/* Shared pieces: card text, meaning panel, quizzes, the reel card for Shuffle. */
import type { Card, Quiz, RecordMeta, Source } from './types';
import { SCENE_LABEL, SOURCE_CODE, VIBE_LABEL } from './types';
import { Bot, CREW, type Member } from './robots/crew';
import { cardState, state } from './store';
import { lineKeys, play, playSeq } from './audio';
import { I } from './icons';
import { DB } from './feed';

/** label colours = the crew's screen colours; Real Talk uses the page ink */
export const ACCENT: Record<Source, string> = {
  talk: 'var(--ink)', words: '#b7a6ff', movies: '#ff3b47', books: '#ffb43d', songs: '#3fd8ff', science: '#7dff8e', comedy: '#ff7ad8',
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const HOST: Partial<Record<Source, Member['id']>> = { movies: 'tune', books: 'spin', songs: 'pod', science: 'reel', comedy: 'mic' };
/** which crew member hosts a record (fixed, so a record always has the same face) */
export const hostOf = (r: RecordMeta | undefined): Member['id'] => (r && HOST[r.s]) || CREW[((r?.no ?? 1) - 1) % CREW.length].id;
export const recOf = (c: Card) => DB.recById.get(c.rec);
export const recCode = (r: RecordMeta | undefined) => `MJ-EN ${String(r?.no ?? 0).padStart(3, '0')}`;
export const accentOf = (r: RecordMeta | undefined) => (r && r.s !== 'talk' && r.s !== 'words' ? ACCENT[r.s] : CREW.find((m) => m.id === hostOf(r))!.color);

/** onActive: run when a reel slide becomes the visible one */
export const onActive = new WeakMap<HTMLElement, () => void>();

export function mark(line: string, head: string) {
  const h = head.replace(/\(.*?\)/g, '').replace(/[.!?,]+$/, '').trim();
  const safe = esc(line);
  if (!h || /\b(sb|sth)\b|~|…|\//.test(h) || h.length < 3) return safe;
  const i = line.toLowerCase().replace(/[’]/g, "'").indexOf(h.toLowerCase().replace(/[’]/g, "'"));
  if (i < 0) return safe;
  return esc(line.slice(0, i)) + '<mark>' + esc(line.slice(i, i + h.length)) + '</mark>' + esc(line.slice(i + h.length));
}

export function headSize(h: string) {
  const longest = Math.max(...h.split(/\s+/).map((w) => w.length));
  return h.length > 42 || longest > 12 ? 'xl' : h.length > 26 || longest > 9 ? 'l' : h.length > 14 || longest > 7 ? 'm' : 's';
}

const stamp = (c: Card) =>
  c.k === 'w' ? `<span class="stamp">${esc(c.pos ?? 'word')}</span>`
    : c.re === 'textbook' ? '<span class="stamp stamp--warn">Textbook</span>'
      : c.re === 'cringe' ? '<span class="stamp stamp--bad">Cringe</span>'
        : '<span class="stamp stamp--good">Real</span>';

/** mono label row: SONG · CRUSH  REAL */
export function metaRow(c: Card, extra = '') {
  const scene = c.sc[0] ? ` · ${esc((SCENE_LABEL[c.sc[0]] ?? c.sc[0]).toUpperCase())}` : '';
  return `<p class="meta"><span class="meta__code">${SOURCE_CODE[c.s]}${scene}</span>${stamp(c)}${c.rare ? '<span class="stamp stamp--rare">Deep cut</span>' : ''}${c.e ? '<span class="stamp">Explicit</span>' : ''}${extra}</p>`;
}

const ytSearch = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export function sourceHtml(c: Card) {
  const out: string[] = [];
  if (c.q) out.push(`<blockquote class="quote"><p>“${esc(c.q[0])}”</p><cite>${esc(c.q[1])}</cite></blockquote>`);
  if (c.r) out.push(`<a class="ref" href="${ytSearch(c.r)}" target="_blank" rel="noopener">${c.s === 'songs' ? 'Listen' : c.s === 'movies' ? 'Watch' : 'Look up'}: ${esc(c.r)} ${I.next}</a>`);
  return out.join('');
}

/** example / dialogue lines; each one plays its own recording */
export function linesHtml(c: Card) {
  if (!c.l.length) return '';
  const dialog = c.l.some((l) => l[0]);
  return `<ol class="lines${dialog ? ' lines--talk' : ''}">${c.l.map(([who, t], i) => `
    <li><button type="button" class="line" data-key="l${i}" aria-label="Play line">
      ${who ? `<b class="who who--${who.toLowerCase()}">${who}</b>` : ''}<span class="line__t">${mark(t, c.h)}</span>${I.speaker}
    </button></li>`).join('')}</ol>`;
}

export function meaningHtml(c: Card) {
  const p: string[] = [];
  p.push(`<p class="ja" lang="ja">${esc(c.ja)}</p>`);
  if (c.d && c.k === 'c') p.push(`<p class="def">${esc(c.d)}</p>`);
  if (c.re && c.re !== 'real') p.push(`<p class="verdict verdict--${c.re}">${c.re === 'textbook' ? 'People understand it, but it sounds like a textbook.' : 'Nobody says this. You will get a look.'}</p>`);
  const alts = [
    ...(c.v ?? []).map(([t, n], i) => `<li class="alt alt--good"><button type="button" class="alt__say" ${i === 0 && c.re && c.re !== 'real' ? 'data-key="v0"' : ''}>${I.check}<b>${esc(t)}</b></button>${n ? `<small lang="ja">${esc(n)}</small>` : ''}</li>`),
    ...(c.x ?? []).map(([t, lab, n]) => `<li class="alt alt--${lab === 'cringe' ? 'bad' : 'warn'}">${I.close}<b>${esc(t)}</b>${n ? `<small lang="ja">${esc(n)}</small>` : ''}</li>`),
  ];
  if (alts.length) p.push(`<ul class="alts">${alts.join('')}</ul>`);
  const more: string[] = [];
  if (c.sl) more.push(`<p><span class="label">Sounds like</span> ${esc(c.sl)}</p>`);
  if (c.y) more.push(`<p><span class="label">Why it works</span><span lang="ja">${esc(c.y).replace(/\n/g, '<br>')}</span></p>`);
  if (c.n) more.push(`<p><span class="label">${c.s === 'science' ? 'The science' : 'Culture'}</span><span lang="ja">${esc(c.n).replace(/\n/g, '<br>')}</span></p>`);
  if (c.c) more.push(`<p class="cite"><span class="label">Source</span>${esc(c.c)}${c.u ? ` <a href="${esc(c.u)}" target="_blank" rel="noopener">Read the paper</a>` : ''}</p>`);
  if (c.vb?.length) more.push(`<p class="vibes">${c.vb.map((v) => `<span>${esc(VIBE_LABEL[v] ?? v)}</span>`).join('')}</p>`);
  if (more.length) p.push(`<details class="more"><summary>More ${I.next}</summary>${more.join('')}</details>`);
  return p.join('');
}

/** wire the play buttons inside a rendered card body */
export function wireAudio(root: HTMLElement, c: Card, onPlay?: () => void) {
  root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    root.querySelectorAll('.is-playing').forEach((x) => x.classList.remove('is-playing'));
    b.classList.add('is-playing');
    onPlay?.();
    void play(c, b.dataset.key!).then(() => b.classList.remove('is-playing'));
  }));
}

