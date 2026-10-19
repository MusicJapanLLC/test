/* The four tabs (Today, Records, Shuffle, Me) and the record page. */
import type { Card, Quiz, RecordMeta, Slide, Source } from './types';
import { SOURCE_LABEL } from './types';
import { DB, Feed, type Filter, dueCards, newCards, nextRecord, recCards, recStats, search, shuffle, todayPlan } from './feed';
import { ACCENT, accentOf, crewDance, esc, hostOf, onActive, recCode, renderQuiz, renderReel } from './render';
import { cardState, exportCode, grade, importCode, level, levelFloor, liveStreak, markGoal, resetAll, rollDay, save, state, status, today } from './store';
import { preload, stop } from './audio';
import { sfx } from './sfx';
import { I } from './icons';
import { mark as mjMark } from './brand';
import { $, $$, band, floatXP, go, mountBots, openCard, party, ring, sleeve, toast, trackRow, vibrate, wireTracks } from './ui';
import { startSession, type SessionSpec } from './session';
import { openDrill } from './drill';
import { CREW } from './robots/crew';

export const view = () => $('#view');

/* ── sessions ── */

export function todaySpec(): SessionSpec {
  const { rec, due, fresh } = todayPlan();
  state.cur = rec.id;
  save();
  return { title: 'Today', cards: [...due, ...fresh], back: '#/', more: () => moreFrom(rec.id) };
}

function moreFrom(rec: string): SessionSpec | null {
  let r = DB.recById.get(rec)!;
  if (!recStats(r.id).fresh) r = nextRecord(r.id) ?? r;
  const cards = newCards(r.id, state.settings.size);
  if (!cards.length) return null;
  state.cur = r.id;
  return { title: r.t, cards, back: `#/r/${r.id}`, more: () => moreFrom(r.id) };
}

export function recordSpec(r: RecordMeta): SessionSpec {
  const due = dueCards(r.id, 20);
  const fresh = newCards(r.id, state.settings.size);
  state.cur = r.id;
  save();
  return { title: r.t, cards: [...due, ...fresh], back: `#/r/${r.id}`, more: () => moreFrom(r.id) };
}

export function play(spec: SessionSpec) {
  if (!spec.cards.length) { toast('Nothing to study here right now.'); return; }
  startSession(spec, () => { refreshHud(); render(); });
}

/* ── HUD (streak + goal in the top bar and the side rail) ── */

export function refreshHud() {
  rollDay();
  const goal = state.settings.goal;
  for (const host of $$('[data-hud=ring]')) host.innerHTML = ring(state.day.done / goal, `${Math.min(state.day.done, goal)}/${goal}`);
  for (const e of $$('[data-hud=streak]')) e.textContent = String(liveStreak());
  const due = DB.all.length ? dueCards(undefined, 999).length : 0;
  for (const e of $$('[data-hud=due]')) { e.textContent = due ? String(due) : ''; e.hidden = !due; }
}

/** the grammar drill record to continue: the first one with due or new sentences */
function nextBuild(): RecordMeta | undefined {
  const drills = DB.records.filter((r) => r.lv === 'build');
  return drills.find((r) => recStats(r.id).due) ?? drills.find((r) => recStats(r.id).fresh) ?? drills[0];
}

/* ── Today ── */

