/**
 * 挿し絵（SVGの線画）。線は pathLength="1" にそろえ、画面に入ったら CSS で描く（.ill の .is-in）。
 * 色は墨（currentColor）と、差し色の赤（var(--accent)）だけ。
 */

const sheet = (x: number, y: number, w: number, h: number, cls = '') =>
  `<rect class="ill-line ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="5" pathLength="1"/>`;

/** Baton Partners：5枚のページが少しずつずれて重なる。いちばん手前に、会社のトップページ */
export function illustPartners(): string {
  const back = [4, 3, 2, 1]
    .map((k) => `<g class="ill-sheet" style="--k:${k}">${sheet(58 + k * 13, 30 - k * 5, 108, 132, 'ill-soft')}</g>`)
    .join('');
  return `<svg class="ill ill-partners" viewBox="0 0 240 180" aria-hidden="true">
  ${back}
  <g class="ill-front">
    <rect class="ill-paper" x="44" y="36" width="108" height="132" rx="5"/>
    ${sheet(44, 36, 108, 132)}
    <path class="ill-line" d="M54 48h18M118 48h24" pathLength="1"/>
    <rect class="ill-fill ill-accent" x="54" y="58" width="88" height="40" rx="3"/>
    <path class="ill-line ill-thick" d="M54 110h62M54 120h76M54 130h48" pathLength="1"/>
    <rect class="ill-line" x="54" y="142" width="34" height="12" rx="6" pathLength="1"/>
  </g>
</svg>`;
}

/** Baton：プロフィールのカード。下で、ふたりのあいだを赤いバトンが渡る */
export function illustBaton(): string {
  const rings = [21, 16, 11]
    .map((r, i) => `<circle class="ill-line ${i ? 'ill-soft' : ''}" cx="78" cy="64" r="${r}" pathLength="1"/>`)
    .join('');
  return `<svg class="ill ill-baton" viewBox="0 0 240 180" aria-hidden="true">
  <rect class="ill-paper" x="34" y="20" width="172" height="142" rx="12"/>
  <rect class="ill-line" x="34" y="20" width="172" height="142" rx="12" pathLength="1"/>
  ${rings}
  <circle class="ill-fill ill-accent" cx="78" cy="64" r="4"/>
  <path class="ill-line ill-thick" d="M112 56h70" pathLength="1"/>
  <path class="ill-line" d="M112 70h52M112 82h60" pathLength="1"/>
  <path class="ill-line ill-soft" d="M50 108h140" pathLength="1"/>
  <circle class="ill-line" cx="66" cy="136" r="9" pathLength="1"/>
  <circle class="ill-line" cx="174" cy="136" r="9" pathLength="1"/>
  <g class="ill-pass"><rect class="ill-fill ill-accent" x="80" y="132" width="80" height="8" rx="4"/></g>
</svg>`;
}

/** SECOND TAKE：カチンコ（撮り直しの2回目） */
export function illustSecondTake(): string {
  const stripes = [0, 1, 2, 3, 4, 5]
    .map((i) => `<path class="ill-fill ${i % 2 ? 'ill-paper' : 'ill-ink'}" d="M${52 + i * 24} 40h24l-12 18h-24z"/>`)
    .join('');
  return `<svg class="ill ill-st" viewBox="0 0 240 180" aria-hidden="true">
  <defs><clipPath id="ill-st-clap"><rect x="46" y="40" width="148" height="18" rx="3"/></clipPath></defs>
  <g class="ill-clap"><g clip-path="url(#ill-st-clap)">${stripes}</g><rect class="ill-line" x="46" y="40" width="148" height="18" rx="3" pathLength="1"/></g>
  <rect class="ill-paper" x="46" y="64" width="148" height="92" rx="5"/>
  <rect class="ill-line" x="46" y="64" width="148" height="92" rx="5" pathLength="1"/>
  <path class="ill-line ill-soft" d="M46 88h148M120 88v68" pathLength="1"/>
  <text class="ill-text" x="58" y="81">SECOND TAKE</text>
  <text class="ill-text ill-small" x="58" y="106">SCENE</text>
  <text class="ill-text ill-small" x="132" y="106">TAKE</text>
  <text class="ill-num" x="160" y="146" text-anchor="middle">2</text>
  <path class="ill-line ill-accent-line" d="M58 136c6-10 10 10 16 0s10 10 16 0 10 10 16 0" pathLength="1"/>
</svg>`;
}

