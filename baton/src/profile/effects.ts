import { gsap, isLowPower, prefersReducedMotion, ScrollTrigger } from '../lib/motion';

/**
 * プロフィールページのヒーロー演出。
 * 「動きを減らす設定」と非力な端末では、いずれも静かに無効化する。
 * 見栄えのための演出が、読むことの邪魔をしないようにする。
 */

type Teardown = () => void;

/**
 * 写真が読めなかったときは頭文字表示に戻す。
 * 写真ファイルを置く前でもページが成立するようにしておく。
 */
export function guardHeroPhoto(scope: ParentNode = document): void {
  const img = scope.querySelector<HTMLImageElement>('[data-shot-img]');
  const shot = scope.querySelector<HTMLElement>('[data-shot]');
  if (!img || !shot) return;

  const fallback = () => shot.classList.add('pf-shot--noimg');

  if (img.complete && img.naturalWidth === 0) fallback();
  img.addEventListener('error', fallback, { once: true });
}

/** 名前・写真・罫を順に立ち上げる。合図（.is-in）だけJSが出す */
export function revealHero(hero: HTMLElement): void {
  window.requestAnimationFrame(() => hero.classList.add('is-in'));
}

/** カーソルに追従する光。座標はCSS変数で渡し、描画はCSSに任せる */
export function cursorGlow(hero: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const target = { x: 0.5, y: 0.35 };
  const smooth = { ...target };
  let raf = 0;

  const onMove = (e: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    target.x = (e.clientX - rect.left) / rect.width;
    target.y = (e.clientY - rect.top) / rect.height;
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    smooth.x += (target.x - smooth.x) * 0.08;
    smooth.y += (target.y - smooth.y) * 0.08;
    hero.style.setProperty('--glow-x', `${(smooth.x * 100).toFixed(2)}%`);
    hero.style.setProperty('--glow-y', `${(smooth.y * 100).toFixed(2)}%`);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  hero.classList.add('has-glow');
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    hero.classList.remove('has-glow');
  };
}

/** 写真と文字を、スクロールに合わせてわずかにずらす。振り幅は小さく保つ */
export function heroParallax(hero: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const shot = hero.querySelector<HTMLElement>('[data-shot]');
  const lead = hero.querySelector<HTMLElement>('.pf-lead');

  const ctx = gsap.context(() => {
    const scrollTrigger = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    if (shot) gsap.to(shot, { yPercent: -8, ease: 'none', scrollTrigger });
    if (lead) gsap.to(lead, { yPercent: 6, opacity: 0.25, ease: 'none', scrollTrigger });
  }, hero);

  ScrollTrigger.refresh();
  return () => ctx.revert();
}
