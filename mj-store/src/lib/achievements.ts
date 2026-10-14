import { sfx } from './sound';
import { local } from './storage';

/**
 * 実績。サイトの中で何かをすると、ゲームみたいに解除される。
 * 記録はこの端末のブラウザにだけ残る。
 */

export interface Achievement {
  id: string;
  title: string;
  hint: string;
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'boot', title: 'MJ STOREを起動した', hint: 'ストアを開く' },
  { id: 'first-game', title: 'はじめての作品ページ', hint: '作品のストアページを開く' },
  { id: 'all-games', title: '全作品、制覇', hint: 'すべてのストアページを開く' },
  { id: 'library', title: 'ライブラリを開いた', hint: '作品一覧を開く' },
  { id: 'patch', title: 'パッチノート愛読者', hint: 'バージョン履歴を最後まで読む' },
  { id: 'request', title: '声が届いた', hint: 'ご要望・バグ報告を送る' },
  { id: 'sound', title: 'サウンドチェック', hint: 'スピーカーのボタンを押す' },
  { id: 'news', title: '情報通', hint: 'お知らせのページを開く' },
  { id: 'crew', title: 'ちびロボ5体と話した', hint: 'サイトのあちこちにいるロボを、5体とも押す' },
  { id: 'bottom', title: '最後まで見た', hint: 'ページのいちばん下まで行く' },
  { id: 'konami', title: '↑↑↓↓←→←→BA', hint: '伝説のコマンド', secret: true },
  { id: 'town', title: 'MJタウンの住人', hint: 'どこかにある町の扉をくぐる', secret: true },
];

const KEY = 'mjstore:ach';
const VISITED = 'mjstore:visited';

let unlocked = new Set<string>(local.json<string[]>(KEY, []));
const listeners = new Set<() => void>();

const TROPHY =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h3v3c0 2.6-1.9 4.6-4.4 4.9A5 5 0 0 1 13 15.8V18h3v3H8v-3h3v-2.2a5 5 0 0 1-2.6-2.9C5.9 12.6 4 10.6 4 8V5h3zm0 4H6v1c0 1.2.6 2.2 1.6 2.7A5 5 0 0 1 7 8zm10 0v1a5 5 0 0 1-.6 2.7c1-.5 1.6-1.5 1.6-2.7V7z" fill="currentColor"/></svg>';

export const isUnlocked = (id: string) => unlocked.has(id);
export const progress = () => ({ done: unlocked.size, total: ACHIEVEMENTS.length });

export function onAchievementChange(fn: () => void): void {
  listeners.add(fn);
}

export function unlock(id: string): void {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || unlocked.has(id)) return;
  unlocked = new Set(unlocked).add(id);
  local.set(KEY, JSON.stringify([...unlocked]));
  listeners.forEach((fn) => fn());
  toast(a);
}

/** ストアページを開いたことを記録し、全作品を見たら解除 */
export function visitGame(id: string, allIds: string[]): void {
  const visited = new Set(local.json<string[]>(VISITED, []));
  visited.add(id);
  local.set(VISITED, JSON.stringify([...visited]));
  unlock('first-game');
  if (allIds.every((g) => visited.has(g))) unlock('all-games');
}

const queue: Achievement[] = [];
let showing = false;

function toast(a: Achievement): void {
  queue.push(a);
  if (!showing) next();
}

function next(): void {
  const a = queue.shift();
  const host = document.querySelector<HTMLElement>('[data-toasts]');
  if (!a || !host) {
    showing = false;
    return;
  }
  showing = true;
  const { done, total } = progress();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast__icon">${TROPHY}</span>
    <span class="toast__text"><small>実績解除</small><b></b></span>
    <span class="toast__count">${done}/${total}</span>`;
  el.querySelector('b')!.textContent = a.title;
  host.appendChild(el);
  sfx.unlock();
  requestAnimationFrame(() => el.classList.add('is-in'));
  window.setTimeout(() => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    window.setTimeout(() => {
      el.remove();
      next();
    }, 420);
  }, 3200);
}

export function renderPanel(panel: HTMLElement): void {
  const { done, total } = progress();
  panel.innerHTML = `
    <div class="ach-panel__head">
      <p class="ach-panel__title">ACHIEVEMENTS<small>実績</small></p>
      <p class="ach-panel__num"><b>${done}</b>/${total}</p>
    </div>
    <div class="ach-panel__bar"><i style="width:${(done / total) * 100}%"></i></div>
    <ul class="ach-list">
      ${ACHIEVEMENTS.map((a) => {
        const on = unlocked.has(a.id);
        const title = on || !a.secret ? a.title : '？？？';
        return `<li class="ach${on ? ' is-on' : ''}">
          <span class="ach__icon">${on ? TROPHY : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h2v11H5V10zm2 0h6V8a3 3 0 0 0-6 0z" fill="currentColor"/></svg>'}</span>
          <span class="ach__text"><b>${title}</b><small>${a.hint}</small></span>
        </li>`;
      }).join('')}
    </ul>
    <p class="ach-panel__note">実績は、この端末のブラウザに記録されます。</p>`;
}
