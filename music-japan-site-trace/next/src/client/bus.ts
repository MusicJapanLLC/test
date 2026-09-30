/**
 * The sound bus. The release player feeds its <audio> element through one AnalyserNode;
 * everything that "listens" (the WebGL world, the header EQ, the CSS variable --level)
 * reads the smoothed values from here once per frame.
 */
type Bus = {
  playing: boolean;
  level: number;
  bass: number;
  mid: number;
  high: number;
  /** 0..1 spikes on bass onsets, decays quickly */
  kick: number;
  spectrum: Uint8Array;
  accent: string;
  title: string;
};

export const bus: Bus = {
  playing: false,
  level: 0,
  bass: 0,
  mid: 0,
  high: 0,
  kick: 0,
  spectrum: new Uint8Array(128),
  accent: '#e1222f',
  title: '',
};

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let prevBass = 0;

/** Must be called from a user gesture (play button) so Safari lets the context start. */
export async function connect(audio: HTMLMediaElement) {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      analyser.connect(ctx.destination);
      bus.spectrum = new Uint8Array(analyser.frequencyBinCount);
    }
    if (!sources.has(audio) && analyser) {
      const src = ctx.createMediaElementSource(audio);
      src.connect(analyser);
      sources.set(audio, src);
    }
    if (ctx.state === 'suspended') await ctx.resume();
  } catch {
    // Without Web Audio the preview still plays; the site simply does not react.
  }
}

const avg = (a: Uint8Array, from: number, to: number) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return s / Math.max(1, to - from) / 255;
};

export function sample(dt: number) {
  if (analyser && bus.playing) {
    analyser.getByteFrequencyData(bus.spectrum as Uint8Array<ArrayBuffer>);
    const n = bus.spectrum.length;
    const bass = avg(bus.spectrum, 1, Math.floor(n * 0.08));
    const mid = avg(bus.spectrum, Math.floor(n * 0.08), Math.floor(n * 0.4));
    const high = avg(bus.spectrum, Math.floor(n * 0.4), n);
    bus.bass += (bass - bus.bass) * Math.min(1, dt * 18);
    bus.mid += (mid - bus.mid) * Math.min(1, dt * 12);
    bus.high += (high - bus.high) * Math.min(1, dt * 12);
    if (bass - prevBass > 0.06 && bass > 0.45) bus.kick = 1;
    prevBass = bass;
  } else {
    bus.bass *= 1 - Math.min(1, dt * 3);
    bus.mid *= 1 - Math.min(1, dt * 3);
    bus.high *= 1 - Math.min(1, dt * 3);
  }
  bus.kick *= 1 - Math.min(1, dt * 6);
  bus.level = bus.bass * 0.5 + bus.mid * 0.35 + bus.high * 0.15;
  document.documentElement.style.setProperty('--level', bus.level.toFixed(3));
  document.documentElement.style.setProperty('--kick', bus.kick.toFixed(3));
}
