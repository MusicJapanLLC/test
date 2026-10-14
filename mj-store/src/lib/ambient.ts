import type { Ambient } from '../data/types';
import { hash, mod, noise1 } from '../scenes/util';
import { reducedMotion } from './motion';

/**
 * ヒーローに漂わせる光の粒。作品ごとに種類を変える。
 *   fireflies … The World の蛍
 *   lanterns  … 灯の旅路の天灯
 *   embers    … ギルドの灯の火の粉
 *   leaves    … 村長の木の葉
 * すべて時刻 t の関数として描くので、止めても再開しても破綻しない。
 */

export interface AmbientHandle {
  play(): void;
  pause(): void;
}

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

const fireflies: Draw = (ctx, w, h, t) => {
  const n = Math.round(Math.min(64, Math.max(18, (w * h) / 22000)));
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = mod(hash(i, 1, 7) * w + (noise1(t * 0.12 + i * 3.1, 3) - 0.5) * 220, w);
    const y = mod(hash(i, 2, 7) * h + (noise1(t * 0.1 + i * 5.7, 5) - 0.5) * 160 - t * 4, h);
    const b = Math.pow(Math.max(0, Math.sin(t * (0.9 + hash(i, 3, 7)) + i * 2.3)), 3);
    if (b < 0.03) continue;
    const r = 7 + hash(i, 4, 7) * 6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(230,255,160,${(0.85 * b).toFixed(3)})`);
    g.addColorStop(0.3, `rgba(200,240,120,${(0.35 * b).toFixed(3)})`);
    g.addColorStop(1, 'rgba(180,230,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

const lanterns: Draw = (ctx, w, h, t) => {
  const n = Math.round(Math.min(26, Math.max(10, w / 70)));
  const range = h + 120;
  for (let i = 0; i < n; i++) {
    const d = hash(i, 1, 9);
    const size = 4 + d * 11;
    const x = hash(i, 2, 9) * w + Math.sin(t * 0.35 + i) * 14 * d;
    const y = h + 60 - mod(t * (7 + d * 18) + hash(i, 3, 9) * range, range);
    const flick = 0.78 + 0.22 * noise1(t * 3 + i * 10, 2);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
    g.addColorStop(0, `rgba(255,190,90,${(0.38 * flick).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
    ctx.globalCompositeOperation = 'source-over';
    const body = ctx.createLinearGradient(0, y - size * 0.7, 0, y + size * 0.7);
    body.addColorStop(0, '#FFEFC2');
    body.addColorStop(1, '#FF9440');
    ctx.globalAlpha = 0.55 + 0.4 * flick * (0.4 + d * 0.6);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.42, y - size * 0.65);
    ctx.lineTo(x + size * 0.42, y - size * 0.65);
    ctx.lineTo(x + size * 0.52, y + size * 0.6);
    ctx.lineTo(x - size * 0.52, y + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
};

const embers: Draw = (ctx, w, h, t) => {
  const n = Math.round(Math.min(70, Math.max(24, w / 24)));
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const L = 5 + hash(i, 1, 41) * 6;
    const a = mod(t + hash(i, 2, 41) * L, L) / L;
    const cyc = Math.floor((t + hash(i, 2, 41) * L) / L);
    const x0 = hash(i, cyc, 43) * w;
    const x = x0 + Math.sin(a * 6 + i) * 40 * a;
    const y = h + 10 - a * h * (0.7 + hash(i, 3, 41) * 0.5);
    const s = 1.2 + hash(i, 4, 41) * 2.4;
    const alpha = Math.sin(a * Math.PI) * 0.9;
    const warm = hash(i, 5, 41) > 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
    g.addColorStop(0, warm ? `rgba(255,214,120,${alpha.toFixed(3)})` : `rgba(255,140,170,${(alpha * 0.8).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - s * 4, y - s * 4, s * 8, s * 8);
  }
};

const LEAF = ['#5E8A4E', '#7FA35A', '#B58A3E', '#3E6B4E', '#C9B36A'];
const leaves: Draw = (ctx, w, h, t) => {
  const n = Math.round(Math.min(30, Math.max(12, w / 50)));
  const range = h + 80;
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const d = hash(i, 1, 13);
    const y = mod(t * (14 + d * 22) + hash(i, 2, 13) * range, range) - 40;
    const x = mod(hash(i, 3, 13) * w + Math.sin(t * 0.8 + i) * 30 + t * (6 + d * 10), w + 40) - 20;
    const s = Math.round(3 + d * 4);
    const flip = Math.abs(Math.sin(t * (1.5 + d) + i));
    ctx.globalAlpha = 0.55 + d * 0.35;
    ctx.fillStyle = LEAF[Math.floor(hash(i, 4, 13) * LEAF.length)];
    ctx.fillRect(Math.round(x), Math.round(y), s, Math.max(1, Math.round(s * flip)));
  }
  ctx.globalAlpha = 1;
};

const DRAW: Record<Ambient, Draw> = { fireflies, lanterns, embers, leaves };

class Instance implements AmbientHandle {
  t = Math.random() * 40;
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private want = false;
  private visible = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private draw: Draw,
  ) {
    this.ctx = canvas.getContext('2d')!;
    ro.observe(canvas);
    io.observe(canvas);
    map.set(canvas, this);
    this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.frame();
  }
  frame() {
    if (!this.w) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(this.ctx, this.w, this.h, this.t);
    this.ctx.globalCompositeOperation = 'source-over';
  }
  setVisible(v: boolean) {
    this.visible = v;
    this.update();
  }
  play() {
    this.want = true;
    this.update();
  }
  pause() {
    this.want = false;
    this.update();
  }
  update() {
    if (this.want && this.visible && !document.hidden && !reducedMotion()) running.add(this);
    else running.delete(this);
    if (running.size && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
}

const map = new Map<Element, Instance>();
const running = new Set<Instance>();
let raf = 0;
let last = 0;
function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  running.forEach((i) => {
    i.t += dt;
    i.frame();
  });
  raf = running.size ? requestAnimationFrame(tick) : 0;
}
const ro = new ResizeObserver((es) => es.forEach((e) => map.get(e.target)?.resize()));
const io = new IntersectionObserver((es) => es.forEach((e) => map.get(e.target)?.setVisible(e.isIntersecting)));
document.addEventListener('visibilitychange', () => map.forEach((i) => i.update()));

export function mountAmbient(canvas: HTMLCanvasElement, autoplay = true): AmbientHandle | null {
  const existing = map.get(canvas);
  if (existing) return existing;
  const kind = canvas.dataset.ambient as Ambient | undefined;
  if (!kind || !DRAW[kind]) return null;
  const inst = new Instance(canvas, DRAW[kind]);
  if (autoplay) inst.play();
  return inst;
}

/** ページ内の光の粒をまとめて起こす（特集カルーセルの中は、カルーセル側が担当） */
export function initAmbient(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-ambient]').forEach((c) => {
    if (c.closest('[data-slide]')) return;
    mountAmbient(c, true);
  });
}
