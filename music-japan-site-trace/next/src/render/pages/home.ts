import { releases, type Locale } from '../../content/releases';
import { copy, path, SITE_URL } from '../../content/site';
import { esc, phrases, prose } from '../html';
import { page } from '../layout';
import { introMark, mark } from '../mark';
import { button, crate, ctaBlock, heading, kicker, mediaCards, partnersTeaser, player } from '../parts';

const brandLogos = [
  { src: '/brand-music-japan-logo-white.png', w: 797, h: 176 },
  { src: '/brand-second-take-logo-white.png', w: 1892, h: 658 },
  { src: '/brand-baton-wordmark-white.png', w: 418, h: 37 },
];

export function aboutSection(locale: Locale, no = '07') {
  const a = copy[locale].about;
  return `<section class="about" data-world-zone="ambient" aria-labelledby="about-title">
  <div class="sec-head">
    ${kicker(a.kicker, no)}
    <h2 class="hx" id="about-title" data-split>${phrases(a.title)}</h2>
    <p class="sec-body">${prose(a.body)}</p>
  </div>
  <ol class="brands">${a.brands
    .map(
      (b, i) => `<li class="brand-row" data-reveal>
      <span class="brand-no">0${i + 1}</span>
      <span class="brand-logo brand-logo--${i}"><img src="${brandLogos[i].src}" alt="${esc(b.kicker)}" width="${brandLogos[i].w}" height="${brandLogos[i].h}" loading="lazy" decoding="async"></span>
      <span class="brand-copy"><span class="brand-kicker">${esc(b.kicker)}</span><strong>${esc(b.title)}</strong><span>${prose(b.body)}</span></span>
    </li>`,
    )
    .join('')}</ol>
</section>`;
}

export function mediaSection(locale: Locale, no = '05') {
  const m = copy[locale].media;
  return `<section class="media" id="media" data-world-zone="voice" aria-labelledby="media-title">
  <div class="sec-head">
    ${kicker(m.kicker, no)}
    <h2 class="hx" id="media-title" data-split>${phrases(m.title)}</h2>
    <p class="sec-body">${prose(m.body)}</p>
  </div>
  ${mediaCards(locale)}
</section>`;
}

export function renderHome(locale: Locale): string {
  const c = copy[locale];
  const h = c.hero;
  const overlay = `<div class="intro" data-intro-overlay aria-hidden="true">
  <div class="intro-rings"><i></i><i></i><i></i></div>
  <div class="intro-mark">${introMark()}</div>
  <p class="intro-cap"><span>MUSIC JAPAN</span><span>SIDE A — 33⅓ RPM</span></p>
  <div class="intro-flash"></div>
</div>
`;
  const body = `

<section class="hero" data-world-zone="hero" aria-labelledby="hero-title">
  <div class="hero-top">
    ${kicker(h.kicker)}
    <p class="hero-rpm" aria-hidden="true"><span>33⅓ RPM</span><span>SIDE A</span><span data-now>NOW SPINNING — MJ-000</span></p>
  </div>
  <h1 class="hero-title" id="hero-title" aria-label="MUSIC FROM JAPAN. ${esc(h.lead.replace('\n', ''))}">
    <span class="ht" aria-hidden="true"><span class="ht-line" data-chars>MUSIC</span><span class="ht-line" data-chars>FROM</span><span class="ht-line ht-line--red" data-chars>JAPAN.</span></span>
  </h1>
  <div class="hero-foot">
    <p class="hero-lead" data-split>${phrases(h.lead)}</p>
    <p class="hero-sub">${prose(h.sub)}</p>
    <div class="hero-actions">${button(h.listen, '#catalog')}${button(h.talk, path(locale, 'contact'), 'line')}</div>
  </div>
  <p class="hero-scroll" aria-hidden="true"><i></i>${esc(h.scroll)}</p>
  <div class="hero-fallback" aria-hidden="true">${mark({ id: 'hf', cls: 'mj-mark hero-fallback-mark' })}</div>
</section>

<section class="stage" data-stage data-world-zone="stage" aria-label="${locale === 'ja' ? '音楽とメディアの仕事' : 'What we do'}">
  <div class="stage-pin">
    <div class="stage-steps">${c.stage
      .map(
        (s, i) => `<article class="step" data-step="${i}"${i === 0 ? ' data-active' : ''}>
        <p class="step-no"><span>${s.no}</span><i></i><span>0${i + 1} / 03</span></p>
        <p class="step-word" aria-hidden="true">${s.word}</p>
        <h2 class="step-title">${phrases(s.title)}</h2>
        <p class="step-body">${prose(s.body)}</p>
      </article>`,
      )
      .join('')}</div>
    <div class="stage-rail" aria-hidden="true"><span>A1</span><i><b data-stage-bar></b></i><span>A3</span></div>
  </div>
</section>

<section class="news" data-world-zone="ambient" aria-labelledby="news-title">
  <div class="news-head">${kicker(c.news.kicker, '02')}<h2 class="news-title" id="news-title">${esc(c.news.title)}</h2></div>
  <ul class="news-list">${c.news.items
    .map((n) => {
      const inner = `<time datetime="${n.date.replaceAll('.', '-')}">${n.date}</time><span class="news-label">${n.label}</span><span class="news-text">${esc(n.title)}</span><span class="news-arrow" aria-hidden="true">${n.href ? '↗' : ''}</span>`;
      if (!n.href) return `<li><div class="news-item">${inner}</div></li>`;
      const external = /^https?:/.test(n.href);
      return `<li><a class="news-item" href="${n.href}"${external ? ` target="_blank" rel="noopener noreferrer"` : ''}>${inner}${external ? `<span class="sr">${c.newTab}</span>` : ''}</a></li>`;
    })
    .join('')}</ul>
</section>

<section class="mf" data-world-zone="ambient" aria-labelledby="mf-title">
  ${kicker(c.manifesto.kicker, '03')}
  <h2 class="mf-title" id="mf-title" data-fill>${phrases(c.manifesto.title)}</h2>
  <p class="mf-body">${prose(c.manifesto.body)}</p>
  <ul class="mf-genres" aria-label="Genres"><li><i>01</i>ARTIST</li><li><i>02</i>JAZZ</li><li><i>03</i>CLASSICAL</li><li><i>04</i>SLEEP</li><li><i>05</i>PODCAST</li><li><i>06</i>STORIES</li></ul>
</section>

${crate(locale)}
${mediaSection(locale)}
${partnersTeaser(locale)}
${aboutSection(locale)}
${ctaBlock(locale)}
${player(locale)}`;

  return page({
    locale,
    page: 'home',
    title: c.home.title,
    description: c.home.description,
    body,
    overlay,
    world: 'home',
    bodyClass: 'is-home',
    graph: [
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}${path(locale, 'home')}#catalog`,
        name: locale === 'ja' ? '合同会社Music Japanの音楽作品' : 'Music from Music Japan LLC',
        numberOfItems: releases.length,
        itemListElement: releases.map((r, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'MusicRecording', name: r.title, byArtist: { '@type': 'MusicGroup', name: r.artist }, image: r.cdn, url: r.href },
        })),
      },
    ],
  });
}

export { heading };
