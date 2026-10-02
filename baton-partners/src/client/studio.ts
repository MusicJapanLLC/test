import { prefersReducedMotion } from './env';

/**
 * studio の世界観（Smartaleck など）だけの小さな演出。
 * ファインダーのタイムコード（時:分:秒:コマ）を、画面に見えている間だけ進める。
 * 「動きを減らす」設定では止めたまま（00:00:00:00 の静止画として成立する）。
 */
export function setupStudio(): void {
  if (prefersReducedMotion()) return;
  document.querySelectorAll<HTMLElement>('[data-timecode]').forEach((el) => {
    let raf = 0;
    let start = 0;
    const pad = (n: number) => String(n).padStart(2, '0');
    const tick = (now: number) => {
      if (!start) start = now;
      const s = (now - start) / 1000;
      const f = Math.floor((s % 1) * 24);
      el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}:${pad(f)}`;
      raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) raf = requestAnimationFrame(tick);
    }).observe(el);
  });
}
