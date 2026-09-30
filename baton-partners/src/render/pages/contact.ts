import QRCode from 'qrcode';
import { routes, site } from '../../config/site';
import type { Partner, Question } from '../../types';
import { document, footer, header, shortName, type BuildEnv } from '../layout';
import { answerBox, pageHero } from '../parts';
import { breadcrumbLd, faqLd, ids, orgLd, pageLd } from '../seo';
import { esc, heading, jp } from '../text';

/** 話してみる前の、手続きについての質問（全社共通。社名だけ差し替える） */
const processFaq = (name: string) => [
  {
    q: '話を聞いてみるだけでも、大丈夫ですか。',
    a: `はい、情報を集めている段階でもかまいません。アンケートの内容を見て、Music Japanからご連絡します。${name}とおつなぎするかどうかは、そのあとで一緒に決めます。`,
  },
  {
    q: '話してみると、すぐに営業の電話がかかってきますか。',
    a: `いいえ。ご回答は、まずMusic Japanが読みます。お名前や連絡先を${name}へお伝えするのは、お客様と${name}の両方が了承してからです。そのあと、LINEグループでおつなぎします。`,
  },
  {
    q: '予約カレンダーはありますか。',
    a: 'ありません。ご相談の中身と目的を確かめてからおつなぎしたいので、予約ではなくアンケートでお伺いしています。',
  },
];

const ROLES = ['代表取締役・役員', '部長・マネージャー', '担当者', 'その他'];

/** 事前に共有できる資料の形式（client/contact.ts・gas/Code.gs と揃える） */
const FILE_ACCEPT = '.pdf,.ppt,.pptx,.key,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip';

/** フォームの上に置く、送る前に知っておくと安心なこと */
const PROMISES = (name: string) => [
  { t: '連絡先は、つなぐと決まってから', d: `お名前やご連絡先を${name}へお伝えするのは、双方の了承がそろってからです。` },
  { t: '説明のし直しがいらない', d: '先方はご相談の概要を読んだうえで会うので、最初の打ち合わせから本題に入れます。' },
];

function question(q: Question, n: number): string {
  const type = q.type === 'multi' ? 'checkbox' : 'radio';
  const opts = q.options
    .map(
      (o, i) => `
        <label class="chip">
          <input type="${type}" name="${q.id}" value="${esc(o)}"${q.type === 'single' && i === 0 ? ' required' : ''} />
          <span>${esc(o)}</span>
        </label>`,
    )
    .join('');
  return `
    <fieldset class="q" data-q="${q.id}" data-type="${q.type}">
      <legend class="q-l"><span class="q-no">Q${n}</span><span>${jp(q.label)}</span>${q.type === 'multi' ? '<span class="q-hint">複数選択可</span>' : ''}</legend>
      <div class="chips">${opts}</div>
      <p class="q-err" role="alert" hidden>ひとつ以上選んでください</p>
    </fieldset>`;
}

