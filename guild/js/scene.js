/* ギルドの灯 — scene: ギルドの断面図。住人が自律的に動き回る。
 * ワールド座標: 幅 400。地面 y=0、上の階ほど y がマイナス。
 */
'use strict';
(function () {
  const SC = (G.scene = {});
  const D = G.D;
  const art = G.art;
  const W = 400, FH = 120;
  const WL = 52, WR = 392, IL = 60, IR = 384, STAIR = 330;
  const DOOR_X = 56;
  const PS = 1.15; // 住人の大きさ
  const DAY_LEN = 720; // 12分で1日
  SC.FH = FH;

  let canvas, ctx, dpr = 1, cssW = 0, cssH = 0, s = 1, offX = 0;
  let camTop = -300, camVel = 0, camTween = null;
  let topPad = 120, botPad = 80;
  let drag = null;
  let night = 0, dayPhase = 0;
  const agents = [];
  const parts = [];
  const coins = []; // シーン上のコイン {kind:'tip'|'desk', x, y, v, ref, born}
  let doorOpen = 0;
  let time = 0;
  let lastBoardLen = -1;
  const paperPop = [];
  let flashFloor = null; // 建設完了・強化時の光
  let shake = 0;
  SC.agents = agents;

  const floorY = (i) => -i * FH;
  SC.floorY = floorY;

  // ---------------------------------------------------------------- setup
  SC.init = function (cv) {
    canvas = cv;
    ctx = canvas.getContext('2d', { alpha: false });
    SC.resize();
    window.addEventListener('resize', SC.resize);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', (e) => {
      camVel = 0;
      camTween = null;
      camTop += e.deltaY / s;
      clampCam(true);
    }, { passive: true });
    G.on('dispatch', onDispatch);
    G.on('resolved', onResolved);
    G.on('hired', (a) => spawnAdv(a, true));
    G.on('dismissed', (a) => {
      const ag = agents.find((x) => x.kind === 'adv' && x.id === a.id);
      if (ag) leaveGuild(ag, true);
    });
    G.on('built', (id) => {
      const f = D.FAC[id].floor;
      flashFloor = { f, t: 0 };
      for (let i = 0; i < 70; i++) confetti(G.rand(IL, IR), floorY(f) - G.rand(20, 100));
      syncStaff();
      SC.focusFloor(f);
    });
    G.on('upgraded', (id) => {
      const f = D.FAC[id].floor;
      flashFloor = { f, t: 0 };
      for (let i = 0; i < 26; i++) sparkle(G.rand(IL + 10, STAIR - 10), floorY(f) - G.rand(10, 90), '#ffe58f');
    });
  };

  SC.resize = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    s = Math.min(cssW / (W + 8), (cssH - 140) / 440);
    s = Math.max(s, 0.6);
    offX = (cssW - (W + 8) * s) / 2;
    clampCam(true);
  };
  SC.setPads = (top, bot) => { topPad = top; botPad = bot; clampCam(true); };

  // ---------------------------------------------------------------- camera
  function visibleFloors() {
    const st = G.state;
    let n = G.sim.builtFloors(st);
    if (n < D.FACILITIES.length) n += 1; // 次の階（工事予定地）
    return n;
  }
  function camBounds() {
    const viewH = cssH / s;
    const nv = visibleFloors();
    const top = -nv * FH - 96 - topPad / s;
    const bottom = 26 + botPad / s - viewH;
    return [Math.min(top, bottom), bottom];
  }
  function clampCam(hard) {
    const [a, b] = camBounds();
    if (hard) camTop = G.clamp(camTop, a, b);
    return [a, b];
  }
  SC.focusFloor = function (f, instant) {
    const viewH = (cssH - topPad - botPad) / s;
    const target = floorY(f) - FH / 2 - viewH * 0.35 - topPad / s;
    const [a, b] = camBounds();
    const to = G.clamp(target, a, b);
    if (instant) camTop = to;
    else camTween = { from: camTop, to, t: 0 };
  };
  SC.focusBottom = () => { camTop = camBounds()[1]; };
  SC.worldToScreen = (x, y) => [offX + x * s, (y - camTop) * s];
  SC.screenToWorld = (x, y) => [(x - offX) / s, y / s + camTop];

  // ---------------------------------------------------------------- input
  function onDown(e) {
    G.audio.init();
    drag = { x: e.clientX, y: e.clientY, cam: camTop, moved: false, t: performance.now(), lastY: e.clientY, lastT: performance.now(), id: e.pointerId };
    camVel = 0;
    camTween = null;
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 7 || Math.abs(e.clientX - drag.x) > 7) drag.moved = true;
    if (drag.moved) {
      const [a, b] = camBounds();
      let c = drag.cam - dy / s;
      // 端で少しだけ伸びる
      if (c < a) c = a - Math.sqrt(a - c) * 3;
      if (c > b) c = b + Math.sqrt(c - b) * 3;
      camTop = c;
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      camVel = G.lerp(camVel, (-(e.clientY - drag.lastY) / s) / (dt / 1000), 0.4);
      drag.lastY = e.clientY;
      drag.lastT = now;
    }
  }
  function onUp(e) {
    if (!drag || (e.pointerId !== drag.id && e.type !== 'pointercancel')) return;
    if (!drag.moved && e.type === 'pointerup') tap(e.clientX, e.clientY);
    if (performance.now() - drag.lastT > 90) camVel = 0;
    drag = null;
  }

  function tap(sx, sy) {
    const [wx, wy] = SC.screenToWorld(sx, sy);
    ripple(wx, wy);
    // コイン
    let best = null, bd = 22;
    coins.forEach((c) => {
      const d = Math.hypot(c.x - wx, c.y - 4 - wy);
      if (d < bd) { bd = d; best = c; }
    });
    if (best) { collectCoin(best, true); return; }
    // 人
    const hit = agents.filter((a) => a.visible && !a.away).filter((a) => {
      const p = agentPos(a);
      return Math.abs(p[0] - wx) < 11 && wy < p[1] + 3 && wy > p[1] - 44;
    }).sort((a, b) => agentPos(b)[1] - agentPos(a)[1])[0];
    if (hit) { tapAgent(hit); return; }
    // 掲示板をタップしたら依頼を開く
    if (wx > 106 && wx < 174 && wy > -94 && wy < -30) { G.audio.sfx('tap'); G.ui.openSheet('quests'); return; }
    // 階
    const f = Math.floor(-wy / FH);
    const nv = visibleFloors();
    if (f >= 0 && f < nv && wx > WL && wx < WR) {
      G.audio.sfx('tap');
      const fac = D.FACILITIES[f];
      if (fac) G.ui.openFacility(fac.id);
    }
  }

  function tapAgent(a) {
    G.audio.sfx('soft');
    G.haptic(6);
    a.jump = 1;
    if (a.kind === 'adv') {
      const adv = G.state.adv.find((x) => x.id === a.id);
      if (a.act === 'sleep') {
        say(a, G.pick(D.CHATTER.tapSleep), 2.2);
      } else say(a, G.pick(D.CHATTER.tap), 1.8);
      if (adv) G.ui.showAdvPop(adv, a);
    } else if (a.kind === 'staff') {
      say(a, a.role === 'rina' ? G.pick(D.RINA_LINES) : a.role === 'bartender' ? 'いらっしゃい！' : a.role === 'smith' ? 'ふん、いい鉄だ' : 'ふふ…調合中よ', 2);
    } else {
      say(a, G.pick(D.CUSTOMER_LINES), 2);
    }
  }

  // ---------------------------------------------------------------- coins
  function collectCoin(c, byTap) {
    const i = coins.indexOf(c);
    if (i < 0) return;
    coins.splice(i, 1);
    const st = G.state;
    let v = 0;
    if (c.kind === 'tip') {
      const ti = st.tips.indexOf(c.ref);
      if (ti >= 0) { v = st.tips[ti].v; st.tips.splice(ti, 1); }
      st.stats.tips++;
    } else if (c.kind === 'desk') {
      v = st.deskCoins;
      st.deskCoins = 0;
      G.emit('deskCollected');
    }
    if (v <= 0) return;
    st.gold += v;
    st.stats.goldEarned += v;
    const [x, y] = SC.worldToScreen(c.x, c.y - 4);
    G.ui.flyCoins(x, y, v, byTap);
    for (let k = 0; k < 6; k++) sparkle(c.x, c.y - 4, '#ffd45a');
    floatText(c.x, c.y - 14, '+' + G.fmt(v) + 'G', '#ffe27a');
  }
  SC.collectAll = function () {
    coins.slice().forEach((c) => collectCoin(c, false));
  };
  SC.coinCount = () => coins.length;
  SC.deskCoinScreen = () => {
    const c = coins.find((x) => x.kind === 'desk');
    return c ? SC.worldToScreen(c.x, c.y - 4) : null;
  };

  function syncCoins() {
    const st = G.state;
    // 酒場のチップ
    st.tips.forEach((t) => {
      if (!coins.some((c) => c.ref === t)) {
        const seat = seatPos(t.seat);
        const stack = coins.filter((c) => c.kind === 'tip' && c.seat === t.seat).length;
        coins.push({ kind: 'tip', ref: t, seat: t.seat, x: seat.tx + (stack % 3) * 5 - 5, y: floorY(2) - 24 - Math.floor(stack / 3) * 3, born: time });
      }
    });
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.kind === 'tip' && !st.tips.includes(c.ref)) coins.splice(i, 1);
    }
    // 受付の相談料
    const hasDesk = coins.some((c) => c.kind === 'desk');
    if (st.deskCoins > 0 && !hasDesk) coins.push({ kind: 'desk', x: 236, y: floorY(0) - 27, born: time });
    if (st.deskCoins <= 0 && hasDesk) coins.splice(coins.findIndex((c) => c.kind === 'desk'), 1);
  }

  // ---------------------------------------------------------------- particles
  function addPart(p) {
    if (parts.length > 420) parts.shift();
    parts.push(p);
  }
  function sparkle(x, y, col) {
    addPart({ type: 'spark', x, y, vx: G.rand(-30, 30), vy: G.rand(-50, -10), g: 60, life: 0, max: G.rand(0.5, 0.9), col, size: G.rand(1.2, 2.4), rot: G.rand(0, 6) });
  }
  function confetti(x, y) {
    addPart({ type: 'tri', x, y, vx: G.rand(-40, 40), vy: G.rand(-90, -20), g: 80, life: 0, max: G.rand(1.2, 2.2), col: G.pick(['#ffcf4a', '#ff7a6a', '#6ad0ff', '#8fe08a', '#c79bff']), size: G.rand(2, 3.6), rot: G.rand(0, 6), vr: G.rand(-8, 8) });
  }
  function floatText(x, y, text, col) {
    addPart({ type: 'text', x, y, vx: 0, vy: -16, g: 0, life: 0, max: 1.3, text, col });
  }
  function ripple(x, y) {
    addPart({ type: 'ring', x, y, life: 0, max: 0.35, vx: 0, vy: 0, g: 0 });
  }
  function note(x, y) {
    addPart({ type: 'note', x, y, vx: G.rand(-6, 6), vy: -14, g: 0, life: 0, max: 1.8, text: G.pick(['♪', '♫']), col: G.pick(['#ffe27a', '#ffffff', '#ffc2d6']) });
  }
  function zzz(x, y) {
    addPart({ type: 'note', x, y, vx: 5, vy: -9, g: 0, life: 0, max: 2.2, text: 'z', col: '#dfe8ff', size: 6 });
  }
  function smoke(x, y) {
    addPart({ type: 'smoke', x, y, vx: G.rand(2, 8), vy: G.rand(-14, -8), g: 0, life: 0, max: G.rand(2.5, 4), size: G.rand(3, 5) });
  }
  function dust(x, y) {
    addPart({ type: 'dust', x, y, vx: G.rand(-14, 14), vy: G.rand(-16, -4), g: 10, life: 0, max: G.rand(0.6, 1.1), size: G.rand(2, 4) });
  }
  function forgeSpark(x, y) {
    addPart({ type: 'spark', x, y, vx: G.rand(-40, 40), vy: G.rand(-70, -25), g: 140, life: 0, max: G.rand(0.3, 0.7), col: G.pick(['#ffd45a', '#ff9a3a', '#fff2b0']), size: G.rand(0.8, 1.6), rot: 0 });
  }
  SC.burst = (x, y, n = 20) => { for (let i = 0; i < n; i++) confetti(x, y); };

  // ---------------------------------------------------------------- agents
  function newAgent(o) {
    const a = Object.assign({
      x: 100, f: 0, facing: 1, phase: 0, t: Math.random() * 10, state: 'stand', queue: [], act: null, actT: 0,
      speed: 30, visible: true, bubble: null, jump: 0, blinkT: G.rand(1, 4), blink: false, stair: null, nextChat: G.rand(4, 12),
    }, o);
    agents.push(a);
    return a;
  }
  function agentPos(a) {
    if (a.stair) {
      const { from, dir, k } = a.stair;
      const x0 = dir > 0 ? 380 : 338, x1 = dir > 0 ? 338 : 380;
      const y0 = floorY(from), y1 = floorY(from + dir);
      return [G.lerp(x0, x1, k), G.lerp(y0, y1, k)];
    }
    return [a.x, floorY(a.f)];
  }
  SC.agentScreen = (a) => {
    const p = agentPos(a);
    return SC.worldToScreen(p[0], p[1]);
  };

  function say(a, text, dur = 2.4) {
    a.bubble = { text, t: 0, dur };
  }

  // 目的地 {f, x} までの移動を予約
  function goTo(a, f, x) {
    a.queue = [];
    let cf = a.stair ? a.stair.from + a.stair.dir : a.f;
    if (a.stair) a.queue.push({ type: 'finishStair' });
    while (cf !== f) {
      if (f > cf) {
        a.queue.push({ type: 'walk', x: 381 });
        a.queue.push({ type: 'stair', dir: 1 });
        cf++;
      } else {
        a.queue.push({ type: 'walk', x: 337 });
        a.queue.push({ type: 'stair', dir: -1 });
        cf--;
      }
    }
    a.queue.push({ type: 'walk', x });
  }

  function spawnAdv(adv, entering) {
    if (agents.some((x) => x.kind === 'adv' && x.id === adv.id)) return;
    const a = newAgent({ kind: 'adv', id: adv.id, look: adv.look, speed: G.rand(28, 34) });
    if (entering) {
      a.x = -16; a.f = 0;
      goTo(a, 0, G.rand(180, 205));
      a.act = 'report';
      a.actT = 0;
      a.entering = true;
    } else {
      // ギルドのどこかに居る
      const st = G.state;
      const fl = Math.min(G.sim.builtFloors(st) - 1, G.randi(0, 2));
      a.f = Math.max(0, fl);
      a.x = G.rand(IL + 20, STAIR - 20);
      a.act = null;
      a.actT = G.rand(0, 2);
    }
    return a;
  }

  function leaveGuild(a, forever) {
    a.act = 'leave';
    a.forever = forever;
    a.item = null;
    a.sleeping = false;
    goTo(a, 0, -20);
  }

  function onDispatch(ex) {
    ex.party.forEach((id, i) => {
      const a = agents.find((x) => x.kind === 'adv' && x.id === id);
      if (!a) return;
      a.departing = true;
      setTimeout(() => {
        a.departing = false;
        if (a.sleeping) { say(a, 'はっ！ 行ってきます！', 2); a.sleeping = false; }
        else say(a, G.pick(D.CHATTER.depart), 2);
        leaveGuild(a, false);
      }, i * 350);
    });
  }
  function onResolved({ party }) {
    if (!SC.ready) return; // 留守中に帰ってきた冒険者は、最初からギルドに居る
    G.audio.sfx('door');
    party.forEach((adv, i) => {
      // 留守中に解決したものは、帰ってくる演出は省略
      setTimeout(() => {
        const ex = agents.find((x) => x.kind === 'adv' && x.id === adv.id);
        if (ex) { ex.away = false; ex.visible = true; ex.x = -16; ex.f = 0; ex.stair = null; goTo(ex, 0, G.rand(180, 205)); ex.act = 'report'; ex.entering = true; }
        else spawnAdv(adv, true);
      }, i * 650);
    });
  }

  // 施設スタッフ
  function syncStaff() {
    const st = G.state;
    const need = [['rina', 0, true]];
    if (st.fac.tavern > 0) need.push(['bartender', 2, true]);
    if (st.fac.smithy > 0) need.push(['smith', 3, true]);
    if (st.fac.alchemy > 0) need.push(['alchemist', 5, true]);
    need.forEach(([role, f]) => {
      if (agents.some((a) => a.kind === 'staff' && a.role === role)) return;
      const look = STAFF_LOOKS[role]();
      const pos = { rina: 252, bartender: 304, smith: 196, alchemist: 150 }[role];
      newAgent({ kind: 'staff', role, look, f, x: pos, home: pos, facing: role === 'smith' ? -1 : role === 'rina' ? -1 : -1, act: 'staff', actT: 0 });
    });
  }
  const STAFF_LOOKS = {
    rina: () => ({ cls: 'warrior', role: 'rina', seed: 3, skin: '#f6d3b3', hair: '#8a4a2a', style: 'pony', outfit: '#3f8f6e', vest: '#2f6f55', pants: '#3d3f52', blush: true }),
    bartender: () => ({ cls: 'warrior', role: 'bartender', seed: 7, skin: '#e0a87e', hair: '#5a3a2a', style: 'bald', outfit: '#f1e9d8', apron: '#7a4f2e', pants: '#3a2e28', mustache: true }),
    smith: () => ({ cls: 'warrior', role: 'smith', seed: 11, skin: '#e8b48a', hair: '#b8432f', style: 'short', outfit: '#6a5a4a', apron: '#4a3326', pants: '#3a2e28', beard: true, height: 0.82, wide: 1.18 }),
    alchemist: () => ({ cls: 'mage', role: 'alchemist', seed: 13, skin: '#f9dcc4', hair: '#d8dde3', style: 'long', outfit: '#6a4f9a', robe: true, hood: '#4f3a7a', pants: '#3a2e48', blush: true }),
  };

  // 客
  let custT = 3;
  function spawnCustomer() {
    const st = G.state;
    const lv = st.fac.tavern;
    const seats = D.seats(lv);
    const used = new Set(agents.filter((a) => a.seat != null).map((a) => a.seat));
    const free = [];
    for (let i = 0; i < seats; i++) if (!used.has(i)) free.push(i);
    if (!free.length) return;
    const seat = G.pick(free);
    const look = art.randomLook('warrior');
    look.role = 'customer';
    look.outfit = G.pick(['#b85c4a', '#4a7ab8', '#8a9a4a', '#c08a3a', '#7a5aa8', '#4a9a8a', '#d0a080']);
    look.hair = G.pick(D.HAIRS);
    if (Math.random() < 0.3) look.apron = G.pick(['#e8dcc0', '#c8b890']);
    const a = newAgent({ kind: 'cust', look, x: -16, f: 0, seat, speed: G.rand(24, 30) });
    const p = seatPos(seat);
    goTo(a, 2, p.x);
    a.act = 'toSeat';
    G.audio.sfx('door');
  }

  // 酒場の席（テーブル3卓×2 + カウンター2）
  function seatPos(i) {
    const tables = [112, 166, 220];
    if (i < 6) {
      const t = tables[Math.floor(i / 2)];
      const left = i % 2 === 0;
      return { x: t + (left ? -15 : 15), facing: left ? 1 : -1, tx: t };
    }
    return { x: 252 + (i - 6) * 16, facing: 1, tx: 286 + (i - 6) * 8, bar: true };
  }

  function bedPos(i) {
    const frame = Math.floor(i / 2), tier = i % 2;
    return { x: 92 + frame * 58, y: floorY(1) - 9 - tier * 30 };
  }

  // 冒険者の気まぐれ
  function chooseActivity(a) {
    const st = G.state;
    const adv = st.adv.find((x) => x.id === a.id);
    if (!adv) return;
    const tr = adv.trait;
    const acts = [
      { id: 'wander', w: 3 },
      { id: 'board', w: 2.2 },
      { id: 'sleep', w: tr === 'sleepy' ? 4 : 1.2 },
    ];
    if (st.fac.tavern > 0) acts.push({ id: 'drink', w: tr === 'drinker' ? 5 : 1.8 });
    if (st.fac.training > 0) acts.push({ id: 'train', w: tr === 'brave' ? 4 : 2.2 });
    if (st.fac.smithy > 0) acts.push({ id: 'smith', w: 1.2 });
    if (st.fac.alchemy > 0) acts.push({ id: 'alchemy', w: 0.9 });
    if (st.fac.tower > 0) acts.push({ id: 'tower', w: 1 });
    if (tr === 'singer') acts.push({ id: 'sing', w: 2.5 });
    if (agents.filter((x) => x.kind === 'adv' && x.visible && !x.away && x !== a && !x.act).length) acts.push({ id: 'chat', w: 1.6 });
    const pick = G.weighted(acts, (x) => x.w).id;
    a.item = null;
    switch (pick) {
      case 'wander': {
        const f = G.randi(0, Math.min(1, G.sim.builtFloors(st) - 1));
        goTo(a, f, G.rand(IL + 16, STAIR - 16));
        a.act = 'wander';
        a.actT = G.rand(3, 7);
        break;
      }
      case 'board':
        goTo(a, 0, G.rand(120, 160));
        a.act = 'board';
        a.actT = G.rand(3, 6);
        break;
      case 'sleep': {
        const idx = st.adv.findIndex((x) => x.id === a.id);
        const b = bedPos(idx);
        goTo(a, 1, b.x - 4);
        a.act = 'sleep';
        a.bed = idx;
        a.actT = G.rand(14, 28);
        break;
      }
      case 'drink': {
        const used = new Set(agents.filter((x) => x.seat != null).map((x) => x.seat));
        const n = D.seats(st.fac.tavern);
        const free = [];
        for (let i = 0; i < n; i++) if (!used.has(i)) free.push(i);
        if (!free.length) { a.act = null; a.actT = 1; return; }
        a.seat = G.pick(free);
        goTo(a, 2, seatPos(a.seat).x);
        a.act = 'drink';
        a.actT = G.rand(12, 22);
        break;
      }
      case 'train': {
        const dummies = dummyXs();
        const used = new Set(agents.filter((x) => x.dummy != null).map((x) => x.dummy));
        const free = dummies.map((x, i) => i).filter((i) => !used.has(i));
        if (!free.length) { a.act = null; a.actT = 1; return; }
        a.dummy = G.pick(free);
        goTo(a, 4, dummies[a.dummy] - 17);
        a.act = 'train';
        a.actT = G.rand(10, 18);
        break;
      }
      case 'smith':
        goTo(a, 3, G.rand(222, 250));
        a.act = 'smith';
        a.actT = G.rand(6, 10);
        break;
      case 'alchemy':
        goTo(a, 5, G.rand(200, 260));
        a.act = 'alchemy';
        a.actT = G.rand(6, 10);
        break;
      case 'tower':
        goTo(a, 6, 232);
        a.act = 'tower';
        a.actT = G.rand(8, 14);
        break;
      case 'sing':
        goTo(a, G.randi(0, Math.min(2, G.sim.builtFloors(st) - 1)), G.rand(IL + 30, STAIR - 30));
        a.act = 'sing';
        a.actT = G.rand(6, 10);
        break;
      case 'chat': {
        const other = G.pick(agents.filter((x) => x.kind === 'adv' && x.visible && !x.away && x !== a && !x.act));
        const p = agentPos(other);
        const f = other.stair ? other.stair.from : other.f;
        const x = G.clamp(p[0] + (p[0] > 200 ? -16 : 16), IL + 10, STAIR - 10);
        goTo(a, f, x);
        a.act = 'chat';
        a.partner = other;
        other.act = 'listen';
        other.queue = [];
        other.actT = 9;
        a.actT = 8;
        break;
      }
    }
  }
  function dummyXs() {
    const lv = G.state.fac.training;
    const n = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
    return [140, 200, 260].slice(0, n);
  }

  function arrive(a) {
    // 到着時の振る舞い
    const st = G.state;
    switch (a.act) {
      case 'report':
        a.facing = 1;
        say(a, G.pick(D.CHATTER.return), 2.2);
        a.state = 'stand';
        a.actT = 2.2;
        a.entering = false;
        {
          const rina = agents.find((x) => x.role === 'rina');
          if (rina) setTimeout(() => say(rina, 'おかえりなさい！', 1.8), 500);
        }
        break;
      case 'board':
        a.facing = -1;
        a.state = 'stand';
        if (Math.random() < 0.5) say(a, G.pick(D.CHATTER.board), 2);
        break;
      case 'sleep':
        a.sleeping = true;
        a.hop = 0;
        break;
      case 'drink': {
        const p = seatPos(a.seat);
        a.facing = p.facing;
        a.state = 'drink';
        a.item = 'mug';
        if (Math.random() < 0.6) say(a, G.pick(D.CHATTER.tavern), 2);
        break;
      }
      case 'toSeat': {
        const p = seatPos(a.seat);
        a.facing = p.facing;
        a.state = 'drink';
        a.item = 'mug';
        a.act = 'custDrink';
        a.actT = G.rand(14, 24);
        const bt = agents.find((x) => x.role === 'bartender');
        if (bt && Math.random() < 0.5) say(bt, 'いらっしゃい！', 1.6);
        break;
      }
      case 'train':
        a.facing = 1;
        a.state = 'swing';
        a.swingT = 0;
        break;
      case 'smith':
        a.facing = -1;
        a.state = 'stand';
        if (Math.random() < 0.5) say(a, G.pick(D.CHATTER.smith), 2);
        break;
      case 'alchemy':
        a.facing = -1;
        a.state = 'stand';
        break;
      case 'tower':
        a.facing = 1;
        a.state = 'stand';
        break;
      case 'chat':
        if (a.partner) {
          const pp = agentPos(a.partner);
          a.facing = pp[0] > a.x ? 1 : -1;
          a.partner.facing = -a.facing;
          a.chatStep = 0;
          a.chatT = 0;
        }
        a.state = 'stand';
        break;
      case 'leave':
        if (a.forever || a.kind === 'cust') a.remove = true;
        else { a.visible = false; a.away = true; }
        break;
      case 'custLeave':
        a.remove = true;
        break;
      default:
        a.state = 'stand';
    }
  }

  function updateAgent(a, dt) {
    a.t += dt;
    // まばたき
    a.blinkT -= dt;
    if (a.blinkT < 0) {
      a.blink = !a.blink;
      a.blinkT = a.blink ? 0.12 : G.rand(2, 5);
    }
    if (a.jump > 0) a.jump = Math.max(0, a.jump - dt * 3);
    if (a.bubble) {
      a.bubble.t += dt;
      if (a.bubble.t > a.bubble.dur) a.bubble = null;
    }
    if (!a.visible) return;

    // 移動
    if (a.queue.length) {
      a.sleeping = false;
      const q = a.queue[0];
      if (q.type === 'walk') {
        const d = q.x - a.x;
        const step = a.speed * dt;
        if (Math.abs(d) <= step) {
          a.x = q.x;
          a.queue.shift();
        } else {
          a.x += Math.sign(d) * step;
          a.facing = Math.sign(d);
          a.phase += step * 0.28;
        }
        a.state = 'walk';
      } else if (q.type === 'stair') {
        if (!a.stair) a.stair = { from: a.f, dir: q.dir, k: 0 };
        a.stair.k += (a.speed * 1.5 * dt) / 128;
        a.facing = q.dir > 0 ? -1 : 1;
        a.phase += a.speed * 1.5 * dt * 0.28;
        a.state = 'walk';
        if (a.stair.k >= 1) {
          a.f = a.stair.from + a.stair.dir;
          a.x = q.dir > 0 ? 338 : 380;
          a.stair = null;
          a.queue.shift();
        }
      } else if (q.type === 'finishStair') {
        a.queue.shift();
      }
      if (!a.queue.length) arrive(a);
      return;
    }

    // 滞在
    if (a.kind === 'staff') { updateStaff(a, dt); return; }
    a.actT -= dt;
    switch (a.act) {
      case 'sleep':
        if (Math.random() < dt * 0.5) {
          const b = bedPos(a.bed);
          zzz(b.x - 6, b.y - 10);
        }
        break;
      case 'train':
        a.swingT = (a.swingT || 0) + dt;
        a.swing = G.clamp((a.swingT % 0.9) / 0.32, 0, 1);
        a.armed = true;
        if ((a.swingT % 0.9) < dt * 1.2) {
          a.dummyHit = (a.dummyHit || 0) + 1;
          const dx = dummyXs()[a.dummy];
          if (dx) {
            dummyWobble[a.dummy] = 1;
            for (let i = 0; i < 3; i++) dust(dx - 4, floorY(4) - G.rand(14, 24));
          }
          if (Math.random() < 0.12) say(a, G.pick(D.CHATTER.train), 1.2);
        }
        break;
      case 'sing':
        a.state = 'cheer';
        if (Math.random() < dt * 2.2) note(a.x + G.rand(-4, 4), floorY(a.f) - 38);
        break;
      case 'chat':
        if (a.partner) {
          a.chatT += dt;
          if (a.chatT > 1.8) {
            a.chatT = 0;
            a.chatStep++;
            const who = a.chatStep % 2 ? a : a.partner;
            say(who, G.pick(['ねえねえ', 'それでさ〜', 'ほんとに！？', 'あはは', 'わかる', 'へぇ〜', '♪', 'まじで？']), 1.6);
          }
        }
        break;
      case 'tower':
        if (Math.random() < dt * 0.15) say(a, G.pick(['遠くまで見える…', '竜の山が見える', 'いい風だ']), 2);
        break;
      case 'custDrink':
        if (Math.random() < dt * 0.03) say(a, G.pick(D.CUSTOMER_LINES), 2);
        break;
      case 'wander':
        if (Math.random() < dt * 0.08) say(a, G.pick(D.CHATTER.idle), 2.2);
        break;
    }
    if (a.actT <= 0) {
      // 終了
      const prev = a.act;
      a.state = 'stand';
      a.armed = false;
      a.swing = 0;
      a.item = null;
      a.sleeping = false;
      if (prev === 'chat' && a.partner) { a.partner.act = null; a.partner.actT = 0.5; a.partner = null; }
      if (a.seat != null) {
        if (a.kind === 'cust') {
          // チップを置いて帰る
          const st = G.state;
          const cap = D.tipCap(st.fac.tavern);
          if (st.tips.length < cap) {
            const v = D.tipValue(st.fac.tavern);
            st.tips.push({ seat: a.seat, v });
          }
          say(a, 'ごちそうさま！', 1.4);
        }
        a.seat = null;
      }
      a.dummy = null;
      if (a.kind === 'cust') {
        a.act = 'custLeave';
        goTo(a, 0, -20);
        return;
      }
      a.act = null;
      chooseActivity(a);
    }
  }

  const dummyWobble = [0, 0, 0];
  function updateStaff(a, dt) {
    if (a.role === 'rina') {
      a.state = 'stand';
      a.facing = -1;
      if (Math.random() < dt * 0.03) say(a, G.pick(D.RINA_LINES), 2.2);
      if (G.state.active.length && Math.random() < dt * 0.02) say(a, '冒険、うまくいってるかな', 2.2);
    } else if (a.role === 'bartender') {
      a.state = 'stand';
      a.wipe = (a.wipe || 0) + dt;
    } else if (a.role === 'smith') {
      a.hamT = (a.hamT || 0) + dt;
      const c = a.hamT % 1.25;
      a.state = 'hammer';
      a.item = 'hammer';
      a.swing = G.clamp(c / 0.3, 0, 1);
      if (c < dt * 1.1) {
        for (let i = 0; i < 9; i++) forgeSpark(174, floorY(3) - 22);
        const scr = SC.worldToScreen(174, floorY(3) - 20);
        if (scr[1] > topPad && scr[1] < cssH - botPad && !G.ui.sheetOpen()) G.audio.sfx('clank');
      }
    } else if (a.role === 'alchemist') {
      a.state = 'stand';
      a.item = 'flask';
      if (Math.random() < dt * 0.02) say(a, G.pick(['ふふふ…', 'もう少しで完成', '色が変わった！']), 2);
    }
  }

  // ---------------------------------------------------------------- update
  SC.update = function (dt) {
    time += dt;
    const st = G.state;
    // 昼夜
    dayPhase = (Date.now() / 1000 % DAY_LEN) / DAY_LEN;
    night = nightness(dayPhase);
    G.audio.setNight(night > 0.5);

    // カメラ
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 0.7);
      camTop = G.lerp(camTween.from, camTween.to, G.ease.inOut(camTween.t));
      if (camTween.t >= 1) camTween = null;
    } else if (!drag) {
      camTop += camVel * dt;
      camVel *= Math.pow(0.04, dt);
      const [a, b] = camBounds();
      if (camTop < a) { camTop = G.lerp(camTop, a, 1 - Math.pow(0.0005, dt)); camVel = 0; }
      if (camTop > b) { camTop = G.lerp(camTop, b, 1 - Math.pow(0.0005, dt)); camVel = 0; }
      if (Math.abs(camVel) < 2) camVel = 0;
    }

    // 住人の同期
    st.adv.forEach((adv) => {
      const has = agents.find((x) => x.kind === 'adv' && x.id === adv.id);
      if (!has && adv.status === 'idle') spawnAdv(adv, false);
      if (has && adv.status === 'away' && !has.away && has.act !== 'leave' && !has.departing) leaveGuild(has, false);
    });
    syncStaff();

    // 客
    if (st.fac.tavern > 0) {
      custT -= dt;
      if (custT <= 0) {
        custT = D.tipInterval(st.fac.tavern) * G.rand(0.8, 1.3);
        if (agents.filter((a) => a.kind === 'cust').length < D.seats(st.fac.tavern)) spawnCustomer();
      }
    }
    // 受付の相談料
    const deskInt = 22;
    if (time > 2 && G.now() - st.deskAt > deskInt) {
      st.deskAt = G.now();
      const unit = 2 + st.rank * 2;
      if (st.deskCoins < unit * 6) st.deskCoins += unit;
    }
    syncCoins();
    // 自動回収
    if (st.fac.tavern >= 4) coins.forEach((c) => { if (c.kind === 'tip' && time - c.born > 1.6) collectCoin(c, false); });
    if (st.fac.hall >= 3) coins.forEach((c) => { if (c.kind === 'desk' && time - c.born > 4) collectCoin(c, false); });

    for (let i = agents.length - 1; i >= 0; i--) {
      updateAgent(agents[i], dt);
      if (agents[i].remove) agents.splice(i, 1);
    }
    // 扉
    const nearDoor = agents.some((a) => a.visible && !a.stair && a.f === 0 && a.x < 74 && a.x > -10 && a.queue.length);
    doorOpen = G.lerp(doorOpen, nearDoor ? 1 : 0, 1 - Math.pow(0.002, dt));
    for (let i = 0; i < 3; i++) dummyWobble[i] *= Math.pow(0.03, dt);

    // 煙突の煙
    if (st.fac.tavern > 0 && Math.random() < dt * 2.2) {
      const nv = visibleFloors();
      smoke(322, floorY(nv) - 64);
    }
    // 建設中のホコリ
    if (st.building) {
      const f = D.FAC[st.building.id].floor;
      if (Math.random() < dt * 8) dust(G.rand(IL + 20, STAIR - 20), floorY(f) - G.rand(0, 10));
      if (Math.random() < dt * 1.2) {
        const scr = SC.worldToScreen(200, floorY(f) - 50);
        if (scr[1] > 0 && scr[1] < cssH && !G.ui.sheetOpen()) G.audio.sfx('build');
      }
    }
    if (flashFloor) { flashFloor.t += dt; if (flashFloor.t > 1.2) flashFloor = null; }
    // 掲示板の紙が増えたらぽんっ
    if (lastBoardLen >= 0 && st.board.length > lastBoardLen) paperPop.push({ i: st.board.length - 1, t: 0 });
    lastBoardLen = st.board.length;
    paperPop.forEach((p) => (p.t += dt));
    while (paperPop.length && paperPop[0].t > 0.6) paperPop.shift();

    // パーティクル
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
  };

  function nightness(p) {
    // 0..1 → 夜の濃さ
    if (p < 0.04) return G.lerp(0.7, 0, p / 0.04);
    if (p < 0.58) return 0;
    if (p < 0.68) return G.ease.inOut((p - 0.58) / 0.1);
    if (p < 0.9) return 1;
    return G.lerp(1, 0.7, (p - 0.9) / 0.1);
  }
  SC.night = () => night;

  // ---------------------------------------------------------------- render
  const SKY = {
    day: ['#6fb9e8', '#cdeefc'],
    dusk: ['#46508e', '#f6a66a'],
    night: ['#0d1430', '#2a3566'],
  };
  function skyColors() {
    const p = dayPhase;
    const duskK = p > 0.55 && p < 0.72 ? G.bump((p - 0.55) / 0.17) : p > 0.88 || p < 0.06 ? G.bump(((p + 0.12) % 1) / 0.18) * 0.7 : 0;
    let top = G.mix(SKY.day[0], SKY.night[0], night);
    let bot = G.mix(SKY.day[1], SKY.night[1], night);
    top = G.mix(top, SKY.dusk[0], duskK * 0.6);
    bot = G.mix(bot, SKY.dusk[1], duskK * 0.8);
    // 雨の日・曇りの日は空が灰色がかる
    const wx = weather();
    const gray = wx.rain * 0.5 + (wx.cloud ? 0.12 : 0);
    if (gray > 0.01) { top = G.mix(top, '#6c7688', gray); bot = G.mix(bot, '#a8b0bc', gray); }
    return [top, bot, duskK];
  }
  SC.skyColors = skyColors;

  SC.render = function () {
    const st = G.state;
    const nq = Math.round(night * 24) / 24; // 色キャッシュのために量子化
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [skyT, skyB, duskK] = skyColors();
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, skyT);
    g.addColorStop(1, skyB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);

    const sh = shake > 0 ? (Math.random() - 0.5) * shake * 4 : 0;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (offX + sh), -dpr * s * camTop);
    const leftW = -offX / s - 4, rightW = (cssW - offX) / s + 4;

    drawSkyObjects(leftW, rightW, nq, duskK);
    drawBackdrop(leftW, rightW, nq);
    drawGround(leftW, rightW, nq);
    drawBuilding(st, nq);
    drawAgents();
    drawFront(st);
    drawNight(nq);
    drawRain(st);
    drawLights(st, nq);
    drawParticles();
    drawCoins();
    drawBubbles();
  };

  function drawSkyObjects(L, R, n, duskK) {
    const viewTop = camTop, viewBot = camTop + cssH / s;
    // 星
    if (n > 0.05) {
      for (let i = 0; i < 70; i++) {
        const x = G.lerp(L, R, G.hash(i * 13));
        const y = G.lerp(-1100, 0, G.hash(i * 29)) + camTop * 0.85;
        if (y < viewTop - 5 || y > viewBot) continue;
        const tw = 0.5 + 0.5 * Math.sin(time * (1 + G.hash(i) * 2) + i);
        ctx.fillStyle = `rgba(255,250,230,${n * (0.35 + tw * 0.6)})`;
        const r = G.hash(i * 7) < 0.15 ? 1.1 : 0.6;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    // 太陽と月（空を横切る）
    const p = dayPhase;
    const sunK = G.inv(0.0, 0.66, p);
    if (sunK >= 0 && sunK <= 1) {
      const x = G.lerp(L - 20, R + 20, sunK);
      const y = camTop + topPad / s + 40 + Math.pow(sunK * 2 - 1, 2) * 110;
      ctx.fillStyle = G.rgba('#fff3c4', 0.25);
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      art.facet(ctx, x, y, 15, 15, 10, duskK > 0.3 ? '#ffb46a' : '#ffe9a0', time * 0.05, 0.12);
    }
    const moonK = G.inv(0.62, 1.04, p < 0.1 ? p + 1 : p);
    if (moonK >= 0 && moonK <= 1) {
      const x = G.lerp(L - 20, R + 20, moonK);
      const y = camTop + topPad / s + 44 + Math.pow(moonK * 2 - 1, 2) * 100;
      ctx.fillStyle = 'rgba(220,230,255,0.15)';
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
      art.facet(ctx, x, y, 11, 11, 9, '#f2eedc', 0.3, 0.12);
      art.ellipse(ctx, x + 3, y - 2, 2.2, 2.2, 'rgba(180,170,150,0.5)');
      art.ellipse(ctx, x - 3, y + 3, 1.5, 1.5, 'rgba(180,170,150,0.4)');
    }
    const wx = weather();
    // オーロラ（夜、ときどき）
    if (n > 0.6 && G.hash(wx.day * 31 + 7) > 0.55) {
      const ay = -760 + camTop * 0.85;
      if (ay > viewTop - 260 && ay < viewBot) {
        ctx.save();
        ['#5cffb0', '#5ad0ff', '#c08aff'].forEach((col, j) => {
          const g = ctx.createLinearGradient(0, ay - 60 + j * 26, 0, ay + 40 + j * 26);
          g.addColorStop(0, G.rgba(col, 0));
          g.addColorStop(0.5, G.rgba(col, 0.13 * (n - 0.5) * 2));
          g.addColorStop(1, G.rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          const base = ay + j * 26;
          ctx.moveTo(L, base + 40);
          for (let k = 0; k <= 24; k++) {
            const x = G.lerp(L, R, k / 24);
            ctx.lineTo(x, base - 50 + Math.sin(k * 0.7 + time * 0.35 + j) * 22 + Math.sin(k * 1.9 - time * 0.2) * 8);
          }
          ctx.lineTo(R, base + 40);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }
    }
    // 流れ星（夜）
    if (n > 0.55) {
      const per = 6.5;
      const idx = Math.floor(time / per);
      const kk = (time % per) / 0.7;
      if (kk < 1 && G.hash(idx * 17) > 0.35) {
        const sx = G.lerp(L, R, G.hash(idx * 3));
        const sy = viewTop + 30 + G.hash(idx * 5) * 160;
        const x1 = sx + kk * 90, y1 = sy + kk * 40;
        const g = ctx.createLinearGradient(x1 - 40, y1 - 18, x1, y1);
        g.addColorStop(0, 'rgba(255,255,240,0)');
        g.addColorStop(1, `rgba(255,255,240,${0.9 * (1 - kk) * n})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x1 - 40, y1 - 18); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    // 朝夕の光の筋
    if (duskK > 0.15 && sunK >= 0 && sunK <= 1) {
      const sx = G.lerp(L - 20, R + 20, sunK), sy = camTop + topPad / s + 40 + Math.pow(sunK * 2 - 1, 2) * 110;
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const a0 = 1.2 + i * 0.32 + Math.sin(time * 0.2 + i) * 0.04;
        ctx.fillStyle = `rgba(255,200,140,${0.06 * duskK})`;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a0 - 0.05) * 600, sy + Math.sin(a0 - 0.05) * 600);
        ctx.lineTo(sx + Math.cos(a0 + 0.05) * 600, sy + Math.sin(a0 + 0.05) * 600);
        ctx.fill();
      }
      ctx.restore();
    }
    // 雲（遠くの小さな雲はゆっくり、近くの大きな雲は速く）
    const nCloud = wx.cloud || wx.rain ? 16 : 11;
    for (let i = 0; i < nCloud; i++) {
      const nearC = i % 3 === 0;
      const sp = (nearC ? 9 : 4) + G.hash(i * 3) * (nearC ? 8 : 5);
      const span = R - L + 200;
      const x = L - 100 + ((G.hash(i * 17) * span + time * sp) % span);
      const y = -80 - G.hash(i * 11) * 900 + camTop * (nearC ? 0.6 : 0.45) + Math.sin(time * 0.3 + i) * 2;
      if (y < viewTop - 50 || y > viewBot + 20) continue;
      const w = (nearC ? 50 : 26) + G.hash(i * 5) * (nearC ? 46 : 30);
      cloud(x, y, w, Math.min(1, n + (wx.rain ? 0.35 : wx.cloud ? 0.12 : 0)));
    }
    // 飛行船（昼、ときどき）
    if (n < 0.4) {
      const per = 140;
      const kk = (time % per) / 70;
      if (kk < 1) {
        const ax = G.lerp(R + 60, L - 60, kk);
        const ay = viewTop + 70 + Math.sin(time * 0.5) * 4;
        ctx.save();
        ctx.translate(ax, ay);
        art.facet(ctx, 0, 0, 22, 8, 10, '#c86a4a', 0, 0.16);
        art.poly(ctx, [18, -2, 26, -7, 26, 7, 18, 2], '#a04a3a');
        art.poly(ctx, [-6, 8, 6, 8, 5, 12, -5, 12], '#6a4a32');
        ctx.strokeStyle = 'rgba(60,40,30,0.6)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-5, 8); ctx.moveTo(8, 6); ctx.lineTo(5, 8); ctx.stroke();
        art.star(ctx, -2, 0, 3, '#f0c94a');
        ctx.restore();
      }
    }
    // 鳥（昼）
    if (n < 0.3) {
      for (let i = 0; i < 3; i++) {
        const span = R - L + 200;
        const x = L - 100 + ((time * (14 + i * 3) + i * 140) % span);
        const y = camTop + 50 + i * 18 + Math.sin(time + i) * 6;
        const fl = Math.sin(time * 8 + i * 2) * 2.5;
        ctx.strokeStyle = `rgba(60,50,60,${0.5 * (1 - n * 3)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(x - 4, y - fl); ctx.lineTo(x, y); ctx.lineTo(x + 4, y - fl); ctx.stroke();
      }
    }
  }
  function cloud(x, y, w, n) {
    const c = G.mix('#ffffff', '#4a5680', n * 0.85);
    const h = w * 0.32;
    art.poly(ctx, [x - w * 0.5, y, x - w * 0.36, y - h * 0.7, x - w * 0.1, y - h, x + w * 0.16, y - h * 1.15, x + w * 0.4, y - h * 0.6, x + w * 0.52, y], G.rgba(c, 0.85));
    art.poly(ctx, [x - w * 0.36, y - h * 0.7, x - w * 0.1, y - h, x + w * 0.16, y - h * 1.15, x, y - h * 0.5], G.rgba(G.shade(c, 0.4), 0.7));
  }

  function drawBackdrop(L, R, n) {
    const py = camTop * 0.25;
    // 遠い山
    const far = G.mix('#9cc3cf', '#283a5a', n);
    const mid = G.mix('#7fae8a', '#21334a', n);
    ctx.save();
    ctx.translate(0, py);
    const ys = -40;
    let pts = [L, ys + 40];
    for (let i = 0; i <= 14; i++) {
      const x = G.lerp(L, R, i / 14);
      pts.push(x, ys - 30 - G.hash(i * 31) * 60);
    }
    pts.push(R, ys + 40);
    art.facetPoly(ctx, pts, far, 0.05);
    // 雪
    ctx.restore();
    ctx.save();
    ctx.translate(0, camTop * 0.12);
    drawSea(L, R, n);
    pts = [L, 10];
    for (let i = 0; i <= 18; i++) {
      const x = G.lerp(L, R, i / 18);
      pts.push(x, -14 - G.hash(i * 7 + 3) * 26);
    }
    pts.push(R, 10);
    art.poly(ctx, pts, mid);
    // 町並み
    for (let i = 0; i < 9; i++) {
      const x = L + 10 + i * 46 + G.hash(i) * 10;
      if (x > WL - 30 && x < WR + 10) continue;
      house(x, -2, 26 + G.hash(i * 3) * 10, 22 + G.hash(i * 5) * 18, n, i);
    }
    ctx.restore();
  }
  // 遠くの海（画面が広いとき、ギルドの左右に見える）
  function drawSea(L, R, n) {
    const hy = -50;
    const [, , duskK] = skyColors();
    const top = G.mix(G.mix('#7cc4ea', '#e8a070', duskK * 0.5), '#1c2c58', n);
    const bot = G.mix('#3f8fc8', '#0f1a3a', n);
    const g = ctx.createLinearGradient(0, hy, 0, 12);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(L, hy, R - L, 62);
    ctx.fillStyle = G.rgba(G.mix('#eaf8ff', '#5a6a9a', n), 0.6);
    ctx.fillRect(L, hy, R - L, 0.8);
    const span = R - L + 40;
    for (let i = 0; i < 40; i++) {
      const x = L - 20 + ((G.hash(i * 7) * span + time * (2 + G.hash(i) * 3)) % span);
      if (x > WL - 10 && x < WR + 10) continue;
      const y = hy + 3 + G.hash(i * 13) * 34;
      const a = (0.3 + 0.35 * Math.sin(time * 1.6 + i * 1.7)) * (1 - n * 0.5);
      const w = 2 + G.hash(i * 3) * 6;
      ctx.fillStyle = `rgba(235,248,255,${a})`;
      ctx.fillRect(x - w / 2, y, w, 0.7);
    }
  }
  function house(x, y, w, h, n, i) {
    const wall = G.mix(['#d9c3a0', '#c9a98a', '#e0d0b0'][i % 3], '#2a3150', n * 0.8);
    const roof = G.mix(['#a8543e', '#5e6e8e', '#8a5a3a'][i % 3], '#1c2238', n * 0.8);
    art.poly(ctx, [x, y, x + w, y, x + w, y - h, x, y - h], wall);
    art.poly(ctx, [x - 3, y - h, x + w + 3, y - h, x + w / 2, y - h - w * 0.5], roof);
    art.poly(ctx, [x - 3, y - h, x + w / 2, y - h - w * 0.5, x + w / 2, y - h], G.shade(roof, 0.12));
    const lit = n > 0.4 && G.hash(i * 9 + Math.floor(time / 9)) > 0.25;
    ctx.fillStyle = lit ? '#ffcf7a' : G.mix('#6a8aa0', '#1a2038', n);
    ctx.fillRect(x + w * 0.3, y - h * 0.65, w * 0.18, h * 0.25);
    ctx.fillRect(x + w * 0.58, y - h * 0.65, w * 0.18, h * 0.25);
  }

  function drawGround(L, R, n) {
    const grass = G.mix('#7cbf57', '#253d36', n * 0.85);
    const soil = G.mix('#8a6a4a', '#2a2430', n * 0.8);
    art.poly(ctx, [L, 0, R, 0, R, 400, L, 400], soil);
    art.poly(ctx, [L, -2, R, -2, R, 7, L, 7], grass);
    art.poly(ctx, [L, -2, R, -2, R, 0.5, L, 0.5], G.shade(grass, 0.12));
    // 草
    for (let i = 0; i < 40; i++) {
      const x = G.lerp(L, R, G.hash(i * 3 + 1));
      if (x > WL - 4 && x < WR + 4) continue;
      const sw = Math.sin(time * 1.5 + i) * 0.8;
      art.poly(ctx, [x - 1.5, 0, x + 1.5, 0, x + sw, -5 - G.hash(i) * 3], G.shade(grass, -0.1 + G.hash(i * 9) * 0.2));
    }
    // 石畳
    for (let i = 0; i < 6; i++) {
      const x = 4 + i * 9;
      art.poly(ctx, [x, 1, x + 7, 1, x + 7.5, 4.5, x - 0.5, 4.5], G.mix('#b9a88e', '#3a3848', n * 0.8));
    }
    // 土の中の小石
    for (let i = 0; i < 30; i++) {
      const x = G.lerp(L, R, G.hash(i * 41));
      const y = 14 + G.hash(i * 43) * 60;
      art.facet(ctx, x, y, 2 + G.hash(i) * 2, 1.4 + G.hash(i) * 1.2, 5, G.shade(soil, 0.08), i, 0.12);
    }
    // 街灯
    const lx = 22;
    art.poly(ctx, [lx - 1, 0, lx + 1, 0, lx + 1, -46, lx - 1, -46], G.mix('#3a3a44', '#15151d', n));
    art.poly(ctx, [lx - 5, -46, lx + 5, -46, lx + 3, -56, lx - 3, -56], G.mix('#3a3a44', '#15151d', n));
    art.poly(ctx, [lx - 3, -47, lx + 3, -47, lx + 2, -54, lx - 2, -54], n > 0.3 ? '#ffd88a' : '#d8e4ea');
    art.poly(ctx, [lx - 6, -56, lx + 6, -56, lx, -61], G.mix('#3a3a44', '#15151d', n));
    // 樽
    art.facetPoly(ctx, [38, 0, 48, 0, 49, -7, 48, -14, 38, -14, 37, -7], G.mix('#9a6a3a', '#2e2430', n * 0.7), 0.12);
    art.poly(ctx, [37.3, -4, 48.7, -4, 48.8, -5.2, 37.2, -5.2], G.mix('#5a4a3a', '#1e1820', n * 0.7));
    art.poly(ctx, [37.3, -10, 48.7, -10, 48.8, -11.2, 37.2, -11.2], G.mix('#5a4a3a', '#1e1820', n * 0.7));
  }

  // ---------------------------------------------------------------- building
  const WALLPAPER = {
    hall: '#9a6c48', bunks: '#86624a', tavern: '#74492f', smithy: '#6c6560', training: '#8a7250', alchemy: '#55496e', tower: '#61707f',
  };

  function drawBuilding(st, n) {
    const built = G.sim.builtFloors(st);
    const nv = visibleFloors();
    const viewTop = camTop - 20, viewBot = camTop + cssH / s + 20;
    // 基礎
    art.poly(ctx, [WL - 6, 0, WR + 6, 0, WR + 4, 12, WL - 4, 12], '#7a7470');
    for (let i = 0; i < 12; i++) {
      const x = WL - 4 + i * 30;
      art.poly(ctx, [x, 1.5, x + 27, 1.5, x + 27, 10.5, x, 10.5], G.shade('#8a847e', (G.hash(i) - 0.5) * 0.14));
    }
    for (let f = 0; f < nv; f++) {
      const top = floorY(f + 1), bot = floorY(f);
      if (bot < viewTop || top > viewBot) continue;
      const fac = D.FACILITIES[f];
      const lv = st.fac[fac.id];
      const buildingNow = st.building && st.building.id === fac.id;
      if (lv > 0) drawRoom(st, f, fac, lv);
      else drawSite(st, f, fac, buildingNow);
      // 床板（この階の天井＝上の階の床）
      art.poly(ctx, [WL - 4, top, WR + 4, top, WR + 4, top + 9, WL - 4, top + 9], '#5e3f2a');
      art.poly(ctx, [WL - 4, top, WR + 4, top, WR + 4, top + 2.5, WL - 4, top + 2.5], '#7e5a3e');
      for (let x = WL; x < WR; x += 44) art.poly(ctx, [x, top + 2.5, x + 6, top + 2.5, x + 6, top + 9, x, top + 9], '#4e3322');
      // 外壁
      art.poly(ctx, [WL - 4, top, WL + 8, top, WL + 8, bot, WL - 4, bot], '#6b4a32');
      art.poly(ctx, [WL - 4, top, WL, top, WL, bot, WL - 4, bot], '#835c40');
      art.poly(ctx, [WR - 8, top, WR + 4, top, WR + 4, bot, WR - 8, bot], '#5a3e2a');
      // 柱
      art.poly(ctx, [STAIR - 3, top + 9, STAIR + 1, top + 9, STAIR + 1, bot, STAIR - 3, bot], 'rgba(60,38,24,0.35)');
    }
    // 1階の扉
    drawDoor();
    // 階段（建っている階どうし＋工事予定地へ）
    for (let f = 0; f < nv - 1; f++) drawStairs(f);
    // 屋根
    drawRoof(st, nv);
    // 看板
    drawSign(st);
  }

  // 夜：建物全体を少し青く沈める（このあと灯りを足し算で重ねる）
  function drawNight(n) {
    if (n <= 0) return;
    const nv = visibleFloors();
    const y = floorY(nv);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = G.rgba('#6b74b0', n * 0.45);
    // 建物の形（壁＋屋根＋煙突）だけを沈める
    ctx.beginPath();
    ctx.moveTo(WL - 6, 12);
    ctx.lineTo(WL - 6, y + 8);
    ctx.lineTo(WL - 20, y + 8);
    ctx.lineTo(WL - 20, y + 4);
    ctx.lineTo(WL - 18, y + 4);
    ctx.lineTo((WL + WR) / 2, y - 70);
    ctx.lineTo(WR + 18, y + 4);
    ctx.lineTo(WR + 20, y + 4);
    ctx.lineTo(WR + 20, y + 8);
    ctx.lineTo(WR + 6, y + 8);
    ctx.lineTo(WR + 6, 12);
    ctx.closePath();
    ctx.rect(312, y - 69, 20, 45);
    ctx.fill();
    ctx.restore();
  }

  function drawDoor() {
    const y = 0;
    // 開口部
    art.poly(ctx, [WL - 4, y, WL + 8, y, WL + 8, y - 44, WL - 4, y - 44], '#2e1e14');
    // 扉（開くと細くなる）
    const w = 12 * (1 - doorOpen * 0.82);
    art.poly(ctx, [WL - 4, y, WL - 4 + w, y, WL - 4 + w, y - 43, WL - 4, y - 43], '#8a5a34');
    art.poly(ctx, [WL - 4, y, WL - 4 + w * 0.5, y, WL - 4 + w * 0.5, y - 43, WL - 4, y - 43], '#9c6a40');
    if (w > 3) art.ellipse(ctx, WL - 4 + w - 2.4, y - 21, 1.1, 1.1, '#e8bd4c');
    // 上枠
    art.poly(ctx, [WL - 7, y - 44, WL + 11, y - 44, WL + 11, y - 48, WL - 7, y - 48], '#5e3f2a');
    // 扉のランタン
    art.poly(ctx, [WL - 10, y - 52, WL - 4, y - 52, WL - 5, y - 58, WL - 9, y - 58], '#3a3030');
    art.poly(ctx, [WL - 9.5, y - 52.5, WL - 4.5, y - 52.5, WL - 5.5, y - 57.5, WL - 8.5, y - 57.5], night > 0.3 ? '#ffd27a' : '#e0d8c0');
  }

  function drawStairs(f) {
    const y0 = floorY(f), y1 = floorY(f + 1);
    // 吹き抜けの奥
    ctx.fillStyle = 'rgba(30,18,10,0.18)';
    ctx.fillRect(STAIR + 1, y1 + 9, IR - STAIR - 1, y0 - y1 - 9);
    // 側桁
    art.poly(ctx, [384, y0, 388, y0, 340, y1 + 2, 334, y1 + 2], '#6a4630');
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const k = (i + 0.5) / steps;
      const x = G.lerp(382, 338, k), y = G.lerp(y0, y1 + 4, k);
      art.poly(ctx, [x - 5, y, x + 6, y, x + 6, y + 2.4, x - 5, y + 2.4], i % 2 ? '#a07650' : '#946c48');
    }
    // 手すり
    ctx.strokeStyle = '#4e3322';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(384, y0 - 22); ctx.lineTo(338, y1 - 18); ctx.stroke();
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      const x = G.lerp(384, 338, k), y = G.lerp(y0, y1 + 4, k);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, G.lerp(y0 - 22, y1 - 18, k)); ctx.stroke();
    }
  }

  function wallPlanks(f, color, stone) {
    const top = floorY(f + 1) + 9, bot = floorY(f);
    art.poly(ctx, [IL, top, IR, top, IR, bot, IL, bot], color);
    if (stone) {
      for (let r = 0; r < 7; r++) {
        const y = top + r * 16;
        const off = r % 2 ? 0 : 14;
        for (let x = IL - off; x < STAIR; x += 28) {
          const xx = Math.max(IL, x), w = Math.min(x + 26, STAIR) - xx;
          if (w <= 2) continue;
          const sh = (G.hash(f * 991 + r * 31 + x) - 0.5) * 0.16;
          art.poly(ctx, [xx + 1, y + 1, xx + w - 1, y + 1.5, xx + w - 1.5, Math.min(y + 15, bot), xx + 1, Math.min(y + 15, bot)], G.shade(color, sh));
        }
      }
    } else {
      for (let x = IL, i = 0; x < STAIR; x += 18, i++) {
        const sh = (G.hash(f * 131 + i) - 0.5) * 0.1;
        art.poly(ctx, [x, top, x + 17.4, top, x + 17.4, bot, x, bot], G.shade(color, sh));
        // 木目
        ctx.strokeStyle = G.rgba(G.shade(color, -0.3), 0.25);
        ctx.lineWidth = 0.4;
        const k = G.hash(i * 7 + f);
        ctx.beginPath(); ctx.moveTo(x + 5 + k * 6, top + 10); ctx.quadraticCurveTo(x + 8, top + 40 + k * 30, x + 4 + k * 8, bot - 12); ctx.stroke();
      }
    }
    // 腰板
    art.poly(ctx, [IL, bot - 26, STAIR, bot - 26, STAIR, bot, IL, bot], G.shade(color, -0.2));
    art.poly(ctx, [IL, bot - 27.5, STAIR, bot - 27.5, STAIR, bot - 25, IL, bot - 25], G.shade(color, 0.08));
    // 床
    art.poly(ctx, [IL, bot - 2, IR, bot - 2, IR, bot, IL, bot], G.shade(color, -0.35));
  }

  function windowAt(x, y, w, h, f) {
    const [skyT, skyB, duskK] = skyColors();
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 3, y + h + 3, x - 3, y + h + 3], '#5a3a26');
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, skyT);
    g.addColorStop(1, skyB);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const wx = weather();
    // 窓の外：空
    if (night > 0.4) {
      for (let i = 0; i < 6; i++) {
        const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + G.hash(i + x)) + i);
        ctx.fillStyle = `rgba(255,250,220,${(0.35 + tw * 0.5) * night})`;
        ctx.fillRect(x + G.hash(i + x) * w, y + G.hash(i * 3 + x) * h * 0.5, 0.7, 0.7);
      }
    }
    for (let i = 0; i < 2; i++) {
      const cw = 7 + i * 3;
      const cx = x + ((time * (2.4 + i * 1.3) + x * 3 + i * 23) % (w + cw * 2)) - cw;
      const cy = y + h * (0.18 + i * 0.16);
      const c = G.mix('#ffffff', '#4a5680', night * 0.85);
      art.poly(ctx, [cx - cw, cy, cx - cw * 0.5, cy - cw * 0.3, cx, cy - cw * 0.42, cx + cw * 0.6, cy - cw * 0.25, cx + cw, cy], G.rgba(c, 0.75 * (wx.cloud ? 1 : 0.8)));
    }
    // 窓の外：海（波・光の反射・ときどき船）
    const hy = y + h * 0.6;
    const seaT = G.mix(G.mix('#6cb8e4', '#e89a6a', duskK * 0.6), '#1a2a54', night);
    const seaB = G.mix('#2f7fbf', '#0c1634', night);
    const sg = ctx.createLinearGradient(0, hy, 0, y + h);
    sg.addColorStop(0, seaT);
    sg.addColorStop(1, seaB);
    ctx.fillStyle = sg;
    ctx.fillRect(x, hy, w, y + h - hy);
    ctx.fillStyle = G.rgba(G.mix('#eaf8ff', '#7080b0', night), 0.7);
    ctx.fillRect(x, hy, w, 0.6);
    for (let i = 0; i < Math.ceil(w / 5); i++) {
      const wy = hy + 1.5 + G.hash(i * 5 + x) * (y + h - hy - 2);
      const ww = 1.5 + G.hash(i * 7 + x) * 3;
      const wxp = x + ((G.hash(i * 3 + x) * w + time * (1.2 + G.hash(i) * 1.5)) % (w + 6)) - 3;
      const a = (0.3 + 0.35 * Math.sin(time * 2 + i * 1.9 + x)) * (1 - night * 0.55);
      ctx.fillStyle = `rgba(240,250,255,${a})`;
      ctx.fillRect(wxp, wy, ww, 0.5);
    }
    // 太陽や月の照り返し
    const glx = x + w * (0.3 + 0.4 * ((dayPhase * 3) % 1));
    for (let j = 0; j < 4; j++) {
      const a = 0.25 + 0.25 * Math.sin(time * 5 + j * 2);
      ctx.fillStyle = night > 0.5 ? `rgba(220,230,255,${a * 0.6})` : duskK > 0.3 ? `rgba(255,190,120,${a})` : `rgba(255,250,220,${a})`;
      const ww = 4 - j * 0.7;
      ctx.fillRect(glx - ww / 2 + Math.sin(time * 3 + j) * 0.8, hy + 2 + j * 2.2, ww, 0.6);
    }
    // 帆船がゆっくり横切る
    const bspan = w + 30;
    const bx = x - 15 + ((time * 1.6 + x * 7) % (bspan * 3));
    if (bx < x + w + 15) {
      const by = hy + 1.4 + Math.sin(time * 1.8) * 0.3;
      art.poly(ctx, [bx - 4, by, bx + 4, by, bx + 3, by + 1.6, bx - 3, by + 1.6], G.mix('#6a4a32', '#20182a', night));
      art.poly(ctx, [bx - 0.3, by, bx - 0.3, by - 6, bx + 3.4, by - 0.6], G.mix('#fff8ea', '#5a6080', night * 0.8));
      art.poly(ctx, [bx - 0.8, by, bx - 0.8, by - 4.4, bx - 3.6, by - 0.6], G.mix('#e8d8c0', '#4a5070', night * 0.8));
      if (night > 0.5) { ctx.fillStyle = 'rgba(255,210,120,0.9)'; ctx.fillRect(bx + 2, by - 0.6, 0.8, 0.8); }
    }
    // 夜の灯台のひかり
    if (night > 0.4) {
      const a = Math.max(0, Math.sin(time * 1.2 + x * 0.1)) ** 6;
      ctx.fillStyle = `rgba(255,240,180,${a * 0.9 * night})`;
      ctx.beginPath(); ctx.arc(x + w * 0.85, hy - 1, 1.2 + a * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // 雨
    if (wx.rain > 0) {
      ctx.strokeStyle = `rgba(200,220,255,${0.35 * wx.rain})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const rx = x + ((G.hash(i + x) * w + time * 20) % w);
        const ry = y + ((G.hash(i * 9 + x) * h + time * 60) % h);
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 1, ry + 3);
      }
      ctx.stroke();
    }
    ctx.restore();
    art.poly(ctx, [x, y, x + w * 0.35, y, x, y + h * 0.5], 'rgba(255,255,255,0.18)');
    // 桟
    ctx.fillStyle = '#5a3a26';
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    art.poly(ctx, [x - 4, y + h + 2, x + w + 4, y + h + 2, x + w + 3, y + h + 5, x - 3, y + h + 5], '#7e5a3e');
    // 昼の光の帯
    if (night < 0.6 && !wx.rain) {
      ctx.fillStyle = `rgba(255,240,200,${0.07 * (1 - night)})`;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w + 28, floorY(f) - 1);
      ctx.lineTo(x + 18, floorY(f) - 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 雨（建物の外だけに降る）
  function drawRain(st) {
    const wx = weather();
    if (!wx.rain) return;
    const viewTop = camTop, viewBot = camTop + cssH / s;
    const L = -offX / s - 4, R = (cssW - offX) / s + 4;
    const roofY = floorY(G.sim.builtFloors(st)) + 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, viewTop, R - L, viewBot - viewTop);
    ctx.rect(WR + 6, roofY, -(WR - WL + 12), 6 - roofY);
    ctx.clip('evenodd');
    ctx.fillStyle = `rgba(40,52,74,${0.1 * wx.rain})`;
    ctx.fillRect(L, viewTop, R - L, viewBot - viewTop);
    ctx.strokeStyle = `rgba(215,228,250,${0.55 * wx.rain})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const n = Math.round(130 * wx.rain);
    for (let i = 0; i < n; i++) {
      const x = L + ((G.hash(i * 7) * (R - L) + time * 30) % (R - L));
      const y = viewTop + ((G.hash(i * 13) * (viewBot - viewTop) + time * (260 + G.hash(i) * 80)) % (viewBot - viewTop));
      ctx.moveTo(x, y); ctx.lineTo(x - 2.2, y + 9);
    }
    ctx.stroke();
    // 地面の水しぶき
    for (let i = 0; i < 10; i++) {
      const x = L + G.hash(i * 31 + Math.floor(time * 3)) * (R - L);
      if (x > WL - 6 && x < WR + 6) continue;
      const k = (time * 3) % 1;
      ctx.strokeStyle = `rgba(210,225,250,${0.4 * (1 - k) * wx.rain})`;
      ctx.beginPath(); ctx.ellipse(x, 1, 1 + k * 4, 0.5 + k * 1.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // 天気：ゲーム内の1日ごとに決まる（晴れが多い。ときどき曇り・雨）
  let wxCache = { day: -1 };
  function weather() {
    const day = Math.floor(Date.now() / 1000 / DAY_LEN);
    if (wxCache.day !== day) {
      const h = G.hash(day * 977 + 13);
      wxCache = { day, cloud: h > 0.62, rain: 0, rainDay: h > 0.86 };
    }
    // 雨は1日のうち一部だけ、ふわっと降って止む
    if (wxCache.rainDay) {
      const k = dayPhase;
      wxCache.rain = G.clamp(G.bump((k - 0.2) / 0.45) * 1.3, 0, 1);
    } else wxCache.rain = 0;
    return wxCache;
  }
  SC.weather = weather;

  function box(x, yb, w, h, col, top = 3) {
    art.poly(ctx, [x, yb, x + w, yb, x + w, yb - h, x, yb - h], col);
    art.poly(ctx, [x, yb - h, x + w, yb - h, x + w - 1, yb - h - top, x + 1, yb - h - top], G.shade(col, 0.16));
    art.poly(ctx, [x, yb, x + 2, yb, x + 2, yb - h, x, yb - h], G.shade(col, 0.07));
  }

  function lightGlowList() { return SC._lights || (SC._lights = []); }

  function drawRoom(st, f, fac, lv) {
    const bot = floorY(f), top = floorY(f + 1) + 9;
    const lights = lightGlowList();
    switch (fac.id) {
      case 'hall': {
        wallPlanks(f, lv >= 2 ? WALLPAPER.hall : '#8a6448');
        windowAt(176, bot - 92, 26, 34, f);
        if (lv >= 5) {
          // ステンドグラス
          const cols = ['#e05a4a', '#4a8ae0', '#f0c94a', '#5ac08a'];
          for (let i = 0; i < 4; i++) art.poly(ctx, [176 + (i % 2) * 13, bot - 92 + Math.floor(i / 2) * 17, 189 + (i % 2) * 13, bot - 92 + Math.floor(i / 2) * 17, 189 + (i % 2) * 13, bot - 75 + Math.floor(i / 2) * 17], G.rgba(cols[i], 0.55));
        }
        if (lv === 1) {
          // ひび割れ・蜘蛛の巣（強化で消える）
          ctx.strokeStyle = 'rgba(40,24,14,0.45)';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(92, top + 6); ctx.lineTo(97, top + 18); ctx.lineTo(93, top + 26); ctx.lineTo(99, top + 36); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(300, bot - 60); ctx.lineTo(306, bot - 50); ctx.lineTo(302, bot - 42); ctx.stroke();
          ctx.strokeStyle = 'rgba(240,240,240,0.35)';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(IL, top + i * 4); ctx.lineTo(IL + 14 - i * 3, top); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(IL, top); ctx.lineTo(IL + 12, top + 12); ctx.stroke();
        }
        if (lv >= 2) {
          // 絨毯
          art.poly(ctx, [96, bot - 1, 176, bot - 1, 180, bot + 1, 92, bot + 1], '#a8433a');
          // 旗
          const fl = Math.sin(time * 1.2) * 0.8;
          art.poly(ctx, [74, top + 8, 92, top + 8, 92, top + 34 + fl, 83, top + 30, 74, top + 34 - fl], '#3f7a5e');
          art.star(ctx, 83, top + 19, 4, '#f0c94a');
        }
        if (lv >= 4) {
          // 角うさぎの剥製
          art.facet(ctx, 224, top + 18, 8, 5, 6, '#7a5230', 0, 0.12);
          art.poly(ctx, [220, top + 13, 216, top + 2, 222, top + 12], '#f0c94a');
          art.facet(ctx, 224, top + 13, 5.5, 5, 7, '#e9e2d6', 0, 0.12);
        }
        if (lv >= 3) {
          // シャンデリア
          ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(150, top); ctx.lineTo(150, top + 16); ctx.stroke();
          art.poly(ctx, [138, top + 16, 162, top + 16, 158, top + 19, 142, top + 19], '#4a3326');
          [140, 150, 160].forEach((x) => {
            art.poly(ctx, [x - 1, top + 16, x + 1, top + 16, x + 1, top + 12, x - 1, top + 12], '#f5ead0');
            flame(x, top + 11, 1.4);
            lights.push([x, top + 11, 40, 0.5]);
          });
          // 観葉植物
          box(300, bot, 10, 9, '#a0603a', 2);
          for (let i = 0; i < 5; i++) {
            const a = -1.2 + i * 0.6 + Math.sin(time + i) * 0.05;
            art.poly(ctx, [305, bot - 10, 305 + Math.sin(a) * 12 - 2, bot - 10 - Math.cos(a) * 14, 305 + Math.sin(a) * 12 + 2, bot - 10 - Math.cos(a) * 14], G.shade('#4f9445', i * 0.05));
          }
        }
        // 掲示板
        drawBoard(st, bot);
        // ベンチ
        box(72, bot - 8, 26, 3, '#7a5230', 2);
        art.poly(ctx, [74, bot, 76, bot, 76, bot - 8, 74, bot - 8], '#5a3a26');
        art.poly(ctx, [94, bot, 96, bot, 96, bot - 8, 94, bot - 8], '#5a3a26');
        break;
      }
      case 'bunks': {
        wallPlanks(f, WALLPAPER.bunks);
        windowAt(290, bot - 88, 24, 30, f);
        if (lv >= 3) art.poly(ctx, [80, bot - 1, 300, bot - 1, 304, bot + 1, 76, bot + 1], '#5a6a9a');
        // 箪笥
        box(296, bot, 22, 40, '#7a5230', 3);
        art.poly(ctx, [299, bot - 26, 315, bot - 26, 315, bot - 25, 299, bot - 25], '#5a3a26');
        art.poly(ctx, [299, bot - 13, 315, bot - 13, 315, bot - 12, 299, bot - 12], '#5a3a26');
        // ランタン
        art.poly(ctx, [240, top + 2, 241, top + 2, 241, top + 12, 240, top + 12], '#3a2a20');
        art.poly(ctx, [236, top + 12, 245, top + 12, 244, top + 22, 237, top + 22], '#3a3030');
        art.poly(ctx, [237.5, top + 13, 243.5, top + 13, 242.8, top + 21, 238.2, top + 21], '#ffd27a');
        lights.push([240.5, top + 17, 46, 0.55]);
        const beds = D.beds(lv);
        for (let i = 0; i < Math.ceil(beds / 2); i++) bunkFrame(92 + i * 58, bot, beds - i * 2 >= 2);
        break;
      }
      case 'tavern': {
        wallPlanks(f, WALLPAPER.tavern);
        // レンガの暖炉
        for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
          const x = IL + 2 + c * 12 + (r % 2) * 6, y = bot - 12 - r * 9;
          art.poly(ctx, [x, y, x + 11, y, x + 11, y + 8, x, y + 8], G.shade('#9a5040', (G.hash(r * 7 + c) - 0.5) * 0.2));
        }
        art.poly(ctx, [IL + 6, bot, IL + 36, bot, IL + 36, bot - 24, IL + 6, bot - 24], '#2a1810');
        art.poly(ctx, [IL, bot - 54, IL + 44, bot - 54, IL + 44, bot - 58, IL, bot - 58], '#6a4630');
        for (let i = 0; i < 5; i++) {
          const fx = IL + 12 + i * 5, fh = 9 + Math.sin(time * 9 + i * 2) * 3 + G.noise1(time * 4 + i) * 4;
          art.poly(ctx, [fx - 3, bot - 2, fx + 3, bot - 2, fx + Math.sin(time * 6 + i) * 1.5, bot - 2 - fh], i % 2 ? '#ff9a3a' : '#ffcf5a');
        }
        lights.push([IL + 21, bot - 10, 75, 0.8]);
        // 酒棚
        art.poly(ctx, [256, bot - 74, 326, bot - 74, 326, bot - 72, 256, bot - 72], '#5a3a26');
        art.poly(ctx, [256, bot - 54, 326, bot - 54, 326, bot - 52, 256, bot - 52], '#5a3a26');
        for (let i = 0; i < Math.min(9, 3 + lv); i++) {
          const x = 262 + (i % 5) * 13, y = i < 5 ? bot - 74 : bot - 54;
          const col = ['#4a8a5a', '#8a3a4a', '#c8a03a', '#3a5a8a', '#7a4a8a'][i % 5];
          art.poly(ctx, [x, y, x + 5, y, x + 5, y - 9, x + 3.5, y - 12, x + 3.5, y - 14, x + 1.5, y - 14, x + 1.5, y - 12, x, y - 9], col);
          art.poly(ctx, [x + 0.8, y - 2, x + 1.8, y - 2, x + 1.8, y - 8, x + 0.8, y - 8], 'rgba(255,255,255,0.35)');
        }
        if (lv >= 2) {
          [300, 314].forEach((x, i) => {
            art.facetPoly(ctx, [x - 7, bot - 2, x + 7, bot - 2, x + 8, bot - 10, x + 7, bot - 18, x - 7, bot - 18, x - 8, bot - 10], '#9a6a3a', 0.12);
          });
        }
        // 吊りランプ
        [140, 200].forEach((x) => {
          ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + 18); ctx.stroke();
          art.poly(ctx, [x - 5, top + 18, x + 5, top + 18, x + 3, top + 25, x - 3, top + 25], '#3a3030');
          art.poly(ctx, [x - 3, top + 19, x + 3, top + 19, x + 2, top + 24, x - 2, top + 24], '#ffd27a');
          lights.push([x, top + 22, 48, 0.55]);
        });
        if (lv >= 5) {
          // 楽団の看板
          art.poly(ctx, [182, top + 34, 222, top + 34, 222, top + 48, 182, top + 48], '#e8d8b0');
          ctx.fillStyle = '#5a3a26';
          ctx.font = G.font(700, 6);
          ctx.textAlign = 'center';
          ctx.fillText('本日の一杯', 202, top + 43.5);
        }
        break;
      }
      case 'smithy': {
        wallPlanks(f, WALLPAPER.smithy, true);
        // 炉
        art.facetPoly(ctx, [IL + 4, bot, IL + 52, bot, IL + 50, bot - 40, IL + 38, bot - 60, IL + 18, bot - 60, IL + 6, bot - 40], '#5e5550', 0.08);
        art.poly(ctx, [IL + 14, bot - 6, IL + 42, bot - 6, IL + 40, bot - 26, IL + 16, bot - 26], '#2a1810');
        const gl = 0.75 + Math.sin(time * 3) * 0.15 + G.noise1(time * 5) * 0.1;
        art.poly(ctx, [IL + 16, bot - 6, IL + 40, bot - 6, IL + 38, bot - 14, IL + 18, bot - 14], G.mix('#ff7a2a', '#ffd25a', gl - 0.5));
        lights.push([IL + 28, bot - 14, 80, 0.85 * gl]);
        art.poly(ctx, [IL + 22, bot - 60, IL + 34, bot - 60, IL + 33, top, IL + 23, top], '#4e4844');
        // 金床
        art.poly(ctx, [160, bot - 14, 190, bot - 14, 186, bot - 18, 164, bot - 18], '#4a4e56');
        art.poly(ctx, [190, bot - 14, 196, bot - 16, 186, bot - 18], '#4a4e56');
        art.poly(ctx, [168, bot, 182, bot, 178, bot - 14, 172, bot - 14], '#3a3e46');
        art.poly(ctx, [164, bot - 18, 186, bot - 18, 184, bot - 19.5, 166, bot - 19.5], '#7a808a');
        // 水桶
        box(128, bot, 16, 12, '#7a5230', 2);
        art.poly(ctx, [129, bot - 12, 143, bot - 12, 143, bot - 13.4, 129, bot - 13.4], '#5aa0c8');
        // 武器棚
        art.poly(ctx, [244, bot - 66, 316, bot - 66, 316, bot - 63, 244, bot - 63], '#5a3a26');
        for (let i = 0; i < Math.min(7, 1 + Math.ceil(lv * 0.7)); i++) {
          const x = 252 + i * 10;
          art.sword(ctx, x, bot - 26, 0, 30);
        }
        break;
      }
      case 'training': {
        wallPlanks(f, WALLPAPER.training);
        windowAt(96, bot - 92, 26, 32, f);
        art.poly(ctx, [100, bot - 1, 300, bot - 1, 300, bot + 1, 100, bot + 1], '#5a7a4a');
        const ds = dummyXs();
        ds.forEach((x, i) => {
          const wob = Math.sin(time * 22) * dummyWobble[i] * 0.3;
          ctx.save();
          ctx.translate(x, bot);
          ctx.rotate(wob);
          art.poly(ctx, [-1.2, 0, 1.2, 0, 1.2, -36, -1.2, -36], '#6a4630');
          art.facetPoly(ctx, [-6, -12, 6, -12, 7, -26, 5, -30, -5, -30, -7, -26], '#d8b860', 0.12);
          art.poly(ctx, [-9, -26, 9, -26, 9, -24, -9, -24], '#c8a850');
          art.facet(ctx, 0, -35, 5, 5, 7, '#d8b860', 0, 0.14);
          art.poly(ctx, [-2.5, -36, -1, -36, -1, -34.5, -2.5, -34.5], '#5a3a26');
          ctx.restore();
        });
        // 的
        art.facet(ctx, 300, bot - 52, 10, 10, 10, '#f0e6d0', 0, 0.08);
        art.facet(ctx, 300, bot - 52, 6.5, 6.5, 10, '#d4493a', 0, 0.08);
        art.facet(ctx, 300, bot - 52, 3, 3, 10, '#f0e6d0', 0, 0.08);
        // 張り紙
        art.poly(ctx, [190, top + 16, 216, top + 14, 217, top + 34, 191, top + 35], '#efe2c4');
        ctx.fillStyle = '#7a3a2e';
        ctx.font = G.font(800, 6);
        ctx.textAlign = 'center';
        ctx.fillText('根性', 204, top + 28);
        break;
      }
      case 'alchemy': {
        wallPlanks(f, WALLPAPER.alchemy, true);
        // 本棚
        box(262, bot, 54, 70, '#5a3a26', 3);
        for (let r = 0; r < 4; r++) {
          art.poly(ctx, [264, bot - 4 - r * 17, 314, bot - 4 - r * 17, 314, bot - 5.5 - r * 17, 264, bot - 5.5 - r * 17], '#3a2416');
          for (let b = 0; b < 8; b++) {
            const h = 9 + G.hash(r * 8 + b) * 5;
            art.poly(ctx, [265 + b * 6, bot - 6 - r * 17, 270 + b * 6, bot - 6 - r * 17, 270 + b * 6, bot - 6 - r * 17 - h, 265 + b * 6, bot - 6 - r * 17 - h], ['#8a3a4a', '#3a5a8a', '#4a8a5a', '#c8a03a', '#6a4a8a'][(r + b) % 5]);
          }
        }
        // 大釜
        const hue = (time * 0.15) % 1;
        const liq = G.mix('#7fe0c0', '#c79bff', G.bump(hue));
        art.facetPoly(ctx, [96, bot - 4, 136, bot - 4, 142, bot - 18, 138, bot - 30, 94, bot - 30, 90, bot - 18], '#3a3640', 0.12);
        art.poly(ctx, [96, bot - 30, 136, bot - 30, 134, bot - 33, 98, bot - 33], liq);
        lights.push([116, bot - 34, 60, 0.6]);
        if (Math.random() < 0.15) addPart({ type: 'bubble', x: G.rand(100, 132), y: bot - 33, vx: 0, vy: -10, g: 0, life: 0, max: G.rand(0.6, 1.2), col: liq, size: G.rand(1, 2.4) });
        art.poly(ctx, [100, bot, 104, bot, 104, bot - 4, 100, bot - 4], '#2a2630');
        art.poly(ctx, [128, bot, 132, bot, 132, bot - 4, 128, bot - 4], '#2a2630');
        // 机とフラスコ
        box(190, bot - 20, 50, 3, '#6a4630', 2);
        art.poly(ctx, [194, bot, 197, bot, 197, bot - 20, 194, bot - 20], '#4e3322');
        art.poly(ctx, [233, bot, 236, bot, 236, bot - 20, 233, bot - 20], '#4e3322');
        ['#ff7a8a', '#7fe0c0', '#ffd25a', '#9a8cff'].slice(0, 1 + Math.min(3, lv)).forEach((c, i) => {
          const x = 198 + i * 11;
          art.poly(ctx, [x, bot - 23, x + 7, bot - 23, x + 5, bot - 30, x + 2, bot - 30], c);
          art.poly(ctx, [x + 2, bot - 30, x + 5, bot - 30, x + 5, bot - 35, x + 2, bot - 35], 'rgba(230,240,255,0.7)');
        });
        if (Math.random() < 0.08) sparkle(G.rand(80, 300), bot - G.rand(20, 90), '#d8c8ff');
        break;
      }
      case 'tower': {
        wallPlanks(f, WALLPAPER.tower, true);
        windowAt(110, bot - 96, 70, 56, f);
        // 地図の机
        box(196, bot - 22, 40, 3, '#6a4630', 2);
        art.poly(ctx, [198, bot - 25, 234, bot - 25, 232, bot - 27, 200, bot - 27], '#e8d8b0');
        art.poly(ctx, [200, bot, 203, bot, 203, bot - 22, 200, bot - 22], '#4e3322');
        art.poly(ctx, [229, bot, 232, bot, 232, bot - 22, 229, bot - 22], '#4e3322');
        // 望遠鏡
        ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(262, bot); ctx.lineTo(272, bot - 28); ctx.lineTo(282, bot); ctx.moveTo(272, bot - 28); ctx.lineTo(272, bot); ctx.stroke();
        ctx.save(); ctx.translate(272, bot - 30); ctx.rotate(-0.5);
        art.poly(ctx, [-14, -2, 14, -3.4, 14, 3.4, -14, 2], '#c8a03a');
        art.poly(ctx, [-14, -2, 14, -3.4, 14, 0, -14, 0], '#e0bc5a');
        ctx.restore();
        break;
      }
    }
    // 光の演出
    if (flashFloor && flashFloor.f === f) {
      const k = 1 - flashFloor.t / 1.2;
      ctx.fillStyle = `rgba(255,240,190,${0.5 * k})`;
      ctx.fillRect(IL, top, IR - IL, bot - top);
    }
  }

  function flame(x, y, r) {
    const h = r * 2.6 + Math.sin(time * 12 + x) * r * 0.5;
    art.poly(ctx, [x - r, y, x + r, y, x, y - h], '#ffcf5a');
    art.poly(ctx, [x - r * 0.5, y, x + r * 0.5, y, x, y - h * 0.55], '#fff4c0');
  }

  function bunkFrame(x, bot, two) {
    const wood = '#7a5230';
    // 柱
    art.poly(ctx, [x - 20, bot, x - 17, bot, x - 17, bot - 62, x - 20, bot - 62], wood);
    art.poly(ctx, [x + 18, bot, x + 21, bot, x + 21, bot - 62, x + 18, bot - 62], G.shade(wood, -0.1));
    [0, 1].forEach((tier) => {
      if (tier === 1 && !two) return;
      const y = bot - 9 - tier * 30;
      art.poly(ctx, [x - 18, y, x + 19, y, x + 19, y + 4, x - 18, y + 4], G.shade(wood, -0.05));
      art.poly(ctx, [x - 17, y, x + 18, y, x + 18, y - 3, x - 17, y - 3], '#efe6d6');
      // 枕
      art.poly(ctx, [x - 16, y - 3, x - 6, y - 3, x - 7, y - 7, x - 15, y - 7], '#fffaf0');
    });
    // はしご
    ctx.strokeStyle = G.shade(wood, 0.1); ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 18, bot - 10 - i * 8); ctx.lineTo(x + 23, bot - 10 - i * 8); ctx.stroke(); }
  }

  function drawBoard(st, bot) {
    const x = 112, y = bot - 76, w = 56, h = 40;
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 3, y + h + 3, x - 3, y + h + 3], '#5a3a26');
    art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#b08a5e');
    // 紙
    const n = Math.min(7, st.board.length);
    for (let i = 0; i < n; i++) {
      const q = st.board[i];
      const col = i % 4, row = Math.floor(i / 4);
      const px = x + 4 + col * 13, py = y + 4 + row * 19;
      const pop = paperPop.find((p) => p.i === i);
      const sc = pop ? G.ease.outBack(Math.min(1, pop.t / 0.5)) : 1;
      const flutter = Math.sin(time * 2 + i * 1.7) * 0.4;
      ctx.save();
      ctx.translate(px + 5, py);
      ctx.scale(sc, sc);
      ctx.rotate((G.hash(i * 3) - 0.5) * 0.12);
      const area = D.AREA_BY_ID[q.area];
      art.poly(ctx, [-5, 0, 5, 0, 5 + flutter * 0.4, 14, -5 + flutter * 0.4, 14.4], q.boss ? '#ffe6a0' : '#f5ead0');
      art.poly(ctx, [-5, 0, 5, 0, 5, 3, -5, 3], area.pal.mid);
      ctx.fillStyle = 'rgba(80,60,40,0.5)';
      ctx.fillRect(-3.5, 5.5, 7, 0.8);
      ctx.fillRect(-3.5, 8, 5, 0.8);
      ctx.fillRect(-3.5, 10.5, 6, 0.8);
      art.ellipse(ctx, 0, 0.5, 1.2, 1.2, '#d4493a');
      ctx.restore();
    }
    // 看板の文字
    art.poly(ctx, [x + 12, y - 12, x + w - 12, y - 12, x + w - 12, y - 4, x + 12, y - 4], '#e8d8b0');
    ctx.fillStyle = '#5a3a26';
    ctx.font = G.font(800, 5.5);
    ctx.textAlign = 'center';
    ctx.fillText('依頼', x + w / 2, y - 6.2);
  }

  function drawSite(st, f, fac, buildingNow) {
    const bot = floorY(f), top = floorY(f + 1) + 9;
    // 空き部屋
    art.poly(ctx, [IL, top, IR, top, IR, bot, IL, bot], 'rgba(60,40,28,0.55)');
    // 足場
    ctx.strokeStyle = '#a07650';
    ctx.lineWidth = 2;
    for (let x = IL + 20; x < STAIR; x += 60) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.stroke(); }
    ctx.lineWidth = 1.4;
    for (let y = bot - 30; y > top; y -= 34) { ctx.beginPath(); ctx.moveTo(IL + 10, y); ctx.lineTo(STAIR - 10, y); ctx.stroke(); }
    ctx.lineWidth = 0.8;
    for (let x = IL + 20; x < STAIR - 60; x += 60) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x + 60, bot - 30); ctx.stroke(); }
    const stt = G.sim.facState(fac.id, st);
    const cx = (IL + STAIR) / 2;
    if (buildingNow) {
      const b = st.building;
      const k = G.clamp(1 - (b.endAt - G.now()) / Math.max(1, b.dur), 0, 1);
      // 作業中の大工（ハンマー）
      const hamK = (time * 2.2) % 1;
      ctx.save();
      ctx.translate(cx - 30, bot);
      art.person(ctx, { cls: 'warrior', role: 'carpenter', seed: 5, skin: '#e0a87e', hair: '#5a3a2a', style: 'short', outfit: '#c08a3a', apron: '#7a4f2e', pants: '#4a3a2e' }, { t: time, state: 'hammer', swing: G.clamp(hamK / 0.3, 0, 1), item: 'hammer', facing: 1 });
      ctx.restore();
      // 進捗バー
      art.rrect(ctx, cx - 50, top + 22, 100, 9, 4.5);
      ctx.fillStyle = 'rgba(20,12,8,0.6)';
      ctx.fill();
      art.rrect(ctx, cx - 49, top + 23, Math.max(7, 98 * k), 7, 3.5);
      ctx.fillStyle = '#f0c94a';
      ctx.fill();
      ctx.fillStyle = '#fff6dc';
      ctx.font = G.font(800, 7);
      ctx.textAlign = 'center';
      ctx.fillText(`${fac.name}を建設中… ${G.fmtClock(b.endAt - G.now())}`, cx, top + 17);
    } else {
      // 看板
      art.poly(ctx, [cx - 66, top + 30, cx + 66, top + 30, cx + 66, top + 58, cx - 66, top + 58], '#e8d8b0');
      art.poly(ctx, [cx - 66, top + 30, cx + 66, top + 30, cx + 66, top + 33, cx - 66, top + 33], '#c8b890');
      art.poly(ctx, [cx - 2, top + 58, cx + 2, top + 58, cx + 2, bot, cx - 2, bot], '#7a5230');
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5a3a26';
      ctx.font = G.font(800, 8);
      ctx.fillText(stt === 'locked' ? `${fac.name}（ランク${fac.rank}）` : `${fac.name} 建設予定地`, cx, top + 44);
      ctx.font = G.font(700, 6.5);
      ctx.fillStyle = stt === 'buildable' ? '#3f8a5e' : '#8a6a4a';
      const c = fac.cost(0);
      ctx.fillText(stt === 'locked' ? 'ギルドランクを上げると建てられる' : `タップして建てる ・ ${G.fmt(c.gold)}G${c.mat ? ' ' + c.mat + '素材' : ''}`, cx, top + 53);
      if (stt === 'buildable' && G.sim.canAfford(c, st)) {
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;
        ctx.strokeStyle = `rgba(240,201,74,${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 68, top + 28, 136, 32);
      }
    }
  }

  function drawRoof(st, nv) {
    const y = floorY(nv);
    const peakY = y - 70;
    art.poly(ctx, [WL - 18, y + 4, WR + 18, y + 4, (WL + WR) / 2, peakY], '#8a3a2e');
    // 瓦の段
    for (let i = 0; i < 6; i++) {
      const k0 = i / 6, k1 = (i + 1) / 6;
      const yy0 = G.lerp(y + 4, peakY, k0), yy1 = G.lerp(y + 4, peakY, k1);
      const xl0 = G.lerp(WL - 18, (WL + WR) / 2, k0), xr0 = G.lerp(WR + 18, (WL + WR) / 2, k0);
      const xl1 = G.lerp(WL - 18, (WL + WR) / 2, k1), xr1 = G.lerp(WR + 18, (WL + WR) / 2, k1);
      art.poly(ctx, [xl0, yy0, (xl0 + xr0) / 2, yy0, (xl1 + xr1) / 2, yy1, xl1, yy1], G.shade('#a8483a', i % 2 ? 0.04 : -0.02));
      art.poly(ctx, [(xl0 + xr0) / 2, yy0, xr0, yy0, xr1, yy1, (xl1 + xr1) / 2, yy1], G.shade('#8a3a2e', i % 2 ? -0.04 : -0.1));
    }
    art.poly(ctx, [WL - 20, y + 4, WR + 20, y + 4, WR + 20, y + 8, WL - 20, y + 8], '#5e3f2a');
    // 煙突
    art.poly(ctx, [314, y - 24, 330, y - 24, 330, y - 64, 314, y - 64], '#8a5040');
    art.poly(ctx, [312, y - 64, 332, y - 64, 332, y - 69, 312, y - 69], '#6a3a30');
    // 屋根窓
    art.poly(ctx, [196, y - 10, 248, y - 10, 222, y - 40], '#6a2e24');
    art.poly(ctx, [210, y - 10, 234, y - 10, 234, y - 26, 222, y - 33, 210, y - 26], night > 0.4 ? '#ffcf7a' : '#9fc8e0');
    ctx.fillStyle = '#4e3322';
    ctx.fillRect(221, y - 32, 2, 22);
    // 旗
    const fx = (WL + WR) / 2, fy = peakY;
    art.poly(ctx, [fx - 1, fy, fx + 1, fy, fx + 1, fy - 30, fx - 1, fy - 30], '#4e3322');
    const flagCol = st.rank >= 9 ? '#f0c94a' : '#3f7a5e';
    const pts = [fx + 1, fy - 30];
    for (let i = 0; i <= 6; i++) pts.push(fx + 1 + i * 4, fy - 30 + Math.sin(time * 4 - i * 0.8) * 1.6 * (i / 6));
    for (let i = 6; i >= 0; i--) pts.push(fx + 1 + i * 4, fy - 18 + Math.sin(time * 4 - i * 0.8) * 1.6 * (i / 6));
    art.poly(ctx, pts, flagCol);
    art.star(ctx, fx + 10, fy - 24 + Math.sin(time * 4 - 2) * 0.6, 2.6, st.rank >= 9 ? '#fff6c0' : '#f0c94a');
  }

  function drawSign(st) {
    // 扉の上の看板（ギルド名と星）
    const x = WL + 14, y = -58;
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 8); ctx.lineTo(x + 6, y); ctx.moveTo(x + 40, y - 8); ctx.lineTo(x + 40, y); ctx.stroke();
  }

  function drawLights(st, n) {
    const lights = lightGlowList();
    const k = 0.18 + n * 0.75;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    lights.forEach(([x, y, r, a]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,170,80,${0.32 * a * k})`);
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    if (n > 0.2) {
      // 街灯と扉のランタン
      [[22, -50, 50], [WL - 7, -55, 34]].forEach(([x, y, r]) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,200,110,${0.5 * n})`);
        g.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
    }
    ctx.restore();
    lights.length = 0;
  }

  // ---------------------------------------------------------------- characters
  function drawAgents() {
    // 階ごと、奥→手前
    const list = agents.filter((a) => a.visible && !a.away);
    list.sort((a, b) => (a.kind === 'staff' ? -1 : 0) - (b.kind === 'staff' ? -1 : 0));
    list.forEach(drawAgent);
  }
  function drawAgent(a) {
    let [x, y] = agentPos(a);
    const viewTop = camTop - 60, viewBot = camTop + cssH / s + 60;
    if (y < viewTop || y > viewBot) return;
    if (a.sleeping && a.bed != null) {
      const b = bedPos(a.bed);
      ctx.save();
      ctx.translate(b.x + 2, b.y - 3);
      art.sleeper(ctx, a.look, a.t, a.look.outfit);
      ctx.restore();
      return;
    }
    if (a.seat != null && (a.state === 'drink' || a.state === 'sit')) y += 0;
    const jump = a.jump > 0 ? -Math.sin(a.jump * Math.PI) * 6 : 0;
    ctx.save();
    ctx.translate(x, y + jump);
    ctx.scale(PS, PS);
    art.person(ctx, a.look, {
      t: a.t, state: a.state, phase: a.phase, facing: a.facing, blink: a.blink, talk: a.bubble && a.bubble.t < 1.2,
      expr: a.state === 'cheer' ? 'happy' : null, swing: a.swing, armed: a.armed, item: a.item,
    });
    ctx.restore();
  }

  function drawFront(st) {
    // 人の手前に来る家具：受付カウンター、酒場のテーブルとカウンター
    const b0 = floorY(0);
    // 受付カウンター
    const lv = st.fac.hall;
    const CH = 19;
    box(214, b0, 70, CH, lv >= 5 ? '#8a5a34' : '#7a5230', 3);
    art.poly(ctx, [214, b0 - CH, 284, b0 - CH, 284, b0 - CH + 2, 214, b0 - CH + 2], lv >= 5 ? '#e8bd4c' : '#5e3f2a');
    for (let i = 0; i < 3; i++) art.poly(ctx, [222 + i * 22, b0 - CH + 5, 236 + i * 22, b0 - CH + 5, 236 + i * 22, b0 - 5, 222 + i * 22, b0 - 5], G.shade('#7a5230', -0.12));
    // 帳簿と羽ペン・ろうそく
    art.poly(ctx, [256, b0 - CH - 3.5, 270, b0 - CH - 3.5, 271, b0 - CH - 1, 255, b0 - CH - 1], '#efe2c4');
    ctx.strokeStyle = '#f5f0e8'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(268, b0 - CH - 3); ctx.lineTo(274, b0 - CH - 12); ctx.stroke();
    art.poly(ctx, [276, b0 - CH - 3, 279, b0 - CH - 3, 279, b0 - CH - 9, 276, b0 - CH - 9], '#f5ead0');
    flame(277.5, b0 - CH - 9.5, 1.2);
    lightGlowList().push([277.5, b0 - CH - 11, 36, 0.5]);
    if (st.fac.tavern > 0) {
      const b2 = floorY(2);
      const seats = D.seats(st.fac.tavern);
      [112, 166, 220].forEach((tx, i) => {
        if (seats <= i * 2) return;
        // 椅子
        [-15, 15].forEach((d, j) => {
          if (seats <= i * 2 + j) return;
          art.poly(ctx, [tx + d - 5, b2 - 9, tx + d + 5, b2 - 9, tx + d + 5, b2 - 7, tx + d - 5, b2 - 7], '#6a4630');
          art.poly(ctx, [tx + d - 4, b2, tx + d - 3, b2, tx + d - 3, b2 - 7, tx + d - 4, b2 - 7], '#4e3322');
          art.poly(ctx, [tx + d + 3, b2, tx + d + 4, b2, tx + d + 4, b2 - 7, tx + d + 3, b2 - 7], '#4e3322');
        });
        art.facetPoly(ctx, [tx - 12, b2 - 18, tx + 12, b2 - 18, tx + 10, b2 - 21, tx - 10, b2 - 21], '#8a5a34', 0.1);
        art.poly(ctx, [tx - 1.5, b2, tx + 1.5, b2, tx + 1.5, b2 - 18, tx - 1.5, b2 - 18], '#5e3f2a');
        art.poly(ctx, [tx - 6, b2, tx + 6, b2, tx + 4, b2 - 2, tx - 4, b2 - 2], '#5e3f2a');
      });
      // バーカウンター
      box(270, b2, 56, 24, '#6e4630', 3);
      art.poly(ctx, [270, b2 - 24, 326, b2 - 24, 326, b2 - 22, 270, b2 - 22], '#e8bd4c');
      if (seats > 6) [252, 268].slice(0, seats - 6).forEach((x) => {
        art.poly(ctx, [x - 4, b2 - 12, x + 4, b2 - 12, x + 4, b2 - 10, x - 4, b2 - 10], '#6a4630');
        art.poly(ctx, [x - 0.8, b2, x + 0.8, b2, x + 0.8, b2 - 10, x - 0.8, b2 - 10], '#4e3322');
      });
      // カウンター上のジョッキ
      art.mug(ctx, 290, b2 - 25.5);
      art.mug(ctx, 308, b2 - 25.5);
    }
  }

  // ---------------------------------------------------------------- overlays
  function drawParticles() {
    parts.forEach((p) => {
      const k = p.life / p.max;
      const a = 1 - k;
      switch (p.type) {
        case 'spark':
          ctx.fillStyle = G.rgba(p.col, a);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.life * 4);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        case 'tri':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          art.poly(ctx, [-p.size, p.size * 0.6, p.size, p.size * 0.6, 0, -p.size], G.rgba(p.col, Math.min(1, a * 2)));
          ctx.restore();
          break;
        case 'text':
          ctx.save();
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.font = G.font(900, 9);
          ctx.textAlign = 'center';
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(60,30,10,0.8)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.col;
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();
          break;
        case 'note':
          ctx.save();
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.font = G.font(800, p.size || 8);
          ctx.textAlign = 'center';
          ctx.fillStyle = p.col;
          ctx.fillText(p.text, p.x + Math.sin(p.life * 4) * 2, p.y);
          ctx.restore();
          break;
        case 'smoke':
          ctx.fillStyle = `rgba(${night > 0.5 ? '120,120,140' : '230,230,235'},${0.35 * a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k * 2), 0, Math.PI * 2); ctx.fill();
          break;
        case 'dust':
          ctx.fillStyle = `rgba(200,180,150,${0.45 * a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + k), 0, Math.PI * 2); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = `rgba(255,240,200,${0.7 * a})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, 4 + k * 12, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'bubble':
          ctx.strokeStyle = G.rgba(p.col, a);
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
          break;
      }
    });
  }
  function drawCoins() {
    coins.forEach((c, i) => {
      const age = time - c.born;
      const pop = G.ease.outBack(Math.min(1, age / 0.4));
      const bob = Math.sin(time * 3 + i) * 1.4;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(pop, pop);
      // 光の輪
      const g = ctx.createRadialGradient(0, -4, 0, 0, -4, 14);
      g.addColorStop(0, 'rgba(255,220,120,0.55)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-14, -18, 28, 28);
      art.coin(ctx, 0, -4, c.kind === 'desk' ? 5.5 : 4.6, time + i);
      if (c.kind === 'desk') {
        ctx.font = G.font(800, 6);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff6dc';
        ctx.strokeStyle = 'rgba(60,30,10,0.7)';
        ctx.lineWidth = 2;
        const v = '+' + G.fmt(G.state.deskCoins);
        ctx.strokeText(v, 0, -12);
        ctx.fillText(v, 0, -12);
      }
      ctx.restore();
    });
    // チップが満杯の時のお知らせ
    const st = G.state;
    if (st.fac.tavern > 0 && st.fac.tavern < 4 && st.tips.length >= D.tipCap(st.fac.tavern)) {
      const y = floorY(3) + 20;
      const p = 0.5 + Math.sin(time * 5) * 0.5;
      art.bubble(ctx, 190, y + 4, 'チップが満杯！ タップで回収', 0.75 + p * 0.25, 1);
    }
  }
  function drawBubbles() {
    agents.forEach((a) => {
      if (!a.bubble || !a.visible || a.away) return;
      let [x, y] = agentPos(a);
      if (a.sleeping && a.bed != null) { const b = bedPos(a.bed); x = b.x - 6; y = b.y + 6; }
      const b = a.bubble;
      const inK = G.ease.outBack(Math.min(1, b.t / 0.25));
      const out = b.t > b.dur - 0.25 ? (b.dur - b.t) / 0.25 : 1;
      art.bubble(ctx, x, y - (a.look.height ? 34 : 40) * PS, b.text, out, inK);
    });
  }

  SC.ready = false;
  SC.start = function () {
    const st = G.state;
    syncStaff();
    st.adv.forEach((a) => { if (a.status === 'idle') spawnAdv(a, false); });
    SC.focusBottom();
    SC.ready = true;
  };
})();
