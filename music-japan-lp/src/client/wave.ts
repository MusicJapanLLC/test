/**
 * SECOND TAKE：カチンコの下で、声の波がゆっくり動く（Canvas 2D）。
 * 見えているあいだだけ描く。動きを減らす設定では、止まった波を1枚だけ描く。
 */
export function wave(reduced: boolean) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-wave]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#141414';
  const accent = css.getPropertyValue('--accent').trim() || '#d62b33';
  let w = 0;
  let h = 0;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = (t: number) => {
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const bars = Math.max(24, Math.floor(w / 7));
    for (let i = 0; i < bars; i++) {
      const x = (i + 0.5) * (w / bars);
      const k = i / bars;
      const env = Math.sin(Math.PI * k) ** 0.8;
      const v = (Math.sin(k * 19 + t * 1.9) * 0.5 + Math.sin(k * 7.3 - t * 1.3) * 0.35 + Math.sin(k * 41 + t * 3.1) * 0.15) * env;
      const bh = Math.max(2, Math.abs(v) * h * 0.9);
      const hot = Math.abs(k - (0.5 + Math.sin(t * 0.5) * 0.3)) < 0.06;
      ctx.fillStyle = hot ? accent : ink;
      ctx.globalAlpha = hot ? 1 : 0.18 + env * 0.5;
      ctx.beginPath();
      ctx.roundRect(x - 1.25, mid - bh / 2, 2.5, bh, 1.25);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  size();
  window.addEventListener('resize', size);
  if (reduced) {
    draw(1.2);
    return;
  }
  let raf = 0;
  let on = false;
  const loop = (now: number) => {
    draw(now / 1000);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) {
      on = true;
      raf = requestAnimationFrame(loop);
    } else if (!e.isIntersecting && on) {
      on = false;
      cancelAnimationFrame(raf);
    }
  }).observe(canvas);
}
