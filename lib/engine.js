// Ticket-to-ad attribution, ported from the rules settled on Economic Forum 2026.
//
//   Ref Ad           ref code is our own ad link (or a code the edition lists as ad evidence)
//   Ref Org from Ad  other ref code, but one specific Meta Ad ID owns its purchase that hour
//   Direct Ads       no ref code, but one specific Meta Ad ID owns its purchase that hour
//   Organic / Direct Organic   the same two cases without a provable Ad ID
//
// "Owns its purchase" = Meta reports a purchase of that value in that hour from exactly one ad,
// and no other order of that value could be the one (or the ad's purchases cover all of them).
// Where several ads cover several same-value orders, an order's own ref code breaks the tie
// toward an ad of the same creative; a pairing counts only if it is the only possible one.

const MIN_TICKET = 790; // cheapest real ticket — one Pixel event fires per order with its total

const TARGET_TOKEN = /(target|size|interest|tss|wealth|consult|list|lookalike|retarget|broad|custom|lal|เป้า)/i;
const FORMAT_TOKEN = /^(photo|photo album|video|vdo|carousel|reel|reels|shorts|alb|link|link post|album)$/i;

// Ad name → creative. Naming convention: PROJECT_Owner_Objective_Outlet_Platform_Format_Creative[_Target]
export function creativeFromAdName(name) {
  const t = String(name).split("_").map(s => s.trim()).filter(Boolean);
  let i = t.findIndex(x => FORMAT_TOKEN.test(x) || /^photo /i.test(x));
  let rest;
  if (i >= 0) {
    rest = t.slice(i + 1);
    if (/^photo /i.test(t[i]) && !FORMAT_TOKEN.test(t[i])) rest = [t[i].replace(/^photo /i, ""), ...rest];
  } else rest = t.slice(5);
  while (rest.length > 1 && TARGET_TOKEN.test(rest[rest.length - 1])) rest.pop();
  return rest.join(" ").trim() || name;
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");

export function creativeForRef(ref, edition) {
  const map = edition.refCreative || {};
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const k = keys.find(k => ref.toLowerCase().startsWith(k.toLowerCase()));
  return k ? map[k] : null;
}

export function isAdRef(ref, edition) {
  if (!ref) return false;
  if ((edition.adRefCodes || {})[ref]) return true;
  return (edition.adRefPrefixes || ["ad-"]).some(p => ref.toLowerCase().startsWith(p.toLowerCase()));
}

// tickets: [{oid, day:"YYYY-MM-DD", hour:"HH", paid, type, price, ref}]
// purchases: [{day, hour, adId, adName, n, v, nClick, nView, vClick, vView}]  (Meta, per ad per hour)
export function attribute(tickets, purchases, edition, { end } = {}) {
  const orders = new Map();
  for (const t of tickets) {
    if (!t.paid || (end && t.day > end)) continue;
    let o = orders.get(t.oid);
    if (!o) orders.set(t.oid, o = { oid: t.oid, day: t.day, hour: t.hour, ref: t.ref, v: 0, t: 0, types: {} });
    o.v += t.price; o.t += 1; o.types[t.type] = (o.types[t.type] || 0) + 1;
  }
  const key = (d, h) => d + " " + h;
  const byHour = new Map(), ads = new Map();
  for (const o of orders.values()) (byHour.get(key(o.day, o.hour)) || byHour.set(key(o.day, o.hour), []).get(key(o.day, o.hour))).push(o);
  for (const p of purchases) (ads.get(key(p.day, p.hour)) || ads.set(key(p.day, p.hour), []).get(key(p.day, p.hour))).push(p);

  const same = o => (byHour.get(key(o.day, o.hour)) || []).filter(x => Math.abs(x.v - o.v) < 1);
  const holds = (p, v) => (p.n === 1 && Math.abs(p.v - v) < 1) || (p.n >= 2 && p.v - v >= (p.n - 1) * MIN_TICKET - 1);
  const exact = (p, v) => (p.n === 1 && Math.abs(p.v - v) < 1) || (p.n >= 2 && Math.abs(p.v - p.n * v) < 1);

  const adOf = new Map();
  for (const o of orders.values()) {
    if (isAdRef(o.ref, edition)) continue;
    const rows = ads.get(key(o.day, o.hour)) || [];
    const cand = rows.filter(p => holds(p, o.v));
    const ids = [...new Set(cand.map(p => p.adId))];
    if (ids.length !== 1) continue;
    const s = same(o);
    if (s.length === 1 || (cand.every(p => exact(p, o.v)) && cand.reduce((a, p) => a + p.n, 0) >= s.length)) adOf.set(o.oid, cand[0]);
  }

  // tie-break by ref-code creative inside fully covered hours
  const adCreative = p => creativeFromAdName(p.adName);
  for (const [k, list] of byHour) {
    const rows = ads.get(k) || [];
    for (const v of [...new Set(list.map(o => o.v))]) {
      const s = list.filter(o => Math.abs(o.v - v) < 1);
      const todo = s.filter(o => !adOf.has(o.oid) && !isAdRef(o.ref, edition));
      const slots = rows.flatMap(p => exact(p, v) ? Array(p.n).fill(p) : []);
      if (!todo.length || slots.length < s.length || s.length > 7) continue;
      const allowed = (o, p) => { const c = o.ref ? creativeForRef(o.ref, edition) : null; return !c || norm(c) === norm(adCreative(p)); };
      const seen = new Map(s.map(o => [o.oid, new Set()]));
      const used = new Array(slots.length).fill(false), pick = [];
      (function walk(i) {
        if (i === s.length) { s.forEach((o, j) => seen.get(o.oid).add(slots[pick[j]].adId)); return; }
        for (let j = 0; j < slots.length; j++) if (!used[j] && allowed(s[i], slots[j])) { used[j] = true; pick[i] = j; walk(i + 1); used[j] = false; }
      })(0);
      for (const o of todo) { const ids = [...seen.get(o.oid)]; if (ids.length === 1) adOf.set(o.oid, slots.find(p => p.adId === ids[0])); }
    }
  }

  const out = [];
  for (const o of orders.values()) {
    const p = adOf.get(o.oid);
    let label, creative = null, kind = null;
    if (isAdRef(o.ref, edition)) {
      label = (edition.adRefCodes || {})[o.ref] ? "Ref Org from Ad" : "Ref Ad"; // listed codes (e.g. a QR on a video ad) keep the sheet's label
      creative = (edition.adRefCodes || {})[o.ref] || creativeForRef(o.ref, edition) || "ยังไม่ได้จับคู่: " + o.ref;
      kind = "Click";
    } else if (p) {
      label = o.ref ? "Ref Org from Ad" : "Direct Ads";
      creative = adCreative(p);
      kind = p.nView && !p.nClick ? "View" : p.nClick && !p.nView ? "Click"
           : Math.abs((p.vView || 0) - o.v) < 1 && Math.abs((p.vClick || 0) - o.v) >= 1 ? "View" : "Click";
    } else label = o.ref ? "Organic" : "Direct Organic";
    out.push({ ...o, label, creative, adId: p?.adId || "", adName: p?.adName || "", kind, tracked: !!creative });
  }
  return out;
}

export function capacityOk(result, purchases) {
  const cnt = new Map();
  for (const p of purchases) cnt.set(p.day + " " + p.hour, (cnt.get(p.day + " " + p.hour) || 0) + p.n);
  const used = new Map();
  for (const o of result) if (o.adId) used.set(o.day + " " + o.hour, (used.get(o.day + " " + o.hour) || 0) + 1);
  return [...used].filter(([k, n]) => n > (cnt.get(k) || 0)).map(([k]) => k);
}
