/* ドット絵エンジン：低解像度のキャンバスに整数座標で描き、最後に光を当てて拡大する */
'use strict';
const PX = (window.PX = {});

PX.BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

PX.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

PX.hex = (h) => {
  h = h.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
PX.toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
PX.mix = (a, b, t) => {
  const A = PX.hex(a), B = PX.hex(b);
  return PX.toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};

PX.canvas = function (w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx, w, h };
};

// ---------------------------------------------------------------- primitives
PX.rect = (c, x, y, w, h, col) => { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
PX.p = (c, x, y, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
PX.hline = (c, x0, x1, y, col) => { if (x1 < x0) [x0, x1] = [x1, x0]; PX.rect(c, x0, y, x1 - x0 + 1, 1, col); };
PX.vline = (c, x, y0, y1, col) => { if (y1 < y0) [y0, y1] = [y1, y0]; PX.rect(c, x, y0, 1, y1 - y0 + 1, col); };
PX.line = function (c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (let i = 0; i < 2000; i++) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
};
// 多角形（走査線で塗る：アンチエイリアスなし）
PX.poly = function (c, pts, col) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
  c.fillStyle = col;
  const n = pts.length / 2;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) c.fillRect(a, y, b - a, 1);
    }
  }
};
PX.ellipse = function (c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
};
// 2色を割合でディザ
PX.dither = function (c, x, y, w, h, colA, colB, t) {
  c.fillStyle = colA;
  c.fillRect(x, y, w, h);
  c.fillStyle = colB;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const tt = typeof t === 'function' ? t(i, j) : t;
    if (PX.BAYER[(y + j) & 3][(x + i) & 3] < tt) c.fillRect(x + i, y + j, 1, 1);
  }
};
// 縦グラデーション（色の段をディザでつなぐ）
PX.gradV = function (c, x, y, w, h, stops) {
  const n = stops.length - 1;
  for (let j = 0; j < h; j++) {
    const t = (j / Math.max(1, h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    for (let k = 0; k < w; k++) {
      c.fillStyle = PX.BAYER[(y + j) & 3][(x + k) & 3] < f ? stops[i + 1] : stops[i];
      c.fillRect(x + k, y + j, 1, 1);
    }
  }
};

// ---------------------------------------------------------------- sprites
// data: 文字列の配列。pal: 文字 → 色（'.' は透明）
PX.sprite = function (c, data, pal, x, y, flip) {
  const h = data.length;
  for (let j = 0; j < h; j++) {
    const row = data[j];
    const w = row.length;
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(Math.round(x + (flip ? w - 1 - i : i)), Math.round(y + j), 1, 1);
    }
  }
};

// 形（マスク）から、明暗と輪郭を自動で付けたスプライトを作る
//  ramp: 暗→明の色。light は左上。
PX.shaped = function (w, h, drawMask, ramp, opts = {}) {
  const m = PX.canvas(w, h);
  drawMask(m.ctx);
  const md = m.ctx.getImageData(0, 0, w, h).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && md[(y * w + x) * 4 + 3] > 128;
  const out = PX.canvas(w, h);
  const o = out.ctx;
  const R = ramp.length;
  const outline = opts.outline === undefined ? PX.mix(ramp[0], '#000000', 0.45) : opts.outline;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (on(x, y)) {
      let lvl = opts.base != null ? opts.base : R - 2;
      // 縦方向にゆるく暗く
      if (opts.vgrad) {
        const t = y / h;
        const drop = t * opts.vgrad + (PX.BAYER[y & 3][x & 3] - 0.5) * 0.9;
        lvl -= Math.max(0, Math.round(drop));
      }
      if (!on(x + 1, y) || !on(x, y + 1)) lvl -= 2;
      else if (!on(x + 2, y + 1) || !on(x + 1, y + 2)) lvl -= 1;
      if (!on(x - 1, y) || !on(x, y - 1)) lvl += 1;
      if (opts.rim && (!on(x - 1, y - 1)) && on(x + 1, y + 1)) lvl += 1;
      lvl = Math.max(0, Math.min(R - 1, lvl));
      o.fillStyle = ramp[lvl];
      o.fillRect(x, y, 1, 1);
    } else if (outline && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) {
      o.fillStyle = outline;
      o.fillRect(x, y, 1, 1);
    }
  }
  return out.cv;
};

// 既存の絵に輪郭を足す（透明部分の外周を塗る）
PX.outline = function (cv, col) {
  const w = cv.width, h = cv.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, w, h);
  const a = d.data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 128;
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) pts.push(x, y);
  }
  ctx.fillStyle = col;
  for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
  return cv;
};

// ---------------------------------------------------------------- lighting
// lights: [{x, y, r, i, col?}]  ambient: 0..1  night: [r,g,b] 乗算色 warm: [r,g,b]
PX.light = function (c, w, h, lights, o = {}) {
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const amb = o.ambient != null ? o.ambient : 0.15;
  const night = o.night || [0.36, 0.4, 0.68];
  const warm = o.warm || [1.12, 0.96, 0.74];
  const hot = o.hot || [1.35, 1.15, 0.85];
  const steps = o.steps || 6;
  const sy = o.yScale || 1.35; // 見下ろし視点では縦方向の距離を伸ばす
  const ambY = o.ambientY; // y に応じた環境光（空が明るいなど）
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let L = ambY ? ambY(y) : amb;
      for (const l of lights) {
        const dx = x - l.x, dy = (y - l.y) * sy;
        const dd = dx * dx + dy * dy;
        if (dd >= l.r * l.r) continue;
        const k = 1 - Math.sqrt(dd) / l.r;
        L += l.i * k * k * (l.soft ? 0.7 : 1);
      }
      // 段にしてディザ
      const q = Math.floor(L * steps + PX.BAYER[y & 3][x & 3]) / steps;
      let mr, mg, mb;
      if (q <= 1) {
        mr = night[0] + (warm[0] - night[0]) * q;
        mg = night[1] + (warm[1] - night[1]) * q;
        mb = night[2] + (warm[2] - night[2]) * q;
      } else {
        const t = Math.min(1, (q - 1) / 0.6);
        mr = warm[0] + (hot[0] - warm[0]) * t;
        mg = warm[1] + (hot[1] - warm[1]) * t;
        mb = warm[2] + (hot[2] - warm[2]) * t;
      }
      const i = (y * w + x) * 4;
      d[i] = Math.min(255, d[i] * mr);
      d[i + 1] = Math.min(255, d[i + 1] * mg);
      d[i + 2] = Math.min(255, d[i + 2] * mb);
    }
  }
  c.putImageData(img, 0, 0);
};

// ディザで描く光の輪（加算）
PX.glow = function (c, cx, cy, r, col, strength = 0.5, yScale = 1) {
  const [R, G, B] = PX.hex(col);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let y = Math.floor(cy - r / yScale); y <= cy + r / yScale; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dy = (y - cy) * yScale;
      const k = 1 - Math.sqrt(dx * dx + dy * dy) / r;
      if (k <= 0) continue;
      const v = k * k * strength;
      const lv = Math.floor(v * 4 + PX.BAYER[y & 3][x & 3]) / 4;
      if (lv <= 0) continue;
      c.fillStyle = `rgb(${R * lv},${G * lv},${B * lv})`;
      c.fillRect(x, y, 1, 1);
    }
  }
  c.restore();
};

// 低解像度の絵を整数倍で拡大
PX.upscale = function (src, scale, dst) {
  const out = dst || PX.canvas(src.width * scale, src.height * scale);
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(src, 0, 0, src.width * scale, src.height * scale);
  return out;
};
