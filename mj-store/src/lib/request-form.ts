import { games } from '../data/games';
import { REQUEST_TYPES, SEVERITY } from '../render/request';
import { unlock } from './achievements';
import { sfx } from './sound';
import { submitRequest, type RequestPayload } from './submit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function envSummary(): string {
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'その他のブラウザ';
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'その他のOS';
  return `${os} / ${browser} / 画面 ${window.innerWidth}×${window.innerHeight}`;
}

export function initRequestForm(): void {
  const formQ = document.querySelector<HTMLFormElement>('[data-req-form]');
  const ticketQ = document.querySelector<HTMLElement>('[data-ticket]');
  if (!formQ || !ticketQ) return;
  const form: HTMLFormElement = formQ;
  const ticket: HTMLElement = ticketQ;

  const message = form.querySelector<HTMLTextAreaElement>('[data-message]')!;
  const count = form.querySelector<HTMLElement>('[data-count]')!;
  const sevField = form.querySelector<HTMLElement>('[data-severity-field]')!;
  const sev = form.querySelector<HTMLInputElement>('[data-severity]')!;
  const sevOut = form.querySelector<HTMLOutputElement>('[data-severity-out]')!;
  const envField = form.querySelector<HTMLElement>('[data-env-field]')!;
  const envBox = form.querySelector<HTMLInputElement>('[data-env]')!;
  const envPreview = form.querySelector<HTMLElement>('[data-env-preview]')!;
  const msgNo = form.querySelector<HTMLElement>('[data-message-no]')!;
  const error = form.querySelector<HTMLElement>('[data-req-error]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-req-submit]')!;
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]')!;

  const env = envSummary();
  envPreview.textContent = env;

  /* URL で用件と作品を選んだ状態にする（?game=akari-no-tabiji&type=idea） */
  const params = new URLSearchParams(location.search);
  const pre = (name: string, value: string | null) => {
    if (!value) return;
    const input = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value)}"]`);
    if (input) input.checked = true;
  };
  pre('type', params.get('type'));
  pre('game', params.get('game'));

  const currentType = () => (form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value ?? 'bug');

  function syncType() {
    const id = currentType();
    const def = REQUEST_TYPES.find((t) => t.id === id) ?? REQUEST_TYPES[0];
    message.placeholder = def.placeholder;
    const isBug = id === 'bug';
    sevField.hidden = !isBug;
    envField.hidden = !isBug;
    envPreview.hidden = !isBug || !envBox.checked;
    msgNo.textContent = isBug ? '04' : '03';
    form.dataset.type = id;
  }
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input[name="type"]')) syncType();
    if (t === envBox) envPreview.hidden = !envBox.checked;
  });
  syncType();

  const paintSev = () => {
    const v = Number(sev.value);
    sevOut.textContent = SEVERITY[v - 1] ?? '';
    sev.style.setProperty('--v', String((v - 1) / (SEVERITY.length - 1)));
    form.dataset.sev = String(v);
  };
  sev.addEventListener('input', paintSev);
  paintSev();

  message.addEventListener('input', () => {
    count.textContent = String(message.value.length);
    if (error.hidden === false && message.value.trim().length >= 4) error.hidden = true;
  });

  const showError = (text: string) => {
    error.textContent = text;
    error.hidden = false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const data = new FormData(form);
    const text = String(data.get('message') ?? '').trim();
    const contact = String(data.get('contact') ?? '').trim();
    if (text.length < 4) {
      showError('内容を、もう少しだけ詳しく書いてください。');
      message.focus();
      return;
    }
    if (contact && !EMAIL.test(contact)) {
      showError('メールアドレスの形をご確認ください（返信が不要なら空欄で大丈夫です）。');
      form.querySelector<HTMLInputElement>('[name="contact"]')?.focus();
      return;
    }

    const type = currentType();
    const gameSlug = String(data.get('game') ?? 'store');
    const game = games.find((g) => g.slug === gameSlug);
    const no = `MJ-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const payload: RequestPayload = {
      ticket: no,
      timestamp: new Date().toISOString(),
      type,
      typeLabel: REQUEST_TYPES.find((t) => t.id === type)?.label ?? type,
      game: gameSlug,
      gameTitle: game?.title ?? 'MJ STORE（このサイト）',
      severity: type === 'bug' ? (SEVERITY[Number(sev.value) - 1] ?? '') : '',
      message: text,
      name: String(data.get('name') ?? '').trim(),
      contact,
      env: type === 'bug' && envBox.checked ? `${env} / ${navigator.userAgent}` : '',
      page: location.href,
    };

    /* 迷惑送信よけ。人には見えない欄が埋まっていたら、送ったふりだけする */
    const honeypot = String(data.get('website') ?? '');

    submit.disabled = true;
    form.classList.add('is-sending');
    submitLabel.textContent = '届けています…';
    try {
      if (!honeypot) await submitRequest(payload);
      showTicket(payload);
    } catch (err) {
      showError((err as Error).message);
    } finally {
      submit.disabled = false;
      form.classList.remove('is-sending');
      submitLabel.textContent = '開発チームに届ける';
    }
  });

  function showTicket(p: RequestPayload) {
    ticket.querySelector('[data-ticket-no]')!.textContent = `#${p.ticket}`;
    ticket.querySelector('[data-ticket-type]')!.textContent = p.typeLabel;
    ticket.querySelector('[data-ticket-game]')!.textContent = p.gameTitle;
    form.hidden = true;
    ticket.hidden = false;
    requestAnimationFrame(() => ticket.classList.add('is-in'));
    sfx.send();
    unlock('request');
    ticket.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ticket.focus({ preventScroll: true });
  }

  ticket.querySelector('[data-ticket-again]')?.addEventListener('click', () => {
    message.value = '';
    count.textContent = '0';
    ticket.classList.remove('is-in');
    ticket.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
