import '../styles/base.css';
import '../styles/service.css';

import { getService } from '../data/services';
import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
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
    renderFooter(footer, { backToHub: true });

    initSmoothScroll();
    revealOnScroll(document);

    // テレアポ後に /engineer/#survey で直接飛ばせるように
    if (window.location.hash === '#survey') {
      window.requestAnimationFrame(() =>
        document.getElementById('survey')?.scrollIntoView({ block: 'start' }),
      );
    }

    const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
    if (canvas && shouldRender3D()) {
      // Standment だけ3Dをフルに使う。他は板1枚の軽量な背景
      const load = service.heavyWebGL
        ? () =>
            import('./scene-standment').then(({ mountStandmentScene }) =>
              mountStandmentScene(canvas, service.theme),
            )
        : () =>
            import('./scene-light').then(({ mountLightScene }) =>
              mountLightScene(canvas, service.theme),
            );

      whenIdle(() => void load().catch(() => {}), 1500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
