import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { bpNo, breadcrumb, ctaBand, document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, marquee, nextReads } from '../parts';
import { breadcrumbLd, ids, orgLd, pageLd, serviceLd } from '../seo';
import { esc, heading, jp } from '../text';

export function renderTop(p: Partner, env: BuildEnv): string {
  const t = p.top;
  const s = p.service;
  const path = routes.top(p.slug);

  const verbs = t.verbs
    .map(
      (v, i) => `
      <article class="verb" data-verb="${i}">
        <p class="verb-no"><span>0${i + 1}</span><span class="verb-ja">${esc(v.ja)}</span></p>
        <p class="verb-en" aria-hidden="true">${esc(v.en)}.</p>
        <h3 class="verb-h">${heading(v.title)}</h3>
        <p class="verb-p">${jp(v.body)}</p>
      </article>`,
    )
    .join('');

  const problems = t.problems
    .map(
      (pr, i) => `
      <li class="issue rv">
        <span class="issue-no">0${i + 1}</span>
        <h3 class="issue-h">${heading(pr.title)}</h3>
        <p class="issue-p">${jp(pr.detail)}</p>
      </li>`,
    )
    .join('');

  const stats = t.stats
    .map(
      (st) => `
      <div class="stat rv">
        <p class="stat-label">${esc(st.label)}</p>
        <p class="stat-v"><span class="stat-num${/[\u3040-\u9fff]/.test(st.value) ? ' is-jp' : ''}">${esc(st.value)}</span><span class="stat-unit">${esc(st.unit)}</span></p>
        ${st.note ? `<p class="stat-note">${jp(st.note)}</p>` : ''}
      </div>`,
    )
    .join('');

  const features = s.features
    .map(
      (f, i) => `
      <li class="feat rv">
        <p class="feat-meta"><span>0${i + 1}</span><span>${esc(f.en)}</span></p>
        <h3 class="feat-h">${heading(f.title)}</h3>
        <p class="feat-p">${jp(f.detail)}</p>
      </li>`,
    )
    .join('');

  const body = `
${header(p, 'top')}
<main id="main">
  <section class="stage" data-stage aria-labelledby="hero-h">
    <div class="stage-sticky">
      <div class="scene" data-scene="network" data-count="3200" aria-hidden="true"><canvas></canvas></div>
      <div class="stage-shade" aria-hidden="true"></div>
      <div class="wrap stage-ui">
        <div class="hero" data-hero>
          <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>Music Japan Partners — ${bpNo(p)}<span class="kicker-co">${esc(p.company.nameEn)}</span></p>
          <h1 id="hero-h" class="hero-h">${heading(t.title)}</h1>
          <p class="hero-lead">${jp(t.lead)}</p>
          <ul class="badges">${t.badges.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          <div class="hero-actions">
            <a class="btn btn-ink" href="${routes.service(p.slug)}"><span>${s.name.length > 8 ? 'サービスを見る' : `${esc(s.name)}を見る`}</span><span class="arrow" aria-hidden="true">→</span></a>
            <a class="btn btn-line" href="${routes.contact(p.slug)}" data-cursor="Talk">話してみる</a>
          </div>
        </div>
        <div class="verbs" data-verbs>
          <h2 class="sr-only">${esc(shortName(p))}が支える3つのこと</h2>
          ${verbs}
        </div>
        <div class="stage-foot" aria-hidden="true">
          <span class="scroll-cue"><i></i>Scroll</span>
          <span class="stage-progress"><i data-progress></i></span>
          <span class="stage-step" data-step>00 / 03</span>
        </div>
      </div>
    </div>
  </section>

  <div class="wrap crumb-row">${breadcrumb([{ name: shortName(p) }])}</div>
  ${answerBox(p.seo.top.answer, 'top-answer')}

  ${marquee(t.marquee, { label: `${s.name}のキーワード` })}

  ${consoleBand(p)}

  <section class="sec sec-issue" aria-labelledby="issue-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">01 — Issue</p>
        <h2 id="issue-h" class="sec-h">${heading(t.problemsTitle)}</h2>
      </header>
      <ol class="issues">${problems}</ol>
    </div>
  </section>

  <section class="sec sec-highlight" aria-labelledby="hl-h">
    <div class="scene scene-hl" data-scene="network" data-count="900" data-phase="${p.world.scene === 'vault' ? '2.0' : '1.0'}" aria-hidden="true"><canvas></canvas></div>
    <div class="wrap hl-in">
      <header class="hl-head rv">
        <p class="kicker">02 — ${esc(t.highlight.en)}</p>
        <h2 id="hl-h" class="hl-h">${heading(t.highlight.title)}</h2>
        <p class="hl-lead">${jp(t.highlight.lead)}</p>
      </header>
      <ol class="hl-steps">${t.highlight.steps
        .map(
          (st, i) => `
        <li class="hl-step rv" style="--d:${i}">
          <span class="hl-no">0${i + 1}</span>
          <h3 class="hl-step-h">${heading(st.title)}</h3>
          <p class="hl-step-p">${jp(st.detail)}</p>
        </li>`,
        )
        .join('')}</ol>
      <p class="fine rv">${jp(t.highlight.note)}</p>
    </div>
  </section>

  <section class="sec sec-numbers" aria-labelledby="num-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">03 — Numbers</p>
        <h2 id="num-h" class="sec-h">${heading(t.numbersTitle)}</h2>
      </header>
      <div class="stats">${stats}</div>
      <p class="fine">${jp(t.statsNote)}</p>
    </div>
  </section>

  ${voicesSection(p)}

  <section class="clients" aria-labelledby="clients-h">
    <p id="clients-h" class="clients-h wrap">${jp(s.clientsNote)}</p>
    ${marquee(s.clients, { label: '利用企業', size: 'md', reverse: true })}
  </section>

  ${mediaSection(p)}

  <section class="sec sec-quote" aria-labelledby="about-teaser-h">
    <div class="wrap quote-in">
      <p class="kicker rv">04 — About</p>
      <blockquote class="quote rv${t.aboutQuoteCite ? ' quote-cited' : ''}">
        <p id="about-teaser-h" class="quote-p">${heading(t.aboutQuote)}</p>
        ${t.aboutQuoteCite ? `<p class="quote-cite">${jp(t.aboutQuoteCite)}</p>` : ''}
      </blockquote>
      <div class="quote-side rv">
        ${p.leader?.photo && p.leader.photoSize ? `<figure class="quote-leader"><img src="${p.leader.photo}" alt="" width="${p.leader.photoSize[0]}" height="${p.leader.photoSize[1]}" loading="lazy" decoding="async" /><figcaption><span>${esc(p.leader.role)}</span>${esc(p.leader.name)}</figcaption></figure>` : ''}
        <p>${jp(p.about.lead)}</p>
        <a class="link-arrow" href="${routes.about(p.slug)}"><span>${esc(shortName(p))}の取り組みを読む</span><span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>

  <section class="sec sec-ink" aria-labelledby="svc-h">
    <div class="wrap">
      <header class="svc-head rv">
        <p class="kicker kicker-light">05 — Service</p>
        <p class="logo-plate"><img src="${s.logo}" alt="${esc(s.logoAlt)}" width="${s.logoSize[0]}" height="${s.logoSize[1]}" loading="lazy" /></p>
        <h2 id="svc-h" class="sec-h sec-h-light">${heading(`${s.name}｜${s.category}`)}</h2>
        <p class="svc-lead">${jp(s.description)}</p>
      </header>
      <ul class="feats">${features}</ul>
      <a class="btn btn-paper" href="${routes.service(p.slug)}"><span>${esc(s.name)}の詳細を見る</span><span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </section>

  <section class="sec sec-insight" aria-labelledby="ins-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">06 — Insights</p>
        <h2 id="ins-h" class="sec-h">${heading('読んでから、話してみる。')}</h2>
      </header>
      <a class="cover rv" href="${routes.insight(p.slug, p.insight.slug)}">
        <span class="cover-meta"><span>${esc(p.insight.category)}</span><span>${p.insight.published.replace(/-/g, '.')}</span><span>${p.insight.readingMinutes} min read</span></span>
        <span class="cover-h">${heading(p.insight.title)}</span>
        <span class="cover-p">${jp(p.insight.description)}</span>
        <span class="link-arrow"><span>記事を読む</span><span class="arrow" aria-hidden="true">→</span></span>
      </a>
    </div>
  </section>

  ${nextReads(p, 'top')}

  ${ctaBand(p)}
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
          description: p.seo.top.description,
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

/** 引き受ける作業を、監視画面のログのように1行ずつ打ち出す帯（console の世界観）。最後の行は動き続ける */
function consoleBand(p: Partner): string {
  const c = p.top.console;
  if (!c) return '';
  return `
  <section class="console-band" aria-labelledby="console-h">
    <div class="wrap console-in">
      <header class="console-head rv">
        <p class="kicker kicker-light">${esc(p.top.verbs.map((v) => v.en).join(' / '))}</p>
        <h2 id="console-h" class="console-h">${heading(`${shortName(p)}が、まとめて引き受けること。`)}</h2>
        <p class="console-lead">${jp(p.service.description)}</p>
      </header>
      <div class="term rv" role="group" aria-label="${esc(c.label)}">
        <p class="term-bar"><span class="term-dot" aria-hidden="true"></span><span>${esc(c.label)}</span><span class="term-clock" aria-hidden="true">24/365</span></p>
        <ul class="term-list">${c.lines
          .map(
            (l, i) =>
              `<li style="--i:${i}"><span class="term-k">${esc(l.k)}</span><span class="term-v">${esc(l.v)}</span><span class="term-s${l.ok ? ' is-ok' : ' is-live'}">${l.ok ? 'OK' : 'LIVE'}</span></li>`,
          )
          .join('')}</ul>
        <p class="term-cursor" aria-hidden="true"><span>$</span><i></i></p>
      </div>
    </div>
  </section>`;
}

/** 公式サイトに載っているお客様の声（出典つき）。ない企業では何も出さない */
function voicesSection(p: Partner): string {
  const v = p.top.voices;
  if (!v) return '';
  return `
  <section class="sec sec-voices" aria-labelledby="voices-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Voices</p>
        <h2 id="voices-h" class="sec-h">${heading(v.title)}</h2>
      </header>
      <ul class="voices">${v.items
        .map(
          (it, i) => `
        <li class="voice rv" style="--d:${i}">
          <blockquote class="voice-q"><p>${jp(it.text)}</p></blockquote>
          <p class="voice-who">${esc(it.who)}</p>
        </li>`,
        )
        .join('')}</ul>
      <p class="fine">${jp(v.note)}</p>
    </div>
  </section>`;
}

/** 取材・登壇・提携。第三者の掲載と、企業自身の発表は kind で分けて見せる */
function mediaSection(p: Partner): string {
  const m = p.top.media;
  if (!m) return '';
  return `
  <section class="sec sec-media" aria-labelledby="media-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">Record</p>
        <h2 id="media-h" class="sec-h">${heading(m.title)}</h2>
      </header>
      <ol class="media rv">${m.items
        .map((it) => {
          const inner = `<span class="media-kind">${esc(it.kind)}</span><span class="media-t">${jp(it.title)}</span><span class="media-by">${esc(it.by)}${it.date ? `<span class="media-date">${esc(it.date)}</span>` : ''}</span>`;
          return `<li>${it.url ? `<a class="media-row" href="${it.url}" target="_blank" rel="noopener">${inner}<span class="ext" aria-hidden="true">↗</span></a>` : `<div class="media-row">${inner}<span class="ext" aria-hidden="true"></span></div>`}</li>`;
        })
        .join('')}</ol>
    </div>
  </section>`;
}
