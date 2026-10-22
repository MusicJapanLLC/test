import { prefersReducedMotion } from './env';

/**
 * presto の世界観（BE.PRESTO など）だけの演出。
 *   ・鐘（[data-ring]）と和音の音。Web Audio で、押したときだけ鳴らす（自動再生しない）
 *   ・鐘が鳴ると、WebGL のシーンへ「bp:ring」を送って波紋を広げる（client/bell.ts）
 *   ・メトロノーム（発信のテンポ）、8小節のスコア（職務×ツール）、速度記号の目盛りの鐘、表紙の傾き
 * 動きを減らす設定でも、音と切り替えは使える（揺れ・振り子・傾きだけ止める）
 */

let ac: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

// 鐘の倍音（整数倍にならない部分音が、鐘らしさになる）：[比率, 音量, 減衰の秒数]
const BELL: [number, number, number][] = [
  [0.5, 0.32, 5],
  [1, 1, 3.6],
  [1.19, 0.42, 2.8],
  [1.5, 0.26, 2.2],
  [2, 0.46, 2],
  [2.51, 0.2, 1.4],
  [2.66, 0.16, 1.2],
  [3.01, 0.14, 1],
  [4.1, 0.08, 0.6],
  [5.43, 0.05, 0.4],
];

function ringBell(freq: number, vel = 1): void {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + 0.01;
  for (const [ratio, amp, decay] of BELL) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * amp * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

/** 和音の一音（やわらかいピアノのような音） */
function softNote(freq: number, delay = 0, len = 2.4): void {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + 0.01 + delay;
  const voices: [number, number, OscillatorType][] = [
    [1, 0.5, 'triangle'],
    [2, 0.12, 'sine'],
    [3, 0.05, 'sine'],
  ];
  for (const [mul, amp, type] of voices) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq * mul;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len / mul);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.05);
  }
}

function flag(el: Element, cls: string, ms: number): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

function setupBells(): void {
  document.querySelectorAll<HTMLElement>('[data-ring]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = Number(btn.dataset.ring) || 523.25;
      ringBell(f, 1);
      flag(btn, 'is-ringing', 1000);
      window.dispatchEvent(new CustomEvent('bp:ring', { detail: { power: btn.classList.contains('pr-seal') ? 1.3 : 0.9 } }));
    });
  });
}