export async function renderContact(p: Partner, env: BuildEnv): Promise<string> {
  const path = routes.contact(p.slug);
  const name = shortName(p);
  const qr = await QRCode.toString(site.lineUrl, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#141414', light: '#0000' },
  });

  const faq = processFaq(name);
  const faqHtml = faq
    .map(
      (f) => `
      <details class="faq-item" open>
        <summary><span class="faq-q">Q</span><span>${jp(f.q)}</span><span class="faq-icon" aria-hidden="true"></span></summary>
        <div class="faq-a"><p>${jp(f.a)}</p></div>
      </details>`,
    )
    .join('');

  const steps = [
    { t: '公式LINEを追加', d: 'Music Japanの公式LINEを追加します。おつなぎの連絡はここから届きます。' },
    { t: 'アンケートに回答', d: 'ご相談の目的と状況を、約2分でお伺いします。' },
    { t: 'Music Japanが確認', d: `ご回答をもとに、${name}とのご相談が合うかを確認します。` },
    { t: `${name}へ事前確認`, d: 'お客様の連絡先は伝えずに、ご相談の概要だけを確認します。' },
    { t: 'LINEグループでおつなぎ', d: `双方の了承がそろったら、グループを作成します。目安は${site.leadTime}です。` },
  ]
    .map(
      (s, i) => `
      <li class="step rv" style="--d:${i}">
        <span class="step-no">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="step-h">${heading(s.t)}</h3>
        <p class="step-p">${jp(s.d)}</p>
      </li>`,
    )
    .join('');

  const body = `
${header(p, 'contact')}
<main id="main">
  ${pageHero({
    p,
    no: '04',
    en: 'Talk',
    title: [`${name}と、`, '話してみる。'],
    lead: `予約カレンダーはありません。Music Japanがご相談の内容を確かめてから、${name}とおつなぎします。`,
    phase: 2.0,
    crumbs: [{ name, href: routes.top(p.slug) }, { name: '話してみる' }],
  })}

  ${answerBox(p.seo.contact.answer, 'contact-answer')}

  <section class="sec sec-steps" aria-labelledby="steps-h">
    <div class="wrap">
      <header class="sec-head sec-head-row rv">
        <p class="kicker">Flow</p>
        <h2 id="steps-h" class="sec-h">${heading('おつなぎまでの、5つのステップ。')}</h2>
      </header>
      <ol class="steps">${steps}</ol>
      <p class="fine">${jp('ご紹介の可否とタイミングは、Music Japanが一件ずつ判断します。自動でのマッチングや予約は行っていません。')}</p>
    </div>
  </section>

  <section class="sec" aria-labelledby="pfaq-h">
    <div class="wrap grid-sec">
      <header class="sec-head rv">
        <p class="kicker">FAQ</p>
        <h2 id="pfaq-h" class="sec-h">${heading('話してみる前に')}</h2>
      </header>
      <div class="faq rv">${faqHtml}</div>
    </div>
  </section>

  <section class="sec sec-form" aria-labelledby="form-h">
    <div class="wrap form-grid">
      <aside class="line-card rv" aria-labelledby="line-h">
        <p class="kicker">Step 01</p>
        <h2 id="line-h" class="line-h">${heading('はじめに、公式LINEを追加')}</h2>
        <p class="line-p">${jp('おつなぎのご連絡は、Music Japanの公式LINEからお送りします。追加したあと、右のアンケートにお進みください。')}</p>
        <a class="btn btn-line-app btn-block" href="${site.lineUrl}" target="_blank" rel="noopener" data-line-link>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 5.9-3.5 8-5.9C21.4 14.4 22 12.8 22 11c0-4.4-4.5-8-10-8z"/></svg>
          <span>公式LINEを追加する</span>
        </a>
        <figure class="qr">
          <div class="qr-code">${qr}</div>
          <figcaption>${jp('パソコンでご覧の方は、スマートフォンで読み取ってください。')}</figcaption>
        </figure>
      </aside>

      <div class="form-wrap rv">
        <p class="kicker">Step 02</p>
        <h2 id="form-h" class="form-h">${heading(`話してみる前の、${p.contact.questions.length}つの質問`)}</h2>
        <p class="form-lead">${jp(`ご回答はMusic Japanが確認しだい、ご相談の概要として事前に${name}へ共有します。先方も状況を分かったうえでお話しできるので、はじめの打ち合わせがぐっと早く進みます。`)}</p>
        <ul class="promises">${PROMISES(name)
          .map((m) => `<li class="promise"><strong>${jp(m.t)}</strong><span>${jp(m.d)}</span></li>`)
          .join('')}</ul>

        <form class="form" data-form data-partner="${p.slug}" data-partner-name="${esc(p.company.name)}" novalidate>
          <div class="form-block">
            <p class="form-block-t">ご相談について</p>
            ${p.contact.questions.map((q, i) => question(q, i + 1)).join('')}
          </div>

          <div class="form-block">
            <p class="form-block-t">お客様について</p>
            <div class="fields">
              <label class="field"><span class="field-l">会社名<em>必須</em></span><input name="company" type="text" autocomplete="organization" required /></label>
              <label class="field"><span class="field-l">お名前<em>必須</em></span><input name="name" type="text" autocomplete="name" required /></label>
              <label class="field"><span class="field-l">メールアドレス<em>必須</em></span><input name="email" type="email" autocomplete="email" inputmode="email" required /></label>
              <label class="field"><span class="field-l">役職</span>
                <select name="role"><option value="">選択してください</option>${ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}</select>
              </label>
              <div class="field field-wide">
                <span class="field-l" id="files-l">事前に共有したい資料<span class="opt">任意</span></span>
                <label class="drop" data-drop>
                  <input name="files" type="file" multiple accept="${FILE_ACCEPT}" data-files aria-labelledby="files-l" aria-describedby="files-help" />
                  <span class="drop-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg></span>
                  <span class="drop-t">${jp('会社案内・ポートフォリオ・企画書など')}</span>
                  <span class="drop-s"><span class="drop-pick">ファイルを選ぶ</span><span class="drop-drag">またはここへドラッグ</span></span>
                </label>
                <ul class="drop-list" data-file-list hidden></ul>
                <p class="field-err" role="alert" data-file-err hidden></p>
                <span class="field-help" id="files-help">${jp(`PDF・スライド・画像などを、まとめて送れます。先方へお渡しするのは、双方の了承後です。`)}</span>
              </div>
              <label class="field field-wide"><span class="field-l">ポートフォリオ・資料のURL<span class="opt">任意</span></span><input name="portfolioUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://" />
                <span class="field-help">${jp('Googleドライブや自社サイトなど、リンクで共有したい場合はこちらへ。')}</span></label>
              <label class="field field-wide"><span class="field-l">ひとこと<span class="opt">任意</span></span><textarea name="comment" rows="4" placeholder="聞いてみたいこと、いまの状況など"></textarea></label>
              <label class="hp" aria-hidden="true">Website<input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
            </div>
          </div>

          <label class="agree">
            <input type="checkbox" name="agree" required />
            <span>${jp(`お名前・ご連絡先を${name}へ共有するのは、双方の了承後のみです。`)}<a href="${routes.privacy()}" target="_blank" rel="noopener">プライバシーポリシー</a>に同意のうえ送信します。</span>
          </label>

          <p class="form-err" role="alert" data-form-err hidden></p>
          <button class="btn btn-cta btn-lg btn-block" type="submit" data-submit><span>この内容で送る</span><span class="arrow" aria-hidden="true">→</span></button>
        </form>

        <div class="done" data-done hidden tabindex="-1">
          <p class="kicker">Thank you</p>
          <p class="done-h">${heading('ご回答を受け付けました。')}</p>
          <p class="done-id">受付番号 <strong data-receipt>—</strong></p>
          <ol class="done-next">
            <li>${jp('Music Japanがご回答の内容を確認します。')}</li>
            <li>${jp(`${name}へ、ご相談の概要だけを事前に確認します。`)}</li>
            <li>${jp(`双方の了承がそろったら、公式LINEでグループを作成します（目安：${site.leadTime}）。`)}</li>
          </ol>
          <p class="done-note">${jp('まだ公式LINEを追加していない方は、いまのうちに追加をお願いします。')}</p>
          <a class="btn btn-line-app" href="${site.lineUrl}" target="_blank" rel="noopener"><span>公式LINEを追加する</span></a>
        </div>
      </div>
    </div>
  </section>
</main>
${footer(p)}`;

  return document(
    {
      kind: 'contact',
      path,
      partner: p,
      title: p.seo.contact.title,
      description: p.seo.contact.description,
      og: `/og/${p.slug}-contact.png`,
      jsonLd: [
        ...orgLd(env, p),
        pageLd(env, {
          type: 'ContactPage',
          path,
          name: p.seo.contact.title,
          description: p.seo.contact.description,
          image: `/og/${p.slug}-contact.png`,
          partner: p,
          dateModified: p.seo.updated,
          mainEntity: ids.org(env, p),
        }),
        faqLd(env, path, faq),
        breadcrumbLd(env, path, [
          { name, href: routes.top(p.slug) },
          { name: '話してみる', href: path },
        ]),
      ],
    },
    env,
    body,
  );
}
