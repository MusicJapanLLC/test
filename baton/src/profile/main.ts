import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { initAnalytics } from '../lib/analytics';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, isCoarsePointer, prefersReducedMotion, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from './footer';
import { renderProfileSections } from './render';

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

export function mountProfilePage(profileId: string): void {
  const profile = getProfile(profileId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderProfileSections(app, profile);
    renderProfileFooter(footer);

    initSmoothScroll();
    revealOnScroll(document);
    initEditorialParallax();

    if (window.location.hash === '#talk-request') {
      window.requestAnimationFrame(() =>
        document.getElementById('talk-request')?.scrollIntoView({ block: 'start' }),
      );
    }

    // monument / heavyWebGL を持つプロフィール（実データ入りの「ミニLP」）だけ、
    // サービスページと同じ3Dヒーローを読み込む
    const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    if (canvas && shouldRender3D()) {
      if (profile.heavyWebGL) {
        whenIdle(() => {
          void import('../service/scene-standment')
            .then(({ mountStandmentScene }) => mountStandmentScene(canvas, profile.theme))
            .catch(() => {});
        }, 1500);
      } else if (profile.monument) {
        whenIdle(() => {
          void import('../service/scene-light')
            .then(({ mountLightScene }) => mountLightScene(canvas, profile.theme, profile.monument))
            .catch(() => {});
        }, 1500);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
