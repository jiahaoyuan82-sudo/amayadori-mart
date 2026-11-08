'use strict';
/* =========================================================
 * ui.js — HUD / 菜单弹窗 / 存档系统 / 新手引导 / 启动
 * ========================================================= */

const $ = id => document.getElementById(id);
const TUTORIAL_KEY = 'amayadori-tutorial-seen';
function setBtn(id, icon, label) { const b = $(id); b.querySelector('i').textContent = icon; b.querySelector('span').textContent = label; }

/* ---------------- HUD ---------------- */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHUD() {
  if (!G.started) return;
  const m = Math.floor(G.minute), hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
  setText('clock', `${hh}:${mm}`);
  const W = WEATHER[todayWx().type];
  const icon = G.rain > 0.3 ? (G.snow ? '❄️' : '☔') : W.rain > 0.3 ? '☁️' : nightness(m / 60) > 0.5 ? '🌙' : W.icon;
  setText('day', `${dateLabel(G.day)} ${icon} ${Math.round(G.temp ?? 15)}°`);
  setText('money', yen(G.money).replace('¥', ''));
  const full = Math.round(G.rep * 2) / 2;
  setText('rep', '★'.repeat(Math.floor(full)) + (full % 1 ? '☆' : '') + '·'.repeat(5 - Math.ceil(full)) + ` ${G.rep.toFixed(1)}`);
  setText('today', `今日 ${G.todayCustomers} 人 · ${yen(G.fin.today.sales)}`);
  const lowCats = CATEGORIES.filter(c => G.unlocked[c.id] && catState(c.id).empty).length;
  $('btn-order').classList.toggle('alert', lowCats > 0 && G.orders.length === 0);
}

/* ---------------- 工具栏 ---------------- */
function togglePause(force) {
  G.paused = force == null ? !G.paused : force;
  setBtn('btn-pause', G.paused ? '▶' : '⏸', G.paused ? '继续' : '暂停');
  $('btn-pause').classList.toggle('on', G.paused);
}
function toggleRoof() { G.cutTarget = G.cutTarget > 0.5 ? 0 : 1; $('btn-roof').classList.toggle('on', G.cutTarget < 0.5); }
function toggleSpeed() {
  G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1;
  setBtn('btn-speed', G.speed === 1 ? '▶' : G.speed === 2 ? '⏩' : '⏭', `${G.speed}倍速`);
  $('btn-speed').classList.toggle('on', G.speed > 1);
}
function manualSave() {
  if (save()) toast('💾 已保存'); else toast('⚠️ 保存失败：浏览器禁止了本地存储（可能是无痕模式）');
}
$('btn-pause').onclick = () => { Sound.click(); togglePause(); };
$('btn-speed').onclick = () => { Sound.click(); toggleSpeed(); };
$('btn-order').onclick = () => { Sound.click(); openPanel('order'); };
$('btn-staff').onclick = () => { Sound.click(); openPanel('staff'); };
$('btn-fin').onclick = () => { Sound.click(); openPanel('fin'); };
$('btn-weather').onclick = () => { Sound.click(); openPanel('weather'); };
$('btn-menu').onclick = () => { Sound.click(); showMenu(); };

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('modal').classList.contains('hidden')) closeModal(); else if (G.started) showMenu(); return; }
  if (!G.started || !$('modal').classList.contains('hidden')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  if (e.key === 'r' || e.key === 'R') toggleRoof();
  const k = { '1': 'order', '2': 'staff', '3': 'fin', '4': 'weather' }[e.key];
  if (k) openPanel(k);
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); manualSave(); }
});

