import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { ctaBand, document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, leaderSection, nextReads, pageHero } from '../parts';
import { breadcrumbLd, ids, orgLd, pageLd } from '../seo';
import { esc, heading, jp } from '../text';

export function renderAbout(p: Partner, env: BuildEnv): string {
  const a = p.about;
  const path = routes.about(p.slug);

  const story = a.story
    .map(
      (s, i) => `
      <article class="story rv">
        <p class="story-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
        <h3 class="story-h">${heading(s.heading)}</h3>
        <p class="story-p">${jp(s.body)}</p>
      </article>`,
    )
    .join('');

  const stance = a.stance
    .map(
      (s, i) => `
      <li class="stance rv">
        <span class="stance-no">0${i + 1}</span>
        <h3 class="stance-h">${heading(s.title)}</h3>
        <p class="stance-p">${jp(s.detail)}</p>
      </li>`,
    )
    .join('');

  const profile = p.company.profile
    .map(
      (r) => `
      <div class="prof-row">
        <dt>${esc(r.label)}</dt>
        <dd>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.value)}<span class="ext" aria-hidden="true">↗</span></a>` : jp(r.value)}</dd>
      </div>`,
    )
    .join('');

  const body = `
${header(p, 'about')}
<main id="main">
  ${pageHero({
    p,
    no: '01',
    en: 'About',
    title: a.title,
    lead: a.lead,
    phase: 0.45,
    crumbs: [{ name: shortName(p), href: routes.top(p.slug) }, { name: '取り組み' }],
  })}

  ${answerBox(p.seo.about.answer, 'about-answer')}

  <section class="sec sec-statement" aria-label="ステートメント">
    <div class="wrap statement">
      <p class="statement-p rv">${heading(p.top.aboutQuote)}</p>
      ${p.top.aboutQuoteCite ? `<p class="quote-cite rv">${jp(p.top.aboutQuoteCite)}</p>` : ''}
    </div>
  </section>

  <section class="sec" aria-labelledby="story-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">Story</p>
        <h2 id="story-h" class="sec-h">${heading(`なぜ、${shortName(p)}なのか。`)}</h2>
      </header>
      <div class="stories">${story}</div>
    </div>
  </section>

  ${leaderSection(p)}

  <section class="sec sec-tint" aria-labelledby="stance-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Stance</p>
        <h2 id="stance-h" class="sec-h">${heading(a.stanceTitle)}</h2>
      </header>
      <ul class="stances">${stance}</ul>
    </div>
  </section>

  <section class="sec" aria-labelledby="prof-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">Company</p>
        <h2 id="prof-h" class="sec-h">${heading('会社概要')}</h2>
      </header>
      <div class="rv">
        <dl class="prof">${profile}</dl>
        <div class="next-links">
          <a class="link-arrow" href="${routes.service(p.slug)}"><span>${esc(p.service.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
          <a class="link-arrow" href="${routes.insight(p.slug, p.insight.slug)}"><span>記事を読む</span><span class="arrow" aria-hidden="true">→</span></a>
        </div>
      </div>
    </div>
  </section>

  ${nextReads(p, 'about')}

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'about',
      path,
      partner: p,
      title: p.seo.about.title,
      description: p.seo.about.description,
      og: `/og/${p.slug}-about.png`,
      jsonLd: [
        ...orgLd(env, p),
        pageLd(env, {
          type: 'AboutPage',
          path,
          name: p.seo.about.title,
          description: p.seo.about.description,
          image: `/og/${p.slug}-about.png`,
          partner: p,
          dateModified: p.seo.updated,
          mainEntity: ids.org(env, p),
        }),
        breadcrumbLd(env, path, [
          { name: shortName(p), href: routes.top(p.slug) },
          { name: '取り組み', href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
