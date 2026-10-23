"use client";
// The Zip export is parsed here in the browser: names, emails and phone numbers never leave the page.
// Only Meta ad data comes from the server (/api/ads → Supermetrics).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import { attribute, capacityOk, creativeFromAdName, creativeForRef } from "@/lib/engine";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const num = n => Math.round(n).toLocaleString("en-US");
const baht = n => "฿" + num(n);
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
const pad = n => String(n).padStart(2, "0");
const sameCreative = (a, b) => {
  const left = String(a).toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
  const right = String(b).toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
  return left === right || left.startsWith(right) || right.startsWith(left);
};
const simpleCreativeFor = (order, edition) => {
  if (!order.ref) return "";
  const mapped = (edition.adRefCodes || {})[order.ref] || creativeForRef(order.ref, edition);
  if (mapped) return mapped;
  // A CTA that is genuinely from an ad may be new and not yet named in
  // refCreative. Count it, but never turn ordinary website/unknown links into
  // ad-attributed sales merely because an ad happened to be running.
  return /^ad-/i.test(order.ref) ? "CTA Ad / ยังไม่ระบุชิ้นงาน" : "";
};
const platformForRef = ref => {
  const value = String(ref || "").toLowerCase();
  if (value === "qr-spot-vdo") return "YouTube";
  if (value.startsWith("ad-fb-") || value.startsWith("ad-ig-")) return "Meta";
  if (value.startsWith("ad-gg-")) return "Google Ads";
  if (value.startsWith("ad-tik-") || value.startsWith("ad-tt-")) return "TikTok";
  return "";
};
function PlatformBadge({ platform }) {
  const label = platform === "Google Ads" ? "Google Ads" : platform;
  const icon = platform === "YouTube" ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/><path d="m10 9 5 3-5 3Z" fill="white"/></svg>
    : platform === "Google Ads" ? <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M23 78 52 24" stroke="#fbbc04" strokeWidth="18" strokeLinecap="round"/><path d="m52 24 29 54" stroke="#4285f4" strokeWidth="18" strokeLinecap="round"/><circle cx="23" cy="78" r="10" fill="#34a853"/></svg>
    : platform === "TikTok" ? <span className="platform-note">♪</span>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#1877f2"/><path d="M14.2 20v-7h2.4l.4-2.8h-2.8V8.4c0-.8.2-1.4 1.4-1.4H17V4.5a19 19 0 0 0-2-.1c-2.1 0-3.5 1.3-3.5 3.6v2.2H9v2.8h2.5v7Z" fill="white"/></svg>;
  return <span className={`platform-badge platform-${platform.toLowerCase().replace(/\s+/g, "-")}`} title={label} aria-label={label}>{icon}</span>;
}
const SIMPLE_TIERS = [
  { key: "CTA แอดในช่วงแอดรัน", color: "#2a62d6" },
  { key: "ยอดอื่นๆ / ไม่เข้าเกณฑ์", color: "#d6d4cc" },
];
const TIERS = [
  { key: "Ref Ad", color: "#2a62d6", note: "คลิกลิงก์แอด / สแกน QR" },
  { key: "Ref Org from Ad", color: "#58a0f0", note: "ลิงก์ออร์แกนิก + Ad ID จาก Meta" },
  { key: "Direct Ads", color: "#9cc6f7", note: "ไม่มี ref + Ad ID จาก Meta" },
  { key: "ไม่ได้มาจากแอด", color: "#d6d4cc", note: "Organic / Direct Organic" },
];

function expandWindows(windows = []) {
  const set = new Set();
  for (const [a, b] of windows) {
    for (let t = new Date(a.replace(" ", "T") + ":00:00Z"); t <= new Date(b.replace(" ", "T") + ":00:00Z"); t = new Date(+t + 3600e3))
      set.add(t.toISOString().slice(0, 10) + " " + t.toISOString().slice(11, 13));
  }
  return set;
}

