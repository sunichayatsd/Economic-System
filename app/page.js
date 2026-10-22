import Link from "next/link";
import TopBar from "@/components/TopBar";
import { SERIES, EDITIONS } from "@/lib/events";

export default async function Home() {
  const year = new Date().getFullYear();
  return (
    <>
      <TopBar title="เลือก Event" />
      <main className="wrap">
        <div className="series">
          {SERIES.map(s => {
            const eds = EDITIONS.filter(e => e.series === s.key).sort((a, b) => b.year - a.year);
            return (
              <section key={s.key} className="card">
                <h2>{s.name}</h2>
                {eds.length ? (
                  <div className="years">
                    {eds.map(e => <Link key={e.slug} href={`/event/${e.slug}`} className="year">{s.name} {e.year} →</Link>)}
                  </div>
                ) : (
                  <p className="muted">ยังไม่ได้ตั้งค่างานปี {year} — ใส่บัญชีโฆษณาและ prefix แคมเปญใน <code>lib/events.js</code></p>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
