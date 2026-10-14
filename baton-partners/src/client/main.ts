import '../styles/base.css';
import '../styles/pages.css';
import '../styles/fx.css';
import '../styles/operator.css';
import '../styles/sections.css';
import '../styles/theme-mono.css';
import '../styles/theme-console.css';
import '../styles/theme-minka.css';
import '../styles/theme-needle.css';
import '../styles/theme-studio.css';
import '../styles/theme-match.css';
import '../styles/theme-cheer.css';
import '../styles/theme-orbit.css';
import { setupContact } from './contact';
import { prefersReducedMotion } from './env';
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
  if (document.body.dataset.theme === 'match') void import('../styles/fonts-match.css');
  if (document.body.dataset.theme === 'cheer') void import('../styles/fonts-cheer.css');
  if (document.body.dataset.theme === 'orbit') void import('../styles/fonts-orbit.css');
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
// cheer の世界観だけの演出（招待状とカードを裏返す・応援ボタン）
if (document.body.dataset.theme === 'cheer') void import('./cheer').then((m) => m.setupCheer());
// orbit の世界観だけの演出（最初の絶対値のカウンター・人柄の五角形を重ねる図）
// カウンターの幕は、読み込みを待たずにここで出す（2回目からとページ移動の幕のあとは出さない）
if (document.body.dataset.theme === 'orbit') {
  if (document.querySelector('[data-orb-intro]') && !document.documentElement.classList.contains('is-entering') && !prefersReducedMotion()) {
    try {
      if (sessionStorage.getItem('bp-orb-intro') !== '1') document.documentElement.classList.add('is-orb-intro');
      sessionStorage.setItem('bp-orb-intro', '1');
    } catch {
      document.documentElement.classList.add('is-orb-intro');
    }
  }
  void import('./orbit').then((m) => m.setupOrbit());
}
// console の世界観だけの演出（切り替えの日の図・控えの置き場所の「乗っ取られたら？」）
// 最初の一度だけ、トラックが走ってきて見出しの荷物を降ろす（2回目からとページ移動の幕のあとは出さない）
if (document.body.dataset.theme === 'console') {
  if (document.querySelector('.wb-intro') && !document.documentElement.classList.contains('is-entering') && !prefersReducedMotion()) {
    try {
      if (sessionStorage.getItem('bp-dp-intro') !== '1') document.documentElement.classList.add('is-dp-intro');
      sessionStorage.setItem('bp-dp-intro', '1');
    } catch {
      document.documentElement.classList.add('is-dp-intro');
    }
  }
  void import('./console').then((m) => m.setupConsole());
}

const stage = setupStage();
mountScenes((scene) => stage?.attach(scene));
