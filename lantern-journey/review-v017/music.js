/* 灯の旅路 · v05 original Celtic town, battle, boss and victory scores.
 * All voices are locally synthesized; no external samples or copied melodies.
 * First enable()/toggle() must originate inside a pointer/key gesture.
 */
(() => {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const SCENES = ['town', 'battle', 'boss', 'result'];
  const TEMPO = { town:72, battle:120, boss:138, result:86 };
  const LOOKAHEAD = 0.16, BAR_STEPS = 6;
  // Phrase events: [eighth-note position, MIDI pitch, length in eighth notes].
  // D Dorian: D E F G A B C. Breathing rests and long arrivals are intentional.
  const THEME = [
    [[0,74,2],[2,77,1],[3,79,1],[4,81,1.7]],
    [[0,79,1],[1,77,1],[2,76,1],[3,74,2.3]],
    [[0,79,2],[2,81,1],[3,83,2],[5,81,.7]],
    [[0,79,1],[1,77,1],[2,76,1],[3,74,2.3]],
    [[0,77,3],[3,81,1],[4,79,1],[5,77,.8]],
    [[0,76,2],[2,79,1],[3,81,1],[4,79,1.4]],
    [[0,83,2],[2,81,1],[3,79,1],[4,76,1.5]],
    [[0,77,1],[1,76,1],[2,74,3.2]],
    [[0,81,2],[2,79,1],[3,76,2],[5,77,.8]],
    [[0,79,1],[1,77,1],[2,76,1],[3,74,2.2]],
    [[0,79,2],[2,83,1],[3,81,1],[4,79,1.5]],
    [[0,76,1],[1,79,1],[2,81,1],[3,84,1],[4,81,1.6]],
    [[0,81,2],[2,77,1],[3,79,1],[4,81,1.5]],
    [[0,83,2],[2,81,1],[3,79,2.2]],
    [[0,76,1],[1,77,1],[2,79,1],[3,76,2.1]],
    [[0,77,1],[1,76,1],[2,74,3.3]]
  ];
  const CHORDS = [
    [50,62,65,69], [48,60,64,67], [43,59,62,67], [50,62,65,69],
    [41,57,60,65], [48,60,64,67], [43,59,62,67], [50,62,65,69],
    [45,57,60,64], [50,62,65,69], [43,59,62,67], [48,60,64,67],
    [41,57,60,65], [43,59,62,67], [48,60,64,67], [50,62,65,69]
  ];
  const SCORE = Array.from({ length: 64 }, (_, bar) => {
    const section = Math.floor(bar / 16), source = THEME[bar % 16];
    return source.map(([slot, pitch, length], i) => {
      // The second phrase answers lower; the third lifts; the last comes home.
      let note = section === 1 && i === 0 && bar % 4 === 0 ? pitch - 12 : pitch;
      if (section === 2 && i === 0 && bar % 4 === 0) note = Math.min(84, pitch + 7);
      if (section === 3 && bar % 4 === 3 && i === source.length - 1) length += .25;
      return [slot, note, Math.min(length, 5.8 - slot)];
    });
  });
  const BATTLE = [
    [[0,74,.8],[1,77,.8],[2,81,.8],[3,79,.8],[4,77,.8],[5,76,.75]],
    [[0,74,1.7],[2,81,.7],[3,83,.7],[4,81,.7],[5,79,.7]],
    [[0,77,.7],[1,79,.7],[2,81,.7],[3,84,1.6],[5,81,.7]],
    [[0,79,.8],[1,77,.8],[2,76,.8],[3,74,2.5]],
    [[0,81,.7],[1,83,.7],[2,84,.7],[3,81,.7],[4,79,.7],[5,77,.7]],
    [[0,79,1.7],[2,77,.7],[3,76,.7],[4,74,1.7]],
    [[0,76,.7],[1,79,.7],[2,83,.7],[3,81,.7],[4,79,.7],[5,76,.7]],
    [[0,77,.8],[1,76,.8],[2,74,1.7],[4,69,.8],[5,72,.8]]
  ];
  const BOSS = [
    [[0,62,.8],[1,69,.8],[2,74,.8],[3,77,1.7],[5,76,.75]],
    [[0,74,1.7],[2,72,.75],[3,69,.8],[4,65,1.75]],
    [[0,67,.8],[1,74,.8],[2,79,.8],[3,83,1.7],[5,81,.75]],
    [[0,79,.8],[1,77,.8],[2,74,.8],[3,72,.8],[4,69,1.7]],
    [[0,65,.8],[1,72,.8],[2,77,.8],[3,81,.8],[4,84,1.7]],
    [[0,83,.8],[1,81,.8],[2,79,.8],[3,77,.8],[4,76,1.7]],
    [[0,69,.8],[1,72,.8],[2,76,.8],[3,79,.8],[4,83,1.7]],
    [[0,81,.8],[1,79,.8],[2,77,.8],[3,76,.8],[4,74,1.7]]
  ];
  const VICTORY = [
    [[0,81,1.7],[2,84,.8],[3,86,2.7]],
    [[0,84,1.7],[2,81,.8],[3,79,1.7],[5,81,.75]],
    [[0,83,1.7],[2,86,.8],[3,84,1.7],[5,83,.75]],
    [[0,81,.8],[1,79,.8],[2,77,.8],[3,79,2.5]],
    [[0,77,1.7],[2,81,.8],[3,84,2.5]],
    [[0,83,.8],[1,81,.8],[2,79,.8],[3,81,2.5]],
    [[0,79,1.7],[2,77,.8],[3,76,.8],[4,74,1.7]],
    [[0,77,.8],[1,79,.8],[2,81,.8],[3,74,2.7]]
  ];
  const PROGRESSIONS = {
    town:CHORDS,
    battle:[CHORDS[0],CHORDS[1],CHORDS[4],CHORDS[2],CHORDS[0],CHORDS[4],CHORDS[6],CHORDS[0]],
    boss:[CHORDS[0],CHORDS[0],CHORDS[2],CHORDS[1],CHORDS[4],CHORDS[2],CHORDS[8],CHORDS[0]],
    result:[CHORDS[4],CHORDS[1],CHORDS[2],CHORDS[1],CHORDS[4],CHORDS[2],CHORDS[1],CHORDS[0]]
  };
  let ctx, master, musicBus, effectsBus, room, waves, noise;
  let enabled = false, muted = true, paused = false, scene = 'town';
  let intensity=0,intensityTarget=0,color='forest';const toneColors={forest:0,stone:-5,tide:5,trial:2};
  let interval = null, silenceTimer = null;
  let epoch = 0, enabling = null, suspending = Promise.resolve();
  const mix = { master: .84, music: .9, effects: .86 };
  const channels = {}, clocks = {}, fades = new WeakMap(), voices = new Set(), lastCue = new Map();
  const hidden = () => !!root.document?.hidden;
  const playable = () => ctx && ctx.state === 'running' && enabled && !muted && !paused && !hidden();
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);

  function gainAt(param, time) {
    const fade = fades.get(param);
    if (!fade) return param.value;
    const fraction = Math.min(1, Math.max(0, (time - fade.time) / Math.max(.001, fade.duration)));
    return fade.from + (fade.to - fade.from) * fraction;
  }
  function ramp(param, target, seconds) {
    const time = ctx.currentTime, from = gainAt(param, time);
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(time);
    else { param.cancelScheduledValues(time); param.setValueAtTime(from, time); }
    param.linearRampToValueAtTime(target, time + seconds);
    fades.set(param, { from, to: target, time, duration: seconds });
  }
  function prune() {
    for (const voice of voices) if (voice.end < ctx.currentTime - .02) voices.delete(voice);
  }
  function keep(source, end, nodes, auxiliary = []) {
    const group = { source, end, auxiliary };
    voices.add(group);
    source.onended = () => {
      voices.delete(group);
      for (const oscillator of auxiliary) { try { oscillator.stop(); } catch (_) {} }
      for (const node of nodes) { try { node.disconnect(); } catch (_) {} }
    };
  }
  function envelope(gain, time, length, volume, instrument) {
    gain.setValueAtTime(.0001, time);
    const attack = instrument === 'harp' ? .008 : instrument === 'flute' ? .045 : instrument === 'fiddle' ? .055 : .22;
    gain.linearRampToValueAtTime(volume, time + Math.min(attack, length * .2));
    if (instrument === 'harp') {
      gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .24), time + length * .4);
      gain.exponentialRampToValueAtTime(.0001, time + length);
    } else {
      gain.linearRampToValueAtTime(volume * .84, time + length * .68);
      gain.linearRampToValueAtTime(.0001, time + length);
    }
  }
  function note(midi, time, length, volume, instrument, bus, pan = 0) {
    if(bus===channels.battle||bus===channels.boss)midi+=toneColors[color]||0;
    if (!ctx || !midi) return;
    prune(); if (voices.size >= 100) return;
    const oscillator = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    oscillator.setPeriodicWave(waves[instrument]);
    oscillator.frequency.setValueAtTime(hz(midi), time);
    filter.type = 'lowpass'; filter.Q.value = .45;
    filter.frequency.setValueAtTime(instrument === 'harp' ? 4200 : instrument === 'drone' ? 1000 : instrument === 'fiddle' ? 4700 : 3400, time);
    if (instrument === 'harp') filter.frequency.exponentialRampToValueAtTime(1400, time + Math.min(.4, length));
    envelope(gain.gain, time, length, volume, instrument);
    oscillator.connect(filter); filter.connect(gain);
    const nodes = [oscillator, filter, gain], auxiliary = [];
    if (instrument === 'fiddle') {
      const second = ctx.createOscillator(); second.setPeriodicWave(waves.fiddle);
      oscillator.detune.setValueAtTime(-3.5,time); second.detune.setValueAtTime(3.5,time);
      second.frequency.setValueAtTime(hz(midi),time); second.connect(filter);
      // Two softly beating bowed voices add body; each is halved to preserve headroom.
      gain.gain.cancelScheduledValues(time); envelope(gain.gain,time,length,volume*.5,instrument);
      second.start(time);second.stop(time+length+.025);nodes.push(second);auxiliary.push(second);
    }
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner(); panner.pan.value = pan;
      gain.connect(panner); panner.connect(bus); nodes.push(panner);
    } else gain.connect(bus);
    if ((instrument === 'flute' || instrument === 'fiddle') && length > .24) {
      const vibrato = ctx.createOscillator(), depth = ctx.createGain();
      vibrato.frequency.value = instrument === 'fiddle' ? 5.15 : 4.3;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(instrument === 'fiddle' ? 5.5 : 3.2, time + Math.min(.35, length * .5));
      vibrato.connect(depth); depth.connect(oscillator.detune);
      if (instrument === 'fiddle') depth.connect(auxiliary[0].detune);
      vibrato.start(time); vibrato.stop(time + length + .02);
      nodes.push(vibrato, depth); auxiliary.push(vibrato);
    }
    keep(oscillator, time + length + .025, nodes, auxiliary);
    oscillator.start(time); oscillator.stop(time + length + .025);
  }
  function air(time, length, volume, bus) {
    prune(); if (voices.size >= 90) return;
    const source = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; source.loop = true;
    band.type = 'bandpass'; band.frequency.value = 1800; band.Q.value = .7;
    envelope(gain.gain, time, length, volume, 'flute');
    source.connect(band); band.connect(gain); gain.connect(bus);
    keep(source, time + length + .02, [source, band, gain]);
    source.start(time); source.stop(time + length + .02);
  }
  function softDrum(time, volume, bus) {
    const oscillator = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(95, time);
    oscillator.frequency.exponentialRampToValueAtTime(58, time + .16);
    filter.type = 'lowpass'; filter.frequency.value = 400;
    gain.gain.setValueAtTime(.0001, time); gain.gain.linearRampToValueAtTime(volume, time + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .24);
    oscillator.connect(filter); filter.connect(gain); gain.connect(bus);
    keep(oscillator, time + .27, [oscillator, filter, gain]);
    oscillator.start(time); oscillator.stop(time + .27);
  }
  function makeWave(harmonics) {
    const real = new Float32Array(harmonics.length + 1), imaginary = new Float32Array(harmonics.length + 1);
    harmonics.forEach((strength, i) => { imaginary[i + 1] = strength; });
    return ctx.createPeriodicWave(real, imaginary);
  }
  function graph() {
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0;
    musicBus = ctx.createGain(); musicBus.gain.value = mix.music;
    effectsBus = ctx.createGain(); effectsBus.gain.value = mix.effects;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.knee.value = 8; limiter.ratio.value = 8;
    limiter.attack.value = .004; limiter.release.value = .18;
    const safety = ctx.createWaveShaper(), curve = new Float32Array(2048);
    for(let i=0;i<curve.length;i++)curve[i]=.97*Math.tanh(1.1*(i/(curve.length-1)*2-1));
    safety.curve=curve;safety.oversample='2x';
    musicBus.connect(master); effectsBus.connect(master); master.connect(limiter);limiter.connect(safety);safety.connect(ctx.destination);
    for (const name of SCENES) {
      channels[name] = ctx.createGain(); channels[name].gain.value = name === scene ? 1 : 0;
      channels[name].connect(musicBus);
      clocks[name]={step:0,next:0};
    }
    waves = {
      flute: makeWave([1,.16,.09,.035,.012,.005]),
      fiddle: makeWave([1,.53,.3,.2,.14,.11,.08,.06,.038,.026,.015]),
      harp: makeWave([1,.48,.21,.12,.072,.045,.022]),
      drone: makeWave([1,.28,.14,.065,.023])
    };
    room = ctx.createConvolver(); const roomFilter = ctx.createBiquadFilter(), wet = ctx.createGain();
    roomFilter.type = 'lowpass'; roomFilter.frequency.value = 2600; wet.gain.value = .15;
    const length = Math.floor(ctx.sampleRate * 1.05), impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    let seed = 23017;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = random() * Math.pow(1 - i / length, 3.5) * .2;
    }
    room.buffer = impulse; musicBus.connect(room); room.connect(roomFilter); roomFilter.connect(wet); wet.connect(master);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .21), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = random();
    ctx.onstatechange = () => { if (ctx.state === 'running') { if (playable()) start(); } else stopNow(); };
    return true;
  }
  function percussion(time,kind,volume,bus) {
    if(kind==='kick') {softDrum(time,volume,bus);return;}
    noiseBurst(time,kind==='snare'?.14:.045,volume,kind==='snare'?1500:5200,kind==='snare'?1800:2200,bus);
  }
  function noiseBurst(time,length,volume,frequency,width,bus,sweepTo=frequency) {
    prune(); if(voices.size>=100)return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noise;source.loop=true;filter.type='bandpass';filter.Q.value=Math.max(.3,frequency/width);
    filter.frequency.setValueAtTime(frequency,time);
    if(sweepTo!==frequency)filter.frequency.exponentialRampToValueAtTime(sweepTo,time+length);
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(volume,time+.003);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    source.connect(filter);filter.connect(gain);gain.connect(bus);
    keep(source,time+length+.02,[source,filter,gain]);source.start(time);source.stop(time+length+.02);
  }
  function glide(time,startHz,endHz,length,volume,type='sine') {
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=type;
    oscillator.frequency.setValueAtTime(startHz,time);oscillator.frequency.exponentialRampToValueAtTime(endHz,time+length);
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(volume,time+.007);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    oscillator.connect(gain);gain.connect(effectsBus);keep(oscillator,time+length+.02,[oscillator,gain]);
    oscillator.start(time);oscillator.stop(time+length+.02);
  }
  function melodyFor(name,bar) {
    if(name==='town')return SCORE[bar%64];
    const source=(name==='battle'?BATTLE:name==='boss'?BOSS:VICTORY)[bar%8];
    const variation=Math.floor((bar%32)/8);
    return source.map(([slot,pitch,length],i)=>[slot,
      variation===1&&i===source.length-1?pitch+(name==='boss'?-12:0):
      variation===2&&i===0?Math.min(86,pitch+12):pitch,length]);
  }
  function schedule(time,index,name) {
    const slot=index%BAR_STEPS,bar=Math.floor(index/BAR_STEPS),bus=channels[name],eighth=60/(TEMPO[name]*3);
    const progression=PROGRESSIONS[name],chord=progression[bar%progression.length];
    const tense=name==='boss',fighting=name==='battle'||tense,winning=name==='result';
    for(const [position,pitch,duration] of melodyFor(name,bar))if(position===slot){
      const length=duration*eighth;
      if(name==='town'){
        note(pitch,time,length,.153,'flute',bus,-.1);air(time,length,.0044,bus);
        if(bar%4===3&&slot===0)note(pitch-12,time+.04,length*.92,.045,'fiddle',bus,.19);
      }else if(fighting){
        note(pitch-(tense?12:0),time,length,.165,'fiddle',bus,-.14);
        if(bar%4>=2||tense)note(pitch,time+.018,length*.9,.074,'flute',bus,.15);
        if(tense&&slot===0)note(pitch-12,time+.025,length*.93,.078,'fiddle',bus,.25);
      }else{
        note(pitch,time,length,.145,'flute',bus,-.15);air(time,length,.003,bus);
        if(slot===0)note(pitch-12,time+.025,length*.92,.09,'fiddle',bus,.22);
      }
    }
    const harpSlots=fighting?[0,1,2,3,4,5]:winning?[0,1,3,4,5]:[0,2,3,5];
    if(harpSlots.includes(slot)){
      const pitch=chord[[1,2,3,1,2,3][slot]];
      note(pitch+(winning&&slot%2?12:0),time,eighth*(fighting?1.6:2.65),fighting?.058:winning?.061:.065,'harp',bus,.27);
    }
    if(slot===0||slot===3){
      note(chord[0]-(chord[0]>=48?12:0),time,eighth*2.8,fighting?.087:winning?.072:.064,'drone',bus,0);
      if(fighting){percussion(time,'kick',(tense?.18:.145)+intensity*.065,bus);note(chord[0]-12,time,eighth*1.4,.045+intensity*.045,'fiddle',bus,0);}
    }
    if(fighting){
      if(slot===2||slot===5)percussion(time,'snare',(tense?.09:.065)+intensity*.025,bus);if(intensity>.55&&slot%2===1)percussion(time,'kick',.09,bus);if(intensity>.35&&slot===0)for(const pitch of chord.slice(1))note(pitch-12,time,eighth*2.5,.035+intensity*.035,'fiddle',bus,-.2);
      if(slot%2===1)percussion(time,'brush',tense?.027:.018,bus);
      if(tense&&slot===4&&bar%2===1)percussion(time,'kick',.092,bus);
      if(slot===0&&bar%4===0)for(const offset of [0,2,4])note(chord[1+offset/2],time+offset*.012,eighth*5.3,tense?.041:.027,'fiddle',bus,offset===0?-.2:.2);
    }else if(winning){
      if(slot===0||slot===3)percussion(time,'kick',.059,bus);
      if(slot===0&&bar%2===0)for(const pitch of chord.slice(1))note(pitch,time,eighth*5.6,.038,'fiddle',bus,.18);
    }else if(slot===0&&bar%4===0){
      note(38,time,eighth*23.8,.027,'drone',bus,-.12);note(45,time+.03,eighth*23.6,.015,'drone',bus,.12);
    }
    return eighth;
  }
  function tick() {
    if(!playable())return;intensity+=(intensityTarget-intensity)*.08;
    for(const name of SCENES){
      const fade=fades.get(channels[name].gain),active=name===scene||gainAt(channels[name].gain,ctx.currentTime)>.001||(fade?.to>0);
      if(!active)continue;
      const lane=clocks[name];
      if(lane.next<ctx.currentTime-.1)lane.next=ctx.currentTime+.03;
      let guard=0;
      while(lane.next<ctx.currentTime+LOOKAHEAD&&guard++<5){
        lane.next+=schedule(lane.next,lane.step,name);lane.step=(lane.step+1)%(name==='town'?384:192);
      }
    }
  }
  function stopClock() { if (interval !== null) { root.clearInterval(interval); interval = null; } }
  function cancelSilence() { if (silenceTimer !== null) { root.clearTimeout(silenceTimer); silenceTimer = null; } }
  function stopNow() {
    stopClock(); cancelSilence();
    for (const group of [...voices]) {
      for (const source of [group.source, ...group.auxiliary]) { try { source.stop(); } catch (_) {} }
    }
    voices.clear();
  }
  function start() {
    if (interval !== null || !playable()) return;
    for(const name of SCENES)clocks[name].next=ctx.currentTime+.045;
    tick(); interval = root.setInterval(tick, 25);
  }
  async function enable() {
    if (enabling?.epoch === epoch) return enabling.promise;
    const version = epoch;
    const promise = (async () => {
      try {
        if (!ctx && !graph()) return false;
        await suspending;
        if (ctx.state !== 'running') await ctx.resume();
        if (version !== epoch || hidden()) return false;
        cancelSilence(); enabled = true; muted = false;
        ramp(master.gain, mix.master, 1.2); if (playable()) start();
        return true;
      } catch (_) { if (version === epoch) muted = true; return false; }
    })();
    enabling = { epoch: version, promise };
    try { return await promise; } finally { if (enabling?.promise === promise) enabling = null; }
  }
  async function toggle() {
    if (!enabled || muted) { await enable(); return muted; }
    epoch++; muted = true; stopClock(); cancelSilence();
    ramp(master.gain, 0, .5);
    const version = epoch;
    silenceTimer = root.setTimeout(() => {
      silenceTimer = null;
      if (version === epoch && muted) {
        stopNow(); if (ctx.state === 'running') suspending = ctx.suspend().catch(() => {});
      }
    }, 550);
    return true;
  }
  function setScene(value) {
    const alias={expedition:'battle',combat:'battle',victory:'result',camp:'town'};
    value=alias[value]||value;
    if(!SCENES.includes(value))return false;
    if(value===scene)return true;
    scene=value;
    if(ctx){clocks[value].step=0;clocks[value].next=ctx.currentTime+.035;
      for(const name of SCENES)ramp(channels[name].gain,name===value?1:0,1.05);
    }
    return true;
  }
  function setIntensity(value){if(!Number.isFinite(value))return false;intensityTarget=Math.min(1,Math.max(0,value));return true;}
  function setColor(value){if(!Object.hasOwn(toneColors,value))return false;color=value;return true;}
  function setVolume(value, channel = 'master') {
    if (!Number.isFinite(value) || !Object.hasOwn(mix, channel)) return false;
    mix[channel] = Math.max(0, Math.min(1, value));
    if (ctx) {
      const bus = channel === 'master' ? master : channel === 'music' ? musicBus : effectsBus;
      ramp(bus.gain, channel === 'master' && muted ? 0 : mix[channel], .25);
    }
    return true;
  }
  function sfx(name) {
    if(!playable())return false;
    const aliases={upgrade:'complete',fever:'complete',collect:'coin',attack:'slash',hit:'slash',spell:'spark',magic:'spark',defend:'guard',critical:'crit',win:'reward',victory:'reward',lose:'defeat',success:'complete',bow:'arrow'};
    const cue=aliases[name]||name;
    const throttle={ultimate:1.4,awaken:1.5,step:.16,coin:.28,complete:1.3,reward:.65,slash:.12,spark:.18,guard:.18,crit:.22,defeat:1.3,confirm:.09,cancel:.13,error:.24,arrow:.12,heal:.24,barrier:.24,break:.2,combo:.25}[cue];
    if(throttle===undefined)return false;
    const now=ctx.currentTime;if(now-(lastCue.get(cue)??-Infinity)<throttle)return false;lastCue.set(cue,now);
    const phrase=(notes,spacing,length,volume)=>notes.forEach((pitch,i)=>note(pitch,now+i*spacing,length,volume,'harp',effectsBus,i%2?.11:-.11));
    const blade=(critical=false)=>{
      noiseBurst(now,.095,critical?.29:.215,4200,3600,effectsBus,950);
      noiseBurst(now+.033,.065,critical?.32:.24,1300,1800,effectsBus,650);
      glide(now+.022,critical?170:135,critical?38:48,critical?.23:.17,critical?.27:.185);
      glide(now+.04,1130,840,.15,critical?.085:.057);
      glide(now+.047,1780,1370,.09,critical?.062:.032);
      if(critical){noiseBurst(now+.11,.17,.15,2400,2600,effectsBus,550);note(74,now+.055,.29,.07,'harp',effectsBus);}
    };
    switch(cue){
      case 'ultimate':
        noiseBurst(now,.45,.22,600,900,effectsBus,4200);glide(now,120,880,.48,.12);phrase([62,69,74,81],.11,.7,.095);
        noiseBurst(now+.62,.28,.31,3200,3400,effectsBus,320);glide(now+.62,180,35,.48,.32);softDrum(now+.65,.28,effectsBus);
        for(const [i,pitch]of [74,77,81,86].entries())note(pitch,now+.66+i*.06,.8,.105,'fiddle',effectsBus,i%2?.2:-.2);break;
      case 'awaken':glide(now,85,290,.55,.12);noiseBurst(now,.42,.14,950,1300,effectsBus,2800);softDrum(now+.22,.21,effectsBus);break;
      case 'step':noiseBurst(now,.045,.024,360,400,effectsBus,230);break;
      case 'coin':phrase([81,86],.046,.27,.071);break;
      case 'confirm':phrase([69,74],.052,.28,.085);break;
      case 'cancel':phrase([67,62],.062,.28,.065);break;
      case 'error':glide(now,190,140,.16,.065);phrase([62,60],.1,.24,.061);break;
      case 'slash':blade();break;
      case 'crit':blade(true);break;
      case 'combo':blade(true);glide(now+.16,260,58,.2,.18);noiseBurst(now+.15,.15,.18,3500,3000,effectsBus,800);phrase([74,81],.085,.32,.079);break;
      case 'arrow':
        noiseBurst(now,.09,.16,5600,3100,effectsBus,1650);glide(now,1250,540,.09,.058);
        glide(now+.07,240,90,.11,.12);noiseBurst(now+.075,.075,.13,1000,1900,effectsBus,450);break;
      case 'heal':
        phrase([69,74,77,81],.09,.6,.086);note(74,now+.12,.75,.066,'flute',effectsBus,-.1);note(81,now+.17,.66,.045,'flute',effectsBus,.1);break;
      case 'barrier':
        glide(now,170,480,.32,.076);noiseBurst(now,.25,.09,650,750,effectsBus,1450);
        note(74,now+.03,.6,.07,'flute',effectsBus,-.2);note(81,now+.03,.6,.055,'flute',effectsBus,.2);softDrum(now+.035,.12,effectsBus);break;
      case 'break':
        noiseBurst(now,.21,.24,2350,3000,effectsBus,300);glide(now,210,38,.25,.24);
        glide(now+.025,1460,360,.21,.078);noiseBurst(now+.1,.12,.15,3700,3200,effectsBus,950);break;
      case 'spark':
        glide(now,280,1350,.19,.12);noiseBurst(now,.22,.13,550,1100,effectsBus,4200);
        phrase([74,81,86],.05,.38,.093);
        glide(now+.17,185,64,.15,.165);noiseBurst(now+.19,.15,.15,2400,2100,effectsBus,1400);break;
      case 'guard':
        glide(now,920,540,.28,.095);glide(now+.009,1370,830,.23,.055);
        softDrum(now,.19,effectsBus);noiseBurst(now,.1,.18,900,1500,effectsBus,420);
        phrase([62,69],.075,.3,.082);break;
      case 'defeat':
        glide(now,220,55,.55,.13);noiseBurst(now,.4,.08,1200,1200,effectsBus,200);
        for(const [i,pitch] of [69,65,62,57].entries())note(pitch,now+i*.15,.7,.075,'fiddle',effectsBus,0);break;
      case 'reward':
        phrase([69,74,77,81,86],.085,.65,.109);softDrum(now+.33,.075,effectsBus);
        note(62,now+.2,.8,.06,'fiddle',effectsBus,-.15);note(69,now+.2,.8,.054,'fiddle',effectsBus,.15);break;
      case 'complete':
        phrase([62,69,74,77,81,86],.09,.78,.115);
        for(const pitch of [62,65,69])note(pitch,now+.28,1.05,.066,'fiddle',effectsBus,.12);break;
    }
    return true;
  }
  function pause() {
    epoch++; paused = true; stopNow();
    if (ctx?.state === 'running') suspending = ctx.suspend().catch(() => {});
    return suspending;
  }
  async function resume() {
    paused = false;
    if (!enabled || muted || hidden()) return false;
    return enable();
  }
  root.document?.addEventListener('visibilitychange', () => {
    if (hidden()) {
      epoch++; stopNow();
      if (ctx?.state === 'running') suspending = ctx.suspend().catch(() => {});
    } else if (enabled && !muted && !paused) enable();
  });
  root.HearthAudio = Object.freeze({ enable, toggle, pause, resume, setScene, sfx, setVolume, setIntensity, setColor,
    get isMuted() { return muted; }, get scene() { return scene; }
  });
})();
