import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import { loadData } from './feed';
import { applySheet, applyTheme, refreshHud, render, shuffleView } from './views';
import { endSession, sessionOpen } from './session';
import { closeDrill, drillOpen } from './drill';
import { unlock, stop } from './audio';
import { sfx } from './sfx';
import { logo } from './brand';
import { I } from './icons';
import { $, $$ } from './ui';

applyTheme();
applySheet();
// the crawlable landing inside #view is Japanese; once the app takes over, the UI is English (Japanese parts carry lang="ja")
$('#view').removeAttribute('lang');

/* shell: logo + HUD on top, four tabs at the bottom (a side rail on wide screens) */
$('[data-logo]').innerHTML = logo();
$('[data-tabs]').innerHTML = ([
  ['today', '#/', 'Today', I.today],
  ['records', '#/records', 'Records', I.records],
  ['shuffle', '#/shuffle', 'Shuffle', I.shuffle],
  ['me', '#/me', 'You', I.me],
] as const).map(([id, href, label, icon]) => `<a href="${href}" data-tab="${id}">${icon}<span>${label}</span>${id === 'today' ? '<i class="badge" data-hud="due" hidden></i>' : ''}</a>`).join('');
$('[data-flame]').innerHTML = I.flame;

const sheet = $<HTMLDialogElement>('#sheet');

/* keyboard for the reel feed (sessions and the drill handle their own keys) */
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || sheet.open || sessionOpen() || document.body.classList.contains('in-session')) return;
  if (e.metaKey || e.ctrlKey || e.altKey || document.body.dataset.tab !== 'shuffle') return;
  const cur = shuffleView.current() as (HTMLElement & { reveal?: () => void; toggleSave?: () => void; pick?: (i: number) => void }) | undefined;
  const k = e.key;
  if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); shuffleView.step(1); }
  else if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); shuffleView.step(-1); }
  else if (k === ' ') { e.preventDefault(); cur?.reveal?.(); }
  else if (k === 's') cur?.toggleSave?.();
  else if (k === 'p') cur?.querySelector<HTMLButtonElement>('.rbtn--play, .listen-btn')?.click();
  else if (/^[1-4]$/.test(k)) cur?.pick?.(Number(k) - 1);
});

/* phones only allow sound after a touch */
const firstTouch = () => { unlock(); sfx.unlock(); };
document.addEventListener('pointerdown', firstTouch, { once: true });
document.addEventListener('keydown', firstTouch, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

async function boot() {
  try {
    await loadData();
  } catch (err) {
    $('#view').innerHTML = `<p class="empty">Couldn’t load the cards. Check your connection and reload.</p>`;
    console.error(err);
    return;
  }
  $$('[data-tab]').forEach((a) => a.addEventListener('click', () => sfx.tap()));
  // Back (or a link) while a session or the drill is open closes it first
  const closeOverlay = () => { if (sessionOpen() && !drillOpen()) endSession(); else if (drillOpen()) closeDrill(); };
  window.addEventListener('popstate', () => { if (document.body.classList.contains('in-session')) closeOverlay(); });
  window.addEventListener('hashchange', () => { if (document.body.classList.contains('in-session')) closeOverlay(); else render(); });
  render();
  refreshHud();
  document.body.classList.add('is-ready');
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
}
void boot();
