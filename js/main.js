'use strict';
/* =========================================================
 * main.js — 游戏状态 / 顾客AI / 输入 / HUD / 主循环
 * ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ISO.ctx = ctx;

const SAVE_KEY = 'amayadori-mart-save-v3';
const MIN_PER_SEC = 3;            // 现实 1 秒 = 游戏 3 分钟 (一天 8 分钟)

const G = {
  started: false, paused: false, speed: 1,
  money: START_MONEY, rep: 3, day: 1, minute: 21 * 60, served: 0, todayCustomers: 0,
  rain: 1, rainTarget: 1, snow: false, cut: 0, cutTarget: 0, door: 0,
  customers: [], passers: [], cars: [], trucks: [], floats: [], queue: [], ripples: [], drops: [], staffRT: {},
  passT: 0.5, carT: 1.5, saveT: 10, lastHour: 21, todayTarget: 80,
  hits: [], hover: null, time: 0,
};
const env = { night: 1, rain: 1, cut: 0, door: 0, minute: G.minute };

const clerk = {
  x: REGISTER_POS[0], y: REGISTER_POS[1], dir: [-1, 0], moving: false, phase: 0, alpha: 1,
  look: { shirt: '#2a9d8f', pants: '#2b2d42', hair: '#1b1b1b', skin: '#f1d3b3', cap: '#2a9d8f', apron: '#f4a261', tall: 1 },
};

const INTERIOR = buildInteriorStatics();
const FRONT = buildFrontStatics();
const BACK = buildBackStatics();

/* ---------------- 相机 ---------------- */
const cam = { anim: null };
function fitZoom() { return isPortrait() ? ISO.W / 1150 : Math.min(ISO.W / 1250, ISO.H / 820); }
function setView(wx, wy, wz, zoom, offY = 0) {
  ISO.zoom = zoom;
  ISO.panX = -((wx - wy) * ISO.TW / 2 * zoom);
  ISO.panY = -(((wx + wy) * ISO.TH / 2 - wz * ISO.TZ) * zoom) + offY;
}
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
const isPortrait = () => ISO.H > ISO.W * 1.05;
const VIEW_TITLE = () => isPortrait()
  ? [10, 5.6, 1.2, ISO.W / 820, -ISO.H * 0.2]
  : [10.5, 6.6, 1.0, fitZoom() * 0.95, -ISO.H * 0.15];
const VIEW_GAME = () => isPortrait()
  ? [9.0, 4.3, 0.9, clamp(ISO.W / 590, 0.35, 2.2), -ISO.H * 0.02]
  : [9.4, 4.7, 0.8, Math.min(ISO.W / 720, ISO.H / 560), ISO.H < 500 ? 0 : 10];
