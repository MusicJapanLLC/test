import { prefersReducedMotion } from './env';

/**
 * ページ全体の動き。1本の requestAnimationFrame でまとめて回す。
 * 「動きを減らす」設定のときは、見た目の完成形だけ出して何も動かさない。
 */

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Tick = (dt: number, velocity: number) => void;
const ticks: Tick[] = [];
let lastY = window.scrollY;
let velocity = 0;

function loop(prev: number) {
  requestAnimationFrame((now) => {
    const dt = Math.min(64, now - prev) / 16.67;
    const y = window.scrollY;
    velocity = lerp(velocity, (y - lastY) / Math.max(dt, 0.5), 0.2);
    lastY = y;
    for (const t of ticks) t(dt, velocity);
    loop(now);
  });
}

// ── 見出しを1文字ずつに分け、2行目は企業色のグラデーションで塗る ──
function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function hex(c: string): number[] {
  const m = c.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
}
function gradientAt(stops: number[][], t: number) {
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const local = t * (stops.length - 1) - seg;
  return `rgb(${mix(stops[seg], stops[seg + 1], local).join(',')})`;
}

export function splitHeadings(): void {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  const stops = [v('--brand'), v('--scene-match') || v('--brand'), v('--brand-2') || v('--brand')]
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
    .map(hex);

  document.querySelectorAll<HTMLElement>('.hero-h, .phero-h').forEach((h) => {
    let c = 0;
    h.querySelectorAll<HTMLElement>('.ph').forEach((ph) => {
      const text = ph.textContent ?? '';
      ph.textContent = '';
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--c', String(c++));
        s.textContent = ch;
        ph.append(s);
      }
    });
    h.classList.add('split');
  });

  // 2行目（.ln + .ln）を、1文字ずつ色を変えてグラデーションに
  // mono・console の世界観では色のグラデーションを使わない（2行目は帯に白抜き）
  if (stops.length >= 2 && !['mono', 'console', 'minka', 'studio'].includes(document.body.dataset.theme ?? '')) {
    document.querySelectorAll<HTMLElement>('.hero-h .ln + .ln, .hl-h .ln + .ln').forEach((ln) => {
      const units = ln.querySelectorAll<HTMLElement>('.ch').length ? ln.querySelectorAll<HTMLElement>('.ch') : ln.querySelectorAll<HTMLElement>('.ph');
      const n = units.length;
      units.forEach((u, i) => (u.style.color = gradientAt(stops, n > 1 ? i / (n - 1) : 0)));
      ln.classList.add('is-grad');
    });
  }
}

// ── 数字のカウントアップ ──
function countUp(el: HTMLElement) {
  const raw = el.textContent ?? '';
  const m = /^([+\-−]?)(\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) return;
  const [, sign, num] = m;
  const target = Number(num);
  if (!target) return;
  // 小数の実績（34.91% など）は、桁を丸めずに最後まで同じ桁数で数える
  const digits = num.split('.')[1]?.length ?? 0;
  const start = performance.now();
  const dur = 1600;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = t < 1 ? `${sign}${(target * e).toFixed(digits)}` : raw.trim();
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = `${sign}${(0).toFixed(digits)}`;
  requestAnimationFrame(step);
}

// ── 英字がランダムな文字から正しい綴りに落ち着く ──
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789—/';
function scramble(node: Text) {
  const final = node.data;
  if (!/[A-Za-z]/.test(final)) return;
  // 経過時間で進める（端末が重くてコマ落ちしても、0.7秒で必ず正しい綴りに戻る）
  const start = performance.now();
  const dur = 700;
  const run = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const reveal = Math.floor(t * final.length);
    node.data =
      t >= 1
        ? final
        : [...final].map((ch, i) => (i < reveal || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
    if (t < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
  window.setTimeout(() => (node.data = final), dur + 400);
}

function onEnter(els: Iterable<Element>, fn: (el: HTMLElement) => void, margin = '-10% 0px') {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        fn(e.target as HTMLElement);
      }
    },
    { rootMargin: margin },
  );
  for (const el of els) io.observe(el);
}

// ── ページ切り替えの幕 ──
const NAV_KEY = 'bp-nav';
function setupTransitions() {
  const html = document.documentElement;
  // 幕はサイト内でページを移るときだけ。検索から初めて来た人には、すぐ本文を見せる（LCPを遅らせない）
  let entering = false;
  try {
    entering = sessionStorage.getItem(NAV_KEY) === '1';
    sessionStorage.removeItem(NAV_KEY);
  } catch {
    entering = false;
  }
  if (entering) {
    html.classList.add('is-entering');
    window.setTimeout(() => html.classList.remove('is-entering'), 1700);
  }
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) html.classList.remove('is-leaving', 'is-entering');
  });

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    try {
      sessionStorage.setItem(NAV_KEY, '1');
    } catch {
      /* 保存できなくても遷移はする */
    }
    html.classList.add('is-leaving');
    window.setTimeout(() => (location.href = url.href), 560);
  });
}

