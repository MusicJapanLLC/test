import { gsap, isLowPower, prefersReducedMotion, ScrollTrigger } from '../lib/motion';

type Teardown = () => void;

export function guardHeroPhoto(scope: ParentNode = document): void {
  const img = scope.querySelector<HTMLImageElement>('[data-shot-img]');
  const shot = scope.querySelector<HTMLElement>('[data-shot]');
  if (!img || !shot) return;

  const fallback = () => shot.classList.add('pf-shot--noimg');
  if (img.complete && img.naturalWidth === 0) fallback();
  img.addEventListener('error', fallback, { once: true });
}

export function revealHero(hero: HTMLElement): void {
  window.requestAnimationFrame(() => hero.classList.add('is-in'));
}

export function cursorGlow(hero: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const target = { x: 0.5, y: 0.35 };
  const smooth = { ...target };
  let raf = 0;

  const onMove = (e: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    target.x = (e.clientX - rect.left) / rect.width;
    target.y = (e.clientY - rect.top) / rect.height;
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    smooth.x += (target.x - smooth.x) * 0.08;
    smooth.y += (target.y - smooth.y) * 0.08;
    hero.style.setProperty('--glow-x', `${(smooth.x * 100).toFixed(2)}%`);
    hero.style.setProperty('--glow-y', `${(smooth.y * 100).toFixed(2)}%`);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  hero.classList.add('has-glow');
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    hero.classList.remove('has-glow');
  };
}

export function heroParallax(hero: HTMLElement): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const shot = hero.querySelector<HTMLElement>('[data-shot]');
  const lead = hero.querySelector<HTMLElement>('.pf-lead');

  const ctx = gsap.context(() => {
    const scrollTrigger = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    if (shot) gsap.to(shot, { yPercent: -8, ease: 'none', scrollTrigger });
    if (lead) gsap.to(lead, { yPercent: 6, opacity: 0.25, ease: 'none', scrollTrigger });
  }, hero);

  ScrollTrigger.refresh();
  return () => ctx.revert();
}

export function splitHeadings(scope: ParentNode = document): void {
  const titles = Array.from(scope.querySelectorAll<HTMLElement>('.section__title'));
  if (!titles.length) return;

  titles.forEach((title) => {
    const text = title.textContent ?? '';
    if (!text) return;

    title.textContent = '';
    title.setAttribute('aria-label', text);
    title.classList.add('pf-split');

    Array.from(text).forEach((ch, i) => {
      const slot = document.createElement('span');
      slot.className = 'pf-split__slot';
      slot.setAttribute('aria-hidden', 'true');

      const inner = document.createElement('span');
      inner.className = 'pf-split__char';
      inner.style.setProperty('--i', String(i));
      inner.textContent = ch === ' ' ? ' ' : ch;

      slot.appendChild(inner);
      title.appendChild(slot);
    });

    if (prefersReducedMotion()) {
      title.classList.add('is-in');
      return;
    }

    ScrollTrigger.create({
      trigger: title,
      start: 'top 88%',
      once: true,
      onEnter: () => title.classList.add('is-in'),
    });
  });
}

export function drawRules(scope: ParentNode = document): void {
  if (prefersReducedMotion()) return;

  scope.querySelectorAll<HTMLElement>('.service-item, .prose p').forEach((node) => {
    ScrollTrigger.create({
      trigger: node,
      start: 'top 90%',
      once: true,
      onEnter: () => node.classList.add('is-drawn'),
    });
  });
}

export function mediaParallax(): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const ctx = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>('.media-card__thumb').forEach((thumb) => {
      const img = thumb.querySelector('.media-card__img');
      if (!img) return;
      gsap.fromTo(
        img,
        { yPercent: -6 },
        {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: thumb, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    });
  }, document.body);

  return () => ctx.revert();
}

export function tiltCards(scope: ParentNode = document): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const cleanups: Teardown[] = [];

  scope.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const onMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--tilt-x', `${((0.5 - py) * 5).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${((px - 0.5) * 5).toFixed(2)}deg`);
      card.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
    };
    const onLeave = () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

export function magneticButtons(scope: ParentNode = document): Teardown {
  if (prefersReducedMotion() || isLowPower()) return () => {};

  const buttons = Array.from(scope.querySelectorAll<HTMLElement>('[data-magnetic]'));
  if (!buttons.length) return () => {};

  const radius = 90;

  const onMove = (e: PointerEvent) => {
    buttons.forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > radius + Math.max(rect.width, rect.height) / 2) {
        btn.style.setProperty('--pull-x', '0px');
        btn.style.setProperty('--pull-y', '0px');
        return;
      }

      const pull = Math.min(1, radius / Math.max(dist, 1)) * 0.22;
      btn.style.setProperty('--pull-x', `${(dx * pull).toFixed(1)}px`);
      btn.style.setProperty('--pull-y', `${(dy * pull).toFixed(1)}px`);
    });
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  return () => window.removeEventListener('pointermove', onMove);
}

export function scrollProgress(): Teardown {
  const bar = document.createElement('div');
  bar.className = 'pf-progress';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  bar.appendChild(fill);
  document.body.appendChild(bar);

  const apply = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    fill.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };

  window.addEventListener('scroll', apply, { passive: true });
  window.addEventListener('resize', apply);
  apply();

  return () => {
    window.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
    bar.remove();
  };
}

export function openingCurtain(): void {
  if (prefersReducedMotion()) return;

  const curtain = document.createElement('div');
  curtain.className = 'pf-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<span class="pf-curtain__mark">Baton</span>';
  document.body.appendChild(curtain);

  window.requestAnimationFrame(() => curtain.classList.add('is-open'));
  window.setTimeout(() => curtain.remove(), 1600);
}
