import { CREW, newPose, renderRobot, type Face, type Pose } from './crew/bots';
import { H, W } from './crew/sprite';
import { prefersReducedMotion } from './env';

/**
 * Music Japan のロボット5体（TUNE / SPIN / POD / REEL / MIC）。公式サイトと同じドット絵を、
 * Baton Partners の運営会社ページ（needle の世界観）で動かす。
 *
 *   [data-bot="tune"]                … 1体。ふだんはまばたき・きょろきょろ、ときどき手をふる。押すと跳ねてしゃべる
 *   [data-bot-crew] の中の [data-bot] … 5体そろって踊る（CTA帯）
 *   メニューを開いたとき（スマホ）     … [data-bot-menu] の中に、2〜3体がランダムで出る
 *
 * 32×48 のキャンバスに 12fps で描く。画面に1体もいないときは止まる。動きを減らす設定では1枚の絵だけ。
 */

type Id = 'tune' | 'spin' | 'pod' | 'reel' | 'mic';

const LINES: Record<Id, string[]> = {
  tune: ['よーし、いくよ！', 'ぼく、TUNE！', 'リーダーです（自称）', 'ページ、いっしょにつくろ！', '押した？押したよね！', 'ついてきて！'],
  spin: ['ふぁ〜…', 'あと5分…', 'ねむいけど、回る…', 'むにゃ…検索…されてる…', 'はっ！起きてた！', 'ふわふわ〜'],
  pod: ['…いいね', 'このページ、悪くない', 'AIにも、読まれてるよ', 'クールにいこう', '…話してみれば？', 'ヘッドホンは外さない主義'],
  reel: ['記録中…', '全部おぼえてるよ', '記録係のREELです', 'いまの、保存した', 'アーカイブ完了！', 'データによると、いい会社'],
  mic: ['みんなー！ノってる〜？', '話してみる、押してみて！', 'マイク、オン！', 'しゃべりすぎ？えへ', '拍手〜！', 'いっしょにつくろ！'],
};
/** 5体の性格：休んでいるときの癖 */
const IDLE: Record<Id, { face: Face; float?: boolean; talk?: boolean }> = {
  tune: { face: 'open' },
  spin: { face: 'drowsy', float: true },
  pod: { face: 'cool' },
  reel: { face: 'open' },
  mic: { face: 'grin', talk: true },
};
const DANCE: Record<Id, string[]> = {
  tune: ['bounce', 'step', 'clap', 'pose'],
  spin: ['sway', 'float', 'sway'],
  pod: ['nod', 'sway', 'snap'],
  reel: ['robot', 'step', 'robot'],
  mic: ['bounce', 'wave', 'clap', 'spin'],
};

