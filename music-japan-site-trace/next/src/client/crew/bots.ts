import { H, Sprite, W } from './sprite';


/**
 * The Music Japan robot crew. One visual language for all five: a black body with a grey
 * rim, a dark screen for a face, the face itself in red, a grey Ø on the chest, a big head,
 * stubby legs and little arm nubs. They differ only in silhouette.
 */
export type Face = 'open' | 'blink' | 'smile' | 'laugh' | 'wow' | 'sleep' | 'love' | 'wink' | 'dizzy' | 'sing' | 'talk';
export type Arm = 'down' | 'out' | 'up' | 'wave1' | 'wave2' | 'hip';
export type Pose = {
  t: number;
  /** whole body offset (negative = up) */
  dy: number;
  /** extra head offset, for nods */
  hy: number;
  /** head lean */
  hx: number;
  /** body lean */
  bx: number;
  flip: boolean;
  armL: Arm;
  armR: Arm;
  legs: 'stand' | 'step1' | 'step2' | 'dangle';
  legH: number;
  face: Face;
  talkOpen: boolean;
  float: boolean;
  playing: boolean;
  ground: 'dark' | 'light';
};

export const newPose = (t: number): Pose => ({ t, dy: 0, hy: 0, hx: 0, bx: 0, flip: false, armL: 'down', armR: 'down', legs: 'stand', legH: 3, face: 'open', talkOpen: false, float: false, playing: false, ground: 'dark' });

const BODY = '#131318';
const HI = '#2c2c37';
const LO = '#0a0a0d';
const RIM = '#3d3d49';
const SCREEN = '#060608';
const FACE = '#ff2e3e';
const GLOW = '#2e0a11';
const GREY = '#62626f';

type Bot = { id: string; name: string; head: (s: Sprite, P: Pose, x: number, y: number) => { fy: number; eyes?: 'reels' } };

function face(s: Sprite, cx: number, fy: number, P: Pose) {
  const e = P.face;
  const L = Math.round(cx - 4.5), R = Math.round(cx + 3.5);
  const m = { '#': FACE };
  const eye = (x: number, rows: string[]) => s.st(x, fy, rows, m);
  const open = ['##', '##', '##'];
  switch (e) {
    case 'open': case 'talk': eye(L, open); eye(R, open); break;
    case 'blink': case 'sleep': eye(L, ['..', '..', '##']); eye(R, ['..', '..', '##']); break;
    case 'smile': case 'sing': eye(L - 1, ['...', '.#.', '#.#']); eye(R, ['...', '.#.', '#.#']); break;
    case 'laugh': eye(L - 1, ['#..', '.##', '#..']); eye(R, ['..#', '##.', '..#']); break;
    case 'wow': eye(L - 1, ['.#.', '#.#', '.#.']); eye(R, ['.#.', '#.#', '.#.']); break;
    case 'love': eye(L - 1, ['#.#', '###', '.#.']); eye(R, ['#.#', '###', '.#.']); break;
    case 'wink': eye(L - 1, ['...', '.#.', '#.#']); eye(R, open); break;
    case 'dizzy': eye(L - 1, ['#.#', '.#.', '#.#']); eye(R, ['#.#', '.#.', '#.#']); break;
  }
  const mouth: Record<Face, string[]> = {
    open: ['#..#', '.##.'], blink: ['#..#', '.##.'], smile: ['#..#', '.##.'], wink: ['#..#', '.##.'], love: ['#..#', '.##.'],
    laugh: ['####', '#..#', '.##.'], sing: ['.##.', '#..#', '.##.'], wow: ['.##.', '#..#', '.##.'],
    sleep: ['.##.'], dizzy: ['.#.#', '#.#.'],
    talk: P.talkOpen ? ['.##.', '#..#', '.##.'] : ['####'],
  };
  s.st(Math.round(cx - 1.5), fy + 4, mouth[e], m);
}

