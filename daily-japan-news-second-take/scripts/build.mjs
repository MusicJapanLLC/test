import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const assetsDir = path.join(root, 'assets');
const articles = JSON.parse(fs.readFileSync(path.join(root, 'content', 'articles.json'), 'utf8'));
const productionUrl = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4173');
const siteUrl = productionUrl.replace(/\/$/, '');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

const assetFiles = [
  'styles.css','daily-news.css','site.js',
  'ai-grid.svg','yen-wave.svg','chip-lines.svg','science-orbit.svg','diplomacy-map.svg','startup-bars.svg'
];
for (const file of assetFiles) fs.copyFileSync(path.join(assetsDir, file), path.join(dist, 'assets', file));

function esc(value='') {
  return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function dateShort(value, lang) {
  return new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year:'numeric', month: lang === 'ja' ? 'numeric' : 'short', day:'numeric', timeZone:'Asia/Tokyo'
  }).format(new Date(value));
}
function articlePath(lang, article) { return `/${lang}/articles/${article.slug}/`; }
function category(article, lang) { return lang === 'ja' ? article.categoryJa : article.categoryEn; }

const searchData = articles.map(a => ({
  slug:a.slug,
  image:a.image,
  categoryJa:a.categoryJa,
  categoryEn:a.categoryEn,
  ja:{title:a.ja.title, dek:a.ja.dek},
  en:{title:a.en.title, dek:a.en.dek},
  readMinutes:a.readMinutes
}));

function header(lang, article=null) {
  const ja = lang === 'ja';
  const counterpart = article ? articlePath(ja ? 'en':'ja', article) : `/${ja ? 'en':'ja'}/`;
  return `
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-logo daily-wordmark" href="/${lang}/" aria-label="Daily Japan News">
        <span class="daily-wordmark__top">DAILY</span>
        <span class="daily-wordmark__main">JAPAN <em>NEWS</em></span>
      </a>
      <nav class="desktop-nav" aria-label="${ja?'メインナビゲーション':'Primary navigation'}">
        <a href="/${lang}/#articles">${ja?'最新':'LATEST'}</a>
        <a href="/${lang}/#briefs">${ja?'要点':'QUICK BRIEF'}</a>
        <a href="/${lang}/#popular">POPULAR</a>
        <a href="/${lang}/#themes">${ja?'テーマ':'TOPICS'}</a>
      </nav>
      <div class="header-actions">
        <a class="edition-switch" href="${counterpart}" aria-label="${ja?'English edition':'日本語版'}">${ja?'EN':'JP'}</a>
        <button class="icon-button" type="button" data-open="search" aria-label="${ja?'記事を検索':'Search articles'}"><span class="search-icon" aria-hidden="true"></span></button>
        <button class="icon-button" type="button" data-open="menu" aria-label="${ja?'メニューを開く':'Open menu'}"><span class="menu-icon" aria-hidden="true"></span></button>
      </div>
    </div>
  </header>`;
}

