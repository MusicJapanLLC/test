/* ギルドの灯 — audio: Web Audio だけで鳴らすケルト風BGMと効果音
 *  - 外部音源ファイルは使わない。曲はこのファイルの中で作曲したオリジナル。
 *  - 楽器: ティンホイッスル / ハープ / フィドル / バウロン / ドローン
 *  - BGM は場面ごとにクロスフェード、メニューを開くとローパスで「こもる」。
 */
'use strict';
(function () {
  const A = (G.audio = {});
  let ctx = null;
  let master, comp, musicGain, musicLP, sfxGain, ambGain, convolver, revReturn, musicSend, sfxSend;
  let noiseBuf = null, brownBuf = null, harpWave = null;
  let current = null; // 再生中のトラック
  let wantTrack = 'guild';
  let schedTimer = null;
  let ambientLevel = 0;
  let murmur = null;
  A.night = false;
  A.ready = false;
  A.muffled = false;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------------------------------------------------------------- init
  A.init = function () {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    // 最後にリミッター：派手な効果音が重なっても割れない
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    master.connect(comp).connect(limiter).connect(ctx.destination);

    musicGain = ctx.createGain();
    musicLP = ctx.createBiquadFilter();
    musicLP.type = 'lowpass';
    musicLP.frequency.value = 18000;
    musicLP.Q.value = 0.5;
    musicGain.connect(musicLP).connect(master);

    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0;
    ambGain.connect(master);

    convolver = ctx.createConvolver();
    convolver.buffer = makeIR(2.6);
    revReturn = ctx.createGain();
    revReturn.gain.value = 0.32;
    convolver.connect(revReturn).connect(master);
    musicSend = ctx.createGain();
    musicSend.gain.value = 0.55;
    musicLP.connect(musicSend).connect(convolver);
    sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.18;
    sfxGain.connect(sfxSend).connect(convolver);

    noiseBuf = makeNoise(2, false);
    brownBuf = makeNoise(4, true);
    const real = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const imag = new Float32Array([0, 1, 0.46, 0.24, 0.13, 0.07, 0.035, 0.02]);
    harpWave = ctx.createPeriodicWave(real, imag);

    A.applyVolumes();
    A.ready = true;
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.8);
    schedTimer = setInterval(schedule, 30);
    A.playTrack(wantTrack, true);
    A.setAmbient(ambientLevel);
  };

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
    const t = ctx.currentTime;
    musicGain.gain.setTargetAtTime(Math.pow(s.bgm, 1.4) * 2.3 * (A.muffled ? 0.62 : 1), t, 0.08);
    sfxGain.gain.setTargetAtTime(Math.pow(s.sfx, 1.2) * 1.7, t, 0.05);
  };

  // メニューを開いた時、音楽を少しこもらせる
  A.setMuffle = function (on) {
    A.muffled = on;
    if (!ctx) return;
    musicLP.frequency.setTargetAtTime(on ? 1150 : 18000, ctx.currentTime, on ? 0.09 : 0.18);
    A.applyVolumes();
  };

  // 夜になったら夜の曲へ、朝になったら昼の曲へ（ギルドにいるときだけ）
  let homeDay = 'guild';
  A.playHome = function (fade) { A.playTrack(A.night ? 'night' : homeDay, fade || 1.1); };
  A.setNight = function (n) {
    if (A.night === n) return;
    A.night = n;
    if (!ctx) { if (TRACKS[wantTrack] && TRACKS[wantTrack].home) wantTrack = n ? 'night' : homeDay; return; }
    if (current && TRACKS[current.name].home && wantTrack === current.name) A.playHome(2.6);
  };

  // タブを離れたらふわっと消え、戻ったらふわっと戻る
  A.pause = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.35);
    setTimeout(() => { if (document.hidden && ctx) ctx.suspend(); }, 420);
  };
  A.resume = function () {
    if (!ctx) return;
    ctx.resume().then(() => {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(0, t);
      master.gain.linearRampToValueAtTime(1, t + 1.4);
      if (current) current.resync();
    });
  };

  A._debug = () => ({ ctx, master, musicGain, sfxGain });

  // ---------------------------------------------------------------- instruments
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (d) g.gain.linearRampToValueAtTime(peak * sus, t + a + d);
    g.gain.setValueAtTime(peak * sus, end);
    g.gain.linearRampToValueAtTime(0.0001, end + rel);
  }

  function whistle(t, m, dur, vol, dest) {
    const f = mtof(m);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    const g2 = ctx.createGain();
    g2.gain.value = 0.11;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 2, t);
    // 装飾音（カット）: 一瞬上の音を鳴らしてから本来の音へ
    if (dur > 0.26 && Math.random() < 0.2) {
      o.frequency.setValueAtTime(mtof(m + 2), t);
      o.frequency.setValueAtTime(f, t + 0.032);
      o2.frequency.setValueAtTime(mtof(m + 2) * 2, t);
      o2.frequency.setValueAtTime(f * 2, t + 0.032);
    }
    env(g, t, 0.022, vol, 0.08, 0.82, 0.06, t + dur * 0.92);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(dest);
    // ビブラート（長い音だけ、後からかかる）
    if (dur > 0.34) {
      const l = ctx.createOscillator();
      l.frequency.value = 5.3 + Math.random() * 0.6;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(0, t + 0.14);
      lg.gain.linearRampToValueAtTime(f * 0.0075, t + dur * 0.85);
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    // 息の音
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = f * 1.6;
    bf.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.32, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(bf).connect(ng).connect(dest);
    n.start(t, Math.random() * 1.5, 0.09);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.12);
    o2.stop(t + dur + 0.12);
  }

  function harp(t, m, vol, dest, ring = 1.9) {
    const f = mtof(m);
    const o = ctx.createOscillator();
    o.setPeriodicWave(harpWave);
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 1.6), t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.32, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + ring + 0.05);
  }

  function fiddle(t, m, dur, vol, dest) {
    const f = mtof(m);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    lp.Q.value = 0.8;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 900;
    pk.gain.value = 5;
    const g = ctx.createGain();
    env(g, t, 0.05, vol, 0.1, 0.85, 0.09, t + dur * 0.95);
    const l = ctx.createOscillator();
    l.frequency.value = 5.8;
    const lg = ctx.createGain();
    lg.gain.value = f * 0.005;
    l.connect(lg).connect(o.frequency);
    o.connect(lp).connect(pk).connect(g).connect(dest);
    o.start(t);
    l.start(t);
    o.stop(t + dur + 0.15);
    l.stop(t + dur + 0.15);
  }

  function bodhran(t, acc, vol, dest) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(54, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * acc, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.35);
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = acc > 0.7 ? 700 : 1600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.35 * acc, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(lp).connect(ng).connect(dest);
    n.start(t, Math.random(), 0.06);
  }

  // ---------------------------------------------------------------- tunes
  // ABC 記法のごく一部を読む。調号は曲ごと（既定はニ長調 F#, C#）。
  const KEYS = { D: { F: 1, C: 1 }, G: { F: 1 }, C: {}, Dm: { B: -1 }, F: { B: -1 } };
  function parseABC(str, key) {
    const out = [];
    const re = /(=|\^|_)?([A-Ga-gz])([,']*)(\d*)/g;
    const base = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
    const sig = KEYS[key || 'D'];
    let m;
    let t = 0;
    while ((m = re.exec(str))) {
      const acc = m[1], L = m[2], oct = m[3], len = m[4] ? parseInt(m[4], 10) : 1;
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

  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function chordNotes(name) {
    const minor = /m$/.test(name);
    let pc = PC[name[0]];
    if (name[1] === '#') pc += 1;
    else if (name[1] === 'b') pc -= 1;
    if (pc < 0) pc += 12;
    let root = 48 + pc;
    if (root > 53) root -= 12;
    return { root, fifth: root + 7, third: root + 12 + (minor ? 3 : 4), oct: root + 12 };
  }

  // 「灯りの酒場」6/8 ジグ（AABB）— このゲームのために作曲
  const JIG_A = 'd2e f2d | e2c A2G | F2A d2f | e2d c2A | d2e f2g | a2f g2e | f2d e2c | d3 d2A';
  const JIG_B = 'fga b2a | g2e =c2e | fga b2a | ge=c d3 | fga b2a | g2b a2f | g2e f2d | ecA d3';
  const JIG_CH_A = ['D', 'D', 'A', 'A', 'D', 'D', 'A', 'A', 'D', 'D', 'D', 'G', 'D', 'A', 'D', 'D'];
  const JIG_CH_B = ['D', 'G', 'C', 'C', 'D', 'G', 'C', 'D', 'D', 'G', 'G', 'D', 'G', 'D', 'A', 'D'];

  // 「草原を行け」4/4 リール（ホ・ドリア）— 冒険譚用
  const REEL_A = 'E2BE dEBE | G2AB dBAG | F2AF DFAF | d2cd BAFA | E2BE dEBE | G2AB d2ef | gfed BAFA | B2E2 E4';
  const REEL_B = 'e2Be geBe | f2df afdf | e2Be gefg | afdf e4 | e2Be geBe | f2af gfed | BdAF DEFA | B2E2 E4';
  const REEL_CH_A = ['Em', 'Em', 'G', 'G', 'D', 'D', 'D', 'Bm', 'Em', 'Em', 'G', 'D', 'Em', 'D', 'Em', 'Em'];
  const REEL_CH_B = ['Em', 'Em', 'D', 'D', 'Em', 'Em', 'D', 'Em', 'Em', 'Em', 'D', 'G', 'G', 'D', 'Em', 'Em'];

  const HARP_PAT = {
    6: (c) => [[0, c.root, 1], [1, c.fifth, 0.72], [2, c.third, 0.72]],
    4: (c) => [[0, c.root, 1], [1, c.fifth, 0.72], [2, c.oct, 0.72], [3, c.third, 0.72]],
    3: (c) => [[0, c.root, 1], [1, c.fifth, 0.7], [2, c.oct, 0.7], [3, c.third, 0.75], [4, c.oct, 0.62], [5, c.fifth, 0.55]],
  };
  const DRUM_PAT = {
    6: (e) => (e === 0 ? [1] : e === 3 ? [0.7] : e === 5 || e === 2 ? [0.32, 1] : null),
    4: (e) => (e % 2 === 0 ? [e === 0 ? 1 : e === 4 ? 0.8 : 0.5] : [0.25, 1]),
    3: (e) => (e === 0 ? [1] : e === 2 || e === 4 ? [0.42, 1] : null),
  };
  function buildTune(def) {
    const A1 = parseABC(def.A, def.key), B1 = parseABC(def.B, def.key);
    const events = [];
    const bar = def.bar; // 1小節の8分音符数
    const beat = def.beat || (def.meter === 6 ? 3 : def.meter === 3 ? 2 : 4);
    const harpPat = def.harpPat || HARP_PAT[def.meter];
    const drumPat = def.drumPat || DRUM_PAT[def.meter];
    let off = 0;
    const parts = [
      [A1, def.chA, 0],
      [A1, def.chA, 1],
      [B1, def.chB, 0],
      [B1, def.chB, 1],
    ];
    parts.forEach(([p, ch, rep], pi) => {
      p.notes.forEach((n) => {
        const beatAcc = n.t % beat === 0 ? 1 : 0.82;
        events.push({ t: off + n.t, d: n.d, m: n.m, i: 'mel', acc: beatAcc, part: pi, rep });
      });
      const cd = p.len / ch.length; // 和音1つの長さ
      ch.forEach((name, k) => {
        const c = chordNotes(name);
        const t0 = off + k * cd;
        harpPat(c, cd).forEach(([o, m, acc]) => { if (o < cd) events.push({ t: t0 + o, m, i: 'harp', acc, part: pi }); });
      });
      const bars = p.len / bar;
      for (let b = 0; b < bars; b++) {
        for (let e = 0; e < bar; e++) {
          const d = drumPat(e, b);
          if (d) events.push({ t: off + b * bar + e, i: 'drum', acc: d[0], ghost: !!d[1] });
        }
      }
      off += p.len;
    });
    events.sort((a, b) => a.t - b.t);
    return { events, len: off };
  }

  // 「市場の朝」2/4 ポルカ（ト長調）— 昼のギルド・2曲目
  const POLKA_A = 'd2 B2 G2 B2 | dcBA G2 D2 | E2 F2 G2 A2 | B2 A2 G2 E2 | d2 B2 G2 B2 | dcBA G2 B2 | A2 F2 D2 F2 | G4 G2 z2';
  const POLKA_B = 'g2 fe d2 B2 | c2 e2 A2 c2 | B2 dB G2 B2 | A2 cA F2 A2 | g2 fe d2 B2 | c2 e2 A2 c2 | B2 G2 A2 F2 | G4 G2 z2';
  // 「星降る窓辺」3/4 スロー・エア（ト長調）— 夜のギルド
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
  // 「潮騒のホーンパイプ」4/4（ニ長調）— 潮風の港
  const HARBOR_A = 'A3G F3G | A2d2 d3c | B3A G3F | E2A2 A3G | F3G A3B | c2e2 e3d | c3B A3G | F2D2 D4';
  const HARBOR_B = 'd3e f3e | d2f2 a3f | g3f e3d | c2e2 e3c | d3e f3g | a2f2 d3B | A3F G3E | D2F2 D4';
  // 「天空の回廊」3/4（ハ長調）— 天空城
  const SKY_A = 'E2 G2 c2 | e4 d2 | c2 B2 A2 | G6 | F2 A2 c2 | f4 e2 | d2 c2 B2 | c6';
  const SKY_B = 'g2 e2 c2 | d4 G2 | A2 B2 c2 | d6 | e2 f2 g2 | a4 g2 | f2 e2 d2 | c6';
  // 「深淵の螺旋」6/8（ホ短調）— 深淵の迷宮
  const ABYSS_A = 'E3 B3 | A2G F2E | D3 A3 | G2F E3 | E3 B3 | c2B A2G | F2G A2F | E6';
  const ABYSS_B = 'e3 d3 | B2c d2B | A3 G3 | F2G A3 | e3 g3 | f2e d2B | c2B A2F | E6';
  // 「紅蓮の竜王」4/4（ニ短調）— ボス戦
  const BOSS_A = 'd2 Ad fdAd | c2 Gc ecGc | B2 FB dBFB | A2 ^CE A4 | d2 Ad fdAd | c2 Gc ecGc | B2 dB A2 ^c2 | d4 D4';
  const BOSS_B = 'f2 ef gfed | e2 de fedc | d2 cd edcB | ^c2 A2 E2 A2 | f2 ef gfed | e2 de fedc | dcBA B2 ^c2 | d8';

  const TRACKS = {
    guild: {
      A: JIG_A, B: JIG_B, chA: JIG_CH_A, chB: JIG_CH_B, bar: 6, meter: 6, rotate: 2,
      bpm: 86, // 付点四分 = 86
      drone: [38, 45],
      arrange(pass, night) {
        if (night) return { mel: 0.075, harp: 0.11, fid: 0, drum: 0, drone: 0.018, tempo: 0.86 };
        return [
          { mel: 0.1, harp: 0.12, fid: 0, drum: 0, drone: 0.022, tempo: 1 },
          { mel: 0.1, harp: 0.11, fid: 0.03, drum: 0.2, drone: 0.024, tempo: 1 },
          { mel: 0.065, harp: 0.13, fid: 0, drum: 0.16, drone: 0.02, tempo: 1 },
          { mel: 0.1, harp: 0.11, fid: 0.035, drum: 0.22, drone: 0.026, tempo: 1 },
        ][pass % 4];
      },
    },
    reels: {
      A: REEL_A, B: REEL_B, chA: REEL_CH_A, chB: REEL_CH_B, bar: 8, meter: 4,
      bpm: 104 * 2, // 8分音符 = 208
      drone: [40, 47],
      arrange(pass) {
        return [
          { mel: 0.085, harp: 0.11, fid: 0, drum: 0.2, drone: 0.016, tempo: 1 },
          { mel: 0.09, harp: 0.1, fid: 0.03, drum: 0.22, drone: 0.018, tempo: 1 },
        ][pass % 2];
      },
    },
  };
  Object.assign(TRACKS, {
    guild2: {
      title: '♪ 市場の朝 — ギルド楽団', home: true, rotate: 2,
      A: POLKA_A, B: POLKA_B, key: 'G', bar: 8, meter: 4, beat: 2,
      chA: ['G', 'G', 'D', 'G', 'C', 'D', 'G', 'Em', 'G', 'G', 'D', 'G', 'D', 'D', 'G', 'G'],
      chB: ['G', 'G', 'C', 'Am', 'G', 'G', 'D', 'D', 'G', 'G', 'C', 'Am', 'G', 'D', 'G', 'G'],
      bpm: 236, drone: [43, 50],
      // ブン・チャッ（低い音と和音を交互に）
      harpPat: (c) => [[0, c.root, 1], [2, c.third, 0.6], [2, c.fifth + 12, 0.42], [3, c.oct, 0.35]],
      drumPat: (e) => (e % 4 === 0 ? [1] : e % 4 === 2 ? [0.55] : [0.22, 1]),
      arrange(pass) {
        return [
          { mel: 0.09, harp: 0.11, fid: 0, drum: 0.17, drone: 0.012, tempo: 1 },
          { mel: 0.09, harp: 0.1, fid: 0.03, drum: 0.2, drone: 0.014, tempo: 1 },
        ][pass % 2];
      },
    },
    night: {
      title: '♪ 星降る窓辺 — ギルド楽団', home: true,
      A: AIR_A, B: AIR_B, key: 'G', bar: 6, meter: 3,
      chA: ['G', 'G', 'Em', 'C', 'G', 'Am', 'D', 'G'],
      chB: ['G', 'Em', 'D', 'C', 'Em', 'G', 'D', 'G'],
      bpm: 128, drone: [43, 50],
      arrange(pass) {
        return [
          { mel: 0.07, harp: 0.12, fid: 0, drum: 0, drone: 0.014, tempo: 1 },
          { mel: 0.05, lead: 'fid', harp: 0.11, fid: 0, drum: 0, drone: 0.016, tempo: 0.97 },
          { mel: 0.065, harp: 0.13, fid: 0.022, drum: 0, drone: 0.014, tempo: 1 },
        ][pass % 3];
      },
    },
    forest: {
      title: '♪ ささやきの森のジグ — ギルド楽団',
      A: FJIG_A, B: FJIG_B, key: 'G', bar: 6, meter: 6,
      chA: ['Em', 'Em', 'Em', 'G', 'D', 'D', 'D', 'D', 'Em', 'Em', 'Em', 'C', 'D', 'D', 'Em', 'Em'],
      chB: ['Em', 'C', 'D', 'Bm', 'Em', 'Em', 'G', 'D', 'Em', 'C', 'D', 'G', 'D', 'Em', 'B', 'Em'],
      bpm: 100, drone: [40, 47],
      arrange(pass) {
        return [
          { mel: 0.085, harp: 0.11, fid: 0, drum: 0.18, drone: 0.018, tempo: 1 },
          { mel: 0.09, harp: 0.1, fid: 0.032, drum: 0.21, drone: 0.02, tempo: 1 },
        ][pass % 2];
      },
    },
    cave: {
      title: '♪ こだまの底で — ギルド楽団',
      A: CAVE_A, B: CAVE_B, key: 'Dm', bar: 6, meter: 3,
      chA: ['Dm', 'Gm', 'Dm', 'A', 'Dm', 'Dm', 'Gm', 'A'],
      chB: ['Dm', 'Gm', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm'],
      bpm: 150, drone: [38, 45],
      // 心臓の音のような太鼓
      drumPat: (e) => (e === 0 ? [1] : e === 1 ? [0.5] : null),
      arrange(pass) {
        return [
          { mel: 0.06, lead: 'fid', harp: 0.13, fid: 0, drum: 0.15, drone: 0.03, tempo: 1 },
          { mel: 0.07, harp: 0.12, fid: 0.026, drum: 0.17, drone: 0.03, tempo: 1 },
        ][pass % 2];
      },
    },
    castle: {
      title: '♪ 灰の城の行進 — ギルド楽団',
      A: MARCH_A, B: MARCH_B, key: 'D', bar: 8, meter: 4,
      chA: ['Bm', 'Bm', 'F#', 'Bm', 'Bm', 'A', 'D', 'D', 'Bm', 'Bm', 'Bm', 'F#', 'G', 'A', 'Bm', 'Bm'],
      chB: ['Bm', 'Bm', 'G', 'Em', 'A', 'A', 'D', 'D', 'Bm', 'Bm', 'G', 'Em', 'G', 'A', 'Bm', 'Bm'],
      bpm: 200, drone: [35, 42],
      // 行進の太鼓：ドン・タ・ドン・タ、小節の終わりに小さな連打
      drumPat: (e) => (e === 0 ? [1] : e === 4 ? [0.85] : e % 2 === 0 ? [0.55] : e === 7 ? [0.4] : [0.18, 1]),
      arrange(pass) {
        return [
          { mel: 0.085, harp: 0.1, fid: 0.02, drum: 0.26, drone: 0.02, tempo: 1 },
          { mel: 0.08, harp: 0.11, fid: 0.035, drum: 0.28, drone: 0.022, tempo: 1 },
        ][pass % 2];
      },
    },
    peak: {
      title: '♪ 竜の背を越えて — ギルド楽団',
      A: PEAK_A, B: PEAK_B, key: 'G', bar: 8, meter: 4,
      chA: ['Am', 'D', 'G', 'G', 'Am', 'D', 'G', 'Am', 'Am', 'D', 'G', 'G', 'C', 'Am', 'G', 'Am'],
      chB: ['Am', 'D', 'G', 'G', 'Am', 'D', 'G', 'Am', 'Am', 'D', 'G', 'Am', 'Em', 'G', 'G', 'Am'],
      bpm: 232, drone: [45, 52],
      arrange(pass) {
        return [
          { mel: 0.085, harp: 0.1, fid: 0, drum: 0.22, drone: 0.016, tempo: 1 },
          { mel: 0.085, harp: 0.1, fid: 0.035, drum: 0.25, drone: 0.018, tempo: 1 },
        ][pass % 2];
      },
    },
    harbor: {
      title: '♪ 潮騒のホーンパイプ — ギルド楽団',
      A: HARBOR_A, B: HARBOR_B, key: 'D', bar: 8, meter: 4,
      chA: ['D', 'D', 'D', 'A', 'G', 'D', 'A', 'A', 'D', 'G', 'A', 'A', 'A', 'Em', 'D', 'D'],
      chB: ['D', 'D', 'D', 'D', 'G', 'D', 'A', 'A', 'D', 'G', 'D', 'Bm', 'D', 'A', 'D', 'D'],
      bpm: 188, drone: [38, 45],
      drumPat: (e) => (e === 0 ? [1] : e === 4 ? [0.8] : e % 2 === 0 ? [0.5] : e === 3 || e === 7 ? [0.3, 1] : null),
      arrange(pass) {
        return [
          { mel: 0.085, harp: 0.11, fid: 0.02, drum: 0.2, drone: 0.016, tempo: 1 },
          { mel: 0.085, harp: 0.1, fid: 0.035, drum: 0.22, drone: 0.018, tempo: 1 },
        ][pass % 2];
      },
    },
    sky: {
      title: '♪ 天空の回廊 — ギルド楽団',
      A: SKY_A, B: SKY_B, key: 'C', bar: 6, meter: 3,
      chA: ['C', 'C', 'Am', 'G', 'F', 'F', 'G', 'C'],
      chB: ['C', 'G', 'F', 'G', 'C', 'F', 'G', 'C'],
      bpm: 156, drone: [36, 43],
      arrange(pass) {
        return [
          { mel: 0.08, harp: 0.13, fid: 0.025, drum: 0.1, drone: 0.016, tempo: 1 },
          { mel: 0.07, lead: 'fid', harp: 0.13, fid: 0, drum: 0.12, drone: 0.018, tempo: 1 },
        ][pass % 2];
      },
    },
    abyss: {
      title: '♪ 深淵の螺旋 — ギルド楽団',
      A: ABYSS_A, B: ABYSS_B, key: 'G', bar: 6, meter: 6,
      chA: ['Em', 'Em', 'Am', 'B', 'D', 'D', 'G', 'Em', 'Em', 'Em', 'C', 'Am', 'D', 'B', 'Em', 'Em'],
      chB: ['Em', 'D', 'G', 'G', 'Am', 'G', 'D', 'D', 'Em', 'Em', 'D', 'G', 'Am', 'B', 'Em', 'Em'],
      bpm: 66, drone: [40, 47],
      drumPat: (e) => (e === 0 ? [1] : e === 1 ? [0.45] : null),
      arrange(pass) {
        return [
          { mel: 0.06, lead: 'fid', harp: 0.13, fid: 0, drum: 0.14, drone: 0.032, tempo: 1 },
          { mel: 0.065, harp: 0.12, fid: 0.024, drum: 0.16, drone: 0.034, tempo: 1 },
        ][pass % 2];
      },
    },
    boss: {
      title: '♪ 紅蓮の竜王 — ギルド楽団',
      A: BOSS_A, B: BOSS_B, key: 'Dm', bar: 8, meter: 4,
      chA: ['Dm', 'Dm', 'C', 'C', 'Bb', 'Bb', 'A', 'A', 'Dm', 'Dm', 'C', 'C', 'Bb', 'A', 'Dm', 'Dm'],
      chB: ['Dm', 'Gm', 'C', 'F', 'Bb', 'Gm', 'A', 'A', 'Dm', 'Gm', 'C', 'F', 'Gm', 'A', 'Dm', 'Dm'],
      bpm: 240, drone: [38, 45],
      drumPat: (e) => (e % 4 === 0 ? [1] : e % 2 === 0 ? [0.75] : [0.42]),
      arrange(pass) {
        return [
          { mel: 0.09, harp: 0.1, fid: 0.035, fidAll: true, drum: 0.3, drone: 0.03, tempo: 1 },
          { mel: 0.09, harp: 0.11, fid: 0.045, fidAll: true, drum: 0.32, drone: 0.032, tempo: 1.02 },
        ][pass % 2];
      },
    },
  });
  TRACKS.guild.title = '♪ 灯りの酒場 — ギルド楽団';
  TRACKS.guild.home = true;
  TRACKS.reels.title = '♪ 草原を行け — ギルド楽団';
  Object.values(TRACKS).forEach((d) => Object.assign(d, buildTune(d)));
  A.trackTitle = (name) => (TRACKS[name] ? TRACKS[name].title : '');

  class Track {
    constructor(name, at) {
      this.name = name;
      this.def = TRACKS[name];
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.out.connect(musicGain);
      this.pass = 0;
      this.idx = 0;
      this.alive = true;
      this.mix = this.def.arrange(0, A.night);
      this.spe = this.secPerEighth();
      this.loopStart = at && at > ctx.currentTime ? at : ctx.currentTime + 0.12;
      this.startDrone();
    }
    secPerEighth() {
      const d = this.def;
      const tempo = this.mix.tempo || 1;
      // 6/8 は付点四分基準、4/4 は8分基準
      return d.meter === 6 ? 60 / (d.bpm * tempo * 3) : 60 / (d.bpm * tempo);
    }
    startDrone() {
      const [a, b] = this.def.drone;
      this.droneG = ctx.createGain();
      this.droneG.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 430;
      lp.Q.value = 1.2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 120;
      lfo.connect(lfoG).connect(lp.frequency);
      this.droneOsc = [a, b, a + 12].map((m, i) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m) * (i === 2 ? 1.003 : 1);
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(this.droneG).connect(this.out);
      lfo.start();
      this.droneOsc.push(lfo);
      this.droneG.gain.setTargetAtTime(this.mix.drone, ctx.currentTime, 1.2);
    }
    fadeIn(sec) {
      const t = ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(1, t + sec);
    }
    fadeOut(sec) {
      const t = ctx.currentTime;
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(this.out.gain.value, t);
      this.out.gain.linearRampToValueAtTime(0, t + sec);
      setTimeout(() => this.dispose(), sec * 1000 + 600);
      this.fading = true;
    }
    dispose() {
      this.alive = false;
      try { this.droneOsc.forEach((o) => o.stop()); } catch (e) { /* already */ }
      try { this.out.disconnect(); } catch (e) { /* noop */ }
    }
    // タブ復帰時：止まっていた間の音を一斉に鳴らさないよう、次の小節から再開
    resync() {
      const bar = this.def.bar;
      const t = ctx.currentTime;
      if (this.loopStart + this.def.events[Math.min(this.idx, this.def.events.length - 1)].t * this.spe < t) {
        // 現在位置を次の小節頭に合わせる
        const pos = (t - this.loopStart) / this.spe;
        let nextBar = Math.ceil(pos / bar) * bar;
        if (nextBar >= this.def.len) {
          this.loopStart += this.def.len * this.spe;
          nextBar = 0;
          this.pass++;
        }
        this.idx = this.def.events.findIndex((e) => e.t >= nextBar);
        if (this.idx < 0) this.idx = 0;
        this.loopStart = t + 0.1 - nextBar * this.spe;
      }
    }
    schedule(until) {
      const d = this.def;
      if (this.ended) return;
      let guard = 0;
      while (guard++ < 200) {
        if (this.idx >= d.events.length) {
          // 昼のギルドは2曲を交互に（曲の切れ目で、きれいに入れ替える）
          if (d.rotate && this.pass + 1 >= d.rotate && current === this && !this.fading && !A.night) {
            homeDay = this.name === 'guild' ? 'guild2' : 'guild';
            A.playTrack(homeDay, { cut: true, fade: 2.6, fadeIn: 0.25, at: this.loopStart + d.len * this.spe });
            return;
          }
          this.loopStart += d.len * this.spe;
          this.idx = 0;
          this.pass++;
          this.mix = d.arrange(this.pass, A.night);
          this.spe = this.secPerEighth();
          this.droneG.gain.setTargetAtTime(this.mix.drone, this.loopStart, 1.5);
        }
        const ev = d.events[this.idx];
        const t = this.loopStart + ev.t * this.spe;
        if (t > until) break;
        this.idx++;
        if (t < ctx.currentTime - 0.02) continue;
        this.play(ev, t);
      }
    }
    play(ev, t) {
      const mx = this.mix;
      const hum = (Math.random() - 0.5) * 0.012;
      const vel = 0.9 + Math.random() * 0.2;
      if (ev.i === 'mel') {
        const dur = ev.d * this.spe;
        if (mx.mel > 0) {
          if (mx.lead === 'fid') fiddle(t + hum, ev.m, dur, mx.mel * ev.acc * vel, this.out);
          else whistle(t + hum, ev.m, dur, mx.mel * ev.acc * vel, this.out);
        }
        // フィドルは繰り返しの2回目だけ1オクターブ下で重なる（ボス戦はずっと）
        if (mx.fid > 0 && (ev.rep === 1 || mx.fidAll)) fiddle(t + hum, ev.m - 12, dur, mx.fid * vel, this.out);
      } else if (ev.i === 'harp') {
        if (mx.harp > 0) harp(t + hum * 0.5, ev.m, mx.harp * ev.acc * vel, this.out);
      } else if (ev.i === 'drum') {
        if (mx.drum > 0 && !(ev.ghost && Math.random() < 0.35)) bodhran(t, ev.acc, mx.drum * vel, this.out);
      }
    }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    if (current && current.alive) current.schedule(ctx.currentTime + 0.25);
    if (A._old && A._old.alive) A._old.schedule(ctx.currentTime + 0.25);
    // 暖炉のパチパチ
    if (ambientLevel > 0 && Math.random() < 0.09 * ambientLevel) crackle();
  }

  // opt: true=起動直後 / 数値=切り替えの秒数 / {fade, fadeIn, at, cut}
  A.playTrack = function (name, opt) {
    if (!TRACKS[name]) name = 'guild';
    const o = typeof opt === 'object' && opt ? opt : { first: opt === true, fade: typeof opt === 'number' ? opt : 0 };
    wantTrack = name;
    if (!ctx) return;
    if (current && current.name === name && !current.fading) return;
    if (current) {
      if (A._old) A._old.dispose();
      A._old = current;
      if (o.cut) current.ended = true;
      current.fadeOut(o.first ? 0.1 : o.fade || 1.1);
    }
    current = new Track(name, o.at);
    current.fadeIn(o.first ? 2.4 : o.fadeIn || (o.fade ? Math.max(0.45, o.fade * 0.9) : 1.4));
  };
  A.track = () => (current ? current.name : wantTrack);

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
  const rr = (a, b) => a + Math.random() * (b - a);
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
    if (!ctx || ctx.state !== 'running') return;
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
    }
  };
})();