function renderToday() {
  const { rec, due, fresh } = todayPlan();
  const st = recStats(rec.id);
  const buildRec = nextBuild();
  const total = due.length + fresh.length;
  const learned = DB.all.filter((c) => (state.cards[c.id]?.box ?? 0) > 0).length;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const goal = state.settings.goal;
  view().innerHTML = `
    <section class="page today">
      <div class="today__main">
        <p class="eyebrow">Side A · ${day}</p>
        <h1 class="display">Today's<br>session.</h1>
        <p class="today__plan">${due.length ? `<b>${due.length}</b> to review` : 'Nothing to review'}${fresh.length ? ` + <b>${fresh.length}</b> new from <b>${esc(rec.t)}</b>` : ''}</p>
        ${total
          ? `<button type="button" class="btn btn--primary btn--xl" data-start>${I.play}<span>Start · ${total} cards</span></button>`
          : `<a class="btn btn--primary btn--xl" href="#/records">${I.records}<span>All caught up. Pick a record</span></a>`}
      </div>
      <div class="today__side">
        <div class="today__now">
          ${sleeve(rec, { big: true })}
          <div class="today__nowtxt">
            <p class="eyebrow">Now playing</p>
            <p class="today__rec">${esc(rec.t)}</p>
            <p class="muted">${st.done} of ${st.n} learned${st.due ? ` · ${st.due} due` : ''}</p>
            <a class="link" href="#/records">Change record ${I.next}</a>
          </div>
        </div>
        <div class="today__stats">
          <div class="stat">${ring(state.day.done / goal, `${Math.min(state.day.done, goal)}/${goal}`, 'ring--lg')}<span>Daily goal</span></div>
          <div class="stat"><b>${liveStreak()}</b><span>${I.flame} Day streak</span></div>
          <div class="stat"><b>${learned}</b><span>Learned</span></div>
        </div>
      </div>
      <div class="today__rest">
        <nav class="today__more" aria-label="More ways to study">
          <button type="button" class="row" data-review ${due.length ? '' : 'disabled'}>${I.repeat}<span><b>Review only</b><small>${due.length ? `${due.length} cards due` : 'Nothing due right now'}</small></span>${I.next}</button>
          <button type="button" class="row" data-drill>${I.headphones}<span><b>Listening drill</b><small>Play ${esc(rec.t)} like a playlist. Shadow it.</small></span>${I.next}</button>
          ${buildRec ? `<button type="button" class="row" data-build>${I.key}<span><b>Build It · 瞬間英作文</b><small>${esc(buildRec.t)}: Japanese in, English out, from word tiles</small></span>${I.next}</button>` : ''}
          <a class="row" href="#/shuffle">${I.shuffle}<span><b>Shuffle</b><small>Swipe through everything, reel style</small></span>${I.next}</a>
        </nav>
        ${band()}
      </div>
    </section>`;
  mountBots(view(), { auto: true });
  view().querySelector('[data-start]')?.addEventListener('click', () => play(todaySpec()));
  $('[data-review]').addEventListener('click', () => play({ title: 'Review', cards: dueCards(undefined, 40), back: '#/' }));
  $('[data-drill]').addEventListener('click', () => openDrill(rec, () => render()));
  view().querySelector('[data-build]')?.addEventListener('click', () => { if (buildRec) play(recordSpec(buildRec)); });
  for (const c of fresh.slice(0, 2)) void preload(c);
}

/* ── Records (shelf + search) ── */

const SHELVES: [string, (r: RecordMeta) => boolean][] = [
  ['Real Talk', (r) => r.s === 'talk' && r.lv !== 'levelup'],
  ['Level Up', (r) => r.lv === 'levelup' && r.s === 'talk'],
  ['Build It · 瞬間英作文', (r) => r.lv === 'build'],
  ['Words', (r) => r.s === 'words' && r.lv !== 'levelup'],
  ['Level Up Words', (r) => r.s === 'words' && r.lv === 'levelup'],
  ['Songs, Film & Books', (r) => ['songs', 'movies', 'books'].includes(r.s)],
  ['Comedy & Science', (r) => ['comedy', 'science'].includes(r.s)],
];

