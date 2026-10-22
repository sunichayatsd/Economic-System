// Server-side Supermetrics client over its MCP endpoint (the same connection the team uses in Claude/Codex).
// Needs SUPERMETRICS_MCP_TOKEN — the shared "api__…" bearer token.

const MCP_URL = "https://mcp.supermetrics.com/mcp";

export const configured = () => Boolean(process.env.SUPERMETRICS_MCP_TOKEN);

class McpSession {
  constructor() { this.sid = null; this.id = 0; }
  async send(method, params, notify = false) {
    const headers = {
      Authorization: "Bearer " + process.env.SUPERMETRICS_MCP_TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sid) headers["Mcp-Session-Id"] = this.sid;
    const res = await fetch(MCP_URL, { method: "POST", headers, cache: "no-store",
      body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++this.id, method, params }) });
    this.sid = res.headers.get("mcp-session-id") || this.sid;
    if (notify) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`Supermetrics MCP ${res.status}: ${text.slice(0, 200)}`);
    // streamable HTTP answers either as plain JSON or as an SSE stream whose last data line is the reply
    const payload = text.includes("data:") ? text.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5)).pop() : text;
    const msg = JSON.parse(payload);
    if (msg.error) throw new Error(msg.error.message || "MCP error");
    return msg.result;
  }
  async open() {
    await this.send("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "event-ad-dashboard", version: "0.3" } });
    await this.send("notifications/initialized", {}, true);
    return this;
  }
  async tool(name, args) {
    const r = await this.send("tools/call", { name, arguments: args });
    const body = JSON.parse(r?.content?.[0]?.text || "{}");
    if (!body.success) throw new Error(body.error?.message || body.error || `${name} failed`);
    return body.data;
  }
}

async function query(mcp, { account, fields, filter, start, end }) {
  let d = await mcp.tool("data_query", {
    ds_id: "FA", ds_accounts: account, fields: fields.join(","), filters: filter,
    date_range_type: "custom", start_date: start, end_date: end,
    settings: { include_deleted_items: true }, max_rows: 50000,
  });
  for (let i = 0; d.status !== "completed" && i < 30; i++) {
    if (["failed", "error"].includes(d.status)) throw new Error("Supermetrics query failed");
    d = await mcp.tool("get_async_query_results", { schedule_id: d.schedule_id });
  }
  const [, ...rows] = d.data || [];   // first row is display headers; columns follow the requested order
  return rows.map(r => Object.fromEntries(fields.map((f, i) => [f, r[i]])));
}

const hourOf = s => String(s).slice(0, 2);
const n = x => Number(x) || 0;

export async function adData({ account, prefix, start, end }) {
  const mcp = await new McpSession().open();
  const camp = `campaign_name =@ ${prefix}`;
  // sequential: one MCP session, and Supermetrics rate-limits parallel queries per token
  const purch = await query(mcp, { account, start, end, filter: `${camp} AND ActionType == offsite_conversion.fb_pixel_purchase`,
    fields: ["date", "hourly_stats_aggregated_by_advertiser_time_zone", "ad_id", "ad_name", "ActionType",
             "actions_7d_click", "actions_1d_view", "action_values_7d_click", "action_values_1d_view"] });
  const delivery = await query(mcp, { account, start, end, filter: `${camp} AND impressions > 0`,
    fields: ["date", "hourly_stats_aggregated_by_advertiser_time_zone", "impressions"] });
  const spend = await query(mcp, { account, start, end, filter: `${camp} AND impressions > 0`,
    fields: ["date", "ad_name", "impressions", "cost"] });
  return {
    purchases: purch.map(r => ({
      day: r.date, hour: hourOf(r.hourly_stats_aggregated_by_advertiser_time_zone), adId: String(r.ad_id), adName: r.ad_name,
      nClick: n(r.actions_7d_click), nView: n(r.actions_1d_view), vClick: n(r.action_values_7d_click), vView: n(r.action_values_1d_view),
    })).map(p => ({ ...p, n: p.nClick + p.nView, v: p.vClick + p.vView })).filter(p => p.n > 0),
    adHours: delivery.map(r => r.date + " " + hourOf(r.hourly_stats_aggregated_by_advertiser_time_zone)),
    spend: spend.map(r => ({ day: r.date, adName: r.ad_name, impressions: n(r.impressions), cost: n(r.cost) })),
  };
}
