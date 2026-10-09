import '../styles/base.css';
import { initAmbient } from '../lib/ambient';
import { initDevices, initLightbox } from '../lib/device';
import { initChrome } from '../lib/chrome';
import { initCountUp, initReveal, initTilt } from '../lib/motion';

/** 全ページ共通の起動処理 */
export function startPage(): void {
  document.documentElement.classList.add('js');
  initChrome();
  initAmbient();
  initDevices();
  initLightbox();
  initReveal();
  initTilt();
  initCountUp();
}
