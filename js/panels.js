'use strict';
/* =========================================================
 * panels.js — 进货 / 人员 / 财报 / 天气 面板
 * ========================================================= */

const P = { active: false, name: null, tab: null, sub: null };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function openPanel(name, tab) {
  P.name = name;
  P.tab = tab || P.tabs?.[name] || defaultTab(name);
  P.sub = null;
  renderPanel(true);
}
function defaultTab(name) { return { order: 'rice', staff: 'crew', fin: 'today', weather: 'list', news: 'today', shelf: 'overview' }[name]; }
const fmt = n => yen(n);
P.tabs = {};

function renderPanel(first) {
  const body = $('modal-body');
  const old = body.querySelector('.pbody');
  const scroll = !first && old ? old.scrollTop : 0;
  const html = ({ order: orderHTML, staff: staffHTML, fin: finHTML, weather: weatherHTML, news: newsHTML, shelf: shelfHTML })[P.name]();
  openModal(html, 'big');
  P.active = true;
  P.tabs[P.name] = P.tab;
  const nb = body.querySelector('.pbody');
  if (nb) nb.scrollTop = scroll;
  setupTabs(body, first);
}

/* 标签栏: 左右箭头 + 滚轮横向滚动 + 鼠标拖动 */
function setupTabs(root, first) {
  for (const wrap of root.querySelectorAll('.tabwrap')) {
    const t = wrap.querySelector('.tabs');
    const upd = () => {
      wrap.classList.toggle('can-l', t.scrollLeft > 4);
      wrap.classList.toggle('can-r', t.scrollLeft + t.clientWidth < t.scrollWidth - 4);
    };
    if (P.tabScroll != null && !first) t.scrollLeft = P.tabScroll;
    else { const on = t.querySelector('.on'); if (on) t.scrollLeft = Math.max(0, on.offsetLeft - t.clientWidth / 2 + on.offsetWidth / 2); }
    upd();
    t.addEventListener('scroll', () => { P.tabScroll = t.scrollLeft; upd(); });
    t.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { t.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let drag = null;
    t.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') drag = { x: e.clientX, s: t.scrollLeft, moved: false }; });
    t.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) { drag.moved = true; t.classList.add('dragging'); } t.scrollLeft = drag.s - dx; });
    const end = () => { if (drag && drag.moved) P.tabDragged = performance.now(); drag = null; t.classList.remove('dragging'); };
    t.addEventListener('pointerup', end); t.addEventListener('pointerleave', end);
  }
}

function head(title) {
  return `<div class="ph"><h2>${title}</h2><div class="pmoney">💰 ${yen(G.money)}</div><button class="x" data-p="close" aria-label="关闭">✕</button></div>`;
}
function tabs(list) {
  return `<div class="tabwrap"><button class="tarrow l" data-tscroll="-1" aria-label="向左">‹</button><div class="tabs">${list.map(([id, label]) => `<button class="${P.tab === id ? 'on' : ''}" data-p="tab:${id}">${label}</button>`).join('')}</div><button class="tarrow r" data-tscroll="1" aria-label="向右">›</button></div>`;
}
function stars(n, max = 5) { return '<span class="stars">' + '★'.repeat(n) + '<i>' + '★'.repeat(Math.max(0, max - n)) + '</i></span>'; }
function bar(v, max, cls = '') { return `<span class="bar ${cls}"><span style="width:${clamp(v / max * 100, 0, 100)}%"></span></span>`; }

/* ======================= 进货 ======================= */
function vendHTML() {
  return '<div class="plist">' + VEND_DEFS.map((d, i) => {
    const vm = G.vend[i], need = vm.cap - vm.stock, cost = r1(need * d.cost);
    return `<div class="pcard vcard">
      <div class="pe"><span class="vchip" style="background:${d.color}"></span></div>
      <div class="pinfo">
        <b>${d.name}</b> <small>${d.brand}</small>
        <div class="pmeta">每罐进价 ¥${d.cost} · 建议价 ¥${d.price} · 今天卖出 <b>${vm.sold || 0}</b> 罐</div>
        <div class="pstock"><span>库存 <b>${vm.stock}</b>/${vm.cap}</span>${bar(vm.stock, vm.cap, vm.stock < 8 ? '' : 'teal')}</div>
      </div>
      <div class="pctl">
        <div class="price"><button data-p="vprice:${i}:-0.5">−</button><span>${fmt(vm.price)}</span><button data-p="vprice:${i}:0.5">＋</button></div>
        <div class="margin">${d.hot ? '天冷好卖' : d.cold ? '天热好卖' : '四季都卖'}</div>
        <button class="primary sm" data-p="vfill:${i}" ${need <= 0 || G.money < cost ? 'disabled' : ''}>补满 ×${need}<small>${fmt(cost)}</small></button>
      </div>
    </div>`;
  }).join('') + `</div><p class="note">🥫 自动贩卖机不用店员，路过的人会顺手买一罐，收入算进「贩卖机」。卖空了记得补货！价格定太高会没人买。</p>`;
}

