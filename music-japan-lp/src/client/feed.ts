/** お知らせ：種類で絞り込む（View Transitions API があれば、並び替わりがなめらかに） */
export function feed(reduced: boolean) {
  const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const items = Array.from(document.querySelectorAll<HTMLElement>('.fc'));
  items.forEach((el, i) => el.style.setProperty('view-transition-name', `fc-${i}`));
  const apply = (f: string) => {
    chips.forEach((c) => {
      const on = c.dataset.filter === f;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    items.forEach((el) => (el.hidden = f !== 'all' && el.dataset.type !== f));
  };
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const f = c.dataset.filter!;
      const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (d.startViewTransition && !reduced) d.startViewTransition(() => apply(f));
      else apply(f);
    }),
  );
}
