import { loadDefaultJapaneseParser } from 'budoux';
import type { Game, Platform, Shot } from '../data/types';

export interface RenderCtx {
  /** 配信パス。通常は '/'。サブパス配信なら '/test/' など */
  base: string;
  /** 本番の URL（末尾スラッシュなし）。canonical・OGP・構造化データの基準 */
  siteUrl: string;
}

export const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const budoux = loadDefaultJapaneseParser();

/**
 * 見出し・題名用。文節の切れ目にだけ <wbr> を入れる。
 * CSS の word-break: keep-all と組み合わせて、「ここ／にある」のような途中の改行を防ぐ（iPhone の Safari でも効く）
 */
export const ph = (s: string): string => budoux.parse(s).map(esc).join('<wbr>');

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 2026-10-09 → 2026.10.09 */
export const dot = (d: string): string => d.replace(/-/g, '.');

export const href = (ctx: RenderCtx, path: string): string =>
  `${ctx.base}${path.replace(/^\/+/, '')}`;

export const gameHref = (ctx: RenderCtx, g: Game): string => href(ctx, `games/${g.slug}/`);

/** サイト内のパスを、本番の絶対 URL にする（'/games/x/' → 'https://…/games/x/'） */
export const abs = (ctx: RenderCtx, path: string): string =>
  `${ctx.siteUrl}/${path.replace(/^\/+/, '')}`;

/** 実際のゲーム画面の <img>。幅・高さを必ず入れて、レイアウトのずれを出さない */
export function shotImg(
  ctx: RenderCtx,
  shot: Shot,
  opts: { cls?: string; lazy?: boolean; priority?: boolean; style?: string; sizes?: string; data?: string } = {},
): string {
  const attrs = [
    opts.data ?? '',
    `src="${href(ctx, shot.src)}"`,
    `width="${shot.w}"`,
    `height="${shot.h}"`,
    `alt="${esc(shot.alt)}"`,
    opts.cls ? `class="${opts.cls}"` : '',
    opts.style ? `style="${opts.style}"` : '',
    opts.sizes ? `sizes="${opts.sizes}"` : '',
    opts.priority ? 'fetchpriority="high"' : opts.lazy === false ? '' : 'loading="lazy"',
    'decoding="async"',
  ];
  return `<img ${attrs.filter(Boolean).join(' ')} />`;
}

/**
 * 実機のフレーム（スマホ／PCのブラウザ）に、実際の画面を重ねて入れる。
 * 中の画像は JS で数秒ごとに切り替わる（[data-device]）。
 */
export function deviceHtml(ctx: RenderCtx, g: Game, opts: { priority?: boolean; max?: number } = {}): string {
  /* スマホのブラウザで撮った画面（アドレスバーのぶん背が低い）があれば、ブラウザごと見せる */
  const inBrowser = g.device === 'phone' && g.shots.some(isBrowserShot);
  const picked = g.shots
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => !inBrowser || isBrowserShot(s))
    .slice(0, opts.max ?? g.shots.length);
  const imgs = picked
    .map(({ s, index }, i) =>
      shotImg(ctx, s, {
        cls: `device__shot${i === 0 ? ' is-on' : ''}`,
        priority: opts.priority && i === 0,
        lazy: !(opts.priority && i === 0),
        data: `data-shot="${index}"`,
      }),
    )
    .join('');
  const play = g.playUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (g.device === 'browser') {
    return `
    <div class="device device--browser" data-device>
      <div class="device__bar" aria-hidden="true"><i></i><i></i><i></i><span>${esc(play)}</span></div>
      <div class="device__screen">${imgs}</div>
    </div>`;
  }
  if (inBrowser) {
    const first = picked[0].s;
    const host = play.split('/')[0];
    return `
    <div class="device device--phone device--safari" data-device>
      <div class="device__screen">
        <div class="device__top" aria-hidden="true"><span class="device__url">${icon.lock}${esc(host)}</span></div>
        <div class="device__view" style="aspect-ratio:${first.w} / ${first.h}">${imgs}</div>
        <div class="device__tabs" aria-hidden="true"><i></i><i></i><b></b><i></i><i></i></div>
      </div>
      <span class="device__island" aria-hidden="true"></span>
    </div>`;
  }
  return `
    <div class="device device--phone" data-device>
      <div class="device__screen">${imgs}</div>
      <span class="device__island" aria-hidden="true"></span>
    </div>`;
}

/** スマホのブラウザ（アドレスバーつき）で撮った、縦横比が短めの画面か */
export function isBrowserShot(s: Shot): boolean {
  return s.h < s.w * 1.95 && s.h > s.w;
}

