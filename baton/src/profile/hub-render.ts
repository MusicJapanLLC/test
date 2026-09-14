import { profiles } from '../data/profiles';
import { el, withBase } from '../lib/dom';
import { gsap, isCoarsePointer, prefersReducedMotion } from '../lib/motion';

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
export function renderProfileHub(app: HTMLElement): void {
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

      attachTilt(link);
      return link;
    });

  app.append(
    el('section', { class: 'section' }, [
      el('div', { class: 'wrap' }, [el('div', { class: 'talk-hub-list', 'data-reveal-group': true }, cards)]),
    ]),
  );
}