function animateView(to, dur = 1.6) {
  const from = { zoom: ISO.zoom, panX: ISO.panX, panY: ISO.panY };
  setView(...to);
  const target = { zoom: ISO.zoom, panX: ISO.panX, panY: ISO.panY };
  Object.assign(ISO, from);
  cam.anim = { from, target, t: 0, dur };
}
function updateCam(dt) {
  if (!cam.anim) return;
  const a = cam.anim; a.t += dt;
  const k = clamp(a.t / a.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  ISO.zoom = lerp(a.from.zoom, a.target.zoom, e);
  ISO.panX = lerp(a.from.panX, a.target.panX, e);
  ISO.panY = lerp(a.from.panY, a.target.panY, e);
  if (k >= 1) cam.anim = null;
}

function resize() {
  ISO.dpr = Math.min(2, window.devicePixelRatio || 1);
  ISO.W = window.innerWidth; ISO.H = window.innerHeight;
  canvas.width = Math.round(ISO.W * ISO.dpr);
  canvas.height = Math.round(ISO.H * ISO.dpr);
  canvas.style.width = ISO.W + 'px'; canvas.style.height = ISO.H + 'px';
  // 手机地址栏伸缩只改变高度, 此时不重置玩家拖动过的视角
  if (Math.abs(ISO.W - (resize.lastW || 0)) > 1 || !G.started) setView(...(G.started ? VIEW_GAME() : VIEW_TITLE()));
  resize.lastW = ISO.W;
  initDrops();
}

/* ---------------- 时间 / 天气 / 光照 ---------------- */
function nightness(h) {
  if (h >= 19.5 || h < 4.5) return 1;
  if (h < 6.5) return 1 - (h - 4.5) / 2;
  if (h < 17) return 0;
  return (h - 17) / 2.5;
}
function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function computeLight() {
  const h = G.minute / 60, N = nightness(h), r = G.rain;
  const dk = G.started && G.wx && G.wx[G.day] ? WEATHER[G.wx[G.day].t.type].dark : 0;
  const day = [1 - 0.2 * r - dk * 0.4, 1 - 0.2 * r - dk * 0.4, 1 - 0.15 * r - dk * 0.3];
  let a = mix3(day, [0.27, 0.31, 0.5], N);
  const w = Math.max(0, 1 - Math.abs(h - 18) / 1.3, 1 - Math.abs(h - 5.6) / 1.0) * (1 - 0.5 * r);
  a = [a[0] * lerp(1, 1.08, w), a[1] * lerp(1, 0.8, w), a[2] * lerp(1, 0.72, w)];
  AMB = a;
  env.night = N; env.rain = r; env.cut = G.cut; env.door = G.door; env.minute = G.minute;
  // 背景色
  const dayTop = mix3([150, 185, 215], [120, 132, 148], r), dayBot = mix3([225, 233, 240], [170, 178, 188], r);
  let top = mix3(dayTop, [12, 18, 34], N), bot = mix3(dayBot, [4, 6, 11], N);
  top = mix3(top, [70, 58, 96], w * 0.8); bot = mix3(bot, [229, 150, 105], w * 0.8);
  env.bgTop = top.map(v => v | 0); env.bgBot = bot.map(v => v | 0);
}

/* ---------------- 雨 ---------------- */
function initDrops() {
  G.drops = [];
  const nDrops = Math.min(520, Math.round(ISO.W * ISO.H / 1900));
  for (let i = 0; i < nDrops; i++) G.drops.push({ x: Math.random() * ISO.W, y: Math.random() * ISO.H, l: rand(10, 22), v: rand(650, 950) });
}
function updateRain(dt) {
  for (const d of G.drops) {
    d.y += d.v * dt; d.x += d.v * 0.16 * dt;
    if (d.y > ISO.H) { d.y = -d.l; d.x = Math.random() * ISO.W * 1.1 - ISO.W * 0.1; }
  }
  const n = G.rain * 60 * dt;
  for (let i = 0; i < n; i++) {
    const x = rand(0, BOARD.w), y = rand(0, BOARD.h);
    const inStore = x > STORE.x0 && x < STORE.x1 && y > STORE.y0 && y < STORE.y1;
    if (inStore && G.cut > 0.5) continue;
    G.ripples.push({ x, y, z: inStore ? STORE.H + 0.16 : 0.02, t: 0 });
  }
  G.ripples = G.ripples.filter(r => (r.t += dt) < 0.45);
}
function drawRain() {
  if (G.rain < 0.02) return;
  const c = ctx;
  if (G.snow) {
    c.fillStyle = `rgba(245,248,255,${0.8 * G.rain})`;
    const n = Math.min(G.drops.length, (G.drops.length * G.rain * 0.6) | 0);
    for (let i = 0; i < n; i++) {
      const d = G.drops[i], sx = (d.x + Math.sin(G.time * 1.5 + i) * 12) % ISO.W, sy = (d.y * 0.35 + i * 37) % ISO.H;
      c.beginPath(); c.arc(sx, sy, 1.2 + (i % 3) * 0.7, 0, 7); c.fill();
    }
    return;
  }
  c.strokeStyle = MANGA.on ? (env.night > 0.5 ? `rgba(255,255,255,${0.6 * G.rain})` : `rgba(0,0,0,${0.45 * G.rain})`) : `rgba(200,215,240,${0.35 * G.rain})`; c.lineWidth = 1;
  c.beginPath();
  const n = Math.min(G.drops.length, (G.drops.length * G.rain) | 0);
  for (let i = 0; i < n; i++) {
    const d = G.drops[i];
    c.moveTo(d.x, d.y); c.lineTo(d.x - d.l * 0.16, d.y - d.l);
  }
  c.stroke();
  for (const r of G.ripples) {
    const [sx, sy] = proj(r.x, r.y, r.z), k = r.t / 0.45;
    c.strokeStyle = `rgba(210,225,250,${0.5 * (1 - k) * G.rain})`;
    c.beginPath(); c.ellipse(sx, sy, (2 + 9 * k) * ISO.zoom, (1 + 4.5 * k) * ISO.zoom, 0, 0, 7); c.stroke();
  }
}

/* ---------------- 顾客 AI ---------------- */
function demandWeight(p) {
  if (!G.unlocked[p.cat] || !G.carried[p.id]) return 0;
  const h = G.minute / 60, T = G.temp == null ? 15 : G.temp;
  let w = p.pop;
  if (p.morning && h >= 6 && h < 10) w *= 1.8;
  if (p.lunch && h >= 11 && h < 14) w *= 1 + p.lunch;
  if (p.night && (h >= 20 || h < 4)) w *= 1 + p.night;
  if (p.heat) w *= clamp(Math.exp(p.heat * (T - 17) / 9), 0.12, 4);
  if (p.rain) w *= 1 + p.rain * G.rain;
  const r = priceRatio(p.id);
  w *= r < 1 ? 1 + (1 - r) * 1.2 : Math.max(0.15, acceptance(p.id));
  return w;
}

function chooseWants() {
  const r = Math.random(), n = r < 0.55 ? 1 : r < 0.87 ? 2 : 3;
  const pool = PRODUCTS.map(p => [p, demandWeight(p)]).filter(x => x[1] > 0);
  const out = [];
  while (out.length < n && pool.length) {
    const it = wpick(pool, x => x[1]);
    out.push(it[0].id);
    pool.splice(pool.indexOf(it), 1);
  }
  const shelf = out.filter(id => CAT_BY_ID[PRODUCT_BY_ID[id].cat].stand);
  const hot = out.filter(id => !CAT_BY_ID[PRODUCT_BY_ID[id].cat].stand);
  shelf.sort((a, b) => CAT_BY_ID[PRODUCT_BY_ID[a].cat].stand[1] - CAT_BY_ID[PRODUCT_BY_ID[b].cat].stand[1]);
  return [shelf, hot];
}

function spawnCustomer(opt = {}) {
  const fromLeft = opt.fromLeft ?? Math.random() < 0.5, sx = fromLeft ? 0.05 : BOARD.w - 0.05;
  let [wants, hot] = chooseWants();
  if (opt.wants) { wants = opt.wants.filter(id => CAT_BY_ID[PRODUCT_BY_ID[id].cat].stand); hot = opt.wants.filter(id => !CAT_BY_ID[PRODUCT_BY_ID[id].cat].stand); }
  const lane = LANE_CUSTOMER + rand(-0.12, 0.12);
  const c = {
    kind: 'customer', x: sx, y: lane, look: opt.look ? { ...randomLook(), ...opt.look } : randomLook(), wants, hot, got: [],
    state: 'walkIn', path: [[DOOR.cx + rand(-0.2, 0.2), lane], [DOOR.cx + rand(-0.15, 0.15), ENTRY_OUT[1]], [DOOR.cx + rand(-0.2, 0.2), ENTRY_IN[1]]], speed: opt.speed || rand(1.35, 1.8),
    phase: Math.random() * 6, moving: true, dir: [fromLeft ? 1 : -1, 0], alpha: 0, umbrella: G.rain > 0.3 ? 1 : 0,
    timer: 0, patience: 0, mood: 0, bubble: null, bubbleT: 0, exitX: Math.random() < 0.5 ? 0.05 : BOARD.w - 0.05,
    ...opt.flags,
  };
  G.customers.push(c);
  return c;
}

function spawnPasser() {
  const fromLeft = Math.random() < 0.5;
  const y = LANE_PASSER + rand(-0.06, 0.08), endX = fromLeft ? BOARD.w - 0.05 : 0.05;
  const p = {
    x: fromLeft ? 0.05 : BOARD.w - 0.05, y, look: randomLook(), path: [[endX, y]],
    speed: rand(0.95, 1.5), phase: Math.random() * 6, moving: true, dir: [fromLeft ? 1 : -1, 0], alpha: 0, umbrella: G.rain > 0.3 ? 1 : 0,
  };
  // 路过时顺便在自动贩卖机买一罐
  if (G.started && G.vend) {
    for (let i = 0; i < VEND_X.length; i++) {
      if (Math.random() < vendChance(i)) {
        const vx = VEND_X[i] + 0.42;
        p.vendI = i; p.path = [[vx, y], [vx, 7.42], [vx, y + 0.02], [endX, y]]; p.vendState = 'go';
        break;
      }
    }
  }
  G.passers.push(p);
}

function spawnCar() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  G.cars.push({ x: dir > 0 ? -1.4 : BOARD.w + 1.4, y: dir > 0 ? 10.1 : 12.0, dir, speed: rand(3.5, 5.5), color: pick(['#d9d9d9', '#2b2d42', '#e63946', '#457b9d', '#f1f1ee', '#5f7a63', '#e9c46a']) });
}

