"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EventNav from "@/components/EventNav";

const dimensions = [
  ["status", "Order Type"],
  ["ref", "Ref Code / CTA"],
  ["type", "Ticket Type"],
  ["day", "Completed date"],
];
const labelFor = (ticket, dimension) => {
  if (dimension === "status") return ticket.paid ? "Paid" : "Free";
  if (dimension === "type") return ticket.type || "(ไม่ระบุประเภท)";
  if (dimension === "day") return ticket.day;
  return ticket.ref || "(Blank)";
};
const number = value => Math.round(value).toLocaleString("en-US");
const baht = value => `฿${number(value)}`;
const csvCell = value => `"${String(value).replace(/"/g, '""')}"`;

export default function PivotTable({ edition }) {
  const [tickets, setTickets] = useState(null);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState(["", ""]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [primary, setPrimary] = useState("status");
  const [secondary, setSecondary] = useState("ref");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`/api/uploads?slug=${edition.slug}`).then(r => r.json()).then(data => {
      if (!data.storage) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
      if (!data.upload) { setMessage("ยังไม่มีไฟล์ Zipevent ที่บันทึกไว้ กรุณาอัปโหลดจากหน้าแดชบอร์ดก่อน"); return; }
      const saved = typeof data.upload.tickets === "string" ? JSON.parse(data.upload.tickets) : data.upload.tickets;
      if (!Array.isArray(saved)) throw new Error("รูปแบบข้อมูลที่บันทึกไว้ไม่ถูกต้อง");
      setTickets(saved); setRange([data.upload.first_day, data.upload.last_day]);
    }).catch(error => setMessage(error.message || "โหลดข้อมูลไม่สำเร็จ"));
  }, [edition.slug]);

  const pivot = useMemo(() => {
    if (!tickets || !range[0] || !range[1]) return null;
    const needle = query.trim().toLowerCase();
    const filtered = tickets.filter(ticket => ticket.day >= range[0] && ticket.day <= range[1])
      .filter(ticket => orderFilter === "all" || (orderFilter === "paid" ? ticket.paid : !ticket.paid))
      .filter(ticket => !needle || [ticket.ref, ticket.type, ticket.day].some(value => String(value || "").toLowerCase().includes(needle)));
    const groups = new Map();
    for (const ticket of filtered) {
      const first = labelFor(ticket, primary);
      const second = labelFor(ticket, secondary);
      if (!groups.has(first)) groups.set(first, new Map());
      const row = groups.get(first).get(second) || { count: 0, revenue: 0 };
      row.count += 1; row.revenue += Number(ticket.price || 0);
      groups.get(first).set(second, row);
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "th")).map(([name, children]) => ({
      name,
      children: [...children.entries()].sort(([a], [b]) => a.localeCompare(b, "th")).map(([label, values]) => ({ label, ...values })),
    }));
    const total = filtered.reduce((sum, ticket) => ({ count: sum.count + 1, revenue: sum.revenue + Number(ticket.price || 0) }), { count: 0, revenue: 0 });
    return { groups: ordered, total };
  }, [tickets, range, orderFilter, primary, secondary, query]);

  function downloadCsv() {
    if (!pivot) return;
    const primaryLabel = dimensions.find(([value]) => value === primary)?.[1];
    const secondaryLabel = dimensions.find(([value]) => value === secondary)?.[1];
    const rows = [[primaryLabel, secondaryLabel, "Count: Ticket Type", "Sum: Price"]];
    for (const group of pivot.groups) {
      const subtotal = group.children.reduce((sum, row) => ({ count: sum.count + row.count, revenue: sum.revenue + row.revenue }), { count: 0, revenue: 0 });
      group.children.forEach((row, index) => rows.push([index ? "" : group.name, row.label, row.count, row.revenue]));
      rows.push([`${group.name} Total`, "", subtotal.count, subtotal.revenue]);
    }
    rows.push(["รวม", "", pivot.total.count, pivot.total.revenue]);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    anchor.download = `${edition.slug}-pivot.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
  }

  const choosePrimary = value => { setPrimary(value); if (value === secondary) setSecondary(dimensions.find(([candidate]) => candidate !== value)?.[0] || "ref"); };
  return <main className="wrap">
    <div className="pivot-head"><div><h2>Pivot ยอดขาย</h2><p className="muted">รูปแบบเดียวกับ Pivot: นับ Ticket Type และรวม Price ตามข้อมูล Zipevent</p></div><Link className="ghost pivot-back" href={`/event/${edition.slug}`}>← กลับหน้าแดชบอร์ด</Link></div>
    <EventNav edition={edition} current="pivot" />
    {message && <section className="card"><p className="err">{message}</p><Link className="primary pivot-back" href={`/event/${edition.slug}`}>ไปอัปโหลดไฟล์ Zipevent</Link></section>}
    {!message && !pivot && <section className="card"><p className="muted">กำลังโหลดข้อมูลยอดขาย…</p></section>}
    {pivot && <>
      <section className="card pivot-controls">
        <label>Completed date ตั้งแต่ <input type="date" value={range[0]} onChange={event => setRange([event.target.value, range[1]])} /></label>
        <label>ถึง <input type="date" value={range[1]} onChange={event => setRange([range[0], event.target.value])} /></label>
        <label>Order Type<select value={orderFilter} onChange={event => setOrderFilter(event.target.value)}><option value="all">(total)</option><option value="paid">Paid</option><option value="free">Free</option></select></label>
        <label>แถวหลัก<select value={primary} onChange={event => choosePrimary(event.target.value)}>{dimensions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>แถวย่อย<select value={secondary} onChange={event => setSecondary(event.target.value)}>{dimensions.filter(([value]) => value !== primary).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>ค้นหา ref / ประเภท<input className="text pivot-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น Neolix หรือ QR" /></label>
        <button className="primary" onClick={downloadCsv}>ดาวน์โหลด CSV</button>
      </section>
      <section className="card">
        <div className="pivot-summary"><span>รวมทั้งหมด</span><b>{number(pivot.total.count)} ใบ</b><small>Revenue {baht(pivot.total.revenue)}</small></div>
        <div className="tbl"><table className="pivot-table"><thead><tr><th>{dimensions.find(([value]) => value === primary)?.[1]}</th><th>{dimensions.find(([value]) => value === secondary)?.[1]}</th><th>Count: Ticket Type</th><th>Sum: Price</th></tr></thead><tbody>
          {pivot.groups.map(group => {
            const subtotal = group.children.reduce((sum, row) => ({ count: sum.count + row.count, revenue: sum.revenue + row.revenue }), { count: 0, revenue: 0 });
            return <GroupRows group={group} subtotal={subtotal} key={group.name} />;
          })}
          <tr className="tot"><td>รวม</td><td></td><td>{number(pivot.total.count)}</td><td>{baht(pivot.total.revenue)}</td></tr>
        </tbody></table></div>
      </section>
    </>}
  </main>;
}

function GroupRows({ group, subtotal }) {
  return <>
    {group.children.map((row, index) => <tr key={`${group.name}-${row.label}`}><td>{index === 0 ? group.name : ""}</td><td>{row.label}</td><td>{number(row.count)}</td><td>{baht(row.revenue)}</td></tr>)}
    <tr className="pivot-subtotal"><td>{group.name} Total</td><td></td><td>{number(subtotal.count)}</td><td>{baht(subtotal.revenue)}</td></tr>
  </>;
}
