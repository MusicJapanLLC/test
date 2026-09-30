import { bus } from './bus';
import { reducedMotion } from './env';

/**
 * The Music Japan mini character: a pixel-art figure whose head is the official
 * symbol (a record, light grooves on the left, shaded on the right, red label).
 * It lives in the bottom-left corner: bobs, blinks, strolls, falls asleep when left
 * alone, answers a tap, and dances whenever a preview is playing.
 */

const W = 20; // sprite grid
const H = 26;
const INK = '#0b0b0e';
const PAPER = '#efe9e0';
const SHADE = '#8d867e';
const RED = '#e1222f';
const BODY = '#3a3a46';
const BODY_HI = '#565668';
const VINYL = '#17171c';
const RIM = '#2c2c34';
const LEG = '#4a4a58';

type Mood = 'idle' | 'walk' | 'dance' | 'jump' | 'sleep';

const LINES = {
  ja: ['やあ！', '♪', '1曲どう？', 'Music Japanだよ', 'レコード回してる', 'ジャケットを押してみて', 'また来てね'],
  en: ['Hi!', '♪', 'Play a record?', 'This is Music Japan', 'Spinning records', 'Tap a sleeve', 'Come back soon'],
};

function drawHead(g: CanvasRenderingContext2D, ox: number, oy: number, blink: boolean, sleepy: boolean, happy: boolean, t: number) {
  const cx = ox + 9.5;
  const cy = oy + 7.5;
  const spin = t * 2.4;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 20; x++) {
      const dx = ox + x + 0.5 - cx;
      const dy = oy + y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r > 7.5) continue;
      let c = VINYL;
      if (r > 6.8) c = RIM;
      else if (r < 3.7) c = RED;
      else if (Math.abs(r - 5.3) < 0.5 || Math.abs(r - 6.3) < 0.45) c = dx < 0 ? PAPER : SHADE; // the symbol's grooves
      // a sheen that turns with the record
      const a = Math.atan2(dy, dx);
      if (r > 4.2 && r < 6.8 && c === VINYL && Math.cos(a - spin) > 0.94) c = '#3a3a44';
      g.fillStyle = c;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  const ex = Math.round(cx);
  const ey = Math.round(cy);
  // face printed on the red label
  g.fillStyle = INK;
  if (sleepy || blink) {
    g.fillRect(ex - 3, ey, 2, 1);
    g.fillRect(ex + 1, ey, 2, 1);
  } else if (happy) {
    g.fillRect(ex - 3, ey, 1, 1); g.fillRect(ex - 2, ey - 1, 1, 1); g.fillRect(ex - 1, ey, 1, 1);
    g.fillRect(ex + 1, ey, 1, 1); g.fillRect(ex + 2, ey - 1, 1, 1); g.fillRect(ex + 3, ey, 1, 1);
  } else {
    g.fillRect(ex - 2, ey - 1, 1, 2);
    g.fillRect(ex + 2, ey - 1, 1, 2);
    g.fillStyle = PAPER; // eye highlights
    g.fillRect(ex - 2, ey - 1, 1, 1);
    g.fillRect(ex + 2, ey - 1, 1, 1);
  }
  // blush + mouth
  g.fillStyle = '#ff7a84';
  g.fillRect(ex - 3, ey + 1, 1, 1);
  g.fillRect(ex + 3, ey + 1, 1, 1);
  g.fillStyle = INK;
  if (!sleepy) g.fillRect(ex, ey + 2, 1, 1);
  if (happy && !sleepy) { g.fillRect(ex - 1, ey + 1, 1, 1); g.fillRect(ex + 1, ey + 1, 1, 1); }
  // spindle hole doubles as a tiny hair tuft on top
  g.fillStyle = RED;
  g.fillRect(ex, oy - 1, 1, 1);
  g.fillRect(ex + 1, oy - 2, 1, 1);
}

function drawBody(g: CanvasRenderingContext2D, ox: number, oy: number, mood: Mood, frame: number) {
  const bx = ox + 7;
  const by = oy + 15;
  // scarf
  g.fillStyle = RED;
  g.fillRect(bx, by, 6, 1);
  g.fillRect(bx + 4, by + 1, 2, 2);
  // torso
  g.fillStyle = BODY;
  g.fillRect(bx, by + 1, 6, 5);
  g.fillStyle = BODY_HI;
  g.fillRect(bx + 1, by + 2, 1, 3);
  // arms
  g.fillStyle = BODY;
  const up = mood === 'dance' ? frame % 2 : mood === 'jump' ? 1 : -1;
  if (up === 1) {
    g.fillRect(bx - 2, by - 2, 1, 3); g.fillRect(bx - 1, by + 1, 1, 1);
    g.fillRect(bx + 7, by + 2, 1, 3); g.fillRect(bx + 6, by + 1, 1, 1);
  } else if (up === 0) {
    g.fillRect(bx - 2, by + 2, 1, 3); g.fillRect(bx - 1, by + 1, 1, 1);
    g.fillRect(bx + 7, by - 2, 1, 3); g.fillRect(bx + 6, by + 1, 1, 1);
  } else {
    g.fillRect(bx - 1, by + 1, 1, 4);
    g.fillRect(bx + 6, by + 1, 1, 4);
  }
  // hands
  g.fillStyle = PAPER;
  if (up === 1) { g.fillRect(bx - 2, by - 3, 1, 1); g.fillRect(bx + 7, by + 5, 1, 1); }
  else if (up === 0) { g.fillRect(bx - 2, by + 5, 1, 1); g.fillRect(bx + 7, by - 3, 1, 1); }
  else { g.fillRect(bx - 1, by + 5, 1, 1); g.fillRect(bx + 6, by + 5, 1, 1); }
  // legs + red shoes
  g.fillStyle = LEG;
  const step = mood === 'walk' || mood === 'dance' ? frame % 2 : 0;
  g.fillRect(bx + 1, by + 6, 1, 3 - step);
  g.fillRect(bx + 4, by + 6, 1, 2 + step);
  g.fillStyle = RED;
  g.fillRect(bx, by + 9 - step, 2, 1);
  g.fillRect(bx + 4, by + 8 + step, 2, 1);
}

