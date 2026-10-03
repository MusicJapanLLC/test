import { sortedActivity, dotDate, type Activity } from '../content/activity';
import * as C from '../content/copy';
import { faqGeneral, faqPartners, type QA } from '../content/faq';
import { page, type PageKey } from '../content/pages';
import { projects, type Project } from '../content/projects';
import { company, EMAIL, OFFICIAL_URL, socials, TIMEREX_URL } from '../content/site';
import { illustAbout, illustBaton, illustNews, illustPartners, illustRecord, illustSecondTake, illustTalk, illustWorks, pageIcon } from './illust';
import { arrow, bpMark, socialIcon } from './icons';
import { ext, more, num, pageHero, secHead } from './parts';
import { esc, heading, jp } from './text';

const SERVICE_ILL: Record<string, () => string> = { partners: illustPartners, baton: illustBaton, secondtake: illustSecondTake };

/* ───────── 共通の部品 ───────── */

function faqList(items: QA[], id: string, title: string): string {
  return `<section class="sec faq" aria-labelledby="${id}">
  <div class="wrap faq-in">
    <h2 class="sh-title faq-title" id="${id}">${esc(title)}</h2>
    <div class="faq-list">${items
      .map((f, i) => `<details class="qa"${i === 0 ? ' open' : ''}><summary><span class="qa-q">${esc(f.q)}</span><span class="qa-icon" aria-hidden="true"></span></summary><div class="qa-a"><p>${jp(f.a)}</p></div></details>`)
      .join('')}</div>
  </div>
</section>`;
}

/** ページの終わりの「次のページ」。本の章のように、順に読み進められる */
function pageEnd(key: PageKey): string {
  const N = C.common.next;
  const order = N.order as readonly string[];
  const i = order.indexOf(key);
  const nextKey = order[i + 1];
  if (!nextKey) return '';
  const p = page(nextKey as PageKey);
  return `<nav class="page-end" aria-label="${esc(N.label)}">
  <div class="wrap">
    <a class="page-end-link" href="${p.path}">
      <span class="page-end-label">${esc(N.label)}</span>
      <span class="page-end-name">${esc(p.crumb)}</span>
      <span class="page-end-blurb">${jp(N.blurb[nextKey])}</span>
      <span class="page-end-arrow">${arrow('right')}</span>
    </a>
  </div>
</nav>`;
}

/** 公開中の会社：ブラウザとスマホの画面（くわしい版と、短い版） */
function projectMedia(p: Project): string {
  return `<div class="proj-media" data-tilt>
    <a class="proj-browser" ${ext(p.href)} aria-label="${esc(p.name)}のページを開く">
      <span class="proj-bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(p.href.replace('https://', ''))}</span></span>
      <span class="proj-screens">
        <img src="${p.shots.desktop}" alt="${esc(p.name)}のBaton Partnersページ（トップ）" width="1440" height="900" loading="lazy" decoding="async">
        <img class="proj-screen-2" src="${p.shots.desktop2}" alt="" width="1440" height="900" loading="lazy" decoding="async">
      </span>
    </a>
    <span class="proj-phone" aria-hidden="true"><img src="${p.shots.mobile}" alt="" width="390" height="844" loading="lazy" decoding="async"></span>
    <span class="proj-glow" aria-hidden="true"></span>
  </div>`;
}

