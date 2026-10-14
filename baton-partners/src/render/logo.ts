/**
 * Baton Partners のロゴ。
 *
 * 元の Baton（baton/public/favicon.svg ＋「Baton」の文字組み）をそのまま骨格にしている。
 *   Baton          … 黒い角丸に、白い丸と赤い丸（人から人へバトンが渡る）。文字は Helvetica 500・字間 0.16em。シンプル
 *   Baton Partners … 同じ位置・同じ大きさの2つの丸に、墨のグラデーション・光沢・縁取り・光の輪・渡る弧を足す。リッチ
 *                    文字は「Baton」を同じ組みのまま、「Partners」を欧文セリフのイタリックで添える
 *
 * 1ページに複数置けるよう、SVG 内の id には呼び出しごとの接尾辞を付ける。
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

/**
 * マーク＋文字組み。
 * tone: 'ink'＝白い背景用 / 'paper'＝黒い背景用
 */
export function bpLogo(opts: { size?: number; tone?: 'ink' | 'paper'; animated?: boolean; className?: string } = {}): string {
  const tone = opts.tone ?? 'ink';
  return `<span class="bpl bpl-${tone}${opts.className ? ` ${opts.className}` : ''}">${bpMark({ size: opts.size ?? 28, animated: opts.animated })}<span class="bpl-word"><span class="bpl-baton">Baton</span><span class="bpl-partners">Partners</span></span></span>`;
}
