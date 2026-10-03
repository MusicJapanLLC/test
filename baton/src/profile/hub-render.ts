import { profiles } from '../data/profiles';
import { el, externalAttrs, withBase } from '../lib/dom';
import { gsap, isCoarsePointer, prefersReducedMotion } from '../lib/motion';
import { HUB_LEAD, LISTING_CONTACT_URL } from '../lib/profile-facts';
import type { TalkProfile } from '../types';

/**
 * ポインターに合わせて、カードがわずかに傾き、真珠色の光がカーソルを追う。
 * 光の位置は CSS 変数（--mx / --my）で渡し、描くのは CSS に任せる。
 */
function attachTilt(card: HTMLAnchorElement): void {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const setRotX = gsap.quickTo(card, 'rotateX', { duration: 0.7, ease: 'power3.out' });
  const setRotY = gsap.quickTo(card, 'rotateY', { duration: 0.7, ease: 'power3.out' });

  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    setRotX(-(py - 0.5) * 5);
    setRotY((px - 0.5) * 6);
  });

  card.addEventListener('pointerleave', () => {
    setRotX(0);
    setRotY(0);
  });
}

/** 一覧のカード1枚。写真（アーチ型の窓）＋会社名・氏名・ひとこと・タグ */
function profileCard(p: TalkProfile, index: number): HTMLAnchorElement {
  const photo = p.photo;
  const portrait = el('span', { class: 'bt-card__portrait', 'data-hub-anchor': String(index) }, [
    el('span', { class: 'bt-card__halo', 'aria-hidden': 'true' }),
    photo
      ? el('img', {
          class: 'bt-card__img',
          src: withBase(photo.thumb ?? photo.src),
          alt: photo.alt ?? p.name,
          width: 520,
          height: 650,
          loading: 'lazy',
          decoding: 'async',
          style: photo.focus ? `object-position:${photo.focus}` : undefined,
        })
      : el('span', { class: 'bt-card__initial', 'aria-hidden': 'true', text: p.name.slice(0, 1) }),
    el('span', { class: 'bt-card__ring', 'aria-hidden': 'true' }),
  ]);

  const tags = (p.businessTags ?? []).slice(0, 3);
  const keywords = (p.keywordTags ?? []).slice(0, 3);

  return el(
    'a',
    {
      class: 'bt-card',
      href: withBase(`/profile/${p.slug}/`),
      'data-reveal': true,
      'data-hub-card': String(index),
      style: `--card-primary:${p.theme.primary};--card-accent:${p.theme.accent};--i:${index}`,
    },
    [
      portrait,
      el('span', { class: 'bt-card__body' }, [
        el('span', { class: 'bt-card__company', text: p.company }),
        el('span', { class: 'bt-card__person' }, [p.name, el('small', { text: p.title })]),
        el('span', { class: 'bt-card__summary', text: p.listSummary ?? p.tagline ?? p.title }),
        tags.length
          ? el(
              'span',
              { class: 'bt-card__tags' },
              tags.map((t) => el('span', { class: 'bt-card__tag', text: t })),
            )
          : null,
        keywords.length ? el('span', { class: 'bt-card__keywords', text: keywords.map((k) => `#${k}`).join('  ') }) : null,
        el('span', { class: 'bt-card__go', 'aria-hidden': 'true' }, ['プロフィールを見る', el('i', { text: '→' })]),
      ]),
    ],
  ) as HTMLAnchorElement;
}

/**
 * プロフィール一覧（/profile/）。
 * 追加され続けても優劣が生まれないよう、番号は振らない。
 * 写真どうしを背景の糸（hub-threads.ts）がつなぎ、バトンの光が順に手渡されていく。
 */
export function renderProfileHub(app: HTMLElement, opts: { static?: boolean } = {}): void {
  const cards = profiles.filter((p) => p.active).map((p, i) => profileCard(p, i));
  if (!opts.static) cards.forEach(attachTilt);

  app.append(
    // Batonが何かを一文で。検索・AIがこのページを「何のページか」と理解する手がかりになる
    el('section', { class: 'section talk-hub-intro', id: 'about' }, [
      el('div', { class: 'wrap' }, [
        el('h2', { class: 'talk-hub-intro__label', text: 'About Baton', 'data-reveal': true }),
        el('p', { class: 'talk-hub-intro__lead', 'data-reveal': true, text: HUB_LEAD }),
      ]),
    ]),
    el('section', { class: 'section talk-hub-profiles', id: 'profiles', 'aria-label': '掲載中の経営者・事業者' }, [
      el('div', { class: 'wrap' }, [el('div', { class: 'bt-cards', 'data-reveal-group': true }, cards)]),
    ]),
    el('section', { class: 'section talk-hub-cta', id: 'contact' }, [
      el('div', { class: 'wrap' }, [
        el('a', { class: 'btn btn--primary', href: LISTING_CONTACT_URL, ...externalAttrs, 'data-reveal': true }, [
          '紹介・掲載をご希望の方',
        ]),
      ]),
    ]),
  );
}
