import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { initAnalytics } from '../lib/analytics';
import { renderFooter } from '../lib/footer';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileSections } from './render';

export function mountProfilePage(profileId: string): void {
  const profile = getProfile(profileId);

  const start = () => {
    initAnalytics();

    const app = document.getElementById('app');
    const footer = document.getElementById('footer');
    if (!app || !footer) return;

    renderProfileSections(app, profile);
    renderFooter(footer, { backToHub: true });

    initSmoothScroll();
    revealOnScroll(document);

    if (window.location.hash === '#talk-request') {
      window.requestAnimationFrame(() =>
        document.getElementById('talk-request')?.scrollIntoView({ block: 'start' }),
      );
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
