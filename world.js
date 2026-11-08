'use strict';
/* =========================================================
 * world.js — 场景: 地面 / 便利店 / 街道道具 / 灯光
 * ========================================================= */

function item(x0, y0, x1, y1, draw) { return { x0, y0, x1, y1, draw }; }
const SX1 = STORE.x1;   // 店铺右边界 (15)

/* ---------------- 远景 (城市剪影 / 星空) ---------------- */
const SKYLINE = (() => {
  const out = []; let x = -900;
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  while (x < 900) {
    const w = 40 + rnd() * 70, h = 60 + rnd() * 170;
    const wins = [];
    for (let wy = 10; wy < h - 10; wy += 14) for (let wx = 6; wx < w - 8; wx += 11) if (rnd() < 0.32) wins.push([wx, wy, rnd()]);
    out.push({ x, w, h, wins, tone: 0.75 + rnd() * 0.25 });
    x += w + 4 + rnd() * 10;
  }
  return out;
})();
const STARS = Array.from({ length: 90 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 104729) % 1000) / 1000 * 0.55, ((i * 31) % 10) / 10]);

function drawBackdrop(env) {
  const c = ISO.ctx, N = env.night;
  // 星星 & 月亮 (晴朗的夜晚)
  if (N > 0.3 && env.rain < 0.2 && !MANGA.on) {
    c.fillStyle = `rgba(255,255,255,${0.7 * N})`;
    for (const [sx, sy, b] of STARS) { const tw = 0.6 + 0.4 * Math.sin(G.time * (1 + b * 2) + sx * 40); c.globalAlpha = N * tw * (0.4 + b * 0.6); c.fillRect(sx * ISO.W, sy * ISO.H, 1.6, 1.6); }
    c.globalAlpha = N;
    const mx = ISO.W * 0.82, my = ISO.H * 0.14;
    const g = c.createRadialGradient(mx, my, 0, mx, my, 60); g.addColorStop(0, 'rgba(255,248,220,0.35)'); g.addColorStop(1, 'rgba(255,248,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(mx, my, 60, 0, 7); c.fill();
    c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(mx, my, 16, 0, 7); c.fill();
    c.fillStyle = `rgb(${env.bgTop})`; c.beginPath(); c.arc(mx + 7, my - 4, 14, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  // 城市剪影 (随视角轻微视差)
  const [bx, by] = proj(BOARD.w / 2, -3, 0);
  const z = clamp(ISO.zoom, 0.5, 1.6), base = by + 40 * z;
  const col = MANGA.on ? null : mix3(env.bgTop, [40, 48, 66], 0.35 + 0.3 * (1 - N));
  for (let layer = 0; layer < 2; layer++) {
    const k = layer ? 0.75 : 1, off = (ISO.panX * (layer ? 0.15 : 0.3));
    for (const b of SKYLINE) {
      const x = bx + (b.x + layer * 37) * z * k * 1.3 + off, w = b.w * z * k, h = b.h * z * k * (layer ? 0.7 : 1);
      if (x + w < 0 || x > ISO.W) continue;
      if (MANGA.on) { c.fillStyle = MANGA.tone(N > 0.5 ? (layer ? 0.4 : 0.3) : (layer ? 0.75 : 0.65)); }
      else c.fillStyle = `rgba(${col.map(v => v * b.tone * (layer ? 1.15 : 1) | 0)},${0.9 - layer * 0.35})`;
      c.fillRect(x, base - h, w, h + 6);
      if (!layer && N > 0.2) {
        for (const [wx, wy, r] of b.wins) {
          c.fillStyle = MANGA.on ? '#fff' : `rgba(255,${200 + r * 40 | 0},${120 + r * 80 | 0},${N * (0.35 + r * 0.5)})`;
          c.fillRect(x + wx * z, base - h + wy * z, 4 * z, 5 * z);
        }
      }
    }
  }
  // 雾 (让底板浮起来)
  if (!MANGA.on) {
    const fg = c.createLinearGradient(0, base - 80 * z, 0, base + 60);
    fg.addColorStop(0, `rgba(${env.bgBot},0)`); fg.addColorStop(1, `rgba(${env.bgBot},0.85)`);
    c.fillStyle = fg; c.fillRect(0, base - 80 * z, ISO.W, ISO.H);
  }
}

/* ---------------- 地面层 (不参与排序) ---------------- */
function drawGround(env) {
  const W = BOARD.w, Hh = BOARD.h;
  box(0, 0, -0.9, W, Hh, 0.9, '#2a303b', { noTop: true });
  faceY(0.6, 5.4, -0.74, -0.18, Hh + 0.002, '#161a22', { emit: true });
  planeY(0.78, Hh + 0.004, -0.26, g => {
    g.fillStyle = 'rgba(210,215,225,0.85)';
    g.font = `bold 20px ${FONT}`; g.textBaseline = 'top';
    g.fillText(TOWN_NAME, 0, 0);
    g.font = `12px ${FONT}`; g.fillStyle = 'rgba(210,215,225,0.55)';
    g.fillText('AMAYADORI 3-CHOME  ·  CONVENIENCE STORE DIORAMA', 0, 26);
  });

  flat(0, 0, W, 7, 0, '#6e7178');
  planeZ(SX1, 0, 0.003, g => {           // 店旁的砖地
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath();
    for (let i = 1; i < 12; i++) { g.moveTo(i * 50, 0); g.lineTo(i * 50, 700); }
    for (let j = 1; j < 14; j++) { g.moveTo(0, j * 50); g.lineTo(600, j * 50); }
    g.stroke();
  });
  flat(0, 2.4, 3, 8.95, 0.002, '#41454c');
  flat(0.1, 5.2, 0.18, 8.7, 0.004, '#e2e2e2');
  flat(1.85, 5.2, 1.93, 8.7, 0.004, '#e2e2e2');
  flat(0.1, 5.2, 1.93, 5.28, 0.004, '#e2e2e2');
  planeZ(0.55, 3.0, 0.005, g => { g.fillStyle = lit('#e2e2e2', 1, 0.7); g.font = `bold 80px ${FONT}`; g.textBaseline = 'top'; g.fillText('P', 0, 0); });
  // 人行道
  flat(0, 7, W, 8.95, 0.004, '#8d9095');
  planeZ(0, 7, 0.006, g => {
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 1; i < W * 2; i++) { g.moveTo(i * 50, 0); g.lineTo(i * 50, 195); }
    for (let j = 1; j < 4; j++) { g.moveTo(0, j * 50); g.lineTo(W * 100, j * 50); }
    g.stroke();
  });
  flat(0, 8.32, W, 8.48, 0.008, '#d8b13c');
  planeZ(0, 8.32, 0.009, g => { g.fillStyle = 'rgba(120,90,10,0.35)'; for (let i = 0; i < W * 10; i++) { g.beginPath(); g.arc(i * 10 + 5, 8, 2.2, 0, 7); g.fill(); } });
  box(0, 8.95, 0, W, 0.12, 0.1, '#b3b5b9');

  // 马路
  flat(0, 9.07, W, Hh, 0, '#2b2e34');
  flat(0, 9.25, W, 9.33, 0.003, '#d0d0d0');
  flat(0, 12.75, W, 12.83, 0.003, '#d0d0d0');
  for (let x = 0.3; x < W; x += 1.6) {
    if (x > 15.4 && x < 19.2) continue;
    flat(x, 10.98, Math.min(x + 0.9, W), 11.08, 0.003, '#e6e6e6');
  }
  for (let yy = 9.45; yy < 12.7; yy += 0.55) flat(16.4, yy, 19.0, yy + 0.3, 0.004, '#e8e8e8');
  flat(15.85, 9.33, 16.0, 10.95, 0.004, '#e8e8e8');
  planeZ(14.0, 9.55, 0.005, g => {
    g.fillStyle = lit('#e8e8e8', 1, 0.85);
    g.font = `bold 70px ${FONT}`; g.textBaseline = 'top';
    g.fillText('とまれ', 0, 0);
  });
  const manhole = (x, y) => planeZ(x, y, 0.006, g => {
    g.fillStyle = lit('#3a3d42'); g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
    g.strokeStyle = lit('#55595f'); g.lineWidth = 4; g.stroke();
    g.beginPath(); g.arc(0, 0, 20, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.moveTo(0, -20); g.lineTo(0, 20); g.stroke();
  });
  manhole(5, 11.9); manhole(10.6, 7.9); manhole(19.2, 4.6); manhole(13.5, 12.0);

  // 雨天水洼 (带倒影高光)
  if (env.rain > 0.05) {
    const a = 0.16 * env.rain;
    for (const [x, y, r] of [[2.2, 10.4, 70], [6.6, 12.2, 90], [9.2, 9.9, 60], [17.0, 8.0, 50], [1.2, 4.2, 60], [13.5, 11.8, 80], [19.5, 10.6, 70], [11.6, 8.1, 40]]) {
      planeZ(x, y, 0.007, g => {
        g.fillStyle = `rgba(150,175,215,${a})`;
        g.beginPath(); g.ellipse(0, 0, r, r * 0.6, 0.6, 0, 7); g.fill();
        g.fillStyle = `rgba(255,240,210,${a * env.night * 1.2})`;
        g.beginPath(); g.ellipse(-r * 0.2, -r * 0.1, r * 0.35, r * 0.12, 0.6, 0, 7); g.fill();
      });
    }
  }

  // 店内地板 (两色格子)
  flat(STORE.x0, STORE.y0, SX1, STORE.y1, 0.01, '#ebe7de', { amb: AMB_IN });
  planeZ(STORE.x0, STORE.y0, 0.011, g => {
    g.fillStyle = MANGA.on ? 'rgba(0,0,0,0.06)' : 'rgba(150,140,120,0.08)';
    for (let i = 0; i < 24; i++) for (let j = 0; j < 11; j++) if ((i + j) % 2) g.fillRect(i * 50, j * 50, 50, 50);
    g.strokeStyle = 'rgba(120,110,95,0.16)'; g.lineWidth = 2;
    g.beginPath();
    for (let i = 1; i < 24; i++) { g.moveTo(i * 50, 0); g.lineTo(i * 50, 550); }
    for (let j = 1; j < 11; j++) { g.moveTo(0, j * 50); g.lineTo(1200, j * 50); }
    g.stroke();
  });
  // 收银台后面的防滑垫
  flat(12.95, 2.6, 14.4, 5.3, 0.013, '#5b6170', { amb: AMB_IN });
  // 门口地垫
  flat(7.05, 7.06, 8.35, 7.62, 0.012, '#39404c');
  planeZ(7.2, 7.2, 0.014, g => {
    g.fillStyle = lit('#cfd6e0', 1, 0.8); g.font = `bold 22px ${FONT}`; g.textBaseline = 'top';
    g.fillText('WELCOME', 8, 4);
  });
  // 事件: 地上的水渍 / 失物
  if (typeof drawFloorEvents === 'function') drawFloorEvents(env);
}

/* ---------------- 店内墙 (后墙/左墙内侧) ---------------- */
function drawInnerWalls(env) {
  const H = STORE.H, A = { amb: AMB_IN };
  box(3, 1.5, 0, SX1 - 3, 0.15, H, '#efe9df', A);
  box(3, 1.5, 0, 0.15, 5.5, H, '#efe9df', A);
  faceY(3, SX1, 0, 0.18, 1.652, '#c9c2b5', A);   // 踢脚线
  faceY(3.5, 10.5, 2.12, 2.48, 1.652, '#2a9d8f', A);
  planeY(3.8, 1.654, 2.44, g => {
    g.fillStyle = '#fff'; g.font = `bold 24px ${FONT}`; g.textBaseline = 'top';
    g.fillText('つめたいお飲み物  ·  COLD DRINKS  ·  よく冷えてます', 0, 4);
  });
  // 右侧海报区
  faceY(10.9, 11.6, 1.0, 1.9, 1.653, '#e63946', A);
  planeY(10.93, 1.655, 1.86, g => { g.fillStyle = '#fff'; g.font = `bold 15px ${FONT}`; g.textBaseline = 'top'; g.fillText('ポイント', 3, 6); g.font = `bold 30px ${FONT}`; g.fillText('2倍', 6, 30); g.font = `bold 11px ${FONT}`; g.fillText('毎週金曜日', 4, 70); });
  faceY(11.8, 12.4, 1.1, 1.85, 1.653, '#ffd166', A);
  planeY(11.83, 1.655, 1.8, g => { g.fillStyle = '#7a3b00'; g.font = `bold 13px ${FONT}`; g.textBaseline = 'top'; g.fillText('からあげ', 3, 6); g.fillText('増量中!', 3, 26); g.fillText('🍗', 14, 46); });
  // 员工门
  faceY(13.6, 14.5, 0, 2.05, 1.652, '#8b9097', A);
  faceY(14.35, 14.42, 0.95, 1.1, 1.654, '#d0d4d9', A);
  planeY(13.7, 1.654, 1.85, g => {
    g.fillStyle = '#e9edf2'; g.font = `bold 13px ${FONT}`; g.textBaseline = 'top';
    g.fillText('STAFF ONLY', 0, 0);
  });
  // 时钟
  planeY(13.05, 1.654, 2.75, g => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 3; g.stroke();
    const m = env.minute % 720, ha = m / 720 * Math.PI * 2, ma = (env.minute % 60) / 60 * Math.PI * 2;
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ha) * 12, -Math.cos(ha) * 12); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(ma) * 18, -Math.cos(ma) * 18); g.stroke();
  });
  faceX(3.3, 5.8, 2.05, 2.4, 3.152, '#e63946', A);
  planeX(3.152, 5.6, 2.36, g => {
    g.fillStyle = '#fff'; g.font = `bold 22px ${FONT}`; g.textBaseline = 'top';
    g.fillText('カップ麺コーナー', 0, 4);
  });
  faceX(6.1, 6.8, 1.0, 1.9, 3.152, '#f4a261', A);
  planeX(3.152, 6.75, 1.82, g => {
    g.fillStyle = '#fff'; g.font = `bold 16px ${FONT}`; g.textBaseline = 'top';
    g.fillText('おでん', 8, 8); g.fillText('はじめ', 8, 30); g.fillText('ました', 8, 52);
  });
}

