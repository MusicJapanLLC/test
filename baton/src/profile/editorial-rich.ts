import { gsap, isLowPower, prefersReducedMotion, ScrollTrigger } from '../lib/motion';

/**
 * editorial プロフィール（unveil）だけの追加演出。
 *
 * 軸は社名と同じ「unveil ＝ 覆いを取る」。
 * 読み込み・スクロール・ホバーのどれもが「かかっていたものが外れて、
 * 下から本体が現れる」動きで揃うようにしている。
 * 壁谷さんの暗色ページとは反対に、こちらは紙と光の側で作る。
 *
 * どれも prefers-reduced-motion と非力な端末では静かに無効化する。
 */

type Teardown = () => void;

/**
 * ヒーローの見出しにかかっている布を、読み込み直後に一度だけ引き上げる。
 * 布の下端にはブロンズの細い線を置き、線が名前を通り過ぎていくように見せる。
 */
export function liftVeil(): void {
  const veil = document.querySelector<HTMLElement>('[data-veil]');
  if (!veil) return;

  if (prefersReducedMotion()) {
    veil.remove();
    return;
  }

  window.requestAnimationFrame(() => veil.classList.add('is-lifted'));
  window.setTimeout(() => veil.remove(), 1800);
}

/**
 * 紙の上を移動する光。指先のあたりだけがほんのり暖かくなる。
 * 暗色ページの cursorGlow と役割は同じだが、こちらは足すのが影ではなく光。
 */
export function paperLight(root: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const target = { x: 0.5, y: 0.3 };
  const smooth = { ...target };
  let raf = 0;

  const onMove = (e: PointerEvent) => {
    target.x = e.clientX / window.innerWidth;
    target.y = e.clientY / window.innerHeight;
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    smooth.x += (target.x - smooth.x) * 0.07;
    smooth.y += (target.y - smooth.y) * 0.07;
    root.style.setProperty('--paper-x', `${(smooth.x * 100).toFixed(2)}%`);
    root.style.setProperty('--paper-y', `${(smooth.y * 100).toFixed(2)}%`);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  root.classList.add('has-paper-light');
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    root.classList.remove('has-paper-light');
  };
}

/**
 * 本文の左に、読み進めるのに合わせて伸びていくブロンズの罫を引く。
 * 段落そのものは動かさない（読む邪魔をしない）。
 */
export function proseRule(scope: ParentNode = document): void {
  const blocks = Array.from(scope.querySelectorAll<HTMLElement>('body.profile--editorial .prose'));
  if (!blocks.length) return;

  blocks.forEach((block) => {
    block.classList.add('prose--ruled');
    if (prefersReducedMotion()) {
      block.classList.add('is-drawn');
      return;
    }
    ScrollTrigger.create({
      trigger: block,
      start: 'top 85%',
      once: true,
      onEnter: () => block.classList.add('is-drawn'),
    });
  });
}

/**
 * 一覧の行に、ホバーで左から右へ淡い色が差す下地を1枚ずつ足す。
 * 罫線や文字はそのままで、背後の紙の色だけが変わるように見せる。
 */
export function rowWash(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>('body.profile--editorial .service-item')
    .forEach((row) => row.classList.add('service-item--wash'));
}

/**
 * 節の見出しが画面に入るたび、ラベルの前の罫を引き直す。
 * editorial 側は文字を分解せず、罫と余白だけで間を作る。
 */
export function labelRules(scope: ParentNode = document): void {
  const labels = Array.from(
    scope.querySelectorAll<HTMLElement>('body.profile--editorial .section__label'),
  );
  if (!labels.length) return;

  labels.forEach((label) => {
    if (prefersReducedMotion()) {
      label.classList.add('is-drawn');
      return;
    }
    ScrollTrigger.create({
      trigger: label,
      start: 'top 90%',
      once: true,
      onEnter: () => label.classList.add('is-drawn'),
    });
  });
}

/** ヒーローの植物と本文を、スクロールに合わせて別々の速さで送る */
export function editorialDepth(hero: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const art = hero.querySelector<HTMLElement>('[data-editorial-parallax]');
  const inner = hero.querySelector<HTMLElement>('.hero__inner--editorial');

  const ctx = gsap.context(() => {
    const scrollTrigger = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    if (art) gsap.to(art, { yPercent: 12, scale: 1.06, ease: 'none', scrollTrigger });
    if (inner) gsap.to(inner, { yPercent: 8, opacity: 0.3, ease: 'none', scrollTrigger });
  }, hero);

  ScrollTrigger.refresh();
  return () => ctx.revert();
}

/** editorial プロフィールのページで、DOM構築後に1回呼ぶ */
export function initEditorialRich(): Teardown[] {
  const teardowns: Teardown[] = [];

  liftVeil();
  proseRule(document);
  rowWash(document);
  labelRules(document);
  teardowns.push(paperLight(document.body));

  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (hero) teardowns.push(editorialDepth(hero));

  return teardowns;
}
