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
function defaultTab(name) { return { order: 'rice', staff: 'crew', fin: 'today', weather: 'list' }[name]; }
const fmt = n => yen(n);
P.tabs = {};

function renderPanel(first) {
  const body = $('modal-body');
  const old = body.querySelector('.pbody');
  const scroll = !first && old ? old.scrollTop : 0;
  const html = ({ order: orderHTML, staff: staffHTML, fin: finHTML, weather: weatherHTML })[P.name]();
  openModal(html, 'big');
  P.active = true;
  P.tabs[P.name] = P.tab;
  const nb = body.querySelector('.pbody');
  if (nb) nb.scrollTop = scroll;
}

function head(title) {
  return `<div class="ph"><h2>${title}</h2><div class="pmoney">💰 ${yen(G.money)}</div><button class="x" data-p="close" aria-label="关闭">✕</button></div>`;
}
function tabs(list) {
  return `<div class="tabs">${list.map(([id, label]) => `<button class="${P.tab === id ? 'on' : ''}" data-p="tab:${id}">${label}</button>`).join('')}</div>`;
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
          <div class="pstock"><span>货架 <b>${inv.shelf}</b>/${SHELF_CAP}</span><span>仓库 <b>${inv.back}</b></span>${inc ? `<span class="inc">🚚 ${inc}</span>` : ''}</div>
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

/* ======================= 事件处理 ======================= */
$('modal-body').addEventListener('click', e => {
  if (!P.active) return;
  const el = e.target.closest('[data-p]');
  if (!el || el.disabled) return;
  const [act, a, b] = el.dataset.p.split(':');
  Sound.click();
  switch (act) {
    case 'close': closeModal(); return;
    case 'tab': P.tab = a; P.sub = null; renderPanel(true); return;
    case 'price': {
      const p = PRODUCT_BY_ID[a];
      G.price[a] = clamp(r1(G.price[a] + Number(b)), Math.max(0.5, Math.round(p.price * 0.5 * 2) / 2), Math.round(p.price * 2 * 2) / 2);
      break;
    }
    case 'vprice': { const vm = G.vend[+a], d = VEND_DEFS[+a]; vm.price = clamp(r1(vm.price + Number(b)), 1, d.price * 2); break; }
    case 'vfill': vendRefill(+a); break;
    case 'noop': {
    }
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
