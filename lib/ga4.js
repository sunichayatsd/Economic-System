import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CORE_URL = property => `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`;
const FUNNEL_URL = property => `https://analyticsdata.googleapis.com/v1alpha/properties/${property}:runFunnelReport`;
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

function coreFilter(step) {
  const expressions = [{ filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: step.event } } }];
  if (step.path) expressions.push({ filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: step.path } } });
  return expressions.length === 1 ? expressions[0] : { andGroup: { expressions } };
}

function funnelStep(step) {
  const expressions = [{ funnelEventFilter: { eventName: step.event } }];
  if (step.path) expressions.push({ funnelFieldFilter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: step.path } } });
  return { name: step.label, filterExpression: expressions.length === 1 ? expressions[0] : { andGroup: { expressions } } };
}

function reportValue(data) {
  const headers = data.metricHeaders?.map(header => header.name) || [];
  const values = Object.fromEntries(headers.map((name, index) => [name, number(data.rows?.[0]?.metricValues?.[index]?.value)]));
  return { users: values.totalUsers || 0, count: values.eventCount || 0 };
}

function funnelValues(data, steps) {
  const dimensions = data.funnelVisualization?.dimensionHeaders?.map(header => header.name) || [];
  const metrics = data.funnelVisualization?.metricHeaders?.map(header => header.name) || [];
  const rows = data.funnelVisualization?.rows || [];
  return steps.map(step => {
    const row = rows.find(candidate => String(candidate.dimensionValues?.[dimensions.indexOf("funnelStepName")]?.value || "").endsWith(step.label));
    const users = number(row?.metricValues?.[metrics.indexOf("activeUsers")]?.value);
    return users || null;
  });
}

// Core reports provide stable event totals. Funnel is attempted separately because Google currently exposes it
// through the alpha endpoint; a failure must never turn into a guessed drop-off value.
export async function journeyReport(config, startDate, endDate) {
  if (!config.propertyId) throw new Error("กรอก GA4 Property ID ก่อนเชื่อมข้อมูล");
  const property = String(config.propertyId).replace(/^properties\//, "").trim();
  if (!/^\d+$/.test(property)) throw new Error("GA4 Property ID ต้องเป็นตัวเลข");
  const steps = config.steps.filter(step => step.event).map(step => ({ ...step, path: step.path || "" }));
  if (steps.length < 2) throw new Error("ต้องมีอย่างน้อย 2 ขั้นของ Customer Journey");
  const token = await accessToken();
  const totals = await Promise.all(steps.map(async step => {
    const data = await request(CORE_URL(property), token, { dateRanges: [{ startDate, endDate }], metrics: [{ name: "totalUsers" }, { name: "eventCount" }], dimensionFilter: coreFilter(step) });
    return reportValue(data);
  }));

  let funnel = null;
  let funnelWarning = "";
  try {
    const data = await request(FUNNEL_URL(property), token, { dateRanges: [{ startDate, endDate }], funnel: { isOpenFunnel: true, steps: steps.map(funnelStep) } });
    funnel = funnelValues(data, steps);
  } catch (error) {
    funnelWarning = `ยังคำนวณ Drop off แบบ Funnel ไม่ได้: ${error.message}`;
  }
  return { source: "GA4 Data API", startDate, endDate, steps: steps.map((step, index) => ({ ...step, ...totals[index], funnelUsers: funnel?.[index] ?? null })), funnelWarning };
}
