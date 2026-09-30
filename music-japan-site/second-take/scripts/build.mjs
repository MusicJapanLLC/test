// Generates every HTML page (Japanese at /, English at /en/) plus feeds,
// sitemap and search indexes into dist/. Static assets in dist/assets are
// hand-maintained and left untouched.
//   npm run build
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadDefaultJapaneseParser } from "budoux";
import { articles } from "../src/articles.mjs";
import { copy, links } from "../src/copy.mjs";

const ORIGIN = "https://secondtake.music-japan.com";
const DIST = join(process.cwd(), "dist");
const LANGS = ["ja", "en"];
const VERSION = "20261001";
const budoux = loadDefaultJapaneseParser();

// ---------- helpers ----------
const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Headline text: Japanese is split into phrases so lines never break mid-word.
const phrase = (lang, text) =>
  lang === "ja" ? budoux.parse(text).map(esc).join("<wbr>") : esc(text);

const prefix = (lang) => (lang === "en" ? "/en" : "");
const href = (lang, path) => `${prefix(lang)}${path}`;
const other = (lang) => (lang === "ja" ? "en" : "ja");

const formatDate = (lang, iso) => {
  const [y, m, d] = iso.split("-");
  if (lang === "ja") return `${y}.${m}.${d}`;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${month} ${Number(d)}, ${y}`;
};

const img = (article, { cls = "", eager = false, sizes = "100vw", alt = "" } = {}) => {
  const [w, h] = article.imageSize;
  return `<img class="${cls}" src="/assets/${article.image}.webp" width="${w}" height="${h}" alt="${esc(alt)}" sizes="${sizes}" style="object-position:${article.focus}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}>`;
};

const external = (url, label, cls = "") =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}<span class="ext" aria-hidden="true">↗</span></a>`;

const byNo = (a, b) => a.no.localeCompare(b.no);
const sorted = [...articles].sort(byNo);

// ---------- layout ----------
function head({ lang, path, title, description, image, type = "website", jsonld, article }) {
  const t = copy[lang];
  const url = `${ORIGIN}${href(lang, path ?? "/")}`;
  const alt = (l) => `${ORIGIN}${href(l, path)}`;
  const ogImage = image ? `${ORIGIN}${image}` : `${ORIGIN}/assets/second-take-cover.png`;
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0b0a09">
${path === null ? "" : `<link rel="canonical" href="${url}">`}
${path === null ? "" : `<link rel="alternate" hreflang="ja" href="${alt("ja")}">
<link rel="alternate" hreflang="en" href="${alt("en")}">
<link rel="alternate" hreflang="x-default" href="${alt("ja")}">`}
<link rel="alternate" type="application/rss+xml" title="SECOND TAKE" href="${ORIGIN}${href(lang, "/feed.xml")}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="SECOND TAKE">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:locale:alternate" content="${copy[other(lang)].ogLocale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
${article ? `<meta property="article:published_time" content="${article.date}T09:00:00+09:00">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/bodoni-moda-latin-opsz-italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/styles.css?v=${VERSION}">
<script>document.documentElement.classList.add("js")</script>
<script defer src="/assets/site.js?v=${VERSION}"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>`;
}

function header(lang, path, current) {
  const t = copy[lang];
  const navItem = (key, target) =>
    `<a href="${href(lang, target)}"${current === key ? ' aria-current="page"' : ""}>${t.nav[key]}</a>`;
  const altLang = other(lang);
  const altHref = path === null ? href(altLang, "/") : href(altLang, path);
  return `<a class="skip" href="#main">${t.skip}</a>