type Move = (P: Pose, b: number, ph: number, t: number) => void;
const MOVES: Record<string, Move> = {
  bounce: (P, b, ph) => { P.dy = ph < 0.35 ? 1 : 0; P.legH = 3 - P.dy; P.armL = b % 2 ? 'up' : 'out'; P.armR = b % 2 ? 'out' : 'up'; P.hx = b % 2 ? 1 : -1; P.face = b % 4 < 2 ? 'sing' : 'smile'; },
  step: (P, b) => { P.hx = b % 2 ? 1 : -1; P.bx = P.hx; P.legs = b % 2 ? 'step1' : 'step2'; P.armL = b % 4 === 0 ? 'up' : 'out'; P.armR = b % 4 === 2 ? 'up' : 'out'; P.face = 'smile'; },
  sway: (P, b) => { const s = Math.floor(b / 2) % 2; P.hx = s ? 1 : -1; P.armL = s ? 'down' : 'out'; P.armR = s ? 'out' : 'down'; P.face = 'smile'; },
  nod: (P, b, ph) => { P.hy = ph < 0.4 ? 1 : 0; P.armL = P.armR = 'hip'; P.face = b % 4 === 3 ? 'wink' : 'cool'; },
  clap: (P, b, ph) => { const air = b % 2 === 0 && ph < 0.6; P.dy = air ? -Math.round(Math.sin((ph / 0.6) * Math.PI) * 4) : 0; P.armL = P.armR = air ? 'up' : 'out'; P.legs = air ? 'dangle' : 'stand'; P.face = air ? 'laugh' : 'smile'; },
  wave: (P, b, ph) => { const w = ph < 0.5; P.armL = w ? 'wave1' : 'wave2'; P.armR = w ? 'wave2' : 'wave1'; P.hx = b % 2 ? 1 : 0; P.face = 'sing'; },
  robot: (P, b) => { const k = b % 4; P.armL = k === 0 ? 'out' : k === 2 ? 'up' : 'down'; P.armR = k === 1 ? 'out' : k === 3 ? 'up' : 'down'; P.bx = k < 2 ? 1 : -1; P.hx = P.bx; P.face = 'open'; },
  spin: (P, b, ph) => { P.flip = Math.floor((b + ph) * 2) % 2 === 1; P.armL = P.armR = 'out'; P.face = 'laugh'; P.dy = ph < 0.2 ? 1 : 0; P.legH = 3 - P.dy; },
  float: (P, _b, _ph, t) => { const k = Math.sin(t * 2.2); P.dy = -Math.round(3 + k * 1.5); P.float = true; P.legs = 'dangle'; P.armL = P.armR = 'out'; P.face = 'smile'; },
  pose: (P, b) => { const k = Math.floor(b / 2) % 3; P.armL = k === 0 ? 'up' : 'hip'; P.armR = k === 1 ? 'up' : 'hip'; P.face = k === 2 ? 'love' : 'wink'; P.flip = k === 1; },
  snap: (P, b) => { P.hx = b % 2 ? 1 : 0; P.armR = b % 2 ? 'wave2' : 'out'; P.face = b % 4 === 3 ? 'wink' : 'cool'; },
};

type Bot = {
  el: HTMLElement;
  id: Id;
  index: number;
  ctx: CanvasRenderingContext2D;
  say: HTMLElement | null;
  dance: boolean;
  seed: number;
  visible: boolean;
  react: number;
  reactFace: Face;
  blinkAt: number;
  lookAt: number;
  look: number;
  waveAt: number;
  sayUntil: number;
  lines: string[];
  lineAt: number;
};