function renderRecords(q = '') {
  view().innerHTML = `
    <section class="page records">
      <h1 class="display display--s">Records</h1>
      <label class="search">${I.search}<input type="search" id="q" placeholder="Search words, phrases, 日本語" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></label>
      <div class="records__body"></div>
    </section>`;
  const body = $('.records__body');
  const draw = (text: string) => {
    if (text.trim()) {
      const hits = search(text);
      body.innerHTML = hits.length
        ? `<p class="eyebrow">${hits.length} result${hits.length > 1 ? 's' : ''}</p><ol class="tracks">${hits.map((c) => trackRow(c, undefined, { showRec: true })).join('')}</ol>`
        : `<p class="empty">No match for “${esc(text)}”. Try a shorter word.</p>`;
      return;
    }
    body.innerHTML = SHELVES.map(([name, f]) => {
      const rs = DB.records.filter(f);
      return rs.length ? `<h2 class="shelf__h"><span>${esc(name)}</span><small>${rs.length} records</small></h2><div class="shelf">${rs.map((r) => sleeve(r, { now: r.id === state.cur })).join('')}</div>` : '';
    }).join('');
    mountBots(body, { tap: false });
  };
  draw(q);
  wireTracks(body);
  const input = $<HTMLInputElement>('#q');
  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = window.setTimeout(() => { draw(input.value); history.replaceState(null, '', input.value ? `#/records?q=${encodeURIComponent(input.value)}` : '#/records'); }, 160); });
}

/* ── one record ── */

let trackFilter: 'all' | 'new' | 'learning' | 'known' = 'all';
let filterFor = '';

function renderRecord(id: string) {
  const r = DB.recById.get(id);
  if (!r) { go('#/records'); return; }
  if (filterFor !== id) { trackFilter = 'all'; filterFor = id; }
  const st = recStats(r.id);
  const cards = recCards(r.id);
  const fresh = Math.min(st.fresh, state.settings.size);
  view().innerHTML = `
    <section class="page record" style="--acc:${accentOf(r)}">
      <a class="backlink" href="#/records">${I.back}<span>Records</span></a>
      <div class="record__hero">
        ${sleeve(r, { big: true, href: false })}
        <div class="record__txt">
          <p class="eyebrow">${esc(recCode(r))} · ${esc(SOURCE_LABEL[r.s])}</p>
          <h1 class="display display--s">${esc(r.t)}</h1>
          <p class="muted">${esc(r.sub)}</p>
          <p class="counts"><span><i class="dot dot--new"></i>${st.fresh} new</span><span><i class="dot dot--learning"></i>${st.learning} learning</span><span><i class="dot dot--known"></i>${st.known} known</span></p>
        </div>
      </div>
      ${r.ex?.length ? `<section class="grammar"><p class="eyebrow">The point</p>${r.ex.map((x) => `<p lang="ja">${esc(x)}</p>`).join('')}</section>` : ''}
      <div class="record__actions">
        <button type="button" class="btn btn--primary" data-learn ${fresh || st.due ? '' : 'disabled'}>${I.play}<span>${fresh ? `${r.lv === 'build' ? 'Build' : 'Learn'} ${fresh} new` : st.due ? `Review ${st.due}` : 'All learned'}</span></button>
        <button type="button" class="btn btn--ghost" data-drill>${I.headphones}<span>Listen</span></button>
        ${st.due && fresh ? `<button type="button" class="btn btn--ghost" data-review>${I.repeat}<span>Review ${st.due}</span></button>` : ''}
        <button type="button" class="btn btn--ghost" data-test>${I.check}<span>Test</span></button>
      </div>
      <div class="tracks__head">
        <h2 class="shelf__h"><span>Tracks</span><small>${cards.length}</small></h2>
        <button type="button" class="chip" data-sheet aria-pressed="${state.settings.sheet}">${state.settings.sheet ? I.eyeOff : I.eye}<span>${state.settings.sheet ? 'Meanings hidden' : 'Hide meanings'}</span></button>
      </div>
      <div class="seg seg--filter" role="group" aria-label="Show">${(['all', 'new', 'learning', 'known'] as const).map((f) => `<button type="button" data-f="${f}" aria-pressed="${f === trackFilter}">${f === 'all' ? `All ${cards.length}` : `${f[0].toUpperCase()}${f.slice(1)} ${f === 'new' ? st.fresh : f === 'learning' ? st.learning : st.known}`}</button>`).join('')}</div>
      <ol class="tracks">${cards.map((c, i) => (trackFilter === 'all' || status(c.id) === trackFilter ? trackRow(c, i) : '')).join('') || '<li class="empty">Nothing here yet.</li>'}</ol>
    </section>`;
  mountBots(view(), { tap: true });
  $('[data-learn]').addEventListener('click', () => play(recordSpec(r)));
  view().querySelector('[data-review]')?.addEventListener('click', () => play({ title: r.t, cards: dueCards(r.id, 40), back: `#/r/${r.id}` }));
  $('[data-drill]').addEventListener('click', () => openDrill(r, () => render()));
  $('[data-test]').addEventListener('click', () => {
    const learnedCards = cards.filter((c) => status(c.id) !== 'new');
    const pool = learnedCards.length >= 4 ? learnedCards : cards;
    play({ title: `${r.t} test`, cards: shuffle(pool).slice(0, 10), back: `#/r/${r.id}`, quiz: true });
  });
  $('[data-sheet]').addEventListener('click', () => { state.settings.sheet = !state.settings.sheet; save(); applySheet(); renderRecord(id); });
  $$<HTMLButtonElement>('[data-f]').forEach((b) => b.addEventListener('click', () => { trackFilter = b.dataset.f as typeof trackFilter; renderRecord(id); }));
  wireTracks($('.tracks'));
  void preload(cards[0]);
}