/* ---------------- 商品小模型 ---------------- */
function drawProductUnit(pid, x, y, z, k) {
  const p = PRODUCT_BY_ID[pid], [kind, col] = p.look, A = { amb: AMB_IN };
  switch (kind) {
    case 'onigiri':
      for (let i = 0; i < 2; i++) {
        box(x + i * 0.24, y, z, 0.2, 0.18, 0.16, '#f6f3ea', A);
        box(x + i * 0.24 + 0.07, y + 0.02, z, 0.06, 0.17, 0.13, '#1f2d27', A);
        box(x + i * 0.24 + 0.02, y + 0.17, z + 0.11, 0.05, 0.02, 0.04, col, A);
      }
      break;
    case 'bento':
      box(x, y, z, 0.46, 0.22, 0.1, '#1b1b1b', A);
      box(x + 0.02, y + 0.02, z + 0.1, 0.42, 0.18, 0.02, col, { top: '#f1e3c8', amb: AMB_IN });
      break;
    case 'bread':
      box(x, y, z, 0.24, 0.18, 0.12, col, { top: '#f0c27a', amb: AMB_IN });
      box(x + 0.27, y, z, 0.22, 0.18, 0.11, col, { top: '#e8b46c', amb: AMB_IN });
      break;
    case 'sando':
      for (let i = 0; i < 2; i++) box(x + i * 0.24, y, z, 0.2, 0.12, 0.2, '#f4efe2', { left: col, amb: AMB_IN });
      break;
    case 'cup':
      box(x, y, z, 0.18, 0.17, 0.2, col, { top: '#f6f1e6', amb: AMB_IN });
      box(x, y + 0.22, z, 0.18, 0.17, 0.2, col, { top: '#f6f1e6', amb: AMB_IN });
      break;
    case 'bag':
      box(x, y, z, 0.2, 0.1, 0.26, col, A);
      break;
    case 'bottle':
      for (let i = 0; i < 4; i++) {
        box(x + i * 0.18, y, z, 0.09, 0.09, 0.3, col, A);
        box(x + i * 0.18 + 0.02, y + 0.02, z + 0.3, 0.05, 0.05, 0.05, '#ffffff', A);
      }
      break;
    case 'can':
      for (let i = 0; i < 4; i++) box(x + i * 0.18, y, z, 0.1, 0.1, 0.2, col, { top: '#cfd3d8', amb: AMB_IN });
      break;
    case 'umbrella':
      box(x, y, z, 0.06, 0.06, 0.75, '#e6eef8', { alpha: 0.85, amb: AMB_IN });
      box(x - 0.01, y - 0.01, z + 0.75, 0.08, 0.08, 0.06, '#333', A);
      break;
    case 'towel':
      box(x, y, z, 0.22, 0.16, 0.08, col, A);
      break;
    case 'battery':
      box(x, y, z, 0.16, 0.06, 0.2, col, { left: '#e9c46a', amb: AMB_IN });
      break;
    case 'bun':
      box(x, y, z, 0.13, 0.13, 0.09, col, { emit: true });
      break;
    case 'karaage':
      box(x, y, z, 0.14, 0.1, 0.12, '#f7f3e8', { emit: true });
      box(x + 0.02, y + 0.02, z + 0.12, 0.1, 0.06, 0.04, col, { emit: true });
      break;
    case 'oden':
      box(x, y, z, 0.13, 0.13, 0.05, col, { emit: true });
      break;
    case 'icecup':
      box(x, y, z, 0.14, 0.14, 0.09, col, { top: '#f1f1f1', amb: AMB_IN });
      break;
    case 'mag':
      box(x, y, z, 0.24, 0.05, 0.32, col, { top: '#f4f4f4', amb: AMB_IN });
      box(x + 0.03, y + 0.051, z + 0.2, 0.18, 0.002, 0.08, '#ffffff', { amb: AMB_IN, noTop: true, noRight: true });
      break;
    case 'icebar':
      box(x, y, z, 0.07, 0.18, 0.04, col, A);
      break;
  }
}