/** 自然移动: 转向平滑、起步加速、到达减速、拐角提前转弯、互相避让 */
function moveAlong(p, dt) {
  if (p.vx == null) { p.vx = 0; p.vy = 0; p.spd = 0; }
  if (!p.path.length) {
    const k = Math.max(0, 1 - dt * 9);
    p.vx *= k; p.vy *= k; p.spd = Math.hypot(p.vx, p.vy);
    p.moving = p.spd > 0.12;
    if (p.spd > 0.01) { p.x += p.vx * dt; p.y += p.vy * dt; }
    turnToward(p, p.face, dt, 6);
    return true;
  }
  let t = p.path[0], dx = t[0] - p.x, dy = t[1] - p.y, dist = Math.hypot(dx, dy);
  const last = p.path.length === 1;
  if (!last && dist < 0.32) { p.path.shift(); t = p.path[0]; dx = t[0] - p.x; dy = t[1] - p.y; dist = Math.hypot(dx, dy); }
  if (last && dist < 0.03) { p.x = t[0]; p.y = t[1]; p.path.shift(); p.moving = false; return true; }
  const maxS = p.speed * (p.slow || 1);
  const want = last ? Math.min(maxS, dist * 2.8 + 0.18) : maxS;
  let ux = dx / dist, uy = dy / dist;
  if (p.wobble) { const w = Math.sin(G.time * 2.3 + p.phase) * 0.45; const nx = ux - uy * w, ny = uy + ux * w, l = Math.hypot(nx, ny); ux = nx / l; uy = ny / l; }
  const sep = dist > 0.5 ? 1 : 0.2;
  const tx = ux * want + (p.sepX || 0) * sep, ty = uy * want + (p.sepY || 0) * sep;
  const acc = Math.min(1, dt * 7);
  p.vx += (tx - p.vx) * acc; p.vy += (ty - p.vy) * acc;
  // 防止冲过终点
  const step = Math.hypot(p.vx, p.vy) * dt;
  if (last && step >= dist) { p.x = t[0]; p.y = t[1]; p.path.shift(); p.moving = false; return true; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.spd = Math.hypot(p.vx, p.vy);
  if (p.spd > 0.05) turnToward(p, [p.vx / p.spd, p.vy / p.spd], dt, 10);
  p.phase += dt * 8.5 * Math.min(1.3, p.spd / 1.25);
  p.moving = p.spd > 0.1;
  return false;
}
function turnToward(p, f, dt, rate) {
  if (!f) return;
  if (!p.dir) p.dir = f.slice();
  const k = Math.min(1, dt * rate);
  let dx = p.dir[0] + (f[0] - p.dir[0]) * k, dy = p.dir[1] + (f[1] - p.dir[1]) * k;
  const l = Math.hypot(dx, dy) || 1;
  p.dir = [dx / l, dy / l];
}
/** 人与人之间的轻微排斥, 避免重叠 */
function computeSeparation(list) {
  for (const p of list) { p.sepX = 0; p.sepY = 0; }
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 > 0.3 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), f = (0.55 - d) * 1.6 / d;
      a.sepX += dx * f; a.sepY += dy * f; b.sepX -= dx * f; b.sepY -= dy * f;
    }
  }
}
/** 站着时偶尔东张西望 */
function idleLook(p, dt, base) {
  p.lookT = (p.lookT ?? rand(1, 4)) - dt;
  if (p.lookT <= 0) {
    p.lookT = rand(1.5, 4.5);
    const a = Math.atan2(base[1], base[0]) + rand(-0.9, 0.9);
    p.face = Math.random() < 0.6 ? base : [Math.cos(a), Math.sin(a)];
  }
}

