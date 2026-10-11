import type { Card, Quiz, Source } from './types';
import { SCENE_LABEL, SOURCE_ICON, SOURCE_LABEL, VIBE_LABEL } from './types';
import { Bot, memberFor } from './robots/crew';
import { cardState, state } from './store';
import { speak, speakLines, canSpeak } from './tts';

export const ACCENT: Record<Source, string> = {
  talk: '#f3eee6', words: '#b9a8ff', movies: '#ff2e3e', books: '#ffb43d', songs: '#3fd8ff', science: '#7dff8e', comedy: '#ff7ad8',
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const ICON = {
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l5 5h-3.5v7h-3V8H7z"/><path d="M5 13v7h14v-7" fill="none" stroke-width="2.2"/></svg>',
};

/** run when a slide becomes the active one (autoplay listening, robot hello) */
export const onActive = new WeakMap<HTMLElement, () => void>();

function mark(line: string, head: string) {
  const h = head.replace(/\(.*?\)/g, '').replace(/[.!?,]+$/, '').trim();
  const safe = esc(line);
  if (!h || /\b(sb|sth)\b|~|…|\//.test(h) || h.length < 3) return safe;
  const i = line.toLowerCase().replace(/[’]/g, "'").indexOf(h.toLowerCase().replace(/[’]/g, "'"));
  if (i < 0) return safe;
  return esc(line.slice(0, i)) + '<mark>' + esc(line.slice(i, i + h.length)) + '</mark>' + esc(line.slice(i + h.length));
}

const realStamp = (re?: string) =>
  re === 'textbook' ? '<span class="stamp stamp--textbook">⚠ Textbook</span>'
    : re === 'cringe' ? '<span class="stamp stamp--cringe">✗ Cringe</span>'
      : '<span class="stamp stamp--real">✓ Real</span>';

const ytSearch = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export function cardBack(c: Card): string {
  const parts: string[] = [];
  parts.push(`<p class="ja" lang="ja">${esc(c.ja)}</p>`);
  if (c.d) parts.push(`<p class="def">${esc(c.d)}</p>`);
  if (c.re && c.re !== 'real') {
    parts.push(`<p class="verdict verdict--${c.re}">${c.re === 'textbook' ? 'Understood, but sounds like a textbook.' : 'Nobody says this. You’ll get a look.'}</p>`);
  }
  if (c.v?.length) parts.push(`<ul class="alts">${c.v.map(([t, n]) => `<li class="alt alt--real"><b>✓ ${esc(t)}</b>${n ? `<small lang="ja">${esc(n)}</small>` : ''}</li>`).join('')}</ul>`);
  if (c.x?.length) parts.push(`<ul class="alts">${c.x.map(([t, lab, n]) => `<li class="alt alt--${lab}"><b>${lab === 'cringe' ? '✗' : '⚠'} ${esc(t)}</b>${n ? `<small lang="ja">${esc(n)}</small>` : ''}</li>`).join('')}</ul>`);
  if (c.y) parts.push(`<div class="why"><p class="label">Why it works</p><p lang="ja">${esc(c.y).replace(/\n/g, '<br>')}</p></div>`);
  if (c.n) parts.push(`<div class="note"><p class="label">Culture</p><p lang="ja">${esc(c.n).replace(/\n/g, '<br>')}</p></div>`);
  if (c.c) parts.push(`<p class="cite">Source: ${esc(c.c)}${c.u ? ` <a href="${esc(c.u)}" target="_blank" rel="noopener">Read ↗</a>` : ''}</p>`);
  return parts.join('');
}

export function cardFront(c: Card): string {
  const tags = [
    `<span class="src">${SOURCE_ICON[c.s]} ${SOURCE_LABEL[c.s]}</span>`,
    ...c.sc.slice(0, 2).map((s) => `<span class="tag">${esc(SCENE_LABEL[s] ?? s)}</span>`),
    c.k === 'c' ? realStamp(c.re) : '',
    c.rare ? '<span class="stamp stamp--rare">✦ Deep cut</span>' : '',
    c.e ? '<span class="stamp stamp--explicit">Explicit</span>' : '',
  ].join('');
  const kicker = c.k === 'w' ? `Word · ${esc(c.pos ?? '')}` : c.re && c.re !== 'real' ? 'Real or nah?' : 'Chunk';
  const body: string[] = [];
  if (c.q) body.push(`<blockquote class="quote"><p>“${esc(c.q[0])}”</p><cite>— ${esc(c.q[1])}</cite></blockquote>`);
  if (c.r) {
    const label = c.s === 'songs' ? '🎵' : c.s === 'movies' ? '🎬' : '↗';
    body.push(`<p class="ref"><a href="${ytSearch(c.r)}" target="_blank" rel="noopener">${label} ${esc(c.r)}</a></p>`);
  }
  if (c.l.length) {
    const dialog = c.l.some((l) => l[0]);
    body.push(`<ol class="lines${dialog ? ' lines--talk' : ''}">${c.l.map(([who, t]) => `<li${who ? ` class="who-${who.toLowerCase()}"` : ''}>${who ? `<b>${who}</b>` : ''}<span>${mark(t, c.h)}</span></li>`).join('')}</ol>`);
  }
  if (c.vb?.length) body.push(`<p class="vibes">${c.vb.map((v) => `<span>${esc(VIBE_LABEL[v] ?? v)}</span>`).join('')}</p>`);
  const longest = Math.max(...c.h.split(/\s+/).map((w) => w.length));
  const size = c.h.length > 42 || longest > 11 ? 'xl' : c.h.length > 26 || longest > 8 ? 'l' : c.h.length > 14 || longest > 6 ? 'm' : 's';
  return `
    <header class="card__top">${tags}</header>
    <div class="card__main">
      <p class="kicker">${kicker}</p>
      <h2 class="head head--${size}${c.re && c.re !== 'real' ? ' head--strike' : ''}">${esc(c.h)}</h2>
      ${c.ipa ? `<p class="ipa">/${esc(c.ipa)}/</p>` : ''}
      ${c.k === 'w' && c.d ? `<p class="wdef">${esc(c.d)}</p>` : ''}
      ${c.sl ? `<p class="sounds">Sounds like <b>${esc(c.sl)}</b></p>` : ''}
      ${body.join('')}
    </div>`;
}

export interface CardHandlers {
  onSave(c: Card, saved: boolean, el: HTMLElement): void;
  onFlip(c: Card, open: boolean): void;
  onShare(c: Card): void;
}

export function renderCard(c: Card, h: CardHandlers, opts: { review?: boolean } = {}): HTMLElement {
  const el = document.createElement('section');
  el.className = `slide slide--card${c.rare ? ' is-rare' : ''}`;
  el.dataset.id = c.id;
  el.style.setProperty('--acc', ACCENT[c.s]);
  const open = state.settings.ja === 'show';
  const saved = !!state.cards[c.id]?.saved;
  el.innerHTML = `
    <article class="card${open ? ' is-open' : ''}" tabindex="-1">
      ${opts.review ? '<p class="badge-review">↺ Back for review</p>' : ''}
      ${cardFront(c)}
      <div class="card__back" ${open ? '' : 'hidden'}>${cardBack(c)}</div>
      <p class="hint">${open ? 'Double-tap to save' : 'Tap to flip · Double-tap to save'}</p>
      <span class="burst" aria-hidden="true"></span>
    </article>
    <aside class="rail" aria-label="Card actions">
      <span class="rail__bot"></span>
      <button type="button" class="rbtn rbtn--save" aria-pressed="${saved}" aria-label="Save">${ICON.save}<span>${saved ? 'Saved' : 'Save'}</span></button>
      ${canSpeak() ? `<button type="button" class="rbtn rbtn--play" aria-label="Listen">${ICON.play}<span>Listen</span></button>` : ''}
      <button type="button" class="rbtn rbtn--ja" aria-pressed="${open}" aria-label="Show meaning"><i lang="ja">あ</i><span>Meaning</span></button>
      <button type="button" class="rbtn rbtn--share" aria-label="Share">${ICON.share}<span>Share</span></button>
    </aside>`;
  const card = el.querySelector<HTMLElement>('.card')!;
  const back = el.querySelector<HTMLElement>('.card__back')!;
  const saveBtn = el.querySelector<HTMLButtonElement>('.rbtn--save')!;
  const jaBtn = el.querySelector<HTMLButtonElement>('.rbtn--ja')!;
  const bot = new Bot(memberFor(c.s), { auto: true });
  el.querySelector('.rail__bot')!.append(bot.canvas);
  (el as HTMLElement & { bot?: Bot }).bot = bot;

  const setOpen = (v: boolean) => {
    card.classList.toggle('is-open', v);
    back.hidden = !v;
    jaBtn.setAttribute('aria-pressed', String(v));
    h.onFlip(c, v);
    if (v) bot.act(c.re && c.re !== 'real' ? (c.re === 'cringe' ? 'dizzy' : 'think') : 'wow');
  };
  const setSaved = (v: boolean) => {
    const s = cardState(c.id);
    s.saved = v;
    if (v && !s.due) s.due = Date.now() + 12 * 3600 * 1000;
    saveBtn.setAttribute('aria-pressed', String(v));
    saveBtn.querySelector('span')!.textContent = v ? 'Saved' : 'Save';
    h.onSave(c, v, el);
    if (v) {
      bot.act('rec', 1600);
      card.classList.remove('is-burst');
      void card.offsetWidth;
      card.classList.add('is-burst');
    }
  };
  (el as HTMLElement & { toggleOpen?: () => void; toggleSave?: () => void }).toggleOpen = () => setOpen(!card.classList.contains('is-open'));
  (el as HTMLElement & { toggleSave?: () => void }).toggleSave = () => setSaved(!state.cards[c.id]?.saved);

  let lastTap = 0;
  let tapTimer = 0;
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    const now = performance.now();
    if (now - lastTap < 280) {
      clearTimeout(tapTimer);
      lastTap = 0;
      if (!state.cards[c.id]?.saved) setSaved(true);
      else { card.classList.remove('is-burst'); void card.offsetWidth; card.classList.add('is-burst'); }
      return;
    }
    lastTap = now;
    tapTimer = window.setTimeout(() => setOpen(!card.classList.contains('is-open')), 240);
  });
  saveBtn.addEventListener('click', () => setSaved(!state.cards[c.id]?.saved));
  jaBtn.addEventListener('click', () => setOpen(!card.classList.contains('is-open')));
  el.querySelector('.rbtn--play')?.addEventListener('click', () => {
    bot.act('dance', 2400);
    speakLines(c.k === 'w' ? [c.h, c.l[0][1]] : [c.h, ...c.l.map((l) => l[1])]);
  });
  el.querySelector('.rbtn--share')!.addEventListener('click', () => h.onShare(c));
  bot.canvas.addEventListener('click', () => bot.act(['jump', 'laugh', 'wave', 'float', 'love'][Math.floor(Math.random() * 5)] as 'jump'));
  onActive.set(el, () => {
    if (state.settings.autoVoice) speak(c.h);
    if (c.rare) bot.act('star');
  });
  return el;
}

