import { CREW, newPose, renderRobot, type Pose } from './bots';
import { H, W } from './sprite';
import { reducedMotion } from '../env';
import { bus } from '../bus';

/**
 * The robot crew. They only appear when there is a reason to:
 *  - a preview is playing → all five come out and dance at the bottom of the player
 *  - the mobile menu opens → two or three of them wait at the bottom of the menu
 * Everything is drawn into 32×48 canvases at 12fps, and the loop stops when nobody is on stage.
 */

export type Genre = 'hiphop' | 'jpop' | 'rnb' | 'jazz' | 'classical' | 'sleep';
type Locale = 'ja' | 'en';

const LINES: Record<Locale, Record<Genre | 'menu' | 'tap' | 'hello' | 'bye', string[]>> = {
  ja: {
    hiphop: ['ビート、キてる…！', '首が勝手にノってる', '渋谷の夜って感じ', 'ヨー、チェケ…あ、照れる', 'このベース、胸にくる', 'いっしょに揺れよ？', '未完成でも、最高だよね', 'ボリューム、あと1だけ', 'トーキョー・ジャンキーズ！'],
    jpop: ['このメロディ、すき', '夕焼けの色がする', '口ずさんじゃう〜♪', 'なんか、泣きそう', 'サビ、くるよ…！', 'いまの気分にぴったり', 'きらきらしてる', 'もう1回聴いてもいい？', 'ここにある、ね'],
    rnb: ['ゆら〜り、ゆらり', '声が、しみる…', '夜にひとりで聴きたい', '大人の味がする', '指パッチン…できない', 'このグルーヴ、とける', 'ちょっと切ないね', 'マイアミの風…？', 'スロウに、スロウに'],
    jazz: ['ピアノ、夜の匂い', 'コーヒー、いれよっか', 'スウィングしちゃう', '大人のラウンジだ…', 'シャバドゥビ〜♪', '雨の日にも合うね', 'しっとり、しっとり', 'ベースの足音、すき', '今夜はゆっくりいこ'],
    classical: ['おとぎ話の中みたい', 'ページをめくる音がする', '集中モード、オン', '指揮してみる。えへん', 'ふかふかの音だね', 'お城に行きたくなる', '勉強、がんばろ', '優雅に…優雅に…', 'ブラボー！'],
    sleep: ['ふぁ…ねむくなってきた', '雨の音、やさしい', 'おやすみモード', 'すー…はー…', '目、閉じてもいいよ', 'ぼくも寝ちゃいそう', 'ゆっくりでいいんだよ', '夢で会おうね', 'zzz…はっ、起きてた！'],
    menu: ['どこ行く？', '作品ページ、おすすめ！', '会社概要、読んだ？', '迷ったらトップへ！', 'パートナーさんも見てね', 'お問い合わせ、まってる', 'えへへ', '押してくれてありがと', '今日もいい音、見つけよ'],
    tap: ['やあ！', 'わっ！', 'くすぐったい〜', 'なになに？', 'えへへ', 'もう1回！', 'ぴょん！', 'Music Japanだよ', 'いい曲あるよ'],
    hello: ['いい曲、見つけたね', 'きたきた〜！', 'いっしょに聴こ！', '全員集合〜！'],
    bye: ['またね！', 'いい曲だった〜', 'また聴こうね', 'おつかれさま〜'],
  },
  en: {
    hiphop: ['This beat hits!', 'My head won’t stop nodding', 'Feels like Shibuya at night', 'Yo… okay that was cringe', 'That bass!', 'Move with me?', 'Unfinished and perfect', 'One more notch louder', 'TOKYO JUNKIES!'],
    jpop: ['Love this melody', 'Sounds like a sunset', 'Humming along ♪', 'I might cry a little', 'Chorus incoming…!', 'Exactly my mood', 'So sparkly', 'Play it again?', 'It’s right here'],
    rnb: ['Swaying slowly…', 'That voice…', 'A song for late nights', 'Very grown-up', 'I can’t snap my fingers', 'Melting into this groove', 'A little bittersweet', 'Is that a Miami breeze?', 'Slow… slow…'],
    jazz: ['Piano smells like midnight', 'Coffee, anyone?', 'I’m swinging', 'Fancy lounge vibes', 'Shoo-bee-doo ♪', 'Perfect for rainy days', 'Smooth…', 'Love that walking bass', 'Let’s take it easy'],
    classical: ['Like a fairy tale', 'Pages turning…', 'Focus mode: on', 'Let me conduct. Ahem.', 'Such a soft sound', 'I want to visit a castle', 'Study time!', 'Elegant… elegant…', 'Bravo!'],
    sleep: ['Getting sleepy…', 'The rain is so gentle', 'Sleep mode', 'Breathe in… out…', 'You can close your eyes', 'I might doze off too', 'No rush at all', 'See you in a dream', 'Zzz… I’m awake!'],
    menu: ['Where to?', 'Check out the works!', 'Read about us?', 'Lost? Go home!', 'Meet our partners', 'We’d love to hear from you', 'Hehe', 'Thanks for the tap', 'Find a good song today'],
    tap: ['Hi!', 'Whoa!', 'That tickles', 'What’s up?', 'Hehe', 'Again!', 'Boing!', 'This is Music Japan', 'Got a song for you'],
    hello: ['Great pick!', 'Here we go!', 'Let’s listen!', 'Everyone, assemble!'],
    bye: ['See you!', 'That was good', 'Listen again soon', 'Good job, team'],
  },
};
const CHATS: Record<Locale, [string, string][]> = {
  ja: [['どこ行く？', '作品ページ！'], ['今日もいい音、見つけよ', 'うん！'], ['押してくれた〜', 'えへへ'], ['なに聴く？', 'ぜんぶ！'], ['おなかすいた', 'ぼくたち電池だよ']],
  en: [['Where to?', 'The works page!'], ['Find a good song?', 'Yes!'], ['They tapped us!', 'Hehe'], ['What should we play?', 'Everything!'], ['I’m hungry', 'We run on batteries']],
};

