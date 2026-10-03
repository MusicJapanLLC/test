import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { ctaBand, document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, botHtml, marquee, nextReads, pageHero } from '../parts';
import { breadcrumbLd, faqLd, ids, orgLd, pageLd, serviceLd } from '../seo';
import { esc, heading, jp } from '../text';

export function renderService(p: Partner, env: BuildEnv): string {
  const s = p.service;
  const path = routes.service(p.slug);

  const solutions = s.solutions
    .map(
      (x, i) => `
      <li class="sol rv">
        <p class="sol-no">0${i + 1}</p>
        <p class="sol-before"><span class="sol-tag">Before</span>${jp(x.problem)}</p>
        <span class="sol-arrow" aria-hidden="true"></span>
        <div class="sol-after">
          <p class="sol-tag sol-tag-on">${esc(x.feature)}</p>
          <p class="sol-a">${heading(x.answer)}</p>
        </div>
      </li>`,
    )
    .join('');

  const flow = s.flow
    .map(
      (f, i) => `
      <li class="flow-step rv" style="--d:${i}">
        <span class="flow-dot" aria-hidden="true"></span>
        <p class="flow-en">${esc(f.en)}</p>
        <p class="flow-stage">${esc(f.stage)}</p>
        <p class="flow-feat">${esc(f.feature)}</p>
      </li>`,
    )
    .join('');

  const features = s.features
    .map(
      (f, i) => `
      <li class="feat feat-light rv">
        <p class="feat-meta"><span>0${i + 1}</span><span>${esc(f.en)}</span></p>
        <h3 class="feat-h">${heading(f.title)}</h3>
        <p class="feat-p">${jp(f.detail)}</p>
      </li>`,
    )
    .join('');

  const stats = p.top.stats
    .map(
      (st) => `
      <div class="stat stat-sm rv">
        <p class="stat-label">${esc(st.label)}</p>
        <p class="stat-v"><span class="stat-num${/[\u3040-\u9fff]/.test(st.value) ? ' is-jp' : ''}">${esc(st.value)}</span><span class="stat-unit">${esc(st.unit)}</span></p>
        ${st.note ? `<p class="stat-note">${jp(st.note)}</p>` : ''}
      </div>`,
    )
    .join('');

  const fits = s.fits.map((f) => `<li>${jp(f)}</li>`).join('');

  const faq = p.faq
    .map(
      (f, i) => `
      <details class="faq-item"${i < 2 ? ' open' : ''}>
        <summary><span class="faq-q">Q</span><span>${jp(f.q)}</span><span class="faq-icon" aria-hidden="true"></span></summary>
        <div class="faq-a"><p>${jp(f.a)}</p></div>
      </details>`,
    )
    .join('');

  const body = `
${header(p, 'service')}
<main id="main">
  ${pageHero({
    p,
    no: '03',
    en: 'Service',
    logo: { src: s.logo, alt: s.logoAlt, size: s.logoSize },
    title: s.category,
    lead: s.description,
    phase: 1.0,
    crumbs: [{ name: shortName(p), href: routes.top(p.slug) }, { name: s.name }],
  })}

  ${answerBox(p.seo.service.answer, 'service-answer')}

  <section class="clients clients-svc" aria-labelledby="clients-h">
    <p id="clients-h" class="clients-h wrap">${jp(s.clientsNote)}</p>
    ${marquee(s.clients, { label: '利用企業', size: 'md' })}
  </section>

  <section class="sec" aria-labelledby="sol-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Before / After</p>
        <h2 id="sol-h" class="sec-h">${heading(`その悩みに、${s.name}はこう応える。`)}</h2>
      </header>
      <ol class="sols">${solutions}</ol>
    </div>
  </section>

  <section class="sec sec-tint" aria-labelledby="flow-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">${esc(s.labels.flowKicker)}</p>
        <h2 id="flow-h" class="sec-h">${heading(s.labels.flowTitle)}</h2>
      </header>
      <ol class="flow">${flow}</ol>
    </div>
  </section>

  <section class="sec" aria-labelledby="feat-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Features</p>
        <h2 id="feat-h" class="sec-h">${heading(s.labels.featuresTitle)}</h2>
      </header>
      <ul class="feats feats-light">${features}</ul>
    </div>
  </section>

  <section class="sec sec-tint" aria-labelledby="stat-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Numbers</p>
        <h2 id="stat-h" class="sec-h">${heading(s.labels.statsTitle)}</h2>
      </header>
      <div class="stats">${stats}</div>
      <p class="fine">${jp(p.top.statsNote)}</p>
    </div>
  </section>

  <section class="sec" aria-labelledby="onb-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Onboarding</p>
        <h2 id="onb-h" class="sec-h">${heading(s.labels.onboardingTitle)}</h2>
      </header>
      <ul class="stances">${s.onboarding
        .map(
          (o, i) => `
        <li class="stance rv${o.bot ? ' has-bot' : ''}" style="--d:${i}">
          ${o.bot ? botHtml(o.bot) : ''}
          <span class="stance-no">0${i + 1}</span>
          <h3 class="stance-h">${heading(o.title)}</h3>
          <p class="stance-p">${jp(o.detail)}</p>
        </li>`,
        )
        .join('')}</ul>
    </div>
  </section>

  <section class="sec sec-tint" aria-labelledby="fit-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">For you</p>
        <h2 id="fit-h" class="sec-h">${heading(s.labels.fitsTitle)}</h2>
      </header>
      <div class="rv">
        <ul class="fits">${fits}</ul>
        <p class="official">
          <a class="link-arrow" href="${s.url}" target="_blank" rel="noopener"><span>${esc(s.name)} 公式サイト</span><span class="arrow" aria-hidden="true">↗</span></a>
        </p>
      </div>
    </div>
  </section>

  <section class="sec" aria-labelledby="faq-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">FAQ</p>
        <h2 id="faq-h" class="sec-h">${heading(`${s.name}について、よくある質問`)}</h2>
      </header>
      <div class="faq rv">${faq}</div>
    </div>
  </section>

  ${nextReads(p, 'service')}

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'service',
      path,
      partner: p,
      title: p.seo.service.title,
      description: p.seo.service.description,
      og: `/og/${p.slug}-service.png`,
      jsonLd: [
        ...orgLd(env, p),
        serviceLd(env, p),
        pageLd(env, {
          path,
          name: p.seo.service.title,
          description: p.seo.service.description,
          image: `/og/${p.slug}-service.png`,
          partner: p,
          dateModified: p.seo.updated,
          mainEntity: ids.service(env, p),
        }),
        faqLd(env, path, p.faq),
        breadcrumbLd(env, path, [
          { name: shortName(p), href: routes.top(p.slug) },
          { name: s.name, href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
