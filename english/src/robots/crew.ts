/*
 * The Music Japan robot crew (TUNE / SPIN / POD / REEL / MIC).
 * Drawing code ported from the official site (music-japan.com) so the crew looks exactly the same.
 * The crew never speaks here: no speech bubbles and none of their original lines.
 * They only react with faces, moves and tiny pixel icons on their screens.
 */

const W = 32;
const H = 48;

const BODY = '#131318';
const BODY_HI = '#2c2c37';
const BODY_LO = '#0a0a0d';
const EDGE = '#3d3d49';
const SCREEN = '#060608';
const METAL = '#62626f';

type Face =
  | 'open' | 'talk' | 'blink' | 'sleep' | 'drowsy' | 'smile' | 'sing' | 'grin' | 'laugh'
  | 'wow' | 'love' | 'star' | 'wink' | 'dizzy' | 'cool';
type Arm = 'down' | 'out' | 'up' | 'wave1' | 'wave2' | 'hip';
type Legs = 'stand' | 'step1' | 'step2' | 'dangle';

export interface Pose {
  t: number;
  dy: number;
  hy: number;
  hx: number;
  bx: number;
  flip: boolean;
  armL: Arm;
  armR: Arm;
  legs: Legs;
  legH: number;
  face: Face;
  look: number;
  text: string;
  talkOpen: boolean;
  float: boolean;
  playing: boolean;
  ground: 'dark' | 'light';
}

const basePose = (t: number): Pose => ({
  t, dy: 0, hy: 0, hx: 0, bx: 0, flip: false, armL: 'down', armR: 'down', legs: 'stand', legH: 3,
  face: 'open', look: 0, text: '', talkOpen: false, float: false, playing: false, ground: 'dark',
});

class Grid {
  a: (string | null)[] = new Array(W * H).fill(null);
  p(x: number, y: number, c: string | null) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.a[y * W + x] = c;
  }
  get(x: number, y: number) {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= W || y >= H ? null : this.a[y * W + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c);
  }
  rr(x: number, y: number, w: number, h: number, rad: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const px = i + 0.5, py = j + 0.5;
      const dx = px < rad ? rad - px : px > w - rad ? px - (w - rad) : 0;
      const dy = py < rad ? rad - py : py > h - rad ? py - (h - rad) : 0;
      if (dx * dx + dy * dy <= rad * rad + 0.35) this.p(x + i, y + j, c);
    }
  }
  el(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.p(x, y, c);
    }
  }
  ring(cx: number, cy: number, rx: number, ry: number, th: number, c: string) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const ox = (x + 0.5 - cx) / rx, oy = (y + 0.5 - cy) / ry;
      const ix = (x + 0.5 - cx) / (rx - th), iy = (y + 0.5 - cy) / (ry - th);
      if (ox * ox + oy * oy <= 1 && ix * ix + iy * iy > 1) this.p(x, y, c);
    }
  }
  st(x: number, y: number, rows: string[], map: Record<string, string>) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) { const c = map[row[i]]; if (c) this.p(x + i, y + j, c); }
    });
  }
  bevel(c: string, hi: string, lo: string) {
    const b = this.a.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : b[y * W + x]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (b[y * W + x] !== c) continue;
      if (lo && (at(x, y + 1) !== c || at(x + 1, y) !== c)) this.a[y * W + x] = lo;
      if (hi && (at(x, y - 1) !== c || at(x - 1, y) !== c)) this.a[y * W + x] = hi;
    }
  }
  glow(c: string, on: string, to: string) {
    const b = this.a.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (b[y * W + x] !== on) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && b[Y * W + X] === c) { this.a[y * W + x] = to; break; }
      }
    }
  }
  outline(c: string) {
    const b = this.a.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (b[y * W + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && b[Y * W + X]) { this.a[y * W + x] = c; break; }
      }
    }
  }
}

const dimmed = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  const f = (n: number) => Math.round(6 + (n - 6) * 0.17).toString(16).padStart(2, '0');
  return `#${f(v >> 16)}${f((v >> 8) & 255)}${f(v & 255)}`;
};

