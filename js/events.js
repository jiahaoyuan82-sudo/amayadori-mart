'use strict';
/* =========================================================
 * events.js — 随机事件 & 漫画风对话
 * ========================================================= */

/* ======================= 对话 ======================= */
G.talks = []; G.pendingTalks = []; G.chatT = 8;

/** 让某人说话. style: normal | shout | think */
function say(p, text, style = 'normal', dur = 3.4) {
  if (!p) return;
  G.talks = G.talks.filter(t => t.p !== p);
  G.talks.push({ p, text, style, t: 0, dur });
  if (G.talks.length > 4) G.talks.shift();
}
function sayLater(delay, p, text, style, dur) { G.pendingTalks.push({ delay, p, text, style, dur }); }

const LINES = {
  enterClerk: ['いらっしゃいませ～！', '欢迎光临～', 'いらっしゃいませ！'],
  regCustomer: ['麻烦帮我加热一下～', '有袋子吗？', '可以用手机付吗？', '再来一份关东煮！', '这个是新品吗？', '今天也辛苦啦～', '积分卡在这里', '不用袋子，谢谢'],
  regClerk: ['好的，请稍等～', '承惠，谢谢！', 'ありがとうございました！', '要加热吗？', '欢迎下次再来～', '这是找零～'],
  browse: ['嗯…吃什么好呢', '今天想吃点不一样的', '又涨价了吗…', '这个新口味看起来不错', '晚饭就这个吧'],
  rain: ['雨好大啊…', '忘带伞了…', '躲会儿雨再走吧', '鞋子全湿了…'],
  cold: ['好冷！来个肉包吧', '关东煮的味道好香～', '冬天就该吃热乎的'],
  hot: ['热死了…冰棍冰棍！', '要冰的，越冰越好', '空调好舒服～'],
  night: ['加班到现在…', '夜宵就靠你了', '睡不着出来逛逛'],
  morning: ['早饭随便吃点', '要迟到了要迟到了！', '来杯咖啡提提神'],
  empty: ['啊，卖完了吗…', '想要的没有了…', '下次早点来吧'],
  waitLong: ['怎么这么慢…', '赶时间啊…', '排了好久了'],
  staffIdle: ['店长，今天客人好多！', '我去整理一下货架', '仓库的货我来搬～', '下雨天伞卖得好快', '有点困了…', '今天的晚饭吃什么呢', '那位常客今天还没来呢', 'がんばります！'],
  staffGenki: ['いらっしゃいませーーー！！', '包在我身上！', '今天也元气满满！'],
  eat: ['好吃～', 'ふぅ…暖和了', '休息一下再走', '这家的炸鸡真不错'],
};
function contextLine(c) {
  const h = G.minute / 60, T = G.temp ?? 15, pool = [...LINES.browse];
  if (G.rain > 0.4) pool.push(...LINES.rain, ...LINES.rain);
  if (T < 10) pool.push(...LINES.cold, ...LINES.cold);
  if (T > 26) pool.push(...LINES.hot, ...LINES.hot);
  if (h >= 22 || h < 4) pool.push(...LINES.night);
  if (h >= 6 && h < 10) pool.push(...LINES.morning);
  return pick(pool);
}
function clerkPerson() {
  const cs = currentCashier();
  return cs && G.staffRT[cs.id] ? G.staffRT[cs.id] : clerk;
}

