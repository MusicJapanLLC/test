import '../styles/base.css';
import '../styles/pages.css';
import '../styles/fx.css';
import '../styles/theme-mono.css';
import '../styles/theme-console.css';
import { setupContact } from './contact';
import { setupFx } from './fx';
import { mountScenes } from './scenes';
import { setupStage } from './stage';
import { setupHeader, setupMenu, setupReveal, setupSmoothScroll, setupToc } from './ui';

document.documentElement.classList.add('js');
// Google Fonts で配信するビルドでは、自前のフォントを読み込まない（チャンクごと出力されない）
if (!__GOOGLE_FONTS__) {
  void import('../styles/fonts.css');
  if (document.body.dataset.theme === 'mono' || document.body.dataset.page === 'index')
    void import('../styles/fonts-mono.css');
  if (document.body.dataset.theme === 'console') void import('../styles/fonts-console.css');
}

setupHeader();
setupMenu();
setupReveal();
setupSmoothScroll();
setupToc();
setupContact();
setupFx();

const stage = setupStage();
mountScenes((scene) => stage?.attach(scene));