function commonPersonUpdate(p, dt) {
  const edge = Math.min(p.x, BOARD.w - p.x);
  p.alpha = clamp(edge / 0.9, 0, 1);
  const wantUmb = G.rain > 0.3 && regionOf(p.x, p.y) !== 'in' && p.y > 7.85 ? 1 : 0;
  p.umbrella = clamp(p.umbrella + clamp(wantUmb - p.umbrella, -dt * 4, dt * 4), 0, 1);
}

function goNext(c) {
  if (c.wants.length) {
    const cat = PRODUCT_BY_ID[c.wants[0]].cat;
    const sp = standFor(cat);
    c.path = navPath(c.x, c.y, sp[0], sp[1]);
    c.face = faceFor(cat);
    c.state = 'toShelf';
  } else if (c.thief) {
    leave(c, 0); c.speed = 1.05;
  } else if (c.got.length || c.hot.length) {
    joinQueue(c);
  } else {
    leave(c, -1);
  }
}

function joinQueue(c) {
  G.queue.push(c);
  c.qi = G.queue.length - 1;
  const spot = QUEUE_SPOTS[Math.min(c.qi, QUEUE_SPOTS.length - 1)];
  c.path = navPath(c.x, c.y, spot[0], spot[1]);
  c.face = c.qi < 4 ? [1, 0] : [1, 0.3];
  c.state = 'queue'; c.ready = false;
  const cs = currentCashier();
  let pat = 28 + G.rep * 3;
  if (cs) pat *= 1 + statEff(cs, 'service') * 0.06 + (cs.traits.includes('healing') ? 0.2 : 0);
  c.patience = c.maxPatience = pat;
}

function leave(c, mood) {
  const qi = G.queue.indexOf(c);
  if (qi >= 0) G.queue.splice(qi, 1);
  c.state = 'leaving'; c.ready = false; c.sit = false;
  const lane = LANE_CUSTOMER + rand(-0.12, 0.12);
  c.path = [...navPath(c.x, c.y, DOOR.cx + rand(-0.2, 0.2), ENTRY_IN[1]), [DOOR.cx + rand(-0.15, 0.15), ENTRY_OUT[1]], [DOOR.cx, lane], [c.exitX, lane]];
  c.bubble = mood > 0 ? '♪' : mood < 0 ? '💢' : null;
  c.bubbleT = 3;
  if (mood < 0) Sound.angry();
}

function floatAt(c, text, color) { const [sx, sy] = proj(c.x, c.y, 2.1); addFloat(sx, sy, text, color); }

/** 顾客在货架前拿商品. 返回 'ok' | 'price' | 'empty' */
function takeItem(c, pid) {
  const inv = G.inv[pid];
  if (inv.shelf <= 0) return 'empty';
  if (Math.random() > acceptance(pid)) return 'price';
  inv.shelf--;
  c.got.push({ pid, price: G.price[pid] });
  return 'ok';
}

function tryTake(c, final) {
  const pid = c.wants[0];
  let r = takeItem(c, pid);
  if (r === 'empty') {
    // 同类替代品
    const alt = carriedIn(PRODUCT_BY_ID[pid].cat).filter(p => p.id !== pid && G.inv[p.id].shelf > 0);
    if (alt.length && Math.random() < 0.55) {
      const a = pick(alt);
      if (takeItem(c, a.id) === 'ok') { c.wants.shift(); floatAt(c, `换成${a.emoji}`, '#cde7ff'); goNext(c); return true; }
    }
    if (!final) return false;
    G.fin.today.lostStock++; G.fin.today.lostValue += G.price[pid];
    c.wants.shift(); c.mood--; G.rep = clamp(G.rep - 0.08, 0, 5);
    goNext(c);
    return true;
  }
  if (r === 'price') {
    G.fin.today.lostPrice++; G.fin.today.lostValue += G.price[pid];
    floatAt(c, '太贵了…', '#ffd0a8');
    c.wants.shift(); c.mood -= 0.5;
    goNext(c);
    return true;
  }
  c.wants.shift();
  goNext(c);
  return true;
}

function checkout(c, staff) {
  // 热食: 结账时点单
  for (const pid of c.hot) {
    const r = takeItem(c, pid);
    if (r === 'empty') { G.fin.today.lostStock++; G.fin.today.lostValue += G.price[pid]; c.mood -= 0.5; }
    else if (r === 'price') { G.fin.today.lostPrice++; }
  }
  c.hot = [];
  if (!c.got.length) { leave(c, -1); return; }
  let total = 0;
  for (const g of c.got) { total += g.price; recordSale(g.pid, g.price); }
  total = r1(total);
  G.money = r1(G.money + total); G.served++; G.fin.today.buyers++;
  let repGain = c.mood < 0 ? 0.001 : 0.006;
  if (staff) repGain += statEff(staff, 'service') * 0.0015;
  G.rep = clamp(G.rep + repGain, 0, 5);
  const [sx, sy] = proj(c.x, c.y, 2.0);
  addFloat(sx, sy, `+${yen(total)}`, '#7dffb0');
  Sound.coin();
  if (!staff && navigator.vibrate) navigator.vibrate(20);
  c.bag = true;
  if (typeof onCheckout === 'function') onCheckout(c, staff, total);
  // 买了热食/便当的客人, 有时会去イートイン坐一会儿
  const eat = c.got.some(g => ['hot', 'rice', 'bread'].includes(PRODUCT_BY_ID[g.pid].cat)) && Math.random() < 0.3;
  const seat = eat && EATIN_SEATS.findIndex((s, i) => !G.customers.some(o => o.seat === i));
  if (eat && seat >= 0) {
    const qi = G.queue.indexOf(c); if (qi >= 0) G.queue.splice(qi, 1);
    c.seat = seat; c.state = 'toSeat'; c.ready = false;
    const [sx, sy] = EATIN_SEATS[seat];
    c.path = navPath(c.x, c.y, sx, sy - 0.12).concat([[sx, sy]]); c.face = [0, 1];
    c.bubble = '♪'; c.bubbleT = 2;
    return;
  }
  leave(c, c.mood < 0 ? 0 : 1);
}

