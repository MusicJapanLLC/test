// Generates every HTML page (Japanese at /, English at /en/) plus feeds,
// sitemap and search indexes into dist/. Static assets in dist/assets are
// hand-maintained and left untouched.
//   npm run build
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadDefaultJapaneseParser } from "budoux";
import { articles } from "../src/articles.mjs";
import { copy, links, nav } from "../src/copy.mjs";

const ORIGIN = "https://secondtake.music-japan.com";
const DIST = join(process.cwd(), "dist");
const LANGS = ["ja", "en"];
const VERSION = "20261001c";
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

// Copy strings may contain "\n" for a deliberate line break.
const lines = (lang, text) => text.split("\n").map((t) => phrase(lang, t)).join("<br>");

const prefix = (lang) => (lang === "en" ? "/en" : "");
const href = (lang, path) => `${prefix(lang)}${path}`;
const other = (lang) => (lang === "ja" ? "en" : "ja");
const stNo = (a) => `ST.${a.no.padStart(3, "0")}`;

const formatDate = (lang, iso) => {
  const [y, m, d] = iso.split("-");
  if (lang === "ja") return `${y}.${m}.${d}`;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${month} ${Number(d)}, ${y}`;
};

const img = (article, { cls = "", eager = false, sizes = "100vw", alt = "", text = "" } = {}) => {
  if (!article.image) {
    return `<div class="${cls} typo-cover" role="img" aria-label="${esc(alt || `ST.${article.no.padStart(3, "0")}`)}"><span class="typo-cover__no">ST.${article.no.padStart(3, "0")}</span>${text ? `<span class="typo-cover__q">${esc(text)}</span>` : ""}<span class="typo-cover__slash" aria-hidden="true"></span></div>`;
  }
  const [w, h] = article.imageSize;
  return `<img class="${cls}" src="/assets/${article.image}.webp" width="${w}" height="${h}" alt="${esc(alt)}" sizes="${sizes}" style="object-position:${article.focus}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}>`;
};

const external = (url, label, cls = "") =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}<span class="ext" aria-hidden="true">↗</span></a>`;

const byNo = (a, b) => b.no.localeCompare(a.no);
const sorted = [...articles].sort(byNo);
const altPath = (lang, path) => href(other(lang), path === null ? "/" : path);

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
<meta name="theme-color" content="#f5f3ee">
${path === null ? "" : `<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ja" href="${alt("ja")}">
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
<link rel="stylesheet" href="/assets/fonts.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/styles.css?v=${VERSION}">
<script>document.documentElement.classList.add("js")</script>
<script defer src="/assets/site.js?v=${VERSION}"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>`;
}

function langSwitch(lang, path) {
  const o = other(lang);
  return `<span class="lang-switch">
        <span class="lang-switch__current" aria-current="true">${lang.toUpperCase()}</span>
        <a href="${altPath(lang, path)}" hreflang="${o}" lang="${o}" data-lang-link>${o.toUpperCase()}<span class="visually-hidden"> — ${copy[o].langName}</span></a>
      </span>`;
}

function navLinks(lang, current) {
  return nav
    .map(([key, label, target]) => `<a href="${href(lang, target)}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("\n        ");
}

function bar(lang, path, current, isHome) {
  const t = copy[lang];
  return `<a class="skip" href="#main">${t.skip}</a>
<header class="bar${isHome ? " bar--home" : ""}" data-bar>
  <div class="bar__inner">
    <a class="bar__brand" href="${href(lang, "/")}" aria-label="SECOND TAKE">
      <img src="/assets/second-take-logo-header.png" width="700" height="243" alt="SECOND TAKE BUSINESS × LIFE">
    </a>
    <nav class="bar__nav" aria-label="${t.navLabel}">
        ${navLinks(lang, current)}
    </nav>
    <div class="bar__tools">
      ${langSwitch(lang, path)}
      <button class="icon-btn" type="button" data-open-search aria-label="${t.search}"><span class="i-search" aria-hidden="true"></span></button>
      <button class="icon-btn icon-btn--menu" type="button" data-open-menu aria-label="${t.menuOpen}"><span class="i-menu" aria-hidden="true"></span></button>
    </div>
  </div>
  <div class="read-progress" aria-hidden="true"><span data-progress></span></div>
</header>`;
}

