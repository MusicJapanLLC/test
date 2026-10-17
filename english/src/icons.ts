/* One line-icon set for the whole app (24px grid, 1.8 stroke, round ends). No emoji anywhere in the UI. */
const S = (body: string, extra = '') =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

export const I = {
  today: S('<circle cx="12" cy="12" r="9"/><path d="M10 8.6v6.8l5.4-3.4z" fill="currentColor" stroke="none"/>'),
  records: S('<rect x="2.8" y="5" width="11.5" height="14" rx="1"/><circle cx="15.5" cy="12" r="5.8"/><circle cx="15.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
  shuffle: S('<path d="M3 7h3.4c2 0 3.2 1 4.2 2.7l2.6 4.7c1 1.7 2.2 2.6 4.2 2.6H21M3 17h3.4c1.3 0 2.3-.4 3.1-1.2M14.4 8.2c.8-.8 1.8-1.2 3-1.2H21M18.6 4.6 21 7l-2.4 2.4M18.6 14.6 21 17l-2.4 2.4"/>'),
  me: S('<circle cx="12" cy="8.4" r="3.8"/><path d="M4.6 20c1.2-3.6 4-5.4 7.4-5.4s6.2 1.8 7.4 5.4"/>'),
  search: S('<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.8 4.8"/>'),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: S('<path d="m5 12.6 4.4 4.4L19 7.4"/>'),
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  next: S('<path d="m9 5 7 7-7 7"/>'),
  play: S('<path d="M8 5.4v13.2L18.6 12z" fill="currentColor" stroke="none"/>'),
  pause: S('<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>'),
  speaker: S('<path d="M4 9.4h3.4L12 5.8v12.4l-4.6-3.6H4z" fill="currentColor" stroke="none"/><path d="M15.4 9a4 4 0 0 1 0 6M18 6.4a7.6 7.6 0 0 1 0 11.2"/>'),
  prev: S('<path d="M17 6v12L8.6 12z" fill="currentColor" stroke="none"/><path d="M7 6v12"/>'),
  skip: S('<path d="M7 6v12l8.4-6z" fill="currentColor" stroke="none"/><path d="M17 6v12"/>'),
  bookmark: S('<path d="M7 4h10v16l-5-3.8L7 20z"/>'),
  share: S('<path d="M12 15V4M8 8l4-4 4 4M5 13v6.5h14V13"/>'),
  flame: S('<path d="M12 21c-3.8 0-6.4-2.6-6.4-6.1 0-3.1 2.1-5.2 3.5-7.5.3 1.6 1.1 2.7 2.2 3.3.2-2.9 1.4-5.3 3.4-7 .3 2.8 1.7 4.4 2.9 6 1 1.4 1.8 3 1.8 5.2C19.4 18.4 16 21 12 21z"/>'),
  eye: S('<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: S('<path d="M2.5 12S6 5.6 12 5.6c1.6 0 3 .4 4.2 1.1M21.5 12s-1.2 2.3-3.5 4.1M9.4 17.9c.8.3 1.7.5 2.6.5"/><path d="M4 20 20 4"/>'),
  headphones: S('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.4" height="6.6" rx="1.2"/><rect x="16.6" y="14" width="4.4" height="6.6" rx="1.2"/>'),
  repeat: S('<path d="M4 11V9.4A3.4 3.4 0 0 1 7.4 6H19M16 3l3 3-3 3M20 13v1.6a3.4 3.4 0 0 1-3.4 3.4H5M8 21l-3-3 3-3"/>'),
  more: S('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  spark: S('<path d="M12 3.5l1.9 5.2 5.6.3-4.4 3.5 1.5 5.4L12 14.8l-4.6 3.1 1.5-5.4L4.5 9l5.6-.3z"/>'),
  swipe: S('<path d="M8 8 4 12l4 4M16 8l4 4-4 4M4 12h16"/>'),
  key: S('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'),
};

export type IconName = keyof typeof I;
