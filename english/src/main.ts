import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import type { Card, Quiz, Slide, Source } from './types';
import { SCENE_LABEL, SOURCE_ICON, SOURCE_LABEL } from './types';
import { DB, Feed, type Filter, dueCount, loadData, missedCards, reviewSlides, savedCards, search } from './feed';
import { ACCENT, crewDance, esc, onActive, renderCard, renderQuiz } from './render';
import { cardState, exportCode, grade, importCode, level, levelFloor, liveStreak, markGoal, resetAll, rollDay, save, state } from './store';
import { sfx } from './sfx';
import { hush } from './tts';
import { Bot, CREW } from './robots/crew';

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const app = $('#app');

/* ── theme ── */
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
applyTheme();

/* ── toasts & effects ── */
function toast(text: string, kind = '') {
  const host = $('#toasts');
  const t = document.createElement('p');
  t.className = `toast ${kind}`;
  t.textContent = text;
  host.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 1800);
}

function floatXP(n: number, from?: HTMLElement) {
  const f = document.createElement('span');
  f.className = 'xp-float';
  f.textContent = `+${n} XP`;
  const r = (from ?? $('.views')).getBoundingClientRect();
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top + r.height * 0.42}px`;
  document.body.append(f);
  setTimeout(() => f.remove(), 1100);
}

const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

/* ── header: progress ring, streak, combo ── */
let combo = 0;
function updateHud() {
  rollDay();
  const goal = state.settings.goal;
  const p = Math.min(1, state.day.done / goal);
  document.querySelectorAll<SVGCircleElement>('.ring__bar').forEach((c) => c.style.setProperty('--p', String(p)));
  document.querySelectorAll('[data-hud=done]').forEach((e) => (e.textContent = `${Math.min(state.day.done, goal)}/${goal}`));
  document.querySelectorAll('[data-hud=streak]').forEach((e) => (e.textContent = String(liveStreak())));
  document.querySelectorAll('[data-hud=xp]').forEach((e) => (e.textContent = String(state.xp)));
  document.querySelectorAll('[data-hud=level]').forEach((e) => (e.textContent = String(level())));
  const lv = level();
  const span = levelFloor(lv + 1) - levelFloor(lv);
  document.querySelectorAll<HTMLElement>('[data-hud=lvbar]').forEach((e) => e.style.setProperty('--p', String((state.xp - levelFloor(lv)) / span)));
  document.querySelectorAll<HTMLElement>('[data-hud=combo]').forEach((e) => {
    e.textContent = `×${combo}`;
    e.closest<HTMLElement>('.combo')!.hidden = combo < 2;
  });
  document.querySelectorAll('[data-hud=due]').forEach((e) => {
    const n = DB.all.length ? dueCount() : 0;
    e.textContent = n ? String(n) : '';
    (e as HTMLElement).hidden = !n;
  });
}

function party() {
  const p = $('#party');
  p.hidden = false;
  p.innerHTML = `<div class="party__in"><p class="party__kicker">Daily goal</p><p class="party__title">You did it.</p><p class="party__streak">🔥 ${liveStreak()} day streak</p><div class="party__crew"></div><p class="party__hint">Tap to keep going</p></div>`;
  crewDance($('.party__crew', p), 5);
  sfx.goal();
  vibrate([30, 40, 30, 40, 80]);
  const close = () => { p.hidden = true; p.replaceChildren(); };
  p.onclick = close;
  setTimeout(close, 3600);
}

function countDone(xp: number, from?: HTMLElement) {
  rollDay();
  state.day.done++;
  state.xp += xp;
  if (markGoal()) party();
  save();
  updateHud();
  if (xp >= 5) floatXP(xp, from);
}

/* ── feed view ── */
class FeedView {
  host = $('#feed');
  gen = new Feed();
  slides: HTMLElement[] = [];
  data = new WeakMap<HTMLElement, Slide>();
  active = -1;
  enteredAt = 0;
  counted = new WeakSet<HTMLElement>();
  io: IntersectionObserver;
  reviewMode = false;

  constructor() {
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          const i = this.slides.indexOf(e.target as HTMLElement);
          if (i >= 0 && i !== this.active) this.setActive(i);
        }
      }
    }, { root: this.host, threshold: [0.6] });
  }

  reset(filter: Filter, scene = '', pin?: Card, slides?: Slide[]) {
    hush();
    this.io.disconnect();
    this.host.replaceChildren();
    this.slides = [];
    this.active = -1;
    this.gen = new Feed(filter, scene);
    this.reviewMode = !!slides;
    if (pin) this.gen.pin(pin);
    if (slides) {
      this.gen.queue.push(...slides, { type: 'goal' });
    } else if (!state.introSeen && !pin) {
      this.gen.queue.unshift({ type: 'intro' });
    }
    this.host.scrollTop = 0;
    this.append(slides ? Math.min(slides.length + 1, 8) : 6);
    requestAnimationFrame(() => this.setActive(0));
  }

  build(s: Slide): HTMLElement {
    let el: HTMLElement;
    if (s.type === 'card') {
      el = renderCard(s.card, {
        onSave: (c, saved) => {
          if (saved) { sfx.save(); vibrate(15); state.xp += 3; toast('Saved · comes back for review', 'toast--save'); }
          else sfx.unsave();
          save();
          updateHud();
          void c;
        },
        onFlip: (c, open) => { if (open) { sfx.flip(); cardState(c.id).last = Date.now(); save(); } },
        onShare: (c) => share(c),
      }, { review: s.review });
    } else if (s.type === 'quiz') {
      el = renderQuiz(s.quiz, { onAnswer: (q, ok, node) => this.answered(q, ok, node) });
    } else if (s.type === 'goal') {
      el = document.createElement('section');
      el.className = 'slide slide--end';
      el.innerHTML = `<div class="end"><div class="end__crew"></div><p class="end__title">Review done.</p><p class="end__text">Everything due is cleared. Back to the feed?</p><button type="button" class="btn">Keep scrolling</button></div>`;
      crewDance($('.end__crew', el), 3);
      $('button', el).addEventListener('click', () => go('#/'));
    } else {
      el = document.createElement('section');
      el.className = 'slide slide--intro';
      el.innerHTML = `
        <div class="intro">
          <p class="intro__kicker">MJ ENGLISH</p>
          <h1 class="intro__title">Real English,<br>in reels.</h1>
          <p class="intro__text">Words and chunks from songs, movies, classic books, science, comedy and real talk. No textbook cringe.</p>
          <div class="intro__crew"></div>
          <ul class="intro__how">
            <li><b>Swipe up</b> for the next one</li>
            <li><b>Tap</b> a card to see the meaning</li>
            <li><b>Double-tap</b> to save it for review</li>
          </ul>
          <p class="intro__go">Swipe up to start ↑</p>
        </div>`;
      const crew = $('.intro__crew', el);
      CREW.forEach((m, i) => { const b = new Bot(m.id); crew.append(b.canvas); setTimeout(() => b.act('jump'), 200 + i * 140); });
    }
    this.data.set(el, s);
    return el;
  }

  append(n: number) {
    for (let i = 0; i < n; i++) {
      if (this.reviewMode && !this.gen.queue.length) break;
      const s = this.gen.next();
      const el = this.build(s);
      this.slides.push(el);
      this.host.append(el);
      this.io.observe(el);
    }
  }

  setActive(i: number) {
    const prev = this.slides[this.active];
    if (prev) this.leave(prev);
    this.active = i;
    const el = this.slides[i];
    if (!el) return;
    this.enteredAt = performance.now();
    this.slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const s = this.data.get(el);
    if (prev) sfx.tick();
    onActive.get(el)?.();
    if (s?.type === 'card') {
      if (s.card.rare && !this.counted.has(el)) sfx.rare();
      if (view === 'feed') history.replaceState(null, '', `#/c/${s.card.id}`);
    }
    if (s?.type === 'intro') { state.introSeen = true; save(); }
    if (i >= this.slides.length - 4) this.append(6);
  }

  leave(el: HTMLElement) {
    hush();
    const s = this.data.get(el);
    if (s?.type === 'card' && !this.counted.has(el) && performance.now() - this.enteredAt > 1200) {
      this.counted.add(el);
      const st = cardState(s.card.id);
      st.seen++;
      st.last = Date.now();
      countDone(2);
    }
  }

  answered(q: Quiz, ok: boolean, el: HTMLElement) {
    grade(q.card.id, ok);
    rollDay();
    if (ok) {
      combo++;
      state.bestCombo = Math.max(state.bestCombo, combo);
      state.day.right++;
      sfx.right(combo);
      vibrate(20);
      crewDance($('.quiz__crew', el), Math.max(1, Math.min(5, combo)));
      if (combo === 3 || combo === 5 || combo % 10 === 0) toast(`🔥 ${combo} in a row`, 'toast--combo');
      countDone(10 + Math.min(combo, 10) * 2, el);
    } else {
      combo = 0;
      state.day.wrong++;
      sfx.wrong();
      vibrate([40, 30, 40]);
      crewDance($('.quiz__crew', el), 1, 'dizzy');
      countDone(1, el);
    }
    updateHud();
  }

  step(d: 1 | -1) {
    const target = this.slides[Math.max(0, Math.min(this.slides.length - 1, this.active + d))];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  current() { return this.slides[this.active]; }
}

