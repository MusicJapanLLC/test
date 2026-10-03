/* ギルドの灯 — core: 名前空間・数学・乱数・色・書式 */
'use strict';
const G = (window.G = window.G || {});

G.VERSION = '0.2.0';
G.WORLD_W = 400;

// ---------- fonts ----------
//  ui   : 本文・ボタン（Zen Kaku Gothic New）
//  head : 見出し・技名・ロゴ（Shippori Mincho B1）
//  num  : 数字・欧文（Cinzel。和文は明朝に落ちる）
G.FONT = {
  ui: '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif',
  head: '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif',
  num: '"Cinzel", "Shippori Mincho B1", "Hiragino Mincho ProN", serif',
};
G.font = (w, px, kind = 'ui') => `${w} ${px}px ${G.FONT[kind] || G.FONT.ui}`;

// ---------- math ----------
G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
G.ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
};
// 0→1→0 の山（演出用）
G.bump = (t) => Math.sin(G.clamp(t, 0, 1) * Math.PI);
// 区間 [a,b] を 0..1 に
G.seg = (t, a, b) => G.clamp((t - a) / (b - a), 0, 1);

// ---------- random ----------
G.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
G.randi = (a, b) => Math.floor(G.rand(a, b + 1));
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
G.chance = (p) => Math.random() < p;
G.weighted = (items, wf) => {
  let total = 0;
  for (const it of items) total += wf(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= wf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
};
// 決定的な疑似乱数（キャラの見た目など、毎フレーム同じ値が欲しい所で使う）
G.hash = (n) => {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967295;
};
G.noise1 = (x) => {
  const i = Math.floor(x), f = x - i;
  const a = G.hash(i * 7919), b = G.hash((i + 1) * 7919);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
};

// ---------- color ----------
const _colorCache = new Map();
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (v) => G.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
G.rgb = hexToRgb;
// amt: -1..1  負なら暗く、正なら明るく
G.shade = (hex, amt) => {
  const key = hex + '|' + amt.toFixed(3);
  let v = _colorCache.get(key);
  if (v) return v;
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) v = rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  else v = rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  if (_colorCache.size > 6000) _colorCache.clear();
  _colorCache.set(key, v);
  return v;
};
G.mix = (a, b, t) => {
  const key = a + b + t.toFixed(3);
  let v = _colorCache.get(key);
  if (v) return v;
  const A = hexToRgb(a), B = hexToRgb(b);
  v = rgbToHex(G.lerp(A[0], B[0], t), G.lerp(A[1], B[1], t), G.lerp(A[2], B[2], t));
  if (_colorCache.size > 6000) _colorCache.clear();
  _colorCache.set(key, v);
  return v;
};
G.rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

// ---------- format ----------
G.fmt = (n) => {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('ja-JP');
  if (n < 1e8) {
    const v = n / 1e4;
    return (v < 100 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)) + '万';
  }
  if (n < 1e12) {
    const v = n / 1e8;
    return (v < 100 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)) + '億';
  }
  return (n / 1e12).toFixed(1) + '兆';
};
G.fmtTime = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return sec + '秒';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s ? `${m}分${s}秒` : `${m}分`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}時間${mm}分` : `${h}時間`;
};
// 時計表記 1:05 / 12:00:03
G.fmtClock = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (v) => String(v).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
};

G.now = () => Date.now() / 1000;

// ---------- tiny event bus ----------
const _ev = new Map();
G.on = (name, fn) => {
  if (!_ev.has(name)) _ev.set(name, []);
  _ev.get(name).push(fn);
};
G.emit = (name, data) => {
  const l = _ev.get(name);
  if (l) for (const fn of l.slice()) fn(data);
};

// ---------- haptics ----------
G.haptic = (ms = 8) => {
  try {
    if (G.state && G.state.settings && !G.state.settings.haptics) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) { /* noop */ }
};

G.reducedMotion = () => {
  try {
    if (G.state && G.state.settings && G.state.settings.reduceMotion) return true;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};

G.$ = (sel, root = document) => root.querySelector(sel);
G.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
G.el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
G.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
