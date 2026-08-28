import '../styles/base.css';
import '../styles/service.css';

import { getService } from '../data/services';
import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, isLowPower, revealOnScroll } from '../lib/motion';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { renderServiceSections } from './render';

export function mountServicePage(serviceId: string): void {
  const service = getService(serviceId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderServiceSections(app, service);
    renderFooter(footer);

    initSmoothScroll();
    revealOnScroll(document);

    // テレアポ後に /engineer/#survey で直接飛ばせるように
    if (window.location.hash === '#survey') {
      window.requestAnimationFrame(() =>
        document.getElementById('survey')?.scrollIntoView({ block: 'start' }),
      );
    }

    const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');

    /**
     * スマホでは3Dを読み込まない。
     * three.js の読み込みと解析だけで主スレッドが2秒近く止まり、
     * 広告から来た人の初動を損なう。背景はCSSのグラデーションで成立する。
     */
    if (canvas && shouldRender3D() && !isLowPower()) {
      whenIdle(() => {
        void import('./scene-light')
          .then(({ mountLightScene }) => mountLightScene(canvas, service.theme, service.monument))
          .catch(() => {});
      }, 1500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
