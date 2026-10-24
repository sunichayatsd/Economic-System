import { findEdition } from "@/lib/events";
import { hasDb, readEventConfig, writeEventConfig } from "@/lib/db";

const normalizeHashtag = value => {
  const text = String(value || "").trim().replace(/^#+/, "").replace(/\s+/g, "");
  return text ? `#${text}`.slice(0, 81) : "";
};

const cleanHashtags = values => [...new Set((Array.isArray(values) ? values : [])
  .map(normalizeHashtag)
  .filter(tag => /^#[\p{L}\p{N}_]+$/u.test(tag)))]
  .slice(0, 30);

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  const edition = findEdition(slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  const saved = await readEventConfig(slug);
  return Response.json({
    storage: hasDb(),
    config: { hashtags: cleanHashtags(saved?.config?.socialListening?.hashtags) },
    updatedAt: saved?.updated_at || null,
  });
}

export async function POST(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const hashtags = cleanHashtags(body.hashtags);
  if (!hashtags.length) return Response.json({ error: "เพิ่มอย่างน้อย 1 Hashtag ก่อนบันทึก" }, { status: 400 });
  if ((body.hashtags || []).length !== hashtags.length) return Response.json({ error: "Hashtag ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ โดยไม่เว้นวรรค" }, { status: 400 });
  const saved = await writeEventConfig(edition.slug, { socialListening: { hashtags } });
  return Response.json({ config: { hashtags }, saved });
}
