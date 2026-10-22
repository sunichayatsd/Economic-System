"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const dimensionOptions = [
  ["day", "วันขาย"],
  ["type", "ประเภทบัตร"],
  ["ref", "ref code / CTA"],
];
const labelFor = (ticket, dimension) => {
  if (dimension === "day") return ticket.day;
  if (dimension === "type") return ticket.type || "(ไม่ระบุประเภท)";
  return ticket.ref || "(ไม่มี ref)";
};
const formatNumber = n => Math.round(n).toLocaleString("en-US");
const formatValue = (value, metric) => metric === "revenue" ? `฿${formatNumber(value)}` : formatNumber(value);
const csvCell = value => `"${String(value).replace(/"/g, '""')}"`;

export default function PivotTable({ edition }) {
  const [tickets, setTickets] = useState(null);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState(["", ""]);
  const [rowDimension, setRowDimension] = useState("day");
  const [columnDimension, setColumnDimension] = useState("type");
  const [metric, setMetric] = useState("tickets");

  useEffect(() => {
    fetch(`/api/uploads?slug=${edition.slug}`)
      .then(r => r.json())
      .then(data => {
        if (!data.storage) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
        if (!data.upload) { setMessage("ยังไม่มีไฟล์ Zipevent ที่บันทึกไว้ กรุณาอัปโหลดจากหน้าแดชบอร์ดก่อน"); return; }
        const saved = typeof data.upload.tickets === "string" ? JSON.parse(data.upload.tickets) : data.upload.tickets;
        if (!Array.isArray(saved)) throw new Error("รูปแบบข้อมูลที่บันทึกไว้ไม่ถูกต้อง");
        setTickets(saved);
        setRange([data.upload.first_day, data.upload.last_day]);
      })
      .catch(error => setMessage(error.message || "โหลดข้อมูลไม่สำเร็จ"));
  }, [edition.slug]);

  const pivot = useMemo(() => {
    if (!tickets || !range[0] || !range[1]) return null;
    const paid = tickets.filter(t => t.paid && t.day >= range[0] && t.day <= range[1]);
    const rows = [...new Set(paid.map(t => labelFor(t, rowDimension)))].sort((a, b) => a.localeCompare(b, "th"));
    const columns = [...new Set(paid.map(t => labelFor(t, columnDimension)))].sort((a, b) => a.localeCompare(b, "th"));
    const values = new Map();
    for (const ticket of paid) {
      const row = labelFor(ticket, rowDimension);
      const column = labelFor(ticket, columnDimension);
      const key = `${row}\u0000${column}`;
      values.set(key, (values.get(key) || 0) + (metric === "revenue" ? Number(ticket.price || 0) : 1));
    }
    const at = (row, column) => values.get(`${row}\u0000${column}`) || 0;
    const total = paid.reduce((sum, ticket) => sum + (metric === "revenue" ? Number(ticket.price || 0) : 1), 0);
    return { paid, rows, columns, at, total };
  }, [tickets, range, rowDimension, columnDimension, metric]);

  function downloadCsv() {
    if (!pivot) return;
    const headers = [dimensionOptions.find(x => x[0] === rowDimension)?.[1], ...pivot.columns, "รวม"];
    const lines = pivot.rows.map(row => {
      const values = pivot.columns.map(column => pivot.at(row, column));
      return [row, ...values, values.reduce((sum, value) => sum + value, 0)];
    });
    const totals = ["รวม", ...pivot.columns.map(column => pivot.rows.reduce((sum, row) => sum + pivot.at(row, column), 0)), pivot.total];
    const csv = "\ufeff" + [headers, ...lines, totals].map(line => line.map(csvCell).join(",")).join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    anchor.download = `${edition.slug}-pivot-${metric}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return <main className="wrap">
    <div className="pivot-head">
      <div>
        <h2>Pivot ยอดขาย (ทดลอง)</h2>
        <p className="muted">สรุปจาก Paid Ticket ในไฟล์ Zipevent ที่บันทึกไว้ — เปลี่ยนมิติและดาวน์โหลด CSV ได้ทันที</p>
      </div>
      <Link className="ghost pivot-back" href={`/event/${edition.slug}`}>← กลับหน้าแดชบอร์ด</Link>
    </div>

    {message && <section className="card"><p className="err">{message}</p><Link className="primary pivot-back" href={`/event/${edition.slug}`}>ไปอัปโหลดไฟล์ Zipevent</Link></section>}
    {!message && !pivot && <section className="card"><p className="muted">กำลังโหลดข้อมูลยอดขาย…</p></section>}
    {pivot && <>
      <section className="card pivot-controls">
        <label>ตั้งแต่ <input type="date" value={range[0]} onChange={event => setRange([event.target.value, range[1]])} /></label>
        <label>ถึง <input type="date" value={range[1]} onChange={event => setRange([range[0], event.target.value])} /></label>
        <label>แถว
          <select value={rowDimension} onChange={event => {
            const next = event.target.value;
            setRowDimension(next);
            if (next === columnDimension) setColumnDimension(dimensionOptions.find(([value]) => value !== next)?.[0] || "day");
          }}>
            {dimensionOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>คอลัมน์
          <select value={columnDimension} onChange={event => setColumnDimension(event.target.value)}>
            {dimensionOptions.filter(([value]) => value !== rowDimension).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>ตัววัด
          <select value={metric} onChange={event => setMetric(event.target.value)}>
            <option value="tickets">จำนวนบัตร</option>
            <option value="revenue">Revenue</option>
          </select>
        </label>
        <button className="primary" onClick={downloadCsv}>ดาวน์โหลด CSV</button>
      </section>

      <section className="card">
        <div className="pivot-summary"><span>{metric === "revenue" ? "Revenue รวม" : "Paid Ticket รวม"}</span><b>{formatValue(pivot.total, metric)}</b><small>{formatNumber(pivot.paid.length)} รายการบัตร</small></div>
        <div className="tbl">
          <table>
            <thead><tr><th>{dimensionOptions.find(x => x[0] === rowDimension)?.[1]}</th>{pivot.columns.map(column => <th key={column}>{column}</th>)}<th>รวม</th></tr></thead>
            <tbody>
              {pivot.rows.map(row => {
                const values = pivot.columns.map(column => pivot.at(row, column));
                return <tr key={row}><td>{row}</td>{values.map((value, index) => <td key={pivot.columns[index]}>{formatValue(value, metric)}</td>)}<td><b>{formatValue(values.reduce((sum, value) => sum + value, 0), metric)}</b></td></tr>;
              })}
              <tr className="tot"><td>รวม</td>{pivot.columns.map(column => <td key={column}>{formatValue(pivot.rows.reduce((sum, row) => sum + pivot.at(row, column), 0), metric)}</td>)}<td>{formatValue(pivot.total, metric)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </main>;
}
