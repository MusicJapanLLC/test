export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let webgl: boolean | null = null;

/** WebGL が使えるか。使えない環境はCSSの静的な代替で成立させる */
export function supportsWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/** 見出しを描き終えてから3Dを読み込む。LCPを遅らせないため */
export function whenIdle(run: () => void, timeout = 1200): void {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout });
  else window.setTimeout(run, 120);
}
