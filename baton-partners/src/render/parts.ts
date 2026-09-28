import type { Partner } from '../types';
import { breadcrumb } from './layout';
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