function projectRow(p: Project, i: number, full: boolean): string {
  const W = C.works.spec;
  return `<article class="proj proj-${p.id}${i % 2 ? ' is-flip' : ''}" style="--c1:${p.palette[0]};--c2:${p.palette[1]}" data-proj>
  ${projectMedia(p)}
  <div class="proj-info">
    <p class="proj-no"><span>${esc(p.no)}</span><span class="proj-live"><span class="live-dot" aria-hidden="true"></span>公開中</span></p>
    <img class="proj-logo" src="${p.logo.src}" alt="${esc(p.name)}" width="${p.logo.w}" height="${p.logo.h}" loading="lazy" decoding="async">
    <h3 class="proj-name">${esc(p.name)}${p.service ? `<small>${esc(p.service)}</small>` : ''}</h3>
    <p class="proj-meta">${esc(p.category)}　${esc(p.base)}</p>
    <p class="proj-catch">${esc(p.catch)}</p>
    <p class="proj-note">${jp(p.world.note)}</p>
    ${
      full
        ? `<dl class="proj-spec">
      <div><dt>${esc(W.palette)}</dt><dd><ul class="proj-palette">${p.palette.map((c) => `<li style="--c:${c}"><span>${c}</span></li>`).join('')}</ul></dd></div>
      <div><dt>${esc(W.type)}</dt><dd>${esc(p.type)}</dd></div>
      <div><dt>${esc(W.motif)}</dt><dd>${esc(p.motif)}</dd></div>
    </dl>
    <p class="proj-pages-title">${esc(W.pages)}</p>
    <ul class="proj-pages">${p.pages.map((pg, k) => `<li><a ${ext(pg.href)}><span>${num(k + 1)}</span>${esc(pg.label)}${arrow('up-right')}</a></li>`).join('')}</ul>`
        : `<p class="proj-open">${more(p.href, 'ページを開く', { external: true })}</p>`
    }
  </div>
</article>`;
}

function newsRow(a: Activity): string {
  const label = C.news.types[a.type] ?? a.type;
  const inner = `<time datetime="${a.date}">${dotDate(a.date)}</time><span class="nr-type" data-type="${a.type}">${esc(label)}</span><span class="nr-title">${jp(a.title)}</span>${a.href ? arrow('up-right') : ''}`;
  return `<li class="nr">${a.href ? `<a ${a.href.startsWith('http') ? ext(a.href) : `href="${a.href}"`}>${inner}</a>` : `<div>${inner}</div>`}</li>`;
}

/* ───────── トップ ───────── */
function top(): string {
  const T = C.top;
  return `<section class="hero" aria-labelledby="hero-title">
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="hero-eyebrow">${esc(T.eyebrow)}</p>
      <h1 class="hero-title" id="hero-title">${heading(T.title)}</h1>
      <p class="hero-lead">${jp(T.lead)}</p>
      <a class="hero-more" href="#answer"><span>${esc(T.more)}</span><span class="hero-more-arrow">${arrow('down')}</span></a>
    </div>
    <div class="hero-visual" data-record>
      <canvas class="record-gl" data-record-canvas aria-hidden="true"></canvas>
      <div class="record-fallback">${illustRecord()}</div>
      <span class="record-shadow" aria-hidden="true"></span>
    </div>
  </div>
</section>

<section class="sec answer" id="answer" aria-labelledby="answer-title">
  <div class="wrap answer-in">
    <p class="sh-label">${esc(T.answer.label)}</p>
    <h2 class="answer-title" id="answer-title" data-reveal>${heading(T.answer.title)}</h2>
    <div class="answer-body">
      ${T.answer.body.map((b) => `<p data-reveal>${jp(b)}</p>`).join('')}
      <p class="answer-music" data-reveal>${esc(T.answer.music)} ${more(`${OFFICIAL_URL}/works/`, T.answer.musicLink, { external: true })}</p>
    </div>
  </div>
</section>

<section class="sec services" aria-labelledby="svc-title">
  <div class="wrap">
    ${secHead({ id: 'svc-title', label: T.services.label, title: T.services.title })}
    <div class="svc-grid">${T.services.items
      .map(
        (s, i) => `<a class="svc svc-${s.key}" href="${s.href}" data-reveal style="--i:${i}">
      <span class="svc-ill">${SERVICE_ILL[s.key]()}</span>
      <span class="svc-kind">${esc(s.kind)}</span>
      <span class="svc-name">${esc(s.name)}</span>
      <span class="svc-body">${jp(s.body)}</span>
      <span class="svc-more">${esc(s.more)}${arrow('right')}</span>
    </a>`,
      )
      .join('')}</div>
  </div>
</section>

<section class="sec showcase is-dark" aria-labelledby="works-title">
  <div class="wrap">
    ${secHead({ id: 'works-title', label: T.works.label, title: T.works.title, lead: T.works.lead })}
    ${projects.map((p, i) => projectRow(p, i, false)).join('')}
    <p class="showcase-more">${more('/works/', T.works.more)}</p>
  </div>
</section>

<section class="sec latest" aria-labelledby="latest-title">
  <div class="wrap latest-in">
    ${secHead({ id: 'latest-title', label: T.news.label, title: T.news.title })}
    <div>
      <ul class="news-rows">${sortedActivity().slice(0, 4).map(newsRow).join('')}</ul>
      <p class="latest-more">${more('/news/', T.news.more)}</p>
    </div>
  </div>
</section>`;
}