const BOTS: Bot[] = [
  {
    id: 'tune', name: 'TUNE',
    head(s, _P, x, y) {
      // hooked antenna with a ball at the end
      s.st(x + 12, y - 8, ['..###..', '.#...#.', '##...#.', '##..#..', '....#..', '....#..', '....#..', '....#..'], { '#': BODY });
      s.rr(x + 4, y, 24, 18, 4, BODY);
      s.rr(x + 6, y + 2, 20, 13, 3, SCREEN);
      return { fy: y + 5 };
    },
  },
  {
    id: 'spin', name: 'SPIN',
    head(s, P, x, y) {
      s.rect(x + 15, y - 3, 2, 3, BODY);
      const cx = x + 15.5, ry = y - 4.5;
      s.el(cx, ry, 11, 2.2, BODY);
      s.el(cx, ry, 2.6, 1, GREY);
      const sp = P.t * (P.float ? 18 : P.playing ? 7 : 2);
      for (let k = 0; k < 2; k++) {
        const a = sp + k * Math.PI;
        s.p(cx + Math.cos(a) * 7.5, ry + Math.sin(a) * 1.3, RIM);
      }
      s.rr(x + 5, y, 22, 18, 8, BODY);
      s.rr(x + 8, y + 3, 16, 11, 4, SCREEN);
      return { fy: y + 5 };
    },
  },
  {
    id: 'pod', name: 'POD',
    head(s, _P, x, y) {
      // headband: the upper half of a ring (drawn apart so the body below stays intact)
      const band = new Sprite();
      band.ring(x + 15.5, y + 8, 13.5, 10, 2, BODY);
      for (let yy = 0; yy < y + 7; yy++) for (let xx = 0; xx < W; xx++) if (band.get(xx, yy)) s.p(xx, yy, BODY);
      s.rr(x + 5, y + 1, 22, 17, 7, BODY);
      s.rr(x + 8, y + 4, 16, 10, 4, SCREEN);
      s.rr(x + 1, y + 6, 5, 9, 2, BODY);
      s.rr(x + 26, y + 6, 5, 9, 2, BODY);
      s.rect(x + 2, y + 8, 1, 5, HI);
      s.rect(x + 29, y + 8, 1, 5, HI);
      return { fy: y + 6 };
    },
  },
  {
    id: 'reel', name: 'REEL',
    head(s, P, x, y) {
      s.st(x + 15, y - 4, ['..#', '.#.', '.#.', '..#'], { '#': BODY });
      s.rr(x + 3, y, 26, 18, 3, BODY);
      s.rect(x + 6, y + 2, 20, 2, HI);
      s.rr(x + 6, y + 5, 20, 10, 3, SCREEN);
      return { fy: y + 7, eyes: P.face === 'open' || P.face === 'talk' ? 'reels' : undefined };
    },
  },
  {
    id: 'mic', name: 'MIC',
    head(s, _P, x, y) {
      s.rect(x + 15, y - 2, 2, 2, BODY);
      s.rr(x + 14, y - 5, 4, 3, 1, BODY);
      s.el(x + 15.5, y + 8.5, 12, 9.5, BODY);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (s.get(xx, yy) === BODY && yy >= y && (xx + yy) % 2 === 0) s.p(xx, yy, '#1c1c23');
      s.rr(x + 8, y + 3, 16, 11, 4, SCREEN);
      s.rect(x + 7, y + 17, 18, 1, HI);
      return { fy: y + 5 };
    },
  },
];

export const CREW = BOTS.map((b) => ({ id: b.id, name: b.name }));

function arm(s: Sprite, which: Arm, side: 'L' | 'R', bx: number, by: number) {
  const pts: Record<Arm, [number, number][]> = {
    down: [[8, 2], [9, 2], [7, 3], [8, 3], [9, 3], [7, 4], [8, 4]],
    out: [[6, 2], [7, 2], [8, 2], [9, 2], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]],
    up: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [4, -2], [5, -2], [3, -3], [4, -3]],
    wave1: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [5, -2], [6, -2], [5, -3], [6, -3], [5, -4]],
    wave2: [[8, 2], [9, 2], [7, 1], [8, 1], [6, 0], [7, 0], [5, -1], [6, -1], [4, -2], [5, -2], [2, -2], [3, -2], [3, -3]],
    hip: [[8, 2], [9, 2], [7, 3], [8, 4], [9, 4], [9, 5]],
  };
  for (const [x, y] of pts[which]) s.p((side === 'L' ? x : 31 - x) + bx, by + y, BODY);
}