function dialogs(lang) {
  const ja = lang === 'ja';
  return `
  <dialog class="menu-dialog" id="site-menu" aria-label="${ja?'サイトメニュー':'Site menu'}">
    <div class="dialog-head"><span class="dialog-title">DAILY JAPAN NEWS</span><button class="dialog-close" type="button" data-close aria-label="${ja?'閉じる':'Close'}">×</button></div>
    <div class="menu-body">
      <div class="menu-search"><label class="visually-hidden" for="menu-search-input">${ja?'記事を検索':'Search articles'}</label><input id="menu-search-input" type="search" placeholder="${ja?'テーマ、企業、キーワードから探す':'Search topics, companies or keywords'}" autocomplete="off"></div>
      <nav class="menu-primary">
        <a href="/${lang}/#articles" data-close-menu-link>${ja?'最新ニュース':'Latest News'}</a>
        <a href="/${lang}/#briefs" data-close-menu-link>${ja?'3分で要点':'Quick Brief'}</a>
        <a href="/${lang}/#popular" data-close-menu-link>${ja?'よく読まれている記事':'Popular'}</a>
        <a href="/${lang}/#themes" data-close-menu-link>${ja?'テーマから読む':'Topics'}</a>
        <a href="/${lang}/#about" data-close-menu-link>${ja?'Daily Japan Newsについて':'About'}</a>
      </nav>
      <div class="menu-utility"><button type="button" data-reader-size>Aa　${ja?'文字サイズ':'Text size'}</button><button type="button" data-open="cookies">Cookie</button><a href="https://music-japan.pages.dev/">${ja?'運営会社':'Company'}</a></div>
    </div>
  </dialog>
  <dialog class="search-dialog" id="search-dialog" aria-label="${ja?'記事検索':'Article search'}">
    <div class="dialog-head"><span class="dialog-title">SEARCH</span><button class="dialog-close" type="button" data-close>×</button></div>
    <div class="search-body"><label class="visually-hidden" for="page-search-input">${ja?'記事を検索':'Search articles'}</label><input class="page-search-input" id="page-search-input" type="search" placeholder="${ja?'AI、経済、半導体、外交…':'AI, economy, semiconductors, diplomacy…'}" autocomplete="off"><p class="search-count" id="search-count">${articles.length} ARTICLES</p><div class="search-results" id="search-results"></div></div>
  </dialog>
  <dialog class="cookie-dialog" id="cookie-dialog" aria-label="Cookie">
    <div class="dialog-head"><span class="dialog-title">PRIVACY</span><button class="dialog-close" type="button" data-close>×</button></div>
    <div class="cookie-body"><p class="eyebrow">Cookie settings</p><h2 class="section-title">${ja?'読む体験を<br>自分のものに':'Make reading<br>your own'}</h2><div class="cookie-choice"><span><strong>${ja?'必要なCookie':'Essential cookies'}</strong><small>${ja?'検索設定や文字サイズの保存に使用':'Used for search and reader settings'}</small></span><span>ON</span></div><button class="button button--red" id="cookie-save" type="button">${ja?'設定を保存':'Save'}</button></div>
  </dialog>`;
}

function footer(lang) {
  const ja = lang === 'ja';
  return `
  <footer class="site-footer"><div class="site-footer__inner">
    <div class="footer-news-brand"><strong>DAILY JAPAN NEWS</strong><span>Japan, made clear.</span></div>
    <div class="footer-grid"><nav class="footer-nav"><a href="/${lang}/#articles">${ja?'最新ニュース':'Latest'}</a><a href="/${lang}/#popular">Popular</a><a href="/${lang}/#themes">${ja?'テーマ':'Topics'}</a><a href="/${lang}/#about">${ja?'私たちについて':'About'}</a><a href="/${ja?'en':'ja'}/">${ja?'English':'日本語'}</a><button class="footer-button" type="button" data-open="cookies">Cookie</button></nav></div>
    <p class="copyright">© 2026 MUSIC JAPAN LLC</p>
  </div></footer>
  <section class="cookie-banner" id="cookie-banner" aria-label="Cookie" hidden><h2>Cookie</h2><p>${ja?'文字サイズなどの設定保存にCookieを使用します':'Cookies save reader preferences'}</p><div class="cookie-actions"><button class="accept-all" type="button" data-cookie-accept>OK</button></div></section>
  <button class="scroll-top" id="scroll-top" type="button" aria-label="${ja?'ページ上部へ戻る':'Back to top'}">↑</button>`;
}

