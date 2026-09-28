import '../styles/base.css';
import '../styles/pages.css';
import { setupContact } from './contact';
import { mountScenes } from './scenes';
import { setupStage } from './stage';
import { setupHeader, setupMenu, setupReveal, setupSmoothScroll, setupToc } from './ui';

document.documentElement.classList.add('js');
void import('../styles/fonts.css');

setupHeader();
setupMenu();
setupReveal();
setupSmoothScroll();
setupToc();
setupContact();

const stage = setupStage();
mountScenes((scene) => stage?.attach(scene));
