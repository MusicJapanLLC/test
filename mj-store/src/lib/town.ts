import { games } from '../data/games';
import type { Game } from '../data/types';
import { hash, hex, mix, rgb, sprite } from '../scenes/util';
import { unlock } from './achievements';
import { sfx } from './sound';

/**
 * 隠しモード「MJタウン」。
 * ↑↑↓↓←→←→BA で開く。作品ごとにお店が建っていて、扉から作品ページへ入れる。
 * 作品を増やすと、町にも自動でお店が増える。
 */

const VH = 180;
const GROUND = 148;
const FIRST_SHOP = 190;
const SPACING = 240;
const SHOP_W = 150;
const SHOP_H = 96;
const SPEED = 72;

const PLAYER_A = [
  '...HHHH...',
  '..HHHHHH..',
  '.HHSSSSHH.',
  '.HSESSESH.',
  '..SSSSSS..',
  '...SSSS...',
  '..TTTTTT..',
  '.STTTTTTS.',
  '.STTTTTTS.',
  '..TTTTTT..',
  '..PPPPPP..',
  '..PP..PP..',
  '..PP..PP..',
  '..BB..BB..',
];
const PLAYER_B = [
  ...PLAYER_A.slice(0, 10),
  '..PPPPPP..',
  '...PPPP...',
  '...PP.PP..',
  '...BB.BB..',
];
const PLAYER_PAL = { H: '#2A1A12', S: '#F2C49B', E: '#14100E', T: '#FF4D2E', P: '#2B3566', B: '#14100E' };

const CHIEF = [
  '.WW....WW.',
  '.WSSSSSSW.',
  '.KKKSSKKK.',
  '..SSnnSS..',
  '.WWWWWWWW.',
  '..SSSSSS..',
  '..GGWWGG..',
  '.SGGGGGGS.',
  '.SGGGGGGS.',
  '..GGGGGG..',
  '..KK..KK..',
  '..KK..KK..',
];
const CHIEF_PAL = { W: '#FFFFFF', S: '#FFD2A6', K: '#14183A', n: '#F4A37C', G: '#2F9E62' };

const MAILBOX = [
  '.RRRRRR.',
  'RRRRRRRR',
  'RKKKKKKR',
  'RRRRRRRR',
  'RRWWWWRR',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRRRRRRR',
  '.RRRRRR.',
  '...KK...',
  '...KK...',
  '...KK...',
  '..KKKK..',
];
const MAILBOX_PAL = { R: '#E8382B', K: '#1B1724', W: '#FFFFFF' };

interface Spot {
  kind: 'shop' | 'post';
  x: number;
  door: number;
  game?: Game;
  href: string;
  label: string;
}

export interface TownOptions {
  /** 埋め込み表示（404ページ）。閉じるボタンを出さない */
  embed?: HTMLElement;
  base?: string;
}

let openInstance: (() => void) | null = null;

