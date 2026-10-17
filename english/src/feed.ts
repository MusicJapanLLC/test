import type { Card, Quiz, QuizKind, RecordMeta, Slide, Source } from './types';
import { cardState, isDue, state, status } from './store';

export const DB = {
  cards: [] as Card[], words: [] as Card[], all: [] as Card[], byId: new Map<string, Card>(),
  records: [] as RecordMeta[], recById: new Map<string, RecordMeta>(), byRec: new Map<string, Card[]>(),
};

export async function loadData() {
  const get = async <T>(f: string) => {
    const r = await fetch(`data/${f}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${f} ${r.status}`);
    return (await r.json()) as T;
  };
  const [cards, words, meta] = await Promise.all([get<Card[]>('cards.json'), get<Card[]>('words.json'), get<{ records: RecordMeta[] }>('meta.json')]);
  DB.cards = cards;
  DB.words = words;
  DB.all = [...cards, ...words];
  DB.records = meta.records;
  for (const r of meta.records) { DB.recById.set(r.id, r); DB.byRec.set(r.id, []); }
  for (const c of DB.all) { DB.byId.set(c.id, c); DB.byRec.get(c.rec)?.push(c); }
}

/* ── records ── */

export const recCards = (rec: string) => (DB.byRec.get(rec) ?? []).filter((c) => allowed(c));

export function recStats(rec: string) {
  const cards = recCards(rec);
  let fresh = 0, learning = 0, known = 0, due = 0;
  for (const c of cards) {
    const st = status(c.id);
    if (st === 'new') fresh++; else if (st === 'known') known++; else learning++;
    if (isDue(state.cards[c.id])) due++;
  }
  return { n: cards.length, fresh, learning, known, due, done: cards.length - fresh };
}

/** the next new cards of a record, in the record's own order */
export const newCards = (rec: string, n: number) => recCards(rec).filter((c) => status(c.id) === 'new').slice(0, n);

export const dueCards = (rec?: string, limit = 40) =>
  shuffle(DB.all.filter((c) => allowed(c) && (!rec || c.rec === rec) && isDue(state.cards[c.id]))).slice(0, limit);

/** the next record on the shelf that still has new cards */
export function nextRecord(after: string): RecordMeta | undefined {
  const i = DB.records.findIndex((r) => r.id === after);
  const order = [...DB.records.slice(i + 1), ...DB.records.slice(0, i + 1)];
  return order.find((r) => recStats(r.id).fresh > 0);
}

/** Today = everything due (up to 20) + the next new cards from the current record */
export function todayPlan() {
  let rec = DB.recById.get(state.cur) ?? DB.records[0];
  if (!recStats(rec.id).fresh) rec = nextRecord(rec.id) ?? rec;
  const due = dueCards(undefined, 20);
  const fresh = newCards(rec.id, state.settings.size);
  return { rec, due, fresh };
}

const rand = (n: number) => Math.floor(Math.random() * n);
const pickOne = <T>(a: T[]) => a[rand(a.length)];
export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export const allowed = (c: Card) => state.settings.explicit || !c.e;

const WEIGHTS: Record<Source, number> = { talk: 30, words: 22, movies: 12, songs: 10, comedy: 10, books: 8, science: 8 };

/* ── quizzes ── */

