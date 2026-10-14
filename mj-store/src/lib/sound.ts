import { local } from './storage';

/**
 * 効果音。音源ファイルは使わず、その場で鳴らしている。
 * 初期状態はオン（オフにした人だけ、その設定を覚えておく）。ヘッダーのスピーカーで切り替える。
 * ブラウザの決まりで、最初に画面を押すまでは鳴らない。
 */

const KEY = 'mjstore:sound';
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = local.get(KEY) !== '0';
/** 一度でも押した・キーを打ったか。それまでは音の準備もしない */
let gestured = false;
const listeners = new Set<(on: boolean) => void>();

if (typeof window !== 'undefined') {
  const mark = () => {
    gestured = true;
    window.removeEventListener('pointerdown', mark, true);
    window.removeEventListener('keydown', mark, true);
  };
  window.addEventListener('pointerdown', mark, true);
  window.addEventListener('keydown', mark, true);
}

function ensure(): AudioContext | null {
  if (!gestured) return null;
  if (!ac) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0.16;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3, delay = 0, slideTo?: number) {
  if (!enabled) return;
  const a = ensure();
  if (!a || !master) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

let lastHover = 0;

export const sfx = {
  hover() {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    tone(1568, 0.035, 'square', 0.06);
  },
  click() {
    tone(988, 0.05, 'square', 0.14);
    tone(1480, 0.07, 'square', 0.1, 0.045);
  },
  unlock() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.14, 'square', 0.13, i * 0.07));
  },
  boot() {
    [261.63, 392, 523.25, 783.99].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.09));
  },
  step() {
    tone(180, 0.03, 'triangle', 0.1);
  },
  door() {
    tone(330, 0.28, 'triangle', 0.22, 0, 880);
    tone(660, 0.2, 'square', 0.08, 0.12, 1320);
  },
  send() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.12, i * 0.06));
  },
  /** ちびロボの声。5体それぞれ高さが違う */
  bot(i: number) {
    const base = [880, 587.33, 659.25, 783.99, 1046.5][i % 5];
    tone(base, 0.06, 'square', 0.12);
    tone(base * 1.5, 0.08, 'square', 0.1, 0.06);
    tone(base * 1.26, 0.1, 'triangle', 0.12, 0.13);
  },
  menu(open: boolean) {
    if (open) [523.25, 783.99].forEach((f, i) => tone(f, 0.08, 'square', 0.11, i * 0.05));
    else [783.99, 523.25].forEach((f, i) => tone(f, 0.07, 'square', 0.09, i * 0.04));
  },
  tick() {
    tone(1318.5, 0.025, 'square', 0.06);
  },
};

export function soundOn(): boolean {
  return enabled;
}

export function setSound(on: boolean): void {
  enabled = on;
  local.set(KEY, on ? '1' : '0');
  if (on) {
    ensure();
    tone(880, 0.08, 'square', 0.14);
    tone(1320, 0.12, 'square', 0.12, 0.07);
  }
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn: (on: boolean) => void): void {
  listeners.add(fn);
}
