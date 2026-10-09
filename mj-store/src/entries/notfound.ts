import '../styles/town-page.css';
import { openTown } from '../lib/town';
import { startPage } from './common';

startPage();
const host = document.querySelector<HTMLElement>('[data-town-embed]');
if (host) openTown({ embed: host });
