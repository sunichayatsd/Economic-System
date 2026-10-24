"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EventNav from "@/components/EventNav";

const OBJECTIVES = ["Awareness", "Video View", "Engagement", "Traffic", "Sales", "กันงบ"];
const OBJECTIVE_GROUPS = [
  { label: "Awareness", objectives: ["Awareness", "Video View"] },
  { label: "Engagement", objectives: ["Engagement"] },
  { label: "Traffic", objectives: ["Traffic"] },
  { label: "Sales", objectives: ["Sales"] },
  { label: "กันงบ", objectives: ["กันงบ"] },
];
const CHANNELS = ["Facebook", "Instagram", "Google PMAX", "Google Search", "Google Display", "Google Demand Gen", "YouTube"];
const money = n => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
const tokenText = value => String(value || "").toLowerCase().replace(/[\s_-]+/g, " ");

function objectiveOf(row) {
  const text = tokenText(row.campaignName || row.adName || "");
  if (/video view|videoview|vdo view/.test(text)) return "Video View";
  if (/awareness|aware|reach/.test(text)) return "Awareness";
  if (/engagement|engage|thruplay/.test(text)) return "Engagement";
  if (/traffic|link click|click/.test(text)) return "Traffic";
  if (/sales|sale|conversion|purchase/.test(text)) return "Sales";
  return "";
}

function channelOf(row) {
  const text = tokenText(`${row.publisherPlatform || ""} ${row.campaignName || row.adName || ""}`);
  if (row.platform === "Meta Ads") {
    if (/instagram|(^| )ig( |$)/.test(text)) return "Instagram";
    if (/facebook|(^| )fb( |$)/.test(text)) return "Facebook";
    return "";
  }
  if (row.platform === "Google Ads") {
    if (/demand gen|demandgen|(^| )dgen( |$)|discovery/.test(text)) return "Google Demand Gen";
    if (/pmax|performance max/.test(text)) return "Google PMAX";
    if (/google search|paid search|(^| )search( |$)|(^| )sem( |$)/.test(text)) return "Google Search";
    if (/google display|(^| )display( |$)|(^| )gdn( |$)/.test(text)) return "Google Display";
    if (/youtube|(^| )yt( |$)|video/.test(text)) return "YouTube";
  }
  return "";
}

