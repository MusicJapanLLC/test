/* Uses the browser's built-in voices (free, no plugin). Quality depends on the device; iPhone and Chrome are good. */
import { state } from './store';

let voice: SpeechSynthesisVoice | null = null;
const PREFERRED = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex', 'Aaron', 'Nicky', 'Ava', 'Allison'];

function pick() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
  voice = PREFERRED.map((n) => vs.find((v) => v.name.includes(n))).find(Boolean) ?? vs.find((v) => v.localService) ?? vs[0] ?? null;
}
if ('speechSynthesis' in window) {
  pick();
  speechSynthesis.addEventListener?.('voiceschanged', pick);
}

export const canSpeak = () => 'speechSynthesis' in window;

export function speak(text: string, opts: { rate?: number; onend?: () => void } = {}) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const clean = text.replace(/[“”"]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/~|…/g, ' ');
  const u = new SpeechSynthesisUtterance(clean);
  if (voice) u.voice = voice;
  u.lang = 'en-US';
  u.rate = opts.rate ?? state.settings.rate;
  if (opts.onend) u.onend = opts.onend;
  speechSynthesis.speak(u);
}

export function speakLines(lines: string[]) {
  if (!canSpeak()) return;
  let i = 0;
  const next = () => { if (i < lines.length) speak(lines[i++], { onend: next }); };
  next();
}

export const hush = () => { if (canSpeak()) speechSynthesis.cancel(); };
