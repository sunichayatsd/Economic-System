import Link from "next/link";
import EventNav from "@/components/EventNav";

const FEATURES = {
  "media-plan": {
    kicker: "MEDIA PLANNING",
    title: "Media Plan",
    description: "พื้นที่วางแผนงบประมาณ ช่องทาง และเป้าหมายโฆษณาของ Event นี้",
    sections: [
      ["Budget", "กำหนดงบรวมและงบแยกตามแพลตฟอร์ม"],
      ["Channel Mix", "วางสัดส่วน Meta, Google และ TikTok"],
      ["KPI & Pacing", "ติดตามเป้าหมายและการใช้งบเทียบกับแผน"],
    ],
  },
  "ads-suggestion": {
    kicker: "ADS INTELLIGENCE",
    title: "Ads Suggestion",
    description: "พื้นที่สรุปข้อสังเกตและคำแนะนำจากผลโฆษณา ยอดขาย และ Media Plan ของ Event นี้",
    sections: [
      ["Performance Signals", "ตรวจสัญญาณสำคัญจาก Spend, Pacing และผลลัพธ์ของแต่ละช่องทาง"],
      ["Budget Suggestion", "เสนอแนวทางจัดสรรงบโดยอ้างอิงข้อมูลจริงและงบคงเหลือ"],
      ["Action Review", "แสดงคำแนะนำให้ตรวจสอบก่อนนำไปปรับ Campaign จริง"],
    ],
  },
  "total-tickets": {
    kicker: "TICKET PERFORMANCE",
    title: "Total Tickets",
    description: "พื้นที่รวมยอดบัตร รายได้ และแนวโน้มยอดขายของ Event นี้",
    sections: [
      ["Paid Tickets", "สรุปจำนวนบัตรที่ชำระเงินแล้ว"],
      ["Revenue", "รวมรายได้จริงจากไฟล์ Zipevent"],
      ["Sales Trend", "ดูยอดขายแยกตามวันและประเภทบัตร"],
    ],
  },
  "social-listening": {
    kicker: "SOCIAL INTELLIGENCE",
    title: "Social Listening",
    description: "พื้นที่ติดตามเสียงพูดถึง กระแส และประเด็นสำคัญของ Event นี้",
    sections: [
      ["Mentions", "รวมจำนวนการพูดถึงจากช่องทางที่เชื่อมต่อ"],
      ["Sentiment", "ดูสัดส่วนความคิดเห็นเชิงบวก กลาง และลบ"],
      ["Topics", "สรุปหัวข้อและคำที่ถูกพูดถึงมากที่สุด"],
    ],
  },
};

export default function EventFeaturePage({ edition, feature }) {
  const content = FEATURES[feature];

  return <main className="wrap feature-page">
    <section className="feature-intro card">
      <p className="sync-kicker">{content.kicker}</p>
      <h2>{content.title}</h2>
      <p>{content.description}</p>
      <span className="feature-status">กำลังเตรียมระบบเชื่อมต่อข้อมูล</span>
    </section>

    <EventNav edition={edition} current={feature} />

    <section className="feature-grid" aria-label={`${content.title} modules`}>
      {content.sections.map(([title, description], index) => <article className="feature-module card" key={title}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <h3>{title}</h3>
        <p>{description}</p>
        <small>สำหรับ {edition.year}</small>
      </article>)}
    </section>

    <Link className="pivot-link feature-dashboard-link" href={`/event/${edition.slug}`}>← กลับหน้า Dashboard</Link>
  </main>;
}
