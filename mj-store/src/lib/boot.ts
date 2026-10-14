import { reducedMotion } from './motion';
import { sfx } from './sound';
import { session } from './storage';

/**
 * 起動画面。MJ STORE を「ゲーム機の起動」のように立ち上げる。
 * 1回の訪問（タブ）につき1度だけ。クリックかキーで飛ばせる。
 */
export function runBoot(): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-boot]');
  if (!el) return Promise.resolve();
  if (reducedMotion() || session.get('mjstore:booted')) {
    el.remove();
    return Promise.resolve();
  }
  session.set('mjstore:booted', '1');
  el.hidden = false;
  document.documentElement.classList.add('is-booting');
  requestAnimationFrame(() => el.classList.add('is-run'));
  sfx.boot();

  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', done);
      el.classList.add('is-done');
      document.documentElement.classList.remove('is-booting');
      window.setTimeout(() => {
        el.remove();
        resolve();
      }, 760);
    };
    const timer = window.setTimeout(done, 2400);
    el.addEventListener('click', done);
    window.addEventListener('keydown', done);
  });
}
