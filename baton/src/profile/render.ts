import { profiles } from '../data/profiles';
import { el, externalAttrs, withBase } from '../lib/dom';
import {
  LISTING_CONTACT_URL,
  officialUrl,
  oneLiner,
  profileFaqs,
  sameAsUrls,
  serviceNames,
  type Faq,
} from '../lib/profile-facts';
import type { MediaItem, TalkProfile } from '../types';
import { renderRequestForm } from './request-form';

export type RenderOptions = {
  /**
   * true のとき、ビルド時の静的HTML用に描く（フォームを組み立てない）。
   * AIクローラーはJavaScriptを実行しないので、本文はHTMLに焼き込んでおく。
   */
  static?: boolean;
};

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
        el('h2', { class: 'section__title', text: profile.servicesTitle ?? '運営メディア・サービス', 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: 'service-list', 'data-reveal-group': true },
        profile.services.map((s, i) =>
          el('div', { class: 'service-item', 'data-reveal': true }, [
            el('span', { class: 'service-item__index', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
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

  const card = (m: MediaItem, i: number) =>
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
        el('span', { class: 'media-feature__index', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'media-feature__glow', 'aria-hidden': 'true' }),
        // 画像があるときはポートフォリオのように上に大きく出す
        m.image
          ? el('span', { class: 'media-feature__thumb' }, [
              el('img', { src: m.image, alt: '', loading: 'lazy', decoding: 'async' }),
            ])
          : null,
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

  const nodes: (HTMLElement | null)[] = [
    featured.length
      ? el('div', { class: 'media-features', 'data-reveal-group': true }, featured.map(card))
      : null,
    featured.length > 1
      ? el('p', { class: 'media-swipe-hint', 'aria-hidden': 'true', text: `Swipe · ${featured.length}` })
      : null,
    rest.length ? el('div', { class: 'media-rows', 'data-reveal-group': true }, rest.map(row)) : null,
  ];
  return nodes.filter((n): n is HTMLElement => n !== null);
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

  return el('section', { class: `section${achievements ? ' section--achievements' : ''}`, id: 'media' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', {
          class: 'section__label',
          text: profile.mediaLabel ?? (achievements ? 'Media & Appearances' : 'Media'),
          'data-reveal': true,
        }),
        el('h2', {
          class: 'section__title',
          text: profile.mediaTitle ?? (achievements ? '登壇・掲載・発信' : '関連リンク'),
          'data-reveal': true,
        }),
      ]),
      ...body,
    ]),
  ]);
}

function requestSection(profile: TalkProfile, opts: RenderOptions): HTMLElement {
  const mount = el('div', { class: 'survey', 'data-request-mount': true });

  const section = el('section', { class: 'section section--survey', id: 'talk-request' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Introduction', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: `${profile.name}さんへの紹介を希望する`, 'data-reveal': true }),
        el('p', { class: 'section__note', 'data-reveal': true }, [
          '以下のご回答をお願いします。',
          el('br'),
          '運営が確認した後、双方の確認が取れればご紹介させていただきます。',
        ]),
      ]),
      mount,
    ]),
  ]);

  if (opts.static) {
    // フォームはブラウザで組み立てる。HTMLだけを読む相手には、申請先がここだと伝える
    mount.append(
      el('p', { class: 'survey__static' }, [
        'この欄の申請フォームから、',
        `${profile.name}さんへの紹介を申し込めます（表示にはJavaScriptが必要です）。`,
      ]),
    );
  } else {
    renderRequestForm(mount, profile);
  }
  return section;
}

/** パンくず。Batonトップ → このプロフィール */
function breadcrumb(profile: TalkProfile): HTMLElement {
  return el('nav', { class: 'pf-breadcrumb', 'aria-label': 'パンくずリスト' }, [
    el('ol', { class: 'wrap pf-breadcrumb__list' }, [
      el('li', {}, [el('a', { href: withBase('/profile/'), text: 'Baton -バトン-' })]),
      el('li', {}, [el('a', { href: withBase('/profile/'), text: 'プロフィール一覧' })]),
      el('li', { 'aria-current': 'page', text: profile.name }),
    ]),
  ]);
}

/**
 * プロフィール概要。「〇〇とは」に一文で答え、続けて要点を表にする。
 * AI検索は、ページの冒頭で質問にそのまま答えている文を引用しやすい。
 */
function overviewSection(profile: TalkProfile): HTMLElement {
  const official = officialUrl(profile);
  const accounts = sameAsUrls(profile).filter((u) => u !== official);
  const row = (term: string, value: Node | string | null) =>
    value ? el('div', { class: 'pf-facts__row' }, [el('dt', { text: term }), el('dd', {}, [value])]) : null;
  const link = (url: string, label: string) => el('a', { href: url, ...externalAttrs, text: label });
  const hostOfUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return el('section', { class: 'section section--overview', id: 'overview' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Profile', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: `${profile.name}とは`, 'data-reveal': true }),
      ]),
      el('p', { class: 'pf-overview__lead', 'data-reveal': true, text: oneLiner(profile) }),
      el(
        'dl',
        { class: 'pf-facts', 'data-reveal': true },
        [
          row('氏名', profile.name),
          row('所属', official ? link(official, profile.company) : profile.company),
          row('役職', profile.title),
          row('拠点', profile.location ?? null),
          row('事業領域', serviceNames(profile).join('、') || null),
          row(
            '発信',
            accounts.length
              ? el(
                  'span',
                  { class: 'pf-facts__links' },
                  accounts.map((u) => link(u, hostOfUrl(u))),
                )
              : null,
          ),
        ].filter((n): n is HTMLDivElement => n !== null),
      ),
    ]),
  ]);
}

