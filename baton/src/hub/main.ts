import '../styles/base.css';
import '../styles/hub.css';

import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { renderHub } from './render';

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderHub(app);
  renderFooter(footer);

  initSmoothScroll();
  revealOnScroll(document);

  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas && shouldRender3D()) {
    // 3Dはヒーロー描画のあとに読み込む。LCPを遅らせないため
    whenIdle(() => {
      void import('./scene').then(({ mountHubScene }) => mountHubScene(canvas)).catch(() => {});
    }, 1200);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
