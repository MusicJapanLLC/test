import '../styles/library.css';
import { unlock } from '../lib/achievements';
import { local } from '../lib/storage';
import { startPage } from './common';

startPage();
unlock('library');

const list = document.querySelector<HTMLElement>('[data-lib]');
const empty = document.querySelector<HTMLElement>('[data-lib-empty]');
const countEl = document.querySelector<HTMLElement>('[data-lib-count]');
const items = Array.from(document.querySelectorAll<HTMLElement>('.lib-item:not(.lib-item--next)'));

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn, _i, all) => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter ?? 'ALL';
    all.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    let shown = 0;
    items.forEach((el) => {
      const ok = f === 'ALL' || (el.dataset.platforms ?? '').split(' ').includes(f);
      el.hidden = !ok;
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = String(shown);
    if (empty) empty.hidden = shown > 0;
  });
});

const VIEW_KEY = 'mjstore:libview';
const setView = (v: string) => {
  if (!list) return;
  list.dataset.view = v;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
    if (b === list) return;
    const on = b.dataset.view === v;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  local.set(VIEW_KEY, v);
};
document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view ?? 'grid')),
);
const saved = local.get(VIEW_KEY);
if (saved === 'list' || saved === 'grid') setView(saved);