/* ---------------- 弹窗 ---------------- */
let modalPrevPause = null;
function openModal(html, cls) {
  if (typeof P !== 'undefined') P.active = false;
  $('modal-body').className = 'sheet' + (cls ? ' ' + cls : '');
  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
  if (G.started && modalPrevPause === null) { modalPrevPause = G.paused; G.paused = true; }
  return $('modal-body');
}
function closeModal() {
  if (typeof P !== 'undefined') P.active = false;
  $('modal').classList.add('hidden');
  if (modalPrevPause !== null) { G.paused = modalPrevPause; modalPrevPause = null; }
}
$('modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
function on(b, a, fn) { const el = b.querySelector(`[data-a="${a}"]`); if (el) el.onclick = () => { Sound.click(); fn(); }; }

function confirmBox(title, msg, okText, onOk, danger, onCancel) {
  const b = openModal(`
    <h2>${title}</h2><p>${msg}</p>
    <div class="row"><button data-a="no">取消</button><button data-a="ok" class="${danger ? 'danger' : 'primary'}">${okText}</button></div>`);
  on(b, 'no', onCancel || closeModal);
  on(b, 'ok', () => { closeModal(); onOk(); });
}

function showMenu() {
  const b = openModal(`
    <h2>☰ 菜单</h2>
    <div class="grid">
      <button data-a="resume" class="primary wide">▶ 继续游戏</button>
      <button data-a="save">💾 立即保存</button>
      <button data-a="sound">${Sound.muted ? '🔇 声音：关' : '🔊 声音：开'}</button>
      <button data-a="roof">🏠 ${G.cutTarget > 0.5 ? '盖上屋顶' : '掀开屋顶'}</button>
      <button data-a="view">⌖ 重置视角</button>
      <button data-a="manga" class="wide">🎨 画风：${MANGA.on ? '漫画风（点我切回普通）' : '普通（点我试试漫画风）'}</button>
      <button data-a="help" class="wide">❓ 玩法说明</button>
      <button data-a="export">📤 导出存档码</button>
      <button data-a="import">📥 导入存档码</button>
      <button data-a="title" class="wide">🏠 保存并回到标题</button>
    </div>
    <p class="note">进度每 10 秒自动保存在本机浏览器里。<br>换手机或电脑时，用「导出存档码」把进度带过去。</p>`);
  on(b, 'resume', closeModal);
  on(b, 'save', () => { closeModal(); manualSave(); });
  on(b, 'sound', () => { Sound.setMuted(!Sound.muted); showMenuKeepPause(); });
  on(b, 'roof', () => { toggleRoof(); closeModal(); });
  on(b, 'help', () => showHelp(false));
  on(b, 'manga', () => { setManga(!MANGA.on); showMenu(); });
  on(b, 'view', () => { closeModal(); animateView(VIEW_GAME(), 0.8); });
  on(b, 'export', showExport);
  on(b, 'import', showImport);
  on(b, 'title', () => { save(); location.reload(); });
}
function showMenuKeepPause() { showMenu(); }

function showHelp(first) {
  const b = openModal(`
    <h2>🏪 怎么玩</h2>
    <ol class="tut">
      <li><span>📦</span><div><b>进货 → 仓库</b>在「进货」里按箱订货，送货车送到后放进仓库。还能调售价、解锁新类别。</div></li>
      <li><span>⬆</span><div><b>点货架 = 上架</b>货架牌子出现 ⬆ 说明仓库有货可以上架；变<em class="o">橙</em>/<em class="r">红</em>就是快卖完了。</div></li>
      <li><span>💴</span><div><b>点客人 = 结账</b>收银台前客人头上出现 💴 时点他收钱。雇了收银员就会自动结账。</div></li>
      <li><span>👥</span><div><b>招人帮忙</b>「人员」里看简历招人，安排早/晚/夜班。补货员会自动上架。</div></li>
      <li><span>🌤</span><div><b>看天气备货</b>下雨卖伞、天冷卖关东煮、天热卖冰。预报和客流预测不一定准！</div></li>
      <li><span>👆</span><div><b>${IS_TOUCH ? '单指拖动 · 双指缩放' : '拖动平移 · 滚轮缩放'}</b>${IS_TOUCH ? '' : '空格暂停，1~4 打开面板，R 屋顶，Ctrl+S 保存。'}</div></li>
    </ol>
    <div class="row"><button data-a="ok" class="primary">${first ? '开始营业！' : '知道了'}</button></div>`);
  on(b, 'ok', () => { closeModal(); try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) { } });
}

