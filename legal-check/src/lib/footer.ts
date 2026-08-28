import { site } from '../data/site';
import { el, externalAttrs, frag, withBase } from './dom';
import { logo } from './logo';

/** 全ページ共通のフッター。制作クレジット・プライバシーポリシー・事業者情報 */
export function renderFooter(mount: HTMLElement): void {
  mount.className = 'footer';

  const credit = el('div', { class: 'footer__credit' }, [
    logo('standment', 'footer__logo', 'Standment'),
    el('div', {}, [
      el('p', { text: site.producer.credit }),
      el('div', { class: 'footer__links' }, [
        el('a', { href: site.producer.works, ...externalAttrs, text: 'Standment 制作実績' }),
        el('a', { href: withBase(site.privacyPath), text: 'プライバシーポリシー' }),
      ]),
    ]),
  ]);

  const org = el('div', { class: 'footer__org' }, [
    el('strong', { text: site.operator.name }),
    el('p', { text: site.operator.address }),
    el('p', {}, [
      el('a', { href: site.operator.url, ...externalAttrs, text: '会社概要' }),
    ]),
  ]);

  mount.append(
    el('div', { class: 'wrap' }, [
      el('div', { class: 'footer__grid' }, [credit, org]),
      el('div', { class: 'footer__bottom' }, [
        el('span', { text: `© ${new Date().getFullYear()} ${site.operator.name}` }),
        el('span', { text: 'Baton' }),
      ]),
    ]),
  );
}

export { frag };
