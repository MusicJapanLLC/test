/* ギルドの灯 — reelfx: 冒険譚の背景に住む者たち
 *  空（太陽・月・星・雲・鳥・花火）、風（クルンと巻く風の線）、波、エリアごとの生き物、
 *  そして戦いを見守る「見物人」たち。会心で驚き、閃きで拍手、ピンチで心配し、勝てば喜ぶ
 *  （背景の魔物は笑ったり、驚いたり、逃げ出したりする）。
 *  - prep      … 冒険譚ごとの顔ぶれ（seed で決まる）と、いまの「場の空気」を求める
 *  - drawSky   … 遠景の山より奥（drawBg の空の直後）。太陽の光・星・遠くの鳥・山の向こうの竜
 *  - drawBack  … 地形の上・戦う者の後ろ。見物人・コウモリ・骸骨の舞踏会・波
 *  - drawFront … 戦う者の手前。風の渦・舞う花びら・しぶき・蛍
 *  毎フレームの負荷を抑えるため、人や小物は1度だけ絵にして使い回す（スプライト）。
 */
'use strict';
(function () {
  const X = (G.reelfx = {});
  const art = G.art;
  const TAU = Math.PI * 2;
  const hash = G.hash;
  const seg = G.seg, clamp = G.clamp, lerp = G.lerp, bump = G.bump;
  const fr = (x) => x - Math.floor(x);
  const outBack = (x) => G.ease.outBack(clamp(x, 0, 1));

  let c = null; // 描画先
  let CF = null; // 冒険譚ごとの設定
  let PL = null, REEL = null, LY = null;
  let T = 0, GY = 400, SC = 120, RM = false;
  const sx = (x, par) => x - (SC - 120) * par; // 歩き・撤退のスクロールに合わせた視差

  // ---------------------------------------------------------------- 乱数
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];
  const hh = (a, b) => hash(((a * 7919) ^ (b * 104729)) >>> 0);

  // 動きをひかえめに（matchMedia は重いので1秒ごとに見る）
  let rmAt = -9, rmV = false;
  function reduced() {
    const now = performance.now();
    if (now - rmAt > 1000) { rmAt = now; rmV = !!(G.reducedMotion && G.reducedMotion()); }
    return rmV;
  }

  // ---------------------------------------------------------------- 描き置き（スプライト）
  const sprites = new Map();
  let sprRes = 0, resW = -1, resV = 2;
  function res() {
    const w = window.innerWidth || 360, h = window.innerHeight || 640;
    if (w !== resW) {
      resW = w;
      const k = Math.min(w / 360, h / 600);
      resV = clamp(Math.round(Math.min(window.devicePixelRatio || 1, 2.5) * k * 1.35 * 4) / 4, 1, 4);
    }
    return resV;
  }
  function sprite(key, x0, y0, w, h, draw) {
    const r0 = res();
    if (r0 !== sprRes) { sprites.clear(); sprRes = r0; }
    let s = sprites.get(key);
    if (s) return s;
    // 大きな小道具は少し粗く（縮小描画の負荷を抑える）
    const r = w * h > 12000 ? Math.max(1, r0 * 0.75) : r0;
    s = document.createElement('canvas');
    s.width = Math.max(1, Math.ceil(w * r));
    s.height = Math.max(1, Math.ceil(h * r));
    const g = s.getContext('2d');
    g.scale(r, r);
    g.translate(-x0, -y0);
    try { draw(g); } catch (e) { /* 絵の失敗で再生は止めない */ }
    s._x0 = x0; s._y0 = y0; s._w = w; s._h = h;
    if (sprites.size > 180) sprites.clear();
    sprites.set(key, s);
    return s;
  }
  function blit(s, x, y, kx, ky, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(kx, ky);
    c.drawImage(s, s._x0, s._y0, s._w, s._h);
    c.restore();
  }

  // ---------------------------------------------------------------- 小さな描画の道具
  function P(g, pts, fill) { art.poly(g, pts, fill); }
  function E(g, x, y, rx, ry, fill) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); g.fillStyle = fill; g.fill();
  }
  const grads = new Map();
  function radial(key, r, stops) {
    let g = grads.get(key);
    if (!g) {
      g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
      if (grads.size > 60) grads.clear();
      grads.set(key, g);
    }
    return g;
  }
  function glow(x, y, r, key, stops, a) {
    if (a <= 0.004) return;
    c.save();
    c.translate(x, y);
    c.globalAlpha = a;
    c.fillStyle = radial(key, r, stops);
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.restore();
  }
  // 太陽・月の光：ゆっくり回る光の筋
  function rays(x, y, r0, r1, n, rot, w, col, a) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = a;
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU, rr = i % 2 ? r1 * 0.68 : r1;
      c.moveTo(Math.cos(an - w) * r0, Math.sin(an - w) * r0);
      c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
      c.lineTo(Math.cos(an + w) * r0, Math.sin(an + w) * r0);
      c.closePath();
    }
    c.fill();
    c.restore();
  }
  // 遠景の稜線（drawBg の layer と同じ形）
  function ridgeY(x, amp, base, n, par, seed, jag) {
    const span = 400 / n, sh = SC * par, i0 = Math.floor(sh / span), off = -(sh - i0 * span);
    const fi = (x - off) / span, i = Math.floor(fi), f = fi - i;
    const y0 = base - hash(seed + i + i0) * amp - (jag && (i + i0) % 2 ? amp * 0.3 : 0);
    const y1 = base - hash(seed + i + 1 + i0) * amp - (jag && (i + 1 + i0) % 2 ? amp * 0.3 : 0);
    return lerp(y0, y1, f);
  }
  const wrapX = (x, span, off) => ((x % span) + span) % span - off;

  // ---------------------------------------------------------------- 場の空気（戦いの状況）
  // k: walk / watch / enc / charge / skill / crit / hurt / bighurt / miss / heal / win / lose
  const M = { k: 'watch', d: 0, big: false, pinch: 0, imp: -9, impK: 0, hype: 0, boss: false, critSeen: false };
  function mood(pl, reel, t) {
    M.k = t < 1.05 ? 'walk' : 'watch';
    M.d = t;
    M.big = !!pl.big;
    M.boss = !!(reel.boss || reel.guardian);
    M.hype = reel.tier === 'legend' ? 2 : reel.tier === 'great' ? 1 : 0;
    M.imp = -9; M.impK = 0; M.critSeen = false;
    let hits = 0;
    if (t > pl.encT - 0.05 && t < pl.encT + 0.95) { M.k = 'enc'; M.d = t - pl.encT; }
    const bs = pl.beats;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      const d = t - b.at;
      if (b.kind === 'mon') {
        if (d >= 0 && !b.miss) { hits += b.big ? 2 : 1; M.imp = b.at; M.impK = b.big ? 1 : 0.4; }
        if (d >= 0 && d < 1.1) { M.k = b.miss ? 'miss' : b.big ? 'bighurt' : 'hurt'; M.d = d; }
      } else if (b.kind === 'skill') {
        if (t > b.t - 0.55 && d < 0) { M.k = 'charge'; M.d = t - (b.t - 0.55); }
        else if (d >= 0 && d < 1.5) { M.k = 'skill'; M.d = d; }
        if (d >= 0) { M.imp = b.at; M.impK = 1; M.critSeen = true; }
      } else if (b.kind === 'hit') {
        if (b.crit && d >= 0 && d < 1.0) { M.k = 'crit'; M.d = d; }
        if (d >= 0) { M.imp = b.at; M.impK = b.crit ? 0.8 : 0.22; if (b.crit) M.critSeen = true; }
      } else if (b.kind === 'heal') {
        if (d >= 0 && d < 0.9) { M.k = 'heal'; M.d = d; }
      }
    }
    M.pinch = pl.fail ? (hits >= 2 ? 1 : hits ? 0.6 : 0) : hits >= 3 ? 0.6 : 0;
    if (!pl.fail && t >= pl.finishT) { M.k = 'win'; M.d = t - pl.finishT; M.imp = pl.finishT; M.impK = 1; }
    else if (pl.fail && t >= pl.finishT + 0.05) { M.k = 'lose'; M.d = t - pl.finishT; }
  }
  // 大きな衝撃からの経過（0 で直後、離れるほど大きい）
  const sinceImp = (minK) => (M.impK >= minK ? T - M.imp : 99);

  // ---------------------------------------------------------------- 見物人の反応
  // side: friend（町の人）/ foe（背景の魔物：笑う・驚く・逃げる）/ animal / rival（ライバル：失敗を笑う）
  const RX = { pose: 'idle', hop: 0, dx: 0, rot: 0, sq: 1, mark: null, mk: 0, md: 0, face: 1, a: 1, blink: false };
  function react(a, wx, t) {
    const r = RX;
    r.pose = 'idle'; r.dx = 0; r.rot = 0; r.sq = 1; r.mark = null; r.mk = 0; r.md = 0; r.a = 1;
    const fx = wx < 206 ? 1 : -1; // 戦いのほうを向く
    r.face = a.face || fx;
    r.hop = RM ? 0 : Math.sin(t * 2.1 + a.seed * 6.3) * 0.5;
    r.blink = Math.sin(t * 2.7 + a.seed * 11) > 0.985;
    let k = M.k;
    const d = M.d - a.delay;
    if (d < 0 && k !== 'walk' && k !== 'watch') k = 'watch'; // ほんの少し遅れて気づく
    r.md = d;
    const S = a.side;
    const pop = (d0, dur) => outBack(seg(d, d0, d0 + 0.16)) * (1 - seg(d, dur - 0.15, dur));
    const jump = (h, dur) => { if (!RM) r.hop -= bump(d / dur) * h; };
    switch (k) {
      case 'walk':
        if (S === 'friend' && a.wave) { r.pose = 'wave'; r.face = -1; }
        else if (S === 'foe') r.pose = 'hide';
        break;
      case 'watch': {
        r.rot = 0.05 * fx;
        const cyc = fr(t * 0.42 + a.seed);
        if (M.pinch > 0 && (S === 'friend' || S === 'animal')) {
          r.pose = S === 'friend' ? 'worry' : 'idle';
          if (cyc < 0.55) { r.mark = 'sweat'; r.mk = outBack(cyc / 0.08) * (1 - seg(cyc, 0.45, 0.55)); }
        } else if (M.pinch > 0 && (S === 'foe' || S === 'rival')) {
          r.pose = 'laugh';
          if (cyc < 0.5) { r.mark = 'laugh'; r.mk = outBack(cyc / 0.08) * (1 - seg(cyc, 0.4, 0.5)); }
        } else if (a.sleeper && !M.critSeen) {
          r.pose = 'sleep'; r.mark = 'zzz'; r.mk = 1;
        }
        break;
      }
      case 'enc':
        if (S === 'foe') { if (M.big) { r.pose = 'cheer'; r.mark = 'note'; r.mk = pop(0.1, 0.95); } }
        else if (S === 'rival') { r.mark = '!'; r.mk = pop(0, 0.8); }
        else if (a.sleeper) { r.pose = 'sleep'; r.mark = 'zzz'; r.mk = 1; }
        else { r.pose = M.big ? 'cover' : 'surprise'; r.mark = M.big ? '!!' : '!'; r.mk = pop(0, 0.9); jump(M.big ? 5 : 8, 0.35); }
        break;
      case 'charge':
        r.rot = 0.1 * fx;
        r.mark = S === 'foe' ? '?' : 'dots'; r.mk = pop(0, 9);
        break;
      case 'skill':
        if (S === 'foe') {
          if (d < 0.55) { r.pose = 'surprise'; r.mark = '!!'; r.mk = pop(0, 0.6); jump(10, 0.4); r.dx = -fx * bump(d / 0.55) * 6; }
          else { r.pose = 'cower'; r.mark = 'sweat'; r.mk = pop(0.55, 1.5); }
        } else if (S === 'animal') { r.pose = 'surprise'; r.mark = '!'; r.mk = pop(0, 1); jump(10, 0.4); }
        else { r.pose = 'clap'; r.mark = S === 'rival' ? '!!' : a.seed > 0.5 ? 'spark' : 'note'; r.mk = pop(0.05, 1.5); if (!RM) r.hop -= Math.abs(Math.sin(d * 10)) * 3; }
        break;
      case 'crit':
        if (S === 'foe') { r.pose = 'surprise'; r.mark = '!'; r.mk = pop(0, 0.8); jump(7, 0.35); r.dx = -fx * bump(d / 0.6) * 5; }
        else { r.pose = d < 0.45 || S !== 'friend' ? 'surprise' : 'cheer'; r.mark = '!'; r.mk = pop(0, 0.85); jump(9, 0.38); }
        break;
      case 'hurt': case 'bighurt':
        if (S === 'foe' || S === 'rival') { r.pose = 'laugh'; r.mark = 'laugh'; r.mk = pop(0.05, 1.1); }
        else if (S === 'animal') { if (k === 'bighurt') { r.pose = 'surprise'; r.mark = '!'; r.mk = pop(0, 1); jump(8, 0.4); } }
        else { r.pose = k === 'bighurt' ? 'cover' : 'worry'; r.mark = k === 'bighurt' ? '!?' : a.seed > 0.5 ? 'sweat' : '?'; r.mk = pop(0.02, 1.1); }
        break;
      case 'miss':
        if (S === 'foe') { r.mark = 'anger'; r.mk = pop(0.05, 1); }
        else if (S === 'friend') { r.pose = 'cheer'; r.mark = 'note'; r.mk = pop(0.05, 1); }
        break;
      case 'heal':
        if (S === 'friend') { r.mark = 'heart'; r.mk = pop(0, 0.9); }
        break;
      case 'win':
        if (S === 'foe') {
          if (d < 0.35) { r.pose = 'surprise'; r.mark = '!!'; r.mk = pop(0, 0.35); jump(8, 0.3); }
          else if (a.flee) {
            // 魔物が倒れたあとは右側が空くので、左の端にいる者以外は右へ逃げる
            const away = wx < 120 ? -1 : 1;
            r.pose = 'flee'; r.face = away; r.mark = 'sweat'; r.mk = pop(0.35, 99);
            r.dx = away * G.ease.inCubic(seg(d, 0.35, 1.7)) * 300;
            if (!RM) r.hop -= Math.abs(Math.sin(t * 16 + a.seed * 5)) * 3;
          } else { r.pose = 'cower'; r.mark = 'sweat'; r.mk = pop(0.35, 99); }
        } else if (S === 'animal') { r.pose = 'cheer'; if (!RM) r.hop -= Math.abs(Math.sin(t * 7 + a.seed * 4)) * 4; }
        else {
          r.pose = S === 'rival' || a.clapper ? 'clap' : 'cheer';
          if (!RM) r.hop -= Math.abs(Math.sin(t * 8 + a.seed * 3)) * (S === 'rival' ? 1.5 : 5);
          const cyc = fr(t * 0.7 + a.seed);
          r.mark = S === 'rival' ? (cyc < 0.5 ? 'dots' : null) : M.hype >= 2 ? (cyc < 0.5 ? 'spark' : 'heart') : cyc < 0.5 ? 'note' : 'heart';
          r.mk = outBack(fr(cyc * 2) / 0.12) * (1 - seg(fr(cyc * 2), 0.8, 1));
          r.md = fr(cyc * 2);
        }
        break;
      case 'lose':
        if (S === 'foe' || S === 'rival') { r.pose = 'laugh'; r.mark = 'laugh'; r.mk = pop(0.1, 99); if (!RM) r.hop -= Math.abs(Math.sin(t * 10 + a.seed * 3)) * 3; }
        else if (S === 'friend') { r.pose = 'worry'; r.mark = fr(t * 0.6 + a.seed) < 0.5 ? 'sweat' : '?'; r.mk = 1; }
        break;
    }
    if (r.pose === 'laugh' && !RM) { r.hop -= Math.abs(Math.sin(t * 15 + a.seed * 9)) * 1.6; r.rot += Math.sin(t * 15) * 0.04; }
    if ((r.pose === 'cower' || r.pose === 'cover') && !RM) { r.dx += Math.sin(t * 60 + a.seed * 9) * 0.7; r.sq = 0.9; }
    return r;
  }

  // ---------------------------------------------------------------- 驚き・拍手のマーク（図形で描く）
  function strokeOut(lw) {
    c.lineWidth = lw + 2.2; c.strokeStyle = '#2a1a10'; c.stroke();
    c.lineWidth = lw; c.strokeStyle = c._ink || '#ffffff'; c.stroke();
  }
  function drawMark(kind, x, y, k, d) {
    if (!kind || k <= 0.02) return;
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    c.lineCap = 'round'; c.lineJoin = 'round';
    switch (kind) {
      case '!': case '!!': case '!?': {
        const red = kind === '!?';
        P(c, [-6, -13, 6, -13, 4.6, 5, -4.6, 5], red ? '#ff8a6a' : '#ffcf4a');
        P(c, [-6, -13, 6, -13, 5.6, -10, -5.6, -10], red ? '#ffc0a8' : '#fff0b0');
        const one = (ox) => { P(c, [ox - 1.5, -10, ox + 1.5, -10, ox + 1, -1.5, ox - 1, -1.5], '#2a1404'); E(c, ox, 1.4, 1.3, 1.3, '#2a1404'); };
        if (kind === '!') one(0);
        else if (kind === '!!') { one(-2.2); one(2.2); }
        else {
          one(-2.4);
          c.beginPath(); c.moveTo(0.4, -7); c.quadraticCurveTo(0.6, -10, 2.8, -10); c.quadraticCurveTo(5, -10, 4.6, -7.4); c.quadraticCurveTo(4.2, -5.6, 2.8, -4.6); c.lineTo(2.8, -2.8);
          c.lineWidth = 1.5; c.strokeStyle = '#2a1404'; c.stroke(); E(c, 2.8, 1.4, 1.2, 1.2, '#2a1404');
        }
        break;
      }
      case '?':
        c.beginPath(); c.moveTo(-3.4, -6.5); c.quadraticCurveTo(-3, -11, 0.4, -11); c.quadraticCurveTo(4, -11, 3.8, -7.6); c.quadraticCurveTo(3.6, -5, 0.4, -3.6); c.lineTo(0.4, -1.4);
        c._ink = '#bfe8ff'; strokeOut(2.2);
        E(c, 0.4, 2.6, 2, 2, '#2a1a10'); E(c, 0.4, 2.6, 1.1, 1.1, '#bfe8ff');
        break;
      case 'note': {
        const fl = -(d || 0) * 10;
        c.translate(Math.sin((d || 0) * 6) * 2, fl);
        c.beginPath(); c.moveTo(1.6, 1); c.lineTo(1.6, -10); c.quadraticCurveTo(5, -8, 6.5, -5);
        c._ink = '#ff9ccf'; strokeOut(1.6);
        E(c, -0.4, 1.4, 3, 2.3, '#2a1a10'); E(c, -0.4, 1.4, 2.1, 1.5, '#ff9ccf');
        break;
      }
      case 'sweat':
        c.translate(6, 2 + (d || 0) * 2);
        P(c, [0, -6, 3.2, -0.6, 2.2, 2.4, 0, 3.2, -2.2, 2.4, -3.2, -0.6], '#2a5a8a');
        P(c, [0, -4.6, 2.2, -0.6, 1.4, 1.8, 0, 2.3, -1.4, 1.8, -2.2, -0.6], '#9fd8ff');
        E(c, -0.8, -0.4, 0.6, 0.9, '#ffffff');
        break;
      case 'heart':
        c.translate(0, -(d || 0) * 8);
        art.heart(c, 0, -2, 6.4, '#2a1a10');
        art.heart(c, 0, -2, 5, '#ff6f8f');
        break;
      case 'spark': {
        const s = 1 + Math.sin(T * 14) * 0.15;
        c.scale(s, s);
        P(c, [0, -9, 1.8, -1.8, 9, 0, 1.8, 1.8, 0, 9, -1.8, 1.8, -9, 0, -1.8, -1.8], '#fff3a0');
        P(c, [0, -5.5, 1, -1, 5.5, 0, 1, 1, 0, 5.5, -1, 1, -5.5, 0, -1, -1], '#ffffff');
        break;
      }
      case 'laugh': {
        // 笑い：ゆれる「ハハ」と、こぼれる笑い線
        const w = Math.sin(T * 18) * 1.2;
        c.font = G.font(900, 11, 'ui');
        c.textAlign = 'center';
        c.lineJoin = 'round';
        c.lineWidth = 3.4; c.strokeStyle = '#2a1a10';
        c.strokeText('ハハ', w, -1); c.fillStyle = '#ffe9a8'; c.fillText('ハハ', w, -1);
        c.beginPath(); c.moveTo(-10, -6); c.lineTo(-13, -9); c.moveTo(10, -6); c.lineTo(13, -9);
        c.lineWidth = 1.2; c.strokeStyle = '#ffe9a8'; c.stroke();
        break;
      }
      case 'anger':
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          const an = i * Math.PI / 2 + Math.PI / 4;
          const ax = Math.cos(an) * 2, ay = Math.sin(an) * 2;
          c.moveTo(ax + Math.cos(an - 0.9) * 3.4, ay + Math.sin(an - 0.9) * 3.4);
          c.quadraticCurveTo(ax, ay, ax + Math.cos(an + 0.9) * 3.4, ay + Math.sin(an + 0.9) * 3.4);
        }
        c._ink = '#ff5a4a'; strokeOut(1.6);
        break;
      case 'dots':
        for (let i = 0; i < 3; i++) {
          const on = fr(T * 1.6) * 3 > i;
          E(c, -5 + i * 5, 0, 2, 2, '#2a1a10');
          E(c, -5 + i * 5, 0, 1.2, 1.2, on ? '#ffffff' : '#9aa0b8');
        }
        break;
      case 'zzz': {
        const p = fr(T * 0.6);
        c.globalAlpha *= 1 - p;
        c.translate(p * 6, -p * 10);
        c.beginPath(); c.moveTo(-3, -3); c.lineTo(3, -3); c.lineTo(-3, 3); c.lineTo(3, 3);
        c._ink = '#d8e4ff'; strokeOut(1.3);
        break;
      }
    }
    c._ink = null;
    c.restore();
  }

  // ---------------------------------------------------------------- 人の見物人（描き置き）
  const D = G.D;
  const BRIGHT = ['#e0604a', '#4a8ad0', '#e8b84a', '#6aa85a', '#c86aa0', '#5ab8b0', '#f08a3a'];
  function lookOf(r, kind) {
    const L = {
      cls: 'warrior', role: 'npc', seed: Math.floor(r() * 997),
      skin: pickR(r, D.SKINS), hair: pickR(r, D.HAIRS), style: pickR(r, D.HAIR_STYLES),
      outfit: pickR(r, BRIGHT), pants: pickR(r, ['#4b3a2e', '#3d3f52', '#5a4632', '#384a3c']), blush: r() < 0.7,
    };
    if (kind === 'kid') { L.height = 0.74; L.wide = 0.95; L.style = pickR(r, ['short', 'spiky', 'pony', 'bob', 'bun']); }
    else if (kind === 'farmer') { L.outfit = pickR(r, ['#c9a464', '#8aa86a', '#b8805a']); L.vest = '#6a5a3a'; L.mustache = r() < 0.6; L.style = 'short'; }
    else if (kind === 'girl') { L.apron = '#f4ecdc'; L.style = pickR(r, ['long', 'pony', 'bun', 'bob']); L.hood = r() < 0.4 ? pickR(r, ['#e86a6a', '#f2d36a', '#8ac0e8']) : undefined; }
    else if (kind === 'elder') { L.hair = '#e4e4e8'; L.style = 'bald'; L.beard = true; L.outfit = pickR(r, ['#7a6a9a', '#6a7a6a', '#8a6a4a']); L.height = 0.92; }
    else if (kind === 'sailor') { L.outfit = '#f2f0ea'; L.vest = '#2f4f7a'; L.pants = '#2f3f5a'; L.style = 'short'; L.mustache = r() < 0.4; }
    else if (kind === 'miner') { L.outfit = '#8a6a4a'; L.vest = '#5a4a3a'; L.beard = true; L.height = 0.82; L.wide = 1.15; }
    else if (kind === 'monk') { L.robe = true; L.outfit = '#d0743a'; L.style = 'bald'; L.hair = '#d8dde3'; L.beard = true; L.pants = '#8a4a2a'; }
    else if (kind === 'skyfolk') { L.robe = true; L.outfit = pickR(r, ['#f4f0ff', '#fff4e0', '#e8f4ff']); L.hair = pickR(r, ['#f2e0a0', '#e8e8f0', '#f4c0d0', '#c8e0ff']); L.height = r() < 0.5 ? 0.8 : 1; }
    else if (kind === 'rival') { L.cls = 'thief'; delete L.role; L.outfit = pickR(r, ['#3f5a4a', '#4a3f5a', '#5a3f3a']); }
    return L;
  }
  function hat(g, a) {
    const L = a.look;
    g.save();
    g.scale(L.wide || 1, L.height || 1);
    if (a.hat === 'straw') {
      E(g, 0.5, -31, 10.5, 2.3, '#d8b85a');
      P(g, [-5.5, -31, 5.5, -31, 4.6, -36.4, -4.6, -36.4], '#f0d47a');
      P(g, [-5.4, -32.6, 5.4, -32.6, 5.2, -31.4, -5.2, -31.4], '#c4553a');
    } else if (a.hat === 'cap') {
      P(g, [-6.6, -30.6, 6.6, -30.6, 5.6, -34.6, -5.6, -34.6], '#f6f6f2');
      P(g, [-7, -30.6, 7.6, -30.6, 7.6, -29.4, -7, -29.4], '#2f4f7a');
    } else if (a.hat === 'helmet') {
      P(g, [-7.2, -28.6, -6.2, -33.4, -2, -36, 3, -36, 6.6, -33, 7.4, -28.6], '#e8b830');
      P(g, [-6.2, -33.4, -2, -36, 0, -35.6, -4, -31], '#ffd860');
      E(g, 6.8, -31.6, 1.7, 1.7, '#fff6c0');
    } else if (a.hat === 'halo') {
      g.strokeStyle = '#ffe070'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(0.5, -40.5, 5.2, 1.6, 0, 0, TAU); g.stroke();
    }
    g.restore();
  }
  function wings(g, a) {
    const h = a.look.height || 1;
    g.save();
    g.scale(1, h);
    P(g, [-1, -19, -11, -27, -16, -23, -14, -16, -9, -13, -3, -14], '#e8ecfa');
    P(g, [-1, -19, -11, -27, -16, -23, -7, -19], '#ffffff');
    P(g, [1, -18, -6, -29, -11, -27, -10, -20, -5, -16], '#f6f8ff');
    g.restore();
  }
  function personSpr(a, pose) {
    return sprite('p' + a.id + pose, -20, -56, 40, 62, (g) => {
      if (a.wings) wings(g, a);
      const st = pose === 'happy' ? 'stand' : pose === 'sleep' ? 'sit' : pose;
      const expr = pose === 'cheer' || pose === 'happy' ? 'happy' : pose === 'hurt' ? 'hurt' : pose === 'sleep' ? 'sleep' : null;
      art.person(g, a.look, { t: 0.6, state: st, phase: 0, facing: 1, armed: false, expr });
      if (a.hat) hat(g, a);
      if (a.tool === 'fork') {
        g.save(); g.scale(1, a.look.height || 1);
        P(g, [6.6, 1, 7.6, 1, 7.6, -40, 6.6, -40], '#8a5a32');
        P(g, [4.4, -40, 9.8, -40, 9.8, -41, 4.4, -41], '#9aa2ac');
        [4.6, 7, 9.4].forEach((x) => P(g, [x - 0.4, -41, x + 0.4, -41, x + 0.3, -46, x - 0.3, -46], '#9aa2ac'));
        g.restore();
      }
    });
  }
  function drawPerson(a, r, x, y, t) {
    let pose = 'stand';
    switch (r.pose) {
      case 'cheer': pose = 'cheer'; break;
      case 'wave': pose = Math.sin(t * 11 + a.seed * 5) > 0 ? 'cheer' : 'happy'; break;
      case 'clap': pose = Math.sin(t * 20 + a.seed * 5) > 0 ? 'cheer' : 'happy'; break;
      case 'worry': case 'cover': case 'cower': pose = 'hurt'; break;
      case 'laugh': pose = 'happy'; break;
      case 'sleep': pose = 'sleep'; break;
      case 'idle': pose = a.sitter ? 'sit' : 'stand'; break;
    }
    if (a.sitter && pose === 'hurt') pose = 'sit';
    const s = personSpr(a, pose);
    const k = a.s;
    blit(s, x + r.dx, y + r.hop, (r.face < 0 ? -k : k), k * r.sq, r.rot);
    if (r.pose === 'clap' && Math.sin(t * 20 + a.seed * 5) > 0.6) {
      // 拍手の小さな光
      const hy = y + r.hop - 40 * k * (a.look.height || 1);
      c.strokeStyle = 'rgba(255,240,170,0.9)'; c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - 5, hy - 2); c.lineTo(x - 8, hy - 5);
      c.moveTo(x + 5, hy - 2); c.lineTo(x + 8, hy - 5);
      c.moveTo(x, hy - 5); c.lineTo(x, hy - 9);
      c.stroke();
    }
  }

  // ---------------------------------------------------------------- 生き物の見物人（描き置き）
  // どれも右向きで描く。top は頭の高さ（マークの位置）
  const CRE = {
    sheep: { top: 18, draw(g) {
      P(g, [-7, -5, -5, -5, -5, 0, -7, 0], '#3a3030'); P(g, [3, -5, 5, -5, 5, 0, 3, 0], '#3a3030');
      art.facet(g, -1, -9, 10, 6.5, 8, '#f2eee4', 0.2, 0.12);
      art.facet(g, -5, -13, 5, 4, 6, '#fbf8f0', 0, 0.1); art.facet(g, 3, -13.5, 5, 4, 6, '#fbf8f0', 0.4, 0.1);
      art.facet(g, 9.5, -10.5, 3.6, 4.2, 6, '#4a3e3a', 0.3, 0.14);
      P(g, [7, -13, 4.4, -12, 6.6, -10.6], '#3a302c');
      E(g, 10.8, -11.4, 0.8, 0.9, '#ffffff');
    } },
    goat: { top: 22, draw(g) {
      P(g, [-7, -6, -5, -6, -5, 0, -7, 0], '#5a4a40'); P(g, [3, -6, 5, -6, 5, 0, 3, 0], '#5a4a40');
      art.facet(g, -1, -10, 10, 6, 8, '#ece6dc', 0.2, 0.14);
      P(g, [6, -12, 9, -20, 13, -18, 12, -12, 9, -9], '#f4f0e8');
      P(g, [9, -20, 7, -25, 5, -24, 8, -19], '#8a7a6a'); P(g, [11, -19.6, 11, -25, 9.6, -24.6, 10, -19.6], '#a0907e');
      P(g, [11.4, -12.4, 13, -12, 12, -8.6], '#d8d0c4');
      E(g, 11, -17, 0.8, 0.8, '#2a1a14');
      P(g, [-11, -13, -8, -14, -9, -11], '#e0d8cc');
    } },
    dog: { top: 20, draw(g, v) {
      const col = v.col || '#c8925a';
      P(g, [-4, 0, 6, 0, 7, -8, 3, -13, -4, -9], G.shade(col, -0.08));
      art.facetPoly(g, [-4, 0, 3, 0, 4, -9, 1, -12, -5, -8], col, 0.14);
      P(g, [2, 0, 4.4, 0, 4.4, -6, 2, -6], G.shade(col, -0.18));
      art.facet(g, 5.5, -15, 5, 4.6, 7, col, 0.2, 0.14);
      P(g, [8.5, -15.4, 12.6, -14.4, 12.6, -12, 8.5, -12], G.shade(col, 0.25));
      E(g, 12.4, -14.2, 1.1, 0.9, '#2a1a14');
      P(g, [2.4, -18.6, 0, -12, 3.6, -13], G.shade(col, -0.3));
      if (v.happy) {
        P(g, [9.6, -12, 11, -12, 10.6, -9.4], '#ff7a8a');
        g.strokeStyle = '#2a1a14'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(5.6, -16); g.lineTo(6.5, -17); g.lineTo(7.4, -16); g.stroke();
      } else E(g, 6.6, -16.2, 0.8, 1, '#2a1a14');
    } },
    cat: { top: 17, draw(g, v) {
      const col = v.col || '#e8a050';
      art.facetPoly(g, [-5, 0, 4, 0, 4, -7, 1, -11, -4, -8], col, 0.16);
      art.facet(g, 3.5, -12.5, 4.6, 4.2, 7, col, 0.3, 0.14);
      P(g, [0, -15, 0.6, -19.4, 3, -16], G.shade(col, -0.12)); P(g, [5, -16, 7.6, -19.2, 7.8, -14.4], G.shade(col, -0.05));
      if (v.sleep) {
        g.strokeStyle = '#2a1a14'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(3.4, -12.4); g.quadraticCurveTo(4.2, -11.6, 5, -12.4); g.moveTo(6.2, -12.4); g.quadraticCurveTo(7, -11.6, 7.6, -12.4); g.stroke();
      } else { E(g, 4.2, -12.6, 0.7, 1.1, '#2a1a14'); E(g, 7, -12.6, 0.7, 1.1, '#2a1a14'); }
      P(g, [5.4, -11, 6.2, -11, 5.8, -10.4], '#e86a7a');
      if (v.stripe) { P(g, [-2, -9, 0, -9.6, -1, -6], G.shade(col, -0.2)); P(g, [-3.6, -6, -1.6, -6.6, -2.6, -3], G.shade(col, -0.2)); }
    } },
    squirrel: { top: 14, draw(g) {
      art.facetPoly(g, [-3, 0, -8, -3, -11, -10, -9, -16, -4, -17, -5, -12, -2, -6], '#c0703a', 0.16);
      art.facetPoly(g, [-2, 0, 4, 0, 4, -6, 1, -9, -2, -6], '#d8843e', 0.14);
      art.facet(g, 3, -10, 3.6, 3.2, 6, '#d8843e', 0.2, 0.12);
      P(g, [1.4, -12.4, 1.8, -15, 3.2, -12.6], '#a85a2a');
      E(g, 4, -10.6, 0.7, 0.8, '#2a1a14');
      art.facet(g, 5.4, -5.4, 1.8, 2, 6, '#a86a3a', 0, 0.1); P(g, [3.8, -6.6, 7, -6.6, 6.4, -7.8, 4.4, -7.8], '#6a4a2a');
    } },
    owl: { top: 20, draw(g, v) {
      art.facet(g, 0, -9, 7.4, 9.4, 8, '#8a6a4a', 0, 0.16);
      art.facet(g, 0.6, -6, 4.6, 5.6, 7, '#c8a880', 0.2, 0.1);
      P(g, [-6, -16, -5, -21, -2.4, -16.6], '#6a4a32'); P(g, [6, -16, 5, -21, 2.4, -16.6], '#6a4a32');
      E(g, -2.6, -13, 3.2, 3.2, '#efe2c4'); E(g, 3.2, -13, 3.2, 3.2, '#efe2c4');
      if (v.shut) {
        g.strokeStyle = '#2a1a14'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(-4.4, -13); g.lineTo(-0.8, -13); g.moveTo(1.4, -13); g.lineTo(5, -13); g.stroke();
      } else {
        const pr = v.wide ? 2.3 : 1.6;
        E(g, -2.6, -13, pr, pr, '#f2c23a'); E(g, 3.2, -13, pr, pr, '#f2c23a');
        E(g, -2.4, -13, pr * 0.55, pr * 0.55, '#1a1008'); E(g, 3.4, -13, pr * 0.55, pr * 0.55, '#1a1008');
      }
      P(g, [-0.4, -11.4, 1.4, -11.4, 0.5, -9.2], '#e8a030');
      P(g, [-2, 0, -0.6, 0, -1.3, 1.6], '#e8a030'); P(g, [1.6, 0, 3, 0, 2.3, 1.6], '#e8a030');
    } },
    gull: { top: 13, draw(g) {
      P(g, [-1, 0, 0, 0, 0, -3, -1, -3], '#e89040'); P(g, [2, 0, 3, 0, 3, -3, 2, -3], '#e89040');
      art.facet(g, 0, -6, 7, 3.8, 7, '#f6f6f2', 0.1, 0.1);
      P(g, [-8, -6, -2, -8.6, 4, -6.6, -2, -4.6], '#9aa4b0');
      P(g, [-8, -6, -11, -5, -9, -4], '#4a5058');
      art.facet(g, 5, -10, 3.2, 3, 6, '#f8f8f6', 0.2, 0.08);
      P(g, [7.6, -10.4, 11, -9.6, 7.8, -9], '#f0b030');
      E(g, 6, -10.8, 0.6, 0.7, '#1a1a1a');
    } },
    slime: { top: 14, draw(g, v) { g.save(); g.scale(0.62, 0.62); art.monster.slime(g, { t: 0.3, atk: 0, color: v.col || '#58c7a8' }); g.restore(); } },
    rabbit: { top: 22, draw(g) { g.save(); g.scale(0.6, 0.6); art.monster.rabbit(g, { t: 0, atk: 0 }); g.restore(); } },
    mush: { top: 18, draw(g, v) { g.save(); g.scale(0.55, 0.55); art.monster.mushroom(g, { t: 0.3, atk: 0, color: v.col }); g.restore(); } },
    crab: { top: 14, draw(g) { g.save(); g.scale(0.42, 0.42); art.monster.crab(g, { t: 0.3, atk: 0 }); g.restore(); } },
    pumpkin: { top: 18, draw(g) { g.save(); g.scale(0.5, 0.5); art.monster.pumpkin(g, { t: 0.3, atk: 0 }); g.restore(); } },
    imp: { top: 18, draw(g, v) {
      const col = '#5a2a72';
      g.strokeStyle = '#3a1a4a'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(-11, -2, -10, -9); g.stroke();
      P(g, [-11.4, -9, -9, -12, -8.4, -8.4], '#3a1a4a');
      P(g, [-3, -11, -12, -16, -10, -10, -13, -8, -4, -7], '#3a1a4a');
      P(g, [3, -11, 12, -16, 10, -10, 13, -8, 4, -7], '#4a2458');
      art.facet(g, 0, -8, 6.6, 7.4, 8, col, 0, 0.18);
      P(g, [-4, -13, -6, -19, -2, -14.4], '#e8d8c0'); P(g, [4, -13, 6, -19, 2, -14.4], '#d8c8b0');
      E(g, -2.2, -9.6, 1.4, v.wide ? 2 : 1.4, '#ffe24a'); E(g, 2.6, -9.6, 1.4, v.wide ? 2 : 1.4, '#ffe24a');
      if (v.wide) { E(g, -2.2, -9.4, 0.5, 0.7, '#1a0a1a'); E(g, 2.6, -9.4, 0.5, 0.7, '#1a0a1a'); }
      P(g, [-3, -5.6, 3.4, -5.6, 2, -3.6, -1.6, -3.6], '#2a0a2a');
      P(g, [-2.2, -5.6, -1.4, -5.6, -1.8, -4.6], '#ffffff'); P(g, [1.4, -5.6, 2.2, -5.6, 1.8, -4.6], '#ffffff');
    } },
    ghost: { top: 22, draw(g, v) {
      art.facetPoly(g, [-8, 0, -6, -3, -3, 0, 0, -3, 3, 0, 6, -3, 8, 0, 8, -12, 5, -19, 0, -21, -5, -19, -8, -12], '#f2f0ff', 0.1);
      E(g, -2.6, -12, 1.5, v.wide ? 2.6 : 2, '#2a2440'); E(g, 3, -12, 1.5, v.wide ? 2.6 : 2, '#2a2440');
      E(g, 0.3, -7.6, 1.4, v.wide ? 1.8 : 1, '#2a2440');
      E(g, -5, -9, 1.4, 0.8, 'rgba(255,140,170,0.5)'); E(g, 5.6, -9, 1.4, 0.8, 'rgba(255,140,170,0.5)');
    } },
    spirit: { top: 16, draw(g) {
      art.facetPoly(g, [0, 0, -7, -5, -8, -11, -4, -16, 2, -16, 6, -12, 5, -6], '#f4fbff', 0.1);
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-3, 4, -9, 3); g.quadraticCurveTo(-13, 1, -11, -2); g.stroke();
      E(g, -2.4, -10, 0.9, 1.3, '#4a5a8a'); E(g, 1.6, -10, 0.9, 1.3, '#4a5a8a');
      E(g, -4, -7.6, 1.2, 0.6, 'rgba(255,150,190,0.55)'); E(g, 3.2, -7.6, 1.2, 0.6, 'rgba(255,150,190,0.55)');
    } },
    goblin: { top: 13, draw(g, v) {
      P(g, [-5, -6, -13, -10, -6, -3], '#5a8a3a'); P(g, [5, -6, 13, -10, 6, -3], '#6a9a44');
      art.facet(g, 0, -5, 6, 5.6, 8, '#7ab04a', 0.2, 0.16);
      E(g, -2.4, -6.4, 1.6, v.wide ? 2.2 : 1.6, '#fff4a0'); E(g, 2.6, -6.4, 1.6, v.wide ? 2.2 : 1.6, '#fff4a0');
      E(g, -2, -6.2, 0.6, 0.8, '#1a1a0a'); E(g, 3, -6.2, 0.6, 0.8, '#1a1a0a');
      P(g, [-1.4, -3.4, 1.8, -3.4, 0.2, -1.6], '#3a5a22');
      P(g, [-4, -9.6, 4, -9.6, 3, -12, -3, -12], '#6a5a4a');
    } },
    hatch: { top: 16, draw(g) {
      P(g, [-2, 4, -3, -6, 1, -10, 4, -6, 3, 4], '#5fae7a');
      art.facet(g, 2, -11, 5, 4.2, 7, '#6cc088', 0.3, 0.14);
      P(g, [5, -11.6, 9.4, -10.4, 5.4, -8.6], '#7ad09a');
      P(g, [-3, -13, -2, -17, 0, -14.8, 1.6, -17.6, 3, -15, 5, -17.4, 6.4, -13, 2, -12], '#f6f2e6');
      E(g, 3.4, -11.6, 0.9, 1.1, '#1a1a0a'); E(g, 3.7, -12, 0.3, 0.3, '#ffffff');
    } },
  };
  function creSpr(kind, v, vk) {
    return sprite('c' + kind + vk, -24, -34, 48, 40, (g) => CRE[kind].draw(g, v));
  }
  function drawCreature(a, r, x, y, t) {
    const def = CRE[a.kind];
    const v = a.v || {};
    let vk = a.vk || '';
    let vv = v;
    if (a.kind === 'cat') { const sl = r.pose === 'sleep'; vk += sl ? 's' : 'a'; vv = sl ? a.vSleep || (a.vSleep = Object.assign({}, v, { sleep: true })) : v; }
    else if (a.kind === 'dog' && (r.pose === 'cheer' || r.pose === 'wave' || M.k === 'win')) { vk += 'h'; vv = a.vHappy || (a.vHappy = Object.assign({}, v, { happy: true })); }
    else if ((a.kind === 'owl' || a.kind === 'imp' || a.kind === 'ghost' || a.kind === 'goblin') && (r.pose === 'surprise' || r.pose === 'cower' || r.pose === 'flee')) { vk += 'w'; vv = a.vWide || (a.vWide = Object.assign({}, v, { wide: true })); }
    else if (a.kind === 'owl' && r.blink) { vk += 'b'; vv = a.vShut || (a.vShut = Object.assign({}, v, { shut: true })); }
    const s = creSpr(a.kind, vv, a.kind + vk);
    const k = a.s;
    let sq = r.sq, hop = r.hop;
    if (r.pose === 'laugh' && !RM) sq *= 1 + Math.sin(t * 30) * 0.06;
    if (r.pose === 'hide') { hop += 6 * k; sq *= 0.9; }
    if (a.kind === 'dog' && !RM) {
      // しっぽ
      const w = Math.sin(t * (r.pose === 'cheer' || M.k === 'win' ? 22 : 6)) * 0.5;
      const bx = x + r.dx - 4 * k * (r.face < 0 ? -1 : 1), by = y + hop - 3 * k;
      c.strokeStyle = G.shade(v.col || '#c8925a', -0.1); c.lineWidth = 2 * k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - Math.cos(w) * 6 * k * (r.face < 0 ? -1 : 1), by - Math.sin(w + 1) * 6 * k); c.stroke();
    }
    blit(s, x + r.dx, y + hop, r.face < 0 ? -k : k, k * sq, r.rot);
    void def;
  }

  // ---------------------------------------------------------------- 顔ぶれ（冒険譚ごと）
  const cfgCache = new Map();
  function actor(cf, kind, side, x, y, s, extra) {
    const a = { kind, side, x, y, s, par: 0.8, seed: cf.r(), face: 0, flee: true, id: cf.seed + '_' + cf.cast.length };
    if (extra) Object.assign(a, extra);
    a.delay = 0.02 + a.seed * 0.16;
    if (CRE[kind]) a.top = CRE[kind].top;
    else { a.person = true; a.look = lookOf(cf.r, kind); a.top = 40 * (a.look.height || 1); }
    cf.cast.push(a);
    return a;
  }
  function cfgOf(reel) {
    let cf = cfgCache.get(reel.id);
    if (cf) return cf;
    const seed = ((reel.seed || 7) ^ 0x2545f491) >>> 0;
    cf = { seed, r: rng(seed), area: reel.area, cast: [] };
    const f = SETUP[reel.area];
    if (f) f(cf, cf.r, reel);
    // 背景の雲・鳥・風の位相
    cf.ph = cf.r() * 100;
    if (cfgCache.size > 40) cfgCache.clear();
    cfgCache.set(reel.id, cf);
    return cf;
  }
  function drawActor(a, t) {
    const wx = sx(a.x, a.par) + (a.bobX ? Math.sin(t * a.bobX + a.seed * 9) * 10 : 0);
    let wy = GY + a.y + (a.bob ? Math.sin(t * 1.3 + a.bobP) * a.bob : 0);
    if (a.ridge) wy = a.ridge(wx) + (a.bob ? Math.sin(t * 1.3 + a.bobP) * a.bob : 0);
    const r = react(a, wx, t);
    if (r.pose === 'flee' && Math.abs(r.dx) > 420) return;
    if (a.ride) r.dx = 0; // 乗り物ごと動かす子は乗り物の位置に合わせる
    const x = wx, y = wy;
    if (a.alphaK != null) c.globalAlpha = a.alphaK * (r.pose === 'flee' ? 1 - seg(r.md, 0.4, 1.4) : r.pose === 'surprise' && a.kind === 'ghost' ? 0.45 : 1);
    if (a.person) drawPerson(a, r, x, y, t);
    else drawCreature(a, r, x, y, t);
    if (a.alphaK != null) c.globalAlpha = 1;
    if (r.mark && r.mk > 0) {
      const top = a.top * a.s * (r.pose === 'sleep' ? 0.7 : 1);
      drawMark(r.mark, x + r.dx + (r.face < 0 ? -4 : 4), y + r.hop - top - 9, r.mk * (a.markK || 1), r.md);
    }
  }
  function drawCast(filter) {
    const cs = CF.cast;
    for (let i = 0; i < cs.length; i++) if (!filter || cs[i].layer === filter) drawActor(cs[i], T);
  }

  // ---------------------------------------------------------------- 雲・鳥
  function cloudSpr(v, tint) {
    return sprite('cl' + v + tint, -64, -40, 128, 46, (g) => {
      const B = [
        [[-34, -9, 18, 12], [-12, -17, 22, 18], [14, -14, 19, 15], [36, -7, 15, 10]],
        [[-28, -8, 15, 11], [-6, -15, 20, 16], [20, -10, 16, 12]],
        [[-40, -6, 13, 9], [-20, -13, 17, 13], [4, -18, 20, 17], [28, -11, 16, 12], [46, -5, 11, 8]],
      ][v % 3];
      const sh = G.mix(tint, '#c8d4ee', 0.35);
      B.forEach(([x, y, rx, ry], i) => art.facet(g, x, y + 2.5, rx, ry, 7, sh, i * 0.7, 0.05));
      B.forEach(([x, y, rx, ry], i) => art.facet(g, x - 1.5, y - 0.5, rx * 0.9, ry * 0.86, 7, tint, i * 0.7 + 0.3, 0.05));
      P(g, [-56, 0, 56, 0, 50, -6, -50, -6], sh);
    });
  }
  function clouds(n, y0, y1, sp, kmin, kmax, a, tint, par) {
    for (let i = 0; i < n; i++) {
      const h1 = hh(CF.seed, i * 3 + 1), h2 = hh(CF.seed, i * 3 + 2);
      const span = 520;
      const x = wrapX(h1 * span - T * sp * (0.7 + h2 * 0.6) - SC * par, span, 80);
      const y = lerp(y0, y1, h2);
      const k = lerp(kmin, kmax, hh(CF.seed, i * 3 + 3));
      c.globalAlpha = a;
      blit(cloudSpr(i, tint), x, y, k, k * 0.9, 0);
    }
    c.globalAlpha = 1;
  }
  // V 字の鳥の群れ（羽ばたき）。1本の線でまとめて描く
  function flock(x, y, n, k, t, col, lw, dir) {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
      const bx = x - dir * row * 10 * k, by = y + (i ? side * row * 6 * k : 0) + Math.sin(t * 1.3 + i) * 1.5;
      const fl = Math.sin(t * 9 + i * 1.7) * 2.8 * k, w = 5.4 * k;
      c.moveTo(bx - w, by - fl);
      c.quadraticCurveTo(bx - w * 0.4, by - 2.4 * k, bx, by);
      c.quadraticCurveTo(bx + w * 0.4, by - 2.4 * k, bx + w, by - fl);
    }
    c.stroke();
  }
  // 周期ごとに空を横切る群れ
  function flocks(n, y0, y1, period, k, col, lw) {
    for (let i = 0; i < n; i++) {
      const ph = hh(CF.seed, 40 + i) * period;
      const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
      const dir = hh(cyc, 41 + i) < 0.5 ? 1 : -1;
      const sp = 26 + hh(cyc, 42 + i) * 14;
      const x = dir > 0 ? -60 + lt * sp : 420 - lt * sp;
      if (x < -80 || x > 440) continue;
      const y = lerp(y0, y1, hh(cyc, 43 + i)) + Math.sin(lt * 0.8) * 6;
      flock(x, y, 3 + Math.floor(hh(cyc, 44 + i) * 4), k, T + i, col, lw, dir);
    }
  }
  // 1羽のコウモリ（羽ばたき）
  function batPath(x, y, k, fl) {
    c.moveTo(x, y - 1.4 * k);
    c.lineTo(x + 3 * k, y - 2.8 * k);
    c.lineTo(x + 9 * k, y - 4 * k - fl * k);
    c.lineTo(x + 7 * k, y + 0.4 * k);
    c.lineTo(x + 4.4 * k, y - 0.4 * k);
    c.lineTo(x + 2.4 * k, y + 2 * k);
    c.lineTo(x, y + 1.6 * k);
    c.lineTo(x - 2.4 * k, y + 2 * k);
    c.lineTo(x - 4.4 * k, y - 0.4 * k);
    c.lineTo(x - 7 * k, y + 0.4 * k);
    c.lineTo(x - 9 * k, y - 4 * k - fl * k);
    c.lineTo(x - 3 * k, y - 2.8 * k);
    c.closePath();
  }

  // ---------------------------------------------------------------- 花火（伝説級・ボスの勝利）
  function fireworks(y0, y1, cols) {
    if (M.k !== 'win' || (M.hype < 2 && !M.boss) || RM) return;
    const d = M.d - 0.25;
    if (d < 0) return;
    for (let j = 0; j < 3; j++) {
      const period = 1.5, ph = j * 0.5;
      const cyc = Math.floor((d + ph) / period), lt = (d + ph) - cyc * period;
      if (cyc < 0 || cyc > 8) continue;
      const x = 40 + hh(cyc, 60 + j) * 280, y = lerp(y0, y1, hh(cyc, 61 + j));
      const col = cols[(cyc + j) % cols.length];
      if (lt < 0.35) {
        // 打ち上げ
        const yy = lerp(y + 140, y, G.ease.outCubic(lt / 0.35));
        c.fillStyle = col;
        c.fillRect(x - 0.8, yy, 1.6, 5);
        continue;
      }
      const e = lt - 0.35, R = 34 * G.ease.outCubic(Math.min(1, e / 0.7));
      const a = 1 - seg(e, 0.5, 1.1);
      if (a <= 0) continue;
      c.globalAlpha = a;
      c.strokeStyle = col; c.lineWidth = 1.6; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 14; i++) {
        const an = (i / 14) * TAU + cyc;
        const gx = Math.cos(an), gy = Math.sin(an);
        const drop = e * e * 14;
        c.moveTo(x + gx * R * 0.7, y + gy * R * 0.7 + drop);
        c.lineTo(x + gx * R, y + gy * R + drop);
      }
      c.stroke();
      glow(x, y, R * 1.3, 'fw' + col, [0, G.rgba(col, 0.35), 1, G.rgba(col, 0)], a * 0.6);
      c.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- 風（風のタクト風：流れてクルンと巻く線）
  const WIND = [];
  function windTpl(v) {
    if (WIND[v]) return WIND[v];
    const p = [];
    const L1 = 110 + (v % 3) * 28, r = 11 + (v % 2) * 4;
    for (let i = 0; i <= 14; i++) { const u = i / 14; p.push(u * L1, Math.sin(u * Math.PI * 1.3 + v) * 3.5); }
    const ex = p[p.length - 2], ey = p[p.length - 1];
    const cx = ex, cy = ey - r;
    const spiral = v % 2 === 1;
    const turns = spiral ? 1.35 : 1;
    const steps = spiral ? 30 : 22;
    for (let i = 1; i <= steps; i++) {
      const th = (i / steps) * TAU * turns;
      const rr = spiral ? r * (1 - (i / steps) * 0.72) : r;
      p.push(cx + Math.sin(th) * rr, cy + Math.cos(th) * rr);
    }
    if (!spiral) {
      const lx = p[p.length - 2], ly = p[p.length - 1];
      for (let i = 1; i <= 8; i++) { const u = i / 8; p.push(lx + u * 60, ly - Math.sin(u * Math.PI * 0.5) * 6); }
    }
    const len = [0];
    for (let i = 2; i < p.length; i += 2) len.push(len[len.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
    WIND[v] = { p, len, total: len[len.length - 1] };
    return WIND[v];
  }
  const tmpPt = [0, 0, 0];
  function windPoint(w, s) {
    const L = w.len, p = w.p;
    let i = 1;
    while (i < L.length - 1 && L[i] < s) i++;
    const f = clamp((s - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]), 0, 1);
    tmpPt[0] = lerp(p[(i - 1) * 2], p[i * 2], f);
    tmpPt[1] = lerp(p[(i - 1) * 2 + 1], p[i * 2 + 1], f);
    tmpPt[2] = Math.atan2(p[i * 2 + 1] - p[(i - 1) * 2 + 1], p[i * 2] - p[(i - 1) * 2]);
    return tmpPt;
  }
  function windStroke(w, s0, s1) {
    const L = w.len, p = w.p;
    let started = false;
    c.beginPath();
    for (let i = 0; i < L.length; i++) {
      if (L[i] < s0) continue;
      if (!started) {
        if (i > 0) {
          const f = (s0 - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]);
          c.moveTo(lerp(p[(i - 1) * 2], p[i * 2], f), lerp(p[(i - 1) * 2 + 1], p[i * 2 + 1], f));
        } else c.moveTo(p[0], p[1]);
        started = true;
      }
      if (L[i] > s1) {
        const f = (s1 - L[i - 1]) / Math.max(0.001, L[i] - L[i - 1]);
        c.lineTo(lerp(p[(i - 1) * 2], p[i * 2], f), lerp(p[(i - 1) * 2 + 1], p[i * 2 + 1], f));
        break;
      }
      c.lineTo(p[i * 2], p[i * 2 + 1]);
    }
    c.stroke();
  }
  // n 本の風。y0..y1 の高さを流れる。carry: 一緒に運ばれる葉・花びら
  function winds(n, y0, y1, col, carry, dirBias) {
    if (RM) n = Math.min(n, 1);
    const gust = sinceImp(0.8) < 0.6 ? 1 : 0; // 大技のあとは突風
    for (let j = 0; j < n + gust; j++) {
      const period = 2.4 + hh(CF.seed, 70 + j) * 1.6;
      const ph = hh(CF.seed, 71 + j) * period + CF.ph;
      const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
      const isGust = j >= n;
      const v = Math.floor(hh(cyc, 72 + j) * 6);
      const w = windTpl(v);
      const speed = 230 + hh(cyc, 73 + j) * 80;
      const trail = 70 + hh(cyc, 74 + j) * 40;
      const dur = (w.total + trail) / speed;
      const lt2 = isGust ? sinceImp(0.8) : lt;
      if (lt2 > dur || lt2 < 0) continue;
      const head = lt2 * speed, tail = head - trail;
      const dir = isGust ? 1 : (hh(cyc, 75 + j) < (dirBias != null ? dirBias : 0.8) ? 1 : -1);
      const k = 0.8 + hh(cyc, 76 + j) * 0.5;
      const x0 = dir > 0 ? -30 + hh(cyc, 77 + j) * 150 : 390 - hh(cyc, 77 + j) * 150;
      const y = isGust ? GY - 70 - hh(cyc, 78) * 80 : lerp(y0, y1, hh(cyc, 78 + j));
      const a = Math.min(1, lt2 * 6) * (1 - seg(lt2, dur - 0.25, dur));
      c.save();
      c.translate(x0 + lt2 * 26 * dir, y);
      c.scale(dir * k, k);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.globalAlpha = a * 0.85;
      c.strokeStyle = col;
      c.lineWidth = 2.4 / k;
      windStroke(w, Math.max(0, tail), Math.min(w.total, head));
      c.globalAlpha = a * 0.45;
      c.lineWidth = 1.2 / k;
      c.translate(-8, 6);
      windStroke(w, Math.max(0, tail + 20), Math.min(w.total, head - 30));
      c.restore();
      if (carry && head < w.total + 10) {
        const pt = windPoint(w, Math.min(w.total, head - 6));
        const lx = x0 + lt2 * 26 * dir + pt[0] * dir * k, ly = y + pt[1] * k;
        carry(lx, ly, lt2 * 9 + j, a);
      }
    }
  }
  function leaf(x, y, rot, col, k) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k);
    P(c, [-3.4, 0, 0, -1.8, 3.4, 0, 0, 1.8], col);
    c.restore();
  }
  function petal(x, y, rot, col, k) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k * (0.4 + Math.abs(Math.sin(rot * 1.7)) * 0.6));
    P(c, [-2.6, 0, -1, -2, 2, -1.6, 2.6, 0, 1, 1.8, -1.6, 1.4], col);
    c.restore();
  }
  // 漂う粒（花びら・葉・雪・火の粉）
  function drift(n, sp, fall, cols, kind, yTop, yBot, k) {
    if (RM) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const h1 = hh(CF.seed, 90 + i), h2 = hh(CF.seed, 91 + i), h3 = hh(CF.seed, 92 + i);
      const span = 420;
      const x = wrapX(h1 * span + T * sp * (0.6 + h2 * 0.8) + Math.sin(T * 1.3 + i) * 10 - SC * 0.9, span, 30);
      const H = yBot - yTop;
      const y = yTop + fr(h3 + T * fall * (0.5 + h2) / H) * H;
      const rot = T * (1.5 + h2 * 2) + i;
      const col = cols[i % cols.length];
      if (kind === 'petal') petal(x, y, rot, col, k);
      else if (kind === 'leaf') leaf(x, y, rot, col, k);
      else if (kind === 'ember') { c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 6 + i * 2); c.fillStyle = col; c.fillRect(x, y, 2 * k, 2 * k); c.globalAlpha = 1; }
      else if (kind === 'snow') { c.fillStyle = col; c.beginPath(); c.arc(x, y, 1.3 * k, 0, TAU); c.fill(); }
      else if (kind === 'mote') { c.globalAlpha = 0.25 + 0.35 * Math.sin(T * 1.7 + i * 3); c.fillStyle = col; c.fillRect(x, y, 1.4 * k, 1.4 * k); c.globalAlpha = 1; }
    }
  }
  // 蛍：ふわふわ明滅
  function fireflies(n, x0, x1, y0, y1, col) {
    if (RM) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const h1 = hh(CF.seed, 120 + i), h2 = hh(CF.seed, 121 + i);
      const x = lerp(x0, x1, h1) + Math.sin(T * (0.5 + h2) + i * 2) * 18 + Math.sin(T * 1.7 + i) * 4;
      const y = lerp(y0, y1, h2) + Math.cos(T * (0.6 + h1 * 0.5) + i) * 12;
      const b = Math.max(0, Math.sin(T * (1.4 + h2) + i * 3));
      if (b < 0.05) continue;
      glow(x, y, 9, 'ff' + col, [0, G.rgba(col, 0.6), 1, G.rgba(col, 0)], b);
      c.fillStyle = G.rgba('#ffffff', 0.6 + b * 0.4);
      c.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
  }

  // ---------------------------------------------------------------- エリアごとの顔ぶれ
  const SETUP = {
    meadow(cf, r) {
      // 丘の上の町の人（左）＋ 草むらの魔物（真ん中）
      const pool = ['kid', 'kid', 'farmer', 'girl', 'elder', 'dog', 'sheep'];
      const n = 2 + (r() < 0.6 ? 1 : 0);
      const used = {};
      for (let i = 0; i < n; i++) {
        let k = pickR(r, pool);
        if (used[k] && k !== 'kid') k = 'kid';
        used[k] = 1;
        const x = 14 + i * 24 + r() * 6;
        const a = actor(cf, k, k === 'dog' || k === 'sheep' ? 'animal' : 'friend', x, 0, k === 'dog' || k === 'sheep' ? 1.05 : 1, { layer: 'hill', par: 0.55, wave: r() < 0.7 });
        if (k === 'farmer') { a.hat = 'straw'; a.tool = 'fork'; }
        if (k === 'kid' && r() < 0.35) a.hat = 'straw';
        if (k === 'dog') a.v = { col: pickR(r, ['#c8925a', '#e8e0d0', '#6a5a4a']) };
        if (k === 'elder') a.clapper = true;
      }
      const g = pickR(r, ['slime', 'slime', 'rabbit', 'cat']);
      if (g === 'slime') {
        actor(cf, 'slime', 'foe', 186, -3, 0.95, { layer: 'gap', v: { col: '#58c7a8' }, vk: 'g' });
        if (r() < 0.6) actor(cf, 'slime', 'foe', 204, -1, 0.75, { layer: 'gap', v: { col: pickR(r, ['#7ab0e8', '#e8a0c0', '#f0d060']) }, vk: 'p' + Math.floor(r() * 9) });
      } else if (g === 'rabbit') actor(cf, 'rabbit', 'foe', 194, -2, 0.9, { layer: 'gap' });
      else actor(cf, 'cat', 'animal', 194, -2, 1.05, { layer: 'gap', sleeper: true, v: { col: pickR(r, ['#e8a050', '#9a9aa4', '#3a3440']), stripe: r() < 0.5 } });
      cf.sheep = 2 + Math.floor(r() * 3);
      cf.mill = r() < 0.75;
    },
    forest(cf, r) {
      actor(cf, 'owl', 'animal', 86, 0, 1, { layer: 'branch', par: 0.6 });
      if (r() < 0.7) actor(cf, 'squirrel', 'animal', 58, 0, 1, { layer: 'branch', par: 0.6, face: r() < 0.5 ? 1 : 0 });
      if (r() < 0.65) actor(cf, 'rival', 'rival', 24, -2, 1, { layer: 'ground', par: 0.8 });
      const n = 2 + (r() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) actor(cf, 'mush', 'foe', 180 + i * 14 + r() * 4, -2 + i % 2, 0.8 + r() * 0.3, { layer: 'gap', v: { col: pickR(r, ['#d6574a', '#e8a040', '#b06ad0']) }, vk: '' + i });
      cf.deer = r() < 0.8;
    },
    cave(cf, r) {
      actor(cf, 'miner', 'friend', 30, 0, 0.92, { layer: 'ledge', par: 0.55, hat: 'helmet', clapper: r() < 0.5 });
      actor(cf, 'goblin', 'foe', 196, 0, 1.25, { layer: 'cart', par: 0.8, flee: true, ride: true });
      cf.bats = [];
      // 低く垂れた鍾乳石の先にだけぶら下がる（上は画面の帯に隠れるので）
      for (let i = 0; i < 9; i++) if (30 + hash(i * 3) * 60 > 52 && r() < 0.8) cf.bats.push(i);
      if (cf.bats.length < 2) cf.bats.push(2, 6);
      cf.eyes = [0, 1, 2].map((i) => ({ x: 40 + i * 110 + r() * 60, y: 0.3 + r() * 0.14, s: 1.3 + r() * 0.6, ph: r() * 10 }));
    },
    castle(cf, r) {
      cf.band = 3 + (r() < 0.5 ? 1 : 0);
      cf.style = [0, 1, 2, 3].map(() => Math.floor(r() * 3));
      actor(cf, 'ghost', 'foe', 198, -112, 0.95, { layer: 'air', par: 0.6, bob: 4, bobP: r() * 6, bobX: 0.5, alphaK: 0.82 });
      cf.crows = r() < 0.8;
    },
    peak(cf, r) {
      actor(cf, 'monk', 'friend', 12, 0, 0.95, { layer: 'crag', par: 0.5, sitter: true, clapper: true });
      actor(cf, 'goat', 'animal', 40, 0, 1, { layer: 'crag', par: 0.5 });
      if (r() < 0.6) actor(cf, 'goat', 'animal', 74, 0, 0.85, { layer: 'crag2', par: 0.5, face: -1 });
      actor(cf, 'hatch', 'foe', 196, -44, 1.05, { layer: 'nest', par: 0.8, flee: false });
    },
    harbor(cf, r) {
      const a = actor(cf, 'sailor', 'friend', 182, -38, 0.92, { layer: 'crate', hat: r() < 0.7 ? 'cap' : null, wave: true });
      void a;
      actor(cf, 'cat', 'animal', 168, -19, 0.95, { layer: 'crate', sleeper: r() < 0.6, v: { col: pickR(r, ['#e8a050', '#9a9aa4', '#f0ece4']), stripe: r() < 0.5 } });
      actor(cf, 'gull', 'animal', 202, -25, 1.1, { layer: 'post', par: 0.9 });
      if (r() < 0.7) actor(cf, 'crab', 'foe', 222, 0, 0.9, { layer: 'pier' });
    },
    sky(cf, r) {
      const n = 2 + (r() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) actor(cf, 'skyfolk', 'friend', 180 + i * 17, -152, 0.9, { layer: 'islet', par: 0.5, wings: true, hat: 'halo', bob: 4, bobP: 0, clapper: i === 1 });
      for (let i = 0; i < 2; i++) actor(cf, 'spirit', 'animal', 50 + i * 46, -170 + i * 16, 0.95, { layer: 'air', par: 0.4, bob: 6, bobP: i * 2, bobX: 0.7 });
    },
    abyss(cf, r) {
      actor(cf, 'imp', 'foe', 61, -128, 0.95, { layer: 'pillar', par: 0.7 });
      actor(cf, 'imp', 'foe', 211, -128, 0.9, { layer: 'pillar', par: 0.7 });
      cf.eyeX = [110 + r() * 40, 290 + r() * 30];
    },
  };

  // ---------------------------------------------------------------- 空（遠景より奥）
  const SKY = {
    meadow(area) {
      const sunX = 290, sunY = 90;
      glow(sunX, sunY, 110, 'sunM', [0, 'rgba(255,248,200,0.55)', 0.35, 'rgba(255,240,180,0.18)', 1, 'rgba(255,240,180,0)'], 0.9 + Math.sin(T * 1.3) * 0.1);
      rays(sunX, sunY, 30, 74, 14, T * 0.12, 0.09, '#fffbe0', 0.32 + Math.sin(T * 1.7) * 0.06);
      rays(sunX, sunY, 28, 52, 10, -T * 0.07 + 0.3, 0.12, '#fff4c0', 0.22);
      clouds(3, 40, 190, 3, 0.45, 0.7, 0.8, '#ffffff', 0.03);
      flocks(1, 120, 220, 16, 0.85, 'rgba(60,70,90,0.55)', 1.2);
      // 遠くの丘：風車と羊
      const ridge = (x) => ridgeY(x, 60, GY - 70, 6, 0.15, 11, false);
      if (CF.mill) windmill(sx(64, 0.15), ridge, area);
      for (let i = 0; i < CF.sheep; i++) {
        const x = sx(150 + hh(CF.seed, 30 + i) * 200, 0.15);
        const hop = sinceImp(0.8) < 0.5 ? bump(sinceImp(0.8) / 0.5) * 4 : 0;
        const graze = Math.sin(T * 0.6 + i * 2) > 0.3 ? 1 : 0;
        blit(creSpr('sheep', {}, 'sheep'), x, ridge(x) + 1.5 - hop, (i % 2 ? -0.42 : 0.42), 0.42, graze * 0.12 * (i % 2 ? -1 : 1));
      }
      fireworks(70, 180, ['#ff8ac0', '#ffe070', '#8ad8ff', '#a8ff9a']);
    },
    forest(area) {
      glow(54, 26, 120, 'sunF', [0, 'rgba(255,252,220,0.6)', 0.3, 'rgba(255,248,200,0.2)', 1, 'rgba(255,248,200,0)'], 0.8 + Math.sin(T * 1.1) * 0.1);
      rays(54, 26, 26, 90, 12, T * 0.09, 0.07, '#fffbe6', 0.25);
      art.facet(c, 54, 26, 18, 18, 10, '#fff8d8', T * 0.1, 0.06);
      clouds(2, 30, 120, 3, 0.4, 0.6, 0.7, '#f4fff8', 0.03);
      flocks(1, 70, 150, 18, 0.7, 'rgba(30,50,40,0.5)', 1.1);
      if (CF.deer) {
        const ridge = (x) => ridgeY(x, 70, GY - 80, 7, 0.15, 31, true);
        const x = sx(250, 0.15) + Math.sin(T * 0.15) * 6;
        const alert = (M.k === 'crit' || M.k === 'skill' || M.k === 'bighurt') && M.d < 1.2;
        const run = M.k === 'win' ? G.ease.inCubic(seg(M.d, 0.3, 2)) * 200 : 0;
        deer(x + run, ridge(x + run), area.pal.far, alert, run > 0);
      }
      fireworks(50, 140, ['#ffe070', '#a8ff9a', '#ff9ad0']);
    },
    castle(area) {
      // 星（またたき）と流れ星
      for (let i = 0; i < 34; i++) {
        const x = hh(CF.seed, 200 + i) * 380 - 10, y = 46 + hh(CF.seed, 201 + i) * (GY - 230);
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(T * (0.8 + hh(i, 3) * 2) + i));
        if (i < 6) {
          c.globalAlpha = tw;
          const s = 2.4 + tw;
          P(c, [x, y - s, x + s * 0.3, y - s * 0.3, x + s, y, x + s * 0.3, y + s * 0.3, x, y + s, x - s * 0.3, y + s * 0.3, x - s, y, x - s * 0.3, y - s * 0.3], '#fff8e0');
        } else { c.globalAlpha = tw * 0.8; c.fillStyle = '#f4f0ff'; c.fillRect(x, y, 1.4, 1.4); }
      }
      c.globalAlpha = 1;
      shootingStar(40, 160);
      // 月の暈と、ゆっくり回る月光
      glow(80, 80, 92, 'moonC', [0, 'rgba(250,244,255,0.5)', 0.3, 'rgba(220,210,255,0.16)', 1, 'rgba(200,190,255,0)'], 0.85 + Math.sin(T * 0.9) * 0.15);
      rays(80, 80, 26, 64, 16, T * 0.05, 0.05, '#f4f0ff', 0.18 + Math.sin(T * 1.2) * 0.05);
      c.strokeStyle = 'rgba(240,236,255,0.25)'; c.lineWidth = 1;
      c.beginPath(); c.arc(80, 80, 30 + Math.sin(T * 0.8) * 2, 0, TAU); c.stroke();
      // 月を横切るコウモリ
      const period = 9, cyc = Math.floor((T + CF.ph) / period), lt = (T + CF.ph) - cyc * period;
      if (lt < 5) {
        c.fillStyle = 'rgba(30,20,40,0.85)';
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const x = -20 + lt * 48 + i * 16 - Math.sin(i) * 6, y = 70 + Math.sin(lt * 2 + i * 2) * 10 + i * 9 + hh(cyc, i) * 20;
          batPath(x, y, 0.85, Math.sin(T * 16 + i * 2) * 3);
        }
        c.fill();
      }
      fireworks(60, 170, ['#ffb3d0', '#ffe070', '#b8a8ff', '#ffffff']);
    },
    peak(area) {
      // 夕日の光（遠い山の向こうで回る）
      glow(270, 110, 150, 'sunP', [0, 'rgba(255,236,170,0.65)', 0.3, 'rgba(255,190,120,0.22)', 1, 'rgba(255,170,110,0)'], 0.9 + Math.sin(T * 1.2) * 0.1);
      rays(270, 110, 40, 110, 16, T * 0.08, 0.06, '#fff0c0', 0.24 + Math.sin(T * 1.5) * 0.05);
      rays(270, 110, 38, 76, 12, -T * 0.05, 0.1, '#ffd8a0', 0.18);
      // 山の向こうを飛ぶ竜の影
      const period = 15, ph = CF.ph % period;
      const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
      const dir = hh(cyc, 9) < 0.5 ? 1 : -1;
      const x = dir > 0 ? -60 + lt * 32 : 420 - lt * 32;
      if (x > -70 && x < 430) dragonShadow(x, GY - 200 + Math.sin(lt * 0.5) * 26 + hh(cyc, 8) * 30, dir, G.shade(area.pal.far, -0.32), 0.9);
      flocks(1, 150, 230, 20, 0.8, 'rgba(70,30,30,0.5)', 1.2);
      fireworks(60, 150, ['#ffe08a', '#ff9a6a', '#ffffff']);
    },
    harbor(area) {
      glow(280, 80, 110, 'sunH', [0, 'rgba(255,250,215,0.6)', 0.35, 'rgba(255,240,190,0.18)', 1, 'rgba(255,240,190,0)'], 0.9 + Math.sin(T * 1.3) * 0.1);
      rays(280, 80, 28, 70, 14, T * 0.11, 0.09, '#fffbe6', 0.3 + Math.sin(T * 1.6) * 0.06);
      clouds(3, 40, 170, 4, 0.45, 0.75, 0.8, '#ffffff', 0.03);
      // 水平線の向こうの船（帆だけ見える）
      const hz = GY - 64;
      const shx = wrapX(320 - T * 2.2 - SC * 0.05, 480, 60);
      P(c, [shx, hz + 1, shx, hz - 14, shx + 7, hz - 3], 'rgba(240,236,228,0.8)');
      P(c, [shx - 1, hz + 1, shx - 1, hz - 11, shx - 6, hz - 2], 'rgba(220,216,210,0.75)');
      flocks(1, 110, 190, 14, 0.8, 'rgba(255,255,255,0.85)', 1.3);
      fireworks(60, 160, ['#ffe070', '#8ad8ff', '#ff8ac0']);
    },
    sky(area) {
      const sunX = 296, sunY = 60;
      glow(sunX, sunY, 130, 'sunS', [0, 'rgba(255,252,230,0.75)', 0.3, 'rgba(255,240,210,0.25)', 1, 'rgba(255,240,210,0)'], 0.9 + Math.sin(T * 1.2) * 0.1);
      rays(sunX, sunY, 24, 96, 18, T * 0.1, 0.06, '#ffffff', 0.32);
      rays(sunX, sunY, 22, 60, 12, -T * 0.06, 0.1, '#fff4c8', 0.24);
      art.facet(c, sunX, sunY, 18, 18, 10, '#fffbe8', T * 0.12, 0.06);
      // 空くじら
      const period = 26, ph = CF.ph % period;
      const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
      const wx = 430 - lt * 20;
      if (wx > -110) skyWhale(wx, 150 + hh(cyc, 3) * 70 + Math.sin(lt * 0.6) * 6, 0.9 + hh(cyc, 4) * 0.3);
      clouds(3, 60, 200, 5, 0.5, 0.8, 0.85, '#ffffff', 0.04);
      flocks(2, 100, 230, 17, 0.75, 'rgba(90,100,160,0.5)', 1.1);
      fireworks(60, 180, ['#ffe08a', '#ffffff', '#b8d0ff', '#ffb8e0']);
    },
    abyss(area) {
      // 闇の奥の巨大な目（ゆっくりまばたきして、戦いを目で追う）
      const ex = 180, ey = GY - 250;
      const open = M.k === 'win' ? 1 - seg(M.d, 0.2, 0.9) : M.k === 'lose' ? 1 : 0.8 + Math.sin(T * 0.4) * 0.1;
      const bl = fr(T * 0.13 + CF.ph);
      const blinkK = bl < 0.04 ? Math.abs(bl / 0.02 - 1) : 1;
      const wideK = (M.k === 'crit' || M.k === 'skill') && M.d < 0.8 ? 1.25 : 1;
      const h = 24 * open * blinkK * wideK;
      glow(ex, ey, 140, 'abE', [0, 'rgba(170,80,230,0.32)', 1, 'rgba(120,40,200,0)'], 0.6 + 0.4 * open);
      if (h > 0.8) {
        const w = 78;
        c.save();
        c.beginPath(); c.moveTo(ex - w, ey); c.quadraticCurveTo(ex, ey - h * 2, ex + w, ey); c.quadraticCurveTo(ex, ey + h * 2, ex - w, ey); c.closePath();
        c.globalAlpha = 0.7;
        c.fillStyle = '#4a2068'; c.fill();
        c.clip();
        const lk = lookX(ex);
        const ix = ex + lk * 30;
        E(c, ix, ey, 22, 22, '#b050f0');
        E(c, ix, ey, 15, 15, '#d890ff');
        E(c, ix, ey, 3.4 * (wideK > 1 ? 0.6 : 1), 17, '#12041c');
        E(c, ix - 7, ey - 7, 3, 3, 'rgba(255,255,255,0.7)');
        c.restore();
        c.globalAlpha = 0.6;
        c.strokeStyle = '#c890ff'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(ex - 78, ey); c.quadraticCurveTo(ex, ey - h * 2, ex + 78, ey); c.stroke();
        c.globalAlpha = 1;
      } else {
        c.strokeStyle = 'rgba(200,140,255,0.5)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(ex - 78, ey); c.quadraticCurveTo(ex, ey + 6, ex + 78, ey); c.stroke();
      }
    },
  };
  // 目線：いま動いているほうを見る（-1..1）
  function lookX(ex) {
    let tx = 266;
    if (PL && LY) {
      for (const b of PL.beats) if (T > b.t - 0.2 && T < b.at + 0.3) tx = b.kind === 'mon' ? (LY.px[b.target] || 120) : b.kind === 'heal' ? (LY.px[b.who] || 120) : 266;
      if (T < 1.1) tx = 60 + T * 80;
    }
    return clamp((tx - ex) / 160, -1, 1);
  }
  function shootingStar(y0, y1) {
    if (RM) return;
    const period = 6.5, ph = CF.ph % period;
    const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
    if (lt > 0.7 || hh(cyc, 5) < 0.3) return;
    const x0 = 120 + hh(cyc, 6) * 220, y = lerp(y0, y1, hh(cyc, 7));
    const u = lt / 0.7;
    const hx = x0 - u * 140, hy = y + u * 60;
    const a = Math.sin(u * Math.PI);
    c.strokeStyle = `rgba(255,250,230,${0.9 * a})`;
    c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 36, hy - 15); c.stroke();
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.fillRect(hx - 1.2, hy - 1.2, 2.4, 2.4);
  }
  function windmill(x, ridge, area) {
    const y = ridge(x) + 2;
    const col = G.shade(area.pal.far, 0.32);
    P(c, [x - 6, y, x + 6, y, x + 4, y - 22, x - 4, y - 22], col);
    P(c, [x - 6, y, x - 1, y, x - 1, y - 22, x - 4, y - 22], G.shade(col, 0.12));
    P(c, [x - 5.5, y - 22, x + 5.5, y - 22, x, y - 29], G.shade('#c4553a', 0.2));
    P(c, [x - 1.6, y, x + 1.6, y, x + 1.6, y - 5, x - 1.6, y - 5], G.shade(col, -0.3));
    // 羽根：風車はくるくる回る（大技の突風で速く）
    const sp = sinceImp(0.8) < 1.2 ? 3.2 : 0.9;
    const a0 = T * sp + CF.ph;
    c.save(); c.translate(x, y - 23); c.rotate(a0);
    c.fillStyle = G.shade(col, 0.25);
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const an = (i / 4) * TAU, ca = Math.cos(an), sa = Math.sin(an);
      c.moveTo(ca * 2 - sa * 0.6, sa * 2 + ca * 0.6);
      c.lineTo(ca * 15 - sa * 0.6, sa * 15 + ca * 0.6);
      c.lineTo(ca * 15 - sa * 3.6, sa * 15 + ca * 3.6);
      c.lineTo(ca * 4 - sa * 3, sa * 4 + ca * 3);
      c.closePath();
    }
    c.fill();
    c.restore();
    E(c, x, y - 23, 1.5, 1.5, G.shade(col, -0.25));
  }
  function deer(x, y, col, alert, run) {
    const k = 0.62;
    const sh = G.shade(col, -0.22);
    c.save(); c.translate(x, y + 1); c.scale(-k, k);
    const lg = run ? Math.sin(T * 14) * 3 : 0;
    P(c, [-8, 0, -6.6, 0, -6 + lg, -10, -8, -10], sh); P(c, [6, 0, 7.4, 0, 7 - lg, -10, 5, -10], sh);
    P(c, [-10, -9, 9, -9, 10, -16, -9, -17], sh);
    const hy = alert || run ? -30 : -18, hx = alert || run ? 12 : 15;
    P(c, [7, -15, 10, -16, hx + 2, hy, hx - 1, hy], sh);
    P(c, [hx - 2, hy - 1, hx + 5, hy + 1, hx + 4, hy + 4, hx - 2, hy + 3], sh);
    c.strokeStyle = sh; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(hx, hy - 1); c.lineTo(hx - 3, hy - 8); c.lineTo(hx - 6, hy - 10); c.moveTo(hx - 3, hy - 8); c.lineTo(hx - 1, hy - 12); c.stroke();
    c.restore();
  }
  function dragonShadow(x, y, dir, col, k) {
    const fl = Math.sin(T * 3.2) * 9;
    c.save(); c.translate(x, y); c.scale(dir * k, k);
    c.fillStyle = col;
    c.beginPath();
    // 胴と首・尾
    c.moveTo(-26, 2); c.quadraticCurveTo(-10, -4, 6, -2); c.quadraticCurveTo(14, -6, 20, -8); c.lineTo(25, -6); c.lineTo(20, -3);
    c.quadraticCurveTo(10, 3, -4, 4); c.quadraticCurveTo(-18, 6, -34, 8); c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-6, -2); c.lineTo(-14, -16 - fl); c.lineTo(-2, -24 - fl * 1.4); c.lineTo(4, -14 - fl * 0.6); c.lineTo(6, -2); c.closePath();
    c.moveTo(-4, 2); c.lineTo(-18, 8 + fl * 0.4); c.lineTo(-6, 12 + fl * 0.6); c.lineTo(4, 3); c.closePath();
    c.fill();
    c.restore();
  }
  function skyWhale(x, y, k) {
    c.save(); c.translate(x, y); c.scale(-k, k);
    c.globalAlpha = 0.55;
    art.facetPoly(c, [-50, 0, -36, -12, -6, -17, 26, -13, 46, -4, 56, -10, 64, -14, 60, -2, 64, 8, 54, 4, 44, 6, 20, 12, -14, 13, -40, 8], '#b8c4ec', 0.08);
    P(c, [-34, 6, -6, 9, 22, 8, 40, 4, 20, 12, -14, 13, -38, 9], '#e8ecff');
    P(c, [-4, 6, 6, 16 + Math.sin(T * 1.4) * 2, 12, 8], '#a8b4e0');
    E(c, -36, -3, 1.6, 1.6, '#3a4070');
    c.globalAlpha = 0.75;
    // しおふき（きらきら）
    const sp = fr(T * 0.25);
    if (sp < 0.4) for (let i = 0; i < 5; i++) {
      const u = sp / 0.4;
      E(c, -18 + (i - 2) * 4 * u, -20 - u * 18 + Math.abs(i - 2) * u * 5, 1.4, 1.4, '#ffffff');
    }
    c.restore();
  }

  // ---------------------------------------------------------------- 地形の上・戦いの後ろ
  // 丘（草原の見物席）
  function hillSpr(area) {
    const p = area.pal;
    return sprite('hill' + area.id, -60, -8, 230, 118, (g) => {
      const base = area.id === 'meadow' ? G.mix(p.near, p.ground, 0.35) : G.shade(p.near, 0.05);
      art.facetPoly(g, [-60, 108, -60, 6, -24, -2, 10, -4, 40, 2, 76, 22, 120, 54, 165, 100, 168, 108], base, 0.12);
      P(g, [-60, 6, -24, -2, 10, -4, 40, 2, 76, 22, 70, 27, 36, 9, 8, 3, -24, 5, -60, 13], G.shade(p.ground, 0.16));
      P(g, [-60, 13, -24, 5, 8, 3, 36, 9, 70, 27, 66, 30, 34, 13, 8, 7, -24, 9, -60, 17], G.shade(base, -0.06));
      // 花と草
      for (let i = 0; i < 16; i++) {
        const x = -50 + hash(i * 7 + 3) * 190, y = 10 + hash(i * 11 + 1) * 80;
        const top = x < 40 ? -2 : (x - 40) * 0.62;
        if (y < top + 6) continue;
        if (i % 3 === 0) E(g, x, y, 1.6, 1.6, ['#fff4f0', '#ffd860', '#ff9ab8'][i % 3 === 0 ? (i / 3) % 3 : 0]);
        else P(g, [x - 2, y, x, y - 4, x + 1, y], G.shade(base, -0.14));
      }
    });
  }
  // 草むら（手前で魔物を隠す）
  function bush(x, y, k, col) {
    const s = sprite('bush' + col, -22, -16, 44, 18, (g) => {
      art.facet(g, -10, -4, 10, 7, 7, G.shade(col, -0.04), 0.2, 0.12);
      art.facet(g, 8, -5, 11, 8, 7, col, 0.6, 0.12);
      art.facet(g, -1, -8, 9, 7, 7, G.shade(col, 0.08), 1, 0.12);
      P(g, [-20, 0, 20, 0, 18, -3, -18, -3], G.shade(col, -0.12));
    });
    blit(s, x, y, k, k, 0);
  }
  function butterflies(n, x0, x1, y0, y1) {
    for (let i = 0; i < n; i++) {
      const h1 = hh(CF.seed, 150 + i), h2 = hh(CF.seed, 151 + i);
      const x = lerp(x0, x1, fr(h1 + T * 0.03 * (h2 > 0.5 ? 1 : -1))) + Math.sin(T * 1.1 + i) * 14;
      const y = lerp(y0, y1, h2) + Math.sin(T * 2.3 + i * 3) * 8;
      const fl = Math.abs(Math.sin(T * 14 + i)) * 3.6 + 0.6;
      const col = ['#ffffff', '#ffb0d8', '#9ad8ff', '#ffe070'][i % 4];
      P(c, [x, y, x - fl, y - 3.6, x - fl * 0.9, y + 1.6], col);
      P(c, [x, y, x + fl, y - 3.6, x + fl * 0.9, y + 1.6], G.shade(col, -0.1));
    }
  }

  const BACK = {
    meadow(area) {
      const p = area.pal;
      // 丘：見物人の席
      blit(hillSpr(area), sx(0, 0.55), GY - 104, 1, 1, 0);
      const hillTop = (x) => { const lx = x - sx(0, 0.55); return GY - 104 + (lx < 10 ? -2 + (lx + 24) * -0.06 : lx < 40 ? -4 + (lx - 10) * 0.2 : 2 + (lx - 40) * 0.55); };
      CF.cast.forEach((a) => { if (a.layer === 'hill' && !a.ridge) a.ridge = hillTop; });
      drawCast('hill');
      butterflies(3, 0, 340, GY - 150, GY - 40);
      drawCast('gap');
      bush(sx(196, 0.8), GY + 1, 1.05, G.shade(p.near, 0.1));
    },
    forest(area) {
      const p = area.pal;
      fireflies(6, 0, 360, GY - 170, GY - 20, '#e8ff9a');
      // 大きな木と枝（左）：フクロウとリス
      const tx = sx(4, 0.6);
      const trunk = sprite('ftrunk', -40, -400, 170, 404, (g) => {
        art.facetPoly(g, [-26, 4, 16, 4, 12, -120, 10, -400, -24, -400, -20, -120], '#4a3424', 0.1);
        P(g, [-6, 4, 16, 4, 12, -120, 10, -400, -4, -400, -2, -120], '#3a281c');
        P(g, [8, -150, 104, -172, 112, -166, 104, -162, 12, -138], '#4a3424');
        P(g, [40, -158, 64, -186, 68, -182, 46, -156], '#4a3424');
        art.facet(g, 108, -178, 20, 14, 7, G.shade(p.near, 0.05), 0.3, 0.14);
        art.facet(g, 70, -196, 18, 12, 7, p.near, 1, 0.14);
        art.facet(g, 124, -190, 14, 10, 7, G.shade(p.near, -0.05), 2, 0.14);
        art.facet(g, 0, -260, 34, 26, 8, p.near, 0.2, 0.14);
        art.facet(g, 30, -228, 24, 16, 7, G.shade(p.near, 0.06), 0.6, 0.14);
        art.facet(g, -12, -224, 22, 16, 7, G.shade(p.near, -0.04), 1.2, 0.14);
        P(g, [-14, 4, -34, 4, -18, -8], '#3a281c'); P(g, [10, 4, 26, 4, 12, -10], '#3a281c');
      });
      blit(trunk, tx, GY - 2, 1, 1, 0);
      const branchY = (x) => GY - 2 - 150 - (x - tx - 8) * (22 / 96);
      CF.cast.forEach((a) => { if (a.layer === 'branch' && !a.ridge) a.ridge = branchY; });
      drawCast('branch');
      drawCast('ground');
      // 小さなキノコたち（会心で跳ねる）
      drawCast('gap');
      // ふわふわ光る胞子
      drift(5, 6, -8, ['#e8ffb0'], 'mote', GY - 200, GY, 1.4);
    },
    cave(area) {
      // 天井のコウモリ（鍾乳石の先にぶら下がる）
      const imp = sinceImp(0.8);
      const scatter = (M.k === 'win' && M.d < 2.6) || imp < 2.2 || (M.k === 'enc' && M.big);
      c.fillStyle = '#5a4876';
      const sk = imp < 2.2 ? imp : M.d;
      c.beginPath();
      for (const i of CF.bats) {
        const x = wrapX(i * 52 - SC * 0.5, 470, 50);
        const h = 30 + hash(i * 3) * 60;
        if (scatter && sk < 2.2) {
          const u = sk / 2.2;
          const fx = x + Math.sin(u * TAU * 1.4 + i) * 40 * bump(u), fy = h + 6 + Math.sin(u * TAU * 2 + i * 2) * 24 * bump(u) + bump(u) * 30;
          batPath(fx, fy, 1.3, Math.sin(T * 22 + i) * 3.5);
        } else {
          // ぶら下がって揺れる
          const sw = Math.sin(T * 1.5 + i) * 0.15;
          const bx = x + sw * 8, by = h + 10;
          // 翼でくるまった逆さまの姿
          c.moveTo(bx - 1, by - 9); c.lineTo(bx + 1, by - 9); c.lineTo(bx + 5, by - 3); c.lineTo(bx + 5.6, by + 3); c.lineTo(bx, by + 6.4); c.lineTo(bx - 5.6, by + 3); c.lineTo(bx - 5, by - 3); c.closePath();
          c.moveTo(bx - 2.6, by + 5); c.lineTo(bx - 4.4, by + 9.6); c.lineTo(bx - 0.8, by + 6.4); c.closePath();
          c.moveTo(bx + 2.6, by + 5); c.lineTo(bx + 4.4, by + 9.6); c.lineTo(bx + 0.8, by + 6.4); c.closePath();
        }
      }
      c.fill();
      // 寝ている子の目（起きると光る）
      for (const i of CF.bats) {
        if (scatter && sk < 2.2) continue;
        const x = wrapX(i * 52 - SC * 0.5, 470, 50) + Math.sin(T * 1.5 + i) * 0.9;
        const h = 30 + hash(i * 3) * 60;
        if (M.critSeen || M.k === 'enc') { c.fillStyle = '#ffe65a'; c.fillRect(x - 2.4, h + 14, 1.6, 1.6); c.fillRect(x + 0.8, h + 14, 1.6, 1.6); }
        else { c.strokeStyle = '#2a2036'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 2.6, h + 14.8); c.lineTo(x - 0.8, h + 14.8); c.moveTo(x + 0.8, h + 14.8); c.lineTo(x + 2.6, h + 14.8); c.stroke(); }
      }
      // 飛び交う群れ
      const period = 7, cyc = Math.floor((T + CF.ph) / period), lt = (T + CF.ph) - cyc * period;
      if (lt < 4.5) {
        const dir = hh(cyc, 1) < 0.5 ? 1 : -1;
        c.fillStyle = '#5a4a74';
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const x = dir > 0 ? -30 + lt * 95 - i * 18 : 390 - lt * 95 + i * 18;
          const y = GY - 210 + hh(cyc, 2) * 60 + Math.sin(lt * 4 + i * 1.3) * 10 + i * 5;
          batPath(x, y, 1.05, Math.sin(T * 20 + i * 1.7) * 3.4);
        }
        c.fill();
      }
      // 闇に光る目
      for (let i = 0; i < CF.eyes.length; i++) {
        const e = CF.eyes[i];
        const x = sx(e.x, 0.3), y = GY * e.y + 50;
        const gone = M.k === 'win' ? seg(M.d, 0.1, 0.6) : 0;
        if (gone >= 1) continue;
        const bl = Math.sin(T * 0.9 + e.ph) > 0.96 ? 0.15 : 1;
        const wide = (M.k === 'crit' || M.k === 'skill') && M.d < 1 ? 1.6 : 1;
        const laugh = M.k === 'hurt' || M.k === 'bighurt' || M.k === 'lose' || M.pinch > 0;
        const lk = lookX(x) * 1.2;
        c.globalAlpha = (1 - gone) * (0.75 + Math.sin(T * 2 + i) * 0.2);
        glow(x, y, 16 * e.s, 'ceyes', [0, 'rgba(255,210,80,0.3)', 1, 'rgba(255,200,60,0)'], c.globalAlpha);
        for (let j = -1; j <= 1; j += 2) {
          const ex = x + j * 5 * e.s;
          if (laugh) {
            c.strokeStyle = '#ffd84a'; c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(ex - 2.4 * e.s, y + 0.6); c.quadraticCurveTo(ex, y - 2.6 * e.s, ex + 2.4 * e.s, y + 0.6); c.stroke();
          } else {
            E(c, ex, y, 2.6 * e.s * wide, 1.6 * e.s * bl * wide, '#ffd84a');
            E(c, ex + lk, y, 0.8 * e.s, 1.2 * e.s * bl, '#2a1400');
          }
        }
        c.globalAlpha = 1;
      }
      // しずく
      for (let i = 0; i < 2; i++) {
        const sIdx = [1, 5][i];
        const x = wrapX(sIdx * 52 - SC * 0.5, 470, 50);
        const h = 30 + hash(sIdx * 3) * 60;
        const period2 = 1.9 + i * 0.7, lt2 = (T + i * 0.8) % period2;
        const fall = Math.sqrt(2 * (GY - 20 - h) / 600);
        if (lt2 < fall) {
          const y = h + 300 * lt2 * lt2;
          c.fillStyle = 'rgba(170,236,255,0.85)';
          c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 1.4, y + 0.6); c.lineTo(x, y + 1.6); c.lineTo(x - 1.4, y + 0.6); c.closePath(); c.fill();
        } else {
          const u = (lt2 - fall) / 0.8;
          if (u < 1) {
            c.strokeStyle = `rgba(170,236,255,${0.7 * (1 - u)})`; c.lineWidth = 1;
            c.beginPath(); c.ellipse(x, GY - 20, 2 + u * 14, 0.8 + u * 3, 0, 0, TAU); c.stroke();
          }
        }
      }
      // 左の岩棚：鉱夫さん
      const lx = sx(0, 0.55);
      const ledge = sprite('cledge', -40, -40, 150, 100, (g) => {
        art.facetPoly(g, [-40, -8, 90, -8, 96, -2, 70, 10, 40, 22, 0, 40, -40, 56], '#3a3450', 0.14);
        P(g, [-40, -8, 90, -8, 96, -2, -40, -1], '#4e4866');
        [[60, -8], [72, -8], [80, -8]].forEach(([x, y], i) => {
          P(g, [x - 3, y, x, y - 12 - i * 3, x + 3, y], '#7fe0ff');
          P(g, [x, y - 12 - i * 3, x + 3, y, x + 0.5, y], '#c8f6ff');
        });
      });
      const ly = GY - 96;
      glow(lx + 72, ly - 8, 26, 'crys', [0, 'rgba(127,224,255,0.35)', 1, 'rgba(127,224,255,0)'], 0.7 + Math.sin(T * 2.2) * 0.3);
      blit(ledge, lx, ly, 1, 1, 0);
      CF.cast.forEach((a) => { if (a.layer === 'ledge') { a.y = -96; } });
      // ランタンの灯り
      const miner = CF.cast.find((a) => a.layer === 'ledge');
      if (miner) glow(sx(miner.x, 0.55) + 10, ly - 24, 34, 'lant', [0, 'rgba(255,200,110,0.4)', 1, 'rgba(255,200,110,0)'], 0.8 + Math.sin(T * 9) * 0.06 + Math.sin(T * 5.3) * 0.06);
      drawCast('ledge');
      // トロッコとゴブリン（真ん中）
      const gx = sx(196, 0.8);
      c.strokeStyle = '#5a5060'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(gx - 60, GY - 3); c.lineTo(gx + 60, GY - 3); c.moveTo(gx - 60, GY - 6); c.lineTo(gx + 60, GY - 6); c.stroke();
      const gob = CF.cast.find((a) => a.layer === 'cart');
      let cartDx = 0;
      if (gob) {
        const r = react(gob, gx, T);
        cartDx = r.pose === 'flee' ? r.dx : 0; // トロッコごと逃げる
        const peek = r.pose === 'hide' || r.pose === 'surprise' && r.md > 0.25 ? 9 : r.pose === 'cower' ? 6 : 0;
        gob.y = -16 + peek;
        gob.x = 196 + cartDx;
        drawActor(gob, T);
        gob.x = 196;
      }
      const cart = sprite('ccart', -18, -20, 36, 22, (g) => {
        art.facetPoly(g, [-15, -18, 15, -18, 12, -3, -12, -3], '#5a4a52', 0.12);
        P(g, [-16, -19, 16, -19, 16, -16, -16, -16], '#8a8a96');
        P(g, [-6, -14, -3, -14, -3, -6, -6, -6], '#4a3a42'); P(g, [3, -14, 6, -14, 6, -6, 3, -6], '#4a3a42');
      });
      blit(cart, gx + cartDx, GY - 4, 1, 1, 0);
      const wr = (T * 8) * (cartDx > 0 ? 1 : 0);
      for (const wxo of [-8, 8]) {
        E(c, gx + cartDx + wxo, GY - 4, 3.2, 3.2, '#2a2430');
        c.strokeStyle = '#7a7a86'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(gx + cartDx + wxo + Math.cos(wr) * 2.6, GY - 4 + Math.sin(wr) * 2.6); c.lineTo(gx + cartDx + wxo - Math.cos(wr) * 2.6, GY - 4 - Math.sin(wr) * 2.6); c.stroke();
      }
    },
    castle(area) {
      const p = area.pal;
      // 舞踏会の部屋（左の棟）：灯りの窓の奥で骸骨たちが踊る
      const fx = sx(0, 0.5);
      const wx0 = fx + 18, wx1 = fx + 76, wb = GY - 114, wt = GY - 142;
      // 部屋の中
      const ig = sprite('chall', 0, -64, 60, 66, (g) => {
        const lg = g.createLinearGradient(0, -64, 0, 2);
        lg.addColorStop(0, '#5a2a3a'); lg.addColorStop(0.6, '#a8503a'); lg.addColorStop(1, '#d88a4a');
        g.fillStyle = lg; g.fillRect(0, -64, 60, 66);
        P(g, [0, -6, 60, -6, 60, 2, 0, 2], '#6a3428');
        for (let i = 0; i < 6; i++) P(g, [i * 10, -6, i * 10 + 5, -6, i * 10 + 5, 2, i * 10, 2], '#8a4a34');
      });
      blit(ig, wx0 - 1, wb + 1, 1, 1, 0);
      // まわる色の光（パーティー中）
      if (M.k !== 'win' || M.d < 0.6) {
        for (let i = 0; i < 3; i++) {
          const an = T * 1.6 + i * 2.1;
          const lx = (wx0 + wx1) / 2 + Math.cos(an) * 20, ly = wb - 34 + Math.sin(an * 1.3) * 10;
          glow(lx, ly, 12, 'disc' + i, [0, ['rgba(255,120,200,0.5)', 'rgba(120,220,255,0.5)', 'rgba(255,230,120,0.5)'][i], 1, 'rgba(255,255,255,0)'], 0.8);
        }
      }
      // シャンデリア
      const sw = Math.sin(T * 1.8) * 0.12 + (sinceImp(0.8) < 1 ? Math.sin(T * 14) * 0.2 * (1 - sinceImp(0.8)) : 0);
      const chx = (wx0 + wx1) / 2, chy = wt - 26;
      c.strokeStyle = '#3a2a20'; c.lineWidth = 0.8;
      const cx2 = chx + Math.sin(sw) * 16, cy2 = chy + Math.cos(sw) * 16;
      c.beginPath(); c.moveTo(chx, chy); c.lineTo(cx2, cy2); c.stroke();
      P(c, [cx2 - 8, cy2, cx2 + 8, cy2, cx2 + 5, cy2 + 3, cx2 - 5, cy2 + 3], '#c8a040');
      for (let i = -1; i <= 1; i++) { c.fillStyle = '#fff0a0'; c.fillRect(cx2 + i * 6 - 0.6, cy2 - 3.4 + Math.sin(T * 12 + i) * 0.4, 1.2, 2.4); }
      skeletonBand(wx0, wx1, wb);
      // 棟の外壁（窓の形にくり抜き）
      const facade = sprite('cfac' + area.id, -16, -208, 126, 210, (g) => {
        // 窓は頭やセリフにかからないよう高めに（U だけ上げる）
        const U = 18, top = -188;
        art.facetPoly(g, [-16, 2, 108, 2, 108, top, -16, top], G.shade(p.mid, 0.02), 0.06);
        P(g, [-16, 2, 4, 2, 4, top, -16, top], G.shade(p.mid, 0.1));
        for (let i = 0; i < 6; i++) P(g, [-16 + i * 22, top, -4 + i * 22, top, -4 + i * 22, top - 12, -16 + i * 22, top - 12], G.shade(p.mid, 0.05));
        // 石のすじ
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
        for (let r = 0; r < 10; r++) { g.beginPath(); g.moveTo(-16, -14 - r * 18); g.lineTo(108, -14 - r * 18); g.stroke(); }
        const arch = () => { g.beginPath(); g.moveTo(18, -94 - U); g.lineTo(18, -124 - U); g.arc(47, -124 - U, 29, Math.PI, 0); g.lineTo(76, -94 - U); g.closePath(); };
        // 窓をくり抜く
        g.globalCompositeOperation = 'destination-out';
        arch(); g.fill();
        g.globalCompositeOperation = 'source-over';
        // 窓枠と桟
        g.strokeStyle = G.shade(p.near, -0.1); g.lineWidth = 3;
        arch(); g.stroke();
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(37, -94 - U); g.lineTo(37, -150 - U); g.moveTo(57, -94 - U); g.lineTo(57, -150 - U); g.moveTo(18, -126 - U); g.lineTo(76, -126 - U); g.stroke();
        P(g, [14, -92 - U, 80, -92 - U, 82, -88 - U, 12, -88 - U], G.shade(p.mid, 0.16));
        // 旗
        P(g, [86, -168, 100, -168, 100, -118, 93, -125, 86, -118], '#7a2a4a');
        P(g, [86, -168, 93, -168, 93, -122, 86, -118], '#9a3a5a');
        // 小窓
        P(g, [-6, -60, 2, -60, 2, -48, -6, -48], 'rgba(255,190,110,0.55)');
      });
      blit(facade, fx, GY - 2, 1, 1, 0);
      // 窓から漏れる光
      glow((wx0 + wx1) / 2, wb - 20, 70, 'hallG', [0, 'rgba(255,190,120,0.18)', 1, 'rgba(255,190,120,0)'], 0.8 + Math.sin(T * 7) * 0.05);
      // 壁の松明
      for (const tx of [fx + 6, fx + 92]) torch(tx, GY - 84);
      // 塔の上のカラス
      if (CF.crows) crows(sx(220, 0.25), area);
      drawCast('air');
    },
    peak(area) {
      const p = area.pal;
      // 鷲（ゆったり旋回）
      const ex = 70 + Math.cos(T * 0.45) * 50, ey = GY - 230 + Math.sin(T * 0.45) * 16;
      const fl = Math.sin(T * 2.2) * 0.4;
      c.save(); c.translate(ex, ey); c.scale(Math.sin(T * 0.45) > 0 ? -1 : 1, 1);
      c.fillStyle = '#4a2a24';
      c.beginPath(); c.moveTo(-12, -2 - fl * 6); c.quadraticCurveTo(-6, -3, -2, 0); c.lineTo(0, 1.6); c.lineTo(2, 0); c.quadraticCurveTo(6, -3, 12, -2 - fl * 6); c.quadraticCurveTo(6, 0, 0, 3.4); c.quadraticCurveTo(-6, 0, -12, -2 - fl * 6); c.fill();
      c.restore();
      // 左の岩山：仙人とヤギ
      const cx = sx(0, 0.5);
      const crag = sprite('pcrag' + area.id, -40, -6, 150, 120, (g) => {
        const base = G.mix(p.near, p.mid, 0.3);
        art.facetPoly(g, [-40, 114, -40, 8, -10, -2, 24, -4, 50, 4, 58, 40, 84, 44, 104, 70, 110, 114], base, 0.18);
        P(g, [-40, 8, -10, -2, 24, -4, 50, 4, 46, 9, 20, 3, -12, 5, -40, 14], G.shade(p.mid, 0.22));
        P(g, [58, 40, 84, 44, 82, 48, 60, 45], G.shade(p.mid, 0.2));
        // 岩のすじ
        P(g, [0, 20, 6, 60, 2, 60], 'rgba(0,0,0,0.15)'); P(g, [30, 14, 40, 50, 36, 52], 'rgba(0,0,0,0.12)');
      });
      blit(crag, cx, GY - 110, 1, 1, 0);
      const cragTop = (x) => {
        const lx = x - cx;
        const y = lx < -10 ? lerp(8, -2, (lx + 40) / 30) : lx < 24 ? lerp(-2, -4, (lx + 10) / 34) : lx < 50 ? lerp(-4, 4, (lx - 24) / 26) : lx < 58 ? 4 : lx < 84 ? lerp(40, 44, (lx - 58) / 26) : 44;
        return GY - 110 + y + 1;
      };
      CF.cast.forEach((a) => { if ((a.layer === 'crag' || a.layer === 'crag2') && !a.ridge) a.ridge = cragTop; });
      drawCast('crag'); drawCast('crag2');
      // 落石：大技のたびに転がり落ちる
      rocks(area);
      // 真ん中の岩と巣（竜の子）
      const nx = sx(196, 0.8);
      const pillar = sprite('pnest' + area.id, -20, -46, 40, 48, (g) => {
        art.facetPoly(g, [-14, 2, 14, 2, 10, -30, 4, -40, -6, -40, -11, -30], G.mix(p.near, p.mid, 0.4), 0.18);
        P(g, [-6, -40, 4, -40, 6, -36, -8, -36], G.shade(p.mid, 0.18));
      });
      blit(pillar, nx, GY - 2, 1, 1, 0);
      const hat = CF.cast.find((a) => a.layer === 'nest');
      if (hat) {
        const r = react(hat, nx, T);
        hat.y = -40 + (r.pose === 'hide' || r.pose === 'cower' ? 8 : r.pose === 'surprise' && r.md > 0.3 ? 6 : 0);
        drawActor(hat, T);
        // 喜ぶと小さな火をぽっ
        if (r.pose === 'laugh' || r.pose === 'cheer') {
          const u = fr(T * 1.6);
          if (u < 0.4) { const fx = nx + 12 + u * 16; glow(fx, GY - 52 - u * 6, 7, 'pf', [0, 'rgba(255,190,90,0.9)', 1, 'rgba(255,120,40,0)'], 1 - u / 0.4); }
        }
      }
      const nest = sprite('pnest2', -16, -8, 32, 12, (g) => {
        P(g, [-14, -4, 14, -4, 11, 2, -11, 2], '#6a4a2a');
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 1;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-14 + i * 5, -5 + (i % 2) * 2); g.lineTo(-8 + i * 5, 1 - (i % 2) * 3); g.stroke(); }
      });
      blit(nest, nx, GY - 40, 1, 1, 0);
    },
    harbor(area) {
      const hz = GY - 64;
      // 波の白いすじ（ぷかぷか上下しながら現れては消える）
      waves(hz, GY - 2);
      // 跳ねる魚
      fish(hz);
      // 大技でしぶき
      splashes(hz);
      // 灯台守（小さく手を振る）
      const lx = 70 - SC * 0.1;
      const kw = M.k === 'win' || M.k === 'walk' ? Math.sin(T * 10) : 0;
      c.fillStyle = '#2f4f7a'; c.fillRect(lx + 6.5, hz - 56, 2.2, 4);
      E(c, lx + 7.6, hz - 57.6, 1.2, 1.2, '#f0c8a0');
      c.strokeStyle = '#2f4f7a'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(lx + 8.4, hz - 55); c.lineTo(lx + 10 + kw, hz - 58.4); c.stroke();
      // 木箱（見物席）
      const bx = sx(176, 0.8);
      const crates = sprite('hcrates', -26, -40, 52, 42, (g) => {
        const box = (x, y, w, h, col) => {
          art.facetPoly(g, [x, y, x + w, y, x + w, y - h, x, y - h], col, 0.08);
          g.strokeStyle = G.shade(col, -0.25); g.lineWidth = 1;
          g.strokeRect(x + 1, y - h + 1, w - 2, h - 2);
          g.beginPath(); g.moveTo(x + 1, y - 1); g.lineTo(x + w - 1, y - h + 1); g.stroke();
        };
        box(-24, 0, 22, 19, '#a87a48'); box(-1, 0, 22, 19, '#9a6e40'); box(-12, -19, 22, 19, '#b88a52');
      });
      blit(crates, bx, GY - 1, 1, 1, 0);
      CF.cast.forEach((a) => {
        if (a.layer === 'crate' && a.kind === 'sailor') { a.y = -38; }
        if (a.layer === 'crate' && a.kind === 'cat') { a.y = -19; }
      });
      drawCast('crate');
      drawCast('pier');
      gullPost();
      // 桟橋のふちの泡
      foam(GY - 2);
    },
    sky(area) {
      // 小さな浮島がぷかぷか
      for (let i = 0; i < 2; i++) {
        const x = sx([28, 340][i], 0.3), y = GY - [190, 236][i] + Math.sin(T * 0.9 + i * 2) * 4;
        floatRock(x, y, [16, 12][i], area);
      }
      // 真ん中の浮島：天空の民が見物
      const ix = sx(196, 0.5), iy = GY - 150 + Math.sin(T * 1.3) * 4;
      CF.cast.forEach((a) => { if (a.layer === 'islet') a.bobP = 0; });
      drawCast('islet');
      floatRock(ix, iy, 34, area, true);
      drawCast('air');
      // きらめく光の粒
      for (let i = 0; i < 12; i++) {
        const x = hh(CF.seed, 300 + i) * 360, y = GY - 40 - hh(CF.seed, 301 + i) * (GY - 120);
        const tw = Math.max(0, Math.sin(T * (1.2 + hh(i, 5)) + i * 2));
        if (tw < 0.2) continue;
        const s = 1.5 + tw * 2.2;
        c.globalAlpha = tw;
        P(c, [x, y - s, x + s * 0.25, y - s * 0.25, x + s, y, x + s * 0.25, y + s * 0.25, x, y + s, x - s * 0.25, y + s * 0.25, x - s, y, x - s * 0.25, y - s * 0.25], '#fffbe0');
      }
      c.globalAlpha = 1;
    },
    abyss(area) {
      // 鎖でつながれた目玉
      for (let i = 0; i < 2; i++) chainedEye(sx(CF.eyeX[i], 0.4), GY - 200 - i * 30, i);
      // 床のルーン（閃きで強く光る）
      const pulse = M.k === 'skill' ? 1.6 - seg(M.d, 0, 1.4) : 1;
      for (let i = 0; i < 3; i++) {
        const x = sx(60 + i * 120, 0.9), y = GY + 8 + i % 2 * 6;
        const a = (0.25 + 0.2 * Math.sin(T * 1.4 + i * 2)) * pulse;
        c.save(); c.translate(x, y); c.scale(1, 0.32); c.rotate(T * 0.2 * (i % 2 ? 1 : -1));
        c.strokeStyle = `rgba(200,150,255,${clamp(a, 0, 1)})`; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.stroke();
        c.beginPath();
        for (let j = 0; j < 5; j++) { const an = j / 5 * TAU; c.moveTo(Math.cos(an) * 20, Math.sin(an) * 20); c.lineTo(Math.cos(an + 2.5) * 20, Math.sin(an + 2.5) * 20); }
        c.stroke();
        c.restore();
      }
      // 闇から伸びる触手（勝つと引っこむ）
      tentacles(area);
      // 漂う紫の鬼火
      for (let i = 0; i < 4; i++) {
        const x = wrapX(hh(CF.seed, 400 + i) * 420 + T * (8 + i * 3), 420, 30), y = GY - 60 - hh(CF.seed, 401 + i) * 160 + Math.sin(T * 1.2 + i * 2) * 14;
        glow(x, y, 14, 'wisp', [0, 'rgba(210,160,255,0.65)', 0.4, 'rgba(160,90,240,0.25)', 1, 'rgba(120,60,220,0)'], 0.7 + Math.sin(T * 3 + i) * 0.3);
        c.fillStyle = '#f4e8ff'; c.fillRect(x - 1, y - 1, 2, 2);
      }
      drawCast('pillar');
    },
  };

  // ---- 古城：骸骨の舞踏会
  function skeletonBand(x0, x1, base) {
    const n = CF.band;
    let mode = 'dance';
    const k = M.k, d = M.d;
    if (k === 'crit' || k === 'charge' || (k === 'enc' && d < 0.8)) mode = 'freeze';
    else if (k === 'skill') mode = d < 0.3 ? 'freeze' : 'clap';
    else if (k === 'hurt' || k === 'bighurt' || (k === 'watch' && M.pinch > 0)) mode = 'laugh';
    else if (k === 'win') mode = 'panic';
    else if (k === 'lose') mode = 'laugh';
    const bone = '#f4ecd8';
    const w = x1 - x0;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = bone; c.lineWidth = 1.7;
    const heads = [];
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const st = CF.style[i];
      const ph = i * 1.7;
      let x = x0 + (w / (n + 1)) * (i + 1);
      let y = base;
      let face = i % 2 ? -1 : 1;
      const beat = T * 2.4 * TAU / 2.4; // 1拍
      let la = 0, ra = 0, ll = 0, rl = 0, bob = 0, jaw = 0, lean = 0;
      if (mode === 'dance') {
        bob = Math.abs(Math.sin(beat + ph)) * 2;
        if (st === 0) { la = -2.2 + Math.sin(beat * 2 + ph) * 0.6; ra = 2.2 - Math.sin(beat * 2 + ph) * 0.6; ll = Math.max(0, Math.sin(beat + ph)) * 0.8; }
        else if (st === 1) { la = -1.2 + Math.sin(beat + ph) * 1.2; ra = 1.2 + Math.sin(beat + ph) * 1.2; rl = Math.max(0, -Math.sin(beat + ph)) * 0.9; lean = Math.sin(beat + ph) * 0.15; }
        else { la = -2.6; ra = -0.6 + Math.sin(beat * 2) * 0.5; face = Math.sin(beat * 0.5 + ph) > 0 ? 1 : -1; ll = Math.max(0, Math.sin(beat * 2 + ph)) * 0.6; }
        x += Math.sin(beat * 0.5 + ph) * 3;
      } else if (mode === 'freeze') {
        la = -0.4; ra = 0.4; face = 1; jaw = 1.2; // 戦いのほうへ振り向く
      } else if (mode === 'clap') {
        const cl = Math.sin(T * 22 + ph) > 0;
        la = cl ? -0.9 : -1.5; ra = cl ? 0.9 : 1.5; face = 1; bob = Math.abs(Math.sin(T * 8 + ph)) * 1.4;
      } else if (mode === 'laugh') {
        la = -0.6; ra = 0.6; lean = -0.2 + Math.sin(T * 16 + ph) * 0.08; jaw = Math.abs(Math.sin(T * 18 + ph)) * 2; bob = Math.abs(Math.sin(T * 9 + ph)) * 2;
      } else if (mode === 'panic') {
        const u = seg(d, 0.2 + i * 0.12, 1.6 + i * 0.12);
        const dir = i < n / 2 ? -1 : 1;
        x += dir * G.ease.inCubic(u) * 90;
        face = dir;
        la = -2.8 + Math.sin(T * 30) * 0.2; ra = 2.8 - Math.sin(T * 30) * 0.2; jaw = 2;
        ll = Math.sin(T * 24 + ph) * 0.8; rl = -ll; bob = Math.abs(Math.sin(T * 24 + ph)) * 2;
        if (d < 0.3) { la = -0.4; ra = 0.4; ll = rl = 0; bob = -bump(d / 0.3) * 4; }
      }
      y -= bob;
      const s = 0.82;
      const hipY = y - 12 * s, shY = y - 22 * s;
      const hx = x + Math.sin(lean) * 10 * s * face;
      // 脚
      c.moveTo(x, hipY); c.lineTo(x - 3 * s + Math.sin(ll) * 6 * s * face, y - Math.cos(ll) * 0.2 - (ll > 0 ? ll * 5 * s : 0));
      c.moveTo(x, hipY); c.lineTo(x + 3 * s + Math.sin(rl) * 6 * s * face, y - (rl > 0 ? rl * 5 * s : 0));
      // 背骨とあばら
      c.moveTo(x, hipY); c.lineTo(hx, shY);
      c.moveTo(hx - 3.6 * s, shY + 3 * s); c.lineTo(hx + 3.6 * s, shY + 3 * s);
      c.moveTo(hx - 3 * s, shY + 6 * s); c.lineTo(hx + 3 * s, shY + 6 * s);
      // 腕（肩から）
      c.moveTo(hx, shY); c.lineTo(hx + Math.sin(la) * 9 * s * face, shY + Math.cos(la) * 9 * s);
      c.moveTo(hx, shY); c.lineTo(hx + Math.sin(ra) * 9 * s * face, shY + Math.cos(ra) * 9 * s);
      heads.push(hx + face * 0.6, shY - 5.6 * s, face, jaw);
    }
    c.stroke();
    for (let i = 0; i < heads.length; i += 4) {
      const hx = heads[i], hy = heads[i + 1], f = heads[i + 2], jaw = heads[i + 3];
      E(c, hx, hy, 4.4, 4.2, bone);
      P(c, [hx - 2.6 + f * 0.6, hy + 2.4, hx + 2.6 + f * 0.6, hy + 2.4, hx + 2.2 + f * 0.6, hy + 4.4 + jaw, hx - 2.2 + f * 0.6, hy + 4.4 + jaw], bone);
      E(c, hx - 1.6 + f * 1, hy - 0.4, 1.1, 1.3, '#3a2030'); E(c, hx + 1.6 + f * 1, hy - 0.4, 1.1, 1.3, '#3a2030');
    }
    // マーク
    if (mode === 'freeze' && heads.length) drawMark('!', heads[0], heads[1] - 12, outBack(seg(d, 0, 0.15)), d);
    if (mode === 'clap' && heads.length > 4) drawMark('note', heads[4], heads[5] - 12, outBack(seg(d, 0.3, 0.45)), fr(d * 0.8));
    if (mode === 'laugh' && heads.length) drawMark('laugh', (heads[0] + heads[heads.length - 4]) / 2, heads[1] - 14, outBack(seg(d, 0.05, 0.2)), d);
    if (mode === 'panic' && heads.length && d < 1.5) drawMark('!!', heads[0], heads[1] - 12, outBack(seg(d, 0, 0.15)) * (1 - seg(d, 1.2, 1.5)), d);
  }
  function torch(x, y) {
    const fl = 0.75 + Math.sin(T * 13 + x) * 0.15 + Math.sin(T * 7.3 + x * 0.3) * 0.1;
    glow(x, y - 8, 26 * fl, 'torch', [0, 'rgba(255,170,90,0.45)', 1, 'rgba(255,150,80,0)'], 1);
    P(c, [x - 3, y, x + 3, y, x + 2, y + 6, x - 2, y + 6], '#3a2a20');
    P(c, [x - 3.4, y, x + 3.4, y, x + Math.sin(T * 15 + x) * 1.4, y - 11 * fl], '#ffa040');
    P(c, [x - 1.6, y, x + 1.6, y, x + Math.sin(T * 15 + x) * 0.8, y - 6 * fl], '#fff0b0');
  }
  function crows(cx, area) {
    const imp = sinceImp(0.8);
    const fly = imp < 2.4 || (M.k === 'win' && M.d < 2.4);
    const u = imp < 2.4 ? imp / 2.4 : M.k === 'win' ? M.d / 2.4 : 1;
    for (let i = 0; i < 2; i++) {
      const tx = cx + [-60, 60][i], ty = GY - [170, 170][i] - 26;
      if (fly && u < 1) {
        const fx = tx + Math.sin(u * TAU + i) * 30 * bump(u), fy = ty - bump(u) * 40;
        c.fillStyle = '#1e1824';
        c.beginPath(); batPath(fx, fy, 0.7, Math.sin(T * 18 + i) * 3); c.fill();
        continue;
      }
      const s = sprite('crow', -8, -10, 16, 12, (g) => {
        art.facet(g, 0, -4, 4.4, 3, 6, '#2a2430', 0, 0.12);
        art.facet(g, 3.6, -6.4, 2.4, 2.2, 6, '#2a2430', 0.3, 0.1);
        P(g, [5.6, -6.8, 8, -6, 5.6, -5.6], '#e8b040');
        P(g, [-4, -4, -8, -2, -4, -2.4], '#1a1420');
        E(g, 4.2, -7, 0.5, 0.5, '#ffffff');
      });
      const look = Math.sin(T * 0.7 + i * 3) > 0 ? 1 : -1;
      blit(s, tx, ty + 1, look * 0.95, 0.95, 0);
    }
    void area;
  }
  function rocks(area) {
    if (!PL) return;
    for (const b of PL.beats) {
      const big = (b.kind === 'skill') || (b.kind === 'mon' && b.big) || (b.kind === 'hit' && b.crit) || b.finish;
      if (!big) continue;
      const d = T - b.at;
      if (d < 0 || d > 2.4) continue;
      for (let j = 0; j < 2; j++) {
        const hx = hh(b.i * 7 + 3, j);
        const x0 = j === 0 ? sx(20 + hx * 50, 0.5) : sx(170 + hx * 80, 0.8);
        const y0 = j === 0 ? GY - 112 : GY - 150, yG = GY - 4 - j * 2;
        const vx = (j === 0 ? 36 : -20) + hx * 20;
        // 跳ねながら落ちる
        let t2 = d - j * 0.12, y = y0, vy = 0;
        if (t2 < 0) continue;
        const g = 700;
        let tt = t2, bounce = 0;
        let v0 = 0, yy = y0;
        while (bounce < 4) {
          const disc = v0 * v0 + 2 * g * (yG - yy);
          const tHit = (-v0 + Math.sqrt(Math.max(0, disc))) / g;
          if (tt < tHit) { y = yy + v0 * tt + 0.5 * g * tt * tt; break; }
          tt -= tHit; yy = yG; v0 = -(v0 + g * tHit) * 0.42; bounce++;
          if (bounce >= 4) y = yG;
        }
        void vy;
        const x = x0 + vx * t2;
        const a = 1 - seg(d, 1.8, 2.4);
        c.globalAlpha = a;
        c.save(); c.translate(x, y - 3); c.rotate(t2 * 6 * (j ? -1 : 1));
        art.facet(c, 0, 0, 4 + hx * 2, 3.4 + hx * 1.5, 6, G.shade(area.pal.mid, 0.08), 0, 0.2);
        c.restore();
        c.globalAlpha = 1;
        if (bounce >= 1 && tt < 0.25 && bounce < 3) {
          c.fillStyle = `rgba(200,160,130,${0.5 * (1 - tt / 0.25)})`;
          c.beginPath(); c.ellipse(x, yG, 4 + tt * 30, 1.6 + tt * 4, 0, 0, TAU); c.fill();
        }
      }
    }
  }
  // ---- 港
  function waves(hz, bot) {
    const rows = 4;
    c.strokeStyle = 'rgba(255,255,255,0.88)';
    c.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      const u = r / (rows - 1);
      const y = lerp(hz + 7, bot - 10, u);
      const k = 0.55 + u * 0.8;
      c.lineWidth = 1 + u * 1.1;
      c.beginPath();
      const n = 6 - Math.floor(u * 2);
      for (let i = 0; i < n; i++) {
        const per = 3.2 + hh(r * 11 + i, 3) * 2;
        const lt = fr(T / per + hh(r * 13 + i, 4));
        const life = Math.sin(lt * Math.PI);
        if (life < 0.15) continue;
        const span = 420;
        const x = wrapX(hh(r * 17 + i, 5) * span + T * (4 + u * 6) - SC * (0.15 + u * 0.35), span, 30);
        const yy = y + Math.sin(T * 1.6 + i * 2 + r) * 1.4;
        const w = 9 * k * life, h = 4 * k * life;
        // 風のタクト風の波頭：盛り上がってクルンと巻く
        c.moveTo(x - w * 1.4, yy);
        c.quadraticCurveTo(x - w * 0.4, yy - h * 1.2, x + w * 0.3, yy - h);
        c.quadraticCurveTo(x + w * 0.9, yy - h * 0.7, x + w * 0.55, yy - h * 0.15);
        c.quadraticCurveTo(x + w * 0.25, yy + h * 0.2, x + w * 0.1, yy - h * 0.35);
      }
      c.stroke();
    }
  }
  function foam(y) {
    const span = 26;
    const off = wrapX(-SC * 1 + T * 8, span, 0);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    for (let x = -30 + off; x < 400; x += span) {
      const h = 2.4 + Math.sin(T * 2.4 + x * 0.1) * 1.2;
      c.moveTo(x, y);
      c.quadraticCurveTo(x + span * 0.25, y - h, x + span * 0.5, y - 0.4);
      c.quadraticCurveTo(x + span * 0.75, y - h * 0.7, x + span, y);
    }
    c.lineTo(400, y + 1.6); c.lineTo(-30, y + 1.6); c.closePath();
    c.fill();
  }
  function fish(hz) {
    if (RM) return;
    const period = 4.2, ph = CF.ph % period;
    const cyc = Math.floor((T + ph) / period), lt = (T + ph) - cyc * period;
    const x0 = 230 + hh(cyc, 1) * 120 - 120 * (hh(cyc, 2) < 0.5 ? 1 : 0);
    const y0 = hz + 16 + hh(cyc, 3) * 22;
    const dur = 0.9;
    if (lt < dur) {
      const u = lt / dur;
      const x = x0 + u * 34, y = y0 - Math.sin(u * Math.PI) * 26;
      const ang = Math.atan2(-Math.cos(u * Math.PI) * 26 * Math.PI, 34);
      c.save(); c.translate(x, y); c.rotate(ang);
      P(c, [-6, 0, -2, -2.6, 4, -2, 7, 0, 4, 2, -2, 2.4], '#9ac8e8');
      P(c, [-6, 0, -9, -3, -8.4, 0, -9, 3], '#7aa8d0');
      E(c, 4.2, -0.6, 0.6, 0.6, '#1a2a3a');
      c.restore();
    }
    for (const [st, xx] of [[0, x0], [dur, x0 + 34]]) {
      const u = (lt - st) / 0.7;
      if (u < 0 || u > 1) continue;
      c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - u)})`; c.lineWidth = 1;
      c.beginPath(); c.ellipse(xx, y0, 3 + u * 10, 1 + u * 2.4, 0, 0, TAU); c.stroke();
      if (u < 0.5) for (let i = -1; i <= 1; i++) { c.fillStyle = `rgba(255,255,255,${0.9 * (1 - u * 2)})`; c.fillRect(xx + i * 4 * u * 3, y0 - Math.sin(u * Math.PI * 2) * 6 - 1, 1.6, 1.6); }
    }
  }
  function splashes(hz) {
    if (!PL || !LY) return;
    for (const b of PL.beats) {
      const big = b.kind === 'skill' || (b.kind === 'hit' && b.crit) || (b.kind === 'mon' && b.big) || b.finish;
      if (!big) continue;
      const d = T - b.at;
      if (d < 0 || d > 1.1) continue;
      for (let j = 0; j < 2; j++) {
        const x = LY.mx + (j ? 56 : -58) + hh(b.i, j) * 10, y = GY - 10;
        c.fillStyle = `rgba(235,250,255,${0.9 * (1 - seg(d, 0.6, 1.1))})`;
        c.beginPath();
        for (let i = 0; i < 7; i++) {
          const vx = (i - 3) * 22 * (0.8 + hh(b.i + i, j) * 0.4), vy = -150 - hh(i, b.i + j) * 90;
          const px = x + vx * d, py = y + vy * d + 0.5 * 520 * d * d;
          if (py > y + 2) continue;
          c.moveTo(px + 2, py); c.arc(px, py, 2 - d, 0, TAU);
        }
        c.fill();
        if (d < 0.5) {
          c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - d * 2)})`; c.lineWidth = 1.4;
          c.beginPath(); c.ellipse(x, y + 2, 6 + d * 40, 2 + d * 6, 0, 0, TAU); c.stroke();
        }
      }
    }
    void hz;
  }
  function gullPost() {
    const a = CF.cast.find((x) => x.layer === 'post');
    if (!a) return;
    const imp = sinceImp(0.8);
    const fly = imp < 2.6 || (M.k === 'win' && M.d < 3);
    const u = imp < 2.6 ? imp / 2.6 : M.k === 'win' ? M.d / 3 : 1;
    const px = sx(202, 0.9);
    if (fly && u < 1) {
      // 驚いて飛び立ち、ぐるっと回って戻る
      const fx = px + Math.sin(u * TAU) * 40 * bump(u), fy = GY - 25 - bump(u) * 70;
      const fl = Math.sin(T * 16) * 4;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx - 9, fy - fl); c.quadraticCurveTo(fx - 4, fy - 4, fx, fy); c.quadraticCurveTo(fx + 4, fy - 4, fx + 9, fy - fl); c.stroke();
      if (u < 0.25) drawMark('!', fx, fy - 12, outBack(u / 0.06), u);
      return;
    }
    drawActor(a, T);
  }
  function floatRock(x, y, w, area, big) {
    const s = sprite('frock' + w + (big ? 'b' : ''), -w - 2, -6, w * 2 + 4, w * 1.6 + 8, (g) => {
      art.facetPoly(g, [-w, 0, w, 0, w * 0.6, w * 0.6, w * 0.1, w * 1.4, -w * 0.5, w * 0.7], '#a89cc8', 0.16);
      P(g, [-w, 0, w, 0, w * 0.92, -4, -w * 0.9, -4], '#8ad08a');
      P(g, [-w * 0.8, -4, -w * 0.3, -4, -w * 0.5, -6], '#a8e0a0');
      if (big) {
        P(g, [w * 0.2, 2, w * 0.28, 2, w * 0.3, w * 1.2, w * 0.18, w * 1.2], 'rgba(220,240,255,0.6)');
        art.facet(g, -w * 0.62, -8, 5, 5, 6, '#e8b0d8', 0, 0.1);
        art.facet(g, w * 0.7, -7, 4, 4, 6, '#fff0a0', 0, 0.1);
      }
    });
    blit(s, x, y, 1, 1, 0);
    void area;
  }
  function chainedEye(x, y, i) {
    const sw = Math.sin(T * 0.8 + i * 2) * 0.12;
    const retract = M.k === 'win' ? G.ease.inCubic(seg(M.d, 0.3, 1.4)) * 260 : 0;
    const len = (GY - 200 - 40 + i * 30) * 0.55;
    const ey = y - retract;
    const ex = x + Math.sin(sw) * len;
    c.strokeStyle = '#4a3a5a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(ex, ey - 12); c.stroke();
    for (let j = 1; j < 8; j++) {
      const u = j / 8;
      c.strokeStyle = '#6a5a7a'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(lerp(x, ex, u), lerp(0, ey - 12, u), 1.6, 2.6, sw, 0, TAU); c.stroke();
    }
    const wide = (M.k === 'crit' || M.k === 'skill') && M.d < 1 ? 1 : 0;
    const laugh = M.k === 'hurt' || M.k === 'bighurt' || M.k === 'lose';
    glow(ex, ey, 26, 'ceye', [0, 'rgba(255,120,160,0.25)', 1, 'rgba(255,80,140,0)'], 0.8);
    art.facet(c, ex, ey, 11, 11, 10, '#f0e6f0', T * 0.1, 0.1);
    const bl = Math.sin(T * 0.7 + i * 5) > 0.97;
    if (laugh || bl) {
      c.strokeStyle = '#6a2a5a'; c.lineWidth = 1.8;
      c.beginPath();
      if (laugh) { c.moveTo(ex - 6, ey + 1); c.quadraticCurveTo(ex, ey - 6, ex + 6, ey + 1); } else { c.moveTo(ex - 7, ey); c.lineTo(ex + 7, ey); }
      c.stroke();
    } else {
      const lk = lookX(ex) * 4;
      E(c, ex + lk, ey, wide ? 6.6 : 5.6, wide ? 6.6 : 5.6, '#c0306a');
      E(c, ex + lk, ey, wide ? 1.8 : 3, wide ? 1.8 : 3.4, '#1a0612');
      E(c, ex + lk - 2, ey - 2, 1.2, 1.2, '#ffffff');
    }
    c.strokeStyle = 'rgba(200,60,90,0.5)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(ex - 10, ey + 3); c.lineTo(ex - 6, ey + 2); c.moveTo(ex + 9, ey - 4); c.lineTo(ex + 5, ey - 3); c.stroke();
  }
  function tentacles(area) {
    const down = M.k === 'win' ? G.ease.inCubic(seg(M.d, 0.2, 1)) : 0;
    const flinch = (M.k === 'crit' || M.k === 'skill') && M.d < 0.6 ? bump(M.d / 0.6) : 0;
    const happy = M.k === 'lose' || M.k === 'hurt' || M.k === 'bighurt' ? 1 : 0;
    for (let i = 0; i < 2; i++) {
      const bx = sx([178, 216][i], 0.85), by = GY - 2;
      const H = (70 + i * 16) * (1 - down) * (1 - flinch * 0.4);
      if (H < 2) continue;
      const sw = Math.sin(T * (1.1 + happy * 2) + i * 2.4);
      c.fillStyle = i ? '#3a1e52' : '#2e1846';
      c.beginPath();
      const n = 10;
      const pts = [];
      for (let j = 0; j <= n; j++) {
        const u = j / n;
        const cx = bx + Math.sin(u * 2.4 + T * (1.3 + happy) + i) * 10 * u + sw * 14 * u * u;
        const cy = by - u * H;
        pts.push(cx, cy, 6 * (1 - u) + 0.8);
      }
      for (let j = 0; j <= n; j++) { const q = j * 3; if (j === 0) c.moveTo(pts[q] - pts[q + 2], pts[q + 1]); else c.lineTo(pts[q] - pts[q + 2], pts[q + 1]); }
      for (let j = n; j >= 0; j--) { const q = j * 3; c.lineTo(pts[q] + pts[q + 2], pts[q + 1]); }
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(220,170,255,0.55)';
      c.beginPath();
      for (let j = 2; j < n; j += 2) { const q = j * 3; c.moveTo(pts[q] + 2, pts[q + 1]); c.arc(pts[q] + pts[q + 2] * 0.3, pts[q + 1], 1.2, 0, TAU); }
      c.fill();
    }
    void area;
  }

  // ---------------------------------------------------------------- 手前（戦う者の前）
  const FRONT = {
    meadow() {
      winds(3, 120, GY - 30, 'rgba(255,255,255,0.95)', (x, y, r, a) => { c.globalAlpha = a; petal(x, y, r, '#ffc0d8', 1.2); petal(x - 10, y + 5, r + 2, '#ffffff', 1); c.globalAlpha = 1; });
      drift(5, 14, 10, ['#ffd0e0', '#ffffff', '#fff2a0'], 'petal', GY - 160, GY + 60, 1);
    },
    forest() {
      winds(1, 150, GY - 60, 'rgba(240,255,230,0.75)', (x, y, r, a) => { c.globalAlpha = a; leaf(x, y, r, '#a8c860', 1.3); c.globalAlpha = 1; });
      fireflies(4, 0, 360, GY - 60, GY + 30, '#f0ff9a');
      drift(3, 10, 22, ['#8ab850', '#c8a050'], 'leaf', GY - 220, GY + 60, 1.2);
    },
    cave() {
      drift(8, 4, -6, ['#bfefff'], 'mote', GY - 260, GY + 20, 1.2);
    },
    castle() {
      winds(1, 140, GY - 80, 'rgba(230,220,250,0.55)', null, 0.5);
      drift(6, 5, -4, ['#ffe8c0'], 'mote', GY - 220, GY + 20, 1.2);
    },
    peak() {
      winds(4, 110, GY - 40, 'rgba(255,240,225,0.9)', (x, y, r, a) => { c.globalAlpha = a; c.fillStyle = '#ffb060'; c.fillRect(x, y, 2, 2); c.fillRect(x - 9, y + 4, 1.6, 1.6); c.globalAlpha = 1; });
      drift(10, 30, -14, ['#ffb070', '#ffd8a0'], 'ember', GY - 250, GY + 40, 1);
    },
    harbor() {
      winds(3, 110, GY - 70, 'rgba(255,255,255,0.95)', null, 0.75);
      // しぶき（桟橋のふち）
      for (let i = 0; i < 6; i++) {
        const per = 1.6 + hh(i, 9) * 1.2, lt = fr(T / per + hh(i, 8));
        if (lt > 0.5) continue;
        const u = lt / 0.5;
        const x = wrapX(hh(CF.seed, 500 + i) * 400 - SC * 1, 400, 20), y = GY - 2 - Math.sin(u * Math.PI) * 10;
        c.fillStyle = `rgba(255,255,255,${0.8 * (1 - u)})`;
        c.fillRect(x - 1, y, 2, 2); c.fillRect(x + 4 * u, y + 2, 1.4, 1.4);
      }
    },
    sky() {
      winds(4, 120, GY - 40, 'rgba(255,255,255,0.95)', (x, y, r, a) => { c.globalAlpha = a; petal(x, y, r, '#ffffff', 1.4); c.globalAlpha = 1; });
      drift(6, 12, 8, ['#ffffff', '#fff0c8'], 'petal', GY - 260, GY + 40, 1.1);
    },
    abyss() {
      drift(10, 6, -10, ['#d8b0ff', '#ff9ad8'], 'mote', GY - 260, GY + 30, 1.4);
    },
  };

  // ---------------------------------------------------------------- 入口
  X.prep = function (reel, pl, L, t) {
    if (!reel || reel.digest || !pl) { CF = null; return; }
    REEL = reel; PL = pl; LY = L; T = t; GY = L ? L.gy : GY;
    CF = cfgOf(reel);
    RM = reduced();
    mood(pl, reel, t);
  };
  X.drawSky = function (ctx, area, scroll, t, gy) {
    if (!CF || !ctx || !area || CF.area !== area.id) return;
    if (ctx.canvas && ctx.canvas.width <= 2) return; // 下ごしらえ用の仮の絵には描かない
    const f = SKY[area.id];
    if (!f) return;
    c = ctx; SC = scroll; T = t; GY = gy;
    ctx.save();
    try { f(area); } catch (e) { if (!X._err) { X._err = e; console.warn('reelfx sky', e); } }
    ctx.restore();
  };
  X.drawBack = function (ctx, area, scroll, t, gy, pl, reel, L) {
    if (!reel || reel.digest || !area) return;
    if (REEL !== reel || !CF) X.prep(reel, pl, L || LY, t);
    if (!CF || CF.area !== area.id) return;
    const f = BACK[area.id];
    if (!f) return;
    c = ctx; SC = scroll; T = t; GY = gy;
    ctx.save();
    try { f(area); } catch (e) { if (!X._err) { X._err = e; console.warn('reelfx back', e); } }
    ctx.restore();
  };
  X.drawFront = function (ctx, area, scroll, t, gy, pl, reel) {
    if (!reel || reel.digest || !area || REEL !== reel || !CF || CF.area !== area.id) return;
    const f = FRONT[area.id];
    if (!f) return;
    c = ctx; SC = scroll; T = t; GY = gy;
    ctx.save();
    try { f(area); } catch (e) { if (!X._err) { X._err = e; console.warn('reelfx front', e); } }
    ctx.restore();
  };
  X._debug = { mood: () => M, cfg: () => CF, SKY, BACK, FRONT };
})();
