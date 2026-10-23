"use client";

import Link from "next/link";

const steps = [
  { route: "/e/economic-forum-2026", title: "Event page", event: "page_view", description: "users viewed", accent: "blue" },
  { route: "/order/edit/", title: "Filling the form", event: "Draft", description: "users started an order", accent: "violet" },
  { route: "/order/payment/", title: "Waiting for payment", event: "WaitingPayment", description: "users saw the QR", accent: "amber" },
  { route: "/order/complete/", title: "Purchase complete", event: "Completed", description: "users paid", accent: "green" },
];

export default function CustomerJourney({ edition }) {
  return <main className="wrap journey-page">
    <div className="journey-head">
      <div>
        <p className="sync-kicker">GOOGLE ANALYTICS 4 · COMING SOON</p>
        <h2>Customer Journey</h2>
        <p className="muted">โครง Funnel ตั้งแต่หน้า Event จนชำระเงินสำเร็จ — รอเชื่อม Google Analytics 4 เพื่อแสดงตัวเลขจริง</p>
      </div>
      <Link className="ghost pivot-back" href={`/event/${edition.slug}`}>← กลับหน้าแดชบอร์ด</Link>
    </div>

    <section className="journey-status card">
      <span className="journey-status-dot" />
      <div><b>ยังไม่ได้เชื่อม Google Analytics 4</b><p>หน้านี้เป็นโครง Journey และชื่อ event สำหรับตรวจสอบ flow ก่อนเชื่อมข้อมูลจริง</p></div>
    </section>

    <section className="journey-grid" aria-label="Customer journey from event page to completed purchase">
      {steps.map((step, index) => <article className={`journey-step ${step.accent}`} key={step.event}>
        <div className="journey-preview" aria-hidden="true">
          <div className="preview-top" />
          <div className="preview-content"><i /><i /><i /></div>
          <div className="preview-action">{index === 3 ? "Complete" : index === 2 ? "Pay now" : index === 1 ? "Continue" : "Buy ticket"}</div>
        </div>
        <code>{step.route}</code>
        <h3>{step.title}</h3>
        <div className="journey-event"><b>{step.event}</b><div><span>TOTAL USERS</span><strong>—</strong></div><div><span>EVENT COUNT</span><strong>—</strong></div></div>
        <p>{step.description}</p>
        {index < steps.length - 1 && <footer><b>—</b> continued <i /> — dropped</footer>}
      </article>)}
    </section>

    <section className="journey-guide card">
      <h3>สิ่งที่จะดึงจาก GA4 เมื่อเชื่อมแล้ว</h3>
      <p>จำนวนผู้ใช้ (Total users), จำนวน Event, อัตราไปต่อ (continued) และจำนวนที่หลุดในแต่ละขั้น โดยอิง event: <code>page_view</code>, <code>Draft</code>, <code>WaitingPayment</code> และ <code>Completed</code></p>
    </section>
  </main>;
}
