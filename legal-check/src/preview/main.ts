import '../styles/base.css';
import '../styles/service.css';

import { getService } from '../data/services';
import { site } from '../data/site';
import { renderPrivacy } from '../entries/privacy-content';
import { renderFooter } from '../lib/footer';
import { serviceHeroHtml } from '../lib/hero';
import { initSmoothScroll, isLowPower, revealOnScroll } from '../lib/motion';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { mountLightScene } from '../service/scene-light';
import { renderServiceSections } from '../service/render';

/**
 * 単一ファイルのプレビュー。
 * 本番は2ページだが、ここではハッシュで切り替える。
 * 中身の出どころは本番とまったく同じ services.ts。
 */

const service = getService('legal');
let dispose: (() => void) | null = null;

function route(): void {
  dispose?.();
  dispose = null;

  const isPrivacy = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '') === 'privacy';

  const hero = document.getElementById('hero')!;
  const app = document.getElementById('app')!;
  const footer = document.getElementById('footer')!;
  hero.replaceChildren();
  app.replaceChildren();
  footer.replaceChildren();
  document.body.className = isPrivacy ? 'doc' : 'service';

  if (isPrivacy) {
    renderPrivacy(app);
    document.title = `プライバシーポリシー - ${site.name}`;
  } else {
    hero.innerHTML = serviceHeroHtml(service, '#/', { showBackLink: false });
    renderServiceSections(app, service);
    document.title = `${service.serviceName}｜${service.tagline}`;
  }
  renderFooter(footer);

  revealOnScroll(document);
  window.scrollTo(0, 0);

  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas && shouldRender3D() && !isLowPower()) {
    whenIdle(() => {
      if (!document.body.contains(canvas)) return;
      dispose = mountLightScene(canvas, service.theme, service.monument);
    }, 1200);
  }
}

/** プレビューでは別URLが無いので、内部リンクをハッシュに読み替える */
document.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!link) return;
  const href = link.getAttribute('href') ?? '';
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
  if (href.startsWith('#/')) return;
  const slug = href.replace(/^[./]*/, '').replace(/\/$/, '');
  e.preventDefault();
  window.location.hash = slug ? `#/${slug}` : '#/';
});

initSmoothScroll();
window.addEventListener('hashchange', route);
route();
