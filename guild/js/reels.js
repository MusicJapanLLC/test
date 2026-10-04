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
  };
  const BIG = { golem: 1, knight: 1, wyvern: 1, dragon: 1, wolf: 0 };
  const FLYING = { bat: 1, wyvern: 1 };

  // 閃きで覚える技（ロマサガの「閃き」へのオマージュ）
  const SKILLS = {
    warrior: ['烈風斬', '剛断・灯火割り', '獅子奮迅撃', '大地裂き', '十文字斬り', '流星剣'],
    mage: ['蒼炎の槍', '星降りの陣', '雷鳴の輪舞', '氷華結界', '紅蓮の柱', '月光砲'],
    thief: ['影縫い', '月下千刃', '燕返し', '夜霧の舞', '乱れ椿'],
    cleric: ['聖灯の祈り', '天使の鐘', '光輪の裁き', '浄化の陽'],
    archer: ['流星の矢', '風穿ち', '千里一射', '五月雨撃ち', '翠嵐の矢'],
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
  const ROAR = { dragon: 'グオオオオッ!!', wyvern: 'ギャオオッ!', golem: 'ゴゴゴゴ…', knight: 'オォォ…', wolf: 'ガルルル…', bat: 'キキーッ' };

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
  R.make = function ({ q, party, tier, gold, mat, fame, levelUps, extra, endAt, drop, loot, goldBoost }) {
    const st = G.state;
    const area = D.AREA_BY_ID[q.area];
    const md = D.MONSTERS[q.monster];
    const leader = party[0];
    const seed = Math.floor(Math.random() * 1e9);
    const rnd = mulberry(seed ^ 0x51ab);
    const c = { area: area.short, monster: md.name, verb: md.verb, leader: leader ? leader.name : '', cls: leader ? D.CLASSES[leader.cls].name : '' };
    const caption = q.boss ? '最終依頼。紅蓮竜王、ついに――' : fill(pickR(rnd, CAPTIONS), c);
    const tags = TAGS_BASE.slice().sort(() => rnd() - 0.5).slice(0, 3).map((x) => fill(x, c));
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
    const big = !!(reel.boss || BIG[mon]);
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
    const clericIdx = P.findIndex((p) => p.cls === 'cleric');
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
          b.at = t + 1.08;
          b.dmg = Math.round(dmgOf(p) * (4.2 + rnd() * 0.8));
          b.ono = pickR(rnd, ['ズドォォン!!', '斬ッ!!', 'ドガァァン!!', 'ゴォォッ!!']);
          pl.stops.push({ t: b.at, d: 0.16 });
          t += 1.6;
        } else {
          b.kind = 'hit';
          // セットした技を使うことがある
          if (p.set && p.set.length && rnd() < 0.38) b.use = p.set[Math.floor(rnd() * p.set.length)];
          b.crit = rnd() < critP + (p.crit || 0) / 200 + (b.use ? 0.15 : 0);
          b.at = t + (b.melee ? 0.17 : 0.22);
          b.dmg = Math.round(dmgOf(p) * (b.crit ? 2.3 : 1));
          b.ono = b.crit ? pickR(rnd, ['ズバァッ!!', 'ザンッ!!', 'ドゴォッ!!', 'バキィッ!!']) : pickR(rnd, c.ono);
          if (b.crit) pl.stops.push({ t: b.at, d: 0.085 });
          t += b.crit ? 0.68 : 0.56;
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
    // 背景の描き置きは、カメラが寄ってもにじまないよう少し大きめに
    const nb = Math.min(4, dpr * k * 1.2);
    if (Math.abs(nb - bgScale) > 0.01) { bgScale = nb; bgCache.clear(); treeCache.clear(); }
    sprites.clear();
    skyGrad.clear();
    placeHitAreas();
  }

  // 冒険譚ごとの曲（場所・ボス戦で変わる。TikTok の「楽曲」のように画面下に流れる）
  const AREA_TRACK = { meadow: 'reels', forest: 'forest', cave: 'cave', castle: 'castle', peak: 'peak' };
  const trackOf = (r) => (!r || r.end ? null : r.digest ? 'reels' : r.boss ? 'boss' : AREA_TRACK[r.area] || 'reels');
  const songOf = (r) => G.audio.trackTitle(trackOf(r)) || r.song;
  R.trackOf = trackOf;

  R.unseen = () => G.state.reels.filter((r) => !r.claimed);
  R.pendingGold = () => R.unseen().reduce((x, r) => x + r.gold, 0);

  R.open = function () {
    if (open) return;
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
  let skipNoted = false;
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
      const lost = st.streak;
      st.streak = 0;
      if (!skipNoted && !reel.digest) {
        skipNoted = true;
        G.ui.toast(lost ? `途中で飛ばしたので、連続視聴ボーナス（${lost}本）が途切れました` : '敵を倒すところまで見ると、ゴールド+20%と贈り物がもらえます', 'info', 'skip');
      }
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
        if (once('sw' + i, b.t + 0.95)) sfx(p && !CLS[p.cls].melee ? 'cast' : 'swish');
        if (once('h' + i, b.at)) {
          sfx('crit'); sfx('impact', 2);
          for (let j = 0; j < 34; j++) addPart(shardP(L.mx, mcy, mcol, true));
          for (let j = 0; j < 16; j++) addPart(sparkP(L.mx, mcy, '#fff6c0'));
          addDmg(L.mx + b.jx * 10, L.gy - L.mh - 18, b.dmg, 'skill');
          flashT = 0.5; flashCol = '#fff4d0';
          G.haptic(32);
        }
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
  function addDmg(x, y, v, kind) {
    addPart({ type: 'dmg', x, y, vx: G.rand(-14, 14), vy: kind === 'skill' ? -95 : -75, g: 130, life: 0, max: kind === 'skill' ? 1.3 : 1, text: G.fmt(v), kind });
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
    if (!pl || rmNow) return { z: 1, x: 180, y: Hd * 0.5 };
    const imp = (t0, rise, dur, amp, x, y) => {
      const d = t - t0;
      if (d < -rise || d > dur) return;
      const e = d < 0 ? G.ease.outCubic(1 + d / rise) : 1 - G.ease.inOut(d / dur);
      z += amp * e; ex += x * e; ey += y * e; ew += e;
    };
    const my = L.gy - L.mh * 0.5;
    imp(pl.encT + 0.05, 0.12, 0.85, pl.big ? 0.2 : 0.14, L.mx, my);
    pl.beats.forEach((b) => {
      if (b.kind === 'hit') imp(b.at, 0.05, b.crit ? 0.42 : 0.25, b.crit ? 0.14 : 0.04, L.mx, my);
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
    return { z, x: fx, y: fy };
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
      if (b.kind === 'hit') kick(b.at, b.crit ? 6 : 2.4, 0.3);
      else if (b.kind === 'skill') kick(b.at, 10, 0.5);
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
    drawBg(area, scroll, t, L.gy, walkK >= 1 && !fleeing);
    drawMagicCircles(reel, pl, t, L);
    drawMonster(reel, pl, t, L);
    drawParty(reel, pl, t, L);
    drawAttackFx(reel, pl, t, L);
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
      art.monster[reel.monster](ctx, { t: t + c * 0.7, atk: c === 0 ? atk : 0, color: D.MONSTERS[reel.monster].color });
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
    const name = (reel.boss ? '竜王 ' : '') + D.MONSTERS[reel.monster].name + (reel.count > 1 ? ` ×${Math.min(3, reel.count)}` : '');
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
    pl.beats.forEach((b) => {
      if ((b.kind === 'hit' || b.kind === 'skill') && b.who === i && b.melee) {
        const s0 = b.kind === 'skill' ? b.t + 0.9 : b.t;
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
        if ((b.kind === 'hit' || b.kind === 'skill') && b.who === i) {
          const s0 = b.kind === 'skill' ? b.t + 0.9 : b.t;
          const d = t - s0;
          if (b.kind === 'skill' && t > b.t - 0.5 && t < b.t + 0.9) { state = 'stand'; expr = 'happy'; }
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
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.35, 2.35);
      art.person(ctx, p.look, { t: t + i, state, phase, facing, swing, armed, expr, blink: Math.sin(t * 3 + i * 2) > 0.97 });
      ctx.restore();
      // 驚きマーク
      if (t > pl.encT + 0.1 && t < pl.encT + 0.75) drawMark(x, y - 104, '!', G.ease.outBack(G.seg(t, pl.encT + 0.1, pl.encT + 0.25)));
      // 閃きの電球
      pl.beats.forEach((b) => {
        if (b.kind === 'skill' && b.who === i && t > b.t - 0.5 && t < b.t + 0.05) {
          const kk = G.ease.outBack(G.seg(t, b.t - 0.5, b.t - 0.35));
          art.bulb(ctx, x + 4, y - 118 - kk * 6, 9 * kk, 1, t);
        }
      });
      // 技の名前
      pl.beats.forEach((b) => {
        if (b.use && b.who === i && t > b.t - 0.08 && t < b.t + 0.62) {
          const k1 = G.ease.outBack(G.seg(t, b.t - 0.08, b.t + 0.06));
          const a1 = 1 - G.seg(t, b.t + 0.45, b.t + 0.62);
          const x0 = partyX(reel, pl, b.t, L, i);
          ctx.save();
          ctx.globalAlpha = a1;
          ctx.translate(G.clamp(x0, 50, 250), y - 116);
          ctx.scale(k1, k1);
          ctx.font = F(800, 13, 'head');
          ctx.textAlign = 'center';
          const w = ctx.measureText(b.use).width + 18;
          art.poly(ctx, [-w / 2 - 6, -9, w / 2, -9, w / 2 + 6, 6, -w / 2, 6], 'rgba(10,16,38,0.88)');
          ctx.strokeStyle = '#e0b84e';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-w / 2 - 6, -9); ctx.lineTo(w / 2, -9); ctx.lineTo(w / 2 + 6, 6); ctx.lineTo(-w / 2, 6); ctx.closePath(); ctx.stroke();
          ctx.fillStyle = '#ffe39a';
          ctx.fillText(b.use, 0, 2);
          ctx.restore();
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
      if (b.kind === 'hit') {
        const px = partyX(reel, pl, b.t, L, b.who);
        if (b.melee) {
          slash(L.mx - 4, my, t - b.at, b.ang, b.crit ? 1.35 : 1, b.crit);
          if (p && p.cls === 'thief') slash(L.mx + 4, my - 6, t - b.at - 0.05, b.ang + 1.4, 0.8, false);
        } else if (p && p.cls === 'archer') arrow(px + 18, L.gy - 58, L.mx - 10, my, t - b.t, b.at - b.t, b.crit);
        else orb(px + 20, L.gy - 62, L.mx - 10, my, t - b.t, b.at - b.t, p && p.cls === 'cleric' ? '#fff0a0' : '#8fd0ff', b.crit);
        burst(L.mx - 6, my, t - b.at, b.crit ? 1.25 : 0.7, b.crit ? '#fff6c0' : '#ffffff');
      } else if (b.kind === 'skill') {
        const d = t - b.at;
        const cls = p ? p.cls : 'warrior';
        if (cls === 'warrior') {
          slash(L.mx, my, d + 0.04, -0.75, 2.1, true);
          slash(L.mx, my, d, 0.75, 2.1, true);
        } else if (cls === 'thief') {
          for (let j = 0; j < 5; j++) slash(L.mx + (j - 2) * 6, my + ((j * 37) % 11) - 5, d + 0.2 - j * 0.05, -1.2 + j * 0.6, 1.1, true);
        } else if (cls === 'archer') {
          const px = partyX(reel, pl, b.t, L, b.who);
          arrow(px + 18, L.gy - 58, L.mx - 10, my, t - (b.at - 0.14), 0.14, true, 2.2);
        } else {
          pillar(L.mx, L.gy, d, cls === 'cleric' ? '#fff3b0' : '#7fc8ff', cls === 'cleric' ? '#ffd36a' : '#c8a0ff');
        }
        burst(L.mx, my, d, 2.1, '#fff6c0');
        ring(L.mx, my, d, 120, '#ffe9a0');
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
      if (!p || (p.cls !== 'mage' && p.cls !== 'cleric')) return;
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

  // 擬音
  function drawOno(reel, pl, t, L) {
    pl.beats.forEach((b) => {
      if (!b.ono) return;
      const d = t - b.at;
      const dur = b.kind === 'skill' ? 0.75 : b.crit || b.big ? 0.55 : 0.42;
      if (d < 0 || d > dur) return;
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
      if (b.crit && b.kind === 'hit') { const d = t - b.at; if (d > -0.05 && d < 0.25) a = Math.max(a, 1 - G.seg(d, 0, 0.25)); }
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
    // 流れる線
    for (let i = 0; i < 26; i++) {
      const h = G.hash(i * 17);
      const x = ((h * 520 - t * (900 + h * 600)) % 520 + 520) % 520 - 80;
      ctx.fillStyle = `rgba(255,236,190,${0.08 + h * 0.18})`;
      ctx.fillRect(x, cy - 80 + h * 160, 60 + h * 120, 1.5 + h * 2);
    }
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
      }
    });
    ctx.save();
    ctx.globalAlpha = Math.min(1, tIn);
    ctx.drawImage(spr, 0, 132 - 46 - (1 - Math.min(1, tIn)) * 24, 360, 76);
    ctx.restore();
  }

  function drawResult(reel, pl, t, L) {
    const a = G.ease.outBack(G.seg(t, pl.resT, pl.resT + 0.25));
    const label = reel.boss ? '竜王討伐！！' : { fail: '撤退…', ok: '依頼達成', great: '大成功！', legend: '伝説級！！' }[reel.tier];
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
        const big = p.kind === 'skill' ? 1.9 : p.kind === 'crit' ? 1.45 : 1;
        const sc = G.ease.outBack(Math.min(1, p.life / 0.14)) * big;
        ctx.translate(p.x, p.y);
        ctx.scale(sc, sc);
        ctx.font = F(900, 17, 'num');
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = p.kind === 'heal' ? '#0a3020' : p.kind === 'hurt' ? '#3a0808' : '#1a0c02';
        ctx.strokeText(p.text, 0, 0);
        if (p.kind === 'crit' || p.kind === 'skill') {
          const g = ctx.createLinearGradient(0, -14, 0, 4);
          g.addColorStop(0, '#fffbe8');
          g.addColorStop(1, '#ffb83a');
          ctx.fillStyle = g;
        } else ctx.fillStyle = p.kind === 'hurt' ? '#ff9a8a' : p.kind === 'heal' ? '#9ff0b8' : p.kind === 'miss' ? '#cfe6ff' : '#ffffff';
        ctx.fillText(p.text, 0, 0);
        if (p.kind === 'crit' || p.kind === 'skill') {
          ctx.font = F(800, 8.5, 'head');
          ctx.lineWidth = 3;
          ctx.strokeText(p.kind === 'skill' ? '閃き' : '会心', 0, -16);
          ctx.fillStyle = '#ff8a4a';
          ctx.fillText(p.kind === 'skill' ? '閃き' : '会心', 0, -16);
        }
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
})();
