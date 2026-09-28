import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { breadcrumbLd, ctaBand, document, footer, header, orgLd, shortName, type BuildEnv } from '../layout';
import { pageHero } from '../parts';
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
      (f) => `
      <details class="faq-item">
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
        <p class="kicker">Workflow</p>
        <h2 id="flow-h" class="sec-h">${heading('集客から決定まで、ひとつの流れで。')}</h2>
      </header>
      <ol class="flow">${flow}</ol>
    </div>
  </section>

  <section class="sec" aria-labelledby="feat-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Features</p>
        <h2 id="feat-h" class="sec-h">${heading('6つの機能')}</h2>
      </header>
      <ul class="feats feats-light">${features}</ul>
    </div>
  </section>

  <section class="sec sec-tint" aria-labelledby="stat-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Numbers</p>
        <h2 id="stat-h" class="sec-h">${heading('導入の手ごたえ')}</h2>
      </header>
      <div class="stats">${stats}</div>
      <p class="fine">${jp(p.top.statsNote)}</p>
    </div>
  </section>

  <section class="sec" aria-labelledby="onb-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Onboarding</p>
        <h2 id="onb-h" class="sec-h">${heading('導入して、終わりにしない。')}</h2>
      </header>
      <ul class="stances">${s.onboarding
        .map(
          (o, i) => `
        <li class="stance rv" style="--d:${i}">
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
        <h2 id="fit-h" class="sec-h">${heading('こんな人材紹介会社に。')}</h2>
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
        <h2 id="faq-h" class="sec-h">${heading('相談の前に')}</h2>
      </header>
      <div class="faq rv">${faq}</div>
    </div>
  </section>

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'service',
      path,
      partner: p,
      title: `${s.name}｜${s.category}｜${p.company.name} - Baton Partners`,
      description: s.description,
      jsonLd: [
        ...orgLd(env, p),
        {
          '@type': 'Service',
          name: s.name,
          serviceType: s.category,
          description: s.description,
          url: s.url,
          areaServed: 'JP',
          provider: { '@id': `${env.siteUrl}${routes.top(p.slug)}#org` },
        },
        {
          '@type': 'FAQPage',
          mainEntity: p.faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        },
        breadcrumbLd(env, [
          { name: p.company.name, href: routes.top(p.slug) },
          { name: s.name, href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