// Ads Manager export with the "Time of day (ad account time zone)" breakdown → hours with impressions
function parseAdsExport(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
  const hdr = rows[0].map(h => String(h).trim().toLowerCase());
  const find = (...ns) => { for (const n of ns) { const i = hdr.findIndex(h => h === n || h.includes(n)); if (i >= 0) return i; } return -1; };
  const cd = find("day", "date", "reporting starts"), ct = find("time of day"), ci = find("impressions");
  if (cd < 0 || ct < 0 || ci < 0) throw new Error("ไฟล์แอดต้องมีคอลัมน์ Day, Time of day และ Impressions");
  const set = new Set();
  for (const r of rows.slice(1)) {
    if (!(parseFloat(String(r[ci]).replace(/,/g, "")) > 0)) continue;
    const s = String(r[cd]); const m = s.match(/(\d{4})-(\d{2})-(\d{2})/) || s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) continue;
    const day = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    set.add(day + " " + String(r[ct]).trim().slice(0, 2));
  }
  return set;
}

function parseZip(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
  const hdr = rows[0].map(h => String(h).trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = hdr.indexOf(n.toLowerCase()); if (i >= 0) return i; } return -1; };
  const c = { oid: col("order id"), done: col("completed date"), type: col("order type"), tkt: col("ticket type"),
              price: col("price (after discount)", "price"), ref: col("ref code") };
  const miss = Object.entries(c).filter(([, i]) => i < 0).map(([k]) => k);
  if (miss.length) throw new Error("ไม่พบคอลัมน์ " + miss.join(", ") + " — ใช่ไฟล์ export จาก Zipevent ไหม");
  return rows.slice(1).filter(r => r[c.oid]).map(r => {
    const m = String(r[c.done]).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})/);
    if (!m) return null;
    return { oid: String(r[c.oid]).trim(), day: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, hour: pad(m[4]),
             paid: String(r[c.type]).trim().toLowerCase() === "paid", type: String(r[c.tkt]).trim() || "(ไม่ระบุ)",
             price: parseFloat(String(r[c.price]).replace(/,/g, "")) || 0, ref: String(r[c.ref] ?? "").trim() };
  }).filter(Boolean);
}

