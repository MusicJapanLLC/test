import '../styles/base.css';
import '../styles/hub.css';
import '../styles/profile.css';

import { initAnalytics } from '../lib/analytics';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from './footer';
import { renderProfileHub } from './hub-render';

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderProfileHub(app);
  renderProfileFooter(footer);

  initSmoothScroll();
  revealOnScroll(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