/** 某个货架上要画哪些商品格子 (按库存比例) */
function unitsFor(cat, slots) {
  const list = carriedIn(cat);
  if (!list.length) return [];
  const q = Math.max(1, Math.floor(slots / list.length));
  const out = [];
  for (const p of list) {
    const n = Math.ceil(G.inv[p.id].shelf / SHELF_CAP * q);
    for (let i = 0; i < q; i++) out.push(i < n ? p.id : null);
  }
  return out.slice(0, slots);
}

function drawLabel(text, color, x, y, z, w, along) {
  const fn = along === 'x' ? planeX : planeY;
  fn(x, y, z, g => {
    g.fillStyle = color; g.font = `bold 15px ${FONT}`; g.textBaseline = 'top';
    g.fillText(text, 8, 4, w * 100 - 16);
  });
}

function drawFixture(cat) {
  const C = CAT_BY_ID[cat], [x, y, z, w, d, h] = C.box, A = { amb: AMB_IN };
  const units = unitsFor(cat, C.face === 'fridge' ? 21 : C.face === 'freezer' ? 12 : C.face === 'mag' ? 10 : 9);
  switch (C.face) {
    case 'top': {
      box(x, y, 0, w, d, h, '#b98a57', { top: '#d2a676', amb: AMB_IN });
      faceY(x, x + w, h - 0.14, h - 0.02, y + d + 0.002, C.color, A);
      const step = (w - 0.3) / 8;
      units.forEach((pid, i) => pid && drawProductUnit(pid, x + 0.08 + i * step, y + 0.18, h, i));
      break;
    }
    case 'y': {
      const tiers = [0.15, 0.6, 1.05];
      box(x, y, 0, w, d, 0.15, '#6b6f76', A);
      box(x, y, 0.15, w, 0.12, h - 0.15, '#e8e5de', A);
      box(x, y, 0.15, 0.06, d, h - 0.15, '#dcd8cf', A);
      const cw = (w - 0.12) / 3;
      for (let t = 0; t < 3; t++) {
        if (t) box(x + 0.06, y + 0.12, tiers[t], w - 0.12, d - 0.12, 0.04, '#d6d1c6', A);
        for (let c = 0; c < 3; c++) { const pid = units[t * 3 + c]; if (pid) drawProductUnit(pid, x + 0.1 + c * cw, y + d - 0.32, tiers[t] + 0.04, t * 3 + c); }
      }
      box(x + w - 0.06, y, 0.15, 0.06, d, h - 0.15, '#dcd8cf', A);
      box(x, y + d - 0.04, h, w, 0.04, 0.22, C.color, A);
      drawLabel(C.jp, '#ffffff', x, y + d + 0.002, h + 0.21, w, 'y');
      break;
    }
    case 'x': {
      const tiers = [0.15, 0.7, 1.25];
      box(x, y, 0, w, d, 0.15, '#6b6f76', A);
      box(x, y, 0.15, 0.12, d, h - 0.15, '#e8e5de', A);
      box(x, y, 0.15, w, 0.06, h - 0.15, '#dcd8cf', A);
      const cd = (d - 0.12) / 3;
      for (let t = 0; t < 3; t++) {
        if (t) box(x + 0.12, y + 0.06, tiers[t], w - 0.12, d - 0.12, 0.04, '#d6d1c6', A);
        for (let c = 0; c < 3; c++) { const pid = units[t * 3 + c]; if (pid) drawProductUnit(pid, x + w - 0.24, y + 0.1 + c * cd, tiers[t] + 0.04, t * 3 + c); }
      }
      box(x, y + d - 0.06, 0.15, w, 0.06, h - 0.15, '#dcd8cf', A);
      box(x + w - 0.04, y, h, 0.04, d, 0.22, C.color, A);
      drawLabel(C.jp, '#ffffff', x + w + 0.002, y + d, h + 0.21, d, 'x');
      break;
    }
    case 'fridge': {
      box(x, y, 0, w, d, h, '#cfd3d8', A);
      const fy = y + d + 0.003;
      faceY(x + 0.08, x + w - 0.08, 0.12, h - 0.2, fy, '#e6f4ff', { emit: true });
      const tiers = [0.2, 0.75, 1.3];
      const dw = (w - 0.16) / 7;
      for (let t = 0; t < 3; t++) for (let c = 0; c < 7; c++) {
        const pid = units[c * 3 + t];
        if (pid) drawProductUnit(pid, x + 0.16 + c * dw, fy - 0.15, tiers[t], c);
      }
      for (let i = 0; i <= 7; i++) faceY(x + 0.06 + i * dw, x + 0.1 + i * dw, 0.12, h - 0.2, fy + 0.002, '#9aa3ad', A);
      for (let i = 0; i < 7; i++) faceY(x + 0.1 + i * dw + dw - 0.14, x + 0.1 + i * dw + dw - 0.1, 0.7, 1.2, fy + 0.004, '#cfd6de', A);
      faceY(x + 0.08, x + w - 0.08, 0.12, h - 0.2, fy + 0.004, '#ffffff', { emit: true, alpha: 0.12 });
      box(x, y + d - 0.02, h - 0.2, w, 0.04, 0.2, C.color, A);
      drawLabel('ドリンク  ·  DRINKS  ·  ビール', '#ffffff', x + 2.4, fy + 0.006, h - 0.02, 3, 'y');
      break;
    }
    case 'daily': {
      box(x, y, 0, w, d, 0.5, '#34495e', A);
      const um = units.filter(u => u && PRODUCT_BY_ID[u].look[0] === 'umbrella');
      const other = units.filter(u => u && PRODUCT_BY_ID[u].look[0] !== 'umbrella');
      um.forEach((pid, i) => drawProductUnit(pid, x + 0.06 + (i % 3) * 0.12, y + 0.08 + Math.floor(i / 3) * 0.12, 0.5, i));
      box(x, y, 0.5, w, 0.1, 0.5, '#34495e', A);
      other.forEach((pid, i) => drawProductUnit(pid, x + 0.05 + (i % 2) * 0.18, y + 0.02, 1.0, i));
      faceY(x, x + w, 0.3, 0.45, y + d + 0.002, '#e6eef8', A);
      planeY(x + 0.02, y + d + 0.004, 0.44, g => { g.fillStyle = '#1d3557'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText('傘 ¥' + G.price.umbrella, 2, 1); });
      break;
    }
    case 'freezer': {
      box(x, y, 0, w, d, h, '#f4f6f8', { top: '#c9e6f5', amb: AMB_IN });
      faceY(x + 0.05, x + w - 0.05, 0.1, 0.25, y + d + 0.002, C.color, A);
      units.forEach((pid, i) => pid && drawProductUnit(pid, x + 0.1 + (i % 6) * 0.33, y + 0.1 + Math.floor(i / 6) * 0.2, h, i));
      flat(x + 0.04, y + 0.04, x + w - 0.04, y + d - 0.04, h + 0.12, '#e8f7ff', { emit: true, alpha: 0.28 });
      box(x, y + d - 0.04, h, w, 0.04, 0.14, '#5aa9e6', A);
      planeY(x + 0.05, y + d + 0.002, h + 0.13, g => { g.fillStyle = '#fff'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText('アイスクリーム  ICE', 4, 1); });
      break;
    }
    case 'mag': {
      box(x, y, 0, w, d, 0.55, '#8a6d5a', { top: '#a5876f', amb: AMB_IN });
      box(x, y + 0.04, 0.55, w, 0.12, 0.4, '#7a5f4e', A);
      units.forEach((pid, i) => pid && drawProductUnit(pid, x + 0.1 + (i % 10) * 0.27, y + 0.2, 0.55, i));
      faceY(x, x + w, 0.38, 0.5, y + d + 0.002, C.color, A);
      planeY(x + 0.05, y + d + 0.004, 0.49, g => { g.fillStyle = '#fff'; g.font = `bold 10px ${FONT}`; g.textBaseline = 'top'; g.fillText('MAGAZINE · 雑誌 · 新聞', 4, 1); });
      break;
    }
    case 'hot': {
      const on = G.unlocked.hot;
      box(x, y, z, w, d, h, on ? '#f2b866' : '#6b6f76', { emit: on, alpha: 0.9 });
      units.forEach((pid, i) => pid && drawProductUnit(pid, x + 0.08 + (i % 3) * 0.14, y + 0.06 + Math.floor(i / 3) * 0.18, z + 0.06 + Math.floor(i / 3) * 0.0, i));
      planeY(x + 0.02, y + d + 0.003, z + 0.42, g => { g.fillStyle = on ? '#7a3b00' : '#ddd'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText(on ? 'ホット' : '準備中', 4, 2); });
      break;
    }
  }
}