<header class="site-header" data-header>
  <div class="site-header__bar">
    <a class="brand" href="${href(lang, "/")}" aria-label="SECOND TAKE">
      <img class="brand__ink" src="/assets/second-take-logo-header.png" width="700" height="243" alt="SECOND TAKE BUSINESS × LIFE">
      <img class="brand__white" src="/assets/second-take-logo-header-white.png" width="700" height="243" alt="">
    </a>
    <nav class="site-nav" aria-label="${t.navLabel}">
      ${navItem("stories", "/#stories")}
      ${navItem("archive", "/articles/")}
      ${navItem("listen", "/#side-b")}
      ${navItem("about", "/about/")}
      ${navItem("contact", "/contact/")}
    </nav>
    <div class="site-tools">
      <span class="lang-switch">
        <span class="lang-switch__current" aria-current="true">${lang.toUpperCase()}</span>
        <a href="${altHref}" hreflang="${altLang}" lang="${altLang}" data-lang-link>${altLang.toUpperCase()}<span class="visually-hidden"> — ${copy[altLang].langName}</span></a>
      </span>
      <button class="icon-btn" type="button" data-open-search aria-label="${t.search}"><span class="i-search" aria-hidden="true"></span></button>
      <button class="icon-btn icon-btn--menu" type="button" data-open-menu aria-label="${t.menuOpen}"><span class="i-menu" aria-hidden="true"></span></button>
    </div>
  </div>
  <div class="read-progress" aria-hidden="true"><span data-progress></span></div>
</header>`;
}

function dialogs(lang, path) {
  const t = copy[lang];
  const altLang = other(lang);
  const altHref = path === null ? href(altLang, "/") : href(altLang, path);
  return `<dialog class="search-dialog" data-search-dialog aria-label="${t.search}">
  <div class="search-dialog__inner">
    <div class="search-dialog__field">
      <span class="i-search" aria-hidden="true"></span>
      <label class="visually-hidden" for="search-input">${t.search}</label>
      <input id="search-input" type="search" placeholder="${t.searchPlaceholder}" autocomplete="off" data-search-input>
      <button class="text-btn" type="button" data-close>${t.menuClose}</button>
    </div>
    <ol class="search-results" data-search-results data-empty="${esc(t.searchEmpty)}"></ol>
  </div>
</dialog>
<dialog class="menu-dialog" data-menu-dialog aria-label="Menu">
  <div class="menu-dialog__top">
    <span class="menu-dialog__label">SECOND TAKE</span>
    <button class="text-btn" type="button" data-close>${t.menuClose}</button>
  </div>
  <nav class="menu-dialog__nav">
    <a href="${href(lang, "/#stories")}"><span>01</span>${t.nav.stories}</a>
    <a href="${href(lang, "/articles/")}"><span>02</span>${t.nav.archive}</a>
    <a href="${href(lang, "/#side-b")}"><span>03</span>${t.nav.listen}</a>
    <a href="${href(lang, "/about/")}"><span>04</span>${t.nav.about}</a>
    <a href="${href(lang, "/contact/")}"><span>05</span>${t.nav.contact}</a>
  </nav>
  <div class="menu-dialog__foot">
    ${external(links.booking, t.cta.book, "btn btn--light")}
    <a class="menu-dialog__lang" href="${altHref}" hreflang="${altLang}" lang="${altLang}">${copy[altLang].langName}</a>
  </div>
</dialog>`;
}

function footer(lang, path) {
  const t = copy[lang];
  const altLang = other(lang);
  const altHref = path === null ? href(altLang, "/") : href(altLang, path);
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__top">
      <a class="site-footer__brand" href="${href(lang, "/")}" aria-label="SECOND TAKE"><img src="/assets/second-take-logo-header-white.png" width="700" height="243" alt="SECOND TAKE"></a>
      <nav class="site-footer__nav" aria-label="Footer">
        <a href="${href(lang, "/#stories")}">${t.nav.stories}</a>
        <a href="${href(lang, "/articles/")}">${t.nav.archive}</a>
        <a href="${href(lang, "/#side-b")}">${t.nav.listen}</a>
        <a href="${href(lang, "/about/")}">${t.nav.about}</a>
        <a href="${href(lang, "/contact/")}">${t.nav.contact}</a>
      </nav>
      <div class="site-footer__links">
        <p class="label">${t.footer.operated}</p>
        ${external(lang === "en" ? links.companyEn : links.company, lang === "ja" ? "合同会社Music Japan" : "Music Japan LLC")}
        ${external(links.linkedin, "LinkedIn")}
        ${external(links.booking, t.cta.book)}
      </div>
    </div>
    <div class="site-footer__bottom">
      <p>${t.footer.rights}</p>
      <p class="site-footer__sample">${t.sample}</p>
      <a href="${altHref}" hreflang="${altLang}" lang="${altLang}">${copy[altLang].langName}</a>
    </div>
  </div>
</footer>`;
}