/** Draw one frame. Returns nothing; writes into ctx at 1 logical pixel = 1 canvas pixel. */
export function renderRobot(ctx: CanvasRenderingContext2D, index: number, P: Pose) {
  const bot = BOTS[index % BOTS.length];
  const s = new Sprite();
  const y0 = 15 + P.dy;
  const by = y0 + 18;
  // legs: thick and stubby
  const lh = P.legH;
  const top = by + 7;
  const lL = P.legs === 'step1' ? 1 : 0, lR = P.legs === 'step2' ? 1 : 0;
  const inset = P.legs === 'dangle' ? 1 : 0;
  s.rr(11 + P.bx + inset, top, 4 - inset, lh - lL, 1, BODY);
  s.rr(17 + P.bx, top, 4 - inset, lh - lR, 1, BODY);
  // torso
  s.rr(10 + P.bx, by, 12, 8, 3, BODY);
  // head
  const hx = P.hx, hyy = y0 + P.hy;
  const info = bot.head(s, P, hx, hyy);
  // arms (after the head so a raised arm reads in front of it)
  arm(s, P.armL, 'L', P.bx, by);
  arm(s, P.armR, 'R', P.bx, by);
  s.bevel(BODY, HI, LO);
  // chest Ø
  s.st(14 + P.bx, by + 2, ['.##.', '#.##', '##.#', '.##.'], { '#': GREY });
  // face
  const cx = 15.5 + hx;
  if (info.eyes === 'reels') {
    const spin = P.playing ? P.t * 9 : 0;
    for (const ex of [11 + hx, 20 + hx]) {
      s.ring(ex + 0.5, info.fy + 2, 2.6, 2.6, 1, FACE);
      for (let k = 0; k < 3; k++) {
        const a = spin + (k * Math.PI * 2) / 3;
        s.p(ex + 0.5 + Math.cos(a) * 1.1, info.fy + 2 + Math.sin(a) * 1.1, FACE);
      }
    }
    s.st(Math.round(cx - 1.5), info.fy + 5, P.face === 'talk' && P.talkOpen ? ['.##.', '#..#'] : ['#..#', '.##.'], { '#': FACE });
  } else {
    face(s, cx, info.fy, P);
  }
  s.glow(FACE, SCREEN, GLOW);
  if (bot.id === 'mic' && (P.playing || P.face === 'talk')) s.rr(14 + hx, hyy - 5, 4, 3, 1, FACE);
  s.outline(RIM);
  if (P.float) s.ring(15.5 + hx, hyy - 10, 6, 1.6, 1, '#ffe7a3');

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (P.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  // ground shadow shrinks as the robot rises
  const lift = Math.max(0, -P.dy);
  const sw = Math.max(3, 9 - lift * 0.9);
  const a0 = Math.max(0.16, 0.5 - lift * 0.05);
  ctx.fillStyle = P.ground === 'dark' ? `rgba(255,236,230,${(a0 * 0.3).toFixed(3)})` : `rgba(0,0,0,${(a0 * 0.8).toFixed(3)})`;
  for (let x = -sw; x <= sw; x++) {
    ctx.fillRect(Math.round(15.5 + x), 44, 1, 1);
    if (1 - (x / sw) ** 2 > 0.45) ctx.fillRect(Math.round(15.5 + x), 45, 1, 1);
  }
  for (let i = 0; i < s.a.length; i++) {
    const c = s.a[i];
    if (c) { ctx.fillStyle = c; ctx.fillRect(i % W, (i / W) | 0, 1, 1); }
  }
  ctx.restore();
}