/** よくある質問。中身は profile-facts.ts（構造化データと同じもの） */
export function faqSection(
  faqs: Faq[],
  opts: { id?: string; title?: string; noHead?: boolean } = {},
): HTMLElement {
  return el('section', { class: 'section section--faq', id: opts.id ?? 'faq' }, [
    el('div', { class: 'wrap' }, [
      opts.noHead
        ? null
        : el('div', { class: 'section__head', 'data-reveal-group': true }, [
            el('span', { class: 'section__label', text: 'FAQ', 'data-reveal': true }),
            el('h2', { class: 'section__title', text: opts.title ?? 'よくある質問', 'data-reveal': true }),
          ]),
      el(
        'div',
        { class: 'pf-faq', 'data-reveal-group': true },
        faqs.map((f, i) =>
          el('details', { class: 'pf-faq__item', 'data-reveal': true, ...(i === 0 ? { open: true } : {}) }, [
            el('summary', { class: 'pf-faq__q' }, [el('h3', { text: f.q })]),
            el('p', { class: 'pf-faq__a', text: f.a }),
          ]),
        ),
      ),
    ]),
  ]);
}

/** ほかのプロフィールへの内部リンク。回遊と、サイト全体の関係づけのため */
function relatedSection(profile: TalkProfile): HTMLElement {
  const others = profiles.filter((p) => p.active && p.id !== profile.id);
  return el('section', { class: 'section section--related', id: 'related' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Baton Talk', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: 'Batonに掲載中のほかの経営者', 'data-reveal': true }),
      ]),
      el(
        'div',
        { class: 'pf-related', 'data-reveal-group': true },
        [
          ...others.map((p) =>
            el(
              'a',
              {
                class: 'pf-related__card',
                href: withBase(`/profile/${p.slug}/`),
                'data-reveal': true,
                style: `--card-primary:${p.theme.primary};--card-accent:${p.theme.accent}`,
              },
              [
                el('span', { class: 'pf-related__company', text: p.company }),
                el('span', { class: 'pf-related__name', text: `${p.name}（${p.title}）` }),
                el('span', { class: 'pf-related__summary', text: p.listSummary ?? p.tagline ?? p.title }),
              ],
            ),
          ),
          el('a', { class: 'pf-related__all', href: withBase('/profile/'), 'data-reveal': true }, [
            el('span', { text: 'Baton -バトン- のプロフィール一覧を見る' }),
          ]),
          el('a', { class: 'pf-related__all', href: LISTING_CONTACT_URL, ...externalAttrs, 'data-reveal': true }, [
            el('span', { text: 'Batonへの掲載・紹介のご相談（予約ページ）' }),
          ]),
        ],
      ),
    ]),
  ]);
}

/**
 * 帯に流す言葉。その人の「会社名・サービス名・事業内容」を横に流して、
 * スクロール途中でも何をしている人かが目に入るようにする。
 */
export function marqueeWords(profile: TalkProfile): string[] {
  const words = profile.marquee?.length
    ? profile.marquee
    : [
        profile.company,
        ...(profile.services ?? []).map((s) => s.name),
        ...(profile.businessTags ?? []),
        ...(profile.keywordTags ?? []),
      ];
  return Array.from(new Set(words.map((w) => w.trim()).filter(Boolean)));
}

function marquee(profile: TalkProfile): HTMLElement | null {
  const words = marqueeWords(profile);
  if (!words.length) return null;

  // 1周が短いと画面幅に足りず途切れるので、最低12語ぶんになるまで繰り返す
  const loops = Math.max(1, Math.ceil(12 / words.length));
  const run = () =>
    el(
      'span',
      { class: 'pf-marquee__run', 'aria-hidden': 'true' },
      Array.from({ length: loops }, () => words)
        .flat()
        .map((w) =>
          el('span', { class: `pf-marquee__unit${w === profile.company ? ' is-company' : ''}` }, [
            el('span', { text: w }),
            el('span', { class: 'pf-marquee__dot' }),
          ]),
        ),
    );

  return el('div', { class: 'pf-marquee', role: 'presentation' }, [
    // 語数が増えても流れる速さが変わらないよう、長さに比例させる
    el('div', { class: 'pf-marquee__track', style: `--marquee-dur:${words.length * loops * 3.4}s` }, [run(), run()]),
  ]);
}

export function renderProfileSections(app: HTMLElement, profile: TalkProfile, opts: RenderOptions = {}): void {
  // 帯・カードの傾きは、暗色ページと editorial の両方で使う
  const richMotion = profile.heroVariant !== 'simple';
  const media = mediaSection(profile, richMotion);
  const services = servicesSection(profile);
  // 流れる帯は同じ言葉の繰り返しなので、静的HTML（クローラー向け）には入れない
  const band = richMotion && !opts.static ? marquee(profile) : null;
  app.append(
    ...[
      breadcrumb(profile),
      overviewSection(profile),
      proseSection({ id: 'business', label: 'Business', title: '事業内容', paragraphs: profile.business }),
      ...(profile.mediaFirst ? [band, media, services] : [services, band, media]),
      faqSection(profileFaqs(profile)),
      requestSection(profile, opts),
      relatedSection(profile),
    ].filter((n): n is HTMLElement => n !== null),
  );
}
