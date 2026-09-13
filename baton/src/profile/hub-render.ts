import { profiles } from '../data/profiles';
import { el, withBase } from '../lib/dom';

/** 業界・事業タグを最大3件ずつ、小さく1行に並べる */
function tagRow(tags: string[] | undefined): HTMLElement | null {
  if (!tags || !tags.length) return null;
  return el(
    'p',
    { class: 'talk-hub-card__tagrow' },
    tags.slice(0, 3).map((t) => el('span', { class: 'talk-hub-card__tag', text: t })),
  );
}

/**
 * プロフィール一覧（/profile/）。
 * 追加され続けても優劣が生まれないよう、番号は振らない。
 * 会社名を主表記、氏名は添え書きにして小さく出す。
 */
export function renderProfileHub(app: HTMLElement): void {
  app.append(
    el('section', { class: 'section' }, [
      el('div', { class: 'wrap' }, [
        el(
          'div',
          { class: 'talk-hub-list', 'data-reveal-group': true },
          profiles
            .filter((p) => p.active)
            .map((p) =>
              el(
                'a',
                { class: 'talk-hub-card', href: withBase(`/profile/${p.slug}/`), 'data-reveal': true },
                [
                  el('div', { class: 'talk-hub-card__row' }, [
                    el('div', { class: 'talk-hub-card__names' }, [
                      el('p', { class: 'talk-hub-card__company', text: p.company }),
                      el('p', { class: 'talk-hub-card__person', text: p.name }),
                    ]),
                    el('p', { class: 'talk-hub-card__tagline', text: p.tagline ?? p.title }),
                    el(
                      'div',
                      { class: 'talk-hub-card__tags' },
                      [tagRow(p.industryTags), tagRow(p.businessTags)].filter(
                        (n): n is HTMLElement => n !== null,
                      ),
                    ),
                  ]),
                ],
              ),
            ),
        ),
      ]),
    ]),
  );
}
