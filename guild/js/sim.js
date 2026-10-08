/* ギルドの灯 — sim: 状態・経済・依頼・放置計算・セーブ
 * 時間はすべて実時刻（秒）で持つので、オンラインでも留守中でも同じ処理で進む。
 */
'use strict';
(function () {
  const S = (G.sim = {});
  const D = G.D;
  const SAVE_KEY = 'guild-akari-save-v1';

  // ---------------------------------------------------------------- 初期状態
  S.fresh = function () {
    G.state = null;
    const now = G.now();
    const s = {
      v: 1,
      created: now,
      lastSeen: now,
      gold: 30,
      mat: 0,
      fame: 0,
      rank: 1,
      adv: [],
      nextId: 1,
      board: [],
      boardAt: now,
      refreshAt: 0,
      active: [],
      reels: [],
      fac: { hall: 1, bunks: 1, tavern: 0, smithy: 0, training: 0, alchemy: 0, tower: 0 },
      building: null, // { id, endAt, dur }
      cands: [],
      candAt: now,
      tips: [], // 酒場の机に置かれたチップ [{ seat, v }]
      deskCoins: 0, // 受付の相談料
      deskAt: now,
      obj: 0,
      stats: { quests: 0, success: 0, great: 0, legend: 0, fail: 0, likes: 0, tips: 0, goldEarned: 0, areaWin: {}, boss: 0, reels: 0, playSec: 0 },
      seenMonsters: {},
      flags: { tut: 0, autoDispatch: false, bossUnlocked: false },
      settings: { bgm: 0.6, sfx: 0.8, env: 0.7, autoEnh: false, haptics: true, autoplay: true, reduceMotion: false, danmaku: true, notify: true },
      inbox: [],
      items: [],
      relics: {},
      crystals: 30,
      itemsNew: 0,
      bag: { hg2: 1, finish: 2, stone: 6, key: 1 },
      boosts: {},
      streak: 0,
    };
    // 最初の冒険者：戦士ガルド
    const garu = S.makeAdv('warrior', 1, 'ガルド', 'brave');
    garu.look.hair = '#6b4426';
    garu.look.style = 'short';
    garu.look.crest = '#d4493a';
    s.adv.push(garu);
    s.nextId = 2;
    G.state = s;
    // チュートリアル用の最初の依頼
    const tq = S.makeQuest(0, { size: 1, k: 0.05, dur: 14, name: '草原のスライム退治', monster: 'slime' });
    s.board.push(tq);
    s.flags.tutQ = tq.id;
    s.board.push(S.makeQuest(0, { size: 1, k: 0.4 }));
    s.board.push(S.makeQuest(0, { size: 2, k: 0.5 }));
    S.rollCandidates(s, true);
    return s;
  };

  S.makeAdv = function (cls, lv, name, trait) {
    const id = G.state ? G.state.nextId++ : 1;
    return {
      id,
      name: name || S.uniqueName(),
      cls,
      lv: lv || 1,
      exp: 0,
      trait: trait || G.pick(D.TRAIT_IDS),
      bond: 0,
      look: G.art.randomLook(cls),
      status: 'idle',
      hiredAt: G.now(),
      eq: {},
      sk: {},
      skillSet: [],
      mast: {},
    };
  };

  S.uniqueName = function () {
    const used = new Set((G.state ? G.state.adv : []).map((a) => a.name));
    (G.state ? G.state.cands : []).forEach((c) => used.add(c.name));
    (G.state ? G.state.alumni || [] : []).forEach((c) => used.add(c.name));
    const free = D.NAMES.filter((n) => !used.has(n));
    return free.length ? G.pick(free) : G.pick(D.NAMES) + 'Ⅱ';
  };

  // ---------------------------------------------------------------- 数値
  S.expNeed = (lv) => Math.round(8 * Math.pow(1.33, lv - 1));
  S.power = function (a, s = G.state) {
    const base = D.CLASSES[a.cls].pow;
    const items = G.items && s === G.state ? G.items.powMul(a) : 1;
    const tal = G.talent && s === G.state ? (G.talent.advFx(a).pow || 0) / 100 : 0;
    return base * (1 + 0.3 * (a.lv - 1)) * (1 + 0.12 * s.fac.smithy) * (1 + 0.03 * Math.min(a.bond, 10)) * items * (1 + 0.02 * S.mastTotal(a)) * (1 + S.hallBonus(s)) * (1 + tal);
  };
  S.slots = (s = G.state) => s.fac.hall;
  S.busy = (s = G.state) => s.active.filter((e) => !e.abyss).length;
  S.boardSize = (s = G.state) => s.fac.hall + 2;
  S.beds = (s = G.state) => (G.trail && s === G.state && G.trail.hasTrial('few') ? Math.min(4, D.beds(s.fac.bunks)) : D.beds(s.fac.bunks));
  S.offlineCap = (s = G.state) => (3 + s.fac.tower * 2 + (G.pay && G.pay.passActive() ? 2 : 0)) * 3600;
  const starOk = (x, s) => !x.star || S.starLv(x.star, s) > 0;
  S.unlockedAreas = (s = G.state) => D.AREAS.filter((a) => a.rank <= s.rank && starOk(a, s));
  S.unlockedClasses = (s = G.state) => D.CLASS_ORDER.filter((c) => D.CLASSES[c].rank <= s.rank && starOk(D.CLASSES[c], s));

  S.partyInfo = function (quest, party, s = G.state) {
    let pow = 0, cleric = false, archer = false, warrior = false, thief = false, knight = false, bard = false, alch = false;
    let brave = 0, swift = 0, lucky = 0, greedy = 0;
    party.forEach((a) => {
      pow += S.power(a, s);
      // 職業の特技（極めた職業＝熟練★5 の特技は、転職しても使える）
      if (S.hasPerk(a, 'cleric')) cleric = true;
      if (S.hasPerk(a, 'archer')) archer = true;
      if (S.hasPerk(a, 'warrior')) warrior = true;
      if (S.hasPerk(a, 'thief')) thief = true;
      if (S.hasPerk(a, 'knight')) knight = true;
      if (S.hasPerk(a, 'bard')) bard = true;
      if (S.hasPerk(a, 'alchemist')) alch = true;
      if (a.trait === 'brave') brave++;
      if (a.trait === 'swift') swift++;
      if (a.trait === 'lucky') lucky++;
      if (a.trait === 'greedy') greedy++;
    });
    const ratio = pow / (quest.req * (1 + S.starFx('req', s)));
    const real = G.items && s === G.state;
    const rfx = (key) => (real ? G.items.relicFx(key) : 0);
    // 装備と技の能力（パーティの合計・上限つき）
    const ps = real ? G.items.partyStats(party) : {};
    // 才能の樹（冒険者ごと）
    if (real && G.talent) Object.entries(G.talent.partyFx(party)).forEach(([k, v]) => { ps[k] = (ps[k] || 0) + v; });
    const luck = real && G.items.boost('luck') ? G.items.boost('luck').add : 0;
    let p = 0.75 * Math.pow(ratio, 1.6);
    p += (cleric ? 0.08 : 0) + (knight ? 0.06 : 0) + brave * 0.05 + s.fac.alchemy * 0.03 + (ps.succ || 0) / 100 + S.starFx('succ', s);
    p = G.clamp(p, 0.08, 0.97);
    if (!party.length) p = 0;
    const sf = (k) => S.starFx(k, s);
    let dur = quest.dur * (archer ? 0.9 : 1) * Math.pow(0.92, swift) * (1 - s.fac.tower * 0.04) * (1 - rfx('speed')) * (1 - (ps.speed || 0) / 100) * (1 - sf('speed'));
    const great = 0.12 + lucky * 0.06 + s.fac.alchemy * 0.015 + (ratio > 1.4 ? 0.06 : 0) + rfx('great') + (ps.great || 0) / 100 + luck + sf('great') + (real && G.oshi ? G.oshi.partyGreat(party) : 0);
    const ev = (k) => (G.events && real ? G.events.bonus(k) : 0);
    const goldMul = (thief ? 1.15 : 1) * (1 + greedy * 0.1) * (1 + rfx('gold')) * (1 + (ps.gold || 0) / 100) * (1 + sf('gold')) * (1 + ev('gold'));
    return { pow, ratio, p, dur: Math.max(5, dur), great, goldMul, warrior: warrior || knight, expMul: (1 + (ps.exp || 0) / 100) * (1 + sf('exp')) * (bard ? 1.15 : 1) * (1 + ev('exp')), fameMul: bard ? 1.2 : 1, find: (ps.find || 0) + sf('find') + (alch ? 20 : 0), matMul: (1 + (ps.mat || 0) / 100) * (alch ? 1.3 : 1) * (1 + ev('mat')) * (1 + sf('mat')), crit: ps.crit || 0 };
  };

  // ---------------------------------------------------------------- 依頼
  let questSeq = 1;
  S.makeQuest = function (areaIdx, o = {}) {
    const area = D.AREAS[areaIdx];
    const size = o.size || G.randi(1, area.size);
    const k = o.k != null ? o.k : Math.random();
    const sizeMul = [0, 0.55, 0.85, 1, 1.25][size];
    const req = Math.round(G.lerp(area.pow[0], area.pow[1], k) * sizeMul);
    let monster = o.monster || G.pick(area.monsters);
    // かぼちゃ灯籠祭：手前の土地に、かぼちゃおばけが出る
    if (!o.monster && G.events && G.events.theme() === 'pumpkin' && areaIdx <= 2 && Math.random() < 0.28) monster = 'pumpkin';
    const md = D.MONSTERS[monster];
    const rew = (r) => G.lerp(r[0], r[1], k) * sizeMul;
    return {
      id: 'q' + (G.now() * 1000).toFixed(0) + '-' + questSeq++,
      area: area.id,
      name: o.name || `${area.short}の${md.name}${md.verb}`,
      monster,
      count: Math.min(3, size + (Math.random() < 0.3 ? 1 : 0)),
      size,
      req: Math.max(4, req),
      dur: Math.round(o.dur || G.lerp(area.dur[0], area.dur[1], k) * (0.85 + Math.random() * 0.3)),
      gold: Math.round(rew(area.gold) * (0.9 + Math.random() * 0.2)),
      mat: Math.round(rew(area.mat) + (Math.random() < 0.3 ? 1 : 0)),
      fame: Math.max(1, Math.round(rew(area.fame))),
      exp: Math.max(1, Math.round(rew(area.exp))),
      stars: 1 + Math.round(k * 2) + (size >= 3 ? 1 : 0),
      boss: !!o.boss,
    };
  };

  S.bossQuest = () => ({
    id: 'boss', area: 'peak', name: '紅蓮竜王の討伐', monster: 'dragon', count: 1, size: 4,
    req: 1500, dur: 3600, gold: 120000, mat: 80, fame: 600, exp: 600, stars: 5, boss: true,
  });

  // 現在のギルド戦力に合った依頼を1枚作る
  //  ほどよい難しさのエリアを中心に、たまに一段上（憧れ）と一段下（安定）を混ぜる
  S.comfortArea = function (s = G.state) {
    const areas = S.unlockedAreas(s);
    const pows = s.adv.map((a) => S.power(a, s)).sort((a, b) => b - a);
    let comfy = 0;
    areas.forEach((ar, i) => {
      const size = Math.min(ar.size, Math.max(1, pows.length));
      const cap = pows.slice(0, size).reduce((x, y) => x + y, 0);
      const req = G.lerp(ar.pow[0], ar.pow[1], 0.5) * [0, 0.55, 0.85, 1, 1.25][size];
      if (cap / req >= 0.95) comfy = i;
    });
    return { areas, comfy };
  };
  S.genQuest = function (s = G.state) {
    const { areas, comfy } = S.comfortArea(s);
    let idx = comfy;
    const r = Math.random();
    if (r < 0.22 && comfy + 1 < areas.length) idx = comfy + 1;
    else if (r < 0.45 && comfy > 0) idx = comfy - 1;
    return S.makeQuest(areas[idx].index);
  };
  // 掲示板が手に負えない依頼ばかりなら、受けられる依頼に差し替える
  S.ensureDoable = function (s = G.state) {
    if (!s.adv.length) return;
    const all = s.adv;
    const ok = s.board.some((q) => !q.boss && S.bestParty(q, all, 'lean', s).length > 0);
    if (ok || !s.board.length) return;
    const { areas, comfy } = S.comfortArea(s);
    const i = s.board.findIndex((q) => !q.boss);
    if (i >= 0) s.board[i] = S.makeQuest(areas[comfy].index, { k: 0.15 });
  };
  S.canDo = function (q, s = G.state) {
    const idle = s.adv.filter((a) => a.status === 'idle');
    const pick = S.bestParty(q, idle, 'max', s);
    return pick.length && S.partyInfo(q, pick, s).p >= 0.6;
  };

  // パーティ選び
  //  max  : 枠いっぱいまで強い順（手動の「おまかせ」）
  //  lean : 成功率85%に届く最小人数（自動派遣）
  S.bestParty = function (q, pool, mode = 'max', s = G.state) {
    const sorted = pool.slice().sort((a, b) => S.power(b, s) - S.power(a, s));
    if (mode === 'max') {
      const pick = sorted.slice(0, q.size);
      // 僧侶を入れて上がるなら入れ替え
      if (!pick.some((a) => a.cls === 'cleric')) {
        const cl = sorted.find((a) => a.cls === 'cleric' && !pick.includes(a));
        if (cl && pick.length === q.size) {
          const alt = pick.slice(0, -1).concat(cl);
          if (S.partyInfo(q, alt, s).p > S.partyInfo(q, pick, s).p) return alt;
        }
      }
      return pick;
    }
    // lean: 弱い順に足していき、目標に届いたら止める
    const asc = sorted.slice().reverse();
    for (let n = 1; n <= q.size; n++) {
      // n人の組み合わせで、なるべく弱いメンバー構成
      for (let i = 0; i + n <= asc.length; i++) {
        const pick = asc.slice(i, i + n);
        if (S.partyInfo(q, pick, s).p >= 0.8) return pick;
      }
    }
    return [];
  };

  S.dispatch = function (questId, partyIds, at, s = G.state) {
    const qi = s.board.findIndex((q) => q.id === questId);
    if (qi < 0) return null;
    if (S.busy(s) >= S.slots(s)) return null;
    const party = partyIds.map((id) => s.adv.find((a) => a.id === id)).filter((a) => a && a.status === 'idle');
    if (!party.length) return null;
    const q = s.board[qi];
    const info = S.partyInfo(q, party, s);
    const t0 = at || G.now();
    const ex = { q, party: party.map((a) => a.id), startAt: t0, endAt: t0 + info.dur, p: info.p };
    party.forEach((a) => { a.status = 'away'; a.questId = q.id; });
    s.board.splice(qi, 1);
    s.active.push(ex);
    s.stats.quests++;
    G.emit('dispatch', ex);
    return ex;
  };

  // ---------------------------------------------------------------- 深淵の迷宮
  //  1階ずつ攻略する。10階ごとに守護者。深いほど強い装備（アイテムLv 最大150）が出る。
  //  ふつうの派遣枠とは別の「迷宮枠」1つ。自動派遣は迷宮に行かない。
  S.ABYSS_MAX = 100;
  const ABYSS_MON = ['slime', 'rabbit', 'wolf', 'mushroom', 'bat', 'golem', 'skeleton', 'knight', 'wyvern', 'dragon'];
  const ABYSS_GUARD = ['golem', 'knight', 'wyvern', 'dragon'];
  S.abyssIlv = (f) => Math.min(150, 40 + Math.round(f * 1.1));
  S.abyss = (s = G.state) => {
    if (!s.abyss) s.abyss = { open: false, floor: 1, best: 0 };
    if (!s.abyss.open && s.rank >= D.ABYSS.rank) s.abyss.open = true;
    return s.abyss;
  };
  S.abyssQuest = function (f, farm) {
    f = G.clamp(f | 0, 1, S.ABYSS_MAX);
    const guard = f % 10 === 0;
    const mon = guard ? ABYSS_GUARD[(f / 10 - 1) % ABYSS_GUARD.length] : ABYSS_MON[Math.min(9, Math.floor((f - 1) / 12) + ((f * 7) % 3))];
    const md = D.MONSTERS[mon];
    return {
      id: 'abyss-' + f + (farm ? 'f' : ''),
      area: 'abyss', abyss: f, farm: !!farm, guardian: guard,
      name: guard ? `B${f}F 守護者・${md.name}` : `B${f}F ${md.name}の巣`,
      monster: mon,
      count: guard ? 1 : 2 + (f % 2),
      size: 4,
      req: Math.round(260 * Math.pow(1.045, f - 1) * (guard ? 1.25 : 1)),
      dur: Math.round((240 + f * 6) * (guard ? 1.4 : 1)),
      gold: Math.round(700 * Math.pow(1.048, f - 1) * (guard ? 2 : 1)),
      mat: 4 + Math.floor(f / 5) + (guard ? 6 : 0),
      fame: 12 + f * 2,
      exp: Math.round((60 + f * 9) * (guard ? 1.5 : 1)),
      stars: Math.min(5, 3 + Math.floor(f / 34)),
      boss: false,
    };
  };
  S.abyssActive = (s = G.state) => s.active.find((e) => e.abyss) || null;
  // 次に挑む階（farm=true：最深の階で稼ぐ）
  S.abyssNext = function (farm, s = G.state) {
    const ab = S.abyss(s);
    if (farm || ab.floor > S.ABYSS_MAX) return S.abyssQuest(Math.max(1, Math.min(ab.best, S.ABYSS_MAX)), true);
    return S.abyssQuest(ab.floor, false);
  };
  S.dispatchAbyss = function (partyIds, farm, at, s = G.state) {
    const ab = S.abyss(s);
    if (!ab.open || S.abyssActive(s)) return null;
    if (farm && ab.best < 1) return null;
    const party = partyIds.map((id) => s.adv.find((a) => a.id === id)).filter((a) => a && a.status === 'idle');
    if (!party.length) return null;
    const q = S.abyssNext(farm, s);
    q.id += '-' + Math.floor((at || G.now()) * 1000).toString(36);
    const info = S.partyInfo(q, party, s);
    const t0 = at || G.now();
    const ex = { q, party: party.map((a) => a.id), startAt: t0, endAt: t0 + info.dur, p: info.p, abyss: true };
    party.forEach((a) => { a.status = 'away'; a.questId = q.id; });
    s.active.push(ex);
    s.stats.quests++;
    s.stats.abyssRuns = (s.stats.abyssRuns || 0) + 1;
    G.emit('dispatch', ex);
    return ex;
  };

  // 遠征の結果を決める
  S.resolve = function (ex, s = G.state) {
    const party = ex.party.map((id) => s.adv.find((a) => a.id === id)).filter(Boolean);
    const q = ex.q;
    const info = S.partyInfo(q, party, s);
    const area = D.AREA_BY_ID[q.area];
    let tier;
    if (Math.random() < info.p) {
      const r = Math.random();
      const legendP = 0.018 + party.filter((a) => a.trait === 'lucky').length * 0.012 + s.fac.alchemy * 0.004 + (G.events ? G.events.bonus('legend') : 0);
      tier = r < legendP ? 'legend' : r < legendP + info.great ? 'great' : 'ok';
    } else tier = 'fail';
    if (q.boss && tier !== 'fail') tier = 'legend';
    // 深淵：初めて越えた階なら記録を更新
    let firstClear = false;
    if (q.abyss) {
      const ab = S.abyss(s);
      if (tier !== 'fail' && !q.farm && q.abyss >= ab.floor) {
        ab.best = Math.max(ab.best, q.abyss);
        ab.floor = q.abyss + 1;
        firstClear = true;
      }
    }
    const mul = { fail: info.warrior ? 0.5 : 0.25, ok: 1, great: 2, legend: 5 }[tier];
    const matMul = { fail: 0, ok: 1, great: 2, legend: 3 }[tier];
    const tidy = party.filter((a) => a.trait === 'tidy').length;
    // 黄金の祝福（帰ってきた時刻に効いていればゴールド2倍）
    const gb = G.items && s.boosts && s.boosts.gold && s.boosts.gold.until > ex.endAt && s.boosts.gold.from <= ex.endAt ? s.boosts.gold.mult : 1;
    const gold = Math.round(q.gold * mul * info.goldMul * gb * G.rand(0.92, 1.08));
    let mat = q.mat * matMul * info.matMul;
    mat = Math.floor(mat) + (Math.random() < mat - Math.floor(mat) ? 1 : 0);
    mat += (tier !== 'fail' ? tidy : 0) + (tier === 'legend' ? 3 : 0);
    const feast = s.boosts && s.boosts.feast && s.boosts.feast.until > ex.endAt && s.boosts.feast.from <= ex.endAt ? s.boosts.feast : null;
    const fame = tier === 'fail' ? 0 : Math.round(q.fame * (tier === 'legend' ? 3 : tier === 'great' ? 1.5 : 1) * (1 + S.starFx('fame', s)) * (info.fameMul || 1) * S.runFame(s) * (feast ? 1 + feast.add : 1));
    const expMul = (tier === 'fail' ? 0.5 : tier === 'great' ? 1.5 : tier === 'legend' ? 3 : 1) * (1 + 0.12 * s.fac.training) * info.expMul * (feast ? 1 + feast.add : 1);
    // 経験値はその場で反映（帰ってきた時には強くなっている）
    const levelUps = [];
    const topLv = Math.max(1, ...s.adv.map((x) => x.lv));
    party.forEach((a) => {
      const before = a.lv;
      // 熟練：その職業で依頼を成功させるほど上がる
      if (tier !== 'fail') {
        a.mast = a.mast || {};
        const st0 = S.mastStars(a, a.cls);
        a.mast[a.cls] = (a.mast[a.cls] || 0) + (q.abyss ? 2 : 1);
        const st1 = S.mastStars(a, a.cls);
        if (st1 > st0) G.emit('mastery', { a, cls: a.cls, stars: st1 });
      }
      S.gainExp(a, Math.round(q.exp * expMul * (a.trait === 'sleepy' ? 1.1 : 1) * S.catchup(a, topLv)), s);
      if (a.lv > before) levelUps.push({ id: a.id, name: a.name, to: a.lv });
      a.status = 'idle';
      a.questId = null;
      a.returnAt = ex.endAt;
    });
    // おまけの出来事
    let extra = null;
    if (tier !== 'fail' && !q.boss) {
      const r = Math.random();
      const freeBed = s.adv.length + s.cands.filter((c) => c.free).length < S.beds(s);
      if (r < (tier === 'legend' ? 0.5 : 0.08) && freeBed) extra = 'recruit';
      else if (r < 0.16) extra = 'cache';
    }
    const bonusMat = extra === 'cache' ? G.randi(1, 2 + area.index) : 0;
    // 統計
    s.stats[tier === 'ok' ? 'success' : tier]++;
    if (tier !== 'fail') {
      if (tier !== 'ok') s.stats.success++;
      s.stats.areaWin[q.area] = (s.stats.areaWin[q.area] || 0) + 1;
      if (q.boss) { s.stats.boss = (s.stats.boss || 0) + 1; s.flags.runBoss = true; }
    }
    // 戦利品（宝箱の中身）。竜王は必ず最上級
    let drop = null;
    if (G.items) {
      if (q.boss) drop = G.items.make(Math.random, 4, { noRelic: true, tid: 'sword' });
      else if (q.abyss) {
        const ilv = S.abyssIlv(q.abyss);
        const cls = party.length && Math.random() < 0.55 ? G.pick(party).cls : null;
        // 守護者は必ず SR 以上、ふつうの階も落としやすい
        if (q.guardian && tier !== 'fail') drop = G.items.make(Math.random, Math.max(2, G.items.rollRarity(Math.random, 'legend', 4, info.find)), { cls, ilv });
        else drop = G.items.rollDrop(Math.random, tier, 4, party, info.find + 25, { ilv });
      } else drop = G.items.rollDrop(Math.random, tier, area.index, party, info.find);
    }
    const loot = G.items && tier !== 'fail' ? G.items.rollLoot(Math.random, tier, area.index, info.find) : [];
    // お祭りのかぼちゃ飴
    const candy = G.events ? G.events.dropFor(tier, area.index) * (q.monster === 'pumpkin' ? 2 : 1) : 0;
    if (candy) { const e = loot.find((x) => x.id === 'candy'); if (e) e.n += candy; else loot.push({ id: 'candy', n: candy }); }
    if (q.abyss && tier !== 'fail') {
      const add = (id, n) => { const e = loot.find((x) => x.id === id); if (e) e.n += n; else loot.push({ id, n }); };
      if (firstClear) add('cry', q.guardian ? 50 : 3);
      if (q.guardian && (firstClear || Math.random() < 0.25)) add('shard', firstClear ? 2 : 1);
      add('stone', 2 + Math.floor(q.abyss / 10));
    }
    const reel = G.reels.make({ q, party, tier, gold, mat: mat + bonusMat, fame, levelUps, extra, endAt: ex.endAt, drop, loot, goldBoost: gb > 1 ? gb : 0, firstClear });
    s.reels.push(reel);
    if (s.reels.length > 60) S.compactReels(s);
    G.emit('resolved', { ex, reel, party });
    return reel;
  };

  S.gainExp = function (a, n, s = G.state) {
    a.exp += n;
    let guard = 0;
    while (a.exp >= S.expNeed(a.lv) && a.lv < 60 && guard++ < 100) {
      a.exp -= S.expNeed(a.lv);
      a.lv++;
    }
  };

  // 未視聴が溜まりすぎたら、古いものを「留守中のまとめ」に畳む
  S.compactReels = function (s) {
    const unseen = s.reels.filter((r) => !r.claimed);
    if (unseen.length <= 40) {
      s.reels = s.reels.filter((r) => !r.claimed).concat(s.reels.filter((r) => r.claimed).slice(-10));
      return;
    }
    const fold = unseen.slice(0, unseen.length - 39);
    const keep = unseen.slice(unseen.length - 39);
    let digest = keep.find((r) => r.digest);
    const sum = { gold: 0, mat: 0, fame: 0, n: 0 };
    fold.forEach((r) => {
      if (r.digest) { sum.gold += r.gold; sum.mat += r.mat; sum.fame += r.fame; sum.n += r.n; return; }
      sum.gold += r.gold; sum.mat += r.mat; sum.fame += r.fame; sum.n++;
    });
    if (!digest) {
      digest = G.reels.makeDigest(sum);
      keep.unshift(digest);
    } else {
      digest.gold += sum.gold; digest.mat += sum.mat; digest.fame += sum.fame; digest.n += sum.n;
    }
    s.reels = keep;
  };

  // 冒険譚を見た（＝報酬受け取り）
  S.claimReel = function (reel, bonus = 0, s = G.state, opts = {}) {
    if (!reel || reel.claimed) return null;
    reel.claimed = true;
    const mul = 1 + bonus;
    const gold = Math.round(reel.gold * mul);
    const mat = reel.mat;
    s.gold += gold;
    s.mat += mat;
    s.fame += reel.fame;
    s.stats.goldEarned += gold;
    s.stats.matGot = (s.stats.matGot || 0) + mat;
    s.stats.reels++;
    if (reel.tier === 'legend') s.stats.legendSeen = (s.stats.legendSeen || 0) + 1;
    if (reel.monster) s.seenMonsters[reel.monster] = Math.max(s.seenMonsters[reel.monster] || 0, { fail: 1, ok: 1, great: 2, legend: 3 }[reel.tier]);
    // お宝（宝箱・投げ銭）と、閃いた技
    const got = [];
    // マスターのナイス指示：宝のレア度がひとつ上がることがある
    if (G.items && opts.nice > 0 && reel.drop && reel.drop.kind === 'equip' && reel.drop.rarity < 4 && Math.random() < Math.min(0.5, 0.25 * opts.nice)) {
      const d = reel.drop;
      const up = G.items.make(Math.random, d.rarity + 1, { tid: d.tid, ilv: d.ilv, noRelic: true });
      up.niceUp = true;
      reel.drop = up;
      s.stats.niceUp = (s.stats.niceUp || 0) + 1;
    }
    if (G.items) {
      if (reel.drop) { const r = G.items.add(reel.drop); got.push(Object.assign({}, reel.drop, r)); }
      // 町の人からの贈り物は、見届けたときだけ
      if (opts.gifts !== false) (reel.cm || []).forEach((c) => { if (c.gift) { const r = G.items.add(c.gift); got.push(Object.assign({}, c.gift, r)); } });
      (reel.loot || []).forEach((l) => G.items.addCons(l.id, l.n));
      s.stats.items = (s.stats.items || 0) + got.length;
      s.itemsNew = (s.itemsNew || 0) + got.length;
    }
    // 魔晶石
    const cry = (reel.boss ? 100 : 0) + ({ fail: 0, ok: 0, great: 2, legend: 10 }[reel.tier] || 0);
    if (cry) s.crystals = (s.crystals || 0) + cry;
    if (reel.skill) {
      const a = s.adv.find((x) => x.id === reel.skill.id);
      if (a && G.items) {
        G.items.learnSkill(a, reel.skill.name);
        s.stats.skills = (s.stats.skills || 0) + 1;
      }
    }
    if (reel.extra === 'recruit' && reel.recruit) {
      const c = reel.recruit;
      c.free = true;
      c.price = 0;
      s.cands.unshift(c);
      if (s.cands.length > 4) s.cands.pop();
    }
    const ranked = S.checkRank(s);
    got.forEach((it) => { if (it.rarity >= 2 && !it.dup) G.emit('rareItem', it); });
    G.emit('claimed', reel);
    return { gold, mat, fame: reel.fame, ranked, items: got, crystals: cry };
  };

  S.checkRank = function (s = G.state) {
    let up = 0;
    while (s.rank < D.MAX_RANK && s.fame >= D.RANK_FAME[s.rank]) {
      s.rank++;
      up++;
    }
    if (up) {
      s.crystals = (s.crystals || 0) + 30 * up;
      s.runRank = S.recordRank(s);
      // ランク5：受付嬢のおまかせ札をはじめてもらえる
      if (s.rank >= 5 && !s.flags.autoGift && G.items) { s.flags.autoGift = 1; G.items.addCons('auto30', 3); G.items.addCons('auto180', 1); }
      G.emit('rankup', s.rank);
      const ab = S.abyss(s);
      if (ab.open && !s.flags.abyssNoticed) { s.flags.abyssNoticed = true; G.emit('abyssOpen'); }
      if (s.rank >= 10 && !s.flags.bossUnlocked) {
        s.flags.bossUnlocked = true;
        s.board.unshift(S.bossQuest());
      }
    }
    return up;
  };

  // ---------------------------------------------------------------- 転生「ギルドの再建」と灯火の星
  //  ランク8から、ギルドを建て直せる。名声などに応じて「灯火の星」が手に入り、
  //  星座を灯すとずっと強くなる（新しい職業・新しい土地もここで開く）。
  S.REBIRTH_RANK = 8;
  S.STAR_NODES = [
    { id: 'start', short: '再出発', name: '再出発の灯', max: 5, base: 3, inc: 2, x: 50, y: 7, from: 'pow', desc: (l) => `再建時のゴールド +${G.fmt(2000 * l)}${l >= 2 ? '・宿舎Lv2から' : ''}${l >= 4 ? '・受付ホールLv2から' : ''}` },
    { id: 'pow', short: '戦力', name: '戦力の灯', max: 25, base: 1, inc: 1, per: 0.08, x: 50, y: 27, desc: (l) => `全員の戦力 +${Math.round(l * 8)}%` },
    { id: 'great', short: '幸運', name: '幸運の灯', max: 10, base: 2, inc: 1, per: 0.01, x: 23, y: 39, desc: (l) => `大成功率 +${l}%` },
    { id: 'gold', short: '黄金', name: '黄金の灯', max: 20, base: 1, inc: 1, per: 0.1, x: 77, y: 39, desc: (l) => `依頼のゴールド +${l * 10}%` },
    { id: 'speed', short: '疾風', name: '疾風の灯', max: 10, base: 2, inc: 1, per: 0.03, x: 23, y: 65, desc: (l) => `遠征時間 -${l * 3}%` },
    { id: 'exp', short: '叡智', name: '叡智の灯', max: 15, base: 1, inc: 1, per: 0.1, x: 77, y: 65, desc: (l) => `獲得経験値 +${l * 10}%` },
    { id: 'fame', short: '名声', name: '名声の灯', max: 15, base: 2, inc: 1, per: 0.12, x: 50, y: 77, desc: (l) => `獲得名声 +${l * 12}%` },
    { id: 'build', short: '匠', name: '匠の灯', max: 10, base: 1, inc: 1, per: 0.04, x: 12, y: 18, from: 'great', desc: (l) => `施設の費用 -${l * 4}%` },
    { id: 'find', short: '宝探し', name: '宝探しの灯', max: 15, base: 2, inc: 1, per: 6, x: 88, y: 18, from: 'gold', desc: (l) => `レア発見 +${l * 6}%` },
    { id: 'harbor', short: '潮風の港', name: '新天地「潮風の港」', max: 1, base: 5, inc: 0, x: 9, y: 90, from: 'speed', unlock: true, desc: () => 'エリア「潮風の港」が開く（ランク9から・竜嶺のその先）' },
    { id: 'sky', short: '天空城', name: '新天地「天空城」', max: 1, base: 15, inc: 0, x: 27, y: 103, from: 'harbor', unlock: true, desc: () => 'エリア「天空城」が開く（ランク10から・最難関）' },
    { id: 'knight', short: '騎士', name: '新職業「騎士」', max: 1, base: 3, inc: 0, x: 91, y: 90, from: 'exp', unlock: true, desc: () => '職業「騎士」が求職者に来るようになる' },
    { id: 'bard', short: '吟遊詩人', name: '新職業「吟遊詩人」', max: 1, base: 6, inc: 0, x: 73, y: 103, from: 'knight', unlock: true, desc: () => '職業「吟遊詩人」が求職者に来るようになる' },
    { id: 'memory', short: '記憶', name: '記憶の灯', max: 3, base: 6, inc: 6, x: 31, y: 9, from: 'start', desc: (l) => `再建しても、建てていた施設が Lv${l} から始まる` },
    { id: 'veteran', short: '古参', name: '古参の灯', max: 5, base: 4, inc: 3, x: 69, y: 9, from: 'start', desc: (l) => `再建しても、残る冒険者がレベルの ${l * 10}% を持ち越す` },
    { id: 'autostar', short: 'おまかせ', name: 'おまかせの灯', max: 3, base: 3, inc: 3, x: 8, y: 53, from: 'speed', desc: (l) => `再建のたびに おまかせ札（3時間）×${l}` },
    { id: 'alch', short: '錬金術師', name: '新職業「錬金術師」', max: 1, base: 10, inc: 0, x: 50, y: 99, from: 'fame', unlock: true, desc: () => '職業「錬金術師」が求職者に来るようになる' },
  ];
  const NODE = {};
  S.STAR_NODES.forEach((n) => (NODE[n.id] = n));
  S.STAR_NODE = NODE;
  S.prestige = (s = G.state) => s.prestige || (s.prestige = { stars: 0, total: 0, runs: 0, tree: {}, abyssAt: 0 });
  S.starLv = (id, s = G.state) => (s && s.prestige && s.prestige.tree[id]) || 0;
  // 星の効果（＋この周回の遺物・試練の札）
  S.starFx = (key, s = G.state) => { const n = NODE[key]; return (s && n && n.per ? n.per * S.starLv(key, s) : 0) + (G.trail && s === G.state ? G.trail.fx(key) : 0); };
  S.starCost = (id, s = G.state) => { const n = NODE[id]; return n.base + n.inc * S.starLv(id, s); };
  S.starOpen = (id, s = G.state) => { const n = NODE[id]; return !n.from || S.starLv(n.from, s) > 0; };
  S.buyStar = function (id, s = G.state) {
    const n = NODE[id];
    const pr = S.prestige(s);
    if (!n || S.starLv(id, s) >= n.max) return { ok: false, why: 'max' };
    if (!S.starOpen(id, s)) return { ok: false, why: 'locked' };
    const c = S.starCost(id, s);
    if (pr.stars < c) return { ok: false, why: 'stars' };
    pr.stars -= c;
    pr.tree[id] = S.starLv(id, s) + 1;
    G.emit('starBought', id);
    return { ok: true, lv: pr.tree[id] };
  };
  S.canRebirth = (s = G.state) => s.rank >= S.REBIRTH_RANK;
  // 周回の記録：今回の周回が始まった時刻と、各ランクに届いた時間。ランクごとの最速は灯火の星と一緒に残る
  S.newRun = (s = G.state, n) => ({ n: n || ((s.prestige && s.prestige.runs) || 0) + 1, start: G.now(), ranks: {}, q0: (s.stats && s.stats.quests) || 0, g0: (s.stats && s.stats.goldEarned) || 0 });
  S.run = (s = G.state) => s.run || (s.run = S.newRun(s));
  S.runSec = (s = G.state) => Math.max(0, G.now() - S.run(s).start);
  S.recordRank = function (s = G.state) {
    const run = S.run(s), pr = S.prestige(s);
    pr.best = pr.best || {};
    const sec = Math.round(S.runSec(s));
    if (run.ranks[s.rank] != null) return null;
    run.ranks[s.rank] = sec;
    const prev = pr.best[s.rank];
    // 初めての周回は記録だけ（比べる相手がいない）
    if (prev == null || sec < prev) { pr.best[s.rank] = sec; return { sec, prev, best: prev != null }; }
    return { sec, prev, best: false };
  };
  // 再建を重ねるほど、名声が集まりやすい（1回ごとに +10%、最大 +100%）
  S.runFame = (s = G.state) => 1 + 0.1 * Math.min(10, (s.prestige && s.prestige.runs) || 0);
  // 宴：ゴールドを使って、20分間 名声と経験値 +25%（終盤のゴールドの使い道）
  S.FEAST_SEC = 1200;
  S.feastCost = (s = G.state) => Math.round(600 * Math.pow(1.62, s.rank - 1));
  S.feast = function (s = G.state) {
    if (s.fac.tavern < 1) return { ok: false, why: 'tavern' };
    const c = S.feastCost(s);
    if (s.gold < c) return { ok: false, why: 'gold' };
    s.gold -= c;
    s.boosts = s.boosts || {};
    const now = G.now();
    const cur = s.boosts.feast && s.boosts.feast.until > now ? s.boosts.feast : null;
    s.boosts.feast = { add: 0.25, mult: 1, from: cur ? cur.from : now, until: (cur ? cur.until : now) + S.FEAST_SEC, src: 'feast' };
    s.stats.feasts = (s.stats.feasts || 0) + 1;
    G.emit('boost', 'feast');
    return { ok: true, cost: c };
  };
  S.rebirthStars = function (s = G.state) {
    const pr = S.prestige(s);
    const fame = Math.floor(Math.sqrt(Math.max(0, s.fame)) / 4);
    const boss = s.flags.runBoss ? 10 : 0;
    const abyss = Math.floor(Math.max(0, S.abyss(s).best - (pr.abyssAt || 0)) / 5);
    const base = fame + boss + abyss;
    // 星詠みの書：再建で手に入る星 +20%
    const book = G.pay && G.pay.perm('starbook') ? Math.floor(base * 0.2) : 0;
    // 試練の札：自分で難しくした周回は、星が多い
    const trial = G.trail && s === G.state ? Math.floor(base * G.trail.trialStars()) : 0;
    return { fame, boss, abyss, book, trial, total: base + book + trial };
  };
  S.rebirth = function (s = G.state) {
    if (!S.canRebirth(s)) return null;
    const pr = S.prestige(s);
    const now = G.now();
    const earned = S.rebirthStars(s).total;
    const run = S.run(s);
    pr.lastRun = { n: run.n, sec: Math.round(S.runSec(s)), rank: s.rank, quests: (s.stats.quests || 0) - (run.q0 || 0), gold: (s.stats.goldEarned || 0) - (run.g0 || 0), stars: earned, at: now };
    if ((run.trials || []).length) { pr.lastRun.trials = run.trials.slice(); pr.trialsDone = (pr.trialsDone || 0) + run.trials.length; }
    pr.lastRun.relics = (run.relics || []).length;
    pr.history = (pr.history || []).concat([pr.lastRun]).slice(-10);
    const prevFac = Object.assign({}, s.fac);
    pr.stars += earned;
    pr.total += earned;
    pr.runs++;
    pr.abyssAt = Math.max(pr.abyssAt || 0, S.abyss(s).best);
    // 見ていない冒険譚は受け取り済みに（見届けボーナスなし）、遠征中は結果なしで帰還
    s.reels.filter((r) => !r.claimed).forEach((r) => S.claimReel(r, 0, s, { gifts: false }));
    s.reels = s.reels.slice(-10);
    s.active = [];
    const startLv = S.starLv('start', s);
    s.gold = 300 + 2000 * startLv;
    s.mat = 5 * startLv;
    s.fame = 0;
    s.rank = 1;
    s.fac = { hall: startLv >= 4 ? 2 : 1, bunks: startLv >= 2 ? 2 : 1, tavern: 0, smithy: 0, training: 0, alchemy: 0, tower: 0 };
    // 記憶の灯：建てていた施設は、そのレベルから
    const mem = S.starLv('memory', s);
    if (mem) Object.keys(s.fac).forEach((id) => { if (prevFac[id] > 0) s.fac[id] = Math.max(s.fac[id], Math.min(prevFac[id], mem)); });
    s.building = null;
    s.board = [];
    s.boardAt = now;
    s.refreshAt = 0;
    s.tips = [];
    s.deskCoins = 0;
    s.deskAt = now;
    s.obj = 0;
    s.flags.autoDispatch = false;
    s.flags.bossUnlocked = false;
    s.flags.runBoss = false;
    // 冒険者：レベルの高い順にベッドの数だけ残る。ほかは「かつての仲間」として、いつでも呼び戻せる
    const reset = (a) => { a.lv = 1; a.exp = 0; a.status = 'idle'; a.questId = null; a._tx = 0; return a; };
    const vet = S.starLv('veteran', s) * 0.1;
    const keep = (a) => { const lv = Math.max(1, Math.round(a.lv * vet)); reset(a); a.lv = lv; return a; };
    const sorted = s.adv.slice().sort((a, b) => b.lv - a.lv);
    const beds = D.beds(s.fac.bunks);
    s.adv = sorted.slice(0, beds).map(keep);
    s.alumni = (s.alumni || []).concat(sorted.slice(beds).map((a) => { reset(a); a.eq = {}; return a; }));
    s.cands = [];
    S.rollCandidates(s, false);
    for (let i = 0; i < 3; i++) s.board.push(S.makeQuest(0, { size: Math.min(2, i + 1), k: 0.3 + i * 0.2 }));
    s.stats.rebirths = (s.stats.rebirths || 0) + 1;
    const au = S.starLv('autostar', s);
    if (au && G.items) G.items.addCons('auto180', au);
    s.run = S.newRun(s, pr.runs + 1);
    s.flags.justReborn = earned;
    s.lastSeen = now;
    s.speedCursor = now;
    G.emit('rebirth', { earned });
    return { earned };
  };
  // かつての仲間を呼び戻す（無料）
  S.recall = function (id, s = G.state) {
    const i = (s.alumni || []).findIndex((a) => a.id === id);
    if (i < 0) return { ok: false, why: 'none' };
    if (s.adv.length >= S.beds(s)) return { ok: false, why: 'beds' };
    const a = s.alumni.splice(i, 1)[0];
    a.status = 'idle';
    a.hiredAt = G.now();
    s.adv.push(a);
    G.emit('hired', a);
    return { ok: true, adv: a };
  };

  // ---------------------------------------------------------------- 熟練・転職・継承・伸び盛り
  //  熟練：職業ごとに、依頼を成功させた回数で ★1〜★5。★の合計ぶん戦力が上がる（1つ +2%）
  //    ★3：その職業の技を「継承スキル」として、ほかの職業でも1つ使える
  //    ★5：その職業の特技（僧侶の成功率など）を、転職しても持ち続ける
  //  転職：Lv10 から。レベルはそのまま、職業だけ変わる（覚えた技は職業ごとに残る）
  //  継承：Lv15 以上の冒険者が引退し、経験・熟練の一部と技を後輩に託す。引退した人は殿堂へ
  //  伸び盛り：ギルドで一番強い人の 3/4 に届かない冒険者は、経験値 2.5倍
  S.MAST_STEPS = [5, 20, 50, 100, 200];
  S.mastStars = (a, cls) => { const q = (a.mast && a.mast[cls]) || 0; let n = 0; S.MAST_STEPS.forEach((v) => { if (q >= v) n++; }); return n; };
  S.mastTotal = (a) => (a.mast ? Object.keys(a.mast).reduce((x, c) => x + S.mastStars(a, c), 0) : 0);
  S.mastNext = (a, cls) => { const q = (a.mast && a.mast[cls]) || 0; const nx = S.MAST_STEPS.find((v) => q < v); return { q, next: nx || null }; };
  S.hasPerk = (a, cls) => a.cls === cls || S.mastStars(a, cls) >= 5;
  S.hallBonus = (s = G.state) => Math.min(0.1, ((s && s.hall) || []).length * 0.01);
  S.catchup = (a, top) => (a.lv < top * 0.75 ? 2.5 : 1);
  S.isGrowing = (a, s = G.state) => S.catchup(a, Math.max(1, ...s.adv.map((x) => x.lv))) > 1;
  S.CHANGE_LV = 10;
  S.changeCost = (a) => Math.round(200 + a.lv * a.lv * 12);
  S.changeClass = function (a, cls, s = G.state) {
    if (a.cls === cls) return { ok: false, why: 'same' };
    if (a.lv < S.CHANGE_LV) return { ok: false, why: 'lv' };
    if (a.status !== 'idle') return { ok: false, why: 'away' };
    if (!S.unlockedClasses(s).includes(cls)) return { ok: false, why: 'locked' };
    const c = S.changeCost(a);
    if (s.gold < c) return { ok: false, why: 'gold' };
    s.gold -= c;
    a.skBy = a.skBy || {};
    a.setBy = a.setBy || {};
    a.skBy[a.cls] = a.sk || {};
    a.setBy[a.cls] = a.skillSet || [];
    const from = a.cls;
    a.cls = cls;
    a.sk = a.skBy[cls] || {};
    a.skillSet = (a.setBy[cls] || []).filter((n) => a.sk[n]);
    a.look.cls = cls;
    a.look.outfit = G.shade(D.CLASSES[cls].color, G.rand(-0.1, 0.06));
    if (cls === 'knight' && !a.look.crest) a.look.crest = G.pick(['#3a5aa0', '#c4553a', '#e2b84a', '#5a9a6a']);
    // 職業に合わない武器ははずす（倉庫へ）
    if (G.items && a.eq && a.eq.weapon) { const w = G.items.get(a.eq.weapon); if (w && !G.items.fits(w, a)) a.eq.weapon = null; }
    if (a.cross && a.cross.cls === cls) a.cross = null;
    s.stats.classChanges = (s.stats.classChanges || 0) + 1;
    G.emit('classChanged', { a, from });
    return { ok: true, from, cost: c };
  };
  // 継承スキル：★3 以上の、いまと違う職業で覚えた技から1つ
  S.crossOptions = function (a) {
    const out = [];
    Object.keys(a.skBy || {}).forEach((c) => {
      if (c === a.cls) return;
      if (S.mastStars(a, c) < 3) return;
      Object.keys(a.skBy[c] || {}).forEach((n) => out.push({ cls: c, name: n, lv: a.skBy[c][n] }));
    });
    if (a.cross && a.cross.gift && a.cross.cls !== a.cls && !out.some((o) => o.cls === a.cross.cls && o.name === a.cross.name)) out.push({ cls: a.cross.cls, name: a.cross.name, lv: ((a.skBy || {})[a.cross.cls] || {})[a.cross.name] || 1, gift: true });
    return out;
  };
  S.setCross = function (a, cls, name) {
    if (!cls) { a.cross = null; G.emit('itemsChanged'); return true; }
    const o = S.crossOptions(a).find((x) => x.cls === cls && x.name === name);
    if (!o) return false;
    a.cross = { cls, name, gift: !!o.gift };
    G.emit('itemsChanged');
    return true;
  };
  S.totalExp = (a) => { let e = a.exp; for (let l = 1; l < a.lv; l++) e += S.expNeed(l); return e; };
  S.INHERIT_LV = 15;
  S.inheritPreview = function (A, B) {
    const c = { lv: B.lv, exp: B.exp };
    S.gainExp(c, Math.round(S.totalExp(A) * 0.6));
    return c.lv;
  };
  S.inherit = function (fromId, toId, s = G.state) {
    const A = s.adv.find((x) => x.id === fromId), B = s.adv.find((x) => x.id === toId);
    if (!A || !B || A === B) return { ok: false, why: 'none' };
    if (A.lv < S.INHERIT_LV) return { ok: false, why: 'lv' };
    if (A.status !== 'idle' || B.status !== 'idle') return { ok: false, why: 'away' };
    const before = B.lv;
    S.gainExp(B, Math.round(S.totalExp(A) * 0.6), s);
    B.mast = B.mast || {};
    Object.entries(A.mast || {}).forEach(([c, q]) => { B.mast[c] = (B.mast[c] || 0) + Math.floor(q / 2); });
    // いちばん育った技を1つ託す（同じ職業ならそのまま、違えば継承スキルに）
    const best = Object.entries(A.sk || {}).sort((x, y) => y[1] - x[1])[0];
    let skill = null;
    if (best) {
      skill = best[0];
      if (A.cls === B.cls) {
        B.sk = B.sk || {};
        B.sk[skill] = Math.max(B.sk[skill] || 0, best[1]);
        B.skillSet = B.skillSet || [];
        if (!B.skillSet.includes(skill) && B.skillSet.length < (G.items ? G.items.skillSlots(B) : 2)) B.skillSet.push(skill);
      } else {
        B.skBy = B.skBy || {};
        B.skBy[A.cls] = B.skBy[A.cls] || {};
        B.skBy[A.cls][skill] = Math.max(B.skBy[A.cls][skill] || 0, best[1]);
        B.cross = { cls: A.cls, name: skill, gift: true };
      }
    }
    B.bond = Math.min(10, (B.bond || 0) + (A.bond || 0) * 0.5);
    A.eq = {};
    s.adv.splice(s.adv.indexOf(A), 1);
    s.hall = s.hall || [];
    s.hall.push({ name: A.name, cls: A.cls, lv: A.lv, look: A.look, trait: A.trait, to: B.name, at: G.now() });
    if (s.hall.length > 40) s.hall.shift();
    s.stats.inherits = (s.stats.inherits || 0) + 1;
    G.emit('dismissed', A);
    G.emit('inherited', { A, B });
    return { ok: true, from: before, to: B.lv, skill };
  };

  // ---------------------------------------------------------------- 求職者
  S.hireCost = function (lv, s = G.state) {
    return Math.round(40 * Math.pow(1.7, Math.max(0, s.adv.length - 1)) * (1 + 0.35 * (lv - 1)));
  };
  S.rollCandidates = function (s = G.state, first) {
    const classes = S.unlockedClasses(s);
    const keep = s.cands.filter((c) => c.free);
    const n = 3 - keep.length;
    const list = [];
    for (let i = 0; i < n; i++) {
      let cls = G.pick(classes);
      // 新しく解放された職業は出やすく
      if (classes.length > 1 && Math.random() < 0.35) cls = classes[classes.length - 1];
      if (first && i === 0) cls = 'warrior';
      const avgLv = s.adv.length ? s.adv.reduce((x, a) => x + a.lv, 0) / s.adv.length : 1;
      const lv = Math.max(1, Math.round(avgLv * G.rand(0.35, 0.8) + G.rand(0, 1.5)));
      const prevG = G.state;
      G.state = s;
      const c = S.makeAdv(cls, lv);
      G.state = prevG;
      c.price = S.hireCost(lv, s);
      list.push(c);
    }
    s.cands = keep.concat(list);
    s.candAt = G.now();
  };
  S.CAND_INTERVAL = 150;

  S.hire = function (candId, s = G.state) {
    const i = s.cands.findIndex((c) => c.id === candId);
    if (i < 0) return { ok: false, why: 'none' };
    const c = s.cands[i];
    if (s.adv.length >= S.beds(s)) return { ok: false, why: 'beds' };
    const price = c.free ? 0 : S.hireCost(c.lv, s);
    if (s.gold < price) return { ok: false, why: 'gold' };
    s.gold -= price;
    s.cands.splice(i, 1);
    c.status = 'idle';
    c.hiredAt = G.now();
    delete c.price;
    delete c.free;
    s.adv.push(c);
    // 残りの値段を更新
    s.cands.forEach((x) => { if (!x.free) x.price = S.hireCost(x.lv, s); });
    G.emit('hired', c);
    return { ok: true, adv: c };
  };

  S.dismiss = function (advId, s = G.state) {
    const i = s.adv.findIndex((a) => a.id === advId);
    if (i < 0 || s.adv[i].status !== 'idle' || s.adv.length <= 1) return false;
    const a = s.adv.splice(i, 1)[0];
    G.emit('dismissed', a);
    return true;
  };

  // ---------------------------------------------------------------- 施設
  S.facCost = (id, s = G.state) => {
    const c = D.FAC[id].cost(s.fac[id]);
    const k = 1 - S.starFx('build', s);
    return { gold: Math.round(c.gold * k), mat: Math.round(c.mat * k) };
  };
  S.canAfford = (c, s = G.state) => s.gold >= c.gold && s.mat >= c.mat;
  S.facState = function (id, s = G.state) {
    const f = D.FAC[id];
    const lv = s.fac[id];
    if (s.building && s.building.id === id) return 'building';
    if (lv >= f.maxLv) return 'max';
    if (s.rank < f.rank) return 'locked';
    if (lv > 0 && s.rank < D.facRankFor(f, lv)) return 'rank';
    // 下の階が建っていないと建てられない
    if (lv === 0) {
      const below = D.FACILITIES[f.floor - 1];
      if (below && s.fac[below.id] === 0) return 'locked';
      if (s.building) return 'busy';
    }
    return lv === 0 ? 'buildable' : 'upgradable';
  };
  S.upgrade = function (id, s = G.state) {
    const st = S.facState(id, s);
    if (st !== 'buildable' && st !== 'upgradable') return { ok: false, why: st };
    const c = S.facCost(id, s);
    if (!S.canAfford(c, s)) return { ok: false, why: 'cost' };
    s.gold -= c.gold;
    s.mat -= c.mat;
    s.stats.upgrades = (s.stats.upgrades || 0) + 1;
    if (st === 'buildable') {
      const dur = D.FAC[id].buildTime;
      s.building = { id, endAt: G.now() + dur, dur };
      G.emit('buildStart', id);
    } else {
      s.fac[id]++;
      G.emit('upgraded', id);
    }
    return { ok: true };
  };

  S.builtFloors = (s = G.state) => D.FACILITIES.filter((f) => s.fac[f.id] > 0).length;

  // ---------------------------------------------------------------- 目標
  S.objective = function (s = G.state) {
    const o = D.OBJECTIVES[s.obj];
    if (!o) return null;
    const [cur, goal] = o.check(s);
    return { o, cur: Math.min(cur, goal), goal, done: cur >= goal };
  };
  S.claimObjective = function (s = G.state) {
    const ob = S.objective(s);
    if (!ob || !ob.done) return null;
    const r = ob.o.reward;
    s.gold += r.gold || 0;
    s.mat += r.mat || 0;
    s.crystals = (s.crystals || 0) + 5;
    s.stats.goldEarned += r.gold || 0;
    s.obj++;
    return r;
  };

  // ---------------------------------------------------------------- 時間を進める
  // now までの出来事を時刻順に処理する。留守中（cap 超過）の自動派遣は止める。
  S.advance = function (now, s = G.state, opts = {}) {
    const capEnd = opts.capEnd || Infinity;
    if (G.items) G.items.applySpeed(now, s);
    let guard = 0;
    const out = { resolved: 0, autoSent: 0, built: null };
    while (guard++ < 2000) {
      // 次の出来事
      let nextT = Infinity, kind = null, idx = -1;
      s.active.forEach((ex, i) => { if (ex.endAt < nextT) { nextT = ex.endAt; kind = 'quest'; idx = i; } });
      if (s.building && s.building.endAt < nextT) { nextT = s.building.endAt; kind = 'build'; }
      const boardNext = s.boardAt + S.BOARD_INTERVAL;
      if (s.board.length < S.boardSize(s) && boardNext < nextT) { nextT = boardNext; kind = 'board'; }
      if (nextT > now) break;
      if (kind === 'quest') {
        const ex = s.active.splice(idx, 1)[0];
        S.resolve(ex, s);
        out.resolved++;
        if (nextT < capEnd && S.autoOn(nextT, s)) out.autoSent += S.autoDispatch(nextT, s);
      } else if (kind === 'build') {
        s.fac[s.building.id] = 1;
        out.built = s.building.id;
        G.emit('built', s.building.id);
        s.building = null;
      } else if (kind === 'board') {
        s.board.push(S.genQuest(s));
        s.boardAt = nextT;
        S.ensureDoable(s);
        if (nextT < capEnd && S.autoOn(nextT, s)) out.autoSent += S.autoDispatch(nextT, s);
      }
    }
    if (s.board.length >= S.boardSize(s)) {
      // 満杯の間も定期的に見直す
      if (now - s.boardAt > S.BOARD_INTERVAL) { S.ensureDoable(s); s.boardAt = now - S.BOARD_INTERVAL * 0.5; }
    }
    // 求職者の入れ替え
    if (now - s.candAt > S.CAND_INTERVAL) S.rollCandidates(s);
    return out;
  };
  S.BOARD_INTERVAL = 35;
  S.autoOn = (at, s = G.state) => (G.items ? G.items.autoOn(at, s) : false);

  S.autoDispatch = function (at, s = G.state) {
    let sent = 0;
    let guard = 0;
    while (S.busy(s) < S.slots(s) && guard++ < 10) {
      const idle = s.adv.filter((a) => a.status === 'idle');
      if (!idle.length) break;
      let best = null, bestScore = 0, bestParty = null;
      s.board.forEach((q) => {
        if (q.boss) return;
        const party = S.bestParty(q, idle, 'lean', s);
        if (!party.length) return;
        const info = S.partyInfo(q, party, s);
        const score = (q.gold + q.fame * 20) / info.dur / Math.sqrt(party.length);
        if (score > bestScore) { bestScore = score; best = q; bestParty = party; }
      });
      if (!best) break;
      S.dispatch(best.id, bestParty.map((a) => a.id), at, s);
      sent++;
    }
    return sent;
  };

  // 留守中の計算
  S.offline = function (s = G.state) {
    const now = G.now();
    const away = now - s.lastSeen;
    if (away < 5) return null;
    const cap = S.offlineCap(s);
    const capEnd = s.lastSeen + cap;
    const reelsBefore = s.reels.filter((r) => !r.claimed).length;
    const res = S.advance(now, s, { capEnd });
    // 酒場の売上（留守中は 6 割の効率）
    let tavern = 0;
    if (s.fac.tavern > 0) {
      const eff = Math.min(away, cap);
      const lv = s.fac.tavern;
      const tipsPerSec = Math.min(D.seats(lv) / 36, 1 / D.tipInterval(lv));
      const perSec = tipsPerSec * D.tipValue(lv);
      tavern = Math.round(perSec * eff * 0.6);
      s.gold += tavern;
      s.stats.goldEarned += tavern;
    }
    // 訓練場：待機中の冒険者が少しずつ成長
    let trained = 0;
    if (s.fac.training > 0) {
      const eff = Math.min(away, cap);
      s.adv.forEach((a) => {
        if (a.status === 'idle') {
          const n = Math.floor(eff * 0.004 * s.fac.training * (1 + a.lv * 0.1));
          if (n > 0) { S.gainExp(a, n, s); trained += n; }
        }
      });
    }
    const newReels = s.reels.filter((r) => !r.claimed).length - reelsBefore;
    s.lastSeen = now;
    return { away, capped: away > cap, cap, tavern, newReels: Math.max(0, newReels), resolved: res.resolved, autoSent: res.autoSent, trained, built: res.built };
  };

  // ---------------------------------------------------------------- セーブ
  S.serialize = function () {
    const s = G.state;
    s.lastSeen = G.now();
    return JSON.stringify(s, (k, v) => (k === '_plan' || k === '_dm' || k === '_tx' ? undefined : v));
  };
  S.save = function (force) {
    const s = G.state;
    if (!s || G.resetting || !G.booted) return;
    try {
      G.save.write(S.serialize(), force);
    } catch (e) { /* 保存できない環境でも遊べる */ }
  };
  // raw: G.save.init() が返したいちばん新しいセーブ
  S.load = function (raw) {
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return null;
      // 欠けている項目を補う（将来の版との互換）
      const f = S.fresh();
      const merged = Object.assign(f, s);
      merged.stats = Object.assign(S.freshStats(), s.stats || {});
      merged.settings = Object.assign({ bgm: 0.6, sfx: 0.8, env: 0.7, haptics: true, autoplay: true, reduceMotion: false, danmaku: true, notify: true }, s.settings || {});
      merged.flags = Object.assign({ tut: 0, autoDispatch: false, bossUnlocked: false }, s.flags || {});
      merged.fac = Object.assign({ hall: 1, bunks: 1, tavern: 0, smithy: 0, training: 0, alchemy: 0, tower: 0 }, s.fac || {});
      merged.items = s.items || [];
      merged.relics = s.relics || {};
      merged.crystals = s.crystals != null ? s.crystals : 30;
      merged.inbox = s.inbox || [];
      G.state = merged;
      S.abyss(merged);
      if (merged.abyss.open) merged.flags.abyssNoticed = true;
      S.prestige(merged);
      if (!merged.run) merged.run = S.newRun(merged);
      merged.alumni = s.alumni || [];
      if (G.items) G.items.migrate(merged);
      return merged;
    } catch (e) {
      return null;
    }
  };
  S.freshStats = () => ({ quests: 0, success: 0, great: 0, legend: 0, fail: 0, likes: 0, tips: 0, goldEarned: 0, areaWin: {}, boss: 0, reels: 0, playSec: 0 });
  S.reset = function () { return G.save.clear(); };
})();
