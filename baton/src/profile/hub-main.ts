import '../styles/base.css';
import '../styles/hub.css';
import '../styles/profile.css';

import { initAnalytics } from '../lib/analytics';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from './footer';
import { renderProfileHub } from './hub-render';

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderProfileHub(app);
  renderProfileFooter(footer);

  initSmoothScroll();
  revealOnScroll(document);

  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas && shouldRender3D()) {
    // 3Dはヒーロー描画のあとに読み込む。LCPを遅らせないため
    whenIdle(() => {
      void import('../hub/scene').then(({ mountHubScene }) => mountHubScene(canvas)).catch(() => {});
    }, 1200);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
