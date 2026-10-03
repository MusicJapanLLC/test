import { prefersReducedMotion } from './env';

/**
 * 曲目リスト（needle の世界観・トップの「専用LP×SEO×AIO×紹介」）。
 *   見えている間は、1曲ずつ再生バーが伸びて次の曲へ進む（最初に触れるまで）
 *   曲名を押すと、その曲を開く。自動で進むのはそこで止める（読んでいる途中で閉じないように）
 *   JSなし・「動きを減らす」設定では、すべての曲を開いたまま見せる（CSS）
 */
const DURATION = 6500;

export function setupTracklist(): void {
  const root = document.querySelector<HTMLElement>('[data-tracklist]');
  if (!root) return;
  const items = [...root.querySelectorAll<HTMLElement>('[data-track]')];
  if (!items.length) return;
  const now = root.querySelector<HTMLElement>('[data-now]');
  const player = root.querySelector<HTMLElement>('.player');
  const still = prefersReducedMotion();
  if (still) {
    root.classList.add('is-still');
    return;
  }
  root.classList.add('is-live');

  let current = -1;
  let auto = true;
  let inView = false;
  const visible = () => inView && !document.hidden;
  let start = 0;
  let raf = 0;

  const label = (i: number) => {
    const el = items[i];
    const no = el.querySelector('.tr-no')?.textContent ?? '';
    const name = el.querySelector('.tr-name')?.textContent ?? '';
    return `${no} ${name}`.trim();
  };

  const select = (i: number) => {
    if (i === current) return;
    current = i;
    items.forEach((el, k) => {
      const on = k === i;
      el.classList.toggle('is-on', on);
      el.querySelector('.track-row')?.setAttribute('aria-expanded', String(on));
      if (!on) el.style.setProperty('--p', '0');
    });
    if (now) now.textContent = label(i);
    // 曲が変わるたび、盤を少しだけ速く回す
    player?.classList.remove('is-cue');
    void player?.offsetWidth;
    player?.classList.add('is-cue');
    start = performance.now();
  };

  const tick = (t: number) => {
    raf = 0;
    if (!auto || !visible()) return;
    const p = Math.min(1, (t - start) / DURATION);
    items[current]?.style.setProperty('--p', p.toFixed(3));
    if (p >= 1) select((current + 1) % items.length);
    raf = requestAnimationFrame(tick);
  };
  const run = () => {
    if (!raf && auto && visible()) {
      // 見えなくなっていた間の時間は数えない
      const done = Number(items[current]?.style.getPropertyValue('--p') || 0);
      start = performance.now() - done * DURATION;
      raf = requestAnimationFrame(tick);
    }
  };

  items.forEach((el, i) => {
    el.querySelector('.track-row')?.addEventListener('click', () => {
      auto = false;
      root.classList.add('is-picked');
      select(i);
      items[i].style.setProperty('--p', '1');
    });
  });

  select(0);
  new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      run();
    },
    { threshold: 0.35 },
  ).observe(root.querySelector('.player') ?? root);
  document.addEventListener('visibilitychange', run);
}