function orderHTML() {
  const t = P.tab, C = CAT_BY_ID[t];
  let body = '';
  if (t === 'vend') body = vendHTML();
  else if (!G.unlocked[t]) {
    body = `<div class="lockcard"><div class="big">${C.emoji}</div><h3>${C.name} <small>${C.jp}</small></h3><p>${C.desc || ''}</p>
      <p class="muted">解锁后可以进货：${PRODUCTS_BY_CAT[t].map(p => p.emoji + ' ' + p.cn).join('、')}</p>
      <button class="primary" data-p="unlock:${t}" ${G.money < C.unlock ? 'disabled' : ''}>🔓 解锁 ${fmt(C.unlock)}</button></div>`;
  } else {
    body = '<div class="plist">' + PRODUCTS_BY_CAT[t].map(p => {
      const inv = G.inv[p.id], cost = costOf(p.id), base = p.cost, ch = Math.round((cost / base - 1) * 100);
      const pr = G.price[p.id], ratio = pr / p.price, margin = Math.round((pr - cost) / pr * 100), boxCost = r1(cost * p.box);
      const tag = ratio > 1.15 ? '<em class="bad">偏贵</em>' : ratio < 0.9 ? '<em class="good">便宜</em>' : '';
      const inc = incoming(p.id);
      return `<div class="pcard ${G.carried[p.id] ? '' : 'dim'}">
        <div class="pe">${p.emoji}</div>
        <div class="pinfo">
          <b>${esc(p.name)}</b> <small>${esc(p.cn)}</small>${G.carried[p.id] ? '' : ' <em class="new">未上架</em>'}
          <div class="pmeta">进价 ${fmt(cost)} ${ch ? `<i class="${ch > 0 ? 'up' : 'down'}">${ch > 0 ? '↑' : '↓'}${Math.abs(ch)}%</i>` : ''} · 建议价 ${fmt(p.price)}</div>
          <div class="pstock"><span>陈列 <b>${facings(p.id)}</b> 格</span><span>货架 <b>${inv.shelf}</b>/${shelfCap(p.id)}</span><span>仓库 <b>${inv.back}</b></span>${inc ? `<span class="inc">🚚 ${inc}</span>` : ''}${G.carried[p.id] && !displayed(p.id) ? `<button class="sm warnbtn" data-p="place:${p.id}">⚠️ 未陈列 · 摆上</button>` : ''}</div>
        </div>
        <div class="pctl">
          <div class="price"><button data-p="price:${p.id}:-0.5">−</button><span>${fmt(pr)}</span><button data-p="price:${p.id}:0.5">＋</button></div>
          <div class="margin">毛利 ${margin}% ${tag}</div>
          <button class="primary sm" data-p="order:${p.id}:1" ${G.money < boxCost ? 'disabled' : ''}>订 1 箱 ×${p.box}<small>${fmt(boxCost)}</small></button>
        </div>
      </div>`;
    }).join('') + '</div>';
  }
  const inc = G.orders.reduce((s, o) => s + o.qty, 0);
  const eta = G.orders.length ? Math.min(...G.orders.map(o => o.eta)) - absMin() : 0;
  const [n, est] = smartOrderEstimate();
  return head('📦 进货') +
    tabs([...CATEGORIES.map(c => [c.id, `${G.unlocked[c.id] ? c.emoji : '🔒'} ${c.name}`]), ['vend', '🥫 贩卖机']]) +
    `<div class="pbody">${body}</div>
     <div class="pfoot">
       <div class="muted">${inc ? `🚚 在途 ${inc} 件 · 约 ${Math.max(5, Math.round(eta))} 分钟后到` : '下单后约 40～80 分钟送到仓库，再点货架上架'}</div>
       <div class="row">
         <button data-p="smart" ${n ? '' : 'disabled'}>⚡ 一键补单${n ? `（${n} 箱 ${yen(est)}）` : ''}</button>
         <button data-p="shelveall">⬆ 全部上架</button>
       </div>
     </div>`;
}

