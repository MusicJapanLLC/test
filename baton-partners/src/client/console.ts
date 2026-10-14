import { prefersReducedMotion } from './env';

/**
 * console の世界観（DPパートナーズなど）だけの小さな演出。
 *   ・切り替えの日：図が画面に入ったら、見に来る人の点が古いサーバーから新しいサーバーへ移っていく。「もう一度」で巻き戻す
 *   ・控えの置き場所：「乗っ取られたら？」で、WordPress 側が赤くなり、削除の指示が門で止まる（aria-pressed）
 * 「動きを減らす」設定では、切り替えの図は途中の状態で止めたまま（CSS）。乗っ取りの切り替えは同じように使える。
 */
export function setupConsole(): void {
  setupCutover();
  setupLocker();
}

function setupCutover() {
  const figs = document.querySelectorAll<HTMLElement>('[data-cutover]');
  if (!figs.length || prefersReducedMotion()) return;
  const play = (fig: HTMLElement) => {
    fig.classList.add('is-reset');
    fig.classList.remove('is-go');
    void fig.offsetWidth;
    fig.classList.remove('is-reset');
    fig.classList.add('is-go');
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        window.setTimeout(() => play(e.target as HTMLElement), 400);
      }
    },
    { threshold: 0.35 },
  );
  figs.forEach((fig) => {
    io.observe(fig);
    fig.querySelector('[data-cutover-replay]')?.addEventListener('click', () => play(fig));
  });
}

function setupLocker() {
  document.querySelectorAll<HTMLElement>('[data-locker]').forEach((fig) => {
    const btn = fig.querySelector<HTMLButtonElement>('[data-locker-btn]');
    const log = fig.querySelector<HTMLElement>('[data-locker-log]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = (on ? btn.dataset.on : btn.dataset.off) ?? '';
      fig.classList.toggle('is-attack', on);
      if (log) log.textContent = on ? (log.dataset.done ?? '') : '';
    });
  });
}
