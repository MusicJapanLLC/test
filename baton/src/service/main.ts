import '../styles/base.css';
import '../styles/service.css';

import { getService } from '../data/services';
import { initAnalytics } from '../lib/analytics';
import { el, externalAttrs, pad2 } from '../lib/dom';
import { renderFooter } from '../lib/footer';
import { countUp, initSmoothScroll, revealOnScroll } from '../lib/motion';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import type { Item, Service } from '../types';
import { renderSurvey } from './survey';

/** problems / features / strengths は同じ形。数と見出しだけ変える */
function itemSection(opts: {
  id: string;
  label: string;
  title: string;
  items: Item[];
  columns: 2 | 3;
  modifier?: string;
}): HTMLElement {
  return el('section', { class: `section ${opts.modifier ?? ''}`.trim(), id: opts.id }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: opts.label, 'data-reveal': true }),
        el('h2', { class: 'section__title', text: opts.title, 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: `grid grid--${opts.columns}`, 'data-reveal-group': true },
        opts.items.map((item, i) =>
          el('article', { class: 'card', 'data-reveal': true }, [
            el('p', { class: 'card__num', text: pad2(i + 1) }),
            el('h3', { class: 'card__title', text: item.title }),
            el('p', { class: 'card__detail', text: item.detail }),
          ]),
        ),
      ),
    ]),
  ]);
}

function statsSection(service: Service): HTMLElement {
  const isNumeric = (v: string) => /^[+-]?[\d,]+(\.\d+)?$/.test(v);

  const cells = service.stats.map((stat) => {
    const num = el('span', {
      class: `stat__num${isNumeric(stat.value) ? '' : ' stat__num--text'}`,
      text: stat.value,
    });
    countUp(num, stat.value);

    return el('div', { class: 'stat', 'data-reveal': true }, [
      el('p', { class: 'stat__label', text: stat.label }),
      el('p', { class: 'stat__value' }, [
        num,
        stat.unit ? el('span', { class: 'stat__unit', text: stat.unit }) : null,
      ]),
      // 注記は必ず数値のすぐ近くに出す。省略しない
      stat.note ? el('p', { class: 'stat__note', text: stat.note }) : null,
    ]);
  });

  return el('section', { class: 'section', id: 'stats' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Numbers', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '数字', 'data-reveal': true }),
      ]),
      el('div', { class: 'stats', 'data-reveal-group': true }, cells),
    ]),
  ]);
}

function linksSection(service: Service): HTMLElement {
  const icon = () => {
    const span = el('span', { 'aria-hidden': 'true' });
    span.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 3h6v6M11 3L3.5 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return span;
  };

  return el('section', { class: 'section', id: 'links' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Official', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '公式サイト', 'data-reveal': true }),
        el('p', {
          class: 'section__note',
          text: `${service.company} が運営しています。詳しくはこちらから。`,
          'data-reveal': true,
        }),
      ]),
      el(
        'div',
        { class: 'links', 'data-reveal-group': true },
        service.links.map((link) =>
          el('a', { class: 'link-chip', href: link.url, ...externalAttrs, 'data-reveal': true }, [
            el('span', { text: link.label }),
            icon(),
          ]),
        ),
      ),
    ]),
  ]);
}

function surveySection(service: Service): HTMLElement {
  const mount = el('div', { class: 'survey' });

  const section = el('section', { class: 'section section--survey', id: 'survey' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Survey', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '話を聞いてみますか', 'data-reveal': true }),
        el('p', {
          class: 'section__note',
          text: '4問と、ご連絡先だけ。1分ほどで終わります。',
          'data-reveal': true,
        }),
      ]),
      mount,
    ]),
  ]);

  renderSurvey(mount, service);
  return section;
}

export function mountServicePage(serviceId: string): void {
  const service = getService(serviceId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    app.append(
      itemSection({
        id: 'problems',
        label: 'Problems',
        title: 'こういうこと、ありませんか',
        items: service.problems,
        columns: 2,
        modifier: 'section--problems',
      }),
      itemSection({
        id: 'features',
        label: 'Services',
        title: 'できること',
        items: service.features,
        columns: 3,
      }),
      itemSection({
        id: 'strengths',
        label: 'Strengths',
        title: '特徴',
        items: service.strengths,
        columns: 2,
      }),
      statsSection(service),
      linksSection(service),
      surveySection(service),
    );

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
      const load = service.heavyWebGL
        ? () =>
            import('./scene-standment').then(({ mountStandmentScene }) =>
              mountStandmentScene(canvas, service.theme),
            )
        : () =>
            import('./scene-light').then(({ mountLightScene }) =>
              mountLightScene(canvas, service.theme),
            );

      const run = () => void load().catch(() => {});
      whenIdle(run, 1500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
