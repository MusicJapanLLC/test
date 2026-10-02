import * as C from '../content/copy';
import { dotDate, sortedActivity, type Activity } from '../content/activity';
import { faq } from '../content/faq';
import { projects } from '../content/projects';
import { searchLog } from '../content/search-log';
import { BATON_KABEYA_URL, company, EMAIL, OFFICIAL_URL, socials, TEL, TIMEREX_URL } from '../content/site';
import { arrow, bpMark, introMark, mjMark, socialIcon } from './icons';
import { esc, heading, jp } from './text';

const ext = (href: string) => `href="${esc(href)}" target="_blank" rel="noopener"`;
const num = (n: number) => String(n).padStart(2, '0');

/** 予約ページへのボタン。ラベルとサブラベル（ハードルを下げるひとこと） */
function talkButton(label: string, opts: { sub?: string; cls?: string; place: string } = { place: 'body' }): string {
  return `<a class="btn btn-talk ${opts.cls ?? ''}" ${ext(TIMEREX_URL)} data-magnetic data-cursor="TALK" data-talk="${opts.place}"><span class="btn-txt"><span class="btn-label">${jp(label)}</span>${opts.sub ? `<span class="btn-sub">${esc(opts.sub)}</span>` : ''}</span><span class="btn-icon">${arrow('up-right')}</span><span class="sr">（TimeRexの予約ページが新しいタブで開きます）</span></a>`;
}

function kicker(no: string, text: string): string {
  return `<p class="kicker"><span class="kicker-no">${no}</span><span class="kicker-rule" aria-hidden="true"></span><span class="kicker-txt" data-scramble>${esc(text)}</span></p>`;
}

