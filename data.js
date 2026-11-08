'use strict';
/* =========================================================
 * data.js — 游戏数据 (改数值主要改这里)
 * ========================================================= */

const STORE_NAME = 'あまやどりマート';
const STORE_NAME_EN = 'AMAYADORI MART';
const TOWN_NAME = '雨宿町 三丁目';
const START_DATE = new Date(2026, 10, 8);   // 第 1 天 = 2026/11/8
const START_MONEY = 3000;          // 单位: 元 (人民币)
const CURRENCY = '¥';

// 店铺建筑范围
const STORE = { x0: 3, y0: 1.5, x1: 15, y1: 7, H: 3.4 };
const DOOR = { x0: 7, x1: 8.4, cx: 7.7 };
const QUEUE_SPOTS = [[11.85, 3.85], [11.85, 4.6], [11.85, 5.35], [11.85, 6.05], [11.2, 2.95], [10.45, 2.95], [9.7, 2.95], [8.95, 2.95]];
const AISLE_X = 7.6;
const AISLES_X = [3.98, 7.6, 11.8];       // 店内纵向通道
const ROWS_Y = [2.92, 4.7, 6.12];         // 店内横向通道 (后/中/前)
const EATIN_SEATS = [[9.5, 6.2], [10.45, 6.2], [11.3, 6.2]];
const ENTRY_IN = [DOOR.cx, 6.4];
const ENTRY_OUT = [DOOR.cx, 7.65];
const LANE_CUSTOMER = 8.2;
const LANE_PASSER = 8.55;
const BOARD = { w: 21, h: 13 };
const REGISTER_POS = [13.4, 3.9];
const STAFF_HOME = [14.05, 2.3];    // 员工休息/出入点 (STAFF ONLY 门前)
const COUNTER = { x0: 12.3, y0: 2.8, x1: 12.9, y1: 5.2 };
const SHELF_CAP = 8;                // 每种商品货架上最多摆几个
const MAX_STAFF = 6;
const MAX_INSIDE = 20;

/* ---------------- 商品类别 & 货架 ----------------
 * box: [x, y, z, 宽, 深, 高]  stand: 顾客取货站位 (null = 在收银台点单)
 * unlock: 解锁费用 (0 = 开局就有) */
const CATEGORIES = [
  { id: 'rice', name: '饭团便当', jp: 'おにぎり・弁当', emoji: '🍙', unlock: 0, box: [4.4, 3.6, 0, 2.4, 0.6, 1.5], face: 'y', stand: [5.6, 4.7], span: 2.0, color: '#2a9d8f' },
  { id: 'drink', name: '饮料', jp: 'ドリンク', emoji: '🥤', unlock: 0, box: [3.5, 1.65, 0, 7.0, 0.65, 2.0], face: 'fridge', stand: [7.0, 2.88], span: 6.2, color: '#2a9d8f' },
  { id: 'bread', name: '面包', jp: 'パン', emoji: '🍞', unlock: 0, box: [4.4, 5.2, 0, 2.4, 0.5, 1.5], face: 'y', stand: [5.6, 6.12], span: 2.0, color: '#d08c2f' },
  { id: 'noodle', name: '杯面', jp: 'カップ麺', emoji: '🍜', unlock: 0, box: [3.15, 3.3, 0, 0.45, 2.5, 1.8], face: 'x', stand: [3.98, 4.55], span: 2.0, axis: 'y', color: '#e63946' },
  { id: 'snack', name: '零食', jp: 'お菓子', emoji: '🍫', unlock: 0, box: [8.4, 3.6, 0, 2.2, 0.6, 1.5], face: 'y', stand: [9.5, 4.7], span: 1.8, color: '#f2a93b' },
  { id: 'magazine', name: '杂志', jp: '雑誌・新聞', emoji: '📰', unlock: 200, box: [3.4, 6.48, 0, 2.8, 0.42, 0.95], face: 'mag', stand: [4.8, 6.12], span: 2.2, color: '#6d597a', desc: '沿着橱窗的杂志架。早上卖报纸，晚上漫画周刊很受欢迎。' },
  { id: 'daily', name: '日用品', jp: '日用品', emoji: '☂️', unlock: 300, box: [6.42, 6.42, 0, 0.42, 0.45, 0.95], face: 'daily', stand: [6.7, 6.08], span: 0, color: '#457b9d', desc: '门口的伞架和日用品。下雨天透明伞会大卖！' },
  { id: 'hot', name: '热食', jp: 'ホットスナック', emoji: '🍢', unlock: 500, box: [12.35, 4.25, 1.0, 0.5, 0.62, 0.44], face: 'hot', stand: null, color: '#f4a261', desc: '收银台旁的热食柜，客人结账时顺便点。天冷时很受欢迎，有的客人还会在イートイン坐下吃。' },
  { id: 'ice', name: '冰品', jp: 'アイス', emoji: '🍦', unlock: 600, box: [8.45, 5.22, 0, 2.1, 0.5, 0.82], face: 'freezer', stand: [9.5, 6.12], span: 1.6, color: '#8ecae6', desc: '冷冻柜。天越热卖得越好，冬天就比较冷清。' },
];
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/* ---------------- 商品 ----------------
 * cost 进价  price 建议售价  box 每箱数量  pop 基础人气
 * heat: 气温敏感度 (+ 越热越好卖, - 越冷越好卖)  rain: 下雨加成  night: 深夜加成  start: 开局就在售
 * look: 货架上的样子 [类型, 颜色] */
