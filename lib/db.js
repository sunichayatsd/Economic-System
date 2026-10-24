// Postgres storage on Supabase. Without a connection string every helper is a no-op, so the site still works
// statelessly. Only non-personal order fields are stored: order id, completed day/hour, paid flag, ticket type,
// price, ref code.
import postgres from "postgres";

const url = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const hasDb = () => Boolean(url());
let client = null;
// Supabase's transaction pooler (port 6543) is what serverless functions should use; it can't keep prepared statements
const sql = () => (client ||= postgres(url(), { prepare: false, max: 1, ssl: "require", idle_timeout: 20 }));

let ready = null;
function ensureSchema() {
  ready ||= (async () => {
    const q = sql();
    await q`create table if not exists uploads (
      id bigserial primary key, edition text not null, uploaded_at timestamptz not null default now(),
      file_name text, row_count int, first_day text, last_day text, tickets jsonb not null)`;
    await q`create index if not exists uploads_edition on uploads (edition, uploaded_at desc)`;
    await q`create table if not exists ad_cache (
      edition text primary key, fetched_at timestamptz not null default now(), data jsonb not null)`;
    await q`create table if not exists snapshots (
      id bigserial primary key, edition text not null, taken_at timestamptz not null default now(),
      label text, rule text, range_from text, range_to text, metrics jsonb not null)`;
    await q`create table if not exists analytics_configs (
      edition text primary key, updated_at timestamptz not null default now(), config jsonb not null)`;
    await q`create table if not exists analytics_cache (
      edition text primary key, fetched_at timestamptz not null default now(), data jsonb not null)`;
    await q`create table if not exists event_configs (
      edition text primary key, updated_at timestamptz not null default now(), config jsonb not null)`;
    // Supabase also publishes every public table through its REST API; RLS with no policies closes that door,
    // while this server (connecting as the database owner) is unaffected
    for (const t of ["uploads", "ad_cache", "snapshots", "analytics_configs", "analytics_cache", "event_configs"]) await q.unsafe(`alter table ${t} enable row level security`);
  })().catch(e => { ready = null; throw e; });  // let the next request retry instead of caching a failure
  return ready;
}

const SAFE_KEYS = ["oid", "day", "hour", "paid", "type", "price", "ref"];
export const stripTicket = t => Object.fromEntries(SAFE_KEYS.map(k => [k, t[k]]));
// Some serverless Postgres connections return jsonb as a string. Convert it at
// the storage boundary so every API caller consistently receives arrays/objects.
const parseJsonb = value => typeof value === "string" ? JSON.parse(value) : value;

export async function saveUpload(edition, fileName, tickets) {
  if (!hasDb()) return null;
  await ensureSchema();
  const clean = tickets.map(stripTicket);
  const days = clean.map(t => t.day).sort();
  const [row] = await sql()`insert into uploads (edition, file_name, row_count, first_day, last_day, tickets)
    values (${edition}, ${fileName}, ${clean.length}, ${days[0]}, ${days.at(-1)}, ${JSON.stringify(clean)}::jsonb)
    returning id, uploaded_at`;
  return row;
}

export async function latestUpload(edition) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`select id, uploaded_at, file_name, row_count, first_day, last_day, tickets
    from uploads where edition = ${edition} order by uploaded_at desc limit 1`;
  return row ? { ...row, tickets: parseJsonb(row.tickets) } : null;
}

export async function readAdCache(edition) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`select fetched_at, data from ad_cache where edition = ${edition}`;
  return row ? { ...row, data: parseJsonb(row.data) } : null;
}

export async function writeAdCache(edition, data) {
  if (!hasDb()) return;
  await ensureSchema();
  await sql()`insert into ad_cache (edition, data) values (${edition}, ${JSON.stringify(data)}::jsonb)
    on conflict (edition) do update set data = excluded.data, fetched_at = now()`;
}

export async function listSnapshots(edition) {
  if (!hasDb()) return [];
  await ensureSchema();
  return sql()`select id, taken_at, label, rule, range_from, range_to, metrics from snapshots
    where edition = ${edition} order by taken_at desc limit 50`;
}

export async function saveSnapshot(edition, s) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`insert into snapshots (edition, label, rule, range_from, range_to, metrics)
    values (${edition}, ${s.label || null}, ${s.rule}, ${s.from}, ${s.to}, ${JSON.stringify(s.metrics)}::jsonb)
    returning id, taken_at`;
  return row;
}

export async function readAnalyticsConfig(edition) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`select updated_at, config from analytics_configs where edition = ${edition}`;
  return row ? { ...row, config: parseJsonb(row.config) } : null;
}

export async function writeAnalyticsConfig(edition, config) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`insert into analytics_configs (edition, config) values (${edition}, ${JSON.stringify(config)}::jsonb)
    on conflict (edition) do update set config = excluded.config, updated_at = now() returning updated_at`;
  return row;
}

export async function readAnalyticsCache(edition) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`select fetched_at, data from analytics_cache where edition = ${edition}`;
  return row ? { ...row, data: parseJsonb(row.data) } : null;
}

export async function writeAnalyticsCache(edition, data) {
  if (!hasDb()) return null;
  await ensureSchema();
  await sql()`insert into analytics_cache (edition, data) values (${edition}, ${JSON.stringify(data)}::jsonb)
    on conflict (edition) do update set data = excluded.data, fetched_at = now()`;
}

export async function readEventConfig(edition) {
  if (!hasDb()) return null;
  await ensureSchema();
  const [row] = await sql()`select updated_at, config from event_configs where edition = ${edition}`;
  return row ? { ...row, config: parseJsonb(row.config) } : null;
}

export async function writeEventConfig(edition, config) {
  if (!hasDb()) return null;
  await ensureSchema();
  // Merge in JavaScript before the upsert. This keeps independent settings such
  // as projectCode and mediaPlan together even when an older database row was
  // stored in a shape that PostgreSQL's jsonb concatenation cannot merge safely.
  const current = await readEventConfig(edition);
  const previous = current?.config && !Array.isArray(current.config) && typeof current.config === "object"
    ? current.config
    : {};
  const merged = { ...previous, ...config };
  const [row] = await sql()`insert into event_configs (edition, config) values (${edition}, ${JSON.stringify(merged)}::jsonb)
    on conflict (edition) do update set config = excluded.config, updated_at = now() returning updated_at`;
  return row;
}
