import { FILE_EXT, FILE_LIMIT, IS_DEMO, makeReceiptId, readAsBase64, submitConsult, type ConsultPayload } from './submit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+\.\S+$/i;

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);

/**
 * 資料の添付欄。選んだファイルは配列で持ち、送信時に base64 にする。
 * 合計サイズと件数はここで止め、GAS 側でも同じ上限で確かめる。
 */
function setupFiles(form: HTMLFormElement): () => File[] {
  const input = form.querySelector<HTMLInputElement>('[data-files]');
  const drop = form.querySelector<HTMLElement>('[data-drop]');
  const list = form.querySelector<HTMLElement>('[data-file-list]');
  const err = form.querySelector<HTMLElement>('[data-file-err]');
  let files: File[] = [];
  if (!input || !drop || !list) return () => files;

  const say = (msg: string) => {
    if (!err) return;
    err.textContent = msg;
    err.hidden = !msg;
  };

  const render = () => {
    list.replaceChildren(
      ...files.map((f, i) => {
        const li = document.createElement('li');
        li.className = 'drop-file';
        const name = document.createElement('span');
        name.className = 'drop-name';
        name.textContent = f.name;
        const size = document.createElement('span');
        size.className = 'drop-size';
        size.textContent = fmtSize(f.size);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'drop-rm';
        rm.textContent = '×';
        rm.setAttribute('aria-label', `${f.name} を外す`);
        rm.addEventListener('click', () => {
          files = files.filter((_, j) => j !== i);
          say('');
          render();
        });
        li.append(name, size, rm);
        return li;
      }),
    );
    list.hidden = files.length === 0;
  };

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const skipped: string[] = [];
    for (const f of incoming) {
      const total = files.reduce((n, x) => n + x.size, 0);
      if (!FILE_EXT.test(f.name)) skipped.push(`「${f.name}」は送れない形式です。`);
      else if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
      else if (files.length >= FILE_LIMIT.count) skipped.push(`一度に送れるのは${FILE_LIMIT.count}件までです。`);
      else if (total + f.size > FILE_LIMIT.totalBytes) skipped.push(`合計が大きすぎるため「${f.name}」を追加できませんでした。大きな資料は、URLの欄からリンクで共有してください。`);
      else files.push(f);
    }
    say([...new Set(skipped)].join(' '));
    render();
  };

  input.addEventListener('change', () => {
    add(input.files);
    input.value = '';
  });
  // ドラッグ中の見た目。ドロップ自体は input が受け取り、change が発火する
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('is-over')));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));

  return () => files;
}

export function setupContact(): void {
  const form = document.querySelector<HTMLFormElement>('[data-form]');
  if (!form) return;
  const done = document.querySelector<HTMLElement>('[data-done]');
  const errBox = form.querySelector<HTMLElement>('[data-form-err]');
  const button = form.querySelector<HTMLButtonElement>('[data-submit]');
  const groups = [...form.querySelectorAll<HTMLFieldSetElement>('.q')];
  const getFiles = setupFiles(form);

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
    const url = form.elements.namedItem('portfolioUrl') as HTMLInputElement | null;
    if (url) {
      const ok = url.value.trim() === '' || URL_RE.test(url.value.trim());
      if (ok) url.removeAttribute('aria-invalid');
      else url.setAttribute('aria-invalid', 'true');
      if (!ok && !first) first = url;
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
      showError(
        invalid.getAttribute('name') === 'portfolioUrl'
          ? 'URLは https:// から入力してください。'
          : '未入力・未選択の項目があります。赤くなっている箇所をご確認ください。',
      );
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
      },
      comment: String(data.get('comment') ?? '').trim(),
      portfolioUrl: String(data.get('portfolioUrl') ?? '').trim(),
      files: [],
    };

    if (button) {
      button.disabled = true;
      button.querySelector('span')!.textContent = '送信しています…';
    }
    try {
      payload.files = await Promise.all(
        getFiles().map(async (f) => ({ name: f.name, type: f.type, size: f.size, data: await readAsBase64(f) })),
      );
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
        button.querySelector('span')!.textContent = 'この内容で送る';
      }
    }
  });
}
