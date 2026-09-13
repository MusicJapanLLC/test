import { el, externalAttrs } from '../lib/dom';
import type { TalkProfile } from '../types';
import { renderRequestForm } from './request-form';

/** 文章で読ませるセクション（事業内容・実績など）。カードは使わない */
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

/** 運営メディア・サービス。名称＋説明の一覧（カードにはしない） */
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

/**
 * 関連リンク。記事カード風（サムネイル＋タイトル）で並べる。
 * 実際のサムネイル画像はまだ無いため、頭文字を置いたプレースホルダーにしている。
 * 実画像が用意でき次第、.media-card__thumb に <img> を差し込む形に変えられる。
 */
function mediaSection(profile: TalkProfile): HTMLElement | null {
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
        profile.media.map((m) =>
          el('a', { class: 'media-card', href: m.url, ...externalAttrs, 'data-reveal': true }, [
            el('div', { class: 'media-card__thumb' }, [el('span', { text: m.label.slice(0, 1) }), arrow()]),
            el('p', { class: 'media-card__title', text: m.label }),
          ]),
        ),
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

/** プロフィールページの本文。ヒーローより下を丸ごと組み立てる */
export function renderProfileSections(app: HTMLElement, profile: TalkProfile): void {
  app.append(
    ...[
      proseSection({ id: 'business', label: 'Business', title: '事業内容', paragraphs: profile.business }),
      servicesSection(profile),
      mediaSection(profile),
      requestSection(profile),
    ].filter((n): n is HTMLElement => n !== null),
  );
}