/* ───────── Baton Partners ───────── */
const STEP_VIS = [
  '<span class="sv sv-research"><i></i><i></i><i></i><i></i></span>',
  '<span class="sv sv-understand"><i></i><i></i><i></i></span>',
  '<span class="sv sv-world"><i style="--c:#E40010"></i><i style="--c:#1CCCE8"></i><i style="--c:#0E0F12"></i><i style="--c:#2B4BFF"></i></span>',
  '<span class="sv sv-build"><i></i><i></i><i></i><i></i><i></i></span>',
  '<span class="sv sv-search"><i></i><i></i><i></i></span>',
  '<span class="sv sv-launch"><i></i></span>',
  '<span class="sv sv-grow"><i></i><i></i><i></i><i></i><i></i></span>',
  '<span class="sv sv-connect"><i></i><i></i><b></b></span>',
];

function partners(): string {
  const P = C.partners;
  const b = P.build;
  return `${pageHero({
    key: 'partners',
    label: P.label,
    title: P.title,
    catch: P.catch,
    lead: P.lead,
    extra: `<p class="phero-links">${more(P.site.href, P.site.label, { external: true })}</p>`,
    aside: `<div class="bp-visual"><span class="bp-visual-mark">${bpMark({ size: 120, animated: true, id: 'bph' })}</span>${illustPartners()}</div>`,
  })}

<section class="sec pages5" aria-labelledby="pages-title">
  <div class="wrap">
    ${secHead({ id: 'pages-title', label: P.pages.label, title: P.pages.title, lead: P.pages.lead })}
    <ol class="p5">${P.pages.items
      .map((it, i) => `<li class="p5-item" data-reveal style="--i:${i}"><span class="p5-ill">${pageIcon(i)}</span><span class="p5-no">${num(i + 1)}</span><h3 class="p5-name">${esc(it.name)}</h3><p class="p5-body">${jp(it.body)}</p></li>`)
      .join('')}</ol>
  </div>
</section>

<section class="build is-dark" id="build" aria-labelledby="build-title">
  <div class="build-pin">
    <header class="build-head wrap-pad">
      <p class="sh-label">${esc(b.label)}</p>
      <h2 class="sh-title" id="build-title">${heading(b.title)}</h2>
      <p class="sh-lead">${jp(b.lead)}</p>
    </header>
    <div class="build-viewport">
      <ol class="build-track" data-build-track>
        ${b.steps
          .map(
            (s, i) => `<li class="build-step${i === 0 ? ' is-on' : ''}" style="--i:${i}">
          <span class="build-no">${num(i + 1)}</span>
          ${STEP_VIS[i]}
          <p class="build-en">${esc(s.en)}</p>
          <h3 class="build-name">${esc(s.name)}</h3>
          <p class="build-body">${jp(s.body)}</p>
          ${i === 0 ? `<figure class="build-quote"><blockquote><p>「${esc(b.quote)}」</p></blockquote><figcaption>${esc(b.quoteBy)}</figcaption></figure>` : ''}
        </li>`,
          )
          .join('')}
      </ol>
    </div>
    <div class="build-progress wrap-pad" aria-hidden="true"><span class="build-progress-bar"><i data-build-bar></i></span><span class="build-progress-txt"><b data-build-count>01</b> / ${num(b.steps.length)}</span></div>
  </div>
</section>

<section class="sec after" aria-labelledby="after-title">
  <div class="wrap after-in">
    ${secHead({ id: 'after-title', label: P.after.label, title: P.after.title })}
    <ol class="flow">${P.after.steps
      .map((s, i) => `<li class="flow-step" data-reveal style="--i:${i}"><span class="flow-no">${num(i + 1)}</span><h3>${esc(s.name)}</h3><p>${jp(s.body)}</p></li>`)
      .join('')}</ol>
    <figure class="note" data-reveal>
      <blockquote><p>${esc(P.after.note)}</p></blockquote>
      <figcaption>${jp(P.after.noteBody)}</figcaption>
    </figure>
  </div>
</section>

<section class="sec mini-works" aria-labelledby="mw-title">
  <div class="wrap">
    ${secHead({ id: 'mw-title', label: P.works.label, title: P.works.title })}
    <div class="mw-grid">${projects
      .map(
        (p) => `<a class="mw" ${ext(p.href)} style="--c1:${p.palette[0]}" data-reveal>
      <span class="mw-shot"><img src="${p.shots.desktop}" alt="${esc(p.name)}のBaton Partnersページ" width="1440" height="900" loading="lazy" decoding="async"></span>
      <span class="mw-no">${esc(p.no)}</span>
      <span class="mw-name">${esc(p.name)}</span>
      <span class="mw-meta">${esc(p.category)}　${esc(p.base)}</span>
    </a>`,
      )
      .join('')}</div>
    <p class="mw-more">${more('/works/', P.works.more)}</p>
  </div>
</section>

${faqList(faqPartners, 'faq-title', P.faqTitle)}
${pageEnd('partners')}`;
}

