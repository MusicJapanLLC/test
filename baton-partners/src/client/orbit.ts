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
  setupIntro();
  document.querySelectorAll<HTMLElement>('[data-tune]').forEach(setupTune);
}

/**
 * 最初の一度だけの、絶対値のカウンター。−100 から 0 を通って +100 へ数え、光って上へ抜ける。
 * 出すかどうかは main.ts が先に決めて html.is-orb-intro を付ける（2回目・ページ移動の幕のあと・動きを減らす設定では出さない）。
 * 画面に触れる・キーを押す・スクロールすると、すぐに抜ける
 */
function setupIntro() {
  const html = document.documentElement;
  const el = document.querySelector<HTMLElement>('[data-orb-intro]');
  const num = el?.querySelector<HTMLElement>('[data-orb-count]');
  if (!el || !num) return;
  if (!html.classList.contains('is-orb-intro')) {
    el.remove();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.classList.add('is-out');
    // html.is-orb-intro は外さない（見出しの登場の遅れが途中で変わって、文字が跳ねないように）
    window.setTimeout(() => el.remove(), 1000);
  };
  const skip = () => finish();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => window.addEventListener(t, skip, { once: true, passive: true }));
  const start = performance.now();
  const dur = 1300;
  const tick = (now: number) => {
    if (done) return;
    const t = Math.min(1, (now - start) / dur);
    // 0 の手前で少しゆっくり（符号が消える瞬間を見せる）
    const e = t < 0.5 ? 0.5 * Math.pow(t * 2, 1.6) : 1 - 0.5 * Math.pow((1 - t) * 2, 1.6);
    const v = Math.round(-100 + e * 200);
    num.textContent = v < 0 ? `−${-v}` : String(v);
    el.classList.toggle('is-plus', v >= 0);
    if (t < 1) requestAnimationFrame(tick);
    else {
      el.classList.add('is-done');
      window.setTimeout(finish, 420);
    }
  };
  requestAnimationFrame(tick);
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
  // a は水色の五角形と「重なり」、b はピンクの五角形と重なりの切り抜き。同じ形を持つものをまとめて動かす
  const polysA = [...fig.querySelectorAll<SVGPolygonElement>('[data-tune-poly="a"]')];
  const polysB = [...fig.querySelectorAll<SVGPolygonElement>('[data-tune-poly="b"]')];
  const setA = (v: string) => polysA.forEach((el) => el.setAttribute('points', v));
  const setB = (v: string) => polysB.forEach((el) => el.setAttribute('points', v));
  const roleA = fig.querySelector<HTMLElement>('[data-tune-role="a"]');
  const roleB = fig.querySelector<HTMLElement>('[data-tune-role="b"]');
  const topic = fig.querySelector<HTMLElement>('[data-tune-topic]');
  const bubble = topic?.closest<HTMLElement>('.tq-b');
  if (!polysA.length || !polysB.length) return;

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
      setA(attr(curA));
      setB(attr(curB));
      return;
    }
    const fromA = curA;
    const fromB = curB;
    const start = performance.now();
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - start) / 760));
      curA = fromA.map(([x, y], i) => [x + (toA[i][0] - x) * t, y + (toA[i][1] - y) * t]);
      curB = fromB.map(([x, y], i) => [x + (toB[i][0] - x) * t, y + (toB[i][1] - y) * t]);
      setA(attr(curA));
      setB(attr(curB));
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