/* ---------------- 店内固定物件 ---------------- */
function buildInteriorStatics() {
  const A = { amb: AMB_IN };
  return [
    // 收银台
    item(COUNTER.x0, COUNTER.y0, COUNTER.x1, COUNTER.y1, () => {
      const { x0, y0, x1, y1 } = COUNTER;
      box(x0, y0, 0, x1 - x0, y1 - y0, 1.0, '#f1efe9', { top: '#d9d4c7', amb: AMB_IN, shadow: true });
      faceX(y0, y1, 0.72, 0.84, x1 + 0.002, '#2a9d8f', A);
      faceY(x0, x1, 0.72, 0.84, y1 + 0.002, '#2a9d8f', A);
      box(x0 + 0.1, 3.5, 1.0, 0.38, 0.45, 0.16, '#3a3f47', A);
      box(x0 + 0.12, 3.57, 1.16, 0.1, 0.3, 0.22, '#2b2f36', A);
      faceX(3.6, 3.84, 1.2, 1.35, x0 + 0.222, '#9ef0c0', { emit: true });
      box(x0 + 0.1, 3.05, 1.0, 0.35, 0.3, 0.08, '#cfd3d8', A);   // 小票机
      box(x0 + 0.1, 4.95, 1.0, 0.4, 0.2, 0.25, '#e9c46a', A);    // 募捐箱
      drawFixture('hot');
    }),
    // 柜台后的烟酒架
    item(14.42, 2.7, 14.85, 5.2, () => {
      box(14.42, 2.7, 0, 0.43, 2.5, 2.0, '#d6d0c4', A);
      const cols = ['#e63946', '#1d3557', '#f4f1de', '#2a9d8f', '#e9c46a'];
      for (let t = 0; t < 4; t++) for (let i = 0; i < 9; i++) box(14.43, 2.78 + i * 0.27, 0.6 + t * 0.32, 0.05, 0.22, 0.22, cols[(i + t) % 5], { amb: AMB_IN, noTop: true });
    }),
    // 咖啡机
    item(12.4, 5.9, 13.3, 6.4, () => {
      box(12.4, 5.9, 0, 0.9, 0.5, 0.9, '#c9b79c', { amb: AMB_IN, shadow: true });
      box(12.5, 5.95, 0.9, 0.42, 0.38, 0.6, '#2f3338', A);
      faceY(12.55, 12.85, 1.25, 1.4, 6.332, '#ffd166', { emit: true });
      box(13.0, 6.0, 0.9, 0.12, 0.12, 0.3, '#ffffff', A);
      box(13.15, 6.0, 0.9, 0.1, 0.1, 0.22, '#c49a65', A);
      planeY(12.53, 6.332, 1.12, g => { g.fillStyle = '#fff'; g.font = `bold 9px ${FONT}`; g.textBaseline = 'top'; g.fillText('COFFEE', 0, 0); });
    }),
    // ATM
    item(13.95, 5.9, 14.75, 6.5, () => {
      box(13.95, 5.9, 0, 0.8, 0.6, 1.4, '#d7dbe0', { amb: AMB_IN, shadow: true });
      faceY(14.07, 14.63, 0.85, 1.22, 6.502, '#5aa9e6', { emit: true });
      box(14.1, 6.3, 0.75, 0.5, 0.25, 0.04, '#9aa3ad', A);
      planeY(14.1, 6.503, 1.36, g => { g.fillStyle = '#1d3557'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText('ATM 24h', 0, 0); });
    }),
    // イートイン (窗边吧台 + 高脚凳)
    item(9.7, 6.55, 11.95, 6.88, () => {
      box(9.7, 6.55, 0.9, 2.25, 0.33, 0.07, '#b98a57', { top: '#d2a676', amb: AMB_IN });
      for (const lx of [9.75, 11.85]) box(lx, 6.6, 0, 0.06, 0.06, 0.9, '#5d636b', A);
      planeY(9.75, 6.882, 0.85, g => { g.fillStyle = MANGA.on ? '#000' : '#7a5f4e'; g.font = `bold 9px ${FONT}`; g.textBaseline = 'top'; g.fillText('EAT-IN  イートイン', 2, 0); });
    }),
    ...EATIN_SEATS.map(([sx, sy]) => item(sx - 0.15, sy - 0.15 + 0.1, sx + 0.15, sy + 0.15 + 0.1, () => {
      box(sx - 0.04, sy + 0.06, 0, 0.08, 0.08, 0.62, '#5d636b', A);
      box(sx - 0.16, sy - 0.06, 0.62, 0.32, 0.32, 0.06, '#e63946', A);
    })),
    // 购物篮
    item(8.5, 6.5, 8.86, 6.85, () => {
      for (let i = 0; i < 4; i++) box(8.52, 6.52, i * 0.1, 0.32, 0.3, 0.09, '#e63946', A);
    }),
  ];
}
/** 货架物件 (按解锁情况动态生成) */
function fixtureItems() {
  const list = [];
  for (const C of CATEGORIES) {
    if (C.face === 'hot') continue;
    const [x, y, , w, d] = C.box;
    if (G.unlocked[C.id]) list.push(item(x, y, x + w, y + d, () => drawFixture(C.id)));
    else if (C.id === 'magazine') list.push(item(x, y, x + w, y + d, () => { box(x, y, 0, w, d, 0.55, '#8a8f96', { amb: AMB_IN }); planeY(x + 0.1, y + d + 0.003, 0.45, g => { g.fillStyle = '#fff'; g.font = `bold 12px ${FONT}`; g.textBaseline = 'top'; g.fillText('準備中 · 敬请期待', 4, 2); }); }));
    else if (C.id === 'ice') list.push(item(x, y, x + w, y + d, () => { box(x, y, 0, w, d, 0.82, '#c9ced4', { amb: AMB_IN }); planeY(x + 0.1, y + d + 0.003, 0.6, g => { g.fillStyle = '#555'; g.font = `bold 12px ${FONT}`; g.textBaseline = 'top'; g.fillText('準備中', 4, 2); }); }));
  }
  return list;
}

/* ---------------- 送货卡车 ---------------- */
function drawTruck(t, env) {
  const L = 3.3, Wd = 1.3, x = t.x - L / 2, y = t.y - Wd / 2, dark = '#1c2430';
  for (const wx of [x + 0.4, x + L - 0.9]) { box(wx, y - 0.02, 0, 0.5, 0.18, 0.42, dark); box(wx, y + Wd - 0.16, 0, 0.5, 0.18, 0.42, dark); }
  box(x, y, 0.28, L - 0.9, Wd, 1.75, '#f4f4f2');
  faceY(x + 0.1, x + L - 1.0, 1.15, 1.45, y + Wd + 0.002, '#2a9d8f');
  planeY(x + 0.2, y + Wd + 0.004, 1.42, g => { g.fillStyle = '#fff'; g.font = `bold 22px ${FONT}`; g.textBaseline = 'top'; g.fillText('あまやどり便', 6, 2); });
  planeY(x + 0.2, y + Wd + 0.004, 0.95, g => { g.fillStyle = '#2a9d8f'; g.font = `bold 12px ${FONT}`; g.textBaseline = 'top'; g.fillText('DAILY DELIVERY  🚚', 6, 2); });
  box(x + L - 0.9, y + 0.05, 0.28, 0.9, Wd - 0.1, 1.15, '#2a9d8f', { right: '#1f7a6f' });
  box(x + L - 0.85, y + 0.12, 1.0, 0.55, Wd - 0.24, 0.35, '#2b3b52');
  faceX(y + 0.12, y + 0.3, 0.55, 0.7, x + L + 0.002, '#fff6d0', { emit: env.night > 0.3 });
  faceX(y + Wd - 0.3, y + Wd - 0.12, 0.55, 0.7, x + L + 0.002, '#fff6d0', { emit: env.night > 0.3 });
  if (t.state === 'stop') for (let i = 0; i < 3; i++) box(t.x - 0.8 + i * 0.4, t.y - Wd / 2 - 0.55, 0, 0.32, 0.3, 0.26, '#c49a65');
}

