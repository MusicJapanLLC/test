import { routes } from '../../config/site';
import type { Partner } from '../../types';
import { bpNo, breadcrumb, ctaBand, document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, discHtml, marquee, nextReads } from '../parts';
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
        <p class="verb-no"><span>${p.world.theme === 'needle' ? `A${i + 1}` : `0${i + 1}`}</span><span class="verb-ja">${esc(v.ja)}</span></p>
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
      ${p.world.theme === 'orbit' ? orbitHeroExtras(p) : ''}
      <div class="wrap stage-ui">
        ${t.deck ? `<p class="hero-deck" aria-hidden="true">${t.deck.map((l) => `<span>${esc(l)}</span>`).join('')}</p>` : ''}
        <div class="hero" data-hero>
          <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>Music Japan Partners — ${bpNo(p)}<span class="kicker-co">${esc(p.company.nameEn)}</span></p>
          ${t.display ? `<p class="hero-display" aria-hidden="true">${t.display.map((l) => `<span>${esc(l)}</span>`).join('')}</p>` : ''}
          <h1 id="hero-h" class="hero-h">${heading(t.title)}</h1>
          <p class="hero-lead">${jp(t.lead)}</p>
          ${tickerBlock(p)}
          ${activityBlock(p)}
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
        ${waybillBlock(p)}
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

  ${marketSection(p)}

  ${inviteSection(p)}

  ${tracklistSection(p)}

  ${serpSection(p)}

  ${channelsSection(p)}

  ${terminalSection(p)}

  ${boardSection(p)}

  ${tuneSection(p)}

  ${cutoverSection(p)}

  <section class="sec sec-highlight" aria-labelledby="hl-h">
    ${p.world.theme === 'needle' ? discHtml('lp-hl') : `<div class="scene scene-hl" data-scene="network" data-count="900" data-phase="${p.world.scene === 'vault' || p.world.scene === 'en' || p.world.scene === 'feed' ? '2.0' : p.world.scene === 'pair' ? '0.0' : '1.0'}"${p.world.scene === 'pair' ? ' data-sleep="1"' : ''} aria-hidden="true"><canvas></canvas></div>`}
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

  ${planetsSection(p)}

  ${lockerSection(p)}

  ${filmSection(p)}

  ${cardSection(p)}

  ${storySection(p)}

  ${casesSection(p)}

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

  ${teamSection(p)}

  ${eventsSection(p)}

  ${radarSection(p)}

  ${voicesSection(p)}

  ${crateSection(p)}

  <section class="clients" aria-labelledby="clients-h">
    <p id="clients-h" class="clients-h wrap">${jp(s.clientsNote)}</p>
    ${marquee(s.clients, { label: p.operator ? 'ページの裏側で使っているもの' : '利用企業', size: 'md', reverse: true })}
  </section>

  ${partnerLogosSection(p)}

  ${spotlightSection(p)}

  ${productSection(p)}

  ${founderSection(p)}

  ${profileSection(p)}

  ${mediaSection(p)}

  ${missionSection(p)}

  ${absoluteSection(p)}

  ${cheerSection(p)}

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

