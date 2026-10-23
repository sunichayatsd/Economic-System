import { findEdition } from "@/lib/events";
import { ga4Configured, journeyReport } from "@/lib/ga4";
import { hasDb, readAnalyticsCache, readAnalyticsConfig, writeAnalyticsCache, writeAnalyticsConfig } from "@/lib/db";

const defaultConfig = edition => ({
  propertyId: "",
  steps: [
    { label: "Event page", event: "View", path: `/e/${edition.series === "economic" ? "economic-forum" : edition.series}-${edition.year}` },
    { label: "Filling the form", event: "Draft", path: "" },
    { label: "Waiting for payment", event: "WaitingPayment", path: "" },
    { label: "Purchase complete", event: "Completed", path: "" },
  ],
});

function cleanConfig(input, edition) {
  const fallback = defaultConfig(edition);
  const inputSteps = Array.isArray(input?.steps) ? input.steps : fallback.steps;
  return {
    propertyId: String(input?.propertyId || "").replace(/\D/g, "").slice(0, 24),
    steps: fallback.steps.map((fallbackStep, index) => {
      const oldEvent = String(inputSteps[index]?.event || fallbackStep.event).trim();
      const migrateLanding = index === 0 && oldEvent === "page_view";
      return {
      label: fallbackStep.label,
      event: (migrateLanding ? "View" : oldEvent).slice(0, 100),
      path: String(migrateLanding ? fallbackStep.path : inputSteps[index]?.path || "").trim().slice(0, 300),
    };
    }),
  };
}

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const edition = findEdition(params.get("slug"));
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  const saved = await readAnalyticsConfig(edition.slug);
  const cached = await readAnalyticsCache(edition.slug);
  const config = cleanConfig(saved?.config || defaultConfig(edition), edition);
  return Response.json({ storage: hasDb(), directConfigured: ga4Configured(), config, configUpdatedAt: saved?.updated_at || null, report: cached?.data || null, fetchedAt: cached?.fetched_at || null });
}

export async function POST(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const config = cleanConfig(body.config, edition);
  const saved = await writeAnalyticsConfig(edition.slug, config);
  return Response.json({ config, saved });
}

export async function PUT(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const saved = await readAnalyticsConfig(edition.slug);
  const config = saved?.config || defaultConfig(edition);
  if (!ga4Configured()) return Response.json({ error: "ยังไม่ได้ใส่ GOOGLE_SERVICE_ACCOUNT_JSON ใน Vercel" }, { status: 503 });
  const startDate = String(body.startDate || edition.start).slice(0, 10);
  const requestedEnd = String(body.endDate || edition.end).slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const endDate = requestedEnd < yesterday ? requestedEnd : yesterday;
  try {
    const report = await journeyReport(config, startDate, endDate);
    await writeAnalyticsCache(edition.slug, report);
    return Response.json({ report, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message || "ดึงข้อมูล GA4 ไม่สำเร็จ" }, { status: 502 });
  }
}