const PRODUCTS = [
  { id: 'onigiri_sake', cat: 'rice', name: '鮭おにぎり', cn: '鲑鱼饭团', emoji: '🍙', cost: 3.5, price: 7, box: 10, pop: 3, look: ['onigiri', '#f08a6b'], start: 1, morning: 1 },
  { id: 'onigiri_tuna', cat: 'rice', name: 'ツナマヨ', cn: '金枪鱼蛋黄酱饭团', emoji: '🍙', cost: 3.5, price: 7.5, box: 10, pop: 3, look: ['onigiri', '#f2d16b'], start: 1, morning: 1 },
  { id: 'onigiri_ume', cat: 'rice', name: '梅おにぎり', cn: '梅子饭团', emoji: '🍙', cost: 3, price: 6, box: 10, pop: 1.5, look: ['onigiri', '#d94f70'], morning: 1 },
  { id: 'bento', cat: 'rice', name: '幕の内弁当', cn: '幕之内便当', emoji: '🍱', cost: 10, price: 19, box: 6, pop: 2, look: ['bento', '#c0392b'], lunch: 2 },

  { id: 'tea', cat: 'drink', name: '緑茶', cn: '绿茶', emoji: '🍵', cost: 2, price: 4.5, box: 12, pop: 3, heat: 0.3, look: ['bottle', '#7cc576'], start: 1 },
  { id: 'cola', cat: 'drink', name: 'コーラ', cn: '可乐', emoji: '🥤', cost: 2, price: 4.5, box: 12, pop: 2, heat: 0.6, look: ['bottle', '#8b1e1e'] },
  { id: 'water', cat: 'drink', name: '天然水', cn: '矿泉水', emoji: '💧', cost: 1, price: 2.5, box: 12, pop: 2, heat: 0.5, look: ['bottle', '#9fd3ff'], start: 1 },
  { id: 'coffee', cat: 'drink', name: '缶コーヒー', cn: '罐装咖啡', emoji: '☕', cost: 2.5, price: 6, box: 12, pop: 2.5, heat: -0.3, look: ['can', '#6b4226'], morning: 1 },
  { id: 'beer', cat: 'drink', name: 'ビール', cn: '啤酒', emoji: '🍺', cost: 4, price: 8, box: 12, pop: 1.5, heat: 0.4, night: 1.5, look: ['can', '#e9c46a'] },

  { id: 'melonpan', cat: 'bread', name: 'メロンパン', cn: '菠萝包', emoji: '🍞', cost: 3, price: 6.5, box: 8, pop: 2, look: ['bread', '#e8c26a'], start: 1, morning: 1 },
  { id: 'currypan', cat: 'bread', name: 'カレーパン', cn: '咖喱面包', emoji: '🥐', cost: 3.2, price: 7, box: 8, pop: 1.8, look: ['bread', '#b8742e'], start: 1 },
  { id: 'sando', cat: 'bread', name: 'たまごサンド', cn: '鸡蛋三明治', emoji: '🥪', cost: 5, price: 11, box: 8, pop: 2.4, look: ['sando', '#ffe08a'], lunch: 1 },

  { id: 'cupramen', cat: 'noodle', name: 'カップラーメン', cn: '杯面', emoji: '🍜', cost: 3.5, price: 7.5, box: 12, pop: 2.5, heat: -0.5, night: 0.8, look: ['cup', '#e2513f'], start: 1 },
  { id: 'cupudon', cat: 'noodle', name: 'カップうどん', cn: '杯装乌冬', emoji: '🍲', cost: 3.8, price: 8, box: 12, pop: 1.6, heat: -0.6, look: ['cup', '#f2994a'] },
  { id: 'yakisoba', cat: 'noodle', name: 'カップ焼きそば', cn: '杯装炒面', emoji: '🍝', cost: 4, price: 8.5, box: 12, pop: 1.6, night: 0.6, look: ['cup', '#f6f1e6'] },

  { id: 'chips', cat: 'snack', name: 'ポテトチップス', cn: '薯片', emoji: '🥔', cost: 3, price: 7, box: 12, pop: 2.2, night: 0.6, look: ['bag', '#f2c94c'], start: 1 },
  { id: 'choco', cat: 'snack', name: 'チョコレート', cn: '巧克力', emoji: '🍫', cost: 2.5, price: 6, box: 12, pop: 2, heat: -0.2, look: ['bag', '#6b3e26'], start: 1 },
  { id: 'gummy', cat: 'snack', name: 'グミ', cn: '软糖', emoji: '🍬', cost: 2, price: 5, box: 12, pop: 1.5, look: ['bag', '#ff8fab'] },
  { id: 'senbei', cat: 'snack', name: 'せんべい', cn: '仙贝', emoji: '🍘', cost: 3.5, price: 8, box: 12, pop: 1.1, look: ['bag', '#c49a65'] },

  { id: 'manga', cat: 'magazine', name: '週刊少年誌', cn: '周刊漫画', emoji: '📚', cost: 4, price: 9, box: 6, pop: 1.2, night: 0.8, look: ['mag', '#e63946'] },
  { id: 'fashion', cat: 'magazine', name: 'ファッション誌', cn: '时尚杂志', emoji: '📖', cost: 8, price: 18, box: 5, pop: 0.6, look: ['mag', '#ff8fab'] },
  { id: 'newspaper', cat: 'magazine', name: '新聞', cn: '报纸', emoji: '📰', cost: 1, price: 2.5, box: 10, pop: 0.8, morning: 2, look: ['mag', '#e9e9e9'] },

  { id: 'umbrella', cat: 'daily', name: 'ビニール傘', cn: '透明雨伞', emoji: '☂️', cost: 10, price: 25, box: 5, pop: 0.12, rain: 14, look: ['umbrella', '#e6eef8'] },
  { id: 'towel', cat: 'daily', name: 'タオル', cn: '毛巾', emoji: '🧣', cost: 6, price: 15, box: 5, pop: 0.4, rain: 2, look: ['towel', '#a8dadc'] },
  { id: 'battery', cat: 'daily', name: '乾電池', cn: '电池', emoji: '🔋', cost: 5, price: 12, box: 6, pop: 0.5, look: ['battery', '#264653'] },

  { id: 'nikuman', cat: 'hot', name: '肉まん', cn: '肉包', emoji: '🥟', cost: 1.5, price: 4, box: 10, pop: 2, heat: -1, look: ['bun', '#fff8ec'] },
  { id: 'karaage', cat: 'hot', name: 'からあげ', cn: '炸鸡块', emoji: '🍗', cost: 3, price: 8, box: 10, pop: 2.5, look: ['karaage', '#c8792b'] },
  { id: 'oden', cat: 'hot', name: 'おでん', cn: '关东煮', emoji: '🍢', cost: 1.2, price: 3, box: 12, pop: 2, heat: -1.3, look: ['oden', '#e9d8a6'] },

  { id: 'vanilla', cat: 'ice', name: 'バニラアイス', cn: '香草冰淇淋', emoji: '🍦', cost: 3, price: 7, box: 10, pop: 1.6, heat: 1.3, look: ['icecup', '#fff3c4'] },
  { id: 'icebar', cat: 'ice', name: 'ソーダアイス', cn: '苏打冰棒', emoji: '🍧', cost: 1.2, price: 3, box: 12, pop: 1.6, heat: 1.6, look: ['icebar', '#5bc0eb'] },
  { id: 'mochiice', cat: 'ice', name: '雪見だいふく風', cn: '雪媚娘冰淇淋', emoji: '🍡', cost: 4, price: 8, box: 10, pop: 1.2, heat: 0.8, look: ['icecup', '#f7f7f7'] },
];
const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const PRODUCTS_BY_CAT = {};
for (const p of PRODUCTS) (PRODUCTS_BY_CAT[p.cat] = PRODUCTS_BY_CAT[p.cat] || []).push(p);

