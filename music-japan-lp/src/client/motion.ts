import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { clamp, ease } from './env';
import { scramble, splitChars } from './text-fx';

gsap.registerPlugin(ScrollTrigger);

export let lenis: Lenis | null = null;

export type ScrollState = {
  chapter: number;
  grow: number;
  build: number;
  beam: number;
  wave: number;
  hiPage: number;
};

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));

export function setupSmooth(reduced: boolean) {
  if (reduced) return;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false, anchors: { offset: -10 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // ページ内リンク（ヘッダー・メニュー・目盛り）も、なめらかに
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href')!;
    const target = id === '#top' ? 0 : document.querySelector<HTMLElement>(id);
    if (target === null) return;
    e.preventDefault();
    lenis?.scrollTo(target as HTMLElement | number, { offset: 0, duration: 1.6 });
    (document.getElementById('menu') as HTMLElement & { hidePopover?: () => void })?.hidePopover?.();
  });
}

/** 見出しは1文字ずつ下から、本文はふわっと。生成り・赤の面は角の丸い紙のようにせり上がる */
export function reveals(reduced: boolean) {
  splitChars();
  if (reduced) {
    $$('[data-reveal], .stage, .after-step, .serp').forEach((el) => el.classList.add('is-in'));
    return;
  }
  $$('[data-split]').forEach((h) => {
    if (h.closest('.hero')) return;
    const chars = $$('.c', h);
    gsap.set(chars, { yPercent: 118, rotate: 5 });
    ScrollTrigger.create({
      trigger: h,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: Math.min(0.028, 0.9 / chars.length) }),
    });
  });
  $$('[data-reveal]').forEach((el) => {
    gsap.set(el, { y: 36, opacity: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', delay: Number(getComputedStyle(el).getPropertyValue('--i') || 0) * 0.06 }),
    });
  });
  $$('.kicker-txt[data-scramble]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => scramble(el, undefined, 800) });
  });
  $$('.kicker-rule').forEach((el) => {
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
  for (const sel of ['.stage', '.after-step', '.serp']) {
    $$(sel).forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => el.classList.add('is-in') }));
  }
  // 生成り・赤の面が、下から角の丸い紙のように入ってくる
  $$('.sec[data-air="paper"], .sec[data-air="red"]').forEach((sec) => {
    gsap.fromTo(
      sec,
      { '--clip-t': '9vh', '--clip-x': '4.5vw', '--clip-r': '46px' },
      { '--clip-t': '0vh', '--clip-x': '0vw', '--clip-r': '0px', ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 25%', scrub: true } },
    );
  });
  // 数字のカウントアップ
  $$('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'expo.out', onUpdate: () => (el.textContent = String(Math.round(o.v))) }),
    });
  });
}

