import {
  ACHIEVEMENTS,
  onAchievementChange,
  progress,
  renderPanel,
  unlock,
} from './achievements';
import { onSoundChange, setSound, sfx, soundOn } from './sound';
import { shuffleMenuBots } from './robots';
import { listenKonami } from './town';

/** ヘッダー・メニュー・実績・サウンド・フッターなど、全ページ共通の動き */
export function initChrome(): void {
  const header = document.querySelector<HTMLElement>('[data-chrome]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  initMenu();
  initAchievements();
  initSound();
  initFooter();
  listenKonami();
  initSfx();
}

function initMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const sheet = document.querySelector<HTMLElement>('[data-menu-sheet]');
  if (!btn || !sheet) return;
  const items = Array.from(sheet.querySelectorAll<HTMLElement>('.cmd__item, .menu-games a'));
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    document.documentElement.classList.toggle('menu-open', open);
    sfx.menu(open);
    if (open) {
      shuffleMenuBots(sheet);
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    } else {
      sheet.classList.remove('is-open');
      window.setTimeout(() => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
      }, 360);
    }
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  sheet.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });
  window.addEventListener('keydown', (e) => {
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    if (e.key === 'Escape') set(false);
    /* ゲームのメニューのように、↑↓でカーソルを動かす */
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      next?.focus();
      sfx.tick();
    }
  });
}

function initAchievements(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-ach-toggle]');
  const panel = document.querySelector<HTMLElement>('[data-ach-panel]');
  const count = document.querySelector<HTMLElement>('[data-ach-count]');
  const refresh = () => {
    const { done, total } = progress();
    if (count) count.textContent = `${done}/${total}`;
    if (panel && !panel.hidden) renderPanel(panel);
    btn?.classList.toggle('is-complete', done === ACHIEVEMENTS.length);
  };
  refresh();
  onAchievementChange(() => {
    refresh();
    btn?.classList.remove('is-bump');
    void btn?.offsetWidth;
    btn?.classList.add('is-bump');
  });
  if (!btn || !panel) return;

  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      renderPanel(panel);
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
    } else {
      panel.classList.remove('is-open');
      window.setTimeout(() => {
        if (!panel.classList.contains('is-open')) panel.hidden = true;
      }, 240);
    }
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    set(btn.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node)) set(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) set(false);
  });
}

function initSound(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  if (!btn) return;
  const paint = (on: boolean) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'サウンドをオフにする' : 'サウンドをオンにする');
    btn.classList.toggle('is-on', on);
  };
  paint(soundOn());
  onSoundChange(paint);
  btn.addEventListener('click', () => {
    setSound(!soundOn());
    unlock('sound');
  });
}

function initFooter(): void {
  const bottom = document.querySelector('.foot__bottom');
  if (!bottom) return;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      unlock('bottom');
      io.disconnect();
    }
  });
  io.observe(bottom);
}

/** [data-sfx] の要素にカーソルを乗せる・押すと、小さく鳴る（サウンドON時のみ） */
function initSfx(): void {
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest('[data-sfx]');
    if (el && !el.contains(e.relatedTarget as Node)) sfx.hover();
  });
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-sfx]')) sfx.click();
  });
}
