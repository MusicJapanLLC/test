import { partners } from '../content/company';
import { faq } from '../content/faq';
import { artwork, releases, type Locale } from '../content/releases';
import { copy, path, SITE_URL, workPath, type PageKey } from '../content/site';
import { arrow, esc, ext, phrases, prose } from './html';
import { mark } from './mark';

export const kicker = (text: string, no?: string) =>
  `<p class="kicker">${no ? `<i>${esc(no)}</i>` : ''}<span>${esc(text)}</span></p>`;

export const heading = (tag: 'h1' | 'h2' | 'h3', text: string, cls = '') =>
  `<${tag} class="hx ${cls}" data-split>${phrases(text)}</${tag}>`;

export function button(label: string, href: string, variant: 'solid' | 'line' = 'solid', locale?: Locale) {
  const external = ext(href);
  return `<a class="btn btn--${variant}" href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''} data-magnetic><span class="btn-label">${esc(label)}</span>${arrow(external ? 'up-right' : 'right')}${external && locale ? `<span class="sr">${copy[locale].newTab}</span>` : ''}</a>`;
}

/** A record sleeve with the disc tucked inside. Clicking opens the player in place. */
export function sleeve(locale: Locale, index: number) {
  const r = releases[index];
  const c = copy[locale];
  const no = `MJ-${String(index + 1).padStart(3, '0')}`;
  return `<article class="rel" data-group="${r.group}" style="--accent:${r.accent}" data-reveal>
  <button class="sleeve" type="button" data-open-release="${r.id}" aria-haspopup="dialog" aria-label="${esc(`${c.crate.open}: ${r.title} — ${r.artist}`)}" data-cursor-label="PLAY">
    <span class="sleeve-disc" aria-hidden="true"><span class="sleeve-grooves"></span><span class="sleeve-label" style="background-image:url(${artwork(r, 480)})"></span></span>
    <span class="sleeve-cover"><img src="${artwork(r, 800)}" srcset="${artwork(r, 480)} 480w, ${artwork(r, 800)} 800w, ${artwork(r, 1200)} 1200w" sizes="(max-width: 760px) 80vw, 30vw" width="800" height="800" alt="${esc(`${r.title} — ${r.artist}`)}" loading="lazy" decoding="async"></span>
    <span class="sleeve-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
  </button>
  <div class="rel-meta">
    <p class="rel-no"><span>${no}</span><span>${esc(r.type)}</span></p>
    <h3 class="rel-title"><a href="${workPath(locale, r.id)}">${esc(r.title)}</a></h3>
    <p class="rel-artist">${esc(r.artist)}</p>
    <a class="rel-link" href="${r.href}" target="_blank" rel="noopener noreferrer">${esc(r.platform)}${arrow('up-right')}<span class="sr">${c.newTab}</span></a>
  </div>
</article>`;
}

/** The player reads every release from this JSON island, so any page with sleeves embeds it once. */
export function releaseData(locale: Locale) {
  const data = releases.map((r, i) => ({
    id: r.id,
    no: `MJ-${String(i + 1).padStart(3, '0')}`,
    title: r.title,
    artist: r.artist,
    type: r.type,
    description: r.description[locale],
    href: r.href,
    platform: r.platform,
    art: artwork(r, 1200),
    thumb: artwork(r, 480),
    accent: r.accent,
    previews: r.previews,
    credit: r.credit,
  }));
  return `<script type="application/json" data-releases>${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`;
}

export function crate(locale: Locale, opts: { heading?: boolean; no?: string } = {}) {
  const c = copy[locale].crate;
  return `<section class="crate" id="catalog" data-world-zone="crate" aria-labelledby="crate-title">
  ${opts.heading === false ? '' : `<div class="sec-head">
    ${kicker(c.kicker, opts.no ?? '04')}
    <h2 class="hx" id="crate-title" data-split>${phrases(c.title)}</h2>
    <p class="sec-body">${prose(c.body)}</p>
  </div>`}
  <div class="crate-filter" role="group" aria-label="Filter">
    ${(['all', 'yuma', 'brand'] as const).map((f, i) => `<button type="button" data-filter="${f}" aria-pressed="${i === 0}">${c.filters[f]}<sup>${f === 'all' ? releases.length : releases.filter((r) => r.group === f).length}</sup></button>`).join('')}
  </div>
  <div class="crate-grid" data-crate>${releases.map((_, i) => sleeve(locale, i)).join('')}</div>
  ${releaseData(locale)}
</section>`;
}

