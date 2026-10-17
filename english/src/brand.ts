/* The Music Japan mark (the record with the red tonearm and sound wave from music-japan.com), drawn as half-circle
   arcs so it needs no clip paths and can repeat on a page. Cream half solid, right half faded, red details. */
const R = [27, 23.6, 20.2, 16.8, 13.4, 10];
const W = [2, 1.9, 1.8, 1.7, 1.6, 1.5];
const arc = (r: number, side: 0 | 1) => `M32 ${32 - r}A${r} ${r} 0 0 ${side} 32 ${32 + r}`;

export function mark(cls = 'mark') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" fill="none">
    <g stroke="currentColor">${R.map((r, i) => `<path d="${arc(r, 0)}" stroke-width="${W[i]}"/>`).join('')}</g>
    <g stroke="currentColor" stroke-opacity=".55">${R.map((r, i) => `<path d="${arc(r, 1)}" stroke-width="${(W[i] * 0.55).toFixed(2)}"/>`).join('')}</g>
    <path class="mark__red" d="M24.6 31A7.6 7.6 0 0 1 31.4 24.4" stroke-width="1.3" stroke-linecap="round"/>
    <circle class="mark__dot" cx="34.6" cy="24.4" r="1.55"/>
    <path class="mark__red" d="M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

export function logo(cls = '') {
  return `<span class="logo ${cls}">${mark('logo__mark')}<span class="logo__txt"><span class="logo__word">ENGLISH</span><span class="logo__by">MUSIC JAPAN</span></span></span>`;
}
