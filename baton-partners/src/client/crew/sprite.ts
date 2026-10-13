// 公式サイト（music-japan.com, music-japan-site-trace/next/src/client/crew/）と同じロボット。見た目はそちらに合わせ、ここでは書き換えない
/**
 * A tiny pixel canvas for the Music Japan robots. Every robot is drawn from shapes into a
 * 32×48 grid, gets an automatic rim outline, and is blitted 1:1 into a canvas that CSS scales
 * up with `image-rendering: pixelated`. 1,536 pixels per robot — cheap enough to redraw a
 * whole crew at 12fps.
 */
export const W = 32;
export const H = 48;

export type Pix = (string | null)[];

export class Sprite {
  a: Pix = new Array(W * H).fill(null);

  p(x: number, y: number, c: string | null) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.a[y * W + x] = c;
  }
  get(x: number, y: number) {
    x = Math.round(x);
    y = Math.round(y);
    return x < 0 || y < 0 || x >= W || y >= H ? null : this.a[y * W + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c);
  }
  /** rounded rectangle */
  rr(x: number, y: number, w: number, h: number, rad: number, c: string) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const px = i + 0.5, py = j + 0.5;
        const dx = px < rad ? rad - px : px > w - rad ? px - (w - rad) : 0;
        const dy = py < rad ? rad - py : py > h - rad ? py - (h - rad) : 0;
        if (dx * dx + dy * dy <= rad * rad + 0.35) this.p(x + i, y + j, c);
      }
  }
  el(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.p(x, y, c);
      }
  }
  ring(cx: number, cy: number, rx: number, ry: number, th: number, c: string) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const ix = (x + 0.5 - cx) / (rx - th), iy = (y + 0.5 - cy) / (ry - th);
        if (dx * dx + dy * dy <= 1 && ix * ix + iy * iy > 1) this.p(x, y, c);
      }
  }
  /** stamp: rows of characters, each mapped to a colour ('.' = skip) */
  st(x: number, y: number, rows: string[], map: Record<string, string>) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = map[row[i]];
        if (c) this.p(x + i, y + j, c);
      }
    });
  }
  /** light top-left and dark bottom-right edge on every pixel of colour c */
  bevel(c: string, hi: string | null, lo: string | null) {
    const b = this.a.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : b[y * W + x]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (b[y * W + x] !== c) continue;
        if (lo && (at(x, y + 1) !== c || at(x + 1, y) !== c)) this.a[y * W + x] = lo;
        if (hi && (at(x, y - 1) !== c || at(x - 1, y) !== c)) this.a[y * W + x] = hi;
      }
  }
  /** soft glow: paint `glow` on pixels of colour `on` that touch colour `src` */
  glow(src: string, on: string, glow: string) {
    const b = this.a.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (b[y * W + x] !== on) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < H && b[Y * W + X] === src) { this.a[y * W + x] = glow; break; }
        }
      }
  }
  outline(c: string) {
    const b = this.a.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (b[y * W + x]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < H && b[Y * W + X]) { this.a[y * W + x] = c; break; }
        }
      }
  }
}
