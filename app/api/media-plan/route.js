import { findEdition } from "@/lib/events";
import { hasDb, readEventConfig, writeEventConfig } from "@/lib/db";

const OBJECTIVES = new Set(["Awareness", "Engagement", "Traffic", "Sales"]);
const CHANNELS = new Set(["Facebook", "Instagram", "PMAX", "YouTube"]);
const defaults = () => [
  { id: crypto.randomUUID(), objective: "Awareness", channel: "Facebook", budget: 0 },
  { id: crypto.randomUUID(), objective: "Engagement", channel: "Instagram", budget: 0 },
  { id: crypto.randomUUID(), objective: "Traffic", channel: "Facebook", budget: 0 },
  { id: crypto.randomUUID(), objective: "Sales", channel: "PMAX", budget: 0 },
];

const cleanRows = rows => (Array.isArray(rows) ? rows : []).slice(0, 100).map((row, index) => ({
  id: String(row.id || `row-${index + 1}`).slice(0, 80),
  objective: OBJECTIVES.has(row.objective) ? row.objective : "Awareness",
  channel: CHANNELS.has(row.channel) ? row.channel : "Facebook",
  budget: Math.max(0, Number(row.budget) || 0),
}));

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  const edition = findEdition(slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  const saved = await readEventConfig(slug);
  const rows = cleanRows(saved?.config?.mediaPlan?.rows);
  return Response.json({ storage: hasDb(), rows: rows.length ? rows : defaults(), updatedAt: saved?.updated_at || null });
}

export async function POST(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const rows = cleanRows(body.rows);
  if (!rows.length) return Response.json({ error: "Media Plan ต้องมีอย่างน้อย 1 แถว" }, { status: 400 });
  const saved = await writeEventConfig(edition.slug, { mediaPlan: { rows } });
  return Response.json({ rows, saved });
}
