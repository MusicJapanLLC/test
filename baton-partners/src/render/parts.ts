import { routes } from '../config/site';
import type { Partner } from '../types';
import { breadcrumb, shortName } from './layout';
import { esc, heading, jp } from './text';

/**
 * 下層ページ共通のヒーロー。右側に小さなWebGLシーンを置く。
 * phase でシーンの状態を変える（0=散らばる / 1=つながる / 2=決まる）。
 */
export function pageHero(opts: {
  p: Partner;
  no: string;
  en: string;
  title: string | string[];
  lead: string;
  crumbs: { name: string; href?: string }[];
  phase: number;
  big?: string;
  /** サービスロゴなど、見出しの上に大きく置く画像 */
  logo?: { src: string; alt: string; size: [number, number] };
}): string {
  return `
<section class="phero" aria-labelledby="phero-h">
  <div class="scene scene-sub" data-scene="network" data-count="900" data-phase="${opts.phase}" aria-hidden="true"><canvas></canvas></div>
  <div class="wrap phero-in">
    ${breadcrumb(opts.crumbs)}
    <p class="kicker"><span class="kicker-rule" aria-hidden="true"></span>${esc(opts.no)} — ${esc(opts.en)}</p>
    ${opts.logo ? `<p class="phero-logo"><img src="${opts.logo.src}" alt="${esc(opts.logo.alt)}" width="${opts.logo.size[0]}" height="${opts.logo.size[1]}" /></p>` : ''}
    ${opts.big ? `<p class="phero-big" aria-hidden="true">${esc(opts.big)}</p>` : ''}
    <h1 id="phero-h" class="phero-h">${heading(opts.title)}</h1>
    <p class="phero-lead">${jp(opts.lead)}</p>
  </div>
</section>`.trim();
}

/**
 * 横に流れるテキスト帯。スクロールの速さに合わせて加速・傾く（client/fx.ts）。
 * 同じ並びを2回出して、継ぎ目なくループさせる。
 */
export function marquee(items: string[], opts: { label: string; size?: 'xl' | 'md'; reverse?: boolean }): string {
  const run = items.map((t) => `<span class="mq-item">${esc(t)}</span><span class="mq-sep" aria-hidden="true">✦</span>`).join('');
  return `
<div class="mq mq-${opts.size ?? 'xl'}${opts.reverse ? ' mq-rev' : ''}" data-marquee role="marquee" aria-label="${esc(opts.label)}">
  <div class="mq-track"><div class="mq-run">${run}</div><div class="mq-run" aria-hidden="true">${run}</div></div>
</div>`.trim();
}

/**
 * 代表の紹介。写真はモノクロで、ロゴの四角い枠に収める（ホバーでカラー）。
 * 本文は公開されている事実だけで書き、本人の発言は作らない。
 */
export function leaderSection(p: Partner): string {
  const l = p.leader;
  if (!l) return '';
  return `
<section class="sec leader" aria-labelledby="leader-h">
  <div class="wrap leader-in">
    ${
      l.photo && l.photoSize
        ? `<figure class="leader-photo rv">
      <span class="leader-frame" aria-hidden="true"></span>
      <img src="${l.photo}" alt="${esc(l.role)} ${esc(l.name)}" width="${l.photoSize[0]}" height="${l.photoSize[1]}" loading="lazy" decoding="async" />
    </figure>`
        : `<ol class="leader-timeline rv" aria-label="${esc(l.name)}さんの歩み">${(l.timeline ?? [])
            .map((t) => `<li><span class="lt-y">${esc(t.year)}</span><span class="lt-t">${jp(t.text)}</span></li>`)
            .join('')}</ol>`
    }
    <div class="leader-body rv">
      <p class="kicker">Leader</p>
      <p class="leader-role">${esc(l.role)}</p>
      <h2 id="leader-h" class="leader-name">${esc(l.name)}</h2>
      <p class="leader-en" aria-hidden="true">${esc(l.nameEn)}</p>
      <div class="leader-text">${l.body.map((t) => `<p>${jp(t)}</p>`).join('')}</div>
      ${l.motto ? `<p class="leader-motto"><span>${esc(l.motto.label)}</span><strong>${esc(l.motto.text)}</strong></p>` : ''}
    </div>
  </div>
</section>`.trim();
}

/**
 * ページ冒頭の「問い」と「一言の答え」。
 * 検索やAIが段落単位で抜き出しても意味が通るよう、答えは単独で完結する文にする。
 */
export function answerBox(answer: { q: string; a: string }, id = 'answer'): string {
  return `
<section class="answer" aria-labelledby="${id}-h">
  <div class="wrap answer-in">
    <p class="answer-k" aria-hidden="true">Q.</p>
    <div class="answer-body">
      <h2 id="${id}-h" class="answer-q">${esc(answer.q)}</h2>
      <p class="answer-a">${jp(answer.a)}</p>
    </div>
  </div>
</section>`.trim();
}

type Kind = 'top' | 'about' | 'service' | 'insight';

/**
 * 各ページの末尾に置く「次に読む」。いま見ているページ以外の3ページへ、
 * 中身が分かる言葉でリンクする（「こちら」は使わない）。話してみる は直後の帯から。
 */
export function nextReads(p: Partner, current: Kind): string {
  const items: { kind: Kind; href: string; k: string; title: string; desc: string }[] = [
    { kind: 'top', href: routes.top(p.slug), k: 'Top', title: p.seo.top.answer.q, desc: p.seo.top.description },
    { kind: 'about', href: routes.about(p.slug), k: 'About', title: p.seo.about.answer.q, desc: p.seo.about.description },
    { kind: 'service', href: routes.service(p.slug), k: 'Service', title: p.seo.service.answer.q, desc: p.seo.service.description },
    { kind: 'insight', href: routes.insight(p.slug, p.insight.slug), k: 'Insights', title: p.insight.title, desc: p.insight.description },
  ];
  const cards = items
    .filter((it) => it.kind !== current)
    .map(
      (it) => `
      <li>
        <a class="next-card" href="${it.href}">
          <span class="next-k">${it.k}</span>
          <span class="next-t">${heading(it.title)}</span>
          <span class="next-d">${jp(it.desc)}</span>
          <span class="arrow" aria-hidden="true">→</span>
        </a>
      </li>`,
    )
    .join('');
  return `
<nav class="sec next-reads" aria-labelledby="next-h">
  <div class="wrap">
    <p class="kicker rv">Next</p>
    <h2 id="next-h" class="sec-h rv">${heading(`${shortName(p)}について、次に読む`)}</h2>
    <ul class="next-list rv">${cards}</ul>
  </div>
</nav>`.trim();
}

/** 記事の出典。本文の事実・数字・引用の元をたどれるようにする */
export function sourcesList(sources: { label: string; url: string }[]): string {
  if (!sources.length) return '';
  return `
<aside class="a-sources" aria-labelledby="sources-h">
  <p id="sources-h" class="a-sources-t">出典</p>
  <ol>${sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ol>
</aside>`.trim();
}

export { botHtml, discHtml } from './robots';
