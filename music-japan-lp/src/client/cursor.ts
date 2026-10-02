/**
 * カーソル（マウスの端末だけ）。赤い点はそのまま、輪は少し遅れてついてくる。
 * data-cursor のある要素の上では、輪がふくらんでラベル（TALK / OPEN など）を出す。
 * data-magnetic のボタンは、カーソルに少し吸い寄せられる。
 */
export function cursor() {
  const el = document.querySelector<HTMLElement>('[data-cursor-el]');
  if (!el) return;
  document.documentElement.classList.add('has-cursor');
  const label = el.querySelector('b')!;
  let x = -100;
  let y = -100;
  let rx = -100;
  let ry = -100;
  let shown = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        rx = x;
        ry = y;
        shown = true;
      }
    },
    { passive: true },
  );
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    el.style.setProperty('--rx', `${rx}px`);
    el.style.setProperty('--ry', `${ry}px`);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor]');
    if (t) {
      label.textContent = t.dataset.cursor ?? '';
      el.classList.add('is-label');
    } else if ((e.target as HTMLElement).closest('a, button, summary')) {
      label.textContent = '';
      el.classList.remove('is-label');
      el.style.setProperty('--s', '0.6');
    } else {
      label.textContent = '';
      el.classList.remove('is-label');
      el.style.setProperty('--s', '1');
    }
  });

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((m) => {
    m.addEventListener('pointermove', (e) => {
      const r = m.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      m.style.transform = `translate(${dx * 0.16}px, ${dy * 0.24}px)`;
      m.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      m.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    m.addEventListener('pointerleave', () => {
      m.style.transform = '';
    });
  });
}