function updateChatter(dt) {
  for (const t of G.talks) t.t += dt;
  G.talks = G.talks.filter(t => t.t < t.dur && (!t.p.dead));
  G.pendingTalks = G.pendingTalks.filter(t => { t.delay -= dt; if (t.delay <= 0) { say(t.p, t.text, t.style, t.dur); return false; } return true; });
  if (!G.started) return;
  G.chatT -= dt;
  if (G.chatT > 0) return;
  G.chatT = rand(6, 14);
  const r = Math.random();
  const ready = G.queue[0] && G.queue[0].ready ? G.queue[0] : null;
  if (ready && r < 0.35) {
    say(ready, pick(LINES.regCustomer));
    sayLater(1.4, clerkPerson(), pick(LINES.regClerk));
  } else if (r < 0.65) {
    const cs = G.customers.filter(c => ['toShelf', 'pick', 'waitStock', 'eat', 'queue'].includes(c.state) && !c.thief);
    if (cs.length) {
      const c = pick(cs);
      if (c.state === 'waitStock') say(c, pick(LINES.empty), 'think');
      else if (c.state === 'eat') say(c, pick(LINES.eat));
      else if (c.state === 'queue' && c.patience / c.maxPatience < 0.4) say(c, pick(LINES.waitLong), 'think');
      else say(c, contextLine(c), Math.random() < 0.4 ? 'think' : 'normal');
    }
  } else if (r < 0.85) {
    const sts = G.staff.filter(s => G.staffRT[s.id] && G.staffRT[s.id].state !== 'leaving');
    if (sts.length) {
      const st = pick(sts), rt = G.staffRT[st.id];
      if (st.traits.includes('genki') && Math.random() < 0.6) say(rt, pick(LINES.staffGenki), 'shout');
      else say(rt, pick(LINES.staffIdle));
    }
  }
}

/* ======================= 事件 ======================= */
G.cat = null; G.floorItems = G.floorItems || [];

const EVENT_DEFS = [
  { id: 'thief', w: 1, ok: () => G.customers.length < MAX_INSIDE - 1, run: evThief },
  { id: 'cat', w: 1.2, ok: () => !G.cat && G.rain < 0.5, run: evCat },
  { id: 'tour', w: 0.8, ok: h => h >= 10 && h < 20, run: evTour },
  { id: 'influencer', w: 0.5, ok: h => h >= 11 && h < 22, run: evInfluencer },
  { id: 'wallet', w: 0.9, ok: () => G.floorItems.length < 3, run: () => dropFloorItem('wallet') },
  { id: 'spill', w: 1.1, ok: () => G.floorItems.length < 3, run: () => dropFloorItem('spill') },
  { id: 'sick', w: 0.6, ok: () => G.staff.length > 0, run: evSick },
  { id: 'drunk', w: 1, ok: h => h >= 22 || h < 3, run: evDrunk },
  { id: 'students', w: 1.2, ok: h => h >= 15 && h < 18 && dateOf(G.day).getDay() % 6 !== 0, run: evStudents },
  { id: 'regular', w: 2, ok: () => true, run: evRegular },
  { id: 'supplier', w: 0.6, ok: h => h >= 7 && h < 18, run: evSupplierSale },
  { id: 'gift', w: 0.4, ok: () => true, run: evGift },
  { id: 'breakdown', w: 0.4, ok: () => G.money > 200, run: evBreakdown },
  { id: 'rush', w: 0.7, ok: h => (h >= 7 && h < 9) || (h >= 12 && h < 13) || (h >= 18 && h < 20), run: evRush },
];

function maybeEvent(hour) {
  if (!G.started || Math.random() > 0.3) return;
  const h = Math.floor(G.minute / 60);
  const list = EVENT_DEFS.filter(e => e.ok(h));
  if (list.length) wpick(list, e => e.w).run();
}

/* ---- 小偷 ---- */
function evThief() {
  const pool = PRODUCTS.filter(p => G.unlocked[p.cat] && G.carried[p.id] && CAT_BY_ID[p.cat].stand && G.inv[p.id].shelf > 0);
  if (!pool.length) return;
  const wants = [pick(pool).id];
  const c = spawnCustomer({ wants, look: { ...randomLook(), shirt: '#2b2b2b', pants: '#1b1b1b', cap: '#1b1b1b', glasses: false }, flags: { thief: true }, speed: 0.95 });
  toast('👀 有个打扮可疑的人进店了，盯紧他！');
  c.hot = [];
}
function thiefEscape(c) {
  if (c.caught || c.escaped) return;
  c.escaped = true;
  const loss = r1(c.got.reduce((s, g) => s + g.price, 0));
  if (loss > 0) { toast(`😱 有人偷了东西跑了！损失 ${yen(loss)}`); G.fin.today.lostValue = r1(G.fin.today.lostValue + loss); G.rep = clamp(G.rep - 0.05, 0, 5); }
}
function catchThief(c) {
  if (c.caught) return;
  c.caught = true; c.thief = false;
  for (const g of c.got) G.inv[g.pid].shelf = Math.min(SHELF_CAP, G.inv[g.pid].shelf + 1);
  c.got = []; c.wants = [];
  say(clerkPerson(), '站住！放下东西！', 'shout', 2.6);
  sayLater(1.2, c, '对、对不起…', 'normal', 2.4);
  G.rep = clamp(G.rep + 0.2, 0, 5);
  toast('👮 抓到小偷了！商品放回货架，口碑上升');
  Sound.angry();
  leave(c, 0);
  c.speed = 1.8;
}

