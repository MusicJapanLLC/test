import '../styles/base.css';
import '../styles/hub.css';
import '../styles/profile.css';

import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileHub } from './hub-render';

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderProfileHub(app);
  renderFooter(footer, { backToHub: true });

  initSmoothScroll();
  revealOnScroll(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
