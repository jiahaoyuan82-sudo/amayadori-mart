'use strict';
/* =========================================================
 * shelves.js — 货架陈列 (每一格放什么由玩家决定)
 *
 *  - 每一格(facing) 能摆 PER_FACE 件商品 → 格子越多, 货架上能放越多, 越不容易缺货
 *  - 格子越多越显眼 → 人气越高; 中间「黄金层」再 +15%
 *  - 没有摆出来的商品, 客人买不到
 * ========================================================= */

const PER_FACE = 3;
const AMBIENT = ['rice', 'bread', 'noodle', 'snack', 'daily'];
const FIX = {
  rice: { name: 'A 货架', sub: '店中央 · 冷柜前', cols: 3, tiers: 3, accepts: AMBIENT, style: 'gondola' },
  bread: { name: 'B 货架', sub: '店中央 · 靠门口', cols: 3, tiers: 3, accepts: AMBIENT, style: 'gondola', impulse: 1.05 },
  snack: { name: 'C 货架', sub: '右侧 · 收银台旁', cols: 3, tiers: 3, accepts: AMBIENT, style: 'gondola', impulse: 1.08 },
  noodle: { name: '墙边货架', sub: '左墙', cols: 3, tiers: 3, accepts: AMBIENT, style: 'gondola' },
  drink: { name: '冷藏饮料柜', sub: '后墙 · 7 扇门', cols: 7, tiers: 3, accepts: ['drink'], style: 'fridge' },
  ice: { name: '冷冻柜', sub: '冰柜', cols: 6, tiers: 2, accepts: ['ice'], style: 'freezer' },
  hot: { name: '热食柜', sub: '收银台上', cols: 3, tiers: 3, accepts: ['hot'], style: 'hot' },
  magazine: { name: '杂志架', sub: '橱窗边', cols: 5, tiers: 2, accepts: ['magazine'], style: 'mag' },
  daily: { name: '门口伞架', sub: '入口旁', cols: 3, tiers: 3, accepts: ['daily'], style: 'daily' },
};
const FIX_ORDER = ['rice', 'bread', 'snack', 'noodle', 'drink', 'ice', 'hot', 'magazine', 'daily'];
const fixSlots = fid => FIX[fid].cols * FIX[fid].tiers;
const fixOpen = fid => !!(G.unlocked && G.unlocked[fid]);
function tierLabel(fid, t) {
  const n = FIX[fid].tiers;
  if (n === 3) return ['下层', '黄金层', '上层'][t];
  return ['下层', '上层'][t];
}
const isGolden = (fid, t) => FIX[fid].tiers === 3 && t === 1;

/* 列优先的格子顺序: 每一列从下到上, 这样一个商品占一整列就同时有上中下三层 */
function colMajor(fid) {
  const { cols, tiers } = FIX[fid], out = [];
  for (let c = 0; c < cols; c++) for (let t = 0; t < tiers; t++) out.push(t * cols + c);
  return out;
}

/* ---------------- 查询 ---------------- */
function facingList(pid) {
  const out = [];
  if (!G.plan) return out;
  for (const fid of FIX_ORDER) {
    if (!fixOpen(fid)) continue;
    const arr = G.plan[fid]; if (!arr) continue;
    arr.forEach((p, i) => { if (p === pid) out.push({ fid, i, t: Math.floor(i / FIX[fid].cols) }); });
  }
  return out;
}
function facings(pid) { return facingList(pid).length; }
function shelfCap(pid) { return facings(pid) * PER_FACE; }
function displayedOn(fid) { return [...new Set((G.plan[fid] || []).filter(Boolean))].map(id => PRODUCT_BY_ID[id]); }
function displayed(pid) { return facings(pid) > 0; }

/** 显眼程度 → 人气倍率 */
function visibility(pid) {
  const f = facingList(pid);
  if (!f.length) return 0;
  let v = Math.min(1.7, 0.7 + 0.2 * f.length);
  if (f.some(x => isGolden(x.fid, x.t))) v *= 1.15;
  else if (f.every(x => FIX[x.fid].tiers === 3 && x.t === 0)) v *= 0.9;
  v *= Math.max(...f.map(x => FIX[x.fid].impulse || 1));
  return v;
}

function clampShelf(pid) {
  const inv = G.inv[pid], cap = shelfCap(pid);
  if (inv.shelf > cap) { inv.back += inv.shelf - cap; inv.shelf = cap; }
}
function canPlace(fid, pid) { return !pid || FIX[fid].accepts.includes(PRODUCT_BY_ID[pid].cat); }

function setSlot(fid, i, pid) {
  if (!canPlace(fid, pid)) return false;
  const old = G.plan[fid][i];
  G.plan[fid][i] = pid || null;
  if (old && old !== pid) clampShelf(old);
  return true;
}