class Deck<T> {
  private bag: T[] = [];
  private last: T | null = null;
  constructor(private list: T[]) {}
  next(): T {
    if (!this.bag.length) {
      this.bag = this.list.slice().sort(() => Math.random() - 0.5);
      if (this.bag[0] === this.last && this.bag.length > 1) this.bag.push(this.bag.shift()!);
    }
    return (this.last = this.bag.shift()!);
  }
}

/* ── dance moves: each shapes a pose from the beat ── */
type Move = (P: Pose, b: number, ph: number, t: number) => void;
const MOVES: Record<string, Move> = {
  bounce: (P, b, ph) => { P.dy = ph < 0.35 ? 1 : 0; P.legH = 3 - P.dy; P.armL = b % 2 ? 'up' : 'out'; P.armR = b % 2 ? 'out' : 'up'; P.hx = b % 2 ? 1 : -1; P.face = b % 4 < 2 ? 'sing' : 'smile'; },
  step: (P, b) => { P.hx = b % 2 ? 1 : -1; P.bx = P.hx; P.legs = b % 2 ? 'step1' : 'step2'; P.armL = b % 4 === 0 ? 'up' : 'out'; P.armR = b % 4 === 2 ? 'up' : 'out'; P.face = 'smile'; },
  sway: (P, b) => { const s = Math.floor(b / 2) % 2; P.hx = s ? 1 : -1; P.armL = s ? 'down' : 'out'; P.armR = s ? 'out' : 'down'; P.face = 'smile'; },
  nod: (P, b, ph) => { P.hy = ph < 0.4 ? 1 : 0; P.armL = P.armR = 'hip'; P.face = b % 4 === 3 ? 'wink' : 'sing'; },
  clap: (P, b, ph) => { const air = b % 2 === 0 && ph < 0.6; P.dy = air ? -Math.round(Math.sin((ph / 0.6) * Math.PI) * 4) : 0; P.armL = P.armR = air ? 'up' : 'out'; P.legs = air ? 'dangle' : 'stand'; P.face = air ? 'laugh' : 'smile'; },
  wave: (P, b, ph) => { const w = ph < 0.5; P.armL = w ? 'wave1' : 'wave2'; P.armR = w ? 'wave2' : 'wave1'; P.hx = b % 2 ? 1 : 0; P.face = 'sing'; },
  robot: (P, b) => { const k = b % 4; P.armL = k === 0 ? 'out' : k === 2 ? 'up' : 'down'; P.armR = k === 1 ? 'out' : k === 3 ? 'up' : 'down'; P.bx = k < 2 ? 1 : -1; P.hx = P.bx; P.face = 'open'; },
  spin: (P, b, ph) => { P.flip = Math.floor((b + ph) * 2) % 2 === 1; P.armL = P.armR = 'out'; P.face = 'laugh'; P.dy = ph < 0.2 ? 1 : 0; P.legH = 3 - P.dy; },
  float: (P, _b, _ph, t) => { const k = Math.sin(t * 2.2); P.dy = -Math.round(3 + k * 1.5); P.float = true; P.legs = 'dangle'; P.armL = P.armR = 'out'; P.face = 'smile'; },
  pose: (P, b) => { const k = Math.floor(b / 2) % 3; P.armL = k === 0 ? 'up' : 'hip'; P.armR = k === 1 ? 'up' : 'hip'; P.face = k === 2 ? 'love' : 'wink'; P.flip = k === 1; },
  twist: (P, b, ph) => { const q = Math.floor((b + ph) * 2) % 2; P.bx = q ? 1 : -1; P.hx = -P.bx; P.legs = q ? 'step1' : 'step2'; P.armL = P.armR = 'out'; P.face = 'sing'; },
  conduct: (P, b, ph) => { P.armR = ph < 0.5 ? 'wave1' : 'wave2'; P.armL = 'down'; P.hx = Math.floor(b / 2) % 2 ? 0 : 1; P.face = 'smile'; },
  snap: (P, b) => { P.hx = b % 2 ? 1 : 0; P.armR = b % 2 ? 'wave2' : 'out'; P.face = b % 4 === 3 ? 'sing' : 'smile'; },
  doze: (P, b, _ph, t) => { const sleepy = Math.floor(t / 5) % 2 === 1; P.face = sleepy ? 'sleep' : 'smile'; P.hx = b % 2 ? 1 : 0; if (sleepy) { const k = Math.sin(t * 1.2); if (k > 0.2) { P.float = true; P.dy = -Math.round(k * 3); P.legs = 'dangle'; } } },
};
const GENRE: Record<Genre, { bpm: number; pool: string[] }> = {
  hiphop: { bpm: 1.55, pool: ['bounce', 'nod', 'robot', 'clap', 'twist', 'spin', 'pose'] },
  jpop: { bpm: 1.25, pool: ['step', 'wave', 'clap', 'spin', 'pose', 'bounce', 'float'] },
  rnb: { bpm: 0.85, pool: ['sway', 'nod', 'float', 'pose', 'snap'] },
  jazz: { bpm: 1.0, pool: ['sway', 'snap', 'step', 'spin', 'nod'] },
  classical: { bpm: 0.7, pool: ['conduct', 'sway', 'float', 'pose'] },
  sleep: { bpm: 0.45, pool: ['doze', 'sway', 'float'] },
};

