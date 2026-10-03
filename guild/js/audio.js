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

  A.setNight = function (n) { A.night = n; };

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
  // ABC 記法のごく一部を読む。調号はニ長調（F#, C#）。
  function parseABC(str) {
    const out = [];
    const re = /(=|\^|_)?([A-Ga-gz])([,']*)(\d*)/g;
    const base = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
    const sig = { F: 1, C: 1 };
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

  function buildTune(def) {
    const A1 = parseABC(def.A), B1 = parseABC(def.B);
    const events = [];
    const bar = def.bar; // 1小節の8分音符数
    const half = bar / 2;
    let off = 0;
    const parts = [
      [A1, def.chA, 0],
      [A1, def.chA, 1],
      [B1, def.chB, 0],
      [B1, def.chB, 1],
    ];
    parts.forEach(([p, ch, rep], pi) => {
      p.notes.forEach((n) => {
        const beatAcc = n.t % (def.meter === 6 ? 3 : 4) === 0 ? 1 : 0.82;
        events.push({ t: off + n.t, d: n.d, m: n.m, i: 'mel', acc: beatAcc, part: pi, rep });
      });
      ch.forEach((name, k) => {
        const c = chordNotes(name);
        const t0 = off + k * half;
        const pat = def.meter === 6 ? [c.root, c.fifth, c.third] : [c.root, c.fifth, c.oct, c.third];
        pat.forEach((m, j) => events.push({ t: t0 + j, m, i: 'harp', acc: j === 0 ? 1 : 0.72, part: pi }));
      });
      const bars = p.len / bar;
      for (let b = 0; b < bars; b++) {
        for (let e = 0; e < bar; e++) {
          const t = off + b * bar + e;
          if (def.meter === 6) {
            if (e === 0) events.push({ t, i: 'drum', acc: 1 });
            else if (e === 3) events.push({ t, i: 'drum', acc: 0.7 });
            else if (e === 5 || e === 2) events.push({ t, i: 'drum', acc: 0.32, ghost: true });
          } else {
            if (e % 2 === 0) events.push({ t, i: 'drum', acc: e === 0 ? 1 : e === 4 ? 0.8 : 0.5 });
            else events.push({ t, i: 'drum', acc: 0.25, ghost: true });
          }
        }
      }
      off += p.len;
    });
    events.sort((a, b) => a.t - b.t);
    return { events, len: off };
  }

  const TRACKS = {
    guild: {
      A: JIG_A, B: JIG_B, chA: JIG_CH_A, chB: JIG_CH_B, bar: 6, meter: 6,
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
  Object.values(TRACKS).forEach((d) => Object.assign(d, buildTune(d)));

  class Track {
    constructor(name) {
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
      this.loopStart = ctx.currentTime + 0.12;
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
      let guard = 0;
      while (guard++ < 200) {
        if (this.idx >= d.events.length) {
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
        if (mx.mel > 0) whistle(t + hum, ev.m, dur, mx.mel * ev.acc * vel, this.out);
        // フィドルは繰り返しの2回目だけ1オクターブ下で重なる
        if (mx.fid > 0 && ev.rep === 1) fiddle(t + hum, ev.m - 12, dur, mx.fid * vel, this.out);
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

  A.playTrack = function (name, first) {
    wantTrack = name;
    if (!ctx) return;
    if (current && current.name === name && !current.fading) return;
    if (current) {
      if (A._old) A._old.dispose();
      A._old = current;
      current.fadeOut(first ? 0.1 : 1.1);
    }
    current = new Track(name);
    current.fadeIn(first ? 2.4 : 1.4);
  };

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
    }
  };
})();
