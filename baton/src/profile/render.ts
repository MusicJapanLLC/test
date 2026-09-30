import { el, externalAttrs } from '../lib/dom';
import type { MediaItem, TalkProfile } from '../types';
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

function arrowIcon(className: string): HTMLElement {
  const span = el('span', { class: className, 'aria-hidden': 'true' });
  span.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5 3h6v6M11 3L3.5 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return span;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 種別バッジ＋日付。登壇だけ塗りつぶしで強調する */
function metaLine(m: MediaItem): HTMLElement {
  return el('p', { class: 'media-meta' }, [
    m.kind ? el('span', { class: 'media-kind', 'data-kind': m.kind, text: m.kind }) : null,
    m.date ? el('span', { class: 'media-date', text: m.date }) : null,
  ].filter((n): n is HTMLElement => n !== null));
}

/**
 * 実績向けの関連リンク。件数が多くても読めるように、大きさで優先度をつける。
 * featured は大きなカード、それ以外は1行の一覧。
 */
function achievementMedia(items: MediaItem[], richMotion: boolean): Node[] {
  const featured = items.filter((m) => m.featured);
  const rest = items.filter((m) => !m.featured);

  const card = (m: MediaItem) =>
    el(
      'a',
      {
        class: 'media-feature',
        href: m.url,
        ...externalAttrs,
        'data-reveal': true,
        ...(richMotion ? { 'data-tilt': true } : {}),
      },
      [
        metaLine(m),
        el('h3', { class: 'media-feature__title', text: m.label }),
        m.note ? el('p', { class: 'media-feature__note', text: m.note }) : null,
        el('p', { class: 'media-feature__host' }, [
          el('span', { text: hostOf(m.url) }),
          arrowIcon('media-arrow'),
        ]),
      ].filter((n): n is HTMLElement => n !== null),
    );

  const row = (m: MediaItem) =>
    el('a', { class: 'media-row', href: m.url, ...externalAttrs, 'data-reveal': true }, [
      metaLine(m),
      el('span', { class: 'media-row__body' }, [
        el('span', { class: 'media-row__title', text: m.label }),
        m.note ? el('span', { class: 'media-row__note', text: m.note }) : null,
      ].filter((n): n is HTMLElement => n !== null)),
      el('span', { class: 'media-row__host' }, [el('span', { text: hostOf(m.url) }), arrowIcon('media-arrow')]),
    ]);

  return [
    featured.length
      ? el('div', { class: 'media-features', 'data-reveal-group': true }, featured.map(card))
      : null,
    rest.length ? el('div', { class: 'media-rows', 'data-reveal-group': true }, rest.map(row)) : null,
  ].filter((n): n is HTMLDivElement => n !== null);
}

function mediaSection(profile: TalkProfile, richMotion = false): HTMLElement | null {
  if (!profile.media || !profile.media.length) return null;

  const arrow = () => arrowIcon('media-card__arrow');
  const achievements = profile.media.some((m) => m.kind);

  const body: Node[] = achievements
    ? achievementMedia(profile.media, richMotion)
    : [
        el(
          'div',
          { class: 'media-grid', 'data-reveal-group': true },
          profile.media.map((m) =>
            el(
              'a',
              {
                class: 'media-card',
                href: m.url,
                ...externalAttrs,
                'data-reveal': true,
                ...(richMotion ? { 'data-tilt': true } : {}),
              },
              [
                el(
                  'div',
                  { class: 'media-card__thumb' },
                  m.image
                    ? [el('img', { class: 'media-card__img', src: m.image, alt: '', loading: 'lazy' }), arrow()]
                    : [el('span', { text: m.label.slice(0, 1) }), arrow()],
                ),
                el('p', { class: 'media-card__title', text: m.label }),
              ],
            ),
          ),
        ),
      ];

  return el('section', { class: 'section', id: 'media' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: achievements ? 'Media & Appearances' : 'Media', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: achievements ? '登壇・掲載・発信' : '関連リンク', 'data-reveal': true }),
      ]),
      ...body,
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
  // 帯・カードの傾きは、暗色ページと editorial の両方で使う
  const richMotion = profile.heroVariant !== 'simple';
  const media = mediaSection(profile, richMotion);
  const services = servicesSection(profile);
  const band = richMotion ? marquee() : null;
  app.append(
    ...[
      proseSection({ id: 'business', label: 'Business', title: '事業内容', paragraphs: profile.business }),
      ...(profile.mediaFirst ? [band, media, services] : [services, band, media]),
      requestSection(profile),
    ].filter((n): n is HTMLElement => n !== null),
  );
}