export function openTown(opts: TownOptions = {}): void {
  if (openInstance && !opts.embed) return;
  const base = opts.base ?? (import.meta.env.BASE_URL || '/');

  const spots: Spot[] = games.map((g, i) => {
    const x = FIRST_SHOP + i * SPACING;
    return {
      kind: 'shop',
      x,
      door: x + SHOP_W / 2,
      game: g,
      href: `${base}games/${g.slug}/`,
      label: g.title,
    };
  });
  const postX = FIRST_SHOP + games.length * SPACING + 30;
  spots.push({ kind: 'post', x: postX, door: postX + 8, href: `${base}request/`, label: 'ご要望ポスト' });
  const worldW = postX + 200;

  /* ───── DOM ───── */
  const root = document.createElement('div');
  root.className = opts.embed ? 'town town--embed' : 'town';
  if (!opts.embed) {
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
  }
  root.setAttribute('aria-label', 'MJタウン（隠しモード）');
  root.innerHTML = `
    <div class="town__frame" tabindex="0">
      <canvas class="town__canvas" aria-hidden="true"></canvas>
      <div class="town__labels" aria-hidden="true"></div>
      <div class="town__hud">
        <p class="town__title"><span>MJ TOWN</span><small>隠しモード</small></p>
        <p class="town__help"><kbd>←</kbd><kbd>→</kbd> 歩く　<kbd>↑</kbd> 入る${opts.embed ? '' : '　<kbd>Esc</kbd> 閉じる'}</p>
        ${opts.embed ? '' : '<button type="button" class="town__close" aria-label="MJタウンを閉じる">×</button>'}
      </div>
      <div class="town__pad">
        <button type="button" class="town__btn" data-dir="-1" aria-label="左へ歩く">◀</button>
        <button type="button" class="town__btn town__btn--enter" data-enter aria-label="入る">入る</button>
        <button type="button" class="town__btn" data-dir="1" aria-label="右へ歩く">▶</button>
      </div>
      <div class="town__fade"></div>
    </div>`;
  (opts.embed ?? document.body).appendChild(root);

  const frame = root.querySelector<HTMLElement>('.town__frame')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.town__canvas')!;
  const labels = root.querySelector<HTMLElement>('.town__labels')!;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const signEls = spots.map((sp) => {
    const el = document.createElement('span');
    el.className = `town-sign town-sign--${sp.kind}`;
    el.textContent = sp.label;
    if (sp.game) {
      el.style.fontFamily = sp.game.theme.font;
      el.style.color = sp.game.theme.accent;
    }
    labels.appendChild(el);
    return el;
  });
  const prompt = document.createElement('span');
  prompt.className = 'town-prompt';
  prompt.textContent = '▲ 入る';
  labels.appendChild(prompt);
  const bubble = document.createElement('span');
  bubble.className = 'town-bubble';
  bubble.textContent = '世界？ 逆になんで見てないの？';
  labels.appendChild(bubble);
  const welcome = document.createElement('span');
  welcome.className = 'town-sign town-sign--start';
  welcome.textContent = 'WELCOME TO MJ TOWN →';
  labels.appendChild(welcome);

  /* ───── 状態 ───── */
  let W = 320;
  let scale = 1;
  let px = 70;
  let facing = 1;
  let dir = 0;
  let keyDir = 0;
  let padDir = 0;
  let t = 0;
  let stepT = 0;
  let entering: Spot | null = null;
  let enterT = 0;
  let raf = 0;
  let last = performance.now();
  let near: Spot | null = null;

  const chief = spots.find((s) => s.game?.id === 'soncho');

  function resize() {
    const cw = frame.clientWidth;
    const ch = frame.clientHeight;
    if (!cw || !ch) return;
    scale = ch / VH;
    W = Math.max(240, Math.round(cw / scale));
    canvas.width = W;
    canvas.height = VH;
    ctx.imageSmoothingEnabled = false;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(frame);
  resize();

  /* ───── 描画 ───── */
  const SKY_TOP = hex('#140F36');
  const SKY_MID = hex('#5B2F66');
  const SKY_BOT = hex('#F08A5D');

  function drawSky(cam: number) {
    for (let y = 0; y < GROUND; y += 2) {
      const k = y / GROUND;
      const c = k < 0.6 ? mix(SKY_TOP, SKY_MID, k / 0.6) : mix(SKY_MID, SKY_BOT, (k - 0.6) / 0.4);
      ctx.fillStyle = rgb(c);
      ctx.fillRect(0, y, W, 2);
    }
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(((hash(i, 1, 2) * 800 - cam * 0.05) % W + W) % W);
      const y = Math.floor(hash(i, 2, 2) * 70);
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    /* 遠くのビル */
    const off = cam * 0.3;
    for (let i = Math.floor(off / 34) - 1; i < Math.floor((off + W) / 34) + 2; i++) {
      const bw = 22 + Math.floor(hash(i, 3, 2) * 14);
      const bh = 30 + Math.floor(hash(i, 4, 2) * 46);
      const x = Math.floor(i * 34 - off);
      const y = GROUND - 8 - bh;
      ctx.fillStyle = '#2A2150';
      ctx.fillRect(x, y, bw, bh + 8);
      for (let wy = y + 4; wy < GROUND - 12; wy += 6) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
          const lit = hash(wx + i * 7, wy, 5) > 0.62;
          if (!lit) continue;
          const flick = hash(wx, wy, Math.floor(t * 0.5)) > 0.04;
          ctx.fillStyle = flick ? '#FFD98A' : '#8E6A55';
          ctx.fillRect(wx, wy, 2, 2);
        }
      }
    }
  }

  function drawStreet(cam: number) {
    ctx.fillStyle = '#3A3554';
    ctx.fillRect(0, GROUND, W, 7);
    ctx.fillStyle = '#4C4669';
    ctx.fillRect(0, GROUND, W, 1);
    for (let x = -((cam | 0) % 16); x < W; x += 16) {
      ctx.fillStyle = '#332E4A';
      ctx.fillRect(x, GROUND + 1, 1, 6);
    }
    ctx.fillStyle = '#1F1C2C';
    ctx.fillRect(0, GROUND + 7, W, VH - GROUND - 7);
    ctx.fillStyle = '#E8C66A';
    for (let x = -((cam | 0) % 28); x < W; x += 28) ctx.fillRect(x, GROUND + 19, 14, 2);
    /* 街灯 */
    for (let lx = 110; lx < worldW; lx += SPACING) {
      const x = Math.floor(lx - cam);
      if (x < -30 || x > W + 30) continue;
      const glow = ctx.createRadialGradient(x + 3, GROUND - 52, 0, x + 3, GROUND - 52, 34);
      glow.addColorStop(0, 'rgba(255,214,140,0.45)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 32, GROUND - 86, 70, 70);
      ctx.fillStyle = '#16131F';
      ctx.fillRect(x + 2, GROUND - 50, 2, 50);
      ctx.fillRect(x - 1, GROUND - 54, 8, 4);
      ctx.fillStyle = '#FFE3A3';
      ctx.fillRect(x, GROUND - 51, 6, 2);
    }
  }

  function drawShop(sp: Spot, cam: number) {
    const g = sp.game!;
    const th = g.theme;
    const x = Math.floor(sp.x - cam);
    if (x > W + 40 || x + SHOP_W < -40) return;
    const top = GROUND - SHOP_H;
    const wall = th.scheme === 'light' ? th.bg : th.surface;
    const accent = th.accent;
    const dark = rgb(mix(hex(wall.startsWith('#') ? wall : '#222222'), [0, 0, 0], 0.35));

    ctx.fillStyle = wall;
    ctx.fillRect(x, top, SHOP_W, SHOP_H);
    ctx.fillStyle = dark;
    ctx.fillRect(x, top, SHOP_W, 6);
    ctx.fillRect(x, GROUND - 4, SHOP_W, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + SHOP_W - 3, top, 3, SHOP_H);

    /* 看板 */
    ctx.fillStyle = '#121019';
    ctx.fillRect(x + 12, top + 12, SHOP_W - 24, 18);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 12, top + 30, SHOP_W - 24, 1);

    /* ひさし */
    const awY = top + 38;
    for (let i = 0; i < SHOP_W - 8; i += 8) {
      ctx.fillStyle = (i / 8) % 2 ? '#FFFFFF' : accent;
      ctx.fillRect(x + 4 + i, awY, 8, 8);
      ctx.fillRect(x + 5 + i, awY + 8, 6, 1);
      ctx.fillRect(x + 6 + i, awY + 9, 4, 1);
    }

    /* 窓 */
    const winY = top + 54;
    for (const wx of [x + 14, x + SHOP_W - 14 - 30]) {
      ctx.fillStyle = '#121019';
      ctx.fillRect(wx - 1, winY - 1, 32, 26);
      ctx.fillStyle = hash(wx, 1, Math.floor(t * 2)) > 0.08 ? '#FFD98A' : '#F6C870';
      ctx.fillRect(wx, winY, 30, 24);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(wx + 3, winY + 3, 8, 2);
      ctx.fillStyle = '#121019';
      ctx.fillRect(wx + 14, winY, 2, 24);
    }

    /* 扉 */
    const dx = Math.floor(sp.door - cam) - 10;
    const dy = GROUND - 32;
    const isNear = near === sp;
    const isOpen = entering === sp;
    ctx.fillStyle = isNear ? accent : '#121019';
    ctx.fillRect(dx - 2, dy - 2, 24, 34);
    ctx.fillStyle = isOpen ? '#FFF2C8' : '#1E1A2B';
    ctx.fillRect(dx, dy, 20, 32);
    if (!isOpen) {
      ctx.fillStyle = accent;
      ctx.fillRect(dx + 15, dy + 16, 2, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(dx + 2, dy + 2, 7, 28);
    }

    /* お店ごとの飾り */
    switch (th.skin) {
      case 'pixel': {
        for (let i = 0; i < SHOP_W; i += 6) {
          ctx.fillStyle = '#8A5A33';
          ctx.fillRect(x + i, top - 6, 6, 6);
          ctx.fillStyle = '#6FD14A';
          ctx.fillRect(x + i, top - 6, 6, 2);
        }
        const tx = x + SHOP_W + 6;
        ctx.fillStyle = '#7A4E2A';
        ctx.fillRect(tx + 6, GROUND - 24, 6, 24);
        ctx.fillStyle = '#3F9D3B';
        ctx.fillRect(tx, GROUND - 42, 18, 18);
        ctx.fillRect(tx + 3, GROUND - 48, 12, 6);
        ctx.fillStyle = '#5DBB4C';
        ctx.fillRect(tx + 3, GROUND - 39, 3, 3);
        ctx.fillRect(tx + 11, GROUND - 33, 3, 3);
        break;
      }
      case 'lantern': {
        for (let i = 0; i < 3; i++) {
          const lx = x + 30 + i * 45;
          const sway = Math.round(Math.sin(t * 2 + i) * 1);
          const flick = 0.7 + 0.3 * Math.sin(t * 9 + i * 3);
          const glow = ctx.createRadialGradient(lx + 3 + sway, awY + 20, 0, lx + 3 + sway, awY + 20, 16);
          glow.addColorStop(0, `rgba(255,180,80,${(0.5 * flick).toFixed(2)})`);
          glow.addColorStop(1, 'rgba(255,180,80,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(lx - 14, awY + 4, 34, 34);
          ctx.fillStyle = '#121019';
          ctx.fillRect(lx + 3 + sway, awY + 10, 1, 4);
          ctx.fillStyle = '#FFB547';
          ctx.fillRect(lx + sway, awY + 14, 7, 9);
          ctx.fillStyle = '#FF7A4D';
          ctx.fillRect(lx + sway, awY + 21, 7, 2);
        }
        break;
      }
      case 'paper': {
        /* 荷車に積んだ家と、引っ越しの旗 */
        const cx = x + SHOP_W + 6;
        ctx.fillStyle = '#5C3B26';
        ctx.fillRect(cx, GROUND - 10, 34, 4);
        ctx.fillStyle = '#1B1724';
        ctx.fillRect(cx + 4, GROUND - 6, 6, 6);
        ctx.fillRect(cx + 24, GROUND - 6, 6, 6);
        ctx.fillStyle = '#D9B98A';
        ctx.fillRect(cx + 6, GROUND - 26, 22, 16);
        ctx.fillStyle = '#A64B38';
        ctx.fillRect(cx + 4, GROUND - 31, 26, 5);
        ctx.fillStyle = '#3E3428';
        ctx.fillRect(cx + 14, GROUND - 20, 6, 10);
        const wave = Math.round(Math.sin(t * 5));
        ctx.fillStyle = '#16131F';
        ctx.fillRect(x + 8, top - 20, 2, 20);
        ctx.fillStyle = '#A64B38';
        ctx.fillRect(x + 10, top - 20 + wave, 12, 7);
        break;
      }
      case 'feed': {
        for (const tx of [Math.floor(sp.door - cam) - 22, Math.floor(sp.door - cam) + 18]) {
          const f = 0.75 + 0.25 * Math.sin(t * 13 + tx);
          const glow = ctx.createRadialGradient(tx + 2, GROUND - 40, 0, tx + 2, GROUND - 40, 20);
          glow.addColorStop(0, `rgba(255,140,50,${(0.55 * f).toFixed(2)})`);
          glow.addColorStop(1, 'rgba(255,140,50,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(tx - 18, GROUND - 60, 40, 40);
          ctx.fillStyle = '#121019';
          ctx.fillRect(tx, GROUND - 34, 4, 8);
          ctx.fillStyle = '#FF7A1A';
          ctx.fillRect(tx, GROUND - 40, 4, 6);
          ctx.fillStyle = '#FFD36B';
          ctx.fillRect(tx + 1, GROUND - 39 - Math.round(f), 2, 4);
        }
        ctx.fillStyle = '#FF3D6E';
        const hx = x + SHOP_W - 26;
        ctx.fillRect(hx, top - 12, 4, 4);
        ctx.fillRect(hx + 6, top - 12, 4, 4);
        ctx.fillRect(hx - 1, top - 9, 12, 4);
        ctx.fillRect(hx + 1, top - 5, 8, 2);
        ctx.fillRect(hx + 3, top - 3, 4, 2);
        break;
      }
    }
  }

  function placeLabel(el: HTMLElement, wx: number, wy: number, show = true) {
    el.style.transform = `translate(${(wx * scale).toFixed(1)}px, ${(wy * scale).toFixed(1)}px) translate(-50%, -50%)`;
    el.style.opacity = show ? '1' : '0';
  }

  function render(cam: number) {
    drawSky(cam);
    spots.forEach((sp) => {
      if (sp.kind === 'shop') drawShop(sp, cam);
    });
    drawStreet(cam);

    /* ご要望ポスト */
    const post = spots[spots.length - 1];
    const mx = Math.floor(post.x - cam);
    sprite(ctx, MAILBOX, MAILBOX_PAL, mx, GROUND - MAILBOX.length * 2, 2);
    if (near === post) {
      ctx.fillStyle = '#FFE3A3';
      ctx.fillRect(mx - 2, GROUND - MAILBOX.length * 2 - 3, 20, 1);
    }

    /* 入口の看板 */
    const sx = Math.floor(30 - cam);
    ctx.fillStyle = '#16131F';
    ctx.fillRect(sx + 20, GROUND - 30, 2, 30);
    ctx.fillStyle = '#FF4D2E';
    ctx.fillRect(sx, GROUND - 40, 44, 12);

    /* 村長 */
    if (chief) {
      const cx = Math.floor(chief.door - cam) + 34;
      const bob = Math.round(Math.abs(Math.sin(t * 3)) * -1);
      sprite(ctx, CHIEF, CHIEF_PAL, cx, GROUND - CHIEF.length * 2 + bob, 2, true);
    }

    /* 主人公 */
    const walking = dir !== 0 && !entering;
    const frameA = !walking || Math.floor(t * 8) % 2 === 0;
    const p = Math.floor(px - cam) - 10;
    let pyOff = 0;
    let alpha = 1;
    if (entering) {
      pyOff = -Math.min(1, enterT / 0.5) * 4;
      alpha = Math.max(0, 1 - enterT / 0.55);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p + 4, GROUND - 1, 12, 2);
    sprite(ctx, frameA ? PLAYER_A : PLAYER_B, PLAYER_PAL, p, GROUND - PLAYER_A.length * 2 + pyOff, 2, facing < 0);
    ctx.globalAlpha = 1;

    /* ラベル類（DOM） */
    spots.forEach((sp, i) => {
      const el = signEls[i];
      if (sp.kind === 'shop') {
        const fit = Math.min(8, ((SHOP_W - 34) / Math.max(4, sp.label.length)) * 1.05);
        el.style.fontSize = `${(fit * scale).toFixed(1)}px`;
        placeLabel(el, sp.x + SHOP_W / 2 - cam, GROUND - SHOP_H + 21);
      } else {
        el.style.fontSize = `${(6 * scale).toFixed(1)}px`;
        placeLabel(el, sp.x + 8 - cam, GROUND - MAILBOX.length * 2 - 12);
      }
    });
    welcome.style.fontSize = `${(4.6 * scale).toFixed(1)}px`;
    placeLabel(welcome, 52 - cam, GROUND - 34);
    prompt.style.fontSize = `${(5.5 * scale).toFixed(1)}px`;
    if (near && !entering) {
      const y = near.kind === 'post' ? GROUND - MAILBOX.length * 2 - 26 : GROUND - 46;
      placeLabel(prompt, near.door - cam, y + Math.sin(t * 6) * 1.5);
    } else prompt.style.opacity = '0';
    if (chief) {
      const showBubble = Math.abs(px - (chief.door + 44)) < 46 && !entering;
      bubble.style.fontSize = `${(5.2 * scale).toFixed(1)}px`;
      placeLabel(bubble, chief.door + 44 - cam, GROUND - 44, showBubble);
    }
  }

  /* ───── 入力 ───── */
  const keys = new Set<string>();
  const updateDir = () => {
    keyDir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  };
  const map = (k: string) =>
    k === 'ArrowLeft' || k === 'a' || k === 'A'
      ? 'left'
      : k === 'ArrowRight' || k === 'd' || k === 'D'
        ? 'right'
        : k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter' || k === ' '
          ? 'enter'
          : null;

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !opts.embed) {
      e.preventDefault();
      close();
      return;
    }
    const m = map(e.key);
    if (!m) return;
    if (opts.embed && !root.contains(document.activeElement) && document.activeElement !== document.body) return;
    e.preventDefault();
    if (m === 'enter') tryEnter();
    else {
      keys.add(m);
      updateDir();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    const m = map(e.key);
    if (m === 'left' || m === 'right') {
      keys.delete(m);
      updateDir();
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  root.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((b) => {
    const d = Number(b.dataset.dir);
    const start = (e: Event) => {
      e.preventDefault();
      padDir = d;
    };
    const stop = () => {
      if (padDir === d) padDir = 0;
    };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointerleave', stop);
    b.addEventListener('pointercancel', stop);
  });
  root.querySelector('[data-enter]')?.addEventListener('click', () => tryEnter());
  root.querySelector('.town__close')?.addEventListener('click', () => close());

  function tryEnter() {
    if (!near || entering) return;
    entering = near;
    enterT = 0;
    sfx.door();
    unlock('town');
  }

  /* ───── ループ ───── */
  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    dir = entering ? 0 : keyDir || padDir;
    if (dir) {
      facing = dir;
      px = Math.max(16, Math.min(worldW - 16, px + dir * SPEED * dt));
      stepT += dt;
      if (stepT > 0.26) {
        stepT = 0;
        sfx.step();
      }
    }
    near = null;
    for (const sp of spots) {
      if (Math.abs(px - sp.door) < (sp.kind === 'post' ? 16 : 14)) near = sp;
    }
    if (entering) {
      enterT += dt;
      if (enterT > 0.35) root.classList.add('is-leaving');
      if (enterT > 0.85) {
        const target = entering.href;
        cancelAnimationFrame(raf);
        window.location.href = target;
        return;
      }
    }
    const cam = Math.max(0, Math.min(worldW - W, px - W * 0.42));
    render(cam);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  function close() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    ro.disconnect();
    root.classList.add('is-closing');
    document.documentElement.classList.remove('town-open');
    window.setTimeout(() => root.remove(), 260);
    openInstance = null;
  }

  if (!opts.embed) {
    openInstance = close;
    document.documentElement.classList.add('town-open');
    requestAnimationFrame(() => root.classList.add('is-in'));
    frame.focus({ preventScroll: true });
  } else {
    root.classList.add('is-in');
  }
}

/* ───── コナミコマンド ───── */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function listenKonami(): void {
  let pos = 0;
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === KONAMI[pos] ? pos + 1 : key === KONAMI[0] ? 1 : 0;
    if (pos === KONAMI.length) {
      pos = 0;
      unlock('konami');
      openTown();
    }
  });

  /* タッチ端末向け：フッターのロゴを5回タップ */
  let taps = 0;
  let timer = 0;
  document.querySelectorAll('[data-town-tap]').forEach((el) =>
    el.addEventListener('click', () => {
      taps++;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (taps = 0), 1600);
      if (taps >= 5) {
        taps = 0;
        unlock('konami');
        openTown();
      }
    }),
  );
}
