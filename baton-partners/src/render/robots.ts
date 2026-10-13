import type { Bot } from '../types';
import { esc } from './text';

/**
 * Music Japan のロボット（公式サイトの5体）。ドット絵は client/robots.ts が描く。
 * 押すとしゃべる飾りなので、読み上げからは外す。
 */
export function botHtml(id: Bot, opts: { line?: string; className?: string } = {}): string {
  return `<span class="bot bot-${id}${opts.className ? ` ${opts.className}` : ''}" data-bot="${id}"${opts.line ? ` data-bot-line="${esc(opts.line)}"` : ''} aria-hidden="true"><canvas width="32" height="48"></canvas><span class="bot-say" data-bot-say hidden></span></span>`;
}

/**
 * CSSだけで描くレコード（needle の世界観）。WebGLを何枚も起動しないよう、ヒーロー以外のレコードはこれで描く。
 * 溝は repeating-radial-gradient、光沢は conic-gradient、ラベルは公式のシンボル。回転は CSS アニメーション
 */
export function discHtml(className = ''): string {
  return `<div class="lp${className ? ` ${className}` : ''}" aria-hidden="true"><span class="lp-shine"></span><span class="lp-label"><img src="/partners/music-japan/mark.svg" alt="" width="64" height="64" loading="lazy" /></span></div>`;
}
