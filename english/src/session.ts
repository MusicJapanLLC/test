/* A study session: one card at a time, recorded voice first, meaning behind one button,
   then "Again" or "Got it" (or swipe). Cards you miss come back later in the same session.
   It ends with a short check (max 5 questions) and a result screen with the crew. */
import type { Card, Quiz } from './types';
import { makeQuiz, shuffle } from './feed';
import { ACCENT, crewDance, esc, headSize, hostOf, linesHtml, meaningHtml, metaRow, onActive, recCode, recOf, renderQuiz, sourceHtml, wireAudio } from './render';
import { Bot } from './robots/crew';
import { grade, logDay, markGoal, rollDay, save, state, status } from './store';
import { play, preload, stop } from './audio';
import { sfx } from './sfx';
import { I } from './icons';
import { $, band, floatXP, mountBots, party, vibrate } from './ui';

export interface SessionSpec {
  title: string;
  cards: Card[];
  /** where "Done" goes */
  back: string;
  /** offer "keep going" with a fresh spec */
  more?: () => SessionSpec | null;
  /** test only: skip the cards and go straight to questions */
  quiz?: boolean;
}

type Item = { c: Card; fresh: boolean; again: number };

let host: HTMLElement;
let spec: SessionSpec;
let queue: Item[] = [];
let total = 0;
let doneN = 0;
let learned = 0;
let reviewed = 0;
let missed = new Set<string>();
let current: Item | null = null;
let revealed = false;
/** this card is shown Japanese-first (recall mode) */
let reversed = false;
let onClose: () => void = () => {};
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

export const sessionOpen = () => !!host?.isConnected && !host.hidden;

export function startSession(s: SessionSpec, close: () => void) {
  spec = s;
  onClose = close;
  host = $('#session');
  if (host.hidden) history.pushState({ mjOverlay: 1 }, ''); // so the phone's Back button closes the session
  host.hidden = false;
  document.body.classList.add('in-session');
  queue = s.cards.map((c) => ({ c, fresh: status(c.id) === 'new', again: 0 }));
  total = queue.length;
  doneN = 0; learned = 0; reviewed = 0; missed = new Set();
  host.innerHTML = `
    <div class="sess">
      <header class="sess__top">
        <button type="button" class="icon-btn" data-quit aria-label="Close">${I.close}</button>
        <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"><i></i></div>
        <span class="sess__count mono"></span>
        <button type="button" class="icon-btn" data-opts aria-label="Card options" aria-expanded="false">${I.more}</button>
      </header>
      <div class="sess__opts" hidden></div>
      <div class="sess__stage"></div>
      <footer class="sess__actions"></footer>
    </div>`;
  $('[data-quit]', host).addEventListener('click', () => endSession());
  $('[data-opts]', host).addEventListener('click', toggleOpts);
  for (const it of queue.slice(0, 3)) void preload(it.c);
  keyHandler = onKey;
  window.addEventListener('keydown', keyHandler);
  if (s.quiz) { checkRound(10); return; }
  nextCard();
}

/* quick settings without leaving the session */
const OPTS: [keyof typeof state.settings, string, [string | boolean, string][]][] = [
  ['front', 'Card front', [['en', 'English'], ['ja', '日本語']]],
  ['ja', 'Meaning', [['tap', 'On tap'], ['show', 'Always']]],
  ['autoplay', 'Voice', [[true, 'Auto'], [false, 'Off']]],
  ['slow', 'Speed', [[false, 'Normal'], [true, 'Slow']]],
];