/* ======================= 人员 ======================= */
function staffHTML() {
  if (P.sub) return resumeHTML(P.sub);
  const h = Math.floor(G.minute / 60);
  let body;
  if (P.tab === 'crew') {
    body = G.staff.length ? G.staff.map(st => {
      const on = onShift(st, h);
      return `<div class="scard">
        <img src="${portraitURL(st)}" alt="">
        <div class="sinfo">
          <div class="sname"><b>${esc(st.name)}</b> <small>${st.age}岁 · ${st.nationality ? st.nationality + '·' : ''}${st.typeName}</small> <span class="dot ${on ? 'on' : ''}">${on ? '上班中' : '休息'}</span></div>
          <div class="chips">${st.traits.map(t => `<span class="chip" title="${esc(TRAIT_BY_ID[t].desc)}">${TRAIT_BY_ID[t].name}</span>`).join('')}</div>
          <div class="stats">${Object.entries(STAT_NAMES).map(([k, n]) => `<label>${n}${bar(st.stats[k], 5)}</label>`).join('')}</div>
          <div class="seg"><span>班次</span>${Object.entries(SHIFTS).map(([k, s]) => `<button class="${st.shift === k ? 'on' : ''}" data-p="shift:${st.id}:${k}">${s.name}</button>`).join('')}</div>
          <div class="seg"><span>岗位</span>${[['auto', '自动'], ['cashier', '收银'], ['stock', '补货']].map(([k, n]) => `<button class="${st.role === k ? 'on' : ''}" data-p="role:${st.id}:${k}">${n}</button>`).join('')}</div>
          <div class="sfoot"><span>时薪 <b>${fmt(st.wage)}</b>${st.shift === 'night' ? ` <small>夜班 ×${NIGHT_RATE} = ${fmt(st.wage * NIGHT_RATE)}</small>` : ''}</span>
            <span><button class="sm" data-p="resume:${st.id}">📄 简历</button> <button class="sm danger" data-p="fire:${st.id}">解雇</button></span></div>
        </div>
      </div>`;
    }).join('') : `<div class="empty">🧍 还没有员工，现在是你一个人在看店。<br>去「招聘」看看今天有谁来应聘吧！</div>`;
    body += `<p class="note">💡 收银员会自动给客人结账；补货员会自动上架、打扫地面。工资按小时结算：时薪最低 ¥20，夜班（22:00-6:00）×1.5，周末每小时 +¥2。</p>`;
  } else {
    body = `<div class="adbar"><span>📋 每天早上会有新的应聘者。今天有 <b>${G.candidates.length}</b> 人投了简历。</span><button data-p="ad" ${G.money < 80 ? 'disabled' : ''}>📢 发招聘广告 ¥80</button></div>`;
    body += G.candidates.map(c => `<div class="scard cand">
        <img src="${portraitURL(c)}" alt="">
        <div class="sinfo">
          <div class="sname"><b>${esc(c.name)}</b> <small>${c.age}岁 · ${c.gender === 'm' ? '男' : '女'} · ${c.nationality ? c.nationality + '·' : ''}${c.typeName}</small></div>
          <div class="chips">${c.traits.map(t => `<span class="chip">${TRAIT_BY_ID[t].name}<i>${TRAIT_BY_ID[t].jp}</i></span>`).join('')}</div>
          <div class="mini">${Object.entries(STAT_NAMES).map(([k, n]) => `<span>${n} ${stars(c.stats[k])}</span>`).join('')}</div>
          <div class="sfoot"><span>希望 <b>${SHIFTS[c.shift].name}</b> · 时薪 <b>${fmt(c.wage)}</b></span>
            <span><button class="sm" data-p="resume:${c.id}">📄 简历</button> <button class="sm primary" data-p="hire:${c.id}" ${G.staff.length >= MAX_STAFF ? 'disabled' : ''}>录用</button></span></div>
        </div>
      </div>`).join('') || '<div class="empty">今天没有人来应聘了…明天再看看吧</div>';
  }
  return head('👥 人员管理') + tabs([['crew', `在职员工 ${G.staff.length}/${MAX_STAFF}`], ['hire', `招聘 (${G.candidates.length})`]]) + `<div class="pbody">${body}</div>`;
}

function findPerson(id) { return G.staff.find(s => s.id === id) || G.candidates.find(s => s.id === id); }
function resumeHTML(id) {
  const c = findPerson(id);
  if (!c) { P.sub = null; return staffHTML(); }
  const hired = G.staff.includes(c), R = c.resume, d = dateOf(c.hiredDay || G.day);
  const birthY = 2026 - c.age;
  return head('📄 履歴書') + `<div class="pbody"><div class="resume">
    <div class="rhead"><div class="rtitle">履 歴 書 <small>简历</small></div><div class="rdate">${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 现在</div></div>
    <div class="rtop">
      <table>
        <tr><th>姓名</th><td class="nm">${esc(c.name)}</td></tr>
        <tr><th>出生</th><td>${birthY}年生（${c.age}岁） · ${c.gender === 'm' ? '男' : '女'}</td></tr>
        <tr><th>现住址</th><td>${R.area}</td></tr>
        ${c.nationality ? `<tr><th>国籍</th><td>${c.nationality}</td></tr>` : ''}
        <tr><th>身份</th><td>${c.typeName}</td></tr>
      </table>
      <img src="${portraitURL(c)}" alt="照片">
    </div>
    <table class="rt">
      <tr><th colspan="2">学历</th></tr>
      ${R.school.map(s => `<tr><td colspan="2">${esc(s)}</td></tr>`).join('')}
      <tr><th colspan="2">工作经历</th></tr>
      ${R.jobs.length ? R.jobs.map(j => `<tr><td>${esc(j.t)}</td><td class="r">${j.y} 年</td></tr>`).join('') : '<tr><td colspan="2">无</td></tr>'}
      <tr><th colspan="2">资格证书</th></tr>
      <tr><td colspan="2">${R.license.join('、')}</td></tr>
    </table>
    <div class="rbox"><b>兴趣爱好</b>${R.hobbies.join('、')}</div>
    <div class="rbox"><b>应聘动机</b>${esc(R.motive)}</div>
    <div class="rbox"><b>自我推荐</b>「${esc(R.pr)}」</div>
    <div class="rbox"><b>希望条件</b>${SHIFTS[c.shift].name}（${SHIFTS[c.shift].time}） · ${R.days} · 时薪 ${fmt(c.wage)}</div>
    <div class="rbox memo"><b>📝 店长面试笔记</b>
      ${c.traits.map(t => `<div><span class="chip">${TRAIT_BY_ID[t].name}<i>${TRAIT_BY_ID[t].jp}</i></span> ${TRAIT_BY_ID[t].desc}</div>`).join('')}
      <div class="stats wide">${Object.entries(STAT_NAMES).map(([k, n]) => `<label>${n}${bar(c.stats[k], 5)}<i>${c.stats[k]}</i></label>`).join('')}</div>
    </div>
  </div></div>
  <div class="pfoot"><div class="row">
    <button data-p="back">← 返回</button>
    ${hired ? `<button class="danger" data-p="fire:${c.id}">解雇</button>` : `<button class="primary" data-p="hire:${c.id}" ${G.staff.length >= MAX_STAFF ? 'disabled' : ''}>✅ 录用</button>`}
  </div></div>`;
}