/** 図の番号。minka は「其の一」、needle はレコードの曲番号「A1」、ほかは「01」 */
function seq(p: Partner, i: number): string {
  if (p.world.theme === 'minka') return `其の${['一', '二', '三', '四', '五'][i] ?? i + 1}`;
  if (p.world.theme === 'needle') return `${i < 2 ? 'A' : 'B'}${(i % 2) + 1}`;
  return String(i + 1).padStart(2, '0');
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ja-JP') : String(n));

/** 導入事例：数字を棒・順位のはしご・前後の比較で見せる（minka などで使う。データがない企業では出さない） */
function casesSection(p: Partner): string {
  const c = p.top.cases;
  if (!c) return '';
  const metric = (m: NonNullable<Partner['top']['cases']>['items'][number]['metrics'][number]) => {
    if (m.kind === 'rank' && m.from !== undefined) {
      const top = 1;
      const bottom = Math.ceil(m.from + 1);
      const pos = (v: number) => ((v - top) / (bottom - top)) * 100;
      return `
          <div class="cm cm-rank">
            <p class="cm-label">${esc(m.label)}</p>
            <p class="cm-v"><span class="cm-from">${m.from}<small>位</small></span><span class="cm-arrow" aria-hidden="true">→</span><span class="cm-num">${m.value}</span><small>位</small></p>
            <div class="rank-ladder" aria-hidden="true" style="--from:${pos(m.from)}%;--to:${pos(m.value)}%">
              ${Array.from({ length: bottom - top + 1 }, (_, i) => `<span class="rung"><i>${top + i}</i></span>`).join('')}
              <b class="rank-dot"></b>
            </div>
          </div>`;
    }
    if (m.kind === 'ratio') {
      const pct = Math.min(100, (100 / m.value) * 100);
      return `
          <div class="cm cm-ratio">
            <p class="cm-label">${esc(m.label)}</p>
            <p class="cm-v"><span class="cm-num">${fmt(m.value)}</span><small>${esc(m.unit ?? '%')}</small></p>
            <div class="vs" aria-hidden="true">
              <span class="vs-bar vs-before" style="--w:${pct}%"><i>前 100</i></span>
              <span class="vs-bar vs-after" style="--w:100%"><i>後 ${fmt(m.value)}</i></span>
            </div>
          </div>`;
    }
    if (m.kind === 'count') {
      return `
          <div class="cm cm-count">
            <p class="cm-label">${esc(m.label)}</p>
            <p class="cm-v"><span class="cm-num">${fmt(m.value)}</span><small>${esc(m.unit ?? '')}</small></p>
          </div>`;
    }
    return `
          <div class="cm cm-up">
            <p class="cm-label">${esc(m.label)}</p>
            <p class="cm-v"><span class="cm-plus">＋</span><span class="cm-num">${fmt(m.value)}</span><small>${esc(m.unit ?? '%')}</small></p>
            <div class="vs" aria-hidden="true">
              <span class="vs-bar vs-before" style="--w:${(100 / (100 + m.value)) * 100}%"><i>前年</i></span>
              <span class="vs-bar vs-after" style="--w:100%"><i>今年</i></span>
            </div>
          </div>`;
  };
  const items = c.items
    .map((it, idx) => {
      const max = it.bars ? Math.max(...it.bars.items.map((b) => b.value)) : 1;
      return `
      <article class="case rv" style="--d:${idx}">
        <header class="case-head">
          <p class="case-no" aria-hidden="true">${seq(p, idx)}</p>
          <p class="case-co"><span>${esc(it.industry)}</span>${esc(it.company)}</p>
          <h3 class="case-h">${heading(it.headline)}</h3>
          <p class="case-period">${esc(it.period)}</p>
        </header>
        <div class="case-metrics">${it.metrics.map(metric).join('')}</div>
        ${
          it.bars
            ? `<figure class="case-bars">
          <figcaption>${esc(it.bars.title)}</figcaption>
          <ul>${it.bars.items
            .map(
              (b, i) =>
                `<li style="--w:${(b.value / max) * 100}%;--i:${i}"><span class="cb-l">${esc(b.label)}</span><span class="cb-bar"><i></i></span><span class="cb-v">＋${fmt(b.value)}%</span></li>`,
            )
            .join('')}</ul>
        </figure>`
            : ''
        }
        <div class="case-did">
          <p class="case-did-t">やったこと</p>
          <ul>${it.did.map((d) => `<li>${jp(d)}</li>`).join('')}</ul>
          <a class="link-arrow" href="${it.url}" target="_blank" rel="noopener"><span>公式の事例を読む</span><span class="arrow" aria-hidden="true">↗</span></a>
        </div>
      </article>`;
    })
    .join('');
  return `
  <section class="sec sec-cases" aria-labelledby="cases-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Cases</p>
        <h2 id="cases-h" class="sec-h">${heading(c.title)}</h2>
      </header>
      <div class="cases">${items}</div>
      <p class="fine">${jp(c.note)}</p>
    </div>
  </section>`;
}

/** 検索結果の画面に、どの施策がどこで効くかを重ねた図（イメージ図） */
function serpSection(p: Partner): string {
  const s = p.top.serp;
  if (!s) return '';
  const row = (r: NonNullable<Partner['top']['serp']>['rows'][number], i: number) => {
    const body =
      r.kind === 'ai'
        ? `<span class="sr-ai-t">✦ AIによる概要</span><span class="skl w90"></span><span class="skl w75"></span><span class="skl w60"></span><span class="sr-cite"><i></i><i></i><i></i></span>`
        : r.kind === 'ad'
          ? `<span class="sr-tag">スポンサー</span><span class="skl t w55"></span><span class="skl w80"></span>`
          : r.kind === 'map'
            ? `<span class="sr-pins" aria-hidden="true"><i style="--x:22%;--y:38%"></i><i style="--x:58%;--y:62%"></i><i style="--x:76%;--y:30%"></i></span><span class="skl t w45"></span><span class="skl w70"></span>`
            : `<span class="sr-url">example.co.jp › service</span><span class="skl t w65"></span><span class="skl w85"></span><span class="skl w50"></span>`;
    return `
        <li class="sr sr-${r.kind}" style="--i:${i}">
          <div class="sr-box">${body}</div>
          <div class="sr-note"><span class="sr-seal">${seq(p, i)}</span><p class="sr-label">${esc(r.label)}</p><p class="sr-service">${esc(r.service)}</p><p class="sr-p">${jp(r.note)}</p></div>
        </li>`;
  };
  return `
  <section class="sec sec-serp" aria-labelledby="serp-h">
    <div class="wrap serp-in">
      <header class="serp-head rv">
        <p class="kicker">Search</p>
        <h2 id="serp-h" class="sec-h">${heading(s.title)}</h2>
        <p class="serp-lead">${jp(s.lead)}</p>
      </header>
      <figure class="serp rv" aria-label="検索結果の画面と施策の対応（イメージ図）">
        <p class="serp-bar"><span class="serp-q">${esc(s.query)}</span><span class="serp-caret" aria-hidden="true"></span><span class="serp-btn" aria-hidden="true">⌕</span></p>
        <ol class="serp-rows">${s.rows.map(row).join('')}</ol>
        <figcaption class="fine">${jp(s.note)}</figcaption>
      </figure>
    </div>
  </section>`;
}

/** 自社開発のプロダクトと受賞。受賞は公表された部門名のまま、判子の形で */
function productSection(p: Partner): string {
  const pr = p.top.product;
  if (!pr) return '';
  return `
  <section class="sec sec-product" aria-labelledby="product-h">
    <div class="wrap product-in">
      <div class="product-body rv">
        <p class="kicker">Product</p>
        <h2 id="product-h" class="product-h">${esc(pr.name)}</h2>
        <p class="product-lead">${jp(pr.lead)}</p>
        <ul class="product-feats">${pr.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      </div>
      <div class="awards rv">${pr.awards
        .map(
          (a) => `
        <div class="award">
          <p class="award-t">${esc(a.title)}</p>
          <ul class="award-seals">${a.items.map((it, i) => `<li style="--i:${i}"><span>${esc(it)}</span></li>`).join('')}</ul>
        </div>`,
        )
        .join('')}
        <p class="fine">${jp(pr.note)}</p>
      </div>
    </div>
  </section>`;
}

/** 経営理念：縦書きの見出しと大きな一文字、価値観は木札にして吊るす */
function missionSection(p: Partner): string {
  const m = p.top.mission;
  if (!m) return '';
  return `
  <section class="sec sec-mission" aria-labelledby="mission-h">
    <p class="mission-glyph" aria-hidden="true">${esc(m.glyph)}</p>
    <div class="wrap mission-in">
      <h2 id="mission-h" class="mission-h rv">${esc(m.title)}</h2>
      <div class="mission-body rv">
        <p class="kicker">Mission</p>
        <p class="mission-p">${jp(m.body)}</p>
        <ul class="fuda" aria-label="Value">${m.values.map((v, i) => `<li style="--i:${i}"><span>${esc(v)}</span></li>`).join('')}</ul>
        <p class="fine">${jp(m.note)}</p>
      </div>
    </div>
  </section>`;
}

/**
 * レコードの曲目リスト（needle の世界観）。左にジャケットと盤、右に A面・B面の曲。
 * スクロールに合わせて「再生中」の曲が進む（client/tracklist.ts）。押した曲を再生中にもできる。
 * 動きを減らす設定・JSなしでは、全曲の説明が開いた一覧として読める。
 */
function tracklistSection(p: Partner): string {
  const r = p.top.tracklist;
  if (!r) return '';
  const tracks = r.tracks
    .map(
      (tr, i) => `
          <li class="track" data-track="${i}">
            <button class="track-row" type="button" aria-controls="track-${i}">
              <span class="tr-no">${esc(tr.no)}</span>
              <span class="tr-name">${esc(tr.name)}</span>
              <span class="tr-meta">${esc(tr.meta)}</span>
              <span class="tr-bar" aria-hidden="true"><i></i></span>
            </button>
            <div class="tr-detail" id="track-${i}">
              <h3 class="tr-h">${heading(tr.title)}</h3>
              <p class="tr-p">${jp(tr.body)}</p>
            </div>
          </li>`,
    )
    .join('');
  return `
  <section class="sec sec-tracks" aria-labelledby="tracks-h" data-tracklist>
    <div class="wrap">
      <header class="tracks-head rv">
        <p class="kicker">Tracklist — Side A / Side B</p>
        <h2 id="tracks-h" class="tracks-h">${heading(r.title)}</h2>
        <p class="tracks-lead">${jp(r.lead)}</p>
      </header>
      <div class="player rv">
        <div class="player-art" aria-hidden="true">
          <span class="player-disc"><img src="/partners/music-japan/mark.svg" alt="" width="64" height="64" /></span>
          <span class="jacket">
            <span class="jacket-top"><b>BP-000</b>BATON PARTNERS</span>
            <img class="jacket-mark" src="/partners/music-japan/mark.svg" alt="" width="64" height="64" />
            <span class="jacket-t">${esc(r.jacket.title)}</span>
            <span class="jacket-s">${esc(r.jacket.sub)}</span>
          </span>
        </div>
        <div class="player-body">
          <p class="player-now"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Now Playing</span><b data-now>${esc(r.tracks[0]?.no ?? '')}</b></p>
          <ol class="tracks">${tracks}</ol>
        </div>
      </div>
      <p class="fine rv">${jp(r.note)}</p>
    </div>
  </section>`;
}

/** ジャケット写真の棚（公式サイトのジャケット）。2周ぶん並べて、ゆっくり流す */
function crateSection(p: Partner): string {
  const c = p.top.crate;
  if (!c) return '';
  const imgs = c.items.map((src) => `<img src="${src}" alt="" width="320" height="320" loading="lazy" decoding="async" />`).join('');
  return `
  <section class="crate" aria-label="${esc(c.label)}">
    <div class="crate-track" aria-hidden="true"><div class="crate-run">${imgs}</div><div class="crate-run">${imgs}</div></div>
    <a class="crate-link" href="${c.href}" target="_blank" rel="noopener"><span>${esc(c.label)}</span><span class="arrow" aria-hidden="true">↗</span></a>
  </section>`;
}

/** 外部メディアの紹介（スコアボード風）。数字と掲載企業は、そのメディアの公表情報だけ */
function spotlightSection(p: Partner): string {
  const m = p.top.spotlight;
  if (!m) return '';
  return `
  <section class="sec sec-spot" aria-labelledby="spot-h">
    <div class="wrap spot-in">
      <header class="spot-head rv">
        <p class="kicker kicker-light">${esc(m.kicker)}</p>
        <h2 id="spot-h" class="spot-h">${heading(m.title)}</h2>
        <p class="spot-lead">${jp(m.lead)}</p>
        <a class="link-arrow spot-link" href="${m.url}" target="_blank" rel="noopener"><span>${esc(m.name)}を見る</span><span class="arrow" aria-hidden="true">↗</span></a>
      </header>
      <div class="board rv" role="group" aria-label="${esc(m.name)}について">
        <p class="board-bar"><span class="board-dot" aria-hidden="true"></span><span>${esc(m.name)}</span><span class="board-live" aria-hidden="true">ON AIR</span></p>
        <dl class="board-facts">${m.facts
          .map((f) => `<div class="board-fact"><dt>${esc(f.label)}</dt><dd><span class="board-num">${esc(f.value)}</span><span class="board-unit">${esc(f.unit)}</span></dd></div>`)
          .join('')}</dl>
        <div class="board-q">
          <p class="board-t">${esc(m.questionsTitle)}</p>
          <ol>${m.questions.map((q) => `<li>「${esc(q)}」</li>`).join('')}</ol>
        </div>
        <div class="board-names">
          <p class="board-t">${esc(m.namesTitle)}</p>
          <ul>${m.names.map((n) => `<li><strong>${esc(n.name)}</strong><span>${esc(n.detail)}</span></li>`).join('')}</ul>
        </div>
      </div>
      <p class="fine fine-light rv">${jp(m.note)}</p>
    </div>
  </section>`;
}

/** 掲載中のパートナー企業を、レコードのジャケットとして並べる（公式サイトのパートナー欄と同じ見せ方） */
function partnerLogosSection(p: Partner): string {
  const l = p.top.partnerLogos;
  if (!l) return '';
  const items = l.items
    .map((it, i) => {
      const inner = `
          <span class="sleeve-art">
            <span class="sleeve-top"><b>${esc(it.no)}</b><span>BATON PARTNERS</span></span>
            <img src="${it.logo.src}" alt="${esc(it.name)}" width="${it.logo.size[0]}" height="${it.logo.size[1]}" loading="lazy" decoding="async" />
          </span>
          <span class="sleeve-vinyl" aria-hidden="true"><i></i></span>
          <span class="sleeve-body">
            <span class="sleeve-name">${esc(it.name)}</span>
            <span class="sleeve-status">${esc(it.status ?? 'ページを見る')}${it.href ? '<span class="arrow" aria-hidden="true">→</span>' : ''}</span>
          </span>`;
      return `<li class="sleeve rv" style="--tint:${it.tint};--d:${i}">${it.href ? `<a class="sleeve-in" href="${it.href}">${inner}</a>` : `<div class="sleeve-in">${inner}</div>`}</li>`;
    })
    .join('');
  return `
  <section class="sec sec-pl" aria-labelledby="pl-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Partners</p>
        <h2 id="pl-h" class="sec-h">${heading(l.title)}</h2>
      </header>
      <p class="pl-lead rv">${jp(l.lead)}</p>
      <ul class="sleeves">${items}</ul>
      <p class="fine">${jp(l.note)}</p>
    </div>
  </section>`;
}

/** ヒーローの「よく届く相談」。吹き出しが1つずつ入れ替わる（動きを減らす設定では、4つとも並べて見せる） */
function tickerBlock(p: Partner): string {
  const tk = p.top.ticker;
  if (!tk) return '';
  return `
          <div class="ticker" role="group" aria-label="${esc(tk.label)}" style="--n:${tk.items.length}">
            <p class="ticker-k"><span class="ticker-dot" aria-hidden="true"></span>${esc(tk.label)}</p>
            <ul class="ticker-list">${tk.items.map((it, i) => `<li style="--i:${i}"><span class="ticker-b">${esc(it)}</span></li>`).join('')}</ul>
          </div>`;
}

/** 画面ごとの小さな見本（HTMLとCSSだけで描く。実際のアプリの画面ではない） */
function screen(kind: NonNullable<Partner['top']['channels']>['items'][number]['kind']): string {
  switch (kind) {
    case 'reel':
      return `<div class="dev dev-reel"><span class="sc-top">Reels</span><span class="sc-icons"><i></i><i></i><i></i></span><span class="sc-cap"><b></b><b></b></span><span class="sc-prog"><i></i></span></div>`;
    case 'video':
      return `<div class="dev dev-video"><span class="sc-thumb"><b></b><b></b><span class="sc-play"></span><span class="sc-time">12:04</span><span class="sc-prog"><i></i></span></span><span class="sc-meta"><i></i><b></b><b></b></span></div>`;
    case 'influencer':
      return `<div class="dev dev-post"><span class="sc-user"><i></i><b></b><em>PR</em></span><span class="sc-photo"></span><span class="sc-acts"><i></i><i></i><i></i></span><span class="sc-cap"><b></b><b></b></span></div>`;
    case 'line':
      return `<div class="dev dev-line"><span class="sc-bar"><i></i><b></b></span><span class="sc-msg sc-in"></span><span class="sc-msg sc-in sc-short"></span><span class="sc-coupon"><b>COUPON</b></span><span class="sc-menu"><i></i><i></i><i></i><i></i><i></i><i></i></span></div>`;
    default:
      return `<div class="dev dev-ai"><span class="sc-q"></span><span class="sc-spark">✦</span><span class="sc-lines"><b></b><b></b><b></b><b></b></span><span class="sc-src"><i></i><i></i><i></i></span></div>`;
  }
}

/** お客さんが会社に出会う画面と、そこで効く施策（studio の世界観。データがない企業では出さない） */
function channelsSection(p: Partner): string {
  const c = p.top.channels;
  if (!c) return '';
  return `
  <section class="sec sec-channels" aria-labelledby="chn-title">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Screens</p>
        <h2 id="chn-title" class="sec-h">${heading(c.title)}</h2>
      </header>
      <p class="chn-lead rv">${jp(c.lead)}</p>
      <ol class="chns">${c.items
        .map(
          (it, i) => `
        <li class="chn chn-${it.kind} rv" style="--d:${i}">
          <figure class="chn-fig" aria-hidden="true">${screen(it.kind)}</figure>
          <div class="chn-note">
            <p class="chn-no">0${i + 1}<span>${esc(it.label)}</span></p>
            <h3 class="chn-h">${heading(it.service)}</h3>
            <p class="chn-p">${jp(it.note)}</p>
          </div>
        </li>`,
        )
        .join('')}</ol>
      <p class="fine">${jp(c.note)}</p>
    </div>
  </section>`;
}

/** 代表の横長の写真を、カメラのファインダー越しに見せる。横に会社の歩み */
function filmSection(p: Partner): string {
  const f = p.top.film;
  if (!f) return '';
  const [fx, fy] = f.photo.focus;
  return `
  <section class="sec sec-film" aria-labelledby="film-h">
    <figure class="film-frame rv">
      <picture>
        <source media="(max-width: 767px)" srcset="${f.photo.small}" />
        <img src="${f.photo.src}" alt="${esc(f.photo.alt)}" width="${f.photo.size[0]}" height="${f.photo.size[1]}" loading="lazy" decoding="async" style="object-position:${fx}% ${fy}%" />
      </picture>
      <div class="vf" aria-hidden="true" style="--fx:${fx}%;--fy:${fy}%">
        <span class="vf-c vf-tl"></span><span class="vf-c vf-tr"></span><span class="vf-c vf-bl"></span><span class="vf-c vf-br"></span>
        <span class="vf-rec"><i></i>REC</span>
        <span class="vf-tc" data-timecode>00:00:00:00</span>
        <span class="vf-af"><i>AF</i></span>
        <span class="vf-meta">1/250　F2.8　ISO 100</span>
        <span class="vf-bat"><i></i><i></i><i></i></span>
      </div>
      <figcaption class="film-cap">${esc(f.caption)}</figcaption>
    </figure>
    <div class="wrap film-in">
      <header class="film-head rv">
        <p class="kicker">${esc(f.kicker)}</p>
        <h2 id="film-h" class="sec-h">${heading(f.title)}</h2>
      </header>
      <div class="film-body rv">${f.body.map((b) => `<p>${jp(b)}</p>`).join('')}</div>
      <ol class="film-tl rv" aria-label="${esc(shortName(p))}の歩み">${f.timeline
        .map((t, i) => `<li style="--i:${i}"><span class="ftl-y">${esc(t.year)}</span><span class="ftl-t">${jp(t.text)}</span></li>`)
        .join('')}</ol>
    </div>
  </section>`;
}

/** ヒーローの通知（match の世界観）。システムの通知が下から積み上がる（イメージ）。動きを減らす設定では3つを並べて止める */
function activityBlock(p: Partner): string {
  const a = p.top.activity;
  if (!a) return '';
  return `
          <div class="act" role="group" aria-label="${esc(a.label)}（${esc(a.note)}）" style="--n:${a.items.length}">
            <p class="act-k"><span class="act-dot" aria-hidden="true"></span>${esc(a.label)}<span class="act-note">${esc(a.note)}</span></p>
            <ul class="act-list">${a.items
              .map(
                (it, i) =>
                  `<li style="--i:${i}"><span class="act-card"><span class="act-tag">${esc(it.tag)}</span><span class="act-t">${esc(it.text)}</span><span class="act-m">${esc(it.meta)}</span></span></li>`,
              )
              .join('')}</ul>
          </div>`;
}

/** 市場の数字を100個の点で（match の世界観では、点はロゴの三角） */
function marketSection(p: Partner): string {
  const m = p.top.market;
  if (!m) return '';
  const dots = Array.from({ length: 100 }, (_, i) => `<li${i < m.share ? ' class="on"' : ''} style="--i:${i}"></li>`).join('');
  return `
  <section class="sec sec-market" aria-labelledby="market-h">
    <div class="wrap mk-in">
      <header class="mk-head rv">
        <p class="kicker">Market</p>
        <h2 id="market-h" class="sec-h">${heading(m.title)}</h2>
        <p class="mk-lead">${jp(m.lead)}</p>
        <dl class="mk-facts">${m.facts
          .map((f) => `<div class="mk-fact"><dt>${jp(f.label)}</dt><dd><span class="mk-fv">${esc(f.value)}</span><span class="mk-fu">${esc(f.unit)}</span></dd>${f.note ? `<dd class="mk-fn">${jp(f.note)}</dd>` : ''}</div>`)
          .join('')}</dl>
      </header>
      <figure class="mk-fig rv" aria-label="${esc(m.big.label)}：${esc(m.shareLabel)}が約${m.share}%">
        <p class="mk-big"><span class="mk-label">${esc(m.big.label)}</span><span class="mk-num">${esc(m.big.value)}</span><span class="mk-unit">${esc(m.big.unit)}</span></p>
        <ol class="mk-dots" aria-hidden="true">${dots}</ol>
        <figcaption class="mk-legend"><span class="mk-key is-on"><i aria-hidden="true"></i>${esc(m.shareLabel)}<b>約${m.share}%</b></span><span class="mk-key"><i aria-hidden="true"></i>${esc(m.restLabel)}</span></figcaption>
      </figure>
      <p class="fine mk-note rv">${jp(m.note)}</p>
    </div>
  </section>`;
}

/** 選考ボード（イメージ図）。眠っている列のカードが、通知で目を覚ます */
function boardSection(p: Partner): string {
  const b = p.top.board;
  if (!b) return '';
  const col = (i: number) => b.cards.filter((c) => c.col === i);
  const card = (c: { name: string; meta: string; tag?: string }, extra = '') =>
    `<li class="pc${extra}"><span class="pc-av" aria-hidden="true">${esc(c.name.slice(0, 1))}</span><span class="pc-n">${esc(c.name)}</span><span class="pc-m">${esc(c.meta)}</span>${c.tag ? `<span class="pc-tag">${esc(c.tag)}</span>` : ''}</li>`;
  const cols = b.columns
    .map(
      (c, i) => `
          <div class="pipe-col${i === b.columns.length - 1 ? ' is-win' : ''}" style="--c:${i}">
            <p class="pipe-h"><span>${esc(c.name)}</span><small>${esc(c.en)}</small><b>${col(i).length + (i === b.backTo ? 1 : 0)}</b></p>
            <ul>${i === b.backTo ? card({ name: b.sleepers[0].name, meta: b.sleepers[0].meta, tag: '返信あり' }, ' is-back') : ''}${col(i)
              .map((c, k) => card(c, i === b.columns.length - 1 && k === 0 ? ' is-new' : ''))
              .join('')}</ul>
          </div>`,
    )
    .join('');
  return `
  <section class="sec sec-board" aria-labelledby="board-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Pipeline</p>
        <h2 id="board-h" class="sec-h">${heading(b.title)}</h2>
      </header>
      <p class="board-lead rv">${jp(b.lead)}</p>
      <figure class="pipe rv" aria-label="選考ボード（イメージ図）">
        <p class="pipe-bar" aria-hidden="true"><span class="pipe-mark"><i></i><i></i></span><span class="pipe-app">選考ボード</span><span class="pipe-q"></span><span class="pipe-me"></span></p>
        <div class="pipe-scroll" tabindex="0" aria-label="ボードを横にスクロール">
          <div class="pipe-cols">
            <div class="pipe-col pipe-sleep">
              <p class="pipe-h"><span>${esc(b.sleep.name)}</span><small>${esc(b.sleep.en)}</small><b>${b.sleepers.length}</b></p>
              <ul>${b.sleepers
                .map(
                  (s, i) =>
                    `<li class="pc is-sleep${i === 0 ? ' is-waking' : ''}"><span class="pc-av" aria-hidden="true">${esc(s.name.slice(0, 1))}</span><span class="pc-n">${esc(s.name)}</span><span class="pc-m">${esc(s.meta)}</span><span class="pc-days">最後の連絡から${s.days}日</span>${i === 0 ? '<span class="pc-ping" aria-hidden="true">LINE</span>' : ''}</li>`,
                )
                .join('')}</ul>
            </div>${cols}
          </div>
        </div>
        <figcaption class="fine">${jp(b.note)}</figcaption>
      </figure>
      <ol class="pipe-notes">${b.callouts
        .map(
          (c, i) => `
        <li class="pn rv" style="--d:${i}">
          <p class="pn-k"><span>${seq(p, i)}</span>${esc(c.label)}</p>
          <h3 class="pn-h">${heading(c.title)}</h3>
          <p class="pn-p">${jp(c.text)}</p>
        </li>`,
        )
        .join('')}</ol>
    </div>
  </section>`;
}

/** 導入事例を、取材記事のように1社深く。引用は公開された記事の原文のまま */
function storySection(p: Partner): string {
  const s = p.top.story;
  if (!s) return '';
  const demo = s.demo
    ? `
          <div class="ar" aria-hidden="true">
            <p class="ar-bar"><span class="ar-k">${esc(s.demo.label)}</span><span class="ar-time"><i></i><b>${s.demo.seconds}</b>秒</span></p>
            <div class="ar-in">
              <ul class="ar-files">${s.demo.files.map((f, i) => `<li style="--i:${i}"><span class="ar-doc"></span>${esc(f)}</li>`).join('')}</ul>
              <span class="ar-flow"><i></i></span>
              <ul class="ar-fields">${s.demo.fields.map((f, i) => `<li style="--i:${i}"><span>${esc(f)}</span><b></b></li>`).join('')}</ul>
            </div>
            <p class="ar-done"><i></i>登録しました</p>
          </div>`
    : '';
  return `
  <section class="sec sec-story" aria-labelledby="cs-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Case Study</p>
        <h2 id="cs-h" class="sec-h">${heading(s.title)}</h2>
      </header>
      <article class="cs rv">
        <div class="cs-main">
          <p class="cs-co"><span class="cs-ind">${esc(s.industry)}</span><strong>${esc(s.company)}</strong></p>
          <blockquote class="cs-pull">
            <p>${jp(s.pull)}</p>
            <footer>${esc(s.who)}</footer>
          </blockquote>
          <p class="cs-profile">${jp(s.profile)}</p>
          ${demo}
        </div>
        <dl class="cs-rows">${s.rows
          .map((r, i) => `<div class="cs-row" style="--i:${i}"><dt>${esc(r.label)}</dt><dd><ul>${r.items.map((it) => `<li>${jp(it)}</li>`).join('')}</ul></dd></div>`)
          .join('')}</dl>
      </article>
      <ol class="cs-quotes">${s.quotes
        .map(
          (q, i) => `
        <li class="csq rv" style="--d:${i}">
          <blockquote><p>${jp(q.text)}</p></blockquote>
          <p class="csq-c">${jp(q.context)}</p>
        </li>`,
        )
        .join('')}</ol>
      <p class="cs-src rv"><a class="link-arrow" href="${s.url}" target="_blank" rel="noopener"><span>公式の導入事例を読む</span><span class="arrow" aria-hidden="true">↗</span></a><span>${s.interviewer ? `${esc(s.interviewer)}・` : ''}${esc(s.date)}</span></p>
      <p class="fine">${jp(s.note)}</p>
    </div>
  </section>`;
}

/** 代表の歩みを大きく（写真があれば写真、なければ名刺）。年表は横に流れる段階として */
function founderSection(p: Partner): string {
  const f = p.top.founder;
  const l = p.leader;
  if (!f || !l) return '';
  const visual =
    l.photo && l.photoSize
      ? `<figure class="fd-photo">
          <img src="${l.photo}" alt="${esc(l.role)} ${esc(l.name)}" width="${l.photoSize[0]}" height="${l.photoSize[1]}" loading="lazy" decoding="async" />
          <span class="fd-marks" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <figcaption><span>${esc(l.role)}</span>${esc(l.name)}</figcaption>
        </figure>`
      : `<div class="fd-card" aria-hidden="true">
          <span class="fd-card-mark"><i></i><i></i></span>
          <span class="fd-card-role">${esc(l.role)}</span>
          <span class="fd-card-name">${esc(l.name)}</span>
          <span class="fd-card-en">${esc(l.nameEn)}</span>
          <span class="fd-card-co">${esc(p.company.name)}</span>
        </div>`;
  return `
  <section class="sec sec-founder" aria-labelledby="fd-h">
    <div class="wrap fd-in">
      <div class="fd-visual rv">${visual}</div>
      <div class="fd-body rv">
        <p class="kicker">${esc(f.kicker)}</p>
        <h2 id="fd-h" class="sec-h">${heading(f.title)}</h2>
        <p class="fd-name"><span>${esc(l.role)}</span>${esc(l.name)}</p>
        <div class="fd-text">${l.body.map((b) => `<p>${jp(b)}</p>`).join('')}</div>
        ${f.quote ? `<blockquote class="fd-quote"><p>${jp(f.quote.text)}</p><cite>${esc(f.quote.cite)}</cite></blockquote>` : ''}
        ${f.partner ? `<div class="fd-partner"><p class="fd-pr">${esc(f.partner.role)}</p><p class="fd-pn">${esc(f.partner.name)}</p><p class="fd-pp">${jp(f.partner.body)}</p></div>` : ''}
        ${f.links ? `<p class="fd-links">${f.links.map((k) => `<a class="link-arrow" href="${k.url}" target="_blank" rel="noopener"><span>${esc(k.label)}</span><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</p>` : ''}
      </div>
    </div>
    ${
      l.timeline?.length
        ? `<div class="wrap"><ol class="fd-tl rv" aria-label="${esc(l.name)}さんの歩み">${l.timeline
            .map((t, i) => `<li style="--i:${i}"><span class="fdt-y">${esc(t.year)}</span><span class="fdt-t">${jp(t.text)}</span></li>`)
            .join('')}</ol></div>`
        : ''
    }
  </section>`;
}

/** 端末の画面で、AIに頼む様子を1行ずつ（イメージ） */
function terminalSection(p: Partner): string {
  const t = p.top.terminal;
  if (!t) return '';
  const who = { you: 'あなた', ai: 'AI', ok: '完了', ask: '確認' } as const;
  return `
  <section class="sec sec-term" aria-labelledby="term-h">
    <div class="wrap tm-in">
      <header class="tm-head rv">
        <p class="kicker">Hands-on</p>
        <h2 id="term-h" class="sec-h">${heading(t.title)}</h2>
        <p class="tm-lead">${jp(t.lead)}</p>
        <ol class="tm-points">${t.points
          .map((pt, i) => `<li><span class="tm-pno">${seq(p, i)}</span><h3 class="tm-ph">${heading(pt.title)}</h3><p class="tm-pp">${jp(pt.detail)}</p></li>`)
          .join('')}</ol>
      </header>
      <figure class="tm rv" aria-label="AIに頼む様子（イメージ）">
        <p class="tm-bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(t.file)}</span></p>
        <ol class="tm-lines">${t.lines
          .map((l, i) => `<li class="tm-${l.who}" style="--i:${i}"><span class="tm-who">${who[l.who]}</span><span class="tm-t">${esc(l.text)}</span></li>`)
          .join('')}</ol>
        <p class="tm-cursor" aria-hidden="true"><span>›</span><i></i></p>
        <figcaption class="fine">${jp(t.note)}</figcaption>
      </figure>
    </div>
  </section>`;
}

/** 拠点を中心にした同心円の地図（方角は実際の地理、距離は輪の段） */
function radarSection(p: Partner): string {
  const r = p.top.radar;
  if (!r) return '';
  const n = r.rings.length;
  return `
  <section class="sec sec-radar" aria-labelledby="radar-h">
    <div class="wrap rd-in">
      <header class="rd-head rv">
        <p class="kicker">Central</p>
        <h2 id="radar-h" class="sec-h">${heading(r.title)}</h2>
        <p class="rd-lead">${jp(r.lead)}</p>
        <ul class="rd-list">${r.points
          .filter((pt) => pt.event)
          .map((pt) => `<li><b>${esc(pt.name)}</b><span>${jp(pt.event ?? '')}</span></li>`)
          .join('')}</ul>
      </header>
      <figure class="rd rv" aria-label="${esc(r.center.name)}を中心にした地図（イメージ図）">
        <div class="rd-map" aria-hidden="true">
          ${r.rings.map((label, i) => `<span class="rd-ring" style="--k:${(i + 1) / n}"><i>${esc(label)}</i></span>`).join('')}
          <span class="rd-sweep"></span>
          <span class="rd-axis rd-x"></span><span class="rd-axis rd-y"></span>
          <span class="rd-n">N</span>
          ${r.points
            .filter((pt) => pt.ring >= 0)
            .map(
              (pt, i) =>
                `<span class="rd-pt${pt.event ? ' is-ev' : ''}" style="--a:${pt.bearing}deg;--k:${(pt.ring + 0.62) / n};--i:${i}"><span class="rd-pt-in"><i></i><b>${esc(pt.name)}</b><small>${esc(pt.sub)}</small></span></span>`,
            )
            .join('')}
          <span class="rd-center"><i></i><b>${esc(r.center.name)}</b><small>${esc(r.center.sub)}</small></span>
        </div>
        <figcaption class="fine">${jp(r.note)}</figcaption>
      </figure>
    </div>
  </section>`;
}

/** イベントの小さな絵（HTMLとCSSだけ） */
function eventArt(kind: NonNullable<Partner['top']['events']>['items'][number]['art']): string {
  switch (kind) {
    case 'ledger':
      return `<span class="ea-sheet">${Array.from({ length: 15 }, (_, i) => `<i${[4, 7, 11].includes(i) ? ' class="hl"' : ''}></i>`).join('')}</span><span class="ea-check"></span>`;
    case 'shield':
      return `<span class="ea-shield"></span><span class="ea-doc"><i></i><i></i><i></i></span>`;
    case 'office':
      return `<span class="ea-apps">${['O', 'T', 'W', 'X', 'P'].map((c) => `<i>${c}</i>`).join('')}</span><span class="ea-count">20</span>`;
    case 'hall':
      return `<span class="ea-stage"></span><span class="ea-seats">${Array.from({ length: 30 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
    case 'cheers':
      return `<span class="ea-net">${Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
    // orbit の世界観（ZETTAICHI など）：交流会とゲームの絵
    case 'summit':
      return `<span class="ea-spot"></span><span class="ea-podium"></span><span class="ea-crowd">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
    case 'grill':
      return `<span class="ea-smoke"><i></i><i></i><i></i></span><span class="ea-grill"><i></i><i></i><i></i></span><span class="ea-legs"></span>`;
    case 'mystery':
      return `<span class="ea-card"><b>?</b></span><span class="ea-card ea-card-2"><b>!</b></span><span class="ea-lens"></span>`;
    case 'wolf':
      return `<span class="ea-moon"></span><span class="ea-eyes"><i></i><i></i></span><span class="ea-votes">${Array.from({ length: 5 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
    case 'pad':
      return `<span class="ea-pad"><i class="ea-dpad"></i><i class="ea-btn"></i><i class="ea-btn ea-btn-2"></i></span><span class="ea-bomb"></span>`;
    default:
      return `<span class="ea-term"><i></i><i></i><i></i><b></b></span>`;
  }
}

/** 登壇・主催・共催・伴走の記録。チケットのようなカード */
function eventsSection(p: Partner): string {
  const e = p.top.events;
  if (!e) return '';
  return `
  <section class="sec sec-events" aria-labelledby="ev-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Live record</p>
        <h2 id="ev-h" class="sec-h">${heading(e.title)}</h2>
      </header>
      <p class="ev-lead rv">${jp(e.lead)}</p>
      <ol class="evs">${e.items
        .map(
          (it, i) => `
        <li class="ev rv" style="--d:${i % 3}">
          <article class="ev-in">
            <div class="ev-art ev-art-${it.art}" aria-hidden="true">${eventArt(it.art)}</div>
            <div class="ev-body">
              <p class="ev-meta"><span class="ev-date">${esc(it.date)}</span><span class="ev-kind">${esc(it.kind)}</span></p>
              <h3 class="ev-h">${heading(it.title)}</h3>
              <p class="ev-host">${esc(it.host)}</p>
              <p class="ev-p">${jp(it.body)}</p>
              ${it.figure ? `<p class="ev-fig"><b>${esc(it.figure.value)}</b><small>${esc(it.figure.unit)}</small><span>${esc(it.figure.label)}</span></p>` : ''}
              ${it.url ? `<a class="ev-link" href="${it.url}" target="_blank" rel="noopener"><span>告知を見る</span><span aria-hidden="true">↗</span></a>` : ''}
            </div>
            <span class="ev-stub" aria-hidden="true"><b>No.${String(i + 1).padStart(2, '0')}</b></span>
          </article>
        </li>`,
        )
        .join('')}</ol>
      <p class="fine">${jp(e.note)}</p>
    </div>
  </section>`;
}


/* ─────────────────────────────────────────────
   cheer の世界観（Presence など）の部品：招待状・トレーディングカード・応援ボタン
   ───────────────────────────────────────────── */

/** 尖った頂点が上下にくる六角形（亀甲）の頂点。中心 (cx, cy)、外接円の半径 r */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** 四つの角をもつ星（✦）。ロゴのカメがまとう星にならう */
function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return `M${cx} ${cy - r}C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/**
 * 亀甲の甲羅（半径 rings の六角形の集まり）。中心から外へ順番をつけ、data-cell に入れる（応援ボタンが一つずつ灯す）。
 * 作るのは六角形の集まりと星だけ。会社のロゴ（カメ）は描かない
 */
function shellSvg(opts: { rings: number; size: number; className: string; stars?: boolean }): { svg: string; cells: number } {
  const { rings, size } = opts;
  const cells: { x: number; y: number; d: number; a: number }[] = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const x = size * Math.sqrt(3) * (q + r / 2);
      const y = size * 1.5 * r;
      cells.push({ x, y, d: Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)), a: Math.atan2(y, x) });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.a - b.a);
  const w = size * Math.sqrt(3) * (rings * 2 + 1) + size;
  const h = size * (rings * 3 + 2) + size;
  const body = cells
    .map(
      (c, i) => `<g class="cell" data-cell="${i}" style="--i:${i};--d:${c.d}"><polygon points="${hexPoints(c.x, c.y, size * 0.93)}" />${
        opts.stars === false ? '' : `<path class="cell-star" d="${sparklePath(c.x, c.y, size * 0.42)}" />`
      }</g>`,
    )
    .join('');
  return {
    svg: `<svg class="${opts.className}" viewBox="${(-w / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" aria-hidden="true" focusable="false">${body}</svg>`,
    cells: cells.length,
  };
}

/** 招待状。表は経営者のコミュニティ、裏はもう一つの会。横に、判子を押された名刺 */
function inviteSection(p: Partner): string {
  const v = p.top.invite;
  if (!v) return '';
  const emblem = shellSvg({ rings: 1, size: 22, className: 'iv-emblem' }).svg;
  const face = (side: 'front' | 'back', f: { name: string; sub: string; line: string }) => `
          <span class="iv-face iv-${side}" aria-hidden="true">
            <span class="iv-main">
              <span class="iv-top"><span class="iv-serial">${esc(v.card.serial)}</span><span class="iv-bp">${bpNo(p)}</span></span>
              ${emblem}
              <span class="iv-sub">${esc(f.sub)}</span>
              <span class="iv-name">${esc(f.name)}</span>
              <span class="iv-line">${esc(f.line)}</span>
              <span class="iv-host">Hosted by ${esc(p.company.nameEn)}</span>
            </span>
            <span class="iv-stub"><span>Admit one</span><span class="iv-stub-star">${'✦'}</span><span>${side === 'front' ? 'Side A' : 'Side B'}</span></span>
          </span>`;
  return `
  <section class="sec sec-invite" aria-labelledby="invite-h">
    <div class="wrap iv-in">
      <header class="iv-head rv">
        <p class="kicker">${esc(v.kicker)}</p>
        <h2 id="invite-h" class="sec-h">${heading(v.title)}</h2>
        <p class="iv-lead">${jp(v.lead)}</p>
      </header>
      <div class="iv-stage rv">
        <div class="iv-meishi" aria-hidden="true">
          <span class="iv-m-co">${esc(p.company.nameEn)} Co., Ltd.</span>
          <span class="iv-m-title">代表取締役</span>
          <span class="iv-m-name">名刺 太郎</span>
          <span class="iv-m-lines"><i></i><i></i><i></i></span>
          <span class="iv-stamp"><span>${esc(v.stamp)}</span></span>
        </div>
        <button class="iv-card" type="button" data-flip aria-pressed="false" aria-label="招待状を裏返す（表：${esc(v.card.name)}、裏：${esc(v.card.back.name)}）">
          <span class="iv-card-in">${face('front', v.card)}${face('back', v.card.back)}</span>
        </button>
        <p class="iv-hint" aria-hidden="true">Tap to flip ↻</p>
      </div>
      <ol class="iv-rules">${v.rules
        .map(
          (r, i) => `
        <li class="iv-rule rv" style="--i:${i}">
          <span class="iv-no">${esc(r.no)}</span>
          <h3 class="iv-rule-h">${heading(r.title)}</h3>
          <p class="iv-rule-p">${jp(r.text)}</p>
        </li>`,
        )
        .join('')}</ol>
      <p class="fine rv">${jp(v.note)}</p>
    </div>
  </section>`;
}

/** 代表のトレーディングカード。表は写真（なければ写真待ちの面）、裏は公開プロフィール。押すと返る */
function cardSection(p: Partner): string {
  const c = p.top.card;
  const l = p.leader;
  if (!c || !l) return '';
  const initials = l.nameEn
    .split(/\s+/)
    .map((w) => w[0])
    .join('');
  const ph = c.photo ?? (l.photo && l.photoSize ? { src: l.photo, size: l.photoSize, focus: undefined } : undefined);
  const photo = ph
      ? `<img src="${ph.src}" alt="" width="${ph.size[0]}" height="${ph.size[1]}" loading="lazy" decoding="async"${ph.focus ? ` style="object-position:${ph.focus[0]}% ${ph.focus[1]}%"` : ''} />`
      : `<span class="tc-pending">${shellSvg({ rings: 3, size: 16, className: 'tc-hex', stars: false }).svg}<span class="tc-mono">${esc(initials)}</span><span class="tc-soon">${esc(c.pending)}</span></span>`;
  return `
  <section class="sec sec-card" aria-labelledby="card-h">
    <div class="wrap tc-in">
      <div class="tc-stage rv">
        <button class="tc" type="button" data-flip data-tilt aria-pressed="false" aria-label="${esc(l.name)}さんのカードを裏返す">
          <span class="tc-card">
            <span class="tc-face tc-front" aria-hidden="true">
              <span class="tc-top"><span class="tc-team">${esc(c.team)}</span><span class="tc-no">${bpNo(p)}</span></span>
              <span class="tc-photo">${photo}</span>
              <span class="tc-plate">
                <span class="tc-pos">${esc(c.position)}</span>
                <span class="tc-name">${esc(l.name)}</span>
                <span class="tc-en">${esc(l.nameEn)}</span>
              </span>
              <span class="tc-tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>
              <span class="tc-holo"></span>
            </span>
            <span class="tc-face tc-back" aria-hidden="true">
              <span class="tc-back-top"><span>Profile</span><span>${esc(c.team)}</span></span>
              <span class="tc-back-name">${esc(l.nameEn)}</span>
              <span class="tc-rows">${c.back.map((r) => `<span class="tc-row"><span class="tc-k">${esc(r.label)}</span><span class="tc-v">${esc(r.value)}</span></span>`).join('')}</span>
              ${l.motto ? `<span class="tc-motto"><span>${esc(l.motto.label)}</span>${esc(l.motto.text)}</span>` : ''}
            </span>
          </span>
        </button>
        <p class="tc-hint" aria-hidden="true">Tap to flip ↻</p>
      </div>
      <div class="tc-body rv">
        <p class="kicker">${esc(c.kicker)}</p>
        <h2 id="card-h" class="sec-h">${heading(c.title)}</h2>
        <p class="tc-lead">${jp(c.lead)}</p>
        <dl class="tc-list">${c.back.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${jp(r.value)}</dd></div>`).join('')}</dl>
        <p class="fine">${jp(c.note)}</p>
      </div>
    </div>
  </section>`;
}

/** 応援ボタン。押すたびに甲羅の星が一つずつ灯る（client/cheer.ts）。回数はこの端末の中だけ */
function cheerSection(p: Partner): string {
  const c = p.top.cheer;
  if (!c) return '';
  const shell = shellSvg({ rings: 2, size: 30, className: 'ch-shell' });
  return `
  <section class="sec sec-cheer" aria-labelledby="cheer-h">
    <div class="wrap ch-in">
      <div class="ch-body rv">
        <p class="kicker">${esc(c.kicker)}</p>
        <h2 id="cheer-h" class="sec-h">${heading(c.title)}</h2>
        <p class="ch-lead">${jp(c.lead)}</p>
        <p class="fine">${jp(c.note)}</p>
        ${c.link ? `<a class="link-arrow" href="${c.link.url}" target="_blank" rel="noopener"><span>${esc(c.link.label)}</span><span class="arrow" aria-hidden="true">↗</span></a>` : ''}
      </div>
      <div class="ch-stage rv" data-cheer data-cells="${shell.cells}" data-key="bp-cheer-${p.slug}">
        <div class="ch-glow" aria-hidden="true"></div>
        ${shell.svg}
        <button class="ch-btn" type="button" data-cheer-btn><span class="ch-btn-ring" aria-hidden="true"></span><span class="ch-btn-t">${esc(c.button)}</span></button>
        <p class="ch-count" aria-live="polite"><span class="ch-num" data-cheer-count>0</span><span class="ch-unit">回の応援</span></p>
        <p class="ch-done" data-cheer-done>${esc(c.done)}</p>
        <div class="ch-fx" data-cheer-fx aria-hidden="true"></div>
      </div>
    </div>
  </section>`;
}

/** チームの写真。ステッカーとテープで留めた大きな写真と、短い本文（cheer の世界観） */
function teamSection(p: Partner): string {
  const t = p.top.team;
  if (!t) return '';
  const [fx, fy] = t.photo.focus ?? [50, 40];
  return `
  <section class="sec sec-team" aria-labelledby="team-h">
    <div class="wrap tm-in">
      <figure class="tm-photo rv">
        <span class="tm-tape tm-tape-a" aria-hidden="true"></span><span class="tm-tape tm-tape-b" aria-hidden="true"></span>
        <picture>
          <source media="(max-width: 767px)" srcset="${t.photo.small}" />
          <img src="${t.photo.src}" alt="${esc(t.photo.alt)}" width="${t.photo.size[0]}" height="${t.photo.size[1]}" loading="lazy" decoding="async" style="object-position:${fx}% ${fy}%" />
        </picture>
        <span class="tm-star" aria-hidden="true"></span>
        <figcaption class="tm-cap">${esc(t.caption)}</figcaption>
      </figure>
      <div class="tm-body rv">
        <p class="kicker">${esc(t.kicker)}</p>
        <h2 id="team-h" class="sec-h">${heading(t.title)}</h2>
        ${t.body.map((b) => `<p class="tm-p">${jp(b)}</p>`).join('')}
        <ul class="tm-tags">${t.tags.map((g, i) => `<li style="--i:${i}">${esc(g)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
}


/* ─────────────────────────────────────────────
   orbit の世界観（ZETTAICHI / n1a など）の部品：
   人柄の五角形を重ねる図・3つの惑星・プロフィールカード・絶対値の数直線
   ───────────────────────────────────────────── */

/** 五角形の頂点（上から時計回り）。v は 0〜100、r は 100 のときの半径 */
function pentagon(v: number[], r = 100): string {
  return v
    .map((x, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / v.length;
      const k = (Math.max(0, Math.min(100, x)) / 100) * r;
      return `${(Math.cos(a) * k).toFixed(1)},${(Math.sin(a) * k).toFixed(1)}`;
    })
    .join(' ');
}

/**
 * 2人の Big Five を五角形で描いて重ねる（イメージ）。水色とピンクの重なった所（2つの五角形の共通部分）は、n1a のロゴと同じ藍色。
 * 組み合わせのボタンで切り替え、五角形は client/orbit.ts がなめらかに形を変える。JSなしでは最初の組み合わせだけ
 */
function tuneSection(p: Partner): string {
  const t = p.top.tune;
  if (!t) return '';
  const first = t.pairs[0];
  const n = t.axes.length;
  const grid = [20, 40, 60, 80, 100].map((r) => `<polygon points="${pentagon(Array(n).fill(100), r)}" />`).join('');
  const axes = t.axes
    .map((_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      return `<line x1="0" y1="0" x2="${(Math.cos(a) * 100).toFixed(1)}" y2="${(Math.sin(a) * 100).toFixed(1)}" />`;
    })
    .join('');
  const labels = t.axes
    .map((label, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      const x = Math.cos(a) * 122;
      const y = Math.sin(a) * 118 + 5;
      const anchor = Math.abs(x) < 8 ? 'middle' : x > 0 ? 'start' : 'end';
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(label)}</text>`;
    })
    .join('');
  const data = esc(JSON.stringify(t.pairs.map((pr) => ({ a: pr.a, b: pr.b, topic: pr.topic }))));
  return `
  <section class="sec sec-tune" aria-labelledby="tune-h">
    <div class="wrap tune-in">
      <header class="tune-head rv">
        <p class="kicker">${esc(t.kicker)}</p>
        <h2 id="tune-h" class="sec-h">${heading(t.title)}</h2>
        <p class="tune-lead">${jp(t.lead)}</p>
        <div class="tune-tabs" role="group" aria-label="2人の組み合わせを選ぶ">${t.pairs
          .map(
            (pr, i) =>
              `<button type="button" class="tune-tab" data-tune-pick="${i}" aria-pressed="${i === 0}"><span class="tt-no">0${i + 1}</span><span class="tt-l">${esc(pr.label)}</span></button>`,
          )
          .join('')}</div>
      </header>
      <figure class="tune-fig rv" data-tune data-pairs="${data}">
        <div class="tune-chart">
          <svg viewBox="-170 -140 340 282" role="img" aria-label="Big Fiveの5つの軸で描いた2人の人柄を、重ねたイメージ図">
            <g class="tn-grid">${grid}</g>
            <g class="tn-axes">${axes}</g>
            <defs><clipPath id="tn-clip-b"><polygon data-tune-poly="b" points="${pentagon(first.b.v)}" /></clipPath></defs>
            <g class="tn-shapes">
              <polygon class="tn-a" data-tune-poly="a" points="${pentagon(first.a.v)}" />
              <polygon class="tn-b" data-tune-poly="b" points="${pentagon(first.b.v)}" />
              <polygon class="tn-m" data-tune-poly="a" points="${pentagon(first.a.v)}" clip-path="url(#tn-clip-b)" />
            </g>
            <g class="tn-labels">${labels}</g>
          </svg>
        </div>
        <figcaption class="tune-legend">
          <span class="tl tl-a"><i aria-hidden="true"></i><b data-tune-role="a">${esc(first.a.role)}</b></span>
          <span class="tl tl-b"><i aria-hidden="true"></i><b data-tune-role="b">${esc(first.b.role)}</b></span>
          <span class="tl tl-m"><i aria-hidden="true"></i><b>重なり</b></span>
        </figcaption>
        <div class="tune-chat">
          <p class="tq-k">話すと盛り上がりそうなテーマ（例）</p>
          <p class="tq-b" aria-live="polite"><span class="tq-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="tq-t" data-tune-topic>${esc(first.topic)}</span></p>
        </div>
      </figure>
    </div>
    <p class="wrap fine rv">${jp(t.note)}</p>
  </section>`;
}

/** 3つの事業を惑星として並べる（公式サイトの PLANET A / B / C） */
function planetsSection(p: Partner): string {
  const pl = p.top.planets;
  if (!pl) return '';
  return `
  <section class="sec sec-planets" aria-labelledby="pl-h">
    <div class="pl-sky" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Three planets</p>
        <h2 id="pl-h" class="sec-h">${heading(pl.title)}</h2>
      </header>
      <p class="pls-lead rv">${jp(pl.lead)}</p>
      <ol class="pls">${pl.items
        .map(
          (it, i) => `
        <li class="pl rv" style="--d:${i}" data-planet="${esc(it.planet)}">
          <div class="pl-orb" aria-hidden="true"><span class="pl-ring"></span><span class="pl-ball"><b>${esc(it.planet)}</b></span><span class="pl-moon"></span></div>
          <p class="pl-meta"><span>Planet ${esc(it.planet)}</span><span class="pl-en">${esc(it.en)}</span>${it.status ? `<span class="pl-status">${esc(it.status)}</span>` : ''}</p>
          <p class="pl-ja">${esc(it.ja)}</p>
          <h3 class="pl-h">${heading(it.title)}</h3>
          <p class="pl-p">${jp(it.body)}</p>
          <ul class="pl-points">${it.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>
          ${it.url ? `<a class="pl-link" href="${it.url}" target="_blank" rel="noopener"><span>公式サイトを見る</span><span aria-hidden="true">↗</span></a>` : ''}
        </li>`,
        )
        .join('')}</ol>
      <p class="fine rv">${jp(pl.note)}</p>
    </div>
  </section>`;
}

/** サービスのプロフィール画面にならったカード。代表の公開情報だけを並べる */
function profileSection(p: Partner): string {
  const f = p.top.profile;
  const l = p.leader;
  if (!f || !l) return '';
  const photo = f.photo ?? (l.photo && l.photoSize ? { src: l.photo, size: l.photoSize } : null);
  return `
  <section class="sec sec-profile" aria-labelledby="pf-h">
    <div class="wrap pf-in">
      <div class="pf-body rv">
        <p class="kicker">${esc(f.kicker)}</p>
        <h2 id="pf-h" class="sec-h">${heading(f.title)}</h2>
        <p class="pf-lead">${jp(f.lead)}</p>
        <a class="link-arrow" href="${routes.about(p.slug)}"><span>${esc(l.name.replace(' ', ''))}さんの歩みを読む</span><span class="arrow" aria-hidden="true">→</span></a>
        <p class="fine">${jp(f.note)}</p>
      </div>
      <article class="pf-card rv" aria-label="${esc(l.name)}さんのプロフィール">
        <span class="pf-orbit" aria-hidden="true"><i></i></span>
        <header class="pf-top">
          <span class="pf-co">${esc(f.company)}</span>
          <img class="pf-mark" src="${p.service.logo}" alt="" width="${p.service.logoSize[0]}" height="${p.service.logoSize[1]}" loading="lazy" />
        </header>
        <div class="pf-id">
          ${photo ? `<img class="pf-photo" src="${photo.src}" alt="${esc(l.role)} ${esc(l.name)}" width="${photo.size[0]}" height="${photo.size[1]}" loading="lazy" decoding="async" />` : ''}
          <div>
            <p class="pf-name">${esc(l.name)}</p>
            <p class="pf-en">${esc(l.nameEn)}</p>
            <p class="pf-role">${esc(f.role)}</p>
          </div>
        </div>
        <dl class="pf-rows">${f.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${esc(r.v)}</dd></div>`).join('')}</dl>
        <p class="pf-k">インタビューで使っていた言葉</p>
        <ul class="pf-tags">${f.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="pf-hobby"><span class="pf-pad" aria-hidden="true"><i></i></span><span><small>Game</small>${esc(f.hobby)}</span></p>
      </article>
    </div>
  </section>`;
}

/**
 * 絶対値の数直線。マイナスの側の言葉が、見えたときに 0 を軸に一つずつ折り返されて、プラスの側へ渡る。
 * 渡りきると「|経験|」が浮かぶ。動きを減らす設定・JSなしでは、渡りきった形で見せる
 */
function absoluteSection(p: Partner): string {
  const a = p.top.absolute;
  if (!a) return '';
  const ticks = Array.from({ length: 11 }, (_, i) => i - 5)
    .map((v) => `<i style="--v:${v}"${v === 0 ? ' class="is-zero"' : ''}><b>${v < 0 ? `−${-v}` : v}</b></i>`)
    .join('');
  return `
  <section class="sec sec-absolute" aria-labelledby="abs-h">
    <p class="abs-glyph" aria-hidden="true">|x|</p>
    <div class="wrap abs-in">
      <header class="abs-head rv">
        <p class="kicker">${esc(a.kicker)}</p>
        <h2 id="abs-h" class="sec-h">${heading(a.title)}</h2>
      </header>
      <blockquote class="abs-poem rv">
        <p>${a.lines.map((ln) => `<span>${esc(ln)}</span>`).join('')}</p>
        <cite>${esc(a.cite)}</cite>
      </blockquote>
      <figure class="abs-line rv" aria-label="数直線の図。マイナスの側にある${esc(a.marks.join('・'))}が、0を軸に折り返されてプラスの側に移り、「${esc(a.value)}」になる">
        <div class="al-track" aria-hidden="true">
          <span class="al-axis"></span>
          <span class="al-ticks">${ticks}</span>
          <ul class="al-marks">${a.marks.map((m, i) => `<li style="--x:${-(a.marks.length - i)};--i:${i}"><span>${esc(m)}</span></li>`).join('')}</ul>
        </div>
        <p class="al-value"><span class="al-bar" aria-hidden="true"></span><b>${esc(a.value)}</b><span class="al-bar" aria-hidden="true"></span></p>
        <p class="al-formula" aria-hidden="true">|−x| = x</p>
      </figure>
      <div class="abs-body rv">
        <p>${jp(a.body)}</p>
        <p class="fine">${jp(a.note)}</p>
      </div>
    </div>
  </section>`;
}


/**
 * orbit の世界観のヒーローに足すもの。
 *   ・右下でゆっくり回る円形の文字（公式サイトの「ZETTAICHI • SINCE 2026 • ABSOLUTE VALUE」の輪にならう）
 *   ・最初の一度だけ出る、絶対値のカウンター（−100 から 0 を通って |−100| = 100 へ）。client/orbit.ts が動かす。
 *     JSなし・動きを減らす設定では出さない
 */
function orbitHeroExtras(p: Partner): string {
  const ring = `${p.company.nameEn} ✦ ${p.service.name} ✦ ABSOLUTE VALUE ✦ SINCE 2026 ✦ `;
  return `
      <div class="orb-seal" aria-hidden="true">
        <svg viewBox="0 0 200 200"><defs><path id="orb-seal-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs><text><textPath href="#orb-seal-path" textLength="488">${esc(ring)}</textPath></text></svg>
        <span class="orb-seal-c">|x|</span>
      </div>
      <div class="orb-intro" data-orb-intro aria-hidden="true">
        <p class="oi-k">Loading ${esc(p.service.name)}</p>
        <p class="oi-n"><i class="oi-bar"></i><b data-orb-count>−100</b><small>%</small><i class="oi-bar"></i></p>
        <p class="oi-f">|−x| = x</p>
      </div>`;
}

/* ─────────────────────────────────────────────
   console の世界観（DPパートナーズなど）の部品：送り状・切り替えの日・控えの置き場所
   ───────────────────────────────────────────── */

/** サイト引越し屋さんのロゴにならった、荷台のある小さなトラック（線画） */
function truckSvg(className: string): string {
  return `<svg class="${className}" viewBox="0 0 64 36" aria-hidden="true" focusable="false"><path class="tk-bed" d="M3 8h34v18H3z"/><path class="tk-cab" d="M37 13h12l9 8v5H37z"/><path class="tk-win" d="M41 16h7l5 5H41z"/><circle class="tk-wh" cx="13" cy="28" r="5"/><circle class="tk-wh" cx="49" cy="28" r="5"/><path class="tk-box" d="M10 11l7-3 7 3v8l-7 3-7-3z M10 11l7 3 7-3 M17 14v8"/></svg>`;
}

/** 伝票番号から、毎回同じ形になるバーコード（飾り） */
function barcodeSvg(seed: string): string {
  let x = 0;
  const bars: string[] = [];
  const codes = [...seed].map((c) => c.charCodeAt(0));
  for (let i = 0; i < 46; i++) {
    const c = codes[i % codes.length] + i * 7;
    const w = 1 + (c % 3);
    if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="24"/>`);
    x += w + ((c >> 2) % 2);
  }
  return `<svg class="wb-code" viewBox="0 0 ${x} 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">${bars.join('')}</svg>`;
}

