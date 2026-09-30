import { site } from '../data/site';
import { el, withBase } from '../lib/dom';
import { hubFaqs } from '../lib/profile-facts';
import { faqSection } from './render';

/**
 * よくある質問ページ（/faq/）。
 * トップ（/profile/）はデザインを優先して説明を最小限にし、
 * Batonの仕組み・運営者・紹介の流れはこのページにまとめる（フッターからリンク）。
 */
export function renderFaqPage(app: HTMLElement): void {
  app.append(
    el('header', { class: 'faq-head' }, [
      el('div', { class: 'wrap' }, [
        el('a', { class: 'faq-head__brand', href: withBase('/profile/'), text: site.nameJa }),
        el('h1', { class: 'faq-head__title', text: 'よくある質問' }),
      ]),
    ]),
    faqSection(hubFaqs(), { id: 'faq', noHead: true }),
  );
}