type Mode = 'idle' | 'dance' | 'talk' | 'laugh' | 'jump' | 'spin' | 'wave' | 'love' | 'float' | 'dizzy' | 'wow' | 'freestyle';

class Robot {
  el: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private say: HTMLElement;
  private fx: HTMLElement;
  mode: Mode = 'idle';
  private m0 = 0;
  private move = 'bounce';
  private moveBar = -1;
  private blinkTo = 0;
  private nextBlink = 0;
  private talkUntil = 0;
  private sayTimer = 0;
  private nextNote = 0;
  private cycle = 0;
  crew: Crew;
  index: number;
  lookAt: number | null = null;

  constructor(crew: Crew, index: number, align: 'left' | 'center' | 'right') {
    this.crew = crew;
    this.index = index;
    this.el = document.createElement('div');
    this.el.className = 'rb';
    this.el.innerHTML = `<button type="button" class="rb-hit" aria-label="${crew.locale === 'ja' ? `${CREW[index].name}（押すと反応します）` : `${CREW[index].name} (tap to say hi)`}"><canvas width="${W}" height="${H}"></canvas></button><p class="rb-say rb-say--${align}" aria-live="polite"></p><span class="rb-fx" aria-hidden="true"></span>`;
    this.ctx = this.el.querySelector('canvas')!.getContext('2d')!;
    this.say = this.el.querySelector('.rb-say')!;
    this.fx = this.el.querySelector('.rb-fx')!;
    this.el.querySelector('.rb-hit')!.addEventListener('click', () => crew.tapped(this));
    this.nextBlink = performance.now() + Math.random() * 3000;
  }
  speak(text: string, ms = 2400) {
    this.say.textContent = text;
    this.el.classList.add('is-talking');
    clearTimeout(this.sayTimer);
    this.sayTimer = window.setTimeout(() => this.el.classList.remove('is-talking'), ms);
    this.talkUntil = performance.now() + Math.min(1600, 280 + text.length * 110);
  }
  act(mode: Mode) { this.mode = mode; this.m0 = performance.now(); }
  react(playing: boolean, lines: Deck<string>) {
    if (playing) { this.act((['laugh', 'jump', 'spin', 'love'] as Mode[])[Math.floor(Math.random() * 4)]); this.speak(lines.next()); return; }
    const pool: Mode[] = ['talk', 'laugh', 'jump', 'spin', 'wave', 'love', 'float', 'dizzy', 'wow', 'freestyle'];
    this.act(pool[Math.floor(Math.random() * pool.length)]);
    this.speak(lines.next());
  }
  /** menu: talk → laugh → jump → dance, in that order */
  cycleReact(lines: Deck<string>) {
    const order: Mode[] = ['talk', 'laugh', 'jump', 'freestyle'];
    const m = order[this.cycle++ % order.length];
    this.act(m);
    this.speak(m === 'freestyle' ? (this.crew.locale === 'ja' ? 'ノってきた〜♪' : 'Dance time ♪') : lines.next());
  }
  private note(ch: string) {
    const n = document.createElement('i');
    n.textContent = ch;
    n.style.setProperty('--dx', `${(Math.random() - 0.5) * 44}px`);
    this.fx.append(n);
    setTimeout(() => n.remove(), 1700);
  }

