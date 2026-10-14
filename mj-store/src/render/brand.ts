import type { BotId } from '../data/types';
import { esc, href, ph, type RenderCtx } from './util';

export type { BotId };

/**
 * MJ STORE のロゴ。
 * マークは Music Japan のシンボル（真上から見たレコードの溝。左半分は濃く、右半分は淡い）に、
 * 赤い再生ボタンを重ねたもの。音楽の会社がつくるゲームの「スタート」。
 * 文字は「MJ」を太いゴシック、「STORE」をドット文字にして、ゲームらしさを出す。
 */

/** ページに1回だけ置く、ロゴの色の定義（グラデーションなど）。ヘッダーに入っている */
export function brandDefs(): string {
  return `<svg class="brand-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="mjb-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2b33"/><stop offset=".55" stop-color="#16161b"/><stop offset="1" stop-color="#0a0a0d"/></linearGradient>
      <radialGradient id="mjb-shine" cx=".22" cy=".12" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="mjb-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#ff3b30" stop-opacity=".75"/></linearGradient>
      <radialGradient id="mjb-red" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff7a6b"/><stop offset=".45" stop-color="#ef2a2a"/><stop offset="1" stop-color="#a50f1c"/></radialGradient>
      <clipPath id="mjb-l"><rect width="32" height="64"/></clipPath>
      <clipPath id="mjb-r"><rect x="32" width="32" height="64"/></clipPath>
      <filter id="mjb-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    </defs>
  </svg>`;
}

const GROOVES = [22, 17.5, 13].map((r) => `<circle cx="32" cy="32" r="${r}"/>`).join('');

export function markSvg(cls = 'mark'): string {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="15" fill="url(#mjb-bg)"/>
    <rect width="64" height="64" rx="15" fill="url(#mjb-shine)"/>
    <rect x=".6" y=".6" width="62.8" height="62.8" rx="14.4" fill="none" stroke="url(#mjb-rim)" stroke-width="1.2"/>
    <g class="mark__disc" fill="none" stroke="#efe9e0">
      <g clip-path="url(#mjb-l)" stroke-width="1.6">${GROOVES}</g>
      <g clip-path="url(#mjb-r)" stroke-opacity=".4" stroke-width="1.1">${GROOVES}</g>
    </g>
    <circle class="mark__halo" cx="33" cy="32" r="8" fill="#ff3b30" opacity=".5" filter="url(#mjb-halo)"/>
    <path class="mark__play" d="M28.6 25.6 39.4 32 28.6 38.4Z" fill="url(#mjb-red)" stroke="url(#mjb-red)" stroke-width="2.4" stroke-linejoin="round"/>
  </svg>`;
}

/** 「MJ STORE」の文字。STORE は1文字ずつ跳ねる */
export function wordHtml(): string {
  return `<span class="logo__word">MJ<b>${[...'STORE'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</b></span>`;
}

export function logoHtml(ctx: RenderCtx, opts: { as?: 'a' | 'button'; cls?: string; attrs?: string } = {}): string {
  const inner = `${markSvg('logo__mark')}${wordHtml()}`;
  const cls = `logo${opts.cls ? ` ${opts.cls}` : ''}`;
  if (opts.as === 'button') {
    return `<button type="button" class="${cls}" ${opts.attrs ?? ''} aria-label="MJ STORE">${inner}</button>`;
  }
  return `<a class="${cls}" href="${href(ctx, '')}" aria-label="MJ STORE トップへ" ${opts.attrs ?? ''}>${inner}</a>`;
}

/** 合同会社Music Japan の公式ロゴ（公式サイトと同じ画像） */
export function musicJapanLogo(ctx: RenderCtx, cls = 'mj-corp'): string {
  return `<img class="${cls}" src="${href(ctx, 'brand/music-japan-logo-white.png')}" width="797" height="176" alt="合同会社Music Japan" loading="lazy" decoding="async" />`;
}

/* ───────── ちびロボ ───────── */

/**
 * Music Japan のちびロボ5体（公式サイトと同じドット絵）。絵は lib/robots.ts がキャンバスに描く。
 * 名前はまだ決まっていないので、ページには出さない。id は描き分けのためだけに使う。
 */
export const BOT_IDS: BotId[] = ['tune', 'spin', 'pod', 'reel', 'mic'];

/**
 * 1体。押すと跳ねてしゃべる。line は最初にしゃべる言葉（｜で区切ると順番に）。
 * note を入れると、吹き出しを最初から出しておく（解説役）
 */
export function botHtml(id: BotId, opts: { line?: string; note?: string; cls?: string; side?: 'left' | 'right' } = {}): string {
  const cls = ['bot', `bot--${id}`, opts.cls, opts.note ? 'has-note' : '', opts.side === 'left' ? 'is-left' : '']
    .filter(Boolean)
    .join(' ');
  return `<span class="${cls}" data-bot="${id}"${opts.line ? ` data-bot-line="${esc(opts.line)}"` : ''}>
    <canvas width="32" height="48" aria-hidden="true"></canvas>
    <span class="bot__say" data-bot-say${opts.note ? '' : ' hidden'}>${opts.note ? ph(opts.note) : ''}</span>
  </span>`;
}

/** 5体そろって踊る列 */
export function crewHtml(cls = ''): string {
  return `<div class="crew${cls ? ` ${cls}` : ''}" data-bot-crew>${BOT_IDS.map((id) => botHtml(id)).join('')}</div>`;
}
