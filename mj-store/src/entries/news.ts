import '../styles/news.css';
import { unlock } from '../lib/achievements';
import { startPage } from './common';

startPage();
unlock('news');

/* 作品で絞り込む */
const empty = document.querySelector<HTMLElement>('[data-news-empty]');
const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-key]'));
document.querySelectorAll<HTMLButtonElement>('[data-news-filter] [data-filter]').forEach((btn, _i, all) => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter ?? 'all';
    all.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    let shown = 0;
    rows.forEach((el) => {
      const ok = f === 'all' || el.dataset.key === f;
      el.hidden = !ok;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  });
});
