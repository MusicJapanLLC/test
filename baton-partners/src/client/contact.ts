import { IS_DEMO, makeReceiptId, submitConsult, type ConsultPayload } from './submit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function setupContact(): void {
  const form = document.querySelector<HTMLFormElement>('[data-form]');
  if (!form) return;
  const done = document.querySelector<HTMLElement>('[data-done]');
  const errBox = form.querySelector<HTMLElement>('[data-form-err]');
  const button = form.querySelector<HTMLButtonElement>('[data-submit]');
  const groups = [...form.querySelectorAll<HTMLFieldSetElement>('.q')];

  // 選び直したら、その設問のエラー表示を消す
  form.addEventListener('change', (e) => {
    const q = (e.target as HTMLElement).closest<HTMLFieldSetElement>('.q');
    if (q) {
      q.classList.remove('is-invalid');
      q.querySelector<HTMLElement>('.q-err')?.setAttribute('hidden', '');
    }
    const input = e.target as HTMLInputElement;
    if (input.getAttribute('aria-invalid')) input.removeAttribute('aria-invalid');
  });

  // ラジオの required はブラウザ標準の吹き出しを出さず、こちらで案内する
  form.querySelectorAll('input[required]').forEach((el) => el.removeAttribute('required'));

  const validate = (): HTMLElement | null => {
    let first: HTMLElement | null = null;
    for (const g of groups) {
      const ok = g.querySelector('input:checked') !== null;
      g.classList.toggle('is-invalid', !ok);
      g.querySelector<HTMLElement>('.q-err')?.toggleAttribute('hidden', ok);
      if (!ok && !first) first = g;
    }
    for (const name of ['company', 'name', 'email'] as const) {
      const input = form.elements.namedItem(name) as HTMLInputElement;
      const v = input.value.trim();
      const ok = name === 'email' ? EMAIL.test(v) : v.length > 0;
      if (ok) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
      if (!ok && !first) first = input;
    }
    const agree = form.elements.namedItem('agree') as HTMLInputElement;
    if (!agree.checked && !first) first = agree;
    return first;
  };

  const showError = (msg: string) => {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.hidden = false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errBox) errBox.hidden = true;

    const invalid = validate();
    if (invalid) {
      showError('未入力・未選択の項目があります。赤くなっている箇所をご確認ください。');
      invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (invalid.querySelector('input') ?? invalid).focus({ preventScroll: true });
      return;
    }

    const data = new FormData(form);
    const partner = form.dataset.partner ?? 'unknown';
    const receiptId = makeReceiptId(partner);

    // ボット対策：人には見えない欄が埋まっていたら、送ったことにして何もしない
    const isBot = String(data.get('website') ?? '').length > 0;

    const answers: ConsultPayload['answers'] = {};
    const questions: ConsultPayload['questions'] = {};
    for (const g of groups) {
      const id = g.dataset.q ?? '';
      const values = data.getAll(id).map(String);
      answers[id] = g.dataset.type === 'multi' ? values : (values[0] ?? '');
      questions[id] = g.querySelector('.q-l span:nth-child(2)')?.textContent?.trim() ?? id;
    }

    const payload: ConsultPayload = {
      partnerId: partner,
      partnerName: form.dataset.partnerName ?? '',
      receiptId,
      timestamp: new Date().toISOString(),
      source: 'web',
      page: location.pathname,
      answers,
      questions,
      profile: {
        company: String(data.get('company') ?? '').trim(),
        name: String(data.get('name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        role: String(data.get('role') ?? ''),
        lineName: String(data.get('lineName') ?? '').trim(),
      },
      comment: String(data.get('comment') ?? '').trim(),
    };

    if (button) {
      button.disabled = true;
      button.querySelector('span')!.textContent = '送信しています…';
    }
    try {
      if (!isBot) await submitConsult(payload);
      form.hidden = true;
      if (done) {
        done.querySelector('[data-receipt]')!.textContent = receiptId;
        if (IS_DEMO) {
          const note = document.createElement('p');
          note.className = 'done-note';
          note.textContent = '※ デモ環境のため、実際には送信されていません。';
          done.append(note);
        }
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'start' });
        done.focus({ preventScroll: true });
      }
    } catch (err) {
      showError((err as Error).message);
      if (button) {
        button.disabled = false;
        button.querySelector('span')!.textContent = 'アンケートを送信する';
      }
    }
  });
}