/* ───────── Baton ───────── */
function baton(): string {
  const B = C.baton;
  const card = `<figure class="pcard" data-tilt-soft>
  <div class="pcard-frame">
    <p class="pcard-top"><span class="pcard-brand">Baton <i>-バトン-</i></span><span class="pcard-url">${esc(B.card.url)}</span></p>
    <div class="pcard-hero">
      <img src="/people/kabeya-480.webp" srcset="/people/kabeya-480.webp 480w, /people/kabeya-800.webp 800w" sizes="(min-width: 900px) 220px, 40vw" alt="${esc(company.representative)}" width="480" height="600" loading="lazy" decoding="async">
      <p class="pcard-id"><span class="pcard-name">${esc(B.card.name)}</span><span class="pcard-role">${jp(B.card.role)}</span><span class="pcard-tag">${esc(B.card.tag)}</span></p>
    </div>
    <dl class="pcard-rows">${B.card.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${jp(v)}</dd></div>`).join('')}</dl>
  </div>
</figure>`;
  return `${pageHero({
    key: 'baton',
    label: B.label,
    title: B.title,
    catch: B.catch,
    lead: B.lead,
    extra: `<p class="phero-links">${more(B.site.href, B.site.label, { external: true })}</p>`,
    aside: card,
    cls: 'phero-baton',
  })}

<section class="sec rules" aria-labelledby="rules-title">
  <div class="wrap">
    ${secHead({ id: 'rules-title', label: B.rules.label, title: B.rules.title })}
    <ul class="cards4">${B.rules.items
      .map((r, i) => `<li class="card" data-reveal style="--i:${i}"><span class="card-no">${num(i + 1)}</span><h3>${esc(r.name)}</h3><p>${jp(r.body)}</p></li>`)
      .join('')}</ul>
  </div>
</section>

<section class="sec baton-flow" aria-labelledby="bflow-title">
  <div class="wrap">
    ${secHead({ id: 'bflow-title', label: B.flow.label, title: B.flow.title })}
    <ol class="relay">${B.flow.steps
      .map((s, i) => `<li class="relay-step" data-reveal style="--i:${i}"><span class="relay-dot" aria-hidden="true"></span><span class="flow-no">${num(i + 1)}</span><h3>${esc(s.name)}</h3><p>${jp(s.body)}</p></li>`)
      .join('')}</ol>
  </div>
</section>

<section class="sec versus" aria-labelledby="vs-title">
  <div class="wrap versus-in">
    ${secHead({ id: 'vs-title', label: B.versus.label, title: B.versus.title })}
    <div class="versus-body" data-reveal>
      <p>${jp(B.versus.body)}</p>
      <p class="versus-links">${B.versus.links.map((l) => more(l.href, l.label, { external: true })).join('')}</p>
    </div>
  </div>
</section>
${pageEnd('baton')}`;
}

/* ───────── SECOND TAKE ───────── */
function secondTake(): string {
  const S = C.secondTake;
  return `${pageHero({
    key: 'secondtake',
    label: S.label,
    title: S.title,
    catch: S.catch,
    lead: S.lead,
    extra: `<p class="phero-links">${more(S.site.href, S.site.label, { external: true })}<span class="onair"><span class="live-dot" aria-hidden="true"></span>${esc(S.onAir)}</span></p>`,
    aside: `<div class="st-visual">${illustSecondTake()}<canvas class="st-wave" data-wave aria-hidden="true"></canvas></div>`,
    cls: 'phero-st',
  })}

