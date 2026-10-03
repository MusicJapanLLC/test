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
      settings: { bgm: 0.6, sfx: 0.8, haptics: true, autoplay: true, reduceMotion: false },
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
    s.board.push(S.makeQuest(0, { size: 1, k: 0.05, dur: 14, name: '草原のスライム退治', monster: 'slime' }));
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
    };
  };

  S.uniqueName = function () {
    const used = new Set((G.state ? G.state.adv : []).map((a) => a.name));
    (G.state ? G.state.cands : []).forEach((c) => used.add(c.name));
    const free = D.NAMES.filter((n) => !used.has(n));
    return free.length ? G.pick(free) : G.pick(D.NAMES) + 'Ⅱ';
  };

  // ---------------------------------------------------------------- 数値
  S.expNeed = (lv) => Math.round(8 * Math.pow(1.33, lv - 1));
  S.power = function (a, s = G.state) {
    const base = D.CLASSES[a.cls].pow;
    return base * (1 + 0.3 * (a.lv - 1)) * (1 + 0.12 * s.fac.smithy) * (1 + 0.03 * Math.min(a.bond, 10));
  };
  S.slots = (s = G.state) => s.fac.hall;
  S.boardSize = (s = G.state) => s.fac.hall + 2;
  S.beds = (s = G.state) => D.beds(s.fac.bunks);
  S.offlineCap = (s = G.state) => (3 + s.fac.tower * 2) * 3600;
  S.unlockedAreas = (s = G.state) => D.AREAS.filter((a) => a.rank <= s.rank);
  S.unlockedClasses = (s = G.state) => D.CLASS_ORDER.filter((c) => D.CLASSES[c].rank <= s.rank);

  S.partyInfo = function (quest, party, s = G.state) {
    let pow = 0, cleric = false, archer = false, warrior = false, thief = false;
    let brave = 0, swift = 0, lucky = 0, greedy = 0;
    party.forEach((a) => {
      pow += S.power(a, s);
      if (a.cls === 'cleric') cleric = true;
      if (a.cls === 'archer') archer = true;
      if (a.cls === 'warrior') warrior = true;
      if (a.cls === 'thief') thief = true;
      if (a.trait === 'brave') brave++;
      if (a.trait === 'swift') swift++;
      if (a.trait === 'lucky') lucky++;
      if (a.trait === 'greedy') greedy++;
    });
    const ratio = pow / quest.req;
    let p = 0.75 * Math.pow(ratio, 1.6);
    p += (cleric ? 0.08 : 0) + brave * 0.05 + s.fac.alchemy * 0.03;
    p = G.clamp(p, 0.08, 0.97);
    if (!party.length) p = 0;
    let dur = quest.dur * (archer ? 0.9 : 1) * Math.pow(0.92, swift) * (1 - s.fac.tower * 0.04);
    const great = 0.12 + lucky * 0.06 + s.fac.alchemy * 0.015 + (ratio > 1.4 ? 0.06 : 0);
    const goldMul = (thief ? 1.15 : 1) * (1 + greedy * 0.1);
    return { pow, ratio, p, dur: Math.max(5, dur), great, goldMul, warrior };
  };

  // ---------------------------------------------------------------- 依頼
  let questSeq = 1;
  S.makeQuest = function (areaIdx, o = {}) {
    const area = D.AREAS[areaIdx];
    const size = o.size || G.randi(1, area.size);
    const k = o.k != null ? o.k : Math.random();
    const sizeMul = [0, 0.55, 0.85, 1, 1.25][size];
    const req = Math.round(G.lerp(area.pow[0], area.pow[1], k) * sizeMul);
    const monster = o.monster || G.pick(area.monsters);
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
    if (s.active.length >= S.slots(s)) return null;
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

  // 遠征の結果を決める
  S.resolve = function (ex, s = G.state) {
    const party = ex.party.map((id) => s.adv.find((a) => a.id === id)).filter(Boolean);
    const q = ex.q;
    const info = S.partyInfo(q, party, s);
    const area = D.AREA_BY_ID[q.area];
    let tier;
    if (Math.random() < info.p) {
      const r = Math.random();
      const legendP = 0.018 + party.filter((a) => a.trait === 'lucky').length * 0.012 + s.fac.alchemy * 0.004;
      tier = r < legendP ? 'legend' : r < legendP + info.great ? 'great' : 'ok';
    } else tier = 'fail';
    if (q.boss && tier !== 'fail') tier = 'legend';
    const mul = { fail: info.warrior ? 0.5 : 0.25, ok: 1, great: 2, legend: 5 }[tier];
    const matMul = { fail: 0, ok: 1, great: 2, legend: 3 }[tier];
    const tidy = party.filter((a) => a.trait === 'tidy').length;
    const gold = Math.round(q.gold * mul * info.goldMul * G.rand(0.92, 1.08));
    const mat = Math.round(q.mat * matMul + (tier !== 'fail' ? tidy : 0) + (tier === 'legend' ? 3 : 0));
    const fame = tier === 'fail' ? 0 : Math.round(q.fame * (tier === 'legend' ? 3 : tier === 'great' ? 1.5 : 1));
    const expMul = (tier === 'fail' ? 0.5 : tier === 'great' ? 1.5 : tier === 'legend' ? 3 : 1) * (1 + 0.12 * s.fac.training);
    // 経験値はその場で反映（帰ってきた時には強くなっている）
    const levelUps = [];
    party.forEach((a) => {
      const before = a.lv;
      S.gainExp(a, Math.round(q.exp * expMul * (a.trait === 'sleepy' ? 1.1 : 1)), s);
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
      if (q.boss) s.stats.boss = 1;
    }
    const reel = G.reels.make({ q, party, tier, gold, mat: mat + bonusMat, fame, levelUps, extra, endAt: ex.endAt });
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
  S.claimReel = function (reel, bonus = 0, s = G.state) {
    if (!reel || reel.claimed) return null;
    reel.claimed = true;
    const mul = 1 + bonus;
    const gold = Math.round(reel.gold * mul);
    const mat = reel.mat;
    s.gold += gold;
    s.mat += mat;
    s.fame += reel.fame;
    s.stats.goldEarned += gold;
    s.stats.reels++;
    if (reel.tier === 'legend') s.stats.legendSeen = (s.stats.legendSeen || 0) + 1;
    if (reel.monster) s.seenMonsters[reel.monster] = Math.max(s.seenMonsters[reel.monster] || 0, { fail: 1, ok: 1, great: 2, legend: 3 }[reel.tier]);
    if (reel.extra === 'recruit' && reel.recruit) {
      const c = reel.recruit;
      c.free = true;
      c.price = 0;
      s.cands.unshift(c);
      if (s.cands.length > 4) s.cands.pop();
    }
    const ranked = S.checkRank(s);
    return { gold, mat, fame: reel.fame, ranked };
  };

  S.checkRank = function (s = G.state) {
    let up = 0;
    while (s.rank < D.MAX_RANK && s.fame >= D.RANK_FAME[s.rank]) {
      s.rank++;
      up++;
    }
    if (up) {
      G.emit('rankup', s.rank);
      if (s.rank >= 10 && !s.flags.bossUnlocked) {
        s.flags.bossUnlocked = true;
        s.board.unshift(S.bossQuest());
      }
    }
    return up;
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
  S.facCost = (id, s = G.state) => D.FAC[id].cost(s.fac[id]);
  S.canAfford = (c, s = G.state) => s.gold >= c.gold && s.mat >= c.mat;
  S.facState = function (id, s = G.state) {
    const f = D.FAC[id];
    const lv = s.fac[id];
    if (s.building && s.building.id === id) return 'building';
    if (lv >= f.maxLv) return 'max';
    if (s.rank < f.rank) return 'locked';
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
    s.stats.goldEarned += r.gold || 0;
    s.obj++;
    return r;
  };

  // ---------------------------------------------------------------- 時間を進める
  // now までの出来事を時刻順に処理する。留守中（cap 超過）の自動派遣は止める。
  S.advance = function (now, s = G.state, opts = {}) {
    const capEnd = opts.capEnd || Infinity;
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
        if (s.flags.autoDispatch && nextT < capEnd) out.autoSent += S.autoDispatch(nextT, s);
      } else if (kind === 'build') {
        s.fac[s.building.id] = 1;
        out.built = s.building.id;
        G.emit('built', s.building.id);
        s.building = null;
      } else if (kind === 'board') {
        s.board.push(S.genQuest(s));
        s.boardAt = nextT;
        S.ensureDoable(s);
        if (s.flags.autoDispatch && nextT < capEnd) out.autoSent += S.autoDispatch(nextT, s);
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

  S.autoDispatch = function (at, s = G.state) {
    let sent = 0;
    let guard = 0;
    while (s.active.length < S.slots(s) && guard++ < 10) {
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
    return { away, capped: away > cap, cap, tavern, newReels: Math.max(0, newReels), resolved: res.resolved, trained, built: res.built };
  };

  // ---------------------------------------------------------------- セーブ
  S.save = function () {
    const s = G.state;
    if (!s || G.resetting) return;
    s.lastSeen = G.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) { /* 保存できない環境でも遊べる */ }
  };
  S.load = function () {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return null;
      // 欠けている項目を補う（将来の版との互換）
      const f = S.fresh();
      const merged = Object.assign(f, s);
      merged.stats = Object.assign(S.freshStats(), s.stats || {});
      merged.settings = Object.assign({ bgm: 0.6, sfx: 0.8, haptics: true, autoplay: true, reduceMotion: false }, s.settings || {});
      merged.flags = Object.assign({ tut: 0, autoDispatch: false, bossUnlocked: false }, s.flags || {});
      merged.fac = Object.assign({ hall: 1, bunks: 1, tavern: 0, smithy: 0, training: 0, alchemy: 0, tower: 0 }, s.fac || {});
      G.state = merged;
      return merged;
    } catch (e) {
      return null;
    }
  };
  S.freshStats = () => ({ quests: 0, success: 0, great: 0, legend: 0, fail: 0, likes: 0, tips: 0, goldEarned: 0, areaWin: {}, boss: 0, reels: 0, playSec: 0 });
  S.reset = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
  };
})();