function documentShell({lang,title,description,canonical,alternateJa,alternateEn,body,schema='',article=null}) {
  return `<!doctype html><html lang="${lang}"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${esc(title)}</title><meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#fbfaf7">
  <link rel="canonical" href="${siteUrl}${canonical}">
  <link rel="alternate" hreflang="ja" href="${siteUrl}${alternateJa}">
  <link rel="alternate" hreflang="en" href="${siteUrl}${alternateEn}">
  <link rel="alternate" hreflang="x-default" href="${siteUrl}${alternateJa}">
  <meta property="og:site_name" content="Daily Japan News"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${siteUrl}${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/daily-news.css">
  ${schema}</head><body data-lang="${lang}" class="${article?'article-page':''}">
  <a class="skip-link" href="#main">${lang==='ja'?'本文へ移動':'Skip to content'}</a>
  ${header(lang,article)}
  ${body}
  ${dialogs(lang)}${footer(lang)}
  <script id="djn-search-data" type="application/json">${JSON.stringify(searchData).replace(/</g,'\\u003c')}</script>
  <script src="/assets/site.js" defer></script>
  </body></html>`;
}

function feedCard(article, lang, number) {
  const t = article[lang];
  return `<article class="feed-card"><div class="feed-card__image"><img src="/assets/${article.image}" alt="" loading="lazy"></div><span class="feed-card__number">${String(number).padStart(2,'0')}</span><div class="feed-card__content"><span class="feed-card__label">${esc(category(article,lang))}</span><h3>${esc(t.title)}</h3><div class="feed-card__meta"><span>${esc(category(article,lang))}</span><span>${article.readMinutes} MIN</span></div></div><a href="${articlePath(lang,article)}" aria-label="${esc(t.title)}"></a></article>`;
}