/* ======================= 财报 ======================= */
function finHTML() {
  const T = G.fin.today, profit = d => d.sales + (d.vend || 0) - d.purchase - d.wages - d.other;
  let body = '';
  if (P.tab === 'today') {
    const p = profit(T), avg = T.buyers ? r1(T.sales / T.buyers) : 0;
    body = `<div class="kpis">
      <div class="kpi"><small>营业额</small><b>${yen(T.sales + (T.vend || 0))}</b></div>
      <div class="kpi"><small>净利润</small><b class="${p >= 0 ? 'good' : 'bad'}">${yen(p)}</b></div>
      <div class="kpi"><small>来客数</small><b>${G.todayCustomers}</b><i>早上预测 ${T.fcTraffic || '—'} 人</i></div>
      <div class="kpi"><small>客单价</small><b>${yen(avg)}</b><i>购买 ${T.buyers} 人</i></div>
    </div>
    <table class="ftable">
      <tr><th>收入</th><td></td></tr>
      <tr><td>商品销售</td><td class="r good">${yen(T.sales)}</td></tr>
      <tr><td>自动贩卖机</td><td class="r good">${yen(T.vend || 0)}</td></tr>
      <tr><th>支出</th><td></td></tr>
      <tr><td>进货</td><td class="r bad">${yen(-T.purchase)}</td></tr>
      <tr><td>员工工资</td><td class="r bad">${yen(-T.wages)}</td></tr>
      <tr><td>解锁 / 广告</td><td class="r bad">${yen(-T.other)}</td></tr>
      <tr class="sum"><td>今日合计</td><td class="r ${p >= 0 ? 'good' : 'bad'}">${yen(p)}</td></tr>
    </table>
    <div class="losses"><b>⚠️ 错失的生意</b>
      <span>缺货 <b>${T.lostStock}</b> 次</span><span>嫌贵没买 <b>${T.lostPrice}</b> 次</span><span>店里太挤走掉 <b>${T.crowded || 0}</b> 人</span><span>约损失 <b>${yen(T.lostValue)}</b></span></div>
    <p class="note">提示：进货支出算在下单当天，所以大量进货的日子利润会偏低。</p>`;
  } else if (P.tab === 'trend') {
    const days = [...G.fin.history.slice(-13), { ...T, customers: G.todayCustomers, partial: true }];
    const max = Math.max(1, ...days.map(d => Math.max(d.sales + (d.vend || 0), d.purchase + d.wages + d.other)));
    body = `<div class="chart">${days.map(d => {
      const cost = d.purchase + d.wages + d.other;
      return `<div class="col ${d.partial ? 'partial' : ''}" title="${dateLabel(d.day)}">
        <div class="bars"><span class="s" style="height:${(d.sales + (d.vend || 0)) / max * 100}%"></span><span class="c" style="height:${cost / max * 100}%"></span></div>
        <small>${dateLabel(d.day).replace(/\(.\)/, '')}</small></div>`;
    }).join('')}</div>
    <div class="legend"><span class="s"></span>营业额 <span class="c"></span>支出</div>
    <table class="ftable small"><tr><th>日期</th><th>天气</th><th class="r">客流 预测/实际</th><th class="r">营业额</th><th class="r">利润</th></tr>
    ${days.slice().reverse().map(d => `<tr><td>${dateLabel(d.day)}${d.partial ? ' <small>今天</small>' : ''}</td><td>${WEATHER[d.weather].icon}${d.event ? EVENTS.find(e => e.id === d.event)?.icon || '' : ''}</td>
      <td class="r">${d.fcTraffic || '—'} / <b>${d.customers}</b></td><td class="r">${yen(d.sales)}</td><td class="r ${profit(d) >= 0 ? 'good' : 'bad'}">${yen(profit(d))}</td></tr>`).join('')}</table>`;
  } else {
    const week = {}, rev = {};
    for (const d of [...G.fin.history.slice(-6), T]) for (const [k, v] of Object.entries(d.items)) { week[k] = (week[k] || 0) + v; rev[k] = (rev[k] || 0) + (d.revenueBy[k] || 0); }
    const rows = Object.entries(week).sort((a, b) => rev[b[0]] - rev[a[0]]);
    const max = Math.max(1, ...rows.map(r => rev[r[0]]));
    body = rows.length ? `<p class="muted">最近 7 天（含今天）的商品销售排行</p><div class="rank">${rows.map(([id, n], i) => {
      const p = PRODUCT_BY_ID[id];
      return `<div class="rk"><span class="no">${i + 1}</span><span class="e">${p.emoji}</span><span class="n">${esc(p.name)}<small>${p.cn}</small></span>${bar(rev[id], max, 'teal')}<span class="v">${n} 个<br><b>${yen(rev[id])}</b></span></div>`;
    }).join('')}</div>` : '<div class="empty">还没有卖出东西</div>';
  }
  return head('📊 财报') + tabs([['today', '今日'], ['trend', '近两周'], ['rank', '商品排行']]) + `<div class="pbody">${body}</div>`;
}

