/**
 * The official Music Japan symbol: record grooves split light/shade down the middle,
 * a red arc, a red dot and the red frequency wave. Redrawn as vectors for dark grounds.
 */
const RINGS = [27, 23.6, 20.2, 16.8, 13.4, 10];

export function mark({ id = 'mk', cls = 'mj-mark', title = '' } = {}): string {
  const left = RINGS.map((r, i) => `<circle cx="32" cy="32" r="${r}" stroke-width="${(2 - i * 0.1).toFixed(2)}"/>`).join('');
  const right = RINGS.map((r, i) => `<circle cx="32" cy="32" r="${r}" stroke-width="${(1.1 - i * 0.05).toFixed(2)}"/>`).join('');
  return `<svg class="${cls}" viewBox="0 0 64 64" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}><defs><clipPath id="${id}L"><rect width="32" height="64"/></clipPath><clipPath id="${id}R"><rect x="32" width="32" height="64"/></clipPath></defs><g fill="none" stroke="currentColor"><g clip-path="url(#${id}L)">${left}</g><g clip-path="url(#${id}R)" stroke-opacity=".55">${right}</g></g><path d="M24.6 31A7.6 7.6 0 0 1 31.4 24.4" fill="none" stroke="var(--red,#e1222f)" stroke-width="1.3" stroke-linecap="round"/><circle cx="34.6" cy="24.4" r="1.55" fill="var(--red,#e1222f)"/><path d="M5 35.6C13 31.4 20 38.6 29.5 34.4 38 30.6 45 37.4 60.5 32.6" fill="none" stroke="var(--red,#e1222f)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/**
 * Intro variant: every groove is its own stroke so the opening can draw the rings from
 * the centre outwards, then the arc, the dot and the wave.
 */
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

export const markFile = () =>
  mark({ id: 'f' })
    .replace('class="mj-mark" ', 'xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll('currentColor', '#eee8df')
    .replaceAll('var(--red,#e1222f)', '#e1222f');