function homePage(lang) {
  const ja = lang === 'ja';
  const featured = articles.find(a=>a.featured) || articles[0];
  const others = articles.filter(a=>a.slug!==featured.slug);
  const popular = [...articles].sort((a,b)=>b.popularScore-a.popularScore).slice(0,3);
  const body = `<main id="main">
    <div class="news-datebar"><span>SEPTEMBER 13, 2026 · ${ja?'JAPAN EDITION':'GLOBAL EDITION'}</span><span>ECONOMY · BUSINESS · AI · SCIENCE · POLITICS</span></div>
    <section class="home-hero home-hero--news" aria-labelledby="lead-title">
      <div class="home-hero__image"><img src="/assets/${featured.image}" alt="" fetchpriority="high"></div>
      <span class="hero-index"><span>DJN.</span> 0913</span>
      <div class="home-hero__content"><div class="hero-kicker">TODAY'S LEAD　${featured.readMinutes} MIN READ</div><h1 id="lead-title">${esc(featured[lang].title)}</h1><p class="home-hero__meta">${esc(category(featured,lang))}　${esc(featured[lang].dek)}</p><div class="hero-actions"><a class="primary-link" href="${articlePath(lang,featured)}">${ja?'記事を読む':'Read story'}</a><a class="secondary-link" href="#briefs">${ja?'3分で要点':'Quick brief'}</a></div></div>
    </section>
    <section class="feed-section page-shell" id="articles"><div class="section-head"><div><p class="eyebrow">Swipe to discover</p><h2 class="section-title">Latest News<small>${ja?'今日の日本を、重要度から読む':'Understand Japan by importance, not noise'}</small></h2></div><button class="text-link plain-button" type="button" data-open="search">${ja?'すべて探す':'Search all'}</button></div><div class="snap-feed">${others.slice(0,3).map((a,i)=>feedCard(a,lang,i+1)).join('')}</div></section>
    <section class="feed-section page-shell" id="briefs"><div class="section-head"><div><p class="eyebrow">5 things to know</p><h2 class="section-title">Quick Brief<small>${ja?'本文の前に、5つだけ':'Five points before the full story'}</small></h2></div></div><div class="brief-list">${articles.slice(0,3).map((a,i)=>`<a class="brief-card" href="${articlePath(lang,a)}#brief"><span class="brief-card__number">${String(i+1).padStart(2,'0')}</span><span><h3>${esc(a[lang].points[0])}</h3><p>${esc(a[lang].points[1])}</p></span><span class="brief-card__arrow">→</span></a>`).join('')}</div></section>
    <section class="popular-section page-shell" id="popular"><div class="section-head"><div><p class="eyebrow">Most read</p><h2 class="section-title">Popular<small>${ja?'いま押さえておきたい記事':'What readers are opening now'}</small></h2></div></div><div class="popular-list">${popular.map(a=>`<a class="popular-item" href="${articlePath(lang,a)}"><img src="/assets/${a.image}" alt="" loading="lazy"><span><h3>${esc(a[lang].title)}</h3><p>${esc(category(a,lang))} · ${a.readMinutes} MIN</p></span></a>`).join('')}</div></section>
    <section class="theme-section page-shell" id="themes"><div class="section-head"><div><p class="eyebrow">Read by topic</p><h2 class="section-title">Topics<small>${ja?'関心のある分野から読む':'Start with what matters to you'}</small></h2></div></div><div class="theme-grid">${[['Economy',ja?'経済':'Economy'],['Business',ja?'ビジネス':'Business'],['AI','AI'],['Science',ja?'科学':'Science'],['Politics',ja?'政治・外交':'Politics / Diplomacy']].map(([q,l])=>`<button class="theme-link" type="button" data-open="search" data-search-query="${q}"><strong>${l}</strong><span>${q}</span></button>`).join('')}</div></section>
    <section class="page-shell"><div class="notification-panel notification-panel--news"><div class="notification-panel__content"><p class="eyebrow">Daily edition · 14:00 JST</p><h2>${ja?'ニュースを追うより、<br>意味をつかむ':'Less noise.<br>More meaning.'}</h2><p>${ja?'経済・ビジネス・AI・科学・政治外交を横断し、短時間で「なぜ重要か」まで読めるニュース体験へ':'A daily bilingual briefing on Japan, built to explain why each story matters.'}</p></div></div></section>
    <section class="about-teaser about-teaser--news" id="about"><div class="page-shell about-teaser__grid"><div><p class="eyebrow">About Daily Japan News</p><h2>${ja?'速さだけではなく、<br>理解まで':'Fast enough for today.<br>Deep enough to matter.'}</h2></div><p>${ja?'重要ニュースを選び、冒頭の5ポイントで要点を先に提示　その後に背景、数字、影響を必要な深さまで読める形に整理します':'Each story starts with five key points, followed by context, numbers and implications for readers who want to go deeper.'}</p></div></section>
  </main>`;
  const title = ja ? 'Daily Japan News｜日本の重要ニュースを、速く深く' : 'Daily Japan News | Japan, made clear';
  const description = ja ? '日本の経済・ビジネス・AI・科学・政治外交を、5つのポイントと背景まで短時間で理解するニュースメディア' : 'A premium bilingual briefing on Japan’s economy, business, AI, science and politics';
  const schema = `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'Daily Japan News',url:`${siteUrl}/${lang}/`,inLanguage:ja?'ja-JP':'en',publisher:{'@type':'Organization',name:'Music Japan LLC'}}).replace(/</g,'\\u003c')}</script>`;
  return documentShell({lang,title,description,canonical:`/${lang}/`,alternateJa:'/ja/',alternateEn:'/en/',body,schema});
}

