import { prefersReducedMotion } from './env';

/**
 * リレーの区間（top.relay）。スクロールに合わせて --p（0〜1）を進め、
 * いま走っている区間に is-run、走り終えた区間に is-done を付ける。
 * バトンの位置と、レールが赤く塗られていく長さは CSS が --p から決める。
 * 動きを減らす設定では、最初から全区間を走り終えた状態にする。
 */
export function setupRelayTrack(): void {
  const sec = document.querySelector<HTMLElement>('[data-relay]');
  if (!sec) return;
  const legs = [...sec.querySelectorAll<HTMLElement>('[data-leg]')];
  const set = (p: number) => {
    sec.style.setProperty('--p', p.toFixed(4));
    const at = Math.min(legs.length - 1, Math.floor(p * legs.length * 0.999));
    legs.forEach((l, i) => {
      l.classList.toggle('is-run', i === at && p < 1);
      l.classList.toggle('is-done', i < at || p >= 1);
    });
    sec.dataset.leg = String(at + 1);
  };
  if (prefersReducedMotion()) {
    set(1);
    return;
  }
  sec.classList.add('is-live');
  let ticking = false;
  const update = () => {
    ticking = false;
    const track = sec.querySelector<HTMLElement>('.relay-track') ?? sec;
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight;
    // 区間の帯が画面の下から入ってきて、上に抜けるまでを 0〜1 に
    const p = Math.min(1, Math.max(0, (vh * 0.78 - r.top) / (r.height + vh * 0.2)));
    set(p);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}
