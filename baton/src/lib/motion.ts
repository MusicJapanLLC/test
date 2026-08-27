import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/** 動きを減らす設定。ONなら3DもGSAPも動かさず、静的に見せる */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** スマホ・非力な端末では負荷を落とす判断に使う */
export const isLowPower = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 4;
  return isCoarsePointer() || cores <= 4 || window.innerWidth < 768;
};

let lenis: Lenis | null = null;

export function initSmoothScroll(): Lenis | null {
  if (prefersReducedMotion()) return null;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function scrollTo(target: string | HTMLElement, offset = 0): void {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.1 });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * [data-reveal] を順に現れさせる。過剰にしない: 上下18px・0.7秒まで。
 * 動きを減らす設定のときは即座に表示する。
 */
export function revealOnScroll(scope: ParentNode = document): void {
  const items = Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!items.length) return;

  if (prefersReducedMotion()) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const groups = new Map<Element, HTMLElement[]>();
  items.forEach((el) => {
    const key = el.closest('[data-reveal-group]') ?? el;
    const list = groups.get(key) ?? [];
    list.push(el);
    groups.set(key, list);
  });

  groups.forEach((list, key) => {
    ScrollTrigger.create({
      trigger: key as Element,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        list.forEach((el, i) => {
          window.setTimeout(() => el.classList.add('is-in'), i * 90);
        });
      },
    });
  });
}

/** 数字のカウントアップ。数値として読めない値はそのまま表示する */
export function countUp(el: HTMLElement, raw: string): void {
  const match = raw.match(/^([+\-]?)([\d,]+(?:\.\d+)?)$/);
  if (!match || prefersReducedMotion()) {
    el.textContent = raw;
    return;
  }

  const sign = match[1];
  const digits = match[2].replace(/,/g, '');
  const target = Number(digits);
  const grouped = match[2].includes(',');
  const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;

  const render = (n: number) => {
    const fixed = n.toFixed(decimals);
    const [int, dec] = fixed.split('.');
    const withCommas = grouped ? Number(int).toLocaleString('en-US') : int;
    el.textContent = `${sign}${withCommas}${dec ? `.${dec}` : ''}`;
  };

  render(0);
  const state = { n: 0 };

  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter: () => {
      gsap.to(state, {
        n: target,
        duration: 1.5,
        ease: 'power2.out',
        onUpdate: () => render(state.n),
      });
    },
  });
}

export { gsap, ScrollTrigger };