/* ---------------- 存档 ---------------- */
function snapshot() {
  return {
    v: 3, money: G.money, rep: G.rep, day: G.day, minute: G.minute, served: G.served, todayCustomers: G.todayCustomers,
    inv: G.inv, price: G.price, carried: G.carried, costMult: G.costMult, unlocked: G.unlocked,
    orders: G.orders.map(o => ({ pid: o.pid, qty: o.qty, eta: o.eta })), staff: G.staff, candidates: G.candidates, nextId: G.nextId,
    wx: G.wx, fin: G.fin, todayTarget: G.todayTarget, rainTarget: G.rainTarget, snow: G.snow, savedAt: Date.now(),
    vend: G.vend, regulars: G.regulars, buzz: G.buzz,
  };
}
function sanitize(d) {
  if (!d || typeof d !== 'object' || d.v !== 3 || !Number.isFinite(d.money) || !d.inv || !d.wx || !d.fin) throw new Error('bad');
  const num = (v, a, b, def) => Number.isFinite(v) ? clamp(v, a, b) : def;
  const inv = {}, price = {}, carried = {}, costMult = {};
  for (const p of PRODUCTS) {
    const i = d.inv[p.id] || {};
    inv[p.id] = { shelf: Math.round(num(i.shelf, 0, SHELF_CAP, 0)), back: Math.round(num(i.back, 0, 1e5, 0)) };
    price[p.id] = Math.round(num(d.price && d.price[p.id], 10, 1e5, p.price));
    carried[p.id] = !!(d.carried && d.carried[p.id]);
    costMult[p.id] = num(d.costMult && d.costMult[p.id], 0.5, 2, 1);
  }
  const unlocked = {};
  for (const c of CATEGORIES) unlocked[c.id] = !c.unlock || !!(d.unlocked && d.unlocked[c.id]);
  return {
    money: Math.round(num(d.money, -1e9, 1e12, START_MONEY)), rep: num(d.rep, 0, 5, 3),
    day: Math.round(num(d.day, 1, 1e6, 1)), minute: num(d.minute, 0, 1439.9, 7 * 60),
    served: Math.round(num(d.served, 0, 1e9, 0)), todayCustomers: Math.round(num(d.todayCustomers, 0, 1e9, 0)),
    inv, price, carried, costMult, unlocked,
    orders: Array.isArray(d.orders) ? d.orders.filter(o => PRODUCT_BY_ID[o.pid]) : [],
    staff: Array.isArray(d.staff) ? d.staff : [], candidates: Array.isArray(d.candidates) ? d.candidates : [],
    nextId: Math.round(num(d.nextId, 1, 1e9, 1000)), wx: d.wx, fin: d.fin,
    todayTarget: num(d.todayTarget, 0, 1e4, 80), rainTarget: num(d.rainTarget, 0, 1, 0), snow: !!d.snow,
    vend: VEND_DEFS.map((v, i) => { const s = (d.vend || [])[i] || {}; return { stock: Math.round(num(s.stock, 0, v.cap, 20)), price: num(s.price, 0.5, 100, v.price), cap: v.cap, sold: Math.round(num(s.sold, 0, 1e6, 0)) }; }),
    regulars: d.regulars && typeof d.regulars === 'object' ? d.regulars : {}, buzz: Math.round(num(d.buzz, 0, 9, 0)),
  };
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); return true; }
  catch (e) { return false; }
}
function loadSave() {
  try { return sanitize(JSON.parse(localStorage.getItem(SAVE_KEY))); }
  catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

function encodeSave(d) { const x = { ...d, candidates: [], fin: { today: d.fin.today, history: d.fin.history.slice(-14) } }; return 'AMA3-' + btoa(unescape(encodeURIComponent(JSON.stringify(x)))); }
function decodeSave(code) {
  code = (code || '').replace(/\s+/g, '');
  if (!code.startsWith('AMA3-')) throw new Error('prefix');
  return sanitize(JSON.parse(decodeURIComponent(escape(atob(code.slice(5))))));
}

function showExport() {
  if (G.started) save();
  const d = G.started ? snapshot() : loadSave();
  if (!d) { toast('还没有存档可以导出'); return; }
  const code = encodeSave(d);
  const b = openModal(`
    <h2>📤 导出存档码</h2>
    <p>复制下面这段文字，在另一台设备打开游戏 →「导入存档码」粘贴，就能接着玩。</p>
    <textarea id="code-out" readonly>${code}</textarea>
    <div class="row"><button data-a="back">返回</button><button data-a="copy" class="primary">📋 复制</button></div>`);
  on(b, 'back', G.started ? showMenu : closeModal);
  on(b, 'copy', () => {
    const ta = $('code-out');
    const done = () => toast('✅ 已复制存档码');
    const fallback = () => { ta.focus(); ta.select(); ta.setSelectionRange(0, 99999); try { document.execCommand('copy'); done(); } catch (e) { toast('请长按文本框手动复制'); } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
  });
}

function showImport() {
  const b = openModal(`
    <h2>📥 导入存档码</h2>
    <p>把以 <code>AMA3-</code> 开头的存档码粘贴到这里。</p>
    <textarea id="code-in" placeholder="AMA3-..."></textarea>
    <div class="row"><button data-a="back">返回</button><button data-a="go" class="primary">导入</button></div>`);
  on(b, 'back', G.started ? showMenu : closeModal);
  on(b, 'go', () => {
    let d;
    try { d = decodeSave($('code-in').value); } catch (e) { toast('❌ 存档码无效，请检查是否复制完整'); return; }
    confirmBox('导入存档', `将读取：<b>第 ${d.day} 天 · ¥${d.money.toLocaleString()}</b><br>当前进度会被覆盖，确定吗？`, '导入', () => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { }
      if (G.started) { applySave(d); toast('✅ 存档已导入'); }
      else startGame(d);
    }, true);
  });
}

function applySave(d) {
  Object.assign(G, d);
  G.customers = []; G.queue = []; G.staffRT = {}; G.trucks = []; G.floorItems = []; G.cat = null; G.talks = [];
  for (const v of G.vend) v.sold = 0;
  G.lastHour = Math.floor(G.minute / 60);
  if (!G.candidates.length) for (let i = 0; i < 5; i++) G.candidates.push(genApplicant());
  ensureWeather();
  for (let dd = G.day; dd <= G.day + 14; dd++) if (!G.wx[dd].f) G.wx[dd].f = makeForecast(dd, dd - G.day);
  if (!G.wx[G.day].f0) G.wx[G.day].f0 = { ...G.wx[G.day].f };
  if (!G.fin.today || G.fin.today.day !== G.day) G.fin.today = newFinDay();
  G.temp = tempNow();
}

/* ---------------- 标题 / 启动 ---------------- */
function refreshTitle() {
  const d = loadSave();
  const btn = $('btn-continue');
  if (d) {
    btn.classList.remove('hidden');
    btn.innerHTML = `继续上次<small>第 ${d.day} 天 · ¥${d.money.toLocaleString()}</small>`;
  } else btn.classList.add('hidden');
}

function startGame(data) {
  Sound.init();
  if (data) applySave(data);
  else { clearSave(); initEconomy(); startDay(); G.temp = tempNow(); }
  G.lastHour = Math.floor(G.minute / 60);
  G.started = true; G.cutTarget = 1; G.spawnT = 1.5;
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  animateView(VIEW_GAME());
  save();
  let seen = false;
  try { seen = !!localStorage.getItem(TUTORIAL_KEY); } catch (e) { }
  if (!seen) setTimeout(() => showHelp(true), 900);
  else toast(data ? `おかえりなさい！第 ${G.day} 天继续营业` : 'いらっしゃいませ！开店营业');
}

$('btn-start').onclick = () => {
  const d = loadSave();
  if (d) confirmBox('开始新游戏？', `已有存档：<b>第 ${d.day} 天 · ¥${d.money.toLocaleString()}</b><br>开始新游戏会<b>覆盖</b>这个存档。`, '覆盖并开始', () => startGame(null), true);
  else startGame(null);
};
$('btn-continue').onclick = () => { const d = loadSave(); if (d) startGame(d); };
$('btn-import-title').onclick = () => showImport();
refreshTitle();

// 切到后台 / 锁屏: 自动保存并暂停 (手机上很重要)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.started) { save(); if (!G.paused && modalPrevPause === null) togglePause(true); }
});
window.addEventListener('pagehide', () => { if (G.started) save(); });

/* ---------------- 画风切换 ---------------- */
function setManga(on) {
  MANGA.on = on; MANGA.pats = {};
  document.body.classList.toggle('manga', on);
  canvas.style.filter = on ? 'grayscale(1) contrast(1.2)' : '';
  try { localStorage.setItem('amayadori-style', on ? 'manga' : 'normal'); } catch (e) { }
}
try { if (localStorage.getItem('amayadori-style') === 'manga') setManga(true); } catch (e) { }

/* ---------------- 主循环 ---------------- */
initEconomy();   // 标题画面也要有货架内容
G.minute = 21 * 60; G.rainTarget = 1;
window.addEventListener('resize', resize);
resize();
computeLight();
for (let i = 0; i < 3; i++) spawnPasser();
G.passers.forEach((p, i) => { p.x = 2 + i * 5; });
spawnCar();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  updateHUD();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
