export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const small = () => matchMedia('(max-width: 760px)').matches;
export const saveData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent smoothing */
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
