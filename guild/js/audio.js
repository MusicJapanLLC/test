/* ギルドの灯 — audio: Web Audio だけで鳴らすケルト風BGMと効果音
 *  - 外部音源ファイルは使わない。曲はこのファイルの中で作曲したオリジナル。
 *  - 楽器（すべて合成）:
 *      ティンホイッスル・木のフルート（息の音・ビブラート・カット/ロール/スライドの装飾音）
 *      イーリアンパイプ（チャンターとドローン）・フィドル/チェロ（弓の立ち上がり・ビブラート）・アコーディオン（ミュゼット）
 *      ハープ/ギター/ブズーキ/ピチカート/ベース（カープラス＝ストロングで1音ずつ作ってキャッシュ）
 *      グロッケン/チェレスタ・パッド・バウロン・シェイカー
 *  - 曲 = 「部品（A/B…の旋律と和音）」×「編曲（部品ごとの楽器の割り当て）」。
 *    ハーモニー・対旋律・ベース・伴奏は和音から自動で作り、くり返すたびに装飾音・変奏・楽器が変わる。
 *  - ミックス: 楽器ごとのEQ・定位・残響センド → 曲ごとの音量 → BGM音量 → こもり(LPF) → コンプ → リミッター。
 *  - BGM は場面ごとにクロスフェード、メニューを開くとローパスで「こもる」。
 *  公開: init / applyVolumes / setMuffle / playTrack(name, opt)=play / playHome / playTitle / setNight /
 *        setEvent / eventTrack / isEvent / pause / resume / sfx / setAmbient / envTick / track / tracks / trackTitle
 */
