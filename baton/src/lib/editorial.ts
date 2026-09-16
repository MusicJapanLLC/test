import type { TalkProfile } from '../types';
import { shouldRender3D, whenIdle } from './capabilities';
import { gsap, isCoarsePointer, prefersReducedMotion } from './motion';

/**
 * editorial ヒーロー（heroVariant: 'editorial'）専用の演出まとめ。
 * 本番ページ（profile/main.ts）と単一ファイルプレビュー（preview/unveil-only.ts）の
 * 両方から使うため、ここに1箇所へまとめている。
 */

/**
 * editorial ヒーローの植物シルエットに、ポインター位置に応じたごく僅かな
 * 視差を付ける。3Dヒーローの pointerTracker と同じ発想の軽量版（DOM/CSS
 * transformのみ・WebGL不使用）。指の環境・動きを減らす設定では何もしない。
 */
function initEditorialParallax(): void {
  if (prefersReducedMotion() || isCoarsePointer()) return;
  const art = document.querySelector<HTMLElement>('[data-editorial-parallax]');
  const hero = document.querySelector<HTMLElement>('.hero--editorial');
  if (!art || !hero) return;

  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    art.style.transform = `translate3d(${px * -18}px, ${py * -14}px, 0)`;
  });

  hero.addEventListener('pointerleave', () => {
    art.style.transform = '';
  });
}

/**
 * editorial プロフィールの記事カードに、ポインター位置に応じたごく僅かな
 * 3D傾き（perspective tilt）を付ける。指の環境・動きを減らす設定では何もしない。
 */
function initTiltCards(): void {
  if (prefersReducedMotion() || isCoarsePointer()) return;
  const cards = document.querySelectorAll<HTMLElement>('body.profile--editorial .media-card');
  cards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${py * -7}deg) rotateY(${px * 9}deg) translateZ(4px)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}

/**
 * editorial プロフィールの本文セクションに、スクロールに応じた緩やかな視差を付ける
 * （見出しラベルが本文よりわずかに遅れて動く）。gsap/ScrollTriggerは
 * revealOnScrollで既に読み込まれているものを再利用する。
 */
function initEditorialScrollDepth(): void {
  if (prefersReducedMotion()) return;
  const heads = document.querySelectorAll<HTMLElement>('body.profile--editorial .section__head');
  heads.forEach((head) => {
    gsap.fromTo(
      head,
      { y: 26 },
      {
        y: -10,
        ease: 'none',
        scrollTrigger: {
          trigger: head,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      },
    );
  });
}

/** editorial ヒーローを持つプロフィールのページで、DOM構築後に1回呼ぶ */
export function initEditorialMotion(): void {
  initEditorialParallax();
  initTiltCards();
  initEditorialScrollDepth();
}

/**
 * editorial ヒーローの `[data-hero-canvas]` に、対応環境でだけ軽量WebGL演出を
 * 読み込む。動きを減らす設定・非対応環境では何もせず、CSSの静的な花影のまま。
 */
export function mountEditorialWebGL(profile: TalkProfile): void {
  if (profile.heroVariant !== 'editorial') return;
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (!canvas || !shouldRender3D()) return;

  whenIdle(() => {
    void import('../service/scene-editorial')
      .then(({ mountEditorialScene }) => mountEditorialScene(canvas, profile.theme))
      .catch(() => {});
  }, 1200);
}