/* ======================= 天气 ======================= */
function weatherHTML() {
  const rows = [];
  for (let d = G.day; d <= G.day + 14; d++) {
    const w = G.wx[d]; if (!w || !w.f) continue;
    const f = w.f, W = WEATHER[f.type], dt = dateOf(d), wd = dt.getDay();
    const lab = d === G.day ? '今天' : d === G.day + 1 ? '明天' : d === G.day + 2 ? '后天' : '';
    const range = Math.round(f.traffic * (0.08 + (d - G.day) * 0.015) / 5) * 5;
    rows.push(`<div class="wrow ${d === G.day ? 'today' : ''} ${wd === 0 || wd === 6 ? 'we' : ''}">
      <div class="wd"><b>${dt.getMonth() + 1}/${dt.getDate()}</b><small>周${WEEKDAYS[wd]}</small>${lab ? `<em>${lab}</em>` : ''}</div>
      <div class="wi"><span>${W.icon}</span><small>${W.name}</small></div>
      <div class="wt"><b>${f.hi}°</b><span>${f.lo}°</span></div>
      <div class="wp">💧${f.pop}%</div>
      <div class="wc">👥 约 <b>${f.traffic}</b> 人<small>±${Math.max(5, range)}</small>${d === G.day ? `<i>已来 ${G.todayCustomers} 人</i>` : ''}</div>
      ${f.event ? `<div class="wev">${f.event.icon} ${f.event.name}<small>${f.event.desc}</small></div>` : ''}
    </div>`);
  }
  const t = todayWx();
  return head('🌤 天气预报') + `<div class="wnow"><span class="big">${G.snow && G.rain > 0.1 ? '❄️' : G.rain > 0.1 ? '🌧️' : WEATHER[t.type].icon}</span>
    <div><b>${Math.round(G.temp ?? t.hi)}°C</b><small>雨宿町 · 现在${G.rain > 0.1 ? (G.snow ? '在下雪' : '在下雨') : '没下雨'}</small></div>
    <p>📈 预测客流 = 天气 × 星期 × 口碑 × 活动。<br>⚠️ 预报越远越不准，每天的实际客流也会有随机波动。</p></div>
    <div class="pbody wlist">${rows.join('')}</div>`;
}