function updateCustomer(c, dt) {
  commonPersonUpdate(c, dt);
  if (c.bubbleT > 0) c.bubbleT -= dt;
  const arrived = moveAlong(c, dt);
  if (!c.chimed && c.state === 'walkIn' && c.y < 7.05) { c.chimed = true; Sound.chime(); G.todayCustomers++; }

  switch (c.state) {
    case 'walkIn': if (arrived) goNext(c); break;
    case 'toShelf':
      if (arrived) { c.state = 'pick'; c.timer = c.thief ? rand(5, 7) : rand(0.5, 1.4); c.reach = 0.6; }
      break;
    case 'pick':
      c.timer -= dt; c.reach = c.timer < 0.7 ? 0.8 : 0;
      if (c.timer <= 0 && !tryTake(c, false)) {
        c.state = 'waitStock'; c.timer = 6;
        floatAt(c, '缺货!', '#ff8a7a');
      }
      break;
    case 'waitStock':
      c.timer -= dt;
      if (G.inv[c.wants[0]].shelf > 0) tryTake(c, false);
      else if (c.timer <= 0) tryTake(c, true);
      break;
    case 'queue': {
      const idx = G.queue.indexOf(c);
      if (idx !== c.qi) {
        c.qi = idx;
        const spot = QUEUE_SPOTS[Math.min(idx, QUEUE_SPOTS.length - 1)];
        if (c.path.length) c.path[c.path.length - 1] = spot.slice(); else c.path = [spot.slice()];
      }
      c.ready = idx === 0 && !c.path.length;
      if (!c.path.length) c.patience -= dt * (idx === 0 ? 1 : 0.6);
      if (c.patience <= 0) { G.rep = clamp(G.rep - 0.3, 0, 5); for (const g of c.got) G.inv[g.pid].shelf++; c.got = []; leave(c, -1); }
      break;
    }
    case 'toSeat':
      if (arrived) { c.state = 'eat'; c.sit = true; c.timer = rand(10, 20); }
      break;
    case 'eat':
      c.timer -= dt;
      if (c.timer <= 0) { c.seat = null; leave(c, 1); }
      break;
    case 'leaving':
      if (arrived) c.dead = true;
      break;
  }
  if (!c.moving && !c.path.length) idleLook(c, dt, c.state === 'queue' ? [1, 0] : c.state === 'eat' ? [0, 1] : (c.face || [0, 1]));
}

function updatePasser(p, dt) {
  commonPersonUpdate(p, dt);
  if (p.vendState === 'go' && p.path.length === 2) {          // 到了贩卖机前
    p.vendState = 'buy'; p.timer = rand(1.2, 2.2); p.face = [0, -1]; p.savedPath = p.path; p.path = [];
  }
  if (p.vendState === 'buy') {
    p.timer -= dt; moveAlong(p, dt); p.reach = p.timer > 0.6 ? 0.6 : 0;
    if (p.timer <= 0) { vendSell(p.vendI, p); p.vendState = 'done'; p.path = p.savedPath; p.bag = Math.random() < 0.5; }
    return;
  }
  if (moveAlong(p, dt)) p.dead = true;
}

/* ---------------- 补货 (玩家点击货架) ---------------- */
function playerRestock(cat) {
  const C = CAT_BY_ID[cat];
  const [x, y, z, w, d, h] = C.box;
  const [sx, sy] = proj(x + w / 2, y + d / 2, z + h + 0.6);
  const st = catState(cat);
  if (!st.n) { toast(`${C.name}还没有在售商品，去「进货」订货吧`); return; }
  if (st.shelf >= st.cap) { toast(`${C.name}货架已经摆满了`); return; }
  const n = restockCat(cat);
  if (!n) { toast(`📦 仓库里没有${C.name}的货了，去「进货」订货吧`); Sound.angry(); return; }
  addFloat(sx, sy, `⬆ 上架 ${n} 件`, '#9ff0c8');
  Sound.restock();
  if (navigator.vibrate) navigator.vibrate(12);
}

function addFloat(x, y, text, color) { G.floats.push({ x, y, text, color, t: 0 }); }

function toast(msg) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
  while (box.children.length > 3) box.firstChild.remove();
}

