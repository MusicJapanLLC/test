import { site } from '../data/site';
import { el, externalAttrs, withBase } from '../lib/dom';

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
          { href: site.operator.url, ...externalAttrs },
          ['合同会社Music Japan'],
        ),
        el(
          'a',
          { href: 'https://second-take.vocal-shore-1441.chatgpt.site/', ...externalAttrs },
          ['SECOND TAKE'],
        ),
        el('span', { class: 'profile-footer__soon' }, ['Podcast', el('small', { text: '（準備中）' })]),
        el(
          'a',
          { href: 'https://timerex.net/s/music.japan.llc_5445/88d4eb59', ...externalAttrs },
          ['紹介・掲載をご希望の方'],
        ),
      ]),
      el('nav', { class: 'profile-footer__nav', 'aria-label': 'Baton サイト内リンク' }, [
        el('a', { href: withBase('/faq/'), text: 'よくある質問' }),
        el('a', { href: withBase(site.privacyPath), text: 'プライバシーポリシー' }),
      ]),
      el('div', { class: 'profile-footer__bottom' }, [
        el('span', { text: `© ${new Date().getFullYear()} ${site.operator.name}` }),
        el('span', { text: 'Baton' }),
      ]),
    ]),
  );
}
