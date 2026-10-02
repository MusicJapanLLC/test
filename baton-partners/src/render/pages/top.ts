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
          ${tickerBlock(p)}
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

  ${relaySection(p)}

  ${serpSection(p)}

  ${channelsSection(p)}

  <section class="sec sec-highlight" aria-labelledby="hl-h">
    <div class="scene scene-hl" data-scene="network" data-count="900" data-phase="${p.world.scene === 'vault' || p.world.scene === 'en' || p.world.scene === 'relay' || p.world.scene === 'feed' ? '2.0' : '1.0'}" aria-hidden="true"><canvas></canvas></div>
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

  ${filmSection(p)}

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

  ${voicesSection(p)}

  <section class="clients" aria-labelledby="clients-h">
    <p id="clients-h" class="clients-h wrap">${jp(s.clientsNote)}</p>
    ${marquee(s.clients, { label: p.operator ? 'ページの裏側で使っているもの' : '利用企業', size: 'md', reverse: true })}
  </section>

  ${partnerLogosSection(p)}

  ${spotlightSection(p)}

  ${productSection(p)}

  ${mediaSection(p)}

  ${missionSection(p)}

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

/** 図の番号。minka は「其の一」、relay は「LANE 1」、ほかは「01」 */
function seq(p: Partner, i: number): string {
  if (p.world.theme === 'minka') return `其の${['一', '二', '三', '四', '五'][i] ?? i + 1}`;
  if (p.world.theme === 'relay') return `LANE ${i + 1}`;
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
 * 4つの区間を、リレーのように見せる（relay の世界観で使う）。
 * 区間が画面に入るたびに、バトンが次の区間へ渡る（client/relay-track.ts が --leg を進める）。
 * 動きを減らす設定・JSなしでは、4区間が並んだ静止画として読める。
 */
function relaySection(p: Partner): string {
  const r = p.top.relay;
  if (!r) return '';
  const legs = r.legs
    .map(
      (l, i) => `
        <li class="leg" data-leg="${i}" style="--i:${i}">
          <div class="leg-bib" aria-hidden="true"><span class="leg-bib-no">${i + 1}</span><span class="leg-bib-pin"></span></div>
          <p class="leg-meta"><span class="leg-run">${esc(l.leg)}</span><span class="leg-en">${esc(l.en)}</span></p>
          <p class="leg-name">${esc(l.name)}</p>
          <h3 class="leg-h">${heading(l.title)}</h3>
          <p class="leg-p">${jp(l.body)}</p>
          ${i < r.legs.length - 1 ? '<span class="leg-zone" aria-hidden="true"><i></i><i></i><i></i></span>' : '<span class="leg-finish" aria-hidden="true"></span>'}
        </li>`,
    )
    .join('');
  return `
  <section class="sec sec-relay" aria-labelledby="relay-h" data-relay>
    <div class="relay-lanes" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span><b>${i + 1}</b></span>`).join('')}</div>
    <div class="wrap">
      <header class="relay-head rv">
        <p class="kicker">Relay — 4 legs</p>
        <h2 id="relay-h" class="relay-h">${heading(r.title)}</h2>
        <p class="relay-lead">${jp(r.lead)}</p>
      </header>
      <div class="relay-track">
        <div class="relay-rail" aria-hidden="true"><span class="relay-baton" data-baton><i></i></span><span class="relay-fill" data-relay-fill></span></div>
        <ol class="legs">${legs}</ol>
      </div>
      <p class="fine rv">${jp(r.note)}</p>
    </div>
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

/** 掲載中のパートナー企業。ロゴがない会社（了承済み・準備中）は社名の文字で出す */
function partnerLogosSection(p: Partner): string {
  const l = p.top.partnerLogos;
  if (!l) return '';
  const items = l.items
    .map((it) => {
      const mark = it.logo
        ? `<img src="${it.logo.src}" alt="${esc(it.name)}" width="${it.logo.size[0]}" height="${it.logo.size[1]}" loading="lazy" decoding="async" />`
        : `<span class="pl-word">${esc(it.name.replace(/^株式会社|株式会社$/g, ''))}</span>`;
      const inner = `<span class="pl-mark">${mark}</span><span class="pl-name">${esc(it.name)}</span><span class="pl-status">${esc(it.status ?? 'ページを見る')}</span>`;
      return `<li class="pl rv">${it.href ? `<a class="pl-in" href="${it.href}">${inner}<span class="arrow" aria-hidden="true">→</span></a>` : `<div class="pl-in is-soon">${inner}</div>`}</li>`;
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
      <ul class="pls">${items}</ul>
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
