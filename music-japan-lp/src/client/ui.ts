import { ScrollTrigger } from './motion';
import type { World } from './world/world';
import { HUBS, L } from './world/layouts';

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));

/** エコシステム：点を選ぶと説明が変わる。WebGLがあれば、ボタンを3Dのハブの位置に重ねる */
export function ecosystem(getWorld: () => World | null) {
  const map = $('[data-eco-map]');
  if (!map) return;
  const nodes = $$('[data-node]', map);
  const infos = $$('[data-info]');
  const select = (id: string) => {
    nodes.forEach((n) => {
      const on = n.dataset.node === id;
      n.classList.toggle('is-active', on);
      n.setAttribute('aria-pressed', String(on));
    });
    infos.forEach((i) => (i.hidden = i.dataset.info !== id));
    getWorld()?.setHighlight(L.NETWORK, HUBS.findIndex((h) => h.id === id));
  };
  nodes.forEach((n) => n.addEventListener('click', () => select(n.dataset.node!)));
  select('mj');

  // 代替表示（WebGLなし）：SVGの線をボタンの位置どうしで結ぶ
  const svgLines = $$<HTMLElement & SVGLineElement>('[data-edge]', map);
  const place = () => {
    const box = map.getBoundingClientRect();
    if (!box.width) return;
    svgLines.forEach((ln) => {
      const [a, b] = (ln.dataset.edge ?? '').split('-');
      const na = nodes.find((n) => n.dataset.node === a);
      const nb = nodes.find((n) => n.dataset.node === b);
      if (!na || !nb) return;
      const ra = na.getBoundingClientRect();
      const rb = nb.getBoundingClientRect();
      const x1 = ((ra.left + ra.width / 2 - box.left) / box.width) * 100;
      const y1 = ((ra.top + 11 - box.top) / box.height) * 100;
      const x2 = ((rb.left + rb.width / 2 - box.left) / box.width) * 100;
      const y2 = ((rb.top + 11 - box.top) / box.height) * 100;
      ln.setAttribute('x1', String(x1));
      ln.setAttribute('y1', String(y1));
      ln.setAttribute('x2', String(x2));
      ln.setAttribute('y2', String(y2));
    });
  };
  place();
  window.addEventListener('resize', place);
}

/** WebGLのハブ・ページの位置に、DOMのラベルを重ねる（毎フレーム） */
export function labelsFollow(world: World) {
  const map = $('[data-eco-map]');
  const nodes = map ? $$('[data-node]', map) : [];
  const anaBox = $('.ana-labels');
  const anaLabels = $$('[data-page-label]');
  const talkBox = $('[data-talk-link]');
  const talkPts = $$('[data-talk-pt]');
  world.frame((w) => {
    if (map) {
      const vis = w.weight(L.NETWORK);
      const box = map.getBoundingClientRect();
      nodes.forEach((n) => {
        const k = HUBS.findIndex((h) => h.id === n.dataset.node);
        const p = w.screen(L.NETWORK, k);
        if (!p) return;
        n.style.setProperty('--sx', `${(p.x - box.left).toFixed(1)}px`);
        n.style.setProperty('--sy', `${(p.y - box.top).toFixed(1)}px`);
        n.style.setProperty('--vis', vis > 0.6 ? '1' : String(Math.max(0, (vis - 0.3) / 0.3)));
        n.style.pointerEvents = vis > 0.6 ? 'auto' : 'none';
      });
    }
    if (anaBox) {
      const vis = w.weight(L.PAGES);
      const box = anaBox.getBoundingClientRect();
      const narrow = box.width < 560;
      anaLabels.forEach((el, k) => {
        const p = w.screen(L.PAGES, k);
        if (!p) return;
        // 札は中心で置く（translate -50%）。箱の左右からはみ出さないように
        const half = el.offsetWidth / 2 + 4;
        const x = Math.min(Math.max(p.x - box.left + (narrow ? 24 : 70), half), box.width - half);
        el.style.setProperty('--sx', `${x.toFixed(1)}px`);
        el.style.setProperty('--sy', `${(p.y - box.top - (narrow ? 44 : 70)).toFixed(1)}px`);
        el.style.setProperty('--vis', String(Math.max(0, (vis - 0.4) / 0.6)));
      });
    }
    if (talkBox) {
      const vis = w.weight(L.CONNECT);
      const box = talkBox.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      talkPts.forEach((el, k) => {
        const p = w.screen(L.CONNECT, k);
        if (!p) return;
        const half = el.offsetWidth / 2 + 6;
        const x = Math.min(Math.max(p.x, half), vw - half);
        el.style.setProperty('--sx', `${(x - box.left).toFixed(1)}px`);
        el.style.setProperty('--sy', `${(p.y - box.top).toFixed(1)}px`);
        el.style.setProperty('--vis', String(Math.max(0, (vis - 0.5) / 0.5)));
      });
    }
  });
}

