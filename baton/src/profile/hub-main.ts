import '../styles/base.css';
import '../styles/hub.css';
import '../styles/profile.css';
import '../styles/profile-hub-hero.css';

import { initAnalytics } from '../lib/analytics';
import { shouldRender3D } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from './footer';
import { renderProfileHub } from './hub-render';

/**
 * ヒーローの「点灯」。レーザーの着弾と同時に呼ぶ。
 * WebGLが使えない・読み込めないときも、必ずどこかで点灯させる。
 */
function lightUp(hero: HTMLElement): void {
  if (hero.classList.contains('is-lit')) return;
  hero.classList.add('is-lit');
  window.setTimeout(() => hero.classList.add('is-settled'), 2200);
}

function mountHero(): void {
  const hero = document.querySelector<HTMLElement>('[data-bt-hero]');
  if (!hero) return;
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  const line = hero.querySelector<HTMLElement>('[data-bt-line]');

  // 静的版の光の線も、WebGL版と同じ高さに引く
  const placeLine = () => {
    if (!line) return;
    const h = hero.getBoundingClientRect();
    const r = line.getBoundingClientRect();
    hero.style.setProperty('--bt-line-y', `${(((r.top + r.height / 2 - h.top) / Math.max(h.height, 1)) * 100).toFixed(2)}%`);
  };
  placeLine();
  window.addEventListener('resize', placeLine, { passive: true });

  if (!canvas || !shouldRender3D()) {
    // 静的版: CSSの光の線だけで点灯させる
    hero.classList.add('is-static');
    window.setTimeout(() => lightUp(hero), 250);
    return;
  }

  // 3Dが間に合わなければ、そのまま点灯して先に読ませる
  const safety = window.setTimeout(() => {
    hero.classList.add('is-static');
    lightUp(hero);
  }, 3200);

  // ここはページの主役なので、アイドル待ちせずすぐ読む
  void import('./hub-hero-scene')
    .then(({ mountHubHeroScene }) => {
      window.clearTimeout(safety);
      // 既に静的版で点灯済みなら、着弾は飛ばして余韻の演出だけ重ねる
      const skipIntro = hero.classList.contains('is-lit');
      hero.classList.remove('is-static');
      hero.classList.add('is-webgl');
      mountHubHeroScene(canvas, {
        skipIntro,
        lineY: () => {
          if (!line) return 0.5;
          const h = hero.getBoundingClientRect();
          const r = line.getBoundingClientRect();
          return (r.top + r.height / 2 - h.top) / Math.max(h.height, 1);
        },
        onImpact: () => lightUp(hero),
      });
    })
    .catch(() => {
      window.clearTimeout(safety);
      hero.classList.add('is-static');
      lightUp(hero);
    });
}

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  mountHero();
  // ビルド時に焼き込んだ静的HTML（検索・AIクローラー向け）を、動く版に置き換える
  app.replaceChildren();
  footer.replaceChildren();
  renderProfileHub(app);
  renderProfileFooter(footer);

  initSmoothScroll();
  revealOnScroll(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
