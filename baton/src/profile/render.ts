import { el, externalAttrs } from '../lib/dom';
import type { TalkProfile } from '../types';
import { renderRequestForm } from './request-form';

function topicsSection(profile: TalkProfile): HTMLElement | null {
  if (!profile.topics.length) return null;

  return el('section', { class: 'section', id: 'topics' }, [
    el('div', { class: 'wrap' }, [
      el('div', { class: 'section__head', 'data-reveal-group': true }, [
        el('span', { class: 'section__label', text: 'Topics', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: '話せるテーマ', 'data-reveal': true }),
      ]),
      el(
        'ul',
        { class: 'topics', 'data-reveal-group': true },
        profile.topics.map((topic) =>
          el('li', { class: 'topic-tag', 'data-reveal': true }, [topic]),
        ),
      ),
    ]),
  ]);
}

function mediaSection(profile: TalkProfile): HTMLElement | null {
  if (!profile.media || !profile.media.length) return null;

  const icon = () => {
    const span = el('span', { 'aria-hidden': 'true' });
    span.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 3h6v6M11 3L3.5 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
        { class: 'links', 'data-reveal-group': true },
        profile.media.map((m) =>
          el('a', { class: 'link-chip', href: m.url, ...externalAttrs, 'data-reveal': true }, [
            el('span', { text: m.label }),
            icon(),
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
        el('span', { class: 'section__label', text: 'Talk Request', 'data-reveal': true }),
        el('h2', { class: 'section__title', text: 'この人と話したい', 'data-reveal': true }),
        el('p', {
          class: 'section__note',
          text: `${profile.name}さんへ、話したい理由を伝えてください。ご本人の承認後、Music Japanが紹介します。`,
          'data-reveal': true,
        }),
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
    ...[topicsSection(profile), mediaSection(profile), requestSection(profile)].filter(
      (n): n is HTMLElement => n !== null,
    ),
  );
}
