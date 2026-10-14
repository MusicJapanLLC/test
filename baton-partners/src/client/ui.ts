import Lenis from 'lenis';
import { prefersReducedMotion } from './env';

export function setupHeader(): void {
  const hdr = document.querySelector<HTMLElement>('[data-hdr]');
  if (!hdr) return;
  const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function setupMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!btn || !menu) return;
  const label = btn.querySelector('.menu-label');
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.documentElement.classList.toggle('menu-open', open);
    if (label) label.textContent = open ? 'Close' : 'Menu';
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      set(false);
      btn.focus();
    }
  });
  window.matchMedia('(min-width: 960px)').addEventListener('change', (e) => e.matches && set(false));
}

export function setupReveal(): void {
  const items = document.querySelectorAll<HTMLElement>('.rv');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

/** 記事の目次：いま読んでいる節をハイライト */
export function setupToc(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc-side a')];
  if (!links.length) return;
  const map = new Map(links.map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.remove('is-active'));
        map.get(e.target.id)?.classList.add('is-active');
      }
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  document.querySelectorAll('.a-sec').forEach((s) => io.observe(s));
}

/** PCだけ慣性スクロール。タッチ端末と「動きを減らす」設定では使わない */
export function setupSmoothScroll(): void {
  if (prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;
  const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -96 } });
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
