// Event Ad Dashboard — everything runs in the browser; uploaded files never leave this page.
const $ = id => document.getElementById(id);
const num = n => n.toLocaleString("en-US");
const baht = n => "฿" + Math.round(n).toLocaleString("en-US");
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";

// Economic Forum 2026 delivery windows (Meta, hours with impressions), used until an Ads Manager file is loaded.
const DEFAULT_WINDOWS = "2026-09-26 22:00 → 2026-10-14 23:00\n2026-10-15 15:00 → 2026-10-21 23:00";
const store = {
  get(k, d){ try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} }
};

let orders = [];          // one row per ticket: {oid, at:"YYYY-MM-DD HH", day, paid, type, price, ref}
let adHours = new Set();  // "YYYY-MM-DD HH"
let chart = null;

// ---------- parsing ----------
function readBook(file){
  return file.arrayBuffer().then(buf => XLSX.read(buf, {type:"array", cellDates:false}));
}
const pad = n => String(n).padStart(2, "0");
function toStamp(v){
  if(v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())} ${pad(v.getHours())}`;
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}))?/);           // 21/09/2026 11:18:07
  if(m) return `${m[3]}-${pad(m[2])}-${pad(m[1])} ${pad(m[4] ?? 0)}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}))?/);                        // 2026-09-21 11:18
  if(m) return `${m[1]}-${m[2]}-${m[3]} ${m[4] ?? "00"}`;
  return "";
}
const findCol = (hdr, ...names) => {
  const low = hdr.map(h => String(h ?? "").trim().toLowerCase());
  for(const n of names){ const i = low.indexOf(n.toLowerCase()); if(i >= 0) return i; }
  for(const n of names){ const i = low.findIndex(h => h.includes(n.toLowerCase())); if(i >= 0) return i; }
  return -1;
};

async function loadZip(file){
  const wb = await readBook(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false, defval:""});
  const hdr = rows[0] || [];
  const c = {
    oid: findCol(hdr, "Order ID"), done: findCol(hdr, "Completed Date"), type: findCol(hdr, "Order Type"),
    tkt: findCol(hdr, "Ticket Type"), price: findCol(hdr, "Price (After Discount)", "Price"), ref: findCol(hdr, "Ref Code")
  };
  const missing = Object.entries(c).filter(([,i]) => i < 0).map(([k]) => k);
  if(missing.length) throw new Error("ไม่พบคอลัมน์: " + missing.join(", ") + " — ใช่ไฟล์ export จาก Zipevent ไหม");
  orders = rows.slice(1).filter(r => r[c.oid]).map(r => {
    const at = toStamp(r[c.done]);
    return {
      oid: String(r[c.oid]), at, day: at.slice(0, 10),
      paid: String(r[c.type]).trim().toLowerCase() === "paid",
      type: String(r[c.tkt] || "(ไม่ระบุ)").trim(),
      price: parseFloat(String(r[c.price]).replace(/,/g, "")) || 0,
      ref: String(r[c.ref] ?? "").trim()
    };
  }).filter(o => o.at);
  const days = orders.map(o => o.day).sort();
  $("zipStatus").textContent = `${file.name} · ${num(orders.length)} แถว · ${days[0]} ถึง ${days.at(-1)}`;
  $("zipDrop").classList.add("ok");
  setRangeBounds(days[0], days.at(-1));
  render();
}

// Ads Manager export with the "Time of day (ad account time zone)" breakdown.
async function loadAds(files){
  const hours = new Set();
  for(const f of files){
    const wb = await readBook(f);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:false, defval:""});
    const hdr = rows[0] || [];
    const cd = findCol(hdr, "Day", "Date", "Reporting starts"), ct = findCol(hdr, "Time of day"), ci = findCol(hdr, "Impressions");
    if(cd < 0 || ct < 0 || ci < 0) throw new Error(`${f.name}: ต้องมีคอลัมน์ Day, Time of day และ Impressions (export แบบ breakdown ตามชั่วโมง)`);
    for(const r of rows.slice(1)){
      if(!(parseFloat(String(r[ci]).replace(/,/g, "")) > 0)) continue;
      const d = toStamp(r[cd]).slice(0, 10), h = String(r[ct]).trim().slice(0, 2);
      if(d && /^\d\d$/.test(h)) hours.add(`${d} ${h}`);
    }
  }
  if(!hours.size) throw new Error("ไม่พบชั่วโมงที่มี impression ในไฟล์");
  $("windows").value = hoursToWindows([...hours].sort());
  applyWindows();
}

// ---------- ad windows ----------
function addHour(s, n){
  const d = new Date(s.slice(0,10) + "T" + s.slice(11,13) + ":00:00Z");
  d.setUTCHours(d.getUTCHours() + n);
  return d.toISOString().slice(0,10) + " " + d.toISOString().slice(11,13);
}
function hoursToWindows(list){
  const out = []; let start = null, prev = null;
  for(const h of list){
    if(prev && addHour(prev, 1) === h){ prev = h; continue; }
    if(start) out.push(`${start}:00 → ${prev}:00`);
    start = prev = h;
  }
  if(start) out.push(`${start}:00 → ${prev}:00`);
  return out.join("\n");
}
function applyWindows(){
  adHours = new Set();
  let n = 0;
  for(const line of $("windows").value.split("\n")){
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2})(?::\d{2})?\s*(?:→|->|-|to)\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2})/);
    if(!m) continue;
    let h = `${m[1]} ${pad(m[2])}`; const end = `${m[3]} ${pad(m[4])}`;
    for(let guard = 0; h <= end && guard < 24*400; guard++){ adHours.add(h); h = addHour(h, 1); }
    n++;
  }
  store.set("adWindows", $("windows").value);
  $("windowSummary").textContent = `ช่วงเวลาแอดรัน · ${n} ช่วง · ${num(adHours.size)} ชั่วโมง`;
  $("adDrop").classList.toggle("ok", adHours.size > 0);
  render();
}