export const applySheet = () => document.body.classList.toggle('red-sheet', state.settings.sheet);

/* ── Shuffle (the reel feed) ── */

const FILTERS: [Filter, string][] = [
  ['all', 'All'], ['talk', 'Real Talk'], ['words', 'Words'], ['songs', 'Songs'], ['movies', 'Film & TV'], ['books', 'Books'], ['comedy', 'Comedy'], ['science', 'Science'],
];

class Shuffle {
  host!: HTMLElement;
  gen = new Feed();
  slides: HTMLElement[] = [];
  data = new WeakMap<HTMLElement, Slide>();
  active = -1;
  enteredAt = 0;
  counted = new WeakSet<HTMLElement>();
  io!: IntersectionObserver;
  filter: Filter = 'all';
  combo = 0;

  mount(pin?: Card) {
    view().innerHTML = `
      <section class="shuffle">
        <div class="filters" role="toolbar" aria-label="Filter">${FILTERS.map(([f, label]) => `<button type="button" class="chip" data-filter="${f}" aria-pressed="${f === this.filter}" style="--acc:${f === 'all' ? 'var(--ink)' : ACCENT[f as Source]}">${label}</button>`).join('')}</div>
        <div class="feed" id="feed"></div>
      </section>`;
    this.host = $('#feed');
    $$<HTMLButtonElement>('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      this.filter = b.dataset.filter as Filter;
      $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.reset();
    }));
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          const i = this.slides.indexOf(e.target as HTMLElement);
          if (i >= 0 && i !== this.active) this.setActive(i);
        }
      }
    }, { root: this.host, threshold: [0.6] });
    this.reset(pin);
  }

  reset(pin?: Card) {
    stop();
    this.io.disconnect();
    this.host.replaceChildren();
    this.slides = [];
    this.active = -1;
    this.gen = new Feed(this.filter);
    if (pin) this.gen.pin(pin);
    this.host.scrollTop = 0;
    this.append(6);
    requestAnimationFrame(() => this.setActive(0));
  }

  build(s: Slide): HTMLElement {
    if (s.type === 'quiz') return renderQuiz(s.quiz, (q, ok, node) => this.answered(q, ok, node), { slide: true });
    if (s.type === 'card') {
      return renderReel(s.card, {
        onSave: (_c, saved) => { if (saved) { sfx.save(); vibrate(15); toast('Saved. It comes back in Review.'); } else sfx.unsave(); save(); refreshHud(); },
        onOpen: (c) => openCard(c),
        onShare: (c) => share(c),
      });
    }
    const el = document.createElement('section');
    el.className = 'slide slide--end';
    el.innerHTML = `<div class="end"><p class="end__title">That's everything here.</p><button type="button" class="btn btn--primary">Start over</button></div>`;
    $('button', el).addEventListener('click', () => this.reset());
    return el;
  }

  append(n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.gen.next();
      const el = this.build(s);
      this.data.set(el, s);
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
    if (prev) sfx.tick();
    stop();
    onActive.get(el)?.();
    const s = this.data.get(el);
    const nxt = this.data.get(this.slides[i + 1]);
    if (nxt?.type === 'card') void preload(nxt.card);
    if (s?.type === 'card' && location.hash.startsWith('#/shuffle')) history.replaceState(null, '', `#/shuffle/${s.card.id}`);
    if (i >= this.slides.length - 4) this.append(6);
  }

  leave(el: HTMLElement) {
    const s = this.data.get(el);
    if (s?.type === 'card' && !this.counted.has(el) && performance.now() - this.enteredAt > 1500) {
      this.counted.add(el);
      const st = cardState(s.card.id);
      st.seen++;
      save();
    }
  }

  answered(q: Quiz, ok: boolean, el: HTMLElement) {
    grade(q.card.id, ok);
    rollDay();
    if (ok) {
      this.combo++;
      state.bestCombo = Math.max(state.bestCombo, this.combo);
      state.day.right++;
      state.day.done++;
      const xp = 8 + Math.min(this.combo, 10) * 2;
      state.xp += xp;
      sfx.right(this.combo);
      vibrate(20);
      crewDance($('.quiz__crew', el), Math.max(1, Math.min(5, this.combo)));
      if (this.combo === 3 || this.combo === 5 || this.combo % 10 === 0) toast(`${this.combo} in a row`);
      floatXP(xp, el);
    } else {
      this.combo = 0;
      state.day.wrong++;
      sfx.wrong();
      vibrate([40, 30, 40]);
      crewDance($('.quiz__crew', el), 1, 'dizzy');
    }
    if (markGoal()) party();
    save();
    refreshHud();
  }

  step(d: 1 | -1) {
    const target = this.slides[Math.max(0, Math.min(this.slides.length - 1, this.active + d))];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  current() { return this.slides[this.active]; }
}