/* ======================= 管理货架 ======================= */
function shelfHTML() {
  const tabsList = [['overview', '📋 总览'], ...FIX_ORDER.map(f => [f, `${fixOpen(f) ? CAT_BY_ID[f].emoji : '🔒'} ${FIX[f].name}`])];
  if (P.tab !== 'overview' && !FIX[P.tab]) P.tab = 'overview';
  const body = P.tab === 'overview' ? shelfOverview() : shelfDetail(P.tab);
  return head('🗂 管理货架') + tabs(tabsList) + body;
}
function fixFill(fid) { const s = catState(fid); return s.cap ? s.shelf / s.cap : 0; }
function shelfOverview() {
  const und = PRODUCTS.filter(p => G.carried[p.id] && G.unlocked[p.cat] && !displayed(p.id));
  const cards = FIX_ORDER.map(fid => {
    const F = FIX[fid], open = fixOpen(fid), ps = open ? displayedOn(fid) : [], s = catState(fid);
    const used = open ? G.plan[fid].filter(Boolean).length : 0, tot = fixSlots(fid);
    return `<button class="fxcard ${open ? '' : 'locked'} st-${F.style}" data-p="tab:${fid}">
      <div class="fx-h"><b>${open ? CAT_BY_ID[fid].emoji : '🔒'} ${F.name}</b><small>${F.sub}</small></div>
      <div class="fx-mini" style="grid-template-columns:repeat(${F.cols},1fr)">${open ? rowsTopDown(fid).map(i => `<span>${G.plan[fid][i] ? PRODUCT_BY_ID[G.plan[fid][i]].emoji : ''}</span>`).join('') : ''}</div>
      <div class="fx-f">${open ? `<span>格子 ${used}/${tot}</span><span>库存 ${Math.round(fixFill(fid) * 100)}%</span>${s.empty ? '<em class="bad">有空货</em>' : ''}` : '<span>在「进货」里解锁</span>'}</div>
    </button>`;
  }).join('');
  return `<div class="pbody">
    ${und.length ? `<div class="warnbox"><div><b>⚠️ 这些商品进了货，但没摆出来，客人买不到：</b><div class="chips">${und.map(p => `<span class="chip">${p.emoji} ${esc(p.cn)}</span>`).join('')}</div></div><button class="primary" data-p="placeall">一键摆上</button></div>` : ''}
    <div class="fxgrid">${cards}</div>
    <div class="tipbox"><b>📐 陈列小知识</b>
      <span>🧺 每 1 格能放 ${PER_FACE} 件商品，格子越多越不容易卖空</span>
      <span>👀 格子越多越显眼：1 格人气 ×0.9 → 4 格 ×1.5</span>
      <span>⭐ 中间「黄金层」在视线高度，人气再 +15%；只放在最下层 -10%</span>
      <span>🛒 收银台旁的 C 货架容易冲动消费 +8%</span>
      <span>🚫 没有摆出来的商品，客人找不到也买不到</span></div>
  </div>`;
}
function rowsTopDown(fid) { const F = FIX[fid], out = []; for (let t = F.tiers - 1; t >= 0; t--) for (let c = 0; c < F.cols; c++) out.push(t * F.cols + c); return out; }
function shelfDetail(fid) {
  const F = FIX[fid], C = CAT_BY_ID[fid];
  if (!fixOpen(fid)) return `<div class="pbody"><div class="lockcard"><div class="big">🔒</div><h3>${F.name}</h3><p>先在「进货」里解锁「${C.name}」才能使用这个货架。</p><button class="primary" data-p="noop" onclick="openPanel('order','${fid}')">去解锁</button></div></div>`;
  const plan = G.plan[fid], seen = {};
  const cellHTML = i => {
    const pid = plan[i], sel = P.sel === i;
    if (!pid) return `<button class="cell empty ${sel ? 'sel' : ''}" data-p="slot:${fid}:${i}"><span class="plus">＋</span><small>空位</small></button>`;
    const p = PRODUCT_BY_ID[pid], k = seen[pid] = (seen[pid] || 0) + 1;
    const fill = clamp((G.inv[pid].shelf - (k - 1) * PER_FACE) / PER_FACE, 0, 1);
    const hotT = G.trend && G.trend[pid] > 1;
    return `<button class="cell ${sel ? 'sel' : ''} ${fill <= 0 ? 'out' : ''}" data-p="slot:${fid}:${i}" style="--pc:${p.look[1]}">
      ${hotT ? '<i class="hot">🔥</i>' : ''}<span class="pe2">${p.emoji}</span><small>${esc(p.cn)}</small>
      <span class="fillbar"><span style="width:${fill * 100}%"></span></span><span class="ptag">${yen(G.price[pid])}</span></button>`;
  };
  // 格子编号自下而上 (0 = 最下层), 显示时从上往下排
  const rows = Array.from({ length: F.tiers }, (_, k) => F.tiers - 1 - k);
  const cellsByIdx = {}; for (let i = 0; i < plan.length; i++) cellsByIdx[i] = cellHTML(i);
  const viz = `<div class="shelfviz sv-${F.style}">${rows.map(t => `<div class="srow ${isGolden(fid, t) ? 'gold' : ''}"><div class="slabel">${tierLabel(fid, t)}${isGolden(fid, t) ? '<b>⭐ 人气+15%</b>' : ''}</div><div class="scells" style="grid-template-columns:repeat(${F.cols},minmax(0,1fr))">${Array.from({ length: F.cols }, (_, c) => cellsByIdx[t * F.cols + c]).join('')}</div></div>`).join('<div class="plank"></div>')}</div>`;
  let picker = '';
  if (P.sel != null && P.sel < plan.length) {
    const t = Math.floor(P.sel / F.cols), c = P.sel % F.cols;
    const opts = PRODUCTS.filter(p => F.accepts.includes(p.cat) && G.unlocked[p.cat]);
    opts.sort((a, b) => (G.carried[b.id] ? 1 : 0) - (G.carried[a.id] ? 1 : 0) || (b.cat === fid) - (a.cat === fid));
    picker = `<div class="picker"><div class="pk-h"><b>✏️ ${tierLabel(fid, t)} · 第 ${c + 1} 格 放什么？</b>
      <span><button class="sm" data-p="col:${fid}:${P.sel}" ${plan[P.sel] ? '' : 'disabled'}>整列都放这个</button> <button class="sm" data-p="put:${fid}:${P.sel}:">清空这一格</button> <button class="sm" data-p="slot:${fid}:${P.sel}">完成</button></span></div>
      <div class="pk-grid">${opts.map(p => `<button class="pk ${plan[P.sel] === p.id ? 'on' : ''} ${G.carried[p.id] ? '' : 'nc'}" data-p="put:${fid}:${P.sel}:${p.id}">
        <span class="pe2">${p.emoji}</span><b>${esc(p.cn)}</b><small>${G.carried[p.id] ? `已摆 ${facings(p.id)} 格 · 仓库 ${G.inv[p.id].back}` : '还没进过货'}</small>${G.trend && G.trend[p.id] > 1 ? '<i class="hot">🔥 今日热门</i>' : ''}</button>`).join('')}</div></div>`;
  }
  const ps = displayedOn(fid);
  const summary = ps.length ? `<table class="ftable small sumtab"><tr><th>商品</th><th class="r">格子</th><th class="r">货架</th><th class="r">人气</th></tr>${ps.map(p => {
    const fl = facingList(p.id), v = visibility(p.id);
    return `<tr><td>${p.emoji} ${esc(p.cn)} ${fl.some(x => isGolden(x.fid, x.t)) ? '⭐' : ''}</td><td class="r">${fl.length}</td><td class="r">${G.inv[p.id].shelf}/${shelfCap(p.id)}</td><td class="r ${v >= 1.2 ? 'good' : v < 1 ? 'bad' : ''}">×${v.toFixed(2)}</td></tr>`;
  }).join('')}</table>` : '<div class="empty">货架是空的，点上面的格子开始摆放吧</div>';
  const s = catState(fid);
  return `<div class="pbody">
    <div class="fxhead"><div><b>${C.emoji} ${F.name}</b><small>${F.sub} · 可放：${F.accepts.filter(a => CAT_BY_ID[a]).map(a => CAT_BY_ID[a].name).join(' / ')}</small></div>
      <div class="fxstat"><span>库存</span><b>${Math.round(fixFill(fid) * 100)}%</b><small>仓库 ${s.back} 件</small></div></div>
    ${viz}${picker}
    <p class="note">👆 点一个格子，再选商品。每格放 ${PER_FACE} 件；同一种商品摆的格子越多，越显眼、越不容易卖空。</p>
    ${summary}
  </div>
  <div class="pfoot"><div class="row">
    <button data-p="auto:${fid}">✨ 按销量自动陈列</button>
    <button data-p="restockfix:${fid}">⬆ 上架</button>
    <button data-p="clearfix:${fid}">🧹 清空</button>
  </div></div>`;
}

