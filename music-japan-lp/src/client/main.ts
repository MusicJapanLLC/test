import '../styles/fonts.css';
import '../styles/base.css';
import '../styles/site.css';
import { reducedMotion } from './env';
import { headerState, reveals } from './common';

/**
 * どのページでも動くもの（ヘッダー、表示されたら描く線や文字）と、
 * ページごとに必要なものだけを後から読み込む（トップのレコード、横に流れる工程、絞り込みなど）。
 */
const reduced = reducedMotion();
const key = document.documentElement.dataset.page;

headerState();
reveals(reduced);

if (key === 'top') void import('./record').then((m) => m.record(reduced));
if (document.querySelector('[data-build-track]')) void import('./build').then((m) => m.buildTrack(reduced));
if (document.querySelector('[data-proj]')) void import('./projects').then((m) => m.projects(reduced));
if (document.querySelector('[data-filter]')) void import('./feed').then((m) => m.feed(reduced));
if (document.querySelector('[data-wave]')) void import('./wave').then((m) => m.wave(reduced));