const feed = new FeedView();
let currentFilter: Filter = 'all';
let currentScene = '';

function share(c: Card) {
  const onSite = /music-japan\.com$|vercel\.app$/.test(location.hostname);
  const url = onSite ? `${location.origin}/c/${c.id}/` : `${location.href.split('#')[0]}#/c/${c.id}`;
  const text = `${c.h} — ${c.ja}`;
  if (navigator.share) navigator.share({ title: `${c.h} · MJ ENGLISH`, text, url }).catch(() => undefined);
  else navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast(url));
}

/* ── filters ── */
const FILTERS: [Filter, string][] = [
  ['all', 'For You'], ['talk', `${SOURCE_ICON.talk} Real Talk`], ['words', `${SOURCE_ICON.words} Words`], ['movies', `${SOURCE_ICON.movies} Movies & TV`],
  ['songs', `${SOURCE_ICON.songs} Songs`], ['comedy', `${SOURCE_ICON.comedy} Comedy`], ['books', `${SOURCE_ICON.books} Books`], ['science', `${SOURCE_ICON.science} Science`],
];

function drawFilters() {
  const html = FILTERS.filter(([f]) => f === 'all' || DB.all.some((c) => c.s === f))
    .map(([f, label]) => `<button type="button" class="chip" data-filter="${f}" aria-pressed="${f === currentFilter && !currentScene}" style="--acc:${f === 'all' ? 'var(--ink)' : ACCENT[f as Source]}">${label}</button>`).join('')
    + `<button type="button" class="chip chip--scene" data-scenes aria-pressed="${!!currentScene}">${currentScene ? `📍 ${SCENE_LABEL[currentScene]}` : '📍 Scenes'}</button>`;
  document.querySelectorAll('.filters').forEach((f) => (f.innerHTML = html));
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    sfx.tap();
    currentFilter = b.dataset.filter as Filter;
    currentScene = '';
    drawFilters();
    if (view !== 'feed') go('#/');
    feed.reset(currentFilter);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-scenes]').forEach((b) => b.addEventListener('click', openScenes));
}

