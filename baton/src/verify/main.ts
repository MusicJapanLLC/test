import '../styles/base.css';
import '../styles/service.css';
import '../styles/profile.css';

import { renderFooter } from '../lib/footer';
import { checkVerifyToken, confirmVerify } from '../lib/submit';
import { el } from '../lib/dom';

function getToken(): string {
  return new URLSearchParams(window.location.search).get('t') ?? '';
}

function stateMessage(state: string): { title: string; note: string } {
  switch (state) {
    case 'used':
      return { title: 'このリンクはすでに使用済みです。', note: '認証はすでに完了しています。' };
    case 'expired':
      return {
        title: 'このリンクの有効期限が切れています。',
        note: '24時間以内に認証されなかったため、申請は無効になりました。お手数ですが、もう一度お申し込みください。',
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

  const result = await checkVerifyToken(token);
  if (!result.ok || result.state !== 'ready') {
    renderState(card, stateMessage(!result.ok ? 'invalid' : result.state));
    return;
  }

  renderReady(card, token, result.profileName);
}

function renderState(card: HTMLElement, msg: { title: string; note: string }): void {
  card.replaceChildren(
    el('span', { class: 'action-card__label', text: 'Email Verify' }),
    el('h1', { class: 'action-card__title', text: msg.title }),
    el('p', { class: 'action-card__note', text: msg.note }),
  );
}

function renderReady(card: HTMLElement, token: string, profileName?: string): void {
  const confirmBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    text: '認証を完了する',
  }) as HTMLButtonElement;

  const errorBox = el('p', { class: 'survey__error' });
  errorBox.hidden = true;

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '処理中…';
    const res = await confirmVerify(token);
    if (!res.ok) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '認証を完了する';
      errorBox.textContent = '処理できませんでした。時間をおいて再度お試しください。';
      errorBox.hidden = false;
      return;
    }
    card.replaceChildren(
      el('span', { class: 'action-card__label', text: 'Email Verify' }),
      el('h1', { class: 'action-card__title', text: '認証が完了しました。' }),
      el('p', {
        class: 'action-card__note',
        text: 'ご申請ありがとうございます。相手の方の確認後、結果をメールでお知らせします。',
      }),
    );
  });

  card.replaceChildren(
    el('span', { class: 'action-card__label', text: 'Email Verify' }),
    el('h1', { class: 'action-card__title', text: 'メールアドレスの認証' }),
    el('p', {
      class: 'action-card__note',
      text: profileName
        ? `${profileName}さんへの「話したい」申請を有効にします。よろしければボタンを押してください。`
        : 'この申請を有効にします。よろしければボタンを押してください。',
    }),
    el('div', { class: 'action-card__actions' }, [confirmBtn]),
    errorBox,
  );
}

void boot();