/** 1社分のページ：読んでいる項目に合わせて、該当するページを光らせる */
export function anatomy(onPage: (page: number) => void) {
  const parts = $$('[data-part]');
  const labels = $$('[data-page-label]');
  const sheets = $$('[data-sheet]');
  const activate = (el: HTMLElement) => {
    parts.forEach((p) => p.classList.toggle('is-on', p === el));
    const page = Number(el.dataset.page);
    labels.forEach((l, i) => l.classList.toggle('is-hi', page === -1 || i === page));
    sheets.forEach((s, i) => s.classList.toggle('is-hi', page === -1 || i === page));
    onPage(page);
  };
  parts.forEach((p) =>
    ScrollTrigger.create({
      trigger: p,
      start: 'top 62%',
      end: 'bottom 38%',
      onToggle: (self) => self.isActive && activate(p),
    }),
  );
  if (parts[0]) activate(parts[0]);
}

/** 一社のページができるまで：いまの工程を強調し、進み具合を出す */
export function buildSteps() {
  const steps = $$('.build-step');
  const bar = $('[data-build-bar]');
  const count = $('[data-build-count]');
  return (p: number, idx: number) => {
    steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
    bar?.style.setProperty('--p', p.toFixed(3));
    if (count) count.textContent = String(idx + 1).padStart(2, '0');
  };
}

/** NOW：種類で絞り込む（View Transitions API があれば、カードがなめらかに並び替わる） */
export function feed() {
  const chips = $$('[data-filter]');
  const cards = $$('.card');
  const apply = (f: string) => {
    chips.forEach((c) => {
      const on = c.dataset.filter === f;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    cards.forEach((c) => (c.hidden = f !== 'ALL' && c.dataset.type !== f));
    ScrollTrigger.refresh();
  };
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const f = c.dataset.filter!;
      const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(() => apply(f));
      else apply(f);
    }),
  );
}

/** 公開中のページ：カーソルで傾き、2枚目の画面に切り替わる */
export function projects(reduced: boolean) {
  $$('[data-proj]').forEach((proj) => {
    const media = $('[data-tilt]', proj)!;
    const browser = $('.proj-browser', media)!;
    const phone = $('.proj-phone', media)!;
    if (!reduced) {
      media.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = media.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        browser.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
        browser.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
        phone.style.setProperty('--px', `${(x * -26).toFixed(1)}px`);
        phone.style.setProperty('--py', `${(y * -20).toFixed(1)}px`);
      });
      media.addEventListener('pointerleave', () => {
        browser.style.setProperty('--ry', '0deg');
        browser.style.setProperty('--rx', '0deg');
        phone.style.setProperty('--px', '0px');
        phone.style.setProperty('--py', '0px');
      });
    }
    // 画面に入っているあいだ、4秒ごとに2枚目へ
    let timer = 0;
    ScrollTrigger.create({
      trigger: proj,
      start: 'top 75%',
      end: 'bottom 25%',
      onToggle: (self) => {
        window.clearInterval(timer);
        if (self.isActive && !reduced) timer = window.setInterval(() => proj.classList.toggle('is-alt'), 4200);
      },
    });
  });
}

/** 検索の図：言葉を打ち込む */
export function serpTyping(reduced: boolean) {
  const q = $('[data-serp-q]');
  if (!q || reduced) return;
  const text = q.dataset.text ?? q.textContent ?? '';
  q.textContent = '';
  ScrollTrigger.create({
    trigger: q,
    start: 'top 80%',
    once: true,
    onEnter: () => {
      let i = 0;
      const tick = () => {
        q.textContent = text.slice(0, ++i);
        if (i < text.length) window.setTimeout(tick, 90 + Math.random() * 80);
      };
      tick();
    },
  });
}

/** WebGLが使えないときだけ：SECOND TAKE の波形を2Dで描く */
export function waveFallback() {
  const c = $<HTMLCanvasElement>('[data-wave]');
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => {
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
  };
  size();
  window.addEventListener('resize', size);
  const draw = (t: number) => {
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    for (let g = 0; g < 7; g++) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.3 + g * 0.08), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239,233,224,${0.08 + g * 0.015})`;
      ctx.lineWidth = dpr;
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const k = Math.sin(a * 9 + t * 0.0024) * 0.55 + Math.sin(a * 23 - t * 0.0037) * 0.3;
      const r = R * (1 + k * 0.05);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#ff2f3e';
    ctx.lineWidth = 2 * dpr;
    ctx.shadowColor = '#ff2f3e';
    ctx.shadowBlur = 18 * dpr;
    ctx.stroke();
    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