function setupTempo(): void {
  const box = document.querySelector<HTMLElement>('[data-tempo]');
  const raw = box?.querySelector('[data-tempo-data]')?.textContent;
  const range = box?.querySelector<HTMLInputElement>('[data-tempo-range]');
  if (!box || !raw || !range) return;
  const stages = JSON.parse(raw) as { name: string; bpm: number; jp: string; state: string }[];
  const out = box.querySelector<HTMLElement>('.tempo-out');
  const weight = box.querySelector<SVGRectElement>('.m-weight');
  const ticks = [...box.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const field = (k: string) => box.querySelector<HTMLElement>(`[data-t="${k}"]`);
  const last = stages.length - 1;

  const set = (i: number, animate: boolean) => {
    const s = stages[i];
    box.dataset.step = String(i);
    box.style.setProperty('--beat', `${(60 / s.bpm).toFixed(3)}s`);
    box.style.setProperty('--heat', String(i / last));
    // 速いほど、錘は下へ（実物のメトロノームと同じ）
    weight?.style.setProperty('--wy', `${i * 18}px`);
    range.style.setProperty('--fill', `${(i / last) * 100}%`);
    range.setAttribute('aria-valuetext', `${s.name}、四分音符イコール${s.bpm}。${s.state}`);
    const put = (k: string, v: string) => {
      const el = field(k);
      if (el) el.textContent = v;
    };
    put('name', s.name);
    put('bpm', String(s.bpm));
    put('jp', s.jp);
    put('state', s.state);
    // pain・fix はビルド時に文節で区切った <template> を写す
    const copy = (k: string) => {
      const el = field(k);
      const tpl = box.querySelector<HTMLTemplateElement>(`template[data-tt="${k}-${i}"]`);
      if (el && tpl) el.replaceChildren(tpl.content.cloneNode(true));
    };
    copy('pain');
    copy('fix');
    ticks.forEach((t) => t.classList.toggle('is-on', Number(t.dataset.step) === i));
    if (animate && out && !prefersReducedMotion()) flag(out, 'is-swap', 600);
  };
  range.addEventListener('input', () => set(Number(range.value), true));
  ticks.forEach((t) =>
    t.addEventListener('click', () => {
      range.value = t.dataset.step ?? '0';
      set(Number(range.value), true);
    }),
  );
  set(Number(range.value), false);
}

function setupScore(): void {
  const box = document.querySelector<HTMLElement>('[data-score]');
  const raw = box?.querySelector('[data-score-data]')?.textContent;
  if (!box || !raw) return;
  const data = JSON.parse(raw) as {
    common: { office: number[]; field: number[] };
    jobs: { name: string; field?: boolean; parts: number[]; outcomes: number[] }[];
    tools: { name: string; parts: number[] }[];
  };
  // 小節の題と「できるようになること」は、ビルド時に文節で区切った <template> の番号
  const frag = (n: number) => box.querySelector<HTMLTemplateElement>(`template[data-sf="${n}"]`)?.content.cloneNode(true) ?? '';
  let job = 0;
  let tool = 0;
  const cells = [...box.querySelectorAll<HTMLElement>('[data-bar]')];
  const first = data.jobs[0];
  const shown = [...(first.field ? data.common.field : data.common.office), ...first.parts, ...data.tools[0].parts];
  const outcomes = box.querySelector<HTMLElement>('[data-outcomes]');
  const jobName = box.querySelector<HTMLElement>('[data-s="job"]');
  const toolName = box.querySelector<HTMLElement>('[data-s="tool"]');

  const render = () => {
    const j = data.jobs[job];
    const t = data.tools[tool];
    const titles = [...(j.field ? data.common.field : data.common.office), ...j.parts, ...t.parts];
    cells.forEach((c, i) => {
      if (shown[i] === titles[i]) return;
      shown[i] = titles[i];
      c.replaceChildren(frag(titles[i]));
      const bar = c.closest('.bar');
      if (bar && !prefersReducedMotion()) flag(bar, 'is-swap', 700);
    });
    if (outcomes) {
      outcomes.replaceChildren(
        ...j.outcomes.map((o) => {
          const li = document.createElement('li');
          li.append(frag(o));
          return li;
        }),
      );
    }
    if (jobName) jobName.textContent = j.name;
    if (toolName) toolName.textContent = t.name;
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

function setupChord(): void {
  const box = document.querySelector<HTMLElement>('[data-chord]');
  if (!box) return;
  const timers = new Map<string, number>();
  const light = (i: string, ms = 1400) => {
    box.querySelectorAll<HTMLElement>(`[data-note="${i}"]`).forEach((el) => el.classList.add('is-on'));
    window.clearTimeout(timers.get(i));
    timers.set(
      i,
      window.setTimeout(() => box.querySelectorAll<HTMLElement>(`[data-note="${i}"]`).forEach((el) => el.classList.remove('is-on')), ms),
    );
  };
  const heads = [...box.querySelectorAll<HTMLElement>('.cn')];
  heads.forEach((li) => {
    const btn = li.querySelector<HTMLButtonElement>('.nh');
    btn?.addEventListener('click', () => {
      softNote(Number(btn.dataset.pitch));
      light(li.dataset.note ?? '0');
    });
  });
  box.querySelector('[data-chord-all]')?.addEventListener('click', () => {
    heads.forEach((li, i) => {
      const f = Number(li.querySelector<HTMLButtonElement>('.nh')?.dataset.pitch);
      softNote(f, i * 0.09, 3.2);
      window.setTimeout(() => light(li.dataset.note ?? '0', 2400), i * 90);
    });
    // 1オクターブ下のドを足して、和音に厚みを
    softNote(130.81, 0.27, 3.6);
  });
}

/** 速度記号の目盛り：見えたら、鐘が Presto の段まで降りて止まる */
function setupPrologue(): void {
  const box = document.querySelector<HTMLElement>('[data-pro-scale]');
  const pin = box?.querySelector<HTMLElement>('[data-pro-pin]');
  const mark = box?.querySelector<HTMLElement>('[data-pro-mark]');
  if (!box || !pin || !mark) return;
  const place = () => pin.style.setProperty('--pin-y', `${mark.offsetTop + mark.offsetHeight / 2 - 16 + 6}px`);
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    place();
  } else {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        window.setTimeout(place, 250);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(box);
  }
  window.addEventListener('resize', () => pin.style.getPropertyValue('--pin-y') && place(), { passive: true });
}

/** 表紙：マウスの位置で少し傾く（触れる画面・動きを減らす設定では傾けない） */
function setupMag(): void {
  const mag = document.querySelector<HTMLElement>('[data-mag]');
  const inner = mag?.querySelector<HTMLElement>('.mag-in');
  if (!mag || !inner || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
  mag.addEventListener('pointermove', (e) => {
    const r = mag.getBoundingClientRect();
    inner.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`);
    inner.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
  });
  mag.addEventListener('pointerleave', () => {
    inner.style.setProperty('--ry', '0deg');
    inner.style.setProperty('--rx', '0deg');
  });
}

export function setupPresto(): void {
  setupBells();
  setupTempo();
  setupScore();
  setupChord();
  setupPrologue();
  setupMag();
}
