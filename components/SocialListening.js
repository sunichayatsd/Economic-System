"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EventNav from "@/components/EventNav";

const splitTags = value => String(value || "").split(/[,\n]+/).map(tag => tag.trim()).filter(Boolean);
const normalizeTag = value => {
  const text = String(value || "").trim().replace(/^#+/, "").replace(/\s+/g, "");
  return text ? `#${text}` : "";
};

export default function SocialListening({ edition }) {
  const [hashtags, setHashtags] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("กำลังโหลดการตั้งค่า…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/social-listening?slug=${encodeURIComponent(edition.slug)}`, { cache: "no-store" })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "โหลดการตั้งค่าไม่สำเร็จ");
        setHashtags(data.config?.hashtags || []);
        setStatus(data.storage ? (data.updatedAt ? "โหลดการตั้งค่าที่บันทึกไว้แล้ว" : "ยังไม่ได้บันทึก Hashtag") : "ยังไม่ได้เชื่อมฐานข้อมูล");
      }).catch(error => setStatus(error.message));
  }, [edition.slug]);

  const addTags = () => {
    const additions = splitTags(input).map(normalizeTag).filter(Boolean);
    if (!additions.length) return;
    const invalid = additions.find(tag => !/^#[\p{L}\p{N}_]+$/u.test(tag));
    if (invalid) return setStatus(`รูปแบบ ${invalid} ไม่ถูกต้อง — ใช้ตัวอักษร ตัวเลข หรือ _ โดยไม่เว้นวรรค`);
    setHashtags(current => [...new Set([...current, ...additions])].slice(0, 30));
    setInput("");
    setStatus("มีการแก้ไขที่ยังไม่ได้บันทึก");
  };

  const save = async () => {
    if (!hashtags.length) return setStatus("เพิ่มอย่างน้อย 1 Hashtag ก่อนบันทึก");
    setSaving(true); setStatus("กำลังบันทึก…");
    try {
      const response = await fetch("/api/social-listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: edition.slug, hashtags }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setHashtags(data.config.hashtags);
      setStatus("บันทึก Hashtag ของ Event นี้แล้ว");
    } catch (error) { setStatus(error.message); }
    finally { setSaving(false); }
  };

  return <main className="wrap wide-wrap listening-page">
    <section className="feature-intro card listening-intro">
      <p className="sync-kicker">SOCIAL INTELLIGENCE</p>
      <h2>Social Listening</h2>
      <p>กำหนด Hashtag ของ Event เพื่อคัดเฉพาะโพสต์ที่เกี่ยวข้อง ก่อนวิเคราะห์ข้อความและ Comment</p>
      <span className="feature-status">เตรียมพร้อมสำหรับเชื่อม Meta API แบบอ่านอย่างเดียว</span>
    </section>

    <EventNav edition={edition} current="social-listening" />

    <section className="card listening-setup">
      <div className="ticket-section-head"><div><h2>Hashtag Setup</h2><p>เพิ่มได้หลายรายการ ระบบจะเลือกโพสต์ที่ Caption ตรงอย่างน้อย 1 Hashtag</p></div><span>{hashtags.length}/30</span></div>
      <div className="listening-tag-entry">
        <label><span>Hashtag ของ Event</span><input className="text" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTags(); } }} placeholder="#EconomicForum2026, #ReinventThailand" /></label>
        <button type="button" className="secondary" onClick={addTags}>+ เพิ่ม Hashtag</button>
      </div>
      <p className="listening-help">วางหลาย Hashtag พร้อมกันได้โดยคั่นด้วย comma หรือขึ้นบรรทัดใหม่ • ไม่ต้องใส่ # ระบบเติมให้ได้</p>
      <div className="listening-tags" aria-label="Hashtag ที่เลือก">
        {hashtags.map(tag => <span key={tag}>{tag}<button type="button" aria-label={`ลบ ${tag}`} onClick={() => { setHashtags(current => current.filter(item => item !== tag)); setStatus("มีการแก้ไขที่ยังไม่ได้บันทึก"); }}>×</button></span>)}
        {!hashtags.length && <em>ยังไม่มี Hashtag — เพิ่มรายการด้านบน</em>}
      </div>
      <div className="listening-save"><button type="button" className="primary" disabled={saving || !hashtags.length} onClick={save}>{saving ? "กำลังบันทึก…" : "บันทึก Setup"}</button><span>{status}</span></div>
    </section>

    <section className="card listening-preview">
      <div className="ticket-section-head"><div><h2>Post & Comment View</h2><p>โครงหน้าจอหลังเชื่อม Meta API — จะแสดงเฉพาะโพสต์ที่ผ่าน Hashtag Filter</p></div><span>PREVIEW</span></div>
      <div className="listening-post-demo">
        <div className="listening-media"><span>POST IMAGE<br/>OR VIDEO</span></div>
        <article className="listening-post-copy">
          <div className="listening-platform"><i>f</i><div><b>Facebook / Instagram Post</b><small>วันที่โพสต์ · เปิดโพสต์ต้นฉบับ ↗</small></div></div>
          <p>Caption และข้อความของโพสต์จะแสดงบริเวณนี้ พร้อม Hashtag ที่ตรงกับ Setup ของ Event</p>
          <div className="listening-match">Matched: {hashtags.length ? hashtags.slice(0, 3).join("  ") : "—"}</div>
          <div className="listening-sentiment"><span>Positive —</span><span>Neutral —</span><span>Negative —</span></div>
        </article>
        <aside className="listening-comments">
          <h3>Comments</h3>
          {["ข้อความ Comment", "Sentiment และหัวข้อ", "กดตรวจแก้ผลวิเคราะห์ได้"].map((text, index) => <div key={text}><i className={`tone tone-${index}`}></i><span>{text}<small>รอข้อมูลจาก Meta API</small></span></div>)}
        </aside>
      </div>
      <p className="ticket-data-note">ส่วนนี้ยังเป็น Layout Preview จึงไม่มีโพสต์ ตัวเลข หรือ Sentiment สมมติ เมื่อเชื่อม Meta API แล้วระบบจะนำข้อมูลจริงมาแสดงในรูปแบบนี้</p>
    </section>

    <Link className="pivot-link feature-dashboard-link" href={`/event/${edition.slug}`}>← กลับหน้า Dashboard</Link>
  </main>;
}