/* ---------------- 建筑外壳 (立面/右墙/屋顶) ---------------- */
function drawShell(env) {
  const H = STORE.H, ua = 1 - 0.88 * env.cut, open = env.door, X1 = SX1;
  const U = { alpha: ua };
  const RW = X1 - 0.15;

  // 右墙
  box(RW, 1.5, 0, 0.15, 5.5, 0.5, '#dfe2e6');
  if (ua > 0.02) {
    box(RW, 1.5, 0.5, 0.15, 5.5, H - 0.5, '#e4e6ea', U);
    faceX(1.5, 7, 2.3, 2.42, X1 + 0.002, '#2a9d8f', U);
    faceX(1.5, 7, 2.42, 2.48, X1 + 0.002, '#f4a261', U);
    faceX(4.3, 5.6, 1.1, 1.9, X1 + 0.003, '#2c3442', U);
    faceX(4.35, 5.55, 1.15, 1.85, X1 + 0.004, '#ffe8b8', { emit: true, alpha: 0.55 * ua });
    faceX(2.0, 2.9, 1.5, 1.95, X1 + 0.003, '#1d3557', U);
    planeX(X1 + 0.004, 2.85, 1.92, g => {
      g.globalAlpha = ua; g.fillStyle = '#fff'; g.font = `bold 15px ${FONT}`; g.textBaseline = 'top'; g.fillText('ATM あり', 6, 10);
    });
    // 排水管
    box(X1, 6.55, 0, 0.06, 0.06, H, '#9aa3ad', U);
  }

  // 屋顶
  if (ua > 0.02) {
    box(3, 1.5, H, X1 - 3, 5.5, 0.15, '#b8bcc2', U);
    for (const ax of [4.0, 5.2, 11.2, 12.4]) {
      box(ax, 2.1, H + 0.15, 0.95, 0.6, 0.6, '#d5d8dc', U);
      planeX(ax + 0.952, 2.65, H + 0.68, g => { g.globalAlpha = ua; g.strokeStyle = lit('#7a8088', 0.68); g.lineWidth = 3; g.beginPath(); g.arc(28, 25, 18, 0, 7); g.stroke(); });
    }
    box(7.2, 2.0, H + 0.15, 1.1, 1.1, 0.9, '#9aa3ad', U);
    for (let i = 0; i < 4; i++) box(8.8 + i * 0.5, 3.6, H + 0.2, 0.42, 1.6, 0.06, '#2b3a55', { alpha: ua, top: '#3d5a8a' });  // 太阳能板
    box(3, 1.5, H + 0.15, X1 - 3, 0.15, 0.25, '#cfd2d6', U);
    box(3, 1.5, H + 0.15, 0.15, 5.5, 0.25, '#cfd2d6', U);
    box(RW, 1.5, H + 0.15, 0.15, 5.5, 0.25, '#cfd2d6', U);
    box(X1 - 0.65, 6.3, H + 0.15, 0.4, 0.4, 2.2, '#1f3c88', { emit: true, alpha: ua });
    planeY(X1 - 0.64, 6.703, H + 2.25, g => {
      g.globalAlpha = ua; g.fillStyle = '#fff'; g.textBaseline = 'top';
      g.font = `bold 26px ${FONT}`; g.fillText('24', 4, 10);
      g.font = `bold 20px ${FONT}`; g.fillText('H', 12, 40); g.fillText('★', 10, 80);
      g.font = `bold 16px ${FONT}`; g.fillText('あ', 12, 120); g.fillText('ま', 12, 140); g.fillText('や', 12, 160);
    });
    box(3, 6.85, H + 0.15, X1 - 3, 0.15, 0.25, '#cfd2d6', U);
  }

  // 正立面
  box(3, 6.88, 0, 4, 0.17, 0.5, '#f1f1ef');
  box(8.4, 6.88, 0, X1 - 8.4, 0.17, 0.5, '#f1f1ef');
  faceY(3, 7, 0.38, 0.47, 7.052, '#2a9d8f');
  faceY(8.4, X1, 0.38, 0.47, 7.052, '#2a9d8f');
  const glassA = 0.22 * (1 - 0.6 * env.cut);
  faceY(3.18, 6.9, 0.5, 2.3, 7.05, '#d8ecff', { emit: true, alpha: glassA });
  faceY(8.5, X1 - 0.18, 0.5, 2.3, 7.05, '#d8ecff', { emit: true, alpha: glassA });
  if (!MANGA.on) for (const [a, b] of [[3.4, 4.2], [9.0, 9.9], [12.2, 13.0]]) {     // 玻璃反光斜纹
    poly([[a, 7.06, 0.6], [a + 0.25, 7.06, 0.6], [b, 7.06, 2.2], [b - 0.25, 7.06, 2.2]], `rgba(255,255,255,${0.08 * ua})`, false);
  }
  if (ua > 0.02) {
    for (const mx of [4.95, 9.9, 11.8, 13.6]) box(mx, 6.9, 0.5, 0.06, 0.14, 1.8, '#5a616b', U);
    faceY(3.35, 4.05, 0.7, 1.55, 7.056, '#e63946', U);
    planeY(3.42, 7.058, 1.5, g => {
      g.globalAlpha = ua; g.fillStyle = '#fff'; g.textBaseline = 'top';
      g.font = `bold 17px ${FONT}`; g.fillText('新発売', 2, 4);
      g.font = `bold 12px ${FONT}`; g.fillText('冬の肉まん', 2, 32); g.fillText('¥4', 2, 52);
    });
    faceY(14.1, 14.65, 1.3, 1.95, 7.056, '#fdf6e3', U);
    planeY(14.13, 7.058, 1.9, g => {
      g.globalAlpha = ua; g.fillStyle = '#e63946'; g.textBaseline = 'top';
      g.font = `bold 13px ${FONT}`; g.fillText('アルバイト', 2, 4);
      g.fillStyle = '#333'; g.font = `11px ${FONT}`; g.fillText('募集中', 2, 26); g.fillText('時給¥20〜', 2, 44);
    });
    faceY(12.2, 12.8, 0.9, 1.6, 7.056, '#ffd166', U);
    planeY(12.23, 7.058, 1.55, g => { g.globalAlpha = ua; g.fillStyle = '#7a3b00'; g.font = `bold 13px ${FONT}`; g.textBaseline = 'top'; g.fillText('からあげ', 3, 6); g.font = `bold 20px ${FONT}`; g.fillText('¥8', 6, 30); });
  }
  const off = 0.68 * open;
  for (const [dx, sgn] of [[DOOR.x0, -1], [DOOR.cx, 1]]) {
    const x0 = dx + sgn * off;
    faceY(x0, x0 + 0.7, 0.02, 2.2, 7.07, '#d8ecff', { emit: true, alpha: 0.2 });
    box(x0, 7.0, 0, 0.04, 0.08, 2.2, '#5a616b');
    box(x0 + 0.66, 7.0, 0, 0.04, 0.08, 2.2, '#5a616b');
    box(x0, 7.0, 2.16, 0.7, 0.08, 0.04, '#5a616b');
    box(x0 + (sgn < 0 ? 0.6 : 0.06), 7.08, 0.9, 0.03, 0.02, 0.4, '#c0c6cc');
  }
  box(6.88, 6.88, 0, 0.12, 0.17, 2.3, '#e8e8e6');
  box(8.4, 6.88, 0, 0.12, 0.17, 2.3, '#e8e8e6');
  planeY(7.25, 7.075, 1.6, g => { g.fillStyle = MANGA.on ? '#000' : 'rgba(40,60,90,0.8)'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText('自動ドア', 6, 0); });
  if (ua > 0.02) {
    box(3, 6.85, 0.5, 0.18, 0.2, H - 0.5, '#e9e9e7', U);
    box(X1 - 0.18, 6.85, 0.5, 0.18, 0.2, H - 0.5, '#e9e9e7', U);
    box(3, 6.88, 2.3, X1 - 3, 0.17, H - 2.3, '#f4f4f2', U);
    faceY(3, X1, 2.3, 2.42, 7.052, '#2a9d8f', U);
    faceY(3, X1, 2.42, 2.48, 7.052, '#f4a261', U);
  }
  // 雨棚
  poly([[6.5, 7.05, 2.32], [9.0, 7.05, 2.32], [9.0, 7.75, 2.06], [6.5, 7.75, 2.06]], lit('#2a9d8f', 1));
  for (let i = 0; i < 6; i++) poly([[6.5 + i * 0.42, 7.05, 2.321], [6.71 + i * 0.42, 7.05, 2.321], [6.71 + i * 0.42, 7.75, 2.061], [6.5 + i * 0.42, 7.75, 2.061]], lit('#f1f1ef', 1, 0.9), false);
  faceY(6.5, 9.0, 1.96, 2.06, 7.75, '#23867a');
  faceX(7.05, 7.75, 1.96, 2.32, 9.0, '#23867a');
  // 招牌灯箱
  if (ua > 0.02) {
    box(3.3, 7.05, 2.52, X1 - 3.6, 0.16, 0.78, '#fbfbf8', { emit: true, alpha: ua });
    planeY(3.3, 7.212, 3.3, g => {
      g.globalAlpha = ua;
      g.fillStyle = '#1f3c88'; g.beginPath(); g.arc(52, 38, 28, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `bold 32px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('☂', 52, 40);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = '#1f3c88'; g.font = `bold 52px ${FONT}`; g.fillText(STORE_NAME, 100, 2, 640);
      g.fillStyle = '#5b6b8c'; g.font = `bold 13px ${FONT}`; g.fillText(STORE_NAME_EN + '  ·  SINCE 1998', 104, 62);
      g.fillStyle = '#2a9d8f'; g.fillRect(780, 18, 6, 44); g.fillStyle = '#f4a261'; g.fillRect(790, 18, 6, 44);
      g.fillStyle = '#1f3c88'; g.fillRect(970, 8, 120, 62);
      g.fillStyle = '#fff'; g.font = `bold 34px ${FONT}`; g.fillText('24H', 990, 12);
      g.font = `bold 11px ${FONT}`; g.fillText('OPEN', 1015, 52);
      g.fillStyle = '#5b6b8c'; g.font = `bold 15px ${FONT}`; g.fillText('おにぎり · 弁当 · ドリンク', 810, 28);
    });
  }
}

/* ---------------- 自动贩卖机 ---------------- */
const VEND_X = [15.15, 16.05, 16.95];
function drawVending(i, env) {
  const x = VEND_X[i], y = 6.2, w = 0.85, d = 0.7, h = 1.9;
  const vm = G.vend ? G.vend[i] : VEND_DEFS[i];
  const def = VEND_DEFS[i], fy = y + d + 0.002;
  const hot = (G.temp ?? 15) < 16;
  box(x + 0.03, y - 0.03, 0, w - 0.06, d, 0.06, '#2b2b2b');
  box(x, y, 0.06, w, d, h - 0.06, def.color, { top: '#e9e9e9', shadow: true });
  faceX(y + 0.05, y + d - 0.05, 0.3, 1.6, x + w + 0.003, def.color2);
  planeX(x + w + 0.004, y + d - 0.08, 1.5, g => { g.fillStyle = '#fff'; g.font = `bold 15px ${FONT}`; g.textBaseline = 'top'; g.fillText(def.brand, 4, 2, 52); });
  // 顶部招牌
  faceY(x + 0.04, x + w - 0.04, 1.66, 1.84, fy, '#ffffff', { emit: true });
  planeY(x + 0.06, fy + 0.002, 1.83, g => { g.fillStyle = def.color; g.font = `bold 12px ${FONT}`; g.textBaseline = 'top'; g.fillText(def.brand, 2, 2, 74); });
  // 展示窗 (3 行 × 5 个样品)
  faceY(x + 0.07, x + w - 0.07, 0.98, 1.62, fy, '#eef5ff', { emit: true });
  const left = vm.stock;
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
    const cx = x + 0.11 + k * 0.135, z0 = 1.04 + r * 0.2;
    const pc = def.cans[(k + r) % def.cans.length];
    faceY(cx, cx + 0.08, z0 + 0.04, z0 + 0.17, fy + 0.002, pc, { emit: true });
    const soldOut = left <= (r * 5 + k) * vm.cap / 15;
    faceY(cx + 0.01, cx + 0.07, z0, z0 + 0.03, fy + 0.003, soldOut ? '#ff3b3b' : (r === 2 && hot ? '#e63946' : '#2d9cdb'), { emit: true });
  }
  planeY(x + 0.08, fy + 0.004, 1.02, g => {
    g.font = `bold 8px ${FONT}`; g.textBaseline = 'top';
    g.fillStyle = hot ? '#e63946' : '#2d9cdb'; g.fillText(hot ? 'あったか〜い' : 'つめた〜い', 2, 0);
  });
  if (left <= 0) planeY(x + 0.2, fy + 0.005, 1.4, g => { g.fillStyle = 'rgba(230,57,70,0.92)'; g.fillRect(0, 0, 44, 20); g.fillStyle = '#fff'; g.font = `bold 13px ${FONT}`; g.textBaseline = 'top'; g.fillText('売切', 9, 3); });
  // 投币 / 纸币口 / 价格屏
  faceY(x + 0.6, x + 0.78, 0.55, 0.95, fy, '#3a3f47');
  faceY(x + 0.64, x + 0.74, 0.86, 0.9, fy + 0.002, '#c0c6cc');
  faceY(x + 0.63, x + 0.75, 0.7, 0.76, fy + 0.002, '#9ef0c0', { emit: true });
  planeY(x + 0.63, fy + 0.004, 0.76, g => { g.fillStyle = '#063'; g.font = `bold 6px ${FONT}`; g.textBaseline = 'top'; g.fillText('¥' + vm.price, 1, 0); });
  // 取货口
  faceY(x + 0.1, x + 0.56, 0.16, 0.42, fy, '#1b1b1b');
  faceY(x + 0.12, x + 0.54, 0.34, 0.4, fy + 0.002, '#4a4f57');
  // 回收桶 (每台旁边)
  if (i === 2) {
    box(x + w + 0.08, 6.5, 0, 0.32, 0.38, 0.75, '#2f5d8c', { top: '#e0e0e0' });
    planeY(x + w + 0.1, 6.882, 0.65, g => { g.fillStyle = '#fff'; g.font = `bold 9px ${FONT}`; g.textBaseline = 'top'; g.fillText('缶・PET', 2, 0); });
  }
}

/* ---------------- 店门口的旗子 (のぼり) ---------------- */
const NOBORI = [[10.15, '#e63946', 'おでん'], [10.85, '#2a9d8f', '新発売'], [11.55, '#f4a261', 'からあげ'], [12.25, '#1f3c88', '冷たい']];
function drawNobori(x, col, text) {
  const y = 7.45, t = G.time || 0;
  ISO.ctx.globalAlpha = 1 - 0.55 * env.cut;
  box(x, y, 0, 0.05, 0.05, 2.25, '#c0c6cc');
  box(x - 0.06, y - 0.06, 0, 0.17, 0.17, 0.12, '#3a3f47');
  planeY(x + 0.05, y + 0.03, 2.2, g => {
    g.fillStyle = lit(col, 0.84);
    g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) g.lineTo(34 + Math.sin(t * 2.2 + i * 0.6 + x) * 3 * (i / 10), i * 18);
    g.lineTo(0, 180); g.closePath(); g.fill();
    if (MANGA.on) { g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = MANGA.on ? '#000' : '#fff'; g.font = `bold 20px ${FONT}`; g.textBaseline = 'top';
    [...text].forEach((ch, i) => g.fillText(ch, 6, 12 + i * 34));
  });
  ISO.ctx.globalAlpha = 1;
}

function drawCar(cx, cy, axis, facing, color, env, lightsOn) {
  const L = 2.3, Wd = 1.15;
  const dark = '#1c2430', glass = '#2b3b52';
  if (axis === 'y') {
    const x = cx - Wd / 2, y = cy - L / 2;
    for (const [wx, wy] of [[x - 0.02, y + 0.3], [x - 0.02, y + L - 0.75], [x + Wd - 0.16, y + 0.3], [x + Wd - 0.16, y + L - 0.75]]) box(wx, wy, 0, 0.18, 0.45, 0.38, dark);
    box(x, y, 0.22, Wd, L, 0.6, color);
    box(x + 0.08, y + 0.4, 0.82, Wd - 0.16, L - 1.0, 0.5, color, { left: glass, right: glass });
    box(x + 0.08, y + 0.4, 1.3, Wd - 0.16, L - 1.0, 0.04, '#d8d8d8');
    faceY(x + 0.1, x + 0.3, 0.55, 0.68, y + L + 0.002, lightsOn ? '#fff6d0' : '#cfcfcf', { emit: lightsOn });
    faceY(x + Wd - 0.3, x + Wd - 0.1, 0.55, 0.68, y + L + 0.002, lightsOn ? '#fff6d0' : '#cfcfcf', { emit: lightsOn });
    faceY(x + 0.35, x + Wd - 0.35, 0.3, 0.42, y + L + 0.002, '#e9e9e9');
    return;
  }
  const x = cx - L / 2, y = cy - Wd / 2;
  for (const [wx, wy] of [[x + 0.3, y - 0.02], [x + L - 0.75, y - 0.02], [x + 0.3, y + Wd - 0.16], [x + L - 0.75, y + Wd - 0.16]]) box(wx, wy, 0, 0.45, 0.18, 0.38, dark);
  box(x, y, 0.22, L, Wd, 0.6, color);
  const cabX = facing > 0 ? x + 0.35 : x + 0.65;
  box(cabX, y + 0.08, 0.82, L - 1.0, Wd - 0.16, 0.5, color, { left: glass, right: glass });
  if (facing > 0) {
    faceX(y + 0.1, y + 0.3, 0.55, 0.7, x + L + 0.002, '#fff6d0', { emit: lightsOn });
    faceX(y + Wd - 0.3, y + Wd - 0.1, 0.55, 0.7, x + L + 0.002, '#fff6d0', { emit: lightsOn });
  } else {
    faceX(y + 0.1, y + 0.3, 0.55, 0.7, x + L + 0.002, '#ff3b3b', { emit: lightsOn });
    faceX(y + Wd - 0.3, y + Wd - 0.1, 0.55, 0.7, x + L + 0.002, '#ff3b3b', { emit: lightsOn });
  }
}

function drawBike(x, y, color) {
  const wheel = (wx) => planeY(wx, y, 0.62, g => {
    g.strokeStyle = lit('#1e1e1e', 0.84); g.lineWidth = 5;
    g.beginPath(); g.arc(0, 31, 29, 0, 7); g.stroke();
    g.strokeStyle = lit('#9aa0a6', 0.84); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-28, 31); g.lineTo(28, 31); g.moveTo(0, 3); g.lineTo(0, 59); g.stroke();
  });
  wheel(x + 0.3); wheel(x + 1.1);
  planeY(x, y, 1.1, g => {
    g.strokeStyle = lit(color, 0.84); g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(30, 79); g.lineTo(62, 79); g.lineTo(110, 79); g.lineTo(98, 22);
    g.moveTo(30, 79); g.lineTo(52, 30); g.lineTo(98, 30); g.moveTo(62, 79); g.lineTo(52, 30); g.stroke();
    g.fillStyle = lit('#222', 0.84); g.fillRect(40, 22, 24, 7);
    g.strokeStyle = lit('#333', 0.84); g.beginPath(); g.moveTo(88, 12); g.lineTo(110, 12); g.stroke();
    g.fillStyle = lit('#b0b5bb', 0.84); g.fillRect(100, 14, 22, 14); // 车篮
  });
}

function buildFrontStatics() {
  const list = [];
  for (let x = 3; x < SX1; x++) {
    list.push(item(x, 8.72, x + 1, 8.82, () => {
      box(x, 8.72, 0, 0.08, 0.08, 0.72, '#eceff1');
      box(x, 8.74, 0.56, 1, 0.05, 0.08, '#eceff1');
      box(x, 8.74, 0.25, 1, 0.05, 0.06, '#eceff1');
      if (x === SX1 - 1) box(x + 0.92, 8.72, 0, 0.08, 0.08, 0.72, '#eceff1');
    }));
  }
  list.push(item(0.3, 5.65, 1.6, 7.95, (env) => drawCar(0.95, 6.8, 'y', 1, '#5f7a63', env, false)));
  list.push(item(3.3, 7.35, 4.6, 7.5, () => drawBike(3.3, 7.42, '#3d6b8c')));
  list.push(item(4.75, 7.35, 6.05, 7.5, () => drawBike(4.75, 7.42, '#9c3d3d')));
  list.push(item(6.45, 7.12, 6.8, 7.4, () => {
    box(6.45, 7.12, 0, 0.35, 0.28, 0.5, '#6b7078');
    const cols = ['#e6eef8', '#1d3557', '#e63946', '#e6eef8'];
    for (let i = 0; i < 4; i++) box(6.5 + i * 0.07, 7.2, 0.5, 0.05, 0.05, 0.35, cols[i]);
  }));
  list.push(item(6.05, 7.68, 6.5, 7.86, () => {
    box(6.05, 7.68, 0, 0.45, 0.18, 0.95, '#2b2b2b', { shadow: true });
    faceY(6.1, 6.45, 0.25, 0.88, 7.862, '#1f4d3a');
    planeY(6.12, 7.864, 0.85, g => {
      g.fillStyle = '#fff'; g.font = `bold 9px ${FONT}`; g.textBaseline = 'top';
      g.fillText('本日の', 2, 2); g.fillText('おすすめ', 2, 14);
      g.fillStyle = MANGA.on ? '#fff' : '#ffd166'; g.fillText('おでん', 2, 32); g.fillText('¥3〜', 2, 44);
    });
  }));
  [['#3a7d44', '燃'], ['#2f5d8c', '缶'], ['#7b7f86', 'PET']].forEach(([c, t], i) => {
    const x = 8.75 + i * 0.45;
    list.push(item(x, 7.1, x + 0.4, 7.45, () => {
      box(x, 7.1, 0, 0.4, 0.35, 0.75, c, { shadow: true });
      box(x + 0.12, 7.2, 0.75, 0.16, 0.12, 0.02, '#1b1b1b');
      planeY(x + 0.05, 7.452, 0.6, g => { g.fillStyle = '#fff'; g.font = `bold 11px ${FONT}`; g.textBaseline = 'top'; g.fillText(t, 4, 0); });
    }));
  });
  NOBORI.forEach(([x, col, text]) => list.push(item(x, 7.45, x + 0.4, 7.5, () => drawNobori(x, col, text))));
  // 长花槽
  list.push(item(13.0, 7.1, 14.7, 7.45, () => {
    box(13.0, 7.1, 0, 1.7, 0.35, 0.38, '#8a6a4f', { shadow: true });
    for (let i = 0; i < 6; i++) {
      const px = 13.05 + i * 0.27;
      box(px, 7.13, 0.38, 0.24, 0.28, 0.22 + (i % 2) * 0.1, i % 3 ? '#3f7d4e' : '#4f9a60');
      if (i % 2) box(px + 0.08, 7.2, 0.62, 0.08, 0.08, 0.08, '#ff8fab');
    }
  }));
  VEND_X.forEach((x, i) => list.push(item(x, 6.2, x + (i === 2 ? 1.3 : 0.85), 6.9, (env) => drawVending(i, env))));
  for (const y of [2.3, 3.2]) list.push(item(SX1 + 0.1, y, SX1 + 0.75, y + 0.65, () => {
    box(SX1 + 0.1, y, 0, 0.65, 0.65, 0.65, '#d9dcdf', { shadow: true });
    planeX(SX1 + 0.752, y + 0.6, 0.55, g => { g.strokeStyle = lit('#7a8088', 0.68); g.lineWidth = 3; g.beginPath(); g.arc(28, 22, 18, 0, 7); g.stroke(); });
  }));
  list.push(item(SX1 + 0.15, 4.4, SX1 + 0.65, 4.9, () => { for (let i = 0; i < 3; i++) box(SX1 + 0.15, 4.4, i * 0.28, 0.5, 0.5, 0.27, '#e9b824'); }));
  list.push(item(SX1 + 1.2, 3.0, SX1 + 2.4, 3.6, () => {    // 店员用的自行车 & 纸箱
    drawBike(SX1 + 1.2, 3.4, '#5b5f66');
  }));
  list.push(item(SX1 + 1.1, 4.6, SX1 + 2.0, 5.3, () => { box(SX1 + 1.1, 4.6, 0, 0.6, 0.5, 0.4, '#c49a65'); box(SX1 + 1.3, 4.8, 0.4, 0.5, 0.4, 0.3, '#b08a5a'); box(SX1 + 1.5, 4.7, 0, 0.5, 0.55, 0.35, '#c49a65'); }));
  // 弯道镜
  list.push(item(15.9, 8.72, 16.0, 8.82, (env) => {
    ISO.ctx.globalAlpha = 1 - 0.6 * env.cut;
    box(15.9, 8.72, 0, 0.08, 0.08, 2.3, '#e07a2f');
    planeY(15.94, 8.82, 2.75, g => {
      g.fillStyle = lit('#e07a2f', 0.84); g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
      g.fillStyle = 'rgba(190,210,230,0.9)'; g.beginPath(); g.arc(0, 0, 27, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-8, -8, 10, 5, -0.7, 0, 7); g.fill();
    });
    ISO.ctx.globalAlpha = 1;
  }));
  // 路灯
  list.push(item(17.65, 8.65, 17.77, 8.77, (env) => {
    ISO.ctx.globalAlpha = 1 - 0.6 * env.cut;
    box(17.65, 8.65, 0, 0.12, 0.12, 4.3, '#5d636b');
    box(17.66, 8.66, 4.2, 0.1, 0.95, 0.08, '#5d636b');
    box(17.58, 9.45, 3.98, 0.26, 0.3, 0.22, '#3b3f45');
    box(17.6, 9.47, 3.93, 0.22, 0.26, 0.05, env.night > 0.3 ? '#ffc56b' : '#e8e4d8', { emit: env.night > 0.3 });
    ISO.ctx.globalAlpha = 1;
  }));
  // 电线杆
  list.push(item(19.55, 7.85, 19.85, 8.15, (env) => {
    ISO.ctx.globalAlpha = 1 - 0.6 * env.cut;
    box(19.55, 7.85, 0, 0.3, 0.3, 7, '#9a9ea3');
    box(18.9, 7.95, 6.4, 1.6, 0.1, 0.12, '#6d7177');
    box(19.88, 7.88, 5.0, 0.42, 0.42, 0.7, '#7a7f86');
    for (const ix of [19.0, 19.65, 20.35]) box(ix, 7.96, 6.52, 0.06, 0.06, 0.12, '#e9e9e9');
    faceY(19.25, 20.15, 2.3, 2.95, 8.152, '#1f4fa0');
    planeY(19.3, 8.154, 2.9, g => {
      g.fillStyle = '#fff'; g.font = `bold 15px ${FONT}`; g.textBaseline = 'top';
      g.fillText('雨宿町3丁目', 2, 6); g.font = `9px ${FONT}`; g.fillText('AMAYADORI 3-CHOME', 2, 34);
    });
    const c = ISO.ctx; c.strokeStyle = MANGA.on ? '#111' : 'rgba(20,22,28,0.75)'; c.lineWidth = 1.1 * ISO.zoom;
    for (const ix of [19.0, 19.65, 20.35]) {
      const a = proj(ix, 7.99, 6.62), b = proj(ix - 20, 7.6, 6.9), m = proj(ix - 10, 7.8, 5.2);
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke();
    }
    c.globalAlpha = 1;
  }));
  // 公交站长椅
  list.push(item(18.2, 8.0, 19.3, 8.3, () => {
    box(18.25, 8.05, 0, 0.06, 0.2, 0.42, '#5d636b'); box(19.2, 8.05, 0, 0.06, 0.2, 0.42, '#5d636b');
    box(18.2, 8.0, 0.42, 1.1, 0.3, 0.06, '#b98a57', { top: '#d2a676' });
    box(18.2, 7.98, 0.48, 1.1, 0.05, 0.35, '#b98a57');
  }));
  return list;
}

function buildBackStatics() {
  return [
    item(0.2, 0.2, 2.7, 2.0, (env) => {
      box(0.2, 0.2, 0, 2.5, 1.8, 2.7, '#6b5a4e', { shadow: true });
      box(0.1, 0.1, 2.7, 2.7, 2.0, 0.2, '#2f343c');
      faceY(0.45, 1.45, 0.05, 1.9, 2.003, '#3b2f2a');
      faceY(0.5, 1.4, 1.35, 1.88, 2.006, '#1d3557');
      planeY(0.62, 2.008, 1.86, g => {
        g.fillStyle = '#fff'; g.font = `bold 24px ${FONT}`; g.textBaseline = 'top';
        g.fillText('酒', 6, 10); g.fillText('処', 48, 10);
      });
      faceY(1.7, 2.5, 0.9, 1.9, 2.003, '#ffd9a0', { emit: true, alpha: 0.4 + 0.6 * env.night });
      planeY(1.7, 2.005, 1.9, g => {
        g.strokeStyle = 'rgba(80,50,30,0.7)'; g.lineWidth = 3; g.beginPath();
        for (let i = 1; i < 4; i++) { g.moveTo(i * 20, 0); g.lineTo(i * 20, 100); }
        for (let j = 1; j < 4; j++) { g.moveTo(0, j * 25); g.lineTo(80, j * 25); }
        g.stroke();
      });
      box(1.48, 2.02, 1.3, 0.2, 0.2, 0.36, '#d62828', { emit: true });
      planeX(2.702, 1.6, 2.4, g => {
        g.fillStyle = '#f4e3c3'; g.fillRect(0, 0, 40, 110);
        g.fillStyle = '#3b2f2a'; g.font = `bold 26px ${FONT}`; g.textBaseline = 'top';
        g.fillText('横', 7, 10); g.fillText('丁', 7, 55);
      });
    }),
    item(0.15, 2.85, 1.35, 2.95, () => {
      box(0.2, 2.86, 0, 0.06, 0.06, 1.0, '#6b5040');
      box(1.25, 2.86, 0, 0.06, 0.06, 1.0, '#6b5040');
      box(0.15, 2.85, 1.0, 1.2, 0.1, 0.8, '#7b5a45');
      faceY(0.22, 1.28, 1.06, 1.74, 2.952, '#d9c7a8');
      const pc = ['#fdf6e3', '#e9c46a', '#a8dadc', '#fdf6e3', '#ffb4a2'];
      pc.forEach((c, i) => faceY(0.28 + i * 0.2, 0.43 + i * 0.2, 1.2 + (i % 2) * 0.15, 1.5 + (i % 2) * 0.15, 2.954, c));
    }),
    item(2.5, 5.0, 2.6, 5.1, () => {
      box(2.52, 5.02, 0, 0.06, 0.06, 1.7, '#8d9298');
      faceY(2.3, 2.85, 1.65, 2.2, 5.1, '#1f4fa0');
      planeY(2.38, 5.102, 2.17, g => { g.fillStyle = '#fff'; g.font = `bold 38px ${FONT}`; g.textBaseline = 'top'; g.fillText('P', 6, 2); });
    }),
    item(12.6, 0.5, 13.6, 1.2, () => {
      box(12.6, 0.5, 0, 0.6, 0.6, 0.45, '#b08a5a');
      box(13.0, 0.6, 0, 0.6, 0.6, 0.35, '#c49a65');
      box(12.7, 0.55, 0.45, 0.45, 0.45, 0.35, '#b08a5a');
    }),
    item(5.0, 0.4, 6.4, 1.0, () => { box(5.0, 0.4, 0, 1.4, 0.6, 1.1, '#3a7d44', { shadow: true }); box(5.05, 0.45, 1.1, 1.3, 0.5, 0.05, '#2f6b3a'); }),  // 垃圾站
  ];
}

/* ---------------- 夜间光晕 ---------------- */
function drawGlows(env, cars) {
  const N = env.night;
  if (N < 0.02 || MANGA.on) return;
  const c = ISO.ctx;
  c.save();
  c.globalCompositeOperation = 'lighter';
  // 橱窗光束投在人行道上
  for (const [a, b] of [[3.18, 6.9], [7.0, 8.4], [8.5, SX1 - 0.18]]) {
    const p0 = proj(a, 7.06, 0), p1 = proj(b, 7.06, 0), p2 = proj(b + 0.5, 8.6, 0), p3 = proj(a + 0.5, 8.6, 0);
    const mid0 = proj((a + b) / 2, 7.06, 0), mid1 = proj((a + b) / 2 + 0.5, 8.6, 0);
    const gr = c.createLinearGradient(mid0[0], mid0[1], mid1[0], mid1[1]);
    gr.addColorStop(0, `rgba(255,236,200,${0.26 * N})`); gr.addColorStop(1, 'rgba(255,236,200,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.lineTo(...p2); c.lineTo(...p3); c.closePath(); c.fill();
  }
  poolAt(9, 8.4, 6.5, '255,236,200', 0.12 * N, 1.6);
  for (const [x, y] of [[5.5, 4.3], [9.5, 4.3], [13, 4.2]]) poolAt(x, y, 2.6, '255,248,230', 0.08 * N, 1.2);
  glowAt(9, 7.2, 2.9, 5, '230,240,255', 0.16 * N * (1 - 0.8 * env.cut));
  glowAt(17.71, 9.6, 3.9, 1.3, '255,190,110', 0.55 * N);
  poolAt(17.7, 9.6, 3.0, '255,180,90', 0.26 * N, 1.2);
  poolAt(17.6, 11.2, 1.6, '255,180,90', 0.10 * N * (0.4 + env.rain), 0.35);
  for (const vx of VEND_X) { glowAt(vx + 0.42, 6.95, 1.3, 1.2, '210,230,255', 0.26 * N); poolAt(vx + 0.42, 7.6, 1.4, '200,225,255', 0.12 * N, 1.1); }
  glowAt(SX1 - 0.45, 6.5, 4.6, 1.3, '120,150,255', 0.35 * N * (1 - 0.88 * env.cut));
  glowAt(2.1, 2.05, 1.4, 1.2, '255,200,140', 0.35 * N);
  glowAt(1.58, 2.12, 1.5, 0.7, '255,80,60', 0.4 * N);
  for (const car of cars) {
    const ax = car.x + car.dir * 1.3;
    if (car.dir > 0) {
      glowAt(ax, car.y, 0.6, 0.8, '255,245,210', 0.45 * N);
      poolAt(ax + 1.6, car.y, 1.8, '255,245,210', 0.22 * N, 1.2);
    } else {
      glowAt(car.x + 1.15, car.y, 0.6, 0.5, '255,60,60', 0.4 * N);
    }
  }
  c.restore();
}

/* 暗角 */
function drawVignette() {
  if (MANGA.on) return;
  const c = ISO.ctx, R = Math.hypot(ISO.W, ISO.H) / 2;
  const g = c.createRadialGradient(ISO.W / 2, ISO.H / 2, R * 0.55, ISO.W / 2, ISO.H / 2, R * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.22 + 0.2 * env.night})`);
  c.fillStyle = g; c.fillRect(0, 0, ISO.W, ISO.H);
}