<section class="sec outputs" aria-labelledby="out-title">
  <div class="wrap">
    ${secHead({ id: 'out-title', label: S.outputs.label, title: S.outputs.title })}
    <ul class="cards4 cards-out">${S.outputs.items
      .map((o, i) => `<li class="card" data-reveal style="--i:${i}"><span class="card-en">${esc(o.en)}</span><h3>${esc(o.name)}</h3><p>${jp(o.body)}</p></li>`)
      .join('')}</ul>
  </div>
</section>

<section class="sec st-rules is-dark" aria-labelledby="str-title">
  <div class="wrap">
    ${secHead({ id: 'str-title', label: S.rules.label, title: S.rules.title })}
    <ol class="st-list">${S.rules.items
      .map((r, i) => `<li data-reveal style="--i:${i}"><span class="st-take">TAKE ${i + 1}</span><h3>${esc(r.name)}</h3><p>${jp(r.body)}</p></li>`)
      .join('')}</ol>
  </div>
</section>

<section class="sec st-now" aria-labelledby="stn-title">
  <div class="wrap st-now-in">
    <h2 class="sh-label" id="stn-title">${esc(S.now.label)}</h2>
    <p class="st-now-body" data-reveal>${jp(S.now.body)}</p>
  </div>
</section>
${pageEnd('secondtake')}`;
}

/* ───────── 公開中のページ ───────── */
function works(): string {
  const W = C.works;
  return `${pageHero({ key: 'works', label: W.label, title: W.title, lead: W.lead, aside: `<div class="hero-ill">${illustWorks()}</div>` })}
<section class="sec showcase is-dark showcase-full" aria-label="${esc(W.title)}">
  <div class="wrap">
    ${projects.map((p, i) => projectRow(p, i, true)).join('')}
    <p class="showcase-more">${more(W.all.href, W.all.label, { external: true })}</p>
  </div>
</section>
${pageEnd('works')}`;
}

/* ───────── お知らせ ───────── */
function newsPage(): string {
  const N = C.news;
  const items = sortedActivity();
  const types = (['NOW', 'LATEST', 'BUILD LOG', 'JOURNAL'] as const).filter((t) => items.some((a) => a.type === t));
  return `${pageHero({ key: 'news', label: N.label, title: N.title, lead: N.lead, extra: `<p class="phero-links">${more('/feed.xml', N.feeds)}</p>`, aside: `<div class="hero-ill">${illustNews()}</div>` })}
<section class="sec feed" aria-label="${esc(N.title)}">
  <div class="wrap">
    <div class="feed-filter" role="group" aria-label="種類で絞り込む">
      <button type="button" class="chip is-on" data-filter="all" aria-pressed="true">${esc(N.all)}<span>${items.length}</span></button>
      ${types.map((t) => `<button type="button" class="chip" data-filter="${t}" aria-pressed="false">${esc(N.types[t])}<span>${items.filter((a) => a.type === t).length}</span></button>`).join('')}
    </div>
    <ol class="feed-list">${items
      .map((a) => {
        const inner = `<p class="fc-top"><time datetime="${a.date}">${dotDate(a.date)}</time><span class="nr-type" data-type="${a.type}">${esc(N.types[a.type] ?? a.type)}</span><span class="fc-source">${esc(a.source)}</span></p><h2 class="fc-title">${jp(a.title)}</h2>${a.body ? `<p class="fc-body">${jp(a.body)}</p>` : ''}`;
        return `<li class="fc" data-type="${a.type}">${a.href ? `<a ${a.href.startsWith('http') ? ext(a.href) : `href="${a.href}"`}>${inner}<span class="fc-go">${arrow('up-right')}</span></a>` : `<div>${inner}</div>`}</li>`;
      })
      .join('')}</ol>
  </div>
