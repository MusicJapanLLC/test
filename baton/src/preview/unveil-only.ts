import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { profileHeroHtml } from '../lib/hero';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initEditorialMotion, mountEditorialWebGL } from '../lib/editorial';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileFooter } from '../profile/footer';
import { renderProfileSections } from '../profile/render';

/**
 * unveilプロフィール専用の単一ファイルプレビュー。
 * kabeya-only.ts と同じ仕組み。共有リンクでの確認用。
 */

const profile = getProfile('unveil');
document.body.className = profile.heroVariant === 'editorial' ? 'profile profile--editorial' : 'profile';

const hero = document.getElementById('hero')!;
const app = document.getElementById('app')!;
const footer = document.getElementById('footer')!;

hero.innerHTML = profileHeroHtml(profile, '#');
renderProfileSections(app, profile);
renderProfileFooter(footer);

initSmoothScroll();
revealOnScroll(document);
initEditorialMotion();

const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
if (canvas && shouldRender3D()) {
  whenIdle(() => {
    if (profile.heavyWebGL) {
      void import('../service/scene-standment').then(({ mountStandmentScene }) =>
        mountStandmentScene(canvas, profile.theme),
      );
    } else if (profile.monument) {
      void import('../service/scene-light').then(({ mountLightScene }) =>
        mountLightScene(canvas, profile.theme, profile.monument),
      );
    }
  }, 1000);
}
mountEditorialWebGL(profile);
