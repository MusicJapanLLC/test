import '../styles/base.css';
import '../styles/hub.css';
import '../styles/profile.css';

import { profileHubHeroHtml } from '../lib/hero';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from '../profile/footer';
import { renderProfileHub } from '../profile/hub-render';

/**
 * Baton トップページ（/profile/）専用の単一ファイルプレビュー。
 * 共有リンクでの確認用。本番ビルドとは別物。
 */

document.body.className = 'talk-hub';

const hero = document.getElementById('hero')!;
const app = document.getElementById('app')!;
const footer = document.getElementById('footer')!;

hero.innerHTML = profileHubHeroHtml();
renderProfileHub(app);
renderProfileFooter(footer);

initSmoothScroll();
revealOnScroll(document);

const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
if (canvas && shouldRender3D()) {
  whenIdle(() => {
    void import('../hub/scene').then(({ mountHubScene }) => mountHubScene(canvas)).catch(() => {});
  }, 500);
}
