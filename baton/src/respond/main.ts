import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { renderFooter } from '../lib/footer';
import { checkRespondToken, submitRespondAction, type RespondCheckResult } from '../lib/submit';
import { el } from '../lib/dom';

function getToken(): string {
  return new URLSearchParams(window.location.search).get('t') ?? '';
}

function stateMessage(state: string): { title: string; note: string } {
  switch (state) {
    case 'used':
      return { title: 'この申請はすでに回答済みです。', note: 'ご回答ありがとうございました。' };
    case 'expired':
      return {
        title: 'この申請の回答期限が切れています。',
        note: '7日間ご回答がなかったため、この申請は終了しました。',
      };
    default:
      return {
        title: 'このリンクは無効です。',
        note: 'URLをご確認ください。届いたメールのリンクをそのままお使いください。',
      };
  }
}

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  const footer = document.getElementById('footer');
  if (!app || !footer) return;

  renderFooter(footer);

  const card = el('div', { class: 'action-card' });
  const section = el('section', { class: 'action-page' }, [el('div', { class: 'wrap' }, [card])]);
  app.append(section);

  const token = getToken();
  if (!token) {
    renderState(card, stateMessage('invalid'));
    return;
  }

  card.append(el('p', { text: 'ご確認しています…' }));

  const result = await checkRespondToken(token);
  if (!result.ok || result.state !== 'ready' || !result.request) {
    renderState(card, stateMessage(!result.ok ? 'invalid' : result.state));
    return;
  }

  renderReady(card, token, result);
}

function renderState(card: HTMLElement, msg: { title: string; note: string }): void {
  card.replaceChildren(
    el('span', { class: 'action-card__label', text: 'Recipient' }),
    el('h1', { class: 'action-card__title', text: msg.title }),
    el('p', { class: 'action-card__note', text: msg.note }),
  );
}

function renderReady(card: HTMLElement, token: string, result: RespondCheckResult): void {
  const req = result.request!;

  const approveBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    text: '話してもいい（承認する）',
  }) as HTMLButtonElement;

  const declineBtn = el('button', {
    type: 'button',
    class: 'btn btn--decline',
    text: '今回は見送る（辞退する）',
  }) as HTMLButtonElement;

  const errorBox = el('p', { class: 'survey__error' });
  errorBox.hidden = true;

  async function act(decision: 'approved' | 'declined'): Promise<void> {
    approveBtn.disabled = true;
    declineBtn.disabled = true;
    const res = await submitRespondAction(token, decision);
    if (!res.ok) {
      approveBtn.disabled = false;
      declineBtn.disabled = false;
      errorBox.textContent = '処理できませんでした。時間をおいて再度お試しください。';
      errorBox.hidden = false;
      return;
    }

    card.replaceChildren(
      el('span', { class: 'action-card__label', text: 'Recipient' }),
      el('h1', {
        class: 'action-card__title',
        text: decision === 'approved' ? 'ご回答ありがとうございました。' : '承知しました。',
      }),
      el('p', {
        class: 'action-card__note',
        text:
          decision === 'approved'
            ? 'Music Japanより、あらためてご紹介方法についてご連絡します。'
            : '今回の申請はここで終了します。ご連絡ありがとうございました。',
      }),
    );
  }

  approveBtn.addEventListener('click', () => void act('approved'));
  declineBtn.addEventListener('click', () => void act('declined'));

  card.replaceChildren(
    el('span', { class: 'action-card__label', text: 'Recipient' }),
    el('h1', { class: 'action-card__title', text: `${result.profileName ?? 'あなた'}様へ、話したい方がいます` }),
    el('p', { class: 'action-card__note', text: 'ご本人の意思を確認してから、Music Japanが紹介します。' }),
    el('dl', {}, [
      el('dt', { text: '氏名・会社・役職' }),
      el('dd', { text: `${req.applicantName} / ${req.applicantCompany} / ${req.applicantTitle || '(未記入)'}` }),
      el('dt', { text: '目的' }),
      el('dd', { text: req.purpose }),
      el('dt', { text: 'コメント' }),
      el('dd', { text: req.comment }),
      req.note ? el('dt', { text: '補足' }) : null,
      req.note ? el('dd', { text: req.note }) : null,
    ]),
    el('div', { class: 'action-card__actions' }, [approveBtn, declineBtn]),
    errorBox,
  );
}

void boot();
