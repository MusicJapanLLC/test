import { games } from '../data/games';
import { REQUEST_TYPES, SEVERITY } from '../data/request';
import { botHtml, crewHtml } from './brand';
import { esc, icon, ph, themeVars, type RenderCtx } from './util';

const TYPE_ICON: Record<(typeof REQUEST_TYPES)[number]['id'], string> = {
  bug: icon.bug,
  idea: icon.idea,
  love: icon.heart,
  other: icon.mail,
};

export function requestBody(_ctx: RenderCtx): string {
  return `
  <main id="main" class="request">
    <section class="req-hero container">
      <p class="eyebrow" data-reveal><span>REQUEST</span><span>ご要望・バグ報告</span></p>
      <h1 class="req-title" data-reveal>
        <span>${ph('見つけたバグは、')}</span>
        <span><em>あなたの手柄</em>です。</span>
      </h1>
      <p class="req-lead" data-reveal>${ph('バグの報告も、「こうしたらいいやん」も、「ここが好き」も。')}<br class="pc" />${ph('ここから送った声は、開発チームに直接届きます。全部読みます。次のアップデートは、ここから生まれます。')}</p>
      <div class="req-hero__bot" data-reveal>${botHtml('mic', { note: 'ご用件をどうぞ！', line: 'マイク、オン！｜どんな声でも、届けるよ！' })}</div>
      <ol class="req-steps" data-reveal aria-label="送るまでの流れ">
        <li><b>01</b>用件をえらぶ</li>
        <li><b>02</b>作品をえらぶ</li>
        <li><b>03</b>書いて送る</li>
      </ol>
    </section>

    <section class="req-body container">
      <form class="req-form" data-req-form novalidate>
        <fieldset class="req-field" data-reveal>
          <legend class="req-label"><span class="req-label__no">01</span>用件は？<span class="req-req">必須</span></legend>
          <div class="types">
            ${REQUEST_TYPES.map(
              (t, i) => `
            <label class="type" data-sfx>
              <input type="radio" name="type" value="${t.id}"${i === 0 ? ' checked' : ''} />
              <span class="type__box">
                <span class="type__icon">${TYPE_ICON[t.id]}</span>
                <span class="type__label">${t.label}</span>
                <span class="type__note">${t.note}</span>
              </span>
            </label>`,
            ).join('')}
          </div>
        </fieldset>

        <fieldset class="req-field" data-reveal>
          <legend class="req-label"><span class="req-label__no">02</span>どの作品について？<span class="req-req">必須</span></legend>
          <div class="games-pick">
            ${games
              .map(
                (g, i) => `
            <label class="pick" style="${themeVars(g)}" data-sfx>
              <input type="radio" name="game" value="${g.slug}"${i === 0 ? ' checked' : ''} />
              <span class="pick__box"><i aria-hidden="true"></i><span class="pick__title">${esc(g.title)}</span></span>
            </label>`,
              )
              .join('')}
            <label class="pick pick--store" data-sfx>
              <input type="radio" name="game" value="store" />
              <span class="pick__box"><i aria-hidden="true"></i><span class="pick__title">MJ STORE（このサイト）</span></span>
            </label>
          </div>
        </fieldset>

        <fieldset class="req-field req-field--severity" data-reveal data-severity-field>
          <legend class="req-label"><span class="req-label__no">03</span>どのくらい困ってる？</legend>
          <div class="sev">
            <input class="sev__range" type="range" name="severity" min="1" max="${SEVERITY.length}" step="1" value="2" aria-describedby="sev-out" data-severity />
            <output class="sev__out" id="sev-out" data-severity-out>${SEVERITY[1]}</output>
            <ol class="sev__scale" aria-hidden="true">${SEVERITY.map((s) => `<li>${s}</li>`).join('')}</ol>
          </div>
        </fieldset>

        <div class="req-field" data-reveal>
          <label class="req-label" for="req-message"><span class="req-label__no" data-message-no>04</span>内容<span class="req-req">必須</span></label>
          <div class="msg">
            <textarea id="req-message" name="message" rows="7" maxlength="2000" required placeholder="${esc(REQUEST_TYPES[0].placeholder)}" data-message></textarea>
            <p class="msg__count"><span data-count>0</span> / 2000</p>
          </div>
          <label class="check" data-env-field>
            <input type="checkbox" name="attachEnv" checked data-env />
            <span>ブラウザと端末の情報を添える（バグの再現に役立ちます）</span>
          </label>
          <p class="env-preview" data-env-preview></p>
        </div>

        <div class="req-field req-field--two" data-reveal>
          <div>
            <label class="req-label" for="req-name"><span class="req-label__no">05</span>お名前・ニックネーム<span class="req-opt">任意</span></label>
            <input id="req-name" class="input" type="text" name="name" maxlength="60" autocomplete="nickname" placeholder="例）旅する村人" />
          </div>
          <div>
            <label class="req-label" for="req-contact"><span class="req-label__no">06</span>返信がほしい方は、メールアドレス<span class="req-opt">任意</span></label>
            <input id="req-contact" class="input" type="email" name="contact" maxlength="120" autocomplete="email" placeholder="you@example.com" />
          </div>
        </div>

        <div class="hp" aria-hidden="true">
          <label>この欄は空のままにしてください<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
        </div>

        <div class="req-submit" data-reveal>
          <p class="req-error" role="alert" data-req-error hidden></p>
          <button class="btn btn--primary btn--big" type="submit" data-req-submit data-sfx>
            <span data-submit-label>開発チームに届ける</span>${icon.arrow}
          </button>
          <p class="req-small">送っていただいた内容は、作品の改善とご返信のためだけに使います。</p>
        </div>
      </form>

      <div class="ticket" data-ticket hidden tabindex="-1">
        <div class="ticket__card">
          <p class="ticket__label">TICKET</p>
          <p class="ticket__no" data-ticket-no>#MJ-0000</p>
          <p class="ticket__status"><i aria-hidden="true"></i>受付完了</p>
          <dl class="ticket__meta">
            <div><dt>用件</dt><dd data-ticket-type></dd></div>
            <div><dt>作品</dt><dd data-ticket-game></dd></div>
          </dl>
          <p class="ticket__msg">開発チームに届きました。<br />ありがとうございます！</p>
        </div>
        <div class="ticket__crew">
          ${crewHtml()}
          <p class="ticket__thanks">${ph('ちびロボ一同、よろこんでいます。')}</p>
        </div>
        <div class="ticket__actions">
          <button type="button" class="btn btn--ghost" data-ticket-again data-sfx><span>もうひとつ送る</span>${icon.arrow}</button>
        </div>
      </div>
    </section>
  </main>`;
}
