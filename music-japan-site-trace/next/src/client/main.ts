import '../styles/base.css';
import '../styles/home.css';
import '../styles/pages.css';
import { reducedMotion, saveData, supportsWebGL } from './env';
import { playIntro } from './intro';
import { heroEntrance, innerEntrance, marquees, reveals, setupScroll, splitChars, worldZones } from './motion';
import { setupPlayer } from './player';
import { setupContactForm, setupCrate, setupCursor, setupHeader, setupMagnetic, setupTransitions } from './ui';
import type { World } from './world';

const root = document.documentElement;
const isHome = root.dataset.world === 'home';

async function createWorld(): Promise<World | null> {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-world-canvas]');
  if (!canvas || !supportsWebGL() || saveData()) {
    root.classList.add('no-webgl');
    return null;
  }
  try {
    const { World } = await import('./world');
    const sleeves = [...document.querySelectorAll<HTMLImageElement>('.sleeve-cover img')].map((img) => img.src.replace('-800x800bb', '-480x480bb'));
    const world = new World(canvas, { sleeves });
    root.classList.add('has-webgl');
    return world;
  } catch {
    root.classList.add('no-webgl');
    return null;
  }
}

async function boot() {
  splitChars();
  setupHeader();
  setupTransitions();
  setupCrate();
  setupContactForm();

  // Three.js loads in parallel with the intro; the needle drop waits for nobody.
  let world: World | null = null;
  let dropped = false;
  const proxy = {
    drop: () => { dropped = true; world?.drop(); },
    jump: (n: string) => world?.jump(n),
  } as unknown as World;
  const ready = createWorld().then((w) => {
    world = w;
    if (location.search.includes('mj-debug')) (window as unknown as { __mj: unknown }).__mj = w;
    setupPlayer(w);
    if (!w) return;
    if (reducedMotion()) { w.still(isHome ? 'hero' : 'inner-hero'); return; }
    w.jump(isHome ? (dropped || !root.dataset.intro ? 'hero' : 'intro') : document.querySelector('[data-world-zone]')?.getAttribute('data-world-zone') ?? 'inner-hero');
    if (isHome && dropped) w.drop();
    w.start();
  });

  if (reducedMotion()) {
    root.classList.add('is-static');
    document.querySelector('[data-intro-overlay]')?.remove();
    await ready;
    return;
  }

  setupScroll(() => undefined);
  setupCursor();
  setupMagnetic();
  marquees();

  if (isHome) {
    await playIntro(proxy, () => heroEntrance(0.05));
  } else {
    innerEntrance();
  }
  await ready;
  const updateZones = worldZones(world);
  reveals();
  updateZones();
}

void boot();