function masthead(lang, path) {
  const t = copy[lang];
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="masthead" data-masthead>
  <div class="wrap masthead__util">
    <span class="masthead__date" data-today>${formatDate(lang, today)}</span>
    <span class="masthead__tag">${esc(t.tagline)}</span>
    <div class="masthead__tools">
      ${langSwitch(lang, path)}
      <button class="icon-btn" type="button" data-open-search aria-label="${t.search}"><span class="i-search" aria-hidden="true"></span></button>
    </div>
  </div>
  <div class="masthead__brand">
    <a href="${href(lang, "/")}" aria-label="SECOND TAKE"><img src="/assets/second-take-logo.png" width="2048" height="682" alt="SECOND TAKE BUSINESS × LIFE" fetchpriority="high"></a>
  </div>
  <div class="wrap"><nav class="masthead__nav" aria-label="${t.navLabel}">
        ${navLinks(lang, "")}
  </nav></div>
</div>`;
}

function dialogs(lang, path) {
  const t = copy[lang];
  const o = other(lang);
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
    <img src="/assets/second-take-logo-header-white.png" width="700" height="243" alt="SECOND TAKE">
    <button class="text-btn" type="button" data-close>${t.menuClose}</button>
  </div>
  <nav class="menu-dialog__nav">
    ${nav.map(([, label, target], i) => `<a href="${href(lang, target)}"><span>0${i + 1}</span>${label}</a>`).join("\n    ")}
  </nav>
  <div class="menu-dialog__foot">
    <a href="${href(lang, "/contact/")}">Contact</a>
    <a href="${altPath(lang, path)}" hreflang="${o}" lang="${o}">${copy[o].langName}</a>
  </div>
</dialog>`;
}

