import { prefersReducedMotion } from './env';

/**
 * cheer の世界観（Presence など）だけの小さな演出。
 *   ・招待状とトレーディングカード：押すと裏返る（aria-pressed）。カードは指やマウスの位置で傾き、ホロが光る
 *   ・応援ボタン：押すたびに甲羅の星が一つずつ灯り、紙吹雪（星と六角形）が舞う。全部灯ると甲羅ごと光る
 *     回数はこの端末の localStorage にだけ残す（どこにも送らない）。読めない環境では、その場かぎりで数える
 *   ・ヒーローの「禁止。」の判子：叩きつけられた瞬間に見出しが揺れ、判子のまわりに紙吹雪が舞う（夜のスタジアムの世界観）
 * 「動きを減らす」設定では、紙吹雪と傾きと揺れを出さない（裏返すのと、星が灯るのは同じ）。
 */
export function setupCheer(): void {
  const still = prefersReducedMotion();
  setupFlips(still);
  document.querySelectorAll<HTMLElement>('[data-cheer]').forEach((el) => setupButton(el, still));
  if (!still) setupStamps();
}

/** 夜の紺の上の紙吹雪：紺は沈むので、オレンジ・金・白・空色で */
const NIGHT = ['var(--orange)', 'var(--gold)', '#ffffff', 'var(--orange)', 'var(--sky-deep)'];

/**
 * 判子（.hero-h の各行の最後の句）が押された瞬間（CSS の pr-slam が終わったとき）に、
 * 見出しを揺らし、判子の中心から紙吹雪を出す。紙吹雪は見出しの外（.hero）に置き、見出しの文には混ぜない。
 */
function setupStamps() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;
  const host = document.createElement('span');
  host.className = 'pr-burst';
  host.setAttribute('aria-hidden', 'true');
  hero.append(host);
  hero.querySelectorAll<HTMLElement>('.hero-h .ln .ph:last-child').forEach((stamp) => {
    stamp.addEventListener('animationend', (e) => {
      if (e.target !== stamp || !e.animationName.startsWith('pr-slam')) return;
      hero.classList.remove('is-thud');
      void hero.offsetWidth;
      hero.classList.add('is-thud');
      const h = hero.getBoundingClientRect();
      const r = stamp.getBoundingClientRect();
      host.style.left = `${r.left - h.left + r.width / 2}px`;
      host.style.top = `${r.top - h.top + r.height / 2}px`;
      burst(host, 16, NIGHT);
    });
  });
}

function setupFlips(still: boolean) {
  document.querySelectorAll<HTMLButtonElement>('[data-flip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
    });
    if (still || !btn.hasAttribute('data-tilt') || window.matchMedia('(pointer: coarse)').matches) return;
    // カードの傾きとホロ。ポインターの位置を -1〜1 にして CSS 変数で渡す
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = ((e.clientY - r.top) / r.height) * 2 - 1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.setProperty('--tx', x.toFixed(3));
        btn.style.setProperty('--ty', y.toFixed(3));
        btn.classList.add('is-tilt');
      });
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      btn.classList.remove('is-tilt');
      btn.style.setProperty('--tx', '0');
      btn.style.setProperty('--ty', '0');
    });
  });
}

function read(key: string): number {
  try {
    return Math.max(0, Number(window.localStorage.getItem(key)) || 0);
  } catch {
    return 0;
  }
}
function write(key: string, n: number) {
  try {
    window.localStorage.setItem(key, String(n));
  } catch {
    /* 保存できない環境では、その場かぎり */
  }
}

function setupButton(root: HTMLElement, still: boolean) {
  const btn = root.querySelector<HTMLButtonElement>('[data-cheer-btn]');
  const out = root.querySelector<HTMLElement>('[data-cheer-count]');
  const fx = root.querySelector<HTMLElement>('[data-cheer-fx]');
  const cells = [...root.querySelectorAll<SVGGElement>('[data-cell]')].sort((a, b) => Number(a.dataset.cell) - Number(b.dataset.cell));
  if (!btn || !out || !cells.length) return;
  const key = root.dataset.key ?? 'bp-cheer';
  let count = read(key);

  const paint = (pop: boolean) => {
    out.textContent = count.toLocaleString('ja-JP');
    const lit = Math.min(cells.length, count);
    cells.forEach((c, i) => {
      c.classList.toggle('is-on', i < lit);
      if (pop && i === lit - 1 && count <= cells.length) {
        c.classList.remove('is-pop');
        // 同じ要素のアニメーションをもう一度走らせる
        void c.getBoundingClientRect();
        c.classList.add('is-pop');
      }
    });
    root.classList.toggle('is-full', count >= cells.length);
  };
  paint(false);

  btn.addEventListener('click', () => {
    count += 1;
    write(key, count);
    paint(true);
    root.classList.remove('is-hit');
    void root.offsetWidth;
    root.classList.add('is-hit');
    if (!still && fx) burst(fx, count === cells.length ? 36 : 14);
  });
}

const BITS = ['✦', '✦', '⬢', '★', '✧'];
const COLORS = ['var(--orange)', 'var(--navy)', 'var(--gold)', 'var(--orange)', 'var(--sky-deep)'];

/** 紙吹雪：ボタンの中心から、星と六角形が放射状に飛んで落ちる。終わったら消す */
function burst(host: HTMLElement, n: number, colors: string[] = COLORS) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const d = 90 + Math.random() * 150;
    s.textContent = BITS[i % BITS.length];
    s.style.setProperty('--x', `${Math.cos(a) * d}px`);
    s.style.setProperty('--y', `${Math.sin(a) * d - 40}px`);
    s.style.setProperty('--r', `${Math.round(Math.random() * 540 - 270)}deg`);
    s.style.setProperty('--s', (0.7 + Math.random() * 0.9).toFixed(2));
    s.style.color = colors[i % colors.length];
    host.append(s);
    window.setTimeout(() => s.remove(), 1400);
  }
}