  pose(now: number): Pose {
    const t = now / 1000, u = (now - this.m0) / 1000, fr = Math.floor(t * 8);
    const P = newPose(t);
    P.playing = this.crew.genre !== null;
    P.ground = this.crew.ground;
    const talking = now < this.talkUntil;
    const done = (d: number) => { if (u > d) this.mode = this.crew.genre ? 'dance' : 'idle'; };
    switch (this.mode) {
      case 'dance': {
        const g = GENRE[this.crew.genre ?? 'jpop'];
        const beat = t * g.bpm * 2 + this.index * 0.12;
        const b = Math.floor(beat), ph = beat - b, bar = Math.floor(b / 4);
        if (bar !== this.moveBar) {
          this.moveBar = bar;
          this.move = this.crew.syncMove(bar) ?? g.pool[Math.floor(Math.random() * g.pool.length)];
        }
        MOVES[this.move](P, b, ph, t);
        if (talking) { P.face = 'talk'; P.talkOpen = fr % 2 === 0; }
        if (now > this.nextNote) {
          this.note(P.face === 'sleep' ? 'z' : Math.random() > 0.5 ? '♪' : '♫');
          this.nextNote = now + 700 + Math.random() * 900 - bus.level * 400;
        }
        return P;
      }
      case 'freestyle': { const b = Math.floor(t * 4); MOVES[['bounce', 'spin', 'twist', 'wave'][Math.floor(u / 0.9) % 4]](P, b, (t * 4) % 1, t); if (now > this.nextNote) { this.note('♪'); this.nextNote = now + 450; } done(3.4); return P; }
      case 'jump':
        if (u < 0.1) { P.dy = 1; P.legH = 2; P.face = 'smile'; }
        else if (u < 0.62) { P.dy = -Math.round(Math.sin(Math.PI * ((u - 0.1) / 0.52)) * 8); P.armL = P.armR = 'up'; P.face = 'laugh'; P.legs = 'dangle'; }
        else if (u < 0.75) { P.dy = 1; P.legH = 2; P.face = 'smile'; }
        done(0.75);
        return P;
      case 'laugh': P.face = 'laugh'; P.hx = fr % 2; P.armL = P.armR = 'out'; P.dy = fr % 4 < 2 ? 0 : 1; P.legH = 3 - P.dy; done(1.4); return P;
      case 'spin': P.flip = fr % 2 === 1; P.armL = P.armR = 'out'; P.face = u < 1 ? 'laugh' : 'dizzy'; P.dy = u < 1 ? -(fr % 2) : 0; done(1.8); return P;
      case 'dizzy': P.face = 'dizzy'; P.hx = Math.round(Math.sin(u * 9)); P.bx = -P.hx; done(1.6); return P;
      case 'love': P.face = 'love'; P.armL = P.armR = 'hip'; P.dy = Math.floor(u * 4) % 2 ? 0 : -1; if (now > this.nextNote) { this.note('♥'); this.nextNote = now + 500; } done(1.8); return P;
      case 'wave': P.face = 'smile'; P.armR = fr % 4 < 2 ? 'wave1' : 'wave2'; done(1.8); return P;
      case 'wow': P.face = 'wow'; P.dy = u < 0.25 ? -1 : 0; done(0.9); return P;
      case 'talk': P.face = talking ? 'talk' : 'smile'; P.talkOpen = fr % 2 === 0; P.armR = 'out'; done(2.4); return P;
      case 'float': {
        const D = 3.4, e = u < 0.6 ? u / 0.6 : u > D - 0.6 ? Math.max(0, (D - u) / 0.6) : 1;
        const lift = e * (3.5 + Math.sin(u * 3.2));
        P.dy = -Math.round(lift); P.float = lift > 1.2; P.legs = lift > 0.6 ? 'dangle' : 'stand'; P.armL = P.armR = lift > 1 ? 'out' : 'down'; P.face = 'smile';
        done(D);
        return P;
      }
      default: {
        const bb = Math.floor(t * 1.6 + this.index * 0.5) % 2;
        P.dy = bb; P.legH = 3 - bb;
        if (now > this.nextBlink) { this.blinkTo = now + 130; this.nextBlink = now + 2200 + Math.random() * 3200; }
        if (now < this.blinkTo) P.face = 'blink';
        if (talking) { P.face = 'talk'; P.talkOpen = fr % 2 === 0; }
        if (this.lookAt !== null) P.flip = this.lookAt < this.index;
        return P;
      }
    }
  }
  draw(now: number) { renderRobot(this.ctx, this.index, this.pose(now)); }
}

