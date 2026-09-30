import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { clamp, reducedMotion } from './env';
import type { World } from './world';

gsap.registerPlugin(ScrollTrigger);

export let lenis: Lenis | null = null;
let velocity = 0;

/** Split each phrase (.ph) or line ([data-chars]) into characters, keeping phrases unbreakable. */
export function splitChars(root: ParentNode = document) {
  const make = (host: Element) => {
    const text = host.textContent ?? '';
    host.textContent = '';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'c';
      s.textContent = ch;
      host.append(s);
    }
  };
  root.querySelectorAll('[data-split] .ph, [data-chars], [data-split-display]').forEach(make);
  root.querySelectorAll('h1[data-split]:not(:has(.ph)), h2[data-split]:not(:has(.ph))').forEach(make);
}

export function setupScroll(onTick: (time: number) => void) {
  if (reducedMotion()) return;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false, anchors: { offset: -80 } });
  lenis.on('scroll', (e: Lenis) => {
    velocity = e.velocity;
    ScrollTrigger.update();
  });
  gsap.ticker.add((t) => {
    lenis?.raf(t * 1000);
    onTick(t);
  });
  gsap.ticker.lagSmoothing(0);
}

export function reveals() {
  if (reducedMotion()) return;
  // headings: characters rise out of a mask, phrase by phrase
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((h) => {
    if (h.closest('.hero') || h.closest('.ih')) return;
    const chars = h.querySelectorAll('.c');
    gsap.set(chars, { yPercent: 115, rotate: 6 });
    ScrollTrigger.create({
      trigger: h,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1, ease: 'expo.out', stagger: 0.022 }),
    });
  });
  document.querySelectorAll<HTMLElement>('[data-reveal], .sec-body, .kicker, .mf-body, .news-list li, .step-body').forEach((el) => {
    if (el.closest('.hero') || el.closest('.stage') || el.closest('.intro')) return;
    gsap.set(el, { y: 40, opacity: 0 });
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' }) });
  });
  // manifesto: the words fill with ink as you scroll
  document.querySelectorAll<HTMLElement>('[data-fill]').forEach((h) => {
    const chars = h.querySelectorAll('.ph');
    gsap.fromTo(chars, { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: h, start: 'top 80%', end: 'bottom 45%', scrub: true } });
  });
  // oversized display words drift sideways with scroll
  document.querySelectorAll<HTMLElement>('.ih-display').forEach((d) => {
    gsap.to(d, { xPercent: -12, ease: 'none', scrollTrigger: { trigger: d, start: 'top top', end: 'bottom top', scrub: true } });
  });
  // media rings/waves parallax
  document.querySelectorAll<HTMLElement>('.brand-row, .roster').forEach((el) => {
    const img = el.querySelector('img');
    if (img) gsap.fromTo(img, { y: 20 }, { y: -20, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/** Marquees move on their own and speed up with scroll velocity. */
export function marquees() {
  const tracks = [...document.querySelectorAll<HTMLElement>('[data-velocity-marquee]')];
  const state = tracks.map(() => ({ x: 0 }));
  gsap.ticker.add((_t, delta) => {
    const dt = delta / 1000;
    tracks.forEach((el, i) => {
      const inner = (el.firstElementChild as HTMLElement | null) && el.classList.contains('ft-marquee') ? (el.firstElementChild as HTMLElement) : el;
      const w = inner.scrollWidth / 4;
      if (!w) return;
      const speed = 60 + Math.abs(velocity) * 40;
      state[i].x = (state[i].x - speed * dt * (i % 2 ? -1 : 1)) % w;
      if (state[i].x > 0) state[i].x -= w;
      inner.style.transform = `translate3d(${state[i].x}px,0,0)`;
    });
  });
}

/**
 * Sections declare data-world-zone. The zone crossing the viewport's centre decides the
 * record's pose; the pinned stage blends the three chapters by scroll progress.
 */
export function worldZones(world: World | null) {
  const zones = [...document.querySelectorAll<HTMLElement>('[data-world-zone]')];
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  const steps = stage ? [...stage.querySelectorAll<HTMLElement>('.step')] : [];
  const bar = stage?.querySelector<HTMLElement>('[data-stage-bar]');
  let current = '';
  let activeStep = -1;
  const update = () => {
    const mid = innerHeight * 0.5;
    let zone = 'ambient';
    for (const z of zones) {
      const r = z.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) zone = z.dataset.worldZone ?? zone;
    }
    if (stage && zone === 'stage') {
      const r = stage.getBoundingClientRect();
      const p = clamp(-r.top / (stage.offsetHeight - innerHeight));
      bar?.style.setProperty('--p', p.toFixed(3));
      const step = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
      if (step !== activeStep) {
        activeStep = step;
        steps.forEach((s, i) => s.toggleAttribute('data-active', i === step));
      }
      if (world) {
        if (p < 0.34) {
          world.set('cut');
          world.setCut(clamp(p / 0.28));
        } else if (p < 0.42) world.blend('cut', 'spin', (p - 0.34) / 0.08);
        else if (p < 0.68) world.set('spin');
        else if (p < 0.76) world.blend('spin', 'voice', (p - 0.68) / 0.08);
        else world.set('voice');
      }
      current = 'stage';
      return;
    }
    if (zone !== current) {
      current = zone;
      world?.set(zone);
    }
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  return update;
}

export function heroEntrance(delay = 0) {
  if (reducedMotion()) return;
  const chars = document.querySelectorAll('.hero-title .c');
  const tl = gsap.timeline({ delay });
  tl.fromTo(chars, { yPercent: 120, skewY: 14, opacity: 0 }, { yPercent: 0, skewY: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.035 })
    .fromTo('.hero .kicker, .hero-rpm', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.2)
    .fromTo('.hero-lead .ph', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.9, ease: 'expo.out' }, 0.45)
    .fromTo('.hero-sub, .hero-actions, .hero-scroll', { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.9, ease: 'expo.out' }, 0.6);
  return tl;
}

export function innerEntrance() {
  if (reducedMotion()) return;
  const tl = gsap.timeline({ delay: 0.15 });
  tl.fromTo('.ih-display .c', { yPercent: 110 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.03 })
    .fromTo('.ih-title .c, .pf-name .c', { yPercent: 115 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.03 }, 0.2)
    .fromTo('.ih-copy > :not(.ih-title), .pf-copy > :not(.pf-name), .pf-portrait', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.35);
}
