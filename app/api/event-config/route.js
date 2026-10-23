import { findEdition } from "@/lib/events";
import { hasDb, readEventConfig, writeEventConfig } from "@/lib/db";

const cleanProjectCode = value => String(value || "").trim().replace(/\s+/g, "").slice(0, 60);
const validProjectCode = value => /^[A-Za-z0-9][A-Za-z0-9._-]{1,59}$/.test(value);

export async function GET(req) {
  const slug = new URL(req.url).searchParams.get("slug");
  const edition = findEdition(slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  const saved = await readEventConfig(slug);
  return Response.json({
    storage: hasDb(),
    config: { projectCode: cleanProjectCode(saved?.config?.projectCode || edition.prefix) },
    updatedAt: saved?.updated_at || null,
  });
}

export async function POST(req) {
  const body = await req.json();
  const edition = findEdition(body.slug);
  if (!edition) return Response.json({ error: "ไม่พบ Event" }, { status: 404 });
  if (!hasDb()) return Response.json({ error: "ยังไม่ได้เชื่อมฐานข้อมูล" }, { status: 503 });
  const projectCode = cleanProjectCode(body.projectCode);
  if (!validProjectCode(projectCode)) return Response.json({ error: "กรอก QU / Project Code ด้วยตัวอักษร ตัวเลข - _ หรือ . เช่น TSD2615 หรือ QU-1234" }, { status: 400 });
  const saved = await writeEventConfig(edition.slug, { projectCode });
  return Response.json({ config: { projectCode }, saved });
}