/* ── quiz slides ── */

export interface QuizHandlers {
  onAnswer(q: Quiz, ok: boolean, el: HTMLElement): void;
}

const KIND_LABEL: Record<Quiz['kind'], string> = {
  meaning: 'Quick check', gap: 'Fill the gap', real: 'Real or Cringe?', vibe: 'Vibe check', listen: 'Listening', build: 'Build it', word: 'Word check',
};

export function renderQuiz(q: Quiz, h: QuizHandlers): HTMLElement {
  const el = document.createElement('section');
  el.className = `slide slide--quiz quiz--${q.kind}`;
  el.style.setProperty('--acc', ACCENT[q.card.s]);
  const isListen = q.kind === 'listen';
  const lineHtml = q.kind === 'build'
    ? `<p class="quiz__line quiz__line--ja" lang="ja">${esc(q.line ?? '')}</p>`
    : isListen
      ? `<button type="button" class="listen-btn" aria-label="Play again">${ICON.play}<span>Tap to listen</span></button>`
      : q.line ? `<p class="quiz__line">${esc(q.line)}</p>` : '';
  const opts = q.kind === 'build'
    ? `<div class="build"><p class="build__ans" aria-live="polite"></p><div class="build__tiles">${q.tiles!.map((t, i) => `<button type="button" class="tile" data-i="${i}">${esc(t)}</button>`).join('')}</div><button type="button" class="btn-check" disabled>Check</button></div>`
    : `<div class="quiz__opts${q.kind === 'real' ? ' quiz__opts--real' : ''}">${q.options.map((o, i) => `<button type="button" class="opt" data-i="${i}" ${/[ぁ-んァ-ン一-龥]/.test(o) ? 'lang="ja"' : ''}><kbd>${i + 1}</kbd><span>${esc(q.kind === 'vibe' ? VIBE_LABEL[o] ?? o : o)}</span></button>`).join('')}</div>`;
  el.innerHTML = `
    <div class="quiz">
      <p class="quiz__kind">${q.review ? '↺ Review · ' : ''}${KIND_LABEL[q.kind]}</p>
      <h3 class="quiz__prompt">${esc(q.prompt)}</h3>
      ${lineHtml}
      ${opts}
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
    const example = c.l.find((l) => !q.line || l[1] !== q.line)?.[1] ?? c.l[0]?.[1] ?? '';
    after.innerHTML = `
      <p class="after__verdict">${ok ? 'Nice.' : 'Not quite.'}</p>
      <p class="after__head">${esc(c.h)} <span lang="ja">${esc(c.ja)}</span></p>
      ${isListen ? `<p class="after__line">“${esc(q.line ?? '')}”</p>` : example ? `<p class="after__line">${mark(example, c.h)}</p>` : ''}
      <p class="after__next">Swipe up ↑</p>`;
    after.hidden = false;
    h.onAnswer(q, ok, el);
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
      if (!ok) ans.innerHTML += `<small>→ ${esc(q.options[0])}</small>`;
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
    const play = () => speak(q.line ?? '', { rate: Math.min(state.settings.rate, 0.92) });
    el.querySelector('.listen-btn')!.addEventListener('click', play);
    onActive.set(el, () => window.setTimeout(play, 350));
  }
  (el as HTMLElement & { pick?: (i: number) => void }).pick = (i: number) => {
    el.querySelectorAll<HTMLButtonElement>('.opt')[i]?.click();
  };
  return el;
}

export function crewDance(host: HTMLElement, n: number, mood: 'dance' | 'dizzy' = 'dance') {
  host.replaceChildren();
  const ids = ['tune', 'spin', 'pod', 'reel', 'mic'] as const;
  for (let i = 0; i < Math.min(5, n); i++) {
    const b = new Bot(ids[i], { auto: false });
    host.append(b.canvas);
    b.act(mood, mood === 'dance' ? 4000 : 1400);
  }
}
