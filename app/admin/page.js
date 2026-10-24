import Link from "next/link";
import TopBar from "@/components/TopBar";
import { EDITIONS, editionTitle } from "@/lib/events";
import { hasDb } from "@/lib/db";
import { ALLOWED_DOMAIN } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";

function Status({ ok, label, detail }) {
  return (
    <article className={`admin-status ${ok ? "ok" : "pending"}`}>
      <span>{ok ? "พร้อม" : "ต้องตั้งค่า"}</span>
      <h3>{label}</h3>
      <p>{detail}</p>
    </article>
  );
}

export default async function AdminPage() {
  const user = await requireAdmin();
  const oauthReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const secretReady = Boolean(process.env.NEXTAUTH_SECRET);
  const enforced = process.env.AUTH_ENFORCED === "true";

  return (
    <>
      <TopBar title="Admin Management" back />
      <main className="wrap admin-page">
        <section className="card admin-hero">
          <div>
            <p className="sync-kicker">SYSTEM ADMIN</p>
            <h2>ศูนย์จัดการ Event Dashboard</h2>
            <p>ตรวจสถานะระบบและเปิดงานแต่ละ Event โดยไม่แสดงค่า Secret บนหน้าเว็บ</p>
          </div>
          <div className="admin-identity">
            <span>เข้าสู่ระบบเป็น Admin</span>
            <b>{user.email}</b>
            <small>อนุญาตเฉพาะบัญชี @{ALLOWED_DOMAIN}</small>
          </div>
        </section>

        <h2 className="h">สถานะความปลอดภัย</h2>
        <section className="admin-status-grid">
          <Status ok={oauthReady} label="Google Login" detail={oauthReady ? "พบ Client ID และ Client Secret" : "เพิ่ม GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET"} />
          <Status ok={secretReady} label="Session Secret" detail={secretReady ? "ตั้งค่า NEXTAUTH_SECRET แล้ว" : "เพิ่ม NEXTAUTH_SECRET ก่อนเปิดล็อกเว็บ"} />
          <Status ok={enforced} label="ป้องกัน Dashboard และ API" detail={enforced ? "AUTH_ENFORCED เปิดใช้งานแล้ว" : "ยังไม่ล็อกเว็บ เพื่อป้องกัน Admin ถูกล็อกออก"} />
          <Status ok={hasDb()} label="Database" detail={hasDb() ? "เชื่อมฐานข้อมูลสำหรับบันทึก Setup แล้ว" : "ยังไม่พบ DATABASE_URL"} />
          <Status ok={Boolean(process.env.SUPERMETRICS_MCP_TOKEN)} label="Supermetrics" detail="ตรวจเฉพาะว่ามี Token หรือไม่ โดยไม่เปิดเผยค่า" />
          <Status ok={Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)} label="Google Analytics 4" detail="ตรวจเฉพาะ Service Account โดยไม่เปิดเผย JSON" />
        </section>

        <section className="card admin-events">
          <div>
            <p className="sync-kicker">EVENT MANAGEMENT</p>
            <h2>งานที่ตั้งค่าแล้ว</h2>
          </div>
          <div className="admin-event-list">
            {EDITIONS.map(event => (
              <Link key={event.slug} href={`/event/${event.slug}`}>
                <span>{editionTitle(event)}</span>
                <small>{event.prefix || "ยังไม่มี Project ID"}</small>
                <b>เปิด Dashboard →</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="card admin-coming-soon">
          <h2>User Management</h2>
          <p>เฟสนี้ใช้รายชื่อ Admin จาก <code>ADMIN_EMAILS</code> ก่อน ยังไม่มีหน้าสร้างผู้ใช้หรือแก้สิทธิ์ เพื่อไม่ให้เกิดช่องโหว่จากการจัดการบัญชีบนหน้าเว็บ</p>
        </section>
      </main>
    </>
  );
}
