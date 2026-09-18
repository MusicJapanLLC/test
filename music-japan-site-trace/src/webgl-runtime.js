// Adapted from baton/src/lib/webgl.ts at bb60b784.
// Keep renderer/resize/pointer conventions; actually cancel rAF on suspension.
import { WebGLRenderer } from 'three';

export const isMobile = () => matchMedia('(pointer: coarse)').matches || innerWidth <= 760;
export const pixelRatioCap = () => isMobile() ? 1.25 : 1.75;
export function makeRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false,
    powerPreference: isMobile() ? 'low-power' : 'high-performance', stencil: false, depth: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatioCap()));
  renderer.setClearColor(0x0a0a0a, 0);
  return renderer;
}

export function visibleLoop(target, render, onPause = () => {}, onState = () => {}) {
  let raf = 0, previous = null, elapsed = 0, intersecting = false, enabled = true, disposed = false, running = false;
  function cancel() {
    cancelAnimationFrame(raf); raf = 0; previous = null;
    onPause(); if(running){running=false;onState(false);}
  }
  function start() {
    if (!raf && intersecting && enabled && !document.hidden && !disposed) {
      raf = requestAnimationFrame(tick); if(!running){running=true;onState(true);}
    }
  }
  function tick(now) {
    raf = 0;
    if (!intersecting || document.hidden || !enabled || disposed) return cancel();
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, .05);
    previous = now; elapsed += delta;
    render(elapsed, delta, now);
    start();
  }
  const io = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    intersecting ? start() : cancel();
  }, { threshold: 0 });
  io.observe(target);
  const visibility = () => document.hidden ? cancel() : start();
  const pageHide = () => cancel();
  document.addEventListener('visibilitychange', visibility);
  addEventListener('pagehide', pageHide);
  addEventListener('pageshow', visibility);
  return {
    enable(value) { enabled = value; value ? start() : cancel(); },
    dispose() { disposed = true; cancel(); io.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      removeEventListener('pagehide', pageHide); removeEventListener('pageshow', visibility); }
  };
}

export function onResize(target, callback) {
  const apply = () => {
    const rect = target.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) callback(rect.width, rect.height);
  };
  const observer = new ResizeObserver(apply);
  observer.observe(target); apply();
  return () => observer.disconnect();
}

export function pointerTracker(target) {
  const raw = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  const pointer = e => {
    if (e.pointerType !== 'mouse') return;
    const r = target.getBoundingClientRect();
    raw.x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
    raw.y = Math.max(-1, Math.min(1, 1 - (e.clientY - r.top) / r.height * 2));
  };
  const orientation = e => {
    if (!Number.isFinite(e.gamma) || !Number.isFinite(e.beta)) return;
    raw.x = Math.max(-1, Math.min(1, e.gamma / 35));
    raw.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
  };
  target.addEventListener('pointermove', pointer, { passive: true });
  // No intrusive iOS permission prompt. On permission-gated iOS use touch parallax.
  const gyroAllowed = typeof DeviceOrientationEvent !== 'undefined' && !DeviceOrientationEvent.requestPermission;
  if (gyroAllowed) addEventListener('deviceorientation', orientation, { passive: true });
  return { update(delta) {
    const damping = 1 - Math.exp(-2.8 * delta);
    smooth.x += (raw.x - smooth.x) * damping; smooth.y += (raw.y - smooth.y) * damping;
    return smooth;
  }, dispose() { target.removeEventListener('pointermove', pointer);
    if (gyroAllowed) removeEventListener('deviceorientation', orientation); } };
}
