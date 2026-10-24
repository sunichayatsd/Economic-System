import { findEdition } from "@/lib/events";
import { hasDb, readEventConfig, writeEventConfig } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OBJECTIVES = new Set(["Awareness", "Video View", "Engagement", "Traffic", "Sales", "กันงบ"]);
const CHANNELS = new Set(["Facebook", "Instagram", "Google PMAX", "Google Search", "Google Display", "Google Demand Gen", "YouTube"]);
const defaults = () => [
  { id: crypto.randomUUID(), objective: "Awareness", channel: "Facebook", budget: 0 },
  { id: crypto.randomUUID(), objective: "Engagement", channel: "Instagram", budget: 0 },
  { id: crypto.randomUUID(), objective: "Traffic", channel: "Facebook", budget: 0 },
  { id: crypto.randomUUID(), objective: "Sales", channel: "Google PMAX", budget: 0 },
];

const cleanRows = rows => (Array.isArray(rows) ? rows : []).slice(0, 100).map((row, index) => {
  const objective = OBJECTIVES.has(row.objective) ? row.objective : "Awareness";
  const channel = row.channel === "PMAX" ? "Google PMAX" : row.channel;
  return {
    id: String(row.id || `row-${index + 1}`).slice(0, 80),
    objective,
    channel: objective === "กันงบ"
      ? String(row.channel || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120)
      : (CHANNELS.has(channel) ? channel : "Facebook"),
    budget: Math.max(0, Number(row.budget) || 0),
  };
});

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  const edition = findEdition(slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  const saved = await readEventConfig(slug);
  const plan = saved?.config?.mediaPlan;
  const rows = cleanRows(plan?.rows);
  return Response.json(
    { storage: hasDb(), rows: rows.length ? rows : defaults(), updatedAt: plan?.updatedAt || null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const rows = cleanRows(body.rows);
  if (!rows.length) return Response.json({ error: "Media Plan ต้องมีอย่างน้อย 1 แถว" }, { status: 400 });
  const updatedAt = new Date().toISOString();
  const saved = await writeEventConfig(edition.slug, { mediaPlan: { rows, updatedAt } });
  return Response.json({ rows, updatedAt, saved });
}