/** 最初の画面の入場（導入が終わったら） */
export function heroIn(reduced: boolean) {
  const hero = $('.hero');
  if (!hero) return;
  const chars = $$('.hero-title .c', hero);
  const parts = $$('[data-hero-in]', hero);
  if (reduced) return;
  gsap.set(chars, { yPercent: 120, rotate: 6 });
  gsap.set(parts, { y: 30, opacity: 0 });
  gsap.set('.hero-kicker, .hero-ease', { opacity: 0, y: 16 });
  const tl = gsap.timeline({ delay: 0.05 });
  tl.to('.hero-kicker', { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' })
    .to(parts[0], { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, '<0.05')
    .to(chars, { yPercent: 0, rotate: 0, duration: 1.25, ease: 'expo.out', stagger: 0.022 }, '<0.1')
    .to(parts.slice(1), { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, '-=0.9')
    .to('.hero-ease', { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, '-=0.8');
}

/**
 * スクロール位置から、WebGLのかたち（chapter）・線の伸び・横スクロールの位置などを毎フレーム計算する。
 * chapter は、隣り合うセクションの境目が画面を通り過ぎるあいだに、data-ch の値へなめらかに移る。
 */
export function scrollState(opts: { reduced: boolean; desktop: boolean; onBuild: (p: number, idx: number) => void }) {
  const st: ScrollState = { chapter: 0, grow: 0, build: 0, beam: 0, wave: 0, hiPage: -1 };
  const secs = $$('main > section[data-ch]');
  const eco = $('#ecosystem');
  const talk = $('#talk');
  const st8 = $('#second-take');
  const relay = $('[data-relay]');
  const relayBaton = $('[data-relay-baton]');
  const thread = $('.what-thread');
  const bpDisplay = $('[data-stretch]');

  // エコシステム：大きな画面では固定して、線が順に生えるのを見せる
  if (eco) {
    const stage = $('.eco-stage', eco)!;
    // 1画面に収まるときだけ固定する（収まらない高さの画面では、ふつうに流す）
    if (opts.desktop && !opts.reduced && stage.offsetHeight <= window.innerHeight + 4) {
      ScrollTrigger.create({ trigger: eco, start: 'top top', end: '+=130%', pin: stage, pinSpacing: true, anticipatePin: 1 });
    }
  }

  // 一社のページができるまで：横に流れる
  const track = $('[data-build-track]');
  const pin = $('.build-pin');
  if (track && pin && !opts.reduced) {
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${dist() + window.innerHeight * 0.3}`,
        pin: true,
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          st.build = self.progress;
          opts.onBuild(self.progress, Math.min(7, Math.round(self.progress * 7.4)));
        },
      },
    });
  }

  const update = () => {
    const vh = window.innerHeight;
    let ch = Number(secs[0]?.dataset.ch ?? 0);
    for (let i = 1; i < secs.length; i++) {
      const prev = Number(secs[i - 1].dataset.ch);
      const cur = Number(secs[i].dataset.ch);
      if (cur === prev) continue;
      const top = secs[i].getBoundingClientRect().top;
      const p = clamp((vh * 0.9 - top) / (vh * 0.75));
      ch += (cur - prev) * ease(p);
    }
    st.chapter = ch;
    if (eco) {
      const r = eco.getBoundingClientRect();
      const span = Math.max(1, r.height - vh * (opts.desktop ? 0.6 : 0.2));
      st.grow = clamp((vh * 0.55 - r.top) / span) * 1.25;
    }
    if (talk) {
      const r = talk.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh * 1.0));
      st.beam = ease(clamp((p - 0.3) / 0.55));
    }
    if (st8) {
      const r = st8.getBoundingClientRect();
      st.wave = clamp(1 - Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.9));
    }
    if (relay && relayBaton) {
      const r = relay.getBoundingClientRect();
      relayBaton.style.setProperty('--p', String(clamp((vh * 0.85 - r.top) / (r.height + vh * 0.25))));
    }
    if (thread) {
      const r = thread.getBoundingClientRect();
      thread.style.setProperty('--draw', String(1 - clamp((vh - r.top) / (vh * 0.8))));
    }
    if (bpDisplay) {
      const r = bpDisplay.getBoundingClientRect();
      bpDisplay.style.setProperty('--wdth', String(62 + 63 * ease(clamp((vh - r.top) / (vh * 0.75)))));
    }
  };
  return { st, update };
}

/** ヘッダーの色、ページの地の色、右端の目盛り、手元の「話してみる」 */
export function chrome() {
  const html = document.documentElement;
  const secs = $$('main > section');
  const rails = $$('[data-rail-link]');
  const navs = $$('[data-nav]');
  const float = $('[data-float]');
  const talk = $('#talk');
  let lastAir = '';
  let lastHd = '';
  return () => {
    const vh = window.innerHeight;
    let hd = 'ink';
    let air = 'ink';
    let rail = '01';
    let navId = '';
    for (const s of secs) {
      const r = s.getBoundingClientRect();
      if (r.top <= 40 && r.bottom > 40) hd = s.dataset.air ?? 'ink';
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) air = s.dataset.air ?? 'ink';
      if (r.top <= vh * 0.5 && s.dataset.rail) rail = s.dataset.rail;
      if (r.top <= vh * 0.5) navId = s.id;
    }
    if (hd !== lastHd) {
      html.dataset.hd = hd === 'paper' ? 'paper' : hd === 'red' ? 'red' : 'ink';
      lastHd = hd;
    }
    if (air !== lastAir) {
      html.dataset.air = air;
      lastAir = air;
    }
    rails.forEach((a) => a.classList.toggle('is-on', a.dataset.railLink === rail));
    navs.forEach((a) => a.classList.toggle('is-current', a.dataset.nav === navId || (navId.length > 0 && a.dataset.nav === groupOf(navId))));
    html.classList.toggle('is-scrolled', window.scrollY > 40);
    if (float) {
      const t = talk?.getBoundingClientRect();
      float.classList.toggle('is-on', window.scrollY > vh * 0.85 && !(t && t.top < vh * 0.7));
    }
  };
}

const GROUPS: Record<string, string> = { anatomy: 'partners', world: 'partners', after: 'partners', origin: 'partners', build: 'partners', faq: 'about', talk: 'about' };
const groupOf = (id: string) => GROUPS[id] ?? id;

export { ScrollTrigger, gsap };
