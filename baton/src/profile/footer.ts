import { el, externalAttrs } from '../lib/dom';

/**
 * プロフィールページ専用のフッター。
 * 6サービスページ・ハブが使う共通フッター（lib/footer.ts）とは別物で、
 * SECOND TAKEの黒背景フッターを参考にした簡潔な構成にしている。
 */
export function renderProfileFooter(mount: HTMLElement): void {
  mount.className = 'profile-footer';

  mount.append(
    el('div', { class: 'wrap' }, [
      el('div', { class: 'profile-footer__grid' }, [
        el(
          'a',
          { href: 'https://music-japan.pages.dev/', ...externalAttrs },
          ['合同会社Music Japan'],
        ),
        el(
          'a',
          { href: 'https://second-take.vocal-shore-1441.chatgpt.site/', ...externalAttrs },
          ['SECOND TAKE'],
        ),
        el('span', { class: 'profile-footer__soon' }, ['Podcast', el('small', { text: '（準備中）' })]),
      ]),
      el('div', { class: 'profile-footer__bottom' }, [
        el('span', { text: `© ${new Date().getFullYear()} 合同会社Music Japan` }),
        el('span', { text: 'Baton' }),
      ]),
    ]),
  );
}
