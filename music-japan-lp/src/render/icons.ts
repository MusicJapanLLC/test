/**
 * Music Japan の公式シンボル（真上から見たレコード）。公式サイト（music-japan-site-trace/next/src/render/mark.ts）と同じ形。
 * 溝は左半分を明るく、右半分を沈め、赤い弧と点、赤い周波数の線を重ねる。
 */
const RINGS = [27, 23.6, 20.2, 16.8, 13.4, 10];

export function mjMark({ id = 'mk', cls = 'mj-mark', title = '' } = {}): string {
  const left = RINGS.map((r, i) => `<circle cx="32" cy="32" r="${r}" stroke-width="${(2 - i * 0.1).toFixed(2)}"/>`).join('');
  const right = RINGS.map((r, i) => `<circle cx="32" cy="32" r="${r}" stroke-width="${(1.1 - i * 0.05).toFixed(2)}"/>`).join('');
  return `<svg class="${cls}" viewBox="0 0 64 64" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}><defs><clipPath id="${id}L"><rect width="32" height="64"/></clipPath><clipPath id="${id}R"><rect x="32" width="32" height="64"/></clipPath></defs><g fill="none" stroke="currentColor"><g clip-path="url(#${id}L)">${left}</g><g clip-path="url(#${id}R)" stroke-opacity=".55">${right}</g></g><path d="M24.6 31A7.6 7.6 0 0 1 31.4 24.4" fill="none" stroke="var(--red,#e1222f)" stroke-width="1.3" stroke-linecap="round"/><circle cx="34.6" cy="24.4" r="1.55" fill="var(--red,#e1222f)"/><path d="M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6" fill="none" stroke="var(--red,#e1222f)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/** 導入アニメーション用：溝を1本ずつ描き、弧・点・波の順に出す */
export function introMark(): string {
  const rings = RINGS.slice()
    .reverse()
    .map((r, i) => {
      const c = 2 * Math.PI * r;
      return `<circle class="im-ring" style="--i:${i};--c:${c.toFixed(1)}" cx="32" cy="32" r="${r}" stroke-width="${(1.5 + i * 0.1).toFixed(2)}" transform="rotate(-90 32 32)"/>`;
    })
    .join('');
  return `<svg class="im" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="imL"><rect width="32" height="64"/></clipPath><clipPath id="imR"><rect x="32" width="32" height="64"/></clipPath></defs><g fill="none" stroke="currentColor"><g clip-path="url(#imL)">${rings}</g><g clip-path="url(#imR)" stroke-opacity=".5">${rings}</g></g><path class="im-arc" pathLength="1" d="M24.6 31A7.6 7.6 0 0 1 31.4 24.4" fill="none" stroke="#e1222f" stroke-width="1.3" stroke-linecap="round"/><circle class="im-dot" cx="34.6" cy="24.4" r="1.55" fill="#e1222f"/><path class="im-wave" pathLength="1" d="M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6" fill="none" stroke="#e1222f" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/** ファビコン用（単体のSVGファイル）。明るいタブでは墨、暗いタブでは生成り */
export const mjMarkFile = (): string =>
  mjMark({ id: 'f' })
    .replace('class="mj-mark" ', 'xmlns="http://www.w3.org/2000/svg" ')
    .replace('<defs>', '<style>.mk{stroke:#141414}@media (prefers-color-scheme:dark){.mk{stroke:#eee8df}}</style><defs>')
    .replace('<g fill="none" stroke="currentColor">', '<g fill="none" class="mk">')
    .replaceAll('var(--red,#e1222f)', '#d62b33');

/**
 * Baton Partners のマーク（baton-partners/src/render/logo.ts と同じもの）。
 */
let seq = 0;

export function bpMark(opts: { size?: number; animated?: boolean; id?: string } = {}): string {
  const k = opts.id ?? `bpm${++seq}`;
  const size = opts.size ?? 32;
  // 渡る光（白い丸 → 赤い丸）。サイト上だけ動かす
  const motion = opts.animated
    ? `<circle r="1.8" fill="#fff" filter="url(#${k}-glow)"><animateMotion dur="2.6s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="spline" keySplines="0.6 0 0.2 1;0 0 1 1" path="M22 30 C 26 17, 39 17, 43 30"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.5;0.58;1" dur="2.6s" repeatCount="indefinite"/></circle>
       <circle cx="43" cy="32" r="10" fill="none" stroke="#E2334F" stroke-width="1"><animate attributeName="r" values="7.5;13;13" keyTimes="0;0.6;1" dur="2.6s" begin="1.35s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.8;0;0" keyTimes="0;0.6;1" dur="2.6s" begin="1.35s" repeatCount="indefinite"/></circle>`
    : '';
  return `<svg class="bp-mark" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Baton Partners">
  <defs>
    <linearGradient id="${k}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A2A31"/><stop offset="0.55" stop-color="#16161B"/><stop offset="1" stop-color="#0A0A0D"/></linearGradient>
    <radialGradient id="${k}-shine" cx="0.22" cy="0.12" r="0.85"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.04"/><stop offset="1" stop-color="#E2334F" stop-opacity="0.7"/></linearGradient>
    <linearGradient id="${k}-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="1" stop-color="#FF4D63"/></linearGradient>
    <radialGradient id="${k}-red" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FF6B7D"/><stop offset="0.45" stop-color="#E0142F"/><stop offset="1" stop-color="#9E0A22"/></radialGradient>
    <radialGradient id="${k}-white" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D9DAE0"/></radialGradient>
    <filter id="${k}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${k}-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#${k}-bg)"/>
  <rect width="64" height="64" rx="13" fill="url(#${k}-shine)"/>
  <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="12.4" fill="none" stroke="url(#${k}-rim)" stroke-width="1.2"/>
  <path d="M22 30 C 26 17, 39 17, 43 30" fill="none" stroke="url(#${k}-arc)" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="0.1 3.2"/>
  <circle cx="43" cy="32" r="9" fill="#E2334F" opacity="0.45" filter="url(#${k}-halo)"/>
  <circle cx="22" cy="32" r="6.8" fill="url(#${k}-white)"/>
  <circle cx="43" cy="32" r="6.8" fill="url(#${k}-red)"/>
  <circle cx="43" cy="32" r="10" fill="none" stroke="#E2334F" stroke-opacity="0.5" stroke-width="0.8"/>
  ${motion}
</svg>`;
}

export const arrow = (d: 'right' | 'up-right' | 'down' = 'right'): string =>
  `<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="${d === 'right' ? 'M4 12h15M13 6l6 6-6 6' : d === 'down' ? 'M12 4v15M6 13l6 6 6-6' : 'M7 17 17 7M8 7h9v9'}"/></svg>`;

const SOCIAL: Record<string, string> = {
  LinkedIn: '<path d="M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2ZM8 19H5V9.5h3V19ZM6.5 8.2a1.8 1.8 0 1 1 0-3.5 1.8 1.8 0 0 1 0 3.5ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.8 13 12.8 14.3V19h-3V9.5h2.9v1.3a3.2 3.2 0 0 1 2.9-1.6c3.1 0 3.6 2 3.6 4.7V19Z"/>',
  Instagram: '<path d="M12 7.3A4.7 4.7 0 1 0 16.7 12 4.7 4.7 0 0 0 12 7.3Zm0 7.8a3.1 3.1 0 1 1 3.1-3.1 3.1 3.1 0 0 1-3.1 3.1Zm6-8a1.1 1.1 0 1 1-1.1-1.1A1.1 1.1 0 0 1 18 7.1ZM21.9 8.2a5.5 5.5 0 0 0-1.5-3.9 5.5 5.5 0 0 0-3.9-1.5C15 2.7 9 2.7 7.5 2.8a5.5 5.5 0 0 0-3.9 1.5A5.5 5.5 0 0 0 2.1 8.2C2 9.7 2 14.3 2.1 15.8a5.5 5.5 0 0 0 1.5 3.9 5.5 5.5 0 0 0 3.9 1.5c1.5.1 7.5.1 9 0a5.5 5.5 0 0 0 3.9-1.5 5.5 5.5 0 0 0 1.5-3.9c.1-1.5.1-6.1 0-7.6Zm-2 9.9a3.2 3.2 0 0 1-1.8 1.8c-1.3.5-4.3.4-6.1.4s-4.8.1-6.1-.4a3.2 3.2 0 0 1-1.8-1.8C3.6 16.8 3.7 13.8 3.7 12s-.1-4.8.4-6.1a3.2 3.2 0 0 1 1.8-1.8C7.2 3.6 10.2 3.7 12 3.7s4.8-.1 6.1.4a3.2 3.2 0 0 1 1.8 1.8c.5 1.3.4 4.3.4 6.1s.1 4.8-.4 6.1Z"/>',
  X: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/>',
};

export const socialIcon = (name: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${SOCIAL[name] ?? ''}</svg>`;
