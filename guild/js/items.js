/* ギルドの灯 — items: 装備・能力・強化・技・持ち物（ハクスラ）
 *  装備は 武器 / 防具 / 装飾品 の3枠。レア度は N / R / SR / SSR / UR。
 *  - 主能力：武器＝攻撃%、防具＝成功率、装飾品＝大成功率（アイテムLvと強化値で伸びる）
 *  - 追加能力：レア度ぶんだけランダムに付く（R=1 … UR=4）。いちばん強い能力が名前の頭に付く
 *  - 強化：強化石とゴールドで +10 まで。+6 からは失敗することがある（壊れない）
 *  - 分解：いらない装備は強化石に
 *  - 技：閃き・閃きの書で覚える。セットした技だけが効く（2枠、Lv20 で3枠）
 *  - 持ち物：砂時計（倍速）、時短の巻物、黄金の祝福、四つ葉、宝箱の鍵、強化石、書
 */
'use strict';
(function () {
  const IT = (G.items = {});

  IT.RARITY = [
    { id: 'N', name: 'ノーマル', stars: 1, color: '#c9c0b0', glow: '#e8e0d0', mul: 1, sell: 20, stone: 1 },
    { id: 'R', name: 'レア', stars: 2, color: '#6ab4ff', glow: '#bfe2ff', mul: 1.15, sell: 60, stone: 3 },
    { id: 'SR', name: 'スーパーレア', stars: 3, color: '#c27cff', glow: '#ead2ff', mul: 1.32, sell: 180, stone: 8 },
    { id: 'SSR', name: 'ダブルスーパーレア', stars: 4, color: '#ffc83a', glow: '#fff0b0', mul: 1.55, sell: 600, stone: 20 },
    { id: 'UR', name: 'アルティメット', stars: 5, color: '#ff7ab8', glow: '#ffffff', mul: 1.9, sell: 2000, stone: 50, rainbow: true },
  ];
  IT.SLOTS = ['weapon', 'armor', 'acc'];
  IT.SLOT_NAME = { weapon: '武器', armor: '防具', acc: '装飾品' };

  // 装備の種類（[N, R, SR, SSR, UR] の名前）
  IT.EQUIP = {
    sword: { slot: 'weapon', cls: 'warrior', icon: 'sword', names: ['錆びた剣', '鋼のロングソード', '蒼月の剣', '竜牙の大剣', '聖剣ルミナス'] },
    staff: { slot: 'weapon', cls: 'mage', icon: 'staff', names: ['樫の杖', '魔石の杖', '星詠みのロッド', '賢者の霊杖', '天球儀の杖アストラ'] },
    dagger: { slot: 'weapon', cls: 'thief', icon: 'dagger', names: ['果物ナイフ', '盗賊のダガー', '影縫いの短刀', '夜鴉の双刃', '月喰らい'] },
    mace: { slot: 'weapon', cls: 'cleric', icon: 'mace', names: ['木の聖印', '銀のメイス', '祈りの錫杖', '聖女の鐘', '灯火の聖槌'] },
    bow: { slot: 'weapon', cls: 'archer', icon: 'bow', names: ['狩人の弓', '樫の長弓', '風切りの弓', '翠玉の神弓', '星穿ちの弓'] },
    lance: { slot: 'weapon', cls: 'knight', icon: 'lance', names: ['見習いの槍', '騎士の槍', '白銀のランス', '竜騎士の聖槍', '王槍グラディウス'] },
    lute: { slot: 'weapon', cls: 'bard', icon: 'lute', names: ['古びたリュート', '旅のリュート', '月光の竪琴', '妖精王のハープ', '天上の調べ'] },
    flask: { slot: 'weapon', cls: 'alchemist', icon: 'flask', names: ['ガラスのフラスコ', '錬金術の小瓶', '賢者の蒸留器', 'エリクサーの瓶', '創世のアランビック'] },
    armor: { slot: 'armor', icon: 'armor', names: ['布の服', '革の鎧', 'ミスリルの胸当て', '竜鱗の鎧', '灯王の鎧'] },
    robe: { slot: 'armor', icon: 'robe', names: ['旅人のローブ', '魔導士のローブ', '星織りの法衣', '月影の聖衣', '天衣ルミナリア'] },
    charm: { slot: 'acc', icon: 'charm', names: ['木彫りのお守り', '銀の首飾り', '妖精の首飾り', '不死鳥の羽根', '女神の涙'] },
    ring: { slot: 'acc', icon: 'ring', names: ['銅の指輪', '銀の指輪', '紅玉の指輪', '竜眼の指輪', '永遠の環'] },
  };
  IT.EQUIP_IDS = Object.keys(IT.EQUIP);

  // 能力
  IT.STAT = {
    atk: { name: '攻撃', lo: 3, hi: 8, prefix: '猛き', cap: 999 },
    crit: { name: '会心率', lo: 3, hi: 8, prefix: '鋭き', cap: 60 },
    succ: { name: '成功率', lo: 1, hi: 3, prefix: '守りの', cap: 25 },
    great: { name: '大成功率', lo: 1, hi: 2.5, prefix: '幸運の', cap: 20 },
    speed: { name: '遠征時間短縮', lo: 2, hi: 6, prefix: '疾風の', cap: 40 },
    gold: { name: '獲得ゴールド', lo: 4, hi: 12, prefix: '黄金の', cap: 100 },
    exp: { name: '獲得経験値', lo: 5, hi: 15, prefix: '賢者の', cap: 100 },
    find: { name: 'レア発見', lo: 5, hi: 15, prefix: '探求の', cap: 150 },
    mat: { name: '素材', lo: 6, hi: 16, prefix: '職人の', cap: 100 },
  };
  IT.STAT_IDS = Object.keys(IT.STAT);
  IT.MAIN = { weapon: { k: 'atk', base: [6, 10, 16, 24, 34] }, armor: { k: 'succ', base: [2, 3, 4, 6, 8] }, acc: { k: 'great', base: [1, 2, 3, 4.5, 6] } };
  const AREA_ILV = [[1, 6], [6, 16], [16, 28], [28, 42], [42, 60], [58, 76], [74, 92]];
  IT.MAX_ILV = 150;

  // 秘宝（集めるとギルド全体が少し強くなる）
  IT.RELICS = [
    { id: 'map', r: 1, name: '古びた冒険地図', desc: '遠征時間 -4%', fx: { speed: 0.04 } },
    { id: 'bell', r: 1, name: '銀の鈴', desc: '冒険譚の応援で絆が深まりやすい', fx: { bond: 0.25 } },
    { id: 'mug', r: 2, name: '金のジョッキ', desc: '酒場のチップ +12%', fx: { tip: 0.12 } },
    { id: 'harp', r: 2, name: '吟遊詩人の竪琴', desc: '投げ銭が届きやすい', fx: { gift: 0.5 } },
    { id: 'grail', r: 3, name: '灯火の聖杯', desc: '大成功率 +3%', fx: { great: 0.03 } },
    { id: 'scale', r: 3, name: '紅蓮竜の鱗', desc: '全員の戦力 +6%', fx: { pow: 0.06 } },
    { id: 'lantern', r: 4, name: '始まりのランタン', desc: '戦力 +8%・ゴールド +8%', fx: { pow: 0.08, gold: 0.08 } },
  ];
  IT.RELIC = {};
  IT.RELICS.forEach((r) => (IT.RELIC[r.id] = r));

  // 技（閃き・閃きの書で覚える。セットした技が効く）
  IT.SKILLS = {
    warrior: { 烈風斬: { atk: 8 }, '剛断・灯火割り': { crit: 8 }, 獅子奮迅撃: { atk: 6, succ: 2 }, 大地裂き: { great: 3 }, 十文字斬り: { crit: 6, atk: 4 }, 流星剣: { atk: 12 } },
    mage: { 蒼炎の槍: { atk: 10 }, 星降りの陣: { great: 3 }, 雷鳴の輪舞: { crit: 8 }, 氷華結界: { succ: 4 }, 紅蓮の柱: { atk: 12 }, 月光砲: { find: 15 } },
    thief: { 影縫い: { succ: 3 }, 月下千刃: { crit: 10 }, 燕返し: { speed: 6 }, 夜霧の舞: { gold: 15 }, 乱れ椿: { atk: 8 } },
    cleric: { 聖灯の祈り: { succ: 5 }, 天使の鐘: { exp: 15 }, 光輪の裁き: { atk: 8 }, 浄化の陽: { great: 3 } },
    archer: { 流星の矢: { crit: 8 }, 風穿ち: { speed: 6 }, 千里一射: { atk: 10 }, 五月雨撃ち: { atk: 6, crit: 4 }, 翠嵐の矢: { find: 15 } },
    knight: { 聖盾突撃: { atk: 8 }, 不動の誓い: { succ: 5 }, 蒼天の槍: { crit: 8 }, '王剣・灯守り': { atk: 10, succ: 2 } },
    bard: { 勇気の歌: { great: 3 }, 眠りの子守唄: { succ: 4 }, 英雄譚の詩: { exp: 15 }, 喝采のフィナーレ: { gold: 15 } },
    alchemist: { 爆裂フラスコ: { atk: 10 }, 賢者の霧: { find: 15 }, 黄金錬成: { gold: 15 }, 万能薬の雨: { succ: 4 } },
  };
  IT.skillFx = (cls, name) => (IT.SKILLS[cls] && IT.SKILLS[cls][name]) || null;
  IT.skillSlots = (a) => (a.lv >= 20 ? 3 : 2);
  IT.skillDesc = (cls, name, lv = 1) => {
    const fx = IT.skillFx(cls, name);
    if (!fx) return '';
    return Object.entries(fx).map(([k, v]) => `${IT.STAT[k].name} +${fmtV(v * (1 + 0.25 * (lv - 1)))}%`).join('・');
  };

  // 持ち物
  IT.CONS = {
    hg2: { name: '疾風の砂時計', desc: '30分間、遠征と建設が2倍の速さで進む', icon: 'hourglass', rarity: 2, boost: { k: 'speed', mult: 2, sec: 1800 } },
    hg3: { name: '神速の砂時計', desc: '30分間、遠征と建設が3倍の速さで進む', icon: 'hourglass3', rarity: 3, boost: { k: 'speed', mult: 3, sec: 1800 } },
    finish: { name: '時短の巻物', desc: '遠征中のパーティ1組を、すぐに帰還させる', icon: 'scroll', rarity: 1, use: 'finish' },
    horn: { name: '帰還の角笛', desc: '遠征中のパーティ全員を、すぐに帰還させる', icon: 'horn', rarity: 3, use: 'horn' },
    goldx2: { name: '黄金の祝福', desc: '30分間、依頼で手に入るゴールドが2倍', icon: 'coinbag', rarity: 2, boost: { k: 'gold', mult: 2, sec: 1800 } },
    luck: { name: '幸運の四つ葉', desc: '30分間、大成功率 +10%', icon: 'clover', rarity: 2, boost: { k: 'luck', add: 0.1, sec: 1800 } },
    key: { name: '宝箱の鍵', desc: '黄金の宝箱を1回開けられる', icon: 'key', rarity: 2, use: 'key' },
    stone: { name: '強化石', desc: '装備の強化に使う。いらない装備を分解しても手に入る', icon: 'stone', rarity: 0 },
    book: { name: '閃きの書', desc: '冒険者1人が、新しい技を1つ閃く（覚えている技なら技Lvが上がる）', icon: 'book', rarity: 3, use: 'book' },
    shard: { name: '虹の欠片', desc: 'URの装備を限界突破するのに使う。深淵の迷宮の守護者や、URの分解で手に入る', icon: 'shard', rarity: 4 },
    expbook: { name: '経験の書', desc: '冒険者1人に、たっぷり経験値を与える', icon: 'book2', rarity: 1, use: 'exp' },
  };
  IT.CONS_ORDER = ['hg3', 'hg2', 'horn', 'finish', 'goldx2', 'luck', 'key', 'book', 'expbook', 'shard', 'stone'];
  IT.BOOST_NAME = { speed: '倍速', gold: 'ゴールド2倍', luck: '大成功アップ' };

  // ---------------------------------------------------------------- 抽選
  const pickW = (rnd, arr, wf) => {
    let t = 0;
    arr.forEach((x) => (t += wf(x)));
    let r = rnd() * t;
    for (const x of arr) { r -= wf(x); if (r <= 0) return x; }
    return arr[arr.length - 1];
  };
  const TABLE = {
    ok: [58, 30, 9, 2.6, 0.4],
    great: [26, 40, 23, 9, 2],
    legend: [0, 18, 40, 30, 12],
    gift: [30, 40, 22, 7, 1],
    chest: [40, 35, 18, 6, 1],
    free: [62, 30, 7, 1, 0],
  };
  IT.dropChance = { fail: 0, ok: 0.28, great: 0.6, legend: 1 };

  IT.rollRarity = function (rnd, kind, areaIdx = 0, find = 0) {
    const w = TABLE[kind].slice();
    for (let i = 0; i < areaIdx; i++) { w[0] *= 0.82; w[3] *= 1.08; w[4] *= 1.08; }
    // レア発見：上のレア度ほど重みが増える
    const f = 1 + find / 100;
    w[2] *= f; w[3] *= f * f; w[4] *= f * f;
    return pickW(rnd, [0, 1, 2, 3, 4], (i) => w[i]);
  };
  IT.ilvFor = (rnd, areaIdx) => {
    const [a, b] = AREA_ILV[G.clamp(areaIdx | 0, 0, AREA_ILV.length - 1)];
    return Math.round(G.lerp(a, b, rnd()));
  };
  IT.maxArea = () => {
    const st = G.state;
    return st ? Math.max(0, (G.sim ? G.sim.unlockedAreas(st) : G.D.AREAS.filter((a) => a.rank <= st.rank)).reduce((m, a) => Math.max(m, a.index), 0)) : 0;
  };
  const fmtV = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  IT.fmtV = fmtV;

  function rollAffixes(rnd, n, ilv, rarity, slot) {
    const main = IT.MAIN[slot].k;
    const pool = IT.STAT_IDS.filter((k) => k !== main);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const S = IT.STAT[k];
      const v = G.lerp(S.lo, S.hi, rnd()) * IT.RARITY[rarity].mul * (1 + 0.01 * (ilv - 1));
      out.push({ k, v: Math.round(v * 10) / 10, q: (v / (S.hi * IT.RARITY[rarity].mul)) });
    }
    return out;
  }
  function nameOf(it) {
    const base = IT.EQUIP[it.tid].names[it.rarity];
    if (it.rarity === 0 || it.rarity === 4 || !it.affixes || !it.affixes.length) return base;
    const top = it.affixes.slice().sort((a, b) => b.q - a.q)[0];
    return IT.STAT[top.k].prefix + base;
  }
  IT.nameOf = nameOf;

  IT.make = function (rnd, rarity, opt = {}) {
    // 秘宝は SR 以上でまれに
    const relicPool = IT.RELICS.filter((r) => r.r <= rarity && r.r >= rarity - 1);
    if (!opt.noRelic && relicPool.length && rarity >= 2 && rnd() < 0.14) {
      const rel = relicPool[Math.floor(rnd() * relicPool.length)];
      return { uid: uid(), kind: 'relic', rid: rel.id, rarity: rel.r, name: rel.name };
    }
    let tid = opt.tid;
    if (!tid) {
      let pool = IT.EQUIP_IDS;
      if (opt.slot) pool = pool.filter((id) => IT.EQUIP[id].slot === opt.slot);
      // 職業に合う武器が出やすい
      if (opt.cls && rnd() < 0.6) {
        const w = pool.filter((id) => IT.EQUIP[id].cls === opt.cls);
        if (w.length) pool = w;
      }
      tid = pool[Math.floor(rnd() * pool.length)];
    }
    const e = IT.EQUIP[tid];
    const ilv = opt.ilv || IT.ilvFor(rnd, opt.area != null ? opt.area : IT.maxArea());
    const it = { uid: uid(), kind: 'equip', tid, slot: e.slot, rarity, ilv, plus: 0, affixes: rollAffixes(rnd, rarity, ilv, rarity, e.slot), isNew: true };
    it.name = nameOf(it);
    return it;
  };
  let seq = 0;
  function uid() { return 'i' + Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  // 依頼の戦利品
  IT.rollDrop = function (rnd, tier, areaIdx, party, find = 0, o = {}) {
    if (rnd() >= Math.min(1, IT.dropChance[tier] * (1 + find / 200))) return null;
    const rarity = IT.rollRarity(rnd, tier, areaIdx, find);
    const cls = party.length && rnd() < 0.55 ? party[Math.floor(rnd() * party.length)].cls : null;
    return IT.make(rnd, rarity, { cls, area: areaIdx, ilv: o.ilv });
  };
  // おまけ（魔晶石・持ち物）
  IT.rollLoot = function (rnd, tier, areaIdx, find = 0) {
    const out = [];
    const f = 1 + find / 200;
    const add = (id, n) => { const ex = out.find((x) => x.id === id); if (ex) ex.n += n; else out.push({ id, n }); };
    const p = { fail: 0.05, ok: 0.22, great: 0.5, legend: 1 }[tier] * f;
    if (rnd() < p) add('stone', 1 + Math.floor(rnd() * (2 + areaIdx)));
    if (rnd() < p * 0.45) add('cry', [3, 5, 8, 10, 15][Math.floor(rnd() * 5)] + areaIdx * 2);
    if (rnd() < p * 0.12) add(pickW(rnd, ['finish', 'expbook', 'hg2', 'goldx2', 'luck', 'key'], (k) => ({ finish: 4, expbook: 3, hg2: 1.5, goldx2: 1.5, luck: 1.5, key: 1 })[k]), 1);
    if (tier === 'legend' && rnd() < 0.3) add(rnd() < 0.5 ? 'book' : 'hg3', 1);
    return out;
  };
  IT.rollGift = function (rnd) {
    const rarity = IT.rollRarity(rnd, 'gift');
    return IT.make(rnd, rarity, { noRelic: true });
  };

  // ---------------------------------------------------------------- 能力の計算
  IT.mainVal = function (it, adv) {
    const m = IT.MAIN[it.slot];
    let v = m.base[it.rarity] * (1 + 0.015 * (it.ilv - 1)) * (1 + 0.08 * (it.plus || 0)) * (1 + 0.1 * (it.lb || 0));
    if (adv && it.slot === 'weapon') {
      const e = IT.EQUIP[it.tid];
      if (e.cls && e.cls !== adv.cls) v *= 0.5;
    }
    return v;
  };
  IT.fits = (it, adv) => { const e = IT.EQUIP[it.tid]; return !e.cls || e.cls === adv.cls; };
  // 1つの装備の能力 { atk, succ, ... }
  IT.itemStats = function (it, adv) {
    const s = {};
    if (!it || it.kind !== 'equip') return s;
    const m = IT.MAIN[it.slot];
    s[m.k] = (s[m.k] || 0) + IT.mainVal(it, adv);
    const pm = 1 + 0.04 * (it.plus || 0);
    (it.affixes || []).forEach((a) => { s[a.k] = (s[a.k] || 0) + a.v * pm; });
    return s;
  };
  // 冒険者の能力（装備＋技）
  IT.advStats = function (adv) {
    const s = {};
    const addAll = (o, mul = 1) => Object.entries(o).forEach(([k, v]) => { s[k] = (s[k] || 0) + v * mul; });
    IT.equipped(adv).forEach((it) => addAll(IT.itemStats(it, adv)));
    const sb = IT.setBonus(adv);
    if (sb) addAll(sb.fx);
    (adv.skillSet || []).forEach((n) => {
      const fx = IT.skillFx(adv.cls, n);
      if (fx) addAll(fx, 1 + 0.25 * (((adv.sk || {})[n] || 1) - 1));
    });
    return s;
  };
  // パーティの合計（上限つき）
  IT.partyStats = function (party) {
    const s = {};
    party.forEach((a) => Object.entries(IT.advStats(a)).forEach(([k, v]) => { if (k !== 'atk') s[k] = (s[k] || 0) + v; }));
    Object.keys(s).forEach((k) => { s[k] = Math.min(IT.STAT[k].cap, s[k]); });
    return s;
  };
  IT.powMul = function (adv) {
    const st = IT.advStats(adv);
    const sb = IT.setBonus(adv);
    const star = G.sim && G.sim.starFx ? G.sim.starFx('pow') : 0;
    return (1 + (st.atk || 0) / 100) * (1 + IT.relicFx('pow')) * (1 + (sb ? sb.pow : 0)) * (1 + star);
  };
  // そろいボーナス：3枠すべてを SR 以上でそろえると、いちばん低いレア度に応じて強くなる
  IT.SETS = [
    null,
    null,
    { name: 'SRそろい', pow: 0.05, fx: {}, desc: '戦力 +5%' },
    { name: 'SSRそろい', pow: 0.1, fx: { great: 2 }, desc: '戦力 +10%・大成功率 +2%' },
    { name: 'URそろい', pow: 0.18, fx: { great: 3, crit: 10 }, desc: '戦力 +18%・大成功率 +3%・会心率 +10%' },
  ];
  IT.setBonus = function (adv) {
    const eq = IT.equipped(adv);
    if (eq.length < 3) return null;
    const lo = Math.min(...eq.map((it) => it.rarity));
    return IT.SETS[lo] ? Object.assign({ tier: lo }, IT.SETS[lo]) : null;
  };
  IT.relicFx = function (key) {
    const st = G.state;
    if (!st || !st.relics) return 0;
    let v = 0;
    Object.keys(st.relics).forEach((id) => { const r = IT.RELIC[id]; if (r && r.fx[key]) v += r.fx[key]; });
    return v;
  };
  // 装備の点数（おまかせ装備・比較用）
  IT.score = function (it, adv) {
    const s = IT.itemStats(it, adv);
    const w = { atk: 1, crit: 0.35, succ: 2.2, great: 2.4, speed: 0.9, gold: 0.5, exp: 0.4, find: 0.35, mat: 0.3 };
    return Object.entries(s).reduce((x, [k, v]) => x + v * (w[k] || 0.3), 0);
  };

  // ---------------------------------------------------------------- 所持
  IT.get = (u) => (G.state.items || []).find((x) => x.uid === u) || null;
  IT.equipped = function (adv) {
    const eq = adv.eq || {};
    return IT.SLOTS.map((s) => (eq[s] ? IT.get(eq[s]) : null)).filter(Boolean);
  };
  IT.equippedBy = function (u) {
    return G.state.adv.find((a) => a.eq && IT.SLOTS.some((s) => a.eq[s] === u)) || null;
  };
  IT.add = function (item) {
    const st = G.state;
    if (!st.items) st.items = [];
    if (item.kind === 'relic') {
      if (!st.relics) st.relics = {};
      if (st.relics[item.rid]) {
        const gem = [5, 10, 20, 40, 80][item.rarity];
        st.crystals = (st.crystals || 0) + gem;
        return { dup: true, crystals: gem };
      }
      st.relics[item.rid] = 1;
      G.emit('itemsChanged');
      return { relic: true };
    }
    if (item.kind === 'cons') { IT.addCons(item.id, item.n || 1); return { cons: true }; }
    st.items.push(item);
    let auto = null;
    if (st.items.length > 150) {
      // 持ちきれないときは、装備していない・鍵のない一番弱いものを分解
      const free = st.items.filter((x) => !x.lock && !IT.equippedBy(x.uid) && x !== item).sort((a, b) => a.rarity - b.rarity || a.ilv - b.ilv);
      if (free[0]) auto = IT.dismantle(free[0].uid, true);
    }
    st.dex = st.dex || {};
    st.dex[item.tid + ':' + item.rarity] = 1;
    G.emit('itemsChanged');
    return { added: true, auto };
  };
  IT.equip = function (advId, u, slot) {
    const st = G.state;
    const a = st.adv.find((x) => x.id === advId);
    if (!a) return false;
    a.eq = a.eq || {};
    if (!u) { if (slot) a.eq[slot] = null; G.emit('itemsChanged'); return true; }
    const it = IT.get(u);
    if (!it) return false;
    const other = IT.equippedBy(u);
    if (other && other !== a) other.eq[it.slot] = null;
    a.eq[it.slot] = u;
    it.isNew = false;
    G.emit('itemsChanged');
    return true;
  };
  IT.sell = function (u) {
    const st = G.state;
    const it = IT.get(u);
    if (!it || it.lock || IT.equippedBy(u)) return 0;
    st.items.splice(st.items.indexOf(it), 1);
    const g = Math.round(IT.RARITY[it.rarity].sell * (1 + it.ilv / 20) * (1 + 0.3 * (it.plus || 0)));
    st.gold += g;
    G.emit('itemsChanged');
    return g;
  };
  IT.dismantleValue = (it) => IT.RARITY[it.rarity].stone + (it.plus || 0) * 2 + Math.floor(it.ilv / 15);
  IT.dismantle = function (u, silent) {
    const st = G.state;
    const it = IT.get(u);
    if (!it || it.lock || IT.equippedBy(u)) return 0;
    st.items.splice(st.items.indexOf(it), 1);
    const n = IT.dismantleValue(it);
    IT.addCons('stone', n);
    if (it.rarity >= 4) IT.addCons('shard', 2 + (it.lb || 0));
    if (!silent) G.emit('itemsChanged');
    return n;
  };
  IT.bulkDismantle = function (maxRarity) {
    const st = G.state;
    const list = (st.items || []).filter((x) => x.rarity <= maxRarity && !x.lock && !IT.equippedBy(x.uid));
    let n = 0;
    list.forEach((x) => { n += IT.dismantle(x.uid, true); });
    G.emit('itemsChanged');
    return { count: list.length, stones: n };
  };

  // ---------------------------------------------------------------- 強化
  IT.MAX_PLUS = 10;
  IT.maxPlus = (it) => IT.MAX_PLUS + 2 * (it.lb || 0);
  IT.enhanceCost = function (it) {
    const p = it.plus || 0;
    const g = Math.pow(1.55, Math.min(p, 10)) * Math.pow(1.25, Math.max(0, p - 10));
    return { gold: Math.round(30 * (it.rarity + 1) * (1 + it.ilv / 12) * g), stone: 1 + p + it.rarity };
  };
  IT.enhanceRate = (it) => [1, 1, 1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.36, 0.33, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2][it.plus || 0] || 0;
  IT.enhance = function (u) {
    const st = G.state;
    const it = IT.get(u);
    if (!it || (it.plus || 0) >= IT.maxPlus(it)) return { ok: false, why: 'max' };
    const c = IT.enhanceCost(it);
    if (st.gold < c.gold) return { ok: false, why: 'gold' };
    if (IT.cons('stone') < c.stone) return { ok: false, why: 'stone' };
    st.gold -= c.gold;
    IT.addCons('stone', -c.stone);
    const success = Math.random() < IT.enhanceRate(it);
    if (success) it.plus = (it.plus || 0) + 1;
    st.stats.enhance = (st.stats.enhance || 0) + 1;
    G.emit('itemsChanged');
    return { ok: true, success, plus: it.plus };
  };

  // 限界突破（URだけ）：虹の欠片で ★ が増え、主能力 +10%・強化の上限 +2
  IT.MAX_LB = 5;
  IT.lbCost = (it) => [2, 3, 4, 5, 6][it.lb || 0] || 0;
  IT.canLimitBreak = (it) => it && it.kind === 'equip' && it.rarity >= 4 && (it.lb || 0) < IT.MAX_LB;
  IT.limitBreak = function (u) {
    const it = IT.get(u);
    if (!IT.canLimitBreak(it)) return { ok: false, why: 'max' };
    const c = IT.lbCost(it);
    if (IT.cons('shard') < c) return { ok: false, why: 'shard' };
    IT.addCons('shard', -c);
    it.lb = (it.lb || 0) + 1;
    G.state.stats.limitBreaks = (G.state.stats.limitBreaks || 0) + 1;
    G.emit('itemsChanged');
    return { ok: true, lb: it.lb };
  };
  // 追加能力の付け直し（魔晶石）：選んだ1つを引き直す。結果を見て元に戻すこともできる
  IT.rerollCost = (it) => [0, 10, 20, 40, 80][it.rarity] || 0;
  IT.reroll = function (u, idx) {
    const st = G.state;
    const it = IT.get(u);
    if (!it || !it.affixes || !it.affixes[idx]) return { ok: false, why: 'none' };
    const cost = IT.rerollCost(it);
    if ((st.crystals || 0) < cost) return { ok: false, why: 'cry' };
    st.crystals -= cost;
    const old = Object.assign({}, it.affixes[idx]);
    const others = it.affixes.filter((a, i) => i !== idx).map((a) => a.k);
    const main = IT.MAIN[it.slot].k;
    const pool = IT.STAT_IDS.filter((k) => k !== main && !others.includes(k));
    const k = pool[Math.floor(Math.random() * pool.length)];
    const S = IT.STAT[k];
    const m = IT.RARITY[it.rarity].mul;
    const v = G.lerp(S.lo, S.hi, Math.random()) * m * (1 + 0.01 * (it.ilv - 1));
    it.affixes[idx] = { k, v: Math.round(v * 10) / 10, q: v / (S.hi * m) };
    it.name = nameOf(it);
    st.stats.rerolls = (st.stats.rerolls || 0) + 1;
    G.emit('itemsChanged');
    return { ok: true, old, nu: it.affixes[idx] };
  };
  IT.revertReroll = function (u, idx, old) {
    const it = IT.get(u);
    if (!it || !it.affixes || !it.affixes[idx]) return;
    it.affixes[idx] = old;
    it.name = nameOf(it);
    G.emit('itemsChanged');
  };

  // おまかせ装備：戦力の高い人から、空いている一番いい装備を
  IT.autoEquip = function () {
    const st = G.state;
    const advs = st.adv.slice().sort((a, b) => G.sim.power(b) - G.sim.power(a));
    let changed = 0;
    advs.forEach((a) => {
      a.eq = a.eq || {};
      IT.SLOTS.forEach((slot) => {
        const cur = a.eq[slot] ? IT.get(a.eq[slot]) : null;
        let best = cur, bs = cur ? IT.score(cur, a) : -1;
        st.items.forEach((it) => {
          if (it.slot !== slot) return;
          const who = IT.equippedBy(it.uid);
          if (who && who !== a) return;
          const sc = IT.score(it, a);
          if (sc > bs + 0.01) { best = it; bs = sc; }
        });
        if (best && best !== cur) { a.eq[slot] = best.uid; best.isNew = false; changed++; }
      });
    });
    if (changed) G.emit('itemsChanged');
    return changed;
  };

  // ---------------------------------------------------------------- 技
  IT.learnSkill = function (adv, name) {
    adv.sk = adv.sk || {};
    adv.skillSet = adv.skillSet || [];
    const had = !!adv.sk[name];
    adv.sk[name] = Math.min(5, (adv.sk[name] || 0) + 1);
    if (!had && adv.skillSet.length < IT.skillSlots(adv)) adv.skillSet.push(name);
    G.emit('itemsChanged');
    return { lv: adv.sk[name], up: had };
  };
  IT.toggleSkill = function (adv, name) {
    adv.skillSet = adv.skillSet || [];
    const i = adv.skillSet.indexOf(name);
    if (i >= 0) adv.skillSet.splice(i, 1);
    else {
      if (adv.skillSet.length >= IT.skillSlots(adv)) return false;
      adv.skillSet.push(name);
    }
    G.emit('itemsChanged');
    return true;
  };
  IT.unknownSkills = (adv) => Object.keys(IT.SKILLS[adv.cls] || {}).filter((n) => !(adv.sk || {})[n]);

  // ---------------------------------------------------------------- 持ち物・ブースト
  IT.cons = (id) => ((G.state.bag || {})[id] || 0);
  IT.addCons = function (id, n) {
    const st = G.state;
    if (id === 'cry') { st.crystals = (st.crystals || 0) + n; return; }
    st.bag = st.bag || {};
    st.bag[id] = Math.max(0, (st.bag[id] || 0) + n);
    G.emit('itemsChanged');
  };
  // 任務用：持ち物を使った数
  IT.used = function (n = 1) { const st = G.state; st.stats.itemsUsed = (st.stats.itemsUsed || 0) + n; };
  IT.boost = function (k) {
    const b = (G.state.boosts || {})[k];
    return b && b.until > G.now() ? b : null;
  };
  IT.speedMul = () => { const b = IT.boost('speed'); return b ? b.mult : 1; };
  IT.useBoost = function (id) {
    const st = G.state;
    const c = IT.CONS[id];
    if (!c || !c.boost || IT.cons(id) <= 0) return false;
    st.boosts = st.boosts || {};
    const now = G.now();
    const cur = IT.boost(c.boost.k);
    const rest = cur ? cur.until - now : 0;
    st.boosts[c.boost.k] = { mult: Math.max(c.boost.mult || 1, cur ? cur.mult : 1), add: c.boost.add || 0, from: cur ? cur.from : now, until: now + rest + c.boost.sec, src: id };
    IT.addCons(id, -1);
    IT.used();
    G.emit('boost', c.boost.k);
    return true;
  };
  // 倍速：前回からの経過時間のうち、倍速中だったぶんだけ遠征と建設を前に進める
  IT.applySpeed = function (now, s = G.state) {
    const b = s.boosts && s.boosts.speed;
    const cur = s.speedCursor || now;
    s.speedCursor = now;
    if (!b || b.mult <= 1) return;
    const ov = Math.max(0, Math.min(now, b.until) - Math.max(cur, b.from));
    if (ov <= 0) return;
    const extra = ov * (b.mult - 1);
    s.active.forEach((ex) => { ex.endAt -= extra; ex.startAt -= extra; });
    if (s.building) s.building.endAt -= extra;
  };
  // 帰還の角笛：遠征中の全員をすぐに帰す
  IT.finishAll = function () {
    const st = G.state;
    if (!st.active.length || IT.cons('horn') <= 0) return 0;
    const now = G.now();
    st.active.forEach((ex) => { const d = ex.endAt - now; ex.endAt = now - 0.01; ex.startAt -= Math.max(0, d); });
    IT.addCons('horn', -1);
    IT.used();
    return st.active.length;
  };
  IT.finishOne = function (exId) {
    const st = G.state;
    const ex = st.active.find((e) => e.q.id === exId) || st.active.slice().sort((a, b) => a.endAt - b.endAt)[0];
    if (!ex || IT.cons('finish') <= 0) return null;
    const now = G.now();
    const d = ex.endAt - now;
    ex.endAt = now - 0.01;
    ex.startAt -= Math.max(0, d);
    IT.addCons('finish', -1);
    IT.used();
    return ex;
  };

  // ---------------------------------------------------------------- 黄金の宝箱（ガチャ）
  IT.CHEST_COST = 30;
  IT.CHEST10_COST = 280;
  IT.FREE_INTERVAL = 4 * 3600;
  IT.PITY = 30;
  IT.canFree = () => G.now() - (G.state.freeChestAt || 0) >= IT.FREE_INTERVAL;
  // ガチャの中身：装備（ほとんど）と、ときどき持ち物
  const CONS_BY_RANK = [[['stone', 6], ['finish', 1], ['expbook', 1]], [['stone', 12], ['finish', 2], ['expbook', 2]], [['hg2', 1], ['goldx2', 1], ['luck', 1], ['key', 1]], [['hg3', 1], ['book', 1], ['horn', 1]], [['book', 2]]];
  function chestOne(rnd, r) {
    if (r <= 3 && rnd() < 0.18) {
      const opts = CONS_BY_RANK[r];
      const [id, n] = opts[Math.floor(rnd() * opts.length)];
      return { uid: uid(), kind: 'cons', id, n, rarity: Math.max(r, IT.CONS[id].rarity), name: IT.CONS[id].name + (n > 1 ? ` ×${n}` : '') };
    }
    return IT.make(rnd, r);
  }
  IT.openChest = function (kind) {
    const st = G.state;
    const n = kind === 'ten' ? 10 : 1;
    if (kind === 'free') {
      if (!IT.canFree()) return null;
      st.freeChestAt = G.now();
    } else if (kind === 'key') {
      if (IT.cons('key') <= 0) return null;
      IT.addCons('key', -1);
      IT.used();
    } else {
      const cost = kind === 'ten' ? IT.CHEST10_COST : IT.CHEST_COST;
      if ((st.crystals || 0) < cost) return null;
      st.crystals -= cost;
    }
    const rnd = Math.random;
    const out = [];
    for (let i = 0; i < n; i++) {
      st.pity = (st.pity || 0) + (kind === 'free' ? 0 : 1);
      let r = IT.rollRarity(rnd, kind === 'free' ? 'free' : 'chest');
      if (kind !== 'free' && st.pity >= IT.PITY && r < 3) r = 3;
      if (kind === 'ten' && i === n - 1 && !out.some((x) => x.rarity >= 2) && r < 2) r = 2;
      if (r >= 3) st.pity = 0;
      out.push(chestOne(rnd, r));
    }
    st.stats.chests = (st.stats.chests || 0) + n;
    return out;
  };

  // ---------------------------------------------------------------- 古いセーブの変換
  IT.migrate = function (st) {
    const rnd = Math.random;
    (st.items || []).forEach((it) => {
      if (it.kind !== 'equip') return;
      if (!it.slot) {
        const e = IT.EQUIP[it.tid] || IT.EQUIP.sword;
        if (!IT.EQUIP[it.tid]) it.tid = 'sword';
        it.slot = e.slot;
        it.ilv = it.ilv || 1 + it.rarity * 6;
        it.plus = it.plus || 0;
        it.affixes = it.affixes || rollAffixes(rnd, it.rarity, it.ilv, it.rarity, it.slot);
        it.name = nameOf(it);
      }
    });
    st.adv.forEach((a) => {
      if (!a.eq) {
        a.eq = {};
        if (a.equip) { const it = (st.items || []).find((x) => x.uid === a.equip); if (it && it.slot) a.eq[it.slot] = it.uid; }
      }
      delete a.equip;
      if (!a.sk) {
        a.sk = {};
        (a.skills || []).forEach((n) => { a.sk[n] = 1; });
        a.skillSet = (a.skills || []).slice(0, 2);
      }
      delete a.skills;
    });
    st.bag = st.bag || {};
    st.boosts = st.boosts || {};
  };
})();
