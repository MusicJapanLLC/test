(() => {
  'use strict';

  // Header background swap on scroll
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile nav
  const mobileNav = document.querySelector('[data-mobile-nav]');
  const openBtn = document.querySelector('[data-mobile-nav-open]');
  const closeBtn = document.querySelector('[data-mobile-nav-close]');
  const navLinks = document.querySelectorAll('[data-mobile-nav-link]');
  const setMobileNav = (open) => {
    if (!mobileNav) return;
    mobileNav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
  };
  if (openBtn) openBtn.addEventListener('click', () => setMobileNav(true));
  if (closeBtn) closeBtn.addEventListener('click', () => setMobileNav(false));
  navLinks.forEach((a) => a.addEventListener('click', () => setMobileNav(false)));

  // Language switcher dropdown
  document.querySelectorAll('[data-lang-switch]').forEach((wrapper) => {
    const toggle = wrapper.querySelector('[data-lang-toggle]');
    const close = () => {
      wrapper.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    };
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrapper.classList.contains('is-open');
      wrapper.classList.toggle('is-open', willOpen);
      toggle.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });

  // Reveal on scroll. Content is visible by default in CSS; only arm the
  // fade-in effect once we're sure it will actually resolve, and always
  // carry a fallback timer so nothing can stay hidden.
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    document.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
    // Safety net: guarantee visibility even if an element never intersects
    // (e.g. it starts off-DOM-flow, or a full-page capture tool skips scroll events).
    window.setTimeout(() => {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    }, 4000);
  }

  // Lightbox for gallery placeholders
  const lightbox = document.querySelector('[data-lightbox]');
  const triggers = Array.from(document.querySelectorAll('[data-lightbox-trigger]'));
  if (lightbox && triggers.length) {
    const photoEl = lightbox.querySelector('[data-lightbox-photo]');
    const captionEl = lightbox.querySelector('[data-lightbox-caption]');
    let currentIndex = 0;

    const show = (index) => {
      currentIndex = (index + triggers.length) % triggers.length;
      const trigger = triggers[currentIndex];
      photoEl.className = '';
      photoEl.classList.add('lightbox-photo', `photo-tone-${(currentIndex % 6) + 1}`);
      captionEl.textContent = trigger.dataset.caption || '';
    };
    const open = (index) => {
      show(index);
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      lightbox.hidden = true;
      document.body.style.overflow = '';
    };

    triggers.forEach((trigger, i) => {
      trigger.addEventListener('click', () => open(i));
    });
    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', close);
    lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(currentIndex - 1));
    lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => show(currentIndex + 1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', (e) => {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(currentIndex - 1);
      if (e.key === 'ArrowRight') show(currentIndex + 1);
    });
  }
})();