/* ---- 小猫 ---- */
function evCat() {
  const fromLeft = Math.random() < 0.5;
  G.cat = { x: fromLeft ? 0.2 : BOARD.w - 0.2, y: 7.7, tx: rand(9.3, 10.0), state: 'walk', t: 0, life: rand(70, 120), dir: fromLeft ? 1 : -1, petted: 0 };
}
function updateCat(dt) {
  const k = G.cat; if (!k) return;
  k.t += dt;
  if (k.state === 'walk') { const d = k.tx - k.x; k.dir = Math.sign(d) || k.dir; k.x += Math.sign(d) * Math.min(Math.abs(d), dt * 0.9); if (Math.abs(d) < 0.02) k.state = 'sit'; }
  else if (k.state === 'sit' && k.t > k.life) { k.state = 'leave'; k.tx = k.x < BOARD.w / 2 ? -0.5 : BOARD.w + 0.5; }
  else if (k.state === 'leave') { const d = k.tx - k.x; k.dir = Math.sign(d); k.x += Math.sign(d) * dt * 1.1; if (k.x < -0.3 || k.x > BOARD.w + 0.3) G.cat = null; }
}
function petCat() {
  const k = G.cat; if (!k) return;
  k.petted++;
  say(k, k.petted > 2 ? 'ゴロゴロ…♡' : 'にゃ～', 'normal', 2);
  if (k.petted === 1) { G.rep = clamp(G.rep + 0.08, 0, 5); toast('🐱 摸了摸小猫，路过的客人都笑了（口碑+）'); }
  Sound.tone(880, 0, 0.15, 'sine', 0.12); Sound.tone(1100, 0.1, 0.2, 'sine', 0.1);
}
function drawCat(k) {
  const x = k.x, y = k.y, s = k.state === 'sit', bob = s ? 0 : Math.abs(Math.sin(G.time * 10)) * 0.03, col = '#e9a25b', dk = '#b8742e';
  planeZ(x, y, 0.012, g => { g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 0, 22, 12, 0, 0, 7); g.fill(); });
  const fx = k.dir;
  if (s) {
    box(x - 0.13, y - 0.1, 0, 0.26, 0.2, 0.22, col);
    box(x - 0.1 + fx * 0.08, y - 0.08, 0.22, 0.2, 0.17, 0.17, col);
    box(x - 0.09 + fx * 0.08, y - 0.07, 0.39, 0.05, 0.05, 0.06, dk); box(x + 0.04 + fx * 0.08, y - 0.07, 0.39, 0.05, 0.05, 0.06, dk);
    box(x - 0.2 * fx - 0.03, y + 0.05, 0, 0.06, 0.2, 0.04, dk);
  } else {
    box(x - 0.18, y - 0.08, 0.1 + bob, 0.36, 0.16, 0.14, col);
    for (const lx of [-0.14, 0.1]) box(x + lx, y - 0.06, 0, 0.05, 0.12, 0.1 + bob, col);
    box(x + fx * 0.18 - 0.08, y - 0.08, 0.18 + bob, 0.16, 0.16, 0.14, col);
    box(x + fx * 0.18 - 0.07, y - 0.07, 0.32 + bob, 0.04, 0.04, 0.05, dk); box(x + fx * 0.18 + 0.03, y - 0.07, 0.32 + bob, 0.04, 0.04, 0.05, dk);
    box(x - fx * 0.22 - 0.02, y - 0.02, 0.2 + Math.sin(G.time * 6) * 0.04, 0.04, 0.04, 0.22, dk);
  }
}

