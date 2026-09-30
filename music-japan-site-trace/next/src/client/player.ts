import { bus, connect } from './bus';
import type { World } from './world';

type Release = {
  id: string; no: string; title: string; artist: string; type: string; description: string;
  href: string; platform: string; art: string; thumb: string; accent: string;
  previews: { title: string; src: string }[]; credit: string;
};

const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

/**
 * The release player: an Apple Music–style "Now Playing" sheet. The disc slides out of
 * the sleeve when it plays; its audio runs through the sound bus so the whole site reacts.
 */
export function setupPlayer(world: World | null) {
  const dlg = document.querySelector<HTMLDialogElement>('[data-player]');
  const dataEl = document.querySelector<HTMLScriptElement>('[data-releases]');
  if (!dlg || !dataEl) return;
  const releases: Release[] = JSON.parse(dataEl.textContent || '[]');
  const labels = JSON.parse(dlg.dataset.labels || '{}') as { play: string; pause: string; listen: string; error: string };
  const q = <T extends Element>(s: string) => dlg.querySelector<T>(s)!;
  const audio = q<HTMLAudioElement>('[data-pl-audio]');
  const playBtn = q<HTMLButtonElement>('[data-pl-play]');
  const seek = q<HTMLInputElement>('[data-pl-seek]');
  const cur = q<HTMLElement>('[data-pl-cur]');
  const dur = q<HTMLElement>('[data-pl-dur]');
  const status = q<HTMLElement>('[data-pl-status]');
  const tracksWrap = q<HTMLElement>('[data-pl-tracks-wrap]');
  const tracks = q<HTMLOListElement>('[data-pl-tracks]');
  const spectrum = q<HTMLCanvasElement>('[data-pl-spectrum]');
  const now = document.querySelector<HTMLElement>('[data-now]');
  let index = 0;
  let track = 0;
  let opener: HTMLElement | null = null;
  let raf = 0;

  const setPlaying = (on: boolean) => {
    bus.playing = on;
    dlg.classList.toggle('is-playing', on);
    document.documentElement.classList.toggle('is-audio', on);
    playBtn.setAttribute('aria-label', on ? labels.pause : labels.play);
    if (now) now.textContent = on ? `NOW SPINNING — ${releases[index].no} ${releases[index].title}` : 'NOW SPINNING — MJ-000';
  };

  const load = (i: number, t = 0) => {
    index = (i + releases.length) % releases.length;
    track = t;
    const r = releases[index];
    dlg.style.setProperty('--accent', r.accent);
    q<HTMLElement>('[data-pl-bg]').style.backgroundImage = `url(${r.thumb})`;
    q<HTMLElement>('[data-pl-label]').style.backgroundImage = `url(${r.thumb})`;
    const img = q<HTMLImageElement>('[data-pl-img]');
    img.src = r.art;
    img.alt = `${r.title} — ${r.artist}`;
    q<HTMLElement>('[data-pl-no]').textContent = r.no;
    q<HTMLElement>('[data-pl-type]').textContent = r.type;
    q<HTMLElement>('[data-pl-title]').textContent = r.title;
    q<HTMLElement>('[data-pl-artist]').textContent = r.artist;
    q<HTMLElement>('[data-pl-desc]').textContent = r.description;
    q<HTMLElement>('[data-pl-credit]').textContent = r.credit;
    const link = q<HTMLAnchorElement>('[data-pl-link]');
    link.href = r.href;
    link.querySelector('.btn-label')!.textContent = labels.listen.replace('%s', r.platform);
    tracksWrap.hidden = r.previews.length < 2;
    tracks.innerHTML = '';
    r.previews.forEach((p, k) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.title;
      b.setAttribute('aria-current', String(k === track));
      b.addEventListener('click', () => { load(index, k); void play(); });
      li.append(b);
      tracks.append(li);
    });
    audio.src = r.previews[track].src;
    seek.value = '0';
    cur.textContent = '0:00';
    dur.textContent = '0:30';
    status.textContent = '';
    bus.accent = r.accent;
    world?.setAccent(r.accent);
    setPlaying(false);
  };

  const play = async () => {
    await connect(audio);
    try {
      await audio.play();
    } catch {
      status.textContent = labels.error;
    }
  };

  const draw = () => {
    raf = requestAnimationFrame(draw);
    const g = spectrum.getContext('2d');
    if (!g) return;
    const w = (spectrum.width = spectrum.clientWidth * devicePixelRatio);
    const h = (spectrum.height = spectrum.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, w, h);
    const bars = 48;
    const bw = w / bars;
    const accent = getComputedStyle(dlg).getPropertyValue('--accent') || '#e1222f';
    for (let i = 0; i < bars; i++) {
      const v = bus.playing ? bus.spectrum[Math.floor((i / bars) * bus.spectrum.length * 0.7)] / 255 : 0.04 + 0.03 * Math.sin(performance.now() / 600 + i * 0.5);
      const bh = Math.max(2, v * h);
      g.fillStyle = i % 6 === 0 ? accent : 'rgba(239,233,224,.78)';
      g.fillRect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh);
    }
  };

  const open = (id: string, from: HTMLElement | null) => {
    const i = releases.findIndex((r) => r.id === id);
    if (i < 0) return;
    opener = from;
    load(i);
    dlg.showModal();
    // keep the character on stage (dialogs live in the top layer)
    const buddy = document.querySelector('.buddy');
    if (buddy) dlg.append(buddy);
    document.documentElement.classList.add('is-player');
    cancelAnimationFrame(raf);
    draw();
    void play();
  };

  const close = () => {
    audio.pause();
    dlg.close();
  };

  dlg.addEventListener('close', () => {
    audio.pause();
    setPlaying(false);
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove('is-player');
    const buddy = dlg.querySelector('.buddy');
    if (buddy) document.body.append(buddy);
    world?.setAccent('#e1222f');
    opener?.focus();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  q('[data-pl-close]').addEventListener('click', close);
  playBtn.addEventListener('click', () => { if (audio.paused) void play(); else audio.pause(); });
  q('[data-pl-prev]').addEventListener('click', () => { load(index - 1); void play(); });
  q('[data-pl-next]').addEventListener('click', () => { load(index + 1); void play(); });
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => {
    const r = releases[index];
    if (track < r.previews.length - 1) { load(index, track + 1); void play(); } else setPlaying(false);
  });
  audio.addEventListener('error', () => { if (audio.src) status.textContent = labels.error; });
  audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    cur.textContent = fmt(audio.currentTime);
    if (audio.duration) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    seek.style.setProperty('--p', `${Number(seek.value) / 10}%`);
  });
  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration; });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      playBtn.click();
    }
    if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) q<HTMLButtonElement>('[data-pl-next]').click();
    if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) q<HTMLButtonElement>('[data-pl-prev]').click();
  });

  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-open-release]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.openRelease!, b);
  });
}