export function setupBuddy() {
  const host = document.createElement('div');
  host.className = 'buddy';
  const locale = (document.body.dataset.locale as 'ja' | 'en') || 'ja';
  const lines = LINES[locale];
  host.innerHTML = `<button type="button" class="buddy-hit" aria-label="${locale === 'ja' ? 'Music Japanのキャラクター（押すと反応します）' : 'Music Japan character (tap to say hi)'}"><canvas width="${W}" height="${H}"></canvas></button><p class="buddy-say" aria-live="polite"></p><span class="buddy-notes" aria-hidden="true"></span>`;
  document.body.append(host);
  const canvas = host.querySelector('canvas')!;
  const g = canvas.getContext('2d')!;
  const say = host.querySelector<HTMLElement>('.buddy-say')!;
  const notes = host.querySelector<HTMLElement>('.buddy-notes')!;

  let mood: Mood = 'idle';
  let x = -40; // px from the left gutter
  let targetX = 0;
  let dir = 1;
  let jumpT = 0;
  let lastInteract = performance.now();
  let blinkUntil = 0;
  let nextBlink = performance.now() + 2500;
  let sayTimer = 0;
  let noteTimer = 0;
  const still = reducedMotion();

  const talk = (text: string) => {
    say.textContent = text;
    host.classList.add('is-talking');
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => host.classList.remove('is-talking'), 2200);
  };

  host.querySelector('.buddy-hit')!.addEventListener('click', () => {
    lastInteract = performance.now();
    if (mood === 'sleep') { mood = 'idle'; talk(locale === 'ja' ? 'はっ…！' : 'Huh…!'); return; }
    jumpT = 1;
    talk(lines[Math.floor(Math.random() * lines.length)]);
  });

  const popNote = () => {
    const n = document.createElement('i');
    n.textContent = Math.random() > 0.5 ? '♪' : '♫';
    n.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}px`);
    notes.append(n);
    setTimeout(() => n.remove(), 1600);
  };

  const render = (now: number) => {
    const t = now / 1000;
    const frame = Math.floor(t * (mood === 'dance' ? 4 : 3));
    g.clearRect(0, 0, W, H);
    g.save();
    if (dir < 0) { g.translate(W, 0); g.scale(-1, 1); }
    const bob = mood === 'sleep' ? 0 : mood === 'dance' ? frame % 2 : Math.floor(t * 2) % 2;
    const jump = jumpT > 0 ? Math.round(Math.sin((1 - jumpT) * Math.PI) * 4) : 0;
    const oy = 1 - bob - jump + (mood === 'sleep' ? 1 : 0);
    drawHead(g, 0, oy, now < blinkUntil, mood === 'sleep', mood === 'dance' || jumpT > 0, t);
    drawBody(g, 0, oy, jumpT > 0 ? 'jump' : mood, frame);
    g.restore();
  };

  if (still) {
    x = 0;
    host.style.setProperty('--x', '0px');
    render(performance.now());
    return;
  }

  let last = performance.now();
  let acc = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    acc += dt;

    // mood
    const idleFor = (now - lastInteract) / 1000;
    if (bus.playing) {
      if (mood !== 'dance') { mood = 'dance'; talk(locale === 'ja' ? 'この曲、好き！' : 'I love this one!'); }
      noteTimer -= dt;
      if (noteTimer <= 0) { popNote(); noteTimer = 0.45 - bus.level * 0.3; }
    } else if (mood === 'dance') {
      mood = 'idle';
      lastInteract = now;
    } else if (mood !== 'sleep' && idleFor > 40) {
      mood = 'sleep';
    } else if (mood === 'idle' && Math.random() < dt * 0.12) {
      targetX = Math.random() * 110;
      mood = 'walk';
    }
    if (mood === 'walk') {
      const d = targetX - x;
      dir = d >= 0 ? 1 : -1;
      x += Math.sign(d) * Math.min(Math.abs(d), 22 * dt);
      if (Math.abs(d) < 0.5) mood = 'idle';
    } else if (x < 0) {
      // walk in on arrival
      x = Math.min(0, x + 30 * dt);
      dir = 1;
    }
    if (jumpT > 0) jumpT = Math.max(0, jumpT - dt * 2.6);
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2200 + Math.random() * 3000; }
    host.classList.toggle('is-sleeping', mood === 'sleep');
    host.classList.toggle('is-dancing', mood === 'dance');
    host.style.setProperty('--x', `${x.toFixed(1)}px`);
    host.style.setProperty('--sway', mood === 'dance' ? `${Math.sin(now / 1000 * 8) * (4 + bus.bass * 10)}deg` : '0deg');

    // pixel art moves at a low frame rate on purpose
    if (acc >= 1 / 12) { acc = 0; render(now); }
  };
  requestAnimationFrame(tick);
}