/* ---- 旅游团 / 学生 / 高峰 ---- */
function evTour() {
  const n = randInt(5, 7);
  toast('🎌 一个旅游团进店了！');
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      if (!G.started) return;
      const c = spawnCustomer({ fromLeft: true, look: { ...randomLook(), backpack: pick(['#e63946', '#f4a261', '#2a9d8f']), cap: Math.random() < 0.4 ? '#f2c94c' : null }, speed: 1.0 });
      if (i === 0) sayLater(1, c, pick(['哇，日本的便利店！', 'わぁ～コンビニだ！', '饭团好多种类！']), 'shout', 3);
      if (i === 2) sayLater(3, c, '大家快来拍照！', 'normal', 2.5);
    }, i * 900 / Math.max(1, G.speed));
  }
}
function evStudents() {
  toast('🎒 放学了，一群学生涌进来');
  for (let i = 0; i < 4; i++) setTimeout(() => {
    if (!G.started) return;
    const c = spawnCustomer({ look: { ...randomLook(), shirt: '#1d3557', pants: '#2b2d42', collar: '#ffffff', backpack: '#3a3a3a' }, speed: 1.5 });
    if (i === 1) sayLater(1.5, c, pick(['买炸鸡吗？', '冰棍我请客！', '饿死了～']), 'shout', 2.6);
  }, i * 700 / Math.max(1, G.speed));
}
function evRush() {
  toast('⏰ 客流高峰！');
  for (let i = 0; i < 4; i++) setTimeout(() => G.started && spawnCustomer(), i * 1200 / Math.max(1, G.speed));
}

/* ---- 网红 ---- */
function evInfluencer() {
  const hotOk = G.unlocked.hot && carriedIn('hot').length;
  const wants = hotOk ? [pick(carriedIn('hot')).id] : [pick(PRODUCTS.filter(p => G.unlocked[p.cat] && G.carried[p.id] && CAT_BY_ID[p.cat].stand)).id];
  const c = spawnCustomer({ wants, look: { ...randomLook(), shirt: '#ff8fab', glasses: true }, flags: { influencer: true } });
  sayLater(1.5, c, '家人们，今天来探店啦！', 'shout', 3);
  toast('📱 好像有网红来探店了…好好招待！');
}

/* ---- 常客 ---- */
const REGULARS = [
  { id: 'tanaka', name: '田中爷爷', look: { shirt: '#8d99ae', pants: '#4a4e69', hair: '#c9c9c9', skin: '#f1d3b3', tall: 0.92, glasses: true }, lines: ['今天也来买报纸', '小伙子很勤快嘛', '天气变冷咯'], want: ['newspaper', 'tea', 'onigiri_ume'] },
  { id: 'sato', name: '加班的佐藤小姐', look: { shirt: '#f1f1ee', pants: '#22223b', hair: '#2b211c', skin: '#f6dcc3', longHair: true, tall: 0.97 }, lines: ['又加班到这么晚…', '老样子，咖啡和饭团', '只有你们店还开着'], want: ['coffee', 'onigiri_tuna', 'sando'] },
  { id: 'rider', name: '外卖小哥', look: { shirt: '#f2c94c', pants: '#22223b', hair: '#1b1b1b', skin: '#e8c39e', cap: '#f2c94c' }, lines: ['今天单子好多！', '借个充电宝…开玩笑的', '快快快，赶时间'], want: ['water', 'cupramen', 'karaage'] },
  { id: 'kid', name: '放学的小健', look: { shirt: '#e76f51', pants: '#1d3557', hair: '#1b1b1b', skin: '#f1d3b3', tall: 0.78, backpack: '#e63946' }, lines: ['今天的零花钱！', '有新的漫画吗？', '软糖软糖！'], want: ['gummy', 'manga', 'icebar'] },
];
function evRegular() {
  const R = pick(REGULARS);
  if (G.customers.some(c => c.regular === R.id)) return;
  const wants = R.want.filter(id => G.unlocked[PRODUCT_BY_ID[id].cat]).slice(0, 2);
  if (!wants.length) return;
  const c = spawnCustomer({ wants, look: { ...R.look, shoes: '#2b2b2b' }, flags: { regular: R.id } });
  G.regulars = G.regulars || {};
  const n = (G.regulars[R.id] = (G.regulars[R.id] || 0) + 1);
  sayLater(2.5, c, pick(R.lines), 'normal', 3);
  if (n === 1) toast(`🙂 新面孔：${R.name}`);
  else if (n % 5 === 0) { toast(`💝 ${R.name} 第 ${n} 次光临，成了忠实常客！（口碑+）`); G.rep = clamp(G.rep + 0.2, 0, 5); }
}