export default function MediaPlan({ edition }) {
  const [rows, setRows] = useState([]);
  const [draggingId, setDraggingId] = useState("");
  const [ads, setAds] = useState(null);
  const [note, setNote] = useState("กำลังโหลด Media Plan…");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/media-plan?slug=${encodeURIComponent(edition.slug)}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`/api/ads?slug=${encodeURIComponent(edition.slug)}`).then(r => r.json()),
    ]).then(([plan, adData]) => {
      if (plan.error) throw new Error(plan.error);
      setRows(plan.rows || []);
      if (!adData.error) setAds(adData);
      setNote(plan.updatedAt ? `บันทึกล่าสุด ${new Date(plan.updatedAt).toLocaleString("th-TH")}` : "ยังไม่เคยบันทึกแผนนี้");
    }).catch(error => setNote(error.message));
  }, [edition.slug]);

  const spend = useMemo(() => {
    const grouped = {};
    let unclassified = 0;
    for (const item of ads?.spend || []) {
      const objective = objectiveOf(item), channel = channelOf(item), cost = Number(item.cost) || 0;
      if (!objective || !channel) { unclassified += cost; continue; }
      grouped[`${objective}|${channel}`] = (grouped[`${objective}|${channel}`] || 0) + cost;
    }
    return { grouped, unclassified };
  }, [ads]);

  const actualByRow = useMemo(() => {
    const assigned = new Set();
    return Object.fromEntries(rows.map(row => {
      const key = `${row.objective}|${row.channel}`;
      const actual = assigned.has(key) ? 0 : (spend.grouped[key] || 0);
      assigned.add(key);
      return [row.id, actual];
    }));
  }, [rows, spend]);

  const objectiveTotals = useMemo(() => OBJECTIVE_GROUPS.map(group => {
    const objectiveRows = rows.filter(row => group.objectives.includes(row.objective));
    return {
      objective: group.label,
      budget: objectiveRows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0),
      spent: objectiveRows.reduce((sum, row) => sum + (actualByRow[row.id] || 0), 0),
    };
  }), [rows, actualByRow]);
  const totalBudget = rows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0);
  const allocatedSpend = objectiveTotals.reduce((sum, row) => sum + row.spent, 0);

  const updateRow = (id, key, value) => setRows(current => current.map(row => row.id === id ? { ...row, [key]: value } : row));
  const updateObjective = (row, objective) => setRows(current => current.map(item => item.id === row.id ? {
    ...item,
    objective,
    channel: objective === "กันงบ" ? "" : (CHANNELS.includes(item.channel) ? item.channel : "Facebook"),
  } : item));
  const addRow = () => setRows(current => [...current, { id: crypto.randomUUID(), objective: "Awareness", channel: "Facebook", budget: 0 }]);
  const removeRow = id => setRows(current => current.length > 1 ? current.filter(row => row.id !== id) : current);
  const moveRow = (sourceId, targetId) => setRows(current => {
    const sourceIndex = current.findIndex(row => row.id === sourceId);
    const targetIndex = current.findIndex(row => row.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
    const sourceGroup = OBJECTIVE_GROUPS.find(group => group.objectives.includes(current[sourceIndex].objective));
    const targetGroup = OBJECTIVE_GROUPS.find(group => group.objectives.includes(current[targetIndex].objective));
    if (sourceGroup?.label !== targetGroup?.label) return current;
    const next = [...current];
    const [moved] = next.splice(sourceIndex, 1);
    const insertionIndex = next.findIndex(row => row.id === targetId);
    next.splice(insertionIndex, 0, moved);
    return next;
  });

  async function save() {
    setSaving(true); setNote("กำลังบันทึก…");
    try {
      const response = await fetch("/api/media-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: edition.slug, rows }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setRows(data.rows); setNote("บันทึก Media Plan แล้ว");
    } catch (error) { setNote(error.message); }
    finally { setSaving(false); }
  }

  async function refreshSpend() {
    setRefreshing(true); setNote("กำลังดึงยอด Spend ล่าสุดจาก Supermetrics…");
    try {
      const response = await fetch(`/api/ads?slug=${encodeURIComponent(edition.slug)}&refresh=1`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ดึงยอด Spend ไม่สำเร็จ");
      setAds(data); setNote(`อัปเดต Spend แล้ว ${new Date(data.fetchedAt).toLocaleString("th-TH")}`);
    } catch (error) { setNote(error.message); }
    finally { setRefreshing(false); }
  }

  return <main className="wrap wide-wrap media-plan-page">
    <section className="media-plan-head card">
      <div><p className="sync-kicker">MEDIA PLANNING</p><h2>Media Plan</h2><p>ปรับงบตามสถานการณ์จริง และเทียบแผนกับยอด Spend จาก Supermetrics</p></div>
      <div className="media-plan-actions">
        <button className="ghost" type="button" onClick={addRow}>+ เพิ่มแถว</button>
        <button className="ghost" type="button" disabled={refreshing} onClick={refreshSpend}>{refreshing ? "กำลังอัปเดต…" : "อัปเดตยอด Spend"}</button>
        <button className="primary" type="button" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก…" : "บันทึก Media Plan"}</button>
      </div>
    </section>

    <EventNav edition={edition} current="media-plan" />

    <section className="media-plan-summary">
      <div className="card"><span>Plan Budget</span><b>฿{money(totalBudget)}</b></div>
      <div className="card"><span>Amount Spend ที่จับคู่ได้</span><b>฿{money(allocatedSpend)}</b></div>
      <div className="card"><span>Overall Pacing</span><b>{totalBudget ? `${(allocatedSpend / totalBudget * 100).toFixed(1)}%` : "—"}</b></div>
      <div className={`card${spend.unclassified ? " media-plan-warning" : ""}`}><span>Spend ที่ยังไม่จัดหมวด</span><b>฿{money(spend.unclassified)}</b></div>
    </section>

    <section className="card media-plan-table-card">
      <div className="media-plan-table-wrap"><table className="media-plan-table">
        <thead><tr><th aria-label="สลับลำดับ" /><th>Objective</th><th>Channel</th><th>Budget</th><th>Amount Spend</th><th>Remaining</th><th>Pacing</th><th aria-label="จัดการ" /></tr></thead>
        <tbody>
          {OBJECTIVE_GROUPS.flatMap(group => {
            const objectiveRows = rows.filter(row => group.objectives.includes(row.objective));
            if (!objectiveRows.length) return [];
            const subtotal = objectiveTotals.find(total => total.objective === group.label);
            return [
              ...objectiveRows.map(row => {
                const actual = actualByRow[row.id] || 0;
                const budget = Number(row.budget) || 0;
                return <tr key={row.id} className={draggingId === row.id ? "is-dragging" : ""} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); moveRow(event.dataTransfer.getData("text/plain") || draggingId, row.id); setDraggingId(""); }}>
                  <td><button type="button" className="media-plan-drag" draggable onDragStart={event => { setDraggingId(row.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.id); }} onDragEnd={() => setDraggingId("")} aria-label={`ลากเพื่อสลับลำดับ ${row.objective} ${row.channel}`} title="ลากเพื่อสลับลำดับ">⠿</button></td>
                  <td><select value={row.objective} onChange={event => updateObjective(row, event.target.value)}>{OBJECTIVES.map(value => <option key={value}>{value}</option>)}</select></td>
                  <td>{row.objective === "กันงบ"
                    ? <input className="media-plan-label-input" type="text" maxLength="120" placeholder="ระบุว่างบค่าอะไร" value={row.channel} onChange={event => updateRow(row.id, "channel", event.target.value)} />
                    : <select value={row.channel} onChange={event => updateRow(row.id, "channel", event.target.value)}>{CHANNELS.map(value => <option key={value}>{value}</option>)}</select>}
                  </td>
                  <td><input type="number" min="0" step="100" value={row.budget} onChange={event => updateRow(row.id, "budget", event.target.value)} /></td>
                  <td>฿{money(actual)}</td><td className={budget - actual < 0 ? "over-budget" : ""}>฿{money(budget - actual)}</td>
                  <td className={budget && actual / budget > 1 ? "over-budget" : ""}>{budget ? `${(actual / budget * 100).toFixed(1)}%` : "—"}</td>
                  <td><button type="button" className="media-plan-remove" onClick={() => removeRow(row.id)} aria-label="ลบแถว">×</button></td>
                </tr>;
              }),
              <tr className="media-plan-subtotal" key={`${group.label}-total`}><td /><td colSpan="2">{group.label} Total</td><td>฿{money(subtotal.budget)}</td><td>฿{money(subtotal.spent)}</td><td>฿{money(subtotal.budget - subtotal.spent)}</td><td>{subtotal.budget ? `${(subtotal.spent / subtotal.budget * 100).toFixed(1)}%` : "—"}</td><td /></tr>,
            ];
          })}
        </tbody>
        <tfoot><tr><td /><td colSpan="2">Grand Total</td><td>฿{money(totalBudget)}</td><td>฿{money(allocatedSpend)}</td><td>฿{money(totalBudget - allocatedSpend)}</td><td>{totalBudget ? `${(allocatedSpend / totalBudget * 100).toFixed(1)}%` : "—"}</td><td /></tr></tfoot>
      </table></div>
      <div className="media-plan-foot"><p className={note.includes("ไม่") ? "err" : "muted"}>{note}</p><p className="muted">Spend จับคู่จากชื่อ Campaign กับ Objective และ Channel เท่านั้น เช่น QU-XXXX_Sales_Google PMAX รายการที่ระบุไม่ได้จะอยู่ใน “Spend ที่ยังไม่จัดหมวด” เพื่อไม่เดาตัวเลข</p></div>
    </section>

    <Link className="pivot-link feature-dashboard-link" href={`/event/${edition.slug}`}>← กลับหน้า Dashboard</Link>
  </main>;
}