/* ---------------- 主更新 ---------------- */
function update(dt) {
  G.time += dt;
  updateCam(dt);
  const adt = G.paused ? 0 : dt * G.speed;

  if (G.started && !G.paused) {
    const dm = adt * MIN_PER_SEC;
    G.minute += dm;
    if (G.minute >= 1440) {
      G.minute -= 1440;
      endDay();
      G.day++; G.todayCustomers = 0;
      startDay();
      save();
    }
    const hr = Math.floor(G.minute / 60);
    if (hr !== G.lastHour) { const prev = G.lastHour; G.lastHour = hr; onHour(prev); }
    G.temp = tempNow();
    // 客流: 泊松到达
    const lambda = G.todayTarget * hourTraffic(G.minute / 60) / HOUR_TRAFFIC_SUM / 60 * dm;
    if (Math.random() < lambda) {
      const inside = G.customers.filter(c => c.state !== 'leaving' && c.state !== 'eat').length;
      if (inside < MAX_INSIDE) spawnCustomer(); else { G.fin.today.crowded = (G.fin.today.crowded || 0) + 1; spawnPasser(); }
    }
    checkDeliveries();
    updateStaff(adt);
    G.saveT -= dt;
    if (G.saveT <= 0) { G.saveT = 10; save(); }
  }

  G.passT -= adt;
  if (G.passT <= 0) { spawnPasser(); G.passT = rand(3, 7) / (G.started ? hourTraffic(G.minute / 60) : 1); }
  G.carT -= adt;
  if (G.carT <= 0) { spawnCar(); G.carT = rand(4, 10); }

  G.rain = clamp(G.rain + clamp(G.rainTarget - G.rain, -dt * 0.25, dt * 0.25), 0, 1);
  G.cut = clamp(G.cut + clamp(G.cutTarget - G.cut, -dt * 1.5, dt * 1.5), 0, 1);
  Sound.setRain(G.snow ? 0 : G.rain);

  if (adt > 0) computeSeparation([...G.customers, ...G.passers, ...Object.values(G.staffRT || {})]);
  for (const c of G.customers) updateCustomer(c, adt);
  for (const p of G.passers) updatePasser(p, adt);
  if (typeof updateEvents === 'function') updateEvents(adt, dt);
  for (const car of G.cars) { car.x += car.dir * car.speed * adt; if (car.x < -2 || car.x > BOARD.w + 2) car.dead = true; }
  updateTrucks(adt);
  G.customers = G.customers.filter(c => !c.dead);
  G.passers = G.passers.filter(p => !p.dead);
  G.cars = G.cars.filter(c => !c.dead);

  const near = G.customers.some(c => Math.hypot(c.x - DOOR.cx, c.y - 7.0) < 1.15);
  G.door = clamp(G.door + clamp((near ? 1 : 0) - G.door, -dt * 2.5, dt * 2.5), 0, 1);

  clerk.phase += dt;
  G.floats = G.floats.filter(f => (f.t += dt) < 1.6);
  if (G.flash && (G.flash.t -= dt) <= 0) G.flash = null;
  updateRain(dt);
  computeLight();
}

/* ---------------- 渲染 ---------------- */
function personItem(p) { return { ...personBounds(p), draw: () => drawPerson(p, env) }; }

function render() {
  const c = ctx;
  c.setTransform(ISO.dpr, 0, 0, ISO.dpr, 0, 0);
  const bg = c.createLinearGradient(0, 0, 0, ISO.H);
  bg.addColorStop(0, `rgb(${env.bgTop})`); bg.addColorStop(1, `rgb(${env.bgBot})`);
  c.fillStyle = MANGA.on ? MANGA.tone(lerp(0.97, 0.22, env.night)) : bg; c.fillRect(0, 0, ISO.W, ISO.H);
  drawBackdrop(env);
  drawGround(env);

  const people = [...G.customers, ...G.passers];
  const staffRT = Object.values(G.staffRT || {});
  people.push(...staffRT);
  const showClerk = !G.started || !currentCashier() || !staffRT.some(r => r.state === 'register');
  const back = [...BACK], inside = [...INTERIOR, ...(G.started ? fixtureItems() : fixtureItemsTitle())], front = [...FRONT];
  if (showClerk) inside.push(personItem(clerk));
  for (const p of people) {
    const r = regionOf(p.x, p.y);
    (r === 'in' ? inside : r === 'front' ? front : back).push(personItem(p));
  }
  for (const car of G.cars) {
    front.push({
      x0: car.x - 1.15, x1: car.x + 1.15, y0: car.y - 0.58, y1: car.y + 0.58,
      draw: () => { c.globalAlpha = clamp(Math.min(car.x + 1, BOARD.w + 1 - car.x) / 1.6, 0, 1); drawCar(car.x, car.y, 'x', car.dir, car.color, env, env.night > 0.3); c.globalAlpha = 1; },
    });
  }
  for (const t of G.trucks) {
    front.push({
      x0: t.x - 1.65, x1: t.x + 1.65, y0: t.y - 0.65, y1: t.y + 0.65,
      draw: () => { c.globalAlpha = clamp(Math.min(t.x + 1.5, BOARD.w + 1.5 - t.x) / 1.6, 0, 1); drawTruck(t, env); c.globalAlpha = 1; },
    });
  }

  if (typeof eventItems === 'function') for (const it of eventItems()) (it.region === 'in' ? inside : front).push(it);
  back.sort(depthCmp).forEach(o => o.draw(env));
  drawInnerWalls(env);
  inside.sort(depthCmp).forEach(o => o.draw(env));
  drawShell(env);
  front.sort(depthCmp).forEach(o => o.draw(env));

  drawGlows(env, G.cars);
  drawRain();
  drawVignette();
  drawUI();
}
// 标题画面: 未开始时用默认库存画货架
function fixtureItemsTitle() { return G.inv ? fixtureItems() : []; }