/* ---- 结账时的事件钩子 ---- */
function onCheckout(c, staff, total) {
  if (c.influencer && c.mood >= 0) {
    G.buzz = 2; G.rep = clamp(G.rep + 0.3, 0, 5);
    say(c, '绝了！这家店我推荐！', 'shout', 3);
    toast('📈 网红发了好评！接下来两天客流 +20%');
  }
  if (c.regular) { const R = REGULARS.find(r => r.id === c.regular); if (R && Math.random() < 0.5) say(c, '谢谢，明天见～'); }
  if (c.drunk) say(c, '嗝…谢了…', 'think', 2.5);
}

/* ---- 醉汉 ---- */
function evDrunk() {
  const wants = G.carried.beer && G.unlocked.drink ? ['beer'] : ['water'];
  const c = spawnCustomer({ wants, look: { ...randomLook(), shirt: '#f1f1ee', collar: '#8b1e3f' }, flags: { drunk: true, wobble: true }, speed: 0.75 });
  sayLater(2, c, '嗝…再来一罐…', 'think', 3);
}

/* ---- 地上的东西 (失物/水渍) ---- */
function dropFloorItem(type) {
  const spots = [[5.6, 4.75], [9.5, 4.75], [7.6, 3.5], [7.6, 5.5], [6.5, 2.95], [10.2, 6.1], [4.6, 6.1]];
  const [x, y] = pick(spots);
  G.floorItems.push({ type, x: x + rand(-0.3, 0.3), y: y + rand(-0.1, 0.1), t: 0 });
  if (type === 'spill') toast('💦 有客人把饮料打翻了，地上湿了');
  if (type === 'wallet') toast('👛 地上好像有人掉了钱包…');
}
function cleanFloorItem(f) {
  const i = G.floorItems.indexOf(f); if (i < 0) return;
  G.floorItems.splice(i, 1);
  if (f.type === 'spill') { const [sx, sy] = proj(f.x, f.y, 0.4); addFloat(sx, sy, '✨ 打扫干净', '#cde7ff'); }
  if (f.type === 'wallet') {
    G.rep = clamp(G.rep + 0.15, 0, 5);
    toast('👛 失主回来找钱包，非常感谢你！（口碑+）');
    const c = G.customers.find(c => c.state === 'pick' || c.state === 'queue');
    if (c) say(c, '太感谢了！！', 'shout', 2.5);
  }
}
function drawFloorEvents() {
  for (const f of G.floorItems || []) {
    if (f.type === 'spill') planeZ(f.x, f.y, 0.016, g => {
      g.fillStyle = MANGA.on ? 'rgba(0,0,0,0.25)' : 'rgba(140,90,40,0.45)';
      g.beginPath(); g.ellipse(0, 0, 38, 24, 0.4, 0, 7); g.ellipse(30, 14, 14, 9, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-8, -6, 12, 4, 0.4, 0, 7); g.fill();
    });
  }
}

/* ---- 员工请假 ---- */
function evSick() {
  const h = Math.floor(G.minute / 60);
  const cand = G.staff.filter(s => s.absentDay !== G.day && !onShift(s, h));
  if (!cand.length) return;
  const st = pick(cand);
  st.absentDay = G.day;
  toast(`🤒 ${st.name}：「店长…我发烧了，今天的${SHIFTS[st.shift].name}请个假…」`);
}