// 自动贩卖机 (店门口三台, 也是我们的生意)
const VEND_DEFS = [
  { brand: 'あまやどり', name: '饮料贩卖机', color: '#d62828', color2: '#a61e1e', cans: ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#e9c46a'], cost: 1.8, price: 4, cap: 40 },
  { brand: 'COFFEE', name: '咖啡贩卖机', color: '#1d6fb8', color2: '#155a96', cans: ['#6b4226', '#c49a65', '#1d3557', '#f4f1de'], cost: 2.2, price: 5, cap: 40, hot: 1 },
  { brand: 'WATER', name: '矿泉水贩卖机', color: '#e9ecef', color2: '#2a9d8f', cans: ['#9fd3ff', '#7cc576', '#5bc0eb', '#ffffff'], cost: 1, price: 3, cap: 40, cold: 1 },
];

// 各时段客流系数
function hourTraffic(h) {
  if (h < 5) return 0.3;
  if (h < 6) return 0.45;
  if (h < 10) return 1.35;
  if (h < 12) return 0.8;
  if (h < 14) return 1.55;
  if (h < 17) return 0.85;
  if (h < 21) return 1.4;
  return 0.7;
}
const HOUR_TRAFFIC_SUM = Array.from({ length: 24 }, (_, h) => hourTraffic(h + 0.5)).reduce((a, b) => a + b, 0);

/* ---------------- 天气 ---------------- */
const WEATHER = {
  sunny: { icon: '☀️', name: '晴', rain: 0, traffic: 1.08, dark: 0 },
  partly: { icon: '⛅', name: '晴时多云', rain: 0.05, traffic: 1.04, dark: 0.05 },
  cloudy: { icon: '☁️', name: '阴', rain: 0.15, traffic: 1.0, dark: 0.15 },
  shower: { icon: '🌦️', name: '阵雨', rain: 0.45, traffic: 0.9, dark: 0.15 },
  rain: { icon: '🌧️', name: '雨', rain: 0.85, traffic: 0.8, dark: 0.25 },
  storm: { icon: '⛈️', name: '大雨', rain: 1, traffic: 0.6, dark: 0.35 },
  snow: { icon: '❄️', name: '雪', rain: 0.75, traffic: 0.7, dark: 0.2, snow: true },
  typhoon: { icon: '🌀', name: '台风', rain: 1, traffic: 0.35, dark: 0.4 },
};
// 月平均最高/最低气温 (类似东京)  和  降雨倾向
const CLIMATE = [[10, 2, 0.2], [11, 2, 0.22], [14, 5, 0.3], [19, 10, 0.33], [23, 15, 0.35], [26, 19, 0.5], [30, 23, 0.4], [31, 24, 0.33], [27, 21, 0.45], [22, 15, 0.38], [17, 9, 0.28], [12, 4, 0.2]];
const EVENTS = [
  { id: 'matsuri', name: '商店街秋祭', icon: '🏮', traffic: 1.6, desc: '附近有祭典，客人大增' },
  { id: 'hanabi', name: '烟花大会', icon: '🎆', traffic: 1.5, desc: '晚上人特别多' },
  { id: 'undokai', name: '小学运动会', icon: '🏃', traffic: 1.25, desc: '饮料和饭团好卖' },
  { id: 'concert', name: '体育馆演唱会', icon: '🎤', traffic: 1.35, desc: '散场后人潮涌来' },
  { id: 'koji', name: '门前道路施工', icon: '🚧', traffic: 0.75, desc: '路过的人变少了' },
  { id: 'sale', name: '对面超市大促', icon: '🏷️', traffic: 0.8, desc: '客人被抢走了一些' },
];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_TRAFFIC = [1.12, 0.95, 0.95, 0.97, 1.0, 1.12, 1.18];

/* ---------------- 员工素材 ---------------- */
// 时薪 (元/小时)：最低 20 元；夜班 ×1.5，周末 +2 元
const WAGE_MIN = 20, WAGE_MAX = 36, NIGHT_RATE = 1.5, WEEKEND_BONUS = 2;
const SHIFTS = {
  morning: { name: '早班', time: '6:00-14:00', from: 6, to: 14 },
  evening: { name: '晚班', time: '14:00-22:00', from: 14, to: 22 },
  night: { name: '夜班', time: '22:00-6:00', from: 22, to: 6, bonus: NIGHT_RATE },
};
const STAT_NAMES = { cashier: '收银', stock: '补货', service: '服务', stamina: '体力' };

const TRAITS = [
  { id: 'genki', name: '元气满满', jp: '元気', mod: { service: 1 }, desc: '声音洪亮，客人心情会变好' },
  { id: 'majime', name: '认真', jp: '真面目', mod: { stock: 1 }, desc: '做事一丝不苟，从不迟到' },
  { id: 'nonbiri', name: '慢性子', jp: 'のんびり', mod: { cashier: -1, stamina: 1 }, desc: '不急不躁，就是收银有点慢' },
  { id: 'doji', name: '冒失鬼', jp: 'ドジっ子', mod: {}, desc: '补货时偶尔会摔坏商品' },
  { id: 'chatty', name: '话痨', jp: 'おしゃべり', mod: { service: 1, cashier: -1 }, desc: '爱和客人聊天，常客很喜欢' },
  { id: 'shy', name: '怕生', jp: '人見知り', mod: { service: -1, stock: 1 }, desc: '不擅长接待，更喜欢整理货架' },
  { id: 'quick', name: '手脚麻利', jp: 'テキパキ', mod: { cashier: 1, stock: 1 }, desc: '干活效率很高' },
  { id: 'math', name: '心算达人', jp: '計算が得意', mod: { cashier: 1 }, desc: '收银又快又准' },
  { id: 'owl', name: '夜猫子', jp: '夜型', mod: {}, desc: '上夜班时全能力 +1' },
  { id: 'lark', name: '早起鸟', jp: '朝型', mod: {}, desc: '上早班时全能力 +1' },
  { id: 'tough', name: '体力派', jp: '体育会系', mod: { stamina: 1, stock: 1 }, desc: '搬货完全不累' },
  { id: 'healing', name: '治愈系', jp: '癒し系', mod: { service: 1 }, desc: '排队的客人会更有耐心' },
  { id: 'slacker', name: '爱摸鱼', jp: 'サボり癖', mod: { stock: -1 }, desc: '时不时会偷懒发呆' },
  { id: 'veteran', name: '便利店老手', jp: 'ベテラン', mod: { cashier: 1, stock: 1, service: 1 }, desc: '在别的便利店干过很多年' },
  { id: 'perfect', name: '完美主义', jp: '几帳面', mod: { stock: 1, cashier: -1 }, desc: '货架摆得整整齐齐，但有点慢' },
];
const TRAIT_BY_ID = Object.fromEntries(TRAITS.map(t => [t.id, t]));

const SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水', '森', '池田', '橋本', '石川', '前田', '藤田', '小川', '岡田', '後藤', '長谷川', '村上', '近藤', '坂本', '遠藤', '青木', '藤井', '西村', '福田', '太田', '三浦', '星野', '雨宮', '桜井', '早川'];
const GIVEN_M = ['翔太', '大輝', '蓮', '悠斗', '健太', '拓海', '陽翔', '颯太', '誠', '浩二', '隆', '亮', '直樹', '和也', '慎吾', '大和', '湊', '樹', '修', '勇気', '光', '一郎', '健一', '達也'];
const GIVEN_F = ['陽菜', '結衣', 'さくら', '美咲', '葵', '凛', '七海', '彩花', '真由美', '恵子', '由美', '芽衣', '紬', '遥', '千尋', '詩織', '桃子', '舞', '杏', '雪乃', '久美子', '明美', 'ひかり', '莉子'];
const FOREIGN = [
  { name: 'グエン・ヴァン・ナム', from: '越南', g: 'm' }, { name: 'チャン・ティ・ラン', from: '越南', g: 'f' },
  { name: 'リー・ウェイ', from: '中国', g: 'm' }, { name: 'ワン・メイ', from: '中国', g: 'f' },
  { name: 'マリア・サントス', from: '菲律宾', g: 'f' }, { name: 'ラジ・クマール', from: '尼泊尔', g: 'm' },
  { name: 'キム・ジフン', from: '韩国', g: 'm' }, { name: 'パク・ソヨン', from: '韩国', g: 'f' },
  { name: 'アニタ・タパ', from: '尼泊尔', g: 'f' }, { name: 'ソムチャイ', from: '泰国', g: 'm' },
];
const APPLICANT_TYPES = [
  { id: 'hs', name: '高中生', w: 0.14, age: [16, 18], shift: ['evening'], mod: { stamina: 1, service: -1 }, wage: -2 },
  { id: 'uni', name: '大学生', w: 0.26, age: [18, 23], shift: ['evening', 'night'], mod: {}, wage: 0 },
  { id: 'freeter', name: '自由职业', w: 0.18, age: [20, 38], shift: ['morning', 'evening', 'night'], mod: { stock: 1 }, wage: 1 },
  { id: 'parent', name: '家庭主妇/主夫', w: 0.12, age: [30, 52], shift: ['morning'], mod: { service: 1 }, wage: 0 },
  { id: 'senior', name: '退休人员', w: 0.1, age: [60, 72], shift: ['morning'], mod: { stamina: -1, service: 1 }, wage: -1 },
  { id: 'intl', name: '留学生', w: 0.14, age: [19, 29], shift: ['evening', 'night'], mod: { stamina: 1 }, wage: 0 },
  { id: 'side', name: '上班族副业', w: 0.06, age: [25, 45], shift: ['night'], mod: { cashier: 1 }, wage: 2 },
];
const SCHOOLS = {
  hs: ['都立雨宿高等学校', '私立星ヶ丘高校', '県立港南高校', '青葉学園高等部'],
  uni: ['東都大学 经济学部', '港南大学 文学部', '雨宿工業大学 情报学部', '青葉女子大学 家政学部', '星ヶ丘大学 法学部', '都立芸术大学 美术学部'],
  adult: ['都立雨宿高等学校 毕业', '港南大学 经济学部 毕业', '星ヶ丘短期大学 毕业', '雨宿商业高校 毕业', '东都专门学校 料理科 毕业', '县立第一高校 毕业'],
  intl: ['青叶日本语学校', '东都日本语学院', '港南大学 留学生别科', '雨宿国际学院 商务日语科'],
};
const PAST_JOBS = [
  { t: '家庭餐厅 服务员', s: 'service' }, { t: '居酒屋 厨房帮工', s: 'stamina' }, { t: '书店 店员', s: 'stock' },
  { t: '搬家公司 临时工', s: 'stamina' }, { t: '加油站 店员', s: 'service' }, { t: '工厂流水线', s: 'stock' },
  { t: '补习班 讲师', s: 'cashier' }, { t: '送报纸', s: 'stamina' }, { t: '其他便利店 店员', s: 'cashier' },
  { t: '超市 理货员', s: 'stock' }, { t: '贸易公司 营业职', s: 'service' }, { t: '银行 柜台', s: 'cashier' },
  { t: '咖啡店 咖啡师', s: 'service' }, { t: '快递分拣', s: 'stock' }, { t: '游乐园 工作人员', s: 'service' },
];
const LICENSES = ['普通汽车驾照', '英检 2 级', '珠算 3 级', '日本语能力考试 N2', '日本语能力考试 N1', '食品卫生责任者', '汉字检定 3 级', '秘书检定 2 级', 'TOEIC 650 分', '急救员资格', '无'];
const HOBBIES = ['打游戏', '做饭', '看书', '钓鱼', '唱卡拉OK', '看动漫', '健身', '拍照', '撸猫', '种花', '下将棋', '看电影', '逛古着店', '听落语', '跑步', '画画', '泡温泉', '追偶像', '做手工', '研究便利店新品'];
const MOTIVES = {
  hs: ['想赚点零花钱买新手机。', '想攒钱和朋友去旅行。', '想体验一下社会工作。'],
  uni: ['想赚学费和生活费。', '离学校近，下课就能来上班。', '想在毕业前多积累些工作经验。', '晚上时间比较自由。'],
  freeter: ['想找一份长期稳定的工作。', '正在为梦想（乐队）存钱。', '家就在附近，通勤方便。', '喜欢便利店的工作节奏。'],
  parent: ['孩子上学的时间想出来工作。', '想补贴家用。', '想和社会多一些接触。'],
  senior: ['退休后想活动活动身体。', '想多和年轻人交流。', '在家闲不住。'],
  intl: ['想一边打工一边练习日语。', '想赚生活费，也想多了解日本。', '朋友推荐这家店，说店长人很好。'],
  side: ['本职下班后想赚些外快。', '为了还房贷。', '想换换心情，做点不一样的工作。'],
};
const PR_BY_TRAIT = {
  genki: '声音大是我最大的优点！「いらっしゃいませ」交给我！', majime: '学生时代全勤，从没迟到过。', nonbiri: '性格温和，从来不发脾气。',
  doji: '虽然有时候会犯小错，但我会努力的！', chatty: '很喜欢和人聊天，很快就能和客人混熟。', shy: '不太会说话，但做事很细心。',
  quick: '做事讲究效率，一个人能顶两个人用。', math: '心算很快，找零从来没出过错。', owl: '越到深夜越精神。', lark: '每天五点自然醒。',
  tough: '高中时是棒球部的，体力没问题。', healing: '大家都说和我在一起很放松。', slacker: '……会好好干的（大概）。',
  veteran: '在别的便利店做了五年，什么都会。', perfect: '看到货架不整齐就忍不住要整理。',
};
const AREAS = ['雨宿町一丁目', '雨宿町二丁目', '雨宿町五丁目', '星ヶ丘四丁目', '港南台', '青叶町', '旭町', '樱木町'];

/* 外观素材 */
const LOOKS = {
  shirt: ['#e76f51', '#2a9d8f', '#264653', '#e9c46a', '#f4a261', '#8d99ae', '#6d597a', '#b5838d', '#457b9d', '#f1f1ee', '#3d405b', '#9c6644'],
  pants: ['#22223b', '#4a4e69', '#6b705c', '#2b2d42', '#3a3a3a', '#5e548e', '#1d3557'],
  hair: ['#1b1b1b', '#2b211c', '#4a3426', '#7a7a7a', '#c9a26b', '#1b1b1b', '#6b2e1e', '#3b2a4a'],
  hairOld: ['#9a9a9a', '#c9c9c9', '#7a7a7a', '#e6e6e6'],
  skin: ['#f6dcc3', '#f1d3b3', '#e8c39e', '#d9a77f', '#b98463'],
  umb: ['clear', 'clear', 'clear', '#1d3557', '#e63946', '#2a9d8f', '#f4a261', '#6d597a'],
};
