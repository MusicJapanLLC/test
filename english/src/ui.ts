/* Small shared UI helpers: toasts, XP pop, the goal party, the bottom sheet, record sleeves and track rows. */
import type { Card, RecordMeta } from './types';
import { DB, recStats } from './feed';
import { ACCENT, accentOf, esc, hostOf, kindOf, meaningHtml, metaRow, linesHtml, sourceHtml, wireAudio, recCode, recOf, headSize } from './render';
import { Bot, CREW } from './robots/crew';
import { cardState, liveStreak, save, state, status } from './store';
import { play, preload, stop } from './audio';
import { sfx } from './sfx';
import { I } from './icons';

export const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

export const go = (hash: string) => { if (location.hash !== hash) location.hash = hash; };

export function toast(text: string, kind = '') {
  const host = $('#toasts');
  const t = document.createElement('p');
  t.className = `toast ${kind}`;
  t.textContent = text;
  host.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 1900);
}

export function floatXP(n: number, from?: HTMLElement) {
  const f = document.createElement('span');
  f.className = 'xp-float';
  f.textContent = `+${n} XP`;
  const r = (from ?? document.body).getBoundingClientRect();
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top + Math.min(r.height * 0.4, 260)}px`;
  document.body.append(f);
  setTimeout(() => f.remove(), 1100);
}

export const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

/** mount a crew member (or the whole band) into every [data-bot] inside root */
export function mountBots(root: ParentNode, opts: { auto?: boolean; tap?: boolean } = {}) {
  for (const h of $$('[data-bot]', root)) {
    if (h.firstChild) continue;
    const b = new Bot(h.dataset.bot as 'tune', { auto: opts.auto ?? false });
    h.append(b.canvas);
    (h as HTMLElement & { bot?: Bot }).bot = b;
    if (opts.tap !== false) h.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); b.act(['jump', 'laugh', 'love', 'float', 'wave'][Math.floor(Math.random() * 5)] as 'jump'); sfx.tap(); });
  }
}

export const band = () => `<div class="band">${CREW.map((m) => `<span class="band__m" data-bot="${m.id}" title="${m.name}"></span>`).join('')}</div>`;

export function party(title = 'Daily goal hit.') {
  const p = $('#party');
  p.hidden = false;
  p.innerHTML = `<div class="party__in"><p class="eyebrow">Daily goal</p><p class="party__title">${esc(title)}</p><p class="party__streak">${I.flame}<b>${liveStreak()}</b> day streak</p>${band()}<p class="party__hint">Tap to keep going</p></div>`;
  mountBots(p, { tap: false });
  $$<HTMLElement & { bot?: Bot }>('[data-bot]', p).forEach((h, i) => setTimeout(() => h.bot?.act('dance', 3200), i * 90));
  sfx.goal();
  vibrate([30, 40, 30, 40, 80]);
  const close = () => { p.hidden = true; p.replaceChildren(); };
  p.onclick = close;
  setTimeout(close, 3600);
}

/* ── record sleeve (a record cover with a vinyl peeking out) ── */

export function sleeve(r: RecordMeta, opts: { big?: boolean; href?: boolean; now?: boolean } = {}) {
  const st = recStats(r.id);
  const p = st.n ? st.done / st.n : 0;
  const tag = opts.href === false ? 'div' : 'a';
  return `<${tag} class="sleeve${opts.big ? ' sleeve--big' : ''}" ${opts.href === false ? '' : `href="#/r/${r.id}"`} style="--acc:${accentOf(r)};--p:${p.toFixed(3)}">
    <span class="sleeve__art">
      <span class="sleeve__disc" aria-hidden="true"></span>
      <span class="sleeve__no">${esc(recCode(r))}</span>
      <span class="sleeve__kind">${esc(kindOf(r))}</span>
      <span class="sleeve__bot" data-bot="${hostOf(r)}"></span>
      ${opts.now ? '<span class="sleeve__now">Now playing</span>' : ''}
    </span>
    <span class="sleeve__t">${esc(r.t)}</span>
    ${opts.big ? `<span class="sleeve__sub">${esc(r.sub)}</span>` : ''}
    <span class="sleeve__p"><i></i></span>
    <span class="sleeve__n"><b>${st.done}</b>/${st.n}${st.due ? ` · <em>${st.due} due</em>` : ''}</span>
  </${tag}>`;
}

/* ── track rows (record lists and search) ── */

const DOT: Record<string, string> = { new: 'New', learning: 'Learning', known: 'Known' };

export function trackRow(c: Card, i?: number, opts: { showRec?: boolean } = {}) {
  const st = status(c.id);
  const r = recOf(c);
  return `<li class="trk" data-id="${c.id}" style="--acc:${ACCENT[c.s]}">
    <button type="button" class="trk__open">
      ${i !== undefined ? `<span class="trk__no">${String(i + 1).padStart(2, '0')}</span>` : ''}
      <span class="trk__txt"><b class="trk__h">${esc(c.h)}</b>${opts.showRec && r ? `<small class="trk__rec">${esc(r.t)}</small>` : ''}<span class="trk__ja sheetable" lang="ja">${esc(c.ja)}</span></span>
      <span class="dot dot--${st}" title="${DOT[st]}"></span>
    </button>
    <button type="button" class="trk__play" aria-label="Play ${esc(c.h)}">${I.speaker}</button>
  </li>`;
}

/** wire a list of track rows: tap = open the card, speaker = play */
export function wireTracks(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const li = t.closest<HTMLElement>('.trk');
    if (!li) return;
    const c = DB.byId.get(li.dataset.id!);
    if (!c) return;
    if (t.closest('.trk__play')) {
      const b = t.closest<HTMLElement>('.trk__play')!;
      b.classList.add('is-playing');
      void play(c, state.settings.slow ? 'hs' : 'h').then(() => b.classList.remove('is-playing'));
      return;
    }
    const ja = t.closest<HTMLElement>('.trk__ja');
    if (ja && document.body.classList.contains('red-sheet') && !ja.classList.contains('is-peek')) { ja.classList.add('is-peek'); return; }
    openCard(c);
  });
}

/* ── card sheet (full card in a bottom sheet) ── */

export function openCard(c: Card) {
  const dlg = $<HTMLDialogElement>('#sheet');
  const r = recOf(c);
  const saved = !!state.cards[c.id]?.saved;
  dlg.style.setProperty('--acc', ACCENT[c.s]);
  dlg.innerHTML = `
    <div class="sheet__in">
      <header class="sheet__top">
        <a class="sheet__rec" href="#/r/${c.rec}">${esc(recCode(r))} · ${esc(r?.t ?? '')}</a>
        <button type="button" class="icon-btn" data-close aria-label="Close">${I.close}</button>
      </header>
      ${metaRow(c)}
      <h2 class="head head--${headSize(c.h)}${c.re && c.re !== 'real' ? ' head--strike' : ''}">${esc(c.h)}</h2>
      ${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
      <div class="playrow">
        <button type="button" class="btn btn--play" data-key="h">${I.play}<span>Play</span></button>
        <button type="button" class="btn btn--ghost" data-key="hs"><span class="mono">0.75×</span><span>Slow</span></button>
        <button type="button" class="icon-btn" data-save aria-pressed="${saved}" aria-label="Save">${I.bookmark}</button>
      </div>
      ${c.k === 'w' && c.d ? `<p class="wdef">${esc(c.d)}</p>` : ''}
      ${sourceHtml(c)}
      ${linesHtml(c)}
      <div class="meaning">${meaningHtml(c)}</div>
    </div>`;
  wireAudio(dlg, c);
  $('[data-close]', dlg).addEventListener('click', () => dlg.close());
  $('.sheet__rec', dlg).addEventListener('click', () => dlg.close());
  const sb = $<HTMLButtonElement>('[data-save]', dlg);
  sb.addEventListener('click', () => {
    const s = cardState(c.id);
    s.saved = !s.saved;
    if (s.saved && !s.due) s.due = Date.now() + 12 * 3600 * 1000;
    sb.setAttribute('aria-pressed', String(!!s.saved));
    if (s.saved) { sfx.save(); toast('Saved. It comes back in Review.'); } else sfx.unsave();
    save();
  });
  dlg.onclose = () => stop();
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  if (!dlg.open) dlg.showModal();
  void preload(c);
  if (state.settings.autoplay) void play(c, state.settings.slow ? 'hs' : 'h');
}

/** circular progress (records, goal) */
export function ring(p: number, label: string, cls = '') {
  const C = 2 * Math.PI * 15.5;
  return `<span class="ring ${cls}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring__bg" cx="18" cy="18" r="15.5"/><circle class="ring__bar" cx="18" cy="18" r="15.5" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - Math.min(1, p))).toFixed(2)}"/></svg><small>${label}</small></span>`;
}