function page({ lang, path, current, bodyClass, main, ...meta }) {
  return `${head({ lang, path, ...meta })}
<body class="${bodyClass} has-dark-top" data-lang="${lang}">
${header(lang, path, current)}
<main id="main">
${main}
</main>
${footer(lang, path)}
${dialogs(lang, path)}
</body>
</html>
`;
}

// ---------- shared blocks ----------
function secHead(lang, en, sub, link) {
  return `<header class="sec-head reveal">
  <h2 class="sec-title"><span class="sec-title__en">${en}</span><span class="sec-title__sub">${esc(sub)}</span></h2>
  ${link ? `<a class="sec-link" href="${link.href}">${esc(link.label)}<span aria-hidden="true">→</span></a>` : ""}
</header>`;
}

function poster(lang, a) {
  const e = a[lang];
  return `<article class="poster reveal">
  <a class="poster__link" href="${href(lang, `/articles/${a.slug}/`)}">
    <figure class="poster__media">
      ${img(a, { cls: "poster__img", sizes: "(min-width: 900px) 30vw, 80vw" })}
      <span class="poster__take">Take 2</span>
      <span class="poster__no">No.${a.no}</span>
    </figure>
    <div class="poster__body">
      <p class="tags">${e.tags.map(esc).join("<i>/</i>")}</p>
      <h3 class="poster__title">${phrase(lang, e.title)}</h3>
      <p class="poster__meta"><span>${esc(e.name)} — ${esc(e.company)}</span><span>${copy[lang].minRead(a.minutes)}</span></p>
    </div>
  </a>
</article>`;
}

function contactBand(lang) {
  const t = copy[lang];
  return `<section class="contact-band" aria-labelledby="contact-band-title">
  <div class="wrap contact-band__inner reveal">
    <p class="eyebrow">Contact</p>
    <h2 class="contact-band__title" id="contact-band-title">${phrase(lang, t.home.contactHeading)}</h2>
    <p class="contact-band__body">${esc(t.home.contactBody)}</p>
    <div class="cta-row">
      ${external(links.booking, t.cta.book, "btn btn--solid")}
      ${external(links.linkedin, t.cta.linkedin, "btn btn--line")}
    </div>
  </div>
</section>`;
}

function record(label = "SIDE B", cls = "") {
  return `<div class="record ${cls}" aria-hidden="true">
  <div class="record__disc"><div class="record__label"><span>${label}</span></div></div>
  <span class="record__slash"></span>
</div>`;
}

function pageOpen(lang, eyebrow, title, lead, extra = "") {
  return `<section class="page-open">
  <div class="page-open__grain" aria-hidden="true"></div>
  <div class="wrap page-open__inner">
    <p class="slate"><span>SECOND TAKE</span><span>${esc(eyebrow)}</span></p>
    <h1 class="page-open__title">${phrase(lang, title)}</h1>
    ${lead ? `<p class="page-open__lead">${esc(lead)}</p>` : ""}
    ${extra}
  </div>
  <div class="letterbox" aria-hidden="true"><span data-timecode>00:00:00:00</span><span>${esc(eyebrow)}</span></div>
</section>`;
}