/**
 * ヒーローの送り状。スクロールでステージの段階が進むと、追跡の欄が1つずつ進み、トラックが走る（CSSだけ）。
 * 動きを減らす設定・WebGLなしでは、ヒーローの下に、全部の欄が済んだ伝票として置く
 */
function waybillBlock(p: Partner): string {
  const w = p.top.waybill;
  if (!w) return '';
  return `
        <aside class="wb" aria-label="${esc(w.label)}（${esc(w.note)}）">
          <div class="wb-in">
            <p class="wb-top"><span class="wb-label">${esc(w.label)}</span><span class="wb-no">${esc(w.no)}</span></p>
            ${barcodeSvg(w.no)}
            <dl class="wb-route">
              <div class="wb-end wb-from"><dt>${esc(w.from.k)}</dt><dd>${esc(w.from.v)}</dd></div>
              <div class="wb-road" aria-hidden="true"><i class="wb-line"></i>${truckSvg('wb-truck')}</div>
              <div class="wb-end wb-to"><dt>${esc(w.to.k)}</dt><dd>${esc(w.to.v)}</dd></div>
            </dl>
            <p class="wb-items"><span class="wb-items-k">品名</span><span class="wb-items-v">${w.items.map((it) => `<span>${esc(it)}</span>`).join('')}</span></p>
            <ol class="wb-track">${w.track
              .map((tr, i) => `<li data-k="${i}"><span class="wb-dot" aria-hidden="true"></span><b>${esc(tr.en)}</b><span>${esc(tr.ja)}</span></li>`)
              .join('')}</ol>
            <p class="wb-foot"><span class="wb-note">${esc(w.note)}</span><span class="wb-care" aria-hidden="true">${w.care.map((c, i) => `<span style="--i:${i}">${esc(c)}</span>`).join('')}</span></p>
          </div>
        </aside>
        <div class="wb-intro" aria-hidden="true"><span class="wb-dust"></span>${truckSvg('wb-intro-truck')}</div>`;
}

