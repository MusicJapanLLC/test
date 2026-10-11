/* Tiny synth sound effects (no audio files). Created on the first user gesture. */
import { state } from './store';

let ac: AudioContext | null = null;
const ctx = () => {
  if (!state.settings.sound) return null;
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
};

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.12, at = 0, slide = 0 } = {}) {
  const a = ctx();
  if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const NOTE = (n: number) => 523.25 * 2 ** (n / 12);

export const sfx = {
  unlock: () => ctx(),
  tick: () => tone(1400, 0.03, { type: 'triangle', vol: 0.03 }),
  flip: () => tone(420, 0.09, { type: 'sine', vol: 0.08, slide: 1.9 }),
  save: () => { tone(880, 0.06, { type: 'square', vol: 0.04 }); tone(1320, 0.1, { type: 'square', vol: 0.04, at: 0.07 }); },
  unsave: () => tone(660, 0.08, { type: 'square', vol: 0.03, slide: 0.6 }),
  right: (combo = 1) => {
    const up = Math.min(combo - 1, 12);
    tone(NOTE(up), 0.09, { type: 'triangle', vol: 0.1 });
    tone(NOTE(up + 4), 0.09, { type: 'triangle', vol: 0.1, at: 0.08 });
    tone(NOTE(up + 7), 0.16, { type: 'triangle', vol: 0.1, at: 0.16 });
  },
  wrong: () => { tone(160, 0.16, { type: 'square', vol: 0.05 }); tone(120, 0.22, { type: 'square', vol: 0.05, at: 0.1 }); },
  tap: () => tone(980, 0.04, { type: 'triangle', vol: 0.05 }),
  goal: () => [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(NOTE(n), 0.14, { type: 'triangle', vol: 0.09, at: i * 0.07 })),
  rare: () => [12, 19, 24, 31].forEach((n, i) => tone(NOTE(n), 0.2, { type: 'sine', vol: 0.06, at: i * 0.06 })),
};
