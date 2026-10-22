import { EDITIONS } from "@/lib/events";
import { configured } from "@/lib/supermetrics";
import { fetchEdition } from "@/lib/adcache";

export const maxDuration = 60;

// Vercel Cron (vercel.json) calls this every morning; Vercel signs the call with CRON_SECRET.
export async function GET(req) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  if (!configured()) return Response.json({ skipped: "no Supermetrics token" });
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const live = EDITIONS.filter(e => e.metaAccount && e.prefix && e.start <= today && today <= e.end);
  const out = {};
  for (const e of live) {
    try { const d = await fetchEdition(e); out[e.slug] = { ok: true, purchases: d.purchases.length }; }
    catch (err) { out[e.slug] = { ok: false, error: err.message }; }
  }
  return Response.json(out);
}
