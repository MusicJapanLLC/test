/* ギルドの灯 — items: 装備・秘宝・宝箱
 *  レア度は N / R / SR / SSR / UR の5段階。
 *  装備は冒険者1人に1つ（職業に合う武器は効果が満額）。秘宝はギルド全体に効く。
 *  宝物庫の「黄金の宝箱」は魔晶石で開ける（課金はない。魔晶石は遊んで集める）。
 */
'use strict';
(function () {
  const IT = (G.items = {});

  IT.RARITY = [
    { id: 'N', name: 'ノーマル', stars: 1, color: '#c9c0b0', glow: '#e8e0d0', bonus: 0.05, sell: 20 },
    { id: 'R', name: 'レア', stars: 2, color: '#6ab4ff', glow: '#bfe2ff', bonus: 0.1, sell: 60 },
    { id: 'SR', name: 'スーパーレア', stars: 3, color: '#c27cff', glow: '#ead2ff', bonus: 0.18, sell: 180 },
    { id: 'SSR', name: 'ダブルスーパーレア', stars: 4, color: '#ffc83a', glow: '#fff0b0', bonus: 0.3, sell: 600 },
    { id: 'UR', name: 'アルティメット', stars: 5, color: '#ff7ab8', glow: '#ffffff', bonus: 0.5, sell: 2000, rainbow: true },
  ];

  // 装備（[N, R, SR, SSR, UR] の名前）
  IT.EQUIP = {
    sword: { type: 'weapon', cls: 'warrior', icon: 'sword', names: ['錆びた剣', '鋼のロングソード', '蒼月の剣', '竜牙の大剣', '聖剣ルミナス'] },
    staff: { type: 'weapon', cls: 'mage', icon: 'staff', names: ['樫の杖', '魔石の杖', '星詠みのロッド', '賢者の霊杖', '天球儀の杖アストラ'] },
    dagger: { type: 'weapon', cls: 'thief', icon: 'dagger', names: ['果物ナイフ', '盗賊のダガー', '影縫いの短刀', '夜鴉の双刃', '月喰らい'] },
    mace: { type: 'weapon', cls: 'cleric', icon: 'mace', names: ['木の聖印', '銀のメイス', '祈りの錫杖', '聖女の鐘', '灯火の聖槌'] },
    bow: { type: 'weapon', cls: 'archer', icon: 'bow', names: ['狩人の弓', '樫の長弓', '風切りの弓', '翠玉の神弓', '星穿ちの弓'] },
    armor: { type: 'armor', icon: 'armor', names: ['布の服', '革の鎧', 'ミスリルの胸当て', '竜鱗の鎧', '灯王の外套'] },
    charm: { type: 'charm', icon: 'charm', names: ['木彫りのお守り', '銀の指輪', '妖精の首飾り', '不死鳥の羽根', '女神の涙'] },
  };
  IT.EQUIP_IDS = Object.keys(IT.EQUIP);

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

  // ---------------------------------------------------------------- 抽選
  const pickW = (rnd, arr, wf) => {
    let t = 0;
    arr.forEach((x) => (t += wf(x)));
    let r = rnd() * t;
    for (const x of arr) { r -= wf(x); if (r <= 0) return x; }
    return arr[arr.length - 1];
  };
  // 結果ごとのレア度の重み [N, R, SR, SSR, UR]
  const TABLE = {
    ok: [58, 30, 9, 2.6, 0.4],
    great: [26, 40, 23, 9, 2],
    legend: [0, 18, 40, 30, 12],
    gift: [30, 40, 22, 7, 1],
    chest: [40, 35, 18, 6, 1],
    free: [62, 30, 7, 1, 0],
  };
  IT.dropChance = { fail: 0, ok: 0.2, great: 0.5, legend: 1 };

  IT.rollRarity = function (rnd, kind, areaIdx = 0) {
    const w = TABLE[kind].slice();
    // 奥のエリアほど少し良いものが出る
    for (let i = 0; i < areaIdx; i++) { w[0] *= 0.82; w[3] *= 1.08; w[4] *= 1.08; }
    return pickW(rnd, [0, 1, 2, 3, 4], (i) => w[i]);
  };

  IT.make = function (rnd, rarity, opt = {}) {
    // 秘宝は SR 以上でまれに
    const relicPool = IT.RELICS.filter((r) => r.r <= rarity && r.r >= rarity - 1);
    if (!opt.noRelic && relicPool.length && rarity >= 1 && rnd() < 0.18) {
      const rel = relicPool[Math.floor(rnd() * relicPool.length)];
      return { uid: uid(), kind: 'relic', rid: rel.id, rarity: rel.r, name: rel.name };
    }
    let tid = opt.tid;
    if (!tid) {
      const pool = IT.EQUIP_IDS.filter((id) => !opt.cls || IT.EQUIP[id].cls === opt.cls || !IT.EQUIP[id].cls);
      tid = pool[Math.floor(rnd() * pool.length)];
    }
    const e = IT.EQUIP[tid];
    return { uid: uid(), kind: 'equip', tid, rarity, name: e.names[rarity] };
  };
  let seq = 0;
  function uid() { return 'i' + Date.now().toString(36) + (seq++).toString(36); }

  // 依頼の戦利品（冒険譚の生成時に決める）
  IT.rollDrop = function (rnd, tier, areaIdx, party) {
    if (rnd() >= IT.dropChance[tier]) return null;
    const rarity = IT.rollRarity(rnd, tier, areaIdx);
    // パーティの誰かに合う武器が出やすい
    const cls = party.length && rnd() < 0.55 ? party[Math.floor(rnd() * party.length)].cls : null;
    return IT.make(rnd, rarity, { cls });
  };
  IT.rollGift = function (rnd) {
    const rarity = IT.rollRarity(rnd, 'gift');
    return IT.make(rnd, rarity);
  };

  // ---------------------------------------------------------------- 所持・効果
  IT.add = function (item) {
    const st = G.state;
    if (!st.items) st.items = [];
    if (item.kind === 'relic') {
      if (!st.relics) st.relics = {};
      if (st.relics[item.rid]) {
        // 重複した秘宝は魔晶石に
        const gem = [5, 10, 20, 40, 80][item.rarity];
        st.crystals = (st.crystals || 0) + gem;
        return { dup: true, crystals: gem };
      }
      st.relics[item.rid] = 1;
      return { relic: true };
    }
    st.items.push(item);
    if (st.items.length > 120) {
      // 持ちきれないときは、装備していない一番弱いものを売る
      const free = st.items.filter((x) => !IT.equippedBy(x.uid)).sort((a, b) => a.rarity - b.rarity);
      const sold = free[0];
      if (sold) { st.items.splice(st.items.indexOf(sold), 1); st.gold += IT.RARITY[sold.rarity].sell; }
    }
    st.dex = st.dex || {};
    st.dex[item.tid + ':' + item.rarity] = 1;
    G.emit('itemsChanged');
    return { added: true };
  };
  IT.equippedBy = function (uidv) {
    return G.state.adv.find((a) => a.equip === uidv) || null;
  };
  IT.get = (uidv) => (G.state.items || []).find((x) => x.uid === uidv) || null;
  // 装備による戦力の倍率
  IT.powMul = function (adv) {
    let m = 1;
    if (adv.equip) {
      const it = IT.get(adv.equip);
      if (it) {
        const e = IT.EQUIP[it.tid];
        const fit = !e.cls || e.cls === adv.cls ? 1 : 0.5;
        m += IT.RARITY[it.rarity].bonus * fit;
      }
    }
    return m * (1 + IT.relicFx('pow'));
  };
  IT.relicFx = function (key) {
    const st = G.state;
    if (!st || !st.relics) return 0;
    let v = 0;
    Object.keys(st.relics).forEach((id) => { const r = IT.RELIC[id]; if (r && r.fx[key]) v += r.fx[key]; });
    return v;
  };
  IT.equip = function (advId, uidv) {
    const st = G.state;
    const a = st.adv.find((x) => x.id === advId);
    if (!a) return false;
    const other = uidv ? IT.equippedBy(uidv) : null;
    if (other && other !== a) other.equip = null;
    a.equip = uidv || null;
    G.emit('itemsChanged');
    return true;
  };
  IT.sell = function (uidv) {
    const st = G.state;
    const it = IT.get(uidv);
    if (!it || IT.equippedBy(uidv)) return 0;
    st.items.splice(st.items.indexOf(it), 1);
    const g = IT.RARITY[it.rarity].sell;
    st.gold += g;
    G.emit('itemsChanged');
    return g;
  };

  // ---------------------------------------------------------------- 宝物庫の宝箱（ガチャ）
  IT.CHEST_COST = 30;
  IT.CHEST5_COST = 140;
  IT.FREE_INTERVAL = 4 * 3600;
  IT.PITY = 30; // 30回で SSR 以上が確定
  IT.canFree = () => G.now() - (G.state.freeChestAt || 0) >= IT.FREE_INTERVAL;
  IT.openChest = function (kind) {
    const st = G.state;
    const n = kind === 'five' ? 5 : 1;
    if (kind === 'free') {
      if (!IT.canFree()) return null;
      st.freeChestAt = G.now();
    } else {
      const cost = kind === 'five' ? IT.CHEST5_COST : IT.CHEST_COST;
      if ((st.crystals || 0) < cost) return null;
      st.crystals -= cost;
    }
    const rnd = Math.random;
    const out = [];
    for (let i = 0; i < n; i++) {
      st.pity = (st.pity || 0) + (kind === 'free' ? 0 : 1);
      let r = IT.rollRarity(rnd, kind === 'free' ? 'free' : 'chest');
      if (kind !== 'free' && st.pity >= IT.PITY && r < 3) r = 3;
      // 5連の最後は SR 以上
      if (kind === 'five' && i === 4 && !out.some((x) => x.rarity >= 2) && r < 2) r = 2;
      if (r >= 3) st.pity = 0;
      const item = IT.make(rnd, r);
      out.push(item);
    }
    st.stats.chests = (st.stats.chests || 0) + n;
    return out;
  };
})();