// ---------- pages ----------
function homePage(lang) {
  const t = copy[lang];
  const lead = sorted[0];
  const e = lead[lang];
  const main = `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__frame">
    ${img(lead, { cls: "hero__img", eager: true, alt: lang === "ja" ? `${e.name}（サンプル写真）` : `${e.name} (sample photo)` })}
    <div class="hero__shade" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <svg class="hero__slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="hero__slash-wide" x1="72" y1="104" x2="104" y2="0" /><line class="hero__slash-narrow" x1="46" y1="45" x2="104" y2="-2" /></svg>
    <p class="hero__take" aria-hidden="true"><span>Take</span> 2</p>
    <div class="hero__content">
      <p class="slate"><span>No.${lead.no}</span><span>Scene 01</span><span>${e.tags.map(esc).join(" / ")}</span></p>
      <h1 class="hero__title" id="hero-title"><a href="${href(lang, `/articles/${lead.slug}/`)}">${phrase(lang, e.title)}</a></h1>
      <p class="hero__who">${esc(e.name)}<span>${esc(e.company)}　${esc(e.role)}</span></p>
      <div class="hero__actions">
        <a class="cine-link" href="${href(lang, `/articles/${lead.slug}/`)}">${t.readStory}<span class="cine-link__line" aria-hidden="true"></span></a>
        <a class="quiet-link" href="${href(lang, `/articles/${lead.slug}/#brief`)}">${t.brief}</a>
      </div>
    </div>
    <p class="hero__subtitle"><span>${phrase(lang, e.subtitle)}</span></p>
  </div>
  <div class="letterbox" aria-hidden="true">
    <span data-timecode>00:00:00:00</span>
    <span>${t.minReadLong(lead.minutes)}</span>
    <span class="letterbox__rec">SECOND TAKE</span>
  </div>
</section>

<section class="section stories" id="stories">
  <div class="wrap">
    ${secHead(lang, t.home.storiesTitle, t.home.storiesSub, { href: href(lang, "/articles/"), label: t.home.allStories })}
    <div class="posters">
      ${sorted.map((a) => poster(lang, a)).join("\n")}
    </div>
  </div>
</section>

<section class="section decisions" id="decisions">
  <div class="wrap">
    ${secHead(lang, t.home.decisionsTitle, t.home.decisionsSub)}
    <ol class="decision-list">
      ${sorted
        .map(
          (a) => `<li class="reveal"><a class="decision" href="${href(lang, `/articles/${a.slug}/`)}" data-float="/assets/${a.image}.webp">
        <span class="decision__no">${a.no}</span>
        <span class="decision__text">${phrase(lang, a[lang].decision)}</span>
        <span class="decision__who">${esc(a[lang].name)}<small>${esc(a[lang].company)}</small></span>
        <span class="decision__arrow" aria-hidden="true">→</span>
      </a></li>`
        )
        .join("\n")}
    </ol>
  </div>
  <figure class="decision-float" aria-hidden="true"><img alt="" data-float-img></figure>
</section>

<section class="statement">
  <div class="grain" aria-hidden="true"></div>
  <div class="wrap statement__inner reveal">
    <p class="eyebrow">${t.home.statementEyebrow}</p>
    <p class="statement__text">${phrase(lang, t.home.statement)}</p>
    <p class="statement__body">${esc(t.home.statementBody)}</p>
    <a class="cine-link cine-link--light" href="${href(lang, "/about/")}">${t.home.statementLink}<span class="cine-link__line" aria-hidden="true"></span></a>
  </div>
</section>

<section class="section side-b" id="side-b" aria-labelledby="side-b-title">
  <div class="wrap side-b__grid">
    ${record("SIDE B", "reveal")}
    <div class="side-b__text reveal">
      <p class="sec-title__en">${t.home.sideBTitle}</p>
      <h2 class="side-b__heading" id="side-b-title">${phrase(lang, t.home.sideBHeading)}</h2>
      <p class="side-b__body">${esc(t.home.sideBBody)}</p>
      <ol class="tracklist">
        ${sorted
          .map(
            (a, i) => `<li><span class="tracklist__no">B${i + 1}</span><span class="tracklist__title">${esc(a[lang].name)}<small>${esc(a[lang].decision)}</small></span><span class="tracklist__status">${t.home.sideBStatus}</span></li>`
          )
          .join("\n")}
      </ol>
    </div>
  </div>
</section>

${contactBand(lang)}`;

  return page({
    lang,
    path: "/",
    current: "stories",
    bodyClass: "page-home",
    title: t.siteTitle,
    description: t.siteDescription,
    main,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://music-japan.com/#organization",
          name: "合同会社Music Japan",
          alternateName: "Music Japan LLC",
          url: "https://music-japan.com/"
        },
        {
          "@type": "WebSite",
          "@id": `${ORIGIN}/#website`,
          url: `${ORIGIN}${href(lang, "/")}`,
          name: "SECOND TAKE",
          description: t.siteDescription,
          inLanguage: lang === "ja" ? "ja-JP" : "en",
          publisher: { "@id": "https://music-japan.com/#organization" }
        }
      ]
    }
  });
}

