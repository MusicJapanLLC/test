import { routes } from '../../config/site';
import type { Partner } from '../../types';
import {
  breadcrumbLd,
  ctaBand,
  document,
  footer,
  header,
  orgLd,
  shortName,
  type BuildEnv,
} from '../layout';
import { marquee } from '../parts';
import { esc, heading, jp, plain } from '../text';

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
          <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>Baton Partners — No.${p.no}<span class="kicker-co">${esc(p.company.nameEn)}</span></p>
          <h1 id="hero-h" class="hero-h">${heading(t.title)}</h1>
          <p class="hero-lead">${jp(t.lead)}</p>
          <ul class="badges">${t.badges.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          <div class="hero-actions">
            <a class="btn btn-ink" href="${routes.service(p.slug)}"><span>${esc(s.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
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

  ${marquee(['Collect', 'Connect', 'Decide', s.name, 'CRM', 'MA', 'LINE', 'AI Matching', 'AI Workflow', 'Dashboard'], { label: `${s.name}の機能` })}

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
    <div class="scene scene-hl" data-scene="network" data-count="900" data-phase="1.0" aria-hidden="true"><canvas></canvas></div>
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
        <h2 id="num-h" class="sec-h">${heading(`数字で見る、${s.name}の手ごたえ。`)}</h2>
      </header>
      <div class="stats">${stats}</div>
      <p class="fine">${jp(t.statsNote)}</p>
    </div>
  </section>

  <section class="clients" aria-labelledby="clients-h">
    <p id="clients-h" class="clients-h wrap">${jp(s.clientsNote)}</p>
    ${marquee(s.clients, { label: '利用企業', size: 'md', reverse: true })}
  </section>

  <section class="sec sec-quote" aria-labelledby="about-teaser-h">
    <div class="wrap quote-in">
      <p class="kicker rv">04 — About</p>
      <blockquote class="quote rv">
        <p id="about-teaser-h" class="quote-p">${heading(t.aboutQuote)}</p>
      </blockquote>
      <div class="quote-side rv">
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

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'top',
      path,
      partner: p,
      title: `${p.company.name}｜${s.name} ${s.category} - Baton Partners`,
      description: p.top.lead,
      jsonLd: [
        ...orgLd(env, p),
        {
          '@type': 'WebPage',
          name: plain(t.title),
          url: `${env.siteUrl}${path}`,
          about: { '@id': `${env.siteUrl}${path}#org` },
          publisher: { '@id': `${env.siteUrl}/#operator` },
          inLanguage: 'ja',
        },
        breadcrumbLd(env, [{ name: p.company.name, href: path }]),
      ],
    },
    env,
    body,
  );
}