/* ======================= 新闻 ======================= */
function newsHTML() {
  const list = G.newsArchive && G.newsArchive.length ? G.newsArchive : (G.news ? [G.news] : []);
  const idx = P.tab === 'today' ? 0 : clamp(+P.tab || 0, 0, list.length - 1);
  const N = list[idx];
  if (idx === 0 && N) G.newsSeen = N.day;
  const d = N ? dateOf(N.day) : new Date();
  const [head0, ...rest] = N ? N.items : [];
  const body = !N ? '<div class="empty">还没有新闻</div>' : `<div class="paper">
    <div class="masthead"><div class="mt-title">雨宿日報 <small>AMAYADORI TIMES</small></div>
      <div class="mt-sub">${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}） · 第 ${N.day} 号 · 每天 0:00 送达</div></div>
    <div class="headline"><div class="hl-icon">${head0.icon}</div><div><span class="ntag">${head0.tag}</span><h3>${esc(head0.title)}</h3><p>${esc(head0.body)}</p>${head0.eff ? `<div class="eff">📌 ${esc(head0.eff)}</div>` : ''}</div></div>
    <div class="ncols">${rest.map(n => `<div class="nitem"><div class="ni-h"><span class="ni-icon">${n.icon}</span><span class="ntag">${n.tag}</span></div><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p>${n.eff ? `<div class="eff">📌 ${esc(n.eff)}</div>` : ''}</div>`).join('')}</div>
  </div>`;
  const tabsList = list.map((n, i) => [i === 0 ? 'today' : String(i), i === 0 ? '今天' : dateLabel(n.day)]);
  if (P.tab !== 'today' && !tabsList.some(t => t[0] === P.tab)) P.tab = 'today';
  return head('📰 新闻') + tabs(tabsList) + `<div class="pbody">${body}<p class="note">新闻每天随机更新。带 📌 的新闻会影响当天的人气、进价或客流，记得根据新闻调整进货！</p></div>`;
}

