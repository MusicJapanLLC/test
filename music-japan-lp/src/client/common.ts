/** 全ページ共通：ヘッダーの状態と、画面に入ったときの表示 */

export function headerState() {
  const root = document.documentElement;
  let last = -1;
  const paint = () => {
    const scrolled = window.scrollY > 8;
    if (scrolled !== (last === 1)) {
      root.classList.toggle('is-scrolled', scrolled);
      last = scrolled ? 1 : 0;
    }
  };
  paint();
  window.addEventListener('scroll', paint, { passive: true });

  // メニュー（Popover API）：リンクを押したら閉じる
  const menu = document.getElementById('menu') as (HTMLElement & { hidePopover?: () => void }) | null;
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.hidePopover?.()));

  // ページの先頭へ
  document.querySelectorAll<HTMLAnchorElement>('[data-to-top]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: root.classList.contains('rm') ? 'auto' : 'smooth' });
    }),
  );
}

/**
 * 画面に入ったら .is-in を付ける。見出しの文字、線画（.ill）、カードの順番の出方は CSS 側で決める。
 * 動きを減らす設定では、最初からすべて表示する。
 */
export function reveals(reduced: boolean) {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal], .ill, .sh, .phero, .hero'));
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
}
