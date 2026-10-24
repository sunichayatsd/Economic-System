import Link from "next/link";

const destinations = [
  ["pivot", "เปิด Pivot Table"],
  ["journey", "Customer Journey"],
  ["media-plan", "Media Plan"],
  ["ads-suggestion", "Ads Suggestion"],
  ["total-tickets", "Total Tickets"],
  ["social-listening", "Social Listening"],
];

export default function EventNav({ edition, current = "" }) {
  return <nav className="event-section-nav" aria-label="เมนูเครื่องมือของ Event">
    {destinations.map(([path, label]) => <Link
      className={`pivot-link${current === path ? " active" : ""}`}
      href={`/event/${edition.slug}/${path}`}
      aria-current={current === path ? "page" : undefined}
      key={path}
    >{label} <span aria-hidden="true">→</span></Link>)}
  </nav>;
}
