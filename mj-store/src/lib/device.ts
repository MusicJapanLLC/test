import { reducedMotion } from './motion';

/**
 * 実機フレーム（スマホ／PCブラウザ）の中で、実際のゲーム画面を数秒ごとに切り替える。
 * 画面に入っているあいだだけ動く。
 */
export function initDevices(scope: ParentNode = document): void {
  const INTERVAL = 3200;
  scope.querySelectorAll<HTMLElement>('[data-device]').forEach((device) => {
    const shots = Array.from(device.querySelectorAll<HTMLImageElement>('.device__shot'));
    if (shots.length < 2 || reducedMotion()) return;
    let i = 0;
    let timer = 0;
    const next = () => {
      shots[i].classList.remove('is-on');
      i = (i + 1) % shots.length;
      shots[i].classList.add('is-on');
      /* 次の画像を先に読んでおく */
      const after = shots[(i + 1) % shots.length];
      if (after.loading === 'lazy') after.loading = 'eager';
    };
    new IntersectionObserver(([e]) => {
      window.clearInterval(timer);
      if (e.isIntersecting) timer = window.setInterval(next, INTERVAL);
    }).observe(device);
  });
}

/** スクリーンショットを大きく見る。←→で送り、Escで閉じる。スワイプも可 */
export function initLightbox(): void {
  const root = document.querySelector<HTMLElement>('[data-lightbox-root]');
  if (!root) return;
  /* 拡大する画像は、ページの「実際の画面」にある <img> をそのまま複製する（URL の文字列は扱わない） */
  const sources = Array.from(document.querySelectorAll<HTMLImageElement>('[data-shots] .shot__img'));
  const caps = Array.from(document.querySelectorAll<HTMLElement>('[data-shots] .shot__cap')).map((c) =>
    (c.lastChild?.textContent ?? '').trim(),
  );
  if (!sources.length) return;
  let img = root.querySelector<HTMLImageElement>('[data-lb-img]')!;
  const cap = root.querySelector<HTMLElement>('[data-lb-cap]')!;
  let index = 0;
  let opener: HTMLElement | null = null;

  const show = (i: number) => {
    index = (i + sources.length) % sources.length;
    const next = sources[index].cloneNode() as HTMLImageElement;
    next.className = 'lightbox__img';
    next.removeAttribute('loading');
    next.removeAttribute('style');
    next.setAttribute('data-lb-img', '');
    img.replaceWith(next);
    img = next;
    cap.textContent = `${String(index + 1).padStart(2, '0')} / ${String(sources.length).padStart(2, '0')}　${caps[index] ?? ''}`;
  };
  const open = (i: number, from: HTMLElement | null) => {
    opener = from;
    show(i);
    root.hidden = false;
    document.documentElement.classList.add('lb-open');
    requestAnimationFrame(() => root.classList.add('is-open'));
    root.querySelector<HTMLElement>('[data-lb-close]')?.focus();
  };
  const close = () => {
    root.classList.remove('is-open');
    document.documentElement.classList.remove('lb-open');
    window.setTimeout(() => (root.hidden = true), 250);
    opener?.focus();
  };

  document.querySelectorAll<HTMLElement>('[data-lightbox]').forEach((b) =>
    b.addEventListener('click', () => open(Number(b.dataset.lightbox), b)),
  );
  /* ヒーローの実機フレームを押しても、いま映っている画面から開く */
  document.querySelectorAll<HTMLElement>('.g-hero [data-device]').forEach((d) => {
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', '実際の画面を大きく見る');
    const go = () => {
      const on = d.querySelector<HTMLElement>('.device__shot.is-on');
      open(Number(on?.dataset.shot ?? 0), d);
    };
    d.addEventListener('click', go);
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });

  root.querySelector('[data-lb-close]')?.addEventListener('click', close);
  root.querySelector('[data-lb-prev]')?.addEventListener('click', () => show(index - 1));
  root.querySelector('[data-lb-next]')?.addEventListener('click', () => show(index + 1));
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  window.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  let sx = 0;
  root.addEventListener('pointerdown', (e) => (sx = e.clientX));
  root.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  });
}
