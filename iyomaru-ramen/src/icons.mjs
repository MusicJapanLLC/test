// Inline SVG icon set. All icons are 24x24, stroke-based, currentColor.
// Kept as plain strings (no build-time SVG optimizer) to stay dependency-free.

const wrap = (paths, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const icons = {
  wheat: wrap(`
    <path d="M12 21V7"/>
    <path d="M12 7c0-2.5 1.5-4 3.5-4-.2 2.4-1.4 3.6-3.5 4Z"/>
    <path d="M12 7c0-2.5-1.5-4-3.5-4 .2 2.4 1.4 3.6 3.5 4Z"/>
    <path d="M12 11c0-2.2 1.4-3.5 3.2-3.5-.2 2.1-1.3 3.2-3.2 3.5Z"/>
    <path d="M12 11c0-2.2-1.4-3.5-3.2-3.5 .2 2.1 1.3 3.2 3.2 3.5Z"/>
    <path d="M12 15c0-2-1.2-3.2-2.9-3.2.2 1.9 1.2 2.9 2.9 3.2Z"/>
    <path d="M12 15c0-2 1.2-3.2 2.9-3.2-.2 1.9-1.2 2.9-2.9 3.2Z"/>
  `),
  field: wrap(`
    <path d="M3 20h18"/>
    <path d="M5 20v-5c0-2 1-3.5 3-5"/>
    <path d="M12 20v-7c0-2.2 1.2-3.8 3.2-5.2"/>
    <path d="M19 20v-4c0-1.8-.8-3-2.2-4.2"/>
    <circle cx="6" cy="7" r="1.4"/>
    <circle cx="13.5" cy="5" r="1.4"/>
    <circle cx="19.5" cy="8.5" r="1.4"/>
  `),
  fish: wrap(`
    <path d="M3 12c3-4 8-6 12-4.5 2 .8 3.5 2.4 4.5 4.5-1 2.1-2.5 3.7-4.5 4.5-4 1.5-9-.5-12-4.5Z"/>
    <path d="M15 9.5 17.5 7"/>
    <path d="M15 14.5 17.5 17"/>
    <circle cx="8" cy="11.2" r=".9" fill="currentColor" stroke="none"/>
  `),
  clock: wrap(`
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M12 7.5V12l3 2"/>
  `),
  pin: wrap(`
    <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"/>
    <circle cx="12" cy="9.5" r="2.4"/>
  `),
  phone: wrap(`
    <path d="M6 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2L21 15v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3Z"/>
  `),
  instagram: wrap(`
    <rect x="3.5" y="3.5" width="17" height="17" rx="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>
  `),
  wifi: wrap(`
    <path d="M4 9.5c4.5-4 11.5-4 16 0"/>
    <path d="M7 13c3-2.5 7-2.5 10 0"/>
    <path d="M10 16.5c1.2-1 2.8-1 4 0"/>
    <circle cx="12" cy="19.2" r="1" fill="currentColor" stroke="none"/>
  `),
  plug: wrap(`
    <path d="M9 3v4M15 3v4"/>
    <path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0V7Z"/>
    <path d="M12 16.5V21"/>
  `),
  noSmoking: wrap(`
    <path d="M3 15h11a2.5 2.5 0 0 0 0-5"/>
    <path d="M17 15h2"/>
    <path d="M4 4l16 16"/>
  `),
  parking: wrap(`
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>
  `),
  card: wrap(`
    <rect x="3" y="5.5" width="18" height="13" rx="2"/>
    <path d="M3 9.5h18"/>
    <path d="M6.5 14.5h4"/>
  `),
  qr: wrap(`
    <rect x="3.5" y="3.5" width="6" height="6" rx="1"/>
    <rect x="14.5" y="3.5" width="6" height="6" rx="1"/>
    <rect x="3.5" y="14.5" width="6" height="6" rx="1"/>
    <path d="M14.5 14.5h2.5v2.5h-2.5zM19.5 14.5h1v1h-1zM14.5 19.5h1v1h-1zM17.5 17.5h1v1h-1zM19.5 19.5h1v1h-1z" fill="currentColor" stroke="none"/>
  `),
  chair: wrap(`
    <path d="M6.5 3.5v9.5"/>
    <path d="M17.5 3.5v9.5"/>
    <path d="M6.5 8h11"/>
    <path d="M6 20.5 7 13h10l1 7.5"/>
  `),
  chevronDown: wrap(`<path d="M5 8.5 12 15.5 19 8.5"/>`),
  chevronLeft: wrap(`<path d="M15 4.5 7 12l8 7.5"/>`),
  chevronRight: wrap(`<path d="M9 4.5 17 12l-8 7.5"/>`),
  close: wrap(`<path d="M5 5l14 14M19 5 5 19"/>`),
  menuBars: wrap(`<path d="M4 6.5h16M4 12h16M4 17.5h16"/>`),
  globe: wrap(`
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M3.5 12h17"/>
    <path d="M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z"/>
  `),
  bowlMark: wrap(`
    <path d="M3 11.5h18"/>
    <path d="M4 11.5a8 8 0 0 0 16 0"/>
    <path d="M8.5 11.5c-.5-1.6.2-2.7 1.4-3.4"/>
    <path d="M12 11.5c-.4-2 .4-3.3 1.8-4.1"/>
    <path d="M15.2 11.5c-.2-1.3.3-2.2 1.2-2.9"/>
    <path d="M9 19.5h6"/>
    <path d="M10 15.5v2.3"/>
    <path d="M14 15.5v2.3"/>
  `, 'stroke-width="1.1"'),
};

export function icon(name, extraClass = '') {
  const svg = icons[name];
  if (!svg) throw new Error(`Unknown icon: ${name}`);
  return extraClass ? svg.replace('<svg ', `<svg class="${extraClass}" `) : svg;
}