</section>
${pageEnd('news')}`;
}

/* ───────── 会社概要 ───────── */
function about(): string {
  const A = C.about;
  const R = A.rows;
  const rows: [string, string][] = [
    [R.name, `${esc(company.name)}（${esc(company.nameEn)}）`],
    [R.rep, esc(company.representative)],
    [R.address, `〒${esc(company.postal)} ${esc(company.address)}`],
    [R.corporateNo, esc(company.corporateNo)],
    [R.business, `<ul class="about-biz">${A.business.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`],
    [R.email, `<a href="mailto:${EMAIL}">${esc(EMAIL)}</a>`],
    [R.site, `<a ${ext(`${OFFICIAL_URL}/`)}>music-japan.com${arrow('up-right')}</a>`],
  ];
  return `${pageHero({ key: 'about', label: A.label, title: A.title, lead: A.official, extra: `<p class="phero-note">${esc(A.officialNote)}</p>`, aside: `<div class="hero-ill">${illustAbout()}</div>` })}
<section class="sec about-company" aria-label="${esc(A.title)}">
  <div class="wrap">
    <dl class="about-table">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </div>
</section>

<section class="sec about-person" aria-labelledby="person-title">
  <div class="wrap person">
    <div class="person-photo"><img src="/people/kabeya-480.webp" srcset="/people/kabeya-480.webp 480w, /people/kabeya-800.webp 800w" sizes="(min-width: 900px) 320px, 70vw" alt="${esc(company.representative)}" width="480" height="600" loading="lazy" decoding="async"></div>
    <div class="person-copy">
      <p class="sh-label">${esc(A.person.label)}</p>
      <h2 class="person-name" id="person-title">${esc(company.representative)}<small>${esc(company.representativeKana)}</small></h2>
      <p class="person-role">${esc(A.person.role)}</p>
      <p class="person-body">${jp(A.person.body)}</p>
      <p class="person-links">${A.person.links.map((l) => more(l.href, l.label, { external: true })).join('')}</p>
      <p class="sh-label person-sns-title">${esc(A.sns)}</p>
      <ul class="person-sns">${socials.map((s) => `<li><a ${ext(s.href)}>${socialIcon(s.name)}<span>${esc(s.name)}<small>${esc(s.owner)}</small></span></a></li>`).join('')}</ul>
    </div>
  </div>
</section>

${faqList(faqGeneral, 'faq-title', A.faqTitle)}
${pageEnd('about')}`;
}

/* ───────── 話してみる ───────── */
function talk(): string {
  const T = C.talk;
  return `${pageHero({ key: 'talk', label: T.label, title: T.title, lead: T.lead, cls: 'phero-talk', aside: `<div class="hero-ill">${illustTalk()}</div>` })}
<section class="sec talk" aria-labelledby="topics-title">
  <div class="wrap talk-in">
    <div class="talk-topics">
      <h2 class="sh-label" id="topics-title">${esc(T.topicsTitle)}</h2>
      <ul>${T.topics.map((t) => `<li><a href="${t.href}"><span class="tt-name">${esc(t.name)}</span><span class="tt-body">${esc(t.body)}</span>${arrow('right')}</a></li>`).join('')}</ul>
    </div>
    <div class="talk-book">
      <a class="book" ${ext(TIMEREX_URL)} data-talk="talk-page">
        <span class="book-label">${esc(T.button)}</span>
        <span class="book-sub">${jp(T.buttonSub)}</span>
        <span class="book-icon">${arrow('up-right')}</span>
      </a>
      <p class="talk-mail">${esc(T.mail)}：<a href="mailto:${EMAIL}">${esc(EMAIL)}</a></p>
      <p class="talk-music">${esc(T.music)} ${more(`${OFFICIAL_URL}/`, T.musicLink, { external: true })}</p>
    </div>
  </div>
</section>`;
}

export function notFound(): string {
  const N = C.notFound;
  return `<section class="phero nf"><div class="wrap phero-in"><div class="phero-copy"><p class="phero-label">404</p><h1 class="phero-title is-jp">${heading(N.title)}</h1><p class="phero-lead">${jp(N.body)}</p><p class="phero-links">${more('/', N.home)}</p></div></div></section>`;
}

export const PAGE_BODY: Record<PageKey, () => string> = {
  top,
  partners,
  baton,
  secondtake: secondTake,
  works,
  news: newsPage,
  about,
  talk,
};