function articlePage(article, lang) {
  const ja = lang === 'ja';
  const t = article[lang];
  const related = articles.filter(a=>a.slug!==article.slug).slice(0,2);
  const citationLabel = ja ? '参考' : 'References';
  const body = `<main id="main"><article>
    <header class="article-hero"><div class="article-hero__inner">
      <nav class="breadcrumbs"><a href="/${lang}/">TOP</a><span>›</span><a href="/${lang}/#articles">${ja?'ニュース':'NEWS'}</a><span>›</span><span>${esc(category(article,lang))}</span></nav>
      <p class="eyebrow">${esc(category(article,lang))} / ${article.readMinutes} MIN READ</p>
      <h1>${esc(t.title)}</h1><p class="article-deck">${esc(t.dek)}</p>
      <div class="article-byline"><span>DAILY JAPAN NEWS</span><time datetime="${article.published}">${dateShort(article.published,lang)}</time><span>${article.readMinutes} MIN READ</span></div>
      <div class="article-hero__photo"><img src="/assets/${article.image}" alt="" fetchpriority="high"></div>
    </div></header>
    <div class="article-grid"><div class="article-main">
      <section class="brief-box" id="brief"><div class="brief-box__head"><h2>${ja?'この記事のポイント':'5 THINGS TO KNOW'}</h2><span class="brief-box__time">${ja?'先に要点だけ読む':'Read this first'}</span></div><ol class="points-list points-list--editorial">${t.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ol></section>
      <div class="article-body" id="article-body">${t.sections.map((s,i)=>`<h2 id="chapter-${i+1}"><span class="chapter">CHAPTER ${String(i+1).padStart(2,'0')}</span>${esc(s.heading)}</h2><p>${esc(s.body)}</p>`).join('')}</div>
      <p class="news-citation">${citationLabel}：${t.sources.map(esc).join(' / ')}</p>
    </div>
    <aside class="article-aside"><div class="aside-sticky"><p class="eyebrow">${ja?'この記事':'In this story'}</p><nav class="aside-toc">${t.sections.map((s,i)=>`<a href="#chapter-${i+1}">${esc(s.heading)}</a>`).join('')}</nav><button class="aside-button" type="button" data-reader-size>Aa　${ja?'文字サイズ':'Text size'}</button></div></aside>
    </div></article>
    <section class="related-section"><div class="section-head"><div><p class="eyebrow">Keep reading</p><h2 class="section-title">Related<small>${ja?'次に読む':'Read next'}</small></h2></div></div><div class="snap-feed">${related.map((a,i)=>feedCard(a,lang,i+1)).join('')}</div></section>
  </main>`;
  const schemaObj = {'@context':'https://schema.org','@type':'NewsArticle',headline:t.title,description:t.dek,datePublished:article.published,dateModified:article.updated,inLanguage:ja?'ja-JP':'en',mainEntityOfPage:`${siteUrl}${articlePath(lang,article)}`,image:[`${siteUrl}/assets/${article.image}`],author:{'@type':'Organization',name:'Daily Japan News'},publisher:{'@type':'Organization',name:'Music Japan LLC'},articleSection:category(article,lang)};
  const schema = `<meta property="og:type" content="article"><meta property="og:image" content="${siteUrl}/assets/${article.image}"><script type="application/ld+json">${JSON.stringify(schemaObj).replace(/</g,'\\u003c')}</script>`;
  return documentShell({lang,title:`${t.title} | Daily Japan News`,description:t.dek,canonical:articlePath(lang,article),alternateJa:articlePath('ja',article),alternateEn:articlePath('en',article),body,schema,article});
}

function write(rel, content) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, content);
}

write('index.html', homePage('ja'));
write('ja/index.html', homePage('ja'));
write('en/index.html', homePage('en'));
for (const article of articles) {
  write(`ja/articles/${article.slug}/index.html`, articlePage(article,'ja'));
  write(`en/articles/${article.slug}/index.html`, articlePage(article,'en'));
}

write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#171717"/><path d="M10 13h44v5H10zM10 28h31v5H10zM10 43h44v8H10z" fill="#fbfaf7"/><circle cx="49" cy="30.5" r="6.5" fill="#c8001e"/></svg>`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
const urls = ['/', '/ja/','/en/', ...articles.flatMap(a=>[articlePath('ja',a),articlePath('en',a)])];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${siteUrl}${u}</loc></url>`).join('')}</urlset>`);
write('404.html', `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>404 | Daily Japan News</title><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/daily-news.css"><body><main class="page-shell" style="padding-block:20vh"><p class="eyebrow">404</p><h1 class="section-title">Page not found</h1><p><a href="/ja/">Daily Japan Newsへ戻る</a></p></main></body></html>`);

console.log(`Built ${urls.length} routes to ${dist}`);
