import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CORE_URL = property => `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`;
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const base64Url = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const number = value => Number(value || 0);

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ไม่ใช่ JSON ที่ถูกต้อง"); }
}

export const ga4Configured = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

async function accessToken() {
  const account = serviceAccount();
  if (!account?.client_email || !account?.private_key) throw new Error("ยังไม่ได้ตั้งค่า Google Service Account");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "RS256", typ: "JWT" });
  const claim = base64Url({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`); signer.end();
  const assertion = `${header}.${claim}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`ขอสิทธิ์อ่าน GA4 ไม่สำเร็จ: ${data.error_description || data.error || response.status}`);
  return data.access_token;
}

async function request(url, token, body) {
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `GA4 API ${response.status}`);
  return data;
}

export async function journeyReport(config, startDate, endDate) {
  if (!config.propertyId) throw new Error("กรอก GA4 Property ID ก่อนเชื่อมข้อมูล");
  const property = String(config.propertyId).replace(/^properties\//, "").trim();
  if (!/^\d+$/.test(property)) throw new Error("GA4 Property ID ต้องเป็นตัวเลข");
  const steps = config.steps.filter(step => step.event).map(step => ({ ...step, path: step.path || "" }));
  if (steps.length < 2) throw new Error("ต้องมีอย่างน้อย 2 ขั้นของ Customer Journey");
  const token = await accessToken();
  const eventFilters = steps.map(step => ({ filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: step.event, caseSensitive: true } } }));
  const data = await request(CORE_URL(property), token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "eventName" }],
    metrics: [{ name: "totalUsers" }, { name: "eventCount" }],
    dimensionFilter: { orGroup: { expressions: eventFilters } },
    limit: 100000,
  });
  const dimensions = data.dimensionHeaders?.map(header => header.name) || [];
  const metrics = data.metricHeaders?.map(header => header.name) || [];
  const dateIndex = dimensions.indexOf("date");
  const eventIndex = dimensions.indexOf("eventName");
  const usersIndex = metrics.indexOf("totalUsers");
  const countIndex = metrics.indexOf("eventCount");
  const daily = {};
  for (const row of data.rows || []) {
    const date = String(row.dimensionValues?.[dateIndex]?.value || "");
    const event = String(row.dimensionValues?.[eventIndex]?.value || "");
    if (!date || !event) continue;
    daily[date] ||= {};
    daily[date][event] = { users: number(row.metricValues?.[usersIndex]?.value), count: number(row.metricValues?.[countIndex]?.value) };
  }
  const totals = steps.map(step => Object.values(daily).reduce((sum, day) => ({ users: sum.users + number(day[step.event]?.users), count: sum.count + number(day[step.event]?.count) }), { users: 0, count: 0 }));
  const warnings = [];
  for (const [date, day] of Object.entries(daily)) {
    const values = steps.map(step => day[step.event] || { users: 0, count: 0 });
    if (values.some(value => value.count < value.users)) warnings.push(`${date}: eventCount น้อยกว่า totalUsers`);
    if (values[0].users < values[1].users || values[1].users < values[2].users) warnings.push(`${date}: View ≥ Draft ≥ WaitingPayment ไม่เป็นจริง`);
  }
  return {
    source: "GA4 Data API",
    propertyId: property,
    startDate,
    endDate,
    aggregation: "sum_of_daily_users",
    steps: steps.map((step, index) => ({ ...step, ...totals[index], funnelUsers: null })),
    daily,
    funnelWarning: warnings.length ? `ตรวจพบข้อมูลที่ต้องทบทวน: ${warnings.slice(0, 3).join(" · ")}` : "",
  };
}
