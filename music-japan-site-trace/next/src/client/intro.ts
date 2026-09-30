import { gsap } from 'gsap';
import type { World } from './world';

/**
 * NEEDLE DROP. The official symbol draws itself groove by groove, the red wave runs
 * across it, then the symbol rushes towards you and becomes the spinning record while
 * an iris opens onto the page. Repeat visits in the same session get a 0.9 s cut.
 */
export function playIntro(world: World | null, onDrop: () => void): Promise<void> {
  const root = document.documentElement;
  const el = document.querySelector<HTMLElement>('[data-intro-overlay]');
  const variant = root.dataset.intro;
  if (!el || !variant) {
    el?.remove();
    world?.jump('hero');
    onDrop();
    return Promise.resolve();
  }
  try { sessionStorage.setItem('mj-intro', '1'); } catch { /* private mode */ }
  document.body.classList.add('is-intro');

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      tl.kill();
      el.remove();
      document.body.classList.remove('is-intro');
      delete root.dataset.intro;
      resolve();
    };
    const drop = () => {
      world?.drop();
      onDrop();
    };
    const full = variant === 'full';
    const rings = el.querySelectorAll<SVGCircleElement>('.im-ring');
    rings.forEach((r) => {
      const c = r.style.getPropertyValue('--c');
      r.style.strokeDasharray = c;
      r.style.strokeDashoffset = full ? c : '0';
    });
    const tl = gsap.timeline({ onComplete: finish });
    if (full) {
      tl.to(rings, { strokeDashoffset: 0, duration: 0.75, ease: 'power3.inOut', stagger: 0.06 }, 0.05)
        .fromTo('.im-arc', { strokeDashoffset: 1, autoAlpha: 0 }, { strokeDashoffset: 0, autoAlpha: 1, duration: 0.35, ease: 'power2.out' }, 0.55)
        .fromTo('.im-dot', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, 0.72)
        .fromTo('.im-wave', { strokeDashoffset: 1, autoAlpha: 0 }, { strokeDashoffset: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.inOut' }, 0.62)
        .fromTo('.intro-cap span', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'expo.out' }, 0.2)
        .to('.intro-cap', { opacity: 0, duration: 0.25 }, 1.05);
    } else {
      tl.fromTo('.intro-mark', { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'expo.out' }, 0);
      tl.set('.intro-cap', { opacity: 0 }, 0);
    }
    const t0 = full ? 1.12 : 0.32;
    tl.add(drop, t0)
      .to('.intro-mark', { scale: 7, rotate: 28, opacity: 0, duration: 0.7, ease: 'expo.in' }, t0 - 0.28)
      .fromTo('.intro-flash', { opacity: 0 }, { opacity: 0.9, duration: 0.08, ease: 'none', yoyo: true, repeat: 1 }, t0)
      .fromTo('.intro-rings i', { scale: 0.2, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, immediateRender: false }, t0)
      .fromTo(el, { '--hole': '0%' }, { '--hole': '150%', duration: 0.9, ease: 'expo.inOut' }, t0 - 0.05);

    const skip = () => { tl.progress(1); };
    addEventListener('keydown', skip, { once: true });
    el.addEventListener('pointerdown', skip, { once: true });
    addEventListener('wheel', skip, { once: true, passive: true });
    addEventListener('touchmove', skip, { once: true, passive: true });
    // Safety net: never hold the page behind the intro.
    setTimeout(finish, 4000);
  });
}
