import '../styles/base.css';
import '../styles/service.css';

import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { renderPrivacy } from './privacy-content';

function boot(): void {
  initAnalytics();

  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderPrivacy(app);
  renderFooter(footer, { backToHub: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