export function player(locale: Locale) {
  const p = copy[locale].player;
  return `<dialog class="pl" data-player aria-labelledby="pl-title" data-labels='${esc(JSON.stringify({ play: p.play, pause: p.pause, listen: p.listen('%s'), error: p.error }))}'>
  <div class="pl-bg" data-pl-bg aria-hidden="true"></div>
  <div class="pl-shell">
    <button class="pl-close" type="button" data-pl-close aria-label="${p.close}"><span></span><span></span></button>
    <div class="pl-art">
      <div class="pl-disc" data-pl-disc aria-hidden="true"><span class="pl-grooves"></span><span class="pl-label" data-pl-label></span></div>
      <img class="pl-cover" data-pl-img alt="" width="1200" height="1200">
    </div>
    <div class="pl-info">
      <p class="pl-no"><span data-pl-no></span><span data-pl-type></span></p>
      <h2 class="pl-title" id="pl-title" data-pl-title></h2>
      <p class="pl-artist" data-pl-artist></p>
      <canvas class="pl-spectrum" data-pl-spectrum aria-hidden="true"></canvas>
      <div class="pl-transport">
        <button type="button" class="pl-skip" data-pl-prev aria-label="${p.prev}"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12 18 18V6z"/></svg></button>
        <button type="button" class="pl-play" data-pl-play aria-label="${p.play}"><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>
        <button type="button" class="pl-skip" data-pl-next aria-label="${p.next}"><svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg></button>
      </div>
      <div class="pl-progress"><span data-pl-cur>0:00</span><input type="range" min="0" max="1000" value="0" step="1" data-pl-seek aria-label="${p.preview}"><span data-pl-dur>0:30</span></div>
      <p class="pl-status" data-pl-status role="status"></p>
      <div class="pl-tracks" data-pl-tracks-wrap hidden><p>${p.tracks}</p><ol data-pl-tracks></ol></div>
      <p class="pl-desc" data-pl-desc></p>
      <div class="pl-foot"><a class="btn btn--line" data-pl-link target="_blank" rel="noopener noreferrer"><span class="btn-label"></span>${arrow('up-right')}</a><small data-pl-credit></small></div>
    </div>
  </div>
  <audio data-pl-audio preload="none"></audio>
</dialog>`;
}

export function mediaCards(locale: Locale) {
  const m = copy[locale].media;
  return `<div class="media-grid">${m.cards
    .map(
      (card, i) => `<a class="media-card media-card--${i === 0 ? 'st' : 'baton'}" href="${card.href}" target="_blank" rel="noopener noreferrer" data-reveal data-cursor-label="VISIT">
    <span class="media-no">0${i + 1}</span>
    <p class="kicker"><span>${esc(card.label)}</span></p>
    ${i === 0 ? '<span class="media-wave" aria-hidden="true">' + '<i></i>'.repeat(40) + '</span>' : '<span class="media-rings" aria-hidden="true"><i></i><i></i><i></i></span>'}
    <h3 class="media-title">${esc(card.title)}${'sub' in card && card.sub ? `<small>${esc(card.sub)}</small>` : ''}</h3>
    <p class="media-body">${prose(card.body)}</p>
    <span class="media-cta">${esc(card.cta)}${arrow('up-right')}</span><span class="sr">${copy[locale].newTab}</span>
  </a>`,
    )
    .join('')}</div>`;
}

