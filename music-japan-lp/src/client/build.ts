import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * 一社のページができるまで（8つの工程）。
 * 大きな画面：画面を止めて、縦のスクロールで横に流す。いまの工程のカードが赤く光る。
 * スマホと「動きを減らす」設定：横にスワイプして読む（止めない）。
 */
export function buildTrack(reduced: boolean) {
  const track = document.querySelector<HTMLElement>('[data-build-track]');
  const pin = document.querySelector<HTMLElement>('.build-pin');
  if (!track || !pin) return;
  const steps = Array.from(track.querySelectorAll<HTMLElement>('.build-step'));
  const bar = document.querySelector<HTMLElement>('[data-build-bar]');
  const count = document.querySelector<HTMLElement>('[data-build-count]');
  const show = (p: number, idx: number) => {
    steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
    bar?.style.setProperty('--p', p.toFixed(3));
    if (count) count.textContent = String(idx + 1).padStart(2, '0');
  };

  const wide = window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  if (!wide || reduced) {
    // 横スワイプ：真ん中に来たカードを、いまの工程にする
    document.documentElement.classList.add('build-swipe');
    const viewport = track.parentElement!;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = steps.indexOf(e.target as HTMLElement);
          show(i / (steps.length - 1), i);
        }
      },
      { root: viewport, threshold: 0.6 },
    );
    steps.forEach((s) => io.observe(s));
    return;
  }

  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => `+=${dist() + window.innerHeight * 0.25}`,
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => show(self.progress, Math.min(steps.length - 1, Math.round(self.progress * (steps.length - 1)))),
    },
  });
  // 文字や画像で高さが変わったら、止める位置を測り直す
  let lastH = 0;
  let t = 0;
  new ResizeObserver(() => {
    const h = document.body.scrollHeight;
    if (Math.abs(h - lastH) < 2) return;
    lastH = h;
    window.clearTimeout(t);
    t = window.setTimeout(() => ScrollTrigger.refresh(), 160);
  }).observe(document.body);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