class Crew {
  host: HTMLElement;
  robots: Robot[] = [];
  genre: Genre | null = null;
  locale: Locale;
  ground: 'dark' | 'light';
  private lines: Deck<string>;
  private tapLines: Deck<string>;
  private nextLine = 0;
  private nextIdle = 0;
  private syncBar = -1;
  private syncName: string | null = null;
  private kind: 'stage' | 'menu';

  constructor(host: HTMLElement, kind: 'stage' | 'menu', locale: Locale) {
    this.host = host;
    this.kind = kind;
    this.locale = locale;
    this.ground = kind === 'menu' ? 'light' : 'dark';
    this.tapLines = new Deck(LINES[locale][kind === 'menu' ? 'menu' : 'tap']);
    this.lines = this.tapLines;
  }
  /** one in three bars, the whole crew does the same move */
  syncMove(bar: number): string | null {
    if (bar !== this.syncBar) {
      this.syncBar = bar;
      const pool = GENRE[this.genre ?? 'jpop'].pool;
      this.syncName = Math.random() < 0.34 ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    return this.syncName;
  }
  tapped(r: Robot) {
    if (this.kind === 'menu') r.cycleReact(this.tapLines);
    else r.react(this.genre !== null, this.genre ? this.lines : this.tapLines);
  }
  async enter(indices: number[]) {
    this.host.replaceChildren();
    this.robots = indices.map((i, k) => new Robot(this, i, k === 0 && indices.length > 1 ? 'left' : k === indices.length - 1 && indices.length > 1 ? 'right' : 'center'));
    this.robots.forEach((r) => this.host.append(r.el));
    this.host.hidden = false;
    wake();
    if (reducedMotion()) return;
    const entries = ['hop', 'float', 'peek', 'drop'];
    await Promise.all(this.robots.map((r, k) => {
      const e = entries[Math.floor(Math.random() * entries.length)];
      const frames: Record<string, Keyframe[]> = {
        hop: [{ transform: 'translateY(120%)' }, { transform: 'translateY(-18%)', offset: 0.6 }, { transform: 'none' }],
        float: [{ transform: 'translateY(-180%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        peek: [{ transform: `translate(${k % 2 ? 60 : -60}%, 60%) rotate(${k % 2 ? 25 : -25}deg)` }, { transform: `translate(${k % 2 ? 20 : -20}%, 25%) rotate(${k % 2 ? 18 : -18}deg)`, offset: 0.55 }, { transform: 'none' }],
        drop: [{ transform: 'translateY(-160%)' }, { transform: 'none', offset: 0.55 }, { transform: 'translateY(-12%)', offset: 0.75 }, { transform: 'none' }],
      };
      r.act(e === 'float' ? 'float' : e === 'hop' || e === 'drop' ? 'jump' : 'wow');
      r.el.style.opacity = '0';
      return new Promise<void>((res) => setTimeout(() => {
        r.el.style.opacity = '';
        r.el.animate(frames[e], { duration: e === 'float' ? 1300 : 720, easing: 'cubic-bezier(.2,.9,.3,1)' }).finished.then(() => res(), () => res());
      }, k * 140));
    }));
  }
  async leave(wave = true) {
    const rs = this.robots;
    if (!rs.length) return;
    if (wave && !reducedMotion()) {
      rs.forEach((r) => r.act('wave'));
      rs[Math.floor(Math.random() * rs.length)].speak(new Deck(LINES[this.locale].bye).next(), 1400);
      await new Promise((r) => setTimeout(r, 1300));
      await Promise.all(rs.map((r, k) => new Promise<void>((res) => setTimeout(() => r.el.animate([{ transform: 'none' }, { transform: 'translateY(130%)' }], { duration: 420, easing: 'cubic-bezier(.6,0,.8,.4)', fill: 'forwards' }).finished.then(() => res(), () => res()), k * 80))));
    }
    if (this.robots !== rs) return; // a new crew came in meanwhile
    this.robots = [];
    this.host.replaceChildren();
    this.host.hidden = true;
  }
  play(genre: Genre) {
    this.genre = genre;
    this.lines = new Deck(LINES[this.locale][genre]);
    this.robots.forEach((r) => r.act('dance'));
    this.nextLine = performance.now() + 1500;
  }
  stop() { this.genre = null; }
  tick(now: number) {
    if (!this.robots.length) return;
    if (this.genre && now > this.nextLine) {
      const r = this.robots[Math.floor(Math.random() * this.robots.length)];
      r.speak(this.lines.next(), 2600);
      this.nextLine = now + 4200 + Math.random() * 3200;
    }
    if (!this.genre && now > this.nextIdle) {
      // idle life: someone floats, waves, or two of them chat
      this.nextIdle = now + 4200 + Math.random() * 3500;
      const rs = this.robots.filter((r) => r.mode === 'idle');
      if (rs.length >= 2 && Math.random() < 0.4) {
        const [a, b] = rs.sort(() => Math.random() - 0.5);
        const [q, ans] = CHATS[this.locale][Math.floor(Math.random() * CHATS[this.locale].length)];
        a.lookAt = b.index; b.lookAt = a.index;
        a.speak(q, 1800); a.act('talk');
        setTimeout(() => { b.speak(ans, 1800); b.act('laugh'); }, 1500);
        setTimeout(() => { a.lookAt = b.lookAt = null; }, 3600);
      } else if (rs.length) {
        rs[Math.floor(Math.random() * rs.length)].act((['float', 'wave', 'wow', 'jump', 'spin'] as Mode[])[Math.floor(Math.random() * 5)]);
      }
    }
    for (const r of this.robots) r.draw(now);
  }
}

/* ── one shared 12fps loop that sleeps when nobody is on stage ── */
const crews: Crew[] = [];
let running = false;
function wake() {
  if (running) return;
  running = true;
  let last = 0;
  const f = (now: number) => {
    if (!crews.some((c) => c.robots.length)) { running = false; return; }
    requestAnimationFrame(f);
    if (document.hidden || now - last < 1000 / 12) return;
    last = now;
    for (const c of crews) c.tick(now);
  };
  requestAnimationFrame(f);
}

const pick = (n: number) => [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, n);

export function setupCrew() {
  const locale: Locale = document.documentElement.lang === 'en' ? 'en' : 'ja';

  // all-stars in the player
  const dlg = document.querySelector<HTMLDialogElement>('[data-player]');
  if (dlg) {
    const stage = document.createElement('div');
    stage.className = 'crew crew--stage';
    stage.hidden = true;
    dlg.append(stage);
    const crew = new Crew(stage, 'stage', locale);
    crews.push(crew);
    let leaving = 0;
    document.addEventListener('mj:play', (e) => {
      const { on, genre } = (e as CustomEvent<{ on: boolean; genre: Genre }>).detail;
      clearTimeout(leaving);
      if (on) {
        dlg.classList.add('has-crew');
        const start = () => {
          crew.play(genre);
          const hello = crew.robots[Math.floor(Math.random() * crew.robots.length)];
          hello?.speak(new Deck(LINES[locale].hello).next());
        };
        if (crew.robots.length) start();
        else void crew.enter([0, 1, 2, 3, 4]).then(start);
      } else {
        crew.stop();
        // a short pause between tracks shouldn't send everyone home
        leaving = window.setTimeout(() => { void crew.leave().then(() => { if (!crew.robots.length) dlg.classList.remove('has-crew'); }); }, 900);
      }
    });
    dlg.addEventListener('close', () => { clearTimeout(leaving); crew.stop(); void crew.leave(false); dlg.classList.remove('has-crew'); });
  }

  // two or three in the mobile menu
  const nav = document.getElementById('nav');
  if (nav) {
    const spot = document.createElement('div');
    spot.className = 'crew crew--menu';
    spot.hidden = true;
    nav.append(spot);
    const crew = new Crew(spot, 'menu', locale);
    crews.push(crew);
    const small = matchMedia('(max-width: 960px)');
    document.addEventListener('mj:menu', (e) => {
      const open = (e as CustomEvent<{ open: boolean }>).detail.open;
      if (open && small.matches) void crew.enter(pick(2 + Math.floor(Math.random() * 2)));
      else void crew.leave(false);
    });
  }
}
