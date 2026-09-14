import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';
import '../styles/profile-kabeya.css';

import { getProfile } from '../data/profiles';
import { initAnalytics } from '../lib/analytics';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, isCoarsePointer, prefersReducedMotion, revealOnScroll } from '../lib/motion';
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

    // 壁谷プロフィールだけ暗色テーマへ。Unveilのeditorial表示には影響させない。
    if (profile.id === 'kabeya') document.body.classList.add('profile--dark');

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderProfileSections(app, profile);
    renderProfileFooter(footer);

    initSmoothScroll();
    revealOnScroll(document);

    if (profile.heroVariant === 'editorial') {
      initEditorialParallax();
    }

    if (profile.heavyWebGL || profile.monument) {
      openingCurtain();
      splitHeadings(document);
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
    }

    if (window.location.hash === '#talk-request') {
      window.requestAnimationFrame(() =>
        document.getElementById('talk-request')?.scrollIntoView({ block: 'start' }),
      );
    }

    const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    if (canvas && shouldRender3D()) {
      if (profile.heavyWebGL) {
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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