/* ── quizzes ── */

const KIND_LABEL: Record<Quiz['kind'], string> = {
  meaning: 'Quick check', gap: 'Fill the gap', real: 'Real or cringe?', vibe: 'Vibe check', listen: 'Listening', build: 'Build it', word: 'Word check',
};
const REAL_OPTS = ['Real', 'Textbook', 'Cringe'];

export function renderQuiz(q: Quiz, onAnswer: (q: Quiz, ok: boolean, el: HTMLElement) => void, opts: { slide?: boolean } = {}): HTMLElement {
  const el = document.createElement('section');
  el.className = `${opts.slide ? 'slide slide--quiz ' : ''}quiz quiz--${q.kind}`;
  el.style.setProperty('--acc', ACCENT[q.card.s]);
  const isListen = q.kind === 'listen';
  const lineHtml = q.kind === 'build'
    ? `<p class="quiz__line quiz__line--ja" lang="ja">${esc(q.line ?? '')}</p>`
    : isListen
      ? `<button type="button" class="listen-btn">${I.speaker}<span>Play again</span></button>`
      : q.line ? `<p class="quiz__line"${/[ぁ-んァ-ン一-龥]/.test(q.line) ? ' lang="ja"' : ''}>${esc(q.line)}</p>` : '';
  const opts2 = q.kind === 'build'
    ? `<div class="build"><p class="build__ans" aria-live="polite"></p><div class="build__tiles">${q.tiles!.map((t, i) => `<button type="button" class="tile" data-i="${i}">${esc(t)}</button>`).join('')}</div><button type="button" class="btn btn--primary btn-check" disabled>Check</button></div>`
    : `<div class="opts${q.kind === 'real' ? ' opts--row' : ''}">${q.options.map((o, i) => `<button type="button" class="opt" data-i="${i}" ${/[ぁ-んァ-ン一-龥]/.test(o) ? 'lang="ja"' : ''}><kbd>${i + 1}</kbd><span>${esc(q.kind === 'vibe' ? VIBE_LABEL[o] ?? o : q.kind === 'real' ? REAL_OPTS[i] : o)}</span></button>`).join('')}</div>`;
  el.innerHTML = `
    <div class="quiz__in">
      <p class="eyebrow">${q.review ? 'Review · ' : ''}${KIND_LABEL[q.kind]}</p>
      <h3 class="quiz__prompt">${esc(q.prompt)}</h3>
      ${lineHtml}
      ${opts2}
      <div class="quiz__after" hidden></div>
      <div class="quiz__crew" aria-hidden="true"></div>
    </div>`;
  let done = false;
  const after = el.querySelector<HTMLElement>('.quiz__after')!;
  const finish = (ok: boolean) => {
    if (done) return;
    done = true;
    el.classList.add(ok ? 'is-right' : 'is-wrong', 'is-done');
    const c = q.card;
    after.innerHTML = `
      <p class="after__verdict">${ok ? `${I.check} Nice.` : `${I.close} Not quite.`}</p>
      <button type="button" class="after__head" data-key="h">${I.speaker}<b>${esc(c.h)}</b><span lang="ja">${esc(c.ja)}</span></button>
      ${isListen ? `<p class="after__line">“${esc(q.line ?? '')}”</p>` : ''}`;
    wireAudio(after, c);
    after.hidden = false;
    onAnswer(q, ok, el);
  };
  if (q.kind === 'build') {
    const ans = el.querySelector<HTMLElement>('.build__ans')!;
    const check = el.querySelector<HTMLButtonElement>('.btn-check')!;
    const picked: number[] = [];
    const draw = () => {
      ans.innerHTML = picked.map((i) => `<span>${esc(q.tiles![i])}</span>`).join('') || '<em>Tap the words in order</em>';
      check.disabled = picked.length !== q.tiles!.length;
    };
    draw();
    el.querySelectorAll<HTMLButtonElement>('.tile').forEach((b) => b.addEventListener('click', () => {
      if (done) return;
      const i = Number(b.dataset.i);
      const at = picked.indexOf(i);
      if (at >= 0) picked.splice(at, 1); else picked.push(i);
      b.classList.toggle('is-used', at < 0);
      draw();
    }));
    check.addEventListener('click', () => {
      const ok = picked.map((i) => q.tiles![i]).join(' ').toLowerCase() === q.options[0].toLowerCase();
      if (!ok) ans.innerHTML += `<small>${esc(q.options[0])}</small>`;
      finish(ok);
    });
  } else {
    el.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => b.addEventListener('click', () => {
      if (done) return;
      const i = Number(b.dataset.i);
      el.querySelectorAll('.opt')[q.answer].classList.add('is-answer');
      if (i !== q.answer) b.classList.add('is-miss');
      finish(i === q.answer);
    }));
  }
  if (isListen) {
    const btn = el.querySelector<HTMLButtonElement>('.listen-btn')!;
    const go = () => { btn.classList.add('is-playing'); void play(q.card, q.key ?? 'l0').then(() => btn.classList.remove('is-playing')); };
    btn.addEventListener('click', go);
    onActive.set(el, () => window.setTimeout(go, 300));
  }
  (el as HTMLElement & { pick?: (i: number) => void }).pick = (i: number) => el.querySelectorAll<HTMLButtonElement>('.opt')[i]?.click();
  return el;
}

