import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { getProfile } from '../data/profiles';
import { profileHeroHtml } from '../lib/hero';
import { renderFooter } from '../lib/footer';
import { shouldRender3D, whenIdle } from '../lib/capabilities';
import { initSmoothScroll, revealOnScroll } from '../lib/motion';
import { renderProfileSections } from '../profile/render';

/**
 * 壁谷プロフィール専用の単一ファイルプレビュー。
 * ハッシュ切り替え（#/...）に依存せず、開いたら必ずこの1ページだけが出る。
 * 共有リンクでの確認用。ハブや他ページへの導線は持たない。
 */

const profile = getProfile('kabeya');
document.body.className = 'profile';

const hero = document.getElementById('hero')!;
const app = document.getElementById('app')!;
const footer = document.getElementById('footer')!;

hero.innerHTML = profileHeroHtml(profile, '#');
renderProfileSections(app, profile);
renderFooter(footer);

initSmoothScroll();
revealOnScroll(document);

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