/* ---------------- 初始陈列 / 自动陈列 ---------------- */
function emptyPlan() { const p = {}; for (const fid of FIX_ORDER) p[fid] = Array(fixSlots(fid)).fill(null); return p; }

function defaultPlan() {
  G.plan = emptyPlan();
  for (const fid of FIX_ORDER) {
    const list = (PRODUCTS_BY_CAT[fid] || []).filter(p => G.carried[p.id]);
    if (list.length) fillFixture(fid, list.map(p => [p.id, p.pop]));
  }
}
/** 按权重把一组商品摆进某个货架 (列优先, 权重大的先放, 自然拿到更多格子) */
function fillFixture(fid, weighted) {
  const order = colMajor(fid), n = order.length;
  const tot = weighted.reduce((s, w) => s + w[1], 0) || 1;
  let alloc = weighted.map(([id, w]) => [id, Math.max(1, Math.round(w / tot * n))]);
  let sum = alloc.reduce((s, a) => s + a[1], 0);
  alloc.sort((a, b) => b[1] - a[1]);
  while (sum > n) { const a = alloc.find(x => x[1] > 1) || alloc[alloc.length - 1]; a[1]--; sum--; if (a[1] <= 0) alloc.splice(alloc.indexOf(a), 1); }
  G.plan[fid] = Array(n).fill(null);
  let k = 0;
  for (const [id, c] of alloc) for (let j = 0; j < c && k < n; j++) G.plan[fid][order[k++]] = id;
  for (const [id] of weighted) clampShelf(id);
}

/** 按最近 7 天销量 + 基础人气自动排 */
function autoArrange(fid) {
  const sales = {};
  for (const d of [...(G.fin.history || []).slice(-6), G.fin.today]) if (d) for (const [k, v] of Object.entries(d.items)) sales[k] = (sales[k] || 0) + v;
  const pool = new Set(displayedOn(fid).map(p => p.id));
  for (const p of PRODUCTS) if (G.carried[p.id] && p.cat === fid && !displayed(p.id)) pool.add(p.id);
  if (!pool.size) return false;
  fillFixture(fid, [...pool].map(id => [id, (sales[id] || 0) + PRODUCT_BY_ID[id].pop * 3]));
  return true;
}

/** 新进货的商品自动找个位置 (优先自己类别的货架) */
function autoPlace(pid, n = 2) {
  if (displayed(pid)) return null;
  const cat = PRODUCT_BY_ID[pid].cat;
  const cands = [cat, ...FIX_ORDER.filter(f => f !== cat)].filter(f => fixOpen(f) && FIX[f].accepts.includes(cat));
  for (const fid of cands) {
    const empty = colMajor(fid).filter(i => !G.plan[fid][i]);
    if (empty.length) { empty.slice(0, n).forEach(i => { G.plan[fid][i] = pid; }); return fid; }
  }
  // 没有空位: 从格子最多的商品那里让出来
  const fid = cands[0]; if (!fid) return null;
  const cnt = {}; G.plan[fid].forEach(id => { if (id) cnt[id] = (cnt[id] || 0) + 1; });
  const donor = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  if (!donor || donor[1] < 3) return null;
  const order = colMajor(fid).reverse();
  let moved = 0;
  for (const i of order) if (G.plan[fid][i] === donor[0] && moved < Math.min(n, donor[1] - 1)) { G.plan[fid][i] = pid; moved++; }
  clampShelf(donor[0]);
  return fid;
}

function sanitizePlan(raw) {
  const p = emptyPlan();
  if (raw && typeof raw === 'object') for (const fid of FIX_ORDER) {
    const arr = raw[fid];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < p[fid].length; i++) { const id = arr[i]; p[fid][i] = id && PRODUCT_BY_ID[id] && FIX[fid].accepts.includes(PRODUCT_BY_ID[id].cat) ? id : null; }
  }
  return p;
}

/* ---------------- 顾客站位 ---------------- */
function standForSlot(fid, i) {
  const C = CAT_BY_ID[fid], F = FIX[fid];
  if (!C.stand) return null;
  const [bx, by, , w, d] = C.box, col = i % F.cols, j = () => rand(-0.08, 0.08);
  if (C.face === 'x') return [C.stand[0] + j(), by + (col + 0.5) * d / F.cols];
  if (C.face === 'daily') return [C.stand[0] + j(), C.stand[1] + j()];
  return [bx + (col + 0.5) * w / F.cols + j(), C.stand[1] + j()];
}
/** 这个商品在哪里拿: 随机挑一个陈列它的格子 */
function pickSpot(pid) {
  const f = facingList(pid);
  if (!f.length) return null;
  const s = pick(f);
  return { fid: s.fid, pos: standForSlot(s.fid, s.i) };
}
