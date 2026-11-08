'use strict';
/* =========================================================
 * iso.js — 极简等距(2.5D)渲染工具
 * 世界坐标: x 向右下, y 向左下, z 向上 (单位≈1米)
 * ========================================================= */

const ISO = { W: 800, H: 600, dpr: 1, zoom: 1, panX: 0, panY: 0, TW: 64, TH: 32, TZ: 38, ctx: null };
const FONT = "'Zen Maru Gothic','Hiragino Maru Gothic ProN','Yu Gothic','Noto Sans JP','Noto Sans CJK JP','Microsoft YaHei',sans-serif";

let AMB = [1, 1, 1];                 // 当前环境光 (室外随时间变化)
const AMB_EMIT = [1, 1, 1];          // 自发光物体
const AMB_IN = [1.0, 0.98, 0.93];    // 店内灯光

const _rgb = new Map();
function hexRgb(h) {
  let v = _rgb.get(h);
  if (v) return v;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s, 16);
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgb.set(h, v);
  return v;
}

/* ---------- 漫画风: 网点纸(screentone) ---------- */
const MANGA = {
  on: false, pats: {},
  pat(kind) {
    if (this.pats[kind]) return this.pats[kind];
    const n = kind === 'dark' ? 5 : 6, cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    const g = cv.getContext('2d');
    g.fillStyle = kind === 'dark' ? '#1a1a1a' : '#ffffff'; g.fillRect(0, 0, n, n);
    g.fillStyle = kind === 'dark' ? '#ffffff' : '#1a1a1a';
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    if (kind === 'light') dot(3, 3, 0.85);
    else if (kind === 'mid') { dot(1.5, 1.5, 1.15); dot(4.5, 4.5, 1.15); }
    else if (kind === 'dense') { dot(1.5, 1.5, 1.6); dot(4.5, 4.5, 1.6); dot(4.5, 1.5, 0.7); dot(1.5, 4.5, 0.7); }
    else dot(2.5, 2.5, 0.9);
    return (this.pats[kind] = ISO.ctx.createPattern(cv, 'repeat'));
  },
  tone(L) {
    if (L > 0.78) return '#ffffff';
    if (L > 0.6) return this.pat('light');
    if (L > 0.46) return this.pat('mid');
    if (L > 0.34) return this.pat('dense');
    if (L > 0.22) return this.pat('dark');
    return '#141414';
  },
};

/** 把颜色按面朝向系数 f 和环境光 amb 计算成实际颜色 */
function lit(hex, f = 1, a = 1, amb = AMB) {
  const [r, g, b] = hexRgb(hex);
  const R = Math.min(255, r * f * amb[0]) | 0;
  const G = Math.min(255, g * f * amb[1]) | 0;
  const B = Math.min(255, b * f * amb[2]) | 0;
  if (MANGA.on) {
    if (a < 1) return `rgba(255,255,255,${Math.min(0.5, a * 0.8)})`;
    return MANGA.tone(0.28 + 0.72 * (0.299 * R + 0.587 * G + 0.114 * B) / 255);
  }
  return a < 1 ? `rgba(${R},${G},${B},${a})` : `rgb(${R},${G},${B})`;
}

function proj(x, y, z = 0) {
  const s = ISO.zoom;
  return [
    ISO.W / 2 + ISO.panX + (x - y) * ISO.TW / 2 * s,
    ISO.H / 2 + ISO.panY + ((x + y) * ISO.TH / 2 - z * ISO.TZ) * s,
  ];
}

function unproj(sx, sy) {
  const s = ISO.zoom;
  const a = (sx - ISO.W / 2 - ISO.panX) / (ISO.TW / 2 * s);
  const b = (sy - ISO.H / 2 - ISO.panY) / (ISO.TH / 2 * s);
  return [(a + b) / 2, (b - a) / 2];
}

function poly(pts, fill, stroke) {
  const c = ISO.ctx;
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = proj(pts[i][0], pts[i][1], pts[i][2]);
    if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (MANGA.on) {
    c.strokeStyle = '#111'; c.lineWidth = stroke === false ? 0.5 : 0.9; c.lineJoin = 'round';
    c.stroke();
  } else if (stroke !== false) {
    c.strokeStyle = stroke || fill;
    c.lineWidth = 0.6;
    c.stroke();
  }
}

/**
 * 长方体: 只画看得见的三个面 (顶面, y+d 左前面, x+w 右前面)
 * o: {emit, alpha, top, left, right, noTop, noLeft, noRight}
 */
