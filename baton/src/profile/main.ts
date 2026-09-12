import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileSections } from './render';

export function mountProfilePage(profileId: string): void {
  const profile = getProfile(profileId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderProfileSections(app, profile);
    renderFooter(footer, { backToHub: true });

    initSmoothScroll();
    revealOnScroll(document);

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