/**
 * キャッチコピーの一番長い行が、全角何文字ぶんの幅かを見積もる。
 * CSS 側で「画面幅 ÷ この値」をフォントサイズにして、どの画面でも1行に収める。
 */
export function catchEm(lines: string[], latinWidth: number): number {
  const width = (line: string) =>
    Array.from(line).reduce((sum, ch) => sum + (/[\x20-\x7E]/.test(ch) ? latinWidth : 1), 0);
  const longest = Math.max(...lines.map(width));
  return Math.round((longest + 0.35) * 100) / 100;
}

export function catchHtml(lines: string[]): string {
  return lines
    .map(
      (l, i) =>
        `<span class="catch-line" style="--i:${i}"><span class="catch-line__in">${esc(l)}</span></span>`,
    )
    .join('');
}

/** ゲームごとの色と書体を CSS 変数にする */
export function themeVars(g: Game): string {
  const t = g.theme;
  return [
    `--g-bg:${t.bg}`,
    `--g-surface:${t.surface}`,
    `--g-ink:${t.ink}`,
    `--g-mute:${t.mute}`,
    `--g-line:${t.line}`,
    `--g-accent:${t.accent}`,
    `--g-accent2:${t.accent2}`,
    `--g-on-accent:${t.onAccent}`,
    `--g-font:${t.font.replace(/"/g, "'")}`,
  ].join(';');
}

/* ───────── アイコン（すべて currentColor） ───────── */

const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const icon = {
  arrow: svg('<path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>'),
  trophy: svg(
    '<path d="M7 3h10v2h3v3c0 2.6-1.9 4.6-4.4 4.9A5 5 0 0 1 13 15.8V18h3v3H8v-3h3v-2.2a5 5 0 0 1-2.6-2.9C5.9 12.6 4 10.6 4 8V5h3zm0 4H6v1c0 1.2.6 2.2 1.6 2.7A5 5 0 0 1 7 8zm10 0v1a5 5 0 0 1-.6 2.7c1-.5 1.6-1.5 1.6-2.7V7z" fill="currentColor"/>',
  ),
  soundOn: svg(
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>',
  ),
  soundOff: svg(
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>',
  ),
  pc: svg('<path d="M3 4h18v12H3zM9 20h6M12 16v4" fill="none" stroke="currentColor" stroke-width="2"/>'),
  phone: svg('<path d="M7 2.5h10v19H7zM11 18.5h2" fill="none" stroke="currentColor" stroke-width="2"/>'),
  browser: svg(
    '<path d="M3 4h18v16H3zM3 8.5h18" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6.2h1.5M8.8 6.2h1.5" stroke="currentColor" stroke-width="1.6"/>',
  ),
  bug: svg(
    '<path d="M8 7.5a4 4 0 0 1 8 0M7 10h10v5a5 5 0 0 1-10 0zM12 10v10M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M4 7l3 2M20 7l-3 2" fill="none" stroke="currentColor" stroke-width="2"/>',
  ),
  idea: svg(
    '<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20.5h5" fill="none" stroke="currentColor" stroke-width="2"/>',
  ),
  heart: svg(
    '<path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20.5 9c0 6-8.5 11.5-8.5 11.5z" fill="currentColor"/>',
  ),
  mail: svg('<path d="M3 5h18v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 6l8.5 7 8.5-7" fill="none" stroke="currentColor" stroke-width="2"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>'),
  lock: svg('<path d="M6.5 11h11v9.5h-11zM9 11V8a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  star: svg('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="currentColor"/>'),
  repost: svg('<path d="M4 10V7h13l-3-3M20 14v3H7l3 3" fill="none" stroke="currentColor" stroke-width="2"/>'),
  reply: svg('<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2"/>'),
};

const PLATFORM_ICON: Record<Platform, string> = {
  PC: icon.pc,
  スマホ: icon.phone,
};

export function platformsHtml(ps: Platform[], withLabel = false): string {
  return `<span class="platforms">${ps
    .map(
      (p) =>
        `<span class="platform" title="${esc(p)}">${PLATFORM_ICON[p]}${
          withLabel ? `<span>${esc(p)}</span>` : `<span class="sr">${esc(p)}</span>`
        }</span>`,
    )
    .join('')}</span>`;
}

export function stars(): string {
  return `<span class="stars" aria-label="星5つ">${icon.star.repeat(5)}</span>`;
}

/** 背景にぼかして敷く画面。PC作品はタイトル文字が透けないよう、プレイ画面を使う */
export const heroBgShot = (g: Game): Shot | undefined =>
  g.device === 'browser' ? (g.shots[2] ?? g.shots[1] ?? g.shots[0]) : g.shots[0];
