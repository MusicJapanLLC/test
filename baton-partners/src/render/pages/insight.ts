import { routes, site } from '../../config/site';
import type { Block, Partner } from '../../types';
import { breadcrumb, breadcrumbLd, ctaBand, document, footer, header, orgLd, shortName, type BuildEnv } from '../layout';
import { esc, heading, jp } from '../text';

function block(b: Block): string {
  switch (b.type) {
    case 'p':
      return `<p>${jp(b.text)}</p>`;
    case 'list':
      return `<ul class="a-list">${b.items.map((i) => `<li>${jp(i)}</li>`).join('')}</ul>`;
    case 'check':
      return `<ul class="a-check">${b.items.map((i) => `<li>${jp(i)}</li>`).join('')}</ul>`;
    case 'callout':
      return `<aside class="a-callout"><p class="a-callout-t">${esc(b.title)}</p><p>${jp(b.text)}</p></aside>`;
    case 'numbered':
      return `<ol class="a-num">${b.items
        .map((i) => `<li><h3 class="a-num-h">${heading(i.title)}</h3><p>${jp(i.detail)}</p></li>`)
        .join('')}</ol>`;
    case 'table':
      return `<div class="a-table-wrap"><table class="a-table"><thead><tr><th scope="col">${esc(b.head[0])}</th><th scope="col">${esc(b.head[1])}</th></tr></thead><tbody>${b.rows
        .map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${jp(r[1])}</td></tr>`)
        .join('')}</tbody></table></div>`;
  }
}

export function renderInsight(p: Partner, env: BuildEnv): string {
  const a = p.insight;
  const path = routes.insight(p.slug, a.slug);
  const date = a.published.replace(/-/g, '.');

  const toc = a.sections
    .map((s, i) => `<li><a href="#${s.id}"><span>${String(i + 1).padStart(2, '0')}</span>${jp(s.heading)}</a></li>`)
    .join('');

  const sections = a.sections
    .map(
      (s, i) => `
      <section class="a-sec" id="${s.id}" aria-labelledby="${s.id}-h">
        <h2 id="${s.id}-h" class="a-h2"><span class="a-h2-no">${String(i + 1).padStart(2, '0')}</span>${heading(s.heading)}</h2>
        ${s.blocks.map(block).join('\n')}
      </section>`,
    )
    .join('');

  const promo = `
    <aside class="promo">
      <p class="promo-k">${esc(shortName(p))}のサービス</p>
      <p class="promo-logo"><img src="${p.service.logo}" alt="${esc(p.service.logoAlt)}" width="${p.service.logoSize[0]}" height="${p.service.logoSize[1]}" loading="lazy" /></p>
      <p class="promo-p">${jp(p.service.category)}</p>
      <a class="btn btn-ink btn-block" href="${routes.service(p.slug)}"><span>${esc(p.service.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
      <a class="btn btn-cta btn-block" href="${routes.contact(p.slug)}">相談する</a>
    </aside>`;

  const body = `
${header(p, 'insight')}
<main id="main" class="article-main">
  <article class="article" itemscope itemtype="https://schema.org/Article">
    <header class="a-head">
      <div class="scene scene-sub scene-article" data-scene="network" data-count="700" data-phase="1.55" aria-hidden="true"><canvas></canvas></div>
      <div class="wrap a-head-in">
        ${breadcrumb([{ name: shortName(p), href: routes.top(p.slug) }, { name: '記事' }])}
        <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>02 — Insights<span class="kicker-co">${esc(a.category)}</span></p>
        <h1 class="a-h1" itemprop="headline">${heading(a.title)}</h1>
        <p class="a-meta">
          <time datetime="${a.published}" itemprop="datePublished">${date}</time>
          <span>${a.readingMinutes}分で読めます</span>
          <span>Baton Partners 編集部</span>
        </p>
      </div>
    </header>

    <div class="wrap a-layout">
      <div class="a-body" itemprop="articleBody">
        <p class="a-lead">${jp(a.lead)}</p>
        <details class="toc toc-inline" open>
          <summary>目次</summary>
          <ol>${toc}</ol>
        </details>
        ${sections}
        <aside class="a-end">
          <p class="a-end-k">この記事を読んだ方へ</p>
          <p class="a-end-h">${heading(`まずは${p.service.name}を知る。気になったら、相談する。`)}</p>
          <div class="a-end-actions">
            <a class="btn btn-ink" href="${routes.service(p.slug)}"><span>${esc(p.service.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
            <a class="btn btn-cta" href="${routes.contact(p.slug)}">相談する</a>
          </div>
        </aside>
        <p class="a-credit">${jp(`この記事はBaton Partners編集部が制作しています。${p.service.name}に関する記載は、${p.company.name}の公開情報にもとづきます。`)}</p>
      </div>
      <div class="a-side">
        <div class="a-side-sticky">
          <nav class="toc toc-side" aria-label="目次"><p class="toc-t">Contents</p><ol>${toc}</ol></nav>
          ${promo}
        </div>
      </div>
    </div>
  </article>

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'insight',
      path,
      partner: p,
      ogType: 'article',
      title: `${a.title} - Baton Partners`,
      description: a.description,
      jsonLd: [
        ...orgLd(env, p),
        {
          '@type': 'Article',
          headline: a.title,
          description: a.description,
          datePublished: a.published,
          dateModified: a.published,
          inLanguage: 'ja',
          mainEntityOfPage: `${env.siteUrl}${path}`,
          author: { '@type': 'Organization', name: 'Baton Partners 編集部' },
          publisher: { '@type': 'Organization', name: site.operator.name, url: site.operator.url },
          about: { '@id': `${env.siteUrl}${routes.top(p.slug)}#org` },
        },
        breadcrumbLd(env, [
          { name: p.company.name, href: routes.top(p.slug) },
          { name: a.title, href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