/** 公開中のページ：ブラウザの画面が2枚と、スマホ。奥の画面には Central AX の立方体 */
export function illustWorks(): string {
  return `<svg class="ill ill-works" viewBox="0 0 240 180" aria-hidden="true">
  <g class="ill-back">
    <rect class="ill-paper" x="78" y="16" width="146" height="100" rx="8"/>
    <rect class="ill-line ill-soft" x="78" y="16" width="146" height="100" rx="8" pathLength="1"/>
    <path class="ill-line ill-soft" d="M78 31h146M90 46h44M90 56h30" pathLength="1"/>
    <path class="ill-line" d="M172 66l12-6 12 6v14l-12 6-12-6zM172 66l12 6 12-6M184 72v14" pathLength="1"/>
    <path class="ill-line ill-soft" d="M196 84l9-4 9 4v10l-9 4-9-4zM196 84l9 4 9-4M205 88v10" pathLength="1"/>
  </g>
  <g class="ill-front">
    <rect class="ill-paper" x="16" y="48" width="146" height="100" rx="8"/>
    <rect class="ill-line" x="16" y="48" width="146" height="100" rx="8" pathLength="1"/>
    <path class="ill-line" d="M16 63h146" pathLength="1"/>
    <circle class="ill-fill ill-accent" cx="26" cy="55.5" r="2.4"/>
    <circle class="ill-line" cx="34" cy="55.5" r="2.4" pathLength="1"/>
    <circle class="ill-line" cx="42" cy="55.5" r="2.4" pathLength="1"/>
    <path class="ill-line ill-thick" d="M28 80h58M28 92h40" pathLength="1"/>
    <path class="ill-line ill-soft" d="M28 106h70M28 114h56" pathLength="1"/>
    <circle class="ill-line ill-accent-line" cx="128" cy="100" r="18" pathLength="1"/>
    <circle class="ill-line ill-soft" cx="128" cy="100" r="10" pathLength="1"/>
  </g>
  <g class="ill-phone">
    <rect class="ill-paper" x="146" y="92" width="42" height="76" rx="7"/>
    <rect class="ill-line" x="146" y="92" width="42" height="76" rx="7" pathLength="1"/>
    <path class="ill-line ill-thick" d="M154 110h24M154 119h16" pathLength="1"/>
    <path class="ill-line ill-soft" d="M154 132h26M154 139h20M154 146h24" pathLength="1"/>
  </g>
</svg>`;
}

/** お知らせ：日付のついた記録帳。いちばん上の行は「進行中」の赤い点 */
export function illustNews(): string {
  const rows = [0, 1, 2]
    .map((i) => {
      const y = 70 + i * 30;
      const dot = i === 0 ? `<circle class="ill-fill ill-accent ill-live" cx="60" cy="${y}" r="4.5"/>` : `<circle class="ill-line" cx="60" cy="${y}" r="4.5" pathLength="1"/>`;
      return `${dot}<path class="ill-line ill-thick" d="M76 ${y - 4}h${[78, 60, 70][i]}" pathLength="1"/><path class="ill-line ill-soft" d="M76 ${y + 6}h${[104, 92, 84][i]}" pathLength="1"/>`;
    })
    .join('');
  return `<svg class="ill ill-news" viewBox="0 0 240 180" aria-hidden="true">
  <rect class="ill-paper" x="40" y="24" width="160" height="140" rx="10"/>
  <rect class="ill-line" x="40" y="24" width="160" height="140" rx="10" pathLength="1"/>
  <path class="ill-line" d="M76 14v20M120 14v20M164 14v20" pathLength="1"/>
  <path class="ill-line ill-soft" d="M40 48h160M52 85h136M52 115h136" pathLength="1"/>
  <text class="ill-text" x="54" y="42">2026.10</text>
  ${rows}
</svg>`;
}

/** 会社概要：レコードの印の名刺と、大阪・梅田の場所 */
export function illustAbout(): string {
  return `<svg class="ill ill-about" viewBox="0 0 240 180" aria-hidden="true">
  <g class="ill-card">
    <rect class="ill-paper" x="22" y="46" width="152" height="96" rx="8"/>
    <rect class="ill-line" x="22" y="46" width="152" height="96" rx="8" pathLength="1"/>
    <circle class="ill-line" cx="58" cy="82" r="18" pathLength="1"/>
    <circle class="ill-line ill-soft" cx="58" cy="82" r="12.5" pathLength="1"/>
    <circle class="ill-line ill-soft" cx="58" cy="82" r="7" pathLength="1"/>
    <path class="ill-line ill-accent-line" d="M58 64a18 18 0 0 1 18 18" pathLength="1"/>
    <circle class="ill-fill ill-accent" cx="58" cy="82" r="2.6"/>
    <path class="ill-line ill-thick" d="M88 76h64M88 88h40" pathLength="1"/>
    <path class="ill-line ill-soft" d="M36 116h120M36 126h86" pathLength="1"/>
  </g>
  <g class="ill-pin">
    <path class="ill-paper" d="M192 52c-13 0-23 10-23 22 0 16 23 40 23 40s23-24 23-40c0-12-10-22-23-22z"/>
    <path class="ill-line" d="M192 52c-13 0-23 10-23 22 0 16 23 40 23 40s23-24 23-40c0-12-10-22-23-22z" pathLength="1"/>
    <circle class="ill-fill ill-accent" cx="192" cy="74" r="7"/>
  </g>
  <ellipse class="ill-line ill-soft" cx="192" cy="122" rx="18" ry="4" pathLength="1"/>
  <text class="ill-text ill-small" x="192" y="162" text-anchor="middle">UMEDA, OSAKA</text>
</svg>`;
}

