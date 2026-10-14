import { prefersReducedMotion, supportsWebGL } from './env';
import type { PhasedScene } from './scene';

/**
 * トップのステージ。スクロール量から「ヒーロー → 集める → つなぐ → 決める」を切り替え、
 * WebGLシーンの phase を動かす。動きを減らす設定・WebGLなしでは何もしない（縦並びのまま）。
 */
const STATES = [0.16, 0.42, 0.68];
/** スクロール進捗 → シーンの phase。途中に「止まる区間」を入れて、読む時間をつくる */
const STOPS: [number, number][] = [
  [0, 0.55],
  [0.1, 0.55],
  [0.3, 0.8],
  [0.42, 0.8],
  [0.56, 1],
  [0.68, 1],
  [0.84, 2],
  [1, 2],
];

function phaseAt(p: number): number {
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, y1] = STOPS[i];
    const [x0, y0] = STOPS[i - 1];
    if (p <= x1) return y0 + ((p - x0) / (x1 - x0 || 1)) * (y1 - y0);
  }
  return 2;
}

/** ヒーロー表示中（スクロール前）の phase。散らばった点が集まりかけている状態 */
export const HERO_PHASE = STOPS[0][1];

export function setupStage(): { attach: (s: PhasedScene) => void } | null {
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  if (!stage || prefersReducedMotion() || !supportsWebGL()) return null;

  document.documentElement.classList.add('js-stage');
  const bar = stage.querySelector<HTMLElement>('[data-progress]');
  const step = stage.querySelector<HTMLElement>('[data-step]');
  let scene: PhasedScene | null = null;
  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const total = stage.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / (total || 1)));
    const state = STATES.filter((s) => p >= s).length;
    if (stage.dataset.state !== String(state)) {
      stage.dataset.state = String(state);
      if (step) step.textContent = `0${state} / 03`;
    }
    bar?.style.setProperty('--p', String(p));
    if (scene) scene.target = phaseAt(p);
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

  return {
    attach(s) {
      scene = s;
      s.target = phaseAt(Math.min(1, Math.max(0, -stage.getBoundingClientRect().top / (stage.offsetHeight - window.innerHeight || 1))));
    },
  };
}