'use strict';
(function () {
  const A = (G.audio = {});
  let ctx = null;
  let master, comp, limiter, musicIn, musicGain, musicLP, musicWetIn, musicWetGain, musicWetLP, sfxGain, ambGain, convolver, revReturn, sfxSend;
  let noiseBuf = null, brownBuf = null;
  let current = null; // 再生中のトラック
  let wantTrack = 'guild';
  let schedTimer = null;
  let ambientLevel = 0;
  let murmur = null;
  A.night = false;
  A.ready = false;
  A.muffled = false;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rr = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const MUSIC_K = 2.1; // BGM 音量の係数（設定 0.6 で効果音と釣り合う大きさ）
  let errCount = 0;
  function report(e) { if (errCount++ < 3) console.error('[audio]', e); }

  // ---------------------------------------------------------------- init
  A.init = function () {
    if (ctx) {
      if (ctx.state === 'suspended') resumeCtx();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try { ctx = new AC(); } catch (e2) { ctx = null; return; }
    }
    try {
      buildGraph();
    } catch (e) {
      console.warn('[audio] init failed', e);
      try { ctx.close(); } catch (e2) { /* noop */ }
      ctx = null;
      return;
    }
    A.ready = true;
    schedTimer = setInterval(schedule, 30);
    if (ctx.state === 'suspended') resumeCtx();
    A.playTrack(wantTrack, true);
    A.setAmbient(ambientLevel);
  };
  function resumeCtx() {
    try {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
      return p;
    } catch (e) { return null; }
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.25;
    // 最後にリミッター：派手な効果音が重なっても割れない
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    master.connect(comp).connect(limiter).connect(ctx.destination);

    convolver = ctx.createConvolver();
    convolver.buffer = makeIR(2.6);
    revReturn = ctx.createGain();
    revReturn.gain.value = 0.32;
    convolver.connect(revReturn).connect(master);

    // 音楽：乾いた音 → 音量 → こもり → master ／ 残響へ送る音 → 音量 → こもり → 残響（効果音と共用）
    musicIn = ctx.createGain();
    musicGain = ctx.createGain();
    musicLP = ctx.createBiquadFilter();
    musicLP.type = 'lowpass';
    musicLP.frequency.value = 18000;
    musicLP.Q.value = 0.5;
    musicIn.connect(musicGain).connect(musicLP).connect(master);
    musicWetIn = ctx.createGain();
    musicWetGain = ctx.createGain();
    musicWetLP = ctx.createBiquadFilter();
    musicWetLP.type = 'lowpass';
    musicWetLP.frequency.value = 18000;
    musicWetLP.Q.value = 0.5;
    musicWetIn.connect(musicWetGain).connect(musicWetLP).connect(convolver);

    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.18;
    sfxGain.connect(sfxSend).connect(convolver);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0;
    ambGain.connect(master);

    noiseBuf = makeNoise(2, false);
    brownBuf = makeNoise(4, true);
    // 太鼓は最初に作っておく（短いので軽い）
    ['open', 'mid', 'top', 'shk', 'shk2'].forEach((k) => { for (let v = 0; v < 3; v++) drumBuf(k, v); });

    A.applyVolumes();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.8);
  }

  function makeNoise(sec, brown) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  }

  // 温かい残響（後半ほど暗くなるノイズ）
  function makeIR(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const p = i / len;
        const a = 0.55 - p * 0.47; // 時間とともに高域が落ちる
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.pow(1 - p, 2.4) * (i < 300 ? i / 300 : 1);
      }
      // 初期反射
      [0.011, 0.019, 0.027, 0.041].forEach((t, k) => {
        const idx = Math.floor((t + ch * 0.003) * ctx.sampleRate);
        if (idx < len) d[idx] += 0.5 / (k + 1);
      });
    }
    return b;
  }

  A.applyVolumes = function () {
    if (!ctx) return;
    const s = G.state ? G.state.settings : { bgm: 0.6, sfx: 0.8 };
    const bgm = s.bgm == null ? 0.6 : s.bgm, sfx = s.sfx == null ? 0.8 : s.sfx;
    const t = ctx.currentTime;
    const mv = Math.pow(bgm, 1.4) * MUSIC_K * (A.muffled ? 0.62 : 1);
    musicGain.gain.setTargetAtTime(mv, t, 0.08);
    musicWetGain.gain.setTargetAtTime(mv, t, 0.08);
    sfxGain.gain.setTargetAtTime(Math.pow(sfx, 1.2) * 1.7, t, 0.05);
  };

  // メニューを開いた時、音楽を少しこもらせる
  A.setMuffle = function (on) {
    A.muffled = on;
    if (!ctx) return;
    const f = on ? 1150 : 18000, tc = on ? 0.09 : 0.18;
    musicLP.frequency.setTargetAtTime(f, ctx.currentTime, tc);
    musicWetLP.frequency.setTargetAtTime(f, ctx.currentTime, tc);
    A.applyVolumes();
  };

  // タブを離れたらふわっと消え、戻ったらふわっと戻る
  A.pause = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.35);
    setTimeout(() => { if (document.hidden && ctx) { try { const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* noop */ } } }, 420);
  };
  A.resume = function () {
    if (!ctx) return;
    const go = () => {
      if (!ctx) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(0, t);
      master.gain.linearRampToValueAtTime(1, t + 1.4);
      try { if (current) current.resync(); if (A._old && A._old.alive) A._old.resync(); } catch (e) { report(e); }
    };
    const p = resumeCtx();
    if (p && p.then) p.then(go, () => {});
    else go();
  };

  A._debug = () => ({ ctx, master, musicGain, musicIn, sfxGain, voices: VS.ends.length, INST });

  // ---------------------------------------------------------------- 音源の部品
  function mkPan(v) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(v, -1, 1); return p; }
    return ctx.createGain();
  }
  // 倍音の配合（PeriodicWave は AudioContext ごとに作る）
  const WAVE_DEF = {
    whistle: [1, 0.14, 0.06, 0.025, 0.012],
    flute: [1, 0.34, 0.12, 0.05, 0.022, 0.01],
    chanter: [1, 0.62, 0.92, 0.48, 0.66, 0.34, 0.42, 0.24, 0.24, 0.14, 0.12, 0.07, 0.06],
    reed: [1, 0.78, 0.62, 0.5, 0.44, 0.36, 0.3, 0.25, 0.2, 0.16, 0.12, 0.09, 0.07, 0.05],
    drone: [1, 0.3, 0.55, 0.18, 0.36, 0.12, 0.22, 0.08, 0.12, 0.05, 0.06],
  };
  const WAVES = new WeakMap();
  function pwave(name) {
    let w = WAVES.get(ctx);
    if (!w) { w = {}; WAVES.set(ctx, w); }
    if (!w[name]) {
      const h = WAVE_DEF[name];
      const re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1);
      h.forEach((a, i) => { im[i + 1] = a; });
      w[name] = ctx.createPeriodicWave(re, im);
    }
    return w[name];
  }
  // 1音ずつ作った音（弦・鉄琴・太鼓）のキャッシュ。AudioBuffer はどの AudioContext でも使える
  const BUF = new Map();
  function cached(key, make) {
    let b = BUF.get(key);
    if (!b) {
      b = make();
      BUF.set(key, b);
      if (BUF.size > 240) BUF.delete(BUF.keys().next().value);
    }
    return b;
  }
  function toBuffer(data, sr) {
    const b = ctx.createBuffer(1, data.length, sr);
    if (b.copyToChannel) b.copyToChannel(data, 0);
    else b.getChannelData(0).set(data);
    return b;
  }
  // ピークをそろえて、終わりをなめらかに消す
  function finish(out, fadeFrac) {
    let pk = 0;
    for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > pk) pk = a; }
    const k = pk > 0 ? 0.95 / pk : 0;
    const n = out.length, fade = Math.max(1, Math.floor(n * fadeFrac));
    for (let i = 0; i < n; i++) out[i] *= i > n - fade ? (k * (n - i)) / fade : k;
  }

  // ---- カープラス＝ストロング（はじく弦）
  const KS = {
    harp: { t60: (f) => clamp(3.6 - Math.log2(f / 98) * 0.7, 1.0, 3.6), bright: 0.42, pos: 0.27, cap: 2.4 },
    guitar: { t60: (f) => clamp(2.6 - Math.log2(f / 98) * 0.5, 0.8, 2.6), bright: 0.62, pos: 0.17, cap: 1.6 },
    bouz: { t60: (f) => clamp(2.2 - Math.log2(f / 110) * 0.4, 0.8, 2.2), bright: 0.85, pos: 0.12, cap: 1.5, dbl: 1.0035, oct: 1 },
    bass: { t60: () => 2.2, bright: 0.28, pos: 0.2, cap: 1.8 },
    pizz: { t60: () => 0.5, bright: 0.5, pos: 0.22, cap: 0.55 },
  };
  function ksString(out, sr, f, t60, P, amp) {
    const p = sr / f;
    const S = f > 400 ? clamp(0.5 - (f - 400) / 2400, 0.18, 0.5) : 0.5; // ループのフィルタ（高い弦ほど軽く）
    let N = Math.floor(p - S), frac = p - S - N;
    if (frac < 0.15) { N -= 1; frac += 1; }
    if (N < 2) return;
    const C = (1 - frac) / (1 + frac); // 端数の遅れはオールパスで（音程を正確に）
    const line = new Float32Array(N);
    let lp = 0;
    const a = P.bright;
    for (let i = 0; i < N; i++) { lp += a * (Math.random() * 2 - 1 - lp); line[i] = lp; }
    const d = Math.max(1, Math.round(N * P.pos)); // はじく位置（櫛形フィルタ）
    for (let i = N - 1; i >= d; i--) line[i] -= line[i - d];
    let mean = 0;
    for (let i = 0; i < N; i++) mean += line[i];
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const rho = Math.pow(0.001, 1 / (f * t60));
    const S1 = 1 - S;
    let idx = 0, prev = 0, ax = 0, ay = 0;
    for (let i = 0; i < out.length; i++) {
      const cur = line[idx];
      out[i] += cur * amp;
      const lv = S1 * cur + S * prev;
      prev = cur;
      const y = C * lv + ax - C * ay;
      ax = lv;
      ay = y;
      line[idx] = y * rho;
      if (++idx === N) idx = 0;
    }
  }
  function renderKS(kind, m) {
    const P = KS[kind], f = mtof(m);
    const sr = f < 160 ? 16000 : f < 520 ? 22050 : 32000;
    const t60 = P.t60(f);
    const n = Math.max(256, Math.floor(Math.min(P.cap, t60 * 0.8 + 0.05) * sr));
    const out = new Float32Array(n);
    ksString(out, sr, f, t60, P, 1);
    if (P.dbl) ksString(out, sr, f * P.dbl, t60, P, 0.7); // 複弦（少しずらしてうなり）
    if (P.oct && f < 300) ksString(out, sr, f * 2.001, t60 * 0.8, P, 0.35); // 低い弦はオクターブ複弦
    finish(out, 0.15);
    return toBuffer(out, sr);
  }
  // ---- 鉄琴（グロッケン / チェレスタ）
  const MALLET = {
    glock: { p: [[1, 1, 1.9], [2.76, 0.3, 0.55], [5.4, 0.12, 0.2], [8.93, 0.05, 0.09]], att: 0.0015, click: 0.12, cap: 1.9 },
    celesta: { p: [[1, 1, 1.3], [2, 0.2, 0.5], [3, 0.07, 0.22], [4.16, 0.05, 0.12]], att: 0.004, click: 0.04, cap: 1.4 },
  };
  function renderMallet(kind, m) {
    const P = MALLET[kind], f = mtof(m), sr = 32000;
    const n = Math.floor(P.cap * sr);
    const out = new Float32Array(n);
    for (const [r, a, t60] of P.p) {
      const fr = f * r;
      if (fr > sr * 0.45) continue;
      const w = (2 * Math.PI * fr) / sr, c2 = 2 * Math.cos(w), k = Math.pow(0.001, 1 / (t60 * sr));
      const ph = Math.random() * 6.28;
      let y1 = Math.sin(ph - w), y2 = Math.sin(ph - 2 * w), env = a;
      for (let i = 0; i < n; i++) {
        const y = c2 * y1 - y2;
        y2 = y1;
        y1 = y;
        out[i] += y * env;
        env *= k;
      }
    }
    const na = Math.floor(P.att * sr);
    for (let i = 0; i < na; i++) out[i] *= i / na;
    const nc = Math.floor(0.004 * sr);
    for (let i = 0; i < nc; i++) out[i] += (Math.random() * 2 - 1) * P.click * (1 - i / nc);
    finish(out, 0.2);
    return toBuffer(out, sr);
  }
  // ---- 太鼓（バウロン：皮の音＋叩く音）とシェイカー
  const DRUM = {
    open: { f0: 128, f1: 64, gl: 0.07, dec: 0.4, tone: 1, ov: 0.22, nz: 0.55, nlp: 0.07, ndec: 0.035 },
    mid: { f0: 205, f1: 120, gl: 0.04, dec: 0.17, tone: 0.9, ov: 0.18, nz: 0.5, nlp: 0.16, ndec: 0.026 },
    top: { f0: 320, f1: 240, gl: 0.02, dec: 0.065, tone: 0.5, ov: 0.1, nz: 0.8, nlp: 0.5, ndec: 0.016 },
    boom: { f0: 96, f1: 42, gl: 0.12, dec: 0.8, tone: 1, ov: 0.2, nz: 0.35, nlp: 0.045, ndec: 0.05 },
    shk: { tone: 0, nz: 1, hp: 0.8, att: 0.012, ndec: 0.045 },
    shk2: { tone: 0, nz: 1, hp: 0.8, att: 0.018, ndec: 0.075 },
  };
  function renderDrum(kind, v) {
    const P = DRUM[kind], sr = 22050;
    const len = Math.floor(((P.dec || 0) * 1.1 + P.ndec * 5 + (P.att || 0) + 0.02) * sr);
    const out = new Float32Array(len);
    const det = 1 + (v - 1) * 0.035;
    if (P.tone) {
      let ph = 0, ph2 = 0, env = P.tone;
      const kd = Math.pow(0.001, 1 / (P.dec * sr));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = (P.f1 + (P.f0 - P.f1) * Math.exp(-t / P.gl)) * det;
        ph += (2 * Math.PI * f) / sr;
        ph2 += (2 * Math.PI * f * 1.59) / sr;
        const a = i < 40 ? i / 40 : 1;
        out[i] += (Math.sin(ph) + Math.sin(ph2) * P.ov * Math.exp(-t / (P.dec * 0.25))) * env * a;
        env *= kd;
      }
    }
    let lp = 0, x1 = 0, hp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const w = Math.random() * 2 - 1;
      let s;
      if (P.hp) { hp = P.hp * (hp + w - x1); x1 = w; s = hp * (0.7 + 0.3 * Math.random()); }
      else { lp += P.nlp * (w - lp); s = (lp * 0.5) / Math.sqrt(P.nlp); }
      const at = P.att || 0;
      out[i] += s * P.nz * (at ? Math.min(1, t / at) : 1) * Math.exp(-Math.max(0, t - at) / P.ndec);
    }
    finish(out, 0.1);
    return toBuffer(out, sr);
  }
  const drumBuf = (kind, v) => cached('dr:' + kind + v, () => renderDrum(kind, v));

  // ---------------------------------------------------------------- 楽器
  function cleanup(src, nodes) {
    src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* noop */ } } };
  }
  // 装飾音：カット（上の音を一瞬）・タップ（下の音）・ロール（上・本・下・本）・スライド（下からずり上げ）
  function setPitch(params, f, t, dur, ev) {
    const orn = ev && ev.orn;
    const gr = Math.min(0.034, dur * 0.22);
    for (const p of params) {
      if (orn === 'cut' && dur > 0.1) { p.setValueAtTime(mtof(ev.up), t); p.setValueAtTime(f, t + gr); }
      else if (orn === 'tap' && dur > 0.1) { p.setValueAtTime(mtof(ev.dn), t); p.setValueAtTime(f, t + gr); }
      else if (orn === 'slide' && dur > 0.2) { p.setValueAtTime(mtof(ev.dn), t); p.exponentialRampToValueAtTime(f, t + Math.min(0.14, dur * 0.3)); }
      else {
        p.setValueAtTime(f, t);
        if (orn === 'roll' && dur > 0.24) {
          const s = dur / 3;
          p.setValueAtTime(mtof(ev.up), t + s - gr);
          p.setValueAtTime(f, t + s);
          p.setValueAtTime(mtof(ev.dn), t + 2 * s - gr);
          p.setValueAtTime(f, t + 2 * s);
        }
      }
    }
  }
  function vibrato(params, f, t, dur, end, depth, nodes) {
    const l = ctx.createOscillator();
    l.frequency.value = 4.8 + Math.random();
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + 0.16);
    lg.gain.linearRampToValueAtTime(f * depth, t + Math.min(dur, 0.8));
    l.connect(lg);
    for (const p of params) lg.connect(p);
    l.start(t);
    l.stop(end);
    nodes.push(l, lg);
  }

  // 笛（ホイッスル・フルート・チャンター）
  function windNote(t, m, dur, vel, dest, ev, I) {
    const f = mtof(m), end = t + Math.max(0.04, dur);
    const leg = ev && ev.leg;
    const att = I.wave === 'chanter' ? 0.01 : leg ? 0.014 : 0.026;
    const rel = I.rel || 0.06;
    const o = ctx.createOscillator();
    o.setPeriodicWave(pwave(I.wave));
    const g = ctx.createGain(), gg = g.gain;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(vel, t + att);
    if (dur > 0.5 && I.swell) { gg.linearRampToValueAtTime(vel * 0.8, t + att + 0.1); gg.linearRampToValueAtTime(vel * 0.95, t + dur * 0.6); }
    else if (dur > 0.18) gg.linearRampToValueAtTime(vel * 0.84, t + att + 0.09);
    gg.linearRampToValueAtTime(vel * 0.78, end);
    gg.linearRampToValueAtTime(0, end + rel);
    setPitch([o.frequency], f, t, dur, ev);
    const nodes = [o, g];
    if (I.vib && dur > 0.38) vibrato([o.frequency], f, t, dur, end + rel, I.vib, nodes);
    if (I.breath) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuf;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(8000, f * 2.4);
      bp.Q.value = 0.8;
      const ng = ctx.createGain();
      const b = vel * I.breath;
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(b * (leg ? 0.45 : 1), t + 0.012);
      // 短い音は吹き始めの「ふっ」だけ（軽くするため）、長い音は息の音がずっと続く
      const held = dur > 0.34;
      ng.gain.linearRampToValueAtTime(held ? b * 0.22 : 0, t + (held ? 0.07 : 0.08));
      if (held) { ng.gain.setValueAtTime(b * 0.22, end); ng.gain.linearRampToValueAtTime(0, end + rel); }
      n.connect(bp).connect(ng).connect(dest);
      n.start(t, Math.random() * 1.6);
      n.stop(held ? end + rel + 0.02 : t + 0.09);
      nodes.push(n, bp, ng);
    }
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(end + rel + 0.02);
    cleanup(o, nodes);
    return end + rel;
  }

  // フィドル / チェロ：2本のノコギリ波を少しずらし、弓が弦をとらえるまでフィルタが開いていく
  function fiddleNote(t, m, dur, vel, dest, ev, I) {
    const f = mtof(m), end = t + Math.max(0.05, dur);
    const leg = ev && ev.leg;
    const att = I.cello ? 0.07 : leg ? 0.03 : 0.045;
    const rel = I.cello ? 0.12 : 0.08;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.detune.value = -4 - Math.random() * 3;
    o2.detune.value = 4 + Math.random() * 3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    const top = Math.min(I.cello ? 2600 : 6500, f * (I.cello ? 7 : 10));
    lp.frequency.setValueAtTime(Math.max(200, f * 1.6), t);
    lp.frequency.linearRampToValueAtTime(top, t + att * 1.6);
    if (dur > 0.25) lp.frequency.linearRampToValueAtTime(top * 0.72, end);
    const g = ctx.createGain(), gg = g.gain, pk = vel * 0.5;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(pk, t + att);
    if (dur > 0.3) gg.linearRampToValueAtTime(pk * 0.86, t + att + 0.12);
    gg.linearRampToValueAtTime(pk * 0.8, end);
    gg.linearRampToValueAtTime(0, end + rel);
    setPitch([o1.frequency, o2.frequency], f, t, dur, ev);
    const nodes = [o1, o2, lp, g];
    if (I.vib && dur > 0.35) vibrato([o1.frequency, o2.frequency], f, t, dur, end + rel, I.vib, nodes);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(dest);
    o1.start(t);
    o2.start(t);
    o1.stop(end + rel + 0.02);
    o2.stop(end + rel + 0.02);
    cleanup(o1, nodes);
    return end + rel;
  }

  // アコーディオン：2枚のリードを少しずらして（ミュゼット）、ゆれる
  function accNote(t, m, dur, vel, dest, ev) {
    const f = mtof(m), end = t + Math.max(0.04, dur), rel = 0.05;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.setPeriodicWave(pwave('reed'));
    o2.setPeriodicWave(pwave('reed'));
    o1.detune.value = -9;
    o2.detune.value = 10;
    const g = ctx.createGain(), gg = g.gain, pk = vel * 0.5;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(pk, t + 0.022);
    gg.linearRampToValueAtTime(pk * 0.9, end);
    gg.linearRampToValueAtTime(0, end + rel);
    setPitch([o1.frequency, o2.frequency], f, t, dur, ev);
    o1.connect(g);
    o2.connect(g);
    g.connect(dest);
    o1.start(t);
    o2.start(t);
    o1.stop(end + rel + 0.02);
    o2.stop(end + rel + 0.02);
    cleanup(o1, [o1, o2, g]);
    return end + rel;
  }

  // はじく弦（キャッシュした1音を鳴らすだけ。dur があればそこで指で止める）
  function pluckNote(t, m, dur, vel, dest, ev, I) {
    const buf = cached('ks:' + I.ks + ':' + m, () => renderKS(I.ks, m));
    return playBuf(buf, t, dur, vel, dest, I.damp || 0.12);
  }
  function malletNote(t, m, dur, vel, dest, ev, I) {
    const buf = cached('ml:' + I.kind + ':' + m, () => renderMallet(I.kind, m));
    return playBuf(buf, t, 0, vel, dest, 0);
  }
  function playBuf(buf, t, dur, vel, dest, damp) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const rate = 1 + (Math.random() - 0.5) * 0.0024;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    let stop = t + buf.duration / rate;
    g.gain.setValueAtTime(vel, t);
    if (dur > 0 && t + dur + 0.02 < stop) {
      g.gain.setValueAtTime(vel, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + damp);
      stop = t + dur + damp + 0.01;
    }
    s.connect(g).connect(dest);
    s.start(t);
    s.stop(stop);
    cleanup(s, [s, g]);
    return stop;
  }
  function drumHit(t, kind, vel, dest) {
    const buf = drumBuf(kind, Math.floor(Math.random() * 3));
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vel;
    s.connect(g).connect(dest);
    s.start(t);
    cleanup(s, [s, g]);
    return t + buf.duration;
  }

  // パッド：ずらしたノコギリ波を左右に分けて、ゆっくり開くローパスで
  function padChord(t, ms, dur, vel, dL, dR) {
    const end = t + dur, att = Math.min(1.4, dur * 0.4), rel = 1.6;
    const nodes = [];
    let first = null;
    [[dL, -1], [dR, 1]].forEach(([dest, side]) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.6;
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.linearRampToValueAtTime(1500, t + att + 0.5);
      lp.frequency.linearRampToValueAtTime(800, end + rel);
      const g = ctx.createGain(), pk = vel / ms.length;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(pk, t + att);
      g.gain.linearRampToValueAtTime(pk * 0.85, end);
      g.gain.linearRampToValueAtTime(0, end + rel);
      lp.connect(g).connect(dest);
      nodes.push(lp, g);
      for (const m of ms) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = side * (6 + Math.random() * 4);
        o.connect(lp);
        o.start(t);
        o.stop(end + rel + 0.05);
        nodes.push(o);
        if (!first) first = o;
      }
    });
    if (first) cleanup(first, nodes);
    return end + rel;
  }

  // 楽器の表：音の出し方・移調(oct)・音量・定位・残響・EQ・装飾の可否・重さ(w)
  const INST = {
    wh: { play: windNote, wave: 'whistle', oct: 12, vol: 0.2, pan: 0.06, rev: 0.3, breath: 0.32, vib: 0.0045, orn: 2, w: 2, hum: 0.008, eq: [['highpass', 400, 0.7]] },
    fl: { play: windNote, wave: 'flute', oct: 0, vol: 0.26, pan: -0.04, rev: 0.4, breath: 0.55, vib: 0.006, orn: 2, w: 2, swell: 1, rel: 0.09, hum: 0.01, range: [60, 81], eq: [['highpass', 180, 0.7], ['lowpass', 5000, 0.6]] },
    pp: { play: windNote, wave: 'chanter', oct: 12, vol: 0.11, pan: 0.04, rev: 0.32, orn: 2, w: 1.5, hum: 0.006, eq: [['highpass', 260, 0.7], ['peaking', 1250, 1.1, 4], ['lowpass', 4600, 0.7]] },
    fd: { play: fiddleNote, oct: 0, vol: 0.16, pan: -0.18, rev: 0.36, vib: 0.006, orn: 2, w: 2, hum: 0.01, range: [55, 79], eq: [['peaking', 480, 1.2, 3], ['peaking', 2700, 1.4, 4], ['lowpass', 7000, 0.6]] },
    vc: { play: fiddleNote, cello: 1, oct: -12, vol: 0.18, pan: -0.3, rev: 0.4, vib: 0.005, orn: 0, w: 2, hum: 0.012, range: [38, 62], eq: [['peaking', 240, 1, 3], ['lowpass', 2800, 0.7]] },
    ac: { play: accNote, oct: 0, vol: 0.09, pan: 0.26, rev: 0.26, orn: 1, w: 1.5, hum: 0.006, range: [53, 74], eq: [['peaking', 1300, 1, 3], ['lowpass', 3800, 0.7]] },
    hp: { play: pluckNote, ks: 'harp', vol: 0.24, pan: -0.32, rev: 0.45, damp: 0.3, w: 0.5, hum: 0.006, eq: [['lowpass', 7500, 0.5]] },
    gt: { play: pluckNote, ks: 'guitar', vol: 0.15, pan: 0.34, rev: 0.25, damp: 0.08, w: 0.5, hum: 0.004, eq: [['peaking', 180, 1, 2], ['lowpass', 6000, 0.6]] },
    bz: { play: pluckNote, ks: 'bouz', vol: 0.13, pan: 0.38, rev: 0.25, damp: 0.07, w: 0.5, hum: 0.004, eq: [['highpass', 120, 0.7], ['peaking', 2400, 1, 3]] },
    pz: { play: pluckNote, ks: 'pizz', vol: 0.3, pan: -0.12, rev: 0.3, damp: 0.06, w: 0.4, hum: 0.006, eq: [['peaking', 420, 1, 4], ['lowpass', 3800, 0.6]] },
    bs: { play: pluckNote, ks: 'bass', vol: 0.36, pan: 0, rev: 0.1, damp: 0.12, w: 0.5, hum: 0.004, eq: [['lowpass', 1500, 0.7]] },
    gl: { play: malletNote, kind: 'glock', oct: 24, vol: 0.1, pan: 0.42, rev: 0.5, w: 0.4, hum: 0.004 },
    ce: { play: malletNote, kind: 'celesta', oct: 12, vol: 0.13, pan: 0.3, rev: 0.5, w: 0.4, hum: 0.004 },
    pad: { vol: 0.07, rev: 0.6, w: 3 },
    dr: { vol: 0.42, pan: 0.06, rev: 0.12, w: 0.4, hum: 0.003, eq: [['peaking', 90, 1, 2]] },
    sh: { vol: 0.08, pan: -0.45, rev: 0.12, w: 0.3, hum: 0.004, eq: [['highpass', 2500, 0.7]] },
    drone: { vol: 1, pan: 0, rev: 0.3 },
  };
  // 役割：L=主旋律 D=重ね H=ハーモニー C=対旋律 A/A2=伴奏 B=ベース P=パッド R=太鼓 K=シェイカー G=鉄琴のきらめき N=ドローン
  const ROLE_PAN = { L: 0.04, D: -0.24, H: 0.3, C: -0.34 };
  const ROLE_VOL = { L: 1, D: 0.55, H: 0.6, C: 0.62, A: 1, A2: 0.75, B: 1, P: 1, R: 1, K: 1, G: 1, N: 1 };
  const ROLE_PRIO = { L: 3, B: 3, D: 2, H: 2, R: 2, A: 2, A2: 1, C: 1, P: 1, K: 1, G: 1 };

  // 同時発音の上限（スマホ向け）。重さの合計で数え、混んだら目立たないパートから省く
  let VS = { ends: [], w: [] };
  const MAXW = 44;
  function voiceOK(t, end, w, prio) {
    const E = VS.ends, W = VS.w;
    let tot = 0;
    for (let i = E.length - 1; i >= 0; i--) {
      if (E[i] < t) { E.splice(i, 1); W.splice(i, 1); } else tot += W[i];
    }
    if (prio < 3 && tot + w > MAXW + (prio === 2 ? 8 : 0)) return false;
    E.push(end);
    W.push(w);
    return true;
  }

  // 効果音から使う楽器（昔の呼び方のまま）
  function whistle(t, m, dur, vol, dest) { windNote(t, m, dur, vol, dest, null, INST.wh); }
  function harp(t, m, vol, dest, ring = 1.9) { pluckNote(t, m, ring, vol, dest, null, INST.hp); }
  function bodhran(t, acc, vol, dest) { drumHit(t, acc > 0.7 ? 'open' : 'mid', vol * acc, dest); }
  function celesta(t, m, vol, dest) { malletNote(t, m, 0, vol, dest, null, INST.ce); }

  // ---------------------------------------------------------------- 楽譜
  // ABC 記法のごく一部を読む（1 = 8分音符、A2=4分、A/=16分、(3abc=3連符、, ' でオクターブ、^ = _ で臨時記号）
  const KEYS = { D: { F: 1, C: 1 }, G: { F: 1 }, C: {}, F: { B: -1 }, A: { F: 1, C: 1, G: 1 }, Dm: { B: -1 }, Em: { F: 1 }, Am: {}, Bm: { F: 1, C: 1 } };
  const SIG_TONIC = { D: 2, G: 7, C: 0, F: 5, A: 9, Dm: 5, Em: 7, Am: 0, Bm: 2 };
  const scaleOf = (key) => new Set([0, 2, 4, 5, 7, 9, 11].map((x) => (x + (SIG_TONIC[key] || 0)) % 12));
  function parseABC(str, key) {
    const out = [];
    const re = /(\(3)|(=|\^|_)?([A-Ga-gz])([,']*)(\d*)(\/?)(\d*)/g;
    const base = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
    const sig = KEYS[key || 'D'] || {};
    let m, t = 0, trip = 0;
    while ((m = re.exec(str))) {
      if (m[1]) { trip = 3; continue; }
      const acc = m[2], L = m[3], oct = m[4];
      let len = m[5] ? parseInt(m[5], 10) : 1;
      if (m[6]) len /= m[7] ? parseInt(m[7], 10) : 2;
      if (trip > 0) { len = (len * 2) / 3; trip--; }
      if (L === 'z') { t += len; continue; }
      const U = L.toUpperCase();
      let midi = base[U] + (L === U ? 0 : 12);
      for (const c of oct) midi += c === "'" ? 12 : -12;
      if (acc === '^') midi += 1;
      else if (acc === '_') midi -= 1;
      else if (acc !== '=' && sig[U]) midi += sig[U];
      out.push({ t, d: len, m: midi });
      t += len;
    }
    return { notes: out, len: t };
  }
  const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function chordInfo(name) {
    const mm = /^([A-G])([#b]?)(m?)(7|5|sus4|sus2)?$/.exec(name);
    if (!mm) return null;
    const root = (PCN[mm[1]] + (mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0) + 12) % 12;
    const minor = mm[3] === 'm', ext = mm[4];
    let iv = ext === '5' ? [0, 7] : ext === 'sus4' ? [0, 5, 7] : ext === 'sus2' ? [0, 2, 7] : [0, minor ? 3 : 4, 7];
    if (ext === '7') iv = iv.concat([10]);
    return { name, root, minor, third: ext === '5' || (ext && ext[0] === 's') ? null : minor ? 3 : 4, pcs: iv.map((x) => (x + root) % 12) };
  }
  // 和音：配列（部品全体を等分）か 'D | G A | ...'（小節ごと、小節内は等分）
  function parseChords(spec, len, bar) {
    const segs = [];
    if (Array.isArray(spec)) {
      const cd = len / spec.length;
      spec.forEach((n, k) => segs.push({ t: k * cd, d: cd, c: chordInfo(n) }));
    } else {
      spec.split('|').forEach((b, bi) => {
        const toks = b.trim().split(/\s+/).filter(Boolean);
        const cd = bar / toks.length;
        toks.forEach((n, k) => segs.push({ t: bi * bar + k * cd, d: cd, c: chordInfo(n) }));
      });
    }
    return segs;
  }
  const inRange = (pc, lo) => lo + ((((pc - lo) % 12) + 12) % 12); // lo 以上で一番低い pc の音
  const near = (pc, tg) => { const d = ((((pc - tg) % 12) + 12) % 12); return d > 6 ? tg + d - 12 : tg + d; };
  function scUp(m, sc) { for (let k = 1; k <= 3; k++) if (sc.has((m + k) % 12)) return m + k; return m + 2; }
  function scDn(m, sc) { for (let k = 1; k <= 3; k++) if (sc.has((m - k + 120) % 12)) return m - k; return m - 2; }
  function chordAt(P, t) { const ch = P.ch; for (let i = ch.length - 1; i >= 0; i--) if (ch[i].t <= t + 1e-6) return ch[i].c; return ch[0].c; }
  function noteAt(notes, t) { let r = null; for (const n of notes) { if (n.t > t + 1e-6) break; if (n.t + n.d > t + 1e-6) r = n; } return r; }
  // 同じ和音が続くところはつなげる（max を超える長さは区切る）
  function mergeSegs(P, max) {
    const out = [];
    for (const s of P.ch) {
      const l = out[out.length - 1];
      if (l && l.c.name === s.c.name && (!max || l.d + s.d <= max + 1e-6)) l.d += s.d;
      else out.push({ t: s.t, d: s.d, c: s.c });
    }
    return out;
  }
  function arpVoice(c, lo) {
    const r = inRange(c.root, lo);
    return [r, r + 7, r + 12, c.third != null ? r + 12 + c.third : r + 19, r + 19, r + 24];
  }
  function strumVoice(c, inst) {
    const r = inRange(c.root, inst === 'bz' ? 45 : 43);
    const th = c.third != null ? r + 12 + c.third : r + 19;
    return inst === 'bz' ? [r, r + 7, r + 12, th] : [r, r + 7, r + 12, th, r + 19];
  }
  const closeVoice = (c, center) => c.pcs.slice(0, 3).map((pc) => near(pc, center)).sort((a, b) => a - b);
  function harmPitch(m, c, sc) {
    let best = null, bd = 1e9;
    for (let p = m - 9; p <= m - 3; p++) {
      if (!c.pcs.includes(((p % 12) + 12) % 12)) continue;
      const d = Math.abs(p - (m - 4));
      if (d < bd) { bd = d; best = p; }
    }
    return best == null ? scDn(scDn(m, sc), sc) : best;
  }

  // ---------------------------------------------------------------- 編曲
  // 伴奏のパターン（位置は8分音符、拍子の「1小節の長さ/拍の長さ」ごと）
  const STRUM = {
    '6/3': [[0, 1, 1], [2, -1, 0.45], [3, 1, 0.8], [5, -1, 0.5]],
    '9/3': [[0, 1, 1], [2, -1, 0.42], [3, 1, 0.75], [5, -1, 0.42], [6, 1, 0.78], [8, -1, 0.45]],
    '8/2': [[0, 1, 1], [2, 1, 0.5], [3, -1, 0.42], [4, 1, 0.85], [6, 1, 0.5], [7, -1, 0.45]],
    '6/2': [[0, 1, 1], [2, 1, 0.55], [4, 1, 0.55], [5, -1, 0.35]],
  };
  const OOM = { '6/3': { b: [0, 3], c: [2, 5] }, '9/3': { b: [0, 3, 6], c: [2, 5, 8] }, '8/2': { b: [0, 4], c: [2, 6] }, '6/2': { b: [0], c: [2, 4] } };
  // バウロン [位置, 音, 強さ, 抜いてよい]
  const DRUMS = {
    jig: [[0, 'open', 1], [1, 'top', 0.22, 1], [2, 'top', 0.42], [3, 'mid', 0.78], [4, 'top', 0.22, 1], [5, 'top', 0.45]],
    slip: [[0, 'open', 1], [1, 'top', 0.2, 1], [2, 'top', 0.4], [3, 'mid', 0.75], [4, 'top', 0.2, 1], [5, 'top', 0.4], [6, 'mid', 0.78], [7, 'top', 0.2, 1], [8, 'top', 0.42]],
    reel: [[0, 'open', 1], [1, 'top', 0.3], [2, 'mid', 0.6], [3, 'top', 0.35], [4, 'open', 0.85], [5, 'top', 0.3], [6, 'mid', 0.62], [7, 'top', 0.45], [7.5, 'top', 0.2, 1]],
    hp: [[0, 'open', 1], [2, 'mid', 0.55], [3, 'top', 0.4], [4, 'open', 0.85], [6, 'mid', 0.55], [7, 'top', 0.45], [5, 'top', 0.2, 1]],
    polka: [[0, 'open', 1], [1, 'top', 0.35], [2, 'mid', 0.8], [3, 'top', 0.45], [4, 'open', 0.9], [5, 'top', 0.35], [6, 'mid', 0.8], [7, 'top', 0.45]],
    march: [[0, 'boom', 1], [2, 'mid', 0.45], [4, 'open', 0.8], [6, 'mid', 0.45], [7, 'top', 0.35], [7.5, 'top', 0.3]],
    waltz: [[0, 'open', 0.9], [2, 'top', 0.38], [4, 'top', 0.38], [5, 'top', 0.18, 1]],
    heart: [[0, 'open', 1], [1, 'open', 0.5]],
    boss: [[0, 'boom', 1], [1, 'top', 0.4], [2, 'mid', 0.7], [3, 'top', 0.45], [4, 'open', 0.9], [5, 'top', 0.4], [6, 'mid', 0.75], [7, 'mid', 0.6]],
    creep: [[0, 'open', 0.9], [2, 'top', 0.5], [3, 'top', 0.25, 1], [4, 'mid', 0.7], [6, 'top', 0.5], [7, 'top', 0.3]],
  };

  function accent(def, t) {
    const pb = ((t % def.bar) + def.bar) % def.bar;
    if (pb < 1e-6) return 1;
    if (Math.abs(pb % def.beat) < 1e-6) return 0.9;
    return Math.abs(pb - Math.round(pb)) < 1e-6 ? 0.8 : 0.72;
  }
  function nt(t, d, i, r, m, v, orn, def) {
    const e = { t, d, k: 'n', i, r, m, v };
    if (orn) {
      e.orn = orn;
      e.up = i === 'fd' || i === 'ac' ? scUp(m, def.sc) : scUp(scUp(m, def.sc), def.sc);
      e.dn = scDn(m, def.sc);
    }
    return e;
  }
  function ornFor(def, I, n, V) {
    if (!I.orn) return null;
    const r = Math.random();
    const onBeat = Math.abs(n.t % def.beat) < 1e-6;
    if (def.fast) {
      if (n.d >= def.beat && I.orn > 1 && r < 0.28 + V * 0.4) return 'roll';
      if (n.d >= 2 && r < 0.5 + V * 0.2) return 'cut';
      if (onBeat && r < 0.1 + V * 0.18) return 'cut';
      return null;
    }
    if (n.d >= 3 && I.orn > 1 && r < 0.22 + V * 0.2) return 'slide';
    if (n.d >= 2 && r < 0.25 + V * 0.15) return 'cut';
    return null;
  }
  // 変奏：長い音を経過音や刺繍音に割る（速い曲だけ）
  function vary(notes, def, V) {
    const out = [], sc = def.sc;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], nx = notes[i + 1];
      if (nx && Number.isInteger(n.d) && n.d >= 2 && n.d <= 4 && Math.abs(nx.t - n.t - n.d) < 1e-6 && Math.random() < V * 0.22) {
        let tw = nx.m > n.m ? scUp(n.m, sc) : nx.m < n.m ? scDn(n.m, sc) : scUp(n.m, sc);
        if (tw === nx.m) tw = nx.m > n.m ? scDn(n.m, sc) : scUp(n.m, sc);
        if (n.d === 2) out.push({ t: n.t, d: 1, m: n.m }, { t: n.t + 1, d: 1, m: tw });
        else if (n.d === 3 && Math.random() < 0.5) out.push({ t: n.t, d: 2, m: n.m }, { t: n.t + 2, d: 1, m: tw });
        else if (n.d === 3) out.push({ t: n.t, d: 1, m: n.m }, { t: n.t + 1, d: 1, m: scUp(n.m, sc) }, { t: n.t + 2, d: 1, m: n.m });
        else out.push({ t: n.t, d: 2, m: n.m }, { t: n.t + 2, d: 1, m: scUp(n.m, sc) }, { t: n.t + 3, d: 1, m: n.m });
        continue;
      }
      out.push(n);
    }
    return out;
  }

  // 1つの部品（例: A を1回）を、編曲 sp に従ってイベント列にする
  function genSection(def, P, sp, off, E, pass) {
    const dyn = sp.dyn || 1, V = sp.V || 0;
    const half = P.len / 2, notes = P.notes, bar = def.bar, nb = Math.round(P.len / bar);
    const leadOct = sp.L ? INST[sp.L].oct : null;
    E.push({ t: off, k: 'drone', v: sp.N != null ? sp.N : def.N != null ? def.N : 0.5 });
    // 主旋律（装飾音つき）
    if (sp.L) {
      const mel = V > 0 && def.fast ? vary(notes, def, V) : notes;
      let prev = null;
      for (const n of mel) {
        const inst = sp.L2 && n.t >= half ? sp.L2 : sp.L;
        const I = INST[inst];
        const e = nt(off + n.t, n.d, inst, 'L', n.m + I.oct, accent(def, n.t) * dyn, ornFor(def, I, n, V), def);
        if (prev && Math.abs(prev.t + prev.d - n.t) < 1e-6 && Math.random() < 0.55) e.leg = 1;
        E.push(e);
        prev = n;
      }
    }
    // 重ね（ユニゾン/オクターブ。装飾は別々に付くのでヘテロフォニーになる）
    if (sp.D) {
      const [inst, o] = sp.D.split(':');
      const I = INST[inst], oc = o != null ? +o : I.oct;
      for (const n of notes) E.push(nt(off + n.t, n.d, inst, 'D', n.m + oc, accent(def, n.t) * dyn, Math.random() < 0.3 ? ornFor(def, I, n, 0) : null, def));
    }
    // ハーモニー（3度下を和音の音で。速い曲は拍ごとの骨組みだけ）
    if (sp.H) {
      const I = INST[sp.H];
      let last = null;
      const push = (t, d, m, v) => {
        if (last && last.m === m && Math.abs(last.t + last.d - t) < 1e-6) { last.d += d; return; }
        last = nt(t, d, sp.H, 'H', m, v, null, def);
        E.push(last);
      };
      if (def.fast) {
        for (let b = 0; b < P.len - 1e-6; b += def.beat) {
          const n = noteAt(notes, b);
          if (!n) { last = null; continue; }
          push(off + b, def.beat, harmPitch(n.m, chordAt(P, b), def.sc) + I.oct, 0.85 * dyn);
        }
      } else for (const n of notes) push(off + n.t, n.d, harmPitch(n.m, chordAt(P, n.t), def.sc) + I.oct, accent(def, n.t) * 0.9 * dyn);
    }
    // 対旋律（和音の音をなめらかにつなぐ、主旋律とぶつからない長い音）
    if (sp.C) {
      const I = INST[sp.C], [lo, hi] = I.range || [55, 76];
      let prev = Math.round((lo + hi) / 2);
      for (const s of mergeSegs(P, bar)) {
        const n = noteAt(notes, s.t);
        const lm = n && leadOct != null ? n.m + leadOct : null;
        let best = null, bs = 1e9;
        for (let p = lo; p <= hi; p++) {
          if (!s.c.pcs.includes(p % 12)) continue;
          let sc = Math.abs(p - prev) + (p === prev ? 1.5 : 0);
          if (lm != null) {
            const iv = Math.abs(lm - p) % 12;
            if (iv === 0) sc += 3;
            if (iv === 1 || iv === 2 || iv === 10 || iv === 11) sc += 6;
            if (p > lm) sc += 4;
          }
          if (sc < bs) { bs = sc; best = p; }
        }
        if (best == null) continue;
        E.push(nt(off + s.t, s.d, sp.C, 'C', best, 0.8 * dyn, null, def));
        prev = best;
      }
    }
    if (sp.A) accomp(def, P, sp.A, 'A', off, E, dyn, pass);
    if (sp.A2) accomp(def, P, sp.A2, 'A2', off, E, dyn, pass);
    if (sp.B) bassLine(def, P, sp.B, off, E, dyn);
    if (sp.P) for (const s of mergeSegs(P)) E.push({ t: off + s.t, d: s.d, k: 'pad', i: 'pad', r: 'P', ms: closeVoice(s.c, 62), v: sp.P * dyn });
    if (sp.R && DRUMS[sp.R]) {
      for (let b = 0; b < nb; b++) {
        const last = sp.F && b === nb - 1;
        for (const [pos, kind, vel, ghost] of DRUMS[sp.R]) {
          if (last && pos >= bar / 2) continue;
          if (ghost && Math.random() < 0.4) continue;
          E.push({ t: off + b * bar + pos, k: 'hit', i: 'dr', r: 'R', kind, v: vel * dyn });
        }
        if (last) { // 小節の後半をだんだん強くたたき込むフィル
          const st = Math.ceil(bar / 2), step = def.fast ? 0.5 : 1, n = Math.round((bar - st) / step);
          for (let k = 0; k < n; k++) E.push({ t: off + b * bar + st + k * step, k: 'hit', i: 'dr', r: 'R', kind: k === n - 1 ? 'open' : k % 2 ? 'mid' : 'top', v: (0.4 + (0.55 * k) / Math.max(1, n - 1)) * dyn });
        }
      }
    }
    if (sp.K) for (let u = 0; u < P.len; u++) { const on = u % def.beat === 0; E.push({ t: off + u, k: 'hit', i: 'sh', r: 'K', kind: on ? 'shk2' : 'shk', v: (on ? 0.9 : 0.55) * dyn }); }
    if (sp.G) sparkle(def, P, sp.G, off, E, dyn);
  }

  function accomp(def, P, spec, role, off, E, dyn, pass) {
    const [inst, pat] = spec.split(':');
    const bar = def.bar, nb = Math.round(P.len / bar), key = bar + '/' + def.beat;
    const push = (t, d, m, v, dt) => E.push({ t: off + t, d, k: 'n', i: inst, r: role, m, v: v * dyn, dt });
    if (pat === 'arp' || pat === 'arp2') {
      const step = pat === 'arp2' ? 2 : 1;
      const seqs = pat === 'arp2' ? [[0, 2, 3, 2], [0, 3, 2, 4], [0, 1, 3, 2]] : def.beat === 3 ? [[0, 1, 2, 3, 2, 1, 0, 2, 4], [0, 2, 3, 4, 3, 2, 0, 3, 5]] : [[0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1]];
      const seq = seqs[(pass + Math.floor(Math.random() * 2)) % seqs.length];
      for (const s of P.ch) {
        const v = arpVoice(s.c, inst === 'hp' ? 43 : 45);
        let k = 0;
        for (let u = 0; u < s.d - 1e-6; u += step, k++) push(s.t + u, s.d - u + (k === 0 ? 3 : 1.5), v[seq[k % seq.length]], k === 0 ? 1 : 0.68);
      }
    } else if (pat === 'block') { // ゆっくり鳴らす分散和音（ジャラーン）
      for (const s of mergeSegs(P)) {
        const v = arpVoice(s.c, 43);
        [v[0], v[1], v[3], v[5]].forEach((m, j) => push(s.t, s.d + 2, m, 1 - j * 0.12, j * 0.04));
      }
    } else if (pat === 'strum') { // かき鳴らし（ダウンは低い弦から、アップは高い弦から）
      const pt = STRUM[key] || STRUM['8/2'];
      for (let b = 0; b < nb; b++) {
        for (let j = 0; j < pt.length; j++) {
          const [pos, dir, vel] = pt[j];
          const nx = j + 1 < pt.length ? pt[j + 1][0] : bar + pt[0][0];
          const t = b * bar + pos;
          let v = strumVoice(chordAt(P, t), inst);
          if (dir < 0) v = v.slice(1).reverse();
          v.forEach((m, q) => push(t, nx - pos + 0.2, m, vel * (dir < 0 ? 0.75 : 1) * (1 - q * 0.05), q * 0.011));
        }
      }
    } else if (pat === 'oom') { // ブン・チャッ
      const o = OOM[key] || OOM['8/2'];
      const pz = inst === 'pz';
      for (let b = 0; b < nb; b++) {
        o.b.forEach((pos, j) => {
          const t = b * bar + pos, c = chordAt(P, t);
          let m = inRange(c.root, 40);
          if (j % 2 === 1) m = m + 7 > 52 ? m - 5 : m + 7;
          push(t, pz ? 1.2 : 1.6, m, j === 0 ? 1 : 0.85);
        });
        o.c.forEach((pos) => {
          const t = b * bar + pos;
          closeVoice(chordAt(P, t), 60).forEach((m, q) => push(t, pz ? 0.7 : 1.1, m, 0.55, q * 0.006));
        });
      }
    }
  }

  function bassLine(def, P, spec, off, E, dyn) {
    const [inst, pat] = spec.split(':');
    const segs = pat === 'pedal' ? mergeSegs(P) : P.ch;
    const push = (t, d, m, v) => E.push({ t: off + t, d, k: 'n', i: inst, r: 'B', m, v: v * dyn });
    segs.forEach((s, i) => {
      const nx = segs[i + 1] || segs[0];
      const r = inRange(s.c.root, 38);
      const fifth = r + 7 <= 50 ? r + 7 : r - 5;
      if (pat === 'pedal') { push(s.t, s.d, r, 0.9); return; }
      const nbeats = Math.round(s.d / def.beat);
      if (nbeats >= 2) {
        if (pat === 'walk' && nbeats === 4) {
          const nr = inRange(nx.c.root, 38);
          const ap = nr > r ? scDn(nr, def.sc) : scUp(nr, def.sc);
          [[0, r], [2, fifth], [4, r + 12 <= 55 ? r + 12 : r], [6, ap]].forEach(([u, m], j) => push(s.t + u, 2, m, j === 0 ? 1 : 0.8));
        } else if (def.bar === 6 && def.beat === 2) { push(s.t, 4, r, 1); push(s.t + 4, 2, fifth, 0.7); }
        else { const hb = def.beat * Math.floor(nbeats / 2); push(s.t, hb, r, 1); push(s.t + hb, s.d - hb, fifth, 0.82); }
      } else push(s.t, s.d, r, 1);
    });
  }

  // 鉄琴：'sp' = 4小節ごとの終わりにきらめく分散和音、'dr' = 洞窟のしずくのようにぽつり
  function sparkle(def, P, spec, off, E, dyn) {
    const [inst, mode] = spec.split(':');
    const bar = def.bar, nb = Math.round(P.len / bar), base = inst === 'gl' ? 84 : 76;
    if (mode === 'dr') {
      for (let b = 0; b < nb; b++) {
        if (Math.random() > 0.55) continue;
        const u = Math.floor(Math.random() * bar), c = chordAt(P, b * bar + u);
        const pc = c.pcs[Math.floor(Math.random() * c.pcs.length)];
        E.push({ t: off + b * bar + u, d: 6, k: 'n', i: inst, r: 'G', m: inRange(pc, base + Math.floor(Math.random() * 8)), v: 0.6 * dyn });
      }
      return;
    }
    for (let b = 3; b < nb; b += 4) {
      const st = bar - 4, c = chordAt(P, b * bar + st);
      const tones = [];
      for (let p = base; tones.length < 4 && p < base + 30; p++) if (c.pcs.includes(p % 12)) tones.push(p);
      tones.forEach((m, k) => E.push({ t: off + b * bar + st + k, d: 4, k: 'n', i: inst, r: 'G', m, v: (0.55 + k * 0.12) * dyn }));
    }
  }

  // 1周分（pass）をイベント列にする。毎回作り直すので、装飾・変奏・伴奏の形が毎回少し違う
  function compile(def, pass, night) {
    const form = def.passes[pass % def.passes.length];
    const E = [];
    let off = 0;
    for (const [pn, sp0] of form) {
      const P = def.P[pn];
      let sp = sp0 || {};
      if (night && def.nightSoft) sp = Object.assign({}, sp, { R: 0, K: 0, F: 0, dyn: (sp.dyn || 1) * 0.85 });
      genSection(def, P, sp, off, E, pass);
      off += P.len;
    }
    E.sort((a, b) => a.t - b.t);
    return { ev: E, len: off };
  }

  // ---------------------------------------------------------------- 曲（すべてこのゲームのために作曲）
  // 「灯りの酒場」6/8 ジグ（ニ長調）
  const JIG_A = 'd2e f2d | e2c A2G | F2A d2f | e2d c2A | d2e f2g | a2f g2e | f2d e2c | d3 d2A';
  const JIG_A2 = 'd2e f2d | e2c A2G | F2A d2f | e2d c2A | d2e f2g | a2f g2e | fdf ecA | d3 d2e';
  const JIG_B = 'fga b2a | g2e =c2e | fga b2a | ge=c d3 | fga b2a | g2b a2f | g2e f2d | ecA d3';
  const JIG_B2 = 'fga b2a | g2e =c2e | fga b2a | ge=c d2e | fga bag | g2b a2f | gbg fed | ecA d3';
  const JIG_CH_A = ['D', 'D', 'A', 'A', 'D', 'D', 'A', 'A', 'D', 'D', 'D', 'G', 'D', 'A', 'D', 'D'];
  const JIG_CH_B = ['D', 'G', 'C', 'C', 'D', 'G', 'C', 'D', 'D', 'G', 'G', 'D', 'G', 'D', 'A', 'D'];
  // 「草原を行け」4/4 リール（ホ・ドリア）
  const REEL_A = 'E2BE dEBE | G2AB dBAG | F2AF DFAF | d2cd BAFA | E2BE dEBE | G2AB d2ef | gfed BAFA | B2E2 E4';
  const REEL_B = 'e2Be geBe | f2df afdf | e2Be gefg | afdf e4 | e2Be geBe | f2af gfed | BdAF DEFA | B2E2 E4';
  const REEL_CH_A = ['Em', 'Em', 'G', 'G', 'D', 'D', 'D', 'Bm', 'Em', 'Em', 'G', 'D', 'Em', 'D', 'Em', 'Em'];
  const REEL_CH_B = ['Em', 'Em', 'D', 'D', 'Em', 'Em', 'D', 'Em', 'Em', 'Em', 'D', 'G', 'G', 'D', 'Em', 'Em'];
  // 「市場の朝」ポルカ（ト長調、2/4 を2小節ずつ）
  const POLKA_A = 'd2 B2 G2 B2 | dcBA G2 D2 | E2 F2 G2 A2 | B2 A2 G2 E2 | d2 B2 G2 B2 | dcBA G2 B2 | A2 F2 D2 F2 | G4 G2 z2';
  const POLKA_B = 'g2 fe d2 B2 | c2 e2 A2 c2 | B2 dB G2 B2 | A2 cA F2 A2 | g2 fe d2 B2 | c2 e2 A2 c2 | B2 G2 A2 F2 | G4 G2 z2';
  // 「星降る窓辺」3/4 スロー・エア（ト長調）
  const AIR_A = 'D2 G2 A2 | B3 A G2 | E2 D2 E2 | G4 A2 | B2 d2 B2 | A3 G E2 | D2 E2 G2 | G6';
  const AIR_B = 'd2 e2 d2 | B3 A G2 | A2 B2 d2 | e4 d2 | g3 f e2 | d3 B A2 | B2 A2 F2 | G6';
  // 「ささやきの森のジグ」6/8（ホ短調）
  const FJIG_A = 'E2B BAB | E2B BAG | F2A ABA | F2A AGF | E2B BAB | E2B B2c | d2B AGF | GEE E3';
  const FJIG_B = 'e2f g2e | f2d d2B | e2f gfe | d2B A2F | e2f g2e | f2d dcB | AGF GFE | FEE E3';
  // 「こだまの底で」3/4（ニ短調）
  const CAVE_A = 'D2 F2 A2 | G3 F E2 | F2 E2 D2 | ^C4 A,2 | D2 F2 A2 | d3 c A2 | B2 A2 G2 | A6';
  const CAVE_B = 'd2 c2 A2 | B3 A G2 | A2 G2 F2 | E4 ^C2 | D2 F2 A2 | G2 B2 d2 | ^c2 A2 E2 | D6';
  // 「灰の城の行進」4/4（ロ短調）
  const MARCH_A = 'B,2 D2 F3 E | D2 C2 B,4 | F2 B2 A3 G | F2 E2 D4 | B,2 D2 F3 E | D2 F2 B3 c | d2 c2 B2 A2 | B4 B,4';
  const MARCH_B = 'd3 c B2 F2 | G2 F2 E4 | c3 B A2 E2 | F2 E2 D4 | d3 c B2 F2 | G2 B2 e4 | d2 c2 B2 A2 | B8';
  // 「竜の背を越えて」4/4 リール（イ・ドリア）
  const PEAK_A = 'A2eA fAeA | G2dG BGdG | A2eA fAea | gedB A4 | A2eA fAeA | G2dG BGdG | cBcd eage | dBGB A4';
  const PEAK_B = 'a2ea fa e2 | g2dg bg d2 | a2ea faea | gedB A4 | e2ae f2ef | g2fg a2ga | bagf gfed | edBG A4';
  // 「潮騒のホーンパイプ」4/4（ニ長調）
  const HARBOR_A = 'A3G F3G | A2d2 d3c | B3A G3F | E2A2 A3G | F3G A3B | c2e2 e3d | c3B A3G | F2D2 D4';
  const HARBOR_B = 'd3e f3e | d2f2 a3f | g3f e3d | c2e2 e3c | d3e f3g | a2f2 d3B | A3F G3E | D2F2 D4';
  // 「天空の回廊」3/4（ハ長調）
  const SKY_A = 'E2 G2 c2 | e4 d2 | c2 B2 A2 | G6 | F2 A2 c2 | f4 e2 | d2 c2 B2 | c6';
  const SKY_B = 'g2 e2 c2 | d4 G2 | A2 B2 c2 | d6 | e2 f2 g2 | a4 g2 | f2 e2 d2 | c6';
  // 「深淵の螺旋」6/8（ホ短調）
  const ABYSS_A = 'E3 B3 | A2G F2E | D3 A3 | G2F E3 | E3 B3 | c2B A2G | F2G A2F | E6';
  const ABYSS_B = 'e3 d3 | B2c d2B | A3 G3 | F2G A3 | e3 g3 | f2e d2B | c2B A2F | E6';
  // 「紅蓮の竜王」4/4（ニ短調）
  const BOSS_A = 'd2 Ad fdAd | c2 Gc ecGc | B2 FB dBFB | A2 ^CE A4 | d2 Ad fdAd | c2 Gc ecGc | B2 dB A2 ^c2 | d4 D4';
  const BOSS_B = 'f2 ef gfed | e2 de fedc | d2 cd edcB | ^c2 A2 E2 A2 | f2 ef gfed | e2 de fedc | dcBA B2 ^c2 | d8';
  // 「ギルドの灯」3/4 メインテーマ（ニ長調）— タイトル画面
  const THEME_A = 'D2 F2 A2 | d4 cd | B2 A2 G2 | A4 F2 | G2 B2 d2 | g4 fe | f2 d2 B2 | A6';
  const THEME_A2 = 'D2 F2 A2 | d4 cd | B2 A2 G2 | A4 F2 | G2 B2 d2 | g4 fe | f2 d2 c2 | d6';
  const THEME_B = 'B2 c2 d2 | e4 dc | d2 e2 f2 | g4 fe | a4 gf | g2 e2 =c2 | d2 B2 G2 | A6';
  // 「麦穂のスリップジグ」9/8（ト長調）— 昼のギルド・3曲目
  const SLIP_A = 'G2B d2B c2A | B2G A2F D3 | G2B d2g e2d | c2e d2B A3 | G2B d2B c2A | B2d g2e d2B | c2A B2G A2F | A2F G3 G3';
  const SLIP_A2 = 'G2B d2B c2A | B2G A2F D3 | G2B d2g e2d | c2e d2B A3 | G2B d2B c2A | B2d g2e d2B | c2A B2G A2F | A2F G3 G2d';
  const SLIP_B = 'd2g g2f g2a | b2g a2f d3 | e2g f2a g2e | d2B c2A B2d | d2g g2f g2a | b2a g2f e2d | c2A B2G A2F | A2F G3 G3';
  const SLIP_B2 = 'd2g g2f g2a | b2g a2f d3 | e2g f2a g2e | d2B c2A B2d | d2g g2f g2a | b2a g2f e2d | c2A B2G A2F | A2F G3 G2D';
  // 「月影の子守歌」4/4 スロー・エア（ホ短調）— 夜のギルド・2曲目
  const LULL_A = 'E2 G2 B3 A | G2 F2 D4 | E2 G2 B2 d2 | e6 d2 | B2 d2 e3 d | B2 A2 G4 | A2 B2 G2 F2 | E8';
  const LULL_B = 'e3 f g2 e2 | d3 B A2 G2 | A2 B2 c2 e2 | d6 B2 | e3 f g2 b2 | a3 g f2 d2 | e2 B2 d2 F2 | E8';
  // 「かぼちゃ灯籠の行進」4/4 スウィング（イ短調）— 10月のイベント
  const PUMP_A = 'A,2 C2 E2 ^D E | A2 E2 C2 A,2 | D2 F2 A2 ^G A | B2 ^G2 E4 | A,2 C2 E2 ^D E | F2 A2 c2 B A | F2 D2 B,2 ^G,2 | A,2 ^G, A, z4';
  const PUMP_B = 'e2 c2 G2 c2 | d2 B2 G2 B2 | c2 A2 E2 A2 | B2 ^G2 E2 ^G2 | A2 c2 f3 e | d2 A2 F2 D2 | E2 ^G2 B2 d2 | c2 B2 A2 z2';

  // 編曲の記号 — L:主旋律 L2:後半の主旋律 D:重ね('楽器:移調') H:ハーモニー C:対旋律 A/A2:伴奏('楽器:型')
  //   B:ベース('楽器:型') P:パッド R:太鼓 K:シェイカー G:鉄琴('gl:sp'|'ce:sp'|'gl:dr') N:ドローン F:最後の小節にフィル V:変奏 dyn:強さ
  //   楽器: wh ホイッスル / fl フルート / pp パイプ / fd フィドル / vc チェロ / ac アコーディオン / hp ハープ /
  //         gt ギター / bz ブズーキ / pz ピチカート / bs ベース / gl グロッケン / ce チェレスタ
  const TRACKS = {
    theme: {
      title: '♪ ギルドの灯 — メインテーマ', key: 'D', meter: '3/4', bpm: 84, drone: [38, 50], N: 0.4, lvl: 1,
      parts: { I: 'z6 | z6 | z6 | z4 A,2', A: THEME_A, A2: THEME_A2, B: THEME_B, T: 'z6 | z6' },
      chords: { I: 'D | G | Bm | A', A: 'D | Bm | G | D | G | Em | Bm | A', A2: 'D | Bm | G | D | G | Em | D D A | D', B: 'G | A | Bm | Em | D | C | G | A', T: 'D | D' },
      passes: [
        [
          ['I', { L: 'fl', A: 'hp:arp2', P: 0.8, N: 0.5 }],
          ['A', { L: 'fl', A: 'hp:arp2', P: 1, N: 0.5 }],
          ['A2', { L: 'wh', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.8 }],
          ['B', { L: 'fd', H: 'wh', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', P: 0.6, R: 'waltz', G: 'gl:sp', dyn: 0.95 }],
          ['A', { L: 'wh', D: 'fd:0', H: 'ac', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', R: 'waltz', K: 1, P: 0.5 }],
          ['A2', { L: 'wh', D: 'fd:0', H: 'ac', C: 'vc', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', R: 'waltz', K: 1, G: 'ce:sp', P: 0.5 }],
          ['T', { A: 'hp:block', P: 1, N: 0.6 }],
        ],
        [
          ['A', { L: 'fd', A: 'hp:arp2', P: 1, N: 0.5 }],
          ['A2', { L: 'fl', H: 'fd', A: 'hp:arp', B: 'bs:pedal', P: 0.8 }],
          ['B', { L: 'wh', H: 'fd', C: 'vc', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', R: 'waltz', G: 'ce:sp', P: 0.5 }],
          ['A2', { L: 'wh', D: 'fd:0', H: 'ac', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', R: 'waltz', K: 1, P: 0.5 }],
          ['T', { A: 'hp:block', P: 1, N: 0.6 }],
        ],
      ],
    },
    guild: {
      title: '♪ 灯りの酒場 — ギルド楽団', home: true, rotate: 2, key: 'D', meter: '6/8', bpm: 92, swing: 0.07, fast: true, drone: [38, 45], N: 0.45,
      parts: { I: 'z6 | z3 z2A', A: JIG_A, A2: JIG_A2, B: JIG_B, B2: JIG_B2 },
      chords: { I: 'D | G A', A: JIG_CH_A, A2: JIG_CH_A, B: JIG_CH_B, B2: JIG_CH_B },
      passes: [
        [
          ['I', { L: 'wh', A: 'hp:arp', N: 0.5 }],
          ['A', { L: 'wh', A: 'hp:arp', B: 'bs:root', V: 0.2 }],
          ['A2', { L: 'wh', D: 'fd:0', A: 'hp:arp', A2: 'bz:strum', B: 'bs:root', R: 'jig', V: 0.4 }],
          ['B', { L: 'fd', H: 'wh', A: 'bz:strum', B: 'bs:root', R: 'jig', K: 1 }],
          ['B2', { L: 'wh', D: 'fd:0', H: 'ac', A: 'bz:strum', A2: 'hp:arp', B: 'bs:root', R: 'jig', K: 1, F: 1, V: 0.5 }],
        ],
        [
          ['A', { L: 'ac', A: 'gt:strum', B: 'bs:root', R: 'jig', dyn: 0.9 }],
          ['A2', { L: 'ac', D: 'wh', A: 'gt:strum', A2: 'hp:arp', B: 'bs:root', R: 'jig', K: 1, V: 0.4 }],
          ['B', { L: 'wh', L2: 'fd', A: 'hp:arp', B: 'bs:root', P: 0.4, dyn: 0.9 }],
          ['B2', { L: 'fd', D: 'wh', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:root', R: 'jig', K: 1, G: 'gl:sp', F: 1, V: 0.5 }],
        ],
      ],
    },
    guild2: {
      title: '♪ 市場の朝 — ギルド楽団', home: true, rotate: 2, key: 'G', meter: '4/4', bpm: 118, swing: 0.04, fast: true, drone: [43, 50], N: 0.3,
      parts: { I: 'z8 | z6 D2', A: POLKA_A, B: POLKA_B },
      chords: {
        I: 'G | D',
        A: ['G', 'G', 'D', 'G', 'C', 'D', 'G', 'Em', 'G', 'G', 'D', 'G', 'D', 'D', 'G', 'G'],
        B: ['G', 'G', 'C', 'Am', 'G', 'G', 'D', 'D', 'G', 'G', 'C', 'Am', 'G', 'D', 'G', 'G'],
      },
      passes: [
        [
          ['I', { L: 'wh', A: 'ac:oom' }],
          ['A', { L: 'wh', A: 'ac:oom', R: 'polka', V: 0.2, dyn: 0.9 }],
          ['A', { L: 'wh', H: 'fd', A: 'ac:oom', R: 'polka', K: 1, V: 0.3 }],
          ['B', { L: 'fd', A: 'gt:oom', R: 'polka', G: 'gl:sp' }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', A: 'gt:oom', R: 'polka', K: 1, F: 1, V: 0.4 }],
        ],
        [
          ['A', { L: 'ac', A: 'gt:oom', R: 'polka', dyn: 0.9 }],
          ['A', { L: 'ac', D: 'fd:0', A: 'gt:oom', A2: 'hp:arp', R: 'polka', K: 1, V: 0.3 }],
          ['B', { L: 'wh', A: 'hp:arp', B: 'bs:root', dyn: 0.85 }],
          ['B', { L: 'fd', D: 'wh', H: 'ac', A: 'gt:oom', R: 'polka', K: 1, F: 1, G: 'gl:sp' }],
        ],
      ],
    },
    guild3: {
      title: '♪ 麦穂のスリップジグ — ギルド楽団', home: true, rotate: 2, key: 'G', meter: '9/8', bpm: 112, swing: 0.07, fast: true, drone: [43, 50], N: 0.45,
      parts: { I: 'z9 | z6 z2D', A: SLIP_A, A2: SLIP_A2, B: SLIP_B, B2: SLIP_B2 },
      chords: {
        I: 'G | D',
        A: 'G | G D D | G G C | C G D | G | G Em G | C G D | D G G',
        A2: 'G | G D D | G G C | C G D | G | G Em G | C G D | D G G',
        B: 'G | G D D | C D Em | G D G | G | G Em C | C G D | D G G',
        B2: 'G | G D D | C D Em | G D G | G | G Em C | C G D | D G G',
      },
      passes: [
        [
          ['I', { L: 'fl', A: 'hp:arp' }],
          ['A', { L: 'fl', A: 'hp:arp', B: 'bs:root', V: 0.2 }],
          ['A2', { L: 'fl', H: 'fd', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', R: 'slip' }],
          ['B', { L: 'wh', A: 'gt:strum', B: 'bs:root', R: 'slip', K: 1, V: 0.3 }],
          ['B2', { L: 'wh', D: 'fl:0', H: 'fd', A: 'gt:strum', A2: 'hp:arp', B: 'bs:root', R: 'slip', K: 1, G: 'gl:sp', F: 1 }],
        ],
        [
          ['A', { L: 'fd', A: 'hp:arp', P: 0.5, dyn: 0.85 }],
          ['A2', { L: 'fd', D: 'wh', A: 'gt:strum', B: 'bs:root', R: 'slip', V: 0.4 }],
          ['B', { L: 'ac', H: 'fl', A: 'hp:arp', B: 'bs:root', R: 'slip' }],
          ['B2', { L: 'fd', D: 'wh', H: 'ac', C: 'vc', A: 'gt:strum', B: 'bs:root', R: 'slip', K: 1, F: 1, V: 0.5 }],
        ],
      ],
    },
    night: {
      title: '♪ 星降る窓辺 — ギルド楽団', home: true, rotate: 1, key: 'G', meter: '3/4', bpm: 64, drone: [43, 50], N: 0.35,
      parts: { I: 'z6 | z6', A: AIR_A, B: AIR_B, T: 'z6 | z6' },
      chords: { I: 'G | C', A: ['G', 'G', 'Em', 'C', 'G', 'Am', 'D', 'G'], B: ['G', 'Em', 'D', 'C', 'Em', 'G', 'D', 'G'], T: 'G | G' },
      passes: [
        [
          ['I', { A: 'hp:arp2', P: 0.9 }],
          ['A', { L: 'fl', A: 'hp:arp2', P: 1 }],
          ['B', { L: 'fl', C: 'vc', A: 'hp:arp2', P: 1 }],
          ['A', { L: 'fd', H: 'fl', A: 'hp:arp2', B: 'bs:pedal', P: 0.8 }],
          ['B', { L: 'fl', H: 'fd', A: 'hp:arp2', B: 'bs:pedal', G: 'ce:sp', P: 0.8 }],
          ['T', { A: 'hp:block', P: 1 }],
        ],
      ],
    },
    night2: {
      title: '♪ 月影の子守歌 — ギルド楽団', home: true, rotate: 1, key: 'G', meter: '4/4', bpm: 62, drone: [40, 52], N: 0.35,
      parts: { I: 'z8 | z8', A: LULL_A, B: LULL_B, T: 'z8 | z8' },
      chords: {
        I: 'Em | C',
        A: 'Em | D | Em G | C | G Em | Em D G G | D G G D | Em',
        B: 'C | G D | Am C | G | C Em | D | Em D | Em',
        T: 'Em | Em',
      },
      passes: [
        [
          ['I', { A: 'hp:block', P: 1 }],
          ['A', { L: 'fl', A: 'hp:arp2', P: 1 }],
          ['B', { L: 'fl', C: 'vc', A: 'hp:arp2', P: 1 }],
          ['A', { L: 'fd', H: 'fl', A: 'hp:arp2', B: 'bs:pedal', P: 0.8 }],
          ['B', { L: 'fl', H: 'fd', A: 'hp:arp2', B: 'bs:pedal', G: 'ce:sp', P: 0.9 }],
          ['T', { A: 'hp:block', P: 1 }],
        ],
      ],
    },
    halloween: {
      title: '♪ かぼちゃ灯籠の行進 — ギルド楽団', home: true, rotate: 1, nightSoft: true, key: 'Am', meter: '4/4', bpm: 112, swing: 0.16, fast: true, drone: [45, 52], N: 0.3,
      parts: { I: 'z8 | z8', A: PUMP_A, B: PUMP_B },
      chords: { I: 'Am | E7', A: 'Am | Am | Dm | E | Am | F | E7 | Am', B: 'C | G | Am | E | F | Dm | E7 | Am' },
      passes: [
        [
          ['I', { A: 'pz:oom', G: 'gl:sp' }],
          ['A', { L: 'gl', A: 'pz:oom', R: 'creep', dyn: 0.75 }],
          ['A', { L: 'wh', D: 'gl', A: 'pz:oom', R: 'creep', K: 1 }],
          ['B', { L: 'ac', A: 'pz:oom', R: 'creep', K: 1 }],
          ['B', { L: 'fd', D: 'gl', H: 'ac', A: 'pz:oom', R: 'creep', K: 1, F: 1 }],
        ],
        [
          ['A', { L: 'fd', A: 'pz:oom', R: 'creep', dyn: 0.85 }],
          ['A', { L: 'ac', D: 'gl', H: 'fd', A: 'pz:oom', R: 'creep', K: 1 }],
          ['B', { L: 'wh', A: 'pz:oom', A2: 'hp:arp', R: 'creep' }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', A: 'pz:oom', G: 'gl:sp', R: 'creep', K: 1, F: 1 }],
        ],
      ],
    },
    reels: {
      title: '♪ 草原を行け — ギルド楽団', key: 'D', meter: '4/4', bpm: 104, swing: 0.06, fast: true, drone: [40, 47], N: 0.4,
      parts: { I: 'z8 | z8', A: REEL_A, B: REEL_B },
      chords: { I: 'Em | D', A: REEL_CH_A, B: REEL_CH_B },
      passes: [
        [
          ['I', { A: 'bz:strum', R: 'reel', dyn: 0.75 }],
          ['A', { L: 'wh', A: 'bz:strum', B: 'bs:root', R: 'reel' }],
          ['A', { L: 'wh', D: 'fd:0', A: 'bz:strum', A2: 'hp:arp', B: 'bs:root', R: 'reel', V: 0.4 }],
          ['B', { L: 'fd', H: 'wh', A: 'bz:strum', B: 'bs:walk', R: 'reel', K: 1 }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', A: 'bz:strum', B: 'bs:walk', R: 'reel', K: 1, F: 1, V: 0.5 }],
        ],
        [
          ['A', { L: 'fd', A: 'gt:strum', B: 'bs:root', dyn: 0.85 }],
          ['A', { L: 'fd', D: 'wh', A: 'gt:strum', B: 'bs:root', R: 'reel', V: 0.4 }],
          ['B', { L: 'ac', H: 'fd', A: 'hp:arp', B: 'bs:root', R: 'reel', K: 1 }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:walk', R: 'reel', K: 1, F: 1, G: 'gl:sp' }],
        ],
      ],
    },
    forest: {
      title: '♪ ささやきの森のジグ — ギルド楽団', key: 'G', meter: '6/8', bpm: 100, swing: 0.07, fast: true, drone: [40, 47], N: 0.5,
      parts: { I: 'z6 | z6', A: FJIG_A, B: FJIG_B },
      chords: {
        I: 'Em | D',
        A: ['Em', 'Em', 'Em', 'G', 'D', 'D', 'D', 'D', 'Em', 'Em', 'Em', 'C', 'D', 'D', 'Em', 'Em'],
        B: ['Em', 'C', 'D', 'Bm', 'Em', 'Em', 'G', 'D', 'Em', 'C', 'D', 'G', 'D', 'Em', 'B', 'Em'],
      },
      passes: [
        [
          ['I', { A: 'hp:arp', G: 'ce:sp', N: 0.6 }],
          ['A', { L: 'fl', A: 'hp:arp', B: 'bs:root', P: 0.4, G: 'ce:sp' }],
          ['A', { L: 'wh', A: 'hp:arp', A2: 'bz:strum', B: 'bs:root', R: 'jig', V: 0.3 }],
          ['B', { L: 'fd', H: 'fl', A: 'bz:strum', B: 'bs:root', R: 'jig', K: 1 }],
          ['B', { L: 'wh', D: 'fd:0', A: 'bz:strum', A2: 'hp:arp', B: 'bs:root', R: 'jig', K: 1, G: 'gl:sp', F: 1, V: 0.4 }],
        ],
        [
          ['A', { L: 'fd', A: 'hp:arp', P: 0.5, dyn: 0.85 }],
          ['A', { L: 'fd', D: 'wh', A: 'gt:strum', B: 'bs:root', R: 'jig', V: 0.4 }],
          ['B', { L: 'wh', H: 'fd', A: 'gt:strum', B: 'bs:root', R: 'jig', K: 1 }],
          ['B', { L: 'fl', D: 'fd:0', C: 'vc', A: 'bz:strum', A2: 'hp:arp', B: 'bs:root', R: 'jig', K: 1, F: 1, G: 'ce:sp' }],
        ],
      ],
    },
    cave: {
      title: '♪ こだまの底で — ギルド楽団', key: 'Dm', meter: '3/4', bpm: 75, drone: [38, 45], N: 0.9, droneLP: 700,
      parts: { I: 'z6 | z6', A: CAVE_A, B: CAVE_B },
      chords: { I: 'Dm | A', A: ['Dm', 'Gm', 'Dm', 'A', 'Dm', 'Dm', 'Gm', 'A'], B: ['Dm', 'Gm', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm'] },
      passes: [
        [
          ['I', { P: 1, N: 1, G: 'gl:dr' }],
          ['A', { L: 'fd', A: 'hp:arp2', P: 0.9, R: 'heart', G: 'gl:dr' }],
          ['A', { L: 'fl', C: 'vc', A: 'hp:arp2', P: 0.8, R: 'heart' }],
          ['B', { L: 'fd', H: 'fl', A: 'hp:arp', B: 'bs:pedal', P: 0.8, R: 'heart', G: 'gl:dr' }],
          ['B', { L: 'fd', D: 'fl:0', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.7, R: 'heart' }],
        ],
        [
          ['A', { L: 'fl', A: 'hp:arp2', P: 1, G: 'gl:dr', N: 1 }],
          ['A', { L: 'fd', C: 'vc', A: 'hp:arp2', B: 'bs:pedal', P: 0.8, R: 'heart' }],
          ['B', { L: 'pp', A: 'hp:arp2', P: 0.9, R: 'heart', G: 'gl:dr' }],
          ['B', { L: 'fd', H: 'fl', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.7, R: 'heart' }],
        ],
      ],
    },
    castle: {
      title: '♪ 灰の城の行進 — ギルド楽団', key: 'D', meter: '4/4', bpm: 100, drone: [35, 47, 54], N: 0.8, droneLvl: 1.1,
      parts: { I: 'z8 | z8', A: MARCH_A, B: MARCH_B },
      chords: {
        I: 'Bm | F#',
        A: ['Bm', 'Bm', 'F#', 'Bm', 'Bm', 'A', 'D', 'D', 'Bm', 'Bm', 'Bm', 'F#', 'G', 'A', 'Bm', 'Bm'],
        B: ['Bm', 'Bm', 'G', 'Em', 'A', 'A', 'D', 'D', 'Bm', 'Bm', 'G', 'Em', 'G', 'A', 'Bm', 'Bm'],
      },
      passes: [
        [
          ['I', { R: 'march', N: 1, dyn: 0.85 }],
          ['A', { L: 'pp', B: 'bs:root', R: 'march', N: 1 }],
          ['A', { L: 'pp', D: 'fd:0', C: 'vc', A: 'hp:arp', B: 'bs:root', R: 'march' }],
          ['B', { L: 'fd', H: 'ac', C: 'vc', B: 'bs:root', R: 'march', P: 0.4 }],
          ['B', { L: 'pp', D: 'fd:0', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:walk', R: 'march', F: 1 }],
        ],
        [
          ['A', { L: 'fd', A: 'hp:arp', B: 'bs:root', R: 'march', dyn: 0.8 }],
          ['A', { L: 'wh', D: 'fd:0', A: 'bz:strum', B: 'bs:root', R: 'march' }],
          ['B', { L: 'pp', C: 'vc', B: 'bs:root', R: 'march', N: 1 }],
          ['B', { L: 'pp', D: 'fd:0', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:walk', R: 'march', F: 1 }],
        ],
      ],
    },
    peak: {
      title: '♪ 竜の背を越えて — ギルド楽団', key: 'G', meter: '4/4', bpm: 116, swing: 0.06, fast: true, drone: [45, 52], N: 0.4,
      parts: { I: 'z8 | z8', A: PEAK_A, B: PEAK_B },
      chords: {
        I: 'Am | G',
        A: ['Am', 'D', 'G', 'G', 'Am', 'D', 'G', 'Am', 'Am', 'D', 'G', 'G', 'C', 'Am', 'G', 'Am'],
        B: ['Am', 'D', 'G', 'G', 'Am', 'D', 'G', 'Am', 'Am', 'D', 'G', 'Am', 'Em', 'G', 'G', 'Am'],
      },
      passes: [
        [
          ['I', { A: 'bz:strum', R: 'reel', dyn: 0.8 }],
          ['A', { L: 'wh', A: 'bz:strum', B: 'bs:root', R: 'reel' }],
          ['A', { L: 'wh', D: 'fd:0', A: 'bz:strum', B: 'bs:walk', R: 'reel', V: 0.4 }],
          ['B', { L: 'fd', H: 'wh', A: 'bz:strum', A2: 'hp:arp', B: 'bs:root', R: 'reel', K: 1 }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', A: 'bz:strum', B: 'bs:walk', R: 'reel', K: 1, F: 1, G: 'gl:sp' }],
        ],
        [
          ['A', { L: 'ac', A: 'gt:strum', B: 'bs:root', R: 'reel', dyn: 0.9 }],
          ['A', { L: 'fd', D: 'ac:0', A: 'gt:strum', B: 'bs:root', R: 'reel', K: 1, V: 0.3 }],
          ['B', { L: 'fl', H: 'fd', A: 'hp:arp', B: 'bs:root', P: 0.5 }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:walk', R: 'reel', K: 1, F: 1 }],
        ],
      ],
    },
    harbor: {
      title: '♪ 潮騒のホーンパイプ — ギルド楽団', key: 'D', meter: '4/4', bpm: 92, swing: 0.28, fast: true, drone: [38, 45], N: 0.35,
      parts: { I: 'z8 | z8', A: HARBOR_A, B: HARBOR_B },
      chords: {
        I: 'D | A',
        A: ['D', 'D', 'D', 'A', 'G', 'D', 'A', 'A', 'D', 'G', 'A', 'A', 'A', 'Em', 'D', 'D'],
        B: ['D', 'D', 'D', 'D', 'G', 'D', 'A', 'A', 'D', 'G', 'D', 'Bm', 'D', 'A', 'D', 'D'],
      },
      passes: [
        [
          ['I', { A: 'ac:oom', R: 'hp', dyn: 0.8 }],
          ['A', { L: 'ac', A: 'gt:oom', R: 'hp' }],
          ['A', { L: 'ac', D: 'wh', A: 'gt:strum', B: 'bs:root', R: 'hp', K: 1, V: 0.3 }],
          ['B', { L: 'wh', H: 'ac', A: 'gt:strum', B: 'bs:root', R: 'hp' }],
          ['B', { L: 'fd', D: 'wh', H: 'ac', A: 'gt:strum', B: 'bs:walk', R: 'hp', K: 1, F: 1, G: 'gl:sp' }],
        ],
        [
          ['A', { L: 'wh', A: 'hp:arp', B: 'bs:root', dyn: 0.9 }],
          ['A', { L: 'fd', D: 'ac:0', A: 'gt:strum', B: 'bs:root', R: 'hp', V: 0.3 }],
          ['B', { L: 'ac', A: 'gt:oom', R: 'hp', K: 1 }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', C: 'vc', A: 'gt:strum', B: 'bs:walk', R: 'hp', K: 1, F: 1 }],
        ],
      ],
    },
    sky: {
      title: '♪ 天空の回廊 — ギルド楽団', key: 'C', meter: '3/4', bpm: 78, drone: [36, 43], N: 0.3,
      parts: { I: 'z6 | z6', A: SKY_A, B: SKY_B },
      chords: { I: 'C | G', A: ['C', 'C', 'Am', 'G', 'F', 'F', 'G', 'C'], B: ['C', 'G', 'F', 'G', 'C', 'F', 'G', 'C'] },
      passes: [
        [
          ['I', { A: 'hp:arp', P: 1, G: 'ce:sp' }],
          ['A', { L: 'fl', A: 'hp:arp', P: 1, G: 'ce:sp' }],
          ['A', { L: 'wh', C: 'fd', A: 'hp:arp', B: 'bs:pedal', P: 0.8, R: 'waltz', dyn: 0.9 }],
          ['B', { L: 'fd', H: 'wh', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', P: 0.7, R: 'waltz', G: 'gl:sp' }],
          ['B', { L: 'wh', D: 'fd:0', C: 'vc', A: 'hp:arp', B: 'bs:root', P: 0.7, R: 'waltz', K: 1, G: 'ce:sp' }],
        ],
        [
          ['A', { L: 'ce', A: 'hp:arp2', P: 1 }],
          ['A', { L: 'fl', D: 'gl:12', A: 'hp:arp', B: 'bs:pedal', P: 0.8 }],
          ['B', { L: 'wh', H: 'fl', C: 'vc', A: 'hp:arp', A2: 'gt:strum', B: 'bs:root', P: 0.7, R: 'waltz', K: 1 }],
          ['B', { L: 'fd', D: 'wh', H: 'ac', A: 'hp:arp', B: 'bs:root', P: 0.7, R: 'waltz', G: 'gl:sp' }],
        ],
      ],
    },
    abyss: {
      title: '♪ 深淵の螺旋 — ギルド楽団', key: 'G', meter: '6/8', bpm: 66, swing: 0.05, drone: [40, 47], N: 1, droneLP: 650, droneLvl: 1.15,
      parts: { I: 'z6 | z6', A: ABYSS_A, B: ABYSS_B },
      chords: {
        I: 'Em | B',
        A: ['Em', 'Em', 'Am', 'B', 'D', 'D', 'G', 'Em', 'Em', 'Em', 'C', 'Am', 'D', 'B', 'Em', 'Em'],
        B: ['Em', 'D', 'G', 'G', 'Am', 'G', 'D', 'D', 'Em', 'Em', 'D', 'G', 'Am', 'B', 'Em', 'Em'],
      },
      passes: [
        [
          ['I', { P: 1, G: 'gl:dr' }],
          ['A', { L: 'fd', A: 'hp:arp2', P: 1, R: 'heart' }],
          ['A', { L: 'fl', C: 'vc', A: 'hp:arp', P: 0.9, R: 'heart', G: 'gl:dr' }],
          ['B', { L: 'fd', H: 'fl', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.8, R: 'heart' }],
          ['B', { L: 'pp', D: 'fd:0', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.8, R: 'heart', G: 'gl:dr' }],
        ],
        [
          ['A', { L: 'pp', A: 'hp:arp2', P: 1, G: 'gl:dr' }],
          ['A', { L: 'fd', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.9, R: 'heart' }],
          ['B', { L: 'fl', H: 'fd', A: 'hp:arp2', P: 1, R: 'heart', G: 'gl:dr' }],
          ['B', { L: 'fd', D: 'fl:0', C: 'vc', A: 'hp:arp', B: 'bs:pedal', P: 0.8, R: 'heart' }],
        ],
      ],
    },
    boss: {
      title: '♪ 紅蓮の竜王 — ギルド楽団', key: 'Dm', meter: '4/4', bpm: 120, swing: 0.03, fast: true, drone: [38, 45, 50], N: 0.9,
      parts: { I: 'z8 | z8', A: BOSS_A, B: BOSS_B },
      chords: {
        I: 'Dm | A',
        A: ['Dm', 'Dm', 'C', 'C', 'Bb', 'Bb', 'A', 'A', 'Dm', 'Dm', 'C', 'C', 'Bb', 'A', 'Dm', 'Dm'],
        B: ['Dm', 'Gm', 'C', 'F', 'Bb', 'Gm', 'A', 'A', 'Dm', 'Gm', 'C', 'F', 'Gm', 'A', 'Dm', 'Dm'],
      },
      passes: [
        [
          ['I', { A: 'bz:strum', R: 'boss', N: 1 }],
          ['A', { L: 'fd', D: 'vc', A: 'bz:strum', B: 'bs:root', R: 'boss' }],
          ['A', { L: 'fd', D: 'vc', H: 'ac', A: 'bz:strum', B: 'bs:walk', R: 'boss', K: 1, V: 0.3 }],
          ['B', { L: 'pp', D: 'fd:0', C: 'vc', A: 'bz:strum', B: 'bs:root', R: 'boss' }],
          ['B', { L: 'fd', D: 'pp', H: 'ac', C: 'vc', A: 'bz:strum', A2: 'hp:arp', B: 'bs:walk', R: 'boss', K: 1, F: 1 }],
        ],
        [
          ['A', { L: 'wh', D: 'fd:0', A: 'bz:strum', B: 'bs:root', R: 'boss' }],
          ['A', { L: 'pp', D: 'fd:0', H: 'ac', A: 'bz:strum', B: 'bs:walk', R: 'boss', K: 1 }],
          ['B', { L: 'fd', D: 'vc', C: 'ac', A: 'hp:arp', B: 'bs:root', R: 'boss' }],
          ['B', { L: 'wh', D: 'fd:0', H: 'ac', C: 'vc', A: 'bz:strum', B: 'bs:walk', R: 'boss', K: 1, F: 1 }],
        ],
      ],
    },
  };
  // 拍子・音階・部品の解析（読み込み時に1回だけ）
  Object.values(TRACKS).forEach((d) => {
    const [num, den] = d.meter.split('/').map(Number);
    d.bar = den === 8 ? num : num * 2; // 1小節の8分音符の数
    d.beat = den === 8 ? 3 : 2; // 1拍の8分音符の数（bpm はこの拍で数える）
    d.sc = scaleOf(d.key);
    const s = d.swing || 0;
    d.swPts = d.beat === 3 ? [0, 1 + s, 2 + s * 0.5, 3] : [0, 1 + s, 2];
    d.P = {};
    for (const k in d.parts) {
      const p = parseABC(d.parts[k], d.key);
      p.ch = parseChords(d.chords[k], p.len, d.bar);
      d.P[k] = p;
    }
  });
  A.trackTitle = (name) => (TRACKS[name] ? TRACKS[name].title : '');
  A.tracks = () => Object.keys(TRACKS);

  // ---------------------------------------------------------------- 再生
  const DRONE_LVL = 0.05;
  class Track {
    constructor(name, at, o) {
      o = o || {};
      this.name = name;
      this.def = TRACKS[name];
      this.offline = !!o.offline;
      this.night = o.night != null ? !!o.night : A.night;
      this.solo = o.solo || null;
      this.lvl = this.def.lvl || 1;
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.out.connect(musicIn);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0;
      this.wet.connect(musicWetIn);
      this.strips = {};
      this.nodes = [];
      this.pass = o.pass || 0;
      this.spu = 60 / (this.def.bpm * (this.night && this.def.nightSoft ? 0.92 : 1)) / this.def.beat; // 8分音符1つの秒数
      this.cur = compile(this.def, this.pass, this.night);
      this.idx = 0;
      this.t0 = at && at > ctx.currentTime ? at : ctx.currentTime + 0.12; // この周の頭の時刻
      this.alive = true;
      this.startDrone();
    }
    // 8分音符の位置 → 時刻（スウィング/ジグの跳ねを入れる）
    time(u) {
      const d = this.def;
      if (!d.swing) return this.t0 + u * this.spu;
      const b = d.beat, k = Math.floor(u / b), x = u - k * b, i = Math.min(b - 1, Math.floor(x)), p = d.swPts;
      return this.t0 + (k * b + p[i] + (p[i + 1] - p[i]) * (x - i)) * this.spu;
    }
    // 楽器ごとのチャンネル（EQ → 定位 → 乾いた音 / 残響センド）
    strip(role, inst) {
      const key = role + ':' + inst;
      if (this.strips[key]) return this.strips[key];
      const I = INST[inst] || INST.pad;
      const pan = inst === 'padL' ? -0.55 : inst === 'padR' ? 0.55 : ROLE_PAN[role] != null ? ROLE_PAN[role] : I.pan || 0;
      const inp = ctx.createGain();
      this.nodes.push(inp);
      let node = inp;
      for (const [type, f, q, g] of I.eq || []) {
        const b = ctx.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        if (q != null) b.Q.value = q;
        if (g != null) b.gain.value = g;
        node.connect(b);
        node = b;
        this.nodes.push(b);
      }
      const p = mkPan(pan);
      node.connect(p);
      p.connect(this.out);
      this.nodes.push(p);
      if (I.rev > 0) {
        const sg = ctx.createGain();
        sg.gain.value = I.rev;
        p.connect(sg);
        sg.connect(this.wet);
        this.nodes.push(sg);
      }
      return (this.strips[key] = inp);
    }
    // イーリアンパイプのドローン（ずっと鳴っていて、部品ごとに強さが変わる）
    startDrone() {
      const ds = this.def.drone;
      if (!ds || !ds.length || (this.solo && !this.solo.includes('N'))) return;
      const st = this.strip('N', 'drone');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = this.def.droneLP || 950;
      lp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = 0;
      const l = ctx.createOscillator();
      l.frequency.value = 0.09 + Math.random() * 0.04;
      const lg = ctx.createGain();
      lg.gain.value = 160;
      l.connect(lg).connect(lp.frequency);
      lp.connect(g).connect(st);
      const t = Math.max(ctx.currentTime, this.t0 - 0.1);
      this.droneOsc = [l];
      ds.forEach((m, i) => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(pwave('drone'));
        o.frequency.value = mtof(m);
        o.detune.value = i % 2 ? 3 : -3;
        o.connect(lp);
        o.start(t);
        this.droneOsc.push(o);
      });
      l.start(t);
      this.droneG = g;
      this.nodes.push(lp, g, lg);
    }
    fadeIn(sec) { this.ramp(this.lvl, sec); }
    fadeOut(sec) {
      this.ramp(0, sec);
      this.fading = true;
      setTimeout(() => this.dispose(), sec * 1000 + 600);
    }
    ramp(v, sec) {
      const t = ctx.currentTime;
      for (const g of [this.out.gain, this.wet.gain]) {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(v, t + sec);
      }
    }
    dispose() {
      if (!this.alive) return;
      this.alive = false;
      for (const o of this.droneOsc || []) { try { o.stop(); o.disconnect(); } catch (e) { /* already */ } }
      for (const n of this.nodes.concat([this.out, this.wet])) { try { n.disconnect(); } catch (e) { /* noop */ } }
    }
    // タブ復帰・処理落ちのあと：遅れた音を一斉に鳴らさず、次の小節頭から再開
    resync() {
      if (!this.alive || this.idx >= this.cur.ev.length) return;
      const now = ctx.currentTime;
      if (this.time(this.cur.ev[this.idx].t) >= now - 0.05) return;
      const bar = this.def.bar;
      let nb = Math.ceil((now - this.t0) / this.spu / bar) * bar;
      if (nb >= this.cur.len) {
        this.pass++;
        this.cur = compile(this.def, this.pass, this.night);
        nb = 0;
      }
      this.idx = this.cur.ev.findIndex((e) => e.t >= nb - 1e-6);
      if (this.idx < 0) this.idx = this.cur.ev.length;
      this.t0 = now + 0.1 - nb * this.spu;
    }
    schedule(until) {
      if (this.ended || !this.alive) return;
      const now = ctx.currentTime;
      if (!this.offline && this.idx < this.cur.ev.length && this.time(this.cur.ev[this.idx].t) < now - 0.25) this.resync();
      let guard = 0;
      while (guard++ < 600) {
        if (this.idx >= this.cur.ev.length) {
          const endT = this.time(this.cur.len);
          if (endT > until) break;
          // ギルドの曲は何周かしたら次の曲へ（曲の切れ目で、きれいに入れ替える）
          if (!this.offline && this.def.home && current === this && !this.fading && this.pass + 1 >= (this.def.rotate || 2)) {
            const nx = nextHome(this.name);
            if (nx && nx !== this.name) {
              A.playTrack(nx, { cut: true, fade: 2.6, fadeIn: 0.25, at: endT });
              return;
            }
          }
          this.t0 = endT;
          this.pass++;
          this.cur = compile(this.def, this.pass, this.night);
          this.idx = 0;
          continue;
        }
        const ev = this.cur.ev[this.idx];
        const t = this.time(ev.t);
        if (t > until) break;
        this.idx++;
        if (t < now - 0.03 && !this.offline) continue;
        this.play(ev, t);
      }
    }
    play(ev, t) {
      if (ev.k === 'drone') {
        if (this.droneG) this.droneG.gain.setTargetAtTime(ev.v * DRONE_LVL * (this.def.droneLvl || 1), Math.max(t, ctx.currentTime), 1.4);
        return;
      }
      if (this.solo && !this.solo.includes(ev.r)) return;
      const I = INST[ev.i];
      const tt = Math.max(ctx.currentTime, t + (ev.dt || 0) + (I.hum ? (Math.random() - 0.5) * I.hum : 0));
      const dur = ev.d != null ? Math.max(0.03, this.time(ev.t + ev.d) - t) : 0;
      const vel = ev.v * (I.vol || 0.1) * (ROLE_VOL[ev.r] || 1) * (0.9 + Math.random() * 0.2);
      if (!(vel > 0)) return;
      const prio = ROLE_PRIO[ev.r] || 1;
      if (ev.k === 'pad') {
        if (voiceOK(tt, tt + dur + 1.6, I.w, prio)) padChord(tt, ev.ms, dur, vel, this.strip('P', 'padL'), this.strip('P', 'padR'));
      } else if (ev.k === 'hit') {
        if (voiceOK(tt, tt + 0.35, I.w, prio)) drumHit(tt, ev.kind, vel, this.strip(ev.r, ev.i));
      } else if (voiceOK(tt, tt + dur + 0.3, I.w, prio)) I.play(tt, ev.m, dur, vel, this.strip(ev.r, ev.i), ev, I);
    }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    try {
      const until = ctx.currentTime + (document.hidden ? 1.2 : 0.3);
      if (current && current.alive) current.schedule(until);
      if (A._old && A._old !== current && A._old.alive) A._old.schedule(until);
    } catch (e) { report(e); }
    // 暖炉のパチパチ
    if (ambientLevel > 0 && Math.random() < 0.09 * ambientLevel) crackle();
  }

  // opt: true=起動直後 / 数値=切り替えの秒数 / {fade, fadeIn, at, cut}
  A.playTrack = function (name, opt) {
    if (!TRACKS[name]) name = 'guild';
    const o = typeof opt === 'object' && opt ? opt : { first: opt === true, fade: typeof opt === 'number' ? opt : 0 };
    wantTrack = name;
    if (!ctx) return;
    try {
      if (current && current.name === name && !current.fading) return;
      if (current) {
        if (A._old) A._old.dispose();
        A._old = current;
        if (o.cut) current.ended = true;
        current.fadeOut(o.first ? 0.1 : o.fade || 1.1);
      }
      current = new Track(name, o.at);
      current.fadeIn(o.first ? 2.4 : o.fadeIn || (o.fade ? Math.max(0.45, o.fade * 0.9) : 1.4));
    } catch (e) { report(e); }
  };
  A.play = (name, opt) => A.playTrack(name, opt);
  A.track = () => (current ? current.name : wantTrack);
  // タイトル画面のメインテーマ（init 前に呼んでもよい。init すると流れ出す）。ギルドに入ったら playHome()
  A.playTitle = (fade) => A.playTrack('theme', fade || 1.2);

  // ギルドの曲の巡回：昼は 灯りの酒場 → 市場の朝 → 麦穂のスリップジグ、夜は 星降る窓辺 → 月影の子守歌。
  // 期間限定イベント中（10月）は「かぼちゃ灯籠の行進」が昼にも夜にも混ざる
  const ROT = { day: ['guild', 'guild2', 'guild3'], night: ['night', 'night2'] };
  const homeIdx = { day: 0, night: 0 };
  let evOverride; // undefined=日付から自動 / null=なし / 曲名=その曲
  A.eventTrack = function () {
    if (evOverride !== undefined) return evOverride;
    try { return G.events && G.events.theme && G.events.theme() === 'pumpkin' ? 'halloween' : null; } catch (e) { return null; }
  };
  A.isEvent = () => !!A.eventTrack();
  A.setEvent = function (name) { evOverride = name === undefined ? undefined : TRACKS[name] ? name : null; };
  function homeList(night) {
    const l = ROT[night ? 'night' : 'day'].slice();
    const ev = A.eventTrack();
    if (ev && TRACKS[ev]) l.splice(1, 0, ev);
    return l;
  }
  function homeName(night) {
    const l = homeList(night);
    return l[homeIdx[night ? 'night' : 'day'] % l.length];
  }
  function nextHome(name) {
    const k = A.night ? 'night' : 'day', l = homeList(A.night);
    const i = l.indexOf(name);
    homeIdx[k] = (i < 0 ? homeIdx[k] : i) + 1;
    return l[homeIdx[k] % l.length];
  }
  A.playHome = function (fade) { A.playTrack(homeName(A.night), fade || 1.1); };
  // 夜になったら夜の曲へ、朝になったら昼の曲へ（ギルドにいるときだけ）
  A.setNight = function (n) {
    if (A.night === n) return;
    A.night = n;
    if (!ctx) { if (TRACKS[wantTrack] && TRACKS[wantTrack].home) wantTrack = homeName(n); return; }
    if (current && TRACKS[current.name].home && wantTrack === current.name) A.playHome(2.6);
  };

  // ---------------------------------------------------------------- テスト用
  // 曲をオフラインで書き出して、音量を測る（opt: {sr, night, pass, solo:['L','A'..], keep}）
  A._render = function (name, sec, opt) {
    opt = opt || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !TRACKS[name]) return Promise.resolve(null);
    const sr = opt.sr || 44100;
    const off = new OAC(2, Math.ceil(sr * sec), sr);
    const saved = [ctx, musicIn, musicWetIn, VS];
    let tr = null;
    try {
      ctx = off;
      if (!noiseBuf) noiseBuf = makeNoise(2, false);
      VS = { ends: [], w: [] };
      musicIn = off.createGain();
      musicIn.connect(off.destination);
      musicWetIn = off.createGain();
      const conv = off.createConvolver();
      conv.buffer = makeIR(2.6);
      const ret = off.createGain();
      ret.gain.value = opt.dry ? 0 : 0.32;
      musicWetIn.connect(conv).connect(ret).connect(off.destination);
      tr = new Track(name, 0.05, { offline: true, night: opt.night, pass: opt.pass, solo: opt.solo });
      tr.out.gain.value = tr.lvl;
      tr.wet.gain.value = tr.lvl;
      for (let g = 0; g < 20000; g++) {
        const before = tr.pass * 1e6 + tr.idx;
        tr.schedule(sec);
        if (tr.pass * 1e6 + tr.idx === before) break;
      }
    } finally {
      [ctx, musicIn, musicWetIn, VS] = saved;
    }
    const passes = tr ? tr.pass : 0;
    return off.startRendering().then((buf) => {
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let pk = 0, ss = 0;
      const win = sr * 3, wins = [];
      let ws = 0;
      for (let i = 0; i < L.length; i++) {
        const a = Math.abs(L[i]), b = Math.abs(R[i]);
        if (a > pk) pk = a;
        if (b > pk) pk = b;
        const e = L[i] * L[i] + R[i] * R[i];
        ss += e;
        ws += e;
        if ((i + 1) % win === 0) { wins.push(Math.sqrt(ws / (2 * win))); ws = 0; }
      }
      const db = (x) => +(20 * Math.log10(x + 1e-9)).toFixed(1);
      const rms = Math.sqrt(ss / (2 * L.length));
      return { name, peak: db(pk), rms: db(rms), loud: db(Math.max(...wins.slice(1))), quiet: db(Math.min(...wins.slice(1))), passes, buf: opt.keep ? buf : null };
    });
  };
  // 楽譜の検算（小節の長さ・和音・編曲の楽器名）
  A._check = function () {
    const errs = [];
    for (const [name, d] of Object.entries(TRACKS)) {
      for (const k in d.parts) {
        const P = d.P[k];
        if (Math.abs(P.len % d.bar) > 1e-6) errs.push(`${name}.${k}: len ${P.len} not multiple of ${d.bar}`);
        d.parts[k].split('|').forEach((chunk, bi) => { const l = parseABC(chunk, d.key).len; if (Math.abs(l - d.bar) > 1e-6) errs.push(`${name}.${k} bar${bi + 1}: ${l}/${d.bar}`); });
        const cl = P.ch.reduce((a, s) => a + s.d, 0);
        if (Math.abs(cl - P.len) > 1e-6) errs.push(`${name}.${k}: chords ${cl}/${P.len}`);
        P.ch.forEach((s) => { if (!s.c) errs.push(`${name}.${k}: bad chord`); });
      }
      d.passes.forEach((ps, i) => ps.forEach(([pn, sp]) => {
        if (!d.P[pn]) errs.push(`${name}#${i}: no part ${pn}`);
        for (const r of ['L', 'L2', 'H', 'C']) if (sp[r] && !INST[sp[r]]) errs.push(`${name}#${i} ${pn}: bad ${r}=${sp[r]}`);
        for (const r of ['D', 'A', 'A2', 'B', 'G']) if (sp[r] && !INST[sp[r].split(':')[0]]) errs.push(`${name}#${i} ${pn}: bad ${r}=${sp[r]}`);
        if (sp.R && !DRUMS[sp.R]) errs.push(`${name}#${i} ${pn}: bad R=${sp.R}`);
      }));
    }
    return errs;
  };
  // 今の曲の位置を周の frac（0〜1）へ飛ばす（巡回のテスト用）
  A._seek = function (frac) {
    if (!ctx || !current) return;
    const tr = current, u = Math.floor((tr.cur.len * frac) / tr.def.bar) * tr.def.bar;
    tr.idx = tr.cur.ev.findIndex((e) => e.t >= u);
    if (tr.idx < 0) tr.idx = tr.cur.ev.length;
    tr.t0 = ctx.currentTime + 0.1 - u * tr.spu;
  };
  A._state = () => ({ track: current ? current.name : null, pass: current ? current.pass : -1, old: A._old && A._old.alive ? A._old.name : null, voices: VS.ends.length, cache: BUF.size, ctx: ctx ? ctx.state : 'none', home: { day: homeList(false), night: homeList(true) } });
  A._passLen = (name) => { const d = TRACKS[name]; return d.passes.map((ps) => ps.reduce((a, [pn]) => a + d.P[pn].len, 0) * (60 / d.bpm / d.beat)); };

  // ---------------------------------------------------------------- ambient
  A.setAmbient = function (level) {
    ambientLevel = level;
    if (!ctx) return;
    if (!murmur && level > 0) {
      const src = ctx.createBufferSource();
      src.buffer = brownBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const l1 = ctx.createOscillator();
      l1.frequency.value = 0.31;
      const l1g = ctx.createGain();
      l1g.gain.value = 0.22;
      const l2 = ctx.createOscillator();
      l2.frequency.value = 0.173;
      const l2g = ctx.createGain();
      l2g.gain.value = 0.18;
      l1.connect(l1g).connect(g.gain);
      l2.connect(l2g).connect(g.gain);
      src.connect(bp).connect(g).connect(ambGain);
      src.start();
      l1.start();
      l2.start();
      murmur = src;
    }
    const s = G.state ? G.state.settings.sfx : 0.8;
    ambGain.gain.setTargetAtTime(level * 0.09 * s, ctx.currentTime, 0.8);
  };

  function crackle() {
    const t = ctx.currentTime + Math.random() * 0.02;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800 + Math.random() * 2500;
    const g = ctx.createGain();
    const v = 0.012 * (0.4 + Math.random());
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015 + Math.random() * 0.02);
    n.connect(hp).connect(g).connect(ambGain);
    n.start(t, Math.random() * 1.5, 0.05);
  }

  // ---------------------------------------------------------------- 環境音（街とギルド）
  // 海・風・雨はずっと流れる「床」。鳥・カモメ・虫・フクロウ・鐘は、時間帯と天気に合わせてときどき鳴る。
  // ギルドの画面にいる間だけ。音量は設定の「環境音」に従う。
  const E = { on: false, bus: null, beds: null, next: {}, waveAt: 0, gustAt: 0, lastPhase: -1, level: 0, voices: 0 };
  function panNode(v) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = G.clamp(v, -1, 1); return p; }
    return ctx.createGain();
  }
  function envBuses() {
    if (E.bus) return E.bus;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    // 近い音：そのまま＋ほんの少し残響
    const near = ctx.createGain();
    near.connect(out);
    const ns = ctx.createGain();
    ns.gain.value = 0.12;
    near.connect(ns).connect(convolver);
    // 遠い音：高い音が丸く、残響が多め
    const far = ctx.createGain();
    const flp = ctx.createBiquadFilter();
    flp.type = 'lowpass';
    flp.frequency.value = 3200;
    far.connect(flp).connect(out);
    const fs = ctx.createGain();
    fs.gain.value = 0.55;
    flp.connect(fs).connect(convolver);
    E.bus = { out, near, far };
    return E.bus;
  }
  function loopSrc(buf) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * (buf.duration - 0.1));
    return s;
  }
  // ずっと流れる床（風・雨・海の低いうねり）
  function envBeds() {
    if (E.beds) return E.beds;
    const b = envBuses();
    // 風：帯域ノイズ。周波数と強さがゆっくり揺れる
    const wSrc = loopSrc(noiseBuf);
    const wBP = ctx.createBiquadFilter();
    wBP.type = 'bandpass';
    wBP.frequency.value = 420;
    wBP.Q.value = 0.9;
    const wG = ctx.createGain();
    wG.gain.value = 0;
    const wPan = panNode(0);
    wSrc.connect(wBP).connect(wG).connect(wPan).connect(b.near);
    // 風の口笛（ひゅう…）
    const hSrc = loopSrc(noiseBuf);
    const hBP = ctx.createBiquadFilter();
    hBP.type = 'bandpass';
    hBP.frequency.value = 800;
    hBP.Q.value = 16;
    const hG = ctx.createGain();
    hG.gain.value = 0;
    hSrc.connect(hBP).connect(hG).connect(b.far);
    // 雨：明るいざー
    const rSrc = loopSrc(noiseBuf);
    const rHP = ctx.createBiquadFilter();
    rHP.type = 'highpass';
    rHP.frequency.value = 1100;
    const rLP = ctx.createBiquadFilter();
    rLP.type = 'lowpass';
    rLP.frequency.value = 6500;
    const rG = ctx.createGain();
    rG.gain.value = 0;
    rSrc.connect(rHP).connect(rLP).connect(rG).connect(b.near);
    // 海の低いうねり（波の合間もしんとしない）
    const sSrc = loopSrc(brownBuf);
    const sLP = ctx.createBiquadFilter();
    sLP.type = 'lowpass';
    sLP.frequency.value = 260;
    const sG = ctx.createGain();
    sG.gain.value = 0;
    sSrc.connect(sLP).connect(sG).connect(b.near);
    E.beds = { wBP, wG, wPan, hBP, hG, rG, rLP, sG };
    return E.beds;
  }

  // ---- 声と音
  // 波：寄せて、砕けて（しゅわー）、引く。左右どちらかの海から
  function wave(t, vol) {
    const b = envBuses();
    const dur = rr(5, 8);
    const p = panNode(G.pick([-1, 1]) * rr(0.35, 0.85));
    p.connect(b.near);
    const src = ctx.createBufferSource();
    src.buffer = brownBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(rr(800, 1400), t + dur * 0.4);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(vol * 0.4, t + dur * 0.62);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(p);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.1);
    const f = ctx.createBufferSource();
    f.buffer = noiseBuf;
    f.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(rr(2400, 3600), t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + dur);
    bp.Q.value = 0.7;
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0.0001, t);
    fg.gain.setValueAtTime(0.0001, t + dur * 0.36);
    fg.gain.exponentialRampToValueAtTime(vol * 0.16, t + dur * 0.48);
    fg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.96);
    f.connect(bp).connect(fg).connect(p);
    f.start(t, Math.random() * 1.5);
    f.stop(t + dur + 0.1);
  }
  function chirp(t, f0, f1, d, vol, dest, type) {
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, d * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + d + 0.02);
  }
  // スズメ：チュン、チュチュン
  function sparrow(t) {
    const b = envBuses();
    const p = panNode(rr(-0.85, 0.85));
    p.connect(Math.random() < 0.5 ? b.near : b.far);
    const n = 2 + Math.floor(Math.random() * 4);
    const base = rr(3800, 5000);
    const v = rr(0.018, 0.034);
    for (let i = 0; i < n; i++) {
      const f = base * rr(0.96, 1.08);
      chirp(t, f * 0.86, f * 1.08, 0.018, v * 0.7, p);
      chirp(t + 0.016, f * 1.08, f * rr(0.62, 0.72), rr(0.05, 0.08), v, p);
      t += rr(0.1, 0.2) + (Math.random() < 0.2 ? 0.25 : 0);
    }
    return n * 0.18;
  }
  // 歌う小鳥：笛のような節（朝によく歌う）
  function songbird(t) {
    const b = envBuses();
    const p = panNode(rr(-0.7, 0.7));
    p.connect(b.far);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const root = rr(2000, 2600);
    const v = rr(0.02, 0.032);
    const n = 4 + Math.floor(Math.random() * 6);
    let t0 = t;
    for (let i = 0; i < n; i++) {
      const f = root * Math.pow(2, G.pick(scale) / 12);
      if (Math.random() < 0.22) {
        // さえずりのトリル
        for (let k = 0; k < 6; k++) chirp(t0 + k * 0.034, f * (k % 2 ? 1.12 : 1), f * (k % 2 ? 1.0 : 1.1), 0.03, v * 0.75, p);
        t0 += 0.22;
      } else {
        const d = rr(0.07, 0.2);
        chirp(t0, f * rr(0.9, 1.04), f * rr(0.98, 1.18), d, v, p);
        t0 += d + rr(0.03, 0.09);
      }
    }
    return t0 - t;
  }
  // カモメ：ミャーオ、ミャー（海のほうから）
  function gull(t) {
    const b = envBuses();
    const p = panNode(G.pick([-1, 1]) * rr(0.5, 0.95));
    p.connect(b.far);
    const n = 2 + Math.floor(Math.random() * 3);
    let s = rr(0.92, 1.12);
    const v = rr(0.02, 0.034);
    for (let i = 0; i < n; i++) {
      const d = rr(0.22, 0.4);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(900 * s, t);
      o.frequency.linearRampToValueAtTime(1450 * s, t + d * 0.25);
      o.frequency.exponentialRampToValueAtTime(820 * s, t + d);
      const vib = ctx.createOscillator();
      vib.frequency.value = rr(24, 32);
      const vg = ctx.createGain();
      vg.gain.value = 22 * s;
      vib.connect(vg).connect(o.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700 * s;
      bp.Q.value = 2.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.035);
      g.gain.setValueAtTime(v, t + d * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(bp).connect(g).connect(p);
      o.start(t); vib.start(t);
      o.stop(t + d + 0.02); vib.stop(t + d + 0.02);
      t += d + rr(0.08, 0.22);
      s *= rr(0.94, 0.99);
    }
    return n * 0.45;
  }
  // カラス：カァ、カァ（夕方）
  function crow(t) {
    const b = envBuses();
    const p = panNode(rr(-0.8, 0.8));
    p.connect(b.far);
    const n = 2 + Math.floor(Math.random() * 2);
    const v = rr(0.026, 0.04);
    const f0 = rr(380, 470);
    for (let i = 0; i < n; i++) {
      const d = rr(0.32, 0.46);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * 1.08, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.86, t + d);
      // しゃがれ声：速いゆらぎ
      const am = ctx.createOscillator();
      am.frequency.value = rr(55, 75);
      const amg = ctx.createGain();
      amg.gain.value = 0.45;
      const g = ctx.createGain();
      g.gain.value = 0;
      am.connect(amg).connect(g.gain);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 1.6;
      const env2 = ctx.createGain();
      env2.gain.setValueAtTime(0.0001, t);
      env2.gain.linearRampToValueAtTime(v, t + 0.04);
      env2.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(bp).connect(g).connect(env2).connect(p);
      g.gain.setValueAtTime(0.55, t);
      o.start(t); am.start(t);
      o.stop(t + d + 0.02); am.stop(t + d + 0.02);
      t += d + rr(0.25, 0.45);
    }
    return n * 0.8;
  }
  // ひぐらし：カナカナカナ…（夕暮れ）
  function higurashi(t) {
    const b = envBuses();
    const p = panNode(rr(-0.8, 0.8));
    p.connect(b.far);
    const f = rr(4100, 4700);
    const n = 14 + Math.floor(Math.random() * 10);
    const v = rr(0.012, 0.02);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const trem = ctx.createOscillator();
    trem.frequency.value = rr(80, 110);
    const tg = ctx.createGain();
    tg.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    trem.connect(tg).connect(g.gain);
    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0, t);
    let tt = t;
    let gap = 0.12;
    o.frequency.setValueAtTime(f, t);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const amp = v * Math.min(1, (i + 1) / 3) * (1 - k * 0.75);
      o.frequency.setValueAtTime(f * (1 - k * 0.07) * (i % 2 ? 0.97 : 1), tt);
      env2.gain.setValueAtTime(0, tt);
      env2.gain.linearRampToValueAtTime(amp, tt + 0.02);
      env2.gain.linearRampToValueAtTime(amp * 0.5, tt + gap * 0.5);
      env2.gain.linearRampToValueAtTime(0, tt + gap * 0.9);
      tt += gap;
      gap *= 1.018;
    }
    o.connect(g).connect(env2).connect(p);
    o.start(t); trem.start(t);
    o.stop(tt + 0.1); trem.stop(tt + 0.1);
    return tt - t;
  }
  // コオロギ：コロコロ（3〜4発の短い音を、くり返し）
  function cricket(t) {
    const b = envBuses();
    const p = panNode(rr(-0.9, 0.9));
    p.connect(Math.random() < 0.6 ? b.near : b.far);
    const f = rr(4300, 5300);
    const v = rr(0.008, 0.016);
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const chirps = 4 + Math.floor(Math.random() * 7);
    const per = rr(0.42, 0.7);
    const pulses = 3 + Math.floor(Math.random() * 2);
    let tt = t;
    for (let c = 0; c < chirps; c++) {
      for (let k = 0; k < pulses; k++) {
        const s = tt + k * 0.032;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(v, s + 0.006);
        g.gain.linearRampToValueAtTime(0, s + 0.02);
      }
      tt += per;
    }
    o.connect(g).connect(p);
    o.start(t);
    o.stop(tt + 0.05);
    return tt - t;
  }
  // 鈴虫：リーン、リーン
  function suzumushi(t) {
    const b = envBuses();
    const p = panNode(rr(-0.85, 0.85));
    p.connect(b.near);
    const f = rr(3900, 4500);
    const v = rr(0.007, 0.013);
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const trem = ctx.createOscillator();
    trem.frequency.value = rr(40, 55);
    const tg = ctx.createGain();
    tg.gain.value = 0.5;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    trem.connect(tg).connect(am.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const n = 3 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = rr(0.45, 0.85);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(v, tt + 0.06);
      g.gain.setValueAtTime(v, tt + d * 0.7);
      g.gain.linearRampToValueAtTime(0, tt + d);
      tt += d + rr(0.25, 0.5);
    }
    o.connect(am).connect(g).connect(p);
    o.start(t); trem.start(t);
    o.stop(tt + 0.05); trem.stop(tt + 0.05);
    return tt - t;
  }
  // フクロウ：ホー… ホッホー
  function owl(t) {
    const b = envBuses();
    const p = panNode(rr(-0.6, 0.6));
    p.connect(b.far);
    const f = rr(330, 400);
    const v = rr(0.02, 0.03);
    const pat = Math.random() < 0.5 ? [[0, 0.42], [0.85, 0.18], [1.12, 0.18], [1.4, 0.55]] : [[0, 0.5], [0.9, 0.6]];
    pat.forEach(([o0, d]) => {
      const s = t + o0;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f * 1.03, s);
      o.frequency.exponentialRampToValueAtTime(f * 0.94, s + d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(v, s + 0.07);
      g.gain.setValueAtTime(v, s + d * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, s + d);
      const o2 = ctx.createOscillator();
      o2.frequency.value = f * 2.01;
      const g2 = ctx.createGain();
      g2.gain.value = 0.12;
      o2.connect(g2).connect(g);
      o.connect(g).connect(p);
      o.start(s); o2.start(s);
      o.stop(s + d + 0.02); o2.stop(s + d + 0.02);
    });
    return 2.2;
  }
  // 雨だれ：ぽつ、ぽつ
  function drip(t) {
    const b = envBuses();
    const p = panNode(rr(-0.9, 0.9));
    p.connect(b.near);
    const f = rr(1800, 3400);
    chirp(t, f, f * 0.55, rr(0.02, 0.04), rr(0.01, 0.022), p);
    return 0.05;
  }
  // 町の鐘：ゴーン（昼と夕方）
  function bell(t, n) {
    const b = envBuses();
    const p = panNode(rr(-0.3, 0.3));
    p.connect(b.far);
    const f = 220 * rr(0.98, 1.02);
    const parts = [[0.5, 0.5, 5], [1, 1, 4.2], [1.19, 0.45, 3], [1.5, 0.32, 2.6], [2, 0.28, 2], [2.52, 0.16, 1.5], [3.01, 0.1, 1.1], [4.07, 0.06, 0.8]];
    for (let i = 0; i < n; i++) {
      const s = t + i * 2.6;
      parts.forEach(([r, a, dec]) => {
        const o = ctx.createOscillator();
        o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, s);
        g.gain.linearRampToValueAtTime(0.018 * a, s + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, s + dec);
        o.connect(g).connect(p);
        o.start(s);
        o.stop(s + dec + 0.05);
      });
    }
    return n * 2.6 + 3;
  }

  // 時間帯の窓（p は 0〜1 の1日。夜明け 0.9〜0.12、昼 0.04〜0.56、夕方 0.55〜0.7、夜 0.68〜0.92）
  function win(p, a, b, fade = 0.03) {
    const d = (x) => ((x % 1) + 1) % 1;
    const len = d(b - a);
    const x = d(p - a);
    if (x > len) return 0;
    return Math.min(1, x / fade, (len - x) / fade);
  }
  // 各声の「1分あたりの回数」と、鳴ってよい時間帯
  const VOICES = {
    sparrow: { fn: sparrow, rate: 7, gap: 3, w: (p, wx) => (win(p, 0.92, 0.2) * 1.3 + win(p, 0.15, 0.56) * 0.55) * (1 - wx.rain * 0.9) },
    songbird: { fn: songbird, rate: 4, gap: 6, w: (p, wx) => (win(p, 0.9, 0.16) * 1.4 + win(p, 0.16, 0.5) * 0.25) * (1 - wx.rain) },
    gull: { fn: gull, rate: 2.6, gap: 9, w: (p, wx) => (win(p, 0.02, 0.62) * 1 + win(p, 0.94, 0.04) * 0.4) * (1 - wx.rain * 0.7) },
    crow: { fn: crow, rate: 2.4, gap: 8, w: (p, wx) => win(p, 0.54, 0.7, 0.04) * (1 - wx.rain * 0.8) },
    higurashi: { fn: higurashi, rate: 2.2, gap: 7, w: (p, wx) => win(p, 0.56, 0.69, 0.03) * (1 - wx.rain) * (wx.cloud ? 0.6 : 1) },
    cricket: { fn: cricket, rate: 9, gap: 1.2, w: (p, wx) => win(p, 0.66, 0.95, 0.04) * (1 - wx.rain * 0.85) },
    suzumushi: { fn: suzumushi, rate: 5, gap: 2.5, w: (p, wx) => win(p, 0.68, 0.92, 0.04) * (1 - wx.rain * 0.9) },
    owl: { fn: owl, rate: 0.9, gap: 18, w: (p, wx) => win(p, 0.72, 0.9, 0.03) * (1 - wx.rain * 0.6) },
    drip: { fn: drip, rate: 70, gap: 0.08, w: (p, wx) => Math.max(0, wx.rain - 0.25) * 1.3 },
  };
  E.busy = {};

  // 毎フレーム呼ぶ。active=ギルドの画面が見えているか
  A.envTick = function (dt, active) {
    if (!ctx || ctx.state !== 'running' || !G.state || !G.scene || !G.scene.dayPhase) return;
    const s = G.state.settings;
    const vol = s.env == null ? 0.7 : s.env;
    const want = active && vol > 0 && s.sfx > 0 ? Math.pow(vol, 1.2) * 4.2 * Math.min(1, 0.4 + s.sfx) * (A.muffled ? 0.55 : 1) : 0;
    if (!E.bus && want <= 0) return;
    const b = envBuses();
    const bd = envBeds();
    const now = ctx.currentTime;
    if (Math.abs(want - E.level) > 0.004) {
      E.level = want;
      b.out.gain.setTargetAtTime(want, now, want > 0 ? 0.9 : 0.35);
    }
    if (want <= 0) return;
    const p = G.scene.dayPhase();
    const wx = G.scene.weather();
    const night = G.scene.night();
    // 床の強さ（0.5秒ごとに少しずつ）
    E.bedT = (E.bedT || 0) - dt;
    if (E.bedT <= 0) {
      E.bedT = rr(0.9, 1.8);
      const windBase = 0.012 + night * 0.006 + (wx.cloud ? 0.008 : 0) + wx.rain * 0.012 + win(p, 0.55, 0.72) * 0.006;
      const gust = E.gustUntil > now ? 1 : 0;
      bd.wG.gain.setTargetAtTime(windBase * rr(0.55, 1.1) * (gust ? 2.4 : 1), now, gust ? 0.8 : 1.6);
      bd.wBP.frequency.setTargetAtTime(rr(280, 560) * (gust ? 1.7 : 1), now, 1.4);
      if (bd.wPan.pan) bd.wPan.pan.setTargetAtTime(rr(-0.5, 0.5), now, 2.5);
      bd.hG.gain.setTargetAtTime(gust && Math.random() < 0.6 ? windBase * 0.9 : 0.0001, now, 1.1);
      bd.hBP.frequency.setTargetAtTime(rr(620, 1150), now, 1.6);
      bd.rG.gain.setTargetAtTime(wx.rain * 0.05, now, 2);
      bd.rLP.frequency.setTargetAtTime(4500 + wx.rain * 3000, now, 2);
      bd.sG.gain.setTargetAtTime(0.03 + night * 0.012, now, 2);
    }
    // 突風
    if (now > (E.gustAt || 0)) {
      E.gustAt = now + rr(14, 40) / (1 + (wx.cloud ? 0.6 : 0) + wx.rain);
      E.gustUntil = now + rr(3, 6);
      E.bedT = 0;
    }
    // 波：数秒おきに寄せる（夜は少し大きく聞こえる）
    if (now > E.waveAt - 0.05) {
      const t = Math.max(now + 0.05, E.waveAt);
      wave(t, rr(0.09, 0.15) * (1 + night * 0.25) * (1 + wx.rain * 0.2));
      E.waveAt = t + rr(4.2, 7.5);
    }
    // 町の鐘：昼（正午）と夕暮れ
    if (E.lastPhase >= 0) {
      const cross = (x) => (E.lastPhase < x && p >= x) || (E.lastPhase > p && x <= p);
      if (cross(0.3)) bell(now + 0.3, 3);
      else if (cross(0.6)) bell(now + 0.3, 5);
    }
    E.lastPhase = p;
    // 生きものたち
    for (const k in VOICES) {
      const vc = VOICES[k];
      if ((E.busy[k] || 0) > now) continue;
      const w = vc.w(p, wx);
      if (w <= 0.001) continue;
      if (Math.random() < (vc.rate / 60) * w * dt) {
        const len = vc.fn(now + rr(0.02, 0.2)) || 1;
        E.busy[k] = now + vc.gap * rr(0.7, 1.4) + (k === 'cricket' || k === 'drip' ? 0 : len);
      }
    }
  };
  // テスト用：声をすぐ鳴らす
  A.envPlay = function (k) { if (!ctx) return; if (k === 'wave') wave(ctx.currentTime + 0.05, 0.07); else if (k === 'bell') bell(ctx.currentTime + 0.05, 2); else VOICES[k].fn(ctx.currentTime + 0.05); };
  A.envState = () => ({ level: E.level, busy: Object.assign({}, E.busy) });

  // ---------------------------------------------------------------- sfx helpers
  const last = {};
  function throttle(name, ms) {
    const n = performance.now();
    if (last[name] && n - last[name] < ms) return false;
    last[name] = n;
    return true;
  }
  function tone(o) {
    const t = o.t != null ? o.t : ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide || o.dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.dest || sfxGain);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    const t = o.t != null ? o.t : ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    n.connect(f).connect(g).connect(o.dest || sfxGain);
    n.start(t, Math.random() * 1.2, o.dur + 0.05);
  }
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  // ---------------------------------------------------------------- sfx
  A.sfx = function (name, arg) {
    if (!ctx) return;
    if (ctx.state !== 'running') {
      // タイトルをタップした瞬間（init と同じ操作の中）はまだ起動中のことがある：起きたら鳴らす
      if (name === 'enter' && ctx.state === 'suspended' && !document.hidden) {
        const p = resumeCtx();
        if (p && p.then) p.then(() => { if (ctx && ctx.state === 'running') A.sfx(name, arg); }, () => {});
      }
      return;
    }
    try { sfxPlay(name, arg); } catch (e) { report(e); }
  };
  function sfxPlay(name, arg) {
    const t = ctx.currentTime;
    switch (name) {
      case 'tap':
        if (!throttle('tap', 40)) return;
        tone({ f: 980, f2: 520, dur: 0.06, vol: 0.12, type: 'triangle' });
        noise({ f: 3000, dur: 0.02, vol: 0.03, q: 2 });
        break;
      case 'soft':
        if (!throttle('soft', 40)) return;
        tone({ f: 660, f2: 440, dur: 0.07, vol: 0.06, type: 'sine' });
        break;
      case 'coin': {
        if (!throttle('coin', 28)) return;
        const step = PENTA[Math.min(arg || 0, PENTA.length - 1)];
        const m = 86 + step;
        tone({ f: mtof(m), dur: 0.16, vol: 0.09, type: 'triangle' });
        tone({ t: t + 0.045, f: mtof(m + 7), dur: 0.32, vol: 0.075, type: 'sine' });
        tone({ t: t + 0.045, f: mtof(m + 19), dur: 0.2, vol: 0.018, type: 'sine' });
        break;
      }
      case 'coins':
        for (let i = 0; i < 6; i++) {
          const m = 88 + PENTA[G.randi(0, 6)];
          tone({ t: t + i * 0.055 + Math.random() * 0.02, f: mtof(m), dur: 0.22, vol: 0.05, type: 'triangle' });
        }
        break;
      case 'open':
        noise({ f: 300, f2: 2200, dur: 0.2, vol: 0.05, q: 0.8, a: 0.05 });
        tone({ f: 520, f2: 780, dur: 0.12, vol: 0.03 });
        break;
      case 'close':
        noise({ f: 1800, f2: 280, dur: 0.18, vol: 0.04, q: 0.8, a: 0.02 });
        break;
      case 'swipe':
        if (!throttle('swipe', 80)) return;
        noise({ f: 700, f2: 3400, dur: 0.16, vol: 0.06, q: 0.7, a: 0.03 });
        break;
      case 'heart':
        tone({ f: 620, f2: 1300, dur: 0.12, vol: 0.09, slide: 0.08 });
        tone({ t: t + 0.07, f: 1560, dur: 0.18, vol: 0.04 });
        break;
      case 'door': // 扉のベル
        if (!throttle('door', 1500)) return;
        [[1, 1.6, 0.05], [2.76, 0.7, 0.016], [5.4, 0.35, 0.008]].forEach(([r, d, v]) =>
          tone({ f: 1318 * r, dur: d, vol: v, a: 0.002 }));
        tone({ t: t + 0.16, f: 1568, dur: 1.2, vol: 0.03, a: 0.002 });
        break;
      case 'upgrade':
        [74, 78, 81, 86, 90].forEach((m, i) => harp(t + i * 0.055, m, 0.12, sfxGain, 1.4));
        for (let i = 0; i < 5; i++) tone({ t: t + 0.25 + i * 0.04, f: mtof(98 + PENTA[G.randi(0, 5)]), dur: 0.25, vol: 0.02 });
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          tone({ t: t + i * 0.16, f: 210, f2: 120, dur: 0.1, vol: 0.12, type: 'triangle' });
          noise({ t: t + i * 0.16, f: 1600, dur: 0.05, vol: 0.06, q: 1.5 });
        }
        break;
      case 'built':
        [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => harp(t + i * 0.045, m, 0.11, sfxGain, 1.8));
        whistle(t + 0.32, 86, 0.6, 0.08, sfxGain);
        break;
      case 'levelup':
        [81, 86, 90, 93].forEach((m, i) => whistle(t + i * 0.09, m, i === 3 ? 0.5 : 0.1, 0.07, sfxGain));
        [62, 69, 74].forEach((m) => harp(t, m, 0.08, sfxGain));
        break;
      case 'rankup': {
        for (let i = 0; i < 10; i++) bodhran(t + i * 0.045, 0.3 + i * 0.06, 0.25, sfxGain);
        const t2 = t + 0.5;
        [62, 66, 69, 74].forEach((m) => harp(t2, m, 0.1, sfxGain, 2.4));
        [74, 78, 81, 86, 81, 86, 90].forEach((m, i) => whistle(t2 + i * 0.12, m, i === 6 ? 0.9 : 0.13, 0.08, sfxGain));
        bodhran(t2, 1, 0.35, sfxGain);
        break;
      }
      case 'roll': // 宝箱の前のドラムロール
        for (let i = 0; i < 14; i++) {
          const k = i / 13;
          bodhran(t + Math.pow(k, 0.8) * 0.62, 0.25 + k * 0.5, 0.2, sfxGain);
        }
        break;
      case 'reveal': {
        const tier = arg;
        if (tier === 'fail') {
          tone({ f: 392, f2: 330, dur: 0.32, vol: 0.07, type: 'triangle', slide: 0.3 });
          tone({ t: t + 0.32, f: 330, f2: 247, dur: 0.6, vol: 0.07, type: 'triangle', slide: 0.55 });
        } else if (tier === 'ok') {
          [74, 78, 81].forEach((m) => harp(t, m, 0.1, sfxGain));
          tone({ t: t + 0.05, f: mtof(93), dur: 0.4, vol: 0.03 });
        } else if (tier === 'great') {
          [62, 69, 74, 78, 81, 86].forEach((m, i) => harp(t + i * 0.03, m, 0.1, sfxGain, 2.2));
          for (let i = 0; i < 8; i++) tone({ t: t + 0.1 + i * 0.05, f: mtof(93 + PENTA[G.randi(0, 6)]), dur: 0.3, vol: 0.025 });
          bodhran(t, 1, 0.3, sfxGain);
        } else {
          for (let i = 0; i < 16; i++) harp(t + i * 0.035, 62 + PENTA[i % PENTA.length] + (i > 12 ? 12 : 0), 0.08, sfxGain, 2.6);
          [86, 90, 93, 98].forEach((m, i) => whistle(t + 0.6 + i * 0.14, m, i === 3 ? 1.2 : 0.15, 0.08, sfxGain));
          noise({ t: t + 0.55, f: 6000, dur: 1.4, vol: 0.03, q: 0.5, ft: 'highpass', a: 0.3 });
          bodhran(t, 1, 0.4, sfxGain);
          bodhran(t + 0.6, 1, 0.4, sfxGain);
        }
        break;
      }
      case 'hit':
        if (!throttle('hit', 40)) return;
        noise({ f: 2400, f2: 600, dur: 0.12, vol: 0.12, q: 0.8 });
        tone({ f: 160, f2: 60, dur: 0.14, vol: 0.18 });
        break;
      case 'slash':
        noise({ f: 1200, f2: 5200, dur: 0.12, vol: 0.07, q: 1.2, a: 0.02 });
        break;
      case 'magic':
        [86, 90, 93, 98].forEach((m, i) => tone({ t: t + i * 0.035, f: mtof(m), dur: 0.2, vol: 0.035 }));
        noise({ f: 4000, f2: 900, dur: 0.3, vol: 0.04, q: 2 });
        break;
      case 'pop': // 魔物が砕ける
        noise({ f: 900, f2: 200, dur: 0.25, vol: 0.12, q: 0.6 });
        tone({ f: 520, f2: 130, dur: 0.2, vol: 0.08, type: 'triangle' });
        break;
      case 'chest':
        tone({ f: 180, f2: 240, dur: 0.12, vol: 0.12, type: 'triangle' });
        noise({ t: t + 0.02, f: 800, dur: 0.12, vol: 0.06 });
        break;
      case 'bounce':
        if (!throttle('bounce', 60)) return;
        tone({ f: 240, f2: 150, dur: 0.08, vol: 0.08, type: 'triangle' });
        break;
      case 'tick':
        if (!throttle('tick', 45)) return;
        tone({ f: 2400, dur: 0.025, vol: 0.02, type: 'square', lp: 4000 });
        break;
      case 'cheer':
        if (!throttle('cheer', 70)) return;
        tone({ f: mtof(86 + PENTA[G.randi(0, 5)]), dur: 0.12, vol: 0.035 });
        break;
      case 'error':
        tone({ f: 220, dur: 0.1, vol: 0.06, type: 'triangle' });
        tone({ t: t + 0.11, f: 185, dur: 0.16, vol: 0.06, type: 'triangle' });
        break;
      case 'depart':
        [69, 74, 78].forEach((m, i) => whistle(t + i * 0.08, m, i === 2 ? 0.3 : 0.08, 0.06, sfxGain));
        break;
      case 'claim':
        [81, 86, 90].forEach((m, i) => harp(t + i * 0.06, m, 0.1, sfxGain, 1.2));
        break;
      case 'clank':
        if (!throttle('clank', 300)) return;
        tone({ f: 1900, dur: 0.18, vol: 0.012, type: 'triangle' });
        tone({ f: 2870, dur: 0.12, vol: 0.006 });
        break;
      case 'whoosh':
        noise({ f: 400, f2: 1600, dur: 0.3, vol: 0.05, q: 0.6, a: 0.1 });
        break;
      // ---- 戦闘
      case 'swish': // 剣を振る・魔物が飛びかかる
        if (!throttle('swish', 50)) return;
        if (arg === 1) noise({ f: 260, f2: 1300, dur: 0.16, vol: 0.07, q: 0.9, a: 0.03 });
        else noise({ f: 900, f2: 5200, dur: 0.11, vol: 0.075, q: 1.4, a: 0.015 });
        break;
      case 'impact': { // 0=通常 1=会心 2=重い
        if (!throttle('impact', 35)) return;
        const hv = arg || 0;
        tone({ f: 150 - hv * 20, f2: 42, dur: 0.16 + hv * 0.12, vol: 0.2 + hv * 0.06 });
        noise({ f: 1800, f2: 300, dur: 0.1 + hv * 0.08, vol: 0.12 + hv * 0.03, q: 0.7 });
        noise({ f: 5000, dur: 0.025, vol: 0.06, q: 2, ft: 'highpass' });
        if (hv >= 2) tone({ t: t + 0.02, f: 70, f2: 30, dur: 0.5, vol: 0.18 });
        break;
      }
      case 'crit': // 会心：金属が鳴る
        tone({ f: 1760, dur: 0.35, vol: 0.05, type: 'triangle', a: 0.002 });
        tone({ f: 2637, dur: 0.25, vol: 0.03, a: 0.002 });
        tone({ f: 3520, dur: 0.18, vol: 0.018, a: 0.002 });
        noise({ f: 6000, f2: 2500, dur: 0.18, vol: 0.05, q: 1.2 });
        tone({ f: 130, f2: 40, dur: 0.3, vol: 0.22 });
        break;
      case 'cast':
        if (!throttle('cast', 60)) return;
        [79, 83, 86, 91].forEach((m, i) => tone({ t: t + i * 0.03, f: mtof(m), dur: 0.22, vol: 0.03 }));
        noise({ f: 2500, f2: 7000, dur: 0.25, vol: 0.035, q: 3, a: 0.05 });
        break;
      case 'arrow':
        noise({ f: 4200, f2: 1400, dur: 0.16, vol: 0.06, q: 6, a: 0.01 });
        break;
      case 'heal':
        [74, 78, 81, 86, 90].forEach((m, i) => harp(t + i * 0.05, m, 0.07, sfxGain, 1.4));
        noise({ t: t + 0.1, f: 7000, dur: 0.6, vol: 0.02, q: 0.6, ft: 'highpass', a: 0.2 });
        break;
      case 'miss':
        noise({ f: 2400, f2: 500, dur: 0.14, vol: 0.06, q: 1, a: 0.01 });
        tone({ f: 880, f2: 1320, dur: 0.08, vol: 0.025, type: 'triangle' });
        break;
      case 'hurt':
        tone({ f: 220, f2: 110, dur: 0.16, vol: 0.12, type: 'triangle' });
        noise({ f: 900, f2: 200, dur: 0.12, vol: 0.09, q: 0.8 });
        break;
      case 'roar': { // 大きな魔物の咆哮
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(95, t);
        o.frequency.linearRampToValueAtTime(140, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.95);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 23;
        const lg = ctx.createGain();
        lg.gain.value = 18;
        lfo.connect(lg).connect(o.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        o.connect(lp).connect(g).connect(sfxGain);
        o.start(t); lfo.start(t);
        o.stop(t + 1.05); lfo.stop(t + 1.05);
        noise({ f: 500, f2: 200, dur: 0.9, vol: 0.06, q: 0.5, a: 0.1 });
        break;
      }
      case 'encounter':
        tone({ f: mtof(76), dur: 0.12, vol: 0.05, type: 'triangle' });
        tone({ t: t + 0.09, f: mtof(79), dur: 0.3, vol: 0.05, type: 'triangle' });
        bodhran(t, 1, 0.3, sfxGain);
        break;
      case 'flash': // 閃き：ピキーン
        tone({ f: 2093, dur: 0.9, vol: 0.06, a: 0.002 });
        tone({ f: 3136, dur: 0.7, vol: 0.035, a: 0.002 });
        tone({ t: t + 0.07, f: 4186, dur: 0.6, vol: 0.025, a: 0.002 });
        noise({ f: 8000, dur: 0.5, vol: 0.025, q: 0.5, ft: 'highpass', a: 0.05 });
        break;
      case 'cutin': {
        noise({ f: 300, f2: 6000, dur: 0.32, vol: 0.09, q: 0.7, a: 0.1 });
        [50, 57, 62, 69].forEach((m) => tone({ t: t + 0.12, f: mtof(m), dur: 0.7, vol: 0.035, type: 'sawtooth', lp: 1800 }));
        [74, 81].forEach((m) => tone({ t: t + 0.12, f: mtof(m), dur: 0.6, vol: 0.03, type: 'triangle' }));
        bodhran(t + 0.12, 1, 0.42, sfxGain);
        break;
      }
      case 'shatter':
        for (let i = 0; i < 10; i++) tone({ t: t + Math.random() * 0.12, f: 1800 + Math.random() * 3200, dur: 0.12 + Math.random() * 0.2, vol: 0.016, type: 'triangle', a: 0.001 });
        noise({ f: 3000, f2: 800, dur: 0.4, vol: 0.09, q: 0.5 });
        tone({ f: 110, f2: 38, dur: 0.4, vol: 0.2 });
        break;
      case 'rarity': { // 宝箱の色が変わる・レア確定
        const r = G.clamp(arg || 1, 1, 4);
        const base = [0, 79, 81, 84, 86][r];
        const steps = r >= 4 ? [0, 4, 7, 12, 16, 19, 24] : r >= 3 ? [0, 4, 7, 12, 16] : [0, 7, 12];
        steps.forEach((d, i) => tone({ t: t + i * 0.045, f: mtof(base + d), dur: 0.5, vol: 0.04, type: i % 2 ? 'sine' : 'triangle', a: 0.002 }));
        if (r >= 3) noise({ t: t + 0.1, f: 7000, dur: 0.9, vol: 0.03, q: 0.5, ft: 'highpass', a: 0.2 });
        if (r >= 4) for (let i = 0; i < 12; i++) harp(t + 0.3 + i * 0.04, 74 + PENTA[i % PENTA.length], 0.06, sfxGain, 1.8);
        break;
      }
      case 'keyTurn': { // 宝箱の鍵を回す：カチッ（arg 1〜3：回すたびに少し高く）
        const k = G.clamp(arg || 1, 1, 3);
        noise({ f: 4200 + k * 500, dur: 0.03, vol: 0.06, q: 3 });
        tone({ f: 1500 + k * 180, f2: 900, dur: 0.05, vol: 0.05, type: 'triangle' });
        tone({ t: t + 0.05, f: 2600 + k * 220, dur: 0.12, vol: 0.025, type: 'triangle', a: 0.002 });
        tone({ f: 140, f2: 80, dur: 0.08, vol: 0.08 });
        break;
      }
      case 'cardFlip': // カードをめくる：ぱらっ
        if (!throttle('cardFlip', 45)) return;
        noise({ f: 1800, f2: 5200, dur: 0.07, vol: 0.05, q: 0.9, a: 0.01 });
        tone({ t: t + 0.03, f: 1200, f2: 1700, dur: 0.05, vol: 0.02, type: 'triangle' });
        break;
      case 'gather': // UR：光が集まってくる（ひゅうう…と上がる）
        if (!throttle('gather', 400)) return;
        tone({ f: 180, f2: 720, dur: 1.2, vol: 0.045, a: 0.6, type: 'sawtooth', lp: 1400, slide: 1.2 });
        tone({ f: 360, f2: 1440, dur: 1.2, vol: 0.03, a: 0.6, slide: 1.2 });
        noise({ f: 600, f2: 6000, dur: 1.25, vol: 0.05, q: 0.6, a: 1 });
        for (let i = 0; i < 8; i++) tone({ t: t + 0.3 + i * 0.11, f: mtof(86 + PENTA[i]), dur: 0.25, vol: 0.012 + i * 0.002 });
        break;
      case 'commentPop':
        if (!throttle('commentPop', 110)) return;
        tone({ f: 880 + Math.random() * 200, f2: 1500, dur: 0.07, vol: 0.022, slide: 0.05 });
        break;
      case 'gift':
        for (let i = 0; i < 5; i++) tone({ t: t + i * 0.06, f: mtof(91 + PENTA[i]), dur: 0.3, vol: 0.035, type: 'triangle' });
        tone({ t: t + 0.3, f: mtof(103), dur: 0.6, vol: 0.02 });
        break;
      case 'stamp': // 結果のはんこ
        tone({ f: 120, f2: 50, dur: 0.22, vol: 0.2 });
        noise({ f: 1200, f2: 300, dur: 0.1, vol: 0.08, q: 0.8 });
        break;
      case 'enter': // タイトルをタップ：ふぁああーん！と光が弾ける
        if (!throttle('enter', 800)) return;
        enterSwell(t);
        break;
      // ---- 釣り
      case 'splash': // ぽちゃん（浮きが水に落ちる）＋しずく
        if (!throttle('splash', 120)) return;
        splash(t, 1);
        break;
      case 'bite': // くいっ（魚がかかった）＋小さな鈴
        if (!throttle('bite', 200)) return;
        tone({ f: 300, f2: 820, dur: 0.07, vol: 0.12, slide: 0.05 });
        noise({ f: 900, f2: 380, dur: 0.11, vol: 0.06, q: 0.9 });
        [[1, 0.05, 0.55], [2.76, 0.016, 0.26], [5.4, 0.006, 0.12]].forEach(([r, v, d]) => tone({ t: t + 0.07, f: 1760 * r, dur: d, vol: v, a: 0.002 }));
        tone({ t: t + 0.2, f: 2093, dur: 0.4, vol: 0.03, a: 0.002 });
        break;
      case 'reel': // リールを巻くカチカチ（1秒に何度も呼ばれるので、小さく軽く）
        if (!throttle('reel', 45)) return;
        noise({ f: 3200 + Math.random() * 1200, dur: 0.012, vol: 0.02, q: 4 });
        tone({ f: 2300, dur: 0.008, vol: 0.006, type: 'square', lp: 5000 });
        break;
      case 'catch': // 釣れた！：水しぶき＋明るい3音
        if (!throttle('catch', 400)) return;
        splash(t, 0.7);
        [62, 66, 69, 74].forEach((m, i) => harp(t + 0.1 + i * 0.025, m, 0.08, sfxGain, 1.6));
        [81, 86, 90].forEach((m, i) => whistle(t + 0.14 + i * 0.12, m, i === 2 ? 0.6 : 0.11, 0.075, sfxGain));
        for (let i = 0; i < 5; i++) tone({ t: t + 0.4 + i * 0.05, f: mtof(98 + PENTA[G.randi(0, 5)]), dur: 0.25, vol: 0.016 });
        break;
    }
  }
  function splash(t, k) {
    tone({ t, f: 380, f2: 1100, dur: 0.09, vol: 0.12 * k, slide: 0.07 });
    noise({ t, f: 1300, f2: 450, dur: 0.22, vol: 0.08 * k, q: 0.7, a: 0.01 });
    noise({ t: t + 0.02, f: 5000, f2: 2500, dur: 0.16, vol: 0.025 * k, q: 0.8 });
    for (let i = 0; i < 5; i++) {
      const f = rr(1300, 2600);
      tone({ t: t + rr(0.07, 0.42), f, f2: f * 1.6, dur: 0.035, vol: rr(0.015, 0.03) * k });
    }
  }
  // 「ふぁああーん」：低いぼわん → 長三和音がふくらむ（合唱のような響き）→ 上へ駆けるきらめき → 光の余韻
  function enterSwell(t) {
    const s = G.state && G.state.settings.sfx != null ? G.state.settings.sfx : 0.8;
    const bus = ctx.createGain();
    bus.connect(sfxGain);
    const wet = ctx.createGain(); // いつもより深い残響（効果音の音量に合わせる）
    wet.gain.value = Math.pow(s, 1.2) * 1.7 * 0.45;
    bus.connect(wet).connect(convolver);
    setTimeout(() => { try { bus.disconnect(); wet.disconnect(); } catch (e) { /* noop */ } }, 4500);
    tone({ t, f: 92, f2: 46, dur: 0.6, vol: 0.16, a: 0.02, dest: bus });
    noise({ t, f: 160, f2: 900, dur: 0.5, vol: 0.05, q: 0.7, a: 0.12, ft: 'lowpass', dest: bus });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(3800, t + 0.32);
    lp.frequency.exponentialRampToValueAtTime(900, t + 1.75);
    const vow = ctx.createBiquadFilter(); // 「あー」の母音のふくらみ
    vow.type = 'peaking';
    vow.frequency.value = 900;
    vow.Q.value = 1.2;
    vow.gain.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.13);
    g.gain.linearRampToValueAtTime(0.034, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
    lp.connect(vow).connect(g).connect(bus);
    const nodes = [lp, vow, g];
    let first = null;
    [50, 57, 62, 66, 69, 74].forEach((m, i) => {
      [-1, 1].forEach((side) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = side * (7 + Math.random() * 4);
        o.connect(lp);
        o.start(t);
        o.stop(t + 1.8);
        nodes.push(o);
        if (!first) first = o;
      });
    });
    cleanup(first, nodes);
    [74, 76, 78, 81, 83, 86, 88, 90, 93, 95, 98].forEach((m, i) => {
      harp(t + 0.06 + i * 0.045, m, 0.06, bus, 1.3);
      if (i % 2 === 0 && m <= 90) celesta(t + 0.08 + i * 0.045, m, 0.035, bus);
    });
    noise({ t: t + 0.25, f: 7000, dur: 1.4, vol: 0.022, q: 0.5, ft: 'highpass', a: 0.4, dest: bus });
    celesta(t + 0.62, 93, 0.045, bus);
    celesta(t + 0.8, 98, 0.035, bus);
  }
})();
