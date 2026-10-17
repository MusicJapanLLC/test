/* Recorded voice. Every card was recorded ahead of time with a neural voice (see scripts/audio.py) and packed
   into ~45 s MP3 chunks per record. A chunk is fetched and decoded once, then any clip in it plays instantly
   and exactly. The device's own voice is only a fallback for clips that were not recorded yet. */
import type { Card } from './types';
import { canSpeak, hush, speak } from './tts';
import { state } from './store';

type Index = { f: string[]; c: Record<string, [number, number, number]> };

const indexes = new Map<string, Promise<Index | null>>();
const chunks = new Map<string, Promise<AudioBuffer | null>>();
const MAX_CHUNKS = 6;
/** counters for the test page */
export const stats = { decoded: 0, failed: 0, played: 0, fallback: 0 };
(window as unknown as { __mjAudio: typeof stats }).__mjAudio = stats;

let ac: AudioContext | null = null;
let src: AudioBufferSourceNode | null = null;
let token = 0;

function ctx(): AudioContext | null {
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

/** Call from a tap: phones only allow sound after the person touched the page. Also ignore the iPhone mute switch
    for speech (Safari 17+), the way a music or podcast app does. */
export function unlock() {
  try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = 'playback'; } catch { /* older browsers */ }
  const a = ctx();
  if (!a) return;
  const b = a.createBuffer(1, 1, 22050);
  const s = a.createBufferSource();
  s.buffer = b;
  s.connect(a.destination);
  s.start(0);
}

function index(rec: string): Promise<Index | null> {
  let p = indexes.get(rec);
  if (!p) {
    p = fetch(`audio/${rec}.json`).then((r) => (r.ok ? (r.json() as Promise<Index>) : null)).catch(() => null);
    indexes.set(rec, p);
  }
  return p;
}

function decode(a: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // the callback form also works on older Safari
  return new Promise((res, rej) => { const p = a.decodeAudioData(data, res, rej); p?.catch?.(rej); });
}

function chunk(file: string | undefined): Promise<AudioBuffer | null> {
  if (!file) return Promise.resolve(null);
  const key = file;
  let p = chunks.get(key);
  if (p) { chunks.delete(key); chunks.set(key, p); return p; } // most recently used last
  const a = ctx();
  if (!a) return Promise.resolve(null);
  p = fetch(`audio/${file}`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((d) => (d ? decode(a, d) : null))
    .then((b) => { if (b) stats.decoded++; return b; }).catch(() => { stats.failed++; return null; });
  chunks.set(key, p);
  while (chunks.size > MAX_CHUNKS) chunks.delete(chunks.keys().next().value!);
  return p;
}

/** start fetching a card's audio before it is needed */
export async function preload(c: Card) {
  const i = await index(c.rec);
  const e = i?.c?.[`${c.id}:h`];
  if (e) void chunk(i!.f?.[e[0]]);
}

export async function hasAudio(c: Card) {
  return !!(await index(c.rec))?.c?.[`${c.id}:h`];
}

export function textFor(c: Card, key: string): string {
  if (key === 'h' || key === 'hs') return c.h;
  if (key === 'v0') return c.v?.[0]?.[0] ?? '';
  const m = key.match(/^l(\d)$/);
  return m ? c.l[Number(m[1])]?.[1] ?? '' : '';
}

/** line keys in reading order: l0, l1 … (max 4, as recorded) */
export const lineKeys = (c: Card) => c.l.slice(0, 4).map((_, i) => `l${i}`);

export function stop() {
  token++;
  try { src?.stop(); } catch { /* already stopped */ }
  src = null;
  hush();
}

export type Played = { dur: number; recorded: boolean };

async function run(c: Card, key: string, my: number): Promise<Played | null> {
  const i = await index(c.rec);
  const e = i?.c?.[`${c.id}:${key}`];
  if (e) {
    const buf = await chunk(i!.f?.[e[0]]);
    if (my !== token) return null;
    const a = ctx();
    if (buf && a) {
      const s = a.createBufferSource();
      s.buffer = buf;
      s.connect(a.destination);
      src = s;
      // start a hair early and end a hair late: chunks have 0.25 s of silence between clips
      const from = Math.max(0, e[1] - 0.05);
      stats.played++;
      await new Promise<void>((res) => { s.onended = () => res(); s.start(0, from, e[2] + 0.12); });
      return { dur: e[2], recorded: true };
    }
  }
  if (my !== token) return null;
  const text = textFor(c, key);
  if (!text || !canSpeak()) return null;
  const t0 = performance.now();
  stats.fallback++;
  await new Promise<void>((res) => speak(text, { rate: key === 'hs' ? 0.72 : state.settings.rate, onend: () => res() }));
  return { dur: (performance.now() - t0) / 1000, recorded: false };
}

/** play one clip (stops anything playing). Resolves when it ends. */
export function play(c: Card, key = 'h'): Promise<Played | null> {
  stop();
  return run(c, key, ++token);
}

/** play clips in a row with a pause between them; `gap` gets the clip length so shadowing can wait long enough */
export async function playSeq(c: Card, keys: string[], gap: (dur: number) => number = () => 0.35, onClip?: (key: string) => void) {
  stop();
  const my = ++token;
  for (const k of keys) {
    if (my !== token) return false;
    onClip?.(k);
    const r = await run(c, k, my);
    if (my !== token) return false;
    await new Promise((res) => setTimeout(res, gap(r?.dur ?? 1) * 1000));
  }
  return my === token;
}

export const playing = () => !!src;
