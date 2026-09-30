import '../styles/base.css';
import '../styles/profile.css';
import '../styles/profile-hub-hero.css';

import { initAnalytics } from '../lib/analytics';
import { revealOnScroll } from '../lib/motion';
import { renderFaqPage } from './faq-page';
import { renderProfileFooter } from './footer';

function boot(): void {
  initAnalytics();
  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  // ビルド時に焼き込んだ静的HTMLを、同じ内容の動く版に置き換える
  app.replaceChildren();
  footer.replaceChildren();
  renderFaqPage(app);
  renderProfileFooter(footer);
  revealOnScroll(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
