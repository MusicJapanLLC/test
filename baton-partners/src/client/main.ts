import '../styles/base.css';
import '../styles/pages.css';
import '../styles/fx.css';
import '../styles/operator.css';
import '../styles/theme-mono.css';
import '../styles/theme-console.css';
import '../styles/theme-minka.css';
import '../styles/theme-needle.css';
import '../styles/theme-studio.css';
import { setupContact } from './contact';
import { setupFx } from './fx';
import { mountScenes } from './scenes';
import { setupStage } from './stage';
import { setupTracklist } from './tracklist';
import { setupHeader, setupMenu, setupReveal, setupSmoothScroll, setupToc } from './ui';

document.documentElement.classList.add('js');
// Google Fonts で配信するビルドでは、自前のフォントを読み込まない（チャンクごと出力されない）
if (!__GOOGLE_FONTS__) {
  void import('../styles/fonts.css');
  if (document.body.dataset.theme === 'mono' || document.body.dataset.page === 'index')
    void import('../styles/fonts-mono.css');
  if (document.body.dataset.theme === 'console') void import('../styles/fonts-console.css');
  if (document.body.dataset.theme === 'minka') void import('../styles/fonts-minka.css');
  if (document.body.dataset.theme === 'needle') void import('../styles/fonts-needle.css');
  if (document.body.dataset.theme === 'studio') void import('../styles/fonts-studio.css');
}

setupHeader();
setupMenu();
setupReveal();
setupSmoothScroll();
setupToc();
setupContact();
setupFx();
// ちびロボ（needle の世界観）。いるページでだけ読み込む
if (document.querySelector('[data-bot]')) void import('./robots').then((m) => m.setupRobots());
setupTracklist();

// studio の世界観だけの小さな演出（ファインダーのタイムコードなど）
if (document.body.dataset.theme === 'studio') void import('./studio').then((m) => m.setupStudio());

const stage = setupStage();
mountScenes((scene) => stage?.attach(scene));