function footer(lang, path) {
  const o = other(lang);
  const edition = (l) =>
    l === lang
      ? `<span aria-current="true">${copy[l].langName}</span>`
      : `<a href="${altPath(lang, path)}" hreflang="${l}" lang="${l}">${copy[l].langName}</a>`;
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__grid">
      <a class="site-footer__brand" href="${href(lang, "/")}" aria-label="SECOND TAKE"><img src="/assets/second-take-logo-header-white.png" width="700" height="243" alt="SECOND TAKE"></a>
      <nav class="site-footer__col" aria-label="Sections">
        <p class="site-footer__label">Sections</p>
        ${nav.map(([, label, target]) => `<a href="${href(lang, target)}">${label}</a>`).join("\n        ")}
      </nav>
      <div class="site-footer__col">
        <p class="site-footer__label">Company</p>
        ${external(lang === "en" ? links.companyEn : links.company, "Music Japan LLC")}
        ${external(links.linkedin, "LinkedIn")}
        <a href="${href(lang, "/contact/")}">Contact</a>
      </div>
      <div class="site-footer__col">
        <p class="site-footer__label">Edition</p>
        ${edition("ja")}
        ${edition("en")}
      </div>
    </div>
    <div class="site-footer__bottom">
      <p>© 2026 Music Japan LLC</p>
      <p>${copy[lang].sample}</p>
    </div>
  </div>
</footer>`;
}

function page({ lang, path, current, bodyClass, main, ...meta }) {
  const isHome = bodyClass === "page-home";
  return `${head({ lang, path, ...meta })}
<body class="${bodyClass}" data-lang="${lang}">
${bar(lang, path, current, isHome)}
${isHome ? masthead(lang, path) : ""}
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
function rubric(label, sub, link) {
  return `<div class="rubric">
  <h2 class="rubric__title">${label}${sub ? `<small>${esc(sub)}</small>` : ""}</h2>
  ${link ? `<a class="rubric__link" href="${link.href}">${esc(link.label)}<span aria-hidden="true">→</span></a>` : ""}
</div>`;
}

function card(lang, a) {
  const e = a[lang];
  return `<article class="card reveal">
  <a class="card__link" href="${href(lang, `/articles/${a.slug}/`)}">
    <figure class="card__media">
      ${img(a, { cls: "card__img", sizes: "(min-width: 1080px) 30vw, 80vw", text: e.subtitle })}
      <span class="card__no">${stNo(a)}</span>
    </figure>
    <p class="kicker">${e.tags.map(esc).join("<i>/</i>")}</p>
    <h3 class="card__title">${phrase(lang, e.title)}</h3>
    <p class="card__dek">${esc(e.dek)}</p>
    <p class="card__by"><span>${esc(e.name)}　${esc(e.company)}</span><span>${copy[lang].minRead(a.minutes)}</span></p>
  </a>
</article>`;
}

function record(label = "", cls = "") {
  return `<div class="record ${cls}" aria-hidden="true">
  <div class="record__disc"><div class="record__label">${label ? `<span>${label}</span>` : ""}</div></div>
  <span class="record__slash"></span>
</div>`;
}

function pageHead(lang, label, title, lead, extra = "") {
  return `<section class="page-head" data-ghost="${esc(label.split(" / ")[0])}">
  <div class="wrap">
    <p class="page-head__label">${esc(label)}</p>
    <h1 class="page-head__title">${phrase(lang, title)}</h1>
    ${lead ? `<p class="page-head__lead">${lines(lang, lead)}</p>` : ""}
    ${extra}
  </div>
</section>`;
}

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const themeDesc = {
  exit: ["事業や会社をたたむ、あるいは止めると決めた経営者たち。", "Leaders who decided to close a business or stop a line."],
  comeback: ["一度つまずいたあと、かたちを変えて立て直した話。", "Rebuilding in a different shape after the first attempt failed."],
  team: ["社員、共同創業者、マネージャー。人をめぐる決断。", "Decisions about people: staff, co-founders, managers."],
  "new-ventures": ["新しい事業を始め、続けるか止めるかを迫られた話。", "Starting something new — and deciding whether to keep going."],
  decisions: ["決めるまでの迷いと、決めた瞬間の記録。", "The doubt before a decision, and the moment it was made."],
  succession: ["会社を継ぐ、あるいは誰かに渡すという決断。", "Taking over a company, or handing one on."],
  "co-founders": ["一緒に始めた相手との関係を、どう決着させたか。", "How founders settled things with the person they started with."],
  pivot: ["事業の軸を、別の場所へ移した経営者たち。", "Leaders who moved the core of their business somewhere new."]
};
function themes() {
  const map = new Map();
  for (const a of sorted) {
    a.en.tags.forEach((enTag, i) => {
      const slug = slugify(enTag);
      if (!map.has(slug)) map.set(slug, { slug, ja: a.ja.tags[i], en: enTag, items: [] });
      map.get(slug).items.push(a);
    });
  }
  return [...map.values()].sort((x, y) => y.items.length - x.items.length);
}
const themeHref = (lang, tag) => {
  const t = themes().find((x) => x[lang] === tag);
  return href(lang, `/themes/${t.slug}/`);
};
function breadcrumbs(lang, trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${ORIGIN}${href(lang, path)}` }))
  };
}

function themeCounts(lang) {
  const counts = new Map();
  for (const a of sorted) for (const tag of a[lang].tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts.entries()];
}

// ---------- pages ----------
function homePage(lang) {
  const t = copy[lang];
  const h = t.home;
  const lead = sorted.find((a) => a.image);
  const e = lead[lang];
  const rest = sorted.filter((a) => a !== lead).slice(0, 2);
  const older = sorted.filter((a) => a !== lead && !rest.includes(a));
  const main = `
<section class="cover" aria-labelledby="cover-title">
  ${img(lead, { cls: "cover__img", eager: true, alt: lang === "ja" ? `${e.name}（サンプル写真）` : `${e.name} (sample photo)` })}
  <div class="cover__shade" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>
  <svg class="cover__slash" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line class="slash-wide" x1="64" y1="104" x2="104" y2="4" /><line class="slash-narrow" x1="44" y1="48" x2="104" y2="2" /></svg>
  <p class="cover__no" aria-hidden="true"><span>ST.</span> ${lead.no.padStart(3, "0")}</p>
  <div class="wrap cover__content">
    <p class="kicker kicker--light"><span class="kicker__lead">${h.cover}</span>${e.tags.map(esc).join("<i>/</i>")}</p>
    <h1 class="cover__title" id="cover-title"><a href="${href(lang, `/articles/${lead.slug}/`)}">${phrase(lang, e.title)}</a></h1>
    <p class="cover__dek">${esc(e.dek)}</p>
    <p class="cover__by">${esc(e.name)}<span>${esc(e.company)}　${esc(e.role)}</span><span>${t.minRead(lead.minutes)}</span></p>
    <div class="cover__actions">
      <a class="cine-link" href="${href(lang, `/articles/${lead.slug}/`)}">${t.readStory}<span class="cine-link__line" aria-hidden="true"></span></a>
      <a class="quiet-link" href="${href(lang, `/articles/${lead.slug}/#brief`)}">${t.brief}</a>
    </div>
  </div>
</section>

<section class="section front" id="latest">
  <div class="wrap">
    ${rubric(h.latest, h.latestSub, { href: href(lang, "/articles/"), label: h.allStories })}
    <div class="front__grid">
      <div class="front__cards">
        ${rest.map((a) => card(lang, a)).join("\n")}
      </div>
      <aside class="front__side">
        <section class="side-block reveal">
          <p class="side-label">${h.editorLabel}</p>
          <h3 class="side-block__title">${phrase(lang, h.editorHeading)}</h3>
          <p class="side-block__body">${esc(h.editorBody)}</p>
          <a class="rubric__link" href="${href(lang, "/about/")}">${h.editorLink}<span aria-hidden="true">→</span></a>
        </section>
        <section class="side-block reveal" id="themes">
          <p class="side-label">${h.themes}<small>${esc(h.themesSub)}</small></p>
          <ul class="theme-index">
            ${themeCounts(lang)
              .map(([tag, n]) => `<li><a href="${themeHref(lang, tag)}"><span>${esc(tag)}</span><span class="theme-index__n">${String(n).padStart(2, "0")}</span></a></li>`)
              .join("\n            ")}
          </ul>
        </section>
      </aside>
    </div>
  </div>
</section>

${older.length ? `<section class="section previously">
  <div class="wrap">
    ${rubric(t.pages.moreTitle, t.pages.moreSub, { href: href(lang, "/articles/"), label: h.allStories })}
    <ol class="mini-list">
      ${older
        .map(
          (a) => `<li class="reveal"><a href="${href(lang, `/articles/${a.slug}/`)}"><span class="mini-list__img">${img(a, { sizes: "120px" })}</span><span class="mini-list__body"><span class="kicker">${stNo(a)}<i>/</i>${esc(a[lang].tags[0])}</span><span class="mini-list__title">${phrase(lang, a[lang].title)}</span><span class="mini-list__by">${esc(a[lang].name)}　${esc(a[lang].company)}</span></span></a></li>`
        )
        .join("\n      ")}
    </ol>
  </div>
</section>` : ""}

<section class="section briefs" id="briefs">
  <div class="wrap">
    ${rubric(h.briefs, h.briefsSub, { href: href(lang, "/briefs/"), label: t.pages.briefsTitle })}
    <div class="brief-cols">
      ${sorted
        .slice(0, 3)
        .map(
          (a) => `<article class="brief-col reveal">
        <p class="brief-col__no">${stNo(a)}<span>${esc(a[lang].name)}</span></p>
        <h3 class="brief-col__title"><a href="${href(lang, `/articles/${a.slug}/`)}">${phrase(lang, a[lang].title)}</a></h3>
        <ol>${a[lang].brief.map((b) => `<li>${esc(b)}</li>`).join("")}</ol>
        <a class="rubric__link" href="${href(lang, `/articles/${a.slug}/#brief`)}">${h.briefsLink}<span aria-hidden="true">→</span></a>
      </article>`
        )
        .join("\n")}
    </div>
  </div>
</section>

<section class="podcast" id="podcast" aria-labelledby="podcast-title">
  <div class="grain" aria-hidden="true"></div>
  <div class="wrap podcast__grid">
    ${record("", "record--band")}
    <div class="podcast__text">
      <p class="side-label">${h.podcast}</p>
      <h2 class="podcast__title" id="podcast-title">${phrase(lang, h.podcastHeading)}</h2>
      <p class="podcast__body">${esc(h.podcastBody)}</p>
    </div>
    <ol class="episodes">
      ${sorted
        .map((a) => `<li><span class="episodes__no">EP.${a.no}</span><span class="episodes__name">${esc(a[lang].name)}<small>${esc(a[lang].company)}</small></span><span class="episodes__status">${h.podcastStatus}</span></li>`)
        .join("\n      ")}
    </ol>
  </div>
</section>`;

  return page({
    lang,
    path: "/",
    current: "",
    bodyClass: "page-home",
    title: t.siteTitle,
    description: t.siteDescription,
    main,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": "https://music-japan.com/#organization", name: "合同会社Music Japan", alternateName: "Music Japan LLC", url: "https://music-japan.com/" },
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
        ${a.image ? `<img class="frame__still" src="/assets/${a.image}.webp" alt="" loading="lazy" decoding="async" style="object-position:${frameCount++ % 2 ? "70% 62%" : "40% 18%"}">` : ""}
        <div class="grain" aria-hidden="true"></div>
        <span class="frame__tc" aria-hidden="true">${stNo(a)} — ${esc(e.speaker)}</span>
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
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${href(lang, "/")}">SECOND TAKE</a><i>/</i><a href="${href(lang, "/articles/")}">Interviews</a><i>/</i><span>${stNo(a)}</span></nav>
        <p class="kicker kicker--light"><span class="kicker__lead">${stNo(a)}</span>${e.tags.map(esc).join("<i>/</i>")}</p>
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
        ${img(a, { cls: "story-open__img", eager: true, sizes: "(min-width: 960px) 40vw, 100vw", text: e.subtitle, alt: lang === "ja" ? `${e.name}（サンプル写真）` : `${e.name} (sample photo)` })}
        <figcaption>${ta.photo}</figcaption>
      </figure>
    </div>
  </header>

  <div class="story-body">
    <aside class="story-rail">
      <div class="story-rail__sticky">
        <p class="label">${ta.toc}</p>
        <ol class="toc" data-toc>
          ${e.scenes.map((s, n) => `<li><a href="#scene-${n + 1}"><span>0${n + 1}</span>${esc(s.short)}</a></li>`).join("\n          ")}
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
        ${e.intro.map((p, n) => (n === 0 ? `<p class="intro__first">${phrase(lang, p)}</p>` : `<p>${esc(p)}</p>`)).join("\n        ")}
      </div>
      ${e.scenes
        .map(
          (s, n) => `<section class="scene" id="scene-${n + 1}" data-scene>
        <h2 class="scene__head"><span class="scene__no">${ta.scene} 0${n + 1}</span><span class="scene__title">${phrase(lang, s.heading)}</span></h2>
        ${s.blocks.map(block).join("\n        ")}
      </section>`
        )
        .join("\n      ")}

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
          ${record(`EP.${a.no}`, "record--mini")}
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
    ${next.image ? img(next, { cls: "next-take__img", sizes: "100vw" }) : ""}
    <div class="next-take__shade" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <div class="wrap next-take__inner">
      <p class="kicker kicker--light"><span class="kicker__lead">${ta.next}</span>${stNo(next)}</p>
      <p class="next-take__title">${phrase(lang, next[lang].title)}</p>
      <p class="next-take__who">${esc(next[lang].name)}　${esc(next[lang].company)}<span class="next-take__arrow" aria-hidden="true">→</span></p>
    </div>
  </a>

  <section class="section more">
    <div class="wrap">
      ${rubric(ta.more, "", { href: href(lang, "/articles/"), label: t.home.allStories })}
      <div class="front__cards front__cards--wide">${others.map((x) => card(lang, x)).join("\n")}</div>
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
    current: "interviews",
    bodyClass: "page-article",
    title: `${e.title}｜SECOND TAKE`,
    description: e.dek,
    image: a.image ? `/assets/${a.image}.jpg` : undefined,
    type: "article",
    article: a,
    main,
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["Interviews", "/articles/"], [e.title, path]])],
      "@type": "Article",
      articleSection: e.tags,
      keywords: e.tags.join(", "),
      isAccessibleForFree: true,
      headline: e.title,
      description: e.dek,
      datePublished: `${a.date}T09:00:00+09:00`,
      inLanguage: lang === "ja" ? "ja-JP" : "en",
      image: `${ORIGIN}/assets/${a.image ? `${a.image}.jpg` : "second-take-cover.png"}`,
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
  const main = `
${pageHead(lang, ta.label, ta.title, ta.lead)}
<section class="section archive">
  <div class="wrap">
    <div class="filters" role="group" aria-label="${ta.filterLabel}" data-filters>
      <button type="button" aria-pressed="true" data-filter="">${ta.all}</button>
      ${themeCounts(lang).map(([tag]) => `<button type="button" aria-pressed="false" data-filter="${esc(tag)}">${esc(tag)}</button>`).join("\n      ")}
    </div>
    <ol class="archive-list">
      ${sorted
        .map((a) => {
          const e = a[lang];
          return `<li data-tags="${esc(e.tags.join("|"))}" class="reveal">
        <a class="row" href="${href(lang, `/articles/${a.slug}/`)}">
          <span class="row__no">${stNo(a)}</span>
          <span class="row__img">${img(a, { sizes: "160px" })}</span>
          <span class="row__main">
            <span class="kicker">${e.tags.map(esc).join("<i>/</i>")}</span>
            <span class="row__title">${phrase(lang, e.title)}</span>
            <span class="row__who">${esc(e.name)}　${esc(e.company)}</span>
          </span>
          <span class="row__meta"><time datetime="${a.date}">${formatDate(lang, a.date)}</time><span>${t.minRead(a.minutes)}</span></span>
        </a>
      </li>`;
        })
        .join("\n      ")}
    </ol>
  </div>
</section>`;
  return page({ lang, path: "/articles/", current: "interviews", bodyClass: "page-archive", title: `${ta.title}｜SECOND TAKE`, description: ta.lead.replace("\n", ""), main,
    jsonld: { "@context": "https://schema.org", "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["Interviews", "/articles/"]])] } });
}

function aboutPage(lang) {
  const ab = copy[lang].about;
  const main = `
${pageHead(lang, ab.label, ab.heading, ab.lead)}
<section class="section">
  <div class="wrap">
    ${rubric(ab.principlesTitle, ab.principlesSub)}
    <ol class="principle-list">
      ${ab.principles.map(([title, body], n) => `<li class="reveal"><span class="principle__no">0${n + 1}</span><h3>${phrase(lang, title)}</h3><p>${esc(body)}</p></li>`).join("\n      ")}
    </ol>
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${rubric(ab.formatTitle, ab.formatSub)}
    <dl class="format-list">
      ${ab.formats.map(([en, name, body]) => `<div class="reveal"><dt><span class="format-list__en">${esc(en)}</span><span class="format-list__name">${esc(name)}</span></dt><dd>${esc(body)}</dd></div>`).join("\n      ")}
    </dl>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <dl class="stats reveal">
      <div><dt>${copy[lang].pages.statsInterviews}</dt><dd>${String(sorted.length).padStart(2, "0")}</dd></div>
      <div><dt>${copy[lang].pages.statsThemes}</dt><dd>${String(themes().length).padStart(2, "0")}</dd></div>
      <div><dt>${copy[lang].pages.statsLanguages}</dt><dd>02</dd></div>
    </dl>
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${rubric(copy[lang].pages.facesTitle, copy[lang].pages.facesSub, { href: href(lang, "/articles/"), label: copy[lang].home.allStories })}
    <ol class="faces">
      ${sorted.map((a) => `<li class="reveal"><a href="${href(lang, `/articles/${a.slug}/`)}"><span class="faces__img">${img(a, { sizes: "220px", text: "" })}</span><span class="faces__name">${esc(a[lang].name)}</span><span class="faces__co">${esc(a[lang].company)}</span></a></li>`).join("\n      ")}
    </ol>
  </div>
</section>
<section class="section publisher">
  <div class="wrap">
    ${rubric(ab.publisherTitle, ab.publisherSub)}
    <div class="publisher__grid reveal">
      <p class="publisher__text">${esc(ab.publisher)}</p>
      <div class="publisher__links">
        ${external(lang === "en" ? links.companyEn : links.company, lang === "ja" ? "合同会社Music Japan" : "Music Japan LLC", "publisher__link")}
        ${external(links.linkedin, `${esc(ab.person)}<small>LinkedIn</small>`, "publisher__link")}
      </div>
    </div>
  </div>
</section>`;
  return page({ lang, path: "/about/", current: "about", bodyClass: "page-about", title: `${ab.title}｜SECOND TAKE`, description: ab.lead.replace(/\n/g, ""), main,
    jsonld: { "@context": "https://schema.org", "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["About", "/about/"]]), { "@type": "AboutPage", name: ab.title, publisher: { "@id": "https://music-japan.com/#organization" } }] } });
}

function contactPage(lang) {
  const c = copy[lang].contact;
  const ctas = `<div class="cta-row">
      ${external(links.booking, c.book, "btn btn--solid")}
      ${external(links.linkedin, "LinkedIn", "btn btn--line")}
    </div>
    <p class="page-head__note">${esc(c.bookNote)}</p>`;
  const main = `
${pageHead(lang, c.label, c.heading, c.lead, ctas)}
<section class="section">
  <div class="wrap">
    ${rubric("Enquiries", lang === "ja" ? "お問い合わせの種類" : "What to contact us about")}
    <ol class="principle-list">
      ${c.cases.map(([title, body], n) => `<li class="reveal"><span class="principle__no">0${n + 1}</span><h3>${phrase(lang, title)}</h3><p>${esc(body)}</p></li>`).join("\n      ")}
    </ol>
  </div>
</section>`;
  const faq = copy[lang].pages.faq;
  const main2 = main + `
<section class="section">
  <div class="wrap">
    ${rubric(copy[lang].pages.faqTitle, copy[lang].pages.faqSub)}
    <div class="faq">
      ${faq.map(([q, a]) => `<details class="faq__item reveal"><summary>${phrase(lang, q)}</summary><p>${esc(a)}</p></details>`).join("\n      ")}
    </div>
  </div>
</section>`;
  return page({ lang, path: "/contact/", current: "", bodyClass: "page-contact", title: `${c.title}｜SECOND TAKE`, description: c.lead.replace("\n", ""), main: main2,
    jsonld: { "@context": "https://schema.org", "@graph": [
      breadcrumbs(lang, [["SECOND TAKE", "/"], ["Contact", "/contact/"]]),
      { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
    ] } });
}

function notFoundPage() {
  const ja = copy.ja.notFound;
  const en = copy.en.notFound;
  const extra = `<p class="page-head__lead" lang="en">${esc(en.heading)} ${esc(en.body)}</p>
    <div class="cta-row">
      <a class="btn btn--solid" href="/">${ja.back}</a>
      <a class="btn btn--line" href="/en/" lang="en">${en.back}</a>
    </div>`;
  const main = pageHead("ja", "404 — NG Take", ja.heading, ja.body, extra);
  return page({ lang: "ja", path: null, current: "", bodyClass: "page-404", title: `${ja.title}｜SECOND TAKE`, description: ja.body, main });
}


function briefsPage(lang) {
  const t = copy[lang];
  const pg = t.pages;
  const main = `
${pageHead(lang, "Short Reads", pg.briefsTitle, pg.briefsLead)}
<section class="section">
  <div class="wrap">
    <ol class="digest">
      ${sorted
        .map(
          (a) => `<li class="digest__item reveal">
        <div class="digest__meta"><span class="digest__no">${stNo(a)}</span><time datetime="${a.date}">${formatDate(lang, a.date)}</time><span>${esc(a[lang].name)}</span></div>
        <div class="digest__body">
          <h2 class="digest__title"><a href="${href(lang, `/articles/${a.slug}/`)}">${phrase(lang, a[lang].title)}</a></h2>
          <ol class="digest__points">${a[lang].brief.map((b) => `<li>${phrase(lang, b)}</li>`).join("")}</ol>
          <p class="digest__links"><a class="rubric__link" href="${href(lang, `/articles/${a.slug}/`)}">${t.readStory}<span aria-hidden="true">→</span></a><span>${t.minRead(a.minutes)}</span></p>
        </div>
      </li>`
        )
        .join("\n      ")}
    </ol>
  </div>
</section>`;
  return page({ lang, path: "/briefs/", current: "briefs", bodyClass: "page-briefs", title: `${pg.briefsTitle}｜SECOND TAKE`, description: pg.briefsLead.replace("\n", ""), main,
    jsonld: { "@context": "https://schema.org", "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["Short Reads", "/briefs/"]])] } });
}

function themesPage(lang) {
  const pg = copy[lang].pages;
  const list = themes();
  const main = `
${pageHead(lang, "Themes", pg.themesTitle, pg.themesLead)}
<section class="section">
  <div class="wrap">
    <ol class="theme-rows">
      ${list
        .map(
          (th, i) => `<li class="reveal"><a class="theme-row" href="${href(lang, `/themes/${th.slug}/`)}">
        <span class="theme-row__no">${String(i + 1).padStart(2, "0")}</span>
        <span class="theme-row__name">${esc(th[lang])}<small>${esc(lang === "ja" ? th.en : th.ja)}</small></span>
        <span class="theme-row__desc">${phrase(lang, themeDesc[th.slug]?.[lang === "ja" ? 0 : 1] || "")}</span>
        <span class="theme-row__faces">${th.items.slice(0, 3).map((a) => `<span class="theme-row__face">${img(a, { sizes: "64px" })}</span>`).join("")}</span>
        <span class="theme-row__count">${pg.themeCount(th.items.length)}</span>
      </a></li>`
        )
        .join("\n      ")}
    </ol>
  </div>
</section>`;
  return page({ lang, path: "/themes/", current: "themes", bodyClass: "page-themes", title: `${pg.themesTitle}｜SECOND TAKE`, description: pg.themesLead.replace("\n", ""), main,
    jsonld: { "@context": "https://schema.org", "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["Themes", "/themes/"]])] } });
}

function themePage(lang, th) {
  const t = copy[lang];
  const desc = themeDesc[th.slug]?.[lang === "ja" ? 0 : 1] || "";
  const main = `
${pageHead(lang, `Themes / ${th.en}`, th[lang], desc, `<p class="page-head__note">${t.pages.themeCount(th.items.length)}　<a class="quiet-link" href="${href(lang, "/themes/")}">${t.pages.themesTitle}</a></p>`)}
<section class="section">
  <div class="wrap">
    <div class="front__cards front__cards--three">${th.items.map((a) => card(lang, a)).join("\n")}</div>
  </div>
</section>`;
  return page({ lang, path: `/themes/${th.slug}/`, current: "themes", bodyClass: "page-theme", title: `${th[lang]}｜SECOND TAKE`, description: desc, main,
    jsonld: { "@context": "https://schema.org", "@graph": [
      breadcrumbs(lang, [["SECOND TAKE", "/"], ["Themes", "/themes/"], [th[lang], `/themes/${th.slug}/`]]),
      { "@type": "CollectionPage", name: th[lang], description: desc, inLanguage: lang === "ja" ? "ja-JP" : "en",
        mainEntity: { "@type": "ItemList", itemListElement: th.items.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}${href(lang, `/articles/${a.slug}/`)}` })) } }
    ] } });
}

function podcastPage(lang) {
  const t = copy[lang];
  const pg = t.pages;
  const main = `
<section class="podcast-hero">
  <div class="grain" aria-hidden="true"></div>
  <div class="wrap podcast-hero__grid">
    <div>
      <p class="page-head__label">SECOND TAKE Podcast</p>
      <h1 class="podcast-hero__title">${lines(lang, pg.podcastTitle)}</h1>
      <p class="podcast-hero__lead">${lines(lang, pg.podcastLead)}</p>
      <span class="status-pill status-pill--light">${pg.podcastStatus}</span>
    </div>
    ${record("SIDE B", "record--hero")}
  </div>
</section>
<section class="section">
  <div class="wrap">
    ${rubric("Episodes", lang === "ja" ? "配信予定のエピソード" : "Upcoming episodes")}
    <ol class="episode-list">
      ${sorted
        .map(
          (a) => `<li class="reveal"><a href="${href(lang, `/articles/${a.slug}/`)}">
        <span class="episode-list__no">EP.${a.no}</span>
        <span class="episode-list__img">${img(a, { sizes: "96px" })}</span>
        <span class="episode-list__body"><span class="episode-list__name">${esc(a[lang].name)}<small>${esc(a[lang].company)}</small></span><span class="episode-list__title">${phrase(lang, a[lang].title)}</span></span>
        <span class="episode-list__status">${pg.podcastStatus}</span>
      </a></li>`
        )
        .join("\n      ")}
    </ol>
    <p class="page-head__note">${esc(pg.podcastNote)}</p>
  </div>
</section>`;
  return page({ lang, path: "/podcast/", current: "podcast", bodyClass: "page-podcast", title: `Podcast｜SECOND TAKE`, description: pg.podcastLead.replace("\n", ""), main,
    jsonld: { "@context": "https://schema.org", "@graph": [breadcrumbs(lang, [["SECOND TAKE", "/"], ["Podcast", "/podcast/"]])] } });
}

function llmsFull() {
  const out = ["# SECOND TAKE — full text", "", "Interview publication by Music Japan LLC. Japanese edition at /, English edition at /en/. All people and companies currently published are fictional samples.", ""];
  for (const a of sorted) {
    for (const lang of LANGS) {
      const e = a[lang];
      out.push(`## ${e.title}`, "", `- URL: ${ORIGIN}${href(lang, `/articles/${a.slug}/`)}`, `- Interviewee: ${e.name}, ${e.company} (${e.role})`, `- Published: ${a.date}`, `- Themes: ${e.tags.join(", ")}`, "", `> ${e.dek}`, "", ...e.brief.map((b) => `- ${b}`), "", ...e.intro, "");
      for (const sc of e.scenes) {
        out.push(`### ${sc.heading}`, "");
        for (const [type, text] of sc.blocks) out.push(type === "q" ? `**Q:** ${text}` : type === "a" ? `**${e.speaker}:** ${text}` : type === "quote" ? `> ${text}` : text, "");
      }
    }
  }
  return out.join("\n");
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
        no: stNo(a),
        title: e.title,
        name: e.name,
        company: e.company,
        tags: e.tags,
        image: a.image ? `/assets/${a.image}.webp` : "/assets/second-take-cover.webp",
        text: [e.dek, e.decision, ...e.brief].join(" ")
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

for (const generated of ["index.html", "404.html", "articles", "about", "contact", "briefs", "themes", "podcast", "en"]) {
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
  write(`${base}briefs/index.html`, briefsPage(lang));
  write(`${base}themes/index.html`, themesPage(lang));
  for (const th of themes()) write(`${base}themes/${th.slug}/index.html`, themePage(lang, th));
  write(`${base}podcast/index.html`, podcastPage(lang));
  write(`${base}feed.xml`, feed(lang));
  write(`assets/search-${lang}.json`, searchIndex(lang));
  for (const p of ["/", "/articles/", "/briefs/", "/themes/", "/podcast/", "/about/", "/contact/", ...themes().map((th) => `/themes/${th.slug}/`), ...sorted.map((a) => `/articles/${a.slug}/`)]) {
    sitemapPaths.push(href(lang, p));
  }
}
write("404.html", notFoundPage());
write("sitemap.xml", sitemap(sitemapPaths));
write("llms-full.txt", llmsFull());
process.stdout.write(`build: ${sitemapPaths.length} pages + 404\n`);
