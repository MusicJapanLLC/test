import { prefersReducedMotion, supportsWebGL, whenIdle } from './env';
import type { PhasedScene } from './scene';
import { HERO_PHASE } from './stage';

/** ページ内の [data-scene] をすべて起動する。three.js は必要になってから読み込む */
export function mountScenes(onTop?: (scene: PhasedScene) => void): void {
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
    // 企業の世界観で、描くシーンを切り替える（body[data-world-scene]）
    const lattice = document.body.dataset.worldScene === 'lattice';
    const Scene = lattice ? (await import('./lattice')).LatticeScene : (await import('./scene')).NetworkScene;
    for (const host of hosts) {
      const canvas = host.querySelector('canvas');
      if (!canvas) continue;
      const base = Number(host.dataset.count ?? 1000);
      const isStage = host.closest('[data-stage]') !== null;
      const isAurora = host.dataset.scene === 'aurora';
      const scene = new Scene({
        host,
        canvas,
        count: Math.round(base * (small ? 0.45 : 1)),
        phase: Number(host.dataset.phase ?? (isStage ? HERO_PHASE : 0)),
        // 求職者（点）・求人（輪）・決定（重なり）の3色。企業ごとに head の CSS 変数で渡す
        ink: color('--scene-a', color('--ink', '#141414')),
        brand: color('--scene-b', color('--brand', '#147F6E')),
        red: color('--scene-match', color('--red', '#C8102E')),
        layout: isStage ? 'right' : 'center',
        animate,
        mode: isAurora ? 'aurora' : 'network',
        aurora: isAurora ? 1.2 : isStage ? 1 : 0.8,
      });
      if (isStage) onTop?.(scene);
    }
  });
}
