import { profiles } from '../data/profiles';
import { site } from '../data/site';
import { el, externalAttrs, withBase } from '../lib/dom';
import { gsap, isCoarsePointer, prefersReducedMotion } from '../lib/motion';
import { BATON_ABOUT, hubFaqs, LISTING_CONTACT_URL } from '../lib/profile-facts';
import { faqSection } from './render';

/** 業界・事業タグを最大3件ずつ、小さく1行に並べる */
function tagRow(tags: string[] | undefined): HTMLElement | null {
  if (!tags || !tags.length) return null;
  return el(
    'p',
    { class: 'talk-hub-card__tagrow' },
    tags.slice(0, 3).map((t) => el('span', { class: 'talk-hub-card__tag', text: t })),
  );
}

/** ポインター位置に合わせて、カードがわずかに浮き上がって傾く */
function attachTilt(link: HTMLAnchorElement): void {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  const setRotX = gsap.quickTo(link, 'rotateX', { duration: 0.6, ease: 'power3.out' });
  const setRotY = gsap.quickTo(link, 'rotateY', { duration: 0.6, ease: 'power3.out' });
  const setZ = gsap.quickTo(link, 'z', { duration: 0.6, ease: 'power3.out' });

  link.addEventListener('pointermove', (e) => {
    const rect = link.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setRotX(-py * 2.6);
    setRotY(px * 2.6);
    setZ(14);
  });

  link.addEventListener('pointerleave', () => {
    setRotX(0);
    setRotY(0);
    setZ(0);
  });
}

/**
 * プロフィール一覧（/profile/）。
 * 追加され続けても優劣が生まれないよう、番号は振らない。
 * 会社名を主表記、氏名は添え書きにして小さく出す。
 */
export function renderProfileHub(app: HTMLElement, opts: { static?: boolean } = {}): void {
  const cards = profiles
    .filter((p) => p.active)
    .map((p) => {
      const link = el(
        'a',
        {
          class: 'talk-hub-card',
          href: withBase(`/profile/${p.slug}/`),
          'data-reveal': true,
          style: `--card-primary:${p.theme.primary};--card-accent:${p.theme.accent}`,
        },
        [
          el('div', { class: 'talk-hub-card__row' }, [
            el('div', { class: 'talk-hub-card__names' }, [
              el('p', { class: 'talk-hub-card__company', text: p.company }),
              el('p', { class: 'talk-hub-card__person', text: p.name }),
            ]),
            el('p', { class: 'talk-hub-card__tagline', text: p.listSummary ?? p.tagline ?? p.title }),
            el(
              'div',
              { class: 'talk-hub-card__tags' },
              [tagRow(p.businessTags), tagRow(p.keywordTags)].filter((n): n is HTMLElement => n !== null),
            ),
          ]),
        ],
      ) as HTMLAnchorElement;

      if (!opts.static) attachTilt(link);
      return link;
    });

  const steps = [
    ['プロフィールを読む', '運営が実際に対話した経営者・事業者の、事業と人柄を紹介しています。'],
    ['紹介を申請する', '話してみたい人のページのフォームから、目的・お名前・会社名などを入力して申請します。'],
    ['運営が確認してつなぐ', `${site.operator.name}が内容を確認し、双方の確認が取れた場合にご紹介します。`],
  ];

  app.append(
    el('section', { class: 'section talk-hub-intro', id: 'about' }, [
      el('div', { class: 'wrap' }, [
        el('div', { class: 'section__head', 'data-reveal-group': true }, [
          el('span', { class: 'section__label', text: 'About Baton', 'data-reveal': true }),
          el('h2', { class: 'section__title', text: 'Baton -バトン- とは', 'data-reveal': true }),
        ]),
        el('p', { class: 'talk-hub-intro__lead', 'data-reveal': true, text: BATON_ABOUT }),
        el(
          'ol',
          { class: 'talk-hub-steps', 'data-reveal-group': true },
          steps.map(([title, body], i) =>
            el('li', { class: 'talk-hub-step', 'data-reveal': true }, [
              el('span', { class: 'talk-hub-step__num', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
              el('h3', { class: 'talk-hub-step__title', text: title }),
              el('p', { class: 'talk-hub-step__body', text: body }),
            ]),
          ),
        ),
      ]),
    ]),
    el('section', { class: 'section', id: 'profiles' }, [
      el('div', { class: 'wrap' }, [
        el('div', { class: 'section__head', 'data-reveal-group': true }, [
          el('span', { class: 'section__label', text: 'Profiles', 'data-reveal': true }),
          el('h2', { class: 'section__title', text: '掲載中の経営者・事業者', 'data-reveal': true }),
        ]),
        el('div', { class: 'talk-hub-list', 'data-reveal-group': true }, cards),
      ]),
    ]),
    faqSection(hubFaqs()),
    el('section', { class: 'section talk-hub-cta', id: 'contact' }, [
      el('div', { class: 'wrap' }, [
        el('p', { class: 'talk-hub-cta__lead', 'data-reveal': true, text: 'Batonへの掲載・紹介のご相談はこちら' }),
        el('a', { class: 'btn btn--primary', href: LISTING_CONTACT_URL, ...externalAttrs, 'data-reveal': true }, [
          '紹介・掲載をご希望の方（予約ページ）',
        ]),
      ]),
    ]),
  );
}
