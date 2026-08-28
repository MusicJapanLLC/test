import { prefersReducedMotion } from './motion';

let cached: boolean | null = null;

/** WebGL が使えるか。使えない環境ではCSSの静的グラデーションだけで成立させる */
export function supportsWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    cached = Boolean(gl);
  } catch {
    cached = false;
  }
  return cached;
}

/** 3Dを動かしてよい状況か（reduce motion なら止める） */
export const shouldRender3D = (): boolean => supportsWebGL() && !prefersReducedMotion();

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/** ヒーローを描き終えてから3Dを読み込む。LCPを遅らせないため */
export function whenIdle(run: () => void, timeout: number): void {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout });
  else window.setTimeout(run, 200);
}
