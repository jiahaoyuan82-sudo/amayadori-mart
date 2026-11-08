'use strict';
/* =========================================================
 * sim.js — 经营模拟: 库存进货 / 财务 / 天气预报与客流 / 员工
 * ========================================================= */

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function wpick(arr, wf) {
  const tot = arr.reduce((s, x) => s + wf(x), 0);
  let r = Math.random() * tot;
  for (const x of arr) { r -= wf(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
}
function absMin() { return (G.day - 1) * 1440 + G.minute; }
function dateOf(day) { const d = new Date(START_DATE); d.setDate(d.getDate() + day - 1); return d; }
function dateLabel(day) { const d = dateOf(day); return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`; }
function yen(n) {
  const v = Math.round(Math.abs(n) * 10) / 10;
  return (n < 0 ? '-¥' : '¥') + v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}
function r1(n) { return Math.round(n * 10) / 10; }

/* ================= 店内寻路 ================= */
function nearestAisle(x) { return AISLES_X.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a); }
function onRow(y) { return ROWS_Y.find(r => Math.abs(r - y) < 0.36); }
/** 店内两点之间的路径 (沿通道走, 带一点随机偏移让路线不那么机械) */
function navPath(fx, fy, tx, ty) {
  const j = () => rand(-0.12, 0.12);
  const rf = onRow(fy), rt = onRow(ty);
  let pts;
  if (rf != null && rf === rt) pts = [[tx, ty]];
  else {
    const a1 = nearestAisle(fx) + j(), a2 = nearestAisle(tx) + j();
    if (Math.abs(a1 - a2) < 0.5) pts = [[a1, fy], [a1, ty], [tx, ty]];
    else {
      const R = ROWS_Y.reduce((a, b) => (Math.abs(b - fy) + Math.abs(b - ty)) < (Math.abs(a - fy) + Math.abs(a - ty)) ? b : a) + j() * 0.5;
      pts = [[a1, fy], [a1, R], [a2, R], [a2, ty], [tx, ty]];
    }
  }
  const out = [];
  let px = fx, py = fy;
  for (const p of pts) { if (Math.hypot(p[0] - px, p[1] - py) > 0.08) { out.push(p); px = p[0]; py = p[1]; } }
  return out;
}
/** 顾客在货架前随机站一个位置 */
function standFor(cat) {
  const C = CAT_BY_ID[cat], s = C.stand, k = rand(-0.5, 0.5) * (C.span || 0);
  return C.axis === 'y' ? [s[0] + rand(-0.05, 0.05), s[1] + k] : [s[0] + k, s[1] + rand(-0.06, 0.06)];
}
function faceFor(cat) {
  const C = CAT_BY_ID[cat];
  if (C.face === 'x') return [-1, 0];
  if (C.face === 'mag' || C.face === 'daily') return [0, 1];
  return [0, -1];
}
const STAFF_EXIT = [[13.55, 2.55], [11.8, 2.6]];

/* ================= 经济 / 库存 ================= */
function initEconomy() {
  G.inv = {}; G.price = {}; G.carried = {}; G.costMult = {};
  for (const p of PRODUCTS) {
    G.inv[p.id] = { shelf: p.start ? SHELF_CAP : 0, back: p.start ? Math.round(p.box * 0.5) : 0 };
    G.price[p.id] = p.price; G.carried[p.id] = !!p.start; G.costMult[p.id] = 1;
  }
  G.unlocked = {};
  for (const c of CATEGORIES) if (!c.unlock) G.unlocked[c.id] = true;
  G.orders = []; G.staff = []; G.candidates = []; G.nextId = 1;
  G.vend = VEND_DEFS.map(d => ({ stock: 28, price: d.price, cap: d.cap }));
  G.regulars = {}; G.buzz = 0; G.floorItems = [];
  G.wx = {}; G.fin = { today: null, history: [] };
  G.money = START_MONEY; G.rep = 3; G.day = 1; G.minute = 7 * 60; G.served = 0;
}

function costOf(pid) { return r1(PRODUCT_BY_ID[pid].cost * (G.costMult[pid] || 1)); }
function priceRatio(pid) { return G.price[pid] / PRODUCT_BY_ID[pid].price; }
function acceptance(pid) { const r = priceRatio(pid); return r <= 1 ? 1 : Math.max(0, 1 - (r - 1) * 2.2); }
function incoming(pid) { return G.orders.filter(o => o.pid === pid).reduce((s, o) => s + o.qty, 0); }
function carriedIn(cat) { return PRODUCTS_BY_CAT[cat].filter(p => G.carried[p.id]); }

function placeOrder(pid, boxes = 1, silent) {
  const p = PRODUCT_BY_ID[pid];
  if (!G.unlocked[p.cat]) return false;
  const cost = r1(costOf(pid) * p.box * boxes);
  if (G.money < cost) { if (!silent) toast('💸 钱不够了'); return false; }
  G.money -= cost; G.fin.today.purchase += cost;
  G.carried[pid] = true;
  G.orders.push({ pid, qty: p.box * boxes, eta: absMin() + randInt(40, 80) });
  return true;
}

function smartOrder() {
  let n = 0, cost = 0;
  for (const p of PRODUCTS) {
    if (!G.unlocked[p.cat] || !G.carried[p.id]) continue;
    const inv = G.inv[p.id];
    if (inv.shelf + inv.back + incoming(p.id) < Math.max(p.box * 0.8, SHELF_CAP)) {
      const c = costOf(p.id) * p.box;
      if (placeOrder(p.id, 1, true)) { n++; cost += c; }
    }
  }
  return [n, cost];
}
function smartOrderEstimate() {
  let n = 0, cost = 0;
  for (const p of PRODUCTS) {
    if (!G.unlocked[p.cat] || !G.carried[p.id]) continue;
    const inv = G.inv[p.id];
    if (inv.shelf + inv.back + incoming(p.id) < Math.max(p.box * 0.8, SHELF_CAP)) { n++; cost += costOf(p.id) * p.box; }
  }
  return [n, cost];
}

/** 从仓库搬到货架, 返回上架数量 */
function restockCat(cat, limit = Infinity) {
  let moved = 0;
  for (const p of PRODUCTS_BY_CAT[cat]) {
    const inv = G.inv[p.id];
    const n = Math.min(SHELF_CAP - inv.shelf, inv.back, limit - moved);
    if (n > 0) { inv.shelf += n; inv.back -= n; moved += n; }
  }
  return moved;
}
function catNeedsRestock(cat, thresh = 0.6) {
  return PRODUCTS_BY_CAT[cat].some(p => G.carried[p.id] && G.inv[p.id].shelf < SHELF_CAP * thresh && G.inv[p.id].back > 0);
}
function catState(cat) {
  const list = carriedIn(cat);
  let shelf = 0, back = 0, empty = false;
  for (const p of list) { shelf += G.inv[p.id].shelf; back += G.inv[p.id].back; if (G.inv[p.id].shelf === 0) empty = true; }
  return { shelf, cap: list.length * SHELF_CAP, back, empty, n: list.length };
}

function unlockCategory(cat) {
  const c = CAT_BY_ID[cat];
  if (G.unlocked[cat] || G.money < c.unlock) return false;
  G.money -= c.unlock; G.fin.today.other += c.unlock;
  G.unlocked[cat] = true;
  return true;
}

/* ---------------- 送货 ---------------- */
function checkDeliveries() {
  const due = G.orders.filter(o => o.eta <= absMin() && !o.truck);
  if (!due.length) return;
  due.forEach(o => { o.truck = true; });
  G.trucks.push({ x: -2.2, y: 10.1, dir: 1, speed: 4.5, stopX: 9.6, state: 'in', wait: 0, cargo: due });
}
function updateTrucks(dt) {
  for (const t of G.trucks) {
    if (t.state === 'in') {
      t.x += t.speed * dt;
      if (t.x >= t.stopX) { t.x = t.stopX; t.state = 'stop'; t.wait = 2.5; deliver(t.cargo); }
    } else if (t.state === 'stop') {
      t.wait -= dt; if (t.wait <= 0) t.state = 'out';
    } else {
      t.x += t.speed * dt; if (t.x > BOARD.w + 3) t.dead = true;
    }
  }
  G.trucks = G.trucks.filter(t => !t.dead);
}
function deliver(cargo) {
  const names = {};
  for (const o of cargo) {
    G.inv[o.pid].back += o.qty;
    names[o.pid] = (names[o.pid] || 0) + o.qty;
    const i = G.orders.indexOf(o); if (i >= 0) G.orders.splice(i, 1);
  }
  const list = Object.keys(names).map(id => PRODUCT_BY_ID[id].emoji).join('');
  toast(`🚚 货到了！${list} 已放进仓库`);
  Sound.restock();
}

/* ================= 财务 ================= */
function newFinDay() {
  const w = G.wx[G.day];
  return {
    day: G.day, sales: 0, vend: 0, purchase: 0, wages: 0, other: 0, crowded: 0, customers: 0, buyers: 0, items: {}, revenueBy: {},
    lostStock: 0, lostPrice: 0, lostValue: 0, fcTraffic: w && w.f0 ? w.f0.traffic : 0, weather: w ? w.t.type : 'sunny', event: w && w.t.event ? w.t.event.id : null,
  };
}
function recordSale(pid, price) {
  const t = G.fin.today;
  t.sales += price; t.items[pid] = (t.items[pid] || 0) + 1; t.revenueBy[pid] = (t.revenueBy[pid] || 0) + price;
}

/* ================= 天气 / 客流 ================= */
function climateOf(day) {
  const d = dateOf(day), m = d.getMonth(), f = (d.getDate() - 15) / 30;
  const a = CLIMATE[m], b = CLIMATE[(m + (f > 0 ? 1 : 11)) % 12], t = Math.abs(f);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
const WX_NEIGHBOR = { sunny: ['partly'], partly: ['sunny', 'cloudy'], cloudy: ['partly', 'shower'], shower: ['cloudy', 'rain'], rain: ['shower', 'storm', 'cloudy'], storm: ['rain'], snow: ['rain', 'cloudy'], typhoon: ['storm', 'rain'] };

function genTrueDay(day) {
  const [hi, lo, wet] = climateOf(day), m = dateOf(day).getMonth();
  const prev = G.wx[day - 1];
  const rainy = prev && WEATHER[prev.t.type].rain > 0.4 ? 1.5 : 1;
  const opts = [
    ['sunny', (1 - wet) * 0.45], ['partly', (1 - wet) * 0.35], ['cloudy', 0.22],
    ['shower', wet * 0.35 * rainy], ['rain', wet * 0.42 * rainy], ['storm', wet * 0.1 * rainy],
    ['typhoon', m >= 7 && m <= 9 ? 0.03 : 0],
  ];
  let type = wpick(opts, o => o[1])[0];
  const dh = gauss() * 2;
  let H = Math.round(hi + dh + (type === 'sunny' ? 1 : WEATHER[type].rain > 0.4 ? -2 : 0));
  let L = Math.round(lo + dh * 0.8 + (type === 'cloudy' ? 1 : 0));
  if (L >= H) L = H - 2;
  if ((type === 'rain' || type === 'shower' || type === 'storm') && H <= 3) type = 'snow';
  const pop = clamp(Math.round((WEATHER[type].rain * 0.95 + rand(-0.05, 0.1)) * 10) * 10, 0, 100);
  let event = null;
  if (Math.random() < 0.09 && !(prev && prev.t.event)) event = pick(EVENTS);
  return { type, hi: H, lo: L, pop, event, wd: dateOf(day).getDay() };
}

function expectedTraffic(info) {
  const w = WEATHER[info.type];
  const extra = CATEGORIES.filter(c => c.unlock && G.unlocked[c.id]).length;
  let t = 165 * (0.5 + G.rep * 0.17) * w.traffic * WEEKDAY_TRAFFIC[info.wd] * (info.event ? info.event.traffic : 1) * (1 + 0.05 * extra);
  if (info.hi >= 33 || info.hi <= 4) t *= 0.92;
  if (info.buzz) t *= 1.2;
  return t;
}

function makeForecast(day, lead) {
  const t = G.wx[day].t, err = 0.04 + lead * 0.033;
  let type = t.type;
  if (Math.random() < err) type = pick(WX_NEIGHBOR[type]);
  if (lead > 8 && Math.random() < 0.08) type = pick(['sunny', 'cloudy', 'rain']);
  const s = 0.6 + lead * 0.35;
  const hi = Math.round(t.hi + gauss() * s), lo = Math.min(hi - 1, Math.round(t.lo + gauss() * s));
  const pop = clamp(Math.round((t.pop + gauss() * (5 + lead * 4) + (type !== t.type ? (WEATHER[type].rain - WEATHER[t.type].rain) * 60 : 0)) / 10) * 10, 0, 100);
  const event = t.event && (lead <= 9 || Math.random() < 0.4) ? t.event : null;
  const info = { type, hi, lo, pop, event, wd: t.wd };
  const traffic = Math.round(expectedTraffic(info) * (1 + gauss() * (0.05 + 0.012 * lead)) / 5) * 5;
  return { ...info, traffic };
}

function ensureWeather() {
  for (let d = Math.max(1, G.day - 1); d <= G.day + 15; d++) if (!G.wx[d]) G.wx[d] = { t: genTrueDay(d) };
  for (const k of Object.keys(G.wx)) if (+k < G.day - 2) delete G.wx[k];
}
function refreshForecasts() {
  for (let d = G.day; d <= G.day + 14; d++) {
    const w = G.wx[d], lead = d - G.day;
    if (!w.f || lead <= 1 || Math.random() < 0.45) w.f = makeForecast(d, lead);
  }
}

function todayWx() { return G.wx[G.day].t; }
function tempNow() {
  const t = todayWx(), h = G.minute / 60;
  const k = h >= 5 && h <= 14 ? (h - 5) / 9 : h > 14 ? 1 - (h - 14) / 15 : 1 - (h + 10) / 15;
  return lerp(t.lo, t.hi, Math.sin(clamp(k, 0, 1) * Math.PI / 2));
}

function planRain(init) {
  const t = todayWx(), W = WEATHER[t.type];
  const p = t.pop / 100;
  const raining = G.rainTarget > 0.05;
  let now = raining;
  if (init || Math.random() > 0.65) now = Math.random() < p;
  const amt = t.type === 'storm' || t.type === 'typhoon' ? 1 : t.type === 'rain' || t.type === 'snow' ? 0.85 : 0.6;
  G.rainTarget = now ? amt : 0;
  G.snow = !!W.snow;
  if (!init && now !== raining && G.started) toast(now ? (G.snow ? '❄️ 下雪了' : '☔ 下雨了') : '🌤 雨停了');
}

/* 一天开始 */
function startDay() {
  ensureWeather();
  refreshForecasts();
  const w = G.wx[G.day];
  w.f0 = { ...w.f };
  if (G.buzz > 0) G.buzz--;
  G.todayTarget = expectedTraffic({ ...w.t, buzz: G.buzz > 0 }) * Math.exp(gauss() * 0.2);
  for (const p of PRODUCTS) G.costMult[p.id] = clamp(Math.exp(gauss() * 0.07), 0.82, 1.2);
  // 应聘者更新
  G.candidates = G.candidates.filter(() => Math.random() < 0.35);
  const n = randInt(4, 7);
  for (let i = 0; i < n && G.candidates.length < 12; i++) G.candidates.push(genApplicant());
  G.fin.today = newFinDay();
  for (const v of G.vend || []) v.sold = 0;
  planRain(true);
}
function endDay() {
  const t = G.fin.today;
  t.customers = G.todayCustomers;
  G.fin.history.push(t);
  if (G.fin.history.length > 30) G.fin.history.shift();
  const profit = t.sales + t.vend - t.purchase - t.wages - t.other;
  toast(`🌙 ${dateLabel(G.day)} 结算：营业额 ${yen(t.sales)}，利润 ${yen(profit)}，来客 ${t.customers} 人`);
}

/* 每小时 */
function onHour(prevHour) {
  const wd = dateOf(G.day).getDay();
  for (const st of G.staff) {
    if (onShift(st, prevHour)) {
      const pay = hourlyPay(st, prevHour, wd);
      G.money = r1(G.money - pay); G.fin.today.wages = r1(G.fin.today.wages + pay);
    }
  }
  planRain(false);
  if (typeof maybeEvent === 'function') maybeEvent(prevHour);
}

/* ================= 员工 ================= */
function hourlyPay(st, h, wd) {
  return r1(st.wage * (h >= 22 || h < 6 ? NIGHT_RATE : 1) + (wd === 0 || wd === 6 ? WEEKEND_BONUS : 0));
}
function onShift(st, h) {
  if (st.absentDay === G.day) return false;
  const s = SHIFTS[st.shift];
  return s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to;
}
function statEff(st, key) {
  let v = st.stats[key];
  const h = Math.floor(G.minute / 60);
  if (st.traits.includes('owl') && st.shift === 'night') v++;
  if (st.traits.includes('lark') && st.shift === 'morning') v++;
  // 体力: 班次后半段效率下降
  const s = SHIFTS[st.shift], into = ((h - s.from + 24) % 24) / 8;
  if (into > 0.6 && st.stats.stamina <= 2) v -= 1;
  return clamp(v, 1, 6);
}

function genApplicant() {
  const type = wpick(APPLICANT_TYPES, t => t.w);
  let gender = Math.random() < 0.5 ? 'm' : 'f', name, nationality = null;
  if (type.id === 'intl') { const f = pick(FOREIGN); name = f.name; gender = f.g; nationality = f.from; }
  else name = pick(SURNAMES) + ' ' + pick(gender === 'm' ? GIVEN_M : GIVEN_F);
  const age = randInt(type.age[0], type.age[1]);

  const traits = [];
  while (traits.length < 2) {
    const t = pick(TRAITS).id;
    if (traits.includes(t)) continue;
    if ((t === 'owl' && traits.includes('lark')) || (t === 'lark' && traits.includes('owl'))) continue;
    if (t === 'veteran' && age < 22) continue;
    traits.push(t);
  }
  // 工作经历
  const jobs = [];
  const nJobs = type.id === 'hs' ? randInt(0, 1) : type.id === 'senior' ? 1 : type.id === 'uni' ? randInt(0, 2) : randInt(1, 3);
  for (let i = 0; i < nJobs; i++) {
    const j = pick(PAST_JOBS);
    if (jobs.some(x => x.t === j.t)) continue;
    jobs.push({ t: j.t, s: j.s, y: type.id === 'senior' && i === 0 ? randInt(25, 40) : randInt(1, type.id === 'hs' ? 1 : 4) });
  }
  if (traits.includes('veteran') && !jobs.some(j => j.t.includes('便利店'))) jobs.unshift({ t: '其他便利店 店员', s: 'cashier', y: randInt(3, 8) });

  const stats = {};
  for (const k of Object.keys(STAT_NAMES)) stats[k] = randInt(1, 3);
  for (const [k, v] of Object.entries(type.mod)) stats[k] += v;
  for (const t of traits) for (const [k, v] of Object.entries(TRAIT_BY_ID[t].mod)) stats[k] += v;
  for (const j of jobs) stats[j.s] += j.y >= 3 ? 1 : 0.5;
  for (const k of Object.keys(stats)) stats[k] = clamp(Math.round(stats[k]), 1, 5);
  const sum = Object.values(stats).reduce((a, b) => a + b, 0);
  const wage = clamp(Math.round(WAGE_MIN + Math.max(0, sum - 7) * 1.1 + type.wage + randInt(0, 3)), WAGE_MIN, WAGE_MAX);  // 时薪(元)

  const style = gender === 'f' ? pick([1, 2, 3, 6, 0, 2, 1]) : pick([0, 4, 5, 0, 2]);
  const look = {
    skin: pick(LOOKS.skin), hair: type.id === 'senior' ? pick(LOOKS.hairOld) : pick(LOOKS.hair), style,
    eye: randInt(0, 2), mouth: randInt(0, 2), glasses: Math.random() < 0.25, blush: gender === 'f' && Math.random() < 0.6,
    tall: rand(0.9, 1.06) * (gender === 'f' ? 0.96 : 1), bg: pick(['#dfe7f2', '#e8e1f0', '#e3efe6', '#f2e8dc', '#e6e6e6']),
  };
  let school;
  if (type.id === 'hs') school = [pick(SCHOOLS.hs) + ` ${age - 15} 年级 在读`];
  else if (type.id === 'uni') school = [pick(SCHOOLS.adult.slice(0, 2)), pick(SCHOOLS.uni) + ` ${clamp(age - 18, 1, 4)} 年级 在读`];
  else if (type.id === 'intl') school = [`${nationality}的高中 毕业`, pick(SCHOOLS.intl) + ' 在读'];
  else school = [pick(SCHOOLS.adult)];
  const lic = [pick(LICENSES)];
  if (type.id === 'intl') lic[0] = pick(['日本语能力考试 N2', '日本语能力考试 N3', '日本语能力考试 N1']);
  const hobbies = [pick(HOBBIES)]; while (hobbies.length < 2) { const h = pick(HOBBIES); if (!hobbies.includes(h)) hobbies.push(h); }

  return {
    id: G.nextId++, name, gender, age, type: type.id, typeName: type.name, nationality, traits, stats, wage,
    shift: pick(type.shift), look, role: 'auto', hiredDay: 0,
    resume: {
      school, jobs, license: lic, hobbies, motive: pick(MOTIVES[type.id]), pr: PR_BY_TRAIT[traits[0]],
      area: pick(AREAS), days: pick(['每周 3 天以上', '每周 4～5 天', '每天都可以', '每周 2～3 天']),
    },
  };
}

function hire(c) {
  if (G.staff.length >= MAX_STAFF) { toast(`员工最多 ${MAX_STAFF} 人`); return false; }
  const i = G.candidates.indexOf(c); if (i >= 0) G.candidates.splice(i, 1);
  c.hiredDay = G.day;
  G.staff.push(c);
  toast(`🎉 ${c.name} 加入了！（${SHIFTS[c.shift].name}）`);
  return true;
}
function fire(st) {
  const i = G.staff.indexOf(st); if (i >= 0) G.staff.splice(i, 1);
  delete G.staffRT[st.id];
  toast(`${st.name} 离开了这家店…`);
}
function postJobAd() {
  const cost = 80;
  if (G.money < cost) { toast('💸 钱不够'); return false; }
  G.money -= cost; G.fin.today.other += cost;
  for (let i = 0; i < 4; i++) G.candidates.unshift(genApplicant());
  G.candidates = G.candidates.slice(0, 14);
  return true;
}

/* 员工在场景里的行为 */
function staffLook(st) {
  const L = st.look;
  return { shirt: '#2a9d8f', pants: '#2b2d42', hair: L.hair, skin: L.skin, apron: '#f4a261', tall: L.tall, longHair: L.style === 1 || L.style === 3, bun: L.style === 6, glasses: L.glasses };
}
function currentCashier() {
  const h = Math.floor(G.minute / 60);
  const on = G.staff.filter(s => onShift(s, h) && s.role !== 'stock' && G.staffRT[s.id] && G.staffRT[s.id].state !== 'leaving');
  if (!on.length) return null;
  on.sort((a, b) => (b.role === 'cashier') - (a.role === 'cashier') || statEff(b, 'cashier') - statEff(a, 'cashier'));
  return on[0];
}

function updateStaff(dt) {
  if (!G.staffRT) G.staffRT = {};
  const h = Math.floor(G.minute / 60);
  for (const st of G.staff) {
    let rt = G.staffRT[st.id];
    const working = onShift(st, h);
    if (working && !rt) {
      rt = G.staffRT[st.id] = { x: STAFF_HOME[0], y: STAFF_HOME[1], path: [], state: 'idle', timer: 0, alpha: 0, phase: 0, speed: 1.5, dir: [0, 1], look: staffLook(st), umbrella: 0, st };
    }
    if (!rt) continue;
    if (working && (rt.state === 'leaving' || rt.state === 'gone')) { rt.state = 'idle'; rt.role = null; rt.timer = 0; }
    rt.alpha = clamp(rt.alpha + dt * 2 * (rt.state === 'gone' ? -1 : 1), 0, 1);
    if (!working && rt.state !== 'leaving' && rt.state !== 'gone') {
      rt.state = 'leaving'; rt.path = routeHome(rt); rt.bubble = null; rt.target = null;
    }
    const arrived = moveAlong(rt, dt);
    if (rt.state === 'leaving' && arrived) rt.state = 'gone';
    if (rt.state === 'gone' && rt.alpha <= 0) { delete G.staffRT[st.id]; continue; }
    if (rt.state === 'leaving' || rt.state === 'gone') continue;
  }
  const cashier = currentCashier();
  for (const st of G.staff) {
    const rt = G.staffRT[st.id];
    if (!rt || rt.state === 'leaving' || rt.state === 'gone') continue;
    if (cashier === st) staffCashier(st, rt, dt);
    else staffStocker(st, rt, dt);
  }
}

function behindCounter(x) { return x > COUNTER.x1 - 0.05; }
function routeHome(rt) {
  if (behindCounter(rt.x)) return [STAFF_HOME.slice()];
  return [...navPath(rt.x, rt.y, 11.8, 2.92), [11.8, 2.6], [13.55, 2.55], STAFF_HOME.slice()];
}
function routeFromHome(tx, ty) {
  return [[13.55, 2.55], [11.8, 2.6], ...navPath(11.8, 2.92, tx, ty)];
}

function staffCashier(st, rt, dt) {
  if (rt.role !== 'cashier') { rt.role = 'cashier'; rt.state = 'toRegister'; rt.path = behindCounter(rt.x) ? [REGISTER_POS.slice()] : [...routeHome(rt).slice(0, -1), REGISTER_POS.slice()]; rt.bubble = null; }
  if (rt.state === 'toRegister' && !rt.path.length) { rt.state = 'register'; rt.face = [-1, 0]; }
  if (rt.state !== 'register') return;
  const c = G.queue[0];
  if (c && c.ready) {
    rt.timer += dt;
    const need = 3.0 - statEff(st, 'cashier') * 0.4;
    rt.bubble = '💴';
    if (rt.timer >= need) { rt.timer = 0; checkout(c, st); }
  } else { rt.timer = 0; rt.bubble = null; }
}

function staffStocker(st, rt, dt) {
  if (rt.role !== 'stock') { rt.role = 'stock'; rt.state = 'idle'; rt.path = routeHome(rt); rt.target = null; rt.bubble = null; }
  switch (rt.state) {
    case 'idle': {
      if (rt.path.length) return;
      rt.timer -= dt;
      if (rt.timer > 0) return;
      if (st.traits.includes('slacker') && Math.random() < 0.15) { rt.timer = 6; rt.bubble = '💤'; return; }
      rt.bubble = null;
      const busy = Object.values(G.staffRT).map(r => r.target).filter(Boolean);
      // 先处理地上的水渍
      const spill = (G.floorItems || []).find(f => f.type === 'spill' && !f.claimed);
      if (spill) {
        spill.claimed = true; rt.target = 'spill'; rt.spill = spill; rt.state = 'walk'; rt.bubble = '🧹';
        rt.path = routeFromHome(spill.x, spill.y + 0.35); return;
      }
      const cats = CATEGORIES.filter(c => G.unlocked[c.id] && !busy.includes(c.id) && catNeedsRestock(c.id, 0.55));
      if (!cats.length) { rt.timer = 1.5; return; }
      cats.sort((a, b) => catState(a.id).shelf / Math.max(1, catState(a.id).cap) - catState(b.id).shelf / Math.max(1, catState(b.id).cap));
      const cat = cats[0];
      rt.target = cat.id;
      rt.state = 'walk';
      if (cat.stand) { const sp = standFor(cat.id); rt.path = routeFromHome(sp[0], sp[1]); rt.face = faceFor(cat.id); }
      else { rt.path = [[13.4, 4.6]]; rt.face = [-1, 0]; }
      rt.bubble = '📦';
      break;
    }
    case 'walk':
      if (!rt.path.length) { rt.state = 'work'; rt.timer = rt.target === 'spill' ? 2.5 : 3.4 - statEff(st, 'stock') * 0.45; }
      break;
    case 'work':
      rt.timer -= dt;
      if (rt.timer <= 0 && rt.target === 'spill') {
        cleanFloorItem(rt.spill); rt.spill = null; rt.target = null; rt.state = 'idle'; rt.timer = 1; rt.bubble = null; rt.path = routeHome(rt);
      } else if (rt.timer <= 0) {
        const n = restockCat(rt.target);
        if (n > 0 && st.traits.includes('doji') && Math.random() < 0.15) {
          const ps = carriedIn(rt.target).filter(p => G.inv[p.id].shelf > 0);
          if (ps.length) { const p = pick(ps); G.inv[p.id].shelf--; const [sx, sy] = proj(rt.x, rt.y, 2.1); addFloat(sx, sy, `💥 摔坏了${p.emoji}`, '#ff9f8a'); }
        }
        if (n > 0) { const [sx, sy] = proj(rt.x, rt.y, 2.1); addFloat(sx, sy, `⬆ 上架 ${n}`, '#9ff0c8'); }
        rt.target = null; rt.state = 'idle'; rt.timer = 1; rt.bubble = null;
        rt.path = routeHome(rt);
      }
      break;
  }
}

/* ================= 头像 (简历照片) ================= */
const _portraits = new Map();
function portraitURL(person) {
  if (_portraits.has(person.id)) return _portraits.get(person.id);
  const url = drawPortrait(person.look, person.gender, person.age);
  _portraits.set(person.id, url);
  return url;
}
function drawPortrait(L, gender, age) {
  const W = 120, H = 150, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), cx = W / 2, hy = 64, hw = 31, hh = 38;
  g.fillStyle = L.bg; g.fillRect(0, 0, W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // 后发
  g.fillStyle = L.hair;
  if (L.style === 1) { rr(cx - hw - 7, hy - hh + 4, hw * 2 + 14, 100, 24); g.fill(); }
  if (L.style === 2) { rr(cx - hw - 6, hy - 26, hw * 2 + 12, 62, 18); g.fill(); }
  if (L.style === 3) { g.beginPath(); g.ellipse(cx + hw + 6, hy + 4, 10, 26, -0.25, 0, 7); g.fill(); }
  // 西装 (履历照片)
  g.fillStyle = gender === 'f' && Math.random() < 0.4 ? '#3b3f52' : '#23263a';
  g.beginPath(); g.ellipse(cx, H + 18, 60, 52, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - 16, 112); g.lineTo(cx + 16, 112); g.lineTo(cx, 140); g.closePath(); g.fill();
  if (gender === 'm') { g.fillStyle = pick(['#8b1e3f', '#1d3557', '#2a6f5f']); g.beginPath(); g.moveTo(cx - 4, 116); g.lineTo(cx + 4, 116); g.lineTo(cx + 6, 140); g.lineTo(cx - 6, 140); g.closePath(); g.fill(); }
  // 脖子 & 脸
  g.fillStyle = L.skin; g.fillRect(cx - 10, hy + 26, 20, 26);
  g.beginPath(); g.ellipse(cx - hw + 1, hy + 4, 6, 9, 0, 0, 7); g.ellipse(cx + hw - 1, hy + 4, 6, 9, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx, hy, hw, hh, 0, 0, 7); g.fill();
  // 前发
  g.fillStyle = L.hair;
  g.beginPath();
  if (L.style === 4) {
    g.moveTo(cx - hw, hy - 14); g.quadraticCurveTo(cx - hw, hy - hh - 4, cx, hy - hh - 2); g.quadraticCurveTo(cx + hw, hy - hh - 4, cx + hw, hy - 14);
    g.quadraticCurveTo(cx, hy - 30, cx - hw, hy - 14);
  } else if (L.style === 5) {
    g.moveTo(cx - hw - 2, hy - 2);
    const pts = 7;
    for (let i = 0; i <= pts; i++) { const a = Math.PI + i / pts * Math.PI; g.lineTo(cx + Math.cos(a) * (hw + (i % 2 ? 10 : 2)), hy - 8 + Math.sin(a) * (hh + (i % 2 ? 10 : 2))); }
    g.lineTo(cx + hw + 2, hy - 2); g.lineTo(cx + hw - 6, hy - 16); g.lineTo(cx, hy - 22); g.lineTo(cx - hw + 6, hy - 16);
  } else {
    g.moveTo(cx - hw - 3, hy + (L.style === 2 || L.style === 1 ? 14 : -2));
    g.quadraticCurveTo(cx - hw - 2, hy - hh - 10, cx, hy - hh - 7);
    g.quadraticCurveTo(cx + hw + 2, hy - hh - 10, cx + hw + 3, hy + (L.style === 2 || L.style === 1 ? 14 : -2));
    g.lineTo(cx + hw - 5, hy - 14);
    if (gender === 'f') { g.quadraticCurveTo(cx + 6, hy - 14, cx - 4, hy - 30); g.quadraticCurveTo(cx - 14, hy - 16, cx - hw + 5, hy - 12); }
    else { g.lineTo(cx + 12, hy - 22); g.lineTo(cx + 2, hy - 16); g.lineTo(cx - 10, hy - 24); g.lineTo(cx - hw + 5, hy - 14); }
  }
  g.closePath(); g.fill();
  if (L.style === 6) { g.beginPath(); g.arc(cx, hy - hh - 8, 13, 0, 7); g.fill(); }
  // 眉毛
  g.strokeStyle = L.hair === '#e6e6e6' ? '#999' : L.hair; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 20, hy - 9); g.lineTo(cx - 8, hy - 10); g.moveTo(cx + 8, hy - 10); g.lineTo(cx + 20, hy - 9); g.stroke();
  // 眼睛
  const ey = hy + 2;
  g.fillStyle = '#2a2a2a'; g.strokeStyle = '#2a2a2a'; g.lineWidth = 2.6;
  for (const ex of [cx - 13, cx + 13]) {
    if (L.eye === 0) { g.beginPath(); g.arc(ex, ey, 3.6, 0, 7); g.fill(); }
    else if (L.eye === 1) { g.beginPath(); g.arc(ex, ey + 2, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 5.5, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(ex, ey, 3, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1, ey - 1, 1, 0, 7); g.fill(); g.fillStyle = '#2a2a2a'; }
  }
  if (L.glasses) {
    g.strokeStyle = '#333'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx - 13, ey, 9, 0, 7); g.moveTo(cx + 22, ey); g.arc(cx + 13, ey, 9, 0, 7); g.moveTo(cx - 4, ey); g.lineTo(cx + 4, ey); g.stroke();
  }
  if (L.blush) { g.fillStyle = 'rgba(255,120,140,0.35)'; g.beginPath(); g.ellipse(cx - 19, ey + 11, 6, 3.5, 0, 0, 7); g.ellipse(cx + 19, ey + 11, 6, 3.5, 0, 0, 7); g.fill(); }
  // 鼻子嘴巴
  g.strokeStyle = 'rgba(120,70,50,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, ey + 8); g.lineTo(cx - 2, ey + 13); g.stroke();
  g.strokeStyle = '#8a3b3b'; g.fillStyle = '#8a3b3b'; g.lineWidth = 2.4;
  if (L.mouth === 0) { g.beginPath(); g.arc(cx, ey + 16, 7, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  else if (L.mouth === 1) { g.beginPath(); g.moveTo(cx - 6, ey + 21); g.lineTo(cx + 6, ey + 21); g.stroke(); }
  else { g.beginPath(); g.moveTo(cx - 8, ey + 18); g.quadraticCurveTo(cx, ey + 30, cx + 8, ey + 18); g.closePath(); g.fill(); }
  if (age >= 55) { g.strokeStyle = 'rgba(120,80,60,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 25, ey + 12); g.lineTo(cx - 20, ey + 18); g.moveTo(cx + 25, ey + 12); g.lineTo(cx + 20, ey + 18); g.stroke(); }
  return c.toDataURL();
}

/* ================= 自动贩卖机 ================= */
function vendChance(i) {
  const d = VEND_DEFS[i], vm = G.vend[i], T = G.temp ?? 15;
  if (!vm || vm.stock <= 0) return 0;
  let p = 0.04;
  if (d.hot) p *= T < 14 ? 1.8 : 0.7;
  if (d.cold) p *= T > 22 ? 2 : 0.8;
  if (!d.hot && !d.cold) p *= T > 24 ? 1.6 : 1;
  const ratio = vm.price / d.price;
  p *= ratio <= 1 ? 1 + (1 - ratio) : Math.max(0, 1 - (ratio - 1) * 2);
  return p;
}
function vendSell(i, p) {
  const vm = G.vend[i];
  if (!vm || vm.stock <= 0) return;
  vm.stock--; vm.sold = (vm.sold || 0) + 1;
  G.money = r1(G.money + vm.price); G.fin.today.vend = r1(G.fin.today.vend + vm.price);
  const [sx, sy] = proj(VEND_X[i] + 0.42, 6.9, 1.6);
  addFloat(sx, sy, `+¥${vm.price}`, '#9fd3ff');
  Sound.tone(110, 0, 0.18, 'square', 0.12); Sound.tone(80, 0.08, 0.2, 'square', 0.1);
  if (vm.stock === 3) toast(`🥫 ${VEND_DEFS[i].name}快卖空了，记得补货`);
}
function vendRefill(i) {
  const vm = G.vend[i], d = VEND_DEFS[i], n = vm.cap - vm.stock, cost = r1(n * d.cost);
  if (n <= 0) { toast('已经是满的'); return false; }
  if (G.money < cost) { toast('💸 钱不够'); return false; }
  G.money = r1(G.money - cost); G.fin.today.purchase = r1(G.fin.today.purchase + cost);
  vm.stock = vm.cap;
  toast(`🥫 ${d.name}补满了 (+${n} 罐，-${yen(cost)})`);
  Sound.restock();
  return true;
}
