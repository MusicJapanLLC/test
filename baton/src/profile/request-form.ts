import { trackTalkRequestSubmit } from '../lib/analytics';
import { append, el } from '../lib/dom';
import { gsap, prefersReducedMotion } from '../lib/motion';
import { submitTalkRequest, type TalkAttachment, type TalkRequestPayload } from '../lib/submit';
import { TALK_PURPOSES, type TalkProfile } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

type State = {
  purposes: string[];
  name: string;
  company: string;
  title: string;
  email: string;
  comment: string;
  note: string;
  hp: string;
  files: TalkAttachment[];
};

/**
 * 「この人と話したい」申請フォーム。
 * 昔のアンケート（survey.ts）と同じ、カード送り式の3ステップにする。
 * 送信後は「メールをご確認ください」で終わる（この場では何も確定しない）。
 */
export function renderRequestForm(mount: HTMLElement, profile: TalkProfile): void {
  const totalSteps = 3;
  const state: State = {
    purposes: [],
    name: '',
    company: '',
    title: '',
    email: '',
    comment: '',
    note: '',
    hp: '',
    files: [],
  };

  let index = 0;
  let sending = false;

  const bar = el('div', { class: 'survey__bar' });
  const progress = el(
    'div',
    {
      class: 'survey__progress',
      role: 'progressbar',
      'aria-label': '入力の進み具合',
      'aria-valuemin': 0,
      'aria-valuemax': totalSteps,
      'aria-valuenow': 0,
    },
    [bar],
  );

  const stage = el('div', { class: 'survey__stage' });
  mount.append(progress, stage);

  const setProgress = (done: number) => {
    bar.style.transform = `scaleX(${Math.max(Math.min(done / totalSteps, 1), 0.04)})`;
    progress.setAttribute('aria-valuenow', String(done));
  };

  function swap(next: HTMLElement): void {
    const current = stage.firstElementChild as HTMLElement | null;

    if (!current || prefersReducedMotion()) {
      stage.replaceChildren(next);
      focusFirst(next);
      return;
    }

    const from = stage.getBoundingClientRect().height;
    current.classList.add('is-leaving');

    window.setTimeout(() => {
      stage.style.height = `${from}px`;
      stage.replaceChildren(next);
      const to = next.getBoundingClientRect().height + parseFloat(getComputedStyle(stage).paddingTop) * 2;
      gsap.to(stage, {
        height: to,
        duration: 0.42,
        ease: 'power2.out',
        onComplete: () => {
          stage.style.height = '';
        },
      });
      focusFirst(next);
    }, 220);
  }

  function focusFirst(scope: HTMLElement): void {
    const target = scope.querySelector<HTMLElement>(
      'button:not([disabled]), input, select, textarea',
    );
    target?.focus({ preventScroll: true });
  }

  function goTo(next: number): void {
    index = Math.max(0, Math.min(next, totalSteps - 1));
    setProgress(index);
    swap(buildStep());
  }

  function backButton(): HTMLElement {
    const button = el('button', { type: 'button', class: 'btn btn--ghost', text: '← 戻る' }) as HTMLButtonElement;
    button.hidden = index === 0;
    button.addEventListener('click', () => goTo(index - 1));
    return button;
  }

  // ── STEP 1: 目的（複数選択） ─────────────────────────────
  function purposeStep(): HTMLElement {
    const step = el('div', { class: 'survey__step' });
    const selected = new Set(state.purposes);
    const options = el('div', { class: 'survey__options' });

    const nextBtn = el('button', { type: 'button', class: 'btn btn--primary', text: '次へ' }) as HTMLButtonElement;
    const syncNext = () => {
      nextBtn.disabled = selected.size === 0;
    };

    TALK_PURPOSES.forEach((purpose) => {
      const button = el('button', {
        type: 'button',
        class: 'opt opt--multi',
        'aria-pressed': selected.has(purpose) ? 'true' : 'false',
      }) as HTMLButtonElement;
      button.append(el('span', { class: 'opt__mark', 'aria-hidden': 'true' }), el('span', { text: purpose }));
      if (selected.has(purpose)) button.classList.add('is-selected');

      button.addEventListener('click', () => {
        if (selected.has(purpose)) selected.delete(purpose);
        else selected.add(purpose);
        button.classList.toggle('is-selected', selected.has(purpose));
        button.setAttribute('aria-pressed', selected.has(purpose) ? 'true' : 'false');
        state.purposes = Array.from(selected);
        syncNext();
      });

      options.append(button);
    });

    nextBtn.addEventListener('click', () => goTo(index + 1));
    syncNext();

    append(step, [
      el('p', { class: 'survey__count', text: `STEP ${index + 1} / ${totalSteps}` }),
      el('h3', { class: 'survey__question', text: '目的を選んでください' }),
      el('p', { class: 'survey__hint', text: 'あてはまるものをすべて選べます' }),
      options,
      el('div', { class: 'survey__nav' }, [el('span'), nextBtn]),
    ]);

    return step;
  }

  // ── 入力欄の共通部品 ──────────────────────────────────
  function fieldRow(opts: {
    id: string;
    label: string;
    required: boolean;
    type?: string;
    multiline?: boolean;
    hint?: string;
    onInput: (value: string) => void;
    initial: string;
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
    control.value = opts.initial;

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
    if (opts.hint) wrap.append(el('p', { class: 'survey__hint', text: opts.hint }));
    return { wrap, validate };
  }

  // ── STEP 2: 氏名・会社名・役職・メール ───────────────────
  function fieldsStep(): HTMLElement {
    const step = el('div', { class: 'survey__step' });

    const nameField = fieldRow({
      id: 'name',
      label: 'お名前',
      required: true,
      initial: state.name,
      onInput: (v) => (state.name = v),
    });
    const companyField = fieldRow({
      id: 'company',
      label: '会社名',
      required: true,
      initial: state.company,
      onInput: (v) => (state.company = v),
    });
    const titleField = fieldRow({
      id: 'title',
      label: '役職',
      required: false,
      initial: state.title,
      onInput: (v) => (state.title = v),
    });
    const emailField = fieldRow({
      id: 'email',
      label: 'メールアドレス',
      required: true,
      type: 'email',
      initial: state.email,
      onInput: (v) => (state.email = v),
    });

    const rows = [nameField, companyField, titleField, emailField];
    const nextBtn = el('button', { type: 'button', class: 'btn btn--primary', text: '次へ' }) as HTMLButtonElement;

    nextBtn.addEventListener('click', () => {
      const ok = [nameField, companyField, emailField].map((r) => r.validate()).every(Boolean);
      if (!ok) {
        step.querySelector<HTMLElement>('.field.is-invalid input, .field.is-invalid textarea')?.focus();
        return;
      }
      goTo(index + 1);
    });

    append(step, [
      el('p', { class: 'survey__count', text: `STEP ${index + 1} / ${totalSteps}` }),
      el('h3', { class: 'survey__question', text: 'ご連絡先を教えてください' }),
      el('div', { class: 'survey__fields' }, rows.map((r) => r.wrap)),
      el('div', { class: 'survey__nav' }, [backButton(), nextBtn]),
    ]);

    return step;
  }

  // ── 資料添付（最大3件） ───────────────────────────────
  function fileField(): HTMLElement {
    const wrap = el('div', { class: 'field file-field' });
    const label = el('label', { text: '資料を添付' });
    label.append(el('span', { class: 'field__opt', text: '任意' }));

    const list = el('div', { class: 'file-list' });
    const errorBox = el('p', { class: 'field__error' });
    const hint = el('p', { class: 'file-hint', text: `最大${MAX_FILES}件・1件あたり8MBまで（PDF・画像・Office資料など）` });

    const input = el('input', {
      type: 'file',
      accept: '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg',
    }) as HTMLInputElement;

    function renderList(): void {
      list.replaceChildren(
        ...state.files.map((f, i) =>
          el('div', { class: 'file-item' }, [
            el('span', { class: 'file-item__name', text: f.name }),
            (() => {
              const btn = el('button', { type: 'button', class: 'file-item__remove', text: '削除' }) as HTMLButtonElement;
              btn.addEventListener('click', () => {
                state.files.splice(i, 1);
                renderList();
              });
              return btn;
            })(),
          ]),
        ),
      );
      input.disabled = state.files.length >= MAX_FILES;
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      errorBox.textContent = '';
      if (state.files.length >= MAX_FILES) {
        errorBox.textContent = `添付は${MAX_FILES}件までです`;
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        errorBox.textContent = 'このファイルは8MBを超えています';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const base64 = result.slice(result.indexOf(',') + 1);
        state.files.push({ name: file.name, mimeType: file.type || 'application/octet-stream', data: base64 });
        renderList();
      };
      reader.onerror = () => {
        errorBox.textContent = '読み込みに失敗しました。もう一度お試しください。';
      };
      reader.readAsDataURL(file);
    });

    renderList();
    wrap.append(label, list, input, hint, errorBox);
    return wrap;
  }

  // ── STEP 3: ひとこと・備考・資料・送信 ───────────────────
  function finalStep(): HTMLElement {
    const step = el('div', { class: 'survey__step' });

    const commentField = fieldRow({
      id: 'comment',
      label: 'ひとことコメント',
      required: true,
      multiline: true,
      initial: state.comment,
      onInput: (v) => (state.comment = v),
    });
    const noteField = fieldRow({
      id: 'note',
      label: '備考（ポートフォリオなど）',
      required: false,
      multiline: true,
      initial: state.note,
      onInput: (v) => (state.note = v),
    });

    // ハニーポット。人には見えない欄で、埋まっていたらスパム扱いにする
    const honeypot = el('input', {
      type: 'text',
      class: 'hp-field',
      tabindex: -1,
      autocomplete: 'off',
      'aria-hidden': 'true',
    }) as HTMLInputElement;
    honeypot.addEventListener('input', () => (state.hp = honeypot.value));

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary', text: '確認メールを送る' }) as HTMLButtonElement;
    const errorBox = el('p', { class: 'survey__error' });
    errorBox.hidden = true;

    async function send(): Promise<void> {
      if (sending) return;
      const ok = commentField.validate();
      if (!ok) {
        step.querySelector<HTMLElement>('.field.is-invalid textarea')?.focus();
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
        purposes: state.purposes,
        comment: state.comment.trim(),
        note: state.note.trim(),
        attachments: state.files,
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
        setProgress(totalSteps);
        stage.replaceChildren(doneCard());
      } catch (err) {
        sending = false;
        submitBtn.replaceChildren(document.createTextNode('確認メールを送る'));
        submitBtn.disabled = false;
        errorBox.textContent = (err as Error).message;
        errorBox.hidden = false;
      }
    }

    submitBtn.addEventListener('click', () => void send());

    append(step, [
      el('p', { class: 'survey__count', text: `STEP ${index + 1} / ${totalSteps}` }),
      el('h3', { class: 'survey__question', text: '最後に、ひとことお願いします' }),
      el('div', { class: 'survey__fields' }, [commentField.wrap, noteField.wrap, fileField()]),
      honeypot,
      errorBox,
      el('div', { class: 'survey__nav' }, [backButton(), submitBtn]),
    ]);

    return step;
  }

  function buildStep(): HTMLElement {
    if (index === 0) return purposeStep();
    if (index === 1) return fieldsStep();
    return finalStep();
  }

  setProgress(0);
  stage.replaceChildren(buildStep());
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