/* ---- 供应商 / 赠品 / 故障 ---- */
function evSupplierSale() {
  const cats = CATEGORIES.filter(c => G.unlocked[c.id]);
  const c = pick(cats);
  for (const p of PRODUCTS_BY_CAT[c.id]) G.costMult[p.id] = r1(G.costMult[p.id] * 0.75 * 100) / 100;
  toast(`🏷️ 供应商促销：今天「${c.name}」进价 75 折！`);
}
function evGift() {
  const ps = PRODUCTS.filter(p => G.unlocked[p.cat] && G.carried[p.id]);
  if (!ps.length) return;
  const p = pick(ps);
  G.inv[p.id].back += p.box;
  toast(`🎁 供应商送了一箱 ${p.emoji}${p.cn}（已放进仓库）`);
}
function evBreakdown() {
  const cost = randInt(60, 150);
  G.money = r1(G.money - cost); G.fin.today.other = r1(G.fin.today.other + cost);
  toast(`🔧 ${pick(['冷柜', '空调', '自动门', '收银机'])}出故障了，修理花了 ${yen(cost)}`);
}

/* ======================= 每帧更新 / 绘制 ======================= */
function updateEvents(adt, dt) {
  updateChatter(adt > 0 ? dt : 0);
  updateCat(adt);
  for (const f of G.floorItems || []) {
    f.t += adt;
    if (f.type === 'spill' && f.t > 120 && !f.claimed) { G.rep = clamp(G.rep - 0.1, 0, 5); cleanFloorItem(f); toast('😣 地上的水渍一直没人管，客人有意见了'); }
    if (f.type === 'wallet' && f.t > 160) { const i = G.floorItems.indexOf(f); if (i >= 0) G.floorItems.splice(i, 1); }
  }
  // 小偷离店判定 / 员工抓小偷
  for (const c of G.customers) {
    if (c.thief && !c.caught && c.state === 'leaving' && c.y > 7.3) thiefEscape(c);
    if (c.thief && !c.caught && c.state === 'leaving' && !c.checked && c.y > 6.0) {
      c.checked = true;
      const watcher = G.staff.find(s => G.staffRT[s.id] && statEff(s, 'service') >= 4);
      if (watcher && Math.random() < 0.5) catchThief(c);
    }
  }
}

function eventItems() {
  const list = [];
  if (G.cat) { const k = G.cat; list.push({ x0: k.x - 0.2, x1: k.x + 0.2, y0: k.y - 0.1, y1: k.y + 0.1, region: 'front', draw: () => drawCat(k) }); }
  for (const f of G.floorItems || []) if (f.type === 'wallet') list.push({
    x0: f.x - 0.1, x1: f.x + 0.1, y0: f.y - 0.07, y1: f.y + 0.07, region: 'in',
    draw: () => { box(f.x - 0.1, f.y - 0.07, 0.01, 0.2, 0.14, 0.05, '#8b1e3f', { amb: AMB_IN }); box(f.x - 0.02, f.y - 0.07, 0.06, 0.04, 0.14, 0.005, '#e9c46a', { amb: AMB_IN }); },
  });
  return list;
}