/** 話してみる：ふたつの吹き出しと、空いている日に赤い印のついたカレンダー */
export function illustTalk(): string {
  const cells = Array.from({ length: 15 }, (_, i) => {
    const x = 104 + (i % 5) * 22;
    const y = 86 + Math.floor(i / 5) * 22;
    return i === 7
      ? `<rect class="ill-fill ill-accent ill-pick" x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3"/>`
      : `<circle class="ill-fill ill-ink ill-dot" cx="${x}" cy="${y}" r="1.8"/>`;
  }).join('');
  return `<svg class="ill ill-talk" viewBox="0 0 240 180" aria-hidden="true">
  <rect class="ill-paper" x="86" y="50" width="140" height="116" rx="10"/>
  <rect class="ill-line" x="86" y="50" width="140" height="116" rx="10" pathLength="1"/>
  <path class="ill-line" d="M116 40v20M196 40v20" pathLength="1"/>
  <path class="ill-line ill-soft" d="M86 72h140" pathLength="1"/>
  ${cells}
  <g class="ill-bubble ill-bubble-a">
    <path class="ill-paper" d="M22 22h66a9 9 0 0 1 9 9v22a9 9 0 0 1-9 9H48l-13 11V62H22a9 9 0 0 1-9-9V31a9 9 0 0 1 9-9z"/>
    <path class="ill-line" d="M22 22h66a9 9 0 0 1 9 9v22a9 9 0 0 1-9 9H48l-13 11V62H22a9 9 0 0 1-9-9V31a9 9 0 0 1 9-9z" pathLength="1"/>
    <path class="ill-line ill-thick" d="M28 37h42M28 47h28" pathLength="1"/>
  </g>
  <g class="ill-bubble ill-bubble-b">
    <path class="ill-paper" d="M30 104h44a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H66v10l-11-10H30a8 8 0 0 1-8-8v-16a8 8 0 0 1 8-8z"/>
    <path class="ill-line" d="M30 104h44a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H66v10l-11-10H30a8 8 0 0 1-8-8v-16a8 8 0 0 1 8-8z" pathLength="1"/>
    <circle class="ill-fill ill-ink ill-typing" cx="40" cy="120" r="2.4" style="--d:0"/>
    <circle class="ill-fill ill-ink ill-typing" cx="52" cy="120" r="2.4" style="--d:1"/>
    <circle class="ill-fill ill-ink ill-typing" cx="64" cy="120" r="2.4" style="--d:2"/>
  </g>
</svg>`;
}

/** 5枚のページの小さな絵（トップ・取り組み・記事・サービス・話してみる） */
export function pageIcon(i: number): string {
  const frame = '<rect class="ill-line" x="10" y="6" width="44" height="52" rx="4" pathLength="1"/>';
  const inner = [
    '<rect class="ill-fill ill-accent" x="16" y="14" width="32" height="14" rx="2"/><path class="ill-line" d="M16 36h26M16 44h18" pathLength="1"/>',
    '<circle class="ill-line" cx="24" cy="22" r="7" pathLength="1"/><path class="ill-line" d="M35 19h13M35 26h9M16 38h32M16 46h24" pathLength="1"/>',
    '<path class="ill-line" d="M16 14h32M16 21h32M16 28h26M16 35h32M16 42h20" pathLength="1"/><rect class="ill-fill ill-accent" x="40" y="40" width="8" height="8" rx="1"/>',
    '<rect class="ill-line" x="16" y="14" width="14" height="14" rx="2" pathLength="1"/><rect class="ill-line" x="34" y="14" width="14" height="14" rx="2" pathLength="1"/><rect class="ill-line" x="16" y="32" width="14" height="14" rx="2" pathLength="1"/><rect class="ill-fill ill-accent" x="34" y="32" width="14" height="14" rx="2"/>',
    '<path class="ill-line" d="M16 16h32v18H30l-8 7v-7h-6z" pathLength="1"/><circle class="ill-fill ill-accent" cx="24" cy="25" r="2"/><circle class="ill-fill ill-accent" cx="32" cy="25" r="2"/><circle class="ill-fill ill-accent" cx="40" cy="25" r="2"/>',
  ][i];
  return `<svg class="ill ill-page" viewBox="0 0 64 64" aria-hidden="true">${frame}${inner}</svg>`;
}

/** レコード（WebGLが使えないとき、トップの右側に出す） */
export function illustRecord(): string {
  const rings = Array.from({ length: 22 }, (_, i) => {
    const r = 46 + i * 3.4;
    return `<circle cx="160" cy="160" r="${r.toFixed(1)}" class="rec-groove" style="--i:${i}"/>`;
  }).join('');
  return `<svg class="rec-svg" viewBox="0 0 320 320" aria-hidden="true">
  <circle cx="160" cy="160" r="124" class="rec-disc"/>
  ${rings}
  <circle cx="160" cy="160" r="38" class="rec-label"/>
  <circle cx="160" cy="160" r="4" class="rec-hole"/>
  <path d="M160 64a96 96 0 0 1 96 96" class="rec-arc"/>
</svg>`;
}
