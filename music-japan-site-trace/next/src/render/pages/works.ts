import { artwork, releases, type Locale, type Release } from '../../content/releases';
import { copy, path, SITE_URL, workPath } from '../../content/site';
import { arrow, esc, phrases, prose } from '../html';
import { innerHero, page } from '../layout';
import { button, crate, crumbs, ctaBlock, kicker, player, releaseData, sleeve } from '../parts';

const no = (i: number) => `MJ-${String(i + 1).padStart(3, '0')}`;
const tracks = (r: Release) => Number(r.type.match(/(\d+)\s*SONGS/)?.[1] ?? r.previews.length);
const isEP = (r: Release) => /\bEP\b/.test(r.type);
const artistId = (r: Release) => `${SITE_URL}/#artist-${r.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** schema.org node for one release. Everything in it is already shown on the page. */
export function workNode(locale: Locale, r: Release) {
  const url = `${SITE_URL}${workPath(locale, r.id)}`;
  const base = {
    '@id': `${url}#work`,
    name: r.title,
    url,
    description: r.description[locale],
    genre: r.type.split(/\s*[/·]\s*/).filter((g) => !/SONGS|SINGLE|\bEP\b/.test(g)),
    image: `${SITE_URL}${artwork(r, 1200)}`,
    byArtist: { '@type': 'MusicGroup', '@id': artistId(r), name: r.artist },
    sameAs: [r.href],
    copyrightNotice: r.credit,
    mainEntityOfPage: url,
  };
  if (isEP(r)) {
    return {
      '@type': 'MusicAlbum',
      ...base,
      albumReleaseType: 'https://schema.org/EPRelease',
      numTracks: tracks(r),
      track: { '@type': 'ItemList', numberOfItems: r.previews.length, itemListElement: r.previews.map((p, k) => ({ '@type': 'ListItem', position: k + 1, item: { '@type': 'MusicRecording', name: p.title, byArtist: { '@id': artistId(r) } } })) },
    };
  }
  return { '@type': 'MusicRecording', ...base };
}

function aboutArtist(locale: Locale, r: Release) {
  const c = copy[locale].crate;
  const ja = locale === 'ja';
  if (r.group === 'yuma') return { title: c.yumaTitle, body: c.yumaBody };
  return {
    title: c.brandTitle,
    body: ja ? `${r.artist}は、合同会社Music Japanが展開する音楽ブランドです。` : `${r.artist} is one of the music brands run by Music Japan LLC.`,
  };
}