export function partnerSleeve(locale: Locale, i: number, size: 'lg' | 'sm' = 'lg') {
  const p = partners[i];
  return `<div class="ps ps--${size}" style="--c1:${p.colors[0]};--c2:${p.colors[1]}" aria-hidden="true">
    <span class="ps-disc"><span class="ps-grooves"></span><span class="ps-label"></span></span>
    <span class="ps-cover">
      <span class="ps-no">${p.no}</span>
      <span class="ps-series">BATON PARTNERS</span>
      <img src="${p.logo}" alt="" width="${p.logoW}" height="${p.logoH}" loading="lazy" decoding="async">
      <span class="ps-base">${esc(p.base[locale])} — JAPAN</span>
      ${mark({ id: `ps${i}${size}`, cls: 'mj-mark ps-mark' })}
    </span>
  </div>`;
}

export function partnersTeaser(locale: Locale) {
  const t = copy[locale].partnersTeaser;
  return `<section class="pt" data-world-zone="ambient" aria-labelledby="pt-title">
  <div class="sec-head">
    ${kicker(t.kicker, '06')}
    <h2 class="hx" id="pt-title" data-split>${phrases(t.title)}</h2>
    <p class="sec-body">${prose(t.body)}</p>
  </div>
  <div class="pt-row">${partners
    .map(
      (p, i) => `<a class="pt-item" href="${path(locale, 'partners')}#${p.id}" data-reveal data-cursor-label="OPEN">${partnerSleeve(locale, i, 'sm')}<span class="pt-meta"><span class="pt-no">${p.no}</span><strong>${esc(p.name[locale])}</strong><span>${esc(p.category[locale])}</span></span></a>`,
    )
    .join('')}</div>
  <div class="sec-cta">${button(t.cta, path(locale, 'partners'), 'line')}</div>
</section>`;
}

export function ctaBlock(locale: Locale) {
  const c = copy[locale].cta;
  return `<section class="cta" data-world-zone="cta" aria-labelledby="cta-title">
  <div class="cta-wave" aria-hidden="true" data-cta-wave></div>
  ${kicker(c.kicker)}
  <h2 class="hx cta-title" id="cta-title" data-split>${phrases(c.title)}</h2>
  <p class="sec-body">${prose(c.body)}</p>
  <div class="cta-actions">${button(c.button, path(locale, 'contact'))}</div>
</section>`;
}

export function faqSection(locale: Locale, no = '08') {
  const ja = locale === 'ja';
  return `<section class="faq" data-world-zone="ambient" aria-labelledby="faq-title">
  <div class="sec-head">${kicker('FAQ', no)}<h2 class="hx" id="faq-title" data-split>${phrases(ja ? 'よくある質問' : 'Questions, answered')}</h2></div>
  <div class="faq-list">${faq[locale]
    .map((item, i) => `<details class="qa"${i === 0 ? ' open' : ''} data-reveal><summary><span class="qa-no">Q${String(i + 1).padStart(2, '0')}</span><span class="qa-q">${esc(item.q)}</span><span class="qa-mark" aria-hidden="true"></span></summary><p class="qa-a">${prose(item.a)}</p></details>`)
    .join('')}</div>
</section>`;
}

export function faqGraph(locale: Locale, page: PageKey) {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}${path(locale, page)}#faq`,
    inLanguage: locale,
    mainEntity: faq[locale].map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  };
}

/** Visible breadcrumb; mirrors the BreadcrumbList that layout.ts writes into JSON-LD. */
export function crumbs(locale: Locale, page: PageKey, trail?: { name: string; path: string }[]) {
  const c = copy[locale];
  const items = [{ name: c.navLabels.home, path: path(locale, 'home') }, ...(trail ?? [{ name: c.navLabels[page], path: path(locale, page) }])];
  return `<nav class="crumbs" aria-label="${locale === 'ja' ? 'パンくずリスト' : 'Breadcrumb'}"><ol>${items
    .map((t, i) => (i === items.length - 1 ? `<li><span aria-current="page">${esc(t.name)}</span></li>` : `<li><a href="${t.path}">${esc(t.name)}</a></li>`))
    .join('')}</ol></nav>`;
}
