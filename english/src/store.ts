/* Progress lives in this browser only (localStorage). Every read and write is guarded:
   private windows and blocked storage must never break the app. Export/import moves it between devices. */

export interface CardState {
  seen: number;
  saved?: boolean;
  box: number;
  due: number;
  wrong: number;
  right: number;
  last: number;
}

export interface Settings {
  ja: 'tap' | 'show';
  explicit: boolean;
  rate: number;
  autoVoice: boolean;
  sound: boolean;
  goal: number;
  theme: 'auto' | 'dark' | 'light';
}

export interface State {
  v: 1;
  cards: Record<string, CardState>;
  xp: number;
  streak: number;
  lastDay: string;
  day: { date: string; done: number; right: number; wrong: number; goalHit: boolean };
  bestCombo: number;
  settings: Settings;
  introSeen: boolean;
}

const KEY = 'mj-english:v1';
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fresh = (): State => ({
  v: 1,
  cards: {},
  xp: 0,
  streak: 0,
  lastDay: '',
  day: { date: today(), done: 0, right: 0, wrong: 0, goalHit: false },
  bestCombo: 0,
  settings: { ja: 'tap', explicit: false, rate: 0.95, autoVoice: false, sound: true, goal: 20, theme: 'auto' },
  introSeen: false,
});

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as State;
    const base = fresh();
    return { ...base, ...s, settings: { ...base.settings, ...s.settings }, day: { ...base.day, ...s.day } };
  } catch {
    return fresh();
  }
}

export const state: State = load();

let timer = 0;
export function save() {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: keep going in memory */ }
  }, 150);
}

export function rollDay() {
  const t = today();
  if (state.day.date !== t) state.day = { date: t, done: 0, right: 0, wrong: 0, goalHit: false };
}

export function cardState(id: string): CardState {
  return (state.cards[id] ??= { seen: 0, box: 0, due: 0, wrong: 0, right: 0, last: 0 });
}

/* Leitner boxes. Box n waits INTERVALS[n] before it comes back. */
const DAY = 86400000;
const INTERVALS = [0, 0.5 * DAY, 2 * DAY, 5 * DAY, 12 * DAY, 30 * DAY, 75 * DAY];

export function grade(id: string, ok: boolean) {
  const s = cardState(id);
  if (ok) { s.right++; s.box = Math.min(INTERVALS.length - 1, s.box + 1); }
  else { s.wrong++; s.box = 0; }
  s.due = Date.now() + INTERVALS[s.box];
  s.last = Date.now();
  save();
}

export function isDue(s: CardState | undefined) {
  return !!s && (s.saved || s.wrong > 0) && s.due <= Date.now();
}

export function markGoal(): boolean {
  if (state.day.goalHit || state.day.done < state.settings.goal) return false;
  state.day.goalHit = true;
  const t = today();
  const y = new Date(Date.now() - DAY);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  state.streak = state.lastDay === yesterday ? state.streak + 1 : state.lastDay === t ? state.streak : 1;
  state.lastDay = t;
  save();
  return true;
}

/** streak shown today: still alive if the goal was hit yesterday or today */
export function liveStreak() {
  const y = new Date(Date.now() - DAY);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return state.lastDay === today() || state.lastDay === yesterday ? state.streak : 0;
}

export const level = (xp = state.xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const levelFloor = (lv: number) => (lv - 1) ** 2 * 40;

export function exportCode(): string {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code: string): boolean {
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as State;
    if (s.v !== 1 || typeof s.cards !== 'object') return false;
    Object.assign(state, s);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

export function resetAll() {
  Object.assign(state, fresh());
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