function easeList(cls = ''): string {
  return `<ul class="ease ${cls}">${C.talk.ease.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

/* ───────────────────────── 01 HERO ───────────────────────── */
function hero(): string {
  const h = C.hero;
  const [first, ...rest] = h.rotate;
  return `<section class="hero" id="top" data-air="ink" data-ch="0" data-rail="01" aria-labelledby="hero-title">
  <div class="hero-in">
    <p class="hero-kicker"><span class="live-dot" aria-hidden="true"></span><span>${esc(h.kicker)}</span><span class="hero-rot" aria-hidden="true"><span class="hero-rot-lead">${esc(h.rotateLead)}</span><b class="hero-rot-word" data-rotate="${esc([first, ...rest].join('|'))}">${esc(first)}</b></span></p>
    <p class="hero-pre" data-hero-in>${heading(h.pre)}</p>
    <h1 class="hero-title" id="hero-title" data-split>${heading(h.title)}</h1>
    <p class="hero-lead" data-hero-in>${jp(h.lead)}</p>
    <div class="hero-cta" data-hero-in>
      ${talkButton(C.talk.partners, { sub: C.talk.sub, cls: 'btn-xl', place: 'hero' })}
      <a class="btn btn-ghost" href="#live" data-cursor="VIEW"><span class="btn-txt"><span class="btn-label">${esc(h.secondary)}</span></span><span class="btn-icon">${arrow('down')}</span></a>
    </div>
    ${easeList('hero-ease')}
  </div>
  <div class="hero-foot" data-hero-in>
    <div class="hero-live">
      <span class="hero-live-tag"><span class="live-dot" aria-hidden="true"></span>${esc(h.live)}</span>
      ${projects.map((p) => `<a ${ext(p.href)} data-cursor="OPEN">${esc(p.href.replace('https://', ''))}</a>`).join('')}
    </div>
    <p class="hero-scroll"><span class="hero-scroll-line" aria-hidden="true"></span>${esc(h.scroll)}</p>
  </div>
</section>`;
}

/* ───────────────────────── 02 WHAT WE DO ───────────────────────── */
const GLYPHS = [
  // FOUND: 点の中から、虫めがねがひとつを見つける
  `<svg viewBox="0 0 120 120" class="glyph glyph-found" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => {
    const a = i * 2.39996;
    const r = 10 + 46 * Math.sqrt((i + 0.5) / 26);
    return `<circle cx="${(60 + Math.cos(a) * r).toFixed(1)}" cy="${(60 + Math.sin(a) * r).toFixed(1)}" r="${i === 7 ? 3.6 : 1.8}" class="${i === 7 ? 'g-hit' : 'g-dot'}"/>`;
  }).join('')}<circle cx="79" cy="58" r="16" class="g-lens"/><path d="M90.5 69.5 104 83" class="g-lens"/></svg>`,
  // KNOWN: 点がページの形に並ぶ
  `<svg viewBox="0 0 120 120" class="glyph glyph-known" aria-hidden="true"><rect x="22" y="16" width="76" height="88" rx="3" class="g-frame"/><rect x="30" y="26" width="60" height="26" class="g-hero"/><path d="M30 62h44M30 70h56M30 78h36" class="g-text"/><rect x="30" y="88" width="24" height="7" rx="3.5" class="g-btn"/></svg>`,
  // WANTED: 声の波形が言葉になる
  `<svg viewBox="0 0 120 120" class="glyph glyph-wanted" aria-hidden="true">${Array.from({ length: 15 }, (_, i) => {
    const h = 8 + Math.abs(Math.sin(i * 1.3) * 26) + (i % 3) * 4;
    return `<rect x="${18 + i * 6}" y="${(46 - h / 2).toFixed(1)}" width="2.6" height="${h.toFixed(1)}" rx="1.3" class="g-bar" style="--i:${i}"/>`;
  }).join('')}<path d="M22 84h76M22 94h52" class="g-text"/></svg>`,
  // CONNECTED: 2つの点が、赤い線でつながる
  `<svg viewBox="0 0 120 120" class="glyph glyph-connected" aria-hidden="true"><circle cx="28" cy="60" r="9" class="g-node"/><circle cx="92" cy="60" r="9" class="g-node g-node-red"/><path d="M37 60 C 52 34, 68 34, 83 60" class="g-link"/><circle cx="60" cy="41" r="2.4" class="g-spark"/></svg>`,
];

function what(): string {
  const w = C.what;
  return `<section class="sec what" id="what" data-air="paper" data-ch="0" data-rail="02" aria-labelledby="what-title">
  <div class="wrap">
    <header class="sec-head">
      ${kicker('02', w.kicker)}
      <h2 class="h2" id="what-title" data-split>${heading(w.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(w.lead)}</p>
    </header>
    <ol class="what-grid">
      ${w.stages
        .map(
          (s, i) => `<li class="stage" style="--i:${i}" data-reveal>
        <div class="stage-top"><span class="stage-no">${num(i + 1)}</span><span class="stage-en">${esc(s.en)}</span></div>
        ${GLYPHS[i]}
        <h3 class="stage-title">${heading(s.title)}</h3>
        <p class="stage-body">${jp(s.body)}</p>
        <ul class="stage-where">${s.where.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </li>`,
        )
        .join('')}
    </ol>
    <svg class="what-thread" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20 C 150 4, 250 36, 400 20 S 650 4, 800 20 S 1050 36, 1200 20" pathLength="1"/></svg>
    <aside class="what-aside" data-reveal><span class="what-aside-mark">${mjMark({ id: 'wa' })}</span><p>${jp(w.aside)}</p><a class="link-arrow" ${ext(w.asideLink.href)}>${esc(w.asideLink.label)}${arrow('up-right')}</a></aside>
  </div>
</section>`;
}

/* ───────────────────────── 03 ECOSYSTEM ───────────────────────── */
function ecosystem(): string {
  const e = C.ecosystem;
  return `<section class="sec eco" id="ecosystem" data-air="ink" data-ch="1" data-rail="03" data-pin="eco" aria-labelledby="eco-title">
  <div class="eco-stage">
    <header class="eco-head">
      ${kicker('03', e.kicker)}
      <h2 class="h2 h2-eco" id="eco-title" data-split>${heading(e.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(e.lead)}</p>
    </header>
    <div class="eco-map" data-eco-map>
      <svg class="eco-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${e.edges
        .map((ed) => `<line data-edge="${ed.from}-${ed.to}" class="${ed.human ? 'is-human' : ''}"/>`)
        .join('')}</svg>
      ${e.nodes
        .map(
          (n, i) =>
            `<button class="eco-node eco-${n.id}${i === 0 ? ' is-active' : ''}" type="button" data-node="${n.id}" aria-pressed="${i === 0}" data-cursor="SELECT"><span class="eco-node-dot" aria-hidden="true"></span><span class="eco-node-name">${esc(n.name)}</span><span class="eco-node-sub">${esc(n.sub)}</span></button>`,
        )
        .join('')}
      <p class="eco-hint" aria-hidden="true">${esc(e.hint)}</p>
    </div>
    <div class="eco-panel" aria-live="polite">
      ${e.nodes
        .map(
          (n, i) => `<div class="eco-info" data-info="${n.id}"${i === 0 ? '' : ' hidden'}>
        <p class="eco-info-name">${esc(n.name)}<span>${esc(n.sub)}</span></p>
        <p class="eco-info-body">${jp(n.body)}</p>
        <ul class="eco-info-edges">${e.edges
          .filter((ed) => ed.from === n.id || ed.to === n.id)
          .map((ed) => {
            const other = e.nodes.find((x) => x.id === (ed.from === n.id ? ed.to : ed.from))!;
            return `<li class="${ed.human ? 'is-human' : ''}"><span>${ed.from === n.id ? '→' : '←'} ${esc(other.name)}</span>${esc(ed.label)}</li>`;
          })
          .join('')}</ul>
        ${n.href ? `<a class="link-arrow" ${ext(n.href)}>${esc(n.linkLabel ?? n.name)}${arrow('up-right')}</a>` : ''}
      </div>`,
        )
        .join('')}
    </div>
  </div>
  <aside class="eco-example" data-reveal>
    <p class="eco-example-title"><span class="eco-example-tag">EXAMPLE</span>${esc(e.example.title)}</p>
    <p class="eco-example-body">${jp(e.example.body)}</p>
    <p class="eco-example-links">${e.example.links.map((l) => `<a class="link-arrow" ${ext(l.href)}>${esc(l.label)}${arrow('up-right')}</a>`).join('')}</p>
  </aside>
</section>`;
}

/* ───────────────────────── 04 BATON PARTNERS ───────────────────────── */
function partnersIntro(): string {
  const p = C.partners;
  return `<section class="sec bp" id="partners" data-air="red" data-ch="1" data-rail="04" aria-labelledby="bp-title">
  <div class="wrap">
    ${kicker('04', p.kicker)}
    <p class="bp-display" aria-hidden="true" data-stretch><span>BATON</span><span>PARTNERS</span></p>
    <div class="bp-intro">
      <div class="bp-logo" aria-hidden="true">${bpMark({ size: 96, animated: true, id: 'bpi' })}</div>
      <div class="bp-intro-copy">
        <h2 class="h2" id="bp-title" data-split>${heading(p.title)}</h2>
        <p class="sec-lead" data-reveal>${jp(p.lead)}</p>
        <ul class="bp-chips" data-reveal>${p.chips.map((c, i) => `<li><span>${num(i + 1)}</span>${esc(c)}</li>`).join('')}</ul>
        <div class="bp-intro-cta" data-reveal>${talkButton(C.talk.partners, { sub: C.talk.sub, cls: 'btn-ink', place: 'partners-intro' })}</div>
      </div>
    </div>
  </div>
</section>`;
}

function anatomy(): string {
  const a = C.partners.anatomy;
  return `<section class="sec ana" id="anatomy" data-air="ink" data-ch="2" aria-labelledby="ana-title">
  <div class="ana-grid">
    <div class="ana-visual" data-ana-visual>
      <ol class="ana-labels" aria-hidden="true">${a.pages
        .map((pg, i) => `<li class="ana-label" data-page-label="${i}"><span class="ana-label-no">${num(i + 1)}</span><span class="ana-label-en">${esc(pg.en)}</span><span class="ana-label-name">${esc(pg.name)}</span></li>`)
        .join('')}</ol>
      <div class="ana-fallback" aria-hidden="true">${a.pages
        .map((pg, i) => `<div class="ana-sheet" data-sheet="${i}" style="--i:${i}"><span>${esc(pg.en)}</span><i></i><i></i><i></i></div>`)
        .join('')}</div>
    </div>
    <div class="ana-copy">
      <header class="sec-head">
        ${kicker('04.1', a.kicker)}
        <h3 class="h2 h2-sm" id="ana-title" data-split>${heading(a.title)}</h3>
        <p class="sec-lead" data-reveal>${jp(a.lead)}</p>
      </header>
      <ol class="ana-pages">${a.pages
        .map((pg, i) => `<li data-reveal><span class="ana-pages-no">${num(i + 1)}</span><b>${esc(pg.name)}</b><span class="ana-pages-en">${esc(pg.en)}</span><p>${jp(pg.body)}</p></li>`)
        .join('')}</ol>
      <ol class="ana-parts">${a.parts
        .map(
          (pt) => `<li class="ana-part" data-part data-page="${pt.page}">
        <span class="ana-part-no">${pt.no}</span>
        <div><h4>${esc(pt.name)}<small>${pt.page < 0 ? 'ALL PAGES' : esc(a.pages[pt.page].en)}</small></h4><p>${jp(pt.body)}</p></div>
      </li>`,
        )
        .join('')}</ol>
    </div>
  </div>
</section>`;
}

function world(): string {
  const w = C.partners.world;
  return `<section class="sec world" id="world" data-air="paper" data-ch="2" aria-labelledby="world-title">
  <div class="wrap">
    <header class="sec-head sec-head-row">
      ${kicker('04.2', w.kicker)}
      <h3 class="h2 h2-sm" id="world-title" data-split>${heading(w.title)}</h3>
      <p class="sec-lead" data-reveal>${jp(w.lead)}</p>
    </header>
    <div class="world-grid">
      ${projects
        .map(
          (p, i) => `<article class="world-card world-${p.id}" data-reveal style="--d:${i}">
        <div class="world-shot"><img src="${p.shots.desktop}" alt="${esc(p.name)}のBaton Partnersページ（トップ）" width="1440" height="900" loading="lazy" decoding="async"></div>
        <div class="world-body">
          <p class="world-no">${esc(p.no)} — ${esc(p.name)}</p>
          <ul class="world-palette" aria-label="${esc(p.name)}のページで使っている色">${p.palette.map((c) => `<li style="--c:${c}"><span>${c}</span></li>`).join('')}</ul>
          <dl class="world-spec"><div><dt>THEME</dt><dd>${esc(p.world.theme)}</dd></div><div><dt>3D</dt><dd>${esc(p.world.scene)}</dd></div><div><dt>書体</dt><dd>${esc(p.type)}</dd></div><div><dt>モチーフ</dt><dd>${esc(p.motif)}</dd></div></dl>
          <p class="world-note">${jp(p.world.note)}</p>
        </div>
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

function after(): string {
  const a = C.partners.after;
  return `<section class="sec after" id="after" data-air="ink" data-ch="3" aria-labelledby="after-title">
  <div class="wrap">
    <header class="sec-head">
      ${kicker('04.3', a.kicker)}
      <h3 class="h2" id="after-title" data-split>${heading(a.title)}</h3>
    </header>
    <ol class="after-flow" data-after-flow>
      ${a.steps
        .map(
          (s, i) => `<li class="after-step${s.human ? ' is-human' : ''}" style="--i:${i}">
        <span class="after-node" aria-hidden="true"></span>
        <span class="after-no">${num(i + 1)}</span>
        <span class="after-en">${esc(s.en)}</span>
        <h4>${esc(s.name)}</h4>
        <p>${jp(s.body)}</p>
        ${s.human ? '<span class="after-human">HUMAN</span>' : ''}
      </li>`,
        )
        .join('')}
    </ol>
    <div class="after-bottom">
      <figure class="quote" data-reveal>
        <blockquote><p>「${esc(a.quote)}」</p></blockquote>
        <figcaption>${esc(a.quoteBy)}</figcaption>
        <p class="quote-note">${jp(a.quoteNote)}</p>
      </figure>
      <p class="after-note" data-reveal>${jp(a.note)}</p>
    </div>
  </div>
</section>`;
}

function origin(): string {
  const o = C.partners.origin;
  return `<section class="sec origin" id="origin" data-air="paper" data-ch="3" aria-labelledby="origin-title">
  <div class="wrap origin-grid">
    <header class="sec-head">
      ${kicker('04.4', o.kicker)}
      <h3 class="h2 h2-sm" id="origin-title" data-split>${heading(o.title)}</h3>
      <ol class="origin-timeline">${o.timeline.map((t) => `<li data-reveal><time>${esc(t.date)}</time><span>${esc(t.text)}</span></li>`).join('')}</ol>
    </header>
    <div class="origin-body">
      ${o.paragraphs.map((p, i) => `<p class="${i === 0 ? 'origin-first' : ''}${i === o.paragraphs.length - 1 ? ' origin-last' : ''}" data-reveal>${jp(p)}</p>`).join('')}
      <div class="origin-cta" data-reveal>${talkButton(C.talk.partners, { sub: C.talk.sub, place: 'origin' })}</div>
    </div>
  </div>
</section>`;
}

/* ───────────────────────── 05 HOW WE BUILD ───────────────────────── */
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

function build(): string {
  const b = C.build;
  return `<section class="sec build" id="build" data-air="sumi" data-ch="4" data-rail="05" data-pin="build" aria-labelledby="build-title">
  <div class="build-pin">
    <header class="build-head">
      ${kicker('05', b.kicker)}
      <h2 class="h2 h2-sm" id="build-title" data-split>${heading(b.title)}</h2>
      <p class="sec-lead">${jp(b.lead)}</p>
    </header>
    <div class="build-viewport">
      <ol class="build-track" data-build-track>
        ${b.steps
          .map(
            (s, i) => `<li class="build-step" style="--i:${i}">
          <span class="build-no">${num(i + 1)}</span>
          ${STEP_VIS[i]}
          <p class="build-en">${esc(s.en)}</p>
          <h3 class="build-name">${heading(s.name)}</h3>
          <p class="build-body">${jp(s.body)}</p>
          ${i === 0 ? `<figure class="build-quote"><blockquote><p>「${esc(b.quote)}」</p></blockquote><figcaption>${esc(b.quoteBy)}</figcaption></figure>` : ''}
        </li>`,
          )
          .join('')}
      </ol>
    </div>
    <div class="build-progress" aria-hidden="true"><span class="build-progress-bar"><i data-build-bar></i></span><span class="build-progress-txt"><b data-build-count>01</b> / ${num(b.steps.length)}</span></div>
  </div>
</section>`;
}

/* ───────────────────────── 06 LIVE PROJECTS ───────────────────────── */
function live(): string {
  const l = C.live;
  return `<section class="sec live" id="live" data-air="ink" data-ch="5" data-rail="06" aria-labelledby="live-title">
  <div class="wrap">
    <header class="sec-head">
      ${kicker('06', l.kicker)}
      <h2 class="h2" id="live-title" data-split>${heading(l.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(l.lead)}</p>
    </header>
    ${projects
      .map(
        (p, i) => `<article class="proj proj-${p.id}${i % 2 ? ' is-flip' : ''}" style="--c1:${p.palette[0]};--c2:${p.palette[1]}" data-proj>
      <div class="proj-media" data-tilt>
        <a class="proj-browser" ${ext(p.href)} data-cursor="OPEN" aria-label="${esc(p.name)}のページを開く">
          <span class="proj-bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(p.href.replace('https://', ''))}</span></span>
          <span class="proj-screens">
            <img src="${p.shots.desktop}" alt="${esc(p.name)}のBaton Partnersページ（トップ）" width="1440" height="900" loading="lazy" decoding="async">
            <img class="proj-screen-2" src="${p.shots.desktop2}" alt="" width="1440" height="900" loading="lazy" decoding="async">
          </span>
        </a>
        <span class="proj-phone" aria-hidden="true"><img src="${p.shots.mobile}" alt="" width="390" height="844" loading="lazy" decoding="async"></span>
        <span class="proj-glow" aria-hidden="true"></span>
      </div>
      <div class="proj-info">
        <p class="proj-no"><span>${esc(p.no)}</span><span class="proj-live"><span class="live-dot" aria-hidden="true"></span>LIVE</span></p>
        <img class="proj-logo" src="${p.logo.src}" alt="${esc(p.name)}" width="${p.logo.w}" height="${p.logo.h}" loading="lazy" decoding="async">
        <h3 class="proj-name">${esc(p.name)}${p.service ? `<small>${esc(p.service)}</small>` : ''}</h3>
        <p class="proj-meta">${esc(p.category)} — ${esc(p.base)}</p>
        <p class="proj-catch">${esc(p.catch)}</p>
        <p class="proj-note">${jp(p.world.note)}</p>
        <ul class="proj-pages">${p.pages.map((pg, k) => `<li><a ${ext(pg.href)}><span>${num(k + 1)}</span>${esc(pg.label)}${arrow('up-right')}</a></li>`).join('')}</ul>
      </div>
    </article>`,
      )
      .join('')}
    <p class="live-all"><a class="link-arrow" ${ext(l.all.href)}>${esc(l.all.label)}${arrow('up-right')}</a></p>
  </div>
</section>`;
}

/* ───────────────────────── 07 BATON ───────────────────────── */
function batonSection(): string {
  const b = C.baton;
  const L = b.profile.labels;
  return `<section class="sec baton" id="baton" data-air="paper" data-ch="5" data-rail="07" aria-labelledby="baton-title">
  <div class="wrap">
    <header class="sec-head sec-head-row">
      ${kicker('07', b.kicker)}
      <h2 class="h2" id="baton-title" data-split>${heading(b.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(b.lead)}</p>
    </header>
    <div class="baton-grid">
      <figure class="pcard" data-reveal>
        <a class="pcard-frame" ${ext(BATON_KABEYA_URL)} data-cursor="OPEN">
          <span class="pcard-top"><span class="pcard-brand">Baton <i>-バトン-</i></span><span class="pcard-url">baton.music-japan.com/profile/kabeya/</span></span>
          <span class="pcard-hero">
            <img src="/people/kabeya-480.webp" srcset="/people/kabeya-480.webp 480w, /people/kabeya-800.webp 800w" sizes="(min-width: 960px) 220px, 40vw" alt="壁谷 友生" width="480" height="600" loading="lazy" decoding="async">
            <span class="pcard-id"><span class="pcard-name">壁谷 友生</span><span class="pcard-role">${jp('合同会社Music Japan {代表社員}')}</span><span class="pcard-tag">学び、紡ぎ、繋いでいく。</span></span>
          </span>
          <span class="pcard-rows">
            <span class="pcard-row" data-l="${esc(L.who)}">大阪・梅田の合同会社Music Japan代表。</span>
            <span class="pcard-row" data-l="${esc(L.what)}">音楽制作・配信／SECOND TAKE／Baton</span>
            <span class="pcard-row" data-l="${esc(L.want)}">紹介でしか出会えない相手と、時間をかけて関係をつくりたい方</span>
            <span class="pcard-row pcard-chips" data-l="${esc(L.links)}"><i>公式サイト</i><i>LinkedIn</i><i>Instagram</i></span>
            <span class="pcard-row pcard-chips" data-l="${esc(L.media)}"><i>SECOND TAKE</i><i>Baton</i></span>
          </span>
          <span class="pcard-btn">この人と話してみたい</span>
        </a>
        <figcaption>${esc(b.profile.caption)}</figcaption>
      </figure>
      <div class="baton-side">
        <ul class="baton-points">${b.points.map((p, i) => `<li data-reveal><span>${num(i + 1)}</span><h3>${esc(p.title)}</h3><p>${jp(p.body)}</p></li>`).join('')}</ul>
        <div class="baton-stat" data-reveal><p class="baton-stat-num"><b data-count="${b.stat.value}">${b.stat.value}</b><span>${esc(b.stat.unit)}</span></p><p class="baton-stat-label">${jp(b.stat.label)}<small>${esc(b.stat.source)}</small></p></div>
      </div>
    </div>
    <ol class="relay" data-relay>
      <span class="relay-track" aria-hidden="true"><span class="relay-baton" data-relay-baton></span></span>
      ${b.flow.map((f, i) => `<li class="relay-step" style="--i:${i}"><span class="relay-no">${num(i + 1)}</span><span class="relay-en">${esc(f.en)}</span><h3>${esc(f.name)}</h3><p>${jp(f.body)}</p></li>`).join('')}
    </ol>
    <p class="baton-links">${b.links.map((l) => `<a class="link-arrow" ${ext(l.href)}>${esc(l.label)}${arrow('up-right')}</a>`).join('')}</p>
  </div>
</section>`;
}

/* ───────────────────────── 08 SECOND TAKE ───────────────────────── */
function secondTake(): string {
  const s = C.secondTake;
  return `<section class="sec st" id="second-take" data-air="studio" data-ch="6" data-rail="08" aria-labelledby="st-title">
  <div class="wrap">
    <div class="st-grid">
      <header class="st-copy">
        ${kicker('08', s.kicker)}
        <h2 class="h2" id="st-title" data-split>${heading(s.title)}</h2>
        <p class="sec-lead" data-reveal>${jp(s.lead)}</p>
        <p class="st-notad" data-reveal>${jp(s.notAd)}</p>
        <div class="st-cta" data-reveal>
          ${talkButton(s.talk, { sub: C.talk.sub, place: 'second-take' })}
          <a class="link-arrow" ${ext(s.link.href)}>${esc(s.link.label)}${arrow('up-right')}</a>
        </div>
        <p class="st-status" data-reveal><span class="rec-dot" aria-hidden="true"></span>${esc(s.status)}</p>
      </header>
      <div class="st-visual" aria-hidden="true"><canvas class="st-wave" data-wave></canvas><span class="st-onair">SECOND TAKE — ON AIR SOON</span></div>
    </div>
    <h3 class="st-outputs-title" data-split>${heading(s.outputsTitle)}</h3>
    <ol class="st-outputs">${s.outputs
      .map((o, i) => `<li class="st-out st-out-${i}" data-reveal><span class="st-out-vis" aria-hidden="true">${['<i></i>'.repeat(18), '<i></i>'.repeat(5), '<i></i><i></i><i></i>', '<i></i><i></i>'][i]}</span><span class="st-out-en">${esc(o.en)}</span><h4>${esc(o.name)}</h4><p>${jp(o.body)}</p></li>`)
      .join('')}</ol>
    <ol class="st-principles">${s.principles.map((p) => `<li data-reveal><span>${p.no}</span><h4>${heading(p.name)}</h4><p>${jp(p.body)}</p></li>`).join('')}</ol>
  </div>
</section>`;
}

/* ───────────────────────── 09 SEARCH ASSET ───────────────────────── */
function search(): string {
  const s = C.search;
  const rows = searchLog
    .map((r) => `<tr><td><a ${ext(r.url)}>${esc(r.page)}</a></td><td>${esc(r.query)}</td><td>${esc(r.published)}</td><td>${esc(r.checked)}</td><td>${esc(r.position)}<small>${esc(r.how)}</small></td></tr>`)
    .join('');
  return `<section class="sec search" id="search" data-air="paper" data-ch="6" data-rail="09" aria-labelledby="search-title">
  <div class="wrap">
    <header class="sec-head sec-head-row">
      ${kicker('09', s.kicker)}
      <h2 class="h2" id="search-title" data-split>${heading(s.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(s.lead)}</p>
    </header>
    <div class="search-grid">
      <figure class="serp" data-serp>
        <div class="serp-box"><span class="serp-g" aria-hidden="true">${mjMark({ id: 'sg' })}</span><span class="serp-q" data-serp-q data-text="${esc(s.demoQuery)}">${esc(s.demoQuery)}</span><span class="serp-caret" aria-hidden="true"></span></div>
        <ol class="serp-list">${s.demo
          .map((d, i) => `<li class="serp-item" style="--i:${i}"><span class="serp-kind">${esc(d.kind)}</span><span class="serp-title">${esc(d.title)}</span><span class="serp-url">${esc(d.url)}</span><span class="serp-lines" aria-hidden="true"><i></i><i></i></span></li>`)
          .join('')}</ol>
        <figcaption>${esc(s.demoNote)}</figcaption>
      </figure>
      <div class="ledger">
        <h3 class="ledger-title">${esc(s.ledgerTitle)}<span>${s.ledger.length} PAGES</span></h3>
        <ol class="ledger-list">${s.ledger
          .map(
            (r, i) =>
              `<li data-reveal style="--i:${i}">${r.href ? `<a ${ext(r.href)}>` : '<span class="ledger-self">'}<span class="ledger-date">${esc(r.date.replaceAll('-', '.'))}</span><span class="ledger-name">${esc(r.name)}</span><span class="ledger-kind">${esc(r.kind)}</span>${r.href ? `${arrow('up-right')}</a>` : '</span>'}</li>`,
          )
          .join('')}</ol>
      </div>
    </div>
    <div class="slog">
      <h3 class="slog-title">${esc(s.logTitle)}</h3>
      <div class="slog-table" role="region" aria-label="${esc(s.logTitle)}" tabindex="0">
        <table><thead><tr>${s.logHead.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr class="slog-empty"><td colspan="${s.logHead.length}"><span class="slog-cursor" aria-hidden="true"></span>${esc(s.logEmpty)}</td></tr>`}</tbody></table>
      </div>
      <p class="slog-rule">${jp(s.rule)}</p>
    </div>
    <p class="search-principle" data-split>${heading(s.principle)}</p>
  </div>
</section>`;
}

/* ───────────────────────── 10 NOW ───────────────────────── */
function feedCard(a: Activity, i: number): string {
  const body = `<span class="card-top"><span class="card-type">${esc(a.type)}</span><time datetime="${esc(a.date)}">${esc(dotDate(a.date))}</time></span>
      <span class="card-source">${esc(a.source)}</span>
      <span class="card-title">${esc(a.title)}</span>
      ${a.body ? `<span class="card-body">${jp(a.body)}</span>` : ''}
      ${a.href ? `<span class="card-go">${arrow('up-right')}</span>` : ''}`;
  return `<li class="card" data-type="${esc(a.type)}" style="--i:${i}; view-transition-name: card-${i}">${a.href ? `<a class="card-in" ${ext(a.href)} data-cursor="OPEN">${body}</a>` : `<div class="card-in">${body}</div>`}</li>`;
}

function now(): string {
  const n = C.now;
  const list = sortedActivity();
  const types = ['NOW', 'LATEST', 'BUILD LOG', 'JOURNAL'] as const;
  return `<section class="sec now" id="now" data-air="ink" data-ch="7" data-rail="10" aria-labelledby="now-title">
  <div class="wrap">
    <header class="sec-head sec-head-row">
      ${kicker('10', n.kicker)}
      <h2 class="h2" id="now-title" data-split>${heading(n.title)}</h2>
      <p class="sec-lead" data-reveal>${jp(n.lead)}</p>
    </header>
    <div class="now-filters" role="toolbar" aria-label="種類で絞り込む">
      <button type="button" class="chip is-on" data-filter="ALL" aria-pressed="true">${esc(n.all)}<span>${list.length}</span></button>
      ${types.map((t) => `<button type="button" class="chip" data-filter="${t}" aria-pressed="false">${t}<span>${list.filter((a) => a.type === t).length}</span></button>`).join('')}
    </div>
    <ol class="feed" data-feed>${list.map(feedCard).join('')}</ol>
    <p class="now-feeds">${esc(n.feeds)} <a href="/feed.xml">RSS</a> / <a href="/activity.json">JSON</a></p>
  </div>
</section>`;
}

/* ───────────────────────── 11 ABOUT ───────────────────────── */
function about(): string {
  const a = C.about;
  const p = a.person;
  const facts: [string, string][] = [
    ['会社名', `${company.name}（${company.nameEn}）`],
    ['代表社員', company.representative],
    ['所在地', `〒${company.postal} ${company.address}`],
    ['法人番号', company.corporateNo],
    ['メール', EMAIL],
    ['電話', TEL],
  ];
  return `<section class="sec about" id="about" data-air="paper" data-ch="7" data-rail="11" aria-labelledby="about-title">
  <div class="wrap">
    <header class="sec-head">
      ${kicker('11', a.kicker)}
      <h2 class="h2 h2-sm" id="about-title" data-split>${heading(a.title)}</h2>
    </header>
    <div class="about-grid">
      <div class="about-company">
        <p class="about-official" data-reveal>${jp(a.official)}</p>
        <p class="about-own" data-reveal>${jp(a.own)}</p>
        <dl class="facts">${facts.map(([k, v]) => `<div data-reveal><dt>${esc(k)}</dt><dd>${k === 'メール' ? `<a href="mailto:${EMAIL}">${esc(v)}</a>` : esc(v)}</dd></div>`).join('')}<div data-reveal><dt>事業</dt><dd><ul>${a.businesses.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></dd></div><div data-reveal><dt>公式サイト</dt><dd><a ${ext(`${OFFICIAL_URL}/`)}>music-japan.com</a></dd></div></dl>
      </div>
      <article class="person" aria-labelledby="person-name">
        <figure class="person-photo" data-reveal><img src="/people/kabeya-800.webp" srcset="/people/kabeya-480.webp 480w, /people/kabeya-800.webp 800w" sizes="(min-width: 960px) 34vw, 88vw" alt="${esc(p.photoAlt)}" width="800" height="1000" loading="lazy" decoding="async"><figcaption>OSAKA / JAPAN · 2026</figcaption></figure>
        <div class="person-copy">
          <p class="person-role" data-reveal>${esc(p.role)}</p>
          <h3 class="person-name" id="person-name" data-split>${heading(p.name)}</h3>
          <p class="person-roman" data-reveal>${esc(p.kana)} / ${esc(p.en)}</p>
          <p class="person-tag" data-reveal>${esc(p.tagline)}</p>
          <p class="person-bio" data-reveal>${jp(p.bio)}</p>
          <blockquote class="person-statement" data-reveal>${p.statement.map((t) => `<p>${jp(t)}</p>`).join('')}</blockquote>
          <ul class="person-links" data-reveal>
            ${socials.map((s) => `<li><a ${ext(s.href)} aria-label="${esc(s.name)}（${esc(s.owner)}）">${socialIcon(s.name)}<span>${esc(s.name)}</span></a></li>`).join('')}
            ${a.links.map((l) => `<li><a class="link-arrow" ${ext(l.href)}>${esc(l.label)}${arrow('up-right')}</a></li>`).join('')}
          </ul>
        </div>
      </article>
    </div>
  </div>
</section>`;
}

/* ───────────────────────── FAQ ───────────────────────── */
function faqSection(): string {
  return `<section class="sec faq" id="faq" data-air="ink" data-ch="8" aria-labelledby="faq-title">
  <div class="wrap faq-grid">
    <header class="sec-head">
      ${kicker('11.1', C.faqTitle.kicker)}
      <h2 class="h2 h2-sm" id="faq-title" data-split>${heading(C.faqTitle.title)}</h2>
    </header>
    <div class="faq-list">${faq
      .map((f, i) => `<details class="qa" data-reveal${i === 0 ? ' open' : ''}><summary><span class="qa-no">Q${num(i + 1)}</span><span class="qa-q">${esc(f.q)}</span><span class="qa-icon" aria-hidden="true"></span></summary><div class="qa-a"><p>${jp(f.a)}</p></div></details>`)
      .join('')}</div>
  </div>
</section>`;
}

/* ───────────────────────── 12 TALK ───────────────────────── */
function talk(): string {
  const c = C.cta;
  return `<section class="sec talk" id="talk" data-air="ink" data-ch="9" data-rail="12" data-pin="talk" aria-labelledby="talk-title">
  <div class="talk-in">
    ${kicker('12', c.kicker)}
    <h2 class="talk-title" id="talk-title" data-split>${heading(c.title)}</h2>
    <div class="talk-link" data-talk-link aria-hidden="true">
      <span class="talk-pt" data-talk-pt="0"><b>YOU</b>${esc(c.linkFrom)}</span>
      <span class="talk-pt" data-talk-pt="1"><b>MUSIC JAPAN</b>${esc(c.linkTo)}</span>
    </div>
    <p class="talk-lead" data-reveal>${jp(c.lead)}</p>
    <div class="talk-main" data-reveal>
      ${talkButton(C.talk.partners, { sub: C.talk.sub, cls: 'btn-xxl', place: 'final' })}
      ${easeList('talk-ease')}
    </div>
    <ol class="talk-steps">${C.talk.steps.map((s) => `<li data-reveal><span>${esc(s.no)}</span><h3>${esc(s.title)}</h3><p>${jp(s.body)}</p></li>`).join('')}</ol>
    <div class="talk-others" data-reveal>
      <p class="talk-others-title">${esc(c.othersTitle)}</p>
      <ul>${c.others.map((o) => `<li><a ${ext(TIMEREX_URL)} data-talk="other" data-cursor="TALK"><span>${esc(o)}</span><span class="talk-others-go">${esc(c.pick)}${arrow('up-right')}</span></a></li>`).join('')}</ul>
      <p class="talk-mail"><a href="mailto:${EMAIL}">${esc(c.mail)}：${esc(EMAIL)}</a></p>
    </div>
  </div>
</section>`;
}

/* ───────────────────────── 全体 ───────────────────────── */
export function header(): string {
  return `<header class="hd" data-hd>
  <a class="hd-brand" href="#top" aria-label="Music Japan — このページの先頭へ">${mjMark({ id: 'hd' })}<span class="hd-name">Music Japan</span></a>
  <nav class="hd-nav" aria-label="ページ内のメニュー">${C.nav.map((n, i) => `<a href="#${n.id}" data-nav="${n.id}"><i>${num([2, 3, 4, 6, 10, 11][i])}</i><span>${esc(n.label)}</span></a>`).join('')}</nav>
  <a class="hd-talk" ${ext(TIMEREX_URL)} data-talk="header" data-magnetic data-cursor="TALK"><span class="live-dot" aria-hidden="true"></span>${esc(C.talk.button)}</a>
  <button class="hd-menu" type="button" popovertarget="menu" aria-label="メニューを開く"><span></span><span></span></button>
</header>
<div class="menu" id="menu" popover>
  <nav class="menu-nav" aria-label="メニュー">${C.nav.map((n, i) => `<a href="#${n.id}" data-menu-link><i>${num([2, 3, 4, 6, 10, 11][i])}</i>${esc(n.label)}</a>`).join('')}</nav>
  ${talkButton(C.talk.partners, { sub: C.talk.sub, place: 'menu' })}
  <button class="menu-close" type="button" popovertarget="menu" popovertargetaction="hide">閉じる</button>
</div>`;
}

function footer(): string {
  const f = C.footer;
  const line = `<span>${esc(f.marquee)}</span>${mjMark({ id: 'fm' })}`;
  return `<footer class="ft">
  <div class="ft-marquee" aria-hidden="true" data-marquee><div class="ft-track">${line.repeat(4)}</div></div>
  <div class="ft-grid">
    <div class="ft-id">${mjMark({ id: 'ft', cls: 'mj-mark ft-mark' })}<p class="ft-name">${esc(company.name)}</p><p class="ft-addr">〒${company.postal}<br>${esc(company.address)}</p></div>
    <nav class="ft-col" aria-label="${f.services}"><p>${f.services}</p><a ${ext('https://partners.music-japan.com/')}>Baton Partners</a><a ${ext('https://baton.music-japan.com/profile/')}>Baton</a><a ${ext('https://secondtake.music-japan.com/')}>SECOND TAKE</a></nav>
    <nav class="ft-col" aria-label="${f.company}"><p>${f.company}</p><a ${ext('https://music-japan.com/')}>公式サイト</a><a ${ext('https://music-japan.com/company/')}>会社概要</a><a ${ext('https://music-japan.com/profile/')}>代表プロフィール</a><a ${ext('https://music-japan.com/privacy/')}>プライバシーポリシー</a></nav>
    <div class="ft-col"><p>${f.follow}</p>${socials.map((s) => `<a ${ext(s.href)}>${socialIcon(s.name)}${esc(s.name)}</a>`).join('')}</div>
  </div>
  <div class="ft-bottom"><span>${esc(f.rights)}</span><span>COMPANIES / PEOPLE / STORIES / CONNECTIONS — OSAKA</span><a href="#top">${f.top} ↑</a></div>
</footer>`;
}

export function overlays(): string {
  return `<div class="intro" data-intro aria-hidden="true"><div class="intro-mark">${introMark()}</div><span class="intro-line"></span><p class="intro-txt"><span>COMPANIES.</span> <span>PEOPLE.</span> <span>STORIES.</span> <span>CONNECTIONS.</span></p></div>
<canvas class="webgl-world" data-world aria-hidden="true"></canvas>
<div class="world-fallback" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<nav class="rail" aria-label="ページ内の位置">${['top', 'what', 'ecosystem', 'partners', 'build', 'live', 'baton', 'second-take', 'search', 'now', 'about', 'talk']
    .map((id, i) => `<a href="#${id}" data-rail-link="${num(i + 1)}" aria-label="セクション${num(i + 1)}へ"><i></i><span>${num(i + 1)}</span></a>`)
    .join('')}</nav>
<a class="float-talk" ${ext(TIMEREX_URL)} data-float data-talk="float" data-cursor="TALK"><span class="live-dot" aria-hidden="true"></span><span class="float-txt"><b>${esc(C.talk.float)}</b><small>${esc(C.talk.floatSub)}</small></span>${arrow('up-right')}</a>
<div class="cursor" data-cursor-el aria-hidden="true"><i></i><b></b></div>`;
}

export function body(): string {
  return `${hero()}
${what()}
${ecosystem()}
${partnersIntro()}
${anatomy()}
${world()}
${after()}
${origin()}
${build()}
${live()}
${batonSection()}
${secondTake()}
${search()}
${now()}
${about()}
${faqSection()}
${talk()}`;
}

export { footer };