const ORDER = CREW.map((c) => c.id as Id);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function setupRobots(): void {
  const els = [...document.querySelectorAll<HTMLElement>('[data-bot]')];
  if (!els.length) return;
  const still = prefersReducedMotion();
  const bots: Bot[] = [];
  const start = performance.now();

  const make = (el: HTMLElement): Bot | null => {
    const id = el.dataset.bot as Id;
    const index = ORDER.indexOf(id);
    if (index < 0) return null;
    let canvas = el.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      el.prepend(canvas);
    }
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const custom = el.dataset.botLine ? [el.dataset.botLine] : [];
    return {
      el,
      id,
      index,
      ctx,
      say: el.querySelector<HTMLElement>('[data-bot-say]'),
      dance: el.closest('[data-bot-crew]') !== null,
      seed: Math.random() * 10,
      visible: false,
      react: -10,
      reactFace: 'laugh',
      blinkAt: 1 + Math.random() * 3,
      lookAt: 2 + Math.random() * 4,
      look: 0,
      waveAt: 4 + Math.random() * 8,
      sayUntil: 0,
      lines: [...custom, ...LINES[id]],
      lineAt: 0,
    };
  };

  const pose = (b: Bot, t: number): Pose => {
    const P = newPose(t);
    P.ground = 'dark';
    const idle = IDLE[b.id];
    if (b.dance && !still) {
      const bpm = b.id === 'spin' ? 0.8 : b.id === 'pod' ? 1.0 : 1.3;
      const beat = (t + b.seed * 0.1) * bpm * 2;
      const bi = Math.floor(beat);
      const moves = DANCE[b.id];
      const mv = moves[Math.floor(beat / 8 + b.seed) % moves.length];
      MOVES[mv](P, bi, beat - bi, t);
      P.playing = true;
    } else {
      P.face = 'open';
      // まばたき・きょろきょろ・ときどき手をふる
      if (t > b.lookAt) {
        b.look = b.look ? 0 : pick([-1, 1]);
        b.lookAt = t + 1.5 + Math.random() * 4;
      }
      P.look = b.look;
      if (t > b.blinkAt) {
        if (t > b.blinkAt + 0.16) b.blinkAt = t + 2 + Math.random() * 4;
        else P.face = 'blink';
      }
      if (t > b.waveAt) {
        if (t > b.waveAt + 1.6) b.waveAt = t + 7 + Math.random() * 9;
        else {
          const w = Math.floor((t - b.waveAt) * 6) % 2 === 0;
          P.armR = w ? 'wave1' : 'wave2';
          if (P.face === 'open') P.face = 'smile';
        }
      }
      if (idle.float && !still) {
        const k = Math.sin(t * 1.4 + b.seed);
        if (k > 0.35) {
          P.float = true;
          P.dy = -Math.round((k - 0.35) * 5);
          P.legs = 'dangle';
        }
      }
      if (idle.talk && !still && Math.sin(t * 0.7 + b.seed) > 0.6) {
        P.face = 'talk';
        P.talkOpen = Math.floor(t * 8) % 2 === 0;
      }
    }
    // 押されたとき：跳ねて、表情が変わる
    const r = t - b.react;
    if (r >= 0 && r < 0.9) {
      P.dy = -Math.round(Math.sin((r / 0.9) * Math.PI) * 6);
      P.legs = 'dangle';
      P.armL = P.armR = 'up';
      P.face = b.reactFace;
    }
    if (b.say && t < b.sayUntil && P.face === 'open') {
      P.face = 'talk';
      P.talkOpen = Math.floor(t * 8) % 2 === 0;
    }
    return P;
  };

  const draw = (b: Bot, t: number) => renderRobot(b.ctx, b.index, pose(b, t));

  const speak = (b: Bot, t: number) => {
    if (!b.say) return;
    b.say.textContent = b.lines[b.lineAt % b.lines.length];
    b.lineAt += 1;
    b.say.hidden = false;
    b.el.classList.add('is-talking');
    b.sayUntil = t + 2.6;
  };

  for (const el of els) {
    const b = make(el);
    if (!b) continue;
    bots.push(b);
    draw(b, still ? 0 : 0.01);
    const poke = () => {
      const t = (performance.now() - start) / 1000;
      b.react = t;
      b.reactFace = pick(['laugh', 'wow', 'love', 'star'] as Face[]);
      speak(b, t);
      if (still) draw(b, 0);
      kick();
    };
    el.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') poke();
    });
    el.addEventListener('click', poke);
  }
  if (!bots.length) return;

  // 画面に入っている間だけ動かす
  let timer = 0;
  const tick = () => {
    const t = (performance.now() - start) / 1000;
    let any = false;
    for (const b of bots) {
      if (!b.visible) continue;
      any = true;
      draw(b, t);
      if (b.say && !b.say.hidden && t > b.sayUntil) {
        b.say.hidden = true;
        b.el.classList.remove('is-talking');
      }
    }
    if (!any) {
      window.clearInterval(timer);
      timer = 0;
    }
  };
  const kick = () => {
    if (still || timer || document.hidden) return;
    timer = window.setInterval(tick, 1000 / 12);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const b = bots.find((x) => x.el === e.target);
      if (b) b.visible = e.isIntersecting;
    }
    kick();
  });
  bots.forEach((b) => io.observe(b.el));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearInterval(timer);
      timer = 0;
    } else kick();
  });

  // メニュー：開くたびに2〜3体を選び直す
  const menu = document.querySelector<HTMLElement>('[data-bot-menu]');
  if (menu) {
    const shuffle = () => {
      const slots = [...menu.querySelectorAll<HTMLElement>('[data-bot]')];
      const n = 2 + Math.round(Math.random());
      const chosen = new Set(ORDER.slice().sort(() => Math.random() - 0.5).slice(0, n));
      slots.forEach((s) => (s.hidden = !chosen.has(s.dataset.bot as Id)));
    };
    shuffle();
    new MutationObserver(() => {
      if (!document.querySelector('[data-menu]')?.hasAttribute('hidden')) shuffle();
    }).observe(document.querySelector('[data-menu]') ?? menu, { attributes: true, attributeFilter: ['hidden'] });
  }
}