function box(x, y, z, w, d, h, color, o = {}) {
  const amb = o.emit ? AMB_EMIT : (o.amb || AMB);
  const a = o.alpha == null ? 1 : o.alpha;
  if (a <= 0.01) return;
  const st = a < 1 ? false : undefined;
  if (o.shadow && z < 0.05 && a >= 1) poly([[x - 0.05, y - 0.02, 0.006], [x + w + 0.14, y - 0.02, 0.006], [x + w + 0.14, y + d + 0.12, 0.006], [x - 0.05, y + d + 0.12, 0.006]], MANGA.on ? MANGA.pat('mid') : 'rgba(0,0,0,0.16)', false);
  if (!o.noLeft) poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], lit(o.left || color, 0.84, a, amb), st);
  if (!o.noRight) poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], lit(o.right || color, 0.68, a, amb), st);
  if (!o.noTop) poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], lit(o.top || color, 1, a, amb), st);
  // 顶部前沿高光, 让方块边缘更利落
  if (!MANGA.on && !o.noTop && a >= 1 && w > 0.12 && d > 0.12 && ISO.zoom > 0.45) {
    const c = ISO.ctx, p1 = proj(x, y + d, z + h), p2 = proj(x + w, y + d, z + h), p3 = proj(x + w, y, z + h);
    c.strokeStyle = `rgba(255,255,255,${0.1 + 0.12 * Math.min(1, amb[0])})`; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.stroke();
  }
}

function flat(x0, y0, x1, y1, z, color, o = {}) {
  const a = o.alpha == null ? 1 : o.alpha;
  poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], lit(color, 1, a, o.emit ? AMB_EMIT : (o.amb || AMB)), a < 1 ? false : undefined);
}
function faceY(x0, x1, z0, z1, y, color, o = {}) {
  const a = o.alpha == null ? 1 : o.alpha;
  poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], lit(color, o.f || 0.84, a, o.emit ? AMB_EMIT : (o.amb || AMB)), a < 1 ? false : undefined);
}
function faceX(y0, y1, z0, z1, x, color, o = {}) {
  const a = o.alpha == null ? 1 : o.alpha;
  poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], lit(color, o.f || 0.68, a, o.emit ? AMB_EMIT : (o.amb || AMB)), a < 1 ? false : undefined);
}

/* 在某个平面上用 2D 方式作画: 本地 1 单位 = 0.01 米 */
function planeY(x, y, z, cb) { // 正面(朝 +y)，u→+x，v→向下
  const c = ISO.ctx, s = ISO.zoom * 0.01, p = proj(x, y, z);
  c.save(); c.transform(ISO.TW / 2 * s, ISO.TH / 2 * s, 0, ISO.TZ * s, p[0], p[1]); cb(c); c.restore();
}
function planeX(x, y, z, cb) { // 右侧面(朝 +x)，u→-y，v→向下
  const c = ISO.ctx, s = ISO.zoom * 0.01, p = proj(x, y, z);
  c.save(); c.transform(ISO.TW / 2 * s, -ISO.TH / 2 * s, 0, ISO.TZ * s, p[0], p[1]); cb(c); c.restore();
}
function planeZ(x, y, z, cb) { // 地面，u→+x，v→+y
  const c = ISO.ctx, s = ISO.zoom * 0.01, p = proj(x, y, z);
  c.save(); c.transform(ISO.TW / 2 * s, ISO.TH / 2 * s, -ISO.TW / 2 * s, ISO.TH / 2 * s, p[0], p[1]); cb(c); c.restore();
}

function line3(a, b, color, w = 1) {
  const c = ISO.ctx, p = proj(a[0], a[1], a[2]), q = proj(b[0], b[1], b[2]);
  c.strokeStyle = color; c.lineWidth = w * ISO.zoom;
  c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
}

/* ---------- 光晕 (叠加模式下使用) ---------- */
function glowAt(x, y, z, r, rgb, a) {
  const c = ISO.ctx, [sx, sy] = proj(x, y, z), R = r * ISO.TW * 0.5 * ISO.zoom;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, R);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.beginPath(); c.arc(sx, sy, R, 0, Math.PI * 2); c.fill();
}
function poolAt(x, y, r, rgb, a, stretch = 1) {
  const c = ISO.ctx, [sx, sy] = proj(x, y, 0), R = r * ISO.TW * 0.7 * ISO.zoom;
  c.save(); c.translate(sx, sy); c.scale(stretch, 0.5);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
  c.restore();
}

/* ---------- 深度排序 ---------- */
// 物体: {x0,y0,x1,y1, draw()}
function depthCmp(a, b) {
  if (a.x1 <= b.x0 && !(b.y1 <= a.y0)) return -1;
  if (b.x1 <= a.x0 && !(a.y1 <= b.y0)) return 1;
  if (a.y1 <= b.y0 && !(b.x1 <= a.x0)) return -1;
  if (b.y1 <= a.y0 && !(a.x1 <= b.x0)) return 1;
  return (a.x0 + a.x1 + a.y0 + a.y1) - (b.x0 + b.x1 + b.y0 + b.y1);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
