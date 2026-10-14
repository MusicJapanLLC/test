import '../styles/top.css';
import { unlock } from '../lib/achievements';
import { runBoot } from '../lib/boot';
import { initFeature } from '../lib/feature';
import { startPage } from './common';

startPage();
initFeature();
runBoot().then(() => unlock('boot'));
