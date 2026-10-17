/* Listening drill for a record: plays every phrase and line in order, like a playlist.
   Listen = short pauses. Shadow = a pause as long as the line, so you can say it back.
   "Hide text" turns it into a pure ear test. */
import type { Card, RecordMeta } from './types';
import { recCards } from './feed';
import { esc, accentOf, hostOf, mark, recCode } from './render';
import { lineKeys, playSeq, preload, stop, textFor } from './audio';
import { state } from './store';
import { I } from './icons';
import { $, mountBots } from './ui';
import type { Bot } from './robots/crew';

let host: HTMLElement;
let cards: Card[] = [];
let at = 0;
let playingNow = false;
let mode: 'listen' | 'shadow' = 'listen';
let hideText = false;
let onClose: () => void = () => {};

export function openDrill(r: RecordMeta, close: () => void, start = 0) {
  onClose = close;
  cards = recCards(r.id);
  at = Math.max(0, Math.min(start, cards.length - 1));
  host = $('#session');
  history.pushState({ mjOverlay: 1 }, '');
  host.hidden = false;
  document.body.classList.add('in-session');
  host.innerHTML = `
    <div class="drill" style="--acc:${accentOf(r)}">
      <header class="sess__top">
        <button type="button" class="icon-btn" data-quit aria-label="Close">${I.close}</button>
        <p class="drill__rec mono">${esc(recCode(r))} · ${esc(r.t.toUpperCase())} · LISTENING</p>
        <span class="sess__count mono"></span>
      </header>
      <div class="drill__stage">
        <span class="drill__bot" data-bot="${hostOf(r)}"></span>
        <div class="drill__disc" aria-hidden="true"></div>
        <div class="drill__now" aria-live="polite"></div>
      </div>
      <div class="drill__opts">
        <div class="seg" role="group" aria-label="Mode">
          <button type="button" data-mode="listen" aria-pressed="true">Listen</button>
          <button type="button" data-mode="shadow" aria-pressed="false">Shadow</button>
        </div>
        <button type="button" class="chip" data-hide aria-pressed="false">${I.eyeOff}<span>Hide text</span></button>
      </div>
      <footer class="drill__ctrl">
        <button type="button" class="icon-btn icon-btn--lg" data-prev aria-label="Previous">${I.prev}</button>
        <button type="button" class="playbig" data-toggle aria-label="Play">${I.play}</button>
        <button type="button" class="icon-btn icon-btn--lg" data-skip aria-label="Next">${I.skip}</button>
      </footer>
    </div>`;
  mountBots(host);
  $('[data-quit]', host).addEventListener('click', closeDrill);
  $('[data-prev]', host).addEventListener('click', () => { at = Math.max(0, at - 1); restart(); });
  $('[data-skip]', host).addEventListener('click', () => { at = Math.min(cards.length - 1, at + 1); restart(); });
  $('[data-toggle]', host).addEventListener('click', () => (playingNow ? pause() : loop()));
  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode as 'listen' | 'shadow';
    host.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const hide = $<HTMLButtonElement>('[data-hide]', host);
  hide.addEventListener('click', () => {
    hideText = !hideText;
    hide.setAttribute('aria-pressed', String(hideText));
    host.querySelector('.drill')!.classList.toggle('is-hidden-text', hideText);
  });
  window.addEventListener('keydown', onKey);
  draw(null);
}

export const drillOpen = () => !!host?.querySelector('.drill');

export function closeDrill() {
  pause();
  window.removeEventListener('keydown', onKey);
  host.hidden = true;
  host.replaceChildren();
  document.body.classList.remove('in-session');
  if ((history.state as { mjOverlay?: number } | null)?.mjOverlay) history.back();
  onClose();
}

function draw(key: string | null) {
  const c = cards[at];
  if (!c) return;
  $('.sess__count', host).textContent = `${at + 1}/${cards.length}`;
  const lines = ['h', ...lineKeys(c)];
  $('.drill__now', host).innerHTML = `
    <p class="drill__head${key === 'h' ? ' is-on' : ''}">${esc(c.h)}</p>
    <p class="drill__ja" lang="ja">${esc(c.ja)}</p>
    <ol class="drill__lines">${lines.slice(1).map((k) => `<li class="${k === key ? 'is-on' : ''}">${mark(textFor(c, k), c.h)}</li>`).join('')}</ol>`;
}

async function loop() {
  playingNow = true;
  host.querySelector('[data-toggle]')!.innerHTML = I.pause;
  host.querySelector('.drill')!.classList.add('is-playing');
  const bot = (host.querySelector('[data-bot]') as HTMLElement & { bot?: Bot }).bot;
  bot?.act('dance', 600000);
  while (playingNow && at < cards.length) {
    const c = cards[at];
    if (cards[at + 1]) void preload(cards[at + 1]);
    const keys = ['h', ...lineKeys(c)];
    const ok = await playSeq(c, state.settings.slow ? ['hs', ...keys.slice(1)] : keys,
      (dur) => (mode === 'shadow' ? dur * 1.15 + 0.6 : 0.45), (k) => draw(k === 'hs' ? 'h' : k));
    if (!ok || !playingNow) return;
    if (at < cards.length - 1) at++;
    else { pause(); return; }
    draw(null);
    await new Promise((r) => setTimeout(r, 500));
  }
}

function pause() {
  playingNow = false;
  stop();
  if (!host?.isConnected) return;
  const t = host.querySelector('[data-toggle]');
  if (t) t.innerHTML = I.play;
  host.querySelector('.drill')?.classList.remove('is-playing');
  ((host.querySelector('[data-bot]') as HTMLElement & { bot?: Bot } | null)?.bot)?.act('idle');
}

function restart() {
  const was = playingNow;
  pause();
  draw(null);
  if (was) void loop();
}

function onKey(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  if (k === 'escape') closeDrill();
  else if (k === ' ') { e.preventDefault(); if (playingNow) pause(); else void loop(); }
  else if (k === 'arrowright') { at = Math.min(cards.length - 1, at + 1); restart(); }
  else if (k === 'arrowleft') { at = Math.max(0, at - 1); restart(); }
}
