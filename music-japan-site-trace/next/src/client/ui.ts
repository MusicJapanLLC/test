import { gsap } from 'gsap';
import { finePointer, reducedMotion } from './env';
import { lenis } from './motion';

export function setupHeader() {
  const hd = document.querySelector<HTMLElement>('[data-hd]');
  const btn = document.querySelector<HTMLButtonElement>('[data-menu]');
  const nav = document.getElementById('nav');
  let last = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    hd?.classList.toggle('is-scrolled', y > 40);
    hd?.classList.toggle('is-hidden', y > last && y > 400 && !document.documentElement.classList.contains('is-menu'));
    last = y;
  }, { passive: true });
  btn?.addEventListener('click', () => {
    const open = !document.documentElement.classList.contains('is-menu');
    document.documentElement.classList.toggle('is-menu', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? btn.dataset.close! : btn.dataset.open!);
    if (open) lenis?.stop(); else lenis?.start();
  });
  nav?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) {
      document.documentElement.classList.remove('is-menu');
      btn?.setAttribute('aria-expanded', 'false');
      lenis?.start();
    }
  });
  document.querySelector('[data-top]')?.addEventListener('click', (e) => {
    if (!lenis) return;
    e.preventDefault();
    lenis.scrollTo(0, { duration: 1.6 });
  });
}

export function setupCursor() {
  const el = document.querySelector<HTMLElement>('[data-cursor]');
  if (!el || !finePointer() || reducedMotion()) { el?.remove(); return; }
  document.documentElement.classList.add('has-cursor');
  const label = el.querySelector('b')!;
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    xTo(pos.x); yTo(pos.y);
    el.classList.add('is-on');
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('a,button,[data-cursor-label],input,select,textarea');
    const text = t?.closest<HTMLElement>('[data-cursor-label]')?.dataset.cursorLabel ?? '';
    el.classList.toggle('is-link', Boolean(t));
    el.classList.toggle('is-label', Boolean(text));
    label.textContent = text;
  });
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-on'));
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
}

export function setupMagnetic() {
  if (!finePointer() || reducedMotion()) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.28);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

/** Leaving a page: the red record wipe closes over it; the next page opens from it. */
export function setupTransitions() {
  const wipe = document.querySelector<HTMLElement>('[data-wipe]');
  if (!wipe) return;
  const root = document.documentElement;
  requestAnimationFrame(() => root.classList.add('is-loaded'));
  addEventListener('pageshow', (e) => { if (e.persisted) { root.classList.remove('is-leaving'); root.classList.add('is-loaded'); } });
  if (reducedMotion()) return;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/audio/')) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    wipe.style.setProperty('--wx', `${r.left + r.width / 2}px`);
    wipe.style.setProperty('--wy', `${r.top + r.height / 2}px`);
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 620);
  });
}

export function setupCrate() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const items = [...document.querySelectorAll<HTMLElement>('.crate-grid .rel')];
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const f = b.dataset.filter;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const show = items.filter((i) => f === 'all' || i.dataset.group === f);
      const hide = items.filter((i) => !show.includes(i));
      hide.forEach((i) => (i.hidden = true));
      show.forEach((i) => (i.hidden = false));
      if (!reducedMotion()) gsap.fromTo(show, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
    }),
  );
  // sleeves tilt toward the pointer
  if (!finePointer() || reducedMotion()) return;
  document.querySelectorAll<HTMLElement>('.sleeve, .roster-sleeve, .pt-item').forEach((s) => {
    s.addEventListener('pointermove', (e) => {
      const r = s.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      s.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
      s.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
      s.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      s.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    s.addEventListener('pointerleave', () => { s.style.setProperty('--rx', '0deg'); s.style.setProperty('--ry', '0deg'); });
  });
}

export function setupContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const ja = form.dataset.locale === 'ja';
  const err = form.querySelector<HTMLElement>('[data-form-error]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      err && (err.hidden = false);
      form.querySelector<HTMLElement>(':invalid')?.focus();
      return;
    }
    err && (err.hidden = true);
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? '');
    const body = ja
      ? `お問い合わせ種別：${v('type')}\nお名前：${v('name')}\n会社名：${v('company') || '未記入'}\nメールアドレス：${v('email')}\n\nお問い合わせ内容：\n${v('message')}`
      : `Inquiry type: ${v('type')}\nName: ${v('name')}\nCompany: ${v('company') || 'Not provided'}\nEmail: ${v('email')}\n\nMessage:\n${v('message')}`;
    location.href = `mailto:music.japan.llc@gmail.com?subject=${encodeURIComponent(`[Music Japan] ${v('type')}`)}&body=${encodeURIComponent(body)}`;
  });
}
