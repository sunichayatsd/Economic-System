"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const presentation = [
  { title: "Event page", description: "users viewed", accent: "blue", action: "Buy ticket", imageUrl: "/journey/economic-2026/event-page.png" },
  { title: "Filling the form", description: "users started an order", accent: "violet", action: "Continue", imageUrl: "/journey/economic-2026/filling-form.png" },
  { title: "Waiting for payment", description: "users saw the QR", accent: "amber", action: "Pay now", imageUrl: "/journey/economic-2026/waiting-payment.png" },
  { title: "Purchase complete", description: "users paid", accent: "green", action: "Complete", imageUrl: "/journey/economic-2026/purchase-complete.png" },
];
const num = value => Number(value || 0).toLocaleString("en-US");
const initialConfig = edition => ({ propertyId: "", steps: [
  { label: "Event page", event: "View", path: `/e/${edition.series === "economic" ? "economic-forum" : edition.series}-${edition.year}` },
  { label: "Filling the form", event: "Draft", path: "" },
  { label: "Waiting for payment", event: "WaitingPayment", path: "" },
  { label: "Purchase complete", event: "Completed", path: "" },
] });

export default function CustomerJourney({ edition }) {
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const [range, setRange] = useState([edition.start, edition.end < yesterday ? edition.end : yesterday]);
  const [config, setConfig] = useState(() => initialConfig(edition));
  const [report, setReport] = useState(null);
  const [integration, setIntegration] = useState({ loading: true, storage: false, directConfigured: false });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const autoRequestRef = useRef("");
  const requestIdRef = useRef(0);
  const reportRangeMatches = Boolean(report && report.startDate === range[0] && report.endDate === range[1]);

  useEffect(() => {
    fetch(`/api/analytics?slug=${edition.slug}`).then(response => response.json()).then(data => {
      if (data.error) throw new Error(data.error);
      const defaults = initialConfig(edition);
      setConfig({ ...defaults, ...data.config, steps: defaults.steps.map((step, index) => ({ ...step, ...(data.config?.steps?.[index] || {}) })) });
      setReport(data.report || null);
      if (data.report?.startDate && data.report?.endDate) setRange([data.report.startDate, data.report.endDate]);
      setIntegration({ loading: false, storage: data.storage, directConfigured: data.directConfigured, fetchedAt: data.fetchedAt });
    }).catch(error => { setIntegration({ loading: false, storage: false, directConfigured: false }); setNote(error.message || "โหลดการตั้งค่า GA4 ไม่สำเร็จ"); });
  }, [edition]);

  const cards = useMemo(() => presentation.map((item, index) => ({ ...config.steps[index], ...item, stats: reportRangeMatches ? report?.steps?.[index] || null : null })), [config, report, reportRangeMatches]);
  const editStep = (index, key, value) => setConfig(current => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));
  const changeRange = nextRange => { requestIdRef.current += 1; setRange(nextRange); setNote(""); };

  async function saveConfig() {
    setSaving(true); setNote("");
    try {
      const response = await fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: edition.slug, config }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setConfig(data.config); setNote("บันทึกการตั้งค่า GA4 แล้ว");
      return true;
    } catch (error) { setNote(error.message || "บันทึกไม่สำเร็จ"); return false; } finally { setSaving(false); }
  }

  async function refreshGa4(saveFirst = true) {
    if (saveFirst && !(await saveConfig())) return;
    const requestId = ++requestIdRef.current;
    const requestedRange = [...range];
    setSaving(true); setNote("");
    try {
      const response = await fetch("/api/analytics", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: edition.slug, startDate: requestedRange[0], endDate: requestedRange[1] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ดึงข้อมูลไม่สำเร็จ");
      if (requestId !== requestIdRef.current) return;
      setReport(data.report); setRange([data.report.startDate, data.report.endDate]); setIntegration(current => ({ ...current, fetchedAt: data.fetchedAt })); setNote("อัปเดตข้อมูล Customer Journey แล้ว");
    } catch (error) { if (requestId === requestIdRef.current) setNote(error.message || "ดึงข้อมูลไม่สำเร็จ"); } finally { if (requestId === requestIdRef.current) setSaving(false); }
  }

  useEffect(() => {
    const key = `${range[0]}:${range[1]}`;
    const validRange = /^\d{4}-\d{2}-\d{2}$/.test(range[0]) && /^\d{4}-\d{2}-\d{2}$/.test(range[1]) && range[0] <= range[1];
    if (integration.loading || !integration.directConfigured || !integration.storage || !validRange || reportRangeMatches || autoRequestRef.current === key) return;
    const timer = setTimeout(() => { autoRequestRef.current = key; refreshGa4(false); }, 650);
    return () => clearTimeout(timer);
  }, [range, integration.loading, integration.directConfigured, integration.storage, reportRangeMatches]);

  return <main className="wrap journey-page">
    <div className="journey-head">
      <div><p className="sync-kicker">GOOGLE ANALYTICS 4 · CUSTOMER JOURNEY</p><h2>Customer Journey</h2><p className="muted">ตั้งค่าแยกตาม Event แล้วดึงตัวเลขตามช่วงเวลาที่เลือก</p></div>
      <Link className="ghost pivot-back" href={`/event/${edition.slug}`}>← กลับหน้าแดชบอร์ด</Link>
    </div>

    <section className="journey-controls" aria-label="ตัวกรอง Customer Journey">
      <label>ช่วงเวลา ตั้งแต่ <input type="date" value={range[0]} onChange={event => changeRange([event.target.value, range[1]])} /></label>
      <label>ถึง <input type="date" value={range[1]} onChange={event => changeRange([range[0], event.target.value])} /></label>
      <button className="primary" disabled={saving || !integration.directConfigured} onClick={() => refreshGa4(true)}>{saving ? "กำลังอัปเดต…" : "อัปเดตจาก GA4"}</button>
      <small>{!integration.directConfigured ? "รอเชื่อม Google Service Account" : saving ? "กำลังดึง Closed Funnel ตามช่วงวันที่ที่เลือก…" : report && !reportRangeMatches ? "เปลี่ยนช่วงวันที่แล้ว — ระบบกำลังอัปเดตอัตโนมัติ" : report ? `ข้อมูลช่วง ${report.startDate} ถึง ${report.endDate} · บันทึกไว้แล้ว` : "ดึงข้อมูลโดยตรงจาก GA4 Data API"}</small>
    </section>

    <details className="ga4-setup card" open={!config.propertyId}>
      <summary>ตั้งค่า Google Analytics 4 สำหรับ Event นี้</summary>
      <p className="muted small">Property ID และชื่อ event จะถูกบันทึกแยกตาม Event เพื่อใช้สร้าง Dashboard ครั้งถัดไปได้เร็วขึ้น</p>
      <div className="ga4-fields">
        <label>GA4 Property ID<input className="text" inputMode="numeric" value={config.propertyId} onChange={event => setConfig(current => ({ ...current, propertyId: event.target.value }))} placeholder="เช่น 123456789" /></label>
        {config.steps.map((step, index) => <fieldset key={step.label}><legend>{step.label}</legend><label>Event name<input className="text" value={step.event} onChange={event => editStep(index, "event", event.target.value)} /></label><label>Page path {index === 0 ? "(คั่นหลาย path ด้วย ,)" : "(ใช้แสดงชื่อหน้า ไม่ใช้กรอง Event)"}<input className="text" value={step.path} onChange={event => editStep(index, "path", event.target.value)} placeholder={index === 0 ? "/e/event-one, /e/event-two" : "เว้นว่างได้"} /></label></fieldset>)}
      </div>
      <div className="ga4-actions"><button className="primary" disabled={saving || !integration.storage} onClick={saveConfig}>{saving ? "กำลังบันทึก…" : "บันทึก Setup"}</button><span className={note.includes("ไม่") || note.includes("สำเร็จ") ? "err" : "muted"}>{note || (integration.loading ? "กำลังตรวจสถานะ…" : integration.storage ? "การตั้งค่านี้จะถูกเก็บในฐานข้อมูล" : "ยังไม่พบฐานข้อมูลสำหรับบันทึก Setup")}</span></div>
    </details>
    {!integration.directConfigured && <section className="journey-status card"><span className="journey-status-dot" /><div><b>ยังไม่ได้เชื่อม Google Analytics 4</b><p>กรอกและบันทึก Setup ได้ก่อน จากนั้นเพิ่ม Service Account แบบอ่านอย่างเดียวใน Vercel จึงจะกดอัปเดตตัวเลขจริงได้</p></div></section>}
    {reportRangeMatches && report?.funnelWarning && <p className="warn journey-warn">{report.funnelWarning}</p>}
    {reportRangeMatches && report?.sequenceNote && <p className="journey-note">{report.sequenceNote}</p>}

    <section className="journey-grid" aria-label="Customer journey from event page to completed purchase">
      {cards.map((step, index) => {
        const next = cards[index + 1]?.stats;
        const hasFunnel = Boolean(step.stats && next && step.stats.users >= next.users);
        const currentUsers = hasFunnel ? step.stats.users : null;
        const nextUsers = hasFunnel ? next.users : null;
        const dropped = hasFunnel ? currentUsers - nextUsers : null;
        const dropRate = hasFunnel && currentUsers ? dropped / currentUsers : null;
        return <article className={`journey-step ${step.accent}`} key={step.label}>
          <div className="journey-preview">{step.imageUrl ? <img src={step.imageUrl} alt={`Touchpoint: ${step.title}`} /> : <><div className="preview-top" /><div className="preview-content"><i /><i /><i /></div><div className="preview-action">{step.action}</div></>}</div>
          <code>{step.path || "ไม่มี Page path filter"}</code><h3>{step.title}</h3>
          <div className="journey-event"><b>{step.event}</b><div><span>ผู้ใช้ใน CLOSED FUNNEL</span><strong>{step.stats ? num(step.stats.users) : "—"}</strong></div><div><span>EVENT COUNT</span><strong>{step.stats ? num(step.stats.count) : "—"}</strong></div></div>
          <p>{step.description}</p>
          {index < cards.length - 1 && <><footer>{hasFunnel ? <><b>{((nextUsers / Math.max(1, currentUsers)) * 100).toFixed(1)}%</b> continued <i /> {num(dropped)} dropped</> : <>— continued <i /> — dropped</>}</footer><div className="journey-connector" aria-label="Drop off"><div><span>Drop off</span><b>{dropRate === null ? "—" : `${(dropRate * 100).toFixed(1)}%`}</b></div><i aria-hidden="true" /></div></>}
        </article>;
      })}
    </section>

    <section className="journey-guide card"><h3>ระบบนี้ทำอะไรได้</h3><p>สร้าง Closed Funnel จาก custom events ของ Zipevent ได้แก่ View → Draft → WaitingPayment → Completed แล้วนับผู้ใช้ที่ผ่านตามลำดับจริง ตัวเลขผู้ใช้จึงลดลงจากซ้ายไปขวาเสมอ ส่วน Event count แสดงจำนวนครั้งที่ Event นั้นเกิดขึ้น และ Completed ใช้วิเคราะห์ขั้นตอนการซื้อ ไม่ใช่ยอดขายบัตรจริง</p></section>
  </main>;
}