const GLYPHS: Record<string, string[]> = {
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'], U: ['#.#', '#.#', '#.#', '#.#', '###'], L: ['#..', '#..', '#..', '#..', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], E: ['###', '#..', '##.', '#..', '###'], C: ['.##', '#..', '#..', '#..', '.##'],
  Z: ['###', '..#', '.#.', '#..', '###'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'], '♪': ['.##', '.#.', '.#.', '##.', '##.'], '.': ['...', '...', '...', '...', '.#.'],
  '♥': ['...', '#.#', '###', '###', '.#.'], ' ': ['...', '...', '...', '...', '...'], '●': ['...', '###', '###', '###', '...'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
};

function drawFace(g: Grid, cx: number, fy: number, P: Pose, color: string) {
  const L = Math.round(cx - 4.5) + P.look;
  const R = Math.round(cx + 3.5) + P.look;
  const map = { '#': color };
  const eye = (x: number, rows: string[]) => g.st(x, fy, rows, map);
  const solid = ['##', '##', '##'];
  switch (P.face) {
    case 'open': case 'talk': eye(L, solid); eye(R, solid); break;
    case 'blink': case 'sleep': eye(L, ['..', '..', '##']); eye(R, ['..', '..', '##']); break;
    case 'drowsy': eye(L - 1, ['...', '###', '.#.']); eye(R, ['...', '###', '.#.']); break;
    case 'smile': case 'sing': case 'grin': eye(L - 1, ['...', '.#.', '#.#']); eye(R, ['...', '.#.', '#.#']); break;
    case 'laugh': eye(L - 1, ['#..', '.##', '#..']); eye(R, ['..#', '##.', '..#']); break;
    case 'wow': eye(L - 1, ['.#.', '#.#', '.#.']); eye(R, ['.#.', '#.#', '.#.']); break;
    case 'love': eye(L - 1, ['#.#', '###', '.#.']); eye(R, ['#.#', '###', '.#.']); break;
    case 'star': eye(L - 1, ['.#.', '###', '.#.']); eye(R, ['.#.', '###', '.#.']); break;
    case 'wink': eye(L - 1, ['...', '.#.', '#.#']); eye(R, solid); break;
    case 'dizzy': eye(L - 1, ['#.#', '.#.', '#.#']); eye(R, ['#.#', '.#.', '#.#']); break;
    case 'cool': g.st(Math.round(cx - 6.5) + P.look, fy, ['#############', '.####...####.', '..##.....##..'], map); break;
  }
  const mouths: Record<Face, string[]> = {
    open: ['#..#', '.##.'], blink: ['#..#', '.##.'], smile: ['#..#', '.##.'], wink: ['#..#', '.##.'], love: ['#..#', '.##.'],
    laugh: ['####', '#..#', '.##.'], sing: ['.##.', '#..#', '.##.'], wow: ['.##.', '#..#', '.##.'], star: ['####', '#..#', '.##.'],
    sleep: ['.##.'], dizzy: ['.#.#', '#.#.'], drowsy: ['....', '.##.'], grin: ['####', '#..#', '.##.'], cool: ['....', '.###'],
    talk: P.talkOpen ? ['.##.', '#..#', '.##.'] : ['####'],
  };
  g.st(Math.round(cx - 1.5), fy + 4, mouths[P.face], map);
}

function drawText(g: Grid, cx: number, y: number, text: string, color: string) {
  const glyphs = [...text].map((c) => GLYPHS[c] ?? GLYPHS[' ']);
  const width = glyphs.reduce((w, gl) => w + gl[0].length + 1, -1);
  let x = Math.round(cx - width / 2);
  for (const gl of glyphs) { g.st(x, y - 2, gl, { '#': color }); x += gl[0].length + 1; }
}

interface HeadInfo { fy: number; eyes?: 'reels' }
export interface Member {
  id: 'tune' | 'spin' | 'pod' | 'reel' | 'mic';
  name: string;
  color: string;
  rest: Face;
  role: string;
  head(g: Grid, P: Pose, hx: number, hy: number): HeadInfo;
}

export const CREW: Member[] = [
  {
    id: 'tune', name: 'TUNE', color: '#ff2e3e', rest: 'open', role: 'Movies & TV',
    head(g, _P, x, y) {
      g.st(x + 12, y - 8, ['..###..', '.#...#.', '##...#.', '##..#..', '....#..', '....#..', '....#..', '....#..'], { '#': BODY });
      g.rr(x + 4, y, 24, 18, 4, BODY);
      g.rr(x + 6, y + 2, 20, 13, 3, SCREEN);
      return { fy: y + 5 };
    },
  },
  {
    id: 'spin', name: 'SPIN', color: '#ffb43d', rest: 'drowsy', role: 'Classic Books',
    head(g, P, x, y) {
      g.rect(x + 15, y - 3, 2, 3, BODY);
      const cx = x + 15.5, cy = y - 4.5;
      g.el(cx, cy, 11, 2.2, BODY);
      g.el(cx, cy, 2.6, 1, METAL);
      const r = P.t * (P.float ? 18 : P.playing ? 7 : 2);
      for (let i = 0; i < 2; i++) { const a = r + i * Math.PI; g.p(cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 1.3, EDGE); }
      g.rr(x + 5, y, 22, 18, 8, BODY);
      g.rr(x + 8, y + 3, 16, 11, 4, SCREEN);
      return { fy: y + 5 };
    },
  },
  {
    id: 'pod', name: 'POD', color: '#3fd8ff', rest: 'cool', role: 'Songs',
    head(g, _P, x, y) {
      const band = new Grid();
      band.ring(x + 15.5, y + 8, 13.5, 10, 2, BODY);
      for (let j = 0; j < y + 7; j++) for (let i = 0; i < W; i++) if (band.get(i, j)) g.p(i, j, BODY);
      g.rr(x + 5, y + 1, 22, 17, 7, BODY);
      g.rr(x + 8, y + 4, 16, 10, 4, SCREEN);
      g.rr(x + 1, y + 6, 5, 9, 2, BODY);
      g.rr(x + 26, y + 6, 5, 9, 2, BODY);
      g.rect(x + 2, y + 8, 1, 5, BODY_HI);
      g.rect(x + 29, y + 8, 1, 5, BODY_HI);
      return { fy: y + 6 };
    },
  },
  {
    id: 'reel', name: 'REEL', color: '#7dff8e', rest: 'open', role: 'Science',
    head(g, P, x, y) {
      g.st(x + 15, y - 4, ['..#', '.#.', '.#.', '..#'], { '#': BODY });
      g.rr(x + 3, y, 26, 18, 3, BODY);
      g.rect(x + 6, y + 2, 20, 2, BODY_HI);
      g.rr(x + 6, y + 5, 20, 10, 3, SCREEN);
      return { fy: y + 7, eyes: P.face === 'open' || P.face === 'talk' ? 'reels' : undefined };
    },
  },
  {
    id: 'mic', name: 'MIC', color: '#ff7ad8', rest: 'grin', role: 'Comedy',
    head(g, _P, x, y) {
      g.rect(x + 15, y - 2, 2, 2, BODY);
      g.rr(x + 14, y - 5, 4, 3, 1, BODY);
      g.el(x + 15.5, y + 8.5, 12, 9.5, BODY);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (g.get(i, j) === BODY && j >= y && (i + j) % 2 === 0) g.p(i, j, '#1c1c23');
      g.rr(x + 8, y + 3, 16, 11, 4, SCREEN);
      g.rect(x + 7, y + 17, 18, 1, BODY_HI);
      return { fy: y + 5 };
    },
  },
];

const ARMS: Record<Arm, [number, number][]> = {
  down: [[8, 2], [9, 2], [7, 3], [8, 3], [9, 3], [7, 4], [8, 4]],
  out: [[6, 2], [7, 2], [8, 2], [9, 2], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]],
  up: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [4, -2], [5, -2], [3, -3], [4, -3]],
  wave1: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [5, -2], [6, -2], [5, -3], [6, -3], [5, -4]],
  wave2: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [4, -2], [5, -2], [2, -2], [3, -2], [3, -3]],
  hip: [[8, 2], [9, 2], [7, 3], [8, 4], [9, 4], [9, 5]],
};

