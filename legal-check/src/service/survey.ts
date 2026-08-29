import { CONTACT_METHODS } from '../data/services';
import { site } from '../data/site';
import {
  trackSurveyComplete,
  trackSurveyProgress,
  trackSurveyStart,
} from '../lib/analytics';
import { append, el, withBase } from '../lib/dom';
import { gsap, prefersReducedMotion } from '../lib/motion';
import { submitSurvey, type SurveyPayload } from '../lib/submit';
import type { ProfileField, Service, SurveyQuestion } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AUTO_ADVANCE_MS = 400;

/** ハイフン・括弧・全角のどれで書かれていても通す。数字が9桁あれば良しとする */
const telDigits = (v: string): string =>
  v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^\d]/g, '');

const OTHER_LABEL = 'その他';

type State = {
  answers: Record<string, string | string[]>;
  profile: Record<string, string>;
  comment: string;
  contactMethod: string;
};

export function renderSurvey(mount: HTMLElement, service: Service): void {
  const questions = service.survey.questions;
  const fields = service.survey.profileFields;

  /** 属性入力の画面割り。group が付いていればその単位で分ける */
  const groups: (string | undefined)[] = [];
  fields.forEach((f) => {
    if (!groups.includes(f.group)) groups.push(f.group);
  });

  /** Q1〜Q4 → 属性入力（groupの数だけ） → ひとこと＋連絡方法。属性は必ず最後の手前 */
  const totalSteps = questions.length + groups.length + 1;

  /** 残り画面数の表示。「あと◯つ」 */
  const remainingLabel = (at: number) => `あと${totalSteps - at}つ`;

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
    const stored = Array.isArray(state.answers[q.id])
      ? (state.answers[q.id] as string[])
      : state.answers[q.id]
        ? [state.answers[q.id] as string]
        : [];
    // 「その他：〇〇」で保存されているものは、選択肢名に戻して照合する
    const selected = new Set<string>(
      stored.map((v) => (v.startsWith(`${OTHER_LABEL}：`) ? OTHER_LABEL : v)),
    );
    const storedOther = stored.find((v) => v.startsWith(`${OTHER_LABEL}：`));

    const nextBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: '次へ',
    }) as HTMLButtonElement;

    const needsNextButton = q.type === 'multi' || Boolean(q.allowOther);

    const syncNext = () => {
      nextBtn.disabled = selected.size === 0;
    };

    const options = el('div', { class: 'survey__options' });

    /** 「その他」を選んだときだけ、その場に開く自由記述欄 */
    const otherWrap = el('div', { class: 'opt-other' });
    const otherInput = el('input', {
      type: 'text',
      class: 'opt-other__input',
      placeholder: 'よろしければ、ひとことで',
      'aria-label': `${q.label}のその他`,
    }) as HTMLInputElement;
    otherInput.value = storedOther ? storedOther.slice(OTHER_LABEL.length + 1) : '';
    otherWrap.append(otherInput);
    otherWrap.hidden = !selected.has(OTHER_LABEL);

    /** 「その他」は選択肢名だけでなく、書かれた内容も一緒に送る */
    const compose = (): string[] =>
      Array.from(selected).map((v) => {
        if (v !== OTHER_LABEL) return v;
        const text = otherInput.value.trim();
        return text ? `${OTHER_LABEL}：${text}` : OTHER_LABEL;
      });

    const syncOther = () => {
      const on = selected.has(OTHER_LABEL);
      otherWrap.hidden = !on;
      if (on) window.setTimeout(() => otherInput.focus({ preventScroll: true }), 60);
    };

    const store = () => {
      state.answers[q.id] = q.type === 'multi' ? compose() : (compose()[0] ?? '');
    };

    otherInput.addEventListener('input', store);

    const optionList = q.allowOther ? [...q.options, OTHER_LABEL] : q.options;

    optionList.forEach((option) => {
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
          store();
          syncOther();
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
        store();
        syncOther();
        syncNext();

        // 「その他」を選んだときは、書く時間を取るので自動で進めない
        if (option === OTHER_LABEL) return;

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
      q.allowOther ? otherWrap : null,
      el('div', { class: 'survey__nav' }, [
        backButton(),
        needsNextButton ? nextBtn : el('span'),
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
    } else if (field.type === 'number') {
      // 数字だけ入れてもらう。単位は欄の外に固定で見せる
      const input = el('input', {
        id: inputId,
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: field.placeholder,
      }) as HTMLInputElement;
      input.value = (state.profile[field.id] ?? '').replace(/[^\d,]/g, '');

      input.addEventListener('input', () => {
        // 全角数字と、数字以外の文字は落とす
        const cleaned = input.value
          .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
          .replace(/[^\d]/g, '');
        input.value = cleaned ? Number(cleaned).toLocaleString('en-US') : '';
      });

      control = input;
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

    /** 数値欄は単位を付けて送る（シート側の列がそのまま読める形になる） */
    const readValue = (): string => {
      const raw = control.value.trim();
      if (!raw) return '';
      return field.type === 'number' && field.unit ? `${raw}${field.unit}` : raw;
    };

    const validate = (): boolean => {
      const value = readValue();
      state.profile[field.id] = value;

      let message = '';
      if (field.required && !control.value.trim()) message = '入力してください';
      else if (field.type === 'number' && control.value.trim() && !/\d/.test(control.value))
        message = '数字で入力してください';
      else if (field.type === 'email' && value && !EMAIL_RE.test(value))
        message = 'メールアドレスの形式をご確認ください';
      else if (field.type === 'tel' && value && telDigits(value).length < 9)
        message = '電話番号をご確認ください';

      error.textContent = message;
      wrap.classList.toggle('is-invalid', Boolean(message));
      return !message;
    };

    control.addEventListener('input', () => {
      state.profile[field.id] = readValue();
      if (wrap.classList.contains('is-invalid')) validate();
    });
    control.addEventListener('change', () => {
      state.profile[field.id] = readValue();
      if (wrap.classList.contains('is-invalid')) validate();
    });

    if (field.type === 'number' && field.unit) {
      wrap.append(
        label,
        el('span', { class: 'field__with-unit' }, [
          control,
          el('span', { class: 'field__unit', text: field.unit }),
        ]),
        error,
      );
    } else {
      wrap.append(label, control, error);
    }
    return { wrap, validate };
  }

  function profileStep(group: string | undefined, groupIndex: number): HTMLElement {
    const step = el('div', { class: 'survey__step' });
    const rows = fields.filter((f) => f.group === group).map(fieldRow);

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
      trackSurveyProgress(service.id, questions.length + 1 + groupIndex);
      goTo(index + 1);
    });

    append(step, [
      el('p', { class: 'survey__count', text: remainingLabel(index) }),
      el('h3', {
        class: 'survey__question',
        text: group ?? 'ご連絡先を教えてください',
      }),
      groupIndex === 0
        ? el('p', {
            class: 'survey__hint',
            text: 'いただいた内容は、ご案内以外には使いません。',
          })
        : null,
      el('div', { class: 'survey__fields' }, rows.map((r) => r.wrap)),
      el('div', { class: 'survey__nav' }, [backButton(), nextBtn]),
    ]);

    return step;
  }

  /**
   * 最後の画面に、ここまで入力された内容を並べる。
   * 送る側が「何を渡すのか」を見たうえで送信できるようにするため。
   */
  function summary(): HTMLElement {
    const rows = fields
      .map((f) => ({ label: f.label, value: state.profile[f.id] ?? '' }))
      .filter((r) => r.value);

    const back = el('button', {
      type: 'button',
      class: 'survey__summary-edit',
      text: '修正する',
    }) as HTMLButtonElement;
    back.addEventListener('click', () => goTo(questions.length));

    return el('div', { class: 'survey__summary' }, [
      el('div', { class: 'survey__summary-head' }, [
        el('p', { class: 'survey__summary-title', text: 'お送りする内容' }),
        back,
      ]),
      el(
        'dl',
        { class: 'survey__summary-list' },
        rows.flatMap((r) => [
          el('dt', { text: r.label }),
          el('dd', { text: r.value }),
        ]),
      ),
    ]);
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
      summary(),
      errorBox,
      nav,
    );

    return step;
  }

  function buildStep(): HTMLElement {
    if (index < questions.length) return questionStep(questions[index], index + 1);
    const groupIndex = index - questions.length;
    if (groupIndex < groups.length) return profileStep(groups[groupIndex], groupIndex);
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
    el('a', { class: 'done__back', href: withBase('/'), text: site.homeLabel }),
  ]);

  return step;
}