/* ---------------- 画面内 UI (气泡/库存/飘字) ---------------- */
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function bubble(sx, sy, text, bg = '#ffffff', fg = '#222', border = null, scale = 1) {
  const c = ctx, k = (IS_TOUCH ? clamp(ISO.zoom * 1.15, 0.95, 1.4) : clamp(ISO.zoom, 0.75, 1.35)) * scale;
  if (MANGA.on) { bg = '#fff'; fg = '#111'; border = '#111'; }
  c.font = `bold ${Math.round(14 * k)}px ${FONT}`;
  const w = c.measureText(text).width + 16 * k, h = 24 * k;
  const x = sx - w / 2, y = sy - h - 8 * k;
  c.fillStyle = bg; roundRect(c, x, y, w, h, 10 * k); c.fill();
  c.beginPath(); c.moveTo(sx - 5 * k, y + h - 1); c.lineTo(sx, y + h + 7 * k); c.lineTo(sx + 5 * k, y + h - 1); c.fill();
  if (border) { c.strokeStyle = border; c.lineWidth = 2; roundRect(c, x, y, w, h, 10 * k); c.stroke(); }
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, sx, y + h / 2 + 1);
  c.textAlign = 'left';
  return [x, y, w, h];
}

function screenRectOfBox(x, y, z, w, d, h) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [a, b, cc] of [[x, y, z], [x + w, y, z], [x, y + d, z], [x + w, y + d, z], [x, y, z + h], [x + w, y, z + h], [x, y + d, z + h], [x + w, y + d, z + h]]) {
    const p = proj(a, b, cc);
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

function drawUI() {
  const c = ctx;
  G.hits = [];
  if (G.started) {
    for (const C of CATEGORIES) {
      if (!G.unlocked[C.id]) continue;
      const [x, y, z, w, d, h] = C.box;
      const st = catState(C.id);
      if (!st.n) continue;
      const [sx, sy] = proj(x + w / 2, y + d / 2, z + h + (C.face === 'hot' ? 0.25 : 0.35));
      const hov = (G.hover && G.hover.type === 'fix' && G.hover.cat === C.id) || (G.flash && G.flash.cat === C.id);
      const canUp = catNeedsRestock(C.id, 1);
      const bg = st.empty ? '#e63946' : st.shelf / st.cap < 0.35 ? '#f4a261' : hov ? '#2a9d8f' : 'rgba(20,28,40,0.82)';
      const pct = st.shelf / st.cap;
      const show = hov || st.empty || pct < 0.7;
      const r = show ? bubble(sx, sy, `${C.emoji} ${Math.round(pct * 100)}%${canUp ? ' ⬆' : ''}`, bg, '#fff', hov ? '#fff' : canUp ? '#9ff0c8' : null, 0.92) : [sx - 12, sy - 20, 24, 20];
      G.hits.push({ type: 'fix', cat: C.id, rects: [r, screenRectOfBox(x, y, z, w, d, h)] });
    }
    G.hits.push({ type: 'register', rects: [screenRectOfBox(COUNTER.x0, COUNTER.y0, 0, 0.6, 2.4, 1.5)] });
    VEND_X.forEach((vx, i) => {
      G.hits.push({ type: 'vend', i, rects: [screenRectOfBox(vx, 6.2, 0, 0.85, 0.7, 1.9)] });
      const vm = G.vend[i];
      if (vm.stock <= 5) { const [sx, sy] = proj(vx + 0.42, 6.55, 2.2); bubble(sx, sy, vm.stock ? `🥫 ${vm.stock}` : '🥫 售罄', vm.stock ? '#f4a261' : '#e63946', '#fff', null, 0.8); }
    });
    // 员工气泡
    for (const rt of Object.values(G.staffRT || {})) {
      if (rt.alpha < 0.5) continue;
      const [sx, sy] = proj(rt.x, rt.y, 2.05);
      if (rt.bubble) bubble(sx, sy, rt.bubble, 'rgba(220,245,240,0.92)', '#1b4332', null, 0.8);
    }
  }
  const blink = Math.sin(G.time * 8) > 0;
  for (const cu of G.customers) {
    const [sx, sy] = proj(cu.x, cu.y, 2.05);
    const [bx, by] = proj(cu.x, cu.y, 0);
    const k = ISO.zoom;
    G.hits.push({ type: 'customer', c: cu, rects: [[bx - 14 * k, sy + 4 * k, 28 * k, by - sy - 2 * k]] });
    if (cu.alpha < 0.5) continue;
    if ((cu.state === 'toShelf' || cu.state === 'pick') && cu.wants[0]) {
      bubble(sx, sy, PRODUCT_BY_ID[cu.wants[0]].emoji, 'rgba(255,255,255,0.92)');
    } else if (cu.state === 'waitStock' && cu.wants[0]) {
      bubble(sx, sy, `${blink ? '❗' : '❕'}${PRODUCT_BY_ID[cu.wants[0]].emoji}`, '#ffe3e0', '#c1121f', '#e63946');
    } else if (cu.state === 'queue' && cu.ready) {
      const total = r1(cu.got.reduce((s, g) => s + g.price, 0));
      const hotTxt = cu.hot.map(id => PRODUCT_BY_ID[id].emoji).join('');
      const hov = G.hover && (G.hover.type === 'register' || (G.hover.type === 'customer' && G.hover.c === cu));
      const r = bubble(sx, sy, `💴 ${yen(total)}${hotTxt ? ' +' + hotTxt : ''}`, hov ? '#2a9d8f' : '#d8f3dc', hov ? '#fff' : '#1b4332', '#2a9d8f');
      const pr = clamp(cu.patience / cu.maxPatience, 0, 1);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(r[0], r[1] + r[3] + 9 * k, r[2], 4);
      c.fillStyle = pr > 0.5 ? '#52b788' : pr > 0.25 ? '#f4a261' : '#e63946';
      c.fillRect(r[0], r[1] + r[3] + 9 * k, r[2] * pr, 4);
      G.hits.push({ type: 'customer', c: cu, rects: [r] });
    } else if (cu.state === 'queue' && cu.patience / cu.maxPatience < 0.35 && !cu.path.length) {
      bubble(sx, sy, '😤', 'rgba(255,255,255,0.9)');
    } else if (cu.state === 'leaving' && cu.bubble && cu.bubbleT > 0) {
      bubble(sx, sy, cu.bubble, 'rgba(255,255,255,0.92)', cu.bubble === '♪' ? '#2a9d8f' : '#c1121f');
    }
  }
  if (typeof drawEventUI === 'function') drawEventUI();
  for (const f of G.floats) {
    const k = f.t / 1.6;
    c.globalAlpha = 1 - k * k;
    c.font = `bold ${Math.round(16 * clamp(ISO.zoom, 0.85, 1.3))}px ${FONT}`;
    c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.strokeText(f.text, f.x, f.y - k * 46);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - k * 46);
    c.textAlign = 'left'; c.globalAlpha = 1;
  }
  if (!IS_TOUCH && G.hover && G.hover.type === 'fix' && pointer.x != null) {
    const C = CAT_BY_ID[G.hover.cat], st = catState(C.id);
    const txt = catNeedsRestock(C.id, 1) ? `点击上架：从仓库补到货架（仓库 ${st.back} 件）` : st.back ? `${C.name} 已摆满` : `仓库没货了，去「进货」订货`;
    c.font = `bold 13px ${FONT}`;
    const w = c.measureText(txt).width + 16;
    c.fillStyle = 'rgba(15,20,30,0.88)'; roundRect(c, pointer.x + 14, pointer.y + 14, w, 26, 8); c.fill();
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(txt, pointer.x + 22, pointer.y + 28); c.textBaseline = 'alphabetic';
  }
}