function drawArm(g: Grid, pose: Arm, side: 'L' | 'R', bx: number, by: number) {
  for (const [x, y] of ARMS[pose]) g.p((side === 'L' ? x : 31 - x) + bx, by + y, BODY);
}

export function drawMember(ctx: CanvasRenderingContext2D, m: Member, P: Pose) {
  const g = new Grid();
  const hy = 15 + P.dy;
  const by = hy + 18;
  const legTop = by + 7;
  const liftL = P.legs === 'step1' ? 1 : 0;
  const liftR = P.legs === 'step2' ? 1 : 0;
  const dangle = P.legs === 'dangle' ? 1 : 0;
  g.rr(11 + P.bx + dangle, legTop, 4 - dangle, P.legH - liftL, 1, BODY);
  g.rr(17 + P.bx, legTop, 4 - dangle, P.legH - liftR, 1, BODY);
  g.rr(10 + P.bx, by, 12, 8, 3, BODY);
  const hx = P.hx;
  const top = hy + P.hy;
  const info = m.head(g, P, hx, top);
  drawArm(g, P.armL, 'L', P.bx, by);
  drawArm(g, P.armR, 'R', P.bx, by);
  g.bevel(BODY, BODY_HI, BODY_LO);
  g.st(14 + P.bx, by + 2, ['.##.', '#.##', '##.#', '.##.'], { '#': METAL });
  const cx = 15.5 + hx;
  const color = m.color;
  const face: Pose = { ...P, face: P.face === 'open' ? m.rest : P.face };
  if (P.text) drawText(g, cx, info.fy + 3, P.text, color);
  else if (info.eyes === 'reels') {
    const spin = P.playing ? P.t * 9 : 0;
    for (const ex of [11 + hx + P.look, 20 + hx + P.look]) {
      g.ring(ex + 0.5, info.fy + 2, 2.6, 2.6, 1, color);
      for (let k = 0; k < 3; k++) { const a = spin + (k * Math.PI * 2) / 3; g.p(ex + 0.5 + Math.cos(a) * 1.1, info.fy + 2 + Math.sin(a) * 1.1, color); }
    }
    g.st(Math.round(cx - 1.5), info.fy + 5, P.face === 'talk' && P.talkOpen ? ['.##.', '#..#'] : ['#..#', '.##.'], { '#': color });
  } else drawFace(g, cx, info.fy, face, color);
  g.glow(color, SCREEN, dimmed(color));
  if (m.id === 'mic' && (P.playing || P.face === 'talk')) g.rr(14 + hx, top - 5, 4, 3, 1, color);
  g.outline(EDGE);
  if (P.float) g.ring(15.5 + hx, top - 10, 6, 1.6, 1, '#ffe7a3');

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (P.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  const lift = Math.max(0, -P.dy);
  const sw = Math.max(3, 9 - lift * 0.9);
  const alpha = Math.max(0.16, 0.5 - lift * 0.05);
  ctx.fillStyle = P.ground === 'dark' ? `rgba(255,236,230,${(alpha * 0.3).toFixed(3)})` : `rgba(0,0,0,${(alpha * 0.8).toFixed(3)})`;
  for (let x = -sw; x <= sw; x++) {
    ctx.fillRect(Math.round(15.5 + x), 44, 1, 1);
    if (1 - (x / sw) ** 2 > 0.45) ctx.fillRect(Math.round(15.5 + x), 45, 1, 1);
  }
  for (let i = 0; i < g.a.length; i++) { const c = g.a[i]; if (c) { ctx.fillStyle = c; ctx.fillRect(i % W, (i / W) | 0, 1, 1); } }
  ctx.restore();
}

/* ── moves (same dance vocabulary as the official site) ── */
type Move = (P: Pose, beat: number, phase: number, u: number) => void;
const MOVES: Record<string, Move> = {
  bounce: (P, b, ph) => { P.dy = ph < 0.35 ? 1 : 0; P.legH = 3 - P.dy; P.armL = b % 2 ? 'up' : 'out'; P.armR = b % 2 ? 'out' : 'up'; P.hx = b % 2 ? 1 : -1; P.face = b % 4 < 2 ? 'sing' : 'smile'; },
  step: (P, b) => { P.hx = b % 2 ? 1 : -1; P.bx = P.hx; P.legs = b % 2 ? 'step1' : 'step2'; P.armL = b % 4 === 0 ? 'up' : 'out'; P.armR = b % 4 === 2 ? 'up' : 'out'; P.face = 'smile'; },
  sway: (P, b) => { const s = Math.floor(b / 2) % 2; P.hx = s ? 1 : -1; P.armL = s ? 'down' : 'out'; P.armR = s ? 'out' : 'down'; P.face = 'smile'; },
  nod: (P, b, ph) => { P.hy = ph < 0.4 ? 1 : 0; P.armL = P.armR = 'hip'; P.face = b % 4 === 3 ? 'wink' : 'sing'; },
  clap: (P, b, ph) => { const up = b % 2 === 0 && ph < 0.6; P.dy = up ? -Math.round(Math.sin((ph / 0.6) * Math.PI) * 4) : 0; P.armL = P.armR = up ? 'up' : 'out'; P.legs = up ? 'dangle' : 'stand'; P.face = up ? 'laugh' : 'smile'; },
  robot: (P, b) => { const s = b % 4; P.armL = s === 0 ? 'out' : s === 2 ? 'up' : 'down'; P.armR = s === 1 ? 'out' : s === 3 ? 'up' : 'down'; P.bx = s < 2 ? 1 : -1; P.hx = P.bx; P.face = 'open'; },
  spin: (P, b, ph) => { P.flip = Math.floor((b + ph) * 2) % 2 === 1; P.armL = P.armR = 'out'; P.face = 'laugh'; P.dy = ph < 0.2 ? 1 : 0; P.legH = 3 - P.dy; },
  pose: (P, b) => { const s = Math.floor(b / 2) % 3; P.armL = s === 0 ? 'up' : 'hip'; P.armR = s === 1 ? 'up' : 'hip'; P.face = s === 2 ? 'love' : 'wink'; P.flip = s === 1; },
  twist: (P, b, ph) => { const s = Math.floor((b + ph) * 2) % 2; P.bx = s ? 1 : -1; P.hx = -P.bx; P.legs = s ? 'step1' : 'step2'; P.armL = P.armR = 'out'; P.face = 'sing'; },
};
const MOVE_POOL: Record<Member['id'], string[]> = {
  tune: ['bounce', 'step', 'clap', 'pose'],
  spin: ['sway', 'step', 'nod'],
  pod: ['nod', 'sway', 'bounce'],
  reel: ['robot', 'twist', 'step'],
  mic: ['bounce', 'clap', 'spin', 'pose'],
};

export type Act =
  | 'idle' | 'jump' | 'laugh' | 'wow' | 'dizzy' | 'love' | 'star' | 'wave' | 'dance' | 'float' | 'sleep' | 'cool' | 'rec' | 'nope' | 'think';

/** One robot on a canvas. Shared 12fps loop; pixel art moves at a low frame rate on purpose. */
export class Bot {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  member: Member;
  mode: Act = 'idle';
  private m0 = 0;
  private nextBlink = 0;
  private blinkTo = 0;
  private move = 'bounce';
  ground: 'dark' | 'light' = 'dark';
  auto = true;
  attached = false;
  private nextAuto = 0;

  constructor(member: Member | Member['id'], opts: { auto?: boolean } = {}) {
    this.member = typeof member === 'string' ? CREW.find((m) => m.id === member)! : member;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'bot';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.auto = opts.auto ?? true;
    this.nextAuto = performance.now() + 2500 + Math.random() * 4000;
    Bot.all.add(this);
    Bot.start();
    this.draw(performance.now());
  }

  setMember(id: Member['id']) { this.member = CREW.find((m) => m.id === id)!; }

  act(mode: Act, ms?: number) {
    this.mode = mode;
    this.m0 = performance.now();
    this.until = ms ? this.m0 + ms : 0;
    const pool = MOVE_POOL[this.member.id];
    this.move = pool[Math.floor(Math.random() * pool.length)];
    this.nextAuto = this.m0 + 5000 + Math.random() * 5000;
  }
  private until = 0;

  private pose(now: number): Pose {
    const t = now / 1000;
    const u = (now - this.m0) / 1000;
    const P = basePose(t);
    P.ground = this.ground;
    const done = (len: number) => { if ((this.until && now > this.until) || (!this.until && u > len)) this.mode = 'idle'; };
    const breathe = () => { const b = Math.floor(t * 1.6) % 2; P.dy = b; P.legH = 3 - b; };
    switch (this.mode) {
      case 'jump':
        if (u < 0.1) { P.dy = 1; P.legH = 2; P.face = 'smile'; }
        else if (u < 0.62) { const p = (u - 0.1) / 0.52; P.dy = -Math.round(Math.sin(Math.PI * p) * 8); P.armL = P.armR = 'up'; P.face = 'laugh'; P.legs = 'dangle'; }
        else if (u < 0.75) { P.dy = 1; P.legH = 2; P.face = 'smile'; }
        else this.mode = 'idle';
        return P;
      case 'laugh': P.face = 'laugh'; P.hx = Math.floor(t * 8) % 2; P.armL = P.armR = 'out'; done(1.4); return P;
      case 'wow': P.face = 'wow'; P.dy = u < 0.25 ? -1 : 0; done(1); return P;
      case 'dizzy': P.face = 'dizzy'; P.hx = Math.floor(t * 6) % 2 ? 1 : -1; P.armL = 'out'; P.armR = 'down'; done(1.4); return P;
      case 'nope': P.text = 'X'; P.hx = Math.floor(t * 10) % 2 ? 1 : -1; P.armL = P.armR = 'out'; done(1.1); return P;
      case 'think': P.text = '?'; P.armR = 'hip'; P.look = Math.floor(t * 1.2) % 2 ? 1 : -1; done(2.2); return P;
      case 'love': P.face = 'love'; P.armL = P.armR = 'up'; P.dy = Math.floor(t * 4) % 2 ? -1 : 0; done(1.6); return P;
      case 'star': P.face = 'star'; P.armL = 'up'; P.armR = 'out'; P.flip = Math.floor(t * 3) % 2 === 1; done(1.6); return P;
      case 'cool': P.face = 'cool'; P.armL = P.armR = 'hip'; done(1.8); return P;
      case 'rec': P.text = Math.floor(t * 2) % 2 ? 'REC' : '● '; P.armR = 'out'; P.playing = true; done(1.6); return P;
      case 'wave': P.face = 'smile'; P.armR = Math.floor(t * 8) % 4 < 2 ? 'wave1' : 'wave2'; done(1.8); return P;
      case 'sleep': { P.face = 'sleep'; const b = Math.floor(t * 0.8) % 2; P.dy = b; P.legH = 3 - b; done(6); return P; }
      case 'float': {
        const D = 3.4, e = u < 0.6 ? u / 0.6 : u > D - 0.6 ? Math.max(0, (D - u) / 0.6) : 1;
        const lift = e * (3.5 + Math.sin(u * 3.2));
        P.dy = -Math.round(lift); P.float = lift > 1.2; P.legs = lift > 0.6 ? 'dangle' : 'stand'; P.armL = P.armR = lift > 1 ? 'out' : 'down'; P.face = 'smile';
        if (u > D) this.mode = 'idle';
        return P;
      }
      case 'dance': {
        const beat = t * 1.4 * 2, b = Math.floor(beat), ph = beat - b;
        P.playing = true;
        MOVES[this.move](P, b, ph, u);
        if (this.until && now > this.until) this.mode = 'idle';
        return P;
      }
      default: {
        breathe();
        if (now > this.nextBlink) { this.blinkTo = now + 130; this.nextBlink = now + 2200 + Math.random() * 3200; }
        if (now < this.blinkTo && P.face === 'open') P.face = 'blink';
        if (this.auto && now > this.nextAuto) {
          const r = Math.random();
          this.act(r < 0.4 ? 'float' : r < 0.6 ? 'wave' : r < 0.8 ? 'wow' : 'jump');
        }
        return P;
      }
    }
  }

  draw(now: number) { drawMember(this.ctx, this.member, this.pose(now)); }

  destroy() { Bot.all.delete(this); }

  static all = new Set<Bot>();
  private static running = false;
  private static start() {
    if (Bot.running) return;
    Bot.running = true;
    let last = 0;
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      if (document.hidden || now - last < 1000 / 12) return;
      last = now;
      for (const b of Bot.all) {
        if (!b.canvas.isConnected) {
          if (b.attached) Bot.all.delete(b);
          continue;
        }
        b.attached = true;
        b.draw(now);
      }
    };
    requestAnimationFrame(frame);
  }
}

export const memberFor = (source: string): Member['id'] =>
  (({ movies: 'tune', books: 'spin', songs: 'pod', science: 'reel', comedy: 'mic' }) as Record<string, Member['id']>)[source]
  ?? CREW[Math.floor(Math.random() * CREW.length)].id;
