import { findEdition } from "@/lib/events";
import { saveUpload, latestUpload, hasDb } from "@/lib/db";

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!findEdition(slug)) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ storage: false });
  const row = await latestUpload(slug);
  return Response.json({ storage: true, upload: row });
}

export async function POST(req) {
  const { slug, fileName, tickets } = await req.json();
  if (!findEdition(slug)) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!Array.isArray(tickets) || !tickets.length) return Response.json({ error: "ไม่มีข้อมูล" }, { status: 400 });
  if (!hasDb()) return Response.json({ storage: false });
  const row = await saveUpload(slug, String(fileName || "").slice(0, 200), tickets);
  return Response.json({ storage: true, saved: row });
}
