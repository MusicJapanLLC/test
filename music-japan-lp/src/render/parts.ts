import { common as C } from '../content/copy';
import { PAGES, type PageKey } from '../content/pages';
import { OFFICIAL_URL, socials } from '../content/site';
import { arrow, mjMark, socialIcon } from './icons';
import { esc, heading, jp } from './text';

/** 外部リンク（新しいタブ） */
export const ext = (href: string) => `href="${esc(href)}" target="_blank" rel="noopener"`;
export const num = (n: number) => String(n).padStart(2, '0');

/** 「〜について →」のような、文の終わりの小さなリンク */
export function more(href: string, label: string, opts: { external?: boolean; cls?: string } = {}): string {
  const attrs = opts.external ? ext(href) : `href="${esc(href)}"`;
  return `<a class="more ${opts.cls ?? ''}" ${attrs}><span>${esc(label)}</span>${arrow(opts.external ? 'up-right' : 'right')}</a>`;
}

/** セクションの見出し。label は小さな見出し（日本語）、title は h2 */
export function secHead(o: { id: string; label?: string; title: string | string[]; lead?: string; cls?: string }): string {
  return `<header class="sh ${o.cls ?? ''}">
  ${o.label ? `<p class="sh-label">${esc(o.label)}</p>` : ''}
  <h2 class="sh-title" id="${o.id}">${heading(o.title)}</h2>
  ${o.lead ? `<p class="sh-lead">${jp(o.lead)}</p>` : ''}
</header>`;
}

/** パンくず（トップ以外） */
export function crumbs(key: PageKey): string {
  const p = PAGES.find((x) => x.key === key)!;
  return `<nav class="crumbs" aria-label="パンくずリスト"><ol><li><a href="/">トップ</a></li><li><span aria-current="page">${esc(p.crumb)}</span></li></ol></nav>`;
}

/** 下層ページの最初の画面 */
export function pageHero(o: { key: PageKey; label: string; title: string; catch?: string[]; lead: string; aside?: string; extra?: string; cls?: string }): string {
  // 日本語の見出しは、欧文の見出しより少し小さく組む
  const jpTitle = /[぀-ヿ一-鿿]/.test(o.title);
  return `<section class="phero ${o.cls ?? ''}" aria-labelledby="page-title">
  <div class="wrap phero-in">
    <div class="phero-copy">
      ${crumbs(o.key)}
      <p class="phero-label">${esc(o.label)}</p>
      <h1 class="phero-title${jpTitle ? ' is-jp' : ''}" id="page-title">${esc(o.title)}</h1>
      ${o.catch ? `<p class="phero-catch">${heading(o.catch)}</p>` : ''}
      <p class="phero-lead">${jp(o.lead)}</p>
      ${o.extra ?? ''}
    </div>
    ${o.aside ? `<div class="phero-aside">${o.aside}</div>` : ''}
  </div>
</section>`;
}

/** ヘッダー。予約ページへの入口はここの「話してみる」だけ（/talk/ へ） */
export function header(key: PageKey): string {
  const nav = C.nav
    .map((n) => {
      const cur = PAGES.find((p) => p.path === n.href)?.key === key;
      return `<a href="${n.href}"${cur ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
    })
    .join('');
  return `<header class="hd" data-hd>
  <div class="hd-in">
    <a class="hd-brand" href="/" aria-label="Music Japan トップへ">${mjMark({ id: 'hd' })}<span>${esc(C.brand)}</span></a>
    <nav class="hd-nav" aria-label="サイト内のページ">${nav}</nav>
    <a class="hd-talk" href="/talk/"${key === 'talk' ? ' aria-current="page"' : ''}><span class="hd-talk-dot" aria-hidden="true"></span>${esc(C.talk)}</a>
    <button class="hd-menu" type="button" popovertarget="menu" aria-label="${esc(C.menu)}"><span></span><span></span></button>
  </div>
</header>
<div class="menu" id="menu" popover>
  <div class="menu-in">
    <button class="menu-close" type="button" popovertarget="menu" popovertargetaction="hide">${esc(C.close)}</button>
    <nav class="menu-nav" aria-label="サイト内のページ（メニュー）">
      <a href="/">トップ</a>
      ${C.nav.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('')}
      <a href="/talk/">${esc(C.talk)}</a>
    </nav>
  </div>
</div>`;
}

export function footer(): string {
  const f = C.footer;
  return `<footer class="ft">
  <div class="wrap ft-in">
    <div class="ft-brand">
      <a class="ft-logo" href="/" aria-label="Music Japan トップへ">${mjMark({ id: 'ft' })}<span>${esc(C.brand)}</span></a>
      <p class="ft-lead">${jp(f.lead)}</p>
      <p class="ft-music">${esc(f.music)} <a ${ext(`${OFFICIAL_URL}/`)}>${esc(f.musicLink)}${arrow('up-right')}</a></p>
    </div>
    ${f.groups
      .map(
        (g) => `<nav class="ft-col" aria-label="${esc(g.title)}"><p class="ft-title">${esc(g.title)}</p><ul>${g.links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join('')}</ul></nav>`,
      )
      .join('')}
    <div class="ft-col ft-sns"><p class="ft-title">${esc(f.follow)}</p><ul>${socials
      .map((s) => `<li><a ${ext(s.href)} aria-label="${esc(s.name)}（${esc(s.owner)}）">${socialIcon(s.name)}<span>${esc(s.name)}</span></a></li>`)
      .join('')}</ul></div>
  </div>
  <div class="wrap ft-bottom">
    <p>${esc(f.rights)}</p>
    <p class="ft-links"><a ${ext(`${OFFICIAL_URL}/privacy/`)}>${esc(f.privacy)}</a><a href="/feed.xml">${esc(f.rss)}</a><a href="#top" data-to-top>${esc(f.top)}</a></p>
  </div>
  <p class="ft-word" aria-hidden="true">Music Japan</p>
</footer>`;
}
