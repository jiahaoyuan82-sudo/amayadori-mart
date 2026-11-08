'use strict';
/* =========================================================
 * people.js — 人物 (顾客 / 路人 / 店员) 的外观绘制
 * ========================================================= */

function randomLook() {
  return {
    shirt: pick(LOOKS.shirt), pants: pick(LOOKS.pants), hair: pick(LOOKS.hair),
    skin: pick(LOOKS.skin), umb: pick(LOOKS.umb), tall: rand(0.92, 1.06),
    longHair: Math.random() < 0.3, glasses: Math.random() < 0.2,
    shoes: pick(['#2b2b2b', '#f1f1ee', '#6b4226', '#3d405b', '#e63946']),
    backpack: Math.random() < 0.15 ? pick(['#264653', '#e76f51', '#3a3a3a']) : null,
  };
}

function regionOf(x, y) {
  if (x > STORE.x0 && x < STORE.x1 && y > STORE.y0 && y < STORE.y1) return 'in';
  if (y >= STORE.y1 || x >= STORE.x1) return 'front';
  return 'back';
}

function personBounds(p) { return { x0: p.x - 0.2, y0: p.y - 0.15, x1: p.x + 0.2, y1: p.y + 0.15 }; }

function drawPerson(p, env) {
  const c = ISO.ctx, L = p.look;
  const inside = regionOf(p.x, p.y) === 'in';
  const saved = AMB;
  if (inside) AMB = AMB_IN;
  c.globalAlpha = p.alpha == null ? 1 : p.alpha;

  const s = L.tall || 1;
  const ph = p.phase || 0, mv = clamp((p.spd ?? (p.moving ? 1.2 : 0)) / 1.2, 0, 1);
  const breath = Math.sin((G.time || 0) * 2 + (p.x * 3)) * 0.006;
  const sw = Math.sin(ph) * 0.11 * mv, bob = Math.abs(Math.cos(ph)) * 0.035 * mv + breath;
  const sitZ = p.sit ? 0.62 : 0;
  const dx = p.dir ? p.dir[0] : 1, dy = p.dir ? p.dir[1] : 0;
  const px = -dy, py = dx; // 垂直方向
  const x = p.x, y = p.y;

  // 影子
  planeZ(x, y, 0.015, g => { g.fillStyle = MANGA.on ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 0, 24, 20, 0, 0, 7); g.fill(); });

  const legH = 0.66 * s, bodyZ = (p.sit ? sitZ : legH) + bob, bodyH = 0.56 * s;
  const legs = [
    [x + px * 0.08 + dx * sw, y + py * 0.08 + dy * sw],
    [x - px * 0.08 - dx * sw, y - py * 0.08 - dy * sw],
  ].sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  if (p.sit) {
    for (const [lx, ly] of legs) { box(lx - 0.055 + dx * 0.12, ly - 0.055 + dy * 0.12, 0.1, 0.11, 0.11, sitZ - 0.1, L.pants); box(lx - 0.06 + dx * 0.14, ly - 0.06 + dy * 0.14, 0, 0.12, 0.14, 0.08, L.shoes || '#2b2b2b'); }
  } else {
    for (const [lx, ly] of legs) {
      box(lx - 0.055, ly - 0.055, 0.07, 0.11, 0.11, legH - 0.07, L.pants);
      box(lx - 0.06 + dx * 0.03, ly - 0.06 + dy * 0.03, 0, 0.12, 0.12, 0.08, L.shoes || '#2b2b2b');
    }
  }

  const arms = [
    { x: x + px * 0.23 - dx * sw * 0.8, y: y + py * 0.23 - dy * sw * 0.8 },
    { x: x - px * 0.23 + dx * sw * 0.8, y: y - py * 0.23 + dy * sw * 0.8 },
  ];
  const reach = p.reach || 0;
  const drawArm = (a, i) => {
    if (reach && i === 0) {   // 伸手拿东西
      box(a.x - 0.05 + dx * 0.12, a.y - 0.05 + dy * 0.12, bodyZ + 0.3, 0.1, 0.1, 0.24, L.shirt);
      box(a.x - 0.045 + dx * 0.26, a.y - 0.045 + dy * 0.26, bodyZ + 0.36, 0.09, 0.09, 0.08, L.skin);
      return;
    }
    box(a.x - 0.05, a.y - 0.05, bodyZ + 0.12, 0.1, 0.1, 0.41 * s, L.shirt);
    box(a.x - 0.045, a.y - 0.045, bodyZ + 0.04, 0.09, 0.09, 0.08, L.skin);
  };
  const back = arms.filter(a => a.x + a.y < x + y), front = arms.filter(a => a.x + a.y >= x + y);
  back.forEach(a => drawArm(a, arms.indexOf(a)));
  box(x - 0.17, y - 0.12, bodyZ, 0.34, 0.24, bodyH, L.shirt);
  if (L.collar) faceY(x - 0.05, x + 0.05, bodyZ + bodyH - 0.12, bodyZ + bodyH - 0.01, y + 0.122, L.collar);
  if (L.apron) faceY(x - 0.15, x + 0.15, bodyZ + 0.05, bodyZ + 0.4, y + 0.122, L.apron);
  if (L.backpack) box(x - 0.14 - dx * 0.18, y - 0.1 - dy * 0.18, bodyZ + 0.1, 0.28, 0.2, 0.36, L.backpack);
  front.forEach(a => drawArm(a, arms.indexOf(a)));

  const hz = bodyZ + bodyH;
  if (L.longHair) box(x - 0.15 - dx * 0.06, y - 0.15 - dy * 0.06, hz - 0.2, 0.3, 0.3, 0.3, L.hair);
  box(x - 0.13, y - 0.13, hz, 0.26, 0.26, 0.27, L.skin);
  if (dy > 0.3) planeY(x - 0.13, y + 0.131, hz + 0.18, g => { g.fillStyle = '#222'; g.fillRect(6, 0, 4, 5); g.fillRect(16, 0, 4, 5); if (L.glasses) { g.strokeStyle = '#222'; g.lineWidth = 1.5; g.strokeRect(3, -2, 9, 8); g.strokeRect(14, -2, 9, 8); } });
  else if (dx > 0.3) planeX(x + 0.131, y + 0.13, hz + 0.18, g => { g.fillStyle = '#222'; g.fillRect(6, 0, 4, 5); g.fillRect(16, 0, 4, 5); if (L.glasses) { g.strokeStyle = '#222'; g.lineWidth = 1.5; g.strokeRect(3, -2, 9, 8); g.strokeRect(14, -2, 9, 8); } });
  box(x - 0.14, y - 0.14, hz + 0.2, 0.28, 0.28, 0.1, L.hair);
  if (L.bun) box(x - 0.07, y - 0.07, hz + 0.3, 0.14, 0.14, 0.1, L.hair);
  if (dy < 0.5) box(x - 0.14, y - 0.14, hz + 0.05, 0.28, 0.08, 0.17, L.hair);
  if (L.cap) {
    box(x - 0.15, y - 0.15, hz + 0.27, 0.3, 0.3, 0.07, L.cap);
    box(x - 0.1 + dx * 0.15, y - 0.1 + dy * 0.15, hz + 0.27, 0.2, 0.2, 0.03, L.cap);
  }
  // 购物袋
  if (p.bag) {
    const a = front[0] || arms[0];
    box(a.x - 0.1, a.y - 0.06, bodyZ - 0.25, 0.2, 0.12, 0.26, '#fbfbfb');
  }
  if (p.umbrella > 0.05) drawUmbrella(x, y, hz + 0.45, L.umb, p.umbrella);

  c.globalAlpha = 1;
  AMB = saved;
}

function drawUmbrella(x, y, z, col, a) {
  const n = 8, r = 0.62;
  line3([x, y, z + 0.25], [x + 0.05, y + 0.05, z - 0.95], 'rgba(40,40,40,0.9)', 1.4);
  const apex = [x, y, z + 0.28];
  const rim = [];
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2 + Math.PI / 8;
    rim.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r, z]);
  }
  const tris = [];
  for (let i = 0; i < n; i++) {
    const p = rim[i], q = rim[(i + 1) % n];
    tris.push({ p, q, k: p[0] + q[0] + p[1] + q[1], i });
  }
  tris.sort((A, B) => A.k - B.k);
  const clear = col === 'clear';
  for (const t of tris) {
    const f = t.i % 2 ? 0.88 : 1;
    const fill = clear ? `rgba(225,235,248,${0.42 * a})` : lit(col, f, 0.95 * a);
    poly([apex, t.p, t.q], fill, clear ? `rgba(255,255,255,${0.5 * a})` : false);
  }
}