function toggleOpts() {
  const box = $('.sess__opts', host);
  const btn = $('[data-opts]', host);
  const open = box.hidden;
  btn.setAttribute('aria-expanded', String(open));
  if (!open) { box.hidden = true; return; }
  box.innerHTML = OPTS.map(([k, label, opts]) => `<div class="set"><p>${label}</p><div class="seg" role="group">${opts.map(([v, t]) => `<button type="button" data-o="${k}" data-v="${v}" aria-pressed="${state.settings[k] === v}"${t === '日本語' ? ' lang="ja"' : ''}>${t}</button>`).join('')}</div></div>`).join('')
    + '<p class="muted">日本語 front: see the meaning, say it in English, then check.</p>';
  box.hidden = false;
  box.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.o as keyof typeof state.settings;
    const raw = b.dataset.v!;
    (state.settings as unknown as Record<string, unknown>)[k] = raw === 'true' ? true : raw === 'false' ? false : raw;
    save();
    box.querySelectorAll(`[data-o="${k}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (current && (k === 'front' || k === 'ja')) renderCurrent();
  }));
}

export function endSession() {
  stop();
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  host.hidden = true;
  host.replaceChildren();
  document.body.classList.remove('in-session');
  if ((history.state as { mjOverlay?: number } | null)?.mjOverlay) history.back();
  onClose();
}

function progress() {
  const p = total ? doneN / total : 1;
  $<HTMLElement>('.prog i', host).style.width = `${Math.round(p * 100)}%`;
  $('.prog', host).setAttribute('aria-valuenow', String(doneN));
  $('.sess__count', host).textContent = `${Math.min(doneN + 1, total)}/${total}`;
}

function nextCard() {
  stop();
  current = queue.shift() ?? null;
  if (!current) { checkRound(); return; }
  if (queue[0]) void preload(queue[0].c);
  progress();
  renderCurrent();
}

function autoPlay(card: HTMLElement, c: Card) {
  if (!state.settings.autoplay) return;
  const key = state.settings.slow ? 'hs' : 'h';
  const b = card.querySelector<HTMLElement>(`[data-key="${key}"]`);
  b?.classList.add('is-playing');
  void play(c, key).then(() => b?.classList.remove('is-playing'));
}

function renderCurrent() {
  stop();
  const it = current!;
  const c = it.c;
  const r = recOf(c);
  // Japanese-first only makes sense for phrases people should actually say
  reversed = state.settings.front === 'ja' && (c.k === 'w' || c.re === 'real');
  revealed = !reversed && state.settings.ja === 'show';
  const stage = $('.sess__stage', host);
  stage.innerHTML = `
    <article class="scard${reversed ? ' is-rev' : ''}" style="--acc:${ACCENT[c.s]}">
      <div class="scard__top">
        <p class="scard__rec mono">${esc(recCode(r))} · ${esc((r?.t ?? '').toUpperCase())}</p>
        <span class="pill ${it.again ? 'pill--again' : it.fresh ? 'pill--new' : 'pill--rev'}">${it.again ? 'Again' : it.fresh ? 'New' : 'Review'}</span>
      </div>
      <span class="scard__bot" data-bot="${hostOf(r)}"></span>
      ${metaRow(c)}
      ${reversed ? `<div class="scard__jafront"><p class="eyebrow">Say it in English</p><p class="ja ja--big" lang="ja">${esc(c.ja)}</p>${c.k === 'w' && c.d ? `<p class="muted">Hint: ${esc(c.d)}</p>` : ''}</div>` : ''}
      <div class="scard__en" ${reversed ? 'hidden' : ''}>
        <h2 class="head head--${headSize(c.h)}${c.re && c.re !== 'real' ? ' head--strike' : ''}">${esc(c.h)}</h2>
        ${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
        <div class="playrow">
          <button type="button" class="btn btn--play" data-key="h">${I.play}<span>Play</span></button>
          <button type="button" class="btn btn--ghost" data-key="hs"><span class="mono">0.75×</span><span>Slow</span></button>
        </div>
        ${c.k === 'w' && c.d && !reversed ? `<p class="wdef">${esc(c.d)}</p>` : ''}
        ${sourceHtml(c)}
        ${linesHtml(c)}
      </div>
      <div class="meaning" ${revealed ? '' : 'hidden'}>${meaningHtml(c)}</div>
    </article>
    <p class="swipe-hint" aria-hidden="true"><span>${I.back} Again</span><span>Got it ${I.next}</span></p>`;
  const card = $('.scard', stage);
  mountBots(stage, { auto: false });
  const bot = ($('.scard__bot', stage) as HTMLElement & { bot?: Bot }).bot;
  wireAudio(card, c, () => bot?.act('dance', 1600));
  stage.scrollTop = 0;
  drawActions();
  swipe(card);
  if (!reversed) autoPlay(card, c);
}

function drawActions() {
  const foot = $('.sess__actions', host);
  if (!revealed) {
    foot.innerHTML = reversed
      ? `<button type="button" class="btn btn--wide btn--reveal" data-reveal><span lang="ja">答えを見る</span><span>Show answer</span><kbd>Space</kbd></button>`
      : `<button type="button" class="btn btn--wide btn--reveal" data-reveal><span lang="ja">意味を見る</span><span>Show meaning</span><kbd>Space</kbd></button>`;
    $('[data-reveal]', foot).addEventListener('click', reveal);
  } else {
    foot.innerHTML = `
      <button type="button" class="btn btn--again" data-grade="0">${I.repeat}<span>Again</span><kbd>1</kbd></button>
      <button type="button" class="btn btn--got" data-grade="1">${I.check}<span>Got it</span><kbd>2</kbd></button>`;
    foot.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.grade === '1')));
  }
}

function reveal() {
  if (revealed || !current) return;
  revealed = true;
  sfx.flip();
  const m = $('.scard .meaning', host);
  m.hidden = false;
  if (reversed) {
    const en = $('.scard__en', host);
    en.hidden = false;
    autoPlay($('.scard', host), current.c);
  }
  const bot = ($('.scard__bot', host) as HTMLElement & { bot?: Bot }).bot;
  const c = current.c;
  bot?.act(c.re && c.re !== 'real' ? (c.re === 'cringe' ? 'dizzy' : 'think') : 'wow');
  drawActions();
  // bring the meaning up to about a third of the screen (never scroll the phrase fully away)
  requestAnimationFrame(() => {
    const stage = $('.sess__stage', host);
    const top = m.getBoundingClientRect().top - stage.getBoundingClientRect().top;
    if (top > stage.clientHeight * 0.55) stage.scrollBy({ top: top - stage.clientHeight * 0.3, behavior: 'smooth' });
  });
}

function answer(ok: boolean) {
  if (!current) return;
  const it = current;
  const card = $('.scard', host);
  const bot = ($('.scard__bot', host) as HTMLElement & { bot?: Bot }).bot;
  rollDay();
  grade(it.c.id, ok);
  if (ok) {
    if (it.fresh) { learned++; logDay('n'); } else { reviewed++; logDay('r'); }
    state.xp += it.fresh ? 10 : 6;
    state.day.right++;
    doneN++;
    state.day.done++;
    sfx.right(1);
    vibrate(12);
    bot?.act(Math.random() < 0.5 ? 'jump' : 'love');
    floatXP(it.fresh ? 10 : 6, card);
    card.classList.add('fly-right');
  } else {
    missed.add(it.c.id);
    state.day.wrong++;
    state.xp += 1;
    sfx.wrong();
    vibrate([30, 30, 30]);
    bot?.act('dizzy');
    card.classList.add('fly-left');
    // back in 3 cards, at most twice
    if (it.again < 2) queue.splice(Math.min(3, queue.length), 0, { ...it, again: it.again + 1 });
    else doneN++;
  }
  if (markGoal()) setTimeout(() => party(), 450);
  save();
  current = null;
  setTimeout(nextCard, 260);
}

/* swipe right = got it, left = again (only after the meaning was shown or on a review) */
function swipe(card: HTMLElement) {
  let x0 = 0, y0 = 0, dx = 0, on = false;
  card.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button,a,summary')) return;
    on = true; x0 = e.clientX; y0 = e.clientY; dx = 0;
  });
  card.addEventListener('pointermove', (e) => {
    if (!on) return;
    dx = e.clientX - x0;
    if (Math.abs(e.clientY - y0) > Math.abs(dx) * 1.2) { on = false; card.style.transform = ''; return; }
    card.style.transform = `translateX(${dx * 0.9}px) rotate(${dx / 40}deg)`;
    card.dataset.lean = dx > 40 ? 'got' : dx < -40 ? 'again' : '';
  });
  const end = () => {
    if (!on) return;
    on = false;
    card.dataset.lean = '';
    if (Math.abs(dx) > 90) {
      if (!revealed) { revealed = true; }
      answer(dx > 0);
    } else card.style.transform = '';
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', () => { on = false; card.style.transform = ''; card.dataset.lean = ''; });
}

/* ── the check: up to 5 quick questions from this session, missed cards first ── */

let checkQs: Quiz[] = [];
let checkRight = 0;

function checkRound(n = 5) {
  const seen = spec.cards;
  const pool = [...seen.filter((c) => missed.has(c.id)), ...shuffle(seen.filter((c) => !missed.has(c.id)))];
  checkQs = pool.slice(0, n).map((c) => makeQuiz(c, false)).filter((q): q is Quiz => !!q);
  checkRight = 0;
  if (checkQs.length < 2) { finish(); return; }
  $('.sess__count', host).textContent = 'Check';
  $<HTMLElement>('.prog i', host).style.width = '100%';
  nextQuiz(0);
}

function nextQuiz(i: number) {
  stop();
  const q = checkQs[i];
  if (!q) { finish(); return; }
  const stage = $('.sess__stage', host);
  const foot = $('.sess__actions', host);
  foot.innerHTML = `<p class="mono sess__qn">Check ${i + 1} / ${checkQs.length}</p>`;
  const el = renderQuiz(q, (qq, ok, node) => {
    grade(qq.card.id, ok);
    if (ok) { checkRight++; state.xp += 8; sfx.right(checkRight); crewDance($('.quiz__crew', node), checkRight); floatXP(8, node); }
    else { sfx.wrong(); crewDance($('.quiz__crew', node), 1, 'dizzy'); }
    save();
    foot.innerHTML = `<button type="button" class="btn btn--got btn--wide" data-next>${i + 1 < checkQs.length ? 'Next' : 'See results'}${I.next}<kbd>Enter</kbd></button>`;
    $('[data-next]', foot).addEventListener('click', () => nextQuiz(i + 1));
  });
  stage.replaceChildren(el);
  stage.scrollTop = 0;
  onActive.get(el)?.();
}

function finish() {
  stop();
  const stage = $('.sess__stage', host);
  const acc = checkQs.length ? Math.round((checkRight / checkQs.length) * 100) : null;
  stage.innerHTML = `
    <section class="result">
      <p class="eyebrow">${spec.quiz ? 'Test done' : 'Session done'}</p>
      <h2 class="result__title">${spec.quiz ? `${checkRight} of ${checkQs.length} right.` : learned ? `${learned} new in your head.` : 'All reviewed.'}</h2>
      ${band()}
      <dl class="stats">
        <div><dt>New</dt><dd>${learned}</dd></div>
        <div><dt>Reviewed</dt><dd>${reviewed}</dd></div>
        <div><dt>Check</dt><dd>${acc === null ? '–' : `${acc}%`}</dd></div>
        <div><dt>Today</dt><dd>${state.day.done}<small>/${state.settings.goal}</small></dd></div>
      </dl>
      ${missed.size ? `<p class="result__note">${missed.size} card${missed.size > 1 ? 's' : ''} you missed will come back tomorrow.</p>` : ''}
    </section>`;
  mountBots(stage, { tap: true });
  stage.querySelectorAll<HTMLElement & { bot?: Bot }>('[data-bot]').forEach((h, i) => setTimeout(() => h.bot?.act('dance', 3600), i * 120));
  sfx.goal();
  const more = spec.more?.();
  const foot = $('.sess__actions', host);
  foot.innerHTML = `
    <button type="button" class="btn btn--again" data-done>Done</button>
    ${more && more.cards.length ? `<button type="button" class="btn btn--got" data-more>${I.play}<span>${more.cards.length} more</span></button>` : ''}`;
  $('[data-done]', foot).addEventListener('click', () => endSession());
  foot.querySelector('[data-more]')?.addEventListener('click', () => { const keep = onClose; startSession(more!, keep); });
  save();
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { endSession(); return; }
  const quiz = host.querySelector<HTMLElement & { pick?: (i: number) => void }>('.quiz');
  if (quiz) {
    if (/^[1-4]$/.test(k) && !quiz.classList.contains('is-done')) { quiz.pick?.(Number(k) - 1); e.preventDefault(); }
    else if ((k === 'enter' || k === ' ') && quiz.classList.contains('is-done')) { host.querySelector<HTMLButtonElement>('[data-next]')?.click(); e.preventDefault(); }
    return;
  }
  if (!current) {
    if (k === 'enter' || k === ' ') { host.querySelector<HTMLButtonElement>('[data-more]')?.click(); e.preventDefault(); }
    return;
  }
  if (k === ' ' || k === 'enter') { e.preventDefault(); if (!revealed) reveal(); else answer(true); }
  else if (k === '1' || k === 'arrowleft') { if (revealed) answer(false); }
  else if (k === '2' || k === 'arrowright') { if (revealed) answer(true); }
  else if (k === 'p') host.querySelector<HTMLButtonElement>('.scard [data-key="h"]')?.click();
  else if (k === 's') host.querySelector<HTMLButtonElement>('.scard [data-key="hs"]')?.click();
}