function openScenes() {
  const counts = new Map<string, number>();
  for (const c of DB.all) for (const s of c.sc) counts.set(s, (counts.get(s) ?? 0) + 1);
  const list = Object.keys(SCENE_LABEL).filter((s) => (counts.get(s) ?? 0) >= 5);
  openSheet(`<h2 class="sheet__title">Where are you?</h2><p class="sheet__sub">Pick a scene. The feed only shows what you'd say there.</p>
    <div class="scene-grid">${list.map((s) => `<button type="button" class="scene" data-scene="${s}" aria-pressed="${s === currentScene}"><b>${SCENE_LABEL[s]}</b><span>${counts.get(s)}</span></button>`).join('')}
    ${currentScene ? '<button type="button" class="scene scene--clear" data-scene=""><b>All scenes</b></button>' : ''}</div>`, (sheet) => {
    sheet.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((b) => b.addEventListener('click', () => {
      currentScene = b.dataset.scene!;
      currentFilter = 'all';
      closeSheet();
      drawFilters();
      if (view !== 'feed') go('#/');
      feed.reset('all', currentScene);
    }));
  });
}

/* ── sheet (dialog) ── */
const sheet = $<HTMLDialogElement>('#sheet');
function openSheet(html: string, wire?: (el: HTMLElement) => void) {
  sheet.innerHTML = `<div class="sheet__in"><button type="button" class="sheet__close" aria-label="Close">✕</button>${html}</div>`;
  $('.sheet__close', sheet).addEventListener('click', closeSheet);
  wire?.($('.sheet__in', sheet));
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { hush(); if (sheet.open) sheet.close(); sheet.replaceChildren(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

function openCard(c: Card) {
  openSheet('', (el) => {
    const node = renderCard(c, {
      onSave: (_c, saved) => { if (saved) { sfx.save(); toast('Saved'); } else sfx.unsave(); save(); updateHud(); },
      onFlip: (_c, open) => { if (open) sfx.flip(); },
      onShare: share,
    });
    node.classList.add('slide--sheet');
    el.append(node);
  });
}

/* ── review ── */
function drawReview() {
  const host = $('#view-review');
  const due = dueCount();
  const saved = savedCards();
  const missed = missedCards();
  const list = (cards: Card[]) => cards.length
    ? `<ul class="mini-list">${cards.slice(0, 120).map((c) => `<li><button type="button" data-open="${c.id}" style="--acc:${ACCENT[c.s]}"><b>${esc(c.h)}</b><span lang="ja">${esc(c.ja)}</span></button></li>`).join('')}</ul>`
    : '<p class="empty">Nothing yet. Double-tap cards in the feed to save them.</p>';
  host.innerHTML = `
    <div class="page">
      <section class="review-hero">
        <div class="review-hero__bot"></div>
        <div>
          <p class="kicker">Review</p>
          <h1 class="page__title">${due ? `${due} ${due === 1 ? 'card is' : 'cards are'} due.` : 'All caught up.'}</h1>
          <p class="page__lead">Saved cards and the ones you missed come back right before you'd forget them.</p>
          <button type="button" class="btn" data-start ${due ? '' : 'disabled'}>Start review</button>
        </div>
      </section>
      <section><h2 class="page__h">Saved <span>${saved.length}</span></h2>${list(saved)}</section>
      <section><h2 class="page__h">Missed <span>${missed.length}</span></h2>${missed.length ? list(missed) : '<p class="empty">No misses. Suspicious.</p>'}</section>
    </div>`;
  const bot = new Bot('reel');
  $('.review-hero__bot', host).append(bot.canvas);
  bot.act(due ? 'rec' : 'cool', 2000);
  $('[data-start]', host).addEventListener('click', () => {
    const slides = reviewSlides(30);
    go('#/');
    feed.reset('all', '', undefined, slides);
  });
  wireOpen(host);
}

function wireOpen(host: HTMLElement) {
  host.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const c = DB.byId.get(b.dataset.open!);
    if (c) openCard(c);
  }));
}

