import '../styles/fonts.css';
import '../styles/base.css';
import '../styles/sections.css';
import { cursor } from './cursor';
import { finePointer, isMobile, reducedMotion, tier, webglOk } from './env';
import { chrome, gsap, heroIn, reveals, ScrollTrigger, scrollState, setupSmooth } from './motion';
import { rotateWords } from './text-fx';
import { anatomy, buildSteps, ecosystem, feed, labelsFollow, projects, serpTyping, waveFallback } from './ui';
import type { Anchor, World } from './world/world';

const html = document.documentElement;
const reduced = reducedMotion();
const mobile = isMobile();
const desktop = window.innerWidth >= 1080;
const gl = webglOk();
let world: World | null = null;

/* ── 文字と、スクロールの演出 ── */
const rot = document.querySelector<HTMLElement>('[data-rotate]');
if (rot) rotateWords(rot, reduced);
setupSmooth(reduced);
reveals(reduced);

const onBuild = buildSteps();
const { st, update } = scrollState({ reduced, desktop, onBuild });
const paintChrome = chrome();

ecosystem(() => world);
anatomy((page) => world?.setHighlight(2, page));
feed();
projects(reduced);
serpTyping(reduced);
if (finePointer() && !reduced) cursor();

/* ── 導入 ── */
function intro() {
  const el = document.querySelector<HTMLElement>('.intro');
  const mode = html.dataset.intro;
  if (!el || !mode) {
    heroIn(reduced);
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.classList.add('is-out');
    heroIn(reduced);
    try {
      sessionStorage.setItem('mjlp-intro', '1');
    } catch {
      /* 保存できなくても続ける */
    }
    window.setTimeout(() => delete html.dataset.intro, 950);
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(ev, finish);
  };
  window.setTimeout(finish, mode === 'full' ? 1550 : 650);
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(ev, finish, { passive: true, once: true });
}
intro();

/* ── WebGL ── */
async function startWorld() {
  if (!gl) {
    waveFallback();
    return;
  }
  const canvas = document.querySelector<HTMLCanvasElement>('[data-world]');
  if (!canvas) return;
  try {
    const { World } = await import('./world/world');
    world = new World(canvas, { tier: tier(), mobile, reduced });
  } catch {
    waveFallback();
    return;
  }
  html.classList.add('webgl');
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  const anchors: Anchor[] = [
    { el: null, fit: 'none' }, // DUST
    { el: q('[data-eco-map]'), fit: 'contain', scale: desktop ? 0.92 : 0.86 }, // NETWORK
    { el: q('[data-ana-visual]'), fit: 'contain', scale: desktop ? 1.04 : 1.1 }, // PAGES
    { el: null, fit: 'none', ox: desktop ? 3.2 : 0, oy: desktop ? -0.2 : 1.4, scale: desktop ? 0.95 : 0.6 }, // SEARCH
    { el: null, fit: 'none', oy: desktop ? -0.6 : -1.6, scale: desktop ? 1 : 0.7 }, // BUILDLINE
    { el: null, fit: 'none', scale: 1 }, // PROJECTS
    { el: q('.st-visual'), fit: 'contain', scale: 1 }, // WAVE
    { el: null, fit: 'none', oy: -0.4, scale: desktop ? 1 : 0.9 }, // LOG
    { el: null, fit: 'none', ox: desktop ? -3.6 : 0, oy: desktop ? -0.4 : 1.6, scale: desktop ? 0.82 : 0.5 }, // MARK
    { el: q('[data-talk-link]'), fit: 'width', scale: 1 }, // CONNECT
  ];
  world.setAnchors(anchors);
  labelsFollow(world);
  window.addEventListener('resize', () => world?.resize());

  // カーソル（タッチの端末では、最初の画面だけ見えない指先がゆっくり動く）
  if (!reduced) {
    if (finePointer()) {
      window.addEventListener('pointermove', (e) => world?.pointer((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), { passive: true });
      document.addEventListener('pointerleave', () => world?.pointer(0, 0, false));
    } else {
      let t = 0;
      gsap.ticker.add(() => {
        t += 0.006;
        const inHero = window.scrollY < window.innerHeight;
        world?.pointer(Math.sin(t * 1.3) * 0.6, Math.cos(t * 0.9) * 0.4, inHero);
      });
    }
  }
  canvas.classList.add('is-ready');
  if (reduced) {
    const paint = () => {
      update();
      world?.setChapter(Math.round(st.chapter));
      world?.setGrow(1);
      world?.setBeam(1);
      world?.still();
    };
    paint();
    let to = 0;
    window.addEventListener('scroll', () => {
      window.clearTimeout(to);
      to = window.setTimeout(paint, 120);
    });
  } else {
    world.start();
  }
}

/* ── 毎フレーム：スクロールの状態を、WebGLと画面の飾りへ ── */
const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section[data-air="paper"], main > section[data-air="red"]'));
function covered(): boolean {
  const vh = window.innerHeight;
  return sections.some((s) => {
    const r = s.getBoundingClientRect();
    return r.top <= 0 && r.bottom >= vh;
  });
}
const talkSec = document.getElementById('talk');
gsap.ticker.add(() => {
  update();
  paintChrome();
  talkSec?.classList.toggle('is-linked', reduced || st.beam > 0.97);
  if (world && !reduced) {
    world.setChapter(st.chapter);
    world.setGrow(st.grow);
    world.setBuild(st.build);
    world.setBeam(st.beam);
    world.setWave(st.wave);
    world.setVisible(!covered());
  }
});

startWorld();

/* 文字や画像が読み込まれてページの高さが変わったら、固定・横スクロールの位置を測り直す */
let lastH = 0;
let refreshTimer = 0;
new ResizeObserver(() => {
  const h = document.body.scrollHeight;
  if (Math.abs(h - lastH) < 2) return;
  lastH = h;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 180);
}).observe(document.body);
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