// ---------- report ----------
function setRangeBounds(min, max){
  for(const id of ["from","to"]){ $(id).min = min; $(id).max = max; }
  $("from").value = min; $("to").value = max;
}
function render(){
  if(!orders.length){ $("report").hidden = true; $("empty").hidden = false; return; }
  $("report").hidden = false; $("empty").hidden = true;
  const from = $("from").value, to = $("to").value;
  const inRange = orders.filter(o => o.day >= from && o.day <= to);
  const paid = inRange.filter(o => o.paid);
  const isAd = o => adHours.has(o.at);
  const sum = (arr, f = () => true) => arr.filter(f).reduce((s, o) => s + o.price, 0);
  const ad = paid.filter(isAd), noAd = paid.filter(o => !isAd(o));
  const refAd = paid.filter(o => /^ad-/i.test(o.ref));

  $("kTickets").textContent = num(paid.length);
  $("kRevenue").textContent = baht(sum(paid)) + " · " + num(new Set(paid.map(o => o.oid)).size) + " ออเดอร์";
  $("kAd").textContent = num(ad.length);
  $("kAdSub").textContent = `${pct(ad.length, paid.length)} ของยอดขาย · ${baht(sum(ad))}`;
  $("kNoAd").textContent = num(noAd.length);
  $("kNoAdSub").textContent = `${pct(noAd.length, paid.length)} · ${baht(sum(noAd))}`;
  $("kRef").textContent = num(refAd.length);
  $("kRefSub").textContent = `พื้นขั้นต่ำที่พิสูจน์ได้ · ${baht(sum(refAd))}`;
  const free = inRange.filter(o => !o.paid).length;
  $("freeNote").textContent = `ไม่นับบัตรฟรี/บัตรแจก ${num(free)} ใบในช่วงนี้ · ช่วงเวลาแอดรันตามเวลาบัญชีโฆษณา (ควรตั้งเป็น Asia/Bangkok ให้ตรงกับ Zipevent)`;

  // daily chart
  const days = [];
  for(let d = from; d <= to; d = addHour(d + " 00", 24).slice(0,10)) days.push(d);
  const cnt = (arr, d) => arr.filter(o => o.day === d).length;
  const css = getComputedStyle(document.documentElement);
  const data = {
    labels: days.map(d => d.slice(8,10) + "/" + d.slice(5,7)),
    datasets: [
      {label:"ขายช่วงแอดรัน", data: days.map(d => cnt(ad, d)), backgroundColor: css.getPropertyValue("--ad").trim(), borderRadius:3},
      {label:"แอดไม่รัน", data: days.map(d => cnt(noAd, d)), backgroundColor: css.getPropertyValue("--no").trim(), borderRadius:3}
    ]
  };
  if(chart){ chart.data = data; chart.update(); }
  else chart = new Chart($("daily"), {type:"bar", data, options:{
    maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{mode:"index", intersect:false}},
    scales:{x:{stacked:true, grid:{display:false}, ticks:{color:css.getPropertyValue("--muted").trim()}},
            y:{stacked:true, ticks:{precision:0, color:css.getPropertyValue("--muted").trim()}, grid:{color:css.getPropertyValue("--line").trim()}}}
  }});

  // by ticket type
  const groupBy = (arr, key) => arr.reduce((m, o) => (m[key(o)] ??= []).push(o) && m, {});
  const tbl = (id, head, rows, total) => {
    $(id).innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
      rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("") +
      (total ? `<tr class="tot">${total.map(c => `<td>${c}</td>`).join("")}</tr>` : "") + "</tbody>";
  };
  const types = Object.entries(groupBy(paid, o => o.type)).sort((a,b) => b[1].length - a[1].length);
  tbl("byType", ["บัตร","ขาย","ยอดเงิน","ช่วงแอดรัน","%"],
    types.map(([t, a]) => { const x = a.filter(isAd).length; return [esc(t), num(a.length), baht(sum(a)), num(x), pct(x, a.length)]; }),
    ["รวม", num(paid.length), baht(sum(paid)), num(ad.length), pct(ad.length, paid.length)]);

  const refs = Object.entries(groupBy(paid, o => o.ref || "(ไม่มี ref)")).sort((a,b) => b[1].length - a[1].length);
  tbl("byRef", ["Ref code","ขาย","ช่วงแอดรัน","ยอดเงิน"],
    refs.slice(0, 25).map(([r, a]) => [`<code>${esc(r)}</code>`, num(a.length), num(a.filter(isAd).length), baht(sum(a))]),
    refs.length > 25 ? [`อีก ${refs.length - 25} โค้ด`, "", "", ""] : null);
}
const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---------- wiring ----------
function wireDrop(zone, input, handler){
  const run = files => handler(files).catch(e => alertBox(zone, e.message));
  input.addEventListener("change", () => input.files.length && run([...input.files]));
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("over"); run([...e.dataTransfer.files]); });
}
function alertBox(zone, msg){
  const s = zone.querySelector("small"); s.textContent = "⚠ " + msg; s.style.color = "#c0392b";
}
wireDrop($("zipDrop"), $("zipFile"), files => loadZip(files[0]));
wireDrop($("adDrop"), $("adFile"), files => loadAds(files));
$("windows").value = store.get("adWindows", DEFAULT_WINDOWS);
$("windows").addEventListener("change", applyWindows);
$("eventName").value = store.get("eventName", $("eventName").value);
$("eventName").addEventListener("change", e => store.set("eventName", e.target.value));
["from","to"].forEach(id => $(id).addEventListener("change", render));
applyWindows();
