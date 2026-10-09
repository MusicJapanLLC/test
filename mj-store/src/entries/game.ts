import '../styles/game.css';
import { games } from '../data/games';
import { unlock, visitGame } from '../lib/achievements';
import { startPage } from './common';

startPage();

const main = document.querySelector<HTMLElement>('[data-game]');
const id = main?.dataset.game;
if (id) visitGame(id, games.map((g) => g.id));

/* ヒーローを過ぎたら、下に購入バーを出す */
const anchor = document.querySelector('[data-buy-anchor]');
const bar = document.querySelector<HTMLElement>('[data-buybar]');
if (anchor && bar) {
  new IntersectionObserver(([e]) => {
    const past = !e.isIntersecting && e.boundingClientRect.top < 0;
    bar.classList.toggle('is-on', past);
    bar.setAttribute('aria-hidden', String(!past));
  }).observe(anchor);
}

/* バージョン履歴を最後まで読んだら */
const end = document.querySelector('[data-versions-end]');
if (end) {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      unlock('patch');
      io.disconnect();
    }
  });
  io.observe(end);
}
