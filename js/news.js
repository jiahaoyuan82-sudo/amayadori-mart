'use strict';
/* =========================================================
 * news.js — 每日随机新闻「雨宿日报」(有些会影响当天经营)
 * ========================================================= */

const RIVALS = ['ほしぞらストア', 'ラッキーマート', 'まちかど24', 'ニコニコマート', 'サンライズ便利店'];
const TOWN_FOLK = ['田中爷爷', '佐藤小姐', '外卖小哥', '小健', '商店街会长', '拉面店老板', '花店阿姨', '车站站长'];
const SNS = ['某短视频平台', '小红书', '推特', '美食博主', '人气偶像'];

/* 每条模板返回 {icon, tag, title, body, fx}，fx 是效果说明 (不写就是纯新闻) */
const NEWS_TEMPLATES = [
  // ---- 商品潮流 (影响人气) ----
  { w: 3, kind: 'trend', make: () => {
    const p = pickCarried(); if (!p) return null;
    const m = pick([1.6, 1.8, 2.0, 2.5]);
    return { icon: '📈', tag: '潮流', title: `${pick(SNS)}上「${p.cn}」突然爆火`, body: `${pick(['一条视频', '一位博主的测评', '一张深夜照片'])}让${p.emoji}${p.cn}成了今天的话题，很多人专门来便利店找它。`, fx: { trend: [p.id, m] }, eff: `${p.emoji}${p.cn} 今天人气 ×${m}` };
  } },
  { w: 1.5, kind: 'trend', make: () => {
    const p = pickCarried(); if (!p) return null;
    return { icon: '📉', tag: '潮流', title: `「${p.cn}」被说不健康，有点冷门`, body: `${pick(['一档健康节目', '某营养师'])}提到${p.cn}热量太高，今天买的人可能会少一些。`, fx: { trend: [p.id, 0.5] }, eff: `${p.emoji}${p.cn} 今天人气 ×0.5` };
  } },
  { w: 1.2, kind: 'trend', make: () => {
    const opts = [['beer', '⚽ 今晚有足球比赛直播', '球迷们都在准备啤酒和零食。', ['beer', 'chips']], ['cupramen', '📚 附近大学进入考试周', '深夜复习的学生会来买夜宵和咖啡。', ['cupramen', 'coffee']], ['onigiri_sake', '🏃 市民马拉松今早开跑', '选手和观众都需要补给。', ['water', 'onigiri_sake']], ['manga', '📖 人气漫画最新话今天发售', '周刊漫画杂志应该会卖得很好。', ['manga']], ['karaage', '🍗 「炸鸡日」活动', '全国的便利店都在推炸鸡。', ['karaage']]];
    const o = pick(opts);
    const ids = o[3].filter(id => PRODUCT_BY_ID[id]);
    return { icon: o[1].slice(0, 2), tag: '活动', title: o[1].slice(2).trim(), body: o[2], fx: { trends: ids.map(id => [id, 1.8]) }, eff: ids.map(id => PRODUCT_BY_ID[id].emoji).join('') + ' 今天人气 ×1.8' + (ids.some(id => !G.carried[id] || !G.unlocked[PRODUCT_BY_ID[id].cat]) ? '（没上架的话就错过了）' : '') };
  } },
  // ---- 进价 ----
  { w: 1.5, kind: 'cost', make: () => {
    const c = pick(CATEGORIES.filter(c => G.unlocked[c.id]));
    return { icon: '🚜', tag: '物价', title: `${c.name}原料大丰收，批发价下跌`, body: `供应商说今年${pick(['稻米', '小麦', '原材料', '包装材料'])}特别便宜，今天进货很划算。`, fx: { cost: [c.id, 0.85] }, eff: `${c.emoji}${c.name} 今天进价 -15%` };
  } },
  { w: 1.2, kind: 'cost', make: () => {
    const c = pick(CATEGORIES.filter(c => G.unlocked[c.id]));
    return { icon: '⛽', tag: '物价', title: `油价上涨，${c.name}运费变贵`, body: `物流公司今天起上调运费，${c.name}的进价暂时上涨。`, fx: { cost: [c.id, 1.15] }, eff: `${c.emoji}${c.name} 今天进价 +15%` };
  } },
  // ---- 客流 ----
  { w: 1.2, kind: 'traffic', make: () => ({ icon: '🏢', tag: '本地', title: '车站旁的新公寓今天开始入住', body: '一下子多了不少新居民，搬家累了正需要便利店。', fx: { traffic: 1.12 }, eff: '今天客流 +12%' }) },
  { w: 1, kind: 'traffic', make: () => ({ icon: '🚧', tag: '本地', title: '隔壁街道封路施工', body: '施工一直持续到傍晚，路过的人变少了。', fx: { traffic: 0.9 }, eff: '今天客流 -10%' }) },
  { w: 1, kind: 'traffic', make: () => { const r = pick(RIVALS); return { icon: '🏪', tag: '竞争', title: `对面的「${r}」今天大促销`, body: `${r}所有饭团打八折，有些客人被吸引过去了。`, fx: { traffic: 0.92 }, eff: '今天客流 -8%' }; } },
  { w: 0.8, kind: 'traffic', make: () => { const r = pick(RIVALS); return { icon: '🔌', tag: '竞争', title: `「${r}」停电临时歇业`, body: `${r}的冰柜坏了，今天关门一天，客人都跑到我们这里来。`, fx: { traffic: 1.15 }, eff: '今天客流 +15%' }; } },
  { w: 0.8, kind: 'traffic', make: () => ({ icon: '🚃', tag: '交通', title: '电车信号故障，早上大面积延误', body: '车站挤满了等车的人，便利店也跟着热闹起来。', fx: { traffic: 1.08 }, eff: '今天客流 +8%' }) },
  { w: 0.6, kind: 'rep', make: () => ({ icon: '📺', tag: '媒体', title: '地方电视台介绍了「雨宿町的便利店」', body: '节目里出现了我们店的招牌，好多人说「原来就在家附近」。', fx: { rep: 0.15 }, eff: '口碑 +0.15' }) },
  // ---- 纯新闻 / 趣闻 ----
  { w: 2.5, kind: 'flavor', make: () => pick([
    { icon: '🐱', tag: '趣闻', title: '三丁目的橘猫「阿福」被选为町内会吉祥物', body: '据说它最喜欢在便利店门口晒太阳。' },
    { icon: '🎤', tag: '娱乐', title: '本地偶像在商店街拍摄新 MV', body: '粉丝们说想去 MV 里出现的便利店打卡。' },
    { icon: '🍠', tag: '季节', title: '烤红薯的季节到了', body: '商店街的烤红薯摊又出现了，空气里都是甜甜的香味。' },
    { icon: '♟', tag: '本地', title: `${pick(TOWN_FOLK)}在町内会将棋大会夺冠`, body: '赛后接受采访时说：「赢了就去便利店买罐咖啡庆祝。」' },
    { icon: '🌸', tag: '季节', title: '公园里的银杏开始变黄', body: '周末去公园散步的人应该会变多。' },
    { icon: '🍜', tag: '美食', title: '拉面店老板研发新口味', body: '老板说灵感来自便利店的杯面，大家都笑了。' },
    { icon: '🚲', tag: '本地', title: '商店街举办「自行车安全日」', body: '交警提醒大家雨天骑车不要打伞。' },
    { icon: '🎐', tag: '本地', title: '小学生参观了邮局和便利店', body: '孩子们最感兴趣的问题是：「便利店晚上真的不睡觉吗？」' },
    { icon: '🔭', tag: '天文', title: '今晚能看到流星雨', body: '天文台说要是天晴，深夜两点左右最适合观测。' },
    { icon: '🏮', tag: '本地', title: '商店街开始筹备年末大扫除', body: '会长希望每家店都能参加。' },
  ]) },
];