/* ======================= 事件处理 ======================= */
$('modal-body').addEventListener('click', e => {
  if (!P.active) return;
  const ar = e.target.closest('[data-tscroll]');
  if (ar) { const t = ar.parentElement.querySelector('.tabs'); t.scrollBy({ left: +ar.dataset.tscroll * Math.max(200, t.clientWidth * 0.7), behavior: 'smooth' }); return; }
  if (P.tabDragged && performance.now() - P.tabDragged < 250 && e.target.closest('.tabs')) return;
  const el = e.target.closest('[data-p]');
  if (!el || el.disabled) return;
  const [act, a, b] = el.dataset.p.split(':');
  Sound.click();
  switch (act) {
    case 'close': closeModal(); return;
    case 'tab': P.tab = a; P.sub = null; P.sel = null; renderPanel(false); return;
    case 'slot': P.sel = P.sel === +b ? null : +b; break;
    case 'put': {
      const [fid, i, pid] = [a, +b, el.dataset.p.split(':')[3] || null];
      if (setSlot(fid, i, pid)) {
        if (pid && !G.carried[pid]) toast(`📝 ${PRODUCT_BY_ID[pid].emoji}${PRODUCT_BY_ID[pid].name} 还没进货，记得去「进货」订货`);
        if (pid) restockCat(fid);
        // 自动选中下一个空格, 方便连续摆放
        const nx = G.plan[fid].findIndex((x, k) => k > i && !x);
        P.sel = pid && nx >= 0 ? nx : null;
        Sound.restock();
      }
      break;
    }
    case 'col': {
      const fid = a, i = +b, F = FIX[fid], pid = G.plan[fid][i];
      for (let t = 0; t < F.tiers; t++) setSlot(fid, t * F.cols + (i % F.cols), pid);
      if (pid) restockCat(fid);
      break;
    }
    case 'auto': if (autoArrange(a)) { restockCat(a); toast(`✨ 已按最近销量重新陈列「${FIX[a].name}」`); } else toast('这个货架没有可以摆的商品'); P.sel = null; break;
    case 'clearfix': { const ids = displayedOn(a).map(p => p.id); G.plan[a] = G.plan[a].map(() => null); ids.forEach(clampShelf); P.sel = null; toast(`🧹 清空了「${FIX[a].name}」，货都退回仓库了`); break; }
    case 'restockfix': { const n = restockCat(a); toast(n ? `⬆ 上架了 ${n} 件` : '没有可以上架的货'); break; }
    case 'placeall': {
      let n = 0;
      for (const p of PRODUCTS) if (G.carried[p.id] && G.unlocked[p.cat] && !displayed(p.id) && autoPlace(p.id)) { n++; }
      FIX_ORDER.forEach(f => fixOpen(f) && restockCat(f));
      toast(n ? `🗂 摆上了 ${n} 种商品` : '没有空位了，先清出一些格子');
      break;
    }
    case 'place': { const f = autoPlace(a); toast(f ? `🗂 摆到了「${FIX[f].name}」` : '没有空位了，去「管理货架」调整'); if (f) restockCat(f); break; }
    case 'price': {
      const p = PRODUCT_BY_ID[a];
      G.price[a] = clamp(r1(G.price[a] + Number(b)), Math.max(0.5, Math.round(p.price * 0.5 * 2) / 2), Math.round(p.price * 2 * 2) / 2);
      break;
    }
    case 'vprice': { const vm = G.vend[+a], d = VEND_DEFS[+a]; vm.price = clamp(r1(vm.price + Number(b)), 1, d.price * 2); break; }
    case 'vfill': vendRefill(+a); break;
    case 'noop': return;
    case 'order':
      if (placeOrder(a, Number(b))) toast(`📝 已下单 ${PRODUCT_BY_ID[a].emoji} ${PRODUCT_BY_ID[a].name} ×${PRODUCT_BY_ID[a].box}`);
      break;
    case 'smart': { const [n, cost] = smartOrder(); toast(n ? `⚡ 补单 ${n} 箱，共 ${yen(cost)}` : '没有需要补的或钱不够'); break; }
    case 'shelveall': {
      let n = 0;
      for (const c of CATEGORIES) if (G.unlocked[c.id]) n += restockCat(c.id);
      toast(n ? `⬆ 上架了 ${n} 件商品` : '仓库没有可上架的货');
      if (n) Sound.restock();
      break;
    }
    case 'unlock':
      if (unlockCategory(a)) { toast(`🎉 解锁了「${CAT_BY_ID[a].name}」！记得去进货`); Sound.coin(); }
      break;
    case 'shift': { const st = findPerson(+a); st.shift = b; break; }
    case 'role': { const st = findPerson(+a); st.role = b; if (G.staffRT[st.id]) G.staffRT[st.id].role = null; break; }
    case 'resume': P.sub = +a; renderPanel(true); return;
    case 'back': P.sub = null; renderPanel(true); return;
    case 'hire': { const c = findPerson(+a); if (c && hire(c)) { P.sub = null; P.tab = 'crew'; renderPanel(true); return; } break; }
    case 'fire': {
      const st = findPerson(+a);
      P.active = false;
      confirmBox('解雇员工', `确定要解雇 <b>${esc(st.name)}</b> 吗？`, '解雇', () => { fire(st); P.sub = null; openPanel('staff', 'crew'); }, true, () => openPanel('staff'));
      return;
    }
    case 'ad': if (postJobAd()) toast('📢 招聘广告发出去了，来了 4 位新的应聘者'); break;
  }
  renderPanel(false);
});