export const shuffleView = new Shuffle();

function share(c: Card) {
  const onSite = /music-japan\.com$|vercel\.app$/.test(location.hostname);
  const url = onSite ? `${location.origin}/c/${c.id}/` : `${location.href.split('#')[0]}#/c/${c.id}`;
  const text = `${c.h} — ${c.ja}`;
  const copy = () => (navigator.clipboard ? navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast(url)) : toast(url));
  if (navigator.share) navigator.share({ title: `${c.h} · MJ ENGLISH`, text, url }).catch((e: Error) => { if (e?.name !== 'AbortError') void copy(); });
  else void copy();
}

/* ── Me ── */

function seg<T extends string | number | boolean>(key: string, cur: T, opts: [T, string][]) {
  return `<div class="seg" role="group">${opts.map(([v, label]) => `<button type="button" data-set="${key}" data-v="${String(v)}" aria-pressed="${v === cur}">${label}</button>`).join('')}</div>`;
}

function week() {
  const days: { d: string; n: number; r: number; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = new Date(Date.now() - i * 86400000);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const l = state.log[key] ?? { n: 0, r: 0 };
    days.push({ d: key, n: l.n, r: l.r, label: t.toLocaleDateString('en-US', { weekday: 'narrow' }) });
  }
  const max = Math.max(10, ...days.map((d) => d.n + d.r));
  return `<div class="week" role="img" aria-label="Cards studied in the last 7 days">${days.map((d) => `
    <div class="week__d${d.d === today() ? ' is-today' : ''}"><span class="week__bar"><i class="week__r" style="height:${(d.r / max) * 100}%"></i><i class="week__n" style="height:${(d.n / max) * 100}%"></i></span><b>${d.n + d.r || ''}</b><small>${d.label}</small></div>`).join('')}</div>`;
}

