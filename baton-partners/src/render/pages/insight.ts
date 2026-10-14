import { routes } from '../../config/site';
import type { Block, Partner } from '../../types';
import { breadcrumb, ctaBand, document, footer, header, shortName, type BuildEnv } from '../layout';
import { nextReads, sourcesList } from '../parts';
import { abs, breadcrumbLd, ids, orgLd, pageLd, serviceLd } from '../seo';
import { esc, heading, jp, text } from '../text';

function block(b: Block, p: Partner): string {
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
        .map((r) => `<tr><th scope="row">${jp(r[0])}</th><td>${jp(r[1])}</td></tr>`)
        .join('')}</tbody></table></div>`;
    case 'person':
      return personCard(p, b.text);
  }
}

/** この記事に登場する人。写真は正方形の顔写真（avatar）、なければトレーディングカードの写真、代表の写真の順 */
function personCard(p: Partner, note: string): string {
  const l = p.leader;
  if (!l) return '';
  const ph = l.avatar
    ? { src: l.avatar, size: [320, 320] as [number, number], focus: undefined }
    : (p.top.card?.photo ?? (l.photo && l.photoSize ? { src: l.photo, size: l.photoSize, focus: undefined } : undefined));
  const img = ph
    ? `<img class="a-person-img" src="${ph.src}" alt="${esc(p.company.name)} ${esc(l.role)} ${esc(l.name)}" width="${ph.size[0]}" height="${ph.size[1]}" loading="lazy" decoding="async"${ph.focus ? ` style="object-position:${ph.focus[0]}% ${ph.focus[1]}%"` : ''} />`
    : '';
  return `<aside class="a-person" aria-label="この記事に登場する人">
          ${img}
          <div class="a-person-body">
            <p class="a-person-k">この記事に登場する人</p>
            <p class="a-person-name"><a href="${routes.about(p.slug)}">${esc(l.name)}</a><span class="a-person-en">${esc(l.nameEn)}</span></p>
            <p class="a-person-role">${esc(p.company.name)} ${esc(l.role)}</p>
            <p class="a-person-p">${jp(note)}</p>
          </div>
        </aside>`;
}

export function renderInsight(p: Partner, env: BuildEnv): string {
  const a = p.insight;
  const path = routes.insight(p.slug, a.slug);
  const date = a.published.replace(/-/g, '.');
  const updated = p.seo.updated;
  const og = `/og/${p.slug}-insight.png`;

  const toc = a.sections
        // 目次のリンクは「番号｜見出し」の2列のグリッド。見出しは1つの要素に入れて、中の <bp-nobr>（P-ENJIN など）が別の列に分かれないように
    .map((s, i) => `<li><a href="#${s.id}"><span>${String(i + 1).padStart(2, '0')}</span><bp-tx>${jp(s.heading)}</bp-tx></a></li>`)
    .join('');

  const sections = a.sections
    .map(
      (s, i) => `
      <section class="a-sec" id="${s.id}" aria-labelledby="${s.id}-h">
        <h2 id="${s.id}-h" class="a-h2"><span class="a-h2-no">${String(i + 1).padStart(2, '0')}</span>${heading(s.heading)}</h2>
        ${s.blocks.map((b) => block(b, p)).join('\n')}
      </section>`,
    )
    .join('');

  const promo = `
    <aside class="promo">
      <p class="promo-k">${esc(shortName(p))}のサービス</p>
      <p class="promo-logo"><img src="${p.service.logo}" alt="${esc(p.service.logoAlt)}" width="${p.service.logoSize[0]}" height="${p.service.logoSize[1]}" loading="lazy" /></p>
      <p class="promo-p">${jp(p.service.category)}</p>
      <a class="btn btn-ink btn-block" href="${routes.service(p.slug)}"><span>${esc(p.service.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
      <a class="btn btn-cta btn-block" href="${routes.contact(p.slug)}">話してみる</a>
    </aside>`;

  const body = `
${header(p, 'insight')}
<main id="main" class="article-main">
  <article class="article">
    <header class="a-head">
      <div class="scene scene-sub scene-article" data-scene="network" data-count="700" data-phase="1.55" aria-hidden="true"><canvas></canvas></div>
      <div class="wrap a-head-in">
        ${breadcrumb([{ name: shortName(p), href: routes.top(p.slug) }, { name: '記事' }])}
        <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>02 — Insights<span class="kicker-co">${esc(a.category)}</span></p>
        <h1 class="a-h1">${heading(a.title)}</h1>
        <p class="a-meta">
          <span>公開 <time datetime="${a.published}">${date}</time></span>
          ${updated > a.published ? `<span>更新 <time datetime="${updated}">${updated.replace(/-/g, '.')}</time></span>` : ''}
          <span>${a.readingMinutes}分で読めます</span>
          <a href="${routes.editorial()}">Baton Partners 編集部</a>
        </p>
      </div>
    </header>

    <div class="wrap a-layout">
      <div class="a-body">
        <p class="a-lead">${jp(a.lead)}</p>
        <section class="a-keys" aria-labelledby="keys-h">
          <h2 id="keys-h" class="a-keys-h">${esc(p.seo.insightQuestion)}</h2>
          <ul>${a.keyPoints.map((k) => `<li>${jp(k)}</li>`).join('')}</ul>
        </section>
        <details class="toc toc-inline" open>
          <summary>目次</summary>
          <ol>${toc}</ol>
        </details>
        ${sections}
        <aside class="a-end">
          <p class="a-end-k">この記事を読んだ方へ</p>
          <p class="a-end-h">${heading(`まずは${p.service.name}を知る。気になったら、話してみる。`)}</p>
          <div class="a-end-actions">
            <a class="btn btn-ink" href="${routes.service(p.slug)}"><span>${esc(p.service.name)}を見る</span><span class="arrow" aria-hidden="true">→</span></a>
            <a class="btn btn-cta" href="${routes.contact(p.slug)}" data-cursor="Talk">話してみる</a>
          </div>
        </aside>
        ${sourcesList(a.sources)}
        <p class="a-credit">${jp(`この記事は[Baton Partners編集部](${routes.editorial()})が制作しています。${p.service.name}に関する記載は、${p.company.name}の公開情報にもとづきます。`)}</p>
      </div>
      <div class="a-side">
        <div class="a-side-sticky">
          <nav class="toc toc-side" aria-label="目次"><p class="toc-t">Contents</p><ol>${toc}</ol></nav>
          ${promo}
        </div>
      </div>
    </div>
  </article>

  ${nextReads(p, 'insight')}

  ${ctaBand(p)}
</main>
${footer(p)}`;

  return document(
    {
      kind: 'insight',
      path,
      partner: p,
      ogType: 'article',
      title: p.seo.insightTitle,
      description: a.description,
      og,
      ogAlt: a.title,
      jsonLd: [
        ...orgLd(env, p),
        serviceLd(env, p),
        pageLd(env, {
          path,
          name: p.seo.insightTitle,
          description: a.description,
          image: og,
          partner: p,
          dateModified: updated,
          mainEntity: ids.article(env, path),
        }),
        {
          '@type': 'Article',
          '@id': ids.article(env, path),
          headline: text(a.title),
          description: a.description,
          image: abs(env, og),
          datePublished: a.published,
          dateModified: updated,
          inLanguage: 'ja',
          articleSection: a.category,
          mainEntityOfPage: { '@id': ids.page(env, path) },
          isPartOf: { '@id': ids.page(env, path) },
          author: { '@id': ids.editorial(env) },
          publisher: { '@id': ids.operator },
          about: { '@id': ids.org(env, p) },
          // 本文に代表の名前が出てくる記事は、代表（Person）にも触れていることを書く
          mentions: [
            { '@id': ids.service(env, p) },
            ...(p.seo.org.leader && !p.operator && JSON.stringify(a).includes(p.seo.org.leader.name) ? [{ '@id': ids.founder(env, p) }] : []),
          ],
          citation: a.sources.map((s) => s.url),
        },
        breadcrumbLd(env, path, [
          { name: shortName(p), href: routes.top(p.slug) },
          { name: '記事', href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
