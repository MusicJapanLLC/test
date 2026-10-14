import { prefersReducedMotion } from './env';

/**
 * mono の世界観（Central AX）だけの演出。拠点の名駅にちなんで、見出しを駅の発車標にする。
 *   ・見出しの1文字ずつが、パタパタと何度か入れ替わってから止まる（フラップ式の発車標）
 *   ・右上の駅名の横に、いまの時刻（日本時間）
 * 入れ替わっているあいだも、見出しの文は aria-label で読める。「動きを減らす」設定では入れ替えない（時刻は出す）。
 */
const POOL = 'アイウエオカキクケコサシスセソタチツテトナニハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEFGHJKLMNPRSTUVWXYZ';

export function setupMono(): void {
  setupClock();
  if (prefersReducedMotion()) return;
  document.querySelectorAll<HTMLElement>('.hero-h.split, .phero-h.split').forEach((h, k) => flap(h, k === 0 ? 260 : 120));
}

function flap(h: HTMLElement, startAt: number) {
  const chars = [...h.querySelectorAll<HTMLElement>('.ch')];
  if (!chars.length) return;
  h.setAttribute('aria-label', h.textContent ?? '');
  let left = chars.length;
  const done = () => {
    left -= 1;
    if (left === 0) h.removeAttribute('aria-label');
  };
  chars.forEach((ch, i) => {
    const final = ch.textContent ?? '';
    if (!final.trim() || final === ' ') return done();
    ch.classList.add('is-wait');
    const flips = 4 + ((i * 7) % 5);
    let n = 0;
    const tick = () => {
      if (n === 0) {
        // 入れ替わっても幅が変わらないように、止まったときの幅で固定する
        ch.style.width = `${ch.getBoundingClientRect().width}px`;
        ch.classList.remove('is-wait');
      }
      ch.classList.remove('is-flip');
      void ch.offsetWidth;
      ch.classList.add('is-flip');
      if (n >= flips) {
        ch.textContent = final;
        ch.classList.add('is-set');
        window.setTimeout(() => (ch.style.width = ''), 200);
        return done();
      }
      ch.textContent = POOL[Math.floor(Math.random() * POOL.length)];
      n += 1;
      window.setTimeout(tick, 64);
    };
    window.setTimeout(tick, startAt + i * 62);
  });
}

/** 駅名の横に、日本時間の時刻（1分ごと） */
function setupClock() {
  const deck = document.querySelector<HTMLElement>('.hero-deck');
  if (!deck) return;
  const el = document.createElement('span');
  el.className = 'deck-clock';
  el.setAttribute('aria-hidden', 'true');
  deck.append(el);
  const fmt = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
  const set = () => (el.textContent = `JST ${fmt.format(new Date())}`);
  set();
  window.setInterval(set, 30000);
}
