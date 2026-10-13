import { prefersReducedMotion } from './env';

/**
 * orbit の世界観（ZETTAICHI / n1a など）だけの小さな演出。
 *   ・人柄の五角形を重ねる図：組み合わせのボタンで、2人の五角形がなめらかに形を変える。
 *     「話すと盛り上がりそうなテーマ」は、入力中の「…」のあとに出る。見えている間は、触られるまで順に切り替わる
 * 「動きを減らす」設定では、形はすぐに切り替え、自動では回さない。
 */
type Person = { role: string; v: number[] };
type PairData = { a: Person; b: Person; topic: string };

export function setupOrbit(): void {
  document.querySelectorAll<HTMLElement>('[data-tune]').forEach(setupTune);
}

function points(v: number[]): [number, number][] {
  return v.map((x, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / v.length;
    const k = Math.max(0, Math.min(100, x));
    return [Math.cos(a) * k, Math.sin(a) * k];
  });
}
const attr = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function setupTune(fig: HTMLElement) {
  let pairs: PairData[] = [];
  try {
    pairs = JSON.parse(fig.dataset.pairs ?? '[]') as PairData[];
  } catch {
    return;
  }
  if (pairs.length < 2) return;
  const still = prefersReducedMotion();
  const section = fig.closest('section');
  const tabs = [...(section?.querySelectorAll<HTMLButtonElement>('[data-tune-pick]') ?? [])];
  const polyA = fig.querySelector<SVGPolygonElement>('[data-tune-poly="a"]');
  const polyB = fig.querySelector<SVGPolygonElement>('[data-tune-poly="b"]');
  const roleA = fig.querySelector<HTMLElement>('[data-tune-role="a"]');
  const roleB = fig.querySelector<HTMLElement>('[data-tune-role="b"]');
  const topic = fig.querySelector<HTMLElement>('[data-tune-topic]');
  const bubble = topic?.closest<HTMLElement>('.tq-b');
  if (!polyA || !polyB) return;

  let current = 0;
  let curA = points(pairs[0].a.v);
  let curB = points(pairs[0].b.v);
  let raf = 0;
  let typing = 0;
  let auto = 0;
  let touched = false;
  let visible = false;

  const morph = (toA: [number, number][], toB: [number, number][]) => {
    cancelAnimationFrame(raf);
    if (still) {
      curA = toA;
      curB = toB;
      polyA.setAttribute('points', attr(curA));
      polyB.setAttribute('points', attr(curB));
      return;
    }
    const fromA = curA;
    const fromB = curB;
    const start = performance.now();
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - start) / 760));
      curA = fromA.map(([x, y], i) => [x + (toA[i][0] - x) * t, y + (toA[i][1] - y) * t]);
      curB = fromB.map(([x, y], i) => [x + (toB[i][0] - x) * t, y + (toB[i][1] - y) * t]);
      polyA.setAttribute('points', attr(curA));
      polyB.setAttribute('points', attr(curB));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const pick = (i: number) => {
    if (i === current) return;
    current = i;
    const pr = pairs[i];
    tabs.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    morph(points(pr.a.v), points(pr.b.v));
    if (roleA) roleA.textContent = pr.a.role;
    if (roleB) roleB.textContent = pr.b.role;
    if (!topic) return;
    window.clearTimeout(typing);
    if (still) {
      topic.textContent = pr.topic;
      return;
    }
    // 入力中の「…」を少し見せてから、テーマを出す
    bubble?.classList.add('is-typing');
    typing = window.setTimeout(() => {
      topic.textContent = pr.topic;
      bubble?.classList.remove('is-typing');
    }, 900);
  };

  tabs.forEach((b) =>
    b.addEventListener('click', () => {
      touched = true;
      window.clearInterval(auto);
      pick(Number(b.dataset.tunePick ?? 0));
    }),
  );

  if (still) return;
  const run = () => {
    window.clearInterval(auto);
    if (touched || !visible || document.hidden) return;
    auto = window.setInterval(() => pick((current + 1) % pairs.length), 5200);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) run();
    else window.clearInterval(auto);
  }).observe(fig);
  document.addEventListener('visibilitychange', run);
}