/* ---------------- 输入 ---------------- */
const pointer = { x: null, y: null };
const pointers = new Map();
let drag = null, pinch = null;

const HIT_PAD = IS_TOUCH ? 12 : 3;
function inRect(x, y, r) { const p = HIT_PAD; return x >= r[0] - p && x <= r[0] + r[2] + p && y >= r[1] - p && y <= r[1] + r[3] + p; }
function hitTest(x, y) {
  if (!G.started) return null;
  for (let i = G.hits.length - 1; i >= 0; i--) {
    const h = G.hits[i];
    if ((h.type === 'event' || (h.type === 'customer' && h.c.thief && !h.c.caught)) && h.rects.some(r => inRect(x, y, r))) return h;
  }
  const ready = G.queue[0] && G.queue[0].ready ? G.queue[0] : null;
  for (let i = G.hits.length - 1; i >= 0; i--) {
    const h = G.hits[i];
    if (h.type === 'customer' && h.c === ready && h.rects.some(r => inRect(x, y, r))) return h;
  }
  for (const h of G.hits) if (h.type === 'fix' && inRect(x, y, h.rects[0])) return h;
  for (const h of G.hits) if (h.type === 'register' && ready && inRect(x, y, h.rects[0])) return h;
  for (const h of G.hits) if (h.type === 'fix' && h.rects[1] && inRect(x, y, h.rects[1])) return h;
  for (const h of G.hits) if (h.type === 'vend' && inRect(x, y, h.rects[0])) return h;
  return null;
}
function onClick(x, y) {
  const h = hitTest(x, y);
  if (!h) return;
  if (h.type === 'event') { h.onClick(); return; }
  if (h.type === 'customer' && h.c.thief) { catchThief(h.c); return; }
  if (h.type === 'vend') { openPanel('order', 'vend'); return; }
  if (h.type === 'fix') { playerRestock(h.cat); G.flash = { cat: h.cat, t: 0.35 }; }
  else if (h.type === 'customer' || h.type === 'register') { if (G.queue[0] && G.queue[0].ready) checkout(G.queue[0]); }
}

canvas.addEventListener('pointerdown', e => {
  if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, px: ISO.panX, py: ISO.panY, moved: false };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: ISO.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    drag = null;
  }
});
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    zoomAt(pinch.cx, pinch.cy, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
  } else if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) { cam.anim = null; ISO.panX = drag.px + dx; ISO.panY = drag.py + dy; }
  }
  G.hover = drag && drag.moved ? null : hitTest(e.clientX, e.clientY);
  canvas.style.cursor = drag && drag.moved ? 'grabbing' : G.hover ? 'pointer' : 'grab';
});
function endPointer(e) {
  if (drag && !drag.moved && pointers.size === 1) onClick(e.clientX, e.clientY);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  drag = null;
  if (e.pointerType !== 'mouse') { pointer.x = null; G.hover = null; }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { pointer.x = null; G.hover = null; });

function zoomAt(sx, sy, z) {
  z = clamp(z, fitZoom() * 0.6, fitZoom() * 5);
  const k = z / ISO.zoom;
  ISO.panX = sx - ISO.W / 2 - (sx - ISO.W / 2 - ISO.panX) * k;
  ISO.panY = sy - ISO.H / 2 - (sy - ISO.H / 2 - ISO.panY) * k;
  ISO.zoom = z; cam.anim = null;
}
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, ISO.zoom * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });


