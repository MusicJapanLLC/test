import { prefersReducedMotion, supportsWebGL, whenIdle } from './env';
import type { NetworkScene } from './scene';
import { HERO_PHASE } from './stage';

/** ページ内の [data-scene] をすべて起動する。three.js は必要になってから読み込む */
export function mountScenes(onTop?: (scene: NetworkScene) => void): void {
  const hosts = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
  if (!hosts.length) return;

  if (!supportsWebGL()) {
    hosts.forEach((h) => h.classList.add('is-fallback'));
    return;
  }

  const css = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const small = window.matchMedia('(max-width: 767px)').matches;
  const animate = !prefersReducedMotion();

  whenIdle(async () => {
    const { NetworkScene } = await import('./scene');
    for (const host of hosts) {
      const canvas = host.querySelector('canvas');
      if (!canvas) continue;
      const base = Number(host.dataset.count ?? 1000);
      const isStage = host.closest('[data-stage]') !== null;
      const scene = new NetworkScene({
        host,
        canvas,
        count: Math.round(base * (small ? 0.45 : 1)),
        phase: Number(host.dataset.phase ?? (isStage ? HERO_PHASE : 0)),
        brand: color('--brand', '#147F6E'),
        ink: color('--ink', '#141414'),
        red: color('--red', '#C8102E'),
        layout: isStage ? 'right' : 'center',
        animate,
      });
      if (isStage) onTop?.(scene);
    }
  });
}
