"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const presentation = [
  { title: "Event page", description: "users viewed", accent: "blue", action: "Buy ticket" },
  { title: "Filling the form", description: "users started an order", accent: "violet", action: "Continue" },
  { title: "Waiting for payment", description: "users saw the QR", accent: "amber", action: "Pay now" },
  { title: "Purchase complete", description: "users paid", accent: "green", action: "Complete" },
];
const num = value => Number(value || 0).toLocaleString("en-US");
const initialConfig = edition => ({ propertyId: "", steps: [
  { label: "Event page", event: "page_view", path: `/e/${edition.series === "economic" ? "economic-forum" : edition.series}-${edition.year}` },
  { label: "Filling the form", event: "Draft", path: "" },
  { label: "Waiting for payment", event: "WaitingPayment", path: "" },
  { label: "Purchase complete", event: "Completed", path: "" },
] });

export default function CustomerJourney({ edition }) {
  const [range, setRange] = useState([edition.start, edition.end]);
  const [config, setConfig] = useState(() => initialConfig(edition));
  const [report, setReport] = useState(null);
  const [integration, setIntegration] = useState({ loading: true, storage: false, directConfigured: false });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/analytics?slug=${edition.slug}`).then(response => response.json()).then(data => {
      if (data.error) throw new Error(data.error);
      setConfig(data.config || initialConfig(edition));
      setReport(data.report || null);
      setIntegration({ loading: false, storage: data.storage, directConfigured: data.directConfigured, fetchedAt: data.fetchedAt });
    }).catch(error => { setIntegration({ loading: false, storage: false, directConfigured: false }); setNote(error.message || "โหลดการตั้งค่า GA4 ไม่สำเร็จ"); });
  }, [edition]);

  const cards = useMemo(() => presentation.map((item, index) => ({ ...item, ...config.steps[index], stats: report?.steps?.[index] || null })), [config, report]);
  const editStep = (index, key, value) => setConfig(current => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));

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

  async function refreshGa4() {
    if (!(await saveConfig())) return;
    setSaving(true); setNote("");
    try {
      const response = await fetch("/api/analytics", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: edition.slug, startDate: range[0], endDate: range[1] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ดึงข้อมูลไม่สำเร็จ");
      setReport(data.report); setIntegration(current => ({ ...current, fetchedAt: data.fetchedAt })); setNote("อัปเดตข้อมูล Customer Journey แล้ว");
    } catch (error) { setNote(error.message || "ดึงข้อมูลไม่สำเร็จ"); } finally { setSaving(false); }
  }

  return <main className="wrap journey-page">
    <div className="journey-head">
      <div><p className="sync-kicker">GOOGLE ANALYTICS 4 · CUSTOMER JOURNEY</p><h2>Customer Journey</h2><p className="muted">ตั้งค่าได้แยกตาม Event แล้วดึง Funnel ตามช่วงเวลาที่เลือก</p></div>
      <Link className="ghost pivot-back" href={`/event/${edition.slug}`}>← กลับหน้าแดชบอร์ด</Link>
    </div>

    <section className="journey-controls" aria-label="ตัวกรอง Customer Journey">
      <label>ช่วงเวลา ตั้งแต่ <input type="date" value={range[0]} onChange={event => setRange([event.target.value, range[1]])} /></label>
      <label>ถึง <input type="date" value={range[1]} onChange={event => setRange([range[0], event.target.value])} /></label>
      <button className="primary" disabled={saving || !integration.directConfigured} onClick={refreshGa4}>{saving ? "กำลังอัปเดต…" : "อัปเดตจาก GA4"}</button>
      <small>{integration.directConfigured ? "ดึงข้อมูลโดยตรงจาก GA4 Data API" : "รอเชื่อม Google Service Account"}</small>
    </section>

    <details className="ga4-setup card" open={!config.propertyId}>
      <summary>ตั้งค่า Google Analytics 4 สำหรับ Event นี้</summary>
      <p className="muted small">Property ID และชื่อ event จะถูกบันทึกแยกตาม Event เพื่อใช้สร้าง Dashboard ครั้งถัดไปได้เร็วขึ้น</p>
      <div className="ga4-fields">
        <label>GA4 Property ID<input className="text" inputMode="numeric" value={config.propertyId} onChange={event => setConfig(current => ({ ...current, propertyId: event.target.value }))} placeholder="เช่น 123456789" /></label>
        {config.steps.map((step, index) => <fieldset key={step.label}><legend>{step.label}</legend><label>Event name<input className="text" value={step.event} onChange={event => editStep(index, "event", event.target.value)} /></label><label>Page path {index === 0 ? "(ใช้กรองหน้า Event)" : "(ถ้ามี)"}<input className="text" list={index === 0 ? "event-path-options" : undefined} value={step.path} onChange={event => editStep(index, "path", event.target.value)} placeholder={index === 0 ? "/e/your-event" : "เว้นว่างได้"} /></label></fieldset>)}
      </div>
      <div className="ga4-actions"><button className="primary" disabled={saving || !integration.storage} onClick={saveConfig}>{saving ? "กำลังบันทึก…" : "บันทึก Setup"}</button><span className={note.includes("ไม่") || note.includes("สำเร็จ") ? "err" : "muted"}>{note || (integration.loading ? "กำลังตรวจสถานะ…" : integration.storage ? "การตั้งค่านี้จะถูกเก็บในฐานข้อมูล" : "ยังไม่พบฐานข้อมูลสำหรับบันทึก Setup")}</span></div>
    </details>
    <datalist id="event-path-options"><option value={`/e/economic-forum-${edition.year}`} /><option value={`/e/${edition.slug}`} /><option value="/" /></datalist>

    {!integration.directConfigured && <section className="journey-status card"><span className="journey-status-dot" /><div><b>ยังไม่ได้เชื่อม Google Analytics 4</b><p>กรอกและบันทึก Setup ได้ก่อน จากนั้นเพิ่ม Service Account แบบอ่านอย่างเดียวใน Vercel จึงจะกดอัปเดตตัวเลขจริงได้</p></div></section>}
    {report?.funnelWarning && <p className="warn journey-warn">{report.funnelWarning}</p>}

    <section className="journey-grid" aria-label="Customer journey from event page to completed purchase">
      {cards.map((step, index) => {
        const next = cards[index + 1]?.stats;
        const hasFunnel = step.stats?.funnelUsers !== null && step.stats?.funnelUsers !== undefined && next?.funnelUsers !== null && next?.funnelUsers !== undefined;
        const currentUsers = hasFunnel ? step.stats.funnelUsers : null;
        const nextUsers = hasFunnel ? next.funnelUsers : null;
        const dropped = hasFunnel ? Math.max(0, currentUsers - nextUsers) : null;
        const dropRate = hasFunnel && currentUsers ? dropped / currentUsers : null;
        return <article className={`journey-step ${step.accent}`} key={step.label}>
          <div className="journey-preview" aria-hidden="true"><div className="preview-top" /><div className="preview-content"><i /><i /><i /></div><div className="preview-action">{step.action}</div></div>
          <code>{step.path || "ไม่มี Page path filter"}</code><h3>{step.title}</h3>
          <div className="journey-event"><b>{step.event}</b><div><span>TOTAL USERS</span><strong>{step.stats ? num(step.stats.users) : "—"}</strong></div><div><span>EVENT COUNT</span><strong>{step.stats ? num(step.stats.count) : "—"}</strong></div></div>
          <p>{step.description}</p>
          {index < cards.length - 1 && <><footer>{hasFunnel ? <><b>{((nextUsers / Math.max(1, currentUsers)) * 100).toFixed(1)}%</b> continued <i /> {num(dropped)} dropped</> : <>— continued <i /> — dropped</>}</footer><div className="journey-connector" aria-label="Drop off"><div><span>Drop off</span><b>{dropRate === null ? "—" : `${(dropRate * 100).toFixed(1)}%`}</b></div><i aria-hidden="true" /></div></>}
        </article>;
      })}
    </section>

    <section className="journey-guide card"><h3>ระบบนี้ทำอะไรได้</h3><p>เก็บ GA4 Property ID, Page path และ event ของแต่ละ Event ไว้บนเว็บ จากนั้นดึง Total users และ Event count ตามวันที่เลือกโดยตรงจาก GA4. เมื่อ Funnel API ตอบกลับ ระบบจะคำนวณ continued และ Drop off ตามลำดับผู้ใช้จริง</p></section>
  </main>;
}
