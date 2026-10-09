import { mountAmbient, type AmbientHandle } from './ambient';
import { reducedMotion } from './motion';

/** トップの特集カルーセル。7秒ごとに次の作品へ。マウスを乗せている間は止まる */
export function initFeature(): void {
  const root = document.querySelector<HTMLElement>('[data-feature]');
  if (!root) return;
  const stage = root.querySelector<HTMLElement>('.feature__stage')!;
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
  const rails = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-goto]'));
  const n = slides.length;
  if (!n) return;

  const DURATION = 7000;
  const handles: (AmbientHandle | null)[] = slides.map(() => null);
  let index = 0;
  let elapsed = 0;
  let last = performance.now();
  let hovering = false;
  const auto = !reducedMotion() && n > 1;

  const ensure = (i: number) => {
    if (!handles[i]) {
      const canvas = slides[i].querySelector<HTMLCanvasElement>('canvas[data-ambient]');
      handles[i] = canvas ? mountAmbient(canvas, false) : null;
    }
    return handles[i];
  };

  function go(i: number) {
    const next = (i + n) % n;
    if (next === index && handles[next]) return;
    const prev = index;
    index = next;
    elapsed = 0;
    slides.forEach((s, k) => {
      const on = k === index;
      s.classList.toggle('is-active', on);
      s.classList.toggle('is-prev', k === prev && !on);
      s.setAttribute('aria-hidden', String(!on));
      s.querySelectorAll<HTMLElement>('a').forEach((a) => (a.tabIndex = on ? 0 : -1));
      s.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((im) => {
        if (on) im.loading = 'eager';
      });
    });
    rails.forEach((r, k) => {
      r.classList.toggle('is-active', k === index);
      r.setAttribute('aria-selected', String(k === index));
      r.style.setProperty('--p', '0');
    });
    ensure(index)?.play();
    handles.forEach((h, k) => k !== index && window.setTimeout(() => k !== index && h?.pause(), 900));
    window.setTimeout(() => ensure((index + 1) % n), 1200);
  }

  rails.forEach((r) => r.addEventListener('click', () => go(Number(r.dataset.goto))));
  root.querySelector('.feature__rail')?.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'ArrowRight' && k !== 'ArrowLeft') return;
    e.preventDefault();
    const d = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1;
    go(index + d);
    rails[index].focus();
  });

  stage.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hovering = true;
  });
  stage.addEventListener('pointerleave', () => (hovering = false));

  /* スワイプ */
  let sx = 0;
  let sy = 0;
  stage.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
  });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) go(index + (dx < 0 ? 1 : -1));
  });

  /* 最初の1枚 */
  handles[0] = null;
  index = -1;
  go(0);

  if (!auto) return;
  const loop = (now: number) => {
    const dt = now - last;
    last = now;
    if (!hovering && !document.hidden) elapsed += dt;
    rails[index]?.style.setProperty('--p', String(Math.min(1, elapsed / DURATION)));
    if (elapsed >= DURATION) go(index + 1);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