/* ── search ── */
function drawSearch() {
  const host = $('#view-search');
  if (!host.dataset.ready) {
    host.dataset.ready = '1';
    host.innerHTML = `
      <div class="page">
        <p class="kicker">Search</p>
        <label class="search"><span class="sr">Search words and chunks</span><input type="search" placeholder="Search English or 日本語" autocomplete="off" enterkeyhint="search"></label>
        <p class="search__count" aria-live="polite"></p>
        <div class="search__out"></div>
      </div>`;
    const input = $<HTMLInputElement>('input', host);
    let t = 0;
    input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(run, 120); });
    const run = () => {
      const q = input.value;
      const hits = search(q);
      $('.search__count', host).textContent = q.trim() ? `${hits.length}${hits.length === 80 ? '+' : ''} results` : `${DB.cards.length.toLocaleString()} chunks · ${DB.words.length.toLocaleString()} words`;
      $('.search__out', host).innerHTML = hits.length
        ? `<ul class="mini-list">${hits.map((c) => `<li><button type="button" data-open="${c.id}" style="--acc:${ACCENT[c.s]}"><small>${SOURCE_ICON[c.s]} ${SOURCE_LABEL[c.s]}</small><b>${esc(c.h)}</b><span lang="ja">${esc(c.ja)}</span></button></li>`).join('')}</ul>`
        : q.trim() ? '<p class="empty">No hits. Try a shorter word.</p>' : '';
      wireOpen(host);
    };
    run();
  }
  setTimeout(() => $<HTMLInputElement>('input', host).focus({ preventScroll: true }), 60);
}

