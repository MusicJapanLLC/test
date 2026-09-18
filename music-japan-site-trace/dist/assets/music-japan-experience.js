/* Music Japan / RED FREQUENCY — dependency-free, optional visual enhancement. */
(() => {
  'use strict';
  const root = document.documentElement;
  const en = root.lang.startsWith('en');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const dataSaver = Boolean(navigator.connection?.saveData);
  let chosenOff = false;
  try { chosenOff = localStorage.getItem('mj-motion') === 'off'; } catch { /* private mode */ }
  let active = !reduce.matches && !dataSaver && !chosenOff;
  let hero = null;
  let canvas = null;
  let ctx = null;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let width = 0;
  let height = 0;
  let heroVisible = true;
  let pointerX = .68;
  let pointerY = .45;
  let introTimeout = 0;
  let introPlayed = false;
  let scanQueued = false;
  let scrollQueued = false;
  const observed = new WeakSet();
  const tilted = new WeakSet();
  const labels = en
    ? { on: 'Motion ON', off: 'Motion OFF', pause: 'Pause visual effects', resume: 'Enable visual effects', replay: 'Replay intro', system: 'Motion disabled by your device settings' }
    : { on: '演出 ON', off: '演出 OFF', pause: '演出を停止', resume: '演出を再開', replay: '導入を再生', system: '端末の設定により演出を停止しています' };

  const progress = document.createElement('div');
  progress.className = 'mj-progress';
  progress.setAttribute('aria-hidden', 'true');
  const controls = document.createElement('div');
  controls.className = 'mj-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', en ? 'Visual effects' : '演出設定');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  const dot = document.createElement('span');
  dot.className = 'mj-state';
  dot.setAttribute('aria-hidden', 'true');
  const toggleText = document.createTextNode('');
  toggle.append(dot, toggleText);
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'mj-replay';
  replay.textContent = labels.replay;
  replay.hidden = true;
  controls.append(replay, toggle);

  function updateControls() {
    root.dataset.mjMotion = active ? 'on' : 'off';
    toggleText.textContent = active ? labels.on : labels.off;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', active ? labels.pause : labels.resume);
    toggle.disabled = reduce.matches || dataSaver;
    toggle.title = toggle.disabled ? labels.system : '';
    replay.hidden = !hero || !heroVisible || !active;
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }
  function start() {
    if (active && heroVisible && !document.hidden && ctx && !frame) frame = requestAnimationFrame(draw);
  }
  function updateMotion() {
    active = !reduce.matches && !dataSaver && !chosenOff;
    updateControls();
    stop();
    if (!active) root.classList.remove('mj-intro');
    paint(elapsed);
    start();
  }
  toggle.addEventListener('click', () => {
    chosenOff = active;
    try { localStorage.setItem('mj-motion', chosenOff ? 'off' : 'on'); } catch { /* optional preference */ }
    updateMotion();
  });
  window.addEventListener('storage', event => {
    if (event.key === 'mj-motion') { chosenOff = event.newValue === 'off'; updateMotion(); }
  });
  reduce.addEventListener('change', updateMotion);
  function playIntro() {
    if (!active || !hero || !heroVisible) return;
    clearTimeout(introTimeout);
    root.classList.remove('mj-intro');
    void hero.offsetWidth;
    root.classList.add('mj-intro');
    introTimeout = setTimeout(() => root.classList.remove('mj-intro'), 2500);
  }
  replay.addEventListener('click', playIntro);

  function resize() {
    if (!hero || !canvas || !ctx) return;
    width = hero.clientWidth;
    height = hero.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, compact.matches ? 1 : 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint(elapsed);
  }
  function paint(time) {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const mid = height * (compact.matches ? .43 : .5);
    const amplitude = height * (compact.matches ? .085 : .15);
    // A small, bounded signal field; no textures, video, audio or network assets.
    const lines = compact.matches ? 5 : 9;
    const steps = compact.matches ? 60 : 110;
    for (let band = 0; band < lines; band++) {
      const shift = band / lines;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const envelope = Math.sin(u * Math.PI);
        const wave = Math.sin(u * Math.PI * 2.2 - time * .25 + shift * 1.5);
        const harmonic = Math.sin(u * Math.PI * 4.4 + time * .18 + shift) * .28;
        const y = mid + (wave + harmonic) * amplitude * envelope + shift * 25 + (pointerY - .5) * 18;
        if (!i) ctx.moveTo(u * width, y); else ctx.lineTo(u * width, y);
      }
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(237,38,59,0)');
      gradient.addColorStop(.24, `rgba(237,38,59,${band === 3 ? .8 : .12})`);
      gradient.addColorStop(.68, `rgba(255,97,118,${band === 3 ? .95 : .32})`);
      gradient.addColorStop(1, 'rgba(237,38,59,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = band === 3 ? 1.6 : .7;
      ctx.stroke();
    }
    const particles = compact.matches ? 18 : 42;
    for (let i = 0; i < particles; i++) {
      const x = ((i * .6180339 + time * .002) % 1) * width;
      const y = ((i * .381966 + Math.sin(time * .1 + i) * .012) % 1) * height;
      const light = .14 + (Math.sin(time * .7 + i) + 1) * .12;
      ctx.fillStyle = `rgba(238,211,200,${light})`;
      ctx.beginPath();
      ctx.arc(x + (pointerX - .5) * 6, Math.abs(y), i % 5 === 0 ? 1.3 : .65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function draw(now) {
    frame = 0;
    if (!active || !heroVisible || document.hidden) return;
    const interval = compact.matches ? 1000 / 24 : 1000 / 30;
    if (!previous || now - previous >= interval) {
      elapsed += previous ? Math.min((now - previous) / 1000, .1) : 0;
      previous = now;
      paint(elapsed);
    }
    frame = requestAnimationFrame(draw);
  }

  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target;
      element.classList.toggle('mj-in-view', entry.isIntersecting);
      if (element === hero) {
        heroVisible = entry.isIntersecting;
        updateControls();
        heroVisible ? start() : stop();
      } else if (entry.isIntersecting && !element.dataset.mjSeen) {
        element.dataset.mjSeen = 'true';
        if (active && element.getBoundingClientRect().top > 60) element.classList.add('mj-reveal-in');
      }
    }
  }, { threshold: .08 });
  const sizeObserver = new ResizeObserver(resize);

  function scan() {
    scanQueued = false;
    if (!progress.isConnected) document.body.append(progress);
    if (!controls.isConnected) document.body.append(controls);
    const current = document.querySelector('.hero');
    if (current && (current !== hero || !canvas?.isConnected)) {
      if (hero && hero !== current) { visibility.unobserve(hero); sizeObserver.unobserve(hero); }
      hero = current;
      hero.classList.add('mj-ambient');
      canvas = document.createElement('canvas');
      canvas.className = 'mj-signal';
      canvas.setAttribute('aria-hidden', 'true');
      hero.append(canvas);
      ctx = canvas.getContext('2d', { alpha: true });
      if (!hero.querySelector('.mj-needle-trace')) {
        const trace = document.createElement('div');
        trace.className = 'mj-needle-trace';
        trace.setAttribute('aria-hidden', 'true');
        hero.append(trace);
      }
      visibility.observe(hero);
      sizeObserver.observe(hero);
      resize();
      if (!introPlayed && scrollY < 100) { introPlayed = true; playIntro(); }
      start();
    }
    document.querySelectorAll('.related-card:first-child').forEach(card => {
      if (card.querySelector('.mj-voice')) return;
      const voice = document.createElement('div');
      voice.className = 'mj-voice';
      voice.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 28; i++) {
        const bar = document.createElement('i');
        bar.style.setProperty('--bar-height', `${7 + (i * 17 % 29)}px`);
        bar.style.setProperty('--bar-index', String(i));
        voice.append(bar);
      }
      card.classList.add('mj-ambient');
      card.append(voice);
    });
    document.querySelectorAll('.section-heading,.release-card,.about-brand,.related-card,.manifesto > h2,.manifesto__body,.manifesto__wave,.profile-hero,.inner-page__hero').forEach(element => {
      if (observed.has(element)) return;
      observed.add(element);
      if (element.classList.contains('manifesto__wave')) element.classList.add('mj-ambient');
      visibility.observe(element);
    });
    document.querySelectorAll('.release-card').forEach(card => {
      if (tilted.has(card)) return;
      tilted.add(card);
      const visual = card.querySelector('.release-card__visual');
      if (!visual) return;
      card.addEventListener('pointermove', event => {
        if (!active || !fine.matches || compact.matches) return;
        const rect = visual.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        visual.style.setProperty('--tilt-x', `${(x - .5) * 8}deg`);
        visual.style.setProperty('--tilt-y', `${(.5 - y) * 8}deg`);
        visual.style.setProperty('--shine-x', `${x * 100}%`);
        visual.style.setProperty('--shine-y', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        visual.style.setProperty('--tilt-x', '0deg');
        visual.style.setProperty('--tilt-y', '0deg');
      });
    });
    updateControls();
  }
  // The preserved homepage hydrates asynchronously. Enhance its final nodes too.
  const changes = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  });
  function scrollProgress() {
    scrollQueued = false;
    const length = document.documentElement.scrollHeight - innerHeight;
    progress.style.setProperty('--mj-progress', String(length > 0 ? Math.min(1, scrollY / length) : 0));
  }
  addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(scrollProgress); }
  }, { passive: true });
  addEventListener('resize', scrollProgress, { passive: true });
  document.addEventListener('pointermove', event => {
    if (!active || !heroVisible || !fine.matches) return;
    pointerX = event.clientX / Math.max(innerWidth, 1);
    pointerY = event.clientY / Math.max(innerHeight, 1);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    root.dataset.mjVisibility = document.hidden ? 'hidden' : 'visible';
    document.hidden ? stop() : start();
  });
  addEventListener('pagehide', stop);
  addEventListener('pageshow', start);
  compact.addEventListener('change', resize);
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    root.dataset.mjExperience = 'vinyl';
    changes.observe(document.body, { childList: true, subtree: true });
    updateMotion();
    scan();
    scrollProgress();
  }
  // Homepage DOM belongs to React until its effect runs. Never insert decorations
  // into the server-rendered tree before hydration; static internal pages can boot now.
  const isHome = /^\/(?:en\/?)?$/.test(location.pathname) || /^\/(?:en\/)?index\.html$/.test(location.pathname);
  if (!isHome || root.dataset.mjReady === 'true') boot();
  else window.addEventListener('music-japan:ready', boot, { once: true });
})();
