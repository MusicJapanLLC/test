import { el, externalAttrs } from '../lib/dom';
import type { TalkProfile } from '../types';
import { renderRequestForm } from './request-form';

function proseSection(opts: {
  id: string;
  label: string;
  title: string;
  paragraphs?: string[];
}): HTMLElement | null {
  if (!opts.paragraphs || !opts.paragraphs.length) return null;

  return el('section', { class: 'section', id: opts.id }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: opts.label, 'data-reveal': true }),
        el('h2', { class: 'section__title', text: opts.title, 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: 'prose', 'data-reveal-group': true },
        opts.paragraphs.map((p) => el('p', { 'data-reveal': true, text: p })),
      ),
    ]),
  ]);
}

function servicesSection(profile: TalkProfile): HTMLElement | null {
  if (!profile.services || !profile.services.length) return null;

  return el('section', { class: 'section', id: 'services' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Services', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '運営メディア・サービス', 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: 'service-list', 'data-reveal-group': true },
        profile.services.map((s) =>
          el('div', { class: 'service-item', 'data-reveal': true }, [
            el('p', { class: 'service-item__name', text: s.name }),
            el('p', { class: 'service-item__desc', text: s.description }),
          ]),
        ),
      ),
    ]),
  ]);
}

function mediaSection(profile: TalkProfile, richMotion = false): HTMLElement | null {
  if (!profile.media || !profile.media.length) return null;

  const arrow = () => {
    const span = el('span', { class: 'media-card__arrow', 'aria-hidden': 'true' });
    span.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 3h6v6M11 3L3.5 10.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return span;
  };

  return el('section', { class: 'section', id: 'media' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Media', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '関連リンク', 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: 'media-grid', 'data-reveal-group': true },
        profile.media.map((m) => {
          const attrs: Record<string, unknown> = {
            class: 'media-card',
            href: m.url,
            ...externalAttrs,
            'data-reveal': true,
          };
          if (richMotion) attrs['data-tilt'] = true;
          return el('a', attrs, [
            el(
              'div',
              { class: 'media-card__thumb' },
              m.image
                ? [el('img', { class: 'media-card__img', src: m.image, alt: '', loading: 'lazy' }), arrow()]
                : [el('span', { text: m.label.slice(0, 1) }), arrow()],
            ),
            el('p', { class: 'media-card__title', text: m.label }),
          ]);
        }),
      ),
    ]),
  ]);
}

function requestSection(profile: TalkProfile): HTMLElement {
  const mount = el('div', { class: 'survey' });

  const section = el('section', { class: 'section section--survey', id: 'talk-request' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Introduction', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '紹介を希望する', 'data-reveal': true }),
        el('p', { class: 'section__note', 'data-reveal': true }, [
          '以下のご回答をお願いします。',
          el('br'),
          '運営が確認した後、双方の確認が取れればご紹介させていただきます。',
        ]),
      ]),
      mount,
    ]),
  ]);

  renderRequestForm(mount, profile);
  return section;
}

function marquee(): HTMLElement {
  const phrase = '選んだ人が、選んだ人へ。';
  const run = () =>
    el(
      'span',
      { class: 'pf-marquee__run', 'aria-hidden': 'true' },
      Array.from({ length: 4 }, () =>
        el('span', { class: 'pf-marquee__unit' }, [
          el('span', { text: phrase }),
          el('span', { class: 'pf-marquee__dot' }),
        ]),
      ),
    );

  return el('div', { class: 'pf-marquee', role: 'presentation' }, [
    el('div', { class: 'pf-marquee__track' }, [run(), run()]),
  ]);
}

export function renderProfileSections(app: HTMLElement, profile: TalkProfile): void {
  const richMotion = Boolean(profile.heavyWebGL || profile.monument);
  app.append(
    ...[
      proseSection({ id: 'business', label: 'Business', title: '事業内容', paragraphs: profile.business }),
      servicesSection(profile),
      richMotion ? marquee() : null,
      mediaSection(profile, richMotion),
      requestSection(profile),
    ].filter((n): n is HTMLElement => n !== null),
  );
}