export function crewDance(host: HTMLElement, n: number, mood: 'dance' | 'dizzy' = 'dance') {
  host.replaceChildren();
  for (let i = 0; i < Math.min(5, n); i++) {
    const b = new Bot(CREW[i].id, { auto: false });
    host.append(b.canvas);
    b.act(mood, mood === 'dance' ? 4000 : 1400);
  }
}

/* ── reel card (Shuffle) ── */

export interface ReelHandlers {
  onSave(c: Card, saved: boolean): void;
  onOpen(c: Card): void;
  onShare(c: Card): void;
}

export function renderReel(c: Card, h: ReelHandlers): HTMLElement {
  const r = recOf(c);
  const el = document.createElement('section');
  el.className = `slide slide--card${c.rare ? ' is-rare' : ''}`;
  el.dataset.id = c.id;
  el.style.setProperty('--acc', ACCENT[c.s]);
  const open = state.settings.ja === 'show';
  const saved = !!state.cards[c.id]?.saved;
  el.innerHTML = `
    <article class="reel${open ? ' is-open' : ''}">
      ${metaRow(c)}
      <div class="reel__main">
        <h2 class="head head--${headSize(c.h)}${c.re && c.re !== 'real' ? ' head--strike' : ''}">${esc(c.h)}</h2>
        ${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
        ${c.k === 'w' && c.d ? `<p class="wdef">${esc(c.d)}</p>` : ''}
        ${sourceHtml(c)}
        ${linesHtml(c)}
      </div>
      <div class="reel__ja" ${open ? '' : 'hidden'}>${meaningHtml(c)}</div>
      <button type="button" class="reel__reveal" ${open ? 'hidden' : ''}>Show meaning</button>
      <p class="reel__from">${esc(recCode(r))} · ${esc(r?.t ?? '')}</p>
    </article>
    <aside class="rail" aria-label="Card actions">
      <span class="rail__bot"></span>
      <button type="button" class="rbtn rbtn--play" aria-label="Play">${I.speaker}<span>Play</span></button>
      <button type="button" class="rbtn rbtn--save" aria-pressed="${saved}" aria-label="Save">${I.bookmark}<span>${saved ? 'Saved' : 'Save'}</span></button>
      <button type="button" class="rbtn rbtn--share" aria-label="Share">${I.share}<span>Share</span></button>
    </aside>`;
  const card = el.querySelector<HTMLElement>('.reel')!;
  const ja = el.querySelector<HTMLElement>('.reel__ja')!;
  const reveal = el.querySelector<HTMLButtonElement>('.reel__reveal')!;
  const saveBtn = el.querySelector<HTMLButtonElement>('.rbtn--save')!;
  const bot = new Bot(hostOf(r), { auto: true });
  el.querySelector('.rail__bot')!.append(bot.canvas);
  wireAudio(card, c, () => bot.act('dance', 1800));
  reveal.addEventListener('click', () => {
    card.classList.add('is-open'); ja.hidden = false; reveal.hidden = true;
    bot.act(c.re && c.re !== 'real' ? (c.re === 'cringe' ? 'dizzy' : 'think') : 'wow');
    cardState(c.id).last ||= 0;
  });
  const setSaved = (v: boolean) => {
    cardState(c.id).saved = v;
    if (v && !cardState(c.id).due) cardState(c.id).due = Date.now() + 12 * 3600 * 1000;
    saveBtn.setAttribute('aria-pressed', String(v));
    saveBtn.querySelector('span')!.textContent = v ? 'Saved' : 'Save';
    h.onSave(c, v);
    if (v) bot.act('rec', 1600);
  };
  saveBtn.addEventListener('click', () => setSaved(!state.cards[c.id]?.saved));
  el.querySelector('.rbtn--play')!.addEventListener('click', () => {
    bot.act('dance', 2600);
    void playSeq(c, ['h', ...lineKeys(c)]);
  });
  el.querySelector('.rbtn--share')!.addEventListener('click', () => h.onShare(c));
  let lastTap = 0;
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a,button,summary')) return;
    const now = performance.now();
    if (now - lastTap < 300) { lastTap = 0; if (!state.cards[c.id]?.saved) setSaved(true); return; }
    lastTap = now;
  });
  bot.canvas.addEventListener('click', () => bot.act(['jump', 'laugh', 'wave', 'float', 'love'][Math.floor(Math.random() * 5)] as 'jump'));
  onActive.set(el, () => {
    if (state.settings.autoplay) void play(c, state.settings.slow ? 'hs' : 'h');
    if (c.rare) bot.act('star');
  });
  (el as HTMLElement & { reveal?: () => void; toggleSave?: () => void }).reveal = () => reveal.click();
  (el as HTMLElement & { toggleSave?: () => void }).toggleSave = () => setSaved(!state.cards[c.id]?.saved);
  return el;
}