/* 漫画风对话框 */
function drawBalloon(sx, sy, text, style, alpha) {
  const c = ctx, k = (IS_TOUCH ? clamp(ISO.zoom * 1.2, 0.95, 1.35) : clamp(ISO.zoom, 0.8, 1.3));
  c.save(); c.globalAlpha = alpha;
  c.font = `900 ${Math.round(13 * k)}px ${FONT}`;
  const maxW = 150 * k, words = [...text], lines = [''];
  for (const ch of words) { const t = lines[lines.length - 1] + ch; if (c.measureText(t).width > maxW) lines.push(ch); else lines[lines.length - 1] = t; }
  const lh = 17 * k, w = Math.max(...lines.map(l => c.measureText(l).width)) + 22 * k, h = lines.length * lh + 14 * k;
  const pad = style === 'shout' ? w * 0.18 + 14 : 8, bx = clamp(sx - w * 0.35, pad, ISO.W - w - pad), by = sy - h - 18 * k;
  c.lineWidth = 2.4; c.strokeStyle = '#111'; c.fillStyle = '#fff'; c.lineJoin = 'round';
  if (style === 'shout') {
    // 爆炸形对话框
    const cx = bx + w / 2, cy = by + h / 2, n = 18;
    c.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 1 : 1.18 + (i % 4 === 0 ? 0.08 : 0);
      const px = cx + Math.cos(a) * (w / 2 + 8 * k) * r, py = cy + Math.sin(a) * (h / 2 + 6 * k) * r;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(sx - 6 * k, by + h + 4 * k); c.lineTo(sx, sy - 4 * k); c.lineTo(sx + 6 * k, by + h + 4 * k); c.fill(); c.stroke();
  } else if (style === 'think') {
    c.beginPath(); c.ellipse(bx + w / 2, by + h / 2, w / 2 + 6 * k, h / 2 + 5 * k, 0, 0, 7); c.fill(); c.stroke();
    for (const [dx, dy, r] of [[0.25, 1.2, 5], [0.1, 1.55, 3.2]]) { c.beginPath(); c.arc(sx + dx * (bx + w / 2 - sx), by + h * dy - 2, r * k, 0, 7); c.fill(); c.stroke(); }
  } else {
    const r = 12 * k;
    c.beginPath();
    c.moveTo(bx + r, by); c.arcTo(bx + w, by, bx + w, by + h, r); c.arcTo(bx + w, by + h, bx, by + h, r);
    c.lineTo(Math.min(sx + 8 * k, bx + w - r), by + h); c.lineTo(sx, sy - 4 * k); c.lineTo(Math.max(sx - 4 * k, bx + r), by + h);
    c.arcTo(bx, by + h, bx, by, r); c.arcTo(bx, by, bx + w, by, r); c.closePath();
    c.fill(); c.stroke();
  }
  c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((l, i) => c.fillText(l, bx + w / 2, by + 7 * k + lh * (i + 0.5)));
  c.restore();
}

function drawEventUI() {
  // 可点击的事件物件
  if (G.cat) {
    const k = G.cat, [sx, sy] = proj(k.x, k.y, 0.3);
    G.hits.push({ type: 'event', rects: [[sx - 22, sy - 22, 44, 36]], onClick: petCat });
    if (k.state === 'sit' && !k.petted && Math.sin(G.time * 3) > 0.3) bubble(sx, sy - 10, '🐾', 'rgba(255,255,255,0.9)', '#333', null, 0.8);
  }
  for (const f of G.floorItems || []) {
    const [sx, sy] = proj(f.x, f.y, 0.1);
    G.hits.push({ type: 'event', rects: [[sx - 26, sy - 20, 52, 34]], onClick: () => cleanFloorItem(f) });
    bubble(sx, sy - 6, f.type === 'spill' ? '🧹 擦干净' : '👛 捡起来', f.type === 'spill' ? '#8ecae6' : '#ffd166', '#111', '#111', 0.78);
  }
  for (const c of G.customers) {
    if (c.thief && !c.caught && c.alpha > 0.5 && !c.escaped) {
      const [sx, sy] = proj(c.x, c.y, 2.05);
      bubble(sx, sy, c.got.length ? (Math.sin(G.time * 6) > 0 ? '👀 偷东西了! 点他' : '👀 点他!') : '👀 可疑', '#ffe3e0', '#c1121f', '#e63946');
    }
  }
  // 对话框
  for (const t of G.talks) {
    const p = t.p; if (p.alpha != null && p.alpha < 0.3) continue;
    const z = p === G.cat ? 0.6 : (p.sit ? 2.0 : 2.15);
    const [sx, sy] = proj(p.x, p.y, z);
    const a = clamp(Math.min(t.t / 0.15, (t.dur - t.t) / 0.3), 0, 1);
    drawBalloon(sx, sy - (G.customers.includes(p) ? 18 : 0), t.text, t.style, a);
  }
}