function renderMe() {
  const s = state.settings;
  const studied = DB.all.filter((c) => state.cards[c.id]?.box || state.cards[c.id]?.wrong);
  const known = studied.filter((c) => (state.cards[c.id]?.box ?? 0) >= 3).length;
  const lv = level();
  const p = (state.xp - levelFloor(lv)) / (levelFloor(lv + 1) - levelFloor(lv));
  view().innerHTML = `
    <section class="page me">
      <h1 class="display display--s">You</h1>
      <div class="me__stats">
        <div class="stat"><b>${studied.length}</b><span>Learned</span></div>
        <div class="stat"><b>${known}</b><span>Known</span></div>
        <div class="stat"><b>${liveStreak()}</b><span>${I.flame} Streak</span></div>
        <div class="stat"><b>Lv ${lv}</b><span class="lvbar"><i style="width:${Math.round(p * 100)}%"></i></span><small class="muted">${state.xp} XP</small></div>
      </div>
      <h2 class="shelf__h"><span>This week</span><small><i class="sw sw--n"></i>New <i class="sw sw--r"></i>Review</small></h2>
      ${week()}
      <h2 class="shelf__h"><span>Settings</span></h2>
      <div class="settings">
        <div class="set"><p>Card front<small>English to understand it, 日本語 to practice saying it</small></p>${seg('front', s.front, [['en', 'English'], ['ja', '日本語']])}</div>
        <div class="set"><p>Japanese meaning<small>Hidden until you ask, or always on</small></p>${seg('ja', s.ja, [['tap', 'On tap'], ['show', 'Always']])}</div>
        <div class="set"><p>Play voice automatically<small>When a card appears</small></p>${seg('autoplay', s.autoplay, [[true, 'On'], [false, 'Off']])}</div>
        <div class="set"><p>Voice speed<small>Slow is a separate slow recording</small></p>${seg('slow', s.slow, [[false, 'Normal'], [true, 'Slow']])}</div>
        <div class="set"><p>New cards per session</p>${seg('size', s.size, [[5, '5'], [10, '10'], [15, '15'], [20, '20']])}</div>
        <div class="set"><p>Daily goal<small>Cards per day</small></p>${seg('goal', s.goal, [[10, '10'], [20, '20'], [30, '30'], [50, '50']])}</div>
        <div class="set"><p>Sound effects</p>${seg('sound', s.sound, [[true, 'On'], [false, 'Off']])}</div>
        <div class="set"><p>Explicit cards<small>Swearing and dirty jokes</small></p>${seg('explicit', s.explicit, [[false, 'Off'], [true, 'On']])}</div>
        <div class="set"><p>Theme</p>${seg('theme', s.theme, [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light']])}</div>
      </div>
      <h2 class="shelf__h"><span>The crew</span><small>They don't talk. They react.</small></h2>
      <ul class="crew">${CREW.map((m) => `<li style="--acc:${m.color}"><span data-bot="${m.id}"></span><b>${m.name}</b><small>${m.role}</small></li>`).join('')}</ul>
      <h2 class="shelf__h"><span>Your data</span></h2>
      <p class="muted">Progress stays in this browser. Copy the code to move it to another device.</p>
      <div class="data">
        <button type="button" class="btn btn--ghost" data-export>Copy backup code</button>
        <button type="button" class="btn btn--ghost" data-import>Paste a code</button>
        <button type="button" class="btn btn--ghost btn--danger" data-reset>Reset</button>
      </div>
      <div class="data__box" hidden></div>
      <h2 class="shelf__h"><span>About</span></h2>
      <div class="about">
        <p class="about__brand">${mjMark('about__mark')}<span>MJ ENGLISH is made by Music Japan LLC in Osaka. ${DB.cards.length.toLocaleString()} phrases and ${DB.words.length.toLocaleString()} words, with more records coming.</span></p>
        <p>Voice: every card is recorded with Kokoro, an open neural voice model (Apache-2.0), rendered on our side. Pronunciation symbols come from the CMU Pronouncing Dictionary.</p>
        <p>Public page and screen views use Google Analytics 4. Your progress, answers and recordings are not sent. <a href="https://music-japan.com/privacy/" target="_blank" rel="noopener">Privacy &amp; analytics</a></p>
        <p>Quoting: classic-book quotes come only from works in the public domain in both the US and Japan. Movie and TV lines are quoted one line at a time, with the title. Song lyrics are never reproduced; we name the song and teach the phrase with our own examples. Science cards cite the paper. All example sentences are original.</p>
      </div>
    </section>`;
  mountBots(view(), { auto: true });
  $$<HTMLButtonElement>('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.set as keyof typeof state.settings;
    const raw = b.dataset.v!;
    const v = raw === 'true' ? true : raw === 'false' ? false : /^[\d.]+$/.test(raw) ? Number(raw) : raw;
    (state.settings as unknown as Record<string, unknown>)[k] = v;
    save();
    if (k === 'theme') applyTheme();
    if (k === 'sound' && v) sfx.tap();
    $$(`[data-set="${k}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    refreshHud();
  }));
  const box = $('.data__box');
  $('[data-export]').addEventListener('click', () => {
    const code = exportCode();
    box.hidden = false;
    box.innerHTML = `<textarea id="backup" readonly rows="3">${esc(code)}</textarea><button type="button" class="btn btn--ghost" data-copy>Copy</button>`;
    const ta = $<HTMLTextAreaElement>('#backup');
    ta.select();
    $('[data-copy]', box).addEventListener('click', () => navigator.clipboard?.writeText(code).then(() => toast('Copied'), () => { ta.select(); toast('Select and copy the code'); }));
  });
  $('[data-import]').addEventListener('click', () => {
    box.hidden = false;
    box.innerHTML = `<textarea id="restore" rows="3" placeholder="Paste your backup code"></textarea><button type="button" class="btn btn--primary" data-apply>Restore</button>`;
    $('[data-apply]', box).addEventListener('click', () => {
      if (importCode($<HTMLTextAreaElement>('#restore').value)) { toast('Progress restored'); applyTheme(); render(); refreshHud(); }
      else toast('That code did not work');
    });
  });
  $('[data-reset]').addEventListener('click', () => {
    box.hidden = false;
    box.innerHTML = `<p>Delete all progress on this device? This cannot be undone.</p><button type="button" class="btn btn--ghost btn--danger" data-yes>Delete everything</button>`;
    $('[data-yes]', box).addEventListener('click', () => { resetAll(); toast('Reset'); applyTheme(); render(); refreshHud(); });
  });
}

/* ── theme ── */

let themed = false;
export function applyTheme() {
  const t = state.settings.theme;
  if (t !== 'auto') { document.documentElement.dataset.theme = t; themed = true; }
  else if (themed) { delete document.documentElement.dataset.theme; themed = false; }
}

/* ── router ── */

export type Tab = 'today' | 'records' | 'shuffle' | 'me';

export function render() {
  stop();
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/');
  let tab: Tab = 'today';
  window.scrollTo(0, 0);
  view().scrollTop = 0;
  if (parts[0] === 'records') { tab = 'records'; renderRecords(new URLSearchParams(qs ?? '').get('q') ?? ''); }
  else if (parts[0] === 'r' && parts[1]) { tab = 'records'; renderRecord(parts[1]); }
  else if (parts[0] === 'shuffle') { tab = 'shuffle'; shuffleView.mount(parts[1] ? DB.byId.get(parts[1]) : undefined); }
  else if (parts[0] === 'me') { tab = 'me'; renderMe(); }
  else if (parts[0] === 'c' && parts[1]) {
    const c = DB.byId.get(parts[1]);
    tab = 'records';
    if (c) { renderRecord(c.rec); history.replaceState(null, '', `#/r/${c.rec}`); openCard(c); } else renderToday();
  } else renderToday();
  document.body.dataset.tab = tab;
  $$('.tabs a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.tab === tab)));
  refreshHud();
}

export { hostOf };
