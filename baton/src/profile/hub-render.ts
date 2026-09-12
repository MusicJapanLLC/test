import { profiles } from '../data/profiles';
import { el, withBase } from '../lib/dom';

/** プロフィール一覧（/profile/）。各人物ページへのリンクだけを並べる */
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
                  el('p', { class: 'talk-hub-card__name', text: p.name }),
                  el('p', { class: 'talk-hub-card__meta', text: `${p.title}・${p.company}` }),
                ],
              ),
            ),
        ),
      ]),
    ]),
  );
}
