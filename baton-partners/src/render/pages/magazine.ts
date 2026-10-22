import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { breadcrumb, document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, barcodeSvg } from '../parts';
import { breadcrumbLd, ids, orgLd, pageLd, serviceLd } from '../seo';
import { esc, heading, jp, sentences, text } from '../text';

type Magazine = NonNullable<Partner['top']['magazine']>;

/**
 * presto の世界観のトップ。1冊の雑誌『PRESTO』の誌面として組む。
 *   表紙（ヒーロー・h1） → 目次 → 特集（採用SNS） → AI研修の時間割 → 数字 → 代表のメッセージ
 *   → 仕事の一覧 → コラム（記事） → 裏表紙（話してみる）と奥付
 * 黒い表紙と黒い頁、生成りの紙の頁を交互に置く。誌面の仕掛けは本文で説明しない。出典は各頁のクレジットと奥付に。
 * 表紙の写真は WebGL で網点に刷る（client/press.ts）。WebGL がなくても、下の <img> がそのまま表紙になる。
 */
export function renderMagazine(p: Partner, env: BuildEnv): string {
  const t = p.top;
  const m = t.magazine as Magazine;
  const path = routes.top(p.slug);

  const body = `
${header(p, 'top')}
<main id="main" class="mz">
  ${cover(p, m)}
  ${contents(p, m)}
  ${recruit(p, m)}
  ${timetable(p, m)}
  ${numbers(p, m)}
  ${message(p, m)}
  ${index(p, m)}
  ${column(p, m)}
  ${back(p, m)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'top',
      path,
      partner: p,
      title: p.seo.top.title,
      description: p.seo.top.description,
      og: `/og/${p.slug}-top.png`,
      jsonLd: [
        ...orgLd(env, p),
        serviceLd(env, p),
        pageLd(env, {
          path,
          name: p.seo.top.title,
          description: text(p.seo.top.description),
          image: `/og/${p.slug}-top.png`,
          partner: p,
          dateModified: p.seo.updated,
          mainEntity: ids.org(env, p),
        }),
        breadcrumbLd(env, path, [{ name: shortName(p), href: path }]),
      ],
    },
    env,
    body,
  );
}

/** 頁の上の柱（誌名・号・頁の名前・ノンブル）。飾りなので読み上げない */
const folio = (m: Magazine, name: string, page: string) =>
  `<p class="mz-folio" aria-hidden="true"><span>${esc(m.masthead)} ${esc(m.issue)}</span><span>${esc(name)}</span><span>p.${esc(page)}</span></p>`;

const ext = (url: string, label: string, cls = 'mz-link') =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}<span aria-hidden="true"> ↗</span><span class="sr-only">（新しいタブで開きます）</span></a>`;

/** 表紙。題字・柱の見出し・大見出し（h1）・名前・バーコード */
function cover(p: Partner, m: Magazine): string {
  const c = m.cover;
  const [fx, fy] = c.focus ?? [50, 40];
  const l = p.leader;
  return `
  <section class="mz-cover" aria-labelledby="hero-h" data-mz-cover>
    <figure class="mz-cover-photo">
      <img src="${c.src}" alt="${esc(c.alt)}" width="${c.size[0]}" height="${c.size[1]}" fetchpriority="high" decoding="async" style="object-position:${fx}% ${fy}%" />
      <div class="scene mz-press" data-scene="press" data-img="${c.src}" data-focus="${fx},${fy}" data-img-size="${c.size[0]},${c.size[1]}" aria-hidden="true"><canvas></canvas></div>
    </figure>
    <div class="mz-cover-shade" aria-hidden="true"></div>
    <div class="mz-cover-in">
      <p class="mz-cover-top"><span>Baton Partners</span><span>${esc(m.issue)}</span><span>${esc(m.date)}</span></p>
      <p class="mz-mast" aria-hidden="true">${[...m.masthead].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join('')}</p>
      <p class="mz-tagline">${esc(m.tagline)}</p>
      <ul class="mz-lines">${m.coverLines
        .map((cl) => `<li><a href="${cl.href}"><span class="mz-line-k">${esc(cl.k)}</span><span class="mz-line-t">${heading(cl.t)}</span></a></li>`)
        .join('')}</ul>
      <div class="mz-cover-main">
        <h1 id="hero-h" class="mz-h1">${heading(p.top.title)}</h1>
        ${l ? `<p class="mz-cover-name">${esc(l.name)}<span>${esc(p.company.nameEn)} ${esc(l.role)}</span></p>` : ''}
      </div>
      <p class="mz-code" aria-hidden="true">${barcodeSvg(`BP-${p.no}`, 'mz-code-bars')}<b>BP—${esc(p.no.padStart(3, '0'))}</b></p>
    </div>
  </section>`;
}

/** 目次。この号の案内（リード）と、会社の一言の答え */
function contents(p: Partner, m: Magazine): string {
  return `
  <section class="mz-page mz-contents" id="contents" aria-labelledby="contents-h">
    <div class="wrap">
      ${folio(m, 'Contents', '02')}
      <div class="mz-contents-grid">
        <div class="mz-contents-head rv">
          ${breadcrumb([{ name: shortName(p) }])}
          <h2 id="contents-h" class="mz-contents-h">Contents</h2>
          <p class="mz-intro">${jp(p.top.lead)}</p>
        </div>
        <ol class="mz-toc">${m.contents
          .map(
            (c, i) => `
          <li class="rv" style="--d:${i}"><a href="${c.href}"><span class="mz-toc-p">${esc(c.page)}</span><span class="mz-toc-k">${esc(c.k)}</span><span class="mz-toc-t">${heading(c.t)}</span><span class="mz-toc-arrow" aria-hidden="true">→</span></a></li>`,
          )
          .join('')}</ol>
      </div>
    </div>
  </section>
  ${answerBox(p.seo.top.answer, 'top-answer')}`;
}

/** 特集：採用SNS。本文は2段、右の柱に応募までの流れ・業界・導入企業 */
function recruit(p: Partner, m: Magazine): string {
  const r = m.recruit;
  const [first, ...rest] = r.body;
  return `
  <article class="mz-page mz-paper mz-recruit" id="recruit" aria-labelledby="recruit-h">
    <div class="wrap">
      ${folio(m, r.kicker, r.page)}
      <header class="mz-feat-head rv">
        <p class="mz-kicker">${esc(r.kicker)}</p>
        <h2 id="recruit-h" class="mz-feat-h">${heading(r.title)}</h2>
        <p class="mz-feat-lead">${jp(r.lead)}</p>
      </header>
      <div class="mz-feat-body">
        <div class="mz-text rv">
          <p class="mz-drop">${jp(first)}</p>
          ${rest
            .slice(0, 1)
            .map((b) => `<p>${jp(b)}</p>`)
            .join('')}
          <p class="mz-pull" aria-hidden="true">${heading(r.pull)}</p>
          ${rest
            .slice(1)
            .map((b) => `<p>${jp(b)}</p>`)
            .join('')}
        </div>
        <aside class="mz-side rv" aria-label="採用SNSのデータ">
          <figure class="mz-flow">
            <figcaption class="mz-side-k">応募までの流れ</figcaption>
            <ol>${r.flow
              .map((f, i) => `<li><span class="mz-flow-n">0${i + 1}</span><span class="mz-flow-en">${esc(f.en)}</span><span class="mz-flow-t">${heading(f.t)}</span></li>`)
              .join('')}</ol>
          </figure>
          <div class="mz-side-block">
            <p class="mz-side-k">対応している業界</p>
            <ul class="mz-tags">${r.industries.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="mz-side-block">
            <p class="mz-side-k">導入企業</p>
            <ul class="mz-clients">${p.service.clients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          ${ext(r.link.url, r.link.label)}
        </aside>
      </div>
      <p class="mz-credit">${jp(r.credit)}</p>
    </div>
  </article>`;
}

/**
 * AI研修の時間割。職務とツールを選ぶと、8回の中身が入れ替わる（client/presto.ts）。
 * 入れ替わる文は、ビルド時に文節で区切った HTML を <template> に置き、JSON には番号だけを渡す
 * （スマホで「生成|AI」と割れないように。ブラウザで文字列を HTML に戻さない）
 */
function timetable(p: Partner, m: Magazine): string {
  const tt = m.timetable;
  const job = tt.jobs[0];
  const tool = tt.tools[0];
  const rows = [...(job.field ? tt.common.field : tt.common.office), ...job.parts, ...tool.parts];
  const frags: string[] = [];
  const ref = (html: string) => {
    const i = frags.indexOf(html);
    return i < 0 ? frags.push(html) - 1 : i;
  };
  const row = (s: string) => ref(heading(s));
  const data = {
    common: { office: tt.common.office.map(row), field: tt.common.field.map(row) },
    jobs: tt.jobs.map((j) => ({ name: j.name, field: j.field, parts: j.parts.map(row), outcomes: j.outcomes.map((o) => ref(jp(o))) })),
    tools: tt.tools.map((x) => ({ name: x.name, parts: x.parts.map(row) })),
  };
  const chip = (label: string, sub: string, on: boolean, attr: string) =>
    `<button type="button" class="mz-chip" aria-pressed="${on}" ${attr}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  const partOf = (i: number) => (i < 2 ? 0 : i < 5 ? 1 : 2);
  return `
  <article class="mz-page mz-ink mz-tt" id="timetable" aria-labelledby="tt-h" data-tt>
    <div class="wrap">
      ${folio(m, tt.kicker, tt.page)}
      <header class="mz-feat-head rv">
        <p class="mz-kicker">${esc(tt.kicker)}</p>
        <h2 id="tt-h" class="mz-feat-h">${heading(tt.title)}</h2>
        <p class="mz-feat-lead">${jp(tt.lead)}</p>
      </header>
      <ol class="mz-parts">${p.top.highlight.steps
        .map((s, i) => `<li class="rv" style="--d:${i}"><p class="mz-parts-k">Part ${i + 1}</p><h3 class="mz-parts-h">${esc(s.title)}</h3><p>${jp(s.detail)}</p></li>`)
        .join('')}</ol>
      <div class="mz-tt-ctrl rv">
        <div class="mz-tt-group"><p class="mz-side-k" id="tt-job">職務</p><div class="mz-chips" role="group" aria-labelledby="tt-job">${tt.jobs.map((j, i) => chip(j.name, '', i === 0, `data-job="${i}"`)).join('')}</div></div>
        <div class="mz-tt-group"><p class="mz-side-k" id="tt-tool">AI</p><div class="mz-chips" role="group" aria-labelledby="tt-tool">${tt.tools.map((x, i) => chip(x.name, x.by, i === 0, `data-tool="${i}"`)).join('')}</div></div>
        <p class="mz-tt-howto">${esc(tt.howto)}</p>
      </div>
      <div class="mz-tt-sheet rv">
        <p class="mz-tt-title" aria-live="polite"><span data-s="job">${esc(job.name)}</span><span class="mz-tt-tool"><i aria-hidden="true">×</i> <span data-s="tool">${esc(tool.name)}</span></span><small aria-hidden="true">85 min × 8 = 11h20m</small></p>
        <ol class="mz-tt-rows">${rows
          .map(
            (r, i) =>
              `<li data-part="${partOf(i)}"><span class="mz-tt-vol">Vol.${i + 1}</span><span class="mz-tt-part">${esc(tt.parts[partOf(i)])}</span><span class="mz-tt-t" data-bar="${i}">${heading(r)}</span></li>`,
          )
          .join('')}</ol>
        <div class="mz-tt-out">
          <p class="mz-side-k">受講後にできるようになること</p>
          <ul data-outcomes>${job.outcomes.map((o) => `<li>${jp(o)}</li>`).join('')}</ul>
        </div>
      </div>
      <p class="mz-credit">${jp(tt.credit)}</p>
      <a class="mz-link" href="${tt.link.url}">${esc(tt.link.label)}<span aria-hidden="true"> →</span></a>
    </div>
    <script type="application/json" data-tt-data>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
    ${frags.map((f, i) => `<template data-sf="${i}">${f}</template>`).join('')}
  </article>`;
}

/** 数字。紙の頁に、大きな数字を4つ */
function numbers(p: Partner, m: Magazine): string {
  const n = m.numbers;
  return `
  <section class="mz-page mz-paper mz-num" id="numbers" aria-labelledby="num-h">
    <div class="wrap">
      ${folio(m, n.kicker, n.page)}
      <h2 id="num-h" class="mz-num-h rv">${heading(n.title)}</h2>
      <div class="mz-stats">${p.top.stats
        .map(
          (s, i) => `
        <div class="mz-stat rv" style="--d:${i}">
          <p class="mz-stat-v"><span class="mz-stat-n">${esc(s.value)}</span><span class="mz-stat-u">${esc(s.unit)}</span></p>
          <p class="mz-stat-l">${jp(s.label)}</p>
          ${s.note ? `<p class="mz-stat-note">${jp(s.note)}</p>` : ''}
        </div>`,
        )
        .join('')}</div>
      <p class="mz-credit">${jp(p.top.statsNote)}</p>
    </div>
  </section>`;
}

/** 代表のメッセージ。左に写真、右に引用（公式サイトの原文） */
function message(p: Partner, m: Magazine): string {
  const g = m.message;
  const l = p.leader;
  const [fx, fy] = g.photo.focus ?? [50, 30];
  return `
  <article class="mz-page mz-ink mz-msg" id="message" aria-labelledby="msg-h">
    <div class="wrap">
      ${folio(m, g.kicker, g.page)}
      <div class="mz-msg-grid">
        <figure class="mz-msg-photo rv">
          <img src="${g.photo.src}" alt="${esc(p.company.name)} ${esc(l?.role ?? '')} ${esc(l?.name ?? '')}さん" width="${g.photo.size[0]}" height="${g.photo.size[1]}" loading="lazy" decoding="async" style="object-position:${fx}% ${fy}%" />
          <figcaption>${esc(l?.name ?? '')}さん。写真はBE.PRESTO提供</figcaption>
        </figure>
        <div class="mz-msg-body">
          <p class="mz-kicker rv">${esc(g.kicker)}</p>
          <h2 id="msg-h" class="mz-msg-h rv">${heading(g.title)}</h2>
          <p class="mz-msg-intro rv">${jp(g.intro)}</p>
          ${g.quotes.map((q) => `<blockquote class="mz-quote rv"><p>${jp(q)}</p></blockquote>`).join('')}
          <p class="mz-msg-after rv">${jp(g.after)}</p>
          <dl class="mz-facts rv">${g.facts
            .map((f) => `<div><dt>${esc(f.k)}</dt><dd>${f.url ? ext(f.url, f.v, 'mz-inline') : esc(f.v)}</dd></div>`)
            .join('')}</dl>
          <ul class="mz-values rv" aria-label="BE.PRESTOのバリュー">${g.values.map((v) => `<li><b>${esc(v.name)}</b><span>${esc(v.text)}</span></li>`).join('')}</ul>
          <a class="mz-link" href="${routes.about(p.slug)}">${esc(shortName(p))}の取り組みを読む<span aria-hidden="true"> →</span></a>
          <p class="mz-credit">${jp(g.credit)}</p>
        </div>
      </div>
    </div>
  </article>`;
}

/** BE.PRESTO の仕事の一覧（top.verbs）と、それぞれの公式サイト */
function index(p: Partner, m: Magazine): string {
  const x = m.index;
  return `
  <section class="mz-page mz-paper mz-index" id="index" aria-labelledby="idx-h">
    <div class="wrap">
      ${folio(m, x.kicker, x.page)}
      <h2 id="idx-h" class="mz-feat-h rv">${heading(x.title)}</h2>
      <ol class="mz-idx">${p.top.verbs
        .map(
          (v, i) => `
        <li class="rv" style="--d:${i}">
          <p class="mz-idx-no">0${i + 1}</p>
          <div class="mz-idx-body">
            <p class="mz-idx-en">${esc(v.en)}<span>${esc(v.ja)}</span></p>
            <h3 class="mz-idx-h">${heading(v.title)}</h3>
            <p>${jp(v.body)}</p>
            <p class="mz-idx-links">${(x.links[i] ?? []).map((k) => ext(k.url, k.label, 'mz-inline')).join('')}${
              i === 1 ? `<a class="mz-inline" href="${routes.service(p.slug)}">AI研修のページ<span aria-hidden="true"> →</span></a>` : ''
            }</p>
          </div>
        </li>`,
        )
        .join('')}</ol>
    </div>
  </section>`;
}

/** コラム（この企業の記事） */
function column(p: Partner, m: Magazine): string {
  const a = p.insight;
  // 記事の題は「問い。副題」の形が多い。問いを見出しに、残りを小さな袖見出しにする
  const [main, ...rest] = sentences(a.title);
  const dek = rest.join('');
  return `
  <section class="mz-page mz-ink mz-col" id="column" aria-labelledby="col-h">
    <div class="wrap">
      ${folio(m, m.column.kicker, m.column.page)}
      <a class="mz-col-card rv" href="${routes.insight(p.slug, a.slug)}">
        <span class="mz-kicker">${esc(m.column.kicker)} — ${esc(a.category)}</span>
        <h2 id="col-h" class="mz-col-h">${heading(main)}${dek ? `<span class="mz-col-dek">${jp(dek)}</span>` : ''}</h2>
        <span class="mz-col-p">${jp(a.description)}</span>
        <span class="mz-col-meta"><span>${a.published.replace(/-/g, '.')}</span><span>${a.readingMinutes} min read</span><span class="mz-col-go">記事を読む<span aria-hidden="true"> →</span></span></span>
      </a>
    </div>
  </section>`;
}

/** 裏表紙：話してみる。下に奥付 */
function back(p: Partner, m: Magazine): string {
  const b = m.back;
  const c = m.colophon;
  return `
  <section class="mz-back" id="talk" aria-labelledby="talk-h">
    <div class="wrap">
      ${folio(m, 'Talk', b.page)}
      <div class="mz-back-main rv">
        <h2 id="talk-h" class="mz-back-h">${heading(b.title)}</h2>
        <p class="mz-back-p">${jp(b.body)}</p>
        <div class="mz-back-actions">
          <a class="btn btn-cta" href="${routes.contact(p.slug)}" data-cursor="Talk"><span>話してみる</span><span class="arrow" aria-hidden="true">→</span></a>
          <a class="btn btn-line" href="${routes.service(p.slug)}">AI研修を見る</a>
        </div>
      </div>
      <div class="mz-colophon rv">
        <p class="mz-colophon-mast" aria-hidden="true">${esc(m.masthead)}<span>${esc(m.issue)}</span></p>
        <dl>${c.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${r.url ? ext(r.url, r.v, 'mz-inline') : esc(r.v)}</dd></div>`).join('')}</dl>
        <p class="mz-colophon-note">${jp(c.note)}</p>
        <p class="mz-code" aria-hidden="true">${barcodeSvg(`BP-${p.no}`, 'mz-code-bars')}<b>BP—${esc(p.no.padStart(3, '0'))}</b></p>
      </div>
    </div>
  </section>`;
}
