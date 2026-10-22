import { findEdition } from "@/lib/events";
import { listSnapshots, saveSnapshot, hasDb } from "@/lib/db";

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!findEdition(slug)) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  return Response.json({ storage: hasDb(), snapshots: await listSnapshots(slug) });
}

export async function POST(req) {
  const { slug, label, rule, from, to, metrics } = await req.json();
  if (!findEdition(slug)) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const row = await saveSnapshot(slug, { label: String(label || "").slice(0, 120), rule, from, to, metrics });
  return Response.json({ saved: row });
}
