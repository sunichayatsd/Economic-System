import { adData } from "@/lib/supermetrics";
import { readEventConfig, writeAdCache } from "@/lib/db";

const bangkokToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

// Pull an edition's whole flight from Supermetrics (up to today) and keep it in the daily cache.
export async function fetchEdition(edition) {
  const saved = await readEventConfig(edition.slug).catch(() => null);
  const projectCode = String(saved?.config?.projectCode || edition.prefix || "").trim();
  const end = [edition.end, bangkokToday()].sort()[0];
  const data = await adData({
    account: edition.metaAccount,
    prefix: projectCode,
    start: edition.start,
    end,
    spendSources: edition.spendSources,
  });
  const out = { ...data, projectCode, start: edition.start, end, fetchedAt: new Date().toISOString() };
  await writeAdCache(edition.slug, out);
  return out;
}
