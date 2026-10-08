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
      for (let i = 0; i < 70; i++) confetti(G.rand(IL, IR), floorY(f) - G.rand(20, 100));
      celebrate(id, 'built');
      syncStaff();
      SC.focusFloor(f);
    });
    G.on('upgraded', (id) => celebrate(id, 'up'));
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
    // 深淵の扉
    if (SC.abyssDoorHit(wx, wy)) {
      const ab = G.state.abyss;
      if (ab && ab.open) {
        G.audio.sfx('open');
        G.ui.openSheet('quests');
        setTimeout(() => { const el = G.$('.card.abyss, .card.abyss-act'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); } }, 80);
      } else { G.audio.sfx('soft'); G.ui.toast('古い扉に鎖がかかっている…（ランク6で開く）', 'info'); }
      return;
    }
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
  function firework(x, y) {
    const cols = ['#ffe58f', '#ff8a7a', '#8ad8ff', '#b8f08a', '#e0a8ff', '#ffffff'];
    const col = G.pick(cols), col2 = G.pick(cols);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + G.rand(-0.08, 0.08), sp = G.rand(50, 72);
      addPart({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 46, life: 0, max: G.rand(0.8, 1.2), col: i % 3 ? col : col2, size: G.rand(1.4, 2.2), rot: G.rand(0, 6), drag: 1.8 });
    }
    addPart({ type: 'ring', x, y, life: 0, max: 0.5, vx: 0, vy: 0, g: 0, big: 3 });
  }
  function starPop(x, y) {
    addPart({ type: 'star', x, y, vx: G.rand(-10, 10), vy: G.rand(-26, -8), g: 0, life: 0, max: G.rand(0.9, 1.5), col: G.pick(['#fff6c8', '#ffe07a', '#ffffff']), size: G.rand(2.4, 4.2) });
  }
  function ember(x, y) {
    addPart({ type: 'spark', x, y, vx: G.rand(-6, 6), vy: G.rand(-34, -18), g: -4, life: 0, max: G.rand(0.9, 1.6), col: G.pick(['#ffd45a', '#ff9a3a', '#9fe8ff']), size: G.rand(0.8, 1.4), rot: 0 });
  }

  // ---------------------------------------------------------------- 強化の演出
  // 毎回：金色の光の帯が部屋を横切り「Lv UP!」。グレードが上がると紙吹雪と花火、MAX はさらに大きく。
  const celebs = [];
  const CELEB_DUR = [1.9, 2.8, 3.8];
  function celebrate(id, kind) {
    const fac = D.FAC[id];
    if (!fac) return;
    const f = fac.floor;
    const lv = G.state.fac[id] || 1;
    const tier = tierOf(id, lv), prev = tierOf(id, Math.max(1, lv - 1));
    const big = kind === 'built' ? 1 : lv >= fac.maxLv ? 2 : tier > prev ? 1 : 0;
    celebs.push({ f, t: 0, big, lv, kind, name: fac.name, next: 0 });
    while (celebs.length > 3) celebs.shift();
    flashFloor = { f, t: 0 };
    const bot = floorY(f);
    const n = [26, 44, 70][big];
    for (let i = 0; i < n; i++) sparkle(G.rand(IL + 10, STAIR - 10), bot - G.rand(10, 95), G.pick(['#ffe58f', '#fff6c8', '#ffd45a']));
    if (big) for (let i = 0; i < n; i++) confetti(G.rand(IL, STAIR), bot - G.rand(50, 104));
    for (let i = 0; i < [4, 8, 14][big]; i++) starPop(G.rand(IL + 20, STAIR - 20), bot - G.rand(20, 90));
    if (big === 2 && !G.reducedMotion()) shake = Math.max(shake, 0.6);
  }
  function updateCelebs(dt) {
    for (let i = celebs.length - 1; i >= 0; i--) {
      const c = celebs[i];
      c.t += dt;
      const bursts = c.big === 2 ? 5 : c.big === 1 ? 2 : 0;
      while (c.next < bursts && c.t > 0.3 + c.next * 0.42) {
        firework(G.rand(IL + 40, STAIR - 40), floorY(c.f) - G.rand(56, 96));
        c.next++;
      }
      if (c.big && Math.random() < dt * (c.big === 2 ? 14 : 6)) starPop(G.rand(IL + 10, STAIR - 10), floorY(c.f) - G.rand(16, 96));
      if (c.t > CELEB_DUR[c.big]) celebs.splice(i, 1);
    }
  }
  function drawCelebs() {
    celebs.forEach((c) => {
      const bot = floorY(c.f), top = floorY(c.f + 1) + 9;
      const dur = CELEB_DUR[c.big];
      ctx.save();
      ctx.beginPath(); ctx.rect(IL - 8, top - 4, IR - IL + 16, bot - top + 8); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      // 金色の光の帯（斜めに横切る）
      const sweeps = c.big === 2 ? 3 : c.big === 1 ? 2 : 1;
      for (let k = 0; k < sweeps; k++) {
        const p = (c.t - k * 0.5) / 0.95;
        if (p <= 0 || p >= 1) continue;
        const cx = G.lerp(IL - 70, IR + 70, G.ease.inOut(p));
        ctx.save();
        ctx.translate(cx, (top + bot) / 2);
        ctx.rotate(0.38);
        const w = c.big ? 46 : 36;
        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, 'rgba(255,214,110,0)');
        g.addColorStop(0.4, 'rgba(255,214,110,0.32)');
        g.addColorStop(0.5, 'rgba(255,250,220,0.62)');
        g.addColorStop(0.6, 'rgba(255,214,110,0.32)');
        g.addColorStop(1, 'rgba(255,214,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-w, -110, w * 2, 220);
        ctx.restore();
      }
      // 縁の光
      if (c.big) {
        const a = G.bump(c.t / dur) * (0.6 + 0.4 * Math.sin(c.t * 12));
        ctx.strokeStyle = `rgba(255,214,110,${(a * 0.9).toFixed(2)})`;
        ctx.lineWidth = c.big === 2 ? 3 : 2;
        ctx.strokeRect(IL + 1.5, top + 1.5, IR - IL - 3, bot - top - 3);
      }
      ctx.restore();
      // 文字
      const inK = G.ease.outBack(Math.min(1, c.t / 0.35));
      const out = G.clamp((dur - c.t) / 0.45, 0, 1);
      const cx = (IL + STAIR) / 2, y = bot - 62 - (c.t / dur) * 10;
      const main = c.kind === 'built' ? '完成！' : c.big === 2 ? 'MAX!' : 'Lv UP!';
      const size = [15, 17, 23][c.big];
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, y);
      ctx.scale(inK, inK);
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.font = G.font(900, size, c.kind === 'built' ? 'head' : 'num');
      ctx.lineWidth = 4.2;
      ctx.strokeStyle = 'rgba(70,34,8,0.88)';
      ctx.strokeText(main, 0, 0);
      const g = ctx.createLinearGradient(0, -size * 0.8, 0, 2);
      g.addColorStop(0, '#fffbe2');
      g.addColorStop(0.5, '#ffd85a');
      g.addColorStop(1, '#e0962a');
      ctx.fillStyle = g;
      ctx.fillText(main, 0, 0);
      if (c.big === 2) {
        // MAX はきらりと光が走る
        const sx = ((c.t * 1.4) % 1.6 - 0.3) * size * 3;
        spark4(sx - size * 1.6, -size * 0.55, 3 + Math.sin(c.t * 9) * 1, 'rgba(255,255,255,0.95)');
        spark4(size * 1.5, -size * 0.75, 2.4 + Math.sin(c.t * 7 + 1) * 1, 'rgba(255,255,255,0.9)');
      }
      const sub = c.kind === 'built' ? c.name + ' 開業' : c.big === 2 ? `Lv.${c.lv}  超豪華に！` : c.big === 1 ? `Lv.${c.lv}  内装グレードアップ！` : `${c.name} Lv.${c.lv}`;
      ctx.font = G.font(800, 7.5, 'head');
      ctx.lineWidth = 3;
      ctx.strokeText(sub, 0, 11.5);
      ctx.fillStyle = '#fff6dc';
      ctx.fillText(sub, 0, 11.5);
      ctx.restore();
    });
  }
  SC._celebrate = celebrate;

  // 部屋の動き（パーティクルを出すもの）
  let appC = 0;
  function floorOnScreen(f) {
    const y0 = floorY(f + 1), y1 = floorY(f);
    return y1 > camTop && y0 < camTop + cssH / s;
  }
  function roomUpdate(dt) {
    const st = G.state;
    if (st.fac.smithy > 0) {
      const t = tierOf('smithy', st.fac.smithy);
      if (t >= 2) {
        const c = (time + 0.55) % 1.1;
        if (c < appC && floorOnScreen(3)) for (let i = 0; i < 6; i++) forgeSpark(291, floorY(3) - 18);
        appC = c;
      }
      if (t >= 4 && Math.random() < dt * 5 && floorOnScreen(3)) ember(IL + 28 + G.rand(-10, 10), floorY(3) - 22);
    }
    if (st.fac.tavern > 0 && tierOf('tavern', st.fac.tavern) >= 4 && Math.random() < dt * 1.3 && floorOnScreen(2)) note(G.rand(126, 190), floorY(2) - 62);
  }

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

  // 酒場の席（最大12）：0〜5 テーブル3卓の左右、6〜8 カウンター席、9〜11 テーブルの奥の席
  const TABLES = [108, 156, 204];
  function seatPos(i) {
    if (i < 6) {
      const t = TABLES[Math.floor(i / 2)];
      const left = i % 2 === 0;
      return { x: t + (left ? -14 : 14), facing: left ? 1 : -1, tx: t + (left ? -5 : 5) };
    }
    if (i < 9) return { x: 236 + (i - 6) * 14, facing: 1, tx: 284 + (i - 6) * 9, bar: true };
    const t = TABLES[(i - 9) % 3];
    return { x: t, facing: i % 2 ? 1 : -1, tx: t, back: true };
  }
  SC.seatPos = seatPos;


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

  const dummyWobble = [0, 0, 0, 0];
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
    for (let i = 0; i < dummyWobble.length; i++) dummyWobble[i] *= Math.pow(0.03, dt);

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
    updateCelebs(dt);
    roomUpdate(dt);
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
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
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
  SC.dayPhase = () => dayPhase;

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

    const P = SC._debug.prof2;
    let t0 = P ? performance.now() : 0;
    const mark = P ? (k) => { const t1 = performance.now(); P[k] = (P[k] || 0) + t1 - t0; t0 = t1; } : () => {};
    drawSkyObjects(leftW, rightW, nq, duskK); mark('sky');
    drawBackdrop(leftW, rightW, nq);
    drawGround(leftW, rightW, nq); mark('back');
    drawBuilding(st, nq); mark('building');
    drawAgents(); mark('agents');
    drawFront(st); mark('front');
    drawNight(nq);
    drawRain(st);
    drawLights(st, nq); mark('lights');
    drawCelebs();
    drawParticles();
    drawCoins();
    drawBubbles(); mark('over');
  };

  function drawSkyObjects(L, R, n, duskK) {
    const viewTop = camTop, viewBot = camTop + cssH / s;
    // かぼちゃ灯籠祭：夕方から夜にコウモリが飛ぶ
    if (G.events && G.events.theme() === 'pumpkin' && (n > 0.2 || duskK > 0.2)) {
      for (let i = 0; i < 5; i++) {
        const x = L + ((time * (16 + i * 5) + i * 140) % (R - L + 80)) - 40;
        const y = camTop + 60 + i * 34 + Math.sin(time * 1.3 + i * 2) * 14;
        const w = Math.sin(time * 12 + i * 3);
        ctx.fillStyle = 'rgba(30,20,40,0.85)';
        art.poly(ctx, [x, y, x - 6, y - 3 - w * 3, x - 3, y + 0.5, x - 1, y + 1.5, x + 1, y + 1.5, x + 3, y + 0.5, x + 6, y - 3 - w * 3], 'rgba(30,20,40,0.85)');
      }
    }
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
    // かぼちゃ灯籠祭の飾り
    if (G.events && G.events.theme() === 'pumpkin') {
      [[8, 1], [31, 0.8], [WL - 14, 0.7]].forEach(([x, k], i) => {
        const g = 0.65 + Math.sin(time * 5 + i * 2) * 0.25;
        art.facet(ctx, x, -5.5 * k, 7 * k, 5.6 * k, 10, G.mix('#f08a2a', '#6a3a1a', n * 0.5), 0.2, 0.18);
        art.poly(ctx, [x - 0.6, -11 * k, x + 0.8, -11 * k, x + 1.2, -14 * k, x, -13.6 * k], '#4a8a3a');
        const ey = G.rgba('#ffe28a', g);
        art.poly(ctx, [x - 4 * k, -6.6 * k, x - 1.4 * k, -8 * k, x - 1.8 * k, -5.2 * k], ey);
        art.poly(ctx, [x + 4 * k, -6.6 * k, x + 1.4 * k, -8 * k, x + 1.8 * k, -5.2 * k], ey);
        art.poly(ctx, [x - 3.6 * k, -3.6 * k, x, -2.4 * k, x + 3.6 * k, -3.6 * k, x, -1.6 * k], ey);
        lightGlowList().push([x, -6 * k, 22, 0.7 * g, '#ff9a3a']);
      });
    }
    // 樽
    art.facetPoly(ctx, [38, 0, 48, 0, 49, -7, 48, -14, 38, -14, 37, -7], G.mix('#9a6a3a', '#2e2430', n * 0.7), 0.12);
    art.poly(ctx, [37.3, -4, 48.7, -4, 48.8, -5.2, 37.2, -5.2], G.mix('#5a4a3a', '#1e1820', n * 0.7));
    art.poly(ctx, [37.3, -10, 48.7, -10, 48.8, -11.2, 37.2, -11.2], G.mix('#5a4a3a', '#1e1820', n * 0.7));
  }

  // ---------------------------------------------------------------- building
  const WALLPAPER = {
    hall: '#9a6c48', bunks: '#86624a', tavern: '#74492f', smithy: '#6c6560', training: '#8a7250', alchemy: '#55496e', tower: '#61707f',
  };

  // ギルド全体の豪華さ（全施設のレベル合計の割合）：外壁・屋根が変わる
  function extTier(st) {
    let sum = 0, max = 0;
    D.FACILITIES.forEach((f) => { sum += st.fac[f.id] || 0; max += f.maxLv; });
    const r = sum / max;
    return r >= 1 ? 4 : r >= 0.72 ? 3 : r >= 0.45 ? 2 : r >= 0.2 ? 1 : 0;
  }
  SC.extTier = () => extTier(G.state);
  let et = 0;
  // 外壁：木 → 角に石 → 石壁 → 石と真鍮のランタン → 白大理石と金
  function outerWalls(top, bot, t, f) {
    if (t <= 1) {
      art.poly(ctx, [WL - 4, top, WL + 8, top, WL + 8, bot, WL - 4, bot], '#6b4a32');
      art.poly(ctx, [WL - 4, top, WL, top, WL, bot, WL - 4, bot], '#835c40');
      art.poly(ctx, [WR - 8, top, WR + 4, top, WR + 4, bot, WR - 8, bot], '#5a3e2a');
    } else {
      const c = t >= 4 ? '#ece5d8' : '#a49c8e';
      art.poly(ctx, [WL - 4, top, WL + 8, top, WL + 8, bot, WL - 4, bot], c);
      art.poly(ctx, [WL - 4, top, WL - 1, top, WL - 1, bot, WL - 4, bot], G.shade(c, 0.12));
      art.poly(ctx, [WR - 8, top, WR + 4, top, WR + 4, bot, WR - 8, bot], G.shade(c, -0.2));
      ctx.fillStyle = 'rgba(40,30,20,0.18)';
      for (let y = top + 15; y < bot; y += 15) { ctx.fillRect(WL - 4, y, 12, 0.6); ctx.fillRect(WR - 8, y, 12, 0.6); }
      if (t >= 3) {
        const m = t >= 4 ? GOLD : BRASS;
        art.poly(ctx, [WL + 6, top, WL + 8, top, WL + 8, bot, WL + 6, bot], m);
        art.poly(ctx, [WR - 8, top, WR - 6, top, WR - 6, bot, WR - 8, bot], m);
      }
    }
    if (t >= 1) {
      // 角の石（交互に積む）：左右それぞれ1回の塗りで
      const q = t >= 4 ? '#f8f4ec' : '#c8c0b2';
      for (let side = 0; side < 2; side++) {
        ctx.beginPath();
        for (let y = top, i = 0; y < bot - 1; y += 11, i++) {
          const w = i % 2 ? 5 : 8;
          ctx.rect(side ? WR + 4 - w : WL - 4, y + 0.6, w, Math.min(bot, y + 10.4) - y - 0.6);
        }
        ctx.fillStyle = side ? G.shade(q, -0.16) : q;
        ctx.fill();
      }
    }
    if (t >= 3 && f > 0) {
      // 外壁のランタン
      const m = t >= 4 ? GOLD : '#3a3030';
      [[WL - 4, -1], [WR + 4, 1]].forEach(([x, d]) => {
        const lx = x + d * 6, ly = bot - 66;
        art.poly(ctx, [x, ly + 4, lx, ly + 4, lx, ly + 5, x, ly + 5], m);
        art.poly(ctx, [lx - 3, ly - 6, lx + 3, ly - 6, lx + 2.4, ly + 3, lx - 2.4, ly + 3], m);
        art.poly(ctx, [lx - 2, ly - 5, lx + 2, ly - 5, lx + 1.6, ly + 2, lx - 1.6, ly + 2], night > 0.3 ? '#ffd27a' : '#e8e0c8');
        art.poly(ctx, [lx - 3.4, ly - 6, lx + 3.4, ly - 6, lx, ly - 9], m);
        if (night > 0.3) lightGlowList().push([lx, ly - 1, 26, 0.7 * night]);
      });
    }
  }

  function drawBuilding(st, n) {
    et = extTier(st);
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
      if (et >= 3) {
        art.poly(ctx, [WL - 4, top + 3.6, WR + 4, top + 3.6, WR + 4, top + 5, WL - 4, top + 5], et >= 4 ? GOLD : BRASS);
        if (et >= 4) for (let x = WL + 3; x < WR; x += 44) art.facet(ctx, x, top + 4.3, 1.5, 1.5, 6, GOLD_L, 0, 0.2);
      }
      // 外壁
      outerWalls(top, bot, et, f);
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

  // t: 部屋のグレード（窓枠が 木 → 真鍮 → 金 になる）
  const WIN_FRAME = ['#4a3426', '#5a3a26', '#5e3a22', '#8a6a30', '#c8962e'];
  function windowAt(x, y, w, h, f, t = 1) {
    if (SC._debug.skipwin) return;
    const [skyT, skyB, duskK] = skyColors();
    const fr = WIN_FRAME[t] || WIN_FRAME[1];
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 3, y + h + 3, x - 3, y + h + 3], fr);
    if (t >= 3) art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 2, y - 2, x - 2, y - 2], t >= 4 ? GOLD_L : '#d8b870');
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
    ctx.fillStyle = fr;
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    art.poly(ctx, [x - 4, y + h + 2, x + w + 4, y + h + 2, x + w + 3, y + h + 5, x - 3, y + h + 5], t >= 4 ? GOLD : t === 3 ? BRASS : '#7e5a3e');
    if (t >= 4) {
      // 金の窓には上に飾りのアーチ
      art.poly(ctx, [x - 4, y - 3, x + w + 4, y - 3, x + w / 2 + 5, y - 8, x + w / 2, y - 9.5, x + w / 2 - 5, y - 8], GOLD);
      art.facet(ctx, x + w / 2, y - 6, 1.8, 1.8, 6, '#e04a5a', 0, 0.2);
    }
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

  // 深淵の扉：ランク6で封印が解ける。開くと紫の光がもれる
  const ABYSS_DOOR = { x: 358, w: 20, h: 28 };
  function drawAbyssDoor(st, bot) {
    const ab = st.abyss;
    const open = !!(ab && ab.open);
    const { x, w, h } = ABYSS_DOOR;
    // 石のアーチ
    art.poly(ctx, [x - 3, bot, x + w + 3, bot, x + w + 3, bot - h + 6, x + w / 2, bot - h - 3, x - 3, bot - h + 6], '#6e6a72');
    art.poly(ctx, [x - 3, bot, x, bot, x, bot - h + 6, x + w / 2, bot - h, x + w / 2, bot - h - 3, x - 3, bot - h + 6], '#8a868e');
    // 扉の中
    const glow = open ? 0.6 + Math.sin(time * 2.2) * 0.25 : 0;
    art.poly(ctx, [x, bot, x + w, bot, x + w, bot - h + 7, x + w / 2, bot - h + 1, x, bot - h + 7], open ? G.mix('#2a1648', '#7a4ac8', glow * 0.6) : '#3a2a20');
    if (open) {
      for (let i = 0; i < 3; i++) {
        const k = (time * 0.35 + i / 3) % 1;
        ctx.fillStyle = `rgba(210,170,255,${0.8 * Math.sin(k * Math.PI)})`;
        ctx.fillRect(x + 4 + i * 6, bot - 4 - k * 26, 1.4, 1.4);
      }
      lightGlowList().push([x + w / 2, bot - 12, 34, 0.55 * glow, '#b88aff']);
      // 小さな札
      art.poly(ctx, [x + 3, bot - h - 9, x + w - 3, bot - h - 9, x + w - 3, bot - h - 4, x + 3, bot - h - 4], '#e8dcc0');
      ctx.fillStyle = '#5a3a9a';
      ctx.font = G.font(700, 4, 'head');
      ctx.textAlign = 'center';
      ctx.fillText('深淵', x + w / 2, bot - h - 5.2);
    } else {
      // 封印の鎖
      art.poly(ctx, [x, bot - h + 9, x + w, bot - 6, x + w, bot - 8, x, bot - h + 7], '#9a948a');
      art.poly(ctx, [x + w, bot - h + 9, x, bot - 6, x, bot - 8, x + w, bot - h + 7], '#7a746c');
      art.facet(ctx, x + w / 2, bot - h / 2 - 1, 2.6, 3, 6, '#c8a040', 0, 0.2);
    }
  }
  SC.abyssDoorHit = (wx, wy) => wx > ABYSS_DOOR.x - 4 && wx < ABYSS_DOOR.x + ABYSS_DOOR.w + 4 && wy > -ABYSS_DOOR.h - 10 && wy < 2;

  // ================================================================ 内装のグレード
  // 施設レベルに応じて 0〜4 の5段階で部屋の見た目が変わる。
  // 0=ボロ屋（荒板・野石）、1=ふつう（板張り）、2=磨いた木と壁紙、3=石と真鍮、4(MAX)=大理石と金
  function tierOf(id, lv) {
    const m = D.FAC[id].maxLv;
    if (lv >= m) return 4;
    if (lv >= Math.ceil(m * 0.75)) return 3;
    if (lv >= Math.ceil(m * 0.5)) return 2;
    if (lv >= Math.max(2, Math.ceil(m * 0.25))) return 1;
    return 0;
  }
  SC.tierOf = tierOf;
  const TAU = Math.PI * 2;
  const GOLD = '#e8bd4c', GOLD_D = '#b0852a', GOLD_L = '#fff0a8', BRASS = '#c49a50', BRASS_D = '#8a6a30';
  const MARBLE = '#eee8dc', IRON = '#3a3434';
  // MAX のときの壁の色（施設ごとに違う宝石色）
  const LUX = { hall: '#8e3238', bunks: '#33427a', tavern: '#2f5a46', smithy: '#3a3438', training: '#b48a5a', alchemy: '#4a2f6e', tower: '#26345e' };
  const TRIM = ['#4e3322', '#5e3f2a', '#6a4228', BRASS, GOLD];
  const metalOf = (t) => (t >= 4 ? GOLD : t >= 2 ? BRASS : IRON);

  // ---------------------------------------------------------------- 部屋の描画（静的レイヤーのキャッシュ）
  // 部屋は「動かない背景（bg）」と「動くもの（fx）」に分けて描く。bg は階ごとにオフスクリーンへ焼いておき、
  // 施設レベルか画面の拡大率が変わったときだけ描き直す。豪華な装飾を増やしても毎フレームの負荷は増えない。
  const roomCache = [];
  let bgK = 0; // bg を焼いている間の拡大率（彫像の一時キャンバス用）
  SC._debug = { nocache: false, roomCache };
  function drawRoom(st, f, fac, lv) {
    const tier = tierOf(fac.id, lv);
    const R = ROOMS[fac.id];
    if (SC._debug.nocache) { bgK = ctx.getTransform().a; R.bg(f, lv, tier); } else blitRoom(f, fac, lv, tier);
    const t0 = SC._debug.prof ? performance.now() : 0;
    if (!SC._debug.skipfx) R.fx(st, f, lv, tier, lightGlowList());
    if (SC._debug.prof) { const p = SC._debug.prof; p[fac.id] = (p[fac.id] || 0) + performance.now() - t0; }
    if (flashFloor && flashFloor.f === f) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      const k = 1 - flashFloor.t / 1.2;
      ctx.fillStyle = `rgba(255,240,190,${0.5 * k})`;
      ctx.fillRect(IL, top, IR - IL, bot - top);
    }
  }
  function blitRoom(f, fac, lv, tier) {
    const m = ctx.getTransform();
    const k = Math.min(m.a, 4);
    const key = fac.id + ':' + lv;
    let c = roomCache[f];
    if (!c || c.key !== key || c.k !== k) c = roomCache[f] = bakeRoom(f, fac, lv, tier, k, key, c);
    const dx = Math.round(m.e + m.a * (IL - 2)), dy = Math.round(m.f + m.d * floorY(f + 1));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (k === m.a) ctx.drawImage(c.cv, dx, dy);
    else ctx.drawImage(c.cv, dx, dy, (c.cv.width * m.a) / k, (c.cv.height * m.a) / k);
    ctx.restore();
  }
  function bakeRoom(f, fac, lv, tier, k, key, old) {
    const cv = (old && old.cv) || document.createElement('canvas');
    const w = Math.ceil((IR - IL + 4) * k), h = Math.ceil((FH + 3) * k);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(k, 0, 0, k, -(IL - 2) * k, -floorY(f + 1) * k);
    const prev = ctx;
    ctx = g;
    bgK = k;
    try { ROOMS[fac.id].bg(f, lv, tier); } finally { ctx = prev; }
    SC._debug.bakes = (SC._debug.bakes || 0) + 1;
    return { cv, key, k };
  }
  SC.clearRoomCache = () => { roomCache.length = 0; };

  // ---------------------------------------------------------------- 壁と床
  function shell(f, id, t, stone) {
    const base = WALLPAPER[id];
    if (t === 0) { roughWall(f, base, stone); return; }
    if (t === 1) { wallPlanks(f, base, stone); return; }
    const top = floorY(f + 1) + 9, bot = floorY(f);
    const lux = LUX[id];
    const up = t === 2 ? G.shade(base, 0.05) : t === 3 ? G.mix(base, lux, 0.45) : lux;
    art.poly(ctx, [IL, top, IR, top, IR, bot, IL, bot], up);
    const wy = bot - 27;
    if (stone) ashlar(f, up, top + 5, wy, t);
    else wallpaper(up, top + 5, wy, t);
    // 上の方ほど少し暗く（天井の陰）
    const g = ctx.createLinearGradient(0, top, 0, top + 30);
    g.addColorStop(0, 'rgba(20,10,20,0.22)');
    g.addColorStop(1, 'rgba(20,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(IL, top, IR - IL, 30);
    wainscot(wy, bot, t, base);
    // 天井の飾り縁
    const tc = TRIM[t];
    art.poly(ctx, [IL, top, IR, top, IR, top + 4, IL, top + 4], G.shade(tc, -0.2));
    art.poly(ctx, [IL, top + 4, IR, top + 4, IR, top + 5.4, IL, top + 5.4], tc);
    if (t >= 3) {
      ctx.fillStyle = t === 4 ? GOLD_D : BRASS_D;
      for (let x = IL + 2; x < IR; x += 6) ctx.fillRect(x, top + 0.8, 3, 2.4);
    }
    if (t === 4) art.poly(ctx, [IL, top + 5.4, IR, top + 5.4, IR, top + 6, IL, top + 6], GOLD_L);
    floorStrip(bot, t);
    if (t >= 3) { pilaster(IL + 1, top + 6, bot - 3, t); pilaster(STAIR - 10, top + 6, bot - 3, t); }
  }

  // ボロ屋：幅のそろわない荒板／不揃いな野石
  function roughWall(f, base, stone) {
    const top = floorY(f + 1) + 9, bot = floorY(f);
    const col = G.mix(base, '#5c5048', 0.4);
    art.poly(ctx, [IL, top, IR, top, IR, bot, IL, bot], G.shade(col, -0.4));
    if (stone) {
      let y = top;
      for (let r = 0; y < bot; r++) {
        const h = 11 + G.hash(f * 97 + r * 13) * 8;
        let x = IL - G.hash(r * 31 + f) * 16;
        for (let i = 0; x < IR; i++) {
          const w = 13 + G.hash(f * 7 + r * 53 + i * 11) * 19;
          const j = (G.hash(r * 17 + i * 5 + f) - 0.5) * 2.4;
          const x0 = Math.max(IL, x + 1), x1 = Math.min(IR, x + w - 1), y0 = y + 1, y1 = Math.min(bot, y + h - 0.6);
          if (x1 - x0 > 2) art.poly(ctx, [x0 + 2, y0 + j * 0.5, x1 - 1.5, y0, x1, y0 + 2.5, x1 - 0.5, y1 - 1.5, x1 - 2.5, y1, x0 + 1.5, y1 + j * 0.3, x0, y1 - 2.5, x0, y0 + 2.5], G.shade(col, (G.hash(f * 3 + r * 29 + i * 41) - 0.5) * 0.26));
          x += w;
        }
        y += h;
      }
    } else {
      let x = IL;
      for (let i = 0; x < IR; i++) {
        const w = 11 + G.hash(f * 131 + i * 7) * 11;
        const sag = G.hash(i * 3 + f) * 4;
        art.poly(ctx, [x + 0.7, top + sag, x + w - 0.7, top + sag * 0.3, x + w - 0.7, bot, x + 0.7, bot], G.shade(col, (G.hash(f * 71 + i) - 0.5) * 0.22));
        if (G.hash(i * 19 + f) > 0.55) {
          const ky = top + 20 + G.hash(i * 23 + f) * 50;
          art.ellipse(ctx, x + w * 0.5, ky, 1.5, 2.3, G.shade(col, -0.35));
          art.ellipse(ctx, x + w * 0.5, ky, 0.6, 1, G.shade(col, -0.15));
        }
        ctx.fillStyle = 'rgba(30,20,14,0.55)';
        ctx.fillRect(x + 2, top + 7, 0.9, 0.9);
        ctx.fillRect(x + 2, bot - 34, 0.9, 0.9);
        x += w;
      }
    }
    // 汚れ（下ほど暗い）
    const g = ctx.createLinearGradient(0, bot - 30, 0, bot);
    g.addColorStop(0, 'rgba(40,26,16,0)');
    g.addColorStop(1, 'rgba(40,26,16,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(IL, bot - 30, IR - IL, 30);
    // 雨漏りのしみ
    art.ellipse(ctx, 120 + G.hash(f * 5) * 140, top + 8, 9, 5, 'rgba(40,30,20,0.18)');
    art.poly(ctx, [IL, bot - 2.5, IR, bot - 2.5, IR, bot, IL, bot], G.shade(col, -0.5));
    cobweb(IL, top, 1);
  }
  function cobweb(x, y, dir) {
    ctx.strokeStyle = 'rgba(240,240,240,0.32)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(x, y + 3 + i * 3.4); ctx.quadraticCurveTo(x + dir * (5 - i), y + 5 - i, x + dir * (14 - i * 3), y); }
    ctx.moveTo(x, y); ctx.lineTo(x + dir * 12, y + 12);
    ctx.stroke();
  }

  // 壁紙：縦じま（T2）→ 菱格子と真鍮（T3）→ 金の菱格子と百合紋（T4）
  function wallpaper(col, y0, y1, t) {
    if (t === 2) {
      ctx.fillStyle = G.shade(col, 0.07);
      for (let x = IL; x < IR; x += 16) ctx.fillRect(x, y0, 8, y1 - y0);
      ctx.fillStyle = G.rgba(G.shade(col, -0.3), 0.3);
      for (let x = IL + 8; x < IR; x += 16) ctx.fillRect(x, y0, 0.5, y1 - y0);
      return;
    }
    const h = y1 - y0, step = 18;
    ctx.strokeStyle = t === 4 ? G.rgba(GOLD, 0.34) : G.rgba(BRASS, 0.22);
    ctx.lineWidth = t === 4 ? 0.55 : 0.45;
    ctx.beginPath();
    for (let x = IL - h; x < IR; x += step) { ctx.moveTo(x, y1); ctx.lineTo(x + h, y0); ctx.moveTo(x, y0); ctx.lineTo(x + h, y1); }
    ctx.stroke();
    // 交点の飾り
    const mid = (y0 + y1) / 2;
    const orn = t === 4 ? GOLD : G.shade(col, 0.16);
    for (let j = -8; j <= 8; j++) {
      const y = mid + (j * step) / 2;
      if (y < y0 + 2 || y > y1 - 2) continue;
      for (let x = IL - h / 2 + (((j % 2) + 2) % 2) * (step / 2); x < IR; x += step) {
        if (x < IL + 2) continue;
        if (t === 4) fleur(x, y, 2.2, orn);
        else art.poly(ctx, [x, y - 1.6, x + 1.6, y, x, y + 1.6, x - 1.6, y], orn);
      }
    }
  }
  function fleur(x, y, r, col) {
    art.poly(ctx, [x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28, x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28], col);
  }
  // 切石：そろった石（T2）→ 大きな石と真鍮の帯（T3）→ 磨いた石板と金の目地（T4）
  function ashlar(f, col, y0, y1, t) {
    const rh = t === 2 ? 16 : t === 3 ? 19 : 26, rw = t === 2 ? 28 : t === 3 ? 36 : 46;
    // 目地
    art.poly(ctx, [IL, y0, IR, y0, IR, y1, IL, y1], G.shade(col, t === 4 ? -0.14 : -0.22));
    for (let r = 0, y = y0; y < y1; r++, y += rh) {
      const off = r % 2 ? 0 : rw / 2;
      for (let x = IL - off, i = 0; x < IR; x += rw, i++) {
        const xx = Math.max(IL, x), w = Math.min(x + rw - 1, IR) - xx;
        if (w <= 2) continue;
        const yb = Math.min(y + rh - 1, y1);
        const sh = (G.hash(f * 991 + r * 31 + i * 7) - 0.5) * (t === 4 ? 0.1 : 0.16);
        art.poly(ctx, [xx + 1, y + 1, xx + w, y + 1, xx + w, yb, xx + 1, yb], G.shade(col, sh));
        art.poly(ctx, [xx + 1, y + 1, xx + w, y + 1, xx + w, y + 2, xx + 1, y + 2], G.shade(col, sh + 0.12));
        if (t === 4) {
          // 石の模様（脈）
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 0.5;
          const k = G.hash(i * 13 + r * 7 + f);
          ctx.beginPath(); ctx.moveTo(xx + w * k, y + 2); ctx.quadraticCurveTo(xx + w * 0.5, y + rh * 0.6, xx + w * (1 - k), yb - 1); ctx.stroke();
        }
      }
      if (t === 4) { ctx.fillStyle = G.rgba(GOLD, 0.45); ctx.fillRect(IL, y, IR - IL, 0.6); }
    }
    if (t === 3) {
      const by = y0 + rh * 2;
      art.poly(ctx, [IL, by - 1.2, IR, by - 1.2, IR, by + 1.2, IL, by + 1.2], BRASS);
      art.poly(ctx, [IL, by - 1.2, IR, by - 1.2, IR, by - 0.5, IL, by - 0.5], '#e8c878');
    }
  }
  // 腰壁：木のパネル（T2）→ 石と真鍮のレール（T3）→ 大理石と金（T4）
  function wainscot(wy, bot, t, base) {
    if (t === 2) {
      const wood = G.shade(base, -0.3);
      art.poly(ctx, [IL, wy, STAIR, wy, STAIR, bot, IL, bot], wood);
      for (let x = IL + 4; x + 21 < STAIR; x += 27) {
        art.poly(ctx, [x, wy + 5, x + 21, wy + 5, x + 21, bot - 6, x, bot - 6], G.shade(wood, 0.1));
        art.poly(ctx, [x, bot - 7, x + 21, bot - 7, x + 21, bot - 6, x, bot - 6], G.shade(wood, -0.25));
        art.poly(ctx, [x, wy + 5, x + 21, wy + 5, x + 21, wy + 6, x, wy + 6], G.shade(wood, 0.25));
      }
      art.poly(ctx, [IL, wy - 1.6, STAIR, wy - 1.6, STAIR, wy + 1.4, IL, wy + 1.4], G.shade(wood, 0.18));
      art.poly(ctx, [IL, wy - 1.6, STAIR, wy - 1.6, STAIR, wy - 0.8, IL, wy - 0.8], G.shade(wood, 0.35));
    } else if (t === 3) {
      const sc = '#8e877c';
      art.poly(ctx, [IL, wy, STAIR, wy, STAIR, bot, IL, bot], G.shade(sc, -0.25));
      for (let r = 0; r < 2; r++) {
        for (let x = IL - (r ? 11 : 0), i = 0; x < STAIR; x += 22, i++) {
          const xx = Math.max(IL, x), w = Math.min(x + 21, STAIR) - xx;
          if (w < 2) continue;
          const y = wy + 1 + r * 13;
          art.poly(ctx, [xx + 0.5, y, xx + w, y, xx + w, y + 12, xx + 0.5, y + 12], G.shade(sc, (G.hash(i * 7 + r * 13) - 0.5) * 0.16));
          art.poly(ctx, [xx + 0.5, y, xx + w, y, xx + w, y + 1, xx + 0.5, y + 1], G.shade(sc, 0.18));
        }
      }
      art.poly(ctx, [IL, wy - 1.8, STAIR, wy - 1.8, STAIR, wy + 1.2, IL, wy + 1.2], BRASS);
      art.poly(ctx, [IL, wy - 1.8, STAIR, wy - 1.8, STAIR, wy - 1, IL, wy - 1], '#ead08a');
    } else if (t === 4) {
      art.poly(ctx, [IL, wy, STAIR, wy, STAIR, bot, IL, bot], MARBLE);
      ctx.lineWidth = 0.5;
      for (let x = IL + 4, i = 0; x + 21 < STAIR; x += 27, i++) {
        art.poly(ctx, [x, wy + 4.5, x + 21, wy + 4.5, x + 21, bot - 5.5, x, bot - 5.5], '#f6f1e8');
        ctx.strokeStyle = 'rgba(140,130,120,0.35)';
        const k = G.hash(i * 11 + 3);
        ctx.beginPath(); ctx.moveTo(x + 2 + k * 6, wy + 5); ctx.quadraticCurveTo(x + 14, wy + 12, x + 8 + k * 10, bot - 6); ctx.moveTo(x + 12, wy + 9); ctx.lineTo(x + 19, wy + 13); ctx.stroke();
        ctx.strokeStyle = GOLD;
        ctx.strokeRect(x, wy + 4.5, 21, bot - 10 - wy);
      }
      art.poly(ctx, [IL, wy - 2, STAIR, wy - 2, STAIR, wy + 1.4, IL, wy + 1.4], GOLD);
      art.poly(ctx, [IL, wy - 2, STAIR, wy - 2, STAIR, wy - 1.1, IL, wy - 1.1], GOLD_L);
      art.poly(ctx, [IL, wy + 0.8, STAIR, wy + 0.8, STAIR, wy + 1.4, IL, wy + 1.4], GOLD_D);
    }
  }
  function floorStrip(bot, t) {
    if (t === 2) {
      art.poly(ctx, [IL, bot - 3, IR, bot - 3, IR, bot, IL, bot], '#5a3826');
      art.poly(ctx, [IL, bot - 3, IR, bot - 3, IR, bot - 2.3, IL, bot - 2.3], '#8a6042');
    } else if (t === 3) {
      for (let x = IL, i = 0; x < IR; x += 14, i++) art.poly(ctx, [x, bot - 3, x + 13.6, bot - 3, x + 13.6, bot, x, bot], i % 2 ? '#7a746a' : '#8c867b');
      art.poly(ctx, [IL, bot - 3, IR, bot - 3, IR, bot - 2.4, IL, bot - 2.4], '#b0aa9e');
    } else if (t === 4) {
      for (let x = IL, i = 0; x < IR; x += 10, i++) art.poly(ctx, [x, bot - 3.4, x + 10, bot - 3.4, x + 10, bot, x, bot], i % 2 ? '#2e2a32' : '#f2ece2');
      art.poly(ctx, [IL, bot - 3.6, IR, bot - 3.6, IR, bot - 3, IL, bot - 3], GOLD);
    }
  }
  function pilaster(x, y0, y1, t) {
    const w = 9;
    const c = t === 4 ? '#f4efe6' : '#a39c90';
    const cap = t === 4 ? GOLD : BRASS;
    art.poly(ctx, [x, y0, x + w, y0, x + w, y1, x, y1], c);
    art.poly(ctx, [x, y0, x + 1.8, y0, x + 1.8, y1, x, y1], G.shade(c, 0.14));
    art.poly(ctx, [x + w - 1.8, y0, x + w, y0, x + w, y1, x + w - 1.8, y1], G.shade(c, -0.14));
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(x + 3.2, y0 + 8, 0.8, y1 - y0 - 16);
    ctx.fillRect(x + 5.4, y0 + 8, 0.8, y1 - y0 - 16);
    art.poly(ctx, [x - 1.6, y0, x + w + 1.6, y0, x + w + 1.6, y0 + 3.6, x - 1.6, y0 + 3.6], cap);
    art.poly(ctx, [x - 1.6, y0 + 3.6, x + w + 1.6, y0 + 3.6, x + w, y0 + 5.6, x, y0 + 5.6], G.shade(cap, -0.22));
    art.poly(ctx, [x - 1.6, y1 - 3.6, x + w + 1.6, y1 - 3.6, x + w + 1.6, y1, x - 1.6, y1], cap);
    art.poly(ctx, [x - 1.6, y0, x + w + 1.6, y0, x + w + 1.6, y0 + 0.8, x - 1.6, y0 + 0.8], G.shade(cap, 0.35));
  }

  // ---------------------------------------------------------------- 調度品
  function rug(x0, x1, bot, col, t) {
    art.poly(ctx, [x0 + 4, bot - 1.3, x1 - 4, bot - 1.3, x1, bot + 1, x0, bot + 1], col);
    if (t >= 2) art.poly(ctx, [x0 + 4, bot - 1.3, x1 - 4, bot - 1.3, x1 - 3.4, bot - 0.5, x0 + 3.4, bot - 0.5], t >= 4 ? GOLD : t === 3 ? BRASS : G.shade(col, 0.3));
  }
  function painting(x, y, w, h, t, kind) {
    const fr = t >= 4 ? GOLD : t === 3 ? BRASS : '#6a4228';
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 3, y + h + 3, x - 3, y + h + 3], G.shade(fr, -0.25));
    art.poly(ctx, [x - 2, y - 2, x + w + 2, y - 2, x + w + 2, y + h + 2, x - 2, y + h + 2], fr);
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 2, y - 2, x - 2, y - 2], G.shade(fr, 0.3));
    if (kind === 'hero') {
      // ギルド創設者の肖像
      art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#3a2a30');
      const cx = x + w / 2;
      art.poly(ctx, [cx - w * 0.38, y + h, cx - w * 0.3, y + h * 0.66, cx, y + h * 0.58, cx + w * 0.3, y + h * 0.66, cx + w * 0.38, y + h], '#7a2a34');
      art.poly(ctx, [cx - 1.6, y + h * 0.6, cx + 1.6, y + h * 0.6, cx, y + h * 0.84], GOLD);
      art.facet(ctx, cx, y + h * 0.42, w * 0.15, h * 0.2, 7, '#e8c0a0', 0.2, 0.1);
      art.poly(ctx, [cx - w * 0.17, y + h * 0.38, cx - w * 0.12, y + h * 0.2, cx + w * 0.14, y + h * 0.2, cx + w * 0.18, y + h * 0.36, cx + w * 0.1, y + h * 0.28, cx - w * 0.1, y + h * 0.28], '#d8d8d0');
    } else if (kind === 'sea') {
      art.poly(ctx, [x, y, x + w, y, x + w, y + h * 0.6, x, y + h * 0.6], '#f2b884');
      art.poly(ctx, [x, y + h * 0.6, x + w, y + h * 0.6, x + w, y + h, x, y + h], '#3a6aa0');
      art.ellipse(ctx, x + w * 0.7, y + h * 0.5, w * 0.1, w * 0.1, '#fff0b0');
      art.poly(ctx, [x + w * 0.2, y + h * 0.68, x + w * 0.42, y + h * 0.68, x + w * 0.38, y + h * 0.75, x + w * 0.24, y + h * 0.75], '#4a3020');
      art.poly(ctx, [x + w * 0.31, y + h * 0.68, x + w * 0.31, y + h * 0.3, x + w * 0.42, y + h * 0.64], '#fff6e6');
    } else if (kind === 'dragon') {
      art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#2a3048');
      art.poly(ctx, [x, y + h, x + w * 0.3, y + h * 0.7, x + w * 0.6, y + h * 0.85, x + w, y + h * 0.65, x + w, y + h], '#3a4058');
      art.poly(ctx, [x + w * 0.2, y + h * 0.55, x + w * 0.45, y + h * 0.3, x + w * 0.5, y + h * 0.5, x + w * 0.8, y + h * 0.2, x + w * 0.62, y + h * 0.6, x + w * 0.35, y + h * 0.66], '#c0403a');
      art.poly(ctx, [x + w * 0.8, y + h * 0.2, x + w * 0.9, y + h * 0.26, x + w * 0.78, y + h * 0.3], '#ffb04a');
    } else {
      art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#9fd0e8');
      art.poly(ctx, [x, y + h * 0.62, x + w * 0.3, y + h * 0.4, x + w * 0.55, y + h * 0.58, x + w * 0.8, y + h * 0.35, x + w, y + h * 0.5, x + w, y + h, x, y + h], '#6a9a5a');
      art.poly(ctx, [x, y + h * 0.82, x + w * 0.5, y + h * 0.7, x + w, y + h * 0.86, x + w, y + h, x, y + h], '#4f7f45');
      art.ellipse(ctx, x + w * 0.78, y + h * 0.22, w * 0.08, w * 0.08, '#fff2b0');
    }
    art.poly(ctx, [x, y, x + w * 0.4, y, x, y + h * 0.5], 'rgba(255,255,255,0.1)');
  }
  function plant(cx, bot, sz, t) {
    const pot = t >= 4 ? GOLD : t === 3 ? '#c8c0b2' : '#a0603a';
    box(cx - 5 * sz, bot, 10 * sz, 9 * sz, pot, 2);
    if (t >= 3) art.poly(ctx, [cx - 5 * sz, bot - 7 * sz, cx + 5 * sz, bot - 7 * sz, cx + 5 * sz, bot - 6 * sz, cx - 5 * sz, bot - 6 * sz], t >= 4 ? GOLD_D : BRASS);
    for (let i = 0; i < 7; i++) {
      const a = -1.35 + i * 0.45;
      const L = (12 + (i % 2) * 4) * sz;
      const bx = cx + Math.sin(a) * L, by = bot - 9 * sz - Math.cos(a) * L * 1.1;
      art.poly(ctx, [cx, bot - 9 * sz, bx - 2.2 * sz, by + 1, bx, by - 1.5 * sz, bx + 2.2 * sz, by + 1], G.shade('#4f9445', -0.08 + (i % 3) * 0.07));
    }
  }
  function spark4(x, y, r, col) {
    art.poly(ctx, [x, y - r, x + r * 0.22, y - r * 0.22, x + r, y, x + r * 0.22, y + r * 0.22, x, y + r, x - r * 0.22, y + r * 0.22, x - r, y, x - r * 0.22, y - r * 0.22], col);
  }
  // 壁の燭台
  function sconceBg(x, y, t) {
    const m = metalOf(t);
    art.poly(ctx, [x - 2.2, y + 6, x + 2.2, y + 6, x + 2.2, y + 9.5, x - 2.2, y + 9.5], m);
    art.poly(ctx, [x - 0.8, y + 6, x + 0.8, y + 6, x + 0.6, y + 1, x - 0.6, y + 1], m);
    art.poly(ctx, [x - 3, y, x + 3, y, x + 2, y + 1.6, x - 2, y + 1.6], m);
    art.poly(ctx, [x - 0.9, y, x + 0.9, y, x + 0.9, y - 4.6, x - 0.9, y - 4.6], '#f5ead0');
  }
  function sconceFx(x, y, lights, r = 34) {
    flame(x, y - 4.9, 1.2);
    lights.push([x, y - 6, r, 0.45]);
  }
  // 吊りランタン（本体は bg、炎と光は fx）
  function lanternBg(x, top, len, t) {
    const m = t >= 4 ? GOLD : t >= 2 ? BRASS : '#3a3030';
    ctx.strokeStyle = t >= 2 ? BRASS_D : '#3a2a20';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len); ctx.stroke();
    const y = top + len;
    art.poly(ctx, [x - 3.2, y + 2, x + 3.2, y + 2, x + 3.2, y + 9.5, x - 3.2, y + 9.5], '#ffd27a');
    art.poly(ctx, [x - 2, y, x + 2, y, x + 4.4, y + 2.4, x - 4.4, y + 2.4], m);
    art.poly(ctx, [x - 4.4, y + 9.2, x + 4.4, y + 9.2, x + 3.2, y + 11.4, x - 3.2, y + 11.4], m);
    art.poly(ctx, [x - 4, y + 2, x - 3.2, y + 2, x - 3.2, y + 9.4, x - 4, y + 9.4], m);
    art.poly(ctx, [x + 3.2, y + 2, x + 4, y + 2, x + 4, y + 9.4, x + 3.2, y + 9.4], m);
    if (t >= 2) art.facet(ctx, x, y - 0.6, 1, 1, 5, m, 0, 0.2);
  }
  function lanternFx(x, top, len, lights, r = 46) {
    flame(x, top + len + 8.6, 1.1);
    lights.push([x, top + len + 6, r, 0.55]);
  }
  // シャンデリア：鉄（T1）→ 真鍮（T2）→ 真鍮＋クリスタル（T3）→ 金とクリスタルの二段（T4）
  function chandGeo(x, top, len, w, n) {
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(n === 1 ? x : x - w / 2 + (w * i) / (n - 1));
    return { y: top + len, xs };
  }
  function chandelierBg(x, top, len, w, n, t, noChain) {
    const { y, xs } = chandGeo(x, top, len, w, n);
    const m = t >= 4 ? GOLD : t >= 2 ? BRASS : '#4a3326';
    if (!noChain) {
      ctx.strokeStyle = t >= 4 ? GOLD_D : '#3a2a20';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - 2); ctx.stroke();
    }
    ctx.strokeStyle = m;
    ctx.lineWidth = 1;
    ctx.beginPath();
    xs.forEach((cx) => { ctx.moveTo(x, y + 1.5); ctx.quadraticCurveTo(cx, y + 4.5, cx, y - 0.5); });
    ctx.stroke();
    art.facet(ctx, x, y + 0.6, 2.8, 3.4, 8, m, 0, 0.22);
    xs.forEach((cx) => {
      art.poly(ctx, [cx - 2.1, y - 1, cx + 2.1, y - 1, cx + 1.3, y + 0.6, cx - 1.3, y + 0.6], m);
      art.poly(ctx, [cx - 0.8, y - 1, cx + 0.8, y - 1, cx + 0.8, y - 5, cx - 0.8, y - 5], '#f5ead0');
    });
    if (t >= 3) {
      xs.forEach((cx, i) => {
        const k = 3 + (i % 2) * 2.2;
        art.poly(ctx, [cx, y + 1.4, cx + 1, y + 1.4 + k * 0.5, cx, y + 1.4 + k, cx - 1, y + 1.4 + k * 0.5], 'rgba(225,242,255,0.9)');
      });
      art.poly(ctx, [x, y + 3.4, x + 1.7, y + 7, x, y + 10.6, x - 1.7, y + 7], 'rgba(225,242,255,0.95)');
    }
  }
  function chandelierFx(x, top, len, w, n, t, lights, r) {
    const { y, xs } = chandGeo(x, top, len, w, n);
    xs.forEach((cx) => flame(cx, y - 5.3, 1.2));
    if (lights) lights.push([x, y - 3, r || 34 + w, t >= 4 ? 0.8 : 0.6]);
    if (t >= 3) {
      for (let i = 0; i < xs.length; i++) {
        const a = Math.pow(Math.max(0, Math.sin(time * 2.6 + i * 1.9 + x)), 8);
        if (a > 0.05) spark4(xs[i], y + 4 + (i % 2) * 2, 1 + a * 1.6, `rgba(255,255,255,${a.toFixed(2)})`);
      }
    }
  }
  // 金の二段シャンデリア（MAX）
  function grandBg(x, top, len, w) {
    chandelierBg(x, top, len - 9, w * 0.55, 3, 4);
    chandelierBg(x, top, len, w, 5, 4, true);
  }
  function grandFx(x, top, len, w, lights) {
    chandelierFx(x, top, len - 9, w * 0.55, 3, 4, null);
    chandelierFx(x, top, len, w, 5, 4, lights, 60 + w);
  }
  // きらめき（MAX の部屋）：時間から決まる位置で、パーティクルを作らずに描く
  function twinkles(f, x0, x1, y0, y1, n, col = '255,246,200') {
    if (SC._debug.skiptw) return;
    for (let i = 0; i < n; i++) {
      const per = 2.2 + G.hash(i * 7 + f) * 1.6;
      const ph = time / per + G.hash(i * 13 + f * 3);
      const cyc = Math.floor(ph), k = ph - cyc;
      const a = Math.pow(Math.sin(k * Math.PI), 3);
      if (a < 0.05) continue;
      const x = G.lerp(x0, x1, G.hash(cyc * 31 + i * 17 + f * 3)), y = G.lerp(y0, y1, G.hash(cyc * 37 + i * 11 + f * 5));
      spark4(x, y, 1 + a * 1.8, `rgba(${col},${a.toFixed(2)})`);
    }
  }
  // 旗（揺れるので fx）
  function banner(x, y, w, h, col, t, emblem) {
    const fl = Math.sin(time * 1.2 + x) * 0.8;
    if (t >= 3) art.poly(ctx, [x - 2, y - 1.5, x + w + 2, y - 1.5, x + w + 2, y + 0.5, x - 2, y + 0.5], t >= 4 ? GOLD : BRASS);
    art.poly(ctx, [x, y, x + w, y, x + w, y + h + fl, x + w / 2, y + h - 4, x, y + h - fl], col);
    art.poly(ctx, [x, y, x + w / 2, y, x + w / 2, y + h - 4, x, y + h - fl], G.shade(col, 0.08));
    if (t >= 3) {
      ctx.strokeStyle = t >= 4 ? GOLD : BRASS;
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x + 1.6, y + 1); ctx.lineTo(x + 1.6, y + h - fl - 2); ctx.moveTo(x + w - 1.6, y + 1); ctx.lineTo(x + w - 1.6, y + h + fl - 2); ctx.stroke();
    }
    const ec = t >= 3 ? GOLD_L : '#f0c94a';
    if (emblem === 'star') art.star(ctx, x + w / 2, y + h * 0.42, w * 0.22, ec);
    else if (emblem === 'sword') { art.sword(ctx, x + w / 2, y + h * 0.62, 0, h * 0.4); }
    else if (emblem === 'flask') { art.poly(ctx, [x + w / 2 - 3, y + h * 0.62, x + w / 2 + 3, y + h * 0.62, x + w / 2 + 1, y + h * 0.36, x + w / 2 - 1, y + h * 0.36], ec); }
    else if (emblem === 'moon') { art.ellipse(ctx, x + w / 2, y + h * 0.42, w * 0.2, w * 0.2, ec); art.ellipse(ctx, x + w / 2 + 2, y + h * 0.42 - 1, w * 0.17, w * 0.17, col); }
  }
  // ギルドの紋章（盾形）
  function crest(cx, cy, u) {
    ctx.save();
    ctx.translate(cx - 20 * u, cy - 20 * u);
    ctx.scale(u, u);
    art.poly(ctx, [20, 5, 32, 9, 31, 22, 20, 34, 9, 22, 8, 9], GOLD);
    art.poly(ctx, [20, 5, 20, 34, 9, 22, 8, 9], GOLD_L);
    art.poly(ctx, [20, 7.5, 29.6, 10.6, 28.8, 21.2, 20, 31, 11.2, 21.2, 10.4, 10.6], '#1a2a4e');
    art.poly(ctx, [17, 13, 23, 13, 24.5, 16, 24.5, 24, 15.5, 24, 15.5, 16], '#ffd36a');
    art.poly(ctx, [18, 15.5, 22, 15.5, 22.6, 17, 22.6, 22.4, 17.4, 22.4, 17.4, 17], '#fff4c8');
    art.poly(ctx, [16.5, 11.6, 23.5, 11.6, 23, 13, 17, 13], '#c8901e');
    art.poly(ctx, [15, 24, 25, 24, 24, 25.6, 16, 25.6], '#c8901e');
    ctx.restore();
  }
  // 金の像（訓練場の MAX など）：人物を一時キャンバスに描いて金色に染める
  function goldStatue(x, bot, look, pose, sc) {
    const k = bgK || 2;
    const W = 44, H = 56;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * sc * k);
    c.height = Math.ceil(H * sc * k);
    const g = c.getContext('2d');
    g.setTransform(k * sc, 0, 0, k * sc, (W / 2) * sc * k, (H - 2) * sc * k);
    art.person(g, look, Object.assign({ t: 1.3, noShadow: true }, pose));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, 'rgba(255,236,150,0.78)');
    gr.addColorStop(0.5, 'rgba(232,180,60,0.74)');
    gr.addColorStop(1, 'rgba(160,110,30,0.78)');
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(c, x - (W / 2) * sc, bot - (H - 2) * sc, W * sc, H * sc);
  }

  const ROOMS = {};

  // ---------------------------------------------------------------- 受付ホール
  ROOMS.hall = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'hall', t, false);
      if (t === 0) {
        ctx.strokeStyle = 'rgba(40,24,14,0.45)';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(92, top + 6); ctx.lineTo(97, top + 18); ctx.lineTo(93, top + 26); ctx.lineTo(99, top + 36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(300, bot - 60); ctx.lineTo(306, bot - 50); ctx.lineTo(302, bot - 42); ctx.stroke();
        cobweb(STAIR - 2, top, -1);
        box(296, bot, 14, 12, '#7a6048', 2);
        box(311, bot, 12, 9, '#6e563e', 2);
        box(300, bot - 12, 10, 8, '#86684c', 2);
      }
      if (t >= 4) rug(60, 216, bot, '#b0302e', 4);
      else if (t >= 1) rug(t >= 2 ? 92 : 96, t >= 2 ? 208 : 176, bot, t >= 3 ? '#9a2f34' : '#a8433a', t);
      // 剥製（T2〜T3）
      if (t === 2 || t === 3) {
        art.poly(ctx, [216, top + 12, 232, top + 12, 230, top + 24, 218, top + 24], t === 3 ? BRASS_D : '#5a3a26');
        art.facet(ctx, 224, top + 18, 8, 5, 6, '#7a5230', 0, 0.12);
        art.poly(ctx, [220, top + 13, 216, top + 2, 222, top + 12], '#f0c94a');
        art.facet(ctx, 224, top + 13, 5.5, 5, 7, '#e9e2d6', 0, 0.12);
      }
      if (t >= 2) painting(290, top + 13, 26, 19, t, t >= 4 ? 'hero' : t === 3 ? 'sea' : 'land');
      if (t >= 3) trophyCase(284, bot, t);
      if (t >= 3) plant(206, bot, 0.9, t);
      else if (lv >= 3) plant(305, bot, 1, t);
      if (t === 1) { sconceBg(212, bot - 70, 1); sconceBg(322, bot - 70, 1); }
      if (t === 1 && lv >= 3) chandelierBg(150, top, 14, 20, 3, 1);
      if (t === 2) chandelierBg(150, top, 14, 22, 3, 2);
      if (t === 3) chandelierBg(106, top, 16, 26, 5, 3);
      if (t === 4) { grandBg(106, top, 20, 26); chandelierBg(221, top, 12, 16, 3, 4); }
      bench(72, bot, t);
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      windowAt(176, bot - 92, 26, 34, f, t);
      if (lv >= 5) stainedGlass(176, bot - 92, 26, 34, t);
      if (t >= 1) banner(74, top + 8, 18, 26, '#3f7a5e', t, 'star');
      if (t >= 4) crestBanner(258, top + 1, 42, 50);
      if (t === 1) { sconceFx(212, bot - 70, lights); sconceFx(322, bot - 70, lights); }
      if (t === 1 && lv >= 3) chandelierFx(150, top, 14, 20, 3, 1, lights);
      if (t === 2) chandelierFx(150, top, 14, 22, 3, 2, lights);
      if (t === 3) chandelierFx(106, top, 16, 26, 5, 3, lights);
      if (t === 4) { grandFx(106, top, 20, 26, lights); chandelierFx(221, top, 12, 16, 3, 4, lights); }
      drawAbyssDoor(st, bot);
      drawBoard(st, bot, t);
      if (t >= 4) twinkles(f, IL + 10, STAIR - 10, top + 6, bot - 30, 8);
    },
  };
  function bench(x, bot, t) {
    const wood = t === 0 ? '#6a4a30' : t >= 4 ? GOLD : t === 3 ? '#5a3020' : '#7a5230';
    if (t >= 2) {
      // 背もたれとクッション付き
      art.poly(ctx, [x - 1, bot - 8, x + 1, bot - 8, x + 1, bot - 22, x - 1, bot - 22], wood);
      art.poly(ctx, [x + 1, bot - 12, x + 25, bot - 12, x + 25, bot - 21, x + 1, bot - 21], t >= 4 ? '#9a2a3a' : t === 3 ? '#7a2a34' : '#a85a3a');
    }
    box(x, bot - 8, 26, 3, wood, 2);
    if (t >= 2) art.poly(ctx, [x + 1, bot - 11, x + 25, bot - 11, x + 25, bot - 13.5, x + 1, bot - 13.5], t >= 4 ? '#b8323e' : t === 3 ? '#8e3038' : '#c06a44');
    art.poly(ctx, [x + 2, bot, x + 4, bot, x + 4, bot - 8, x + 2, bot - 8], t >= 3 ? G.shade(wood, -0.25) : '#5a3a26');
    art.poly(ctx, [x + 22, bot, x + 24, bot, x + 24, bot - 8, x + 22, bot - 8], t >= 3 ? G.shade(wood, -0.25) : '#5a3a26');
  }
  function trophyCase(x, bot, t) {
    const w = 34, h = 42;
    const fr = t >= 4 ? GOLD : '#5e3a24';
    box(x, bot, w, h, fr, 3);
    art.poly(ctx, [x + 3, bot - h + 3, x + w - 3, bot - h + 3, x + w - 3, bot - 4, x + 3, bot - 4], t >= 4 ? '#4a2030' : '#3a2a24');
    art.poly(ctx, [x + 3, bot - 17, x + w - 3, bot - 17, x + w - 3, bot - 15.6, x + 3, bot - 15.6], fr);
    art.poly(ctx, [x + 3, bot - 30, x + w - 3, bot - 30, x + w - 3, bot - 28.6, x + 3, bot - 28.6], fr);
    // 優勝杯
    const cx = x + 10;
    art.poly(ctx, [cx - 4, bot - 26, cx + 4, bot - 26, cx + 2.5, bot - 20.5, cx - 2.5, bot - 20.5], GOLD);
    art.poly(ctx, [cx - 0.8, bot - 20.5, cx + 0.8, bot - 20.5, cx + 0.8, bot - 18.5, cx - 0.8, bot - 18.5], GOLD_D);
    art.poly(ctx, [cx - 2.6, bot - 18.5, cx + 2.6, bot - 18.5, cx + 2.6, bot - 17, cx - 2.6, bot - 17], GOLD_D);
    art.poly(ctx, [cx - 4, bot - 26, cx - 1, bot - 26, cx - 2, bot - 21, cx - 2.5, bot - 20.5], GOLD_L);
    // 王冠
    const kx = x + 24;
    art.poly(ctx, [kx - 4.5, bot - 30, kx + 4.5, bot - 30, kx + 5, bot - 36, kx + 2.2, bot - 33, kx, bot - 37, kx - 2.2, bot - 33, kx - 5, bot - 36], GOLD);
    art.ellipse(ctx, kx, bot - 32, 1, 1, '#e04a5a');
    // 宝玉と剣
    art.facet(ctx, x + 23, bot - 21, 3, 3.6, 6, '#5ac0e0', 0.3, 0.25);
    art.facet(ctx, x + 10, bot - 33.5, 2.6, 3, 6, '#7ad08a', 0.3, 0.25);
    art.poly(ctx, [x + 5, bot - 7, x + w - 6, bot - 8.5, x + w - 6, bot - 7.5, x + 5, bot - 6], '#dfe5ea');
    art.poly(ctx, [x + 6, bot - 9, x + 7.4, bot - 9, x + 7.4, bot - 4.6, x + 6, bot - 4.6], GOLD);
    art.poly(ctx, [x + 4, bot - h + 4, x + 12, bot - h + 4, x + 4, bot - 14], 'rgba(255,255,255,0.18)');
  }
  function stainedGlass(x, y, w, h, t) {
    const cols = ['#e05a4a', '#4a8ae0', '#f0c94a', '#5ac08a'];
    const hw = w / 2, hh = h / 2;
    for (let i = 0; i < 4; i++) {
      const cx = x + (i % 2) * hw, cy = y + Math.floor(i / 2) * hh;
      art.poly(ctx, [cx, cy, cx + hw, cy, cx + hw, cy + hh], G.rgba(cols[i], 0.55));
      if (t >= 3) art.poly(ctx, [cx, cy, cx, cy + hh, cx + hw, cy + hh], G.rgba(cols[(i + 2) % 4], 0.42));
    }
    if (t >= 4) {
      ctx.strokeStyle = GOLD_D;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const cx = x + (i % 2) * hw, cy = y + Math.floor(i / 2) * hh; ctx.moveTo(cx, cy); ctx.lineTo(cx + hw, cy + hh); }
      ctx.stroke();
      art.facet(ctx, x + hw, y + hh, 4.6, 4.6, 8, '#ffe07a', time * 0.2, 0.25);
      art.facet(ctx, x + hw, y + hh, 2, 2, 6, '#e05a4a', 0, 0.2);
    }
  }
  // MAX の受付：巨大なギルドの紋章旗
  function crestBanner(cx, y, w, h) {
    const sw = Math.sin(time * 1.1) * 0.7;
    art.poly(ctx, [cx - w / 2 - 5, y, cx + w / 2 + 5, y, cx + w / 2 + 5, y + 2.4, cx - w / 2 - 5, y + 2.4], GOLD_D);
    art.facet(ctx, cx - w / 2 - 6, y + 1.2, 2.3, 2.3, 6, GOLD, 0, 0.25);
    art.facet(ctx, cx + w / 2 + 6, y + 1.2, 2.3, 2.3, 6, GOLD, 0, 0.25);
    art.poly(ctx, [cx - w / 2, y + 2, cx + w / 2, y + 2, cx + w / 2 + sw, y + h, cx + sw * 0.5, y + h - 9, cx - w / 2 + sw, y + h], '#7a1e2a');
    art.poly(ctx, [cx - w / 2, y + 2, cx, y + 2, cx + sw * 0.5, y + h - 9, cx - w / 2 + sw, y + h], '#8e2834');
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 2.6, y + 4.5); ctx.lineTo(cx + w / 2 - 2.6, y + 4.5); ctx.lineTo(cx + w / 2 - 2.6 + sw, y + h - 4); ctx.lineTo(cx + sw * 0.5, y + h - 12); ctx.lineTo(cx - w / 2 + 2.6 + sw, y + h - 4); ctx.closePath();
    ctx.stroke();
    crest(cx + sw * 0.3, y + h * 0.42, 0.95);
    // 房
    [cx - w / 2 + sw, cx + w / 2 + sw].forEach((tx) => {
      art.poly(ctx, [tx - 1.2, y + h, tx + 1.2, y + h, tx + 1.8, y + h + 5, tx - 1.8, y + h + 5], GOLD);
    });
  }

  // ---------------------------------------------------------------- 宿舎
  // ベッドの並び：8台までは2段ベッド、それ以上は3段ベッド（最大16台）。
  const bunkCache = { lv: -1, L: null };
  function bunkLayout(lv) {
    if (bunkCache.lv === lv) return bunkCache.L;
    const n = Math.max(1, D.beds(lv));
    let F, sp, x0, tiers;
    if (n <= 8) {
      F = Math.ceil(n / 2); sp = 58; x0 = 92;
      tiers = new Array(F).fill(2);
      if (n % 2) tiers[F - 1] = 1;
    } else {
      // 中ほどの枠から3段にしていく（見た目が左右対称に近くなる順）
      const pri = n <= 12 ? [1, 2, 0, 3] : n <= 15 ? [1, 3, 2, 0, 4] : [1, 4, 2, 3, 0, 5];
      F = pri.length; sp = [58, 50, 44][F - 4]; x0 = [92, 84, 80][F - 4];
      tiers = new Array(F).fill(2);
      for (let e = n - 2 * F, k = 0; e > 0; e--, k++) tiers[pri[k % F]]++;
    }
    const dy = n <= 8 ? 30 : 27;
    const slots = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < F; i++) if (tiers[i] > r) slots.push({ x: x0 + i * sp, r });
    const L = { n, F, sp, x0, tiers, dy, slots };
    bunkCache.lv = lv;
    bunkCache.L = L;
    return L;
  }
  SC.bunkLayout = bunkLayout;
  function bedPos(i) {
    const L = bunkLayout(G.state.fac.bunks);
    const m = L.slots.length;
    const s = L.slots[((i % m) + m) % m];
    return { x: s.x, y: floorY(1) - 9 - s.r * L.dy };
  }
  SC.bedPos = bedPos;
  ROOMS.bunks = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'bunks', t, false);
      const L = bunkLayout(lv);
      if (t >= 1) rug(76, L.F <= 4 ? 300 : 326, bot, t >= 4 ? '#3a4a8e' : t >= 3 ? '#7a2a3a' : '#5a6a9a', t);
      if (L.F <= 4) dresser(296, bot, t);
      if (t >= 3) garland(top + 6, t);
      if (t === 0) {
        // 桶と藁
        box(L.F <= 1 ? 160 : 228, bot, 10, 8, '#7a6048', 1.5);
        art.poly(ctx, [250, bot, 268, bot, 262, bot - 5, 254, bot - 4], '#c8b070');
      }
      for (let i = 0; i < L.F; i++) bunkFrame(L.x0 + i * L.sp, bot, L.tiers[i], L.dy, t);
      bunkLights(f, L, t, top, null);
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      const L = bunkLayout(lv);
      if (L.F <= 4) {
        windowAt(290, bot - 88, 24, 30, f, t);
        if (t >= 1) curtains(290, bot - 88, 24, 30, t >= 2 ? '#3f5a8a' : '#8a6a4a', t);
      }
      bunkLights(f, L, t, top, lights);
      if (t >= 4) twinkles(f, IL + 8, STAIR - 8, top + 4, bot - 12, 9);
    },
  };
  // 宿舎の灯り（lights が null なら本体＝bg、あれば炎＝fx）
  function bunkLights(f, L, t, top, lights) {
    const xs = [];
    if (L.F <= 4 && t <= 1) xs.push(['lan', 240, 2]);
    else if (L.F <= 4) xs.push(['lan', 121, 2], ['lan', 237, 2]);
    else if (t === 3) xs.push(['ch', L.x0 + L.sp * 1.5, 4, 14, 3], ['ch', L.x0 + L.sp * 3.5, 4, 14, 3]);
    else xs.push(['ch', L.x0 + L.sp * 1.5, 4, 14, 3], ['ch', L.x0 + L.sp * 3.5, 4, 14, 3]);
    xs.forEach(([kind, x, len, w, n]) => {
      if (kind === 'lan') { if (lights) lanternFx(x, top - 7, len + 7, lights); else lanternBg(x, top - 7, len + 7, t); }
      else if (lights) chandelierFx(x, top - 3, len + 3, w, n, t, lights, 50);
      else chandelierBg(x, top - 3, len + 3, w, n, t);
    });
  }
  function bunkFrame(x, bot, nt, dy, t) {
    const wood = ['#6a4c32', '#7a5230', '#8e5c36', '#b08848', GOLD][t];
    const H = 9 + (nt - 1) * dy + 23;
    const mat = ['#d8c89a', '#efe6d6', '#f4ece0', '#f6f0e6', '#fbf6ee'][t];
    const pil = ['#e8dcc0', '#fffaf0', '#fffaf0', '#f8e8e8', '#fffdf6'][t];
    const blanket = ['#8a7a5a', '#5a7aa8', '#5a8a6a', '#8a2f3a', '#34458a'];
    if (t >= 4) {
      // 天蓋
      art.poly(ctx, [x - 23, bot - H - 9, x + 24, bot - H - 9, x + 24, bot - H - 1, x - 23, bot - H - 1], '#7a1e2a');
      art.poly(ctx, [x - 23, bot - H - 9, x + 24, bot - H - 9, x + 24, bot - H - 7, x - 23, bot - H - 7], GOLD);
      const fr = [];
      for (let i = 0; i <= 8; i++) fr.push(x - 23 + i * (47 / 8), bot - H - 1 + (i % 2) * 2.4);
      fr.push(x + 24, bot - H - 2.4, x - 23, bot - H - 2.4);
      art.poly(ctx, fr, GOLD);
      [x - 23, x + 24].forEach((px) => art.facet(ctx, px, bot - H - 10, 2.2, 2.2, 6, GOLD_L, 0, 0.25));
    }
    const post = (px) => {
      art.poly(ctx, [px, bot, px + 3, bot, px + 3, bot - H, px, bot - H], wood);
      art.poly(ctx, [px, bot, px + 1, bot, px + 1, bot - H, px, bot - H], G.shade(wood, 0.18));
      if (t >= 2 && t < 4) art.facet(ctx, px + 1.5, bot - H - 1.8, 2.3, 2.3, 6, t >= 3 ? '#e0c070' : G.shade(wood, 0.12), 0, 0.25);
    };
    post(x - 20);
    post(x + 18);
    art.poly(ctx, [x - 20, bot - H, x + 21, bot - H, x + 21, bot - H + 2.2, x - 20, bot - H + 2.2], G.shade(wood, -0.1));
    for (let r = 0; r < nt; r++) {
      const y = bot - 9 - r * dy;
      art.poly(ctx, [x - 18, y, x + 19, y, x + 19, y + 4, x - 18, y + 4], G.shade(wood, -0.06));
      if (t >= 3) art.poly(ctx, [x - 18, y + 1.5, x + 19, y + 1.5, x + 19, y + 2.3, x - 18, y + 2.3], t >= 4 ? GOLD_L : '#e0c070');
      art.poly(ctx, [x - 17, y, x + 18, y, x + 18, y - 3, x - 17, y - 3], mat);
      art.poly(ctx, [x - 16, y - 3, x - 6, y - 3, x - 7, y - 7, x - 15, y - 7], pil);
      if (t >= 4) art.poly(ctx, [x - 16, y - 3, x - 6, y - 3, x - 6.2, y - 3.8, x - 15.8, y - 3.8], GOLD);
      const bc = t === 2 ? ['#5a8a6a', '#a8605a', '#5a7aa8'][(x + r) % 3] : blanket[t];
      art.poly(ctx, [x + 5, y - 3, x + 17.5, y - 3, x + 17.5, y - 5.6, x + 5, y - 5.6], bc);
      art.poly(ctx, [x + 5, y - 5.6, x + 17.5, y - 5.6, x + 17.5, y - 6.2, x + 5, y - 6.2], G.shade(bc, 0.2));
      if (t === 0) art.poly(ctx, [x + 9, y - 3.2, x + 12.5, y - 3.2, x + 12.5, y - 5.4, x + 9, y - 5.4], '#a8946a');
      if (t >= 4) art.poly(ctx, [x + 5, y - 4.6, x + 17.5, y - 4.6, x + 17.5, y - 4, x + 5, y - 4], GOLD);
      if (t >= 3) {
        // 寝台ごとのカーテン（タッセルで留めてある）
        const up = r === nt - 1 ? bot - H + 2 : y - dy + 4;
        const cc = t >= 4 ? '#8e2a34' : '#6a2a3a';
        art.poly(ctx, [x - 17, up, x - 9, up, x - 15, y - 12, x - 17, y - 8], cc);
        art.poly(ctx, [x - 17, up, x - 13, up, x - 16, y - 11, x - 17, y - 8], G.shade(cc, 0.12));
        art.ellipse(ctx, x - 15.6, y - 12, 1.2, 1.2, t >= 4 ? GOLD : '#d0a860');
      }
    }
    // はしご
    ctx.strokeStyle = t >= 3 ? G.shade(wood, 0.15) : G.shade(wood, 0.1);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const rungs = Math.max(3, Math.round((H - 14) / 8));
    for (let i = 0; i < rungs; i++) { ctx.moveTo(x + 18, bot - 10 - i * 8); ctx.lineTo(x + 23, bot - 10 - i * 8); }
    ctx.stroke();
    if (t >= 4) {
      // 天蓋から下がるカーテン（両側）
      art.poly(ctx, [x - 24, bot - H - 1, x - 18, bot - H - 1, x - 20, bot - H * 0.55, x - 22.5, bot - H * 0.45, x - 24, bot - H * 0.5], '#8e2a34');
      art.poly(ctx, [x + 25, bot - H - 1, x + 19, bot - H - 1, x + 21, bot - H * 0.55, x + 23.5, bot - H * 0.45, x + 25, bot - H * 0.5], '#7a2230');
      art.ellipse(ctx, x - 21.5, bot - H * 0.55, 1.6, 1.3, GOLD);
      art.ellipse(ctx, x + 22.5, bot - H * 0.55, 1.6, 1.3, GOLD);
    }
  }
  function dresser(x, bot, t) {
    const wood = t === 0 ? '#6e5236' : t >= 2 ? '#8a5a34' : '#7a5230';
    box(x, bot, 22, 40, wood, 3);
    art.poly(ctx, [x + 3, bot - 26, x + 19, bot - 26, x + 19, bot - 25, x + 3, bot - 25], '#5a3a26');
    art.poly(ctx, [x + 3, bot - 13, x + 19, bot - 13, x + 19, bot - 12, x + 3, bot - 12], '#5a3a26');
    if (t >= 2) {
      [bot - 32, bot - 19, bot - 6].forEach((y) => art.ellipse(ctx, x + 11, y, 1.2, 1.2, BRASS));
      // 花瓶
      art.facet(ctx, x + 11, bot - 47, 3, 4, 7, '#5a8ac0', 0, 0.2);
      [-1, 0, 1].forEach((d) => art.ellipse(ctx, x + 11 + d * 3, bot - 54 + Math.abs(d), 1.8, 1.8, ['#e86a7a', '#f0c94a', '#e8e0f0'][d + 1]));
    } else if (t === 1) {
      art.poly(ctx, [x + 4, bot - 43, x + 9, bot - 43, x + 9, bot - 49, x + 4, bot - 49], '#4a6a9a');
      art.poly(ctx, [x + 10, bot - 43, x + 14, bot - 43, x + 14, bot - 48, x + 10, bot - 48], '#9a4a3a');
    }
  }
  function curtains(x, y, w, h, col, t) {
    const sw = Math.sin(time * 0.8 + x) * 0.5;
    art.poly(ctx, [x - 5, y - 5, x + 4, y - 5, x + 1 + sw, y + h * 0.55, x - 1, y + h + 4, x - 5, y + h + 4], col);
    art.poly(ctx, [x + w + 5, y - 5, x + w - 4, y - 5, x + w - 1 + sw, y + h * 0.55, x + w + 1, y + h + 4, x + w + 5, y + h + 4], G.shade(col, -0.1));
    art.poly(ctx, [x - 7, y - 7, x + w + 7, y - 7, x + w + 7, y - 4, x - 7, y - 4], t >= 3 ? (t >= 4 ? GOLD : BRASS) : '#5a3a26');
  }
  function garland(y, t) {
    const a = t >= 4 ? '#8e2a34' : '#5a7a4a', b = t >= 4 ? GOLD : '#e0c070';
    ctx.strokeStyle = a;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = IL + 4; x < STAIR - 20; x += 30) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y + 9, x + 30, y); }
    ctx.stroke();
    for (let x = IL + 4; x < STAIR - 10; x += 30) art.facet(ctx, x, y, 1.8, 1.8, 6, b, 0, 0.25);
  }

  // ---------------------------------------------------------------- 酒場
  ROOMS.tavern = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'tavern', t, false);
      fireplaceBg(bot, t);
      backBar(bot, lv, t);
      if (t === 0) {
        box(226, bot, 14, 11, '#7a6048', 2);
        box(232, bot - 11, 10, 8, '#86684c', 2);
      }
      if (t >= 1) {
        // 階段下の樽
        [[344, 0], [362, 0], [353, 1]].forEach(([x, r]) => {
          const y = bot - r * 15;
          art.facetPoly(ctx, [x - 8, y, x + 8, y, x + 9, y - 7, x + 8, y - 15, x - 8, y - 15, x - 9, y - 7], '#9a6a3a', 0.12);
          art.poly(ctx, [x - 8.6, y - 4, x + 8.6, y - 4, x + 8.8, y - 5.2, x - 8.8, y - 5.2], '#5a4a3a');
          art.poly(ctx, [x - 8.6, y - 10, x + 8.6, y - 10, x + 8.8, y - 11.2, x - 8.8, y - 11.2], '#5a4a3a');
        });
      }
      if (t === 1) {
        // 鹿の角
        art.poly(ctx, [229, top + 12, 237, top + 12, 236, top + 20, 230, top + 20], '#5a3a26');
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(231, top + 13); ctx.quadraticCurveTo(222, top + 6, 224, top - 1); ctx.moveTo(226, top + 7); ctx.lineTo(221, top + 6);
        ctx.moveTo(235, top + 13); ctx.quadraticCurveTo(244, top + 6, 242, top - 1); ctx.moveTo(240, top + 7); ctx.lineTo(245, top + 6);
        ctx.stroke();
      }
      if (t === 2 || t === 3) {
        painting(114, top + 12, 20, 14, t, 'land');
        painting(232, top + 10, 16, 20, t, t === 3 ? 'dragon' : 'sea');
      }
      if (t === 3) chandelierBg(160, top, 16, 30, 5, 3);
      if (t <= 2) [140, 200].slice(t === 0 ? 1 : 0).forEach((x) => lanternBg(x, top, 16, t));
      if (t >= 4) { stageBg(bot, top); grandBg(156, top, 22, 40); }
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      fireplaceFx(bot, t, lights);
      if (G.items && G.items.boost('feast')) feastDeco(top);
      if (t <= 2) [140, 200].slice(t === 0 ? 1 : 0).forEach((x) => lanternFx(x, top, 16, lights, 48));
      if (t === 3) chandelierFx(160, top, 16, 30, 5, 3, lights);
      if (t >= 4) grandFx(156, top, 22, 40, lights);
      if (lv >= 5 && t < 4) {
        art.poly(ctx, [182, top + 34, 222, top + 34, 222, top + 48, 182, top + 48], t >= 3 ? '#2a3a30' : '#e8d8b0');
        if (t >= 3) { ctx.strokeStyle = BRASS; ctx.lineWidth = 0.8; ctx.strokeRect(182.5, top + 34.5, 39, 13); }
        ctx.fillStyle = t >= 3 ? '#f4ecd0' : '#5a3a26';
        ctx.font = G.font(700, 6);
        ctx.textAlign = 'center';
        ctx.fillText('本日の一杯', 202, top + 43.5);
      }
      if (t >= 3) waitress(bot);
      if (t >= 4) {
        musicians(bot);
        // 舞台の足元灯
        for (let i = 0; i < 4; i++) lights.push([126 + i * 20, bot - 9, 18, 0.5, '#ffd27a']);
        twinkles(f, IL + 50, STAIR - 4, top + 6, bot - 40, 8);
      }
    },
  };
  function fireplaceBg(bot, t) {
    if (t === 0) {
      // 石を積んだだけのかまど
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const x = IL + 4 + c * 13 + (r % 2) * 4, y = bot - 11 - r * 10;
        art.facet(ctx, x + 6, y + 5, 6.4, 4.8, 6, G.shade('#7a7470', (G.hash(r * 7 + c) - 0.5) * 0.3), G.hash(r + c * 3), 0.12);
      }
      art.poly(ctx, [IL + 10, bot, IL + 34, bot, IL + 34, bot - 20, IL + 10, bot - 20], '#2a1810');
      // 鍋
      ctx.strokeStyle = '#3a3030'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(IL + 22, bot - 20); ctx.lineTo(IL + 22, bot - 14); ctx.stroke();
      art.facet(ctx, IL + 22, bot - 10, 6, 4.2, 8, '#3a3436', 0, 0.15);
      return;
    }
    const brick = t >= 3 ? (t >= 4 ? MARBLE : '#9a948a') : '#9a5040';
    if (t <= 2) {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
        const x = IL + 2 + c * 12 + (r % 2) * 6, y = bot - 12 - r * 9;
        art.poly(ctx, [x, y, x + 11, y, x + 11, y + 8, x, y + 8], G.shade(brick, (G.hash(r * 7 + c) - 0.5) * 0.2));
      }
    } else {
      // 石（T3）・大理石（T4）の暖炉
      art.poly(ctx, [IL + 1, bot, IL + 45, bot, IL + 45, bot - 54, IL + 1, bot - 54], brick);
      art.poly(ctx, [IL + 1, bot, IL + 5, bot, IL + 5, bot - 54, IL + 1, bot - 54], G.shade(brick, 0.1));
      art.poly(ctx, [IL + 41, bot, IL + 45, bot, IL + 45, bot - 54, IL + 41, bot - 54], G.shade(brick, -0.12));
      // 両脇の柱と、アーチの上の浮き彫り
      const colc = t >= 4 ? '#ddd4c4' : '#848076';
      const m = t >= 4 ? GOLD : BRASS;
      [IL + 1, IL + 39].forEach((px) => {
        art.poly(ctx, [px, bot, px + 7, bot, px + 7, bot - 50, px, bot - 50], colc);
        art.poly(ctx, [px, bot, px + 1.6, bot, px + 1.6, bot - 50, px, bot - 50], G.shade(colc, 0.15));
        art.poly(ctx, [px - 0.6, bot - 50, px + 7.6, bot - 50, px + 7.6, bot - 53.4, px - 0.6, bot - 53.4], m);
        art.poly(ctx, [px - 0.6, bot - 3, px + 7.6, bot - 3, px + 7.6, bot - 5, px - 0.6, bot - 5], m);
      });
      art.poly(ctx, [IL + 11, bot - 35, IL + 35, bot - 35, IL + 35, bot - 49, IL + 11, bot - 49], G.shade(brick, -0.07));
      ctx.strokeStyle = m; ctx.lineWidth = 0.6; ctx.strokeRect(IL + 12, bot - 48, 22, 12);
      if (t >= 4) {
        ctx.strokeStyle = 'rgba(140,128,116,0.4)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(IL + 13, bot - 47); ctx.quadraticCurveTo(IL + 22, bot - 40, IL + 30, bot - 37); ctx.moveTo(IL + 20, bot - 48); ctx.lineTo(IL + 26, bot - 42); ctx.stroke();
        fleur(IL + 23, bot - 42, 3, GOLD);
        // マントルの金の燭台
        [IL + 5, IL + 41].forEach((cx) => {
          art.poly(ctx, [cx - 2.4, bot - 59.5, cx + 2.4, bot - 59.5, cx + 1, bot - 61, cx - 1, bot - 61], GOLD);
          art.poly(ctx, [cx - 0.5, bot - 61, cx + 0.5, bot - 61, cx + 0.5, bot - 66, cx - 0.5, bot - 66], GOLD);
          art.poly(ctx, [cx - 2, bot - 66, cx + 2, bot - 66, cx + 1.4, bot - 67.2, cx - 1.4, bot - 67.2], GOLD);
          art.poly(ctx, [cx - 0.8, bot - 67.2, cx + 0.8, bot - 67.2, cx + 0.8, bot - 71, cx - 0.8, bot - 71], '#f5ead0');
        });
      }
    }
    art.poly(ctx, [IL + 6, bot, IL + 36, bot, IL + 36, bot - 24, IL + 6, bot - 24], '#2a1810');
    if (t >= 3) {
      // アーチ
      art.poly(ctx, [IL + 6, bot - 24, IL + 36, bot - 24, IL + 32, bot - 28, IL + 21, bot - 30, IL + 10, bot - 28], brick);
      art.poly(ctx, [IL + 4, bot, IL + 38, bot, IL + 38, bot - 2.2, IL + 4, bot - 2.2], t >= 4 ? GOLD : BRASS);
    }
    const mc = t >= 4 ? GOLD : t === 3 ? '#7a746a' : t === 2 ? '#5a3a24' : '#6a4630';
    art.poly(ctx, [IL - 1, bot - 54, IL + 47, bot - 54, IL + 47, bot - 58.5, IL - 1, bot - 58.5], mc);
    art.poly(ctx, [IL - 1, bot - 58.5, IL + 47, bot - 58.5, IL + 46, bot - 59.5, IL, bot - 59.5], G.shade(mc, 0.25));
    if (t === 2) {
      // マントルピースの上：ろうそく立てとジョッキ
      art.mug(ctx, IL + 28, bot - 59.5);
      art.poly(ctx, [IL + 6, bot - 58.5, IL + 10, bot - 58.5, IL + 9.4, bot - 60, IL + 6.6, bot - 60], BRASS);
      art.poly(ctx, [IL + 7.3, bot - 60, IL + 8.7, bot - 60, IL + 8.7, bot - 64.5, IL + 7.3, bot - 64.5], '#f5ead0');
    }
    if (t === 3) {
      // 猪の首の剥製
      const x = IL + 22, y = bot - 76;
      art.poly(ctx, [x - 8, y - 6, x + 8, y - 6, x + 7, y + 8, x - 7, y + 8], '#5a3a26');
      art.facet(ctx, x, y + 2, 7, 6, 7, '#6a4a3a', 0.3, 0.14);
      art.facet(ctx, x, y + 6, 3.4, 2.6, 6, '#8a6a5a', 0, 0.1);
      art.poly(ctx, [x - 3, y + 7, x - 5, y + 3, x - 2.4, y + 6], '#f4ecd8');
      art.poly(ctx, [x + 3, y + 7, x + 5, y + 3, x + 2.4, y + 6], '#f4ecd8');
      art.poly(ctx, [x - 6, y - 2, x - 9, y - 7, x - 4, y - 4], '#5a3a2a');
      art.poly(ctx, [x + 6, y - 2, x + 9, y - 7, x + 4, y - 4], '#5a3a2a');
    }
    if (t >= 4) crest(IL + 22, bot - 78, 0.62);
  }
  function fireplaceFx(bot, t, lights) {
    const n = t === 0 ? 3 : t >= 4 ? 7 : t === 3 ? 6 : 5;
    const hk = t >= 4 ? 1.45 : t === 0 ? 0.65 : 1;
    const x0 = t === 0 ? IL + 14 : IL + 9, sp = t === 0 ? 8 : 26 / (n - 1) + 0.4;
    for (let i = 0; i < n; i++) {
      const fx = x0 + i * sp;
      const fh = (9 + Math.sin(time * 9 + i * 2) * 3 + G.noise1(time * 4 + i) * 4) * hk;
      art.poly(ctx, [fx - 3, bot - 2, fx + 3, bot - 2, fx + Math.sin(time * 6 + i) * 1.5, bot - 2 - fh], i % 2 ? '#ff9a3a' : '#ffcf5a');
      if (t >= 4 && i % 2 === 0) art.poly(ctx, [fx - 1.4, bot - 2, fx + 1.4, bot - 2, fx, bot - 2 - fh * 0.5], '#fff4c0');
    }
    if (t >= 4) [IL + 5, IL + 41].forEach((cx) => flame(cx, bot - 71.3, 1));
    if (t === 0) lights.push([IL + 22, bot - 8, 50, 0.6]);
    else lights.push([IL + 21, bot - 10, t >= 4 ? 90 : 75, t >= 4 ? 0.95 : 0.8]);
  }
  // 酒棚：瓶の数はレベルで増える。T3 で鏡張りの棚、T4 で金の棚と金の瓶
  function backBar(bot, lv, t) {
    const sh = t >= 4 ? GOLD : t === 3 ? '#3a2416' : '#5a3a26';
    if (t >= 3) {
      art.poly(ctx, [252, bot - 92, 330, bot - 92, 330, bot - 26, 252, bot - 26], t >= 4 ? '#4a2a1a' : '#3a2416');
      art.poly(ctx, [256, bot - 88, 326, bot - 88, 326, bot - 30, 256, bot - 30], t >= 4 ? '#a8b8c0' : '#7a8a90');
      art.poly(ctx, [256, bot - 88, 280, bot - 88, 256, bot - 50], 'rgba(255,255,255,0.18)');
      if (t >= 4) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.strokeRect(253, bot - 91, 76, 64); }
    }
    const rows = t === 0 ? [bot - 64] : [bot - 74, bot - 54];
    rows.forEach((y) => {
      art.poly(ctx, [256, y, 326, y, 326, y + 2, 256, y + 2], sh);
      if (t === 2) [262, 318].forEach((x) => art.poly(ctx, [x, y + 2, x + 2, y + 2, x + 2, y + 6, x, y + 4], BRASS));
    });
    const n = t === 0 ? Math.min(3, lv + 1) : Math.min(t >= 3 ? 12 : 10, 3 + lv);
    const per = t >= 3 ? 6 : 5;
    const cols = t >= 4 ? [GOLD, '#8a2a3a', '#e8e0d0', '#3a6a5a', '#c8902a', '#5a3a8a'] : ['#4a8a5a', '#8a3a4a', '#c8a03a', '#3a5a8a', '#7a4a8a'];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / per);
      if (row >= rows.length) break;
      const x = 260 + (i % per) * (t >= 3 ? 11 : 13), y = rows[row];
      const col = cols[i % cols.length];
      if (t >= 4 && i % 3 === 2) {
        // クリスタルのデキャンタ
        art.facet(ctx, x + 2.5, y - 4.5, 3.4, 4.4, 6, '#cfe4f2', 0.3, 0.2);
        art.poly(ctx, [x + 0.8, y - 6.5, x + 2, y - 7.6, x + 1.6, y - 4], 'rgba(255,255,255,0.8)');
        art.poly(ctx, [x + 1.6, y - 9, x + 3.4, y - 9, x + 3.4, y - 12, x + 1.6, y - 12], 'rgba(220,240,255,0.9)');
        art.facet(ctx, x + 2.5, y - 13, 1.4, 1.4, 5, GOLD, 0, 0.2);
        continue;
      }
      art.poly(ctx, [x, y, x + 5, y, x + 5, y - 9, x + 3.5, y - 12, x + 3.5, y - 14, x + 1.5, y - 14, x + 1.5, y - 12, x, y - 9], col);
      art.poly(ctx, [x + 0.8, y - 2, x + 1.8, y - 2, x + 1.8, y - 8, x + 0.8, y - 8], 'rgba(255,255,255,0.35)');
      if (t >= 2) art.poly(ctx, [x, y - 5.5, x + 5, y - 5.5, x + 5, y - 3, x, y - 3], t >= 4 ? '#fff4d0' : '#efe2c4');
    }
  }
  // MAX の酒場：楽団の舞台
  function stageBg(bot, top) {
    const x0 = 112, x1 = 200;
    // 背景の幕
    art.poly(ctx, [x0 + 4, top + 8, x1 - 4, top + 8, x1 - 4, bot - 8, x0 + 4, bot - 8], '#6a1a26');
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = x0 + 8; x < x1 - 6; x += 7) ctx.fillRect(x, top + 8, 2.4, bot - 8 - top - 8);
    // 舞台
    art.poly(ctx, [x0, bot, x1, bot, x1, bot - 8, x0, bot - 8], '#5a3220');
    art.poly(ctx, [x0, bot - 8, x1, bot - 8, x1 - 1, bot - 9.6, x0 + 1, bot - 9.6], '#8a5a34');
    art.poly(ctx, [x0, bot - 7.2, x1, bot - 7.2, x1, bot - 6.2, x0, bot - 6.2], GOLD);
    for (let x = x0 + 8; x < x1; x += 22) art.facet(ctx, x, bot - 3.5, 1.6, 1.6, 6, GOLD, 0, 0.2);
    // 両脇の緞帳（金のタッセルで留める）
    art.poly(ctx, [x0 - 4, top + 6, x0 + 14, top + 6, x0 + 6, bot - 44, x0 + 2, bot - 8, x0 - 4, bot - 8], '#9a2232');
    art.poly(ctx, [x1 + 4, top + 6, x1 - 14, top + 6, x1 - 6, bot - 44, x1 - 2, bot - 8, x1 + 4, bot - 8], '#8a1e2c');
    art.ellipse(ctx, x0 + 5, bot - 44, 2, 1.6, GOLD);
    art.ellipse(ctx, x1 - 5, bot - 44, 2, 1.6, GOLD);
    // 上の飾り幕
    const v = [x0 - 6, top + 5];
    for (let i = 0; i <= 4; i++) {
      const xa = x0 - 6 + i * ((x1 - x0 + 12) / 4);
      if (i) v.push(xa - (x1 - x0 + 12) / 8, top + 15);
      v.push(xa, top + 11);
    }
    v.push(x1 + 6, top + 5);
    art.poly(ctx, v, '#7a1e2a');
    art.poly(ctx, [x0 - 6, top + 5, x1 + 6, top + 5, x1 + 6, top + 7, x0 - 6, top + 7], GOLD);
    art.star(ctx, (x0 + x1) / 2, top + 9.6, 2.6, GOLD_L);
  }
  const bandLooks = [];
  function musicians(bot) {
    if (!bandLooks.length) {
      const bard = art.randomLook('bard', 31);
      Object.assign(bard, { skin: '#f0c8a8', hair: '#3a2a4a', style: 'short', pants: '#3a2a3a' });
      bandLooks.push(bard);
      bandLooks.push({ cls: 'warrior', role: 'singer', seed: 33, skin: '#f8dcc4', hair: '#f0d070', style: 'long', outfit: '#c8304a', robe: true, pants: '#7a1e2a', blush: true });
    }
    const y = bot - 8;
    ctx.save(); ctx.translate(132, y); ctx.scale(PS, PS);
    art.person(ctx, bandLooks[0], { t: time, state: 'stand', facing: 1, armed: true });
    ctx.restore();
    const sing = Math.sin(time * 1.3) > -0.3;
    ctx.save(); ctx.translate(180, y); ctx.scale(PS, PS);
    art.person(ctx, bandLooks[1], { t: time, state: sing ? 'cheer' : 'stand', facing: -1, expr: 'happy', talk: sing });
    ctx.restore();
  }
  let waitLook = null;
  function waitress(bot) {
    if (!waitLook) waitLook = { cls: 'warrior', role: 'waitress', seed: 21, skin: '#f6d3b3', hair: '#c86a3a', style: 'pony', outfit: '#3f5a8f', apron: '#f4efe4', pants: '#2e2a3a', blush: true };
    const ph = time * 0.21;
    const x = 172 + Math.sin(ph) * 62;
    const vx = Math.cos(ph);
    ctx.save(); ctx.translate(x, bot); ctx.scale(PS, PS);
    art.person(ctx, waitLook, { t: time, state: Math.abs(vx) > 0.12 ? 'walk' : 'stand', phase: time * 3.6, facing: vx >= 0 ? 1 : -1, item: 'mug' });
    ctx.restore();
  }
  function feastDeco(top) {
    const cols = ['#e05a4a', '#f0c94a', '#5ac08a', '#4a8ae0', '#c27cff'];
    for (let r = 0; r < 2; r++) {
      const y0 = top + 6 + r * 10, x0 = IL + 50 + r * 20, x1 = 250 - r * 10;
      ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 10, x1, y0); ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const k = (i + 0.5) / 9;
        const px = G.lerp(x0, x1, k), py = y0 + Math.sin(k * Math.PI) * 7.5;
        const sw = Math.sin(time * 3 + i + r) * 0.6;
        art.poly(ctx, [px - 3, py, px + 3, py, px + sw, py + 6], cols[(i + r * 2) % cols.length]);
      }
    }
    if (Math.random() < 0.06) {
      addPart({ type: 'tri', x: G.rand(IL + 40, 250), y: top + 10, vx: G.rand(-6, 6), vy: G.rand(4, 12), g: 6, life: 0, max: 2.6, col: G.pick(cols), size: 1.4, rot: Math.random() * 6, vr: G.rand(-4, 4) });
    }
  }

  // ---------------------------------------------------------------- 鍛冶場
  ROOMS.smithy = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'smithy', t, true);
      forgeBg(bot, top, t);
      if (t >= 1) toolRack(116, bot - 86, t);
      bucket(128, bot, t);
      if (t >= 3) ingots(147, bot, t);
      anvil(175, bot, t, 1);
      weaponWall(bot, lv, t);
      if (t === 2) armorStand(224, bot, t);
      if (t === 3) { armorStand(214, bot, t); armorStand(238, bot, t); }
      if (t >= 2) anvil(292, bot, t, 0.85);
      if (t >= 4) {
        // 伝説の剣の台座
        art.facetPoly(ctx, [216, bot, 236, bot, 234, bot - 6, 231, bot - 14, 221, bot - 14, 218, bot - 6], '#2e2a30', 0.15);
        art.poly(ctx, [219, bot - 14, 233, bot - 14, 234, bot - 16, 218, bot - 16], GOLD);
        art.poly(ctx, [216, bot - 1.6, 236, bot - 1.6, 236, bot, 216, bot], GOLD);
      }
      if (t >= 2) lanternBg(210, top, 10, t);
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      forgeFx(bot, top, t, lights);
      if (t >= 1) bellows(IL + 52, bot, t);
      if (t >= 2) { apprentice(bot); lanternFx(210, top, 10, lights, 40); }
      if (t >= 4) {
        legendSword(226, bot - 40, lights);
        twinkles(f, IL + 60, STAIR - 8, top + 6, bot - 24, 6, '255,220,150');
      }
    },
  };
  function forgeBg(bot, top, t) {
    const st = t === 0 ? '#6a625c' : t >= 4 ? '#2e2a30' : t === 3 ? '#4e4a50' : '#5e5550';
    if (t === 0) {
      art.facetPoly(ctx, [IL + 8, bot, IL + 46, bot, IL + 44, bot - 30, IL + 34, bot - 44, IL + 20, bot - 44, IL + 10, bot - 30], st, 0.1);
      art.poly(ctx, [IL + 16, bot - 5, IL + 38, bot - 5, IL + 36, bot - 20, IL + 18, bot - 20], '#2a1810');
      art.poly(ctx, [IL + 23, bot - 44, IL + 31, bot - 44, IL + 30.5, top, IL + 23.5, top], '#4e4844');
      return;
    }
    const big = t >= 3 ? 4 : 0;
    art.facetPoly(ctx, [IL + 4 - big, bot, IL + 52 + big, bot, IL + 50 + big, bot - 40, IL + 38, bot - 60 - big, IL + 18, bot - 60 - big, IL + 6 - big, bot - 40], st, 0.08);
    art.poly(ctx, [IL + 14, bot - 6, IL + 42, bot - 6, IL + 40, bot - 26, IL + 16, bot - 26], '#2a1810');
    art.poly(ctx, [IL + 22, bot - 60, IL + 34, bot - 60, IL + 33, top, IL + 23, top], t >= 4 ? '#262228' : '#4e4844');
    if (t >= 2) {
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [IL + 4 - big, bot - 40, IL + 52 + big, bot - 40, IL + 51 + big, bot - 42.4, IL + 5 - big, bot - 42.4], m);
      art.poly(ctx, [IL + 13, bot - 26, IL + 43, bot - 26, IL + 43, bot - 28, IL + 13, bot - 28], m);
      [bot - 76, bot - 92].forEach((y) => art.poly(ctx, [IL + 21.5, y, IL + 34.5, y, IL + 34.5, y + 2, IL + 21.5, y + 2], m));
    }
    if (t >= 4) {
      // 黒曜石の炉に金の縁
      art.poly(ctx, [IL + 18, bot - 64, IL + 38, bot - 64, IL + 36, bot - 60, IL + 20, bot - 60], GOLD);
      art.poly(ctx, [IL + 1, bot - 1.8, IL + 55, bot - 1.8, IL + 55, bot, IL + 1, bot], GOLD);
    }
  }
  function forgeFx(bot, top, t, lights) {
    const gl = 0.75 + Math.sin(time * 3) * 0.15 + G.noise1(time * 5) * 0.1;
    if (t === 0) {
      art.poly(ctx, [IL + 18, bot - 5, IL + 36, bot - 5, IL + 35, bot - 11, IL + 19, bot - 11], G.mix('#ff7a2a', '#ffd25a', gl - 0.5));
      lights.push([IL + 27, bot - 10, 60, 0.7 * gl]);
      return;
    }
    art.poly(ctx, [IL + 16, bot - 6, IL + 40, bot - 6, IL + 38, bot - 14, IL + 18, bot - 14], G.mix('#ff7a2a', '#ffd25a', gl - 0.5));
    if (t >= 3) {
      const n = t >= 4 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const fx = IL + 19 + (i * 18) / (n - 1);
        const fh = (6 + Math.sin(time * 10 + i * 2.2) * 2.5 + G.noise1(time * 5 + i * 3) * 4) * (t >= 4 ? 1.7 : 1);
        art.poly(ctx, [fx - 2.6, bot - 12, fx + 2.6, bot - 12, fx + Math.sin(time * 7 + i) * 1.2, bot - 12 - fh], i % 2 ? '#ff9a3a' : '#ffd45a');
        if (t >= 4) art.poly(ctx, [fx - 1.2, bot - 12, fx + 1.2, bot - 12, fx, bot - 12 - fh * 0.55], i % 2 ? '#9fe8ff' : '#fff6c8');
      }
    }
    if (t >= 4) {
      // 炉のルーン
      for (let i = 0; i < 3; i++) {
        const a = 0.45 + 0.4 * Math.sin(time * 2 + i * 2.1);
        ctx.fillStyle = `rgba(255,200,90,${a.toFixed(2)})`;
        const rx = IL + 12 + i * 16, ry = bot - 34;
        ctx.fillRect(rx, ry, 1, 5); ctx.fillRect(rx - 1.5, ry + 1.5, 4, 1); ctx.fillRect(rx + 1.5, ry + 3, 1, 2.5);
      }
      lights.push([IL + 28, bot - 18, 110, 0.95 * gl, '#ffb24a']);
    } else lights.push([IL + 28, bot - 14, 80 + t * 6, 0.85 * gl]);
  }
  function bellows(x, bot, t) {
    const k = 0.5 + 0.5 * Math.sin(time * 2.6);
    const y = bot - 18;
    const wood = t >= 4 ? '#3a2a24' : '#7a5230';
    art.poly(ctx, [x, y + 1, x + 14, y + 3, x + 14, y + 4.5, x, y + 3], wood);
    art.poly(ctx, [x + 2, y + 1, x + 13, y + 2.6, x + 13, y - 2 - k * 4, x + 2, y - 0.5], '#5a3a26');
    art.poly(ctx, [x, y - 1, x + 14, y - 3 - k * 5, x + 14, y - 1.5 - k * 5, x, y + 0.5], wood);
    art.poly(ctx, [x + 13, y - 2.5 - k * 5, x + 17, y - 4 - k * 6, x + 17.4, y - 2.8 - k * 6, x + 13.6, y - 1.4 - k * 5], t >= 3 ? BRASS : '#5a3a26');
    art.poly(ctx, [x + 2, bot, x + 4, bot, x + 4, y + 3, x + 2, y + 3], '#4e3322');
    art.poly(ctx, [x + 11, bot, x + 13, bot, x + 13, y + 4, x + 11, y + 4], '#4e3322');
  }
  function toolRack(x, y, t) {
    art.poly(ctx, [x, y, x + 36, y, x + 36, y + 3, x, y + 3], t >= 3 ? BRASS_D : '#5a3a26');
    // やっとこ
    ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 4, y + 22); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 8.5, y + 22); ctx.stroke();
    // 金槌
    [x + 16, x + 27].forEach((hx, i) => {
      art.poly(ctx, [hx - 0.6, y + 3, hx + 0.6, y + 3, hx + 0.6, y + 18 - i * 3, hx - 0.6, y + 18 - i * 3], '#7a5230');
      art.poly(ctx, [hx - 3, y + 18 - i * 3, hx + 3, y + 18 - i * 3, hx + 3, y + 21.5 - i * 3, hx - 3, y + 21.5 - i * 3], t >= 4 ? GOLD : '#6c727a');
    });
  }
  function bucket(x, bot, t) {
    box(x, bot, 16, 12, t >= 4 ? '#4a3428' : '#7a5230', 2);
    if (t >= 3) {
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [x, bot - 3.5, x + 16, bot - 3.5, x + 16, bot - 4.6, x, bot - 4.6], m);
      art.poly(ctx, [x, bot - 8.5, x + 16, bot - 8.5, x + 16, bot - 9.6, x, bot - 9.6], m);
    }
    art.poly(ctx, [x + 1, bot - 12, x + 15, bot - 12, x + 15, bot - 13.4, x + 1, bot - 13.4], '#5aa0c8');
  }
  function ingots(x, bot, t) {
    const cols = t >= 4 ? [GOLD, '#9fe0f0', GOLD] : ['#a8b0b8', '#c89048', '#a8b0b8'];
    [[0, 0], [5, 0], [2.5, 1]].forEach(([dx, r], i) => {
      const y = bot - r * 3;
      art.poly(ctx, [x + dx, y, x + dx + 6, y, x + dx + 5, y - 3, x + dx + 1, y - 3], cols[i]);
      art.poly(ctx, [x + dx + 1, y - 3, x + dx + 5, y - 3, x + dx + 4.6, y - 2.2, x + dx + 1.4, y - 2.2], 'rgba(255,255,255,0.4)');
    });
  }
  function anvil(cx, bot, t, sc) {
    const c = t >= 4 ? '#3a3c50' : t === 3 ? '#5a606a' : '#4a4e56';
    ctx.save();
    ctx.translate(cx, bot);
    ctx.scale(sc, sc);
    if (t === 0) {
      // 切り株の台
      art.poly(ctx, [-6, 0, 6, 0, 5.5, -10, -5.5, -10], '#7a5a3a');
      art.ellipse(ctx, 0, -10, 5.5, 1.2, '#b08a5a');
    } else art.poly(ctx, [-7, 0, 7, 0, 3, -14, -3, -14], G.shade(c, -0.15));
    art.poly(ctx, [-15, -14, 15, -14, 11, -18, -11, -18], c);
    art.poly(ctx, [15, -14, 21, -16, 11, -18], c);
    art.poly(ctx, [-11, -18, 11, -18, 9, -19.5, -9, -19.5], t >= 4 ? GOLD : '#7a808a');
    ctx.restore();
  }
  // 武器の壁：剣の本数はレベルで増える。T1 盾、T2 斧、T3 真鍮の棚と槍、T4 金の棚と宝剣
  function weaponWall(bot, lv, t) {
    const rc = t >= 4 ? GOLD : t === 3 ? BRASS : t === 0 ? '#6a4a30' : '#5a3a26';
    art.poly(ctx, [244, bot - 66, 318, bot - 66, 318, bot - 63, 244, bot - 63], rc);
    if (t >= 3) art.poly(ctx, [244, bot - 66, 318, bot - 66, 318, bot - 65.2, 244, bot - 65.2], G.shade(rc, 0.35));
    const n = Math.min(8, 1 + Math.ceil(lv * 0.5));
    for (let i = 0; i < n; i++) {
      const x = 252 + i * 8.6;
      if (t >= 4 && i % 2 === 0) {
        // 宝剣（金の柄と宝石）
        ctx.save(); ctx.translate(x, bot - 26);
        art.poly(ctx, [-1.4, -0.4, 1.4, -0.4, 1.2, -30, 0, -32.6, -1.2, -30], '#eef4fa');
        art.poly(ctx, [0, -0.4, 1.4, -0.4, 1.2, -30, 0, -32.6], '#c4d0dc');
        art.poly(ctx, [-3.6, -0.6, 3.6, -0.6, 3.6, 1, -3.6, 1], GOLD);
        art.poly(ctx, [-1, 1, 1, 1, 1, 4.6, -1, 4.6], '#7a2a3a');
        art.facet(ctx, 0, 5.6, 1.3, 1.3, 5, '#e04a5a', 0, 0.2);
        ctx.restore();
      } else art.sword(ctx, x, bot - 26, 0, 30);
    }
    if (t >= 1) {
      // 丸盾
      [256, 300].forEach((x, i) => {
        art.facet(ctx, x, bot - 84, 8.5, 8.5, 10, i ? '#3a5aa0' : '#a83a32', 0, 0.12);
        art.facet(ctx, x, bot - 84, 2.6, 2.6, 8, t >= 4 ? GOLD : '#c8ccd2', 0, 0.2);
        if (t >= 3) { ctx.strokeStyle = t >= 4 ? GOLD : BRASS; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, bot - 84, 8.2, 0, TAU); ctx.stroke(); }
      });
    }
    if (t >= 2) {
      // 交差した斧
      [[-1, 0.7], [1, -0.7]].forEach(([d, a]) => {
        ctx.save(); ctx.translate(278, bot - 82); ctx.rotate(a);
        art.poly(ctx, [-0.7, -12, 0.7, -12, 0.7, 12, -0.7, 12], '#7a5230');
        art.poly(ctx, [0.7 * d, -11, 6 * d, -14, 7 * d, -7, 0.7 * d, -6], t >= 4 ? GOLD : '#b8c0c8');
        ctx.restore();
      });
    }
    if (t >= 3) {
      // 槍
      [326 - 4].forEach((x) => {
        art.poly(ctx, [x - 0.7, bot, x + 0.7, bot, x + 0.7, bot - 92, x - 0.7, bot - 92], '#7a5230');
        art.poly(ctx, [x - 2, bot - 92, x + 2, bot - 92, x, bot - 101], t >= 4 ? GOLD : '#d8dee4');
      });
    }
  }
  function armorStand(x, bot, t) {
    art.poly(ctx, [x - 0.8, bot, x + 0.8, bot, x + 0.8, bot - 42, x - 0.8, bot - 42], '#5a3a26');
    art.poly(ctx, [x - 6, bot, x + 6, bot, x + 5, bot - 2, x - 5, bot - 2], '#5a3a26');
    const m = t >= 3 ? '#c8ced6' : '#9aa2ac';
    art.facetPoly(ctx, [x - 7, bot - 34, x + 7, bot - 34, x + 6, bot - 20, x, bot - 16, x - 6, bot - 20], m, 0.18);
    art.facet(ctx, x - 7.5, bot - 33, 3, 2.4, 6, m, 0, 0.2);
    art.facet(ctx, x + 7.5, bot - 33, 3, 2.4, 6, m, 0, 0.2);
    art.facet(ctx, x, bot - 40, 4.4, 5, 7, m, 0, 0.18);
    art.poly(ctx, [x - 3, bot - 40.5, x + 3, bot - 40.5, x + 3, bot - 39.5, x - 3, bot - 39.5], '#2a2a30');
    if (t >= 3) art.poly(ctx, [x - 1, bot - 45, x + 1, bot - 45, x + 2.4, bot - 51, x - 1.4, bot - 49], '#c4453a');
    art.poly(ctx, [x - 7, bot - 30, x + 7, bot - 30, x + 7, bot - 29, x - 7, bot - 29], t >= 3 ? BRASS : '#6a5a4a');
  }
  let appLook = null, appLast = 0;
  function apprentice(bot) {
    if (!appLook) appLook = { cls: 'warrior', role: 'apprentice', seed: 41, skin: '#f0c8a0', hair: '#3a2a1a', style: 'spiky', outfit: '#8a7a5a', apron: '#5a3a26', pants: '#3a2e28', height: 0.94 };
    const c = (time + 0.55) % 1.1;
    ctx.save(); ctx.translate(313, bot); ctx.scale(PS, PS);
    art.person(ctx, appLook, { t: time, state: 'hammer', swing: G.clamp(c / 0.3, 0, 1), item: 'hammer', facing: -1 });
    ctx.restore();
  }
  // MAX の鍛冶場：宙に浮かぶ伝説の剣
  function legendSword(x, y, lights) {
    const by = y + Math.sin(time * 1.6) * 2.2;
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.strokeStyle = `rgba(255,220,120,${(0.35 * pulse).toFixed(2)})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(x, y + 22, 9 + pulse * 2, 2, 0, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.translate(x, by);
    art.poly(ctx, [-1.8, -12, 1.8, -12, 1.6, 16, 0, 19.5, -1.6, 16], '#f4faff');
    art.poly(ctx, [0, -12, 1.8, -12, 1.6, 16, 0, 19.5], '#bcd8ec');
    art.poly(ctx, [-0.4, -10, 0.4, -10, 0.4, 14, -0.4, 14], 'rgba(120,200,255,0.8)');
    art.poly(ctx, [-6, -13.5, 6, -13.5, 7, -11.5, -7, -11.5], GOLD);
    art.poly(ctx, [-7, -11.5, -9, -14.5, -6, -13.5], GOLD);
    art.poly(ctx, [7, -11.5, 9, -14.5, 6, -13.5], GOLD);
    art.poly(ctx, [-1.1, -13.5, 1.1, -13.5, 1.1, -19, -1.1, -19], '#3a3a7a');
    art.facet(ctx, 0, -20.4, 2, 2, 6, GOLD, time, 0.25);
    art.facet(ctx, 0, -12.5, 1.5, 1.5, 6, '#5ae0ff', 0, 0.25);
    ctx.restore();
    lights.push([x, by, 46, 0.7 * pulse, '#9fe0ff']);
  }

  // ---------------------------------------------------------------- 訓練場
  function dummyXs() {
    const t = tierOf('training', G.state.fac.training);
    return [[140], [140, 200], [140, 200, 260], [126, 174, 222, 270], [128, 174, 220, 266]][t];
  }
  ROOMS.training = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'training', t, t >= 4);
      if (t >= 4) {
        // 闘技場の砂
        art.poly(ctx, [IL, bot - 3, IR, bot - 3, IR, bot, IL, bot], '#d8b878');
        for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(150,110,60,0.5)'; ctx.fillRect(IL + G.hash(i * 7) * (IR - IL), bot - 2.6 + G.hash(i * 3) * 2, 0.8, 0.5); }
        art.poly(ctx, [100, bot - 1.2, 294, bot - 1.2, 294, bot - 0.4, 100, bot - 0.4], 'rgba(255,255,255,0.7)');
      } else if (t >= 1) {
        const mc = t === 3 ? '#8a2f34' : t === 2 ? '#3f5a8a' : '#5a7a4a';
        art.poly(ctx, [100, bot - 1, 300, bot - 1, 300, bot + 1, 100, bot + 1], mc);
        if (t >= 2) art.poly(ctx, [100, bot - 1, 300, bot - 1, 300, bot - 0.4, 100, bot - 0.4], t === 3 ? BRASS : '#e8ecf0');
      }
      if (t >= 1 && t < 4) practiceRack(64, bot, t);
      if (t >= 1 && t < 4) target(300, bot - 52, 10, t);
      if (t >= 2 && t < 4) target(320, bot - 86, 6, t);
      if (t >= 2 && t < 4) weights(296, bot, t);
      if (t === 3) {
        // 交差した剣と盾
        art.sword(ctx, 236, top + 34, -0.6, 24);
        art.sword(ctx, 256, top + 34, 0.6, 24);
        art.facetPoly(ctx, [238, top + 10, 254, top + 10, 254, top + 22, 246, top + 30, 238, top + 22], '#3a5aa0', 0.15);
        art.poly(ctx, [245, top + 12, 247, top + 12, 247, top + 27, 245, top + 27], GOLD);
      }
      if (t >= 3) [160, 240].forEach((x) => torchBg(x, bot - 82, t));
      if (t >= 4) {
        statueLooks();
        art.facetPoly(ctx, [64, bot, 90, bot, 89, bot - 16, 65, bot - 16], '#e8e0d0', 0.08);
        art.poly(ctx, [63, bot - 16, 91, bot - 16, 91, bot - 19, 63, bot - 19], GOLD);
        art.poly(ctx, [64, bot - 2, 90, bot - 2, 90, bot, 64, bot], GOLD);
        art.facetPoly(ctx, [300, bot, 326, bot, 325, bot - 16, 301, bot - 16], '#e8e0d0', 0.08);
        art.poly(ctx, [299, bot - 16, 327, bot - 16, 327, bot - 19, 299, bot - 19], GOLD);
        art.poly(ctx, [300, bot - 2, 326, bot - 2, 326, bot, 300, bot], GOLD);
        goldStatue(77, bot - 19, statueL[0], { state: 'cheer', facing: 1, expr: 'happy' }, 1.25);
        goldStatue(313, bot - 19, statueL[1], { state: 'swing', swing: 0.15, armed: true, facing: -1 }, 1.25);
        // 優勝杯の棚
        art.poly(ctx, [184, top + 44, 222, top + 44, 222, top + 47, 184, top + 47], GOLD_D);
        const cx = 203;
        art.poly(ctx, [cx - 7, top + 30, cx + 7, top + 30, cx + 4.6, top + 39, cx - 4.6, top + 39], GOLD);
        art.poly(ctx, [cx - 7, top + 30, cx - 2, top + 30, cx - 3, top + 38, cx - 4.6, top + 39], GOLD_L);
        art.poly(ctx, [cx - 1.2, top + 39, cx + 1.2, top + 39, cx + 1.2, top + 42, cx - 1.2, top + 42], GOLD_D);
        art.poly(ctx, [cx - 4.4, top + 42, cx + 4.4, top + 42, cx + 4.4, top + 44, cx - 4.4, top + 44], GOLD_D);
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx - 7.5, top + 33.5, 2.6, 1.6, 4.7); ctx.arc(cx + 7.5, top + 33.5, 2.6, -1.6, 1.6); ctx.stroke();
        [[176, '#8e2a34'], [230, '#8e2a34']].forEach(([x]) => { /* 旗は fx */ });
      }
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      windowAt(96, bot - 92, 26, 32, f, t);
      if (t >= 4) { banner(150, top + 6, 16, 30, '#8e2a34', 4, 'sword'); banner(240, top + 6, 16, 30, '#8e2a34', 4, 'sword'); }
      const ds = dummyXs();
      ds.forEach((x, i) => dummy(x, bot, dummyWobble[i] || 0, t, i));
      if (t < 4) {
        art.poly(ctx, [190, top + 16, 216, top + 14, 217, top + 34, 191, top + 35], t >= 3 ? '#f4ecd8' : '#efe2c4');
        if (t >= 3) { ctx.strokeStyle = BRASS; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(190, top + 16); ctx.lineTo(216, top + 14); ctx.lineTo(217, top + 34); ctx.lineTo(191, top + 35); ctx.closePath(); ctx.stroke(); }
        ctx.fillStyle = '#7a3a2e';
        ctx.font = G.font(800, 6, 'head');
        ctx.textAlign = 'center';
        ctx.fillText('根性', 204, top + 28);
      }
      if (t >= 2 && t < 4) {
        // 登り綱
        const sw = Math.sin(time * 0.9) * 2;
        ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(236, top); ctx.quadraticCurveTo(236 + sw * 0.5, top + 40, 236 + sw, bot - 30); ctx.stroke();
        art.ellipse(ctx, 236 + sw, bot - 30, 1.6, 1.6, '#a8885a');
      }
      if (t >= 3) [160, 240].forEach((x) => { flame(x, bot - 86, 1.8); lights.push([x, bot - 88, 44, 0.6]); });
      if (t >= 3) instructor(bot, t);
      if (t >= 4) {
        [[96, bot], [292, bot]].forEach(([x, y]) => brazier(x, y, lights));
        twinkles(f, IL + 6, STAIR - 6, top + 6, bot - 40, 7);
      }
    },
  };
  let statueL = null;
  function statueLooks() {
    if (statueL) return;
    statueL = [
      { cls: 'warrior', seed: 51, skin: '#d8b070', hair: '#c09040', style: 'spiky', outfit: '#c8a050', pants: '#b08840' },
      { cls: 'knight', seed: 53, skin: '#d8b070', hair: '#c09040', style: 'short', outfit: '#c8a050', pants: '#b08840', crest: '#c8a050' },
    ];
  }
  function dummy(x, bot, wob, t, i) {
    const r = Math.sin(time * 22) * wob * 0.3;
    ctx.save();
    ctx.translate(x, bot);
    ctx.rotate(r);
    if (t >= 4) art.poly(ctx, [-5, 0, 5, 0, 4, -2.5, -4, -2.5], GOLD_D);
    art.poly(ctx, [-1.2, 0, 1.2, 0, 1.2, -36, -1.2, -36], t >= 3 ? '#5a3a26' : '#6a4630');
    const armored = t >= 4 || (t === 3 && i % 2 === 0);
    const body = armored ? (t >= 4 ? GOLD : '#a8b0ba') : t === 2 && i === 1 ? '#a8784a' : '#d8b860';
    art.facetPoly(ctx, [-6, -12, 6, -12, 7, -26, 5, -30, -5, -30, -7, -26], body, armored ? 0.2 : 0.12);
    art.poly(ctx, [-9, -26, 9, -26, 9, -24, -9, -24], armored ? G.shade(body, -0.15) : '#c8a850');
    art.facet(ctx, 0, -35, 5, 5, 7, armored ? body : '#d8b860', 0, armored ? 0.2 : 0.14);
    if (armored) {
      art.poly(ctx, [-4, -35.5, 4, -35.5, 4, -34, -4, -34], '#2a2a30');
      if (t >= 4) art.poly(ctx, [-1, -40, 1, -40, 2.6, -46, -1.6, -44], '#c4453a');
    } else art.poly(ctx, [-2.5, -36, -1, -36, -1, -34.5, -2.5, -34.5], '#5a3a26');
    ctx.restore();
  }
  function practiceRack(x, bot, t) {
    const wood = t === 3 ? '#5a3a26' : '#7a5230';
    art.poly(ctx, [x, bot - 30, x + 24, bot - 30, x + 24, bot - 27.5, x, bot - 27.5], wood);
    art.poly(ctx, [x, bot - 4, x + 24, bot - 4, x + 24, bot - 2, x, bot - 2], wood);
    art.poly(ctx, [x + 1, bot, x + 3, bot, x + 3, bot - 30, x + 1, bot - 30], G.shade(wood, -0.1));
    art.poly(ctx, [x + 21, bot, x + 23, bot, x + 23, bot - 30, x + 21, bot - 30], G.shade(wood, -0.1));
    for (let i = 0; i < 4; i++) {
      const sx = x + 6 + i * 4.4;
      if (t >= 3) art.sword(ctx, sx, bot - 6, 0, 28);
      else {
        art.poly(ctx, [sx - 0.9, bot - 3, sx + 0.9, bot - 3, sx + 0.9, bot - 36 + (i % 2) * 4, sx - 0.9, bot - 36 + (i % 2) * 4], '#c8a070');
        art.poly(ctx, [sx - 2.4, bot - 9, sx + 2.4, bot - 9, sx + 2.4, bot - 10.4, sx - 2.4, bot - 10.4], '#8a6040');
      }
    }
  }
  function target(x, y, r, t) {
    if (t >= 3) art.facet(ctx, x, y, r + 1.4, r + 1.4, 12, BRASS, 0, 0.12);
    art.facet(ctx, x, y, r, r, 10, '#f0e6d0', 0, 0.08);
    art.facet(ctx, x, y, r * 0.65, r * 0.65, 10, '#d4493a', 0, 0.08);
    art.facet(ctx, x, y, r * 0.3, r * 0.3, 10, '#f0e6d0', 0, 0.08);
    if (t >= 2) {
      art.poly(ctx, [x - 1, y - 2, x + 9, y - 6, x + 9.2, y - 5.4, x - 0.8, y - 1.4], '#7a5230');
      art.poly(ctx, [x + 8.6, y - 6.6, x + 11, y - 7.2, x + 10, y - 5], '#e8e0d0');
    }
  }
  function weights(x, bot, t) {
    const m = t >= 3 ? '#3a3a40' : '#4a4e56';
    art.poly(ctx, [x, bot - 14, x + 28, bot - 14, x + 28, bot - 12.5, x, bot - 12.5], '#5a3a26');
    art.poly(ctx, [x + 1, bot, x + 2.5, bot, x + 2.5, bot - 14, x + 1, bot - 14], '#5a3a26');
    art.poly(ctx, [x + 25.5, bot, x + 27, bot, x + 27, bot - 14, x + 25.5, bot - 14], '#5a3a26');
    [x + 7, x + 20].forEach((dx, i) => {
      art.poly(ctx, [dx - 4, bot - 16, dx + 4, bot - 16, dx + 4, bot - 15, dx - 4, bot - 15], m);
      art.facet(ctx, dx - 4, bot - 15.5, 1.6, 2.6 + i * 0.6, 6, m, 0, 0.2);
      art.facet(ctx, dx + 4, bot - 15.5, 1.6, 2.6 + i * 0.6, 6, m, 0, 0.2);
    });
    art.facet(ctx, x + 14, bot - 3, 3.6, 3, 8, m, 0, 0.18);
    art.poly(ctx, [x + 12.4, bot - 5.6, x + 15.6, bot - 5.6, x + 15, bot - 8, x + 13, bot - 8], m);
  }
  function torchBg(x, y, t) {
    const m = t >= 4 ? GOLD : '#3a3030';
    art.poly(ctx, [x - 2, y + 8, x + 2, y + 8, x + 2, y + 11, x - 2, y + 11], m);
    art.poly(ctx, [x - 0.8, y + 8, x + 0.8, y + 8, x + 1.2, y, x - 1.2, y], '#6a4630');
    art.poly(ctx, [x - 2.4, y, x + 2.4, y, x + 1.8, y - 3, x - 1.8, y - 3], m);
  }
  function brazier(x, bot, lights) {
    art.poly(ctx, [x - 1, bot, x + 1, bot, x + 1, bot - 16, x - 1, bot - 16], GOLD_D);
    art.poly(ctx, [x - 4, bot, x + 4, bot, x + 2, bot - 2, x - 2, bot - 2], GOLD_D);
    art.poly(ctx, [x - 6, bot - 16, x + 6, bot - 16, x + 4, bot - 21, x - 4, bot - 21], GOLD);
    for (let i = 0; i < 3; i++) {
      const fx = x - 3 + i * 3, fh = 7 + Math.sin(time * 9 + i * 2 + x) * 2.5 + G.noise1(time * 4 + i + x) * 3;
      art.poly(ctx, [fx - 2.2, bot - 20, fx + 2.2, bot - 20, fx + Math.sin(time * 6 + i) * 1.2, bot - 20 - fh], i % 2 ? '#ff9a3a' : '#ffd45a');
    }
    lights.push([x, bot - 24, 46, 0.75]);
  }
  let instLook = null;
  function instructor(bot, t) {
    if (!instLook) instLook = { cls: 'knight', role: 'instructor', seed: 61, skin: '#e0a87e', hair: '#6a6a6a', style: 'short', outfit: '#5a6a8a', pants: '#3a3a48', mustache: true, wide: 1.08 };
    const c = time % 5;
    const cheer = c > 4.2;
    const x = t >= 4 ? 290 : 318;
    ctx.save(); ctx.translate(x, bot); ctx.scale(PS, PS);
    art.person(ctx, instLook, { t: time, state: cheer ? 'cheer' : 'stand', facing: -1, expr: cheer ? 'happy' : null, talk: cheer });
    ctx.restore();
  }

  // ---------------------------------------------------------------- 錬金室
  ROOMS.alchemy = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'alchemy', t, true);
      if (t === 0) {
        // 壁の小さな棚
        art.poly(ctx, [266, bot - 58, 312, bot - 58, 312, bot - 56, 266, bot - 56], '#5a3a26');
        for (let b = 0; b < 4; b++) art.poly(ctx, [270 + b * 6, bot - 58, 275 + b * 6, bot - 58, 275 + b * 6, bot - 69 + (b % 2) * 2, 270 + b * 6, bot - 69 + (b % 2) * 2], ['#8a3a4a', '#3a5a8a', '#4a8a5a', '#c8a03a'][b]);
        art.facet(ctx, 302, bot - 62, 3.6, 4, 7, '#8a7a6a', 0, 0.15);
      } else bookshelf(262, bot, 54, 70, t);
      if (t >= 3) bookshelf(62, bot, 24, 84, t);
      if (t >= 1) herbs(top, t);
      if (t >= 2) starChart(152, bot - 100, 30, 24, t);
      if (t >= 2 && t < 4) potionShelf(184, bot - 92, t);
      cauldronBg(bot, t);
      alchTable(bot, t);
      if (t >= 2) alembic(224, bot - 23, t);
      if (t >= 3) cat(300, bot - 73, t);
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      cauldronFx(bot, t, lights);
      // フラスコ（レベルで増える）
      const nf = t >= 2 ? 2 : Math.min(4, 1 + lv);
      ['#ff7a8a', '#7fe0c0', '#ffd25a', '#9a8cff'].slice(0, nf).forEach((c, i) => {
        const x = 198 + i * 11;
        art.poly(ctx, [x, bot - 23, x + 7, bot - 23, x + 5, bot - 30, x + 2, bot - 30], c);
        art.poly(ctx, [x + 2, bot - 30, x + 5, bot - 30, x + 5, bot - 35, x + 2, bot - 35], 'rgba(230,240,255,0.7)');
        if (t >= 3) lights.push([x + 3.5, bot - 27, 14, 0.5, c]);
      });
      if (t <= 1) {
        // ろうそく
        art.poly(ctx, [233, bot - 23, 236, bot - 23, 236, bot - 29, 233, bot - 29], '#f5ead0');
        flame(234.5, bot - 29.5, 1.2);
        lights.push([234.5, bot - 31, 36, 0.5]);
      }
      if (t === 2) { lanternBg(120, top, 8, 2); lanternFx(120, top, 8, lights, 44); }
      if (t >= 3) floatCandles(f, top, t, lights);
      if (t >= 2) {
        // 本棚の上の結晶
        const a = 0.6 + 0.4 * Math.sin(time * 2);
        art.facet(ctx, 270, bot - 78, 2.2, 5, 5, '#9ae8ff', 0.3, 0.3);
        art.facet(ctx, 275, bot - 77, 1.8, 3.6, 5, '#c79bff', 0.6, 0.3);
        lights.push([272, bot - 78, 24, 0.6 * a, '#9ae8ff']);
      }
      if (t >= 3) floatBooks(bot);
      if (t >= 4) {
        philoCircle(212, bot - 66, lights);
        twinkles(f, IL + 6, STAIR - 6, top + 6, bot - 20, 8, '235,215,255');
      }
      if (Math.random() < 0.08 + t * 0.03) sparkle(G.rand(80, 300), bot - G.rand(20, 90), t >= 4 ? '#ffe9a0' : '#d8c8ff');
    },
  };
  function bookshelf(x, bot, w, h, t) {
    const wood = t >= 4 ? '#3a2030' : '#5a3a26';
    box(x, bot, w, h, wood, 3);
    const rows = Math.floor((h - 6) / 17);
    for (let r = 0; r < rows; r++) {
      const y = bot - 4 - r * 17;
      art.poly(ctx, [x + 2, y, x + w - 2, y, x + w - 2, y - 1.5, x + 2, y - 1.5], t >= 4 ? GOLD_D : '#3a2416');
      const nb = Math.floor((w - 4) / 6);
      for (let b = 0; b < nb; b++) {
        const bh = 9 + G.hash(r * 8 + b + x) * 5;
        const bx = x + 3 + b * 6;
        const col = ['#8a3a4a', '#3a5a8a', '#4a8a5a', '#c8a03a', '#6a4a8a'][(r + b + x) % 5];
        art.poly(ctx, [bx, y - 2, bx + 5, y - 2, bx + 5, y - 2 - bh, bx, y - 2 - bh], col);
        if (t >= 3) art.poly(ctx, [bx, y - 4 - bh * 0.5, bx + 5, y - 4 - bh * 0.5, bx + 5, y - 3 - bh * 0.5, bx, y - 3 - bh * 0.5], t >= 4 ? GOLD : '#d8c070');
      }
    }
    if (t >= 4) { ctx.strokeStyle = GOLD; ctx.lineWidth = 0.8; ctx.strokeRect(x + 0.5, bot - h + 0.5, w - 1, h - 1); }
  }
  function herbs(top, t) {
    [[168, 16], [180, 12], [252, 14]].forEach(([x, len], i) => {
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, top + 5); ctx.lineTo(x, top + len); ctx.stroke();
      const c = ['#6a8a4a', '#8a6a3a', '#7a9a5a'][i];
      art.poly(ctx, [x - 1, top + len, x + 1, top + len, x + 4, top + len + 9, x + 1, top + len + 11, x - 1, top + len + 11, x - 4, top + len + 9], c);
      art.poly(ctx, [x - 1.5, top + len - 0.5, x + 1.5, top + len - 0.5, x + 1.5, top + len + 1, x - 1.5, top + len + 1], '#c84a3a');
    });
  }
  function starChart(x, y, w, h, t) {
    art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#1e2448');
    art.poly(ctx, [x - 1.5, y - 1.5, x + w + 1.5, y - 1.5, x + w + 1.5, y, x - 1.5, y], t >= 4 ? GOLD : '#8a6a4a');
    art.poly(ctx, [x - 1.5, y + h, x + w + 1.5, y + h, x + w + 1.5, y + h + 1.5, x - 1.5, y + h + 1.5], t >= 4 ? GOLD : '#8a6a4a');
    ctx.strokeStyle = 'rgba(240,220,150,0.6)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, h * 0.38, 0, TAU);
    const pts = [[0.2, 0.3], [0.38, 0.22], [0.5, 0.42], [0.7, 0.3], [0.8, 0.6], [0.55, 0.72], [0.3, 0.66]];
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * w, y + py * h) : ctx.moveTo(x + px * w, y + py * h)));
    ctx.stroke();
    pts.forEach(([px, py]) => spark4(x + px * w, y + py * h, 1.1, '#fff2b0'));
  }
  function potionShelf(x, y, t) {
    [0, 15].forEach((dy, r) => {
      art.poly(ctx, [x, y + dy + 12, x + 62, y + dy + 12, x + 62, y + dy + 13.6, x, y + dy + 13.6], t >= 3 ? BRASS_D : '#5a3a26');
      for (let i = 0; i < 6; i++) {
        const bx = x + 4 + i * 10, by = y + dy + 12;
        const c = ['#ff7a8a', '#7fe0c0', '#ffd25a', '#9a8cff', '#7ab0ff', '#ff9a5a'][(i + r * 2) % 6];
        art.facet(ctx, bx + 3, by - 3, 3, 3, 6, c, 0, 0.2);
        art.poly(ctx, [bx + 2, by - 5.5, bx + 4, by - 5.5, bx + 4, by - 8.5, bx + 2, by - 8.5], 'rgba(230,240,255,0.7)');
      }
    });
  }
  function cauldronBg(bot, t) {
    const c = t >= 4 ? GOLD_D : t === 3 ? '#3a3448' : '#3a3640';
    if (t === 0) {
      art.facetPoly(ctx, [102, bot - 4, 130, bot - 4, 134, bot - 14, 131, bot - 23, 101, bot - 23, 98, bot - 14], c, 0.12);
      art.poly(ctx, [106, bot, 109, bot, 109, bot - 4, 106, bot - 4], '#2a2630');
      art.poly(ctx, [123, bot, 126, bot, 126, bot - 4, 123, bot - 4], '#2a2630');
      // 薪
      art.poly(ctx, [100, bot, 132, bot, 131, bot - 2.4, 101, bot - 2.4], '#6a4a30');
      return;
    }
    art.facetPoly(ctx, [96, bot - 4, 136, bot - 4, 142, bot - 18, 138, bot - 30, 94, bot - 30, 90, bot - 18], c, t >= 4 ? 0.22 : 0.12);
    if (t >= 3) {
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [92, bot - 30, 140, bot - 30, 140, bot - 32.4, 92, bot - 32.4], m);
      art.poly(ctx, [91, bot - 17, 141, bot - 17, 141, bot - 18.6, 91, bot - 18.6], m);
    }
    if (t >= 4) for (let i = 0; i < 4; i++) spark4(102 + i * 9, bot - 11, 1.4, GOLD_L);
    art.poly(ctx, [100, bot, 104, bot, 104, bot - 4, 100, bot - 4], '#2a2630');
    art.poly(ctx, [128, bot, 132, bot, 132, bot - 4, 128, bot - 4], '#2a2630');
  }
  function cauldronFx(bot, t, lights) {
    const hue = (time * 0.15) % 1;
    const liq = t >= 4 ? G.mix('#ffd86a', '#ff7a6a', G.bump(hue)) : G.mix('#7fe0c0', '#c79bff', G.bump(hue));
    if (t === 0) {
      art.poly(ctx, [102, bot - 23, 130, bot - 23, 129, bot - 25.5, 103, bot - 25.5], liq);
      lights.push([116, bot - 26, 40, 0.45]);
      if (Math.random() < 0.1) addPart({ type: 'bubble', x: G.rand(105, 127), y: bot - 25, vx: 0, vy: -10, g: 0, life: 0, max: G.rand(0.6, 1.1), col: liq, size: G.rand(0.8, 1.8) });
      return;
    }
    art.poly(ctx, [96, bot - 30, 136, bot - 30, 134, bot - 33, 98, bot - 33], liq);
    lights.push([116, bot - 34, 60 + t * 6, 0.6, t >= 3 ? liq : null]);
    if (Math.random() < 0.15 + t * 0.04) addPart({ type: 'bubble', x: G.rand(100, 132), y: bot - 33, vx: 0, vy: -10, g: 0, life: 0, max: G.rand(0.6, 1.2), col: liq, size: G.rand(1, 2.4) });
    if (t >= 3) {
      // 床の魔法陣
      ctx.strokeStyle = G.rgba(t >= 4 ? '#ffd86a' : '#c79bff', 0.45 + 0.2 * Math.sin(time * 2));
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(116, bot - 1, 34, 2.2, 0, 0, TAU); ctx.stroke();
    }
  }
  function alchTable(bot, t) {
    const top = t >= 4 ? '#e8e0d4' : t === 0 ? '#7a5a3a' : '#6a4630';
    const leg = t >= 4 ? GOLD_D : '#4e3322';
    box(190, bot - 20, 50, 3, top, 2);
    if (t >= 4) art.poly(ctx, [190, bot - 20, 240, bot - 20, 240, bot - 19, 190, bot - 19], GOLD);
    art.poly(ctx, [194, bot, 197, bot, 197, bot - 20, 194, bot - 20], leg);
    art.poly(ctx, [233, bot, 236, bot, 236, bot - 20, 233, bot - 20], leg);
  }
  function alembic(x, y, t) {
    const m = t >= 4 ? GOLD : BRASS;
    art.poly(ctx, [x - 1, y, x + 1, y, x + 1, y - 4, x - 1, y - 4], m);
    art.facet(ctx, x, y - 8, 4.4, 4.4, 8, '#cfe6f4', 0, 0.15);
    art.poly(ctx, [x - 2.6, y - 9.6, x - 1, y - 11.4, x - 0.8, y - 9], 'rgba(255,255,255,0.85)');
    art.poly(ctx, [x - 3.4, y - 6, x + 3.4, y - 6, x + 3, y - 4.6, x - 3, y - 4.6], '#ff9ad0');
    ctx.strokeStyle = 'rgba(210,235,255,0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 2, y - 18, x + 10, y - 14); ctx.lineTo(x + 12, y - 6); ctx.stroke();
    art.poly(ctx, [x + 10, y, x + 15, y, x + 14, y - 5, x + 11, y - 5], '#9ae0c0');
  }
  function cat(x, y, t) {
    const c = t >= 4 ? '#2a2430' : '#3a3438';
    art.facet(ctx, x, y - 4, 4.6, 4, 7, c, 0.3, 0.1);
    art.facet(ctx, x + 3.4, y - 9, 3, 2.8, 7, c, 0, 0.1);
    art.poly(ctx, [x + 1.4, y - 10.6, x + 2, y - 13.4, x + 3.2, y - 11.2], c);
    art.poly(ctx, [x + 4, y - 11.2, x + 5.2, y - 13.4, x + 5.6, y - 10.4], c);
    art.ellipse(ctx, x + 4.6, y - 9.2, 0.6, 0.6, '#ffe07a');
    ctx.strokeStyle = c; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 2); ctx.quadraticCurveTo(x - 9, y - 4, x - 7, y - 10); ctx.stroke();
    if (t >= 4) art.poly(ctx, [x + 1.6, y - 7.4, x + 5, y - 7.4, x + 5, y - 6.6, x + 1.6, y - 6.6], GOLD);
  }
  function floatCandles(f, top, t, lights) {
    const n = t >= 4 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const x = 150 + i * (t >= 4 ? 34 : 46) + (i % 2) * 6;
      if (t >= 4 && x > 186 && x < 240) continue;
      const y = top + 18 + (i % 2) * 7 + Math.sin(time * 1.3 + i * 1.7) * 2;
      art.poly(ctx, [x - 1, y, x + 1, y, x + 1, y - 6, x - 1, y - 6], '#f5ead0');
      flame(x, y - 6.4, 1.1);
      lights.push([x, y - 7, 28, 0.5]);
    }
  }
  function floatBooks(bot) {
    for (let i = 0; i < 2; i++) {
      const x = 240 + i * 34, y = bot - 86 + Math.sin(time * 1.5 + i * 2) * 3;
      const a = Math.sin(time * 4 + i) * 0.4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.15 + i * 0.3);
      art.poly(ctx, [-6, 0, 0, 1.2, 6, 0, 6, -1.2 - a, 0, 0, -6, -1.2 - a], '#f4ecd8');
      art.poly(ctx, [-6.4, 0.4, 0, 1.6, 6.4, 0.4, 6.4, 1.2, 0, 2.4, -6.4, 1.2], i ? '#3a5a8a' : '#8a3a4a');
      ctx.restore();
    }
  }
  // MAX の錬金室：賢者の石の魔法陣
  function philoCircle(cx, cy, lights) {
    const R = 24, rot = time * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = 0.55 + 0.2 * Math.sin(time * 1.7);
    ctx.strokeStyle = `rgba(255,190,110,${a.toFixed(2)})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.moveTo(cx + R * 0.8, cy);
    ctx.arc(cx, cy, R * 0.8, 0, TAU);
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i <= 3; i++) {
        const an = rot + (k * Math.PI) / 3 + (i * TAU) / 3;
        const px = cx + Math.cos(an) * R * 0.8, py = cy + Math.sin(an) * R * 0.8;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const an = -rot * 1.6 + (i * TAU) / 16;
      ctx.moveTo(cx + Math.cos(an) * R * 0.84, cy + Math.sin(an) * R * 0.84);
      ctx.lineTo(cx + Math.cos(an) * R * (i % 2 ? 0.92 : 0.97), cy + Math.sin(an) * R * (i % 2 ? 0.92 : 0.97));
    }
    ctx.moveTo(cx + R * 0.36, cy);
    ctx.arc(cx, cy, R * 0.36, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // 周りを回る小さな宝石
    for (let i = 0; i < 4; i++) {
      const an = time * 0.9 + (i * TAU) / 4;
      art.facet(ctx, cx + Math.cos(an) * R * 1.12, cy + Math.sin(an) * R * 0.34 - 2, 1.4, 1.8, 5, ['#7fe0c0', '#9a8cff', '#ffd25a', '#7ab0ff'][i], an, 0.25);
    }
    const bob = Math.sin(time * 1.8) * 1.8;
    art.facet(ctx, cx, cy + bob, 4.6, 5.6, 6, '#d0283a', time * 0.8, 0.32);
    art.poly(ctx, [cx - 1.6, cy + bob - 3, cx, cy + bob - 4.6, cx + 0.4, cy + bob - 2], 'rgba(255,255,255,0.7)');
    lights.push([cx, cy, 64, 0.85, '#ff7a5a']);
  }

  // ---------------------------------------------------------------- 見張り塔
  ROOMS.tower = {
    bg(f, lv, t) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      shell(f, 'tower', t, true);
      mapTable(196, bot, t);
      if (t >= 2) starChart(t >= 4 ? 228 : 292, bot - 98, 30, 24, t);
      if (t >= 1) bunting(188, t >= 4 ? 296 : 326, top + 6, Math.min(9, 3 + lv), t);
      if (t === 3) chandelierBg(212, top, 10, 20, 3, 3);
      if (t >= 4) grandBg(200, top, 18, 24);
      if (t >= 2) chest(238, bot, t);
      telescope(t, bot);
      if (t >= 3) {
        const ax = t >= 4 ? 84 : 306;
        art.facetPoly(ctx, [ax - 6, bot, ax + 6, bot, ax + 4, bot - 4, ax + 1.6, bot - 20, ax - 1.6, bot - 20, ax - 4, bot - 4], t >= 4 ? MARBLE : '#7a746a', 0.12);
        art.poly(ctx, [ax - 4, bot - 20, ax + 4, bot - 20, ax + 4, bot - 22, ax - 4, bot - 22], t >= 4 ? GOLD : BRASS);
      }
      if (t >= 4) {
        // 結晶の制御台と、屋根の灯台へ光を送る管
        art.facetPoly(ctx, [296, bot, 316, bot, 314, bot - 6, 311, bot - 18, 301, bot - 18, 298, bot - 6], MARBLE, 0.1);
        art.poly(ctx, [298, bot - 18, 314, bot - 18, 315, bot - 20.4, 297, bot - 20.4], GOLD);
        art.poly(ctx, [303, top, 309, top, 309, top + 16, 303, top + 16], GOLD_D);
        art.poly(ctx, [301, top + 16, 311, top + 16, 309, top + 20, 303, top + 20], GOLD);
      }
    },
    fx(st, f, lv, t, lights) {
      const bot = floorY(f), top = floorY(f + 1) + 9;
      windowAt(110, bot - 96, 70, 56, f, t);
      if (t >= 1 && t <= 2) { lanternBg(240, top, 6, t); lanternFx(240, top, 6, lights, 44); }
      if (t === 3) chandelierFx(212, top, 10, 20, 3, 3, lights);
      if (t >= 4) grandFx(200, top, 18, 24, lights);
      if (t >= 3) armillary(t >= 4 ? 84 : 306, bot - 34, t);
      if (t >= 4) {
        const by = bot - 34 + Math.sin(time * 1.5) * 2;
        const p = 0.7 + 0.3 * Math.sin(time * 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, top, 0, by);
        g.addColorStop(0, 'rgba(150,230,255,0)');
        g.addColorStop(1, `rgba(150,230,255,${(0.35 * p).toFixed(2)})`);
        ctx.fillStyle = g;
        ctx.fillRect(304, top + 20, 4, by - top - 26);
        ctx.restore();
        art.facet(ctx, 306, by, 5, 8, 6, '#9ae8ff', time * 0.6, 0.35);
        art.poly(ctx, [304.6, by - 5, 306, by - 7.4, 306.6, by - 3], 'rgba(255,255,255,0.8)');
        lights.push([306, by, 56, 0.8 * p, '#8ae0ff']);
        twinkles(f, IL + 6, STAIR - 6, top + 6, bot - 20, 8, '210,240,255');
      }
    },
  };
  function bunting(x0, x1, y, n, t) {
    ctx.strokeStyle = '#5a3a26';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 10, x1, y); ctx.stroke();
    const cols = t >= 4 ? ['#8e2a34', GOLD, '#26345e'] : ['#e05a4a', '#f0c94a', '#5ac08a', '#4a8ae0', '#c27cff'];
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const px = G.lerp(x0, x1, k), py = y + Math.sin(k * Math.PI) * 7.5;
      art.poly(ctx, [px - 3.4, py, px + 3.4, py, px, py + 7], cols[i % cols.length]);
    }
  }
  function mapTable(x, bot, t) {
    const top = t >= 4 ? '#e8e0d4' : t === 0 ? '#7a5a3a' : '#6a4630';
    box(x, bot - 22, 40, 3, top, 2);
    if (t >= 2) art.poly(ctx, [x, bot - 22, x + 40, bot - 22, x + 40, bot - 21, x, bot - 21], t >= 4 ? GOLD : BRASS);
    art.poly(ctx, [x + 2, bot - 25, x + 38, bot - 25, x + 36, bot - 27, x + 4, bot - 27], '#e8d8b0');
    if (t >= 1) {
      // 地図の線と地球儀
      ctx.strokeStyle = 'rgba(120,80,40,0.6)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(x + 6, bot - 26); ctx.lineTo(x + 16, bot - 26.4); ctx.lineTo(x + 22, bot - 25.6); ctx.stroke();
      art.poly(ctx, [x + 31, bot - 27, x + 33, bot - 27, x + 33, bot - 29, x + 31, bot - 29], t >= 3 ? BRASS : '#6a4630');
      art.facet(ctx, x + 32, bot - 33, 4, 4, 8, '#4a8ac0', 0.4, 0.2);
      art.poly(ctx, [x + 30, bot - 35, x + 33, bot - 36, x + 34, bot - 32, x + 31, bot - 31], '#6aa05a');
    }
    const leg = t >= 4 ? GOLD_D : '#4e3322';
    art.poly(ctx, [x + 4, bot, x + 7, bot, x + 7, bot - 22, x + 4, bot - 22], leg);
    art.poly(ctx, [x + 33, bot, x + 36, bot, x + 36, bot - 22, x + 33, bot - 22], leg);
  }
  function chest(x, bot, t) {
    const wood = t >= 4 ? '#5a2a3a' : '#7a5230';
    const m = t >= 4 ? GOLD : t >= 3 ? BRASS : '#5a5a60';
    box(x, bot, 20, 11, wood, 2);
    art.poly(ctx, [x, bot - 11, x + 20, bot - 11, x + 19, bot - 15, x + 1, bot - 15], G.shade(wood, 0.1));
    art.poly(ctx, [x + 4, bot, x + 6, bot, x + 6, bot - 15, x + 4, bot - 15], m);
    art.poly(ctx, [x + 14, bot, x + 16, bot, x + 16, bot - 15, x + 14, bot - 15], m);
    art.poly(ctx, [x + 9, bot - 9, x + 11, bot - 9, x + 11, bot - 12, x + 9, bot - 12], m);
  }
  function telescope(t, bot) {
    if (t <= 1) {
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(262, bot); ctx.lineTo(272, bot - 28); ctx.lineTo(282, bot); ctx.moveTo(272, bot - 28); ctx.lineTo(272, bot); ctx.stroke();
      ctx.save(); ctx.translate(272, bot - 30); ctx.rotate(-0.5);
      art.poly(ctx, [-14, -2, 14, -3.4, 14, 3.4, -14, 2], '#c8a03a');
      art.poly(ctx, [-14, -2, 14, -3.4, 14, 0, -14, 0], '#e0bc5a');
      ctx.restore();
      return;
    }
    // 大きな真鍮（T4 は金）の望遠鏡
    const m = t >= 4 ? GOLD : BRASS;
    ctx.strokeStyle = t >= 4 ? GOLD_D : '#4a3424'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(260, bot); ctx.lineTo(274, bot - 32); ctx.lineTo(288, bot); ctx.moveTo(274, bot - 32); ctx.lineTo(276, bot); ctx.stroke();
    ctx.save(); ctx.translate(274, bot - 35); ctx.rotate(-0.55);
    art.poly(ctx, [-20, -2.6, 8, -3.6, 8, 3.6, -20, 2.6], m);
    art.poly(ctx, [8, -4.6, 24, -5.4, 24, 5.4, 8, 4.6], G.shade(m, -0.08));
    art.poly(ctx, [-20, -2.6, 24, -5.4, 24, -1, -20, -0.6], G.shade(m, 0.25));
    art.poly(ctx, [23, -5.6, 25.4, -5.6, 25.4, 5.6, 23, 5.6], t >= 4 ? '#7a2a3a' : '#5a3a26');
    art.poly(ctx, [-2, -4, 0, -4, 0, 4, -2, 4], G.shade(m, -0.25));
    ctx.restore();
  }
  function armillary(x, y, t) {
    const m = t >= 4 ? GOLD : BRASS;
    const a = time * 0.6;
    ctx.strokeStyle = m;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 10, 0, 0, TAU);
    ctx.moveTo(x + 10 * Math.abs(Math.cos(a)), y);
    ctx.ellipse(x, y, 10 * Math.abs(Math.cos(a)), 10, 0, 0, TAU);
    ctx.moveTo(x + 10, y);
    ctx.ellipse(x, y, 10, 3.6, 0.4, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x - 2.4, y + 11); ctx.lineTo(x + 2.4, y - 11); ctx.stroke();
    art.facet(ctx, x, y, 2.6, 2.6, 7, t >= 4 ? '#9ae8ff' : '#e0bc5a', a, 0.25);
    art.poly(ctx, [x - 1.5, y + 10, x + 1.5, y + 10, x + 1, y + 12, x - 1, y + 12], m);
  }

  function flame(x, y, r) {
    const h = r * 2.6 + Math.sin(time * 12 + x) * r * 0.5;
    art.poly(ctx, [x - r, y, x + r, y, x, y - h], '#ffcf5a');
    art.poly(ctx, [x - r * 0.5, y, x + r * 0.5, y, x, y - h * 0.55], '#fff4c0');
  }

  function drawBoard(st, bot, t = 1) {
    const x = 112, y = bot - 76, w = 56, h = 40;
    const fr = t >= 4 ? GOLD : t === 3 ? BRASS : t === 0 ? '#4e3424' : '#5a3a26';
    art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 3, y + h + 3, x - 3, y + h + 3], fr);
    if (t >= 3) {
      art.poly(ctx, [x - 3, y - 3, x + w + 3, y - 3, x + w + 2, y - 2, x - 2, y - 2], t >= 4 ? GOLD_L : '#e0c27a');
      [[x - 3, y - 3], [x + w + 3, y - 3], [x - 3, y + h + 3], [x + w + 3, y + h + 3]].forEach(([cx, cy]) => art.facet(ctx, cx, cy, 2.2, 2.2, 6, t >= 4 ? GOLD_L : BRASS, 0, 0.25));
    }
    art.poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], t >= 4 ? '#7a2a30' : t === 3 ? '#3e5a48' : t === 0 ? '#9a7a54' : '#b08a5e');
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
    art.poly(ctx, [x + 12, y - 12, x + w - 12, y - 12, x + w - 12, y - 4, x + 12, y - 4], t >= 4 ? GOLD : '#e8d8b0');
    if (t >= 3) { ctx.strokeStyle = t >= 4 ? GOLD_D : BRASS; ctx.lineWidth = 0.6; ctx.strokeRect(x + 12, y - 12, w - 24, 8); }
    ctx.fillStyle = t >= 4 ? '#5a2a10' : '#5a3a26';
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

  let beaconAt = null; // 見張り塔 MAX の灯台（drawLights で光の筋を描く）
  function drawRoof(st, nv) {
    const y = floorY(nv);
    const peakY = y - 70;
    const cx = (WL + WR) / 2;
    // 瓦：豪華になるほど鮮やかに
    const tileA = et >= 4 ? '#b8443a' : '#a8483a', tileB = et >= 4 ? '#963228' : '#8a3a2e';
    art.poly(ctx, [WL - 18, y + 4, WR + 18, y + 4, cx, peakY], tileB);
    for (let i = 0; i < 6; i++) {
      const k0 = i / 6, k1 = (i + 1) / 6;
      const yy0 = G.lerp(y + 4, peakY, k0), yy1 = G.lerp(y + 4, peakY, k1);
      const xl0 = G.lerp(WL - 18, cx, k0), xr0 = G.lerp(WR + 18, cx, k0);
      const xl1 = G.lerp(WL - 18, cx, k1), xr1 = G.lerp(WR + 18, cx, k1);
      art.poly(ctx, [xl0, yy0, (xl0 + xr0) / 2, yy0, (xl1 + xr1) / 2, yy1, xl1, yy1], G.shade(tileA, i % 2 ? 0.04 : -0.02));
      art.poly(ctx, [(xl0 + xr0) / 2, yy0, xr0, yy0, xr1, yy1, (xl1 + xr1) / 2, yy1], G.shade(tileB, i % 2 ? -0.04 : -0.1));
      if (et >= 2) {
        // 瓦の継ぎ目
        ctx.fillStyle = 'rgba(60,20,14,0.25)';
        ctx.fillRect(xl0, yy0 - 0.6, xr0 - xl0, 0.6);
      }
    }
    if (et >= 3) {
      // 軒の金（真鍮）の縁取り
      ctx.strokeStyle = et >= 4 ? GOLD : BRASS;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(WL - 18, y + 3.4); ctx.lineTo(cx, peakY - 0.6); ctx.lineTo(WR + 18, y + 3.4); ctx.stroke();
    }
    art.poly(ctx, [WL - 20, y + 4, WR + 20, y + 4, WR + 20, y + 8, WL - 20, y + 8], et >= 4 ? GOLD_D : '#5e3f2a');
    if (et >= 2) [WL - 19, WR + 19].forEach((x) => art.facet(ctx, x, y + 3, 2.4, 2.4, 6, et >= 3 ? GOLD : '#c8c0b2', 0, 0.25));
    // 煙突
    art.poly(ctx, [314, y - 24, 330, y - 24, 330, y - 64, 314, y - 64], et >= 2 ? '#8a7a6e' : '#8a5040');
    art.poly(ctx, [312, y - 64, 332, y - 64, 332, y - 69, 312, y - 69], et >= 4 ? GOLD_D : et >= 2 ? '#6a5e54' : '#6a3a30');
    // 屋根窓
    art.poly(ctx, [196, y - 10, 248, y - 10, 222, y - 40], et >= 4 ? '#7a2a22' : '#6a2e24');
    art.poly(ctx, [210, y - 10, 234, y - 10, 234, y - 26, 222, y - 33, 210, y - 26], night > 0.4 ? '#ffcf7a' : '#9fc8e0');
    ctx.fillStyle = et >= 3 ? (et >= 4 ? GOLD : BRASS) : '#4e3322';
    ctx.fillRect(221, y - 32, 2, 22);
    if (et >= 2) {
      ctx.strokeStyle = et >= 3 ? (et >= 4 ? GOLD : BRASS) : '#e8e0d0';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(209, y - 10); ctx.lineTo(209, y - 26.4); ctx.lineTo(222, y - 34.2); ctx.lineTo(235, y - 26.4); ctx.lineTo(235, y - 10); ctx.stroke();
    }
    if (et >= 4) {
      // 破風のギルドの紋章ときらめき
      crest(170, y - 20, 0.42);
      crest(274, y - 20, 0.42);
      twinkles(99, WL, WR, peakY + 10, y, 6);
    }
    let fy = peakY;
    const fx = cx;
    beaconAt = null;
    if (st.fac.tower > 0 && tierOf('tower', st.fac.tower) >= 4) {
      // 見張り塔 MAX：屋根の上の水晶の灯台
      art.facetPoly(ctx, [fx - 9, peakY + 7, fx + 9, peakY + 7, fx + 7, peakY - 4, fx - 7, peakY - 4], '#ece6da', 0.1);
      art.poly(ctx, [fx - 8, peakY - 4, fx + 8, peakY - 4, fx + 8, peakY - 6, fx - 8, peakY - 6], GOLD);
      art.poly(ctx, [fx - 6, peakY - 6, fx + 6, peakY - 6, fx + 6, peakY - 19, fx - 6, peakY - 19], 'rgba(200,235,255,0.35)');
      [fx - 6, fx - 0.6, fx + 4.8].forEach((x) => art.poly(ctx, [x, peakY - 6, x + 1.2, peakY - 6, x + 1.2, peakY - 19, x, peakY - 19], GOLD_D));
      const by = peakY - 12.5 + Math.sin(time * 2) * 0.8;
      art.facet(ctx, fx, by, 3.2, 5, 6, '#a8f0ff', time * 1.5, 0.35);
      art.poly(ctx, [fx - 8, peakY - 19, fx + 8, peakY - 19, fx + 4, peakY - 25, fx - 4, peakY - 25], GOLD);
      art.poly(ctx, [fx - 8, peakY - 19, fx, peakY - 19, fx, peakY - 25, fx - 4, peakY - 25], GOLD_L);
      beaconAt = [fx, by];
      fy = peakY - 25;
    }
    // 旗
    art.poly(ctx, [fx - 1, fy, fx + 1, fy, fx + 1, fy - 30, fx - 1, fy - 30], et >= 3 ? GOLD_D : '#4e3322');
    if (et >= 3) art.facet(ctx, fx, fy - 31, 1.6, 1.6, 6, GOLD, 0, 0.25);
    const flagCol = st.rank >= 9 ? '#f0c94a' : '#3f7a5e';
    const pts = [fx + 1, fy - 30];
    for (let i = 0; i <= 6; i++) pts.push(fx + 1 + i * 4, fy - 30 + Math.sin(time * 4 - i * 0.8) * 1.6 * (i / 6));
    for (let i = 6; i >= 0; i--) pts.push(fx + 1 + i * 4, fy - 18 + Math.sin(time * 4 - i * 0.8) * 1.6 * (i / 6));
    art.poly(ctx, pts, flagCol);
    art.star(ctx, fx + 10, fy - 24 + Math.sin(time * 4 - 2) * 0.6, 2.6, st.rank >= 9 ? '#fff6c0' : '#f0c94a');
    if (et >= 3) {
      // 屋根の両端に小旗
      [[WL - 6, -1], [WR + 6, 1]].forEach(([x, d]) => {
        const py = y - 4;
        art.poly(ctx, [x - 0.6, py, x + 0.6, py, x + 0.6, py - 22, x - 0.6, py - 22], GOLD_D);
        const w = Math.sin(time * 4 + x) * 1.2;
        art.poly(ctx, [x, py - 22, x + d * 12, py - 19 + w, x, py - 16], d < 0 ? '#3f7a5e' : '#8e2a34');
      });
    }
  }

  // 灯台の光：屋根の上から空を横切ってゆっくり回る
  function drawBeacon(n) {
    if (!beaconAt) return;
    const [bx, by] = beaconAt;
    const a = time * 0.8;
    const c = Math.cos(a), k = Math.abs(c), dir = c >= 0 ? 1 : -1;
    const L = 760;
    const inten = (0.16 + n * 0.42) * (0.25 + 0.75 * k);
    const spread = 10 + (1 - k) * 46;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(bx, by, bx + dir * L, by);
    g.addColorStop(0, `rgba(190,240,255,${inten.toFixed(3)})`);
    g.addColorStop(0.35, `rgba(190,240,255,${(inten * 0.45).toFixed(3)})`);
    g.addColorStop(1, 'rgba(190,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2.4);
    ctx.lineTo(bx + dir * L, by - spread - 18);
    ctx.lineTo(bx + dir * L, by + spread);
    ctx.lineTo(bx, by + 2.4);
    ctx.closePath();
    ctx.fill();
    // こちらを向いた瞬間にきらっと
    const face = Math.sin(a) > 0 ? Math.pow(1 - k, 3) : 0;
    const r = 26 + face * 40;
    const hg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    hg.addColorStop(0, `rgba(210,250,255,${(0.5 + face * 0.5).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(210,250,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawSign(st) {
    // 扉の上の看板（ギルド名と星）
    const x = WL + 14, y = -58;
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x + 6, y - 8); ctx.lineTo(x + 6, y); ctx.moveTo(x + 40, y - 8); ctx.lineTo(x + 40, y); ctx.stroke();
  }

  function drawLights(st, n) {
    const lights = lightGlowList();
    SC._debug.nl = lights.length;
    if (SC._debug.skiplights) lights.length = 0;
    const k = 0.18 + n * 0.75;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const vt = camTop - 80, vb = camTop + cssH / s + 80;
    lights.forEach(([x, y, r, a, col]) => {
      if (y + r < vt || y - r > vb) return;
      if (!col && a * k < 0.06) return; // 昼間のほとんど見えない灯りは省く
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col ? G.rgba(col, 0.5 * a * (0.5 + k)) : `rgba(255,170,80,${0.32 * a * k})`);
      g.addColorStop(1, col ? G.rgba(col, 0) : 'rgba(255,170,80,0)');
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
    drawBeacon(n);
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
    const ht = tierOf('hall', st.fac.hall);
    reception(b0, ht);
    if (st.fac.tavern > 0) {
      const b2 = floorY(2);
      const tt = tierOf('tavern', st.fac.tavern);
      const seats = D.seats(st.fac.tavern);
      TABLES.forEach((tx, i) => {
        if (seats <= i * 2) return;
        [-14, 14].forEach((d, j) => { if (seats > i * 2 + j) chair(tx + d, b2, d < 0 ? -1 : 1, tt); });
        table(tx, b2, tt);
      });
      barCounter(b2, tt);
      for (let i = 6; i < Math.min(9, seats); i++) stool(seatPos(i).x, b2, tt);
      if (tt >= 4) {
        // 金の杯
        [290, 308].forEach((x) => {
          art.poly(ctx, [x - 2, b2 - 30, x + 2, b2 - 30, x + 1, b2 - 27, x - 1, b2 - 27], GOLD);
          art.poly(ctx, [x - 0.4, b2 - 27, x + 0.4, b2 - 27, x + 0.4, b2 - 25.4, x - 0.4, b2 - 25.4], GOLD_D);
          art.poly(ctx, [x - 1.6, b2 - 25.4, x + 1.6, b2 - 25.4, x + 1.6, b2 - 24.6, x - 1.6, b2 - 24.6], GOLD_D);
        });
      } else {
        art.mug(ctx, 290, b2 - 25.5);
        art.mug(ctx, 308, b2 - 25.5);
      }
    }
  }
  // 受付カウンター：古い机 → 磨いた木と真鍮 → MAX は大理石と金の大きな受付台
  function reception(b0, t) {
    const CH = 19, x0 = 214, x1 = 284;
    const wood = ['#6e4a2e', '#7a5230', '#8a5a34', '#5e3420', '#f2ece0'][t];
    box(x0, b0, x1 - x0, CH, wood, 3);
    if (t === 4) {
      // 大理石の天板・金の縁・紋章・柱
      art.poly(ctx, [x0 - 3, b0 - CH, x1 + 3, b0 - CH, x1 + 3, b0 - CH + 3, x0 - 3, b0 - CH + 3], GOLD);
      art.poly(ctx, [x0 - 3, b0 - CH, x1 + 3, b0 - CH, x1 + 2, b0 - CH - 1.4, x0 - 2, b0 - CH - 1.4], GOLD_L);
      [x0 + 1, x0 + 32, x1 - 7].forEach((px) => {
        art.poly(ctx, [px, b0 - CH + 3, px + 6, b0 - CH + 3, px + 6, b0, px, b0], GOLD);
        art.poly(ctx, [px, b0 - CH + 3, px + 2, b0 - CH + 3, px + 2, b0, px, b0], GOLD_L);
      });
      [[x0 + 9, x0 + 30], [x0 + 40, x1 - 9]].forEach(([a, b]) => {
        art.poly(ctx, [a, b0 - CH + 6, b, b0 - CH + 6, b, b0 - 4, a, b0 - 4], '#8e2a34');
        ctx.strokeStyle = GOLD; ctx.lineWidth = 0.6; ctx.strokeRect(a + 1.2, b0 - CH + 7.2, b - a - 2.4, CH - 12.4);
      });
      crest(x0 + 35, b0 - 10, 0.36);
      art.poly(ctx, [x0 - 2, b0 - 1.6, x1 + 2, b0 - 1.6, x1 + 2, b0, x0 - 2, b0], GOLD_D);
    } else {
      art.poly(ctx, [x0, b0 - CH, x1, b0 - CH, x1, b0 - CH + 2, x0, b0 - CH + 2], t >= 3 ? BRASS : t === 2 ? '#c49a50' : '#5e3f2a');
      for (let i = 0; i < 3; i++) {
        const px = 222 + i * 22;
        art.poly(ctx, [px, b0 - CH + 5, px + 14, b0 - CH + 5, px + 14, b0 - 5, px, b0 - 5], G.shade(wood, -0.12));
        if (t >= 2) art.poly(ctx, [px, b0 - CH + 5, px + 14, b0 - CH + 5, px + 14, b0 - CH + 6, px, b0 - CH + 6], G.shade(wood, 0.2));
        if (t === 3) { ctx.strokeStyle = BRASS; ctx.lineWidth = 0.5; ctx.strokeRect(px + 1.5, b0 - CH + 6.5, 11, CH - 13); }
      }
      if (t === 0) {
        ctx.strokeStyle = 'rgba(30,18,10,0.5)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(240, b0 - CH + 3); ctx.lineTo(244, b0 - 10); ctx.lineTo(241, b0 - 4); ctx.stroke();
      }
    }
    // 帳簿と羽ペン・ろうそく
    art.poly(ctx, [256, b0 - CH - 3.5, 270, b0 - CH - 3.5, 271, b0 - CH - 1, 255, b0 - CH - 1], '#efe2c4');
    ctx.strokeStyle = '#f5f0e8'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(268, b0 - CH - 3); ctx.lineTo(274, b0 - CH - 12); ctx.stroke();
    if (t >= 2) {
      // 呼び鈴
      art.poly(ctx, [x0 + 6, b0 - CH - 0.6, x0 + 12, b0 - CH - 0.6, x0 + 11, b0 - CH - 2, x0 + 7, b0 - CH - 2], t >= 4 ? GOLD_D : BRASS_D);
      art.facet(ctx, x0 + 9, b0 - CH - 3.4, 2.6, 2, 7, t >= 4 ? GOLD : BRASS, 3.6, 0.3);
    }
    if (t >= 3) {
      // 燭台
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [275, b0 - CH - 1, 281, b0 - CH - 1, 279, b0 - CH - 2.5, 277, b0 - CH - 2.5], m);
      art.poly(ctx, [277.5, b0 - CH - 2.5, 278.5, b0 - CH - 2.5, 278.5, b0 - CH - 6, 277.5, b0 - CH - 6], m);
      art.poly(ctx, [276, b0 - CH - 6, 280, b0 - CH - 6, 279.4, b0 - CH - 7, 276.6, b0 - CH - 7], m);
      art.poly(ctx, [277, b0 - CH - 7, 279, b0 - CH - 7, 279, b0 - CH - 11, 277, b0 - CH - 11], '#f5ead0');
      flame(278, b0 - CH - 11.5, 1.2);
      lightGlowList().push([278, b0 - CH - 13, 40, 0.55]);
    } else {
      art.poly(ctx, [276, b0 - CH - 3, 279, b0 - CH - 3, 279, b0 - CH - 9, 276, b0 - CH - 9], '#f5ead0');
      flame(277.5, b0 - CH - 9.5, 1.2);
      lightGlowList().push([277.5, b0 - CH - 11, 36, 0.5]);
    }
  }
  function chair(x, b2, side, t) {
    const seat = t >= 4 ? GOLD : t === 3 ? '#5a3020' : t === 0 ? '#7a5a3a' : '#6a4630';
    const leg = t >= 4 ? GOLD_D : t === 0 ? '#5e4430' : '#4e3322';
    if (t >= 3) {
      // 背もたれ
      const bx = x + side * 5;
      art.poly(ctx, [bx - 0.9, b2 - 7, bx + 0.9, b2 - 7, bx + 0.9, b2 - 22, bx - 0.9, b2 - 22], leg);
      art.poly(ctx, [bx - 1.6, b2 - 22, bx + 1.6, b2 - 22, bx + 1.6, b2 - 23.4, bx - 1.6, b2 - 23.4], seat);
    }
    art.poly(ctx, [x - 5, b2 - 9, x + 5, b2 - 9, x + 5, b2 - 7, x - 5, b2 - 7], seat);
    if (t >= 3) art.poly(ctx, [x - 4.6, b2 - 10.2, x + 4.6, b2 - 10.2, x + 4.6, b2 - 9, x - 4.6, b2 - 9], t >= 4 ? '#b8323e' : '#8e3038');
    art.poly(ctx, [x - 4, b2, x - 3, b2, x - 3, b2 - 7, x - 4, b2 - 7], leg);
    art.poly(ctx, [x + 3, b2, x + 4, b2, x + 4, b2 - 7, x + 3, b2 - 7], leg);
  }
  function table(tx, b2, t) {
    const wood = t === 0 ? '#7a5a3a' : t >= 2 ? '#7a4a2a' : '#8a5a34';
    art.poly(ctx, [tx - 1.5, b2, tx + 1.5, b2, tx + 1.5, b2 - 18, tx - 1.5, b2 - 18], t >= 4 ? GOLD_D : '#5e3f2a');
    art.poly(ctx, [tx - 6, b2, tx + 6, b2, tx + 4, b2 - 2, tx - 4, b2 - 2], t >= 4 ? GOLD_D : '#5e3f2a');
    if (t >= 3) {
      // テーブルクロス
      const cl = t >= 4 ? '#fbf6ec' : '#9a2f34';
      art.poly(ctx, [tx - 12, b2 - 21, tx + 12, b2 - 21, tx + 13, b2 - 12, tx + 8, b2 - 13.5, tx, b2 - 12, tx - 8, b2 - 13.5, tx - 13, b2 - 12], cl);
      art.poly(ctx, [tx - 12, b2 - 21, tx + 12, b2 - 21, tx + 12, b2 - 19.6, tx - 12, b2 - 19.6], G.shade(cl, 0.15));
      if (t >= 4) art.poly(ctx, [tx - 13, b2 - 13, tx - 8, b2 - 14.5, tx, b2 - 13, tx + 8, b2 - 14.5, tx + 13, b2 - 13, tx + 13, b2 - 12, tx + 8, b2 - 13.5, tx, b2 - 12, tx - 8, b2 - 13.5, tx - 13, b2 - 12], GOLD);
    } else {
      art.facetPoly(ctx, [tx - 12, b2 - 18, tx + 12, b2 - 18, tx + 10, b2 - 21, tx - 10, b2 - 21], wood, 0.1);
      if (t === 0) { ctx.fillStyle = 'rgba(30,18,10,0.4)'; ctx.fillRect(tx - 4, b2 - 20.5, 0.6, 2.4); }
    }
    if (t >= 2) {
      // 卓上のろうそく（T4 は金の燭台）
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [tx - 2, b2 - 21, tx + 2, b2 - 21, tx + 1, b2 - 22.4, tx - 1, b2 - 22.4], m);
      if (t >= 4) {
        art.poly(ctx, [tx - 0.4, b2 - 22.4, tx + 0.4, b2 - 22.4, tx + 0.4, b2 - 26, tx - 0.4, b2 - 26], m);
        art.poly(ctx, [tx - 4.4, b2 - 26, tx + 4.4, b2 - 26, tx + 4.4, b2 - 26.8, tx - 4.4, b2 - 26.8], m);
        [-4, 0, 4].forEach((d) => { art.poly(ctx, [tx + d - 0.6, b2 - 26.8, tx + d + 0.6, b2 - 26.8, tx + d + 0.6, b2 - 30, tx + d - 0.6, b2 - 30], '#f5ead0'); flame(tx + d, b2 - 30.3, 0.8); });
        lightGlowList().push([tx, b2 - 31, 26, 0.5]);
      } else {
        art.poly(ctx, [tx - 0.7, b2 - 22.4, tx + 0.7, b2 - 22.4, tx + 0.7, b2 - 26, tx - 0.7, b2 - 26], '#f5ead0');
        flame(tx, b2 - 26.3, 0.9);
        lightGlowList().push([tx, b2 - 27, 22, 0.4]);
      }
    }
  }
  function stool(x, b2, t) {
    const seat = t >= 4 ? GOLD : '#6a4630';
    art.poly(ctx, [x - 4, b2 - 12, x + 4, b2 - 12, x + 4, b2 - 10, x - 4, b2 - 10], seat);
    if (t >= 3) art.poly(ctx, [x - 3.6, b2 - 13, x + 3.6, b2 - 13, x + 3.6, b2 - 12, x - 3.6, b2 - 12], t >= 4 ? '#b8323e' : '#8e3038');
    art.poly(ctx, [x - 0.8, b2, x + 0.8, b2, x + 0.8, b2 - 10, x - 0.8, b2 - 10], t >= 4 ? GOLD_D : '#4e3322');
    if (t >= 2) art.poly(ctx, [x - 3, b2 - 4, x + 3, b2 - 4, x + 3, b2 - 3.2, x - 3, b2 - 3.2], t >= 4 ? GOLD_D : BRASS);
  }
  // バーカウンター：荒板 → 真鍮の縁 → 真鍮の足掛け → MAX は大理石の天板と金のパネル
  function barCounter(b2, t) {
    const x0 = 270, w = 56, H = 24;
    const wood = ['#5e4430', '#6e4630', '#6a3e26', '#4e2a1a', '#3a2030'][t];
    box(x0, b2, w, H, wood, 3);
    if (t >= 4) {
      art.poly(ctx, [x0 - 2, b2 - H, x0 + w + 2, b2 - H, x0 + w + 2, b2 - H + 3, x0 - 2, b2 - H + 3], MARBLE);
      art.poly(ctx, [x0 - 2, b2 - H + 3, x0 + w + 2, b2 - H + 3, x0 + w + 2, b2 - H + 4, x0 - 2, b2 - H + 4], GOLD);
      for (let i = 0; i < 3; i++) {
        const px = x0 + 4 + i * 17.5;
        art.poly(ctx, [px, b2 - H + 7, px + 14, b2 - H + 7, px + 14, b2 - 5, px, b2 - 5], GOLD);
        art.poly(ctx, [px + 1.4, b2 - H + 8.4, px + 12.6, b2 - H + 8.4, px + 12.6, b2 - 6.4, px + 1.4, b2 - 6.4], '#8e2a34');
        fleur(px + 7, b2 - 12.5, 2.6, GOLD_L);
      }
    } else {
      art.poly(ctx, [x0, b2 - H, x0 + w, b2 - H, x0 + w, b2 - H + 2, x0, b2 - H + 2], t === 0 ? '#7a5a3a' : t >= 2 ? BRASS : '#e8bd4c');
      if (t >= 2) for (let i = 0; i < 3; i++) {
        const px = x0 + 4 + i * 17.5;
        art.poly(ctx, [px, b2 - H + 6, px + 14, b2 - H + 6, px + 14, b2 - 5, px, b2 - 5], G.shade(wood, -0.15));
        art.poly(ctx, [px, b2 - H + 6, px + 14, b2 - H + 6, px + 14, b2 - H + 7, px, b2 - H + 7], G.shade(wood, 0.2));
      }
    }
    if (t >= 3) {
      // 真鍮（金）の足掛けレール
      const m = t >= 4 ? GOLD : BRASS;
      art.poly(ctx, [x0 - 3, b2 - 5, x0 + w, b2 - 5, x0 + w, b2 - 3.8, x0 - 3, b2 - 3.8], m);
      art.poly(ctx, [x0 + 2, b2 - 3.8, x0 + 3, b2 - 3.8, x0 + 3, b2 - 2, x0 + 2, b2 - 2], m);
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
          ctx.beginPath(); ctx.arc(p.x, p.y, (4 + k * 12) * (p.big || 1), 0, Math.PI * 2); ctx.stroke();
          break;
        case 'star':
          spark4(p.x, p.y, p.size * Math.sin(Math.min(1, k * 1.2) * Math.PI), G.rgba(p.col, Math.min(1, a * 1.5)));
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

  // テスト用：全員をベッドへ／酒場の全席を埋める
  SC._debug.sleepAll = () => {
    const st = G.state;
    agents.forEach((a) => {
      if (a.kind !== 'adv') return;
      const idx = st.adv.findIndex((x) => x.id === a.id);
      if (idx < 0) return;
      const b = bedPos(idx);
      Object.assign(a, { queue: [], stair: null, f: 1, x: b.x - 4, act: 'sleep', bed: idx, sleeping: true, actT: 999, visible: true, away: false, seat: null });
    });
  };
  SC._debug.fillSeats = () => {
    const n = D.seats(G.state.fac.tavern);
    const used = new Set(agents.filter((a) => a.seat != null).map((a) => a.seat));
    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      const look = art.randomLook('warrior');
      look.role = 'customer';
      look.outfit = G.pick(['#b85c4a', '#4a7ab8', '#8a9a4a', '#c08a3a', '#7a5aa8', '#4a9a8a', '#d0a080']);
      const p = seatPos(i);
      newAgent({ kind: 'cust', look, x: p.x, f: 2, seat: i, facing: p.facing, state: 'drink', item: 'mug', act: 'custDrink', actT: 999 });
    }
  };

  SC.ready = false;
  SC.start = function () {
    const st = G.state;
    syncStaff();
    st.adv.forEach((a) => { if (a.status === 'idle') spawnAdv(a, false); });
    SC.focusBottom();
    SC.ready = true;
  };
})();
