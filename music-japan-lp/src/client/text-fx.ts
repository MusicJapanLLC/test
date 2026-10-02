/**
 * 文字の演出。
 * - 見出しの文節（.ph）を1文字ずつ <span class="c"> に分ける（文節の途中では改行しないまま）
 * - 英字の小見出しは、ランダムな文字から正しい綴りに落ち着く（スクランブル）
 * - 最初の画面の「THIS PAGE IS ABOUT ___」は、言葉を順に入れ替える
 */
export function splitChars(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-split] .ph').forEach((ph) => {
    if (ph.dataset.done) return;
    ph.dataset.done = '1';
    const text = ph.textContent ?? '';
    ph.textContent = '';
    ph.setAttribute('aria-hidden', 'false');
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'c';
      s.textContent = ch;
      ph.append(s);
    }
  });
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/—_';

export function scramble(el: HTMLElement, to?: string, duration = 900) {
  const final = to ?? el.dataset.final ?? el.textContent ?? '';
  el.dataset.final = final;
  if (!/[A-Za-z0-9]/.test(final)) {
    el.textContent = final;
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    let out = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      const reveal = i / final.length < t * 1.15 - 0.12;
      out += reveal || ch === ' ' || !/[A-Za-z0-9]/.test(ch) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = final;
  };
  requestAnimationFrame(step);
}

export function rotateWords(el: HTMLElement, reduced: boolean) {
  const words = (el.dataset.rotate ?? '').split('|').filter(Boolean);
  if (words.length < 2 || reduced) return;
  let i = 0;
  window.setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % words.length;
    scramble(el, words[i], 700);
  }, 2600);
}