export default function Dashboard({ edition }) {
  const zipInput = useRef(null);
  const [tickets, setTickets] = useState(null);
  const [fileInfo, setFileInfo] = useState("");
  const [ads, setAds] = useState(null);
  const [adsErr, setAdsErr] = useState("");
  const [err, setErr] = useState("");
  const [range, setRange] = useState(["", ""]);
  const [over, setOver] = useState(false);
  const [rule, setRule] = useState("simple");
  const [uploadedHours, setUploadedHours] = useState(null);
  const [saveNote, setSaveNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // The last upload comes back from the database, so the page survives a reload.
  useEffect(() => {
    fetch(`/api/uploads?slug=${edition.slug}`).then(r => r.json()).then(d => {
      if (!d.storage) { setSaveNote("ยังไม่ได้เชื่อมฐานข้อมูล — ปิดหน้าแล้วต้องอัปโหลดใหม่"); return; }
      if (d.upload && !tickets) {
        // `jsonb` can arrive from the server as either an array or a JSON string,
        // depending on the database connection. Normalise it before rendering so
        // a saved Zipevent upload reliably comes back after a browser refresh.
        const t = typeof d.upload.tickets === "string" ? JSON.parse(d.upload.tickets) : d.upload.tickets;
        if (!Array.isArray(t)) throw new Error("รูปแบบข้อมูลที่บันทึกไว้ไม่ถูกต้อง");
        setTickets(t); setRange([d.upload.first_day, d.upload.last_day]);
        setFileInfo(`ไฟล์ล่าสุดที่บันทึกไว้: ${d.upload.file_name} · ${num(d.upload.row_count)} แถว · อัปโหลด ${new Date(d.upload.uploaded_at).toLocaleString("th-TH")}`);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition.slug]);

  async function onFile(f) {
    if (!f) return;
    setErr("");
    try {
      const t = parseZip(await f.arrayBuffer());
      const days = t.map(x => x.day).sort();
      setTickets(t); setFileInfo(`${f.name} · ${num(t.length)} แถว · ${days[0]} ถึง ${days.at(-1)}`);
      setRange([days[0], days.at(-1)]);
      fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: edition.slug, fileName: f.name, tickets: t }) })
        .then(r => r.json()).then(d => setSaveNote(d.storage ? "บันทึกไฟล์นี้ไว้แล้ว (เฉพาะเลขออเดอร์ เวลา ราคา ชนิดบัตร ref — ไม่เก็บชื่อ/อีเมล/เบอร์)" : "ยังไม่ได้เชื่อมฐานข้อมูล — ปิดหน้าแล้วต้องอัปโหลดใหม่"))
        .catch(() => setSaveNote("บันทึกไม่สำเร็จ"));
    } catch (e) { setErr(e.message); }
  }

  function loadAds(refresh) {
    setAdsErr(""); if (refresh) setRefreshing(true);
    return fetch(`/api/ads?slug=${edition.slug}${refresh ? "&refresh=1" : ""}`).then(r => r.json())
      .then(d => (d.error ? setAdsErr(d.error) : setAds(d))).catch(e => setAdsErr(e.message)).finally(() => setRefreshing(false));
  }
  useEffect(() => { if (tickets && !ads) loadAds(false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, edition.slug]);

  const view = useMemo(() => {
    if (!tickets) return null;
    const [from, to] = range;
    const result = attribute(tickets, ads?.purchases || [], edition, { end: to });
    const inR = result.filter(o => o.day >= from && o.day <= to);
    const free = tickets.filter(t => !t.paid && t.day >= from && t.day <= to).length;
    const sumT = a => a.reduce((s, o) => s + o.t, 0), sumV = a => a.reduce((s, o) => s + o.v, 0);
    const strict = inR.filter(o => o.tracked);
    const adHours = ads?.adHours?.length ? new Set(ads.adHours) : uploadedHours || expandWindows(edition.adWindows);
    const during = inR.filter(o => adHours.has(o.day + " " + o.hour));
    const simpleTracked = during.filter(o => simpleCreativeFor(o, edition));
    const simpleTrackedOids = new Set(simpleTracked.map(o => o.oid));
    const tracked = rule === "simple" ? simpleTracked : strict;
    const tierOf = rule === "simple" ? (o => (simpleTrackedOids.has(o.oid) ? "CTA แอดในช่วงแอดรัน" : "ยอดอื่นๆ / ไม่เข้าเกณฑ์"))
                                     : (o => (o.tracked ? o.label : "ไม่ได้มาจากแอด"));
    const refAd = inR.filter(o => o.label === "Ref Ad");
    const byRef = {};
    for (const o of simpleTracked) {
      const k = o.ref ? (edition.adRefCodes || {})[o.ref] || creativeForRef(o.ref, edition) || o.ref : "(ไม่มี ref code)";
      const r = (byRef[k] ||= { name: k, t: 0, v: 0, ad: 0 }); r.t += o.t; r.v += o.v; if (o.label === "Ref Ad") r.ad += o.t;
    }
    const spendIn = (ads?.spend || []).filter(s => s.day >= from && s.day <= to);
    const metaSpendIn = (ads?.metaSpend || []).filter(s => s.day >= from && s.day <= to);
    const spend = spendIn.reduce((a, s) => a + s.cost, 0);
    const metaSpend = metaSpendIn.reduce((a, s) => a + s.cost, 0);
    const metaImpressions = metaSpendIn.reduce((a, s) => a + (s.impressions || 0), 0);
    const spendByPlatform = spendIn.reduce((all, s) => ({ ...all, [s.platform]: (all[s.platform] || 0) + s.cost }), {});

    const days = [];
    for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));

    const byCreative = {};
    const addPlatform = (creative, platform) => {
      if (platform && !creative.platforms.includes(platform)) creative.platforms.push(platform);
    };
    const creativeOrders = rule === "simple" ? simpleTracked : strict;
    for (const o of creativeOrders) {
      const name = rule === "simple" ? simpleCreativeFor(o, edition) : o.creative;
      const c = (byCreative[name] ||= { name, t: 0, v: 0, refAd: 0, org: 0, direct: 0, view: 0, linked: 0, noRef: 0, spend: 0, platforms: [] });
      c.t += o.t; c.v += o.v;
      addPlatform(c, platformForRef(o.ref));
      if (rule === "strict" && o.adId) addPlatform(c, "Meta");
      if (rule === "simple") {
        if (o.ref) c.linked += o.t; else c.noRef += o.t;
      } else {
        if (o.kind === "View") c.view += o.t;
        if (o.label === "Ref Ad") c.refAd += o.t; else if (o.label === "Direct Ads") c.direct += o.t; else c.org += o.t;
      }
    }
    for (const s of metaSpendIn) {
      const name = creativeFromAdName(s.adName);
      const k = Object.keys(byCreative).find(k => k.toLowerCase().replace(/\s/g, "") === name.toLowerCase().replace(/\s/g, "")) || name;
      const c = (byCreative[k] ||= { name: k, t: 0, v: 0, refAd: 0, org: 0, direct: 0, view: 0, linked: 0, noRef: 0, spend: 0, platforms: [] });
      c.spend += s.cost;
      addPlatform(c, "Meta");
    }
    for (const media of ads?.creativeMedia || []) {
      const name = creativeFromAdName(media.adName);
      const k = Object.keys(byCreative).sort((a, b) => b.length - a.length).find(k => sameCreative(k, name));
      if (k && !byCreative[k].imageUrl) {
        byCreative[k].imageUrl = media.imageUrl;
        byCreative[k].fallbackImageUrl = media.fallbackImageUrl || "";
      }
      if (k) addPlatform(byCreative[k], media.videoUrl ? "YouTube" : media.platform === "Google Ads" ? "Google Ads" : "Meta");
    }

    const byType = {};
    for (const o of inR) for (const [ty, n] of Object.entries(o.types)) {
      const r = (byType[ty] ||= { name: ty, t: 0, ad: 0 }); r.t += n; if (o.tracked) r.ad += n;
    }
    const unmapped = [...new Set(strict.filter(o => o.creative.startsWith("ยังไม่ได้จับคู่")).map(o => o.ref))];

    return {
      result, inR, free, tracked, strict, refAd, sumT, sumV, during, simpleTracked, spend, metaSpend, metaImpressions, spendByPlatform, days, tierOf, adHours,
      refs: Object.values(byRef).sort((a, b) => b.t - a.t),
      creatives: Object.values(byCreative).sort((a, b) => b.t - a.t),
      types: Object.values(byType).sort((a, b) => b.t - a.t),
      unmapped, capacity: ads ? capacityOk(result, ads.purchases) : [],
      hoursSource: ads?.adHours?.length ? "Supermetrics (สด)" : uploadedHours ? "ไฟล์ Ads Manager ที่อัปโหลด" : "ข้อมูลที่ตั้งไว้ใน Event",
      metaPurch: (ads?.purchases || []).filter(p => p.day >= from && p.day <= to).reduce((a, p) => a + p.n, 0),
    };
  }, [tickets, ads, range, edition, rule, uploadedHours]);

  async function onAdsFile(f) {
    if (!f) return;
    try { setUploadedHours(parseAdsExport(await f.arrayBuffer())); setErr(""); } catch (e) { setErr(e.message); }
  }

  function downloadLabels() {
    const head = ["Order ID", "Completed date", "Hour", "Tickets", "Value", "Ref Code", "Ads", "Ad ID", "Meta Attribution", "Ad Name", "Creative"];
    const lines = view.result.map(o => [o.oid, o.day, o.hour + ":00", o.t, o.v, o.ref, o.label, o.adId, o.kind || "", o.adName, o.creative || ""]);
    const csv = "﻿" + [head, ...lines].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${edition.slug}-labels.csv`; a.click();
  }

  return (
    <main className="wrap">
      <section className="sync-grid" aria-label="อัปเดตข้อมูล Dashboard">
        <div className={"sync-card zip-sync" + (over ? " over" : "") + (tickets ? " ok" : "")}
          onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}>
          <span className="sync-kicker">1 · ยอดขายบัตร</span>
          <h2>อัปเดตไฟล์ Zipevent</h2>
          <p>อัปโหลด Excel ล่าสุดจาก Zipevent เพื่ออัปเดตยอด Paid Ticket และรายได้</p>
          <button type="button" className="primary" onClick={() => zipInput.current?.click()}>เลือกไฟล์ Zipevent</button>
          <input ref={zipInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => onFile(e.target.files[0])} />
          <small className={err ? "err" : "muted"}>{err || fileInfo || "ข้อมูลที่บันทึกไว้จะกลับมาอัตโนมัติหลัง refresh"}</small>
          {saveNote && <small className="muted">{saveNote}</small>}
        </div>

        <div className="sync-card ads-sync">
          <span className="sync-kicker">2 · ค่าโฆษณา</span>
          <h2>อัปเดตยอด Ads จาก Supermetrics</h2>
          <p>ดึงยอดค่าใช้จ่ายล่าสุดของแคมเปญ Event จากทุก Ads Manager ที่ตั้งค่าไว้</p>
          <button className="primary" disabled={refreshing} onClick={() => loadAds(true)}>
            {refreshing ? "กำลังอัปเดตจาก Supermetrics…" : "อัปเดตยอด Ads"}
          </button>
          <small className={adsErr ? "err" : "muted"}>{adsErr ? "⚠ " + adsErr : ads
            ? <>ข้อมูล {ads.start} – {ads.end} · อัปเดต {new Date(ads.fetchedAt).toLocaleString("th-TH")}{ads.warning ? " · " + ads.warning : ""}{edition.spendSources?.length && !ads.spendComplete ? " · รอข้อมูลบาง Ads Manager" : ""}</>
            : "กดปุ่มเพื่อดึงยอดล่าสุดจาก Supermetrics"}</small>
        </div>
      </section>

      <div className="pivot-entry">
        <Link className="pivot-link" href={`/event/${edition.slug}/pivot`}>เปิด Pivot Table <span aria-hidden="true">→</span></Link>
        <Link className="pivot-link" href={`/event/${edition.slug}/journey`}>Customer Journey <span aria-hidden="true">→</span></Link>
      </div>

      {view && (
        <>
          <div className="toolbar">
            <label>ตั้งแต่ <input type="date" value={range[0]} onChange={e => setRange([e.target.value, range[1]])} /></label>
            <label>ถึง <input type="date" value={range[1]} onChange={e => setRange([range[0], e.target.value])} /></label>
            <div className="seg">
              <button className={rule === "simple" ? "on" : ""} onClick={() => setRule("simple")}>กติกาง่าย: ขายตอนแอดรัน</button>
              <button className={rule === "strict" ? "on" : ""} onClick={() => setRule("strict")} disabled={!ads}>กติกาเข้ม: ต้องมี Ad ID</button>
            </div>
            <button className="ghost" onClick={downloadLabels} disabled={!ads}>ดาวน์โหลดป้ายสำหรับ Lark (CSV)</button>
          </div>

          <h2 className="h">Overall</h2>
          <div className="kpis">
            <Kpi label="ยอดขาย (Paid)" big={num(view.sumT(view.inR))} sub={`${baht(view.sumV(view.inR))} · ไม่นับบัตรฟรี ${num(view.free)} ใบ`} />
            <Kpi hl label={rule === "simple" ? "Ad-tracked (CTA ในช่วงแอดรัน)" : "Ad-tracked (มี Ad ID)"} big={num(view.sumT(view.tracked))} sub={`${pct(view.sumT(view.tracked), view.sumT(view.inR))} ของยอดขาย · ${baht(view.sumV(view.tracked))}`} />
            {rule === "simple"
              ? <Kpi label="Revenue รวม" big={baht(view.sumV(view.inR))} sub={`Paid Ticket ${num(view.sumT(view.inR))} ใบ · ไม่นับบัตรฟรี ${num(view.free)} ใบ`} />
              : <Kpi label="คลิก/สแกนจริง · แค่เห็นแอด" big={`${num(view.sumT(view.tracked.filter(o => o.kind !== "View")))} · ${num(view.sumT(view.tracked.filter(o => o.kind === "View")))}`} sub="เห็น = Meta 1-day view ไม่ได้คลิก" />}
            {edition.spendSources?.length ? (
              <Kpi label="ค่าแอดรวมทุก Ads Manager"
                big={ads?.spendComplete ? baht(view.spend) : "—"}
                sub={ads?.spendComplete
                  ? Object.entries(view.spendByPlatform).map(([p, v]) => `${p} ${baht(v)}`).join(" · ")
                  : ads ? "รอข้อมูลค่าแอดให้ครบทุกแพลตฟอร์มก่อนคำนวณ" : "กำลังดึงค่าแอดทุกแพลตฟอร์ม"} />
            ) : (
              <Kpi label="ค่าแอดรวม Meta" big={ads ? baht(view.spend) : "—"} sub="" />
            )}
            <Kpi label="Cost Per Ticket" big={ads?.spendComplete ? baht(view.spend / Math.max(1, view.sumT(view.inR))) : "—"} sub={ads?.spendComplete ? `ค่าแอดรวม ÷ Paid Ticket ${num(view.sumT(view.inR))} ใบ` : "รอข้อมูลค่าแอดให้ครบทุกแพลตฟอร์มก่อนคำนวณ"} />
          </div>

          <OverallPerformance view={view} ads={ads} rule={rule} />

          <div className="card">
            <h2>Ad-tracked รายวัน</h2>
            {rule === "simple" && <p className="muted small">นับเมื่ออยู่ในช่วงแอดรันและมี ref CTA แอดที่ตั้งค่าไว้ · ช่วงเวลาแอดรันจาก{view.hoursSource} · {num(view.adHours.size)} ชั่วโมง ·{" "}
              <label className="link">อัปโหลดไฟล์ Ads Manager (breakdown Time of day)<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => onAdsFile(e.target.files[0])} /></label></p>}
            <div className="legend">{(rule === "simple" ? SIMPLE_TIERS : TIERS).map(t => <span key={t.key} title={t.note}><i style={{ background: t.color }} />{t.key}</span>)}</div>
            <div className="chart">
              <Bar options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
                scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } } }}
                data={{ labels: view.days.map(d => d.slice(8) + "/" + d.slice(5, 7)),
                  datasets: (rule === "simple" ? SIMPLE_TIERS : TIERS).map(t => ({ label: t.key, backgroundColor: t.color, borderRadius: 2,
                    data: view.days.map(d => view.sumT(view.inR.filter(o => o.day === d && view.tierOf(o) === t.key))) })) }} />
            </div>
          </div>

          {view.creatives.length > 0 && <section className="creative-section">
            <div className="creative-heading"><div><h2>Creative performance</h2><p>{rule === "simple" ? "Paid Ticket ที่อยู่ในช่วงแอดรัน และมี ref CTA แอดที่ผูกกับชิ้นงาน" : "ยอดที่จับคู่ได้จากข้อมูลออเดอร์ด้วย ref หรือ Pixel · รูปจาก Meta Ads และ YouTube assets ผ่าน Supermetrics"}</p></div></div>
            <div className="creative-grid">
              {view.creatives.map(c => <article className="creative-card" key={c.name}>
                <div className="creative-image">
                  {c.imageUrl ? <img src={c.imageUrl} data-fallback={c.fallbackImageUrl} alt={c.name} referrerPolicy="no-referrer" onError={e => {
                    const fallback = e.currentTarget.dataset.fallback;
                    if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                    else e.currentTarget.style.display = "none";
                  }} /> : <span>ไม่มีภาพ Creative</span>}
                </div>
                <div className="creative-body">
                  <div className="creative-title"><h3>{c.name}</h3></div>
                  {c.platforms.length > 0 && <div className="creative-platforms">{c.platforms.map(platform => <PlatformBadge key={platform} platform={platform} />)}</div>}
                  <p className="creative-total"><b>{num(c.t)}</b> {rule === "simple" ? "ยอดจาก CTA แอด" : "ยอดที่จับคู่ได้"} · {baht(c.v)}</p>
                  <p className="creative-breakdown">{rule === "simple" ? `CTA/ref ที่ตั้งค่า ${num(c.linked)}` : `Ref Ad ${num(c.refAd)} · Ref Org from Ad ${num(c.org)} · Direct (Pixel) ${num(c.direct)}`}</p>
                  <div className="creative-range"><span>SELECTED RANGE</span><b>{num(c.t)}</b><small>{range[0]} – {range[1]}</small></div>
                </div>
              </article>)}
            </div>
            {ads?.creativeMediaWarning && <p className="warn">ดึงรูป Creative ไม่ครบ: {ads.creativeMediaWarning}</p>}
          </section>}

          {rule === "simple" && (
            <div className="card">
              <h2>ยอดจาก CTA แอด แยกตามที่มา (ref code)</h2>
              <p className="muted small">นับเฉพาะ ref CTA ที่ตั้งค่าไว้และเกิดในช่วงแอดรัน ไม่รวม Website, ลิงก์อื่น หรือออเดอร์ไม่มี ref</p>
              <div className="tbl"><table>
                <thead><tr><th>ที่มา</th><th>ยอดจาก CTA แอด</th><th>ในนี้คลิกลิงก์แอด</th><th>ยอดเงิน</th></tr></thead>
                <tbody>
                  {view.refs.map(r => <tr key={r.name}><td>{r.name}</td><td>{num(r.t)}</td><td>{num(r.ad)}</td><td>{baht(r.v)}</td></tr>)}
                  <tr className="tot"><td>รวม</td><td>{num(view.sumT(view.simpleTracked))}</td><td>{num(view.refs.reduce((a, r) => a + r.ad, 0))}</td><td>{baht(view.sumV(view.simpleTracked))}</td></tr>
                </tbody>
              </table></div>
            </div>
          )}
          {rule === "strict" && <div className="card">
            <h2>แยกตามชิ้นงาน</h2>
            <div className="tbl"><table>
              <thead><tr><th>ชิ้นงาน</th><th>Ref Ad</th><th>Ref Org from Ad</th><th>Direct Ads</th><th>Ad-tracked</th><th>แค่เห็นแอด</th><th>ยอดเงิน</th><th>ค่าแอด</th><th>ต่อใบ</th></tr></thead>
              <tbody>
                {view.creatives.map(c => (
                  <tr key={c.name}><td>{c.name}</td><td>{c.refAd}</td><td>{c.org}</td><td>{c.direct}</td><td><b>{c.t}</b></td><td>{c.view}</td>
                    <td>{baht(c.v)}</td><td>{c.spend ? baht(c.spend) : "—"}</td><td>{c.spend && c.t ? baht(c.spend / c.t) : "—"}</td></tr>
                ))}
                <tr className="tot"><td>รวม</td>
                  {["refAd", "org", "direct", "t", "view"].map(k => <td key={k}>{num(view.creatives.reduce((a, c) => a + c[k], 0))}</td>)}
                  <td>{baht(view.creatives.reduce((a, c) => a + c.v, 0))}</td><td>{ads ? baht(view.metaSpend) : "—"}</td><td></td></tr>
              </tbody>
            </table></div>
            {view.unmapped.length > 0 && <p className="warn">ref code ของแอดที่ยังไม่รู้ว่าเป็นชิ้นงานไหน: {view.unmapped.map(r => <code key={r}>{r}</code>)} — เพิ่มใน <code>refCreative</code> ของ Event นี้</p>}
          </div>}

          <div className="grid2">
            <div className="card">
              <h2>แยกตามชนิดบัตร</h2>
              <div className="tbl"><table>
                <thead><tr><th>บัตร</th><th>ขาย</th><th>Ad-tracked</th><th>%</th></tr></thead>
                <tbody>{view.types.map(t => <tr key={t.name}><td>{t.name}</td><td>{num(t.t)}</td><td>{num(t.ad)}</td><td>{pct(t.ad, t.t)}</td></tr>)}</tbody>
              </table></div>
            </div>
            <div className="card">
              <h2>ตรวจความถูกต้อง</h2>
              <ul className="checks">
                <li className={view.capacity.length ? "bad" : "good"}>{view.capacity.length ? `มี ${view.capacity.length} ชั่วโมงที่นับเกินจำนวน Purchase ของ Meta` : "ไม่มี Purchase ไหนถูกนับให้ 2 ออเดอร์"}</li>
                <li className={view.unmapped.length ? "bad" : "good"}>{view.unmapped.length ? `ref code แอดที่ยังไม่จับคู่ ${view.unmapped.length} โค้ด` : "ref code แอดทุกตัวจับคู่ชิ้นงานได้"}</li>
                <li>Meta รายงาน Purchase ในช่วงนี้ {num(view.metaPurch)} ครั้ง · จับคู่เป็นออเดอร์ได้ {num(view.strict.filter(o => o.adId).length)} ออเดอร์</li>
              </ul>
            </div>
          </div>

        </>
      )}
    </main>
  );
}

function Kpi({ label, big, sub, hl }) {
  return <div className={"kpi" + (hl ? " hl" : "")}><span>{label}</span><b>{big}</b><small>{sub}</small></div>;
}

function OverallPerformance({ view, ads, rule }) {
  const paid = view.sumT(view.inR);
  const cta = view.sumT(rule === "simple" ? view.simpleTracked : view.tracked);
  const delivery = ads?.funnel || {};
  const impressions = delivery.impressions || view.metaImpressions;
  const reach = delivery.reach || 0;
  const engagement = delivery.engagement || 0;
  const traffic = delivery.linkClicks || 0;
  const platformNames = Object.keys(ads?.funnelByPlatform || {}).join(" + ") || "Meta Ads";
  const mediaSource = ads?.funnelComplete ? platformNames : `${platformNames} · รอข้อมูลบางแพลตฟอร์ม`;
  const ctaLabel = rule === "simple" ? "ยอดบัตรผ่าน CTA แอด" : "ยอดบัตรที่จับคู่กับแอด";
  return <section id="customer-journey" className="performance card">
    <div className="performance-head"><div><h2>Overall Performance</h2><p>Funnel ที่บอกชัดว่าแต่ละ metric อยู่ขั้นไหน ตั้งแต่การมองเห็นจนถึงยอดขาย</p></div><span className="performance-range">SELECTED RANGE</span></div>
    <div className="performance-layout">
      <FunnelGraphic />
      <div className="performance-metric-list">
        <PerformanceMetric level="visibility" label="Impression" value={impressions} source={mediaSource} />
        <PerformanceMetric level="visibility" label="Reach" value={reach} source={`${mediaSource} · ผู้ชมอาจซ้ำข้ามแพลตฟอร์ม`} />
        <PerformanceMetric level="engagement" label="Engagement" value={engagement} source={mediaSource} />
        <PerformanceMetric level="traffic" label="Clicks to Zipevent" value={traffic} source={mediaSource} />
        <div className="sales-metrics"><PerformanceMetric level="sales" label="Sales" value={paid} source="Paid Ticket · ช่วงวันที่เลือก" /><PerformanceMetric level="sales" label="Sales (Ad Tracked)" value={cta} source={rule === "simple" ? "CTA ในช่วงแอดรัน" : "จับคู่ด้วย Ad ID"} /></div>
      </div>
    </div>
    <p className="performance-note">Visibility, Engagement และ Traffic รวมจาก Ads Manager ที่ดึงสำเร็จ; Reach เป็นผลรวมรายแพลตฟอร์ม จึงอาจมีผู้ชมซ้ำข้ามแพลตฟอร์ม. Sales มาจากไฟล์ Zipevent. “CTA” เป็นการนับตาม ref CTA และช่วงเวลาแอดรัน{ads?.funnelWarning ? " · บาง metric รอ Supermetrics ตอบกลับ" : ""}</p>
  </section>;
}

function PerformanceMetric({ level, label, value, source }) {
  return <div className={`performance-metric ${level}`}><span>{label}</span><b>{value ? num(value) : "—"}</b><small>{source}</small></div>;
}

function FunnelGraphic() {
  const stages = [
    { points: "18,8 582,8 445,164 155,164", color: "#dce9ff", title: "awareness" },
    { points: "155,164 445,164 378,239 222,239", color: "#a8c8fb", title: "engagement" },
    { points: "222,239 378,239 326,314 274,314", color: "#5e92e4", title: "traffic" },
    { points: "274,314 326,314 307,390 293,390", color: "#245fb8", title: "sales" },
  ];
  return <div className="funnel-svg" aria-label="ภาพรวมเส้นทางยอดขาย">
    <svg viewBox="0 0 600 412" role="img" aria-label="Funnel จาก Awareness ถึง Sales">
      {stages.map(stage => <polygon key={stage.title} points={stage.points} fill={stage.color} />)}
    </svg>
  </div>;
}
