import { CONTACT_METHODS } from '../data/services';
import {
  trackSurveyComplete,
  trackSurveyProgress,
  trackSurveyStart,
} from '../lib/analytics';
import { append, el } from '../lib/dom';
import { gsap, prefersReducedMotion } from '../lib/motion';
import { submitSurvey, type SurveyPayload } from '../lib/submit';
import type { ProfileField, Service, SurveyQuestion } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AUTO_ADVANCE_MS = 400;

type State = {
  answers: Record<string, string | string[]>;
  profile: Record<string, string>;
  comment: string;
  contactMethod: string;
};

export function renderSurvey(mount: HTMLElement, service: Service): void {
  const questions = service.survey.questions;
  const fields = service.survey.profileFields;
  /** Q1〜Q4 → 属性入力 → ひとこと＋連絡方法。属性は必ず最後の手前 */
  const totalSteps = questions.length + 2;

  const state: State = { answers: {}, profile: {}, comment: '', contactMethod: '' };

  let index = 0;
  let started = false;
  let sending = false;

  const bar = el('div', { class: 'survey__bar' });
  const progress = el('div', {
    class: 'survey__progress',
    role: 'progressbar',
    'aria-label': '回答の進み具合',
    'aria-valuemin': 0,
    'aria-valuemax': totalSteps,
    'aria-valuenow': 0,
  }, [bar]);

  const stage = el('div', { class: 'survey__stage' });
  mount.append(progress, stage);

  const markStarted = () => {
    if (started) return;
    started = true;
    trackSurveyStart(service.id);
  };

  const setProgress = (done: number) => {
    bar.style.transform = `scaleX(${Math.max(Math.min(done / totalSteps, 1), 0.04)})`;
    progress.setAttribute('aria-valuenow', String(done));
  };

  /** カードを差し替える。高さも一緒に送って、画面が飛ばないようにする */
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
    }, 240);
  }

  function focusFirst(scope: HTMLElement): void {
    const target = scope.querySelector<HTMLElement>(
      'button:not([disabled]), input, select, textarea',
    );
    // 画面が飛ばないよう、フォーカスはスクロールなしで当てる
    target?.focus({ preventScroll: true });
  }

  function goTo(next: number): void {
    index = Math.max(0, Math.min(next, totalSteps - 1));
    setProgress(index);
    swap(buildStep());
  }

  // ── 設問カード ────────────────────────────────────────────
  function questionStep(q: SurveyQuestion, position: number): HTMLElement {
    const step = el('div', { class: 'survey__step' });
    const selected = new Set<string>(
      Array.isArray(state.answers[q.id])
        ? (state.answers[q.id] as string[])
        : state.answers[q.id]
          ? [state.answers[q.id] as string]
          : [],
    );

    const nextBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: '次へ',
    }) as HTMLButtonElement;

    const syncNext = () => {
      nextBtn.disabled = selected.size === 0;
    };

    const options = el('div', { class: 'survey__options' });

    q.options.forEach((option) => {
      const button = el('button', {
        type: 'button',
        class: `opt${q.type === 'multi' ? ' opt--multi' : ''}`,
        'aria-pressed': selected.has(option) ? 'true' : 'false',
      }) as HTMLButtonElement;

      button.append(el('span', { class: 'opt__mark', 'aria-hidden': 'true' }), el('span', { text: option }));
      if (selected.has(option)) button.classList.add('is-selected');

      button.addEventListener('click', () => {
        markStarted();

        if (q.type === 'multi') {
          if (selected.has(option)) selected.delete(option);
          else selected.add(option);
          button.classList.toggle('is-selected', selected.has(option));
          button.setAttribute('aria-pressed', selected.has(option) ? 'true' : 'false');
          state.answers[q.id] = Array.from(selected);
          syncNext();
          return;
        }

        selected.clear();
        selected.add(option);
        options.querySelectorAll('.opt').forEach((o) => {
          o.classList.remove('is-selected');
          o.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('is-selected');
        button.setAttribute('aria-pressed', 'true');
        state.answers[q.id] = option;
        syncNext();

        // 選んだ余韻を少し置いてから、自動で次へ
        window.setTimeout(() => {
          if (stage.contains(button)) {
            trackSurveyProgress(service.id, position);
            goTo(index + 1);
          }
        }, AUTO_ADVANCE_MS);
      });

      options.append(button);
    });

    nextBtn.addEventListener('click', () => {
      trackSurveyProgress(service.id, position);
      goTo(index + 1);
    });
    syncNext();

    append(step, [
      el('p', { class: 'survey__count', text: `Q${position} / ${questions.length}` }),
      el('h3', { class: 'survey__question', text: q.label }),
      q.type === 'multi'
        ? el('p', { class: 'survey__hint', text: 'あてはまるものをすべて選べます' })
        : null,
      options,
      el('div', { class: 'survey__nav' }, [
        backButton(),
        q.type === 'multi' ? nextBtn : el('span'),
      ]),
    ]);

    return step;
  }

  function backButton(): HTMLElement {
    const button = el('button', {
      type: 'button',
      class: 'btn btn--ghost',
      text: '← 戻る',
    }) as HTMLButtonElement;
    button.hidden = index === 0;
    button.addEventListener('click', () => goTo(index - 1));
    return button;
  }

  // ── 属性入力 ──────────────────────────────────────────────
  function fieldRow(field: ProfileField): { wrap: HTMLElement; validate: () => boolean } {
    const wrap = el('div', { class: 'field' });
    const inputId = `f-${service.id}-${field.id}`;

    const label = el('label', { for: inputId, text: field.label });
    label.append(
      el('span', {
        class: field.required ? 'field__req' : 'field__opt',
        text: field.required ? '必須' : '任意',
      }),
    );

    let control: HTMLInputElement | HTMLSelectElement;

    if (field.type === 'select') {
      const select = el('select', { id: inputId }) as HTMLSelectElement;
      select.append(el('option', { value: '', text: '選択してください' }));
      (field.options ?? []).forEach((option) =>
        select.append(el('option', { value: option, text: option })),
      );
      select.value = state.profile[field.id] ?? '';
      control = select;
    } else {
      const input = el('input', {
        id: inputId,
        type: field.type,
        autocomplete:
          field.type === 'email'
            ? 'email'
            : field.id === 'company'
              ? 'organization'
              : field.id === 'name'
                ? 'name'
                : 'off',
        inputmode: field.type === 'tel' ? 'tel' : undefined,
      }) as HTMLInputElement;
      input.value = state.profile[field.id] ?? '';
      control = input;
    }

    const error = el('p', { class: 'field__error' });

    const validate = (): boolean => {
      const value = control.value.trim();
      state.profile[field.id] = value;

      let message = '';
      if (field.required && !value) message = '入力してください';
      else if (field.type === 'email' && value && !EMAIL_RE.test(value))
        message = 'メールアドレスの形式をご確認ください';

      error.textContent = message;
      wrap.classList.toggle('is-invalid', Boolean(message));
      return !message;
    };

    control.addEventListener('input', () => {
      state.profile[field.id] = control.value.trim();
      if (wrap.classList.contains('is-invalid')) validate();
    });
    control.addEventListener('change', () => {
      state.profile[field.id] = control.value.trim();
      if (wrap.classList.contains('is-invalid')) validate();
    });

    wrap.append(label, control, error);
    return { wrap, validate };
  }

  function profileStep(): HTMLElement {
    const step = el('div', { class: 'survey__step' });
    const rows = fields.map(fieldRow);

    const nextBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: '次へ',
    }) as HTMLButtonElement;

    nextBtn.addEventListener('click', () => {
      const ok = rows.map((r) => r.validate()).every(Boolean);
      if (!ok) {
        step.querySelector<HTMLElement>('.field.is-invalid input, .field.is-invalid select')?.focus();
        return;
      }
      trackSurveyProgress(service.id, questions.length + 1);
      goTo(index + 1);
    });

    step.append(
      el('p', { class: 'survey__count', text: 'あと2つ' }),
      el('h3', { class: 'survey__question', text: 'ご連絡先を教えてください' }),
      el('p', { class: 'survey__hint', text: 'いただいた内容は、ご案内以外には使いません。' }),
      el('div', { class: 'survey__fields' }, rows.map((r) => r.wrap)),
      el('div', { class: 'survey__nav' }, [backButton(), nextBtn]),
    );

    return step;
  }

  // ── ひとこと＋連絡方法 ───────────────────────────────────
  function finalStep(): HTMLElement {
    const step = el('div', { class: 'survey__step' });

    const textareaId = `f-${service.id}-comment`;
    const textarea = el('textarea', {
      id: textareaId,
      rows: 4,
      placeholder: '気になっていることがあれば',
    }) as HTMLTextAreaElement;
    textarea.value = state.comment;
    textarea.addEventListener('input', () => {
      state.comment = textarea.value;
    });

    const commentField = el('div', { class: 'field' }, [
      (() => {
        const label = el('label', { for: textareaId, text: 'ひとこと' });
        label.append(el('span', { class: 'field__opt', text: '任意' }));
        return label;
      })(),
      textarea,
    ]);

    const contactOptions = el('div', { class: 'survey__options' });
    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: '送信する',
    }) as HTMLButtonElement;

    const syncSubmit = () => {
      submitBtn.disabled = !state.contactMethod || sending;
    };

    CONTACT_METHODS.forEach((method) => {
      const button = el('button', {
        type: 'button',
        class: 'opt',
        'aria-pressed': state.contactMethod === method ? 'true' : 'false',
      }) as HTMLButtonElement;
      button.append(el('span', { class: 'opt__mark', 'aria-hidden': 'true' }), el('span', { text: method }));
      if (state.contactMethod === method) button.classList.add('is-selected');

      button.addEventListener('click', () => {
        state.contactMethod = method;
        contactOptions.querySelectorAll('.opt').forEach((o) => {
          o.classList.remove('is-selected');
          o.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('is-selected');
        button.setAttribute('aria-pressed', 'true');
        syncSubmit();
      });

      contactOptions.append(button);
    });

    const errorBox = el('p', { class: 'survey__error' });
    errorBox.hidden = true;

    const nav = el('div', { class: 'survey__nav' }, [backButton(), submitBtn]);

    const send = async () => {
      if (sending) return; // 二重送信を防ぐ
      sending = true;
      errorBox.hidden = true;
      submitBtn.disabled = true;
      submitBtn.replaceChildren(
        el('span', { class: 'survey__spinner', 'aria-hidden': 'true' }),
        el('span', { text: '送信中' }),
      );

      const payload: SurveyPayload = {
        serviceId: service.id,
        timestamp: new Date().toISOString(),
        answers: state.answers,
        profile: state.profile,
        comment: state.comment,
        contactMethod: state.contactMethod,
      };

      try {
        await submitSurvey(payload);
        trackSurveyComplete(service.id);
        setProgress(totalSteps);
        swap(doneStep(service));
      } catch (err) {
        sending = false;
        submitBtn.replaceChildren(document.createTextNode('送信する'));
        submitBtn.disabled = false;
        errorBox.textContent = `${(err as Error).message} もう一度お試しください。`;
        errorBox.hidden = false;
      }
    };

    submitBtn.addEventListener('click', send);
    syncSubmit();

    step.append(
      el('p', { class: 'survey__count', text: 'さいごに' }),
      el('h3', { class: 'survey__question', text: 'ご連絡の方法を選んでください' }),
      contactOptions,
      el('div', { class: 'survey__fields' }, [commentField]),
      errorBox,
      nav,
    );

    return step;
  }

  function buildStep(): HTMLElement {
    if (index < questions.length) return questionStep(questions[index], index + 1);
    if (index === questions.length) return profileStep();
    return finalStep();
  }

  setProgress(0);
  stage.replaceChildren(buildStep());
}

/** 完了画面。ここでは何も売り込まない */
function doneStep(service: Service): HTMLElement {
  const step = el('div', { class: 'survey__step done' });
  const stat = service.stats[0];

  const mark = el('div', { class: 'done__mark', 'aria-hidden': 'true' });
  mark.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  append(step, [
    mark,
    el('p', {
      class: 'done__title',
      text: 'ありがとうございました。担当より改めてご連絡します。',
    }),
    stat
      ? el('div', { class: 'done__stat' }, [
          el('div', { class: 'stat' }, [
            el('p', { class: 'stat__label', text: stat.label }),
            el('p', { class: 'stat__value' }, [
              el('span', { class: 'stat__num', text: stat.value }),
              stat.unit ? el('span', { class: 'stat__unit', text: stat.unit }) : null,
            ]),
            stat.note ? el('p', { class: 'stat__note', text: stat.note }) : null,
          ]),
        ])
      : null,
    el('a', { class: 'done__back', href: '/', text: 'Baton へ戻る' }),
  ]);

  return step;
}
