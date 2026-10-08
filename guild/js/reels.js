/* ギルドの灯 — reels: 冒険譚（魔導鏡に映る、縦スワイプのショート動画）
 *  依頼の結果は「冒険譚」として届き、見ると報酬を受け取れる。
 *  - 上スワイプで次へ／下スワイプで前へ／ダブルタップで応援／長押しで一時停止
 *  - 結果は再生されるまで分からない（変動報酬）。宝箱は開く直前に色が変わることがある
 *  - 戦闘は seed から決まる段取り（攻撃・会心・被弾・回復・閃き）を、カメラ・ヒットストップ・
 *    斬撃・擬音・カットインで見せる。戦う本人は吹き出しでしゃべる
 *  - コメントは戦闘の進みに合わせて届き、コメント欄に増えていく（返信・投げ銭つき）
 */
'use strict';
(function () {
  const R = (G.reels = {});
  const D = G.D;
  const art = G.art;
  const F = G.font;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- 乱数・文字
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  R.rng = mulberry;
  const fill = (tpl, c) => tpl.replace(/\{(\w+)\}/g, (_, k) => (c[k] != null ? c[k] : ''));
  const pickR = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

  // ---------------------------------------------------------------- 職業ごとの戦い方
  const CLS = {
    warrior: { melee: true, mul: 1, ono: ['ザシュッ', 'ズバッ', 'ガキィン'] },
    thief: { melee: true, mul: 0.9, ono: ['シュバッ', 'ザッ', 'スパッ'] },
    mage: { mul: 1.25, col: '#8fd0ff', ono: ['ドォン', 'バシュウ', 'ゴォッ'] },
    cleric: { mul: 0.72, col: '#fff0a0', ono: ['キィン', 'パァン'] },
    archer: { mul: 1.1, ono: ['ヒュン', 'ドスッ', 'ストン'] },
    knight: { melee: true, mul: 1.05, ono: ['ガギィン', 'ドゴッ', 'ズバァ'] },
    bard: { mul: 0.85, col: '#ffb0e0', ono: ['♪ジャラン', '♪ポロロン', '♪ラ〜'] },
    alchemist: { mul: 1.0, col: '#7fe0a0', ono: ['ボカン', 'シュワッ', 'バシャッ'] },
  };
  const BIG = { golem: 1, knight: 1, wyvern: 1, dragon: 1, wolf: 0, kraken: 1, griffin: 1, sentinel: 1 };
  const FLYING = { bat: 1, wyvern: 1, griffin: 1 };

  // 閃きで覚える技（ロマサガの「閃き」へのオマージュ）
  const SKILLS = {
    warrior: ['烈風斬', '剛断・灯火割り', '獅子奮迅撃', '大地裂き', '十文字斬り', '流星剣'],
    mage: ['蒼炎の槍', '星降りの陣', '雷鳴の輪舞', '氷華結界', '紅蓮の柱', '月光砲'],
    thief: ['影縫い', '月下千刃', '燕返し', '夜霧の舞', '乱れ椿'],
    cleric: ['聖灯の祈り', '天使の鐘', '光輪の裁き', '浄化の陽'],
    archer: ['流星の矢', '風穿ち', '千里一射', '五月雨撃ち', '翠嵐の矢'],
    knight: ['聖盾突撃', '不動の誓い', '蒼天の槍', '王剣・灯守り'],
    bard: ['勇気の歌', '眠りの子守唄', '英雄譚の詩', '喝采のフィナーレ'],
    alchemist: ['爆裂フラスコ', '賢者の霧', '黄金錬成', '万能薬の雨'],
  };

  // 本人のセリフ（性格・職業・出来事ごと）
  const SPEECH = {
    start: {
      brave: ['行くぞ！', '腕が鳴る！', '前は任せろ！'],
      greedy: ['稼ぐぞ〜！', 'お宝の匂いがする', '報酬、山分けな！'],
      sleepy: ['ふぁ…やるか', 'ねむい…けど行く', '早く帰って寝る…'],
      drinker: ['終わったら一杯だ！', '酒のために働くぞ'],
      singer: ['♪いざ参らん〜', '今日も一曲いこうか'],
      swift: ['先手必勝！', 'ちゃちゃっと片付ける'],
      lucky: ['今日はツイてる気がする', 'なんとかなるって！'],
      tidy: ['作戦どおりにね', '装備よし、準備よし'],
    },
    encounter: {
      big: ['で、でかい…！', 'うそでしょ…', '気を引き締めろ！', 'これは骨が折れそうだ'],
      cute: ['か、かわいい…けど敵！', 'ちっちゃいな', '油断するなよ'],
      any: ['出たな！', 'いたぞ！', '来るぞ、構えて！'],
    },
    crit: {
      warrior: ['でりゃあっ！', 'もらった！', '砕けろ！'],
      thief: ['遅い！', 'そこだっ！', '見切った'],
      mage: ['燃えろ！', '穿て！', '吹き飛べ！'],
      cleric: ['光よ！', '天罰です！'],
      archer: ['射抜く！', '狙いどおり', '外さない'],
      knight: ['この盾にかけて！', '押し通る！', '騎士の誇りを！'],
      bard: ['聴いていけ！', 'クライマックスだ！', 'アンコールはなしだ♪'],
      alchemist: ['調合完了！', '配合はバッチリ', '爆ぜろ！'],
    },
    hurt: ['くっ…！', 'いったぁ！', 'まだまだ！', 'やるな…', 'うぐっ'],
    dodge: ['当たらないよ', 'おっと', '遅い遅い', 'ひらりっ'],
    heal: ['回復するね！', 'しっかり！', '光よ、癒やしを', '無理しないで'],
    bulb: ['…見えた！', '今だ…！', 'これだ！'],
    finish: ['決まった！', 'どうだ！', '楽勝！', 'ふぅ…', 'いっちょあがり！'],
    great: ['大当たりだ！', '最高の日だ！', '今日はキレてる！'],
    legend: ['…伝説、だと？', '歴史に名を刻んだぞ！', 'うおおお！'],
    fail: ['撤退だ！', '一旦引くぞ！', '覚えてろ〜！', '逃げるが勝ち！'],
    chest: ['開けるぞ…！', '中身は…？', 'お宝お宝〜！', 'ドキドキする'],
    level: ['力がみなぎる！', 'また強くなった！', 'レベルアップだ！'],
  };
  const MON_ONO = ['ガブッ', 'ドンッ', 'バキッ', 'ゴッ'];
  const MON_ONO_BIG = ['ズドォン!!', 'グシャア!!', 'ドゴォッ!!'];
  const ROAR = { dragon: 'グオオオオッ!!', wyvern: 'ギャオオッ!', golem: 'ゴゴゴゴ…', knight: 'オォォ…', wolf: 'ガルルル…', bat: 'キキーッ', kraken: 'ゴボボボボ…!', griffin: 'キュアアアッ!', sentinel: '…シンニュウシャ、ハイジョ', crab: 'カチカチッ' };

  // 投稿の一言（結果は見せない）
  const CAPTIONS = [
    '{area}で{monster}{verb}。今日もいい仕事', '今日の依頼。最後まで見てほしい', '{leader}、気合い入ってます',
    '結果は…', 'まさかの展開に', 'これがギルドの日常です', '{monster}、思ったより手強い？', '音あり推奨',
    '宝箱の中身、予想してみて', '{leader}の動きに注目', '初見の{monster}', '{area}の空気が好き', '{cls}の本気',
  ];
  const TAGS_BASE = ['#ギルドの灯', '#冒険譚', '#{area}', '#{cls}', '#{monster}', '#ギルドの日常', '#魔導鏡'];
  const TIER_TAG = { fail: '#撤退は勇気', ok: '#依頼達成', great: '#神回', legend: '#伝説級' };

  // ---------------------------------------------------------------- 冒険譚を作る
  let seq = 1;
  const ABYSS_CAP = {
    ok: ['B{f}F 突破。まだまだ底は見えない', '深淵、ひんやりしてる…', 'B{f}F、ここも静かすぎる'],
    great: ['B{f}F を一気に駆け抜けた！', '深淵の宝、見つけちゃった', 'この階、楽勝だったかも'],
    legend: ['【深淵】B{f}F で伝説を見た', '深淵の底から光が…！'],
    fail: ['B{f}F、深淵は甘くない…', '一度戻って、装備を整えよう', '暗すぎて前が見えない…'],
  };
  R.make = function ({ q, party, tier, gold, mat, fame, levelUps, extra, endAt, drop, loot, goldBoost, firstClear }) {
    const st = G.state;
    const area = D.AREA_BY_ID[q.area];
    const md = D.MONSTERS[q.monster];
    const leader = party[0];
    const seed = Math.floor(Math.random() * 1e9);
    const rnd = mulberry(seed ^ 0x51ab);
    const c = { area: area.short, monster: md.name, verb: md.verb, leader: leader ? leader.name : '', cls: leader ? D.CLASSES[leader.cls].name : '' };
    let caption = q.boss ? '最終依頼。紅蓮竜王、ついに――' : fill(pickR(rnd, CAPTIONS), c);
    let tags = TAGS_BASE.slice().sort(() => rnd() - 0.5).slice(0, 3).map((x) => fill(x, c));
    if (q.abyss) {
      caption = q.guardian && tier !== 'fail' ? `B${q.abyss}F の守護者、${md.name}を撃破！` : pickR(rnd, ABYSS_CAP[tier]).replace('{f}', q.abyss);
      tags = ['#深淵の迷宮', `#B${q.abyss}F`, q.guardian ? '#守護者' : fill(pickR(rnd, TAGS_BASE), c)];
    }
    const viewsBase = { fail: [300, 1600], ok: [900, 4200], great: [12000, 58000], legend: [120000, 520000] }[tier];
    const views = Math.round(G.lerp(viewsBase[0], viewsBase[1], rnd()) * (1 + st.rank * 0.15));
    let recruit = null;
    if (extra === 'recruit') {
      const cls = G.pick(G.sim.unlockedClasses(st));
      recruit = G.sim.makeAdv(cls, Math.max(1, Math.round((leader ? leader.lv : 1) * G.rand(0.5, 0.9))));
    }
    const reel = {
      id: 'r' + Date.now().toString(36) + (seq++),
      ts: endAt,
      quest: q.name,
      area: q.area,
      monster: q.monster,
      count: q.count || 1,
      boss: !!q.boss,
      abyss: q.abyss || 0, guardian: !!q.guardian, farm: !!q.farm, firstClear: !!firstClear,
      party: party.map((a) => ({ id: a.id, name: a.name, cls: a.cls, lv: a.lv, look: a.look, trait: a.trait, skills: Object.keys(a.sk || {}), set: (a.skillSet || []).slice(), crit: G.items ? Math.round(G.items.advStats(a).crit || 0) : 0 })),
      tier, gold, mat, fame,
      levelUps: levelUps || [],
      extra, recruit, drop: drop || null, loot: loot || [], goldBoost: goldBoost || 0,
      caption, tags,
      views, likes: Math.round(views * G.lerp(0.05, 0.12, rnd())),
      song: pickR(rnd, D.SONGS),
      liked: false,
      claimed: false,
      seed,
    };
    const pl = makePlan(reel);
    if (pl.skill) reel.skill = { id: reel.party[pl.skill.who].id, name: pl.skill.name };
    reel.cm = genComments(reel, pl);
    return reel;
  };
  R.makeDigest = function (sum) {
    return {
      id: 'd' + Date.now().toString(36), ts: G.now(), digest: true, n: sum.n,
      quest: '留守中の冒険まとめ', area: 'meadow', monster: null, party: [], tier: 'ok',
      gold: sum.gold, mat: sum.mat, fame: sum.fame, levelUps: [], caption: `留守の間に ${sum.n} 件の依頼をこなしました`,
      tags: ['#留守番', '#まとめ'], cm: [{ id: 'rina', t: 1.4, a: 'rina', text: 'ぜんぶ記録しておきました！ おかえりなさい、マスター♪', likes: 42, pin: true, replies: [] }],
      views: 999, likes: 99, song: D.SONGS[0], liked: false, claimed: false, seed: 7,
    };
  };

  function genComments(reel, pl) {
    if (!G.comments) return [];
    const out = G.comments.generate(reel, pl.facts);
    const lim = pl.end - 0.25;
    out.forEach((c) => {
      c.t = Math.min(c.t, lim);
      c.replies.forEach((r) => { r.t = Math.min(Math.max(r.t, c.t + 0.5), pl.end + 0.4); });
    });
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  function ensureComments(reel) {
    if (reel.cm || reel.digest) return;
    reel.cm = genComments(reel, planOf(reel));
    delete reel.comments;
  }

  // ---------------------------------------------------------------- 戦闘の段取り（seed から決定的）
  const planCache = new Map();
  function planOf(reel) {
    let p = planCache.get(reel.id);
    if (!p) {
      p = makePlan(reel);
      if (planCache.size > 80) planCache.clear();
      planCache.set(reel.id, p);
    }
    return p;
  }

  function makePlan(reel) {
    const rnd = mulberry((reel.seed ^ 0x9e3779b9) >>> 0);
    const P = reel.party;
    const n = Math.max(1, P.length);
    const tier = reel.tier;
    const fail = tier === 'fail';
    const mon = reel.monster;
    const big = !!(reel.boss || reel.guardian || BIG[mon]);
    const pl = { beats: [], speech: [], stops: [], slows: [], encT: 1.05, big, fail };
    const nb = reel.boss ? 8 : fail ? 5 : tier === 'ok' ? 4 + (rnd() < 0.45 ? 1 : 0) : tier === 'great' ? 5 + (rnd() < 0.5 ? 1 : 0) : 6 + (rnd() < 0.5 ? 1 : 0);
    const critP = { fail: 0.1, ok: 0.2, great: 0.4, legend: 0.5 }[tier];
    const dmgOf = (p) => Math.round((12 + p.lv * 7) * CLS[p.cls].mul * (0.85 + rnd() * 0.3));

    // 閃き
    let skillIdx = -1, skillWho = -1, skillName = null;
    const skillP = reel.boss ? 1 : { fail: 0.05, ok: 0.1, great: 0.45, legend: 0.92 }[tier];
    if (P.length && rnd() < skillP) {
      skillWho = Math.floor(rnd() * n);
      const known = new Set(P[skillWho].skills || []);
      const pool = SKILLS[P[skillWho].cls].filter((s) => !known.has(s));
      if (pool.length) {
        skillName = pickR(rnd, pool);
        skillIdx = fail ? 1 + Math.floor(rnd() * 2) : tier === 'legend' || rnd() < 0.6 ? nb - 1 : nb - 2;
      }
    }
    // 魔物の攻撃
    const monIdx = new Set();
    const mid = () => 1 + Math.floor(rnd() * Math.max(1, nb - 2));
    if (fail) {
      monIdx.add(nb - 1);
      for (let k = 0; k < 2; k++) { const m = mid(); if (m !== skillIdx) monIdx.add(m); }
    } else {
      const cnt = nb >= 6 ? 2 : rnd() < 0.75 ? 1 : 0;
      for (let k = 0; k < cnt; k++) { const m = mid(); if (m !== skillIdx && m < nb - 1) monIdx.add(m); }
    }
    // 回復（僧侶がいて、被弾のあと）
    let clericIdx = P.findIndex((p) => p.cls === 'cleric');
    if (clericIdx < 0) clericIdx = P.findIndex((p) => p.cls === 'bard');
    const healIdx = new Map();
    if (clericIdx >= 0) {
      monIdx.forEach((m) => {
        const h = m + 1;
        if (h < nb - 1 && !monIdx.has(h) && h !== skillIdx && rnd() < 0.7) healIdx.set(h, m);
      });
    }

    let t = 1.75;
    let rot = Math.floor(rnd() * n);
    let dealt = 0, maxDmg = 0, mvp = 0, combo = 0;
    const byWho = new Array(n).fill(0);
    for (let i = 0; i < nb; i++) {
      const b = { i, t, ang: -0.9 + rnd() * 1.8, jx: rnd() * 2 - 1, jy: rnd() * 2 - 1 };
      if (monIdx.has(i)) {
        b.kind = 'mon';
        b.target = Math.floor(rnd() * n);
        const tg = P[b.target] || { lv: 1 };
        b.big = fail && i === nb - 1;
        b.miss = !b.big && (tg.cls === 'thief' || tg.trait === 'swift' || rnd() < 0.15) && rnd() < 0.6;
        b.at = t + 0.28;
        b.dmg = b.miss ? 0 : Math.round((6 + tg.lv * 4) * (0.8 + rnd() * 0.5) * (b.big ? 2.6 : 1));
        b.ono = b.miss ? 'ミス' : pickR(rnd, b.big ? MON_ONO_BIG : MON_ONO);
        combo = 0;
        t += b.big ? 0.85 : 0.64;
        if (b.big) pl.stops.push({ t: b.at, d: 0.12 });
      } else if (healIdx.has(i)) {
        b.kind = 'heal';
        b.who = clericIdx;
        const m = pl.beats[healIdx.get(i)];
        b.target = m ? m.target : 0;
        b.at = t + 0.22;
        b.dmg = Math.round((10 + P[clericIdx].lv * 6) * (0.9 + rnd() * 0.3));
        t += 0.56;
      } else {
        const sk = i === skillIdx;
        if (sk) b.who = skillWho;
        else {
          // 同じ人が続かないように回す
          b.who = rot % n;
          rot += 1 + (rnd() < 0.25 ? 1 : 0);
        }
        const p = P[b.who] || { cls: 'warrior', lv: 1 };
        const c = CLS[p.cls];
        b.melee = !!c.melee;
        if (sk) {
          b.kind = 'skill';
          b.skill = skillName;
          b.crit = true;
          // カットインのあと、技ごとの動き（溜め→動き出し→命中）
          const fx = skillFx(skillName, p.cls);
          b.w0 = t + 0.62;
          b.s0 = t + 0.9;
          b.lead = Math.max(0.18, fx.lead);
          b.at = b.s0 + b.lead;
          b.dmg = Math.round(dmgOf(p) * (4.2 + rnd() * 0.8));
          b.ono = pickR(rnd, ['ズドォォン!!', '斬ッ!!', 'ドガァァン!!', 'ゴォォッ!!']);
          if (fx.ono) b.ono = fx.ono;
          pl.stops.push({ t: b.at, d: 0.16 });
          t += 1.6 + (b.lead - 0.18) + 0.12;
        } else {
          b.kind = 'hit';
          // セットした技を使うことがある
          if (p.set && p.set.length && rnd() < 0.38) b.use = p.set[Math.floor(rnd() * p.set.length)];
          b.crit = rnd() < critP + (p.crit || 0) / 200 + (b.use ? 0.15 : 0);
          b.at = t + (b.melee ? 0.17 : 0.22);
          b.dmg = Math.round(dmgOf(p) * (b.crit ? 2.3 : 1));
          b.ono = b.crit ? pickR(rnd, ['ズバァッ!!', 'ザンッ!!', 'ドゴォッ!!', 'バキィッ!!']) : pickR(rnd, c.ono);
          if (b.use) {
            // 技：溜め（名前の帯）→ 技ごとの動き → 命中。少し長めのヒットストップ
            const fx = skillFx(b.use, p.cls);
            b.w0 = t;
            b.s0 = t + USE_WIND;
            b.lead = fx.lead;
            b.at = b.s0 + fx.lead;
            if (fx.ono) b.ono = fx.ono;
            pl.stops.push({ t: b.at, d: b.crit ? 0.13 : 0.1 });
            t += USE_WIND + fx.lead + (b.crit ? 0.52 : 0.44);
          } else {
            if (b.crit) pl.stops.push({ t: b.at, d: 0.085 });
            t += b.crit ? 0.68 : 0.56;
          }
        }
        combo++;
        b.combo = combo;
        dealt += b.dmg;
        byWho[b.who] += b.dmg;
        if (b.dmg > maxDmg) maxDmg = b.dmg;
      }
      pl.beats.push(b);
    }
    byWho.forEach((v, i) => { if (v > byWho[mvp]) mvp = i; });
    const last = pl.beats[pl.beats.length - 1];
    pl.finishT = last.at;
    if (!fail) last.finish = true;
    pl.maxHp = fail ? Math.round(dealt / (0.36 + rnd() * 0.24)) : dealt;
    // 残りHP
    let acc = 0;
    pl.beats.forEach((b) => {
      if (b.kind === 'hit' || b.kind === 'skill') acc += b.dmg;
      b.hpAfter = Math.max(0, 1 - acc / Math.max(1, pl.maxHp));
    });

    // とどめ以降
    if (!fail) {
      pl.slows.push({ a: pl.finishT - 0.12, b: pl.finishT + 0.42, f: tier === 'legend' ? 0.26 : tier === 'great' ? 0.42 : 0.7 });
      pl.dropT = pl.finishT + 0.55;
      pl.rollT = pl.dropT + 0.72;
      const rank = reel.drop ? reel.drop.rarity : { ok: 0, great: 1, legend: 2 }[tier];
      let start = rank;
      if (rank >= 2) start = Math.max(0, rank - (rnd() < 0.5 ? 1 : 2));
      if (rank >= 3 && rnd() < 0.35) start = 0;
      pl.chestSteps = [];
      for (let r = start; r <= rank; r++) pl.chestSteps.push(r);
      pl.stepT = pl.chestSteps.map((_, i) => (i === 0 ? pl.dropT : pl.rollT + 0.32 + i * 0.42));
      pl.chestRank = rank;
      pl.reveal = pl.rollT + 0.6 + (pl.chestSteps.length - 1) * 0.42;
      pl.itemT = reel.drop ? pl.reveal + 0.18 : null;
      pl.resT = pl.reveal + (reel.drop ? 1.3 : 0.38);
    } else {
      pl.fleeT = pl.finishT + 0.38;
      pl.pouchT = pl.finishT + 0.95;
      pl.resT = pl.finishT + 1.3;
      pl.chestRank = null;
      pl.reveal = pl.resT;
    }
    pl.lvT = pl.resT + 0.75;
    pl.recruitT = pl.resT + (reel.levelUps.length ? 1.35 : 0.85);
    pl.end = pl.resT + 2.3 + (reel.levelUps.length ? 0.5 : 0) + (reel.extra === 'recruit' ? 1.1 : 0) + (reel.drop ? 0.3 : 0);

    // ---- セリフ
    const ctxs = { monster: (D.MONSTERS[mon] || {}).name || '' };
    const say = (tt, who, bank, dur = 1.2) => {
      if (who == null || who < 0 || !P[who] || !bank || !bank.length) return;
      pl.speech.push({ t: tt, who, text: fill(pickR(rnd, bank), ctxs), dur });
    };
    if (P.length) {
      say(0.42, 0, SPEECH.start[P[0].trait] || SPEECH.start.brave);
      if (n > 1 && rnd() < 0.65) say(pl.encT + 0.42, 1 + Math.floor(rnd() * (n - 1)), big ? SPEECH.encounter.big : mon === 'slime' || mon === 'rabbit' ? SPEECH.encounter.cute : SPEECH.encounter.any);
      else if (rnd() < 0.4) say(pl.encT + 0.42, 0, big ? SPEECH.encounter.big : SPEECH.encounter.any);
      const fc = pl.beats.find((b) => b.kind === 'hit' && b.crit);
      if (fc) say(fc.t - 0.05, fc.who, SPEECH.crit[P[fc.who].cls], 1);
      const fm = pl.beats.find((b) => b.kind === 'mon' && !b.big);
      if (fm) say(fm.at + 0.1, fm.target, fm.miss ? SPEECH.dodge : SPEECH.hurt, 1);
      const fh = pl.beats.find((b) => b.kind === 'heal');
      if (fh) say(fh.t, fh.who, SPEECH.heal, 1);
      const fs = pl.beats.find((b) => b.kind === 'skill');
      if (fs) say(fs.t - 0.62, fs.who, SPEECH.bulb, 0.6);
      if (!fail) {
        say(pl.finishT + 0.32, last.who, tier === 'legend' ? SPEECH.legend : tier === 'great' ? SPEECH.great : SPEECH.finish, 1.3);
        if (rnd() < 0.7) {
          const g = P.findIndex((p) => p.trait === 'greedy' || p.trait === 'lucky');
          say(pl.rollT + 0.05, g >= 0 ? g : Math.floor(rnd() * n), SPEECH.chest, 1);
        }
      } else say(pl.fleeT, 0, SPEECH.fail, 1.4);
      if (reel.levelUps.length) {
        const li = P.findIndex((p) => p.id === reel.levelUps[0].id);
        if (li >= 0) say(pl.lvT + 0.1, li, SPEECH.level, 1.3);
      }
    }
    pl.speech.sort((a, b) => a.t - b.t);
    // 同じ人の吹き出しは重ねない・同時は2つまで
    for (let i = 1; i < pl.speech.length; i++) {
      const s = pl.speech[i];
      for (let j = 0; j < i; j++) {
        const o = pl.speech[j];
        if (o.who === s.who && s.t < o.t + o.dur) s.t = o.t + o.dur + 0.05;
      }
    }
    pl.speech.sort((a, b) => a.t - b.t);

    if (skillName) pl.skill = { who: skillWho, name: skillName };
    // コメント欄に渡す「出来事のまとめ」
    const crits = pl.beats.filter((b) => b.crit);
    const hurtB = pl.beats.find((b) => b.kind === 'mon' && !b.miss);
    const sb = pl.beats.find((b) => b.kind === 'skill');
    pl.facts = {
      tier, crit: crits.length > 0, critT: crits.length ? crits[0].at : null, maxDmg,
      mvpName: P[mvp] ? P[mvp].name : '', skill: skillName, skillT: sb ? sb.at : null,
      drop: !!reel.drop, dropName: reel.drop ? reel.drop.name : '', dropRank: reel.drop ? reel.drop.rarity : -1,
      hurt: !!hurtB, hurtT: hurtB ? hurtB.at : null, hurtName: hurtB && P[hurtB.target] ? P[hurtB.target].name : '', hurtId: hurtB && P[hurtB.target] ? P[hurtB.target].id : null,
      levelUps: reel.levelUps.length > 0, reveal: pl.reveal, finishT: pl.finishT, dur: pl.end,
    };
    return pl;
  }

  function danmakuOf(reel) {
    if (reel._dm) return reel._dm;
    if (!G.comments || reel.digest) return (reel._dm = []);
    const pl = planOf(reel);
    const proxy = {
      encT: pl.encT, finishT: pl.finishT, chestRank: pl.chestRank, dropT: pl.dropT, reveal: pl.reveal,
      beats: pl.beats.map((b) => ({ t: b.at - 0.1, kind: b.kind === 'mon' && b.miss ? 'miss' : b.kind, crit: b.crit })),
    };
    const raw = G.comments.danmaku(reel, pl.facts, proxy);
    // 4本の列に、前の文字が流れ切ってから入れる（入らないものは捨てる）
    const free = [0, 0, 0, 0];
    const dm = [];
    raw.forEach((d) => {
      const w = d.text.length * 13 + 24;
      const dur = 4.2 / d.speed;
      const v = (372 + w) / dur;
      let lane = -1;
      for (let i = 0; i < 4; i++) if (free[i] <= d.t && (lane < 0 || free[i] < free[lane])) lane = i;
      if (lane < 0) return;
      free[lane] = d.t + w / v + 0.15;
      dm.push(Object.assign({}, d, { lane }));
    });
    Object.defineProperty(reel, '_dm', { value: dm, enumerable: false, configurable: true });
    return dm;
  }

  // ---------------------------------------------------------------- 再生の状態
  let root, cv, ctx, dpr = 1, W = 0, H = 0, k = 1, Hd = 640, ox = 0, safeB = 0;
  let items = []; // reel or {end:true}
  let pos = 0, target = 0, anim = null;
  let rt = 0; // current reel time
  let paused = false, holdTimer = null;
  let parts = [];
  let lastTapT = 0, lastTapX = 0, lastTapY = 0;
  let drag = null;
  let sessionGold = 0, sessionCount = 0, cheer = 0;
  let firedFor = null, fired = {};
  let open = false;
  let rewatch = false;
  let banner = null;
  let hintShown = false;
  let rankedInFeed = 0;
  let flashT = 0, flashCol = '#ffffff';
  let cmOpen = false, viewK = 0;
  let cmSeen = 0, cmBumpT = 9, cmBumpN = 0;
  let warpNow = 1;
  let popY = 80; // 常連の通知カードの上端（設計座標）
  let lastCam = { z: 1, x: 180, y: 300 }; // いま描いている冒険譚のカメラ（画面側の文字の位置合わせ）
  R.isOpen = () => open;
  let mainCtxRef = null;
  const mainCtx = () => mainCtxRef;

  R.init = function () {
    root = G.$('#reels');
    cv = G.$('#reelCanvas');
    ctx = cv.getContext('2d');
    mainCtxRef = ctx;
    window.addEventListener('resize', () => { if (open) resize(); });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    G.$('#reelClose').addEventListener('click', () => R.close());
    G.$('#reelAll').addEventListener('click', () => claimAll());
    G.$('#reelLike').addEventListener('click', (e) => { e.stopPropagation(); like(null); });
    G.$('#reelComments').addEventListener('click', (e) => { e.stopPropagation(); openComments(); });
    G.$('#commentsClose').addEventListener('click', () => closeComments());
    G.$('#commentsBackdrop').addEventListener('click', () => closeComments());
    G.$('#commentsList').addEventListener('click', onCommentListClick);
    G.$('#endQuests').addEventListener('click', () => { R.close(); setTimeout(() => G.ui.openSheet('quests'), 260); });
    G.$('#endBack').addEventListener('click', () => R.close());
    G.$('#endHistory').addEventListener('click', () => startRewatch());
    G.on('rankup', () => {
      if (open) {
        banner = { text: `ギルドランク ${G.state.rank} に上がった！`, t: 0 };
        rankedInFeed++;
        for (let i = 0; i < 40; i++) addPart(confettiP(G.rand(0, 360), -10, true));
        G.audio.sfx('rankup');
      }
    });
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = root.clientWidth;
    H = root.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    k = Math.min(W / 360, H / 600);
    ox = (W - 360 * k) / 2;
    Hd = H / k;
    const probe = G.$('#safeProbe');
    safeB = probe ? probe.offsetHeight / k : 0;
    // 常連の通知カードは、上のバー（閉じる・タイトル・所持金）と「見届けると」の札の下に出す
    const topBar = G.$('.reel-top');
    popY = ((topBar ? topBar.offsetHeight : 48) + 36) / k;
    // 背景の描き置きは、カメラが寄ってもにじまないよう少し大きめに
    const nb = Math.min(4, dpr * k * 1.2);
    if (Math.abs(nb - bgScale) > 0.01) { bgScale = nb; bgCache.clear(); treeCache.clear(); }
    sprites.clear();
    skyGrad.clear();
    placeHitAreas();
  }

  // 冒険譚ごとの曲（場所・ボス戦で変わる。TikTok の「楽曲」のように画面下に流れる）
  const AREA_TRACK = { meadow: 'reels', forest: 'forest', cave: 'cave', castle: 'castle', peak: 'peak', harbor: 'harbor', sky: 'sky' };
  const trackOf = (r) => (!r || r.end ? null : r.digest ? 'reels' : r.boss || r.guardian ? 'boss' : r.abyss ? 'abyss' : AREA_TRACK[r.area] || 'reels');
  const songOf = (r) => G.audio.trackTitle(trackOf(r)) || r.song;
  R.trackOf = trackOf;

  R.unseen = () => G.state.reels.filter((r) => !r.claimed);
  R.pendingGold = () => R.unseen().reduce((x, r) => x + r.gold, 0);

  R.open = function () {
    if (open) return;
    G.ui.mirrorFx('#tab-reels .disc');
    const unseen = R.unseen().sort((a, b) => (a.digest ? -1 : b.digest ? 1 : a.ts - b.ts));
    // 一番いい結果は少しだけ後ろに置く（期待を溜める）
    if (unseen.length >= 3) {
      const rankT = { fail: 0, ok: 1, great: 2, legend: 3 };
      let bi = 0;
      unseen.forEach((r, i) => { if (rankT[r.tier] > rankT[unseen[bi].tier]) bi = i; });
      if (bi === 0 && rankT[unseen[0].tier] >= 2 && !unseen[0].digest) {
        const best = unseen.splice(0, 1)[0];
        unseen.splice(2, 0, best);
      }
    }
    unseen.forEach(ensureComments);
    items = unseen.concat([{ end: true }]);
    setTimeout(() => { warm(items[0]); warm(items[1]); }, 60);
    rewatch = false;
    pos = target = 0;
    anim = null;
    rt = 0;
    parts = [];
    sessionGold = 0;
    sessionCount = 0;
    rankedInFeed = 0;
    cheer = 0;
    fired = {};
    firedFor = null;
    paused = false;
    cmOpen = false;
    viewK = 0;
    open = true;
    G.state.streak = 0;
    root.hidden = false;
    root.classList.remove('closing');
    requestAnimationFrame(() => root.classList.add('shown'));
    resize();
    G.audio.playTrack(trackOf(items[0]) || 'reels');
    G.audio.sfx('open');
    updateDom();
    hintShown = G.state.stats.reels > 2;
    G.$('#reelHint').hidden = hintShown || items.length < 2;
    G.emit('reelsOpen');
  };

  R.close = function () {
    if (!open) return;
    // 見ていた冒険譚は受け取り済みにする
    const cur = items[Math.round(pos)];
    if (cur && !cur.end && !cur.claimed && rt > 0.6) claim(cur, true);
    open = false;
    closeComments(true);
    root.classList.remove('shown');
    root.classList.add('closing');
    setTimeout(() => { if (!open) root.hidden = true; }, 320);
    G.audio.playHome();
    G.audio.sfx('close');
    G.sim.save();
    G.emit('reelsClosed', { count: sessionCount, gold: sessionGold, ranked: rankedInFeed });
  };

  function startRewatch() {
    const past = G.state.reels.filter((r) => r.claimed && !r.digest).slice(-12);
    if (!past.length) { G.ui.toast('まだ冒険譚がありません'); return; }
    past.forEach(ensureComments);
    items = past.concat([{ end: true }]);
    rewatch = true;
    pos = target = 0;
    rt = 0;
    fired = {};
    firedFor = null;
    parts = [];
    updateDom();
  }

  // ---------------------------------------------------------------- 受け取り
  // 見届けた＝敵を倒す（撤退する）ところまで見た。見届けると +20%・町の人の贈り物・連続ボーナスが続く
  const claimInfo = new Map();
  R.watchInfo = (reel) => claimInfo.get(reel.id) || null;
  function witnessedNow(reel) {
    if (reel.digest) return true;
    return firedFor === reel && rt >= planOf(reel).finishT + 0.1;
  }
  function claim(reel, quick) {
    if (rewatch || reel.claimed) return;
    const st = G.state;
    const seen = !quick || witnessedNow(reel);
    const streakB = seen ? Math.min(0.3, st.streak * 0.05) : 0;
    const bonus = (seen ? 0.2 : 0) + streakB + cheer * 0.01;
    const res = G.sim.claimReel(reel, bonus, st, { gifts: seen });
    if (!res) return;
    claimInfo.set(reel.id, { seen, streak: seen ? st.streak + 1 : 0, streakB, cheer, gold: res.gold });
    if (seen) {
      st.streak++;
      st.stats.witnessed = (st.stats.witnessed || 0) + 1;
    } else {
      // 飛ばしても責めない。連続視聴ボーナスは静かに次の一本から数え直す
      st.streak = 0;
    }
    sessionCount++;
    sessionGold += res.gold;
    const from = [ox + 180 * k, Hd * 0.3 * k];
    if (res.gold > 0) G.ui.flyCoins(from[0], from[1], res.gold, false, G.$('#reelGold'));
    if (res.items && res.items.length && quick) {
      res.items.forEach((it) => G.ui.toast(`《${it.name}》を手に入れた！`, 'rare' + it.rarity, 'item'));
    }
    G.ui.refreshHud();
    updateDom();
    if (quick) G.audio.sfx('coins');
  }
  function claimAll() {
    const left = items.filter((r) => !r.end && !r.claimed);
    if (!left.length) return;
    let gold = 0, got = 0;
    G.state.streak = 0;
    left.forEach((r) => {
      const res = G.sim.claimReel(r, 0, G.state, { gifts: false });
      if (res) { gold += res.gold; sessionGold += res.gold; sessionCount++; got += (res.items || []).length; }
    });
    G.ui.flyCoins(W / 2, H / 2, gold, false, G.$('#reelGold'));
    G.audio.sfx('coins');
    G.ui.toast(`${left.length}本ぶん まとめて受け取りました（+${G.fmt(gold)}G${got ? `・お宝${got}個` : ''}）。見届けボーナスと贈り物はなし`, 'good');
    goTo(items.length - 1);
    G.ui.refreshHud();
    updateDom();
  }

  // ---------------------------------------------------------------- 入力
  function onDown(e) {
    G.audio.init();
    if (cmOpen) return;
    cv.setPointerCapture(e.pointerId);
    drag = { y0: e.clientY, x0: e.clientX, y: e.clientY, t0: performance.now(), lastY: e.clientY, lastT: performance.now(), v: 0, moved: false, pos0: pos };
    anim = null;
    holdTimer = setTimeout(() => {
      if (drag && !drag.moved) { paused = true; drag.hold = true; G.$('#reelPause').hidden = false; }
    }, 380);
  }
  function onMove(e) {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 8) { drag.moved = true; clearTimeout(holdTimer); }
    if (!drag.moved) return;
    let p = drag.pos0 - dy / H;
    if (p < 0) p = -Math.pow(-p, 0.7) * 0.3;
    if (p > items.length - 1) p = items.length - 1 + Math.pow(p - (items.length - 1), 0.7) * 0.3;
    pos = p;
    const now = performance.now();
    drag.v = G.lerp(drag.v, (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT), 0.5);
    drag.lastY = e.clientY;
    drag.lastT = now;
  }
  function onUp(e) {
    if (!drag) return;
    clearTimeout(holdTimer);
    const d = drag;
    drag = null;
    if (d.hold) { paused = false; G.$('#reelPause').hidden = true; return; }
    if (d.moved) {
      const base = Math.round(d.pos0);
      let to = base;
      const moved = pos - d.pos0;
      if (moved > 0.16 || d.v < -0.45) to = base + 1;
      else if (moved < -0.16 || d.v > 0.45) to = base - 1;
      goTo(G.clamp(to, 0, items.length - 1));
      return;
    }
    const now = performance.now();
    const x = e.clientX, y = e.clientY;
    // 流れてくるコメントをタップ → コメント欄
    const rx = (x - ox) / k, ry = y / k;
    const cur = items[Math.round(pos)];
    if (cur && !cur.end && rx < 292 && ry > Hd - safeB - 196 && ry < Hd - safeB - 112 && tickerRows(cur, rt).length) {
      openComments();
      lastTapT = 0;
      return;
    }
    if (now - lastTapT < 300 && Math.hypot(x - lastTapX, y - lastTapY) < 40) {
      like([x, y]);
      lastTapT = 0;
    } else {
      lastTapT = now; lastTapX = x; lastTapY = y;
      tapCheer(x, y);
    }
  }

  function goTo(i) {
    const cur = Math.round(pos);
    if (i !== cur) {
      const leaving = items[cur];
      // 結果を見る前にスワイプしても、報酬はちゃんと受け取る
      if (leaving && !leaving.end && !leaving.claimed) claim(leaving, true);
      G.audio.sfx('swipe');
      G.haptic(5);
      if (!hintShown) { hintShown = true; G.$('#reelHint').hidden = true; }
    }
    anim = { from: pos, to: i, t: 0, dur: i === cur ? 0.22 : 0.3 };
    target = i;
  }

  function tapCheer(x, y) {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end || cur.digest) return;
    const pl = planOf(cur);
    if (rt > pl.encT && rt < pl.finishT + 0.2 && !cur.claimed) {
      if (cheer < 10) cheer++;
      for (let i = 0; i < 6; i++) addPart(sparkP((x - ox) / k, y / k, '#ffe27a', true));
      addPart({ type: 'text', ui: true, x: (x - ox) / k, y: y / k - 10, vx: 0, vy: -40, life: 0, max: 0.8, text: '応援！', col: '#fff3b0' });
      G.audio.sfx('cheer');
      G.haptic(4);
    }
  }

  function like(at) {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end) return;
    const p = at ? [(at[0] - ox) / k, at[1] / k] : [326, Hd - 250 - safeB];
    for (let i = 0; i < (at ? 5 : 3); i++) {
      addPart({ type: 'heart', ui: true, x: p[0] + G.rand(-12, 12), y: p[1] + G.rand(-6, 6), vx: G.rand(-30, 30), vy: G.rand(-120, -60), life: 0, max: G.rand(0.8, 1.2), size: G.rand(16, 30), rot: G.rand(-0.4, 0.4) });
    }
    G.audio.sfx('heart');
    G.haptic(10);
    if (!cur.liked) {
      cur.liked = true;
      if (!rewatch) {
        G.state.stats.likes++;
        // 冒険者の絆が深まる
        const mul = 1 + (G.items ? G.items.relicFx('bond') : 0);
        cur.party.forEach((pa) => {
          const a = G.state.adv.find((x) => x.id === pa.id);
          if (a && a.bond < 10) a.bond = Math.min(10, a.bond + (a.trait === 'drinker' || a.trait === 'singer' ? 1 : 0.5) * mul);
        });
        if (cur.party.length) addPart({ type: 'text', ui: true, x: 110, y: Hd * 0.6 - 140, vx: 0, vy: -24, life: 0, max: 1.4, text: '絆が深まった ♥', col: '#ffb3c6' });
      }
      updateDom();
    }
  }

  // ---------------------------------------------------------------- コメント
  // 届いたコメント（親）と返信を、届いた順に平らに並べる
  function arrivedFlat(reel, t) {
    const out = [];
    (reel.cm || []).forEach((c) => {
      if (c.t <= t) out.push({ c, t: c.t, key: c.id });
      c.replies.forEach((r, j) => { if (r.t <= t && c.t <= t) out.push({ c: r, parent: c, t: r.t, key: c.id + ':' + j }); });
    });
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  function arrivedCount(reel, t) {
    let n = 0;
    (reel.cm || []).forEach((c) => {
      if (c.t > t) return;
      n++;
      c.replies.forEach((r) => { if (r.t <= t) n++; });
    });
    return n;
  }
  function totalCount(reel) {
    let n = 0;
    (reel.cm || []).forEach((c) => { n += 1 + c.replies.length; });
    return n;
  }
  function reelT(reel) {
    const cur = items[Math.round(pos)];
    return reel === cur ? rt : 999;
  }
  function authorOf(key, reel) {
    if (key === 'master') return { name: 'ギルドマスター', master: true };
    return G.comments ? G.comments.author(key, reel) : { name: key };
  }
  function avatarCanvas(au, size) {
    if (au.rina) return art.rinaCanvas ? art.rinaCanvas(size, 'smile') : art.letterCanvas('リナ', size);
    if (au.master) return art.crestCanvas(size);
    if (au.cat) return art.catCanvas(size);
    if (au.look) return art.portraitCanvas(au.look, size);
    return art.letterCanvas(au.name || '?', size);
  }
  function nameColor(au) {
    if (au.rina) return '#8ff0cf';
    if (au.master) return '#ffe39a';
    if (au.self) return '#ffd36a';
    if (au.rival) return '#ff9a80';
    if (au.member) return '#a8dcff';
    return 'rgba(255,255,255,0.78)';
  }
  function badgeOf(au, c) {
    if (c && c.pin) return '<i class="c-badge pin">固定</i>';
    if (au.rina) return '<i class="c-badge rina">受付</i>';
    if (au.master) return '<i class="c-badge master">あなた</i>';
    if (au.self) return '<i class="c-badge self">本人</i>';
    if (au.rival) return '<i class="c-badge rival">黒鉄団</i>';
    if (au.member) return '<i class="c-badge member">ギルド</i>';
    if (au.traveler) return '<i class="c-badge trav">旅人</i>';
    return '';
  }

  const cmView = { reel: null, rows: new Map(), count: 0, syncT: 0 };
  function openComments() {
    const cur = items[Math.round(pos)];
    if (!cur || cur.end) return;
    ensureComments(cur);
    cmOpen = true;
    cmView.reel = cur;
    cmView.rows.clear();
    cmView.count = 0;
    G.$('#commentsList').innerHTML = '';
    syncComments(true);
    renderPost();
    const el = G.$('#comments');
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('shown'));
    G.audio.sfx('open');
    updateDom();
  }
  function closeComments(silent) {
    const el = G.$('#comments');
    if (!el || el.hidden) { cmOpen = false; return; }
    cmOpen = false;
    el.classList.remove('shown');
    setTimeout(() => { if (!cmOpen) el.hidden = true; }, 260);
    if (!silent) G.audio.sfx('close');
    updateDom();
  }

  function rowHtml(c, au, reel, reply) {
    const ava = art.url(avatarCanvas(au, reply ? 28 : 38));
    let gift = '';
    if (c.gift) {
      const it = c.gift;
      const thumb = G.ui.itemThumb ? `<img alt="" src="${G.ui.itemThumb(it, 40)}">` : '';
      gift = `<div class="c-gift r${it.rarity}">${thumb}<span><b>${art.RARITY_COL[it.rarity].name}</b>${G.esc(it.name)}</span></div>`;
    }
    const liked = c.liked ? ' on' : '';
    return `<img class="c-ava" alt="" src="${ava}"><div class="c-body"><div class="c-name"><b style="color:${nameColor(au)}">${G.esc(au.name)}</b>${badgeOf(au, c)}<span class="c-time">たった今</span></div><p>${G.esc(c.text)}</p>${gift}</div><button class="c-like${liked}" aria-label="いいね"><svg viewBox="0 0 20 20"><polygon points="10,18 1.5,9.5 2.5,4 6,2.5 10,6 14,2.5 17.5,4 18.5,9.5"/></svg><span>${G.fmt(c.likes + (c.liked ? 1 : 0))}</span></button>`;
  }

  function syncComments(initial) {
    const reel = cmView.reel;
    if (!reel) return;
    const list = G.$('#commentsList');
    const t = reelT(reel);
    const flat = arrivedFlat(reel, t);
    let added = 0;
    flat.forEach((e) => {
      if (cmView.rows.has(e.key)) return;
      const au = authorOf(e.c.a, reel);
      const isNew = !initial;
      if (!e.parent) {
        const wrap = G.el('div', 'c-item' + (e.c.pin ? ' pin' : '') + (e.c.gift ? ' gift' : '') + (e.c.a === 'master' ? ' mine' : '') + (isNew ? ' new' : ''));
        wrap.dataset.cid = e.key;
        const row = G.el('div', 'c-row', rowHtml(e.c, au, reel, false));
        row.dataset.like = e.key;
        wrap.appendChild(row);
        wrap.appendChild(G.el('div', 'c-replies'));
        // 固定コメントは一番上、ほかは新しいものが上
        if (e.c.pin) list.prepend(wrap);
        else {
          const pins = list.querySelectorAll(':scope > .c-item.pin');
          const after = pins.length ? pins[pins.length - 1] : null;
          if (after) after.after(wrap); else list.prepend(wrap);
        }
        cmView.rows.set(e.key, wrap);
      } else {
        const pw = cmView.rows.get(e.parent.id);
        if (!pw) return;
        const row = G.el('div', 'c-row reply' + (isNew ? ' new' : ''), rowHtml(e.c, au, reel, true));
        row.dataset.like = e.key;
        pw.querySelector('.c-replies').appendChild(row);
        cmView.rows.set(e.key, row);
      }
      added++;
    });
    // 「たった今」→ 時間の表記
    G.$$('.c-row', list).forEach((row) => {
      const key = row.dataset.like;
      const e = flat.find((x) => x.key === key);
      if (!e) return;
      const age = t - e.t;
      const tm = row.querySelector('.c-time');
      const txt = age < 4 ? 'たった今' : t > 900 ? agoText(reel, e.t) : `${Math.floor(age)}秒前`;
      if (tm.textContent !== txt) tm.textContent = txt;
    });
    const n = flat.length;
    G.$('#commentsCount').textContent = `コメント ${n}件`;
    if (!initial && added > 0) {
      const plus = G.$('#commentsPlus');
      plus.textContent = `+${added}`;
      plus.classList.remove('go');
      void plus.offsetWidth;
      plus.classList.add('go');
      const head = G.$('#commentsCount');
      head.classList.remove('bump');
      void head.offsetWidth;
      head.classList.add('bump');
    }
    let empty = G.$('#commentsEmpty');
    if (!n) {
      if (!empty) { empty = G.el('p', '', 'まだコメントはありません。<br>戦いを見守っていると、町の人たちが書き込みに来ます…'); empty.id = 'commentsEmpty'; list.appendChild(empty); }
    } else if (empty) empty.remove();
    cmView.count = n;
  }
  function agoText(reel, ct) {
    const sec = Math.max(0, G.now() - (reel.ts || G.now())) + ct * 20;
    if (sec < 60) return 'たった今';
    if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
    return `${Math.floor(sec / 86400)}日前`;
  }

  function onCommentListClick(e) {
    const btn = e.target.closest('.c-like');
    if (!btn) return;
    const row = btn.closest('.c-row');
    const key = row && row.dataset.like;
    const reel = cmView.reel;
    if (!key || !reel) return;
    const [cid, j] = key.split(':');
    const c0 = (reel.cm || []).find((c) => c.id === cid);
    if (!c0) return;
    const c = j != null ? c0.replies[+j] : c0;
    if (!c) return;
    c.liked = !c.liked;
    btn.classList.toggle('on', c.liked);
    btn.querySelector('span').textContent = G.fmt(c.likes + (c.liked ? 1 : 0));
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    G.audio.sfx(c.liked ? 'heart' : 'soft');
    G.haptic(6);
  }

  // マスター（あなた）のひとこと
  const QUICK = ['おつかれさま！', 'ナイスファイト！', 'さすがうちのギルド', '最高だった！', '無事でよかった'];
  function renderPost() {
    const box = G.$('#commentsPost');
    const reel = cmView.reel;
    if (!box || !reel) return;
    if (reel.digest || !reel.party.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    if (reel.posted) {
      box.innerHTML = '<span class="c-posted">マスターとしてコメントしました</span>';
      return;
    }
    const rnd = mulberry(reel.seed ^ 0x77);
    const opts = QUICK.slice().sort(() => rnd() - 0.5).slice(0, 3);
    if (reel.tier === 'fail') opts[0] = '無事でよかった';
    box.innerHTML = `<span class="c-me"><img alt="" src="${art.url(art.crestCanvas(28))}"></span>` + opts.map((o) => `<button class="c-chip">${G.esc(o)}</button>`).join('');
    G.$$('.c-chip', box).forEach((b) => b.addEventListener('click', () => postMaster(b.textContent)));
  }
  function postMaster(text) {
    const reel = cmView.reel;
    if (!reel || reel.posted) return;
    const st = G.state;
    const t = Math.min(reelT(reel), 900);
    const c = { id: 'm' + Date.now().toString(36), t, a: 'master', text, likes: 0, replies: [] };
    // いちばん絆の深い人が返事をくれる
    const party = reel.party.map((p) => st.adv.find((a) => a.id === p.id) || p);
    const who = party.slice().sort((a, b) => (b.bond || 0) - (a.bond || 0))[0];
    if (who) {
      const line = G.comments && G.comments.masterReply ? G.comments.masterReply(reel, who) : 'マスター、ありがとう！';
      c.replies.push({ t: t + 1.3, a: 'party:' + who.id, text: line, likes: 2 + Math.floor(Math.random() * 12) });
      const real = st.adv.find((a) => a.id === who.id);
      if (real && !rewatch && real.bond < 10) real.bond = Math.min(10, real.bond + 0.5);
    }
    if (!reel.cm) reel.cm = [];
    reel.cm.push(c);
    reel.posted = true;
    st.stats.posts = (st.stats.posts || 0) + 1;
    G.audio.sfx('commentPop');
    G.haptic(8);
    syncComments(false);
    renderPost();
    G.$('#commentsList').scrollTop = 0;
  }

  // ---------------------------------------------------------------- DOM
  function placeHitAreas() {
    const set = (id, x, y, w, h) => {
      const el = G.$(id);
      el.style.left = (ox + (x - w / 2) * k) + 'px';
      el.style.top = ((y - h / 2) * k) + 'px';
      el.style.width = w * k + 'px';
      el.style.height = h * k + 'px';
    };
    set('#reelLike', 326, Hd - 250 - safeB, 52, 60);
    set('#reelComments', 326, Hd - 185 - safeB, 52, 60);
  }
  function updateDom() {
    const st = G.state;
    const idx = Math.round(target);
    const reelCount = items.length - 1;
    const cur = items[idx];
    G.$('#reelTitle').textContent = rewatch ? '過去の冒険譚' : cur && cur.end ? '冒険譚' : `冒険譚 ${idx + 1}/${reelCount}`;
    G.$('#reelGold').querySelector('b').textContent = G.fmt(st.gold);
    const left = items.filter((r) => !r.end && !r.claimed).length;
    G.$('#reelAll').hidden = rewatch || left < 2 || cmOpen;
    G.$('#reelAll').textContent = `まとめて受け取る（${left}）`;
    const streak = Math.min(0.3, st.streak * 0.05);
    const sc = G.$('#reelStreak');
    sc.hidden = rewatch || cmOpen || (cur && cur.end) || !cur || cur.claimed || cur.digest;
    sc.innerHTML = `見届けると <b>+${Math.round((0.2 + streak) * 100)}%</b>${st.streak ? `<small>連続${st.streak}本</small>` : ''}`;
    const showHit = cur && !cur.end && !cmOpen;
    G.$('#reelLike').hidden = !showHit;
    G.$('#reelComments').hidden = !showHit;
    const end = G.$('#reelEnd');
    if (cur && cur.end) fillEnd();
    end.dataset.active = cur && cur.end ? '1' : '0';
  }

  function fillEnd() {
    const st = G.state;
    const box = G.$('#endActive');
    box.innerHTML = '';
    const now = G.now();
    const act = st.active.slice().sort((a, b) => a.endAt - b.endAt);
    G.$('#endTitle').textContent = rewatch ? 'ここまでが最近の冒険譚です' : sessionCount ? 'すべての冒険譚を見ました' : '新しい冒険譚はまだありません';
    G.$('#endSummary').textContent = sessionCount ? `${sessionCount}本 視聴 ・ +${G.fmt(sessionGold)}G` : '';
    if (act.length) {
      const next = act[0];
      G.$('#endNext').innerHTML = `次の冒険譚まで <b data-countdown="${next.endAt}">${G.fmtClock(next.endAt - now)}</b>`;
      act.forEach((ex) => {
        const adv = st.adv.find((a) => a.id === ex.party[0]);
        const row = G.el('div', 'end-row');
        const k2 = G.clamp((now - ex.startAt) / (ex.endAt - ex.startAt), 0, 1);
        row.innerHTML = `${adv ? `<img alt="" src="${art.portrait(adv.look, 36)}">` : ''}<div><b>${G.esc(ex.q.name)}</b><div class="bar"><i style="width:${k2 * 100}%" data-progress="${ex.startAt},${ex.endAt}"></i></div></div><span data-countdown="${ex.endAt}">${G.fmtClock(ex.endAt - now)}</span>`;
        box.appendChild(row);
      });
    } else {
      G.$('#endNext').textContent = '遠征中のパーティはいません';
    }
    const idle = st.adv.filter((a) => a.status === 'idle').length;
    const free = G.sim.slots() - st.active.length;
    const btn = G.$('#endQuests');
    btn.classList.toggle('pulse', idle > 0 && free > 0);
    btn.textContent = idle > 0 && free > 0 ? `依頼を出す（待機中 ${idle}人）` : '依頼を見る';
    G.$('#endHistory').hidden = rewatch || !st.reels.some((r) => r.claimed && !r.digest);
  }

  // 次に流す冒険譚の下ごしらえ（段取り・流れるコメント・顔・地形の絵・文字の絵）
  function warm(reel) {
    if (!open || !reel || reel.end || reel.digest || !W) return;
    try {
      const pl = planOf(reel);
      danmakuOf(reel);
      (reel.cm || []).forEach((c) => { avatarCanvas(authorOf(c.a, reel), 36); c.replies.forEach((r) => avatarCanvas(authorOf(r.a, reel), 36)); });
      overlaySprite(reel);
      const area = D.AREA_BY_ID[reel.area];
      const L = layout(reel);
      // 地形の絵を作る（画面には出さない）
      const saved = ctx;
      ctx = offscreenDummy();
      ctx.save();
      drawBg(area, 120, 2, L.gy, true);
      ctx.restore();
      ctx = saved;
      void pl;
    } catch (e) { /* 下ごしらえは失敗しても再生には影響しない */ }
  }
  let dummyCtx = null;
  function offscreenDummy() {
    if (!dummyCtx) { const c = document.createElement('canvas'); c.width = c.height = 2; dummyCtx = c.getContext('2d'); }
    return dummyCtx;
  }

  // ---------------------------------------------------------------- 進行
  let rmNow = false;
  function warp(pl, t) {
    if (!pl || rmNow) return 1;
    for (const s of pl.stops) if (t >= s.t && t < s.t + s.d * 0.05) return 0.05;
    for (const s of pl.slows) if (t >= s.a && t < s.b) return s.f;
    return 1;
  }

  R.update = function (dt) {
    if (!open) return;
    rmNow = G.reducedMotion();
    viewK += ((cmOpen ? 1 : 0) - viewK) * Math.min(1, dt * 11);
    if (Math.abs(viewK - (cmOpen ? 1 : 0)) < 0.002) viewK = cmOpen ? 1 : 0;
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      pos = G.lerp(anim.from, anim.to, G.ease.outCubic(anim.t));
      if (anim.t >= 1) {
        pos = anim.to;
        anim = null;
        if (firedFor !== items[pos]) { rt = 0; fired = {}; cheer = 0; parts = []; }
        updateDom();
        setTimeout(() => warm(items[pos + 1]), 120);
      }
    }
    const idx = Math.round(pos);
    const cur = items[idx];
    const settled = !anim && !drag;
    warpNow = 1;
    if (cur && !cur.end && settled && !paused && !R._debug.hold) {
      if (firedFor !== cur) { firedFor = cur; rt = 0; fired = {}; cheer = 0; cmSeen = 0; cmBumpT = 9; G.audio.playTrack(trackOf(cur), { fade: 0.7 }); }
      const pl = cur.digest ? null : planOf(cur);
      warpNow = warp(pl, rt);
      rt += dt * warpNow;
      events(cur, pl);
      // 新しいコメントが届いた
      const n = arrivedCount(cur, rt);
      if (n > cmSeen) {
        if (cmSeen > 0 || rt > 0.3) {
          cmBumpN = n - cmSeen;
          cmBumpT = 0;
          const gift = (cur.cm || []).some((c) => c.gift && c.t <= rt && c.t > rt - dt * 2 - 0.05);
          G.audio.sfx(gift ? 'gift' : 'commentPop');
        }
        cmSeen = n;
      }
      const autoAt = pl ? pl.end : 4.5;
      if (G.state.settings.autoplay && rt > autoAt && !cmOpen) goTo(Math.min(items.length - 1, idx + 1));
    }
    cmBumpT += dt;
    if (cmOpen) {
      cmView.syncT -= dt;
      if (cmView.syncT <= 0) { cmView.syncT = 0.1; syncComments(false); }
    }
    // パーティクル（ヒットストップ中は一緒に止まる）
    const pdt = dt * Math.max(0.05, warpNow);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const d = p.ui ? dt : pdt;
      p.life += d;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      if (p.vr) p.rot += p.vr * d;
    }
    if (flashT > 0) flashT = Math.max(0, flashT - dt * 2.2);
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
    G.$$('#reelEnd [data-countdown]').forEach((el) => { el.textContent = G.fmtClock(+el.dataset.countdown - G.now()); });
    G.$$('#reelEnd [data-progress]').forEach((el) => {
      const [a, b] = el.dataset.progress.split(',').map(Number);
      el.style.width = G.clamp((G.now() - a) / (b - a), 0, 1) * 100 + '%';
    });
    const end = G.$('#reelEnd');
    const endIdx = items.length - 1;
    end.style.transform = `translateY(${(endIdx - pos) * H}px)`;
    end.style.visibility = Math.abs(endIdx - pos) < 1.01 ? 'visible' : 'hidden';
    const off = (idx - pos) * H;
    G.$('#reelLike').style.transform = G.$('#reelComments').style.transform = `translateY(${off}px)`;
  };

  function once(key, at) {
    if (rt >= at && !fired[key]) { fired[key] = true; return true; }
    return false;
  }
  const sfx = (n, a) => G.audio.sfx(n, a);

  function events(reel, pl) {
    if (reel.digest) {
      if (once('roll', 0.5)) sfx('roll');
      if (once('rev', 1.2)) {
        sfx('reveal', 'great');
        for (let i = 0; i < 40; i++) addPart(confettiP(180 + G.rand(-60, 60), Hd * 0.45));
      }
      if (once('claim', 1.5)) claim(reel);
      return;
    }
    const L = layout(reel);
    const mcol = D.MONSTERS[reel.monster].color;
    const mcy = L.gy - L.mh * 0.5;
    if (once('enc', pl.encT)) {
      sfx(pl.big ? 'roar' : 'encounter');
      if (pl.big) G.haptic(18);
    }
    pl.beats.forEach((b, i) => {
      const p = reel.party[b.who];
      if (b.kind === 'skill') {
        if (once('bulb' + i, b.t - 0.45)) { sfx('flash'); G.haptic(10); }
        if (once('cut' + i, b.t)) { sfx('cutin'); flashT = 0.35; flashCol = '#ffffff'; }
        skillEvents(reel, pl, b, i, L, mcy, mcol, true);
      } else if (b.kind === 'hit' && b.w0 != null) {
        skillEvents(reel, pl, b, i, L, mcy, mcol, false);
      } else if (b.kind === 'hit') {
        if (once('sw' + i, b.t + 0.02)) sfx(b.melee ? 'swish' : p && p.cls === 'archer' ? 'arrow' : 'cast');
        if (once('h' + i, b.at)) {
          sfx(b.crit ? 'crit' : 'impact', b.crit ? 1 : 0);
          for (let j = 0; j < (b.crit ? 16 : 7); j++) addPart(shardP(L.mx - 6, mcy, mcol));
          if (b.crit) for (let j = 0; j < 8; j++) addPart(sparkP(L.mx, mcy, '#ffe9a0'));
          addDmg(L.mx + b.jx * 14, L.gy - L.mh - 12, b.dmg, b.crit ? 'crit' : 'hit');
          G.haptic(b.crit ? 16 : 6);
        }
      } else if (b.kind === 'mon') {
        if (once('mw' + i, b.t + 0.05)) sfx('swish', 1);
        if (once('m' + i, b.at)) {
          const px = L.px[b.target] != null ? L.px[b.target] : L.px[0];
          if (b.miss) {
            sfx('miss');
            addPart({ type: 'dmg', x: px, y: L.gy - 92, vx: 0, vy: -50, g: 90, life: 0, max: 0.9, text: 'MISS', kind: 'miss' });
          } else {
            sfx(b.big ? 'impact' : 'hurt', b.big ? 2 : 0);
            for (let j = 0; j < (b.big ? 12 : 6); j++) addPart(sparkP(px, L.gy - 40, '#ffffff'));
            addPart({ type: 'dmg', x: px, y: L.gy - 92, vx: 0, vy: -60, g: 120, life: 0, max: 0.95, text: String(b.dmg), kind: 'hurt' });
            if (b.big) { flashT = 0.45; flashCol = '#ff4030'; }
            G.haptic(b.big ? 30 : 10);
          }
        }
      } else if (b.kind === 'heal') {
        if (once('hl' + i, b.at)) {
          sfx('heal');
          const px = L.px[b.target] != null ? L.px[b.target] : L.px[0];
          for (let j = 0; j < 12; j++) addPart({ type: 'plus', x: px + G.rand(-16, 16), y: L.gy - G.rand(10, 70), vx: 0, vy: G.rand(-50, -20), life: 0, max: G.rand(0.7, 1.1), size: G.rand(3, 5) });
          addPart({ type: 'dmg', x: px, y: L.gy - 96, vx: 0, vy: -45, g: 80, life: 0, max: 0.95, text: '+' + b.dmg, kind: 'heal' });
        }
      }
    });
    if (!pl.fail) {
      if (once('shatter', pl.finishT + 0.02)) {
        sfx('shatter');
        for (let i = 0; i < 56; i++) addPart(shardP(L.mx, mcy, mcol, true));
        G.haptic(reel.tier === 'legend' || reel.tier === 'great' ? 26 : 14);
      }
      if (once('drop', pl.dropT + 0.3)) sfx('bounce');
      if (once('drop2', pl.dropT + 0.5)) sfx('bounce');
      if (once('roll', pl.rollT)) sfx('roll');
      pl.chestSteps.forEach((r, i) => {
        if (i > 0 && once('up' + i, pl.stepT[i])) {
          sfx('rarity', r);
          flashT = 0.3; flashCol = art.RARITY_COL[r].glow;
          for (let j = 0; j < 14; j++) addPart(sparkP(L.cx, L.gy - 30, art.RARITY_COL[r].glow));
          G.haptic(14 + r * 4);
        }
      });
      if (once('reveal', pl.reveal)) {
        sfx('chest');
        sfx('reveal', reel.tier);
        if (pl.chestRank >= 2) sfx('rarity', pl.chestRank);
        const nC = { 0: 14, 1: 30, 2: 60, 3: 90, 4: 140 }[pl.chestRank] || 14;
        for (let i = 0; i < nC; i++) addPart(confettiP(L.cx + G.rand(-40, 40), L.gy - 20));
        if (pl.chestRank >= 3 || reel.tier === 'legend') { flashT = 0.7; flashCol = pl.chestRank >= 4 ? '#ffffff' : '#fff0b0'; G.haptic(40); }
      }
      if (pl.itemT && once('item', pl.itemT)) sfx('gift');
    } else {
      if (once('flee', pl.fleeT)) sfx('whoosh');
    }
    // 常連の通知（左上のカード）
    const pops = popsOf(reel);
    for (let j = 0; j < pops.length; j++) {
      if (once('pop' + j, pops[j].t0)) { sfx(pops[j].c.gift ? 'gift' : 'claim'); G.haptic(5); }
    }
    if (once('res', pl.resT)) sfx('stamp', reel.tier);
    ['g', 'm', 'f'].forEach((key, i) => { if (once('tick' + key, pl.resT + 0.2 + i * 0.18)) sfx('tick'); });
    if (once('claim', pl.resT + 0.35)) claim(reel);
    if (reel.levelUps.length && once('lv', pl.lvT)) {
      sfx('levelup');
      reel.levelUps.forEach((lu) => {
        const i = reel.party.findIndex((p) => p.id === lu.id);
        const x = L.px[i] != null ? L.px[i] : 180;
        for (let j = 0; j < 12; j++) addPart(sparkP(x, L.gy - 60, '#9fe8ff'));
      });
    }
    if (reel.extra === 'recruit' && once('recruit', pl.recruitT)) sfx('door');
  }

  // ---------------------------------------------------------------- パーティクル
  function addPart(p) { if (parts.length < 600) parts.push(p); }
  function sparkP(x, y, col, ui) {
    return { type: 'spark', ui, x, y, vx: G.rand(-110, 110), vy: G.rand(-160, -30), g: 220, life: 0, max: G.rand(0.4, 0.8), col, size: G.rand(2, 4.5), rot: G.rand(0, 6) };
  }
  function confettiP(x, y, ui) {
    return { type: 'tri', ui, x, y, vx: G.rand(-170, 170), vy: G.rand(-390, -120), g: 420, life: 0, max: G.rand(1.6, 2.6), col: G.pick(['#ffcf4a', '#ff7a6a', '#6ad0ff', '#8fe08a', '#c79bff', '#ffffff']), size: G.rand(4, 7.5), rot: G.rand(0, 6), vr: G.rand(-9, 9) };
  }
  function shardP(x, y, col, big) {
    const a = G.rand(0, TAU), sp = G.rand(60, big ? 340 : 170);
    return { type: 'tri', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 380, life: 0, max: G.rand(0.6, 1.2), col: G.shade(col, G.rand(-0.25, 0.25)), size: G.rand(3, big ? 9 : 5), rot: G.rand(0, 6), vr: G.rand(-12, 12) };
  }
  function addDmg(x, y, v, kind, col) {
    const big = kind === 'skill' || kind === 'use' || kind === 'usecrit';
    addPart({ type: 'dmg', x, y, vx: G.rand(-14, 14), vy: big ? -95 : -75, g: 130, life: 0, max: big ? 1.3 : 1, text: G.fmt(v), kind, col });
  }
  // 技の音・手ごたえ・パーティクル（セットした技・閃きの両方）
  function skillEvents(reel, pl, b, i, L, mcy, mcol, flash) {
    const p = reel.party[b.who];
    const fx = beatFx(b, p);
    const home = L.px[b.who] != null ? L.px[b.who] : L.px[0];
    if (!flash && once('uw' + i, b.w0)) {
      sfx('magic');
      G.haptic(6);
      for (let j = 0; j < 8; j++) addPart(sparkP(home + G.rand(-16, 16), L.gy - G.rand(20, 80), fx.col));
    }
    if (once('ug' + i, b.s0)) sfx(fx.go || 'swish');
    if (once('h' + i, b.at)) {
      skillCtx(reel, pl, b, b.at, L, flash ? 1.45 : 1);
      if (fx.hitS === 'impact') { sfx('impact', 2); if (b.crit || flash) sfx('crit'); }
      else { sfx('crit'); sfx('impact', fx.heavy || flash ? 2 : 1); }
      if (fx.extra) sfx(fx.extra[0], fx.extra[1]);
      const nS = flash ? 34 : b.crit ? 18 : 12;
      for (let j = 0; j < nS; j++) addPart(shardP(L.mx, mcy, mcol, flash || b.crit));
      for (let j = 0; j < (flash ? 16 : 10); j++) addPart(sparkP(L.mx, mcy, j % 2 ? '#fff6c0' : fx.col));
      if (fx.parts) fx.parts(SX);
      addDmg(L.mx + b.jx * 10, L.gy - L.mh - (flash ? 18 : 16), b.dmg, flash ? 'skill' : b.crit ? 'usecrit' : 'use', fx.col);
      if (!rmNow && (fx.flash || flash)) { flashT = flash ? 0.5 : 0.3; flashCol = fx.flash || '#fff4d0'; }
      if (fx.heal) healParty(L, reel);
      G.haptic(flash ? 32 : b.crit ? 24 : 18);
    }
    if (fx.multi) {
      for (let j = 0; j < fx.multi.length; j++) {
        if (once('hm' + i + '_' + j, b.at + fx.multi[j])) {
          sfx('impact', 0);
          for (let k2 = 0; k2 < 5; k2++) addPart(sparkP(L.mx + G.rand(-22, 22), mcy + G.rand(-18, 18), fx.col));
          G.haptic(4);
        }
      }
    }
  }

  // ---------------------------------------------------------------- 配置・カメラ
  function layout(reel) {
    const gy = Hd * 0.6;
    const n = reel.party.length || 1;
    const px = [];
    const sp = n >= 4 ? 36 : 44;
    for (let i = 0; i < n; i++) px.push(146 - i * sp);
    const mh = art.monsterHeight[reel.monster] || 40;
    const ms = reel.monster === 'dragon' ? 1.55 : reel.monster === 'slime' ? 2.4 : mh > 50 ? 1.7 : 2.1;
    return { gy, px, mx: 266, mh: mh * ms, ms, cx: 222 };
  }

  function camAt(reel, pl, t, L) {
    let z = 1, ex = 0, ey = 0, ew = 0;
    // 歩いて入ってくる間は少し寄ってパーティを追う
    const walk = G.clamp(t / 1.1, 0, 1);
    z += 0.1 * (1 - G.ease.inOut(walk));
    let bx = G.lerp(110, 180, G.ease.inOut(walk)), by = Hd * 0.5;
    if (!pl || rmNow) return (lastCam = { z: 1, x: 180, y: Hd * 0.5 });
    const imp = (t0, rise, dur, amp, x, y) => {
      const d = t - t0;
      if (d < -rise || d > dur) return;
      const e = d < 0 ? G.ease.outCubic(1 + d / rise) : 1 - G.ease.inOut(d / dur);
      z += amp * e; ex += x * e; ey += y * e; ew += e;
    };
    const my = L.gy - L.mh * 0.5;
    imp(pl.encT + 0.05, 0.12, 0.85, pl.big ? 0.2 : 0.14, L.mx, my);
    pl.beats.forEach((b) => {
      if (b.kind === 'hit' && b.use) {
        // 技：溜めの間は使い手に少し寄り、命中でぐっと寄る
        const hx = L.px[b.who] != null ? L.px[b.who] : L.px[0];
        imp(b.s0, USE_WIND, 0.14, 0.06, hx + 40, L.gy - 56);
        imp(b.at, 0.06, b.crit ? 0.55 : 0.48, b.crit ? 0.2 : 0.15, L.mx, my);
      } else if (b.kind === 'hit') imp(b.at, 0.05, b.crit ? 0.42 : 0.25, b.crit ? 0.14 : 0.04, L.mx, my);
      else if (b.kind === 'skill') imp(b.at, 0.06, 0.7, 0.24, L.mx, my);
      else if (b.kind === 'mon') {
        const px = L.px[b.target] != null ? L.px[b.target] : L.px[0];
        imp(b.at, 0.08, b.big ? 0.6 : 0.3, b.big ? 0.16 : 0.05, px, L.gy - 50);
      }
    });
    if (!pl.fail) {
      imp(pl.finishT, 0.25, 0.95, reel.tier === 'legend' ? 0.26 : 0.18, L.mx, my);
      // 宝箱：揺れている間はぐっと寄る
      const e = G.seg(t, pl.rollT - 0.25, pl.rollT + 0.2) * (1 - G.seg(t, pl.reveal + 0.35, pl.reveal + 0.9));
      if (e > 0) { const ee = G.ease.inOut(e); z += 0.17 * ee; ex += L.cx * ee; ey += (L.gy - 40) * ee; ew += ee; }
    }
    z = G.clamp(z, 1, 1.5);
    let fx = bx, fy = by;
    if (ew > 0) {
      const w = Math.min(1, ew);
      fx = G.lerp(bx, ex / ew, w);
      fy = G.lerp(by, ey / ew, w);
    }
    const hx = 180 / z, hy = Hd / 2 / z;
    fx = G.clamp(fx, hx, 360 - hx);
    fy = G.clamp(fy, hy, Hd - hy);
    return (lastCam = { z, x: fx, y: fy });
  }
  function shakeAt(reel, pl, t) {
    if (!pl || rmNow) return [0, 0];
    let sx = 0, sy = 0;
    const kick = (t0, amp, dur) => {
      const d = t - t0;
      if (d <= 0 || d > dur) return;
      const a = (1 - d / dur) * amp;
      sx += Math.sin(d * 95) * a;
      sy += Math.cos(d * 71) * a * 0.6;
    };
    pl.beats.forEach((b) => {
      if (b.kind === 'hit' && b.use) kick(b.at, (b.crit ? 8 : 6) * ((skillFx(b.use).shake) || 1), 0.4);
      else if (b.kind === 'hit') kick(b.at, b.crit ? 6 : 2.4, 0.3);
      else if (b.kind === 'skill') kick(b.at, 10 * ((skillFx(b.skill).shake) || 1), 0.5);
      else if (b.kind === 'mon' && !b.miss) kick(b.at, b.big ? 10 : 3.4, b.big ? 0.5 : 0.3);
    });
    if (!pl.fail) kick(pl.finishT, 8, 0.4);
    if (pl.big) kick(pl.encT, 5, 0.6);
    if (!pl.fail && pl.chestRank >= 3) kick(pl.reveal, 6, 0.4);
    return [sx, sy];
  }

  // ---------------------------------------------------------------- 描画
  R.render = function () {
    if (!open) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    const vk = G.ease.inOut(viewK);
    const i0 = Math.floor(pos), i1 = Math.ceil(pos);
    [i0, i1].forEach((i, n) => {
      if (n === 1 && i1 === i0) return;
      const it = items[i];
      if (!it || it.end) return;
      const off = (i - pos) * H;
      const m = viewMat(off, vk);
      ctx.save();
      ctx.setTransform(dpr * m.s, 0, 0, dpr * m.s, dpr * m.x, dpr * m.y);
      const cy0 = G.lerp(0, Hd * 0.2, vk), ch = G.lerp(Hd, Hd * 0.5, vk);
      ctx.beginPath();
      if (vk > 0.01) art.rrect(ctx, 0, cy0, 360, ch, 14 * vk);
      else ctx.rect(0, 0, 360, Hd);
      ctx.clip();
      const cur = i === Math.round(pos);
      const t = cur ? rt : (it.claimed && !rewatch ? 99 : 0.35);
      drawReel(it, t, cur, vk);
      ctx.restore();
    });
    if (banner) drawBanner();
  };
  function viewMat(off, vk) {
    const s0 = k, x0 = ox, y0 = off;
    if (vk <= 0) return { s: s0, x: x0, y: y0 };
    const top = (G.$('.reel-top') ? 52 : 40);
    const availH = H * 0.4 - top - 4;
    const s1 = Math.min((W - 16) / 360, availH / (Hd * 0.5));
    const x1 = W / 2 - 180 * s1;
    const y1 = top - Hd * 0.2 * s1 + off;
    return { s: G.lerp(s0, s1, vk), x: G.lerp(x0, x1, vk), y: G.lerp(y0, y1, vk) };
  }

  function drawReel(reel, t, cur, vk) {
    if (reel.digest) { drawDigest(reel, t); drawOverlay(reel, t, cur, null, 1 - vk); return; }
    const area = D.AREA_BY_ID[reel.area];
    const L = layout(reel);
    const pl = planOf(reel);
    const cam = camAt(reel, pl, t, L);
    const [shx, shy] = shakeAt(reel, pl, t);
    // ---- 世界（カメラの中）
    ctx.save();
    ctx.translate(180, Hd / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x + shx, -cam.y + shy);
    const walkK = G.clamp(t / 1.1, 0, 1);
    const fleeing = pl.fail && t > pl.fleeT;
    const scroll = G.ease.outCubic(walkK) * 120 + (fleeing ? -(t - pl.fleeT) * 220 : 0);
    const FX = G.reelfx; // 背景の生き物・見物人・空・風（reelfx.js）
    if (FX) FX.prep(reel, pl, L, t);
    drawBg(area, scroll, t, L.gy, walkK >= 1 && !fleeing);
    if (FX) FX.drawBack(ctx, area, scroll, t, L.gy, pl, reel, L);
    drawMagicCircles(reel, pl, t, L);
    drawMonster(reel, pl, t, L);
    drawParty(reel, pl, t, L);
    drawAttackFx(reel, pl, t, L);
    if (FX) FX.drawFront(ctx, area, scroll, t, L.gy, pl, reel);
    drawChest(reel, pl, t, L);
    drawRecruit(reel, pl, t, L);
    drawHpBar(reel, pl, t, L);
    drawOno(reel, pl, t, L);
    if (cur) drawParts(false);
    drawSpeech(reel, pl, t, L);
    ctx.restore();

    // ---- 画面の上に重ねるもの
    drawSpeedLines(reel, pl, t);
    drawDanmaku(reel, t, 1 - vk);
    drawTitleCard(reel, area, pl, t);
    drawCutin(reel, pl, t);
    if (t > pl.resT) drawResult(reel, pl, t, L);
    if (pl.itemT && t > pl.itemT) drawItemCard(reel, pl, t, L);
    drawOverlay(reel, t, cur, pl, 1 - vk);
    if (cur) {
      drawParts(true);
      if (flashT > 0) {
        ctx.fillStyle = G.rgba(flashCol.startsWith('#') ? flashCol : '#ffffff', Math.min(0.85, flashT));
        ctx.fillRect(0, 0, 360, Hd);
      }
    }
  }

  // ---------------------------------------------------------------- 魔物
  function drawMonster(reel, pl, t, L) {
    if (t < pl.encT - 0.1) return;
    const dead = !pl.fail && t > pl.finishT + 0.02;
    if (dead) return;
    const enter = G.ease.outBack(G.seg(t, pl.encT - 0.1, pl.encT + 0.38));
    let atk = 0, hit = 0, kx = 0, ky = 0;
    pl.beats.forEach((b) => {
      if (b.kind === 'mon') {
        const d = t - b.t;
        if (d > 0 && d < 0.5) atk = Math.max(atk, G.bump(d / 0.5));
      } else if (b.kind === 'hit' || b.kind === 'skill') {
        const d = t - b.at;
        if (d > -0.01 && d < 0.26) { hit = Math.max(hit, 1 - d / 0.26); kx = Math.max(kx, G.bump(d / 0.26) * (b.crit ? 18 : 9)); }
      }
    });
    // とどめの直前は白く光る
    if (!pl.fail && t > pl.finishT - 0.01) hit = 1;
    const fly = FLYING[reel.monster];
    const mx = L.mx + (fly ? 0 : (1 - enter) * 180) + kx;
    const my = fly ? -(1 - enter) * 220 : 0;
    const count = Math.min(3, reel.count || 1);
    for (let c = count - 1; c >= 0; c--) {
      ctx.save();
      const sc = L.ms * (c ? 0.78 : 1);
      ctx.translate(mx + c * 34, L.gy - c * 6 + my + ky);
      ctx.scale(-sc, sc);
      art.setFlash(c === 0 ? hit * 0.85 : 0);
      art.monster[reel.monster](ctx, { t: t + c * 0.7, atk: c === 0 ? atk : 0, color: monColor(reel) });
      art.setFlash(0);
      ctx.restore();
    }
    if (reel.boss) {
      ctx.fillStyle = 'rgba(255,80,40,0.12)';
      ctx.beginPath(); ctx.arc(mx, L.gy - 70, 110, 0, TAU); ctx.fill();
    }
    // 咆哮
    const roar = ROAR[reel.monster];
    if (roar && pl.big && t > pl.encT + 0.15 && t < pl.encT + 1.0) {
      const a = G.seg(t, pl.encT + 0.15, pl.encT + 0.3) * (1 - G.seg(t, pl.encT + 0.8, pl.encT + 1.0));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(mx - 20 + Math.sin(t * 80) * 2, L.gy - L.mh - 30);
      ctx.rotate(-0.12);
      jagText(roar, 0, 0, 20, '#ffe0d0', '#4a0e0a');
      ctx.restore();
    }
  }

  function drawHpBar(reel, pl, t, L) {
    const a0 = pl.encT + 0.35;
    const a1 = pl.fail ? pl.resT + 0.2 : pl.finishT + 0.35;
    if (t < a0 || t > a1) return;
    const a = G.seg(t, a0, a0 + 0.2) * (1 - G.seg(t, a1 - 0.2, a1));
    const hpAt = (tt) => {
      let hp = 1;
      pl.beats.forEach((b) => { if ((b.kind === 'hit' || b.kind === 'skill') && b.at <= tt) hp = b.hpAfter; });
      return hp;
    };
    const hp = hpAt(t);
    const lag = hpAt(t - 0.35);
    const w = 118, h = 7;
    const x = G.clamp(L.mx - w / 2, 8, 352 - w);
    const y = L.gy - L.mh - (FLYING[reel.monster] ? 64 : 34);
    ctx.save();
    ctx.globalAlpha = a;
    // 名前
    ctx.font = F(800, 11, 'head');
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,12,26,0.85)';
    const name = (reel.boss ? '竜王 ' : reel.guardian ? '守護者 ' : reel.abyss ? '深淵の' : '') + D.MONSTERS[reel.monster].name + (reel.count > 1 ? ` ×${Math.min(3, reel.count)}` : '');
    ctx.strokeText(name, x, y - 5);
    ctx.fillStyle = '#f6ecd2';
    ctx.fillText(name, x, y - 5);
    // 枠
    art.rrect(ctx, x - 2, y - 2, w + 4, h + 4, 3);
    ctx.fillStyle = 'rgba(8,12,26,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(x, y, w * lag, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    const col = hp > 0.5 ? ['#ff7a6a', '#c8322a'] : hp > 0.2 ? ['#ffb04a', '#d0641e'] : ['#ff4a6a', '#a0102e'];
    g.addColorStop(0, col[0]);
    g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * hp, h);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y, w * hp, 2);
    // 連続ヒット
    let combo = null;
    pl.beats.forEach((b) => { if (b.combo >= 2 && t > b.at && t < b.at + 0.9) combo = b; });
    if (combo) {
      const kk = G.ease.outBack(G.seg(t, combo.at, combo.at + 0.15));
      ctx.save();
      ctx.translate(x + w + 2, y + 16);
      ctx.scale(kk, kk);
      ctx.textAlign = 'right';
      ctx.font = F(900, 15, 'num');
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#2a1404';
      ctx.strokeText(combo.combo + ' HIT', 0, 0);
      ctx.fillStyle = '#ffd36a';
      ctx.fillText(combo.combo + ' HIT', 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- パーティ
  function partyX(reel, pl, t, L, i) {
    const p = reel.party[i];
    const walkK = G.clamp(t / 1.1, 0, 1);
    let x = L.px[i] - (1 - G.ease.outCubic(walkK)) * 210;
    // 技を使っている間は、技ごとの動き
    const sb = skillBeatOf(pl, i, t);
    if (sb) x = skillMotion(sb, beatFx(sb, p), t, L.px[i], L, MO2).x;
    pl.beats.forEach((b) => {
      if (!sb && b.kind === 'hit' && b.w0 == null && b.who === i && b.melee) {
        const s0 = b.t;
        const d = t - s0;
        if (d > 0 && d < 0.55) {
          const go = G.seg(d, 0, 0.17), back = G.seg(d, 0.24, 0.52);
          x = G.lerp(L.px[i], L.mx - 44, G.ease.outCubic(go) * (1 - G.ease.inOut(back)));
        }
      }
      if (b.kind === 'mon' && b.target === i) {
        const d = t - b.at;
        if (d > -0.12 && d < 0.5) {
          if (b.miss) x -= G.bump(G.seg(d, -0.12, 0.3)) * 22;
          else if (d > 0) x -= G.bump(d / 0.5) * (b.big ? 30 : 16);
        }
      }
    });
    if (pl.fail && t > pl.fleeT) x -= (t - pl.fleeT) * 270 + i * 10;
    void p;
    return x;
  }
  function drawParty(reel, pl, t, L) {
    const walkK = G.clamp(t / 1.1, 0, 1);
    reel.party.forEach((p, i) => {
      const x = partyX(reel, pl, t, L, i);
      let y = L.gy;
      let state = walkK < 1 ? 'walk' : 'stand';
      let facing = 1, swing = 0, armed = true, expr = null;
      const phase = t * 9 + i;
      pl.beats.forEach((b) => {
        if (b.kind === 'skill' && b.who === i && t > b.t - 0.5 && t < b.w0) { state = 'stand'; expr = 'happy'; }
        if (b.kind === 'hit' && b.w0 == null && b.who === i) {
          const d = t - b.t;
          if (d > 0 && d < 0.5) {
            if (b.melee) { state = 'lunge'; swing = G.seg(d, 0.08, 0.22); }
            else if (p.cls === 'archer') { state = 'swing'; swing = G.seg(d, 0, 0.2); }
            else state = 'cast';
          }
        }
        if (b.kind === 'heal' && b.who === i && t > b.t && t < b.t + 0.45) state = 'cast';
        if (b.kind === 'mon' && b.target === i && !b.miss) {
          const d = t - b.at;
          if (d > 0 && d < 0.5) { state = 'hurt'; expr = 'hurt'; }
        }
        if (b.kind === 'mon' && b.target === i && b.miss) {
          const d = t - b.at;
          if (d > -0.12 && d < 0.25) y -= G.bump(G.seg(d, -0.12, 0.25)) * 14;
        }
      });
      if (pl.fail && t > pl.fleeT) { state = 'run'; facing = -1; armed = false; expr = 'hurt'; }
      else if (pl.fail && t > pl.finishT && t <= pl.fleeT) { state = 'hurt'; expr = 'hurt'; }
      else if (!pl.fail && t > pl.finishT + 0.2) { state = t > pl.resT ? 'cheer' : 'stand'; expr = 'happy'; }
      // 技：溜めの光・残像・技ごとのポーズ
      const sb = !(pl.fail && t > pl.fleeT) ? skillBeatOf(pl, i, t) : null;
      const sfx2 = sb ? beatFx(sb, p) : null;
      const mo = sb ? skillMotion(sb, sfx2, t, L.px[i], L, MO) : null;
      if (mo) {
        if (state !== 'hurt') { state = mo.state; swing = mo.swing; facing = mo.facing; if (mo.expr) expr = mo.expr; }
        y += mo.y;
        if (mo.glow > 0) drawSkillAura(L.px[i] + (mo.x - L.px[i]) * 0.2, L.gy, mo.glow, sfx2, t);
        if (mo.ghost > 0) drawGhosts(p, sb, sfx2, t, L, i, mo.ghost);
      }
      ctx.save();
      ctx.translate(x, y);
      if (mo) {
        if (mo.rot) { ctx.translate(0, -36); ctx.rotate(mo.rot * facing); ctx.translate(0, 36); }
        ctx.globalAlpha = mo.alpha;
        ctx.scale(2.35 * mo.sx, 2.35 * mo.sy);
      } else ctx.scale(2.35, 2.35);
      art.person(ctx, p.look, { t: t + i, state, phase, facing, swing, armed, expr, blink: Math.sin(t * 3 + i * 2) > 0.97 });
      ctx.restore();
      if (mo) y -= mo.y;
      // 驚きマーク
      if (t > pl.encT + 0.1 && t < pl.encT + 0.75) drawMark(x, y - 104, '!', G.ease.outBack(G.seg(t, pl.encT + 0.1, pl.encT + 0.25)));
      // 閃きの電球
      pl.beats.forEach((b) => {
        if (b.kind === 'skill' && b.who === i && t > b.t - 0.5 && t < b.t + 0.05) {
          const kk = G.ease.outBack(G.seg(t, b.t - 0.5, b.t - 0.35));
          art.bulb(ctx, x + 4, y - 118 - kk * 6, 9 * kk, 1, t);
        }
      });
      if (pl.fail && t > pl.fleeT && t < pl.fleeT + 1.2) art.poly(ctx, [x + 14, y - 92, x + 18, y - 84, x + 14, y - 82, x + 11, y - 86], '#9fd8ff');
      // レベルアップ
      const lu = reel.levelUps.find((l) => l.id === p.id);
      if (lu && t > pl.lvT) {
        const a = G.seg(t, pl.lvT, pl.lvT + 0.25);
        const yy = y - 124 - G.ease.outCubic(G.seg(t, pl.lvT, pl.lvT + 0.6)) * 18;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.font = F(900, 15, 'num');
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0f2440';
        ctx.strokeText('LEVEL UP', x, yy);
        ctx.fillStyle = '#9fe8ff';
        ctx.fillText('LEVEL UP', x, yy);
        ctx.font = F(800, 11, 'num');
        ctx.strokeText(`Lv ${lu.to}`, x, yy + 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Lv ${lu.to}`, x, yy + 14);
        ctx.restore();
      }
    });
  }

  // ---------------------------------------------------------------- 攻撃の演出
  function drawAttackFx(reel, pl, t, L) {
    const my = L.gy - L.mh * 0.5;
    pl.beats.forEach((b) => {
      const p = reel.party[b.who];
      if (b.kind === 'hit' && b.w0 != null) {
        // セットした技：技ごとのエフェクト
        drawSkillFx(reel, pl, b, t, L, b.crit ? 1.1 : 1);
      } else if (b.kind === 'hit') {
        const px = partyX(reel, pl, b.t, L, b.who);
        if (b.melee) {
          slash(L.mx - 4, my, t - b.at, b.ang, b.crit ? 1.35 : 1, b.crit);
          if (p && p.cls === 'thief') slash(L.mx + 4, my - 6, t - b.at - 0.05, b.ang + 1.4, 0.8, false);
        } else if (p && p.cls === 'archer') arrow(px + 18, L.gy - 58, L.mx - 10, my, t - b.t, b.at - b.t, b.crit);
        else if (p && p.cls === 'bard') notes(px + 20, L.gy - 58, L.mx - 10, my, t - b.t, b.at - b.t, b.crit);
        else if (p && p.cls === 'alchemist') flaskThrow(px + 18, L.gy - 60, L.mx - 10, my, t - b.t, b.at - b.t, b.crit);
        else orb(px + 20, L.gy - 62, L.mx - 10, my, t - b.t, b.at - b.t, p && p.cls === 'cleric' ? '#fff0a0' : '#8fd0ff', b.crit);
        burst(L.mx - 6, my, t - b.at, b.crit ? 1.25 : 0.7, b.crit ? '#fff6c0' : '#ffffff');
      } else if (b.kind === 'skill') {
        // 閃き：同じ技のエフェクトを大きく
        const d = t - b.at;
        drawSkillFx(reel, pl, b, t, L, 1.45);
        burst(L.mx, my, d, 2.1, '#fff6c0');
        ring(L.mx, my, d, 120, '#ffe9a0');
        ring(L.mx, my, d - 0.08, 160, beatFx(b, p).col);
      } else if (b.kind === 'mon') {
        const px = L.px[b.target] != null ? partyX(reel, pl, b.at, L, b.target) : L.px[0];
        if (!b.miss) {
          claw(px + 4, L.gy - 46, t - b.at, b.big ? 1.6 : 1);
          burst(px, L.gy - 46, t - b.at, b.big ? 1.3 : 0.6, '#ffd0c0');
          if (b.big) ring(px, L.gy - 40, t - b.at, 90, '#ff8060');
        } else {
          // 残像
          const d = t - b.at;
          if (d > -0.1 && d < 0.2) {
            ctx.save();
            ctx.globalAlpha = 0.35 * (1 - G.seg(d, -0.1, 0.2));
            ctx.translate(px + 10, L.gy);
            ctx.scale(2.35, 2.35);
            art.person(ctx, reel.party[b.target].look, { t, state: 'stand', facing: 1, noShadow: true });
            ctx.restore();
          }
        }
      } else if (b.kind === 'heal') {
        const px = L.px[b.target] != null ? partyX(reel, pl, b.at, L, b.target) : L.px[0];
        const d = t - b.at;
        if (d > -0.05 && d < 0.6) {
          const kk = G.seg(d, -0.05, 0.6);
          ctx.save();
          ctx.globalAlpha = 1 - kk;
          ctx.strokeStyle = '#9ff0b8';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(px, L.gy - 2, 18 + kk * 26, (18 + kk * 26) * 0.32, 0, 0, TAU); ctx.stroke();
          const g = ctx.createLinearGradient(0, L.gy - 110, 0, L.gy);
          g.addColorStop(0, 'rgba(160,255,200,0)');
          g.addColorStop(1, 'rgba(160,255,200,0.4)');
          ctx.fillStyle = g;
          ctx.fillRect(px - 22, L.gy - 110, 44, 110);
          ctx.restore();
        }
      }
    });
    // とどめ：白い閃光と衝撃波
    if (!pl.fail) {
      const d = t - pl.finishT;
      ring(L.mx, my, d, 170, '#ffffff');
      ring(L.mx, my, d - 0.08, 120, '#ffd36a');
    }
  }

  function slash(x, y, d, ang, sc, crit) {
    const dur = crit ? 0.22 : 0.16;
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(sc, sc);
    const r = 34;
    const a0 = -1.25 + kk * 0.3, a1 = a0 + 2.5 * G.ease.outCubic(Math.min(1, kk * 1.8));
    ctx.globalAlpha = 1 - G.seg(kk, 0.55, 1);
    // 外側の光
    ctx.strokeStyle = crit ? 'rgba(255,214,120,0.55)' : 'rgba(170,220,255,0.45)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
    // 三日月の刃
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, a0, a1);
    ctx.arc(-3, 2, r - 4, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
  function burst(x, y, d, sc, col) {
    const dur = 0.22;
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 1 - kk;
    const n = 10;
    const r1 = 10 * sc * (0.4 + kk), r2 = 34 * sc * (0.5 + kk * 0.8);
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU + 0.2;
      const r = i % 2 ? r1 : r2 * (0.7 + ((i * 37) % 10) / 30);
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }
  function ring(x, y, d, size, col) {
    const dur = 0.45;
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    ctx.save();
    ctx.globalAlpha = (1 - kk) * 0.9;
    ctx.strokeStyle = col;
    ctx.lineWidth = 6 * (1 - kk) + 1;
    ctx.beginPath(); ctx.ellipse(x, y, size * G.ease.outCubic(kk), size * G.ease.outCubic(kk) * 0.55, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function claw(x, y, d, sc) {
    const dur = 0.25;
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.5);
    ctx.globalAlpha = 1 - G.seg(kk, 0.5, 1);
    for (let i = -1; i <= 1; i++) {
      const len = 30 * sc * G.ease.outCubic(Math.min(1, kk * 2.5));
      ctx.beginPath();
      ctx.moveTo(i * 8 * sc, -len / 2);
      ctx.quadraticCurveTo(i * 8 * sc + 4, 0, i * 8 * sc, len / 2);
      ctx.lineTo(i * 8 * sc + 2.5, 0);
      ctx.closePath();
      ctx.fillStyle = '#ffe8e0';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,60,40,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
  function arrow(x0, y0, x1, y1, d, dur, crit, sc = 1) {
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    const x = G.lerp(x0, x1, kk), y = G.lerp(y0, y1, kk) - Math.sin(kk * Math.PI) * 10;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    // 尾
    const g = ctx.createLinearGradient(x - 60 * sc, y, x, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, crit ? 'rgba(255,230,150,0.8)' : 'rgba(220,240,255,0.6)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3 * sc;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 60 * sc, y - Math.sin(ang) * 60 * sc); ctx.lineTo(x, y); ctx.stroke();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
    art.poly(ctx, [-16, -1.2, 8, -1.2, 8, 1.2, -16, 1.2], '#8a5a30');
    art.poly(ctx, [8, -3.5, 16, 0, 8, 3.5], '#e8ecf4');
    art.poly(ctx, [-16, -1, -20, -4, -13, -1], '#e8e0c8');
    art.poly(ctx, [-16, 1, -20, 4, -13, 1], '#d8d0b8');
    ctx.restore();
  }
  function orb(x0, y0, x1, y1, d, dur, col, crit) {
    if (d < 0 || d > dur) return;
    const kk = G.ease.inCubic(d / dur);
    const x = G.lerp(x0, x1, kk), y = G.lerp(y0, y1, kk) - Math.sin(kk * Math.PI) * 22;
    ctx.save();
    for (let i = 4; i >= 0; i--) {
      const k2 = Math.max(0, kk - i * 0.06);
      const tx = G.lerp(x0, x1, k2), ty = G.lerp(y0, y1, k2) - Math.sin(k2 * Math.PI) * 22;
      ctx.fillStyle = G.rgba(col, 0.12 * (5 - i));
      ctx.beginPath(); ctx.arc(tx, ty, (crit ? 12 : 9) * (1 - i * 0.12), 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, crit ? 20 : 15);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, col);
    g.addColorStop(1, G.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, crit ? 20 : 15, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 吟遊詩人：音符が踊りながら飛ぶ
  function notes(x0, y0, x1, y1, d, dur, crit) {
    if (d < 0 || d > dur) return;
    const kk = G.ease.inOut(d / dur);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const k2 = Math.max(0, kk - i * 0.12);
      const x = G.lerp(x0, x1, k2), y = G.lerp(y0, y1, k2) - Math.sin(k2 * Math.PI) * 30 + Math.sin(k2 * 18 + i * 2) * 6;
      const sc = (crit ? 1.25 : 1) * (1 - i * 0.18);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(k2 * 10 + i) * 0.4);
      ctx.scale(sc, sc);
      ctx.fillStyle = i ? 'rgba(255,170,220,0.7)' : '#ffd0ee';
      ctx.beginPath(); ctx.ellipse(-3, 6, 5, 3.6, -0.4, 0, TAU); ctx.fill();
      ctx.fillRect(1, -10, 2, 16);
      ctx.beginPath(); ctx.moveTo(3, -10); ctx.quadraticCurveTo(12, -6, 8, 2); ctx.lineTo(7, 0); ctx.quadraticCurveTo(9, -5, 3, -6); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  // 錬金術師：フラスコが回りながら弧を描いて飛ぶ
  function flaskThrow(x0, y0, x1, y1, d, dur, crit) {
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    const x = G.lerp(x0, x1, kk), y = G.lerp(y0, y1, kk) - Math.sin(kk * Math.PI) * 60;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(kk * 9);
    const s2 = crit ? 1.3 : 1;
    ctx.scale(s2, s2);
    art.poly(ctx, [-5, -2, 5, -2, 7, 8, -7, 8], '#7fe0a0');
    art.poly(ctx, [-5, -2, 0, -2, 0, 8, -7, 8], '#b8ffd0');
    art.poly(ctx, [-2, -8, 2, -8, 2, -2, -2, -2], '#e8f4f0');
    art.poly(ctx, [-3, -10, 3, -10, 3, -8, -3, -8], '#8a5a32');
    ctx.restore();
    ctx.fillStyle = 'rgba(127,224,160,0.35)';
    ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
  }
  function pillar(x, gy, d, c1, c2) {
    if (d < -0.12 || d > 0.6) return;
    const a = d < 0 ? G.seg(d, -0.12, 0) : 1 - G.seg(d, 0.2, 0.6);
    const w = 30 + G.bump(G.seg(d, -0.12, 0.3)) * 26;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, G.rgba(c2, 0));
    g.addColorStop(0.3, G.rgba(c1, 0.8));
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.7, G.rgba(c1, 0.8));
    g.addColorStop(1, G.rgba(c2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - w, -200, w * 2, gy + 200);
    ctx.restore();
  }
  function drawMagicCircles(reel, pl, t, L) {
    pl.beats.forEach((b) => {
      if (b.kind !== 'skill') return;
      const p = reel.party[b.who];
      if (!p || (p.cls !== 'mage' && p.cls !== 'cleric') || SKILL_FX[b.skill]) return;
      const a0 = b.t + 0.85, a1 = b.at + 0.45;
      if (t < a0 || t > a1) return;
      const a = G.seg(t, a0, a0 + 0.12) * (1 - G.seg(t, a1 - 0.15, a1));
      const col = p.cls === 'cleric' ? '#ffd36a' : '#9fc8ff';
      ctx.save();
      ctx.translate(L.mx, L.gy);
      ctx.scale(1, 0.32);
      ctx.rotate(t * 2);
      ctx.globalAlpha = a;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      const r = 70;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const an = (i / 6) * TAU * 2;
        const xx = Math.cos(an) * r * 0.78, yy = Math.sin(an) * r * 0.78;
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU;
        art.poly(ctx, [Math.cos(an) * r * 0.86, Math.sin(an) * r * 0.86, Math.cos(an + 0.08) * r * 0.94, Math.sin(an + 0.08) * r * 0.94, Math.cos(an + 0.16) * r * 0.86, Math.sin(an + 0.16) * r * 0.86], col);
      }
      ctx.restore();
    });
  }

  // ================================================================ 技の演出（部品）
  // どれも ctx の状態（globalAlpha など）を気にせず変える。呼び出し側で save/restore する
  const CLEAR = new Map();
  function clearOf(col) {
    let v = CLEAR.get(col);
    if (!v) { v = G.rgba(col, 0); CLEAR.set(col, v); }
    return v;
  }
  function fxA(a) { ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a; }
  function fxCircle(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0) return;
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function fxGlow(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, col);
    g.addColorStop(1, clearOf(col));
    fxA(a); ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function fxLine(x0, y0, x1, y1, w, col, a) {
    if (a <= 0.004 || w <= 0) return;
    fxA(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function fxBeam(x0, y0, x1, y1, w, col, a) {
    fxLine(x0, y0, x1, y1, w * 2.4, col, a * 0.3);
    fxLine(x0, y0, x1, y1, w, col, a * 0.85);
    fxLine(x0, y0, x1, y1, w * 0.38, '#ffffff', a);
  }
  // 尾を引く光（先が太く丸い）
  function fxStreak(x0, y0, x1, y1, w, col, a) {
    if (a <= 0.004) return;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w, ny = (dx / l) * w;
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + nx, y1 + ny);
    ctx.quadraticCurveTo(x1 + (dx / l) * w * 2.2, y1 + (dy / l) * w * 2.2, x1 - nx, y1 - ny);
    ctx.closePath(); ctx.fill();
  }
  // 細長い光の刃（斬撃の線）
  function fxBlade(x, y, ang, len, w, col, a) {
    if (a <= 0.004 || len <= 0.5) return;
    const c = Math.cos(ang), s = Math.sin(ang), hx = (c * len) / 2, hy = (s * len) / 2, nx = -s * w, ny = c * w;
    fxA(a * 0.5); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - hx, y - hy); ctx.lineTo(x + nx * 2.4, y + ny * 2.4); ctx.lineTo(x + hx, y + hy); ctx.lineTo(x - nx * 2.4, y - ny * 2.4); ctx.closePath(); ctx.fill();
    fxA(a); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x - hx, y - hy); ctx.lineTo(x + nx, y + ny); ctx.lineTo(x + hx, y + hy); ctx.lineTo(x - nx, y - ny); ctx.closePath(); ctx.fill();
  }
  // 稲妻（seed ごとに形が決まる）
  function fxBolt(x0, y0, x1, y1, seed, n, amp, w, col, a, core = '#ffffff') {
    if (a <= 0.004) return;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      fxA(pass ? a : a * 0.55);
      ctx.strokeStyle = pass ? core : col;
      ctx.lineWidth = pass ? w : w * 3.2;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      for (let i = 1; i < n; i++) {
        const k2 = i / n, o = (G.hash(seed * 31 + i) - 0.5) * 2 * amp;
        ctx.lineTo(x0 + dx * k2 + nx * o, y0 + dy * k2 + ny * o);
      }
      ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  function fxStar(x, y, r, rot, col, a, pts = 5, inner = 0.45) {
    if (a <= 0.004 || r <= 0.3) return;
    fxA(a); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const an = rot + (i / (pts * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r;
      if (i) ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); else ctx.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  // きらめき（細い十字の光）
  function fxTwinkle(x, y, r, col, a) {
    fxStar(x, y, r, 0, col, a, 4, 0.14);
    fxCircle(x, y, r * 0.2, '#ffffff', a);
  }
  function fxRing(x, y, r, w, col, a, flat = 0.55) {
    if (a <= 0.004 || r <= 0 || w <= 0) return;
    fxA(a); ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * flat, 0, 0, TAU); ctx.stroke();
  }
  function fxRingV(x, y, rx, ry, w, col, a) {
    if (a <= 0.004 || rx <= 0 || ry <= 0) return;
    fxA(a); ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
  }
  // 地面に広がる衝撃波
  function fxShock(x, y, d, dur, r, col, w = 5) {
    if (d < 0 || d > dur) return;
    const k2 = d / dur;
    fxRing(x, y, r * G.ease.outCubic(k2), w * (1 - k2) + 1, col, 1 - k2, 0.24);
  }
  // 魔法陣（n=3 錬成陣・5 五芒星・6 六芒星）
  function fxSigil(x, y, r, rot, col, a, flat, n) {
    if (a <= 0.004 || r <= 0) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, flat); ctx.rotate(rot);
    fxA(a); ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke();
    const rr = r * 0.8;
    ctx.beginPath();
    if (n === 6) {
      for (let s2 = 0; s2 < 2; s2++) for (let i = 0; i <= 3; i++) { const an = (i / 3) * TAU + s2 * (Math.PI / 3) - Math.PI / 2; if (i) ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    } else if (n === 3) {
      for (let i = 0; i <= 3; i++) { const an = (i / 3) * TAU - Math.PI / 2; if (i) ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      ctx.moveTo(rr * 0.5, 0); ctx.arc(0, 0, rr * 0.5, 0, TAU);
    } else {
      for (let i = 0; i <= 5; i++) { const an = ((i * 2) / 5) * TAU - Math.PI / 2; if (i) ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    }
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * r * 0.86, Math.sin(an) * r * 0.86);
      ctx.lineTo(Math.cos(an + 0.08) * r * 0.95, Math.sin(an + 0.08) * r * 0.95);
      ctx.lineTo(Math.cos(an + 0.16) * r * 0.86, Math.sin(an + 0.16) * r * 0.86);
      ctx.fill();
    }
    ctx.restore();
  }
  // 炎の舌（根元が原点、ang=0 で上へ）
  function fxFlame(x, y, w, h, t, seed, c1, c2, a, ang = 0) {
    if (a <= 0.004 || h <= 0.5) return;
    ctx.save();
    ctx.translate(x, y);
    if (ang) ctx.rotate(ang);
    const sw = Math.sin(t * 19 + seed * 1.7) * w * 0.4;
    for (let l2 = 0; l2 < 3; l2++) {
      const s = l2 === 0 ? 1 : l2 === 1 ? 0.62 : 0.3;
      fxA(a * (l2 === 0 ? 0.85 : 1));
      ctx.fillStyle = l2 === 0 ? c1 : l2 === 1 ? c2 : '#ffffff';
      ctx.beginPath(); ctx.moveTo(-w * s, 0);
      ctx.quadraticCurveTo(-w * s * 1.15, -h * s * 0.55, sw * s, -h * s);
      ctx.quadraticCurveTo(w * s * 1.15, -h * s * 0.55, w * s, 0);
      ctx.quadraticCurveTo(0, h * 0.14 * s, -w * s, 0);
      ctx.fill();
    }
    ctx.restore();
  }
  // 地面から突き出る氷・岩の牙
  function fxSpike(x, gy, h, w, lean, c1, c2, a) {
    if (a <= 0.004 || h <= 0.5) return;
    fxA(a);
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.lineTo(x + lean, gy - h); ctx.lineTo(x + w, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.lineTo(x + lean, gy - h); ctx.lineTo(x + lean * 0.3 - w * 0.15, gy); ctx.closePath(); ctx.fill();
  }
  // 三日月（凸が rot の向き）
  function fxCrescent(x, y, r, rot, col, a, thick = 0.42) {
    if (a <= 0.004 || r <= 0.3) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.35, 1.35); ctx.arc(-r * thick, 0, r * 0.96, 1.25, -1.25, true); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function fxPetal(x, y, s, rot, col, a, long = 1) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, -s * long); ctx.quadraticCurveTo(s * 0.95, -s * 0.15, 0, s * long); ctx.quadraticCurveTo(-s * 0.95, -s * 0.15, 0, -s * long); ctx.fill();
    ctx.restore();
  }
  function fxNote(x, y, s, rot, col, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(-3, 6, 5, 3.6, -0.4, 0, TAU); ctx.fill();
    ctx.fillRect(1, -10, 2, 16);
    ctx.beginPath(); ctx.moveTo(3, -10); ctx.quadraticCurveTo(12, -6, 8, 2); ctx.lineTo(7, 0); ctx.quadraticCurveTo(9, -5, 3, -6); ctx.fill();
    ctx.restore();
  }
  // もこもこの霧・煙
  function fxPuff(x, y, r, col, a) {
    if (a <= 0.004 || r <= 0.5) return;
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x - r * 0.5, y, r * 0.66, 0, TAU);
    ctx.moveTo(x + r * 1.05, y + r * 0.1); ctx.arc(x + r * 0.45, y + r * 0.1, r * 0.6, 0, TAU);
    ctx.moveTo(x + r * 0.75, y - r * 0.35); ctx.arc(x, y - r * 0.35, r * 0.75, 0, TAU);
    ctx.fill();
  }
  // 風の渦
  function fxSwirl(x, y, r, rot, col, a, w) {
    if (a <= 0.004 || r <= 0) return;
    fxA(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.45 + i * 0.28), a0 = rot + i * 2.1;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.5, 0, a0, a0 + 2.3); ctx.stroke();
    }
  }
  // 画面全体の色（カメラの中から描くので広めに塗る）
  function fxTint(col, a) {
    if (a <= 0.004) return;
    fxA(a); ctx.fillStyle = col;
    ctx.fillRect(-420, -520, 1200, Hd + 1040);
  }
  // 色つきの三日月斬り
  function fxSlash(x, y, d, ang, sc, col, dur = 0.2) {
    if (d < 0 || d > dur) return;
    const kk = d / dur;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
    const r = 34;
    const a0 = -1.25 + kk * 0.3, a1 = a0 + 2.5 * G.ease.outCubic(Math.min(1, kk * 1.8));
    const al = 1 - G.seg(kk, 0.55, 1);
    fxA(al * 0.65); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
    fxA(al); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r + 2, a0, a1); ctx.arc(-3, 2, r - 4, a1, a0, true); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 地割れ（光る割れ目）
  function fxCrack(x0, x1, gy, seed, col, a) {
    if (a <= 0.004 || Math.abs(x1 - x0) < 1) return;
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / 9));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      fxA(a); ctx.strokeStyle = pass ? col : '#2a1608'; ctx.lineWidth = pass ? 1.6 : 4.5;
      ctx.beginPath(); ctx.moveTo(x0, gy);
      for (let i = 1; i <= n; i++) ctx.lineTo(G.lerp(x0, x1, i / n), gy + (G.hash(seed * 17 + i) - 0.5) * 7);
      ctx.stroke();
    }
  }
  // 光の円錐（スポットライト・陽の光）
  function fxCone(x0, y0, x1, y1, w0, w1, col, a) {
    if (a <= 0.004) return;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, clearOf(col));
    g.addColorStop(1, col);
    fxA(a); ctx.fillStyle = g;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * w0, y0 + ny * w0); ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1); ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
    ctx.closePath(); ctx.fill();
  }
  function fxShield(x, y, s, c1, c2, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    const path = (k2) => { ctx.beginPath(); ctx.moveTo(-14 * k2, -18 * k2); ctx.lineTo(14 * k2, -18 * k2); ctx.lineTo(17 * k2, -3 * k2); ctx.lineTo(0, 23 * k2); ctx.lineTo(-17 * k2, -3 * k2); ctx.closePath(); };
    fxA(a * 0.32); ctx.fillStyle = c2; path(1.4); ctx.fill();
    fxA(a * 0.8); ctx.fillStyle = c1; path(1); ctx.fill();
    fxA(a); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = c2;
    ctx.fillRect(-1.6, -13, 3.2, 24); ctx.fillRect(-8, -6, 16, 3.2);
    ctx.restore();
  }
  function fxLantern(x, y, s, col, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    fxA(a);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(6.5, 0); ctx.lineTo(5, 7); ctx.lineTo(-5, 7); ctx.lineTo(-6.5, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fffbe6'; ctx.fillRect(-2.4, -5, 4.8, 9);
    ctx.fillStyle = '#6a3e1e';
    ctx.beginPath(); ctx.moveTo(-5.5, -8); ctx.lineTo(5.5, -8); ctx.lineTo(3, -11.5); ctx.lineTo(-3, -11.5); ctx.closePath(); ctx.fill();
    ctx.fillRect(-5.5, 7, 11, 2.2);
    ctx.fillRect(-0.7, -15, 1.4, 4);
    ctx.restore();
  }
  function fxKunai(x, y, ang, s, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    fxA(a);
    ctx.fillStyle = '#dfe3ee'; ctx.beginPath(); ctx.moveTo(0, -2.4); ctx.lineTo(15, 0); ctx.lineTo(0, 2.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a90a8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.lineTo(0, 2.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2436'; ctx.fillRect(-8, -1.3, 8, 2.6);
    ctx.strokeStyle = '#b89aff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-10.2, 0, 2.2, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // 燕（右向き）
  function fxSwallow(x, y, s, flap, rot, col, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -0.6, 2.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(-7, -9 - flap * 5); ctx.lineTo(-15, -11 - flap * 6); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(-6, 7 + flap * 3); ctx.lineTo(-13, 8 + flap * 4); ctx.lineTo(-3, 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-17, -4.5); ctx.lineTo(-12, 0); ctx.lineTo(-17, 4.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(1, 1.2, 4, 1.1, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function fxBell(x, y, s, sw, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(sw); ctx.scale(s, s);
    fxA(a);
    ctx.fillStyle = '#e8b040';
    ctx.beginPath(); ctx.moveTo(-4, -14); ctx.quadraticCurveTo(-12, -12, -11, 2); ctx.lineTo(-16, 10); ctx.lineTo(16, 10); ctx.lineTo(11, 2); ctx.quadraticCurveTo(12, -12, 4, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe8a0';
    ctx.beginPath(); ctx.moveTo(-4, -14); ctx.quadraticCurveTo(-12, -12, -11, 2); ctx.lineTo(-16, 10); ctx.lineTo(-3, 10); ctx.lineTo(-1, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8801e'; ctx.fillRect(-16, 9, 32, 3);
    ctx.fillStyle = '#ffe8a0'; ctx.beginPath(); ctx.arc(0, -16, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a5a14'; ctx.beginPath(); ctx.arc(-sw * 14, 13, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 翼（羽根3枚）
  function fxWing(x, y, side, s, col, a, spread) {
    if (a <= 0.004) return;
    for (let j = 0; j < 4; j++) {
      const an = side * (0.5 + j * 0.32 * spread) - Math.PI / 2 + (side < 0 ? Math.PI : 0) * 0;
      const len = (26 - j * 4) * s;
      const cx = x + side * Math.cos(-0.35 + j * 0.3 * spread) * len * 0.55;
      const cy = y - Math.sin(-0.35 + j * 0.3 * spread) * len * 0.55;
      fxPetal(cx, cy, len * 0.5, side * (Math.PI / 2 + 0.35 - j * 0.3 * spread), col, a * (1 - j * 0.12), 1.0);
      void an;
    }
  }
  // 大きな光の剣（切っ先が原点・上に伸びる）
  function fxBigSword(x, y, s, rot, c1, c2, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    fxA(a * 0.3); ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(-15, -172); ctx.lineTo(15, -172); ctx.lineTo(11, -12); ctx.lineTo(0, 10); ctx.lineTo(-11, -12); ctx.closePath(); ctx.fill();
    fxA(a); ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-6.5, -168); ctx.lineTo(6.5, -168); ctx.lineTo(5.5, -16); ctx.lineTo(0, 0); ctx.lineTo(-5.5, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(0, -168); ctx.lineTo(6.5, -168); ctx.lineTo(5.5, -16); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(-24, -174); ctx.lineTo(24, -174); ctx.lineTo(19, -166); ctx.lineTo(-19, -166); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6a5a'; ctx.beginPath(); ctx.arc(0, -170, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a3e1e'; ctx.fillRect(-3, -198, 6, 24);
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, -202, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function fxFlask(x, y, rot, s, body, a) {
    if (a <= 0.004) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    fxA(a);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-2.4, -3); ctx.lineTo(2.4, -3); ctx.lineTo(7.5, 7); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.lineTo(-7.5, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-2.4, -3); ctx.lineTo(0, -3); ctx.lineTo(-3, 9); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f4f0'; ctx.fillRect(-2.2, -9, 4.4, 6);
    ctx.fillStyle = '#8a5a32'; ctx.fillRect(-3, -11, 6, 2.6);
    ctx.restore();
  }
  function fxDrop(x, y, s, col, a) {
    if (a <= 0.004) return;
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - 6 * s);
    ctx.bezierCurveTo(x + 4 * s, y, x + 3.4 * s, y + 4 * s, x, y + 4 * s);
    ctx.bezierCurveTo(x - 3.4 * s, y + 4 * s, x - 4 * s, y, x, y - 6 * s);
    ctx.fill();
  }
  function fxArrowUp(x, y, s, col, a) {
    if (a <= 0.004) return;
    fxA(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x + 7 * s, y); ctx.lineTo(x + 3 * s, y); ctx.lineTo(x + 3 * s, y + 7 * s);
    ctx.lineTo(x - 3 * s, y + 7 * s); ctx.lineTo(x - 3 * s, y); ctx.lineTo(x - 7 * s, y); ctx.closePath(); ctx.fill();
  }
  function fxText(text, x, y, size, col, a, kind = 'num') {
    if (a <= 0.004) return;
    fxA(a);
    ctx.font = F(900, size, kind);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.28; ctx.strokeStyle = 'rgba(10,14,34,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }

  // ---- 技のパーティクル
  function fxP(type, x, y, col, sp, size, life, g, up) {
    const a = G.rand(0, TAU), v = G.rand(sp * 0.35, sp);
    return { type, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), g, life: 0, max: G.rand(life * 0.6, life), col, size: G.rand(size * 0.6, size), rot: G.rand(0, TAU), vr: G.rand(-7, 7) };
  }
  // 舞い落ちる花びら・葉・羽根
  function petalBurst(n, x, y, cols, sp, size, long) {
    for (let j = 0; j < n; j++) {
      const p = fxP('petal', x + G.rand(-10, 10), y + G.rand(-10, 10), cols[j % cols.length], sp, size, 1.6, 70, 50);
      p.long = long || 1;
      p.drift = G.rand(0, TAU);
      addPart(p);
    }
  }
  function emberBurst(n, x, y, col, sp) {
    for (let j = 0; j < n; j++) addPart(fxP('spark', x + G.rand(-14, 14), y + G.rand(-10, 10), col, sp || 120, 3.6, 0.9, -90, 40));
  }
  function healParty(L, reel) {
    reel.party.forEach((_, i) => {
      const px = L.px[i];
      for (let j = 0; j < 5; j++) addPart({ type: 'plus', x: px + G.rand(-16, 16), y: L.gy - G.rand(10, 70), vx: 0, vy: G.rand(-50, -20), life: 0, max: G.rand(0.7, 1.1), size: G.rand(3, 5) });
    });
  }

  // ================================================================ 技ごとの動きとエフェクト
  // motion: 使い手の動き / lead: 動き出し→命中の秒数 / ono: 擬音 / go・hitS・extra: 音
  // draw(X): エフェクト（X.d=命中からの秒・X.u=動き出しからの秒・X.w=溜めからの秒・X.K=大きさ）
  // parts(X): 命中の瞬間のパーティクル / multi: 追い打ちの小さな命中（命中からの秒）
  const USE_WIND = 0.2;
  const SKILL_FX = {
    // ---------------- 戦士
    烈風斬: {
      col: '#9ff0d0', col2: '#e8fff6', motion: 'slashRange', lead: 0.22, ono: 'ヒュオォッ!!', go: 'whoosh',
      draw(X) {
        const s = X.K, d = X.d;
        for (let j = 0; j < 3; j++) {
          const k2 = (X.u - j * 0.04) / X.lead;
          if (k2 < 0 || k2 > 1.1) continue;
          const kk = Math.min(1, k2), f = 1 - G.seg(k2, 0.95, 1.1);
          const x = G.lerp(X.sx + 6, X.mx - 6, kk), y = G.lerp(X.sy - 4, X.my, kk) + (j - 1) * 14 * s;
          fxStreak(x - 64 * s, y, x - 6, y, 5 * s, X.col, 0.45 * f);
          fxCrescent(x, y, 18 * s * (1 + j * 0.14), 0, X.col, 0.8 * f, 0.5);
          fxCrescent(x + 1.5, y, 14 * s * (1 + j * 0.14), 0, '#ffffff', 0.95 * f, 0.5);
        }
        if (d >= 0 && d < 0.55) {
          const k2 = d / 0.55;
          fxSwirl(X.mx, X.my, 58 * s * (0.5 + G.ease.outCubic(k2)), d * 14, X.col, 0.85 * (1 - k2), 3.2 * s);
          fxSwirl(X.mx, X.my, 36 * s * (0.5 + G.ease.outCubic(k2)), -d * 18 + 1, X.col2, 0.7 * (1 - k2), 2 * s);
          fxSlash(X.mx - 6, X.my - 10, d, -0.5, 1.2 * s, X.col, 0.2);
          fxSlash(X.mx + 4, X.my + 8, d - 0.05, 0.4, 1.1 * s, X.col, 0.2);
          fxSlash(X.mx, X.my, d - 0.1, 1.3, 1 * s, X.col, 0.2);
        }
      },
      parts(X) { petalBurst(12, X.mx, X.my, ['#7fe0a0', '#c8ffe0', '#4ac080'], 200, 5, 1.2); },
      multi: [0.05, 0.1],
    },
    '剛断・灯火割り': {
      col: '#ffb050', col2: '#ff5a1e', motion: 'leap', lead: 0.3, ono: '断ッ!!', go: 'whoosh', heavy: true, shake: 1.3,
      draw(X) {
        const s = X.K, d = X.d;
        // 落ちながら炎の弧
        if (X.u > X.lead * 0.5 && d < 0.06) {
          const k2 = G.seg(X.u, X.lead * 0.5, X.lead);
          fxSlash(X.hx + 16, X.gy + X.hy - 52, k2 * 0.16, -0.9, 1.5 * s, X.col2, 0.2);
        }
        if (d > -0.03 && d < 0.6) {
          const k2 = G.seg(d, -0.03, 0.1), f = 1 - G.seg(d, 0.2, 0.6);
          const y0 = X.top - 80 * s, y1 = X.gy + 8;
          const yy = G.lerp(y0, y1, G.ease.outCubic(k2));
          fxBlade(X.mx - 4, (y0 + yy) / 2, Math.PI / 2, yy - y0, 7 * s * (0.5 + 0.5 * f), X.col, f);
          fxCrack(X.mx - 70 * s, X.mx + 60 * s, X.gy + 3, 5, X.col, f);
          for (let j = 0; j < 5; j++) {
            const h = (40 + G.hash(j * 7 + 1) * 44) * s * G.bump(G.seg(d, 0.02 + j * 0.025, 0.58));
            fxFlame(X.mx - 4 + (j - 2) * 15 * s, X.gy + 3, 10 * s, h, X.t, j, X.col2, X.col, 0.95);
          }
          if (!X.rm) fxTint('#ff6a1e', 0.12 * f);
        }
      },
      parts(X) { emberBurst(18, X.mx, X.gy - 10, '#ffb050', 160); emberBurst(8, X.mx, X.my, '#fff0a0', 120); },
    },
    獅子奮迅撃: {
      col: '#ffd36a', col2: '#ff9a3a', motion: 'flurry', lead: 0.17, ono: 'ガオォッ!!', go: 'whoosh',
      draw(X) {
        const s = X.K, d = X.d;
        for (let j = 0; j < 6; j++) fxSlash(X.mx + ((j * 37) % 13) - 6, X.my + ((j * 23) % 17) - 8, d - j * 0.05, -1.4 + j * 0.55, (0.9 + (j % 2) * 0.3) * s, j % 2 ? X.col : X.col2, 0.16);
        if (d > 0.16 && d < 0.8) {
          const k2 = G.seg(d, 0.16, 0.8), e = G.ease.outCubic(k2);
          fxStar(X.mx, X.my, (34 + 58 * e) * s, k2 * 0.5, X.col2, 0.55 * (1 - k2), 18, 0.62);
          fxStar(X.mx, X.my, (26 + 44 * e) * s, -k2 * 0.4, X.col, 0.75 * (1 - k2), 18, 0.6);
          fxText('獅子', X.mx, X.top - 18 - e * 14, 18 * s, '#fff2c0', G.bump(k2) * 0.9, 'head');
        }
      },
      parts(X) { emberBurst(14, X.mx, X.my, '#ffd36a', 200); },
      multi: [0.05, 0.1, 0.15, 0.2, 0.25],
    },
    大地裂き: {
      col: '#ffb060', col2: '#8a5a32', motion: 'slam', lead: 0.3, ono: 'ゴゴゴォン!!', go: 'whoosh', hitS: 'impact', heavy: true, shake: 1.6,
      draw(X) {
        const s = X.K, d = X.d;
        const land = X.lead - 0.1, lx = X.home + 66, ul = X.u - land;
        if (ul > 0 && d < 0.75) {
          const k2 = G.seg(ul, 0, 0.1);
          fxCrack(lx, G.lerp(lx, X.mx + 34, k2), X.gy + 2, 3, X.col, 1 - G.seg(d, 0.4, 0.75));
          fxShock(lx, X.gy, ul, 0.4, 60 * s, '#ffe0b0', 5);
          if (ul < 0.3) fxPuff(lx, X.gy - 8, (12 + ul * 50) * s, '#c8a888', 0.55 * (1 - ul / 0.3));
        }
        if (d > -0.02 && d < 0.65) {
          for (let j = 0; j < 6; j++) {
            const h = (36 + G.hash(j * 11 + 3) * 48) * s * G.bump(G.seg(d, -0.02 + j * 0.025, 0.62));
            fxSpike(X.mx + (j - 2.5) * 13 * s, X.gy + 5, h, 8 * s, (j - 2.5) * 3, '#a8784e', '#d8b08a', 1);
          }
          fxShock(X.mx, X.gy, d, 0.5, 110 * s, X.col, 7);
        }
      },
      parts(X) {
        for (let j = 0; j < 16; j++) addPart(shardP(X.mx, X.gy - 10, '#a8784e', true));
        for (let j = 0; j < 6; j++) addPart(fxP('puff', X.mx + G.rand(-40, 40), X.gy - 6, '#c8b090', 40, 14, 0.8, -20, 20));
      },
    },
    十文字斬り: {
      col: '#a8d8ff', col2: '#ffffff', motion: 'dash', lead: 0.17, ono: 'ズババッ!!', go: 'swish',
      draw(X) {
        const s = X.K, d = X.d;
        if (d > -0.02 && d < 0.6) {
          const k1 = G.ease.outCubic(G.seg(d, -0.02, 0.06)), k2 = G.ease.outCubic(G.seg(d, 0.07, 0.15));
          const f = 1 - G.seg(d, 0.3, 0.6), L1 = 132 * s;
          fxBlade(X.mx, X.my, 0.12, L1 * k1, 4.5 * s, X.col, f);
          fxBlade(X.mx, X.my, Math.PI / 2 + 0.12, L1 * k2, 4.5 * s, X.col, f);
          if (d > 0.15) {
            const k3 = G.seg(d, 0.15, 0.6);
            fxTwinkle(X.mx, X.my, 46 * s * (1 - k3 * 0.5), '#ffffff', 1 - k3);
            for (let j = 0; j < 4; j++) {
              const an = 0.12 + (j * Math.PI) / 2;
              fxTwinkle(X.mx + Math.cos(an) * 66 * s, X.my + Math.sin(an) * 66 * s, 14 * s, X.col, 1 - k3);
            }
          }
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.my, '#cfe8ff')); },
      multi: [0.08],
    },
    流星剣: {
      col: '#bfe0ff', col2: '#ffffff', motion: 'flip', lead: 0.34, ono: 'ギュオォン!!', go: 'whoosh', heavy: true, shake: 1.3,
      draw(X) {
        const s = X.K, d = X.d;
        // 急降下する彗星の尾
        if (X.u > X.lead * 0.55 && d < 0.04) {
          const hx = X.hx + 6, hy = X.gy + X.hy - 40;
          const ax = X.home + 30, ay = X.gy - 210 - 40;
          fxStreak(ax, ay, hx, hy, 16 * s, X.col, 0.5);
          fxStreak(G.lerp(ax, hx, 0.4), G.lerp(ay, hy, 0.4), hx, hy, 6 * s, '#ffffff', 0.9);
          fxGlow(hx, hy, 34 * s, X.col, 0.9);
        }
        // 降り注ぐ流れ星
        for (let j = 0; j < 4; j++) {
          const t0 = -0.14 + j * 0.06, k2 = G.seg(d, t0, t0 + 0.2);
          if (k2 <= 0 || k2 >= 1) continue;
          const x0 = X.mx - 150 + j * 34, y0 = -50, x1 = X.mx - 24 + j * 16, y1 = X.gy - 14 - (j % 2) * 30;
          const x = G.lerp(x0, x1, k2), y = G.lerp(y0, y1, k2);
          fxStreak(G.lerp(x0, x, 0.3), G.lerp(y0, y, 0.3), x, y, 4 * s, X.col, 0.7);
          fxTwinkle(x, y, 12 * s, '#ffffff', 1);
        }
        if (d >= 0 && d < 0.55) {
          const k2 = G.seg(d, 0, 0.55);
          fxStar(X.mx, X.my, 84 * s * (1 - k2 * 0.4), k2 * 0.8, X.col, 0.8 * (1 - k2), 8, 0.22);
          for (let j = 0; j < 8; j++) {
            const an = (j / 8) * TAU + 0.2, r = (20 + 90 * G.ease.outCubic(k2)) * s;
            fxStar(X.mx + Math.cos(an) * r, X.my + Math.sin(an) * r * 0.7, 7 * s, k2 * 6, j % 2 ? '#ffffff' : X.col, 1 - k2);
          }
        }
      },
      parts(X) { for (let j = 0; j < 14; j++) addPart(fxP('star', X.mx, X.my, j % 2 ? '#ffffff' : '#bfe0ff', 260, 6, 0.9, 200, 60)); },
    },
    // ---------------- 魔法使い
    蒼炎の槍: {
      col: '#4aa8ff', col2: '#c8f0ff', motion: 'cast', lead: 0.24, ono: 'ボォウッ!!', go: 'cast',
      draw(X) {
        const s = X.K, d = X.d;
        if (X.w > 0 && X.u < 0.04) { const k2 = G.seg(X.w, 0, X.W); fxFlame(X.home + 12, X.gy - 74, 6 * s * k2, 18 * s * k2, X.t, 1, X.col, X.col2, 0.95); }
        const k2 = X.u / X.lead;
        if (k2 >= 0 && k2 <= 1) {
          const tx = X.mx - 8, x = G.lerp(X.sx, tx, k2), y = G.lerp(X.sy - 6, X.my, k2);
          ctx.save();
          ctx.translate(x, y); ctx.rotate(Math.atan2(X.my - X.sy + 6, tx - X.sx));
          for (let j = 3; j >= 0; j--) fxFlame(-6 - j * 11 * s, 0, (7 - j) * s, (30 + j * 8) * s, X.t, j * 3, X.col, X.col2, 0.85 - j * 0.15, -Math.PI / 2);
          fxA(1); ctx.fillStyle = X.col2;
          ctx.beginPath(); ctx.moveTo(-28 * s, 0); ctx.lineTo(0, -5.5 * s); ctx.lineTo(24 * s, 0); ctx.lineTo(0, 5.5 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(-16 * s, 0); ctx.lineTo(2 * s, -2.5 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(2 * s, 2.5 * s); ctx.closePath(); ctx.fill();
          ctx.restore();
          fxGlow(x, y, 26 * s, X.col, 0.6);
        }
        if (d >= 0 && d < 0.75) {
          const k3 = G.seg(d, 0, 0.35), f = 1 - G.seg(d, 0.25, 0.75);
          for (let j = 0; j < 8; j++) {
            const an = (j / 8) * TAU + 0.3;
            fxFlame(X.mx + Math.cos(an) * 10 * s, X.my + Math.sin(an) * 10 * s, 9 * s, (20 + 32 * G.ease.outCubic(k3)) * s, X.t, j, X.col, X.col2, f * 0.9, an + Math.PI / 2);
          }
          if (d > 0.12) for (let j = 0; j < 3; j++) fxFlame(X.mx + (j - 1) * 18 * s, X.gy - 2, 8 * s, 26 * s, X.t, j + 5, X.col, X.col2, f * 0.85);
        }
      },
      parts(X) { emberBurst(16, X.mx, X.my, '#8fd0ff', 150); },
    },
    星降りの陣: {
      col: '#ffe9a0', col2: '#c8a0ff', motion: 'raise', lead: 0.28, ono: 'シャララン!!', go: 'cast',
      draw(X) {
        const s = X.K, d = X.d;
        const cy = Math.max(36, X.top - 110);
        const a = G.seg(X.w, 0, X.W + 0.05) * (1 - G.seg(d, 0.35, 0.6));
        fxGlow(X.mx, cy, 70 * s, X.col2, a * 0.45);
        fxSigil(X.mx, cy, 72 * s, X.t * 1.5, X.col2, a * 0.95, 0.3, 5);
        for (let j = 0; j < 10; j++) {
          const tA = -0.12 + j * 0.032, k2 = G.seg(d, tA - 0.22, tA);
          if (k2 <= 0 || d > tA + 0.01) continue;
          const ox = (G.hash(j * 13 + 2) - 0.5) * 130 * s;
          const x0 = X.mx + ox, x1 = X.mx + ox * 0.3 - 8, y1 = X.my + (G.hash(j * 7) - 0.5) * 34;
          const e = G.ease.inCubic(k2), x = G.lerp(x0, x1, e), y = G.lerp(cy, y1, e);
          fxStreak(G.lerp(x0, x, 0.45), G.lerp(cy, y, 0.45), x, y, 4 * s, X.col, 0.6);
          fxStar(x, y, 9 * s, X.t * 6 + j, j % 3 ? X.col : '#ffffff', 1);
        }
        if (d >= 0 && d < 0.5) {
          const k2 = d / 0.5;
          for (let j = 0; j < 7; j++) {
            const an = (j / 7) * TAU, r = (14 + 70 * G.ease.outCubic(k2)) * s;
            fxStar(X.mx + Math.cos(an) * r, X.my + Math.sin(an) * r * 0.6, 8 * s * (1 - k2), k2 * 5, j % 2 ? X.col : X.col2, 1 - k2);
          }
        }
      },
      parts(X) { for (let j = 0; j < 16; j++) addPart(fxP('star', X.mx, X.my, j % 2 ? '#ffe9a0' : '#c8a0ff', 220, 6, 1, 160, 60)); },
      multi: [0.06, 0.12],
    },
    雷鳴の輪舞: {
      col: '#fff27a', col2: '#8fd0ff', motion: 'raise', lead: 0.26, ono: 'バリバリッ!!', go: 'cast', extra: ['shatter'], flash: '#e8f4ff',
      draw(X) {
        const s = X.K, d = X.d;
        const ra = G.seg(X.u, -0.05, 0.12) * (1 - G.seg(d, 0.35, 0.6));
        const R = 54 * s, rot = X.t * 9, fr = Math.floor(X.t * 22);
        if (ra > 0) {
          for (let j = 0; j < 6; j++) {
            const a0 = rot + (j / 6) * TAU, a1 = a0 + TAU / 6;
            fxBolt(X.mx + Math.cos(a0) * R, X.my + Math.sin(a0) * R * 0.42, X.mx + Math.cos(a1) * R, X.my + Math.sin(a1) * R * 0.42, j + fr * 7, 4, 6 * s, 1.4 * s, X.col2, ra);
          }
          for (let j = 0; j < 3; j++) { const an = rot * 1.3 + j * 2.1; fxGlow(X.mx + Math.cos(an) * R, X.my + Math.sin(an) * R * 0.42, 12 * s, X.col, ra); }
        }
        for (let j = 0; j < 3; j++) {
          const dj = d - j * 0.07;
          if (dj < -0.02 || dj > 0.13) continue;
          const bx = X.mx + (j - 1) * 24 * s;
          fxBolt(bx + 26, -90, bx, X.my - 4, j * 17 + fr, 10, 16 * s, 2.4 * s, X.col, 1 - G.seg(dj, 0.05, 0.13));
          fxGlow(bx, X.my, 44 * s, X.col2, 0.85 * (1 - G.seg(dj, 0, 0.13)));
        }
        if (d >= 0 && d < 0.22 && !X.rm) fxTint('#e8f4ff', 0.3 * (1 - d / 0.22));
      },
      parts(X) { for (let j = 0; j < 18; j++) addPart(fxP('spark', X.mx, X.my, j % 2 ? '#fff27a' : '#bfe8ff', 260, 3.5, 0.5, 120, 40)); },
      multi: [0.07, 0.14],
    },
    氷華結界: {
      col: '#bff0ff', col2: '#6fb8ff', motion: 'cast', lead: 0.24, ono: 'パキィン!!', go: 'cast', extra: ['shatter'],
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = X.u / X.lead;
        if (k2 >= 0 && k2 <= 1) {
          for (let j = 0; j < 6; j++) {
            const an = (j / 6) * TAU + 0.5, r = (120 * (1 - G.ease.inCubic(k2)) + 6) * s;
            const x = X.mx + Math.cos(an) * r, y = X.my + Math.sin(an) * r * 0.7;
            ctx.save(); ctx.translate(x, y); ctx.rotate(an);
            fxA(0.9); ctx.fillStyle = X.col;
            ctx.beginPath(); ctx.moveTo(-12 * s, 0); ctx.lineTo(0, -3.5 * s); ctx.lineTo(10 * s, 0); ctx.lineTo(0, 3.5 * s); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
        if (d >= -0.02 && d < 0.85) {
          const bloom = G.ease.outBack(G.seg(d, -0.02, 0.2)), f = 1 - G.seg(d, 0.5, 0.85);
          if (!X.rm) fxTint('#9fd8ff', 0.13 * f);
          fxA(0.3 * f); ctx.fillStyle = '#e8fbff';
          ctx.beginPath(); ctx.ellipse(X.mx, X.gy + 2, 70 * s * bloom, 14 * s * bloom, 0, 0, TAU); ctx.fill();
          for (let j = 0; j < 5; j++) {
            const h = (26 + G.hash(j * 5 + 9) * 34) * s * G.ease.outBack(G.seg(d, j * 0.02, 0.18 + j * 0.02));
            fxSpike(X.mx + (j - 2) * 22 * s, X.gy + 4, h, 7 * s, (j - 2) * 2.5, '#dff8ff', '#8fcfff', f);
          }
          ctx.save();
          ctx.translate(X.mx, X.my); ctx.rotate(d * 0.7);
          for (let ring2 = 0; ring2 < 2; ring2++) {
            const len = (ring2 ? 36 : 62) * s * bloom, wd = (ring2 ? 8 : 12) * s;
            for (let j = 0; j < 6; j++) {
              ctx.rotate(TAU / 6);
              fxA((ring2 ? 0.85 : 0.55) * f); ctx.fillStyle = ring2 ? X.col : X.col2;
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wd, -len * 0.28); ctx.lineTo(0, -len); ctx.lineTo(-wd, -len * 0.28); ctx.closePath(); ctx.fill();
              fxA(f); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
            }
            ctx.rotate(Math.PI / 6);
          }
          ctx.restore();
          fxTwinkle(X.mx, X.my, 28 * s * f, '#ffffff', f);
        }
      },
      parts(X) { for (let j = 0; j < 16; j++) addPart(fxP('star', X.mx, X.my, '#e8fbff', 200, 4.5, 1.2, 60, 30)); },
    },
    紅蓮の柱: {
      col: '#ff4a2a', col2: '#ffd070', motion: 'raise', lead: 0.26, ono: 'ゴオオォッ!!', go: 'cast', heavy: true, shake: 1.2,
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W + X.lead * 0.5) * (1 - G.seg(d, 0.4, 0.7));
        fxGlow(X.mx, X.gy, 70 * s, X.col, a * 0.5);
        fxSigil(X.mx, X.gy, 62 * s, -X.t * 2, '#ff8a5a', a, 0.3, 6);
        if (d > -0.06 && d < 0.8) {
          const k2 = G.ease.outCubic(G.seg(d, -0.06, 0.08)), f = 1 - G.seg(d, 0.35, 0.8);
          const w = (24 + 14 * G.bump(G.seg(d, -0.06, 0.32))) * s;
          const topY = G.lerp(X.gy, -220, k2);
          const g = ctx.createLinearGradient(X.mx - w, 0, X.mx + w, 0);
          g.addColorStop(0, clearOf(X.col)); g.addColorStop(0.28, X.col); g.addColorStop(0.5, X.col2); g.addColorStop(0.72, X.col); g.addColorStop(1, clearOf(X.col));
          fxA(f); ctx.fillStyle = g;
          ctx.fillRect(X.mx - w, topY, w * 2, X.gy - topY + 4);
          fxA(f); ctx.fillStyle = '#fff6e0';
          ctx.fillRect(X.mx - w * 0.16, topY, w * 0.32, X.gy - topY);
          for (let j = 0; j < 6; j++) {
            const side = j % 2 ? 1 : -1, yy = X.gy - ((j * 37 + X.t * 220) % (X.gy - topY + 1));
            fxFlame(X.mx + side * w * 0.7, yy, 8 * s, 30 * s, X.t, j, X.col, X.col2, f * 0.9, side * 0.4);
          }
          if (!X.rm) fxTint('#ff3a1a', 0.12 * f);
        }
      },
      parts(X) { emberBurst(22, X.mx, X.gy - 20, '#ffb060', 140); },
      multi: [0.1, 0.2],
    },
    月光砲: {
      col: '#e6e2ff', col2: '#a49cff', motion: 'cast', lead: 0.16, ono: 'ズォォォン!!', go: 'cast', extra: ['magic'],
      draw(X) {
        const s = X.K, d = X.d;
        const night = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.35, 0.65));
        if (!X.rm) fxTint('#0a0830', 0.3 * night);
        const mx0 = X.home - 4, my0 = X.gy - 150;
        fxGlow(mx0, my0, 64 * s, X.col2, 0.6 * night);
        fxCrescent(mx0, my0, 26 * s, Math.PI, '#f6f4ff', night, 0.55);
        if (X.u > 0 && d < 0.45) {
          const k2 = G.seg(X.u, 0, X.lead), f = 1 - G.seg(d, 0.22, 0.45);
          const x1 = G.lerp(X.sx, X.mx + 100, G.ease.outCubic(k2)), y1 = G.lerp(X.sy - 6, X.my - 4, G.ease.outCubic(k2));
          const w = (11 + Math.sin(X.t * 40) * 1.5) * s * (d > 0 ? 1.5 - G.seg(d, 0, 0.45) : 1);
          fxBeam(X.sx, X.sy - 6, x1, y1, w, X.col2, f);
          fxGlow(X.sx, X.sy - 6, 24 * s, X.col, f);
          for (let j = 0; j < 3; j++) {
            const ph = ((X.t * 3 + j / 3) % 1), rx = G.lerp(X.sx, x1, ph), ry = G.lerp(X.sy - 6, y1, ph);
            fxRingV(rx, ry, 4 * s, (14 + ph * 10) * s, 2 * s, X.col, f * (1 - ph));
          }
        }
        if (d >= 0 && d < 0.4) fxGlow(X.mx, X.my, 76 * s * (1 - G.seg(d, 0, 0.4) * 0.5), X.col, 0.9 * (1 - d / 0.4));
      },
      parts(X) { for (let j = 0; j < 14; j++) addPart(fxP('star', X.mx, X.my, '#e6e2ff', 200, 5, 1, 80, 40)); },
    },
    // ---------------- 盗賊
    影縫い: {
      col: '#9a7aff', col2: '#2a1a4a', motion: 'throw', lead: 0.2, ono: 'ピシィッ!!', go: 'swish',
      draw(X) {
        const s = X.K, d = X.d;
        const sh = G.seg(X.u, 0, X.lead) * (1 - G.seg(d, 0.55, 0.85));
        if (!X.rm) fxTint('#140a2a', 0.18 * sh);
        fxA(0.7 * sh); ctx.fillStyle = '#1a0e30';
        ctx.beginPath(); ctx.ellipse(X.mx, X.gy + 2, 58 * s, 11 * s, 0, 0, TAU); ctx.fill();
        for (let j = 0; j < 3; j++) {
          const tx = X.mx + (j - 1) * 24 * s, ty = X.gy + 3;
          const k2 = G.seg(X.u, j * 0.03, X.lead - 0.02 + j * 0.01);
          if (X.u < j * 0.03) continue;
          if (k2 < 1) {
            const x = G.lerp(X.sx, tx, k2), y = G.lerp(X.sy, ty, k2) - Math.sin(k2 * Math.PI) * 20;
            fxKunai(x, y, Math.atan2(ty - X.sy, tx - X.sx) + 0.2, 1.1 * s, 1);
          } else if (d < 0.85) {
            const f = 1 - G.seg(d, 0.55, 0.85);
            fxGlow(tx, ty - 2, 14 * s, X.col, 0.7 * f);
            fxKunai(tx - 9 * s, ty - 9 * s, 0.9, 1.1 * s, f);
            const st = G.seg(d, 0, 0.18);
            if (st > 0) fxBolt(tx, ty - 2, G.lerp(tx, X.mx + (j - 1) * 6, st), G.lerp(ty, X.my + 4, st), j * 5 + 1, 6, 5, 1 * s, X.col, f * 0.9, '#e8dcff');
          }
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.gy - 10, '#b89aff')); },
    },
    月下千刃: {
      col: '#e8e8ff', col2: '#9a9aff', motion: 'blink', lead: 0.24, ono: 'ザザザンッ!!', go: 'whoosh',
      draw(X) {
        const s = X.K, d = X.d;
        const night = G.seg(X.u, -0.05, 0.12) * (1 - G.seg(d, 0.42, 0.66));
        if (!X.rm) fxTint('#06081e', 0.36 * night);
        fxGlow(X.mx - 50, X.top - 70, 56 * s, X.col2, 0.55 * night);
        fxCircle(X.mx - 50, X.top - 70, 21 * s, '#fbfaff', night);
        if (X.u > 0 && X.u < 0.24) { const k2 = X.u / 0.24; fxPuff(X.home, X.gy - 34, (16 + k2 * 18) * s, '#4a4a6a', 0.65 * (1 - k2)); }
        if (X.u > X.lead * 0.35 && d < 0.12) { const k2 = G.seg(X.u, X.lead * 0.35, X.lead); fxPuff(X.mx + 50, X.gy - 34, (12 + k2 * 16) * s, '#4a4a6a', 0.55 * (1 - k2)); }
        for (let j = 0; j < 16; j++) {
          const dj = d + 0.02 - j * 0.022;
          if (dj < 0 || dj > 0.13) continue;
          const ang = G.hash(j * 19 + 4) * TAU, len = (70 + G.hash(j * 3) * 46) * s;
          const ox = (G.hash(j * 5 + 1) - 0.5) * 40 * s, oy = (G.hash(j * 11 + 2) - 0.5) * 40 * s;
          fxBlade(X.mx + ox, X.my + oy, ang, len * G.ease.outCubic(G.seg(dj, 0, 0.05)), 2.2 * s, X.col2, 1 - G.seg(dj, 0.05, 0.13));
        }
      },
      parts(X) { for (let j = 0; j < 14; j++) addPart(sparkP(X.mx, X.my, '#e8e8ff')); },
      multi: [0.06, 0.12, 0.18, 0.24, 0.3],
    },
    燕返し: {
      col: '#80c8ff', col2: '#ffffff', motion: 'through', lead: 0.22, ono: 'スパパンッ!!', go: 'swish',
      draw(X) {
        const s = X.K, d = X.d;
        const ax = X.mx - 34 * s, ay = X.my - 42 * s, bx = X.mx + 2, by = X.my + 26 * s, cx = X.mx + 40 * s, cy = X.my - 46 * s;
        const d1 = d + 0.12;
        if (d1 > 0 && d1 < 0.5) { const k2 = G.ease.outCubic(G.seg(d1, 0, 0.06)); fxBlade(G.lerp(ax, bx, k2 / 2), G.lerp(ay, by, k2 / 2), Math.atan2(by - ay, bx - ax), Math.hypot(bx - ax, by - ay) * k2, 3.6 * s, X.col, 1 - G.seg(d1, 0.3, 0.5)); }
        if (d > 0 && d < 0.5) { const k2 = G.ease.outCubic(G.seg(d, 0, 0.06)); fxBlade(G.lerp(bx, cx, k2 / 2), G.lerp(by, cy, k2 / 2), Math.atan2(cy - by, cx - bx), Math.hypot(cx - bx, cy - by) * k2, 3.6 * s, X.col, 1 - G.seg(d, 0.3, 0.5)); }
        if (d1 > 0 && d < 0.45) {
          let x, y, rot;
          if (d < 0) { const k2 = G.seg(d1, 0, 0.12); x = G.lerp(ax, bx, k2); y = G.lerp(ay, by, k2); rot = Math.atan2(by - ay, bx - ax); }
          else { const k2 = G.seg(d, 0, 0.45); x = G.lerp(bx, cx + 60, k2); y = G.lerp(by, cy - 50, k2); rot = Math.atan2(cy - by, cx - bx); }
          fxStreak(x - Math.cos(rot) * 40 * s, y - Math.sin(rot) * 40 * s, x, y, 4 * s, X.col, 0.6);
          fxSwallow(x, y, 1.3 * s, Math.sin(X.t * 30), rot, '#1e2a4a', 1 - G.seg(d, 0.3, 0.45));
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.my, '#a8dcff')); },
      multi: [-0.12],
    },
    夜霧の舞: {
      col: '#b8a8e0', col2: '#6a5a9a', motion: 'spin', lead: 0.22, ono: 'ヒュルルッ!!', go: 'whoosh',
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.u, -0.1, 0.12) * (1 - G.seg(d, 0.45, 0.8));
        if (!X.rm) fxTint('#2a2050', 0.16 * a);
        for (let j = 0; j < 8; j++) {
          const an = X.t * 2.6 + (j / 8) * TAU, r = (44 + 12 * Math.sin(j * 1.7)) * s;
          fxPuff(X.mx + Math.cos(an) * r, X.my + Math.sin(an) * r * 0.45 + 10, (17 + G.hash(j) * 9) * s, j % 2 ? X.col : X.col2, 0.42 * a);
        }
        for (let j = 0; j < 4; j++) fxPuff(X.mx - 60 + j * 40, X.gy - 6, 16 * s, X.col2, 0.35 * a);
        for (let j = 0; j < 4; j++) fxSlash(X.mx + (j % 2 ? 10 : -10), X.my + (j - 1.5) * 8, d - j * 0.07, -1.2 + j * 0.9, 0.95 * s, X.col, 0.18);
      },
      parts(X) { for (let j = 0; j < 6; j++) addPart(fxP('puff', X.mx + G.rand(-30, 30), X.my, '#8a7ab8', 50, 16, 0.9, -30, 20)); },
      multi: [0.07, 0.14, 0.21],
    },
    乱れ椿: {
      col: '#ff4a6a', col2: '#ffd0d8', motion: 'spin', lead: 0.2, ono: 'ザシュシュッ!!', go: 'swish',
      draw(X) {
        const s = X.K, d = X.d;
        for (let j = 0; j < 4; j++) fxSlash(X.mx + (j - 1.5) * 6, X.my + (j % 2 ? -8 : 8), d - j * 0.06, -1.1 + j * 0.8, 1.05 * s, X.col, 0.18);
        if (d > 0.05 && d < 0.75) {
          const k2 = G.ease.outBack(G.seg(d, 0.05, 0.22)), f = 1 - G.seg(d, 0.45, 0.75);
          ctx.save();
          ctx.translate(X.mx, X.my - 6); ctx.rotate(d * 0.8); ctx.scale(k2 * s, k2 * s);
          for (let j = 0; j < 5; j++) {
            ctx.rotate(TAU / 5);
            fxCircle(0, -14, 13, '#c8143a', f);
            fxCircle(-3, -16, 7, '#ff6a84', f * 0.8);
          }
          fxCircle(0, 0, 7, '#ffd84a', f);
          for (let j = 0; j < 6; j++) fxCircle(Math.cos(j) * 5, Math.sin(j) * 5, 1.6, '#fff4b0', f);
          ctx.restore();
        }
      },
      parts(X) { petalBurst(20, X.mx, X.my, ['#e8234a', '#ff6a84', '#ffd0d8'], 230, 5.5, 1); },
      multi: [0.06, 0.12],
    },
    // ---------------- 僧侶
    聖灯の祈り: {
      col: '#ffd890', col2: '#ff9a3a', motion: 'pray', lead: 0.26, ono: 'シャラァン!!', go: 'heal', heal: true,
      draw(X) {
        const s = X.K, d = X.d;
        for (let j = 0; j < 4; j++) {
          const rise = G.ease.outCubic(G.seg(X.w, j * 0.03, X.W + 0.06));
          if (rise <= 0 || d > 0.02) continue;
          const x0 = X.home + (j - 1.5) * 20 * s, y0 = X.gy - 40 - rise * (52 + (j % 2) * 16) * s;
          const k2 = G.ease.inOut(G.seg(X.u, j * 0.03, X.lead));
          const x = G.lerp(x0, X.mx + (j - 1.5) * 8, k2), y = G.lerp(y0, X.my, k2) - Math.sin(k2 * Math.PI) * 40 * s + Math.sin(X.t * 6 + j) * 2;
          fxGlow(x, y, 20 * s, X.col, 0.75);
          fxLantern(x, y, 1.05 * s, '#ffb84a', 1);
        }
        if (d >= 0 && d < 0.65) {
          const k2 = G.seg(d, 0, 0.65);
          fxGlow(X.mx, X.my, (40 + 50 * G.ease.outCubic(k2)) * s, X.col, 1 - k2);
          for (let j = 0; j < 10; j++) {
            const an = (j / 10) * TAU + k2;
            fxLine(X.mx + Math.cos(an) * 20 * s, X.my + Math.sin(an) * 20 * s, X.mx + Math.cos(an) * (40 + 60 * k2) * s, X.my + Math.sin(an) * (40 + 60 * k2) * s, 3 * s, '#fff4c0', 0.8 * (1 - k2));
          }
          for (let i = 0; i < X.n; i++) {
            const px = X.px[i];
            const g = ctx.createLinearGradient(0, X.gy - 120, 0, X.gy);
            g.addColorStop(0, 'rgba(255,230,160,0)'); g.addColorStop(1, 'rgba(255,230,160,0.5)');
            fxA(1 - k2); ctx.fillStyle = g; ctx.fillRect(px - 20, X.gy - 120, 40, 120);
          }
        }
      },
      parts(X) { emberBurst(14, X.mx, X.my, '#ffe6a0', 140); },
    },
    天使の鐘: {
      col: '#fff0b0', col2: '#ffd36a', motion: 'pray', lead: 0.26, ono: 'カラァン!!', go: 'heal', extra: ['door'],
      draw(X) {
        const s = X.K, d = X.d;
        const bx = X.mx, by = Math.max(50, X.top - 88);
        const a = G.ease.outBack(G.seg(X.u, -0.12, 0.12)), f = 1 - G.seg(d, 0.5, 0.85);
        if (a > 0 && f > 0) {
          const sw = Math.sin(X.t * 11) * (d > 0 ? 0.42 : 0.15);
          fxGlow(bx, by, 52 * s, X.col, 0.55 * f);
          fxWing(bx - 8 * s, by - 4, -1, s * a, '#ffffff', 0.9 * f, 1 + 0.2 * Math.sin(X.t * 8));
          fxWing(bx + 8 * s, by - 4, 1, s * a, '#ffffff', 0.9 * f, 1 + 0.2 * Math.sin(X.t * 8));
          fxBell(bx, by, 1.2 * s * a, sw, f);
        }
        for (let j = 0; j < 3; j++) {
          const dj = d - j * 0.09;
          if (dj < 0 || dj > 0.5) continue;
          const k2 = dj / 0.5;
          fxRing(bx, by + 10, (20 + 120 * G.ease.outCubic(k2)) * s, 3 * s * (1 - k2) + 0.5, X.col, 1 - k2, 0.62);
        }
        if (d >= 0 && d < 0.4) fxCone(bx, by + 10, X.mx, X.gy, 8 * s, 46 * s, '#fff6d0', 0.5 * (1 - d / 0.4));
      },
      parts(X) { petalBurst(10, X.mx, X.top - 40, ['#ffffff', '#fff6d8'], 120, 6, 1.8); },
    },
    光輪の裁き: {
      col: '#ffe070', col2: '#fff8d0', motion: 'raise', lead: 0.28, ono: 'ズシャアッ!!', go: 'cast', extra: ['rarity', 2],
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = G.ease.inOut(G.seg(X.u, -0.05, X.lead));
        const hy = G.lerp(X.top - 160, X.my - 4, k2), a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.35, 0.6));
        fxRing(X.mx, hy, 48 * s, 8 * s, X.col, a * 0.55, 0.3);
        fxRing(X.mx, hy, 48 * s, 3 * s, '#ffffff', a, 0.3);
        for (let j = 0; j < 8; j++) {
          const an = (j / 8) * TAU + X.t * 3;
          fxStar(X.mx + Math.cos(an) * 48 * s, hy + Math.sin(an) * 48 * s * 0.3, 4 * s, 0, '#fff8d0', a, 4, 0.3);
        }
        for (let j = 0; j < 5; j++) {
          const dj = d - Math.abs(j - 2) * 0.03;
          if (dj < -0.03 || dj > 0.22) continue;
          const x = X.mx + (j - 2) * 15 * s;
          fxBeam(x, -120, x, X.my + 16, 4.5 * s, X.col, 1 - G.seg(dj, 0.06, 0.22));
        }
        if (d >= 0 && d < 0.45) {
          const k3 = G.seg(d, 0, 0.45), f = 1 - k3;
          fxBlade(X.mx, X.my - 12 * s, Math.PI / 2, 140 * s * G.ease.outCubic(G.seg(d, 0, 0.08)), 5 * s, X.col, f);
          fxBlade(X.mx, X.my - 34 * s, 0, 80 * s * G.ease.outCubic(G.seg(d, 0.04, 0.12)), 5 * s, X.col, f);
          fxTwinkle(X.mx, X.my - 34 * s, 30 * s, '#ffffff', f);
        }
      },
      parts(X) { emberBurst(12, X.mx, X.my, '#fff0a0', 160); },
    },
    浄化の陽: {
      col: '#ffc850', col2: '#fff4c0', motion: 'raise', lead: 0.26, ono: 'パアァァッ!!', go: 'cast', heal: true,
      draw(X) {
        const s = X.K, d = X.d;
        const sx0 = X.mx - 36, sy0 = Math.max(52, X.top - 130);
        const a = G.seg(X.w, 0, X.W + 0.1) * (1 - G.seg(d, 0.45, 0.75));
        if (!X.rm) fxTint('#ffcf70', 0.14 * a);
        fxGlow(sx0, sy0, 80 * s, X.col, a * 0.7);
        for (let j = 0; j < 12; j++) {
          const an = (j / 12) * TAU + X.t * 0.9, r0 = 22 * s, r1 = (44 + (j % 2) * 16) * s;
          fxA(a * 0.6); ctx.fillStyle = X.col2;
          ctx.beginPath(); ctx.moveTo(sx0 + Math.cos(an - 0.12) * r0, sy0 + Math.sin(an - 0.12) * r0); ctx.lineTo(sx0 + Math.cos(an) * r1, sy0 + Math.sin(an) * r1); ctx.lineTo(sx0 + Math.cos(an + 0.12) * r0, sy0 + Math.sin(an + 0.12) * r0); ctx.closePath(); ctx.fill();
        }
        fxCircle(sx0, sy0, 19 * s, '#fffbe6', a);
        if (d > -0.08 && d < 0.65) {
          const f = G.seg(d, -0.08, 0.02) * (1 - G.seg(d, 0.3, 0.65));
          fxCone(sx0, sy0, X.mx, X.gy, 16 * s, 70 * s, X.col2, 0.65 * f);
          for (let j = 0; j < 6; j++) {
            const ph = (X.t * 1.6 + j / 6) % 1;
            fxTwinkle(G.lerp(sx0, X.mx, ph) + Math.sin(j * 3 + X.t * 4) * 20 * s * ph, G.lerp(sy0, X.gy, ph), 7 * s, '#ffffff', f);
          }
        }
      },
      parts(X) { emberBurst(12, X.mx, X.gy - 10, '#fff4c0', 120); },
    },
    // ---------------- 狩人
    流星の矢: {
      col: '#ffa050', col2: '#fff0c0', motion: 'skyshot', lead: 0.34, ono: 'ズドオォン!!', go: 'arrow', extra: ['pop'], heavy: true, shake: 1.3,
      draw(X) {
        const s = X.K, d = X.d;
        if (X.u >= 0 && X.u < X.lead * 0.35) {
          arrow(X.sx, X.sy - 10, X.sx + 80, -70, X.u, X.lead * 0.35, true, 1.25 * s);
          fxGlow(G.lerp(X.sx, X.sx + 80, X.u / (X.lead * 0.35)), G.lerp(X.sy - 10, -70, X.u / (X.lead * 0.35)), 16 * s, X.col, 0.8);
        }
        const k2 = G.seg(X.u, X.lead * 0.45, X.lead);
        if (k2 > 0 && d < 0.02) {
          const x0 = X.mx - 160, y0 = -90, x = G.lerp(x0, X.mx, k2), y = G.lerp(y0, X.my, k2);
          const ang = Math.atan2(X.my - y0, X.mx - x0);
          fxStreak(x - Math.cos(ang) * 120 * s, y - Math.sin(ang) * 120 * s, x, y, 18 * s, X.col, 0.45);
          fxStreak(x - Math.cos(ang) * 70 * s, y - Math.sin(ang) * 70 * s, x, y, 8 * s, X.col2, 0.9);
          fxFlame(x, y, 12 * s, 46 * s, X.t, 3, X.col, X.col2, 0.9, ang - Math.PI / 2);
          fxGlow(x, y, 30 * s, X.col, 1);
        }
        if (d >= 0 && d < 0.65) {
          const k3 = G.ease.outCubic(G.seg(d, 0, 0.2)), f = 1 - G.seg(d, 0.18, 0.65);
          fxGlow(X.mx, X.my, (40 + 50 * k3) * s, X.col, f);
          for (let j = 0; j < 7; j++) { const an = (j / 7) * TAU - 1.2; fxFlame(X.mx, X.my, 10 * s, (24 + 30 * k3) * s, X.t, j, X.col, X.col2, f, an + Math.PI / 2); }
          fxShock(X.mx, X.gy, d, 0.5, 120 * s, X.col, 6);
        }
      },
      parts(X) { emberBurst(18, X.mx, X.my, '#ffb060', 220); for (let j = 0; j < 10; j++) addPart(shardP(X.mx, X.my, '#8a5a3a', true)); },
    },
    風穿ち: {
      col: '#a0f0c0', col2: '#e8fff4', motion: 'bow', lead: 0.18, ono: 'ギュイィン!!', go: 'arrow',
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = X.u / X.lead;
        if (k2 >= 0 && k2 <= 1) {
          const tx = X.mx - 10, x = G.lerp(X.sx, tx, k2), y = G.lerp(X.sy, X.my, k2), sl = (X.my - X.sy) / (tx - X.sx || 1);
          for (let j = 0; j < 5; j++) {
            const rx = x - j * 15 * s;
            if (rx < X.sx) break;
            fxRingV(rx, y - j * 15 * s * sl, 3 * s, (13 - j * 1.6) * s, 2 * s, X.col, 0.85 - j * 0.16);
          }
          arrow(X.sx, X.sy, tx, X.my, X.u, X.lead, true, 1.35 * s);
        }
        if (d >= 0 && d < 0.42) {
          const k3 = G.seg(d, 0, 0.12), f = 1 - G.seg(d, 0.15, 0.42);
          fxBeam(X.mx - 24, X.my, X.mx + 20 + 150 * k3, X.my - 8, 5 * s, X.col, f);
          for (let j = 0; j < 3; j++) fxRingV(X.mx + 24 + j * 44 * k3, X.my - 2 - j * 2, 4 * s, (16 + j * 5) * s, 2.4 * s, X.col2, f);
          for (let j = 0; j < 8; j++) { const an = (j / 8) * TAU; fxLine(X.mx + Math.cos(an) * 24 * s, X.my + Math.sin(an) * 24 * s, X.mx + Math.cos(an) * (40 + 50 * k3) * s, X.my + Math.sin(an) * (40 + 50 * k3) * s, 2 * s, X.col, f); }
        }
      },
      parts(X) { petalBurst(8, X.mx + 20, X.my, ['#7fe0a0', '#c8ffe0'], 220, 4.5, 1.2); },
    },
    千里一射: {
      col: '#fff2c0', col2: '#ffcf4a', motion: 'bow', lead: 0.1, ono: 'シュパァン!!', go: 'arrow', focus: true, extra: ['crit'],
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, -0.02, 0.08) * (1 - G.seg(d, 0.05, 0.25));
        if (a > 0) {
          const k2 = G.seg(X.w, 0, X.W + X.lead), R = G.lerp(64, 22, G.ease.outCubic(k2)) * s;
          ctx.save();
          ctx.translate(X.mx, X.my); ctx.rotate(-k2 * 1.4);
          fxA(a); ctx.strokeStyle = X.col2; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.stroke();
          for (let j = 0; j < 4; j++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(R * 0.7, 0); ctx.lineTo(R * 1.3, 0); ctx.stroke(); }
          ctx.restore();
          fxCircle(X.mx, X.my, 2.5 * s, '#ff5a3a', a);
        }
        if (X.u >= 0 && d < 0.3) {
          const k2 = G.seg(X.u, 0, X.lead), f = 1 - G.seg(d, 0.04, 0.3);
          fxBeam(X.sx, X.sy, G.lerp(X.sx, X.mx, k2), G.lerp(X.sy, X.my, k2), 2.6 * s, X.col2, f);
        }
        if (d >= 0 && d < 0.45) {
          const k3 = d / 0.45;
          fxStar(X.mx, X.my, 96 * s * (1 - k3 * 0.5), 0, '#ffffff', 1 - k3, 4, 0.08);
          fxStar(X.mx, X.my, 50 * s * (1 - k3 * 0.5), Math.PI / 4, X.col2, 1 - k3, 4, 0.12);
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.my, '#fff2c0')); },
    },
    五月雨撃ち: {
      col: '#a0c8ff', col2: '#e8f4ff', motion: 'skyshot', lead: 0.3, ono: 'ドドドドッ!!', go: 'arrow',
      draw(X) {
        const s = X.K, d = X.d;
        for (let j = 0; j < 3; j++) arrow(X.sx, X.sy - 10, X.sx + 40 + j * 24, -70, X.u - j * 0.03, X.lead * 0.3, false, 1 * s);
        for (let j = 0; j < 15; j++) {
          const tA = -0.12 + j * 0.026;
          const x1 = X.mx + (G.hash(j * 7 + 3) - 0.5) * 100 * s, y1 = j % 3 === 0 ? X.gy + 2 : X.my + (G.hash(j * 5) - 0.5) * 44;
          const x0 = x1 - 70, y0 = -60;
          if (d < tA) {
            const k2 = G.seg(d, tA - 0.17, tA);
            if (k2 > 0) arrow(x0, y0, x1, y1, k2 * 0.17, 0.17, false, 0.95 * s);
          } else if (j % 3 === 0 && d < 0.75) {
            const f = 1 - G.seg(d, 0.5, 0.75);
            ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); fxA(f);
            ctx.fillStyle = '#8a5a30'; ctx.fillRect(-16, -1.1, 14, 2.2);
            ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-20, -3.5); ctx.lineTo(-13, 0); ctx.lineTo(-20, 3.5); ctx.closePath(); ctx.fill();
            ctx.restore();
          } else if (d < tA + 0.08) fxTwinkle(x1, y1, 10 * s, X.col2, 1 - (d - tA) / 0.08);
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.my, '#cfe4ff')); },
      multi: [0.05, 0.1, 0.15, 0.2, 0.25],
    },
    翠嵐の矢: {
      col: '#40e0a0', col2: '#c8ffe8', motion: 'bow', lead: 0.2, ono: 'ビュオォォッ!!', go: 'arrow',
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = X.u / X.lead;
        if (k2 >= 0 && k2 <= 1) {
          const tx = X.mx - 10, x = G.lerp(X.sx, tx, k2), y = G.lerp(X.sy, X.my, k2);
          for (let j = 0; j < 4; j++) { const an = X.t * 34 + (j * Math.PI) / 2; fxPetal(x - 8 + Math.cos(an) * 6, y + Math.sin(an) * 10 * s, 4 * s, an, j % 2 ? '#5ad890' : '#b8ffd8', 0.95); }
          arrow(X.sx, X.sy, tx, X.my, X.u, X.lead, true, 1.3 * s);
        }
        if (d > -0.02 && d < 0.75) {
          const k3 = G.ease.outCubic(G.seg(d, -0.02, 0.15)), f = 1 - G.seg(d, 0.45, 0.75);
          for (let j = 0; j < 8; j++) {
            const y = X.gy - j * 19 * s * k3, r = (12 + j * 7.5) * s, rot = X.t * 14 + j * 0.8;
            fxA(0.7 * f); ctx.strokeStyle = j % 2 ? X.col : X.col2; ctx.lineWidth = 3 * s;
            ctx.beginPath(); ctx.ellipse(X.mx + Math.sin(X.t * 12 + j) * 5, y, r, r * 0.3, 0, rot, rot + 4.2); ctx.stroke();
          }
          for (let j = 0; j < 10; j++) {
            const ph = (X.t * 1.4 + G.hash(j * 9)) % 1;
            fxPetal(X.mx + Math.cos(X.t * 10 + j) * (10 + ph * 46) * s, X.gy - ph * 150 * s * k3, 4 * s, X.t * 8 + j, j % 2 ? '#5ad890' : '#b8ffd8', f);
          }
        }
      },
      parts(X) { petalBurst(12, X.mx, X.my, ['#40e0a0', '#b8ffd8', '#2ab07a'], 240, 5, 1.2); },
      multi: [0.1, 0.2],
    },
    // ---------------- 騎士
    聖盾突撃: {
      col: '#cfe0ff', col2: '#7fa8ff', motion: 'charge', lead: 0.22, ono: 'ドゴォォン!!', go: 'whoosh', hitS: 'impact', heavy: true, shake: 1.4,
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.04, 0.22));
        const y0 = X.gy + X.hy - 40;
        if (a > 0) { fxGlow(X.hx + 28, y0, 30 * s, X.col2, 0.6 * a); fxShield(X.hx + 28, y0, 1.15 * s, X.col, X.col2, a); }
        if (X.u > 0 && d < 0) {
          for (let j = 0; j < 5; j++) { const yy = y0 - 26 + j * 13; fxLine(X.hx - 10 - j * 6, yy, X.hx - 60 - j * 10, yy, 2.5, '#ffffff', 0.55); }
          fxPuff(X.hx - 14, X.gy - 5, 10 * s, '#c8b8a0', 0.5);
        }
        if (d >= 0 && d < 0.5) {
          const k2 = d / 0.5;
          fxShield(X.mx - 34, y0, (1.2 + k2 * 2.2) * s, X.col, X.col2, 0.8 * (1 - k2));
          fxShock(X.mx, X.gy, d, 0.5, 120 * s, X.col2, 7);
        }
      },
      parts(X) { for (let j = 0; j < 14; j++) addPart(sparkP(X.mx - 20, X.my, '#dfe8ff')); for (let j = 0; j < 4; j++) addPart(fxP('puff', X.mx - 30 + G.rand(-10, 10), X.gy - 6, '#c8b8a0', 50, 14, 0.7, -20, 10)); },
    },
    不動の誓い: {
      col: '#ffd36a', col2: '#fff4c0', motion: 'stance', lead: 0.22, ono: 'ズンッ!!', go: 'clank', hitS: 'impact', heavy: true, buff: true,
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.3, 0.6));
        fxSigil(X.home, X.gy, 38 * s, X.t, X.col, a, 0.3, 5);
        const g = ctx.createLinearGradient(0, X.gy - 130, 0, X.gy);
        g.addColorStop(0, 'rgba(255,211,106,0)'); g.addColorStop(1, 'rgba(255,211,106,0.55)');
        fxA(a); ctx.fillStyle = g; ctx.fillRect(X.home - 24, X.gy - 130, 48, 130);
        fxShield(X.home + 4, X.gy - 112 - Math.sin(X.t * 6) * 2, 0.7 * s, X.col, X.col2, a);
        if (X.u > 0 && d < 0.1) {
          const k2 = G.seg(X.u, 0, X.lead), x = G.lerp(X.home + 24, X.mx - 4, k2);
          for (let j = 0; j < 5; j++) { const h = (46 - j * 8) * s; fxBlade(x - j * 13 * s, X.gy - h / 2, Math.PI / 2, h, 3 * s, X.col, 1 - j * 0.17); }
        }
        if (d > -0.12) pillar(X.mx, X.gy, d, X.col2, X.col);
      },
      parts(X) { emberBurst(10, X.mx, X.my, '#ffe39a', 130); for (let i = 0; i < X.n; i++) for (let j = 0; j < 4; j++) addPart(sparkP(X.px[i], X.gy - 50, '#ffe39a')); },
    },
    蒼天の槍: {
      col: '#70b8ff', col2: '#dff0ff', motion: 'dive', lead: 0.34, ono: 'ズガアァン!!', go: 'whoosh', heavy: true, shake: 1.5,
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = G.seg(X.u, X.lead * 0.55, X.lead);
        if (k2 > 0 && d < 0.03) {
          const x = X.hx + 4, y = X.gy + X.hy - 30;
          const ang = Math.atan2(X.my + 10 - y, X.mx - x);
          fxStreak(x - Math.cos(ang) * 150, y - Math.sin(ang) * 150, x, y, 14 * s, X.col, 0.45);
          ctx.save();
          ctx.translate(x, y); ctx.rotate(ang);
          fxA(0.35); ctx.fillStyle = X.col;
          ctx.beginPath(); ctx.moveTo(-40 * s, 0); ctx.lineTo(10 * s, -14 * s); ctx.lineTo(80 * s, 0); ctx.lineTo(10 * s, 14 * s); ctx.closePath(); ctx.fill();
          fxA(1); ctx.fillStyle = X.col2;
          ctx.beginPath(); ctx.moveTo(-30 * s, 0); ctx.lineTo(10 * s, -7 * s); ctx.lineTo(74 * s, 0); ctx.lineTo(10 * s, 7 * s); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        if (d > -0.05 && d < 0.5) {
          pillar(X.mx, X.gy, d, X.col2, X.col);
          fxShock(X.mx, X.gy, d, 0.5, 130 * s, X.col, 7);
          if (d > 0 && d < 0.3) fxTwinkle(X.mx, X.top - 30, 40 * s * (1 - d / 0.3), '#ffffff', 1 - d / 0.3);
        }
      },
      parts(X) { for (let j = 0; j < 16; j++) addPart(fxP('spark', X.mx, X.gy - 20, j % 2 ? '#bfe0ff' : '#ffffff', 260, 4, 0.7, 260, 120)); },
    },
    '王剣・灯守り': {
      col: '#ffe39a', col2: '#ffb83a', motion: 'royal', lead: 0.2, ono: 'ズバァァン!!', go: 'whoosh', extra: ['rarity', 3], heavy: true, shake: 1.3,
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W);
        const tipX = X.home + 12, tipY = X.gy - 92;
        if (X.u < 0.05 && a > 0) {
          for (let j = 0; j < 6; j++) {
            const an = (j / 6) * TAU + X.t * 5, r = (44 * (1 - a) + 10) * s;
            fxGlow(tipX + Math.cos(an) * r, tipY + Math.sin(an) * r * 0.6, 9 * s, X.col, a);
          }
          fxTwinkle(tipX, tipY, 22 * s * a, '#ffffff', a);
        }
        if (d > -0.1 && d < 0.6) {
          const k2 = G.ease.inCubic(G.seg(d, -0.1, 0.02)), f = 1 - G.seg(d, 0.25, 0.6);
          const ty = G.lerp(X.top - 160, X.my + 10, k2);
          fxGlow(X.mx, ty - 60 * s, 60 * s, X.col2, 0.5 * f);
          fxBigSword(X.mx + 4, ty, 0.75 * s, 0.12, X.col, X.col2, 0.92 * f);
        }
        if (d >= 0 && d < 0.4) fxSlash(X.mx, X.my, d, -0.3, 2.1 * s, X.col2, 0.22);
      },
      parts(X) { emberBurst(16, X.mx, X.my, '#ffe39a', 200); },
    },
    // ---------------- 吟遊詩人
    勇気の歌: {
      col: '#ffb050', col2: '#ffe08a', motion: 'strum', lead: 0.24, ono: '♪ジャジャーン!!', go: 'cheer', buff: true,
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.4, 0.7));
        for (let j = 0; j < 3; j++) { const kk = (X.t * 1.6 + j / 3) % 1; fxRing(X.home, X.gy - 4, (20 + kk * 96) * s, 3 * (1 - kk) * s, X.col, a * (1 - kk), 0.3); }
        for (let i = 0; i < X.n; i++) { const kk = (X.t * 2 + i * 0.3) % 1; fxArrowUp(X.px[i] + 14, X.gy - 92 - kk * 22, 1.1 * s, X.col2, a * G.bump(kk)); }
        notes(X.sx, X.sy, X.mx - 10, X.my, X.u, X.lead, true);
        notes(X.sx, X.sy - 20, X.mx - 10, X.my - 10, X.u - 0.04, X.lead, true);
        if (d >= 0 && d < 0.5) { const k2 = d / 0.5; fxGlow(X.mx, X.my, 60 * s, X.col, 1 - k2); fxNote(X.mx, X.my - 12, 2.6 * s * (1 + k2), Math.sin(d * 20) * 0.2, X.col2, 1 - k2); }
      },
      parts(X) { for (let i = 0; i < X.n; i++) for (let j = 0; j < 2; j++) addPart(fxP('note', X.px[i] + G.rand(-12, 12), X.gy - 70, j ? '#ffe08a' : '#ffb050', 40, 1.1, 1.2, -40, 60)); },
    },
    眠りの子守唄: {
      col: '#a0c0ff', col2: '#e0e8ff', motion: 'lull', lead: 0.3, ono: '♪スヤァ…', go: 'soft', hitS: 'impact',
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.6, 0.95));
        if (!X.rm) fxTint('#1a2050', 0.2 * a);
        for (let j = 0; j < 5; j++) {
          const k2 = G.seg(X.u, j * 0.04, X.lead + j * 0.02);
          if (k2 <= 0 || k2 >= 1) continue;
          fxNote(G.lerp(X.sx, X.mx, k2), G.lerp(X.sy, X.my, k2) + Math.sin(k2 * 9 + j) * 14 * s, 1.15 * s, Math.sin(X.t * 4 + j) * 0.3, j % 2 ? X.col : X.col2, 1);
        }
        if (d >= 0 && d < 0.95) {
          for (let j = 0; j < 3; j++) {
            const k2 = G.seg(d - j * 0.12, 0, 0.75);
            if (k2 <= 0) continue;
            fxText('Z', X.mx + 14 + j * 15 + k2 * 12, X.top - 8 - j * 14 - k2 * 30, (13 + j * 5) * s, X.col2, G.bump(k2));
          }
          for (let j = 0; j < 5; j++) { const ph = (X.t * 0.8 + j / 5) % 1; fxRingV(X.mx + (j - 2) * 18 * s, X.my - ph * 60, 5 * s, 5 * s, 1.4, X.col2, a * (1 - ph)); }
        }
      },
      parts(X) { for (let j = 0; j < 8; j++) addPart(fxP('note', X.mx, X.my, '#c8d8ff', 60, 1, 1.2, -30, 40)); },
    },
    英雄譚の詩: {
      col: '#ffe39a', col2: '#ffb83a', motion: 'strum', lead: 0.26, ono: '♪ジャァーン!!', go: 'cheer', extra: ['rarity', 2],
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = G.seg(X.u, -0.12, X.lead), f = 1 - G.seg(d, 0.3, 0.6);
        if (k2 > 0 && f > 0) {
          const x0 = X.sx, x1 = G.lerp(x0, X.mx, k2), span = X.mx - x0 || 1;
          fxA(0.9 * f); ctx.strokeStyle = X.col; ctx.lineWidth = 1.8;
          for (let j = 0; j < 5; j++) {
            ctx.beginPath();
            for (let xx = x0; xx <= x1; xx += 10) {
              const y = G.lerp(X.sy, X.my, (xx - x0) / span) - 14 * s + j * 6 * s + Math.sin(xx * 0.05 - X.t * 8) * 9 * s;
              if (xx === x0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
            }
            ctx.stroke();
          }
          for (let j = 0; j < 4; j++) {
            const xx = x0 + ((X.t * 160 + j * 46) % Math.max(1, x1 - x0));
            fxNote(xx, G.lerp(X.sy, X.my, (xx - x0) / span) - 4 + Math.sin(xx * 0.05 - X.t * 8) * 9 * s, 1.1 * s, 0, j % 2 ? X.col : '#ffffff', f);
          }
        }
        if (d > -0.06 && d < 0.45) {
          const k3 = G.ease.outCubic(G.seg(d, -0.06, 0.1)), f2 = 1 - G.seg(d, 0.2, 0.45);
          fxGlow(X.mx, X.my - 30, 70 * s, X.col, 0.6 * f2);
          fxBigSword(X.mx + 30, X.my + 20, 0.66 * s, G.lerp(-1.3, -0.2, k3), '#fff2c0', X.col2, f2);
          fxText('英雄譚', X.mx, X.top - 22, 16 * s, '#fff2c0', f2 * G.seg(d, 0, 0.08), 'head');
        }
      },
      parts(X) { emberBurst(14, X.mx, X.my, '#ffe39a', 180); },
    },
    喝采のフィナーレ: {
      col: '#ff7ab8', col2: '#ffe08a', motion: 'finale', lead: 0.26, ono: '♪ブラボー!!', go: 'cheer', extra: ['claim'],
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W) * (1 - G.seg(d, 0.5, 0.85));
        if (!X.rm) fxTint('#100818', 0.24 * a);
        fxCone(X.mx - 130, -40, X.mx - 6 + Math.sin(X.t * 3) * 12, X.gy, 5, 44 * s, '#fff6d8', 0.4 * a);
        fxCone(X.mx + 130, -40, X.mx + 6 - Math.sin(X.t * 3) * 12, X.gy, 5, 44 * s, '#fff6d8', 0.4 * a);
        const FC = FIREWORK_COLS;
        for (let j = 0; j < 3; j++) {
          const dj = d - j * 0.1;
          if (dj < 0 || dj > 0.55) continue;
          const k2 = dj / 0.55, e = G.ease.outCubic(k2);
          const cx = X.mx + (j - 1) * 54 * s, cy = Math.max(40, X.top - 50 - (j % 2) * 28);
          for (let i = 0; i < 12; i++) {
            const an = (i / 12) * TAU, r0 = 8 * s * e, r1 = (14 + 44 * e) * s;
            fxLine(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 + k2 * 10, cx + Math.cos(an) * r1, cy + Math.sin(an) * r1 + k2 * 14, 2.4 * s, FC[(i + j) % FC.length], 1 - k2);
          }
          fxCircle(cx, cy, 6 * s * (1 - k2), '#ffffff', 1 - k2);
        }
      },
      parts(X) { for (let j = 0; j < 34; j++) addPart(confettiP(X.mx + G.rand(-50, 50), X.top - 30)); },
    },
    // ---------------- 錬金術師
    爆裂フラスコ: {
      col: '#ff8a3a', col2: '#ffe060', motion: 'throw', lead: 0.3, ono: 'ドカアァン!!', go: 'swish', hitS: 'impact', extra: ['pop'], heavy: true, shake: 1.4, flash: '#fff0c0',
      draw(X) {
        const s = X.K, d = X.d;
        const k2 = X.u / X.lead;
        if (k2 >= 0 && k2 <= 1) {
          const x = G.lerp(X.sx, X.mx - 6, k2), y = G.lerp(X.sy, X.my, k2) - Math.sin(k2 * Math.PI) * 74;
          fxFlask(x, y, k2 * 10, 1.4 * s, '#ff5a3a', 1);
          fxTwinkle(x + Math.cos(k2 * 10 - 1.6) * 14 * s, y + Math.sin(k2 * 10 - 1.6) * 14 * s, 8 * s, '#ffe060', 0.6 + 0.4 * Math.sin(X.t * 60));
        }
        if (d >= 0 && d < 0.85) {
          const k3 = G.ease.outCubic(G.seg(d, 0, 0.18)), f = 1 - G.seg(d, 0.15, 0.5);
          fxGlow(X.mx, X.my, (40 + 70 * k3) * s, X.col, f);
          fxCircle(X.mx, X.my, (18 + 38 * k3) * s, X.col, f * 0.85);
          fxCircle(X.mx, X.my, (12 + 24 * k3) * s, X.col2, f);
          for (let j = 0; j < 8; j++) { const an = (j / 8) * TAU + 0.2; fxFlame(X.mx + Math.cos(an) * 16 * s, X.my + Math.sin(an) * 16 * s, 10 * s, (20 + 34 * k3) * s, X.t, j, X.col, X.col2, f, an + Math.PI / 2); }
          const sm = G.seg(d, 0.12, 0.85);
          if (sm > 0) for (let j = 0; j < 5; j++) fxPuff(X.mx + (j - 2) * 18 * s, X.my - sm * 80 - (j % 2) * 12, (14 + sm * 22) * s, '#5a5048', 0.5 * (1 - sm));
          fxShock(X.mx, X.gy, d, 0.5, 130 * s, X.col, 7);
        }
      },
      parts(X) { emberBurst(18, X.mx, X.my, '#ffb050', 240); for (let j = 0; j < 12; j++) addPart(shardP(X.mx, X.my, '#ff8a5a', true)); },
    },
    賢者の霧: {
      col: '#7fe0c0', col2: '#3a9a8a', motion: 'throw', lead: 0.3, ono: 'モワァン!!', go: 'swish', hitS: 'impact', extra: ['magic'],
      draw(X) {
        const s = X.K, d = X.d;
        flaskThrow(X.sx, X.sy, X.mx - 10, X.my, X.u, X.lead, true);
        if (d >= 0 && d < 0.95) {
          const k2 = G.ease.outCubic(G.seg(d, 0, 0.3)), f = 1 - G.seg(d, 0.6, 0.95);
          for (let j = 0; j < 9; j++) {
            const an = (j / 9) * TAU + X.t * 0.8, r = (8 + 44 * k2) * s;
            fxPuff(X.mx + Math.cos(an) * r, X.my + Math.sin(an) * r * 0.5 + 8, (14 + 14 * k2) * s, j % 2 ? X.col : X.col2, 0.4 * f);
          }
          for (let j = 0; j < 4; j++) {
            const tw = G.bump(((X.t * 1.5 + j * 0.27) % 1));
            fxSigil(X.mx + (j - 1.5) * 26 * s, X.my - 10 + (j % 2) * 22, 8 * s, X.t * 3, '#e8fff6', f * tw, 1, 6);
          }
          if (d > 0.12) { fxText('?', X.mx - 14, X.top - 14 - Math.sin(X.t * 8) * 3, 18 * s, '#e8fff6', f); fxText('?', X.mx + 16, X.top - 22 - Math.cos(X.t * 8) * 3, 14 * s, '#e8fff6', f); }
        }
      },
      parts(X) { for (let j = 0; j < 12; j++) addPart(sparkP(X.mx, X.my, '#b8ffe8')); },
    },
    黄金錬成: {
      col: '#ffd040', col2: '#fff2b0', motion: 'cast', lead: 0.26, ono: 'チャリィィン!!', go: 'magic', extra: ['coins'],
      draw(X) {
        const s = X.K, d = X.d;
        const a = G.seg(X.w, 0, X.W + X.lead * 0.5) * (1 - G.seg(d, 0.45, 0.8));
        fxGlow(X.mx, X.gy, 72 * s, X.col, a * 0.45);
        fxSigil(X.mx, X.gy, 68 * s, X.t * 1.2, X.col, a, 0.3, 3);
        fxSigil(X.mx, X.gy, 40 * s, -X.t * 2, X.col2, a * 0.8, 0.3, 6);
        for (let j = 0; j < 8; j++) {
          const an = (j / 8) * TAU + X.t, ph = (X.t * 2 + j / 8) % 1;
          const x = X.mx + Math.cos(an) * 64 * s, y = X.gy + Math.sin(an) * 64 * s * 0.3;
          fxLine(x, y, x, y - (20 + ph * 30) * s, 2, X.col, a * (1 - ph));
        }
        if (d >= 0 && d < 0.55) {
          const k2 = d / 0.55;
          fxA(0.55 * (1 - k2)); ctx.fillStyle = X.col;
          ctx.beginPath(); ctx.ellipse(X.mx, X.my, X.mh * 0.45 + 8, X.mh * 0.55, 0, 0, TAU); ctx.fill();
          fxGlow(X.mx, X.my, 80 * s, X.col, 1 - k2);
          for (let j = 0; j < 10; j++) {
            const an = (j / 10) * TAU + k2;
            fxLine(X.mx + Math.cos(an) * 24 * s, X.my + Math.sin(an) * 24 * s, X.mx + Math.cos(an) * (40 + 70 * k2) * s, X.my + Math.sin(an) * (40 + 70 * k2) * s, 3 * s, X.col2, 1 - k2);
          }
        }
      },
      parts(X) { for (let j = 0; j < 16; j++) addPart(fxP('coin', X.mx, X.my, '#ffd040', 240, 5, 1.2, 420, 160)); },
    },
    万能薬の雨: {
      col: '#9ff0b8', col2: '#e0fff0', motion: 'throwUp', lead: 0.32, ono: 'シャアァァ!!', go: 'swish', hitS: 'impact', extra: ['heal'], heal: true,
      draw(X) {
        const s = X.K, d = X.d;
        const bx = (X.mx + X.home) / 2 + 20, by = Math.max(44, X.top - 120);
        const k1 = G.seg(X.u, 0, X.lead * 0.45);
        if (X.u >= 0 && k1 < 1) fxFlask(G.lerp(X.sx, bx, k1), G.lerp(X.sy, by, k1) - Math.sin(k1 * Math.PI) * 20, k1 * 12, 1.3 * s, '#5ad890', 1);
        const ub = X.u - X.lead * 0.45;
        if (ub >= 0 && ub < 0.45) { fxRing(bx, by, (10 + ub * 170) * s, 3 * s, X.col, 1 - ub / 0.45, 0.6); fxGlow(bx, by, 40 * s, X.col, 1 - ub / 0.45); }
        const ra = G.seg(X.u, X.lead * 0.48, X.lead * 0.62) * (1 - G.seg(d, 0.4, 0.75));
        if (ra > 0) {
          const xl = Math.min(X.px[X.n - 1], X.home) - 24, xr = X.mx + 44;
          for (let j = 0; j < 20; j++) {
            const ph = (X.t * 2.3 + G.hash(j * 3 + 1)) % 1;
            const x = G.lerp(xl, xr, G.hash(j * 7 + 5)), y = G.lerp(by, X.gy - 4, ph);
            fxDrop(x, y, 1.15 * s, j % 3 ? X.col : X.col2, ra * (0.5 + 0.5 * (1 - ph)));
          }
        }
      },
      parts(X) { for (let j = 0; j < 10; j++) addPart(fxP('drop', X.mx, X.my, '#9ff0b8', 160, 1.2, 0.8, 380, 80)); },
    },
  };
  const FIREWORK_COLS = ['#ff7ab8', '#ffe08a', '#8fe0ff', '#b8ff9a', '#ffffff'];
  // 名前が見つからない技（古いデータなど）は職業ごとの汎用の演出
  const FX_FALLBACK = {
    warrior: SKILL_FX['十文字斬り'], knight: SKILL_FX['十文字斬り'], thief: SKILL_FX['乱れ椿'], mage: SKILL_FX['蒼炎の槍'],
    cleric: SKILL_FX['光輪の裁き'], archer: SKILL_FX['風穿ち'], bard: SKILL_FX['勇気の歌'], alchemist: SKILL_FX['爆裂フラスコ'],
  };
  function skillFx(name, cls) {
    return (name && SKILL_FX[name]) || FX_FALLBACK[cls] || FX_FALLBACK.warrior;
  }
  const beatFx = (b, p) => skillFx(b.use || b.skill, p && p.cls);

  // ---- 使い手の動き（o に書き込んで返す。o は使い回す）
  const MO = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, state: 'stand', swing: 0, facing: 1, ghost: 0, glow: 0, expr: null };
  const MO2 = Object.assign({}, MO), MO3 = Object.assign({}, MO);
  const BLINK_X = [50, -50, 40, -46], BLINK_Y = [0, 0, -46, -30];
  function skillMotion(b, fx, t, home, L, o) {
    const W = b.s0 - b.w0, lead = b.lead;
    const w = t - b.w0, u = t - b.s0, d = t - b.at;
    const wk = G.seg(w, 0, W);
    const ret = G.ease.inOut(G.seg(d, 0.14, 0.46));
    o.x = home; o.y = 0; o.rot = 0; o.sx = 1; o.sy = 1; o.alpha = 1; o.state = 'stand'; o.swing = 0; o.facing = 1; o.ghost = 0; o.expr = null;
    o.glow = G.seg(w, -0.02, W * 0.6 + 0.01) * (1 - G.seg(d, 0, 0.3));
    const mo = fx.motion;
    switch (mo) {
      case 'dash': case 'flurry': case 'charge': case 'royal': {
        const tx = L.mx - (mo === 'charge' ? 54 : 46), back = mo === 'charge' ? 16 : 10;
        const hold = mo === 'flurry' ? 0.3 : 0.12;
        if (u < 0) {
          o.x = home - back * G.ease.outCubic(wk);
          o.state = mo === 'charge' ? 'lunge' : 'swing'; o.swing = mo === 'charge' ? 0.5 : 0;
          o.sy = 1 - 0.07 * wk; o.rot = mo === 'charge' ? 0.1 * wk : -0.06 * wk;
          if (mo === 'royal') { o.y = -5 * wk; o.rot = -0.05 * wk; }
        } else if (d < hold) {
          o.x = G.lerp(home - back, tx, G.ease.outCubic(G.seg(u, 0, lead)));
          o.state = 'lunge'; o.swing = G.seg(u, lead - 0.07, lead + 0.03);
          o.ghost = d < 0.04 ? 1 : 0;
          if (mo === 'charge') { o.swing = d < 0 ? 0.45 : 1; o.rot = d < 0 ? 0.14 : 0.05; }
          if (mo === 'flurry' && d > 0) { o.swing = 0.5 + 0.5 * Math.sin(d * 70); o.x += Math.sin(d * 90) * 3; o.ghost = 0.6; }
        } else {
          const r2 = G.ease.inOut(G.seg(d, hold, hold + 0.32));
          o.x = G.lerp(tx, home, r2); o.state = r2 < 1 ? 'lunge' : 'stand'; o.swing = 1;
        }
        break;
      }
      case 'leap': case 'slam': {
        const tx = mo === 'slam' ? home + 52 : L.mx - 36, H = mo === 'slam' ? 76 : 96;
        const land = mo === 'slam' ? lead - 0.1 : lead;
        if (u < 0) { o.state = 'swing'; o.sy = 1 - 0.14 * wk; }
        else if (u < land) {
          const k2 = u / land;
          o.x = G.lerp(home, tx, k2); o.y = -Math.sin(k2 * Math.PI) * H;
          o.rot = G.lerp(-0.25, 0.3, k2); o.state = 'swing'; o.swing = G.seg(k2, 0.62, 1); o.ghost = 1;
        } else if (d < 0.16 || (mo === 'slam' && d < 0.22)) {
          const k2 = G.seg(u - land, 0, 0.14);
          o.x = tx; o.state = 'lunge'; o.swing = 1; o.sy = 1 - 0.13 * (1 - k2); o.rot = 0.22 * (1 - k2);
        } else {
          const r2 = G.ease.inOut(G.seg(d, mo === 'slam' ? 0.22 : 0.16, 0.48));
          o.x = G.lerp(tx, home, r2); o.y = -Math.sin(r2 * Math.PI) * 26; o.state = r2 < 1 ? 'swing' : 'stand'; o.swing = 1;
        }
        break;
      }
      case 'flip': case 'dive': {
        const H = mo === 'dive' ? 320 : 210, ax = home + 30;
        if (u < 0) { o.state = 'swing'; o.sy = 1 - 0.15 * wk; }
        else if (u < lead * 0.55) {
          const k1 = G.ease.outCubic(G.seg(u, 0, lead * 0.45));
          o.x = G.lerp(home, ax, k1); o.y = -k1 * H; o.state = 'swing'; o.ghost = 1;
          if (mo === 'flip') o.rot = k1 * TAU;
        } else if (d < 0) {
          const k2 = G.seg(u, lead * 0.55, lead), e = k2 * k2;
          o.x = G.lerp(ax, L.mx - 30, e); o.y = G.lerp(-H, 0, e); o.rot = 0.5; o.state = 'lunge'; o.swing = G.seg(e, 0.5, 1); o.ghost = 1;
        } else if (d < 0.16) { o.x = L.mx - 30; o.state = 'lunge'; o.swing = 1; o.sy = 1 - 0.13 * (1 - G.seg(d, 0, 0.14)); }
        else { o.x = G.lerp(L.mx - 30, home, ret); o.y = -Math.sin(ret * Math.PI) * 30; o.state = ret < 1 ? 'swing' : 'stand'; o.swing = 1; }
        break;
      }
      case 'through': {
        const fx1 = L.mx + 48, pass = lead * 0.55;
        if (u < 0) { o.state = 'lunge'; o.sy = 1 - 0.1 * wk; o.x = home - 8 * wk; o.rot = 0.1 * wk; }
        else if (u < pass) { const k2 = u / pass; o.x = G.lerp(home - 8, fx1, G.ease.outCubic(k2)); o.state = 'lunge'; o.swing = G.seg(k2, 0.35, 0.75); o.ghost = 1; o.rot = 0.14; }
        else if (d < 0.16) { o.x = fx1 - 6 * G.seg(u, pass, lead); o.facing = -1; o.state = 'lunge'; o.swing = G.seg(u, lead - 0.07, lead + 0.02); }
        else { o.x = G.lerp(fx1, home, ret); o.facing = ret < 0.98 ? -1 : 1; o.state = ret < 0.98 ? 'run' : 'stand'; }
        break;
      }
      case 'blink': {
        if (u < 0) { o.state = 'lunge'; o.sy = 1 - 0.1 * wk; }
        else if (u < lead * 0.35) { o.alpha = 1 - G.seg(u, 0, lead * 0.3); o.state = 'lunge'; }
        else if (d < 0) { o.x = L.mx + 50; o.facing = -1; o.alpha = G.seg(u, lead * 0.4, lead * 0.75); o.state = 'lunge'; o.swing = G.seg(u, lead - 0.08, lead); }
        else if (d < 0.32) {
          const j = Math.floor(d / 0.08) % 4;
          o.x = L.mx + BLINK_X[j]; o.y = BLINK_Y[j]; o.facing = BLINK_X[j] > 0 ? -1 : 1; o.state = 'lunge'; o.swing = G.seg(d % 0.08, 0, 0.05);
        } else if (d < 0.44) { o.x = L.mx - 46; o.alpha = 1 - G.seg(d, 0.32, 0.42); o.state = 'lunge'; o.swing = 1; }
        else o.alpha = G.seg(d, 0.44, 0.56);
        break;
      }
      case 'spin': {
        const tx = L.mx - 40;
        if (u < 0) { o.state = 'lunge'; o.sy = 1 - 0.1 * wk; }
        else if (d < 0.26) {
          const k2 = G.seg(u, 0, lead);
          o.x = G.lerp(home, tx, G.ease.outCubic(k2)); o.y = -Math.sin(k2 * Math.PI) * 16;
          let c = Math.cos(u * 32); if (Math.abs(c) < 0.18) c = c < 0 ? -0.18 : 0.18;
          o.sx = c; o.state = 'lunge'; o.swing = 0.5 + 0.5 * Math.sin(u * 32); o.ghost = d < 0 ? 1 : 0.5;
        } else { o.x = G.lerp(tx, home, G.ease.inOut(G.seg(d, 0.26, 0.54))); o.state = 'stand'; }
        break;
      }
      case 'slashRange': {
        if (u < 0) { o.state = 'swing'; o.x = home - 6 * wk; o.rot = -0.07 * wk; }
        else if (d < 0.3) { const k2 = G.ease.outCubic(G.seg(u, 0, 0.1)); o.state = 'lunge'; o.swing = k2; o.x = home - 6 + 16 * k2; o.rot = 0.1 * (1 - G.seg(d, 0, 0.3)); }
        else o.x = G.lerp(home + 10, home, G.seg(d, 0.3, 0.46));
        break;
      }
      case 'raise': {
        if (d < 0.3) { o.state = 'swing'; o.y = -7 * G.ease.outCubic(wk) - Math.sin(t * 9) * 1.4 * wk; }
        else o.y = -7 * (1 - G.seg(d, 0.3, 0.45));
        break;
      }
      case 'pray': {
        const kn = G.ease.outCubic(wk) * (1 - G.seg(d, 0.32, 0.46));
        if (d < 0.32) { o.state = 'write'; o.expr = 'happy'; }
        o.sy = 1 - 0.14 * kn; o.rot = 0.08 * kn;
        break;
      }
      case 'bow': {
        if (u < 0) { o.state = 'cast'; o.x = home - 4 * wk; o.rot = -0.05 * wk; if (fx.focus) o.sy = 1 - 0.05 * wk; }
        else if (d < 0.25) { o.state = 'cast'; o.x = home - 4 - 6 * G.bump(G.seg(u, 0, 0.22)); o.rot = -0.05 * (1 - G.seg(u, 0, 0.2)); }
        else o.x = G.lerp(home - 4, home, G.seg(d, 0.25, 0.4));
        break;
      }
      case 'skyshot': {
        const up = G.ease.outCubic(wk) * (1 - G.seg(u, lead * 0.35, lead * 0.7));
        if (d < 0.25) o.state = 'cast';
        o.rot = -0.5 * up; o.x = home - 4 * up - 5 * G.bump(G.seg(u, 0, 0.2));
        break;
      }
      case 'throw': case 'throwUp': {
        if (u < 0) { o.state = 'swing'; o.rot = -0.1 * wk; o.x = home - 5 * wk; }
        else if (d < 0.25) {
          if (mo === 'throwUp') { o.state = 'swing'; o.rot = -0.2 * (1 - G.seg(u, 0.12, 0.35)); }
          else { o.state = 'lunge'; o.swing = G.ease.outCubic(G.seg(u, 0, 0.1)); o.rot = 0.12 * (1 - G.seg(u, 0.1, 0.3)); }
        }
        break;
      }
      case 'strum': case 'lull': case 'finale': {
        const on = (d < 0.38 ? 1 : 0) * Math.min(1, wk * 3);
        if (mo === 'lull') { o.rot = Math.sin(t * 5) * 0.1 * on; o.y = -Math.abs(Math.sin(t * 5)) * 2 * on; o.expr = 'happy'; }
        else { o.y = -Math.abs(Math.sin(t * 15)) * 4 * on; o.rot = Math.sin(t * 15) * 0.05 * on; }
        if (mo === 'finale' && d > -0.04 && d < 0.45) o.state = 'cheer';
        break;
      }
      case 'stance': {
        if (u < 0) { o.sy = 1 - 0.08 * wk; o.state = 'swing'; }
        else if (d < 0.3) { o.state = 'lunge'; o.swing = G.ease.outCubic(G.seg(u, 0, 0.08)); o.sy = 0.92 + 0.08 * G.seg(u, 0, 0.12); }
        break;
      }
      default: { // cast
        if (u < 0) { o.state = 'swing'; o.y = -3 * wk; }
        else if (d < 0.32) { o.state = 'cast'; o.x = home - 5 * G.bump(G.seg(u, 0, 0.3)); }
      }
    }
    return o;
  }
  // いま技を使っている拍（その人の「いちばん最近始まった行動」が技なら）
  function skillBeatOf(pl, i, t) {
    let best = null;
    const bs = pl.beats;
    for (let j = 0; j < bs.length; j++) {
      const b = bs[j];
      if (b.who !== i || (b.kind !== 'hit' && b.kind !== 'skill')) continue;
      if ((b.w0 != null ? b.w0 - 0.04 : b.t) <= t) best = b; else break;
    }
    return best && best.w0 != null && t < best.at + 0.62 ? best : null;
  }

  // ---- 溜めの光（使い手の後ろ）
  function drawSkillAura(x, y, g, fx, t) {
    ctx.save();
    const col = fx.col;
    fxGlow(x, y - 40, 54, col, 0.55 * g);
    fxA(0.9 * g); ctx.strokeStyle = col; ctx.lineWidth = 2;
    const rr = 26 + Math.sin(t * 14) * 2;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.28, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let j = 0; j < 8; j++) {
      const an = t * 5 + (j / 8) * TAU;
      ctx.fillRect(x + Math.cos(an) * rr - 1.5, y + Math.sin(an) * rr * 0.28 - 1.5, 3, 3);
    }
    for (let j = 0; j < 6; j++) {
      const ph = (t * 1.9 + G.hash(j * 13 + 7)) % 1;
      const xx = x + (G.hash(j * 5 + 3) - 0.5) * 44, yy = y - 6 - ph * 86;
      fxLine(xx, yy, xx, yy - 16, 2.2, j % 2 ? '#ffffff' : col, g * (1 - ph));
    }
    ctx.restore();
  }
  // ---- 残像（技の動きを少し前の時刻で描く）
  function drawGhosts(p, b, fx, t, L, i, strength) {
    if (rmNow || strength <= 0) return;
    art.setFlash(0.75);
    for (let j = 3; j >= 1; j--) {
      const tt = t - j * 0.035;
      const m = skillMotion(b, fx, tt, L.px[i], L, MO2);
      ctx.save();
      ctx.globalAlpha = 0.24 * (1 - j / 4) * strength * m.alpha;
      ctx.translate(m.x, L.gy + m.y);
      if (m.rot) { ctx.translate(0, -36); ctx.rotate(m.rot * m.facing); ctx.translate(0, 36); }
      ctx.scale(2.35 * m.sx, 2.35 * m.sy);
      art.person(ctx, p.look, { t: tt + i, state: m.state, phase: tt * 9 + i, facing: m.facing, swing: m.swing, armed: true, noShadow: true });
      ctx.restore();
    }
    art.setFlash(0);
  }
  // ---- 技の名前の帯（セットした技を使ったとき）
  function skillBannerSprite(name, fx) {
    return tsprite('skb:' + name, 196, 34, (g) => {
      g.font = F(800, 14, 'head');
      const tw = Math.min(150, g.measureText(name).width);
      const w = tw + 46, x0 = (196 - w) / 2, h = 24, y0 = 5;
      // 帯
      const bg = g.createLinearGradient(0, y0, 0, y0 + h);
      bg.addColorStop(0, 'rgba(26,38,78,0.94)');
      bg.addColorStop(1, 'rgba(8,12,30,0.94)');
      g.fillStyle = bg;
      g.beginPath(); g.moveTo(x0 + 8, y0); g.lineTo(x0 + w, y0); g.lineTo(x0 + w - 8, y0 + h); g.lineTo(x0, y0 + h); g.closePath(); g.fill();
      g.strokeStyle = '#e0b84e'; g.lineWidth = 1.2; g.stroke();
      // 技の色のしるし
      g.fillStyle = fx.col;
      g.beginPath(); g.moveTo(x0 + 8, y0); g.lineTo(x0 + 26, y0); g.lineTo(x0 + 18, y0 + h); g.lineTo(x0, y0 + h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(10,14,34,0.85)';
      g.font = F(900, 11, 'head');
      g.textAlign = 'center';
      g.fillText('技', x0 + 13, y0 + 16.5);
      // 名前
      g.textAlign = 'left';
      g.font = F(800, 14, 'head');
      g.lineJoin = 'round';
      g.lineWidth = 3; g.strokeStyle = 'rgba(4,8,20,0.9)';
      g.strokeText(name, x0 + 30, y0 + 17.5, 150);
      const tg = g.createLinearGradient(0, y0 + 5, 0, y0 + 20);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.6, '#ffe39a'); tg.addColorStop(1, '#f0b040');
      g.fillStyle = tg;
      g.fillText(name, x0 + 30, y0 + 17.5, 150);
      g.canvas._bw = w; g.canvas._bx = x0;
    });
  }
  // 帯は画面側に描く（カメラが寄っても切れないよう、使い手の足もとの画面位置に合わせて画面内に収める）
  function drawSkillBanners(reel, pl, t, alpha) {
    if (!reel.party.length) return;
    const L = layout(reel), cam = lastCam;
    for (let i = 0; i < reel.party.length; i++) {
      const b = skillBeatOf(pl, i, t);
      if (!b || !b.use) continue;
      const wx = L.px[i] + 6, wy = L.gy + 26;
      const sx = 180 + (wx - cam.x) * cam.z, sy = Hd / 2 + (wy - cam.y) * cam.z;
      drawSkillBanner(b, beatFx(b, reel.party[i]), sx, G.clamp(sy, 120, Hd - safeB - 150), t, alpha);
    }
  }
  function drawSkillBanner(b, fx, x, y, t, alpha) {
    const t0 = b.w0 - 0.04, t1 = b.at + 0.5;
    if (t < t0 || t > t1) return;
    const spr = skillBannerSprite(b.use, fx);
    const inK = G.ease.outBack(G.seg(t, t0, t0 + 0.16));
    const a = G.seg(t, t0, t0 + 0.06) * (1 - G.seg(t, t1 - 0.14, t1)) * alpha;
    const hw = (spr._bw || 150) / 2 + 8;
    const cx = G.clamp(x, hw, 360 - hw);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, y);
    ctx.scale(G.lerp(0.2, 1, Math.min(1.1, inK)), G.lerp(0.6, 1, Math.min(1, inK)));
    ctx.translate(-98, -17);
    ctx.drawImage(spr, 0, 0, 196, 34);
    // 光が走る
    const sk = G.seg(t, t0 + 0.08, t0 + 0.42);
    if (sk > 0 && sk < 1) {
      const bx = spr._bx || 20, bw = spr._bw || 150;
      const sx = bx - 20 + (bw + 40) * sk;
      ctx.beginPath(); ctx.moveTo(bx + 8, 5); ctx.lineTo(bx + bw, 5); ctx.lineTo(bx + bw - 8, 29); ctx.lineTo(bx, 29); ctx.closePath(); ctx.clip();
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(sx, 5); ctx.lineTo(sx + 12, 5); ctx.lineTo(sx + 2, 29); ctx.lineTo(sx - 10, 29); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---- 技のエフェクト本体（drawAttackFx から）
  const SX = { t: 0, d: 0, u: 0, w: 0, lead: 0, W: 0, K: 1, crit: false, col: '', col2: '', rm: false, home: 0, sx: 0, sy: 0, hx: 0, hy: 0, mx: 0, my: 0, top: 0, gy: 0, mh: 0, px: null, n: 1 };
  function skillCtx(reel, pl, b, t, L, K) {
    const p = reel.party[b.who];
    const fx = beatFx(b, p);
    const X = SX;
    X.t = t; X.d = t - b.at; X.u = t - b.s0; X.w = t - b.w0; X.lead = b.lead; X.W = b.s0 - b.w0;
    X.K = K; X.crit = !!b.crit; X.col = fx.col; X.col2 = fx.col2 || '#ffffff'; X.rm = rmNow;
    X.home = L.px[b.who] != null ? L.px[b.who] : L.px[0];
    X.sx = partyX(reel, pl, b.s0, L, b.who) + 18; X.sy = L.gy - 58;
    const m = skillMotion(b, fx, t, X.home, L, MO3);
    X.hx = m.x; X.hy = m.y;
    X.mx = L.mx; X.gy = L.gy; X.mh = L.mh; X.my = L.gy - L.mh * 0.5; X.top = L.gy - L.mh;
    X.px = L.px; X.n = reel.party.length || 1;
    return fx;
  }
  function drawSkillFx(reel, pl, b, t, L, K) {
    if (t < b.w0 - 0.02 || t > b.at + 0.95) return;
    const fx = skillCtx(reel, pl, b, t, L, K);
    const X = SX;
    ctx.save();
    fx.draw(X);
    ctx.restore();
    ctx.save();
    // 動き出しの刃のきらめき
    if (X.u > -0.1 && X.u < 0.06) fxTwinkle(X.hx + 14, L.gy + X.hy - 74, 18 * K * G.bump(G.seg(X.u, -0.1, 0.06)), '#ffffff', 1);
    ctx.restore();
    // 共通：命中の閃光と輪
    burst(L.mx, X.my, X.d, (b.crit ? 1.5 : 1.15) * K, '#fff6c0');
    ring(L.mx, X.my, X.d, 100 * K, fx.col);
  }

  // 擬音
  function drawOno(reel, pl, t, L) {
    pl.beats.forEach((b) => {
      if (!b.ono) return;
      const d = t - b.at;
      const dur = b.kind === 'skill' ? 0.75 : b.use ? 0.62 : b.crit || b.big ? 0.55 : 0.42;
      if (d < 0 || d > dur) return;
      if (b.use && b.w0 != null) {
        // 技の擬音は技の色で大きく
        const fx = beatFx(b, reel.party[b.who]);
        const kk = G.ease.outBack(G.seg(d, 0, 0.12));
        ctx.save();
        ctx.globalAlpha = 1 - G.seg(d, dur * 0.65, dur);
        ctx.translate(L.mx - 60 + b.jx * 10, L.gy - L.mh * 0.66 + b.jy * 10 - d * 16);
        ctx.rotate(-0.16 + b.jx * 0.08);
        ctx.scale(kk * (b.crit ? 1.12 : 1), kk * (b.crit ? 1.12 : 1));
        jagText(b.ono, 0, 0, 26, fx.col, '#1a0e04');
        ctx.restore();
        return;
      }
      let x, y;
      if (b.kind === 'mon') {
        const px = L.px[b.target] != null ? L.px[b.target] : L.px[0];
        x = px + 26 + b.jx * 8; y = L.gy - 112 + b.jy * 6;
      } else { x = L.mx - 58 + b.jx * 10; y = L.gy - L.mh * 0.62 + b.jy * 10; }
      const big = b.kind === 'skill' || b.crit || b.big;
      const kk = G.ease.outBack(G.seg(d, 0, 0.12));
      ctx.save();
      ctx.globalAlpha = 1 - G.seg(d, dur * 0.65, dur);
      ctx.translate(x, y - d * 14);
      ctx.rotate(-0.18 + b.jx * 0.1);
      ctx.scale(kk, kk);
      if (b.kind === 'mon' && b.miss) jagText(b.ono, 0, 0, 15, '#e8f4ff', '#1a2c48');
      else jagText(b.ono, 0, 0, b.kind === 'skill' ? 30 : big ? 24 : 17, b.kind === 'mon' ? '#ffd0c8' : big ? '#fff2b8' : '#ffffff', b.kind === 'mon' ? '#5a0e0a' : '#2a1404');
      ctx.restore();
    });
  }
  function jagText(text, x, y, size, fill, stroke) {
    ctx.font = F(800, size, 'head');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.36;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
  }

  // 集中線（会心・閃き・とどめ）
  function drawSpeedLines(reel, pl, t) {
    if (rmNow) return;
    let a = 0, cx = 266, cy = Hd * 0.45;
    pl.beats.forEach((b) => {
      if (b.use && b.w0 != null) { const d = t - b.at; if (d > -0.08 && d < 0.36) a = Math.max(a, 0.85 * (1 - G.seg(d, 0.05, 0.36))); }
      else if (b.crit && b.kind === 'hit') { const d = t - b.at; if (d > -0.05 && d < 0.25) a = Math.max(a, 1 - G.seg(d, 0, 0.25)); }
      if (b.kind === 'skill') { const d = t - b.at; if (d > -0.15 && d < 0.5) a = Math.max(a, 1 - G.seg(d, 0.1, 0.5)); }
    });
    if (!pl.fail) { const d = t - pl.finishT; if (d > -0.15 && d < 0.6) a = Math.max(a, 1 - G.seg(d, 0.2, 0.6)); }
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * 0.75;
    ctx.fillStyle = '#ffffff';
    const n = 46;
    for (let i = 0; i < n; i++) {
      const h = G.hash(i * 31 + Math.floor(t * 30));
      const ang = (i / n) * TAU + h * 0.1;
      const r0 = 120 + h * 80, r1 = 600;
      const w = 0.012 + h * 0.018;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang - w) * r1, cy + Math.sin(ang - w) * r1);
      ctx.lineTo(cx + Math.cos(ang + w) * r1, cy + Math.sin(ang + w) * r1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 閃きのカットイン
  function drawCutin(reel, pl, t) {
    const b = pl.beats.find((x) => x.kind === 'skill' && t > x.t && t < x.t + 0.95);
    if (!b) return;
    const p = reel.party[b.who];
    if (!p) return;
    const k2 = (t - b.t) / 0.95;
    const inK = G.ease.outCubic(G.seg(k2, 0, 0.16));
    const outK = G.ease.inCubic(G.seg(k2, 0.84, 1));
    const cy = Hd * 0.42;
    ctx.save();
    ctx.fillStyle = `rgba(4,8,20,${0.62 * (1 - outK)})`;
    ctx.fillRect(0, 0, 360, Hd);
    ctx.translate((1 - inK) * -420 + outK * 420, 0);
    const band = [-30, cy - 62, 390, cy - 84, 390, cy + 62, -30, cy + 84];
    ctx.beginPath();
    ctx.moveTo(band[0], band[1]);
    for (let i = 2; i < 8; i += 2) ctx.lineTo(band[i], band[i + 1]);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const cc = D.CLASSES[p.cls].color;
    const g = ctx.createLinearGradient(0, cy - 80, 0, cy + 80);
    g.addColorStop(0, G.shade(cc, -0.55));
    g.addColorStop(0.5, '#101a36');
    g.addColorStop(1, G.shade(cc, -0.65));
    ctx.fillStyle = g;
    ctx.fillRect(-40, cy - 90, 440, 180);
    // 流れる線（技の色まじり）
    const lc = beatFx(b, p).col;
    for (let i = 0; i < 26; i++) {
      const h = G.hash(i * 17);
      const x = ((h * 520 - t * (900 + h * 600)) % 520 + 520) % 520 - 80;
      ctx.globalAlpha = 0.08 + h * (i % 3 ? 0.18 : 0.4);
      ctx.fillStyle = i % 3 ? '#ffecbe' : lc;
      ctx.fillRect(x, cy - 80 + h * 160, 60 + h * 120, 1.5 + h * 2);
    }
    ctx.globalAlpha = 1;
    // 本人
    ctx.save();
    ctx.translate(92, cy + 118);
    ctx.scale(5.4, 5.4);
    art.person(ctx, p.look, { t, state: CLS[p.cls].melee ? 'swing' : p.cls === 'archer' ? 'swing' : 'cast', swing: G.seg(k2, 0.3, 0.55), facing: 1, armed: true, expr: null, noShadow: true });
    ctx.restore();
    ctx.restore();
    // 金の縁
    ctx.strokeStyle = '#e8c35a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(band[0], band[1]); ctx.lineTo(band[2], band[3]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(band[6], band[7]); ctx.lineTo(band[4], band[5]); ctx.stroke();
    // 技名
    const tk = G.ease.outBack(G.seg(k2, 0.12, 0.3));
    ctx.save();
    ctx.translate(250, cy + 6);
    ctx.scale(tk, tk);
    art.bulb(ctx, -62, -40, 7, 0.9, t);
    ctx.font = F(800, 12, 'head');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe39a';
    ctx.fillText(`${p.name}、閃いた！`, -48, -35);
    ctx.textAlign = 'center';
    const size = b.skill.length > 6 ? 24 : 30;
    ctx.font = F(800, size, 'head');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#1a0e04';
    ctx.strokeText(b.skill, 0, 8);
    const tg = ctx.createLinearGradient(0, -14, 0, 12);
    tg.addColorStop(0, '#fffbe8');
    tg.addColorStop(0.55, '#ffd36a');
    tg.addColorStop(1, '#e08a1e');
    ctx.fillStyle = tg;
    ctx.fillText(b.skill, 0, 8);
    ctx.fillStyle = '#e8c35a';
    ctx.fillRect(-70, 18, 140, 1.5);
    ctx.font = F(700, 10, 'num');
    ctx.fillStyle = 'rgba(255,240,200,0.8)';
    ctx.fillText('NEW SKILL', 0, 32);
    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------- 宝箱・戦利品
  function drawChest(reel, pl, t, L) {
    if (pl.fail) {
      if (t > pl.pouchT) {
        const kk = G.ease.outBack(G.seg(t, pl.pouchT, pl.pouchT + 0.3));
        ctx.save();
        ctx.translate(196, L.gy);
        ctx.scale(2 * kk, 2 * kk);
        art.ellipse(ctx, 0, 0, 8, 2, 'rgba(0,0,0,0.25)');
        art.facetPoly(ctx, [-7, 0, 7, 0, 8, -7, 3, -12, -3, -12, -8, -7], '#a08060', 0.15);
        art.poly(ctx, [-3, -12, 3, -12, 4, -14, -4, -14], '#7a5a40');
        ctx.restore();
      }
      return;
    }
    if (t < pl.dropT) return;
    // いまの色（昇格の段階）
    let si = 0;
    pl.stepT.forEach((st, i) => { if (t >= st) si = i; });
    const rank = pl.chestSteps[si];
    const dropK = G.seg(t, pl.dropT, pl.dropT + 0.6);
    const by = dropK < 1 ? -Math.abs(Math.cos(dropK * Math.PI * 2.2)) * (1 - dropK) * 170 : 0;
    const op = G.ease.outBack(G.seg(t, pl.reveal, pl.reveal + 0.3));
    const shaking = t > pl.rollT && t < pl.reveal;
    const shakeC = shaking ? Math.sin(t * 62) * (1.5 + (t - pl.rollT) * 3.5) : 0;
    const hop = shaking ? Math.abs(Math.sin(t * 9)) * 3 : 0;
    const cx = L.cx;
    // オーラ
    const auraA = G.seg(t, pl.dropT + 0.4, pl.rollT) * (rank >= 1 ? 1 : 0.35);
    if (auraA > 0 && t < pl.reveal + 0.2) {
      const col = rank === 4 ? art.rainbow(t, 0, 70) : art.RARITY_COL[rank].glow;
      const rr = 48 + Math.sin(t * 8) * 4 + (shaking ? (t - pl.rollT) * 18 : 0);
      const g = ctx.createRadialGradient(cx, L.gy - 22, 0, cx, L.gy - 22, rr);
      g.addColorStop(0, G.rgba(col.startsWith('#') ? col : '#ffffff', 0.55 * auraA));
      g.addColorStop(1, G.rgba(col.startsWith('#') ? col : '#ffffff', 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, L.gy - 22 - rr, rr * 2, rr * 2);
      // 光の柱
      if (rank >= 2) {
        const pa = auraA * (0.5 + 0.5 * Math.sin(t * 6));
        const pg = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
        pg.addColorStop(0, 'rgba(255,255,255,0)');
        pg.addColorStop(0.5, G.rgba(col.startsWith('#') ? col : '#ffffff', 0.35 * pa));
        pg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = pg;
        ctx.fillRect(cx - 22, L.gy - 400, 44, 400);
      }
    }
    if (t > pl.reveal) drawRays(cx, L.gy - 40, pl.chestRank, reel.tier, t, pl.reveal);
    ctx.save();
    ctx.translate(cx + shakeC, L.gy + by - hop);
    ctx.scale(2.2, 2.2);
    art.ellipse(ctx, 0, hop / 2.2, 18, 3, 'rgba(0,0,0,0.28)');
    art.chestR(ctx, op, rank, t);
    ctx.restore();
  }

  function drawRays(x, y, rank, tier, t, t0) {
    const a = G.seg(t, t0, t0 + 0.35);
    const n = rank >= 4 ? 18 : rank >= 3 ? 16 : 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (rank >= 3 ? 0.8 : 0.35));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      let col;
      if (rank >= 4) col = `hsla(${(i * 360) / n + t * 120},90%,70%,${0.34 * a})`;
      else col = G.rgba(art.RARITY_COL[rank].glow, (rank >= 2 ? 0.34 : 0.22) * a);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.09) * 340, Math.sin(ang - 0.09) * 340);
      ctx.lineTo(Math.cos(ang + 0.09) * 340, Math.sin(ang + 0.09) * 340);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, `rgba(255,244,200,${0.6 * a})`);
    g.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    void tier;
  }

  function drawItemCard(reel, pl, t, L) {
    const it = reel.drop;
    if (!it) return;
    const d = t - pl.itemT;
    const rise = G.ease.outBack(G.seg(d, 0, 0.45));
    const fade = 1 - G.seg(t, pl.end - 0.6, pl.end);
    const rcI = art.RARITY_COL[it.rarity];
    const cx = 236, cy = G.lerp(L.gy - 30, L.gy - 128, rise);
    const w = 168, h = 58;
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.seg(d, 0, 0.15)) * fade;
    ctx.translate(cx, cy);
    const s = 0.4 + rise * 0.6;
    ctx.scale(s, s);
    // 台紙
    art.rrect(ctx, -w / 2, -h / 2, w, h, 10);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(18,26,52,0.94)');
    g.addColorStop(1, 'rgba(8,12,28,0.94)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = it.rarity === 4 ? art.rainbow(t) : rcI.accent;
    ctx.stroke();
    // アイコン
    ctx.save();
    ctx.translate(-w / 2 + 30, 0);
    const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    ig.addColorStop(0, G.rgba(rcI.glow, 0.5));
    ig.addColorStop(1, G.rgba(rcI.glow, 0));
    ctx.fillStyle = ig;
    ctx.fillRect(-26, -26, 52, 52);
    art.itemIcon(ctx, it, 38, t);
    ctx.restore();
    // 文字
    ctx.textAlign = 'left';
    ctx.font = F(900, 13, 'num');
    ctx.fillStyle = it.rarity === 4 ? art.rainbow(t, 0, 72) : rcI.accent;
    ctx.fillText(rcI.name, -w / 2 + 58, -8);
    ctx.font = F(700, 10, 'ui');
    ctx.fillStyle = '#ffe39a';
    ctx.fillText('★'.repeat(it.rarity + 1), -w / 2 + 58 + ctx.measureText(rcI.name).width + 26, -8);
    ctx.font = F(800, 13.5, 'head');
    ctx.fillStyle = '#f6ecd2';
    ctx.fillText(it.name.length > 9 ? it.name.slice(0, 9) + '…' : it.name, -w / 2 + 58, 12);
    ctx.font = F(700, 9, 'ui');
    ctx.fillStyle = 'rgba(246,236,210,0.7)';
    ctx.fillText(it.kind === 'relic' ? '秘宝 ・ ギルド全体に効く' : '装備品 ・ 宝物庫へ', -w / 2 + 58, 25);
    ctx.restore();
    // UR は特別に
    if (it.rarity >= 4 && d < 1.4) {
      const a = G.seg(d, 0.1, 0.3) * (1 - G.seg(d, 1.0, 1.4));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(180, L.gy - 205);
      ctx.scale(1 + (1 - G.seg(d, 0.1, 0.3)) * 0.8, 1 + (1 - G.seg(d, 0.1, 0.3)) * 0.8);
      ctx.font = F(900, 26, 'num');
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1a0a20';
      ctx.strokeText('ULTIMATE!!', 0, 0);
      const ug = ctx.createLinearGradient(-90, 0, 90, 0);
      for (let i = 0; i <= 6; i++) ug.addColorStop(i / 6, `hsl(${i * 60 + t * 160},95%,70%)`);
      ctx.fillStyle = ug;
      ctx.fillText('ULTIMATE!!', 0, 0);
      ctx.restore();
    }
  }

  function drawRecruit(reel, pl, t, L) {
    if (reel.extra !== 'recruit' || !reel.recruit || t < pl.recruitT) return;
    const kk = G.ease.outCubic(G.seg(t, pl.recruitT, pl.recruitT + 0.8));
    ctx.save();
    ctx.translate(392 - kk * 92, L.gy);
    ctx.scale(2.2, 2.2);
    art.person(ctx, reel.recruit.look, { t, state: kk < 1 ? 'walk' : 'stand', phase: t * 9, facing: -1 });
    ctx.restore();
    if (kk >= 1) bubble(300, L.gy - 104, '仲間にしてください！', G.seg(t, pl.recruitT + 0.8, pl.recruitT + 0.95), 1);
  }

  // ---------------------------------------------------------------- 吹き出し
  function drawSpeech(reel, pl, t, L) {
    const act = pl.speech.filter((s) => t >= s.t && t < s.t + s.dur);
    act.forEach((s, j) => {
      if (!reel.party[s.who]) return;
      const x = partyX(reel, pl, t, L, s.who);
      if (x < -30 || x > 390) return;
      const a = G.seg(t, s.t, s.t + 0.12) * (1 - G.seg(t, s.t + s.dur - 0.15, s.t + s.dur));
      bubble(x + 6, L.gy - 104 - j * 30 - (s.who % 2) * 6, s.text, a, G.ease.outBack(G.seg(t, s.t, s.t + 0.18)));
    });
  }
  function bubble(x, y, text, a, pop) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = F(700, 12, 'ui');
    const w = ctx.measureText(text).width + 18;
    const h = 24;
    const bx = G.clamp(x, w / 2 + 6, 354 - w / 2);
    ctx.translate(bx, y);
    ctx.scale(pop, pop);
    const tx = G.clamp(x - bx, -w / 2 + 10, w / 2 - 10);
    ctx.beginPath();
    const r = 11;
    const L0 = -w / 2, T0 = -h - 7, R0 = w / 2, B0 = -7;
    ctx.moveTo(L0 + r, T0);
    ctx.lineTo(R0 - r, T0);
    ctx.quadraticCurveTo(R0, T0, R0, T0 + r);
    ctx.lineTo(R0, B0 - r + 4);
    ctx.quadraticCurveTo(R0, B0, R0 - r, B0);
    ctx.lineTo(tx + 6, B0);
    ctx.lineTo(tx, 2);
    ctx.lineTo(tx - 4, B0);
    ctx.lineTo(L0 + r, B0);
    ctx.quadraticCurveTo(L0, B0, L0, B0 - r + 4);
    ctx.lineTo(L0, T0 + r);
    ctx.quadraticCurveTo(L0, T0, L0 + r, T0);
    ctx.closePath();
    ctx.fillStyle = '#fffcf2';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#18213a';
    ctx.stroke();
    ctx.fillStyle = '#18213a';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, B0 - 7.5);
    ctx.restore();
  }
  function drawMark(x, y, ch, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(a, a);
    art.poly(ctx, [-9, -14, 9, -14, 7, 8, -7, 8], '#ffcf4a');
    art.poly(ctx, [-9, -14, 9, -14, 8.4, -10, -8.4, -10], '#fff0b0');
    ctx.font = F(900, 17, 'ui');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a1404';
    ctx.fillText(ch, 0, 4);
    ctx.restore();
  }

  // ---------------------------------------------------------------- 文字の演出
  function drawTitleCard(reel, area, pl, t) {
    const tIn = G.ease.outBack(G.seg(t, 0.1, 0.45)) * (1 - G.seg(t, pl.encT + 0.4, pl.encT + 0.8));
    if (tIn <= 0.01) return;
    const spr = tsprite('tc:' + reel.id, 360, 76, (g) => {
      g.translate(180, 46);
      g.textAlign = 'center';
      g.font = F(700, 11, 'head');
      const an = area.name;
      const aw = g.measureText(an).width;
      g.fillStyle = 'rgba(240,220,170,0.95)';
      g.fillText(an, 0, -20);
      g.fillStyle = '#d8b25a';
      g.fillRect(-aw / 2 - 44, -24, 34, 1);
      g.fillRect(aw / 2 + 10, -24, 34, 1);
      art.poly(g, [-aw / 2 - 8, -24, -aw / 2 - 5, -27, -aw / 2 - 2, -24, -aw / 2 - 5, -21], '#d8b25a');
      art.poly(g, [aw / 2 + 8, -24, aw / 2 + 5, -27, aw / 2 + 2, -24, aw / 2 + 5, -21], '#d8b25a');
      g.font = F(800, 23, 'head');
      g.lineJoin = 'round';
      g.lineWidth = 6;
      g.strokeStyle = 'rgba(8,12,28,0.7)';
      g.strokeText(reel.quest, 0, 6);
      g.fillStyle = '#fbf3de';
      g.fillText(reel.quest, 0, 6);
      if (reel.boss) {
        g.font = F(900, 10, 'num');
        g.fillStyle = '#ff8a6a';
        g.fillText('FINAL QUEST', 0, 24);
      } else if (reel.abyss) {
        g.font = F(900, 10, 'num');
        g.fillStyle = reel.guardian ? '#ff8ad8' : '#c89bff';
        g.fillText(`DEPTH B${reel.abyss}F${reel.guardian ? ' ・ GUARDIAN' : ''}`, 0, 24);
      }
    });
    ctx.save();
    ctx.globalAlpha = Math.min(1, tIn);
    ctx.drawImage(spr, 0, 132 - 46 - (1 - Math.min(1, tIn)) * 24, 360, 76);
    ctx.restore();
  }

  // 深淵の魔物は、紫がかった色に
  const monColor = (reel) => (reel.abyss ? G.mix(D.MONSTERS[reel.monster].color, reel.guardian ? '#b0306a' : '#5a3a9a', reel.guardian ? 0.42 : 0.38) : D.MONSTERS[reel.monster].color);
  function drawResult(reel, pl, t, L) {
    const a = G.ease.outBack(G.seg(t, pl.resT, pl.resT + 0.25));
    const label = reel.boss ? '竜王討伐！！' : reel.abyss && reel.tier !== 'fail' && reel.guardian ? '守護者撃破！' : reel.abyss && reel.tier !== 'fail' && reel.firstClear && reel.tier === 'ok' ? `B${reel.abyss}F 突破！` : { fail: '撤退…', ok: '依頼達成', great: '大成功！', legend: '伝説級！！' }[reel.tier];
    const y0 = Hd * 0.2;
    // リボン
    ctx.save();
    ctx.translate(180, y0);
    const stamp = 1 + (1 - G.seg(t, pl.resT, pl.resT + 0.14)) * 1.5;
    ctx.scale(stamp * a, stamp * a);
    ctx.rotate(-0.05);
    if (reel.tier !== 'fail') {
      const rw = 120;
      art.poly(ctx, [-rw - 18, -18, -rw, -18, -rw, 14, -rw - 18, 14, -rw - 10, -2], '#7a1e1e');
      art.poly(ctx, [rw + 18, -18, rw, -18, rw, 14, rw + 18, 14, rw + 10, -2], '#7a1e1e');
      const rg = ctx.createLinearGradient(0, -22, 0, 18);
      rg.addColorStop(0, reel.tier === 'legend' ? '#3a1e6a' : '#1e2e5c');
      rg.addColorStop(1, reel.tier === 'legend' ? '#1e0e3a' : '#0e1838');
      art.poly(ctx, [-rw, -22, rw, -22, rw - 6, 18, -rw + 6, 18], rg);
      ctx.strokeStyle = '#e0b84e';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-rw + 2, -19); ctx.lineTo(rw - 2, -19); ctx.moveTo(-rw + 7, 15); ctx.lineTo(rw - 7, 15); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = F(800, reel.tier === 'legend' || reel.boss ? 34 : 30, 'head');
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = reel.tier === 'fail' ? '#1a1e2a' : '#140a02';
    ctx.strokeText(label, 0, 10);
    if (reel.tier === 'legend' || reel.boss) {
      const g = ctx.createLinearGradient(-120, 0, 120, 0);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60 + t * 160},95%,70%)`);
      ctx.fillStyle = g;
    } else if (reel.tier === 'fail') ctx.fillStyle = '#b8bcc8';
    else {
      const g = ctx.createLinearGradient(0, -14, 0, 12);
      g.addColorStop(0, '#fffbe8');
      g.addColorStop(0.55, reel.tier === 'great' ? '#ffd36a' : '#f6e4b0');
      g.addColorStop(1, reel.tier === 'great' ? '#e08a1e' : '#c8a060');
      ctx.fillStyle = g;
    }
    ctx.fillText(label, 0, 10);
    ctx.restore();

    // 報酬
    const cy = y0 + 54;
    // 表示するゴールドは、見届けボーナス込みの額
    const ci0 = claimInfo.get(reel.id);
    const dispGold = ci0 ? ci0.gold : rewatch || reel.claimed ? reel.gold : Math.round(reel.gold * (1.2 + Math.min(0.3, G.state.streak * 0.05) + cheer * 0.01));
    const list = [{ icon: 'coin', v: dispGold }];
    if (reel.mat) list.push({ icon: 'gem', v: reel.mat });
    if (reel.fame) list.push({ icon: 'star', v: reel.fame });
    const w = list.length * 92;
    ctx.save();
    ctx.globalAlpha = G.seg(t, pl.resT + 0.05, pl.resT + 0.25);
    art.rrect(ctx, 180 - w / 2 - 6, cy - 21, w + 12, 42, 12);
    ctx.fillStyle = 'rgba(8,12,28,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,184,78,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    list.forEach((it, i) => {
      const t0 = pl.resT + 0.2 + i * 0.18;
      const kk = G.ease.outBack(G.seg(t, t0, t0 + 0.25));
      if (kk <= 0) return;
      const x = 180 - w / 2 + 46 + i * 92;
      ctx.save();
      ctx.translate(x, cy);
      ctx.scale(kk, kk);
      if (it.icon === 'coin') art.coin(ctx, -26, 0, 9, t);
      else if (it.icon === 'gem') art.gem(ctx, -26, 0, 10);
      else art.fameStar(ctx, -26, 0, 10);
      const cnt = Math.round(it.v * G.ease.outCubic(G.seg(t, t0, t0 + 0.55)));
      ctx.font = F(800, 16, 'num');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbf3de';
      ctx.fillText('+' + G.fmt(cnt), -12, 6);
      ctx.restore();
    });
    // 付記
    const notes = [];
    const ci = claimInfo.get(reel.id);
    if (!rewatch && ci && ci.seen) notes.push({ text: `見届けボーナス +20%${ci.streakB > 0 ? ` ・ 連続${ci.streak}本 +${Math.round(ci.streakB * 100)}%` : ''}${ci.cheer > 0 ? ` ・ 応援×${ci.cheer}` : ''}`, col: '#ffe27a' });
    else if (!rewatch && !ci && !reel.claimed) notes.push({ text: '見届けボーナス +20% 込み', col: '#ffe27a' });
    if (reel.skill) notes.push({ text: `${reel.party.find((p) => p.id === reel.skill.id)?.name || ''}が「${reel.skill.name}」を習得`, col: '#ffd36a' });
    if (reel.extra === 'cache') notes.push({ text: '隠し財宝を見つけた！ 素材ボーナス', col: '#c9c0ff' });
    if (reel.goldBoost) notes.unshift({ text: `黄金の祝福 ゴールド×${reel.goldBoost}`, col: '#ffd36a' });
    notes.forEach((nt, i) => {
      ctx.save();
      ctx.globalAlpha = G.seg(t, pl.resT + 0.5 + i * 0.15, pl.resT + 0.7 + i * 0.15);
      ctx.font = F(700, 11, 'ui');
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8,12,28,0.8)';
      ctx.strokeText(nt.text, 180, cy + 36 + i * 16);
      ctx.fillStyle = nt.col;
      ctx.fillText(nt.text, 180, cy + 36 + i * 16);
      ctx.restore();
    });
    // おまけ（魔晶石・持ち物）
    const loot = reel.loot || [];
    if (loot.length) {
      const t0 = pl.resT + 0.45;
      const lw = loot.length * 64;
      const ly = cy + 36 + notes.length * 16 + 14;
      ctx.save();
      ctx.globalAlpha = G.seg(t, t0, t0 + 0.2);
      ctx.font = F(700, 9.5, 'ui');
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(246,236,210,0.7)';
      ctx.fillText('おまけ', 180, ly - 14);
      ctx.restore();
      loot.forEach((l, i) => {
        const kk = G.ease.outBack(G.seg(t, t0 + i * 0.1, t0 + 0.25 + i * 0.1));
        if (kk <= 0) return;
        const x = 180 - lw / 2 + 32 + i * 64;
        ctx.save();
        ctx.translate(x - 12, ly);
        ctx.scale(kk, kk);
        art.consIcon(ctx, l.id, 22, t);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = Math.min(1, kk);
        ctx.font = F(800, 12, 'num');
        ctx.textAlign = 'left';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(8,12,28,0.85)';
        ctx.strokeText('×' + l.n, x + 2, ly + 4);
        ctx.fillStyle = '#fbf3de';
        ctx.fillText('×' + l.n, x + 2, ly + 4);
        ctx.restore();
      });
    }
    // 伝説級の虹枠
    if (reel.tier === 'legend') {
      ctx.save();
      ctx.lineWidth = 5;
      const g2 = ctx.createLinearGradient(0, 0, 360, Hd);
      for (let i = 0; i <= 6; i++) g2.addColorStop(i / 6, `hsla(${i * 60 + t * 120},95%,65%,0.85)`);
      ctx.strokeStyle = g2;
      ctx.strokeRect(2.5, 2.5, 355, Hd - 5);
      ctx.restore();
    }
    void L;
  }

  // ---------------------------------------------------------------- 流れるコメント・ティッカー
  function drawDanmaku(reel, t, alpha) {
    if (alpha <= 0.02 || G.state.settings.danmaku === false || reel.digest) return;
    const dm = danmakuOf(reel);
    const pl = planOf(reel);
    alpha *= 1 - 0.75 * G.seg(t, pl.resT, pl.resT + 0.3);
    const font = F(800, 13, 'ui');
    ctx.save();
    dm.forEach((d) => {
      const dur = 4.2 / d.speed;
      const kk = (t - d.t) / dur;
      if (kk < 0 || kk > 1) return;
      const w = textW(font, d.text);
      const x = 372 - kk * (372 + w + 20);
      const y = 172 + (d.lane % 4) * 20;
      const spr = tsprite('dm:' + (d.gold ? 'g' : 'w') + d.text, w + 8, 22, (g) => {
        g.font = font;
        g.textAlign = 'left';
        g.lineJoin = 'round';
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(4,8,18,0.7)';
        g.strokeText(d.text, 4, 16);
        g.fillStyle = d.gold ? '#ffe08a' : '#ffffff';
        g.fillText(d.text, 4, 16);
      });
      ctx.globalAlpha = alpha * 0.82;
      ctx.drawImage(spr, x - 4, y - 16, spr._w, spr._h);
    });
    ctx.restore();
  }

  function tickerRows(reel, t) {
    if (!reel.cm) return [];
    return arrivedFlat(reel, t).slice(-3);
  }
  function drawTicker(reel, t, bottom, alpha) {
    const rows = tickerRows(reel, t);
    if (!rows.length) return;
    const newest = rows[rows.length - 1];
    const shift = 1 - G.ease.outCubic(G.clamp((t - newest.t) / 0.22, 0, 1));
    const base = bottom - 128;
    rows.forEach((e, i) => {
      const slot = rows.length - 1 - i;
      const y = base - (slot - shift) * 24;
      const age = t - e.t;
      const inK = G.clamp(age / 0.22, 0, 1);
      const fadeOld = slot === 2 ? 0.45 * (1 - shift) + 0.0 : slot === 1 ? 0.78 : 1;
      const a = alpha * fadeOld * inK;
      if (a <= 0.02) return;
      const x0 = 12 - (1 - G.ease.outBack(inK)) * 24;
      const spr = tickerSprite(reel, e);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x0, y - 10, spr._w, spr._h);
      ctx.restore();
    });
  }
  function tickerSprite(reel, e) {
    const au = authorOf(e.c.a, reel);
    const fN = F(800, 10.5, 'ui'), fT = F(500, 11, 'ui');
    const nm = (e.parent ? '↳ ' : '') + au.name;
    const nw = textW(fN, nm);
    let text = e.c.text;
    const maxT = 262 - nw - 40;
    while (textW(fT, text) > maxT && text.length > 2) text = text.slice(0, -2) + '…';
    const tw = textW(fT, text);
    const w = 34 + nw + 8 + tw + 12;
    return tsprite('tk:' + reel.id + ':' + e.key, w + 2, 22, (g) => {
      art.rrect(g, 0, 0, w, 21, 10.5);
      g.fillStyle = e.c.gift ? 'rgba(90,60,10,0.62)' : e.c.a === 'master' ? 'rgba(40,60,110,0.62)' : 'rgba(6,10,22,0.5)';
      g.fill();
      if (e.c.gift) { g.strokeStyle = 'rgba(255,214,110,0.8)'; g.lineWidth = 1; g.stroke(); }
      const av = avatarCanvas(au, 36);
      g.save();
      g.beginPath(); g.arc(12, 10.5, 8.5, 0, TAU); g.clip();
      g.drawImage(av, 3.5, 2, 17, 17);
      g.restore();
      g.textAlign = 'left';
      g.font = fN;
      g.fillStyle = nameColor(au);
      g.fillText(nm, 26, 14);
      g.font = fT;
      g.fillStyle = '#ffffff';
      g.fillText(text, 26 + nw + 7, 14);
    });
  }

  // 下部のキャプション・右のボタン（動画と一緒に流れる）
  function drawOverlay(reel, t, cur, pl, alpha) {
    if (alpha <= 0.01) return;
    const bottom = Hd - safeB;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gk = 'ovg|' + bottom.toFixed(1) + '|' + Hd.toFixed(1);
    let gr = skyGrad.get(gk);
    if (!gr) {
      const g = ctx.createLinearGradient(0, bottom - 220, 0, Hd);
      g.addColorStop(0, 'rgba(4,8,18,0)');
      g.addColorStop(1, 'rgba(4,8,18,0.7)');
      const tg = ctx.createLinearGradient(0, 0, 0, 120);
      tg.addColorStop(0, 'rgba(4,8,18,0.5)');
      tg.addColorStop(1, 'rgba(4,8,18,0)');
      gr = [g, tg];
      skyGrad.set(gk, gr);
    }
    ctx.fillStyle = gr[0];
    ctx.fillRect(0, bottom - 220, 360, 220 + safeB);
    ctx.fillStyle = gr[1];
    ctx.fillRect(0, 0, 360, 120);
    ctx.restore();

    if (!reel.digest) drawTicker(reel, t, bottom, alpha);
    if (!reel.digest && pl) drawSkillBanners(reel, pl, t, alpha);
    if (!reel.digest && pl) drawRegularPop(reel, pl, t, alpha);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'left';
    const lead = reel.party[0];
    const ov = overlaySprite(reel);
    ctx.drawImage(ov, 0, bottom - 118, ov._w, ov._h);
    if (pl && t > pl.resT + 0.4 && TIER_TAG[reel.tier]) {
      ctx.font = F(700, 12, 'ui');
      ctx.globalAlpha = alpha * G.seg(t, pl.resT + 0.4, pl.resT + 0.7);
      ctx.fillStyle = '#ffd36a';
      ctx.fillText(TIER_TAG[reel.tier], 16 + ov._tagW, bottom - 118 + ov._tagY);
      ctx.globalAlpha = alpha;
    }
    // 音楽のマーキー
    ctx.save();
    ctx.beginPath();
    ctx.rect(34, bottom - 46, 200, 18);
    ctx.clip();
    ctx.font = F(500, 11, 'ui');
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const song = songOf(reel);
    const sw = textW(ctx.font, song) + 40;
    const mx = 34 - ((t * 28) % sw);
    ctx.fillText(song, mx, bottom - 33);
    ctx.fillText(song, mx + sw, bottom - 33);
    ctx.restore();
    ctx.font = F(700, 12, 'ui');
    ctx.fillStyle = '#fff';
    ctx.fillText('♪', 18, bottom - 33);

    // 右の列
    const rx = 326;
    if (lead) {
      const ay = bottom - 316;
      ctx.save();
      ctx.beginPath(); ctx.arc(rx, ay, 23, 0, TAU);
      const rg = ctx.createLinearGradient(rx, ay - 23, rx, ay + 23);
      rg.addColorStop(0, '#ffe39a'); rg.addColorStop(1, '#b8862a');
      ctx.fillStyle = rg; ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ay, 20.5, 0, TAU); ctx.clip();
      ctx.fillStyle = G.shade(D.CLASSES[lead.cls].color, -0.3);
      ctx.fillRect(rx - 22, ay - 22, 44, 44);
      ctx.translate(rx - 2, ay + 46);
      ctx.scale(1.55, 1.55);
      art.person(ctx, lead.look, { t: 0.5, state: 'stand', facing: 1, noShadow: true });
      ctx.restore();
      art.ellipse(ctx, rx, ay + 23, 8, 8, '#ff4f6d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx - 4, ay + 22, 8, 2);
      ctx.fillRect(rx - 1, ay + 19, 2, 8);
    }
    const prog = pl ? G.clamp(t / pl.end, 0, 1) : 1;
    const ease = G.ease.outCubic(prog);
    // いいね（見ている間にも増えていく）
    const ly = bottom - 250;
    art.heart(ctx, rx, ly - 4, 17, reel.liked ? '#ff4f6d' : '#f4f0f0');
    ctx.font = F(800, 11, 'num');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(G.fmt(Math.round(reel.likes * (0.25 + 0.75 * ease)) + (reel.liked ? 1 : 0)), rx, ly + 24);
    // コメント（届くたびに +1）
    const cy = bottom - 185;
    const bump = cur ? G.bump(G.clamp(cmBumpT / 0.3, 0, 1)) : 0;
    ctx.save();
    ctx.translate(rx, cy - 4);
    ctx.scale(1 + bump * 0.22, 1 + bump * 0.22);
    art.rrect(ctx, -15, -12, 30, 24, 10);
    ctx.fillStyle = '#f4f0f0';
    ctx.fill();
    art.poly(ctx, [-6, 11, 2, 11, -8, 18], '#f4f0f0');
    ctx.fillStyle = '#3a3048';
    [-7, 0, 7].forEach((d) => { ctx.beginPath(); ctx.arc(d, 0, 2, 0, TAU); ctx.fill(); });
    ctx.restore();
    const nC = cur ? arrivedCount(reel, t) : totalCount(reel);
    ctx.fillStyle = '#fff';
    ctx.fillText(G.fmt(nC), rx, cy + 28);
    if (cur && cmBumpT < 0.9 && cmBumpN > 0) {
      const kk = cmBumpT / 0.9;
      ctx.save();
      ctx.globalAlpha = alpha * (1 - G.seg(kk, 0.55, 1));
      ctx.font = F(900, 12, 'num');
      ctx.fillStyle = '#ffd36a';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8,12,28,0.8)';
      const yy = cy - 22 - G.ease.outCubic(kk) * 18;
      ctx.strokeText('+' + cmBumpN, rx + 18, yy);
      ctx.fillText('+' + cmBumpN, rx + 18, yy);
      ctx.restore();
    }
    // 再生数
    ctx.font = F(700, 10, 'num');
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(`▶ ${G.fmt(Math.round(reel.views * (0.3 + 0.7 * ease)))}`, rx, bottom - 128);
    // 回るレコード
    const ry = bottom - 38;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(t * 1.8);
    art.facet(ctx, 0, 0, 17, 17, 12, '#1a2238', 0, 0.12);
    art.facet(ctx, 0, 0, 7, 7, 8, '#c8902a', 0, 0.2);
    art.star(ctx, 0, 0, 4, '#fff0b0');
    ctx.restore();
    // 進行バー
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, Hd - 3, 360, 3);
    ctx.fillStyle = '#e0b84e';
    ctx.fillRect(0, Hd - 3, 360 * prog, 3);
    ctx.restore();
  }

  // ---------------------------------------------------------------- 常連のSNS通知（左上のカード）
  // 町の常連の書き込みが届くと、スマホを手にした顔とひとことが左上にポンと出る。
  // 1度に1枚、1本につき最大3枚。会心・閃き・とどめなど大事な場面への書き込みを優先する
  const POP_DUR = 2.6;
  const POP_PRI = { flash: 3.2, crit: 3, finish: 3, legend: 2.2, drop: 2, great: 2, hurt: 1.6, fail: 1.5, level: 1.4, event: 1.2, next: 1.1, any: 1 };
  const NO_POPS = [];
  const popCache = new Map();
  function regularOf(a) {
    if (typeof a !== 'string' || a.slice(0, 2) !== 'p:' || !G.comments || !G.comments.PERSONAS) return null;
    const id = a.slice(2);
    return G.comments.PERSONAS[id] ? id : null;
  }
  function popsOf(reel) {
    if (!reel || reel.digest || !reel.cm || !reel.cm.length) return NO_POPS;
    const n = reel.cm.length;
    const e = popCache.get(reel.id);
    if (e && e.n === n && e.hd === Hd) return e.list;
    const pl = planOf(reel);
    const cands = [];
    reel.cm.forEach((c) => {
      if (regularOf(c.a)) cands.push({ c, t: c.t, key: c.id, pri: c.gift ? 2.6 : POP_PRI[c.topic] || 1 });
      (c.replies || []).forEach((r, j) => { if (regularOf(r.a)) cands.push({ c: r, t: r.t, key: c.id + ':' + j, pri: 0.8 }); });
    });
    // 大事な場面のものから順に、空いている時間へ入れる（1度に1枚・最大3枚・遅れすぎたものは出さない）
    cands.sort((a, b) => b.pri - a.pri || a.t - b.t);
    const list = [];
    const first = pl.encT + 0.85; // 題名のカードが消えてから
    const last = popHitsResult() ? pl.resT - 1.1 : pl.end - 0.9; // 結果の帯と重なる画面では結果の前に
    const gap = POP_DUR + 0.15;
    for (let ci = 0; ci < cands.length && list.length < 3; ci++) {
      const p = cands[ci];
      let t0 = Math.max(p.t, first);
      for (let guard = 0; guard < 4; guard++) {
        const hit = list.find((q) => t0 > q.t0 - gap && t0 < q.t0 + gap);
        if (!hit) break;
        t0 = hit.t0 + gap;
      }
      if (t0 > last || t0 - p.t > 3 || list.some((q) => Math.abs(t0 - q.t0) < gap - 0.001)) continue;
      list.push({ c: p.c, key: p.key, id: regularOf(p.c.a), t0 });
    }
    list.sort((a, b) => a.t0 - b.t0);
    if (popCache.size > 60) popCache.clear();
    popCache.set(reel.id, { n, hd: Hd, list });
    return list;
  }
  // 通知カードの下端が、結果の帯（左端は少し下がっている）に届く小さな画面か
  const popHitsResult = () => popY + 56 > Hd * 0.2 - 18;
  // 丸い顔（頭と肩）。猫のミケは猫の顔
  function popFaceSprite(id) {
    return tsprite('pf:' + id, 52, 52, (g) => {
      const P = G.comments.PERSONAS[id];
      const cx = 26, cy = 26, r = 22;
      const bc = P.look ? P.look.outfit || '#4a5a8a' : '#c89a5a';
      const bg = g.createLinearGradient(0, 4, 0, 48);
      bg.addColorStop(0, G.shade(bc, 0.35));
      bg.addColorStop(1, G.shade(bc, -0.5));
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, TAU);
      g.fillStyle = bg; g.fill();
      g.clip();
      g.fillStyle = 'rgba(255,240,200,0.18)';
      g.beginPath(); g.arc(cx - 6, cy - 8, 14, 0, TAU); g.fill();
      if (P.look) {
        g.translate(cx - 4, cy - 1 + 27.6 * 2.15);
        g.scale(2.15, 2.15);
        art.person(g, P.look, { t: 0.4, state: 'write', facing: 1, armed: false, expr: 'happy', noShadow: true });
      } else {
        g.drawImage(art.catCanvas(64), cx - r, cy - r, r * 2, r * 2);
      }
      g.restore();
      const rg = g.createLinearGradient(0, 2, 0, 50);
      rg.addColorStop(0, '#fff0b8'); rg.addColorStop(1, '#b8862a');
      g.strokeStyle = rg; g.lineWidth = 2.4;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    });
  }
  // 名前・ひとことの札（1枚ごとに1度だけ描く）
  function popCardSprite(reel, pop) {
    return tsprite('pc:' + reel.id + ':' + pop.key, 240, 58, (g) => {
      const P = G.comments.PERSONAS[pop.id];
      const x0 = 20, w = 216, y0 = 3, h = 51, tx = 54;
      const bg = g.createLinearGradient(0, y0, 0, y0 + h);
      bg.addColorStop(0, 'rgba(30,44,88,0.95)');
      bg.addColorStop(1, 'rgba(10,14,34,0.95)');
      art.rrect(g, x0, y0, w, h, 12);
      g.fillStyle = bg; g.fill();
      g.strokeStyle = pop.c.gift ? '#ffd36a' : 'rgba(224,184,78,0.85)';
      g.lineWidth = pop.c.gift ? 1.6 : 1.1;
      g.stroke();
      g.textAlign = 'left';
      g.font = F(800, 10.5, 'ui');
      g.fillStyle = P.rival ? '#ff9a80' : '#ffe39a';
      g.fillText(P.name, tx, 17.5);
      const nw = g.measureText(P.name).width;
      const badge = P.rival ? '黒鉄団' : '常連';
      g.font = F(800, 8, 'ui');
      const bw = g.measureText(badge).width + 9;
      art.rrect(g, tx + nw + 5, 8.5, bw, 11.5, 5.75);
      g.fillStyle = P.rival ? 'rgba(255,120,90,0.25)' : 'rgba(224,184,78,0.26)';
      g.fill();
      g.fillStyle = P.rival ? '#ffb8a0' : '#ffe39a';
      g.fillText(badge, tx + nw + 9.5, 17.2);
      g.font = F(600, 8.5, 'ui');
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillText('たった今', x0 + w - 10, 17.5);
      g.textAlign = 'left';
      g.font = F(600, 11.5, 'ui');
      g.fillStyle = pop.c.gift ? '#ffe08a' : '#fbf3de';
      let lines = wrap(pop.c.text, x0 + w - tx - 10);
      if (lines.length > 2) lines = [lines[0], lines[1].slice(0, -1) + '…'];
      const ly = lines.length === 1 ? 37 : 33;
      lines.forEach((ln, i) => g.fillText(ln, tx, ly + i * 14.5));
    });
  }
  // 手に持ったスマホ（画面が光る）
  function drawPopPhone(id, t, age, a) {
    const P = G.comments.PERSONAS[id];
    const skin = P.look ? P.look.skin || '#f2c6a0' : '#f4e4d0';
    ctx.save();
    ctx.translate(16, 12);
    ctx.rotate(-0.26 + Math.sin(t * 3) * 0.03);
    const pulse = 0.75 + 0.25 * Math.sin(t * 9);
    fxCircle(0, -1, 14, '#9fe0ff', a * 0.22 * pulse);
    ctx.globalAlpha = a;
    art.rrect(ctx, -6, -10, 12, 19, 2.6);
    ctx.fillStyle = '#1c2234'; ctx.fill();
    ctx.strokeStyle = '#8a94b8'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.globalAlpha = a * (0.8 + 0.2 * pulse);
    ctx.fillStyle = '#c8eeff';
    ctx.fillRect(-4.6, -8, 9.2, 14.6);
    ctx.globalAlpha = a;
    art.heart(ctx, 0, -3.2, 3 * G.ease.outBack(G.seg(age, 0.2, 0.4)), '#ff5a7a');
    ctx.fillStyle = 'rgba(40,60,100,0.55)';
    ctx.fillRect(-3.4, 1.4, 6.8, 1.2); ctx.fillRect(-3.4, 3.6, 4.6, 1.2);
    // 通知の電波
    if (age < 1.1) {
      const k2 = (age * 2.2) % 1;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      for (let j = 0; j < 2; j++) {
        const kk = (k2 + j * 0.5) % 1;
        ctx.globalAlpha = a * (1 - kk) * (1 - G.seg(age, 0.8, 1.1));
        ctx.beginPath(); ctx.arc(5, -10, 4 + kk * 8, -1.4, 0.1); ctx.stroke();
      }
    }
    // 手（指で持つ）
    ctx.globalAlpha = a;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(-1, 8.6, 5.4, 3.6, 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.4, 2.4, 1.7, 3.2, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = G.shade(skin, -0.18);
    ctx.fillRect(-5.2, 6.4, 7.6, 0.8);
    ctx.restore();
  }
  function drawRegularPop(reel, pl, t, alpha) {
    const pops = popsOf(reel);
    if (!pops.length) return;
    let pop = null;
    for (let j = 0; j < pops.length; j++) if (t >= pops[j].t0 && t < pops[j].t0 + POP_DUR) { pop = pops[j]; break; }
    if (!pop) return;
    const age = t - pop.t0;
    let out = G.seg(age, POP_DUR - 0.35, POP_DUR);
    // 小さな画面で結果の帯と重なるときは、結果が出る前にしまう
    if (popHitsResult()) out = Math.max(out, G.seg(t, pl.resT - 0.2, pl.resT + 0.05));
    if (out >= 1) return;
    const rm = rmNow;
    const a = alpha * G.seg(age, 0, 0.08) * (1 - out);
    if (a <= 0.01) return;
    const pcx = 34, pcy = popY + 29;
    ctx.save();
    ctx.translate(0, -out * 12);
    // 後ろの光の筋（技を覚えたときのような）
    if (!rm && age < 0.95) {
      const k2 = G.seg(age, 0, 0.95);
      ctx.save();
      ctx.translate(pcx, pcy);
      ctx.rotate(age * 1.6);
      ctx.globalAlpha = a * 0.5 * (1 - k2) * G.seg(age, 0, 0.12);
      ctx.fillStyle = '#ffe39a';
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const an = (j / 10) * TAU, r2 = 40 + 26 * G.ease.outCubic(k2);
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an - 0.11) * r2, Math.sin(an - 0.11) * r2); ctx.lineTo(Math.cos(an + 0.11) * r2, Math.sin(an + 0.11) * r2);
      }
      ctx.fill();
      ctx.restore();
    }
    // 札（顔の後ろから右へ伸びる）
    const wk = rm ? 1 : G.ease.outCubic(G.seg(age, 0.1, 0.36));
    if (wk > 0) {
      const spr = popCardSprite(reel, pop);
      ctx.save();
      ctx.globalAlpha = a * Math.min(1, wk * 1.6);
      ctx.beginPath(); ctx.rect(pcx, popY - 4, (spr._w - 20) * wk + 2, 66); ctx.clip();
      ctx.drawImage(spr, 10 - (1 - wk) * 26, popY + 1, spr._w, spr._h);
      const sk = G.seg(age, 0.38, 0.82);
      if (!rm && sk > 0 && sk < 1) {
        const sx = 40 + 220 * sk;
        ctx.globalAlpha = a * 0.22 * G.bump(sk);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(sx, popY + 4); ctx.lineTo(sx + 16, popY + 4); ctx.lineTo(sx - 2, popY + 55); ctx.lineTo(sx - 18, popY + 55); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // 輪ときらめき
    if (!rm) {
      const k3 = G.seg(age, 0.04, 0.6);
      if (k3 > 0 && k3 < 1) fxRing(pcx, pcy, 23 + 30 * G.ease.outCubic(k3), 4 * (1 - k3) + 0.5, '#ffe39a', a * (1 - k3), 1);
      const k4 = G.seg(age, 0.06, 0.75);
      if (k4 > 0 && k4 < 1) {
        for (let j = 0; j < 10; j++) {
          const an = (j / 10) * TAU + 0.3, r2 = 26 + 34 * G.ease.outCubic(k4);
          fxTwinkle(pcx + Math.cos(an) * r2, pcy + Math.sin(an) * r2, 6 * (1 - k4) + 1.5, j % 2 ? '#ffffff' : '#ffe39a', a * (1 - k4));
        }
      }
    }
    // 顔（ポンと弾む）とスマホ
    const ps = rm ? 1 : G.ease.outBack(G.seg(age, 0, 0.3));
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.scale(ps, ps);
    ctx.globalAlpha = a;
    ctx.drawImage(popFaceSprite(pop.id), -26, -26, 52, 52);
    drawPopPhone(pop.id, t, age, a);
    ctx.restore();
    // ハートがぴこん
    if (age > 0.26 && age < 1.5) {
      const k5 = G.seg(age, 0.26, 1.5), sc = rm ? 1 : G.ease.outBack(G.seg(age, 0.26, 0.42));
      ctx.save();
      ctx.globalAlpha = a * (1 - G.seg(age, 1.1, 1.5));
      art.heart(ctx, pcx + 18, pcy - 21 - G.ease.outCubic(k5) * (rm ? 0 : 12), 6.5 * sc, '#ff4f6d');
      ctx.restore();
    }
    ctx.restore();
  }

  // 名前・職業・キャプション・タグ（冒険譚ごとに1度だけ描く）
  function overlaySprite(reel) {
    return tsprite('ov:' + reel.id, 300, 82, (g) => {
      g.textAlign = 'left';
      const lead = reel.party[0];
      const handle = reel.digest ? '@受付のリナ' : `@${lead ? lead.name : '???'}${reel.party.length > 1 ? ` ほか${reel.party.length - 1}名` : ''}`;
      g.font = F(900, 14, 'ui');
      g.fillStyle = '#ffffff';
      g.fillText(handle, 16, 18);
      if (lead) {
        const hw = g.measureText(handle).width;
        const badge = `${D.CLASSES[lead.cls].name} Lv${lead.lv}`;
        g.font = F(700, 9.5, 'ui');
        const bw = g.measureText(badge).width + 12;
        art.rrect(g, 22 + hw, 7, bw, 15, 7.5);
        g.fillStyle = 'rgba(224,184,78,0.22)';
        g.fill();
        g.fillStyle = '#ffe39a';
        g.fillText(badge, 28 + hw, 17.5);
      }
      g.font = F(500, 13, 'ui');
      g.fillStyle = '#fbf3de';
      const lines = wrap(reel.caption, 262);
      lines.slice(0, 2).forEach((ln, i) => g.fillText(ln, 16, 39 + i * 18));
      g.font = F(700, 12, 'ui');
      g.fillStyle = '#a8d8ff';
      const tags = reel.tags.join(' ');
      const ty = 39 + Math.min(2, lines.length) * 18;
      g.fillText(tags, 16, ty);
      g.canvas._tagW = g.measureText(tags + ' ').width;
      g.canvas._tagY = ty;
    });
  }

  const wrapCache = new Map();
  function wrap(text, maxW) {
    const key = text + '|' + maxW + '|' + ctx.font;
    if (wrapCache.has(key)) return wrapCache.get(key);
    const out = [];
    let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = ch; } else line = test;
    }
    if (line) out.push(line);
    if (wrapCache.size > 300) wrapCache.clear();
    wrapCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- 文字の描き置き
  // 毎フレーム同じ文字（流れるコメント・コメントの行・キャプション・タイトル）は1度だけ描く
  const sprites = new Map();
  function tsprite(key, w, h, draw) {
    const sc = dpr * k;
    const k2 = key + '@' + sc.toFixed(2);
    let c = sprites.get(k2);
    if (!c) {
      c = offscreen(w, h, sc, draw);
      c._w = w; c._h = h;
      if (sprites.size > 500) sprites.clear();
      sprites.set(k2, c);
    }
    return c;
  }
  const twCache = new Map();
  function textW(font, text) {
    const key = font + '|' + text;
    let v = twCache.get(key);
    if (v == null) {
      const f = ctx.font;
      ctx.font = font;
      v = ctx.measureText(text).width;
      ctx.font = f;
      if (twCache.size > 2000) twCache.clear();
      twCache.set(key, v);
    }
    return v;
  }

  // ---------------------------------------------------------------- 背景
  // 動かない地形（遠景・中景・地面）は冒険譚ごとに1度だけ描いて使い回す。
  // 空・太陽・雲・木漏れ日・霧・光る結晶・舞う粒・木の揺れは、これまでどおり毎フレーム描く。
  const bgCache = new Map();
  const treeCache = new Map();
  const skyGrad = new Map();
  let bgScale = 2;
  function offscreen(w, h, sc, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * sc));
    c.height = Math.max(1, Math.ceil(h * sc));
    const g = c.getContext('2d');
    g.scale(sc, sc);
    const saved = ctx;
    ctx = g;
    try { draw(g); } finally { ctx = saved; }
    return c;
  }
  // key ごとの地形の絵（ワールド座標 x:-20〜380, y:-20〜Hd+20）
  function bgLayer(key, cacheable, draw) {
    if (!cacheable) { draw(); return; }
    const k2 = key + '|' + Hd.toFixed(1) + '|' + bgScale.toFixed(2);
    let c = bgCache.get(k2);
    if (!c) {
      c = offscreen(400, Hd + 40, bgScale, (g) => { g.translate(20, 20); draw(); });
      if (bgCache.size > 10) bgCache.clear();
      bgCache.set(k2, c);
    }
    ctx.drawImage(c, -20, -20, 400, Hd + 40);
  }
  function skyFill(area, gy) {
    const key = area.id + '|' + gy.toFixed(1);
    let g = skyGrad.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, area.pal.sky1);
      g.addColorStop(1, area.pal.sky2);
      if (skyGrad.size > 20) skyGrad.clear();
      skyGrad.set(key, g);
    }
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, 400, gy + 22);
  }
  function drawBg(area, scroll, t, gy, cacheable) {
    const p = area.pal;
    const id = area.id;
    const sk = id + ':' + Math.round(scroll);
    skyFill(area, gy);
    if (G.reelfx) G.reelfx.drawSky(ctx, area, scroll, t, gy); // 遠景の山より奥の空の演出
    const layer = (col, amp, base, n, par, seed, jag) => {
      const span = 400 / n;
      const sh = scroll * par;
      const i0 = Math.floor(sh / span);
      const off = -(sh - i0 * span);
      const pts = [-60, gy + 2];
      for (let i = -1; i <= n + 2; i++) {
        const x = off + i * span;
        const h = G.hash(seed + i + i0) * amp;
        pts.push(x, base - h - (jag && (i + i0) % 2 ? amp * 0.3 : 0));
      }
      pts.push(440, gy + 2);
      art.facetPoly(ctx, pts, col, 0.06);
    };
    const ground = () => {
      art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, Hd + 20, -20, Hd + 20], p.ground);
      art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, gy + 3, -20, gy + 3], G.shade(p.ground, 0.12));
      const gg = ctx.createLinearGradient(0, gy, 0, Hd);
      gg.addColorStop(0, 'rgba(0,0,0,0)');
      gg.addColorStop(1, 'rgba(4,8,18,0.35)');
      ctx.fillStyle = gg;
      ctx.fillRect(-20, gy, 400, Hd - gy + 20);
      for (let i = 0; i < 18; i++) {
        const x = ((i * 31 - scroll) % 420 + 420) % 420 - 30;
        const y = gy + 14 + G.hash(i * 5) * (Hd - gy - 40);
        art.facet(ctx, x, y, 4 + G.hash(i) * 5, 2 + G.hash(i) * 2, 5, G.shade(p.ground, -0.12), i, 0.14);
      }
    };
    if (id === 'meadow') {
      art.facet(ctx, 290, 90, 24, 24, 10, '#fff2b0', t * 0.1, 0.1);
      cloudR(((60 - t * 6 - scroll * 0.1) % 460 + 460) % 460 - 50, 120, 50);
      cloudR(((240 - t * 4 - scroll * 0.1) % 460 + 460) % 460 - 50, 70, 36);
      bgLayer(sk + 'A', cacheable, () => { layer(p.far, 60, gy - 70, 6, 0.15, 11, false); layer(p.mid, 40, gy - 24, 8, 0.4, 23, false); ground(); });
      treesR(area, scroll, gy, 'round', t);
    } else if (id === 'forest') {
      // 木漏れ日
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 90 + Math.sin(t * 0.4 + i) * 8;
        const lg = ctx.createLinearGradient(x, 0, x + 60, gy);
        lg.addColorStop(0, 'rgba(255,250,200,0.22)');
        lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 90, gy); ctx.lineTo(x + 40, gy); ctx.fill();
      }
      ctx.restore();
      bgLayer(sk + 'A', cacheable, () => layer(p.far, 70, gy - 80, 7, 0.15, 31, true));
      treesR(area, scroll * 0.5, gy - 30, 'pine-far', t);
      bgLayer(sk + 'B', cacheable, () => { layer(p.mid, 20, gy - 10, 8, 0.4, 41, false); ground(); });
      treesR(area, scroll, gy, 'pine', t);
    } else if (id === 'cave') {
      bgLayer(sk + 'A', cacheable, () => {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-20, -20, 400, gy + 20);
        for (let i = 0; i < 9; i++) {
          const x = ((i * 52 - scroll * 0.5) % 470 + 470) % 470 - 50;
          const h = 30 + G.hash(i * 3) * 60;
          art.facetPoly(ctx, [x - 14, -20, x + 14, -20, x, h], p.mid, 0.12);
        }
        layer(p.far, 50, gy - 40, 7, 0.3, 51, true);
        ground();
      });
      for (let i = 0; i < 6; i++) {
        const x = ((i * 77 - scroll * 0.8) % 480 + 480) % 480 - 60;
        const gl = 0.6 + Math.sin(t * 2 + i) * 0.3;
        ctx.fillStyle = G.rgba('#7fe0ff', 0.2 * gl);
        ctx.beginPath(); ctx.arc(x, gy - 10, 22, 0, TAU); ctx.fill();
        art.poly(ctx, [x - 5, gy, x, gy - 26, x + 5, gy], '#7fe0ff');
        art.poly(ctx, [x, gy - 26, x + 5, gy, x + 1, gy], '#bff4ff');
      }
    } else if (id === 'castle') {
      bgLayer(sk + 'A', cacheable, () => {
        art.facet(ctx, 80, 80, 20, 20, 10, '#f2eedc', 0, 0.1);
        layer(p.far, 40, gy - 60, 6, 0.12, 61, false);
        const cx = 220 - scroll * 0.25;
        art.poly(ctx, [cx - 60, gy - 30, cx + 60, gy - 30, cx + 60, gy - 120, cx - 60, gy - 120], p.mid);
        [-60, -20, 20, 60].forEach((d, i) => {
          const h = i % 2 ? 150 : 170;
          art.poly(ctx, [cx + d - 12, gy - 30, cx + d + 12, gy - 30, cx + d + 12, gy - h, cx + d - 12, gy - h], G.shade(p.mid, 0.05));
          art.poly(ctx, [cx + d - 15, gy - h, cx + d + 15, gy - h, cx + d, gy - h - 26], p.near);
          ctx.fillStyle = 'rgba(255,200,120,0.6)';
          ctx.fillRect(cx + d - 2, gy - h + 18, 4, 8);
        });
        layer(p.near, 18, gy - 6, 8, 0.6, 71, false);
        ground();
      });
      ctx.save();
      ctx.globalAlpha = 0.32;
      cloudR(((40 - t * 5) % 470 + 470) % 470 - 60, 60, 44);
      cloudR(((260 - t * 3.2) % 470 + 470) % 470 - 60, 104, 30);
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const x = ((t * 10 + i * 120) % 520) - 80;
        ctx.fillStyle = 'rgba(230,220,240,0.12)';
        ctx.beginPath(); ctx.ellipse(x, gy - 10 - i * 8, 90, 14, 0, 0, TAU); ctx.fill();
      }
    } else if (id === 'harbor') {
      // 潮風の港：水平線、灯台、帆船、桟橋
      art.facet(ctx, 280, 80, 22, 22, 10, '#fff4c8', t * 0.1, 0.1);
      cloudR(((80 - t * 5 - scroll * 0.08) % 470 + 470) % 470 - 60, 70, 44);
      cloudR(((300 - t * 3.4 - scroll * 0.08) % 470 + 470) % 470 - 60, 116, 32);
      const hz = gy - 64;
      bgLayer(sk + 'A', cacheable, () => {
        layer(p.far, 26, hz - 4, 6, 0.08, 141, false);
        // 海
        const sg = ctx.createLinearGradient(0, hz, 0, gy);
        sg.addColorStop(0, '#3f8fc0');
        sg.addColorStop(1, '#2a6a9a');
        ctx.fillStyle = sg;
        ctx.fillRect(-20, hz, 400, gy - hz + 4);
        // 灯台
        const lx = 70 - scroll * 0.1;
        art.poly(ctx, [lx - 8, hz + 2, lx + 8, hz + 2, lx + 5, hz - 50, lx - 5, hz - 50], '#f4efe6');
        [0, 1, 2].forEach((i) => art.poly(ctx, [lx - 7.4 + i * 1, hz - 6 - i * 16, lx + 7.4 - i * 1, hz - 6 - i * 16, lx + 6.8 - i * 1, hz - 13 - i * 16, lx - 6.8 + i * 1, hz - 13 - i * 16], '#d4493a'));
        art.poly(ctx, [lx - 6, hz - 50, lx + 6, hz - 50, lx + 6, hz - 58, lx - 6, hz - 58], '#3a4a5a');
        art.poly(ctx, [lx - 7, hz - 58, lx + 7, hz - 58, lx, hz - 66], '#d4493a');
        // 桟橋の床
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, Hd + 20, -20, Hd + 20], p.ground);
        for (let i = 0; i < 26; i++) {
          const x = ((i * 17 - scroll) % 442 + 442) % 442 - 30;
          art.poly(ctx, [x, gy - 2, x + 1.4, gy - 2, x + 1.4 + (x - 180) * 0.25, Hd + 20, x + (x - 180) * 0.25, Hd + 20], 'rgba(60,40,20,0.35)');
        }
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, gy + 4, -20, gy + 4], G.shade(p.ground, 0.14));
        const gg = ctx.createLinearGradient(0, gy, 0, Hd);
        gg.addColorStop(0, 'rgba(0,0,0,0)');
        gg.addColorStop(1, 'rgba(4,8,18,0.35)');
        ctx.fillStyle = gg;
        ctx.fillRect(-20, gy, 400, Hd - gy + 20);
      });
      // 灯台の光
      const lx = 70 - scroll * 0.1;
      const beam = Math.sin(t * 0.8);
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.max(0, beam) * 0.2;
      ctx.fillStyle = '#fff4c0';
      ctx.beginPath(); ctx.moveTo(lx, hz - 54); ctx.lineTo(lx + 160 * beam, hz - 74); ctx.lineTo(lx + 160 * beam, hz - 34); ctx.fill();
      ctx.restore();
      // 波のきらめき
      for (let i = 0; i < 14; i++) {
        const x = ((G.hash(i) * 400 + t * (6 + (i % 3) * 3) - scroll * 0.2) % 420 + 420) % 420 - 20;
        const y = hz + 6 + G.hash(i * 5) * (gy - hz - 12);
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(t * 3 + i)})`;
        ctx.fillRect(x, y, 6 + G.hash(i * 3) * 8, 1.2);
      }
      // 帆船
      const sx = ((260 - t * 4 - scroll * 0.15) % 520 + 520) % 520 - 80, sy = hz + 4 + Math.sin(t * 1.4) * 1.2;
      art.poly(ctx, [sx - 26, sy - 8, sx + 26, sy - 8, sx + 18, sy, sx - 18, sy], '#6a4426');
      art.poly(ctx, [sx - 1, sy - 8, sx + 1, sy - 8, sx + 1, sy - 48, sx - 1, sy - 48], '#4a2e1a');
      art.poly(ctx, [sx + 2, sy - 46, sx + 2, sy - 14, sx + 20, sy - 16, sx + 16, sy - 30], '#f4efe6');
      art.poly(ctx, [sx - 2, sy - 42, sx - 2, sy - 14, sx - 18, sy - 16, sx - 15, sy - 28], '#e8e0d2');
      art.poly(ctx, [sx, sy - 48, sx + 9, sy - 45, sx, sy - 42], '#d4493a');
      // 樽と杭
      for (let i = 0; i < 3; i++) {
        const x = ((i * 160 + 30 - scroll * 0.9) % 480 + 480) % 480 - 40;
        art.poly(ctx, [x - 3, gy + 2, x + 3, gy + 2, x + 3, gy - 22, x - 3, gy - 22], '#5a3a22');
        art.poly(ctx, [x - 3.6, gy - 22, x + 3.6, gy - 22, x + 3, gy - 25, x - 3, gy - 25], '#6a4a2e');
        ctx.strokeStyle = 'rgba(230,210,170,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 3, gy - 18); ctx.quadraticCurveTo(x + 40, gy - 8, x + 80, gy - 18); ctx.stroke();
        art.facet(ctx, x + 22, gy - 8, 7, 9, 8, '#8a5a32', 0, 0.16);
        art.poly(ctx, [x + 15, gy - 12, x + 29, gy - 12, x + 29, gy - 10.6, x + 15, gy - 10.6], '#3a2a20');
      }
      // カモメ
      for (let i = 0; i < 3; i++) {
        const x = ((t * (14 + i * 4) + i * 140) % 460) - 40, y = 60 + i * 26 + Math.sin(t * 1.6 + i) * 8;
        const w2 = Math.sin(t * 7 + i) * 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x - 7, y - w2); ctx.quadraticCurveTo(x - 3, y - 4, x, y); ctx.quadraticCurveTo(x + 3, y - 4, x + 7, y - w2); ctx.stroke();
      }
    } else if (id === 'sky') {
      // 天空城：雲海、浮島と滝、白い尖塔、光の帯
      bgLayer(sk + 'A', cacheable, () => {
        // 遠くの城
        const cx = 230 - scroll * 0.1;
        [[-40, 70], [-14, 96], [14, 120], [40, 84], [62, 60]].forEach(([d, h]) => {
          art.poly(ctx, [cx + d - 9, gy - 60, cx + d + 9, gy - 60, cx + d + 9, gy - 60 - h, cx + d - 9, gy - 60 - h], '#e8e6f6');
          art.poly(ctx, [cx + d - 9, gy - 60, cx + d - 2, gy - 60, cx + d - 2, gy - 60 - h, cx + d - 9, gy - 60 - h], '#f8f6ff');
          art.poly(ctx, [cx + d - 11, gy - 60 - h, cx + d + 11, gy - 60 - h, cx + d, gy - 60 - h - 22], '#8aa0e0');
          ctx.fillStyle = 'rgba(255,220,140,0.7)';
          ctx.fillRect(cx + d - 1.5, gy - 60 - h + 12, 3, 6);
        });
        // 浮島
        [[60, gy - 120, 34], [320, gy - 150, 26]].forEach(([x, y, w]) => {
          const xx = x - scroll * 0.14;
          art.facetPoly(ctx, [xx - w, y, xx + w, y, xx + w * 0.5, y + w * 0.7, xx, y + w * 1.1, xx - w * 0.6, y + w * 0.6], '#a89cc8', 0.14);
          art.poly(ctx, [xx - w, y, xx + w, y, xx + w * 0.9, y - 4, xx - w * 0.9, y - 4], '#8ad08a');
          art.poly(ctx, [xx + w * 0.2, y + 2, xx + w * 0.3, y + 2, xx + w * 0.34, y + w * 1.6, xx + w * 0.16, y + w * 1.6], 'rgba(220,240,255,0.55)');
        });
        // 雲海（地平）
        layer('#f4f0ff', 14, gy - 50, 9, 0.25, 151, false);
        layer('#e6e0f8', 10, gy - 22, 9, 0.45, 161, false);
        // 大理石の床
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, Hd + 20, -20, Hd + 20], p.ground);
        for (let i = 0; i < 12; i++) {
          const x = ((i * 40 - scroll) % 480 + 480) % 480 - 40;
          art.poly(ctx, [x, gy - 2, x + 1, gy - 2, x + 1 + (x - 180) * 0.3, Hd + 20, x + (x - 180) * 0.3, Hd + 20], 'rgba(150,140,190,0.25)');
        }
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, gy + 3, -20, gy + 3], '#ffe08a');
        const gg = ctx.createLinearGradient(0, gy, 0, Hd);
        gg.addColorStop(0, 'rgba(0,0,0,0)');
        gg.addColorStop(1, 'rgba(40,30,80,0.3)');
        ctx.fillStyle = gg;
        ctx.fillRect(-20, gy, 400, Hd - gy + 20);
      });
      // 光の帯
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 120 + Math.sin(t * 0.3 + i) * 10;
        const lg = ctx.createLinearGradient(x, 0, x + 40, gy);
        lg.addColorStop(0, 'rgba(255,240,200,0.28)');
        lg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 30, -20); ctx.lineTo(x + 70, gy); ctx.lineTo(x + 20, gy); ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.7;
      cloudR(((40 - t * 6 - scroll * 0.2) % 480 + 480) % 480 - 60, gy - 30, 50);
      cloudR(((260 - t * 4 - scroll * 0.2) % 480 + 480) % 480 - 60, gy - 44, 36);
      ctx.restore();
      // 手前の柱
      for (let i = 0; i < 2; i++) {
        const x = ((i * 220 + 100 - scroll * 0.75) % 440 + 440) % 440 - 40;
        art.poly(ctx, [x - 9, gy, x + 9, gy, x + 8, gy - 110, x - 8, gy - 110], '#f2f0fa');
        art.poly(ctx, [x - 9, gy, x - 3, gy, x - 3, gy - 110, x - 8, gy - 110], '#ffffff');
        art.poly(ctx, [x - 12, gy - 110, x + 12, gy - 110, x + 12, gy - 116, x - 12, gy - 116], '#e2b84a');
        art.poly(ctx, [x - 12, gy, x + 12, gy, x + 12, gy - 5, x - 12, gy - 5], '#d8d2ec');
      }
    } else if (id === 'abyss') {
      // 深淵：紫の闇に浮かぶ石柱と、ゆらめく松明、光る結晶
      bgLayer(sk + 'A', cacheable, () => {
        for (let i = 0; i < 26; i++) {
          const x = G.hash(i * 17) * 380 - 10, y = G.hash(i * 31) * (gy - 60);
          ctx.fillStyle = `rgba(200,160,255,${0.15 + G.hash(i) * 0.3})`;
          ctx.fillRect(x, y, 1.4, 1.4);
        }
        // 遠くのアーチ
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 120 - scroll * 0.12) % 480 + 480) % 480 - 60;
          const top = gy - 150 - G.hash(i * 9) * 40;
          art.poly(ctx, [cx - 34, gy, cx - 22, gy, cx - 22, top + 30, cx, top + 10, cx + 22, top + 30, cx + 22, gy, cx + 34, gy, cx + 34, top + 24, cx, top - 6, cx - 34, top + 24], p.far);
        }
        layer(p.mid, 46, gy - 30, 7, 0.3, 131, true);
        // 床：石畳とルーン
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, Hd + 20, -20, Hd + 20], p.ground);
        art.poly(ctx, [-20, gy - 2, 380, gy - 2, 380, gy + 3, -20, gy + 3], G.shade(p.ground, 0.16));
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        for (let r = 0; r < 4; r++) {
          const y = gy + 10 + r * r * 14;
          ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(380, y); ctx.stroke();
          for (let i = 0; i < 9; i++) {
            const x = ((i * 50 + r * 25 - scroll) % 450 + 450) % 450 - 30;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 - r * 6, y + 10 + r * 10); ctx.stroke();
          }
        }
        const gg = ctx.createLinearGradient(0, gy, 0, Hd);
        gg.addColorStop(0, 'rgba(0,0,0,0)');
        gg.addColorStop(1, 'rgba(6,2,14,0.55)');
        ctx.fillStyle = gg;
        ctx.fillRect(-20, gy, 400, Hd - gy + 20);
      });
      // 石柱と松明（手前・ゆらめく）
      for (let i = 0; i < 3; i++) {
        const x = ((i * 150 + 40 - scroll * 0.7) % 450 + 450) % 450 - 45;
        art.poly(ctx, [x - 11, gy, x + 11, gy, x + 9, gy - 120, x - 9, gy - 120], p.near);
        art.poly(ctx, [x - 11, gy, x - 3, gy, x - 2, gy - 120, x - 9, gy - 120], G.shade(p.near, 0.12));
        art.poly(ctx, [x - 14, gy - 120, x + 14, gy - 120, x + 12, gy - 128, x - 12, gy - 128], G.shade(p.near, 0.2));
        const fl = 0.75 + Math.sin(t * 13 + i * 2) * 0.15 + Math.sin(t * 7.3 + i) * 0.1;
        ctx.fillStyle = `rgba(255,150,90,${0.16 * fl})`;
        ctx.beginPath(); ctx.arc(x + 14, gy - 86, 30 * fl, 0, TAU); ctx.fill();
        art.poly(ctx, [x + 9, gy - 80, x + 19, gy - 80, x + 16, gy - 72, x + 12, gy - 72], '#3a2a20');
        art.poly(ctx, [x + 10, gy - 81, x + 18, gy - 81, x + 14 + Math.sin(t * 15 + i) * 1.5, gy - 81 - 12 * fl], '#ffb35a');
        art.poly(ctx, [x + 12, gy - 81, x + 16, gy - 81, x + 14, gy - 81 - 7 * fl], '#fff0b0');
      }
      // 光る結晶
      for (let i = 0; i < 5; i++) {
        const x = ((i * 83 + 20 - scroll * 0.85) % 460 + 460) % 460 - 50;
        const gl = 0.6 + Math.sin(t * 1.6 + i * 1.3) * 0.35;
        ctx.fillStyle = G.rgba('#c89bff', 0.18 * gl);
        ctx.beginPath(); ctx.arc(x, gy - 8, 20, 0, TAU); ctx.fill();
        art.poly(ctx, [x - 6, gy, x - 1, gy - 22, x + 4, gy], '#a878f0');
        art.poly(ctx, [x - 1, gy - 22, x + 4, gy, x + 1, gy], '#e2ccff');
        art.poly(ctx, [x + 3, gy, x + 7, gy - 12, x + 10, gy], '#8a5ad8');
      }
    } else if (id === 'peak') {
      bgLayer(sk + 'A', cacheable, () => {
        art.facet(ctx, 270, 110, 34, 34, 10, '#ffe2a0', 0, 0.08);
        layer(p.far, 140, gy - 50, 5, 0.1, 81, true);
        layer(p.mid, 60, gy - 20, 7, 0.35, 91, true);
        ground();
      });
      ctx.save();
      ctx.globalAlpha = 0.4;
      cloudR(((90 - t * 7) % 470 + 470) % 470 - 60, 66, 52);
      cloudR(((300 - t * 4.5) % 470 + 470) % 470 - 60, 140, 34);
      ctx.restore();
      for (let i = 0; i < 20; i++) {
        const x = (G.hash(i) * 380 + t * 8) % 380 - 10;
        const y = (G.hash(i * 7) * gy + t * (20 + G.hash(i) * 30)) % gy;
        ctx.fillStyle = 'rgba(255,190,120,0.6)';
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    if (id === 'meadow') {
      for (let i = 0; i < 3; i++) {
        const x = (t * 20 + i * 140) % 400 - 20, y = gy - 70 - Math.sin(t * 2 + i) * 20;
        const fl = Math.sin(t * 16 + i) * 4;
        art.poly(ctx, [x, y, x - 5, y - 4 - fl, x - 5, y + 3], '#ffe08a');
        art.poly(ctx, [x, y, x + 5, y - 4 - fl, x + 5, y + 3], '#ffd060');
      }
    } else if (id === 'forest') {
      for (let i = 0; i < 6; i++) {
        const x = (G.hash(i) * 400 + t * 14) % 400 - 20, y = (t * 30 + G.hash(i * 3) * 300) % (gy + 20);
        ctx.save(); ctx.translate(x + Math.sin(t * 2 + i) * 8, y); ctx.rotate(t * 2 + i);
        art.poly(ctx, [-3, 0, 0, -2, 3, 0, 0, 2], '#a8c860');
        ctx.restore();
      }
    } else if (id === 'sky') {
      for (let i = 0; i < 10; i++) {
        const k = (t * (0.04 + G.hash(i) * 0.05) + G.hash(i * 9)) % 1;
        const x = G.hash(i * 13) * 380 - 10 + Math.sin(t * 0.8 + i) * 10;
        ctx.save(); ctx.translate(x, k * gy); ctx.rotate(Math.sin(t + i) * 0.8);
        art.poly(ctx, [-3, 0, 0, -1.4, 3, 0, 0, 1.4], 'rgba(255,250,235,0.85)');
        ctx.restore();
      }
    } else if (id === 'abyss') {
      for (let i = 0; i < 14; i++) {
        const k = (t * (0.05 + G.hash(i) * 0.06) + G.hash(i * 7)) % 1;
        const x = G.hash(i * 13) * 380 - 10 + Math.sin(t + i) * 6;
        ctx.fillStyle = `rgba(210,170,255,${0.5 * Math.sin(k * Math.PI)})`;
        ctx.fillRect(x, gy - k * gy, 1.8, 1.8);
      }
    } else if (id === 'cave') {
      for (let i = 0; i < 3; i++) {
        const kk = ((t * 0.8 + i * 0.33) % 1);
        ctx.fillStyle = 'rgba(159,232,255,0.7)';
        ctx.fillRect(60 + i * 110, kk * gy, 1.5, 4);
      }
    }
  }
  function cloudR(x, y, w) {
    art.poly(ctx, [x - w, y, x - w * 0.6, y - w * 0.4, x - w * 0.1, y - w * 0.55, x + w * 0.5, y - w * 0.35, x + w, y], 'rgba(255,255,255,0.85)');
  }
  // 木：1本ずつ絵にしておき、揺れは「傾け」で出す（根元は動かず、上ほど揺れる）
  function treeSprite(area, kind, i) {
    const s = 0.8 + G.hash(i * 13) * 0.5;
    const key = area.id + kind + i + '|' + bgScale.toFixed(2);
    let c = treeCache.get(key);
    if (c) return c;
    const p = area.pal;
    let x0, y0, w, h;
    if (kind === 'round') { x0 = -24 * s; y0 = -62 * s; w = 48 * s; h = 64 * s; }
    else { const th = (kind === 'pine-far' ? 70 : 100) * s; x0 = -26 * s; y0 = -(14 + 0.94 * th); w = 52 * s; h = -y0 + 3; }
    c = offscreen(w, h, bgScale, (g) => {
      g.translate(-x0, -y0);
      if (kind === 'round') {
        art.poly(g, [-3, 0, 3, 0, 2, -30 * s, -2, -30 * s], '#7a5230');
        art.facet(g, 0, -40 * s, 20 * s, 18 * s, 7, p.near, i, 0.16);
      } else {
        const th = (kind === 'pine-far' ? 70 : 100) * s;
        const col = kind === 'pine-far' ? p.mid : p.near;
        art.poly(g, [-3, 0, 3, 0, 3, -12, -3, -12], '#4a3020');
        for (let j = 0; j < 3; j++) {
          const yb = -10 - j * th * 0.26;
          const ww = (24 - j * 6) * s;
          art.poly(g, [-ww, yb, ww, yb, 0, yb - th * 0.42], G.shade(col, j * 0.04));
          art.poly(g, [-ww, yb, 0, yb - th * 0.42, 0, yb], G.shade(col, 0.1 + j * 0.04));
        }
      }
    });
    c._x0 = x0; c._y0 = y0; c._w = w; c._h = h; c._top = kind === 'round' ? 40 * s : 10 + 0.94 * (kind === 'pine-far' ? 70 : 100) * s;
    c._k = kind === 'round' ? 1 : 1.2;
    if (treeCache.size > 120) treeCache.clear();
    treeCache.set(key, c);
    return c;
  }
  function treesR(area, scroll, gy, kind, t) {
    for (let i = 0; i < 7; i++) {
      const span = 470;
      const x = ((i * 70 - scroll * (kind === 'pine-far' ? 0.5 : 0.8)) % span + span) % span - 55;
      const sway = Math.sin(t * 1.2 + i) * 1.2;
      const c = treeSprite(area, kind, i);
      ctx.save();
      ctx.translate(x, gy);
      ctx.transform(1, 0, (-sway * c._k) / c._top, 1, 0, 0);
      ctx.drawImage(c, c._x0, c._y0, c._w, c._h);
      ctx.restore();
    }
  }

  function drawDigest(reel, t) {
    const g = ctx.createLinearGradient(0, 0, 0, Hd);
    g.addColorStop(0, '#16224a');
    g.addColorStop(1, '#3a2a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 360, Hd);
    const gy = Hd * 0.6;
    ctx.save();
    ctx.translate(180, Hd * 0.2);
    ctx.textAlign = 'center';
    ctx.font = F(800, 24, 'head');
    ctx.fillStyle = '#fbf3de';
    ctx.fillText('留守中の冒険まとめ', 0, 0);
    ctx.font = F(700, 13, 'ui');
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${reel.n} 件の依頼をこなしました`, 0, 26);
    ctx.restore();
    if (t > 1.2) drawRays(180, gy - 18, 1, 'great', t, 1.2);
    ctx.save();
    ctx.translate(180, gy);
    ctx.scale(2.6, 2.6);
    art.chestR(ctx, G.ease.outBack(G.seg(t, 1.2, 1.5)), 3, t);
    ctx.restore();
    if (t > 1.2) {
      [['coin', reel.gold], ['gem', reel.mat], ['star', reel.fame]].filter((x) => x[1] > 0).forEach(([ic, v], i) => {
        const kk = G.ease.outBack(G.seg(t, 1.3 + i * 0.15, 1.6 + i * 0.15));
        const y = Hd * 0.35 + i * 30;
        ctx.save();
        ctx.translate(150, y);
        ctx.scale(kk, kk);
        if (ic === 'coin') art.coin(ctx, 0, 0, 9, t);
        else if (ic === 'gem') art.gem(ctx, 0, 0, 10);
        else art.fameStar(ctx, 0, 0, 10);
        ctx.font = F(800, 16, 'num');
        ctx.fillStyle = '#fbf3de';
        ctx.textAlign = 'left';
        ctx.fillText('+' + G.fmt(v), 16, 6);
        ctx.restore();
      });
    }
  }

  function drawParts(ui) {
    parts.forEach((p) => {
      if (!!p.ui !== ui) return;
      const kk = p.life / p.max;
      const a = 1 - kk;
      if (p.type === 'spark') {
        ctx.fillStyle = G.rgba(p.col, a);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.life * 6);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === 'tri') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        art.poly(ctx, [-p.size, p.size * 0.6, p.size, p.size * 0.6, 0, -p.size], G.rgba(p.col, Math.min(1, a * 2.5)));
        ctx.restore();
      } else if (p.type === 'plus') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = '#9ff0b8';
        ctx.fillRect(p.x - p.size, p.y - p.size * 0.3, p.size * 2, p.size * 0.6);
        ctx.fillRect(p.x - p.size * 0.3, p.y - p.size, p.size * 0.6, p.size * 2);
        ctx.restore();
      } else if (p.type === 'heart') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const sc = G.ease.outBack(Math.min(1, p.life / 0.2));
        art.heart(ctx, 0, 0, p.size * sc, '#ff4f6d');
        ctx.restore();
      } else if (p.type === 'text') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.translate(p.x, p.y);
        ctx.font = F(800, 13, 'ui');
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(8,12,28,0.85)';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.col;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      } else if (p.type === 'dmg') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2.5);
        const uk = p.kind === 'use' || p.kind === 'usecrit';
        const big = p.kind === 'skill' ? 1.9 : p.kind === 'usecrit' ? 1.65 : p.kind === 'use' ? 1.4 : p.kind === 'crit' ? 1.45 : 1;
        const sc = G.ease.outBack(Math.min(1, p.life / 0.14)) * big;
        ctx.translate(p.x, p.y);
        ctx.scale(sc, sc);
        ctx.font = F(900, 17, 'num');
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = p.kind === 'heal' ? '#0a3020' : p.kind === 'hurt' ? '#3a0808' : '#1a0c02';
        ctx.strokeText(p.text, 0, 0);
        if (p.kind === 'crit' || p.kind === 'skill' || uk) {
          const g = ctx.createLinearGradient(0, -14, 0, 4);
          g.addColorStop(0, '#fffbe8');
          g.addColorStop(1, uk && p.col ? p.col : '#ffb83a');
          ctx.fillStyle = g;
        } else ctx.fillStyle = p.kind === 'hurt' ? '#ff9a8a' : p.kind === 'heal' ? '#9ff0b8' : p.kind === 'miss' ? '#cfe6ff' : '#ffffff';
        ctx.fillText(p.text, 0, 0);
        if (p.kind === 'crit' || p.kind === 'skill' || p.kind === 'usecrit') {
          const lb = p.kind === 'skill' ? '閃き' : '会心';
          ctx.font = F(800, 8.5, 'head');
          ctx.lineWidth = 3;
          ctx.strokeText(lb, 0, -16);
          ctx.fillStyle = '#ff8a4a';
          ctx.fillText(lb, 0, -16);
        }
        ctx.restore();
      } else if (p.type === 'petal') {
        // 舞う花びら・葉・羽根（ゆらゆら）
        const sw = Math.sin(p.life * 7 + (p.drift || 0)) * 0.9;
        if (p.life > 0.25) { p.vx *= 0.97; p.vy = Math.min(p.vy, 60); }
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.translate(p.x + sw * 6, p.y);
        ctx.rotate(p.rot + sw * 0.6);
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.life * 6 + (p.drift || 0))));
        ctx.fillStyle = p.col;
        const s2 = p.size, lg = p.long || 1;
        ctx.beginPath(); ctx.moveTo(0, -s2 * lg); ctx.quadraticCurveTo(s2 * 0.95, -s2 * 0.15, 0, s2 * lg); ctx.quadraticCurveTo(-s2 * 0.95, -s2 * 0.15, 0, -s2 * lg); ctx.fill();
        ctx.restore();
      } else if (p.type === 'star') {
        ctx.save();
        fxStar(p.x, p.y, p.size, p.rot, p.col, Math.min(1, a * 2));
        ctx.restore();
      } else if (p.type === 'note') {
        ctx.save();
        fxNote(p.x, p.y, p.size, Math.sin(p.life * 6) * 0.3, p.col, Math.min(1, a * 2));
        ctx.restore();
      } else if (p.type === 'coin') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.translate(p.x, p.y);
        ctx.scale(Math.abs(Math.cos(p.life * 9 + p.rot)) * 0.85 + 0.15, 1);
        ctx.fillStyle = '#b8801e'; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.78, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff4b0'; ctx.fillRect(-p.size * 0.15, -p.size * 0.5, p.size * 0.3, p.size);
        ctx.restore();
      } else if (p.type === 'drop') {
        ctx.save();
        fxDrop(p.x, p.y, p.size, p.col, Math.min(1, a * 2));
        ctx.restore();
      } else if (p.type === 'puff') {
        ctx.save();
        fxPuff(p.x, p.y, p.size * (0.6 + kk * 0.9), p.col, 0.5 * a);
        ctx.restore();
      }
    });
  }
  function drawBanner() {
    const a = Math.min(1, banner.t / 0.25) * (banner.t > 2.2 ? (2.6 - banner.t) / 0.4 : 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.globalAlpha = a;
    const y = 70 + (1 - Math.min(1, banner.t / 0.25)) * -30;
    ctx.font = F(800, 17, 'head');
    const w = ctx.measureText(banner.text).width + 44;
    art.rrect(ctx, W / 2 - w / 2, y, w, 40, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + 40);
    g.addColorStop(0, '#22345e');
    g.addColorStop(1, '#0f1a36');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#e0b84e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffe39a';
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, W / 2, y + 26);
    ctx.restore();
  }

  // テスト用
  R._debug = { hold: false, planOf, makePlan, items: () => items, rt: () => rt, setRt: (v) => { rt = v; }, layout, events: () => { const c = items[Math.round(pos)]; if (c && !c.end) events(c, c.digest ? null : planOf(c)); } };
  // T の少し前から実際に再生して止める（パーティクル込みでその瞬間を見る）
  R._debug.seek = (T, pre = 0.6) => {
    const c = items[Math.round(pos)];
    if (!c || c.end) return;
    firedFor = c;
    fired = {};
    rt = Math.max(0, T - pre);
    events(c, c.digest ? null : planOf(c));
    parts = [];
    flashT = 0;
    R._debug.hold = false;
    let n = 0;
    while (rt < T && n++ < 900) R.update(1 / 60);
    R._debug.hold = true;
  };
  R._debug.parts = () => parts.length;
  R._debug.go = (i) => { pos = target = i; anim = null; firedFor = null; rt = 0; fired = {}; parts = []; updateDom(); };
  R._debug.pops = (r) => popsOf(r || items[Math.round(pos)]);
  R._debug.SKILL_FX = SKILL_FX;
})();