function pickCarried() {
  const ps = PRODUCTS.filter(p => G.unlocked[p.cat] && G.carried[p.id]);
  return ps.length ? pick(ps) : null;
}

/** 生成今天的新闻并应用效果 (在 startDay 里调用) */
function generateNews() {
  const items = [];
  const used = new Set(), usedTpl = new Set();
  // 2~3 条有影响的 + 1~2 条趣闻 + 1 条天气提示
  const nFx = randInt(2, 3), nFlavor = randInt(1, 2);
  const fxPool = NEWS_TEMPLATES.filter(t => t.kind !== 'flavor');
  let guard = 0;
  while (items.filter(i => i.fx).length < nFx && guard++ < 30) {
    const t = wpick(fxPool.filter(x => !usedTpl.has(x)), x => x.w);
    if (!t) break;
    const n = t.make();
    if (!n || used.has(n.title)) continue;
    used.add(n.title); usedTpl.add(t); items.push(n);
  }
  guard = 0;
  while (items.filter(i => !i.fx).length < nFlavor && guard++ < 30) {
    const n = NEWS_TEMPLATES.find(t => t.kind === 'flavor').make();
    if (used.has(n.title)) continue;
    used.add(n.title); items.push(n);
  }
  // 天气提示 (明天)
  const tm = G.wx[G.day + 1];
  if (tm && tm.f) {
    const W = WEATHER[tm.f.type];
    let tip = '';
    if (tm.f.pop >= 60) tip = '记得多备一点雨伞和毛巾。';
    else if (tm.f.hi >= 26) tip = '冰品和饮料会好卖。';
    else if (tm.f.hi <= 10) tip = '关东煮和肉包会很受欢迎。';
    else tip = '是个适合出门的日子。';
    items.push({ icon: W.icon, tag: '天气', title: `明天${W.name}，最高 ${tm.f.hi}°C，降水 ${tm.f.pop}%`, body: `气象台预报：${tip}${tm.f.event ? `另外明天有「${tm.f.event.name}」。` : ''}` });
  }
  // 头条 = 第一条有影响的新闻
  items.sort((a, b) => (b.fx ? 1 : 0) - (a.fx ? 1 : 0));
  // 应用效果
  G.trend = {};
  let traffic = 1;
  for (const n of items) {
    const fx = n.fx; if (!fx) continue;
    if (fx.trend) G.trend[fx.trend[0]] = (G.trend[fx.trend[0]] || 1) * fx.trend[1];
    if (fx.trends) for (const [id, m] of fx.trends) G.trend[id] = (G.trend[id] || 1) * m;
    if (fx.cost) for (const p of PRODUCTS_BY_CAT[fx.cost[0]]) G.costMult[p.id] = Math.round(G.costMult[p.id] * fx.cost[1] * 100) / 100;
    if (fx.traffic) traffic *= fx.traffic;
    if (fx.rep) G.rep = clamp(G.rep + fx.rep, 0, 5);
  }
  G.todayTarget *= traffic;
  G.news = { day: G.day, items: items.map(({ icon, tag, title, body, eff }) => ({ icon, tag, title, body, eff })) };
  G.newsArchive = [G.news, ...(G.newsArchive || []).filter(n => n.day !== G.day)].slice(0, 7);
}