const hasPlaceholder = (h: string) => /\b(sb|sth|someone|something|one's)\b|~|…|\(|\//i.test(h);
const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'");

function lineWithHead(c: Card): string | null {
  if (hasPlaceholder(c.h)) return null;
  const h = norm(c.h).replace(/[.!?,]+$/, '');
  if (h.split(' ').length > 7) return null;
  const lines = c.l.map((l) => l[1]).filter((t) => norm(t).includes(h));
  return lines.length ? pickOne(lines) : null;
}

function blank(line: string, head: string) {
  const h = head.replace(/[.!?,]+$/, '');
  const i = norm(line).indexOf(norm(h));
  return line.slice(0, i) + '_____' + line.slice(i + h.length);
}

function distractors(c: Card, n: number, key: (x: Card) => string, sameSource = true): string[] {
  const right = key(c);
  // same kind first (chunk vs word), same source/scene preferred so wrong answers are believable
  const sameKind = DB.all.filter((x) => x.id !== c.id && allowed(x) && x.k === c.k);
  const close = sameKind.filter((x) => (sameSource ? x.s === c.s : x.sc.some((s) => c.sc.includes(s))));
  const pool = [...shuffle(close), ...shuffle(sameKind)];
  const out: string[] = [];
  for (const x of pool) {
    const k = key(x);
    if (!k || k === right || out.includes(k)) continue;
    out.push(k);
    if (out.length === n) break;
  }
  return out;
}

function withAnswer(right: string, wrong: string[]) {
  const options = shuffle([right, ...wrong]);
  return { options, answer: options.indexOf(right) };
}

export function makeQuiz(c: Card, review = false): Quiz | null {
  const kinds: [QuizKind, number][] = [];
  if (c.k === 'w') kinds.push(['word', 4]);
  else {
    kinds.push(['meaning', 3]);
    if (lineWithHead(c)) kinds.push(['gap', 3]);
    const words = c.h.replace(/[.!?,]+$/, '').split(' ');
    if (!hasPlaceholder(c.h) && words.length >= 3 && words.length <= 6 && c.re === 'real') kinds.push(['build', 2]);
    if (c.re !== 'real' || c.x?.length) kinds.push(['real', 3]);
    if (c.vb?.some((v) => ['rude', 'flirty', 'worksafe', 'cold', 'warm'].includes(v))) kinds.push(['vibe', 1]);
  }
  if (c.l.length) kinds.push(['listen', 2]);
  let r = Math.random() * kinds.reduce((s, k) => s + k[1], 0);
  let kind = kinds[0][0];
  for (const [k, w] of kinds) { if ((r -= w) <= 0) { kind = k; break; } }

  switch (kind) {
    case 'word': {
      if (Math.random() < 0.5) {
        const { options, answer } = withAnswer(c.ja, distractors(c, 3, (x) => x.ja));
        return { kind, card: c, prompt: 'What does it mean?', line: c.h, options, answer, review };
      }
      const { options, answer } = withAnswer(c.h, distractors(c, 3, (x) => x.h));
      return { kind, card: c, prompt: 'Which word fits?', line: `${c.ja} — ${c.d ?? ''}`.replace(/ — $/, ''), options, answer, review };
    }
    case 'meaning': {
      const { options, answer } = withAnswer(c.ja, distractors(c, 3, (x) => x.ja, false));
      return { kind, card: c, prompt: 'What does it mean?', line: c.h, options, answer, review };
    }
    case 'gap': {
      const line = lineWithHead(c)!;
      const { options, answer } = withAnswer(c.h.replace(/[.!?,]+$/, ''), distractors(c, 3, (x) => (hasPlaceholder(x.h) || x.k === 'w' ? '' : x.h.replace(/[.!?,]+$/, '')), false));
      return { kind, card: c, prompt: 'Fill the gap', line: blank(line, c.h), options, answer, review };
    }
    case 'build': {
      const words = c.h.replace(/[.!?,]+$/, '').split(' ');
      let tiles = shuffle(words);
      for (let i = 0; i < 4 && tiles.join(' ') === words.join(' '); i++) tiles = shuffle(words);
      return { kind, card: c, prompt: 'Put it in order', line: c.ja, options: [words.join(' ')], answer: 0, tiles, review };
    }
    case 'real': {
      const pool: [string, number][] = [];
      if (c.re === 'real') pool.push([c.h, 0]);
      else pool.push([c.h, c.re === 'textbook' ? 1 : 2]);
      for (const [t, lab] of c.x ?? []) pool.push([t, lab === 'textbook' ? 1 : 2]);
      for (const [t] of c.v ?? []) pool.push([t, 0]);
      const [line, answer] = pickOne(pool);
      return { kind, card: c, prompt: 'Would a native say this?', line, options: ['✓ Real', '⚠ Textbook', '✗ Cringe'], answer, review };
    }
    case 'vibe': {
      const right = c.vb!.find((v) => ['rude', 'flirty', 'worksafe', 'cold', 'warm'].includes(v))!;
      const others = shuffle(['warm', 'chill', 'cold', 'rude', 'flirty', 'worksafe'].filter((v) => !c.vb!.includes(v))).slice(0, 3);
      const { options, answer } = withAnswer(right, others);
      const line = c.l.find((l) => norm(l[1]).includes(norm(c.h).slice(0, 8)))?.[1] ?? c.h;
      return { kind, card: c, prompt: "What's the vibe?", line, options, answer, review };
    }
    case 'listen': {
      const idx = c.l.slice(0, 4).map((l, i) => [l[1], i] as const).filter(([t]) => t.split(' ').length <= 16);
      const [line, li] = idx.length ? pickOne(idx) : [c.l[0][1], 0];
      const others = shuffle(DB.all.filter((x) => x.id !== c.id && allowed(x)).flatMap((x) => x.l.map((l) => l[1])).filter((t) => t !== line && t.split(' ').length <= 16 && Math.abs(t.length - line.length) < 26)).slice(0, 3);
      const { options, answer } = withAnswer(line, others);
      return { kind, card: c, prompt: 'What did you hear?', line, options, answer, review, key: `l${li}` };
    }
  }
  return null;
}

/* ── the endless feed ── */

export type Filter = Source | 'all';

export class Feed {
  filter: Filter = 'all';
  scene = '';
  private used = new Set<string>();
  /** cards shown this session, most recent last (quiz material) */
  recent: Card[] = [];
  private sinceQuiz = 0;
  private quizEvery = 4;
  private sinceReview = 0;
  queue: Slide[] = [];

  constructor(filter: Filter = 'all', scene = '') {
    this.filter = filter;
    this.scene = scene;
  }

  private eligible(src: Source | null) {
    return DB.all.filter((c) => allowed(c) && (!src || c.s === src) && (!this.scene || c.sc.includes(this.scene)));
  }

  private pickSource(): Source | null {
    if (this.filter !== 'all') return this.filter;
    if (this.scene) return null;
    const entries = (Object.entries(WEIGHTS) as [Source, number][]).filter(([s]) => DB.all.some((c) => c.s === s));
    let r = Math.random() * entries.reduce((a, e) => a + e[1], 0);
    for (const [s, w] of entries) if ((r -= w) <= 0) return s;
    return entries[0]?.[0] ?? null;
  }

  private pickCard(): Card | null {
    const src = this.pickSource();
    let pool = this.eligible(src).filter((c) => !this.used.has(c.id));
    if (!pool.length) {
      for (const c of this.eligible(src)) this.used.delete(c.id);
      pool = this.eligible(src);
    }
    if (!pool.length) return null;
    // unseen first, then least seen; a little randomness so it never feels like a list
    const scored = pool.map((c) => ({ c, s: (state.cards[c.id]?.seen ?? 0) * 10 + Math.random() * 6 - (c.f ?? 2) * 0.6 }));
    scored.sort((a, b) => a.s - b.s);
    const top = scored.slice(0, Math.max(6, Math.ceil(scored.length * 0.05)));
    return pickOne(top).c;
  }

  private dueCard(): Card | null {
    const due = DB.all.filter((c) => allowed(c) && isDue(state.cards[c.id]) && (this.filter === 'all' || c.s === this.filter));
    return due.length ? pickOne(due) : null;
  }

  next(): Slide {
    if (this.queue.length) return this.queue.shift()!;
    this.sinceQuiz++;
    this.sinceReview++;
    if (this.sinceQuiz > this.quizEvery && this.recent.length >= 2) {
      this.sinceQuiz = 0;
      this.quizEvery = 3 + rand(3);
      const due = this.sinceReview > 6 ? this.dueCard() : null;
      if (due) this.sinceReview = 0;
      const from = due ?? pickOne(this.recent.slice(-10, -1).length ? this.recent.slice(-10, -1) : this.recent);
      const q = makeQuiz(from, !!due);
      if (q) return { type: 'quiz', quiz: q };
    }
    const c = this.pickCard();
    if (!c) return { type: 'intro' };
    this.used.add(c.id);
    this.recent.push(c);
    if (this.recent.length > 40) this.recent.shift();
    return { type: 'card', card: c };
  }

  /** put a specific card first (deep links) */
  pin(c: Card) {
    this.used.add(c.id);
    this.recent.push(c);
    this.queue.unshift({ type: 'card', card: c });
  }
}

/** A finite review session: every due card becomes a quiz. */
export function reviewSlides(limit = 30): Slide[] {
  const due = shuffle(DB.all.filter((c) => allowed(c) && isDue(state.cards[c.id]))).slice(0, limit);
  return due.map((c) => makeQuiz(c, true)).filter((q): q is Quiz => !!q).map((quiz) => ({ type: 'quiz' as const, quiz }));
}

export const dueCount = () => DB.all.filter((c) => allowed(c) && isDue(state.cards[c.id])).length;
export const savedCards = () => DB.all.filter((c) => state.cards[c.id]?.saved);
export const missedCards = () => DB.all.filter((c) => (state.cards[c.id]?.wrong ?? 0) > 0).sort((a, b) => cardState(b.id).wrong - cardState(a.id).wrong);

export function search(q: string): Card[] {
  const t = norm(q.trim());
  if (!t) return [];
  const hits: [Card, number][] = [];
  for (const c of DB.all) {
    if (!allowed(c)) continue;
    const h = norm(c.h);
    let s = 0;
    if (h === t) s = 100;
    else if (h.startsWith(t)) s = 60;
    else if (h.includes(t)) s = 40;
    else if (c.ja.includes(q.trim())) s = 30;
    else if (c.l.some((l) => norm(l[1]).includes(t))) s = 10;
    if (s) hits.push([c, s - h.length * 0.05]);
  }
  return hits.sort((a, b) => b[1] - a[1]).slice(0, 80).map((x) => x[0]);
}
