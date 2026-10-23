import { findEdition } from "@/lib/events";
import { configured } from "@/lib/supermetrics";
import { readAdCache, readEventConfig } from "@/lib/db";
import { fetchEdition } from "@/lib/adcache";

export const maxDuration = 60;
const STALE_MS = 6 * 3600e3;

// Served from the cache the morning cron fills; a live Supermetrics pull happens only when the cache is
// older than 6 hours or ?refresh=1 is asked for. A failed pull falls back to the last good cache.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const edition = findEdition(searchParams.get("slug"));
  if (!edition?.metaAccount || !edition?.prefix) return Response.json({ error: "Event นี้ยังไม่ได้ตั้งค่าบัญชีโฆษณา" }, { status: 400 });
  const savedConfig = await readEventConfig(edition.slug).catch(() => null);
  const projectCode = String(savedConfig?.config?.projectCode || edition.prefix || "").trim();
  if (!projectCode) return Response.json({ error: "Event นี้ยังไม่ได้ระบุ QU / Project Code" }, { status: 400 });
  const cached = await readAdCache(edition.slug).catch(() => null);
  const cachedProjectCode = String(cached?.data?.projectCode || edition.prefix || "").trim();
  const sameProject = cachedProjectCode.toLowerCase() === projectCode.toLowerCase();
  const fresh = cached && sameProject && Date.now() - new Date(cached.fetched_at) < STALE_MS;
  // Normal page loads use the cache. An explicit dashboard button press always
  // refreshes so the user can immediately get the latest spend and creative media.
  if (fresh && searchParams.get("refresh") !== "1") return Response.json({ ...cached.data, cached: true });
  if (!configured()) {
    if (cached && sameProject) return Response.json({ ...cached.data, cached: true });
    return Response.json({ error: "ยังไม่ได้ใส่ Supermetrics token ใน Vercel" }, { status: 503 });
  }
  try {
    return Response.json(await fetchEdition(edition));
  } catch (e) {
    if (cached && sameProject) return Response.json({ ...cached.data, cached: true, warning: "ดึงใหม่ไม่สำเร็จ ใช้ข้อมูลล่าสุดที่เก็บไว้" });
    return Response.json({ error: "ดึงข้อมูลจาก Supermetrics ไม่สำเร็จ: " + e.message }, { status: 502 });
  }
}
