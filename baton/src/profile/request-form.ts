import { trackTalkRequestSubmit } from '../lib/analytics';
import { append, el } from '../lib/dom';
import { submitTalkRequest, type TalkRequestPayload } from '../lib/submit';
import { TALK_PURPOSES, type TalkProfile } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type State = {
  purpose: string;
  name: string;
  company: string;
  title: string;
  email: string;
  comment: string;
  note: string;
  hp: string;
};

/**
 * 「この人と話したい」申請フォーム。
 * アンケート（survey.ts）とは別モジュール。1枚のカードで完結させ、
 * 送信後は「メールをご確認ください」で終わる（この場では何も確定しない）。
 */
export function renderRequestForm(mount: HTMLElement, profile: TalkProfile): void {
  const state: State = {
    purpose: '',
    name: '',
    company: '',
    title: '',
    email: '',
    comment: '',
    note: '',
    hp: '',
  };

  let sending = false;
  const card = el('div', { class: 'survey__stage' });
  mount.append(card);

  function fieldRow(opts: {
    id: string;
    label: string;
    required: boolean;
    type?: string;
    multiline?: boolean;
    onInput: (value: string) => void;
  }): { wrap: HTMLElement; validate: () => boolean } {
    const wrap = el('div', { class: 'field' });
    const inputId = `talk-${profile.id}-${opts.id}`;
    const label = el('label', { for: inputId, text: opts.label });
    label.append(
      el('span', {
        class: opts.required ? 'field__req' : 'field__opt',
        text: opts.required ? '必須' : '任意',
      }),
    );

    const control = opts.multiline
      ? (el('textarea', { id: inputId, rows: 3 }) as HTMLTextAreaElement)
      : (el('input', {
          id: inputId,
          type: opts.type ?? 'text',
          autocomplete: opts.type === 'email' ? 'email' : 'off',
        }) as HTMLInputElement);

    const error = el('p', { class: 'field__error' });

    const validate = (): boolean => {
      const value = control.value.trim();
      let message = '';
      if (opts.required && !value) message = '入力してください';
      else if (opts.type === 'email' && value && !EMAIL_RE.test(value)) {
        message = 'メールアドレスの形式をご確認ください';
      }
      error.textContent = message;
      wrap.classList.toggle('is-invalid', Boolean(message));
      return !message;
    };

    control.addEventListener('input', () => {
      opts.onInput(control.value);
      if (wrap.classList.contains('is-invalid')) validate();
    });

    wrap.append(label, control, error);
    return { wrap, validate };
  }

  // ── 目的 ──────────────────────────────────────────────
  const purposeOptions = el('div', { class: 'survey__options purpose-grid' });
  TALK_PURPOSES.forEach((purpose) => {
    const button = el('button', {
      type: 'button',
      class: 'opt',
      'aria-pressed': 'false',
    }) as HTMLButtonElement;
    button.append(el('span', { class: 'opt__mark', 'aria-hidden': 'true' }), el('span', { text: purpose }));

    button.addEventListener('click', () => {
      state.purpose = purpose;
      purposeOptions.querySelectorAll('.opt').forEach((o) => {
        o.classList.remove('is-selected');
        o.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
      syncSubmit();
    });

    purposeOptions.append(button);
  });

  // ── 入力欄 ────────────────────────────────────────────
  const nameField = fieldRow({ id: 'name', label: 'お名前', required: true, onInput: (v) => (state.name = v) });
  const companyField = fieldRow({
    id: 'company',
    label: '会社名',
    required: true,
    onInput: (v) => (state.company = v),
  });
  const titleField = fieldRow({ id: 'title', label: '役職', required: false, onInput: (v) => (state.title = v) });
  const emailField = fieldRow({
    id: 'email',
    label: 'メールアドレス',
    required: true,
    type: 'email',
    onInput: (v) => (state.email = v),
  });
  const commentField = fieldRow({
    id: 'comment',
    label: 'なぜ話したいか、ひとことお願いします',
    required: true,
    multiline: true,
    onInput: (v) => (state.comment = v),
  });
  const noteField = fieldRow({
    id: 'note',
    label: '補足（URLなど）',
    required: false,
    multiline: true,
    onInput: (v) => (state.note = v),
  });

  // ハニーポット。人には見えない欄で、埋まっていたらボット扱いにする
  const honeypot = el('input', {
    type: 'text',
    class: 'hp-field',
    tabindex: -1,
    autocomplete: 'off',
    'aria-hidden': 'true',
  }) as HTMLInputElement;
  honeypot.addEventListener('input', () => (state.hp = honeypot.value));

  const submitBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    text: '確認メールを送る',
  }) as HTMLButtonElement;

  const errorBox = el('p', { class: 'survey__error' });
  errorBox.hidden = true;

  function syncSubmit(): void {
    submitBtn.disabled = !state.purpose || sending;
  }
  syncSubmit();

  async function send(): Promise<void> {
    const rows = [nameField, companyField, emailField, commentField];
    const ok = rows.map((r) => r.validate()).every(Boolean) && Boolean(state.purpose);
    if (!ok) {
      card.querySelector<HTMLElement>('.field.is-invalid input, .field.is-invalid textarea')?.focus();
      if (!state.purpose) {
        errorBox.textContent = '目的を選んでください。';
        errorBox.hidden = false;
      }
      return;
    }

    sending = true;
    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitBtn.replaceChildren(
      el('span', { class: 'survey__spinner', 'aria-hidden': 'true' }),
      el('span', { text: '送信中' }),
    );

    const payload: TalkRequestPayload = {
      profileId: profile.id,
      applicant: {
        name: state.name.trim(),
        company: state.company.trim(),
        title: state.title.trim(),
        email: state.email.trim(),
      },
      purpose: state.purpose,
      comment: state.comment.trim(),
      note: state.note.trim(),
      hp: state.hp,
    };

    try {
      const result = await submitTalkRequest(payload);
      if (!result.ok) {
        throw new Error(
          result.error === 'duplicate'
            ? 'このプロフィールには、すでに申請済みです。認証メールが届いていないか確認してください。'
            : result.message || '送信できませんでした。もう一度お試しください。',
        );
      }
      trackTalkRequestSubmit(profile.id);
      card.replaceChildren(doneCard());
    } catch (err) {
      sending = false;
      submitBtn.replaceChildren(document.createTextNode('確認メールを送る'));
      syncSubmit();
      errorBox.textContent = (err as Error).message;
      errorBox.hidden = false;
    }
  }

  submitBtn.addEventListener('click', send);

  append(card, [
    el('p', { class: 'survey__count', text: 'STEP 1' }),
    el('h3', { class: 'survey__question', text: '目的を選んでください' }),
    purposeOptions,
    el('p', { class: 'survey__count', text: 'STEP 2' }),
    el('div', { class: 'survey__fields' }, [
      nameField.wrap,
      companyField.wrap,
      titleField.wrap,
      emailField.wrap,
      commentField.wrap,
      noteField.wrap,
    ]),
    honeypot,
    errorBox,
    el('div', { class: 'survey__nav' }, [el('span'), submitBtn]),
  ]);
}

function doneCard(): HTMLElement {
  const step = el('div', { class: 'survey__step done' });
  const mark = el('div', { class: 'done__mark', 'aria-hidden': 'true' });
  mark.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  append(step, [
    mark,
    el('p', { class: 'done__title', text: 'ご入力のメールアドレスに、確認メールを送りました。' }),
    el('p', {
      class: 'survey__hint',
      text: 'メール内のリンクから認証を完了すると、申請が有効になります（24時間以内）。',
    }),
  ]);

  return step;
}