function articlePage(lang, a) {
  const t = copy[lang];
  const ta = t.article;
  const e = a[lang];
  const i = sorted.indexOf(a);
  const next = sorted[(i + 1) % sorted.length];
  const others = sorted.filter((x) => x !== a);
  const path = `/articles/${a.slug}/`;
  const shareUrl = encodeURIComponent(`${ORIGIN}${href(lang, path)}`);
  const shareText = encodeURIComponent(`${e.title}｜SECOND TAKE`);

  let frameCount = 0;
  const block = ([type, text]) => {
    if (type === "q") return `<p class="q">${esc(text)}</p>`;
    if (type === "a") return `<p class="a"><span class="a__who">${esc(e.speaker)}</span>${esc(text)}</p>`;
    if (type === "quote")
      return `<figure class="frame reveal">
        <img class="frame__still" src="/assets/${a.image}.webp" alt="" loading="lazy" decoding="async" style="object-position:${frameCount++ % 2 ? "70% 62%" : "40% 18%"}">
        <div class="grain" aria-hidden="true"></div>
        <span class="frame__tc" aria-hidden="true">No.${a.no} — ${esc(e.speaker)}</span>
        <blockquote class="frame__line"><p>${phrase(lang, text)}</p></blockquote>
      </figure>`;
    return `<p>${esc(text)}</p>`;
  };

  const main = `
<article class="story" data-story>
  <header class="story-open">
    <div class="grain" aria-hidden="true"></div>
    <div class="wrap story-open__grid">
      <div class="story-open__text">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${href(lang, "/")}">SECOND TAKE</a><i>/</i><a href="${href(lang, "/articles/")}">${ta.crumbs}</a><i>/</i><span>No.${a.no}</span></nav>
        <p class="slate"><span>No.${a.no}</span><span>Take 2</span><span>${e.tags.map(esc).join(" / ")}</span></p>
        <h1 class="story-title">${phrase(lang, e.title)}</h1>
        <p class="story-dek">${esc(e.dek)}</p>
        <dl class="story-meta">
          <div><dt>${ta.interview}</dt><dd>${esc(e.name)}<small>${esc(e.company)}　${esc(e.role)}</small></dd></div>
          <div><dt>${ta.credit}</dt><dd>${esc(ta.editor)}</dd></div>
          <div><dt>Date</dt><dd><time datetime="${a.date}">${formatDate(lang, a.date)}</time></dd></div>
          <div><dt>Read</dt><dd>${t.minRead(a.minutes)}</dd></div>
        </dl>
      </div>
      <figure class="story-open__media">
        ${img(a, { cls: "story-open__img", eager: true, sizes: "(min-width: 960px) 40vw, 100vw", alt: lang === "ja" ? `${e.name}（サンプル写真）` : `${e.name} (sample photo)` })}
        <figcaption>${ta.photo}</figcaption>
      </figure>
    </div>
    <div class="letterbox" aria-hidden="true"><span data-timecode>00:00:00:00</span><span>${ta.scene} 01 — 0${e.scenes.length}</span><span>${t.minReadLong(a.minutes)}</span></div>
  </header>

  <div class="story-body">
    <aside class="story-rail">
      <div class="story-rail__sticky">
        <p class="label">${ta.toc}</p>
        <ol class="toc" data-toc>
          ${e.scenes.map((s, n) => `<li><a href="#scene-${n + 1}"><span>0${n + 1}</span>${esc(s.short)}</a></li>`).join("\n")}
        </ol>
        <button class="size-btn" type="button" data-size-toggle data-sizes="${esc(JSON.stringify(ta.sizes))}" data-label="${esc(ta.textSize)}">Aa<span>${ta.textSize}：${ta.sizes[0]}</span></button>
      </div>
    </aside>

    <div class="prose">
      <section class="brief" id="brief" aria-labelledby="brief-title">
        <h2 class="brief__title" id="brief-title"><span>${ta.briefTitle}</span><small>${ta.briefSub}</small></h2>
        <ol>${e.brief.map((b) => `<li>${phrase(lang, b)}</li>`).join("")}</ol>
      </section>
      <div class="intro">
        ${e.intro.map((p, n) => (n === 0 ? `<p class="intro__first">${phrase(lang, p)}</p>` : `<p>${esc(p)}</p>`)).join("\n")}
      </div>
      ${e.scenes
        .map(
          (s, n) => `<section class="scene" id="scene-${n + 1}" data-scene>
        <h2 class="scene__head"><span class="scene__no">${ta.scene} 0${n + 1}</span><span class="scene__title">${phrase(lang, s.heading)}</span></h2>
        ${s.blocks.map(block).join("\n")}
      </section>`
        )
        .join("\n")}

      <div class="story-end">
        <div class="share">
          <p class="label">${ta.share}</p>
          <div class="share__links">
            ${lang === "ja" ? external(`https://social-plugins.line.me/lineit/share?url=${shareUrl}`, "LINE") : ""}
            ${external(`https://x.com/intent/post?url=${shareUrl}&text=${shareText}`, "X")}
            ${external(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, "LinkedIn")}
            <button class="text-btn" type="button" data-copy="${ORIGIN}${href(lang, path)}" data-copied="${esc(ta.copied)}">${ta.copy}</button>
          </div>
        </div>
        <section class="profile">
          <div class="profile__img">${img(a, { sizes: "120px", alt: "" })}</div>
          <div>
            <p class="label">${ta.profile}</p>
            <h2 class="profile__name">${esc(e.name)}<small>${esc(e.company)}　${esc(e.role)}</small></h2>
            <p>${esc(e.profile)}</p>
            <p class="profile__note">${esc(ta.sampleNote)}</p>
          </div>
        </section>
        <section class="listen">
          ${record("B" + (i + 1), "record--mini")}
          <div>
            <p class="label">${ta.listenTitle}</p>
            <h2 class="listen__title">${phrase(lang, ta.listenHeading)}</h2>
            <span class="status-pill">${ta.listenStatus}</span>
          </div>
        </section>
      </div>
    </div>
  </div>

  <a class="next-take" href="${href(lang, `/articles/${next.slug}/`)}">
    ${img(next, { cls: "next-take__img", sizes: "100vw" })}
    <div class="next-take__shade" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <div class="wrap next-take__inner">
      <p class="slate"><span>${ta.next}</span><span>No.${next.no}</span></p>
      <p class="next-take__title">${phrase(lang, next[lang].title)}</p>
      <p class="next-take__who">${esc(next[lang].name)} — ${esc(next[lang].company)}<span class="next-take__arrow" aria-hidden="true">→</span></p>
    </div>
  </a>

  <section class="section more">
    <div class="wrap">
      ${secHead(lang, ta.more, t.home.storiesSub, { href: href(lang, "/articles/"), label: t.home.allStories })}
      <div class="posters posters--two">${others.map((x) => poster(lang, x)).join("\n")}</div>
    </div>
  </section>
</article>
<div class="resume" data-resume hidden>
  <button type="button" class="resume__go" data-resume-go>${ta.resume}</button>
  <button type="button" class="resume__close" data-resume-close aria-label="${ta.dismiss}">×</button>
</div>`;

  return page({
    lang,
    path,
    current: "archive",
    bodyClass: "page-article",
    title: `${e.title}｜SECOND TAKE`,
    description: e.dek,
    image: `/assets/${a.image}.jpg`,
    type: "article",
    article: a,
    main,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: e.title,
      description: e.dek,
      datePublished: `${a.date}T09:00:00+09:00`,
      inLanguage: lang === "ja" ? "ja-JP" : "en",
      image: `${ORIGIN}/assets/${a.image}.jpg`,
      author: { "@type": "Organization", name: "SECOND TAKE" },
      publisher: { "@type": "Organization", name: "Music Japan LLC", url: "https://music-japan.com/" },
      about: { "@type": "Person", name: e.name },
      mainEntityOfPage: `${ORIGIN}${href(lang, path)}`
    }
  });
}

function archivePage(lang) {
  const t = copy[lang];
  const ta = t.archive;
  const tags = [...new Set(sorted.flatMap((a) => a[lang].tags))];
  const main = `
${pageOpen(lang, ta.title, ta.sub, ta.lead)}
<section class="section archive">
  <div class="wrap">
    <div class="filters" role="group" aria-label="${ta.filterLabel}" data-filters>
      <button type="button" aria-pressed="true" data-filter="">${ta.all}</button>
      ${tags.map((tag) => `<button type="button" aria-pressed="false" data-filter="${esc(tag)}">${esc(tag)}</button>`).join("\n")}
    </div>
    <ol class="archive-list">
      ${sorted
        .map((a) => {
          const e = a[lang];
          return `<li data-tags="${esc(e.tags.join("|"))}" class="reveal">
        <a class="row" href="${href(lang, `/articles/${a.slug}/`)}">
          <span class="row__no">${a.no}</span>
          <span class="row__img">${img(a, { sizes: "160px" })}</span>
          <span class="row__main">
            <span class="tags">${e.tags.map(esc).join("<i>/</i>")}</span>
            <span class="row__title">${phrase(lang, e.title)}</span>
            <span class="row__who">${esc(e.name)} — ${esc(e.company)}</span>
          </span>
          <span class="row__meta"><time datetime="${a.date}">${formatDate(lang, a.date)}</time><span>${t.minRead(a.minutes)}</span></span>
        </a>
      </li>`;
        })
        .join("\n")}
    </ol>
  </div>
</section>
${contactBand(lang)}`;
  return page({
    lang,
    path: "/articles/",
    current: "archive",
    bodyClass: "page-archive",
    title: `${ta.title} — ${ta.sub}｜SECOND TAKE`,
    description: ta.lead,
    main
  });
}

function aboutPage(lang) {
  const t = copy[lang];
  const ab = t.about;
  const main = `
${pageOpen(lang, ab.eyebrow, ab.heading, ab.lead)}
<section class="section principles">
  <div class="wrap">
    ${secHead(lang, ab.principlesTitle, lang === "ja" ? "編集方針" : "How we work")}
    <ol class="principle-list">
      ${ab.principles
        .map(
          ([title, body], n) => `<li class="reveal"><span class="principle__no">0${n + 1}</span><h3>${phrase(lang, title)}</h3><p>${esc(body)}</p></li>`
        )
        .join("\n")}
    </ol>
  </div>
</section>
<section class="section formats">
  <div class="wrap">
    ${secHead(lang, ab.formatTitle, lang === "ja" ? "記事と声" : "Print and voice")}
    <dl class="format-list">
      ${ab.formats
        .map(
          ([en, name, body]) => `<div class="reveal"><dt><span class="didone-i">${esc(en)}</span><small>${esc(name)}</small></dt><dd>${esc(body)}</dd></div>`
        )
        .join("\n")}
    </dl>
  </div>
</section>
<section class="section publisher">
  <div class="wrap"><div class="publisher__grid reveal">
    <div>
      <p class="sec-title__en">${ab.publisherTitle}</p>
      <p class="publisher__text">${esc(ab.publisher)}</p>
    </div>
    <div class="publisher__links">
      ${external(lang === "en" ? links.companyEn : links.company, lang === "ja" ? "合同会社Music Japan" : "Music Japan LLC", "publisher__link")}
      ${external(links.linkedin, `${esc(ab.person)}<small>LinkedIn</small>`, "publisher__link")}
    </div>
  </div></div>
</section>
${contactBand(lang)}`;
  return page({
    lang,
    path: "/about/",
    current: "about",
    bodyClass: "page-about",
    title: `${ab.title}｜SECOND TAKE`,
    description: ab.lead,
    main
  });
}

function contactPage(lang) {
  const t = copy[lang];
  const c = t.contact;
  const ctas = `<div class="cta-row">
      ${external(links.booking, t.cta.book, "btn btn--light")}
      ${external(links.linkedin, t.cta.linkedin, "btn btn--line-light")}
    </div>
    <p class="page-open__note">${esc(t.cta.bookNote)}</p>`;
  const main = `
${pageOpen(lang, c.eyebrow, c.heading, c.lead, ctas)}
<section class="section cases">
  <div class="wrap">
    ${secHead(lang, "Inquiries", lang === "ja" ? "こんなご相談を受け付けています" : "What we can talk about")}
    <ol class="case-list">
      ${c.cases
        .map(([title, body], n) => `<li class="reveal"><span class="principle__no">0${n + 1}</span><h3>${phrase(lang, title)}</h3><p>${esc(body)}</p></li>`)
        .join("\n")}
    </ol>
    <div class="cases__foot reveal">
      ${external(links.booking, t.cta.book, "btn btn--solid")}
      ${external(lang === "en" ? links.companyEn : links.company, t.cta.company, "quiet-link")}
    </div>
  </div>
</section>`;
  return page({
    lang,
    path: "/contact/",
    current: "contact",
    bodyClass: "page-contact",
    title: `${c.title}｜SECOND TAKE`,
    description: c.lead,
    main
  });
}

function notFoundPage() {
  const ja = copy.ja.notFound;
  const en = copy.en.notFound;
  const main = `<section class="page-open page-open--full">
  <div class="page-open__grain" aria-hidden="true"></div>
  <div class="wrap page-open__inner">
    <p class="slate"><span>404</span><span>NG Take</span></p>
    <h1 class="page-open__title">${phrase("ja", ja.heading)}</h1>
    <p class="page-open__lead">${esc(ja.body)}</p>
    <p class="page-open__lead page-open__lead--en" lang="en">${esc(en.heading)} ${esc(en.body)}</p>
    <div class="cta-row">
      <a class="btn btn--light" href="/">${ja.back}</a>
      <a class="btn btn--line-light" href="/en/" lang="en">${en.back}</a>
    </div>
  </div>
</section>`;
  return page({ lang: "ja", path: null, current: "", bodyClass: "page-404", title: `${ja.title}｜SECOND TAKE`, description: ja.body, main });
}

// ---------- feeds, sitemap, search ----------
function feed(lang) {
  const t = copy[lang];
  const items = sorted
    .map((a) => {
      const e = a[lang];
      const url = `${ORIGIN}${href(lang, `/articles/${a.slug}/`)}`;
      return `  <item>
    <title>${esc(e.title)}</title>
    <link>${url}</link>
    <guid>${url}</guid>
    <pubDate>${new Date(`${a.date}T09:00:00+09:00`).toUTCString()}</pubDate>
    <description>${esc(e.dek)}</description>
  </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>SECOND TAKE${lang === "en" ? " (English)" : ""}</title>
  <link>${ORIGIN}${href(lang, "/")}</link>
  <description>${esc(t.siteDescription)}</description>
  <language>${lang}</language>
${items}
</channel>
</rss>
`;
}

function sitemap(paths) {
  const urls = paths
    .map(
      (p) => `  <url>
    <loc>${ORIGIN}${p}</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="${ORIGIN}${p.replace(/^\/en/, "")}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}${p.startsWith("/en") ? p : `/en${p}`}"/>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function searchIndex(lang) {
  return JSON.stringify(
    sorted.map((a) => {
      const e = a[lang];
      return {
        url: href(lang, `/articles/${a.slug}/`),
        no: a.no,
        title: e.title,
        name: e.name,
        company: e.company,
        decision: e.decision,
        tags: e.tags,
        image: `/assets/${a.image}.webp`,
        text: [e.dek, ...e.brief].join(" ")
      };
    })
  );
}

// ---------- write ----------
function write(relPath, content) {
  const target = join(DIST, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

for (const generated of ["index.html", "404.html", "articles", "about", "contact", "en"]) {
  const target = join(DIST, generated);
  if (existsSync(target)) rmSync(target, { recursive: true });
}

const sitemapPaths = [];
for (const lang of LANGS) {
  const base = lang === "en" ? "en/" : "";
  write(`${base}index.html`, homePage(lang));
  write(`${base}articles/index.html`, archivePage(lang));
  write(`${base}about/index.html`, aboutPage(lang));
  write(`${base}contact/index.html`, contactPage(lang));
  for (const a of sorted) write(`${base}articles/${a.slug}/index.html`, articlePage(lang, a));
  write(`${base}feed.xml`, feed(lang));
  write(`assets/search-${lang}.json`, searchIndex(lang));
  for (const p of ["/", "/articles/", "/about/", "/contact/", ...sorted.map((a) => `/articles/${a.slug}/`)]) {
    sitemapPaths.push(href(lang, p));
  }
}
write("404.html", notFoundPage());
write("sitemap.xml", sitemap(sitemapPaths));
process.stdout.write(`build: ${sitemapPaths.length} pages + 404\n`);
