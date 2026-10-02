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

  // three.js とシーンは1回だけ読み込む
  let load: Promise<
    | typeof import('./scene').NetworkScene
    | typeof import('./lattice').LatticeScene
    | typeof import('./vault').VaultScene
    | typeof import('./en').EnScene
    | typeof import('./relay').RelayScene
    | typeof import('./feed').FeedScene
  > | null = null;
  const sceneClass = () =>
    (load ??=
      // 企業の世界観で、描くシーンを切り替える（body[data-world-scene]）
      document.body.dataset.worldScene === 'lattice'
        ? import('./lattice').then((m) => m.LatticeScene)
        : document.body.dataset.worldScene === 'vault'
          ? import('./vault').then((m) => m.VaultScene)
          : document.body.dataset.worldScene === 'en'
            ? import('./en').then((m) => m.EnScene)
            : document.body.dataset.worldScene === 'relay'
              ? import('./relay').then((m) => m.RelayScene)
              : document.body.dataset.worldScene === 'feed'
                ? import('./feed').then((m) => m.FeedScene)
              : import('./scene').then((m) => m.NetworkScene));

  const mount = async (host: HTMLElement) => {
    const Scene = await sceneClass();
    const canvas = host.querySelector('canvas');
    if (!canvas) return;
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
  };

  // 最初の画面にあるシーンだけ、見出しを描き終えてから準備する。
  // 下のほうのシーンは、スクロールで近づいたときに準備する（読み込み直後の負荷を減らす）
  const vh = window.innerHeight;
  const near = hosts.filter((h) => h.getBoundingClientRect().top < vh * 1.2);
  const later = hosts.filter((h) => !near.includes(h));
  whenIdle(() => near.forEach((h) => void mount(h)));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        void mount(e.target as HTMLElement);
      }
    },
    { rootMargin: '400px 0px' },
  );
  later.forEach((h) => io.observe(h));
}
