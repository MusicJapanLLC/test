import { el, externalAttrs, pad2 } from '../lib/dom';
import { countUp } from '../lib/motion';
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
        el('h2', { class: 'section__title', text: '現在の状況について教えてください', 'data-reveal': true }),
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

/** サービスページの本文。ヒーローより下を丸ごと組み立てる */
export function renderServiceSections(app: HTMLElement, service: Service): void {
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
}
