/** 公開中の会社：カーソルで少し傾き、見えているあいだは4秒ごとに2枚目の画面に替わる */
export function projects(reduced: boolean) {
  document.querySelectorAll<HTMLElement>('[data-proj]').forEach((proj) => {
    const media = proj.querySelector<HTMLElement>('[data-tilt]');
    const browser = media?.querySelector<HTMLElement>('.proj-browser');
    const phone = media?.querySelector<HTMLElement>('.proj-phone');
    if (media && browser && phone && !reduced) {
      media.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = media.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        browser.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
        browser.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
        phone.style.setProperty('--px', `${(x * -24).toFixed(1)}px`);
        phone.style.setProperty('--py', `${(y * -18).toFixed(1)}px`);
      });
      media.addEventListener('pointerleave', () => {
        browser.style.setProperty('--ry', '0deg');
        browser.style.setProperty('--rx', '0deg');
        phone.style.setProperty('--px', '0px');
        phone.style.setProperty('--py', '0px');
      });
    }
    if (reduced) return;
    let timer = 0;
    new IntersectionObserver(
      ([e]) => {
        window.clearInterval(timer);
        if (e.isIntersecting) timer = window.setInterval(() => proj.classList.toggle('is-alt'), 4200);
      },
      { threshold: 0.35 },
    ).observe(proj);
  });
}