// ── カスタムカーソル ──
function setupCursor() {
  const el = document.querySelector<HTMLElement>('[data-cursor-el]');
  const label = document.querySelector<HTMLElement>('[data-cursor-label]');
  if (!el || !finePointer()) return;
  document.documentElement.classList.add('has-cursor');
  let x = -99;
  let y = -99;
  let rx = x;
  let ry = y;
  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
    },
    { passive: true },
  );
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('a, button, label, summary, [data-tilt], [data-cursor]');
    const text = t?.dataset.cursor ?? (t?.classList.contains('cover') ? 'Read' : '');
    el.classList.toggle('is-link', Boolean(t));
    el.classList.toggle('is-label', Boolean(text));
    if (label) label.textContent = text;
  });
  ticks.push((dt) => {
    // 止まっているときは書き換えない（毎フレームのスタイル計算を減らす）
    if (Math.abs(rx - x) < 0.1 && Math.abs(ry - y) < 0.1) return;
    rx = lerp(rx, x, 0.18 * dt);
    ry = lerp(ry, y, 0.18 * dt);
    el.style.setProperty('--dx', `${x}px`);
    el.style.setProperty('--dy', `${y}px`);
    el.style.setProperty('--rx', `${rx}px`);
    el.style.setProperty('--ry', `${ry}px`);
  });
}

// ── ボタンがカーソルに吸い付く ──
function setupMagnetic() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('.btn, .menu-btn, .link-arrow').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
      b.style.setProperty('--my', `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
    });
    b.addEventListener('pointerleave', () => {
      b.style.setProperty('--mx', '0px');
      b.style.setProperty('--my', '0px');
    });
  });
}

// ── カードが傾き、光が当たる ──
const TILT = '.feat, .stance, .cover, .issue, .hl-step, .step, .pcard, .line-card, .promo, .stat, .fits li';
function setupTilt() {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>(TILT).forEach((c) => {
    c.dataset.tilt = '';
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      c.classList.add('is-tilting');
      c.style.setProperty('--ty', `${(px - 0.5) * 7}deg`);
      c.style.setProperty('--tx', `${(0.5 - py) * 7}deg`);
      c.style.setProperty('--gx', `${px * 100}%`);
      c.style.setProperty('--gy', `${py * 100}%`);
    });
    c.addEventListener('pointerleave', () => {
      c.classList.remove('is-tilting');
      c.style.setProperty('--tx', '0deg');
      c.style.setProperty('--ty', '0deg');
    });
  });
}

// ── 流れるテキスト帯：スクロールの速さで加速し、傾く ──
function setupMarquees() {
  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((m) => {
    const track = m.querySelector<HTMLElement>('.mq-track');
    const run = m.querySelector<HTMLElement>('.mq-run');
    if (!track || !run) return;
    const dir = m.classList.contains('mq-rev') ? 1 : -1;
    const base = m.classList.contains('mq-md') ? 0.6 : 1.1;
    let x = 0;
    let skew = 0;
    let visible = true;
    // 幅は大きさが変わったときだけ測る（毎フレーム offsetWidth を読むとレイアウトの再計算が走る）
    let w = run.offsetWidth || 1;
    new ResizeObserver(() => (w = run.offsetWidth || 1)).observe(run);
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(m);
    ticks.push((dt, v) => {
      if (!visible) return;
      x += (base + Math.min(Math.abs(v) * 0.35, 30)) * dt * dir;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      skew = lerp(skew, Math.max(-9, Math.min(9, -v * 0.35)), 0.12);
      track.style.setProperty('--mq-x', `${x}px`);
      track.style.setProperty('--mq-skew', `${skew}deg`);
    });
  });
}

// ── スクロール進捗・ヘッダーの出し入れ・視差 ──
function setupScrollBits() {
  const bar = document.querySelector<HTMLElement>('[data-scroll-progress]');
  const hdr = document.querySelector<HTMLElement>('[data-hdr]');
  const parallax = [...document.querySelectorAll<HTMLElement>('.phero-logo, .statement-p, .cta-band-h, .svc-head .logo-plate, .hl-head')];
  let hidden = false;
  let acc = 0;
  // ページの高さは、大きさが変わったときだけ測る
  let max = 0;
  const measure = () => (max = document.documentElement.scrollHeight - window.innerHeight);
  measure();
  new ResizeObserver(measure).observe(document.body);
  window.addEventListener('resize', measure, { passive: true });
  let lastSeen = -1;
  ticks.push((_dt, v) => {
    // スクロールしていないフレームでは何もしない
    const y = window.scrollY;
    if (y === lastSeen && Math.abs(v) < 0.01) return;
    lastSeen = y;
    bar?.style.setProperty('--sp', String(max > 0 ? y / max : 0));
    if (hdr && !document.documentElement.classList.contains('menu-open')) {
      acc = Math.sign(v) === Math.sign(acc) ? acc + v : v;
      const shouldHide = window.scrollY > 240 && acc > 24;
      const shouldShow = acc < -12 || window.scrollY < 120;
      if (shouldHide && !hidden) hdr.classList.add('is-hidden'), (hidden = true);
      else if (shouldShow && hidden) hdr.classList.remove('is-hidden'), (hidden = false);
    }
    // 位置をまとめて読んでから、まとめて書く（読み書きを交互にしない）
    const vh = window.innerHeight;
    const rects = parallax.map((el) => el.getBoundingClientRect());
    parallax.forEach((el, i) => {
      const r = rects[i];
      if (r.bottom < -100 || r.top > vh + 100) return;
      const off = (r.top + r.height / 2 - vh / 2) * -0.08;
      el.style.translate = `0 ${off.toFixed(1)}px`;
    });
  });
}

export function setupFx(): void {
  const reduced = prefersReducedMotion();
  splitHeadings();
  if (reduced) return;

  setupTransitions();
  setupCursor();
  setupMagnetic();
  setupTilt();
  setupMarquees();
  setupScrollBits();

  onEnter(document.querySelectorAll('.stat-num'), countUp);
  onEnter(document.querySelectorAll('.kicker, .flow-en, .feat-meta'), (k) => {
    const walker = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) scramble(n as Text);
  }, '0px');

  loop(performance.now());
}
