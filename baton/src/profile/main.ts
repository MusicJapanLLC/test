import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { initAnalytics } from '../lib/analytics';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import {
  cursorGlow,
  drawRules,
  guardHeroPhoto,
  heroParallax,
  magneticButtons,
  mediaParallax,
  openingCurtain,
  revealHero,
  scrollProgress,
  splitHeadings,
  tiltCards,
} from './effects';
import { renderProfileFooter } from './footer';
import { renderProfileSections } from './render';

export function mountProfilePage(profileId: string): void {
  const profile = getProfile(profileId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderProfileSections(app, profile);
    renderProfileFooter(footer);

    openingCurtain();

    initSmoothScroll();
    splitHeadings(document);
    revealOnScroll(document);
    drawRules(document);
    mediaParallax();
    tiltCards(document);
    magneticButtons(document);
    scrollProgress();

    guardHeroPhoto(document);
    const hero = document.querySelector<HTMLElement>('[data-hero]');
    if (hero) {
      revealHero(hero);
      cursorGlow(hero);
      heroParallax(hero);
    }

    if (window.location.hash === '#talk-request') {
      window.requestAnimationFrame(() =>
        document.getElementById('talk-request')?.scrollIntoView({ block: 'start' }),
      );
    }

    // 3Dは、ヒーローの文字を出し切ってから読む（LCPを遅らせない）
    const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    if (canvas && shouldRender3D()) {
      if (profile.heavyWebGL) {
        // 人物ページ専用の背景。サービスページの立体とは別物
        whenIdle(() => {
          void import('./scene-hero')
            .then(({ mountProfileHeroScene }) => mountProfileHeroScene(canvas, profile.theme))
            .catch(() => {});
        }, 1200);
      } else if (profile.monument) {
        whenIdle(() => {
          void import('../service/scene-light')
            .then(({ mountLightScene }) => mountLightScene(canvas, profile.theme, profile.monument))
            .catch(() => {});
        }, 1500);
      }
    }

    // 写真そのものもWebGLに載せる。読めなければ元の <img> のまま
    const frame = document.querySelector<HTMLElement>('[data-shot] .pf-shot__frame');
    const shotImg = document.querySelector<HTMLImageElement>('[data-shot-img]');
    if (frame && shotImg && shouldRender3D()) {
      whenIdle(() => {
        void import('./photo-gl')
          .then(({ mountPortraitGL }) => mountPortraitGL(frame, shotImg))
          .catch(() => {});
      }, 1800);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
