import { prefersReducedMotion } from './env';

/**
 * presto の世界観（BE.PRESTO など）だけの動き。
 *   ・AI研修の時間割：職務と AI を選ぶと、8回の中身と「受講後にできること」が入れ替わる
 *   ・表紙の題字：スクロールで少しだけ上へ逃げ、柱の見出しが後から追いつく（動きを減らす設定では動かさない）
 * 入れ替わる文は、ビルド時に文節で区切った <template> を写す（ブラウザで文字列を HTML に戻さない）
 */

function flag(el: Element, cls: string, ms: number): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

function setupTimetable(): void {
  const box = document.querySelector<HTMLElement>('[data-tt]');
  const raw = box?.querySelector('[data-tt-data]')?.textContent;
  if (!box || !raw) return;
  const data = JSON.parse(raw) as {
    common: { office: number[]; field: number[] };
    jobs: { name: string; field?: boolean; parts: number[]; outcomes: number[] }[];
    tools: { name: string; parts: number[] }[];
  };
  const frag = (n: number) => box.querySelector<HTMLTemplateElement>(`template[data-sf="${n}"]`)?.content.cloneNode(true) ?? '';
  const cells = [...box.querySelectorAll<HTMLElement>('[data-bar]')];
  const outcomes = box.querySelector<HTMLElement>('[data-outcomes]');
  const jobName = box.querySelector<HTMLElement>('[data-s="job"]');
  const toolName = box.querySelector<HTMLElement>('[data-s="tool"]');
  let job = 0;
  let tool = 0;
  const titles = () => {
    const j = data.jobs[job];
    return [...(j.field ? data.common.field : data.common.office), ...j.parts, ...data.tools[tool].parts];
  };
  let shown = titles();

  const render = () => {
    const j = data.jobs[job];
    const next = titles();
    cells.forEach((c, i) => {
      if (shown[i] === next[i]) return;
      c.replaceChildren(frag(next[i]));
      const li = c.closest('li');
      if (li && !prefersReducedMotion()) flag(li, 'is-swap', 650);
    });
    shown = next;
    outcomes?.replaceChildren(
      ...j.outcomes.map((o) => {
        const li = document.createElement('li');
        li.append(frag(o));
        return li;
      }),
    );
    if (jobName) jobName.textContent = j.name;
    if (toolName) toolName.textContent = data.tools[tool].name;
  };
  const press = (sel: string, on: HTMLElement) =>
    box.querySelectorAll<HTMLElement>(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === on)));
  box.querySelectorAll<HTMLElement>('[data-job]').forEach((b) =>
    b.addEventListener('click', () => {
      job = Number(b.dataset.job);
      press('[data-job]', b);
      render();
    }),
  );
  box.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      tool = Number(b.dataset.tool);
      press('[data-tool]', b);
      render();
    }),
  );
}

/** 表紙：スクロールに合わせて、題字と見出しを少しずつずらす（奥行き） */
function setupCover(): void {
  const cover = document.querySelector<HTMLElement>('[data-mz-cover]');
  if (!cover || prefersReducedMotion()) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const h = cover.offsetHeight || 1;
    const k = Math.min(1, Math.max(0, window.scrollY / h));
    cover.style.setProperty('--mz-scroll', k.toFixed(3));
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!raf) raf = requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

export function setupPresto(): void {
  setupTimetable();
  setupCover();
}
