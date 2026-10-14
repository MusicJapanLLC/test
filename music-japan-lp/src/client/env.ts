/** 端末の性能と設定を見て、演出の強さを決める */
export const reducedMotion = (): boolean => document.documentElement.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = (): boolean => matchMedia('(pointer: fine)').matches;
export const isMobile = (): boolean => window.innerWidth < 760 || matchMedia('(pointer: coarse)').matches;

export function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    return !!gl && !!(gl as WebGL2RenderingContext).getExtension;
  } catch {
    return false;
  }
}

export function tier(): 'high' | 'mid' | 'low' {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (isMobile()) return cores >= 6 && mem >= 4 ? 'mid' : 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'mid';
}

export const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
export const ease = (t: number): number => t * t * (3 - 2 * t);