/** 0〜1 の、毎回同じになる疑似乱数（点の並びと切り替わる順番に使う） */
function hash01(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * 切り替えの日。DNS を切り替えたあと、見に来る人（点）が古いサーバーから新しいサーバーへ、ばらばらに移っていく（イメージ図）。
 * 画面に入ったら1回だけ流れる。「もう一度」で巻き戻す（client/console.ts）。動きを減らす設定では、移っている途中の状態で止める
 */
function cutoverSection(p: Partner): string {
  const c = p.top.cutover;
  if (!c) return '';
  const N = 60;
  const dots = Array.from({ length: N }, (_, i) => {
    const d = hash01(i + 3);
    return `<li style="--d:${(d * 4.2).toFixed(2)}s"${d < 0.5 ? ' class="is-early"' : ''}></li>`;
  }).join('');
  return `
  <section class="sec sec-cutover" aria-labelledby="cut-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">${esc(c.kicker)}</p>
        <h2 id="cut-h" class="sec-h">${heading(c.title)}</h2>
      </header>
      <p class="co-lead rv">${jp(c.lead)}</p>
      <div class="co-in">
        <figure class="co rv" data-cutover aria-label="DNSを切り替えたあと、見に来る人が新しいサーバーへ移っていく様子（イメージ図）">
          <p class="co-bar" aria-hidden="true"><span class="co-dot"></span><span>dns / cutover</span><span class="co-ttl">TTL</span></p>
          <div class="co-map" aria-hidden="true">
            <div class="co-srv co-old"><span class="co-srv-k">OLD</span><b>${esc(c.old.name)}</b><small>${esc(c.old.sub)}</small><span class="co-led"></span></div>
            <ol class="co-grid">${dots}</ol>
            <div class="co-srv co-new"><span class="co-srv-k">NEW</span><b>${esc(c.next.name)}</b><small>${esc(c.next.sub)}</small><span class="co-led"></span></div>
          </div>
          <div class="co-foot">
            <p class="co-legend"><span class="co-key is-old"><i aria-hidden="true"></i>${esc(c.legend.before)}</span><span class="co-key is-new"><i aria-hidden="true"></i>${esc(c.legend.after)}</span></p>
            <p class="co-time" aria-hidden="true"><span>切り替え</span><i></i><span>しばらくして</span></p>
            <button class="co-replay" type="button" data-cutover-replay>もう一度</button>
          </div>
          <figcaption class="fine">${jp(c.note)}</figcaption>
        </figure>
        <ol class="co-steps">${c.steps
          .map(
            (s, i) => `
          <li class="co-step rv" style="--d:${i}">
            <span class="co-no">${String(i + 1).padStart(2, '0')}</span>
            <h3 class="co-h">${heading(s.title)}</h3>
            <p class="co-p">${jp(s.detail)}</p>
            ${s.link ? `<a class="link-arrow co-link" href="${s.link.url}" target="_blank" rel="noopener"><span>${esc(s.link.label)}</span><span class="arrow" aria-hidden="true">↗</span></a>` : ''}
          </li>`,
          )
          .join('')}</ol>
      </div>
    </div>
  </section>`;
}

/**
 * 控えの置き場所。左に WordPress、右にサイトごとの棚が並ぶ保管庫、あいだに渡している権限。
 * 「乗っ取られたら？」を押すと、WordPress 側が赤くなり、削除の指示が門で止まる（client/console.ts）。
 * JSなしでは、権限の表と説明だけで読める
 */
function lockerSection(p: Partner): string {
  const l = p.top.locker;
  if (!l) return '';
  return `
  <section class="sec sec-locker" aria-labelledby="locker-h">
    <div class="wrap lk-in">
      <header class="lk-head rv">
        <p class="kicker">${esc(l.kicker)}</p>
        <h2 id="locker-h" class="sec-h">${heading(l.title)}</h2>
        <p class="lk-lead">${jp(l.lead)}</p>
        <ol class="lk-points">${l.points
          .map((pt, i) => `<li><span class="lk-pno">${String(i + 1).padStart(2, '0')}</span><h3 class="lk-ph">${heading(pt.title)}</h3><p class="lk-pp">${jp(pt.detail)}</p></li>`)
          .join('')}</ol>
      </header>
      <figure class="lk rv" data-locker aria-label="WordPressとバックアップの保管庫の関係（イメージ図）">
        <div class="lk-map">
          <div class="lk-node lk-server" aria-hidden="true">
            <span class="lk-k">Web server</span>
            <span class="lk-win"><i></i><i></i><i></i></span>
            <b>${esc(l.server.name)}</b><small>${esc(l.server.sub)}</small>
            <span class="lk-alarm">ALERT</span>
          </div>
          <div class="lk-gate">
            <p class="lk-gate-k" aria-hidden="true">Access</p>
            <ul class="lk-perms">${l.perms
              .map((pm) => `<li class="${pm.ok ? 'is-ok' : 'is-no'}"><span class="lk-mark" aria-hidden="true">${pm.ok ? '✓' : '×'}</span><span class="lk-pl">${esc(pm.label)}</span><span class="sr-only">${pm.ok ? '：渡している' : '：渡していない'}</span></li>`)
              .join('')}</ul>
            <span class="lk-flow" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="lk-bounce" aria-hidden="true">DELETE ×</span>
          </div>
          <div class="lk-node lk-store" aria-hidden="true">
            <span class="lk-k">Storage</span>
            <b>${esc(l.store.name)}</b><small>${esc(l.store.sub)}</small>
            <ul class="lk-shelves">${l.sites.map((s, i) => `<li style="--i:${i}"><span class="lk-key"></span><span class="lk-sn">${esc(s)}</span><span class="lk-lock"></span></li>`).join('')}</ul>
          </div>
        </div>
        <div class="lk-ctl">
          <button class="lk-btn" type="button" data-locker-btn aria-pressed="false" data-on="${esc(l.attack.reset)}" data-off="${esc(l.attack.button)}">${esc(l.attack.button)}</button>
          <p class="lk-log" data-locker-log aria-live="polite" data-done="${esc(l.attack.done)}"></p>
        </div>
        <figcaption class="fine">${jp(l.note)}${l.source ? ` <a class="in-link" href="${l.source.url}" target="_blank" rel="noopener">${esc(l.source.label)}</a>` : ''}</figcaption>
      </figure>
    </div>
  </section>`;
}