/* ── me ── */
function drawMe() {
  const host = $('#view-me');
  const s = state.settings;
  const seen = Object.values(state.cards).filter((c) => c.seen > 0).length;
  const right = Object.values(state.cards).reduce((a, c) => a + c.right, 0);
  const wrong = Object.values(state.cards).reduce((a, c) => a + c.wrong, 0);
  const acc = right + wrong ? Math.round((right / (right + wrong)) * 100) : 0;
  const seg = (name: string, cur: string | number | boolean, opts: [string | number | boolean, string][]) =>
    `<div class="seg" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-set="${name}" data-v="${String(v)}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  host.innerHTML = `
    <div class="page">
      <p class="kicker">You</p>
      <div class="stats">
        <div class="stat"><b data-hud="streak">0</b><span>day streak</span></div>
        <div class="stat"><b>Lv <span data-hud="level">1</span></b><span><i class="lvbar" data-hud="lvbar"></i></span></div>
        <div class="stat"><b>${seen.toLocaleString()}</b><span>cards seen</span></div>
        <div class="stat"><b>${acc}%</b><span>quiz accuracy</span></div>
        <div class="stat"><b data-hud="xp">0</b><span>XP</span></div>
        <div class="stat"><b>${state.bestCombo}</b><span>best combo</span></div>
      </div>
      <section>
        <h2 class="page__h">The crew</h2>
        <ul class="crew-list">${CREW.map((m) => `<li style="--acc:${m.color}"><span class="crew-list__bot" data-bot="${m.id}"></span><b>${m.name}</b><small>${m.role}</small></li>`).join('')}
          <li class="crew-list__all" style="--acc:var(--ink)"><span class="crew-list__dots">${CREW.map((m) => `<i style="background:${m.color}"></i>`).join('')}</span><b>EVERYONE</b><small>Real Talk &amp; Words</small></li></ul>
      </section>
      <section class="settings">
        <h2 class="page__h">Settings</h2>
        <div class="set"><p>Japanese meaning</p>${seg('ja', s.ja, [['tap', 'Tap to show'], ['show', 'Always']])}</div>
        <div class="set"><p>Explicit cards <small>swearing, dirty jokes</small></p>${seg('explicit', s.explicit, [[false, 'Off'], [true, 'On']])}</div>
        <div class="set"><p>Voice speed</p>${seg('rate', s.rate, [[0.75, 'Slow'], [0.95, 'Normal'], [1.1, 'Fast']])}</div>
        <div class="set"><p>Read cards aloud</p>${seg('autoVoice', s.autoVoice, [[false, 'Off'], [true, 'Auto']])}</div>
        <div class="set"><p>Sound effects</p>${seg('sound', s.sound, [[true, 'On'], [false, 'Off']])}</div>
        <div class="set"><p>Daily goal</p>${seg('goal', s.goal, [[10, '10'], [20, '20'], [30, '30'], [50, '50']])}</div>
        <div class="set"><p>Theme</p>${seg('theme', s.theme, [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']])}</div>
      </section>
      <section class="data">
        <h2 class="page__h">Your progress</h2>
        <p class="page__lead">Saved in this browser only. To move it to your PC (or phone), copy the code here and paste it there.</p>
        <div class="row"><button type="button" class="btn btn--ghost" data-export>Copy my code</button><button type="button" class="btn btn--ghost" data-import>Paste a code</button><button type="button" class="btn btn--ghost btn--danger" data-reset>Reset</button></div>
      </section>
      <section class="about">
        <h2 class="page__h">About</h2>
        <p>MJ ENGLISH is made by Music Japan LLC (Osaka). ${DB.cards.length.toLocaleString()} chunks and ${DB.words.length.toLocaleString()} words so far, more every week.</p>
        <p>How we quote: classic-book quotes come only from works in the public domain in both the US and Japan. Movie and TV lines are quoted one line at a time for commentary, with the title. Song lyrics are never reproduced; we name the song and teach the phrase with our own examples. Science cards cite the original paper. All example sentences are original.</p>
        <p>Pronunciation (IPA) comes from the CMU Pronouncing Dictionary. Voices use your device's built-in speech.</p>
      </section>
    </div>`;
  host.querySelectorAll<HTMLElement>('[data-bot]').forEach((h) => {
    const b = new Bot(h.dataset.bot as 'tune');
    h.append(b.canvas);
    h.addEventListener('click', () => { b.act(['jump', 'laugh', 'love', 'float', 'wave'][Math.floor(Math.random() * 5)] as 'jump'); sfx.tap(); });
  });
  host.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.set as keyof typeof state.settings;
    const raw = b.dataset.v!;
    const v = raw === 'true' ? true : raw === 'false' ? false : /^[\d.]+$/.test(raw) ? Number(raw) : raw;
    (state.settings as unknown as Record<string, unknown>)[k] = v;
    save();
    if (k === 'theme') applyTheme();
    if (k === 'sound' && v) sfx.tap();
    host.querySelectorAll(`[data-set="${k}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (k === 'explicit' || k === 'ja') feed.reset(currentFilter, currentScene);
    updateHud();
  }));
  $('[data-export]', host).addEventListener('click', () => {
    const code = exportCode();
    openSheet(`<h2 class="sheet__title">Your code</h2><p class="sheet__sub">Copy this, open MJ ENGLISH on your other device, go to You → Paste a code.</p><textarea class="code" readonly rows="6">${code}</textarea><button type="button" class="btn" data-copy>Copy</button>`, (el) => {
      $('[data-copy]', el).addEventListener('click', () => navigator.clipboard?.writeText(code).then(() => toast('Copied'), () => undefined));
      $<HTMLTextAreaElement>('textarea', el).select();
    });
  });
  $('[data-import]', host).addEventListener('click', () => {
    openSheet(`<h2 class="sheet__title">Paste a code</h2><p class="sheet__sub">This replaces the progress in this browser.</p><textarea class="code" rows="6" placeholder="Paste here"></textarea><button type="button" class="btn" data-load>Load</button>`, (el) => {
      $('[data-load]', el).addEventListener('click', () => {
        if (importCode($<HTMLTextAreaElement>('textarea', el).value)) { closeSheet(); toast('Progress loaded'); applyTheme(); drawMe(); updateHud(); }
        else toast('That code didn’t work');
      });
    });
  });
  $('[data-reset]', host).addEventListener('click', () => {
    openSheet(`<h2 class="sheet__title">Reset everything?</h2><p class="sheet__sub">Saved cards, streak and XP in this browser will be gone.</p><button type="button" class="btn btn--danger" data-yes>Reset</button>`, (el) => {
      $('[data-yes]', el).addEventListener('click', () => { resetAll(); closeSheet(); applyTheme(); drawMe(); updateHud(); toast('Fresh start'); });
    });
  });
  updateHud();
}

/* ── desktop stage (right column) ── */
function drawStage() {
  const host = document.querySelector<HTMLElement>('#stage-crew');
  if (!host || host.childElementCount) return;
  CREW.forEach((m) => {
    const b = new Bot(m.id);
    const fig = document.createElement('figure');
    fig.style.setProperty('--acc', m.color);
    fig.append(b.canvas);
    fig.insertAdjacentHTML('beforeend', `<figcaption>${m.name}<small>${m.role}</small></figcaption>`);
    fig.addEventListener('click', () => { b.act('jump'); sfx.tap(); });
    host.append(fig);
  });
}

/* ── router ── */
let view: 'feed' | 'review' | 'search' | 'me' = 'feed';
function go(hash: string) { if (location.hash !== hash) location.hash = hash; else route(); }

function route() {
  const h = location.hash || '#/';
  const m = h.match(/^#\/c\/([\w-]+)/);
  const next = h.startsWith('#/review') ? 'review' : h.startsWith('#/search') ? 'search' : h.startsWith('#/me') ? 'me' : 'feed';
  const changed = next !== view;
  view = next;
  document.querySelectorAll<HTMLElement>('.view').forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-current', String((t as HTMLElement).dataset.tab === view)));
  app.dataset.view = view;
  if (view !== 'feed') hush();
  if (view === 'review') drawReview();
  if (view === 'search') drawSearch();
  if (view === 'me') drawMe();
  if (view === 'feed') {
    if (m && !feed.slides.some((s) => s.dataset.id === m[1])) {
      const c = DB.byId.get(m[1]);
      feed.reset(currentFilter, currentScene, c);
    } else if (!feed.slides.length) feed.reset(currentFilter, currentScene);
    else if (changed) feed.current()?.focus?.();
  }
}

/* ── keyboard (PC) ── */
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || sheet.open || e.metaKey || e.ctrlKey || e.altKey) return;
  if (view !== 'feed') return;
  const cur = feed.current() as (HTMLElement & { toggleOpen?: () => void; toggleSave?: () => void; pick?: (i: number) => void }) | undefined;
  const k = e.key;
  if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); feed.step(1); }
  else if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); feed.step(-1); }
  else if (k === ' ') { e.preventDefault(); cur?.toggleOpen?.(); }
  else if (k === 's') cur?.toggleSave?.();
  else if (k === 'p') cur?.querySelector<HTMLButtonElement>('.rbtn--play, .listen-btn')?.click();
  else if (/^[1-4]$/.test(k)) cur?.pick?.(Number(k) - 1);
});

document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

/* ── boot ── */
async function boot() {
  try {
    await loadData();
  } catch (err) {
    $('#feed').innerHTML = `<p class="empty">Couldn’t load the cards. Check your connection and reload.</p>`;
    console.error(err);
    return;
  }
  drawFilters();
  drawStage();
  updateHud();
  document.querySelectorAll<HTMLAnchorElement>('[data-tab]').forEach((a) => a.addEventListener('click', () => sfx.tap()));
  window.addEventListener('hashchange', route);
  route();
  app.classList.add('is-ready');
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
}
void boot();
