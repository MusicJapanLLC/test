import '../styles/base.css';
import '../styles/hub.css';
import '../styles/service.css';

import { services } from '../data/services';
import { site } from '../data/site';
import { renderPrivacy } from '../entries/privacy-content';
import { renderHub } from '../hub/render';
import { hubHeroHtml, serviceHeroHtml } from '../lib/hero';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { renderServiceSections } from '../service/render';
import { mountLightScene } from '../service/scene-light';
import { mountStandmentScene } from '../service/scene-standment';
import { mountHubScene } from '../hub/scene';

/**
 * 単一ファイルのプレビュー。
 * 本番はマルチページだが、ここではハッシュで同じ描画関数を切り替えている。
 * 中身の出どころは本番とまったく同じ services.ts。
 */

let dispose: (() => void) | null = null;

function setTheme(theme: { primary: string; accent: string; bg: string; text: string }) {
  const root = document.documentElement.style;
  root.setProperty('--primary', theme.primary);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--bg', theme.bg);
  root.setProperty('--text', theme.text);
}

function route(): void {
  dispose?.();
  dispose = null;

  const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const service = services.find((s) => s.slug === hash);
  const isPrivacy = hash === 'privacy';

  const hero = document.getElementById('hero')!;
  const app = document.getElementById('app')!;
  const footer = document.getElementById('footer')!;
  hero.replaceChildren();
  app.replaceChildren();
  footer.replaceChildren();
  document.body.className = service ? 'service' : isPrivacy ? 'doc' : 'hub';

  if (service) {
    setTheme(service.theme);
    hero.innerHTML = serviceHeroHtml(service, '#/');
    renderServiceSections(app, service);
    renderFooter(footer, { backToHub: true });
    document.title = `${service.serviceName}｜${service.company} - ${site.name}`;
  } else if (isPrivacy) {
    setTheme({ primary: site.theme.text, accent: site.theme.accent, bg: '#ffffff', text: site.theme.text });
    renderPrivacy(app);
    renderFooter(footer, { backToHub: true });
    document.title = `プライバシーポリシー - ${site.name}`;
  } else {
    setTheme({ primary: site.theme.text, accent: site.theme.accent, bg: site.theme.bg, text: site.theme.text });
    hero.innerHTML = hubHeroHtml();
    renderHub(app);
    renderFooter(footer);
    document.title = `${site.nameJa}｜${site.tagline}`;
  }

  revealOnScroll(document);
  window.scrollTo(0, 0);

  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas && shouldRender3D()) {
    whenIdle(() => {
      if (!document.body.contains(canvas)) return;
      dispose = service
        ? service.heavyWebGL
          ? mountStandmentScene(canvas, service.theme)
          : mountLightScene(canvas, service.theme)
        : mountHubScene(canvas);
    }, 1200);
  }
}

/** プレビューでは各ページが別URLではないので、リンクをハッシュに読み替える */
function interceptLinks(): void {
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
}

initSmoothScroll();
interceptLinks();
window.addEventListener('hashchange', route);
route();