export function renderWorks(locale: Locale) {
  const p = copy[locale].pages.works;
  const ja = locale === 'ja';
  const body = `${innerHero(locale, 'works', `<p class="ih-note"><span>${releases.length}</span>${ja ? 'RELEASES — YUMA / MUSIC BRANDS' : 'RELEASES — YUMA / MUSIC BRANDS'}</p>`)}
${crate(locale, { no: '01' })}
<section class="spec" aria-labelledby="index-title">
  <div class="sec-head">${kicker('INDEX', '02')}<h2 class="hx" id="index-title" data-split>${phrases(ja ? '全作品リスト' : 'Every release')}</h2></div>
  <ol class="tracklist tracklist--works">${releases
    .map((r, i) => `<li data-reveal><span class="tl-no">${no(i)}</span><a class="tl-name" href="${workPath(locale, r.id)}">${esc(r.title)}</a><span class="tl-body">${esc(r.artist)} — ${esc(r.type)}</span></li>`)
    .join('')}</ol>
</section>
${ctaBlock(locale)}
${player(locale)}`;
  return page({
    locale,
    page: 'works',
    title: p.seo,
    description: p.description,
    body,
    graph: [
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}${path(locale, 'works')}#list`,
        name: ja ? '合同会社Music Japanの作品' : 'Works by Music Japan LLC',
        numberOfItems: releases.length,
        itemListElement: releases.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${workPath(locale, r.id)}`, item: workNode(locale, r) })),
      },
    ],
  });
}

export function renderRelease(locale: Locale, index: number) {
  const r = releases[index];
  const c = copy[locale];
  const ja = locale === 'ja';
  const about = aboutArtist(locale, r);
  const others = releases.map((_, i) => i).filter((i) => i !== index).sort((a, b) => Number(releases[b].group === r.group) - Number(releases[a].group === r.group)).slice(0, 3);
  const trail = [
    { name: c.navLabels.works, path: path(locale, 'works') },
    { name: r.title, path: workPath(locale, r.id) },
  ];
  const facts: [string, string][] = [
    [ja ? '作品番号' : 'Catalogue no.', no(index)],
    [ja ? 'アーティスト' : 'Artist', esc(r.artist)],
    [ja ? 'ジャンル・形態' : 'Genre / format', esc(r.type)],
    [ja ? (r.previews.length > 1 ? '試聴できる曲' : '試聴') : r.previews.length > 1 ? 'Preview tracks' : 'Preview', r.previews.map((p) => esc(p.title)).join(' / ')],
    [ja ? '配信' : 'Listen on', `<a href="${r.href}" target="_blank" rel="noopener noreferrer">${esc(r.platform)}${arrow('up-right')}<span class="sr">${c.newTab}</span></a>`],
    [ja ? 'クレジット' : 'Credit', esc(r.credit)],
  ];
  const body = `<section class="wk" data-world-zone="portrait" style="--accent:${r.accent}" aria-labelledby="wk-title">
  <p class="ih-display" aria-hidden="true" data-split-display>${no(index)}</p>
  <div class="wk-grid">
    <button class="wk-art" type="button" data-open-release="${r.id}" aria-haspopup="dialog" aria-label="${esc(`${c.crate.open}: ${r.title} — ${r.artist}`)}" data-cursor-label="PLAY">
      <span class="wk-disc" aria-hidden="true"><span class="sleeve-grooves"></span><span class="sleeve-label" style="background-image:url(${artwork(r, 480)})"></span></span>
      <img src="${artwork(r, 800)}" srcset="${artwork(r, 480)} 480w, ${artwork(r, 800)} 800w, ${artwork(r, 1200)} 1200w" sizes="(max-width: 760px) 86vw, 40vw" width="800" height="800" alt="${esc(`${r.title} — ${r.artist}`)}" fetchpriority="high" decoding="async">
      <span class="sleeve-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
    </button>
    <div class="wk-copy">
      ${crumbs(locale, 'works', trail)}
      ${kicker(r.type, no(index))}
      <h1 class="wk-title" id="wk-title">${esc(r.title)}</h1>
      <p class="wk-artist">${esc(r.artist)}</p>
      <p class="ih-lead">${prose(r.description[locale])}</p>
      <div class="wk-actions">
        <button class="btn btn--solid" type="button" data-open-release="${r.id}" aria-haspopup="dialog" data-magnetic><span class="btn-label">${ja ? 'ここで試聴する' : 'Preview here'}</span>${arrow('right')}</button>
        ${button(c.player.listen(r.platform), r.href, 'line', locale)}
      </div>
    </div>
  </div>
</section>
<section class="spec" aria-labelledby="wk-spec">
  <div class="sec-head">${kicker('RELEASE INFORMATION', '01')}<h2 class="hx" id="wk-spec" data-split>${phrases(ja ? '作品情報' : 'Release information')}</h2></div>
  <dl class="spec-sheet">${facts.map(([k, v], i) => `<div class="spec-row" data-reveal><dt><i>${String(i + 1).padStart(2, '0')}</i>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
</section>
<section class="spec wk-about" aria-labelledby="wk-about">
  <div class="sec-head">${kicker(r.artist.toUpperCase(), '02')}<h2 class="hx" id="wk-about" data-split>${phrases(about.title)}</h2><p class="sec-body">${prose(about.body)}</p></div>
</section>
<section class="crate" data-world-zone="crate" aria-labelledby="wk-more">
  <div class="sec-head">${kicker(ja ? 'MORE FROM THE CRATE' : 'MORE FROM THE CRATE', '03')}<h2 class="hx" id="wk-more" data-split>${phrases(ja ? 'ほかの作品' : 'More releases')}</h2></div>
  <div class="crate-grid">${others.map((i) => sleeve(locale, i)).join('')}</div>
  <div class="sec-cta">${button(ja ? '作品一覧へ' : 'All works', path(locale, 'works'), 'line')}</div>
  ${releaseData(locale)}
</section>
${ctaBlock(locale)}
${player(locale)}`;
  const title = ja ? `${r.title}／${r.artist}｜合同会社Music Japan` : `${r.title} — ${r.artist} | Music Japan LLC`;
  const lead = ja ? `${r.artist}「${r.title}」（${r.type}）。${r.description.ja}` : `${r.title} by ${r.artist} (${r.type}). ${r.description.en}`;
  const tail = ja ? '合同会社Music Japanのサイトで試聴できます。' : ' Preview it on the Music Japan LLC site.';
  const description = (lead + tail).length <= (ja ? 120 : 160) ? lead + tail : lead;
  return page({
    locale,
    page: 'works',
    title,
    description,
    body,
    paths: { ja: workPath('ja', r.id), en: workPath('en', r.id) },
    trail,
    pageType: 'ItemPage',
    image: { url: `${SITE_URL}${artwork(r, 1200)}`, width: 1200, height: 1200, type: 'image/jpeg', alt: `${r.title} — ${r.artist}` },
    graph: [workNode(locale, r)],
  });
}
