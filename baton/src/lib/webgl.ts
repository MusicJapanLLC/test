import { WebGLRenderer } from 'three';
import { isLowPower } from './motion';

export function makeRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const low = isLowPower();
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !low,
    powerPreference: low ? 'low-power' : 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

type LoopHandle = { stop: () => void };

/**
 * 画面外・非アクティブタブでは回さない。スマホの電池とスクロール性能のため。
 */
export function startLoop(
  canvas: HTMLCanvasElement,
  onFrame: (elapsed: number, delta: number) => void,
): LoopHandle {
  let raf = 0;
  let last = performance.now();
  let visible = true;
  const start = last;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    onFrame((now - start) / 1000, delta);
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
    },
    { rootMargin: '120px' },
  );
  io.observe(canvas);

  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    },
  };
}

/** ResizeObserver ベースのリサイズ。iOS のアドレスバー伸縮でも暴れない */
export function onResize(canvas: HTMLCanvasElement, handler: (w: number, h: number) => void) {
  const apply = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) handler(rect.width, rect.height);
  };
  const ro = new ResizeObserver(apply);
  ro.observe(canvas);
  apply();
  return () => ro.disconnect();
}

/** マウス位置を -1..1 で緩やかに追う */
export function pointerTracker(target: HTMLElement) {
  const raw = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  const onMove = (e: PointerEvent) => {
    const rect = target.getBoundingClientRect();
    raw.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    raw.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  window.addEventListener('pointermove', onMove, { passive: true });

  return {
    update(damping = 0.045) {
      smooth.x += (raw.x - smooth.x) * damping;
      smooth.y += (raw.y - smooth.y) * damping;
      return smooth;
    },
    dispose: () => window.removeEventListener('pointermove', onMove),
  };
}
