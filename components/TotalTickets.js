"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import EventNav from "@/components/EventNav";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const number = value => Math.round(Number(value) || 0).toLocaleString("en-US");
const baht = value => `฿${number(value)}`;
const shortDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const COLORS = ["#2a62d6", "#5e92e4", "#174b9a", "#8cb4f2", "#56a985", "#e2a33a", "#965ac4", "#ea6a47"];

export default function TotalTickets({ edition }) {
  const [tickets, setTickets] = useState(null);
  const [range, setRange] = useState(["", ""]);
  const [message, setMessage] = useState("กำลังโหลดข้อมูล Zipevent…");

  useEffect(() => {
    fetch(`/api/uploads?slug=${encodeURIComponent(edition.slug)}`, { cache: "no-store" }).then(response => response.json()).then(data => {
      if (!data.storage) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
      if (!data.upload) throw new Error("ยังไม่มีไฟล์ Zipevent กรุณาอัปโหลดจากหน้า Dashboard ก่อน");
      const saved = typeof data.upload.tickets === "string" ? JSON.parse(data.upload.tickets) : data.upload.tickets;
      if (!Array.isArray(saved)) throw new Error("รูปแบบข้อมูล Zipevent ที่บันทึกไว้ไม่ถูกต้อง");
      setTickets(saved);
      setRange([data.upload.first_day, data.upload.last_day]);
      setMessage("");
    }).catch(error => setMessage(error.message || "โหลดข้อมูลไม่สำเร็จ"));
  }, [edition.slug]);

  const report = useMemo(() => {
    if (!tickets || !range[0] || !range[1]) return null;
    const selected = tickets.filter(ticket => ticket.day >= range[0] && ticket.day <= range[1]);
    const cumulative = tickets.filter(ticket => ticket.day <= range[1]);
    const summary = selected.reduce((total, ticket) => {
      total.all += 1;
      total[ticket.paid ? "paid" : "comp"] += 1;
      total.revenue += Number(ticket.price) || 0;
      return total;
    }, { all: 0, paid: 0, comp: 0, revenue: 0 });

    const types = new Map();
    for (const ticket of cumulative) {
      const name = ticket.type || "(ไม่ระบุประเภท)";
      const row = types.get(name) || { name, cumulative: 0, selected: 0, revenue: 0, paid: 0, comp: 0 };
      row.cumulative += 1;
      if (ticket.day >= range[0]) {
        row.selected += 1;
        row.revenue += Number(ticket.price) || 0;
        row[ticket.paid ? "paid" : "comp"] += 1;
      }
      types.set(name, row);
    }
    const typeRows = [...types.values()].sort((a, b) => b.cumulative - a.cumulative || a.name.localeCompare(b.name, "th"));

    const refs = new Map();
    for (const ticket of selected) {
      const name = ticket.ref || "(Blank / Direct)";
      const row = refs.get(name) || { name, count: 0, revenue: 0 };
      row.count += 1; row.revenue += Number(ticket.price) || 0; refs.set(name, row);
    }
    const refRows = [...refs.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));

    const days = [];
    for (let day = new Date(`${range[0]}T00:00:00Z`); day <= new Date(`${range[1]}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) days.push(day.toISOString().slice(0, 10));
    const leadingTypes = typeRows.slice(0, 7).map(row => row.name);
    const daily = new Map(days.map(day => [day, {}]));
    for (const ticket of selected) {
      const name = leadingTypes.includes(ticket.type || "(ไม่ระบุประเภท)") ? (ticket.type || "(ไม่ระบุประเภท)") : "ประเภทอื่นๆ";
      daily.get(ticket.day)[name] = (daily.get(ticket.day)[name] || 0) + 1;
    }
    const series = [...leadingTypes, ...(selected.some(ticket => !leadingTypes.includes(ticket.type || "(ไม่ระบุประเภท)")) ? ["ประเภทอื่นๆ"] : [])];
    return { summary, typeRows, refRows, days, daily, series };
  }, [tickets, range]);

  const chartData = report ? {
    labels: report.days.map(shortDate),
    datasets: report.series.map((type, index) => ({ label: type, data: report.days.map(day => report.daily.get(day)?.[type] || 0), backgroundColor: COLORS[index % COLORS.length], borderWidth: 0, borderRadius: 2 })),
  } : null;

  return <main className="wrap wide-wrap ticket-page">
    <section className="ticket-head card">
      <div><p className="sync-kicker">TICKET PERFORMANCE</p><h2>Total Tickets</h2><p>สรุปยอดบัตรจากไฟล์ Zipevent ล่าสุด พร้อมแนวโน้มรายวัน ประเภทบัตร และ Ref Code</p></div>
      {report && <div className="ticket-range"><label>ตั้งแต่ <input type="date" value={range[0]} onChange={event => setRange([event.target.value, range[1]])} /></label><label>ถึง <input type="date" value={range[1]} onChange={event => setRange([range[0], event.target.value])} /></label></div>}
    </section>
    <EventNav edition={edition} current="total-tickets" />

    {message && <section className="card"><p className="err">{message}</p><Link className="primary pivot-back" href={`/event/${edition.slug}`}>ไปหน้า Dashboard</Link></section>}
    {report && <>
      <section className="ticket-hero card">
        <div className="ticket-total"><b>{number(report.summary.all)}</b><span>Total Tickets</span><small>{shortDate(range[0])} – {shortDate(range[1])}</small></div>
        <div className="ticket-kpis">
          <article><span>Paid Ticket</span><b>{number(report.summary.paid)}</b></article>
          <article><span>Comp / Free Ticket</span><b>{number(report.summary.comp)}</b></article>
          <article><span>Revenue</span><b>{baht(report.summary.revenue)}</b></article>
          <article className="ticket-setup-needed"><span>Ticket Goal</span><b>ยังไม่ได้ตั้ง</b><small>ต้องเพิ่ม Setup เป้าบัตรของ Event</small></article>
        </div>
      </section>

      <section className="ticket-summary-layout">
        <article className="card ticket-trend-card">
          <div className="ticket-section-head"><div><h2>Ticket Summary</h2><p>ยอดบัตรรายวัน แยกตาม Ticket Type</p></div><span>{number(report.summary.all)} ใบ</span></div>
          <div className="ticket-chart"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom", labels: { boxWidth: 11, usePointStyle: true } }, tooltip: { callbacks: { footer: items => `รวม ${number(items.reduce((sum, item) => sum + item.parsed.y, 0))} ใบ` } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } }} /></div>
        </article>
        <article className="card ticket-side-summary">
          <h2>Selected Range</h2>
          <dl><div><dt>Paid Ticket</dt><dd>{number(report.summary.paid)}</dd></div><div><dt>Comp Ticket</dt><dd>{number(report.summary.comp)}</dd></div><div><dt>Total Ticket</dt><dd>{number(report.summary.all)}</dd></div><div><dt>Revenue</dt><dd>{baht(report.summary.revenue)}</dd></div></dl>
          <p>สถานะ Active / Expired และ Ticket Goal ไม่มีใน Zipevent export จึงยังไม่แสดงตัวเลขสมมติ</p>
        </article>
      </section>

      <section className="card ticket-table-card">
        <div className="ticket-section-head"><div><h2>Ticket Type Summary</h2><p>ยอดสะสมถึงวันสิ้นสุด เทียบยอดในช่วงวันที่เลือก</p></div></div>
        <div className="tbl"><table className="ticket-table"><thead><tr><th>ประเภทบัตร</th><th>Paid</th><th>Comp / Free</th><th>จำนวนสะสม</th><th>ช่วงวันที่เลือก</th><th>Revenue</th></tr></thead><tbody>
          {report.typeRows.map(row => <tr key={row.name}><td>{row.name}</td><td>{number(row.paid)}</td><td>{number(row.comp)}</td><td><b>{number(row.cumulative)}</b></td><td><b className="ticket-period-number">{number(row.selected)}</b></td><td>{baht(row.revenue)}</td></tr>)}
          <tr className="tot"><td>รวมช่วงวันที่เลือก</td><td>{number(report.summary.paid)}</td><td>{number(report.summary.comp)}</td><td>—</td><td>{number(report.summary.all)}</td><td>{baht(report.summary.revenue)}</td></tr>
        </tbody></table></div>
      </section>

      <section className="card ticket-ref-card">
        <div className="ticket-section-head"><div><h2>Ref Code Distribution</h2><p>จำนวนบัตรและรายได้ตาม Ref Code ในช่วงวันที่เลือก</p></div><span>{number(report.refRows.length)} Ref Codes</span></div>
        <div className="ticket-ref-grid">{report.refRows.map(row => <article key={row.name}><span>{row.name}</span><b>{number(row.count)} ใบ</b><small>{baht(row.revenue)}</small></article>)}</div>
        <p className="ticket-data-note">จำนวน Promo Code ที่แจกไม่อยู่ในไฟล์ Zipevent ชุดนี้ จึงแสดงเฉพาะจำนวนที่ใช้จริงผ่าน Ref Code</p>
      </section>
    </>}
    <Link className="pivot-link feature-dashboard-link" href={`/event/${edition.slug}`}>← กลับหน้า Dashboard</Link>
  </main>;
}
