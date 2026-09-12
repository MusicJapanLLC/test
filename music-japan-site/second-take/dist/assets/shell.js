(function () {
  const body = document.body;
  const isArticle = body.classList.contains("article-page");
  const nextArticle = body.dataset.next || "/articles/rebuild-night/";

  const header = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-logo" href="/" aria-label="SECOND TAKE トップへ">
          <img src="/assets/second-take-logo-header.png" width="700" height="243" alt="SECOND TAKE BUSINESS × LIFE">
        </a>
        <nav class="desktop-nav" aria-label="メインナビゲーション">
          <a href="/#articles">ARTICLES</a>
          <a href="/#popular">POPULAR</a>
          <a href="/#themes">THEMES</a>
          <a href="/#about">ABOUT</a>
          <a href="/#podcast">LISTEN</a>
        </nav>
        <div class="header-actions">
          <button class="icon-button" type="button" data-open="search" aria-label="記事を検索">
            <span class="search-icon" aria-hidden="true"></span>
          </button>
          <button class="icon-button" type="button" data-open="menu" aria-label="メニューを開く">
            <span class="menu-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </header>`;

  const skipLink = body.querySelector(".skip-link");
  if (skipLink) skipLink.insertAdjacentHTML("afterend", header);
  else body.insertAdjacentHTML("afterbegin", header);

  const dialogs = `
    <dialog class="menu-dialog" id="site-menu" aria-label="サイトメニュー">
      <div class="dialog-head">
        <span class="dialog-title">SECOND TAKE</span>
        <button class="dialog-close" type="button" data-close aria-label="メニューを閉じる">×</button>
      </div>
      <div class="menu-body">
        <div class="menu-search">
          <label class="visually-hidden" for="menu-search-input">記事を検索</label>
          <input id="menu-search-input" type="search" placeholder="人物、会社、決断から探す" autocomplete="off">
          <button class="icon-button" type="button" data-open="search" aria-label="検索画面を開く"><span class="search-icon" aria-hidden="true"></span></button>
          <div class="menu-quick-results" id="menu-search-results" hidden></div>
        </div>
        <nav class="menu-primary" aria-label="メニュー">
          <a href="/#articles" data-close-menu-link>新着インタビュー</a>
          <a href="/#popular" data-close-menu-link>人気記事</a>
          <a href="/#themes" data-close-menu-link>テーマから読む</a>
          <a href="/#about" data-close-menu-link>SECOND TAKEについて</a>
          <a href="/#podcast" data-close-menu-link>Podcast</a>
          <a href="/#newsletter" data-close-menu-link>メールで受け取る</a>
        </nav>
        <div class="menu-utility">
          <button type="button" data-enable-notifications>新着通知をONにする</button>
          <button type="button" data-reader-size>Aa　文字サイズ：標準</button>
          <button type="button" data-open="cookies">Cookie設定</button>
          <a href="https://music-japan.pages.dev/company/" target="_blank" rel="noopener">合同会社Music Japan ↗</a>
        </div>
      </div>
    </dialog>

    <dialog class="search-dialog" id="search-dialog" aria-label="記事検索">
      <div class="dialog-head">
        <span class="dialog-title">SEARCH</span>
        <button class="dialog-close" type="button" data-close aria-label="検索を閉じる">×</button>
      </div>
      <div class="search-body">
        <label class="visually-hidden" for="page-search-input">記事を検索</label>
        <input class="page-search-input" id="page-search-input" type="search" placeholder="人物名、会社名、失敗、決断…" autocomplete="off">
        <p class="search-count" id="search-count">3 ARTICLES</p>
        <div class="search-results" id="search-results"></div>
      </div>
    </dialog>

    <dialog class="toc-dialog" id="toc-dialog" aria-label="記事の目次">
      <div class="dialog-head">
        <span class="dialog-title">CONTENTS</span>
        <button class="dialog-close" type="button" data-close aria-label="目次を閉じる">×</button>
      </div>
      <div class="toc-body"><nav class="toc-list" id="toc-list"></nav></div>
    </dialog>

    <dialog class="cookie-dialog" id="cookie-dialog" aria-label="Cookie設定">
      <div class="dialog-head">
        <span class="dialog-title">PRIVACY</span>
        <button class="dialog-close" type="button" data-close aria-label="Cookie設定を閉じる">×</button>
      </div>
      <div class="cookie-body">
        <p class="eyebrow">Cookie settings</p>
        <h2 class="section-title">読む体験を<br>自分のものに</h2>
        <div class="cookie-choice">
          <span><strong>必要なCookie</strong><small>検索設定や読書位置の保存に使用</small></span>
          <span>常にON</span>
        </div>
        <div class="cookie-choice">
          <span><strong>アクセス解析</strong><small>読まれている記事や改善点の把握に使用</small></span>
          <label class="switch"><input id="cookie-analytics" type="checkbox"><span aria-hidden="true"></span><span class="visually-hidden">アクセス解析を許可</span></label>
        </div>
        <button class="button button--red" id="cookie-save" type="button">設定を保存</button>
      </div>
    </dialog>

    <dialog class="notification-dialog" id="notification-dialog" aria-label="通知を受け取る">
      <div class="dialog-head">
        <span class="dialog-title">NOTIFICATIONS</span>
        <button class="dialog-close" type="button" data-close aria-label="通知の案内を閉じる">×</button>
      </div>
      <div class="notification-guide">
        <p class="eyebrow">Notifications on iPhone</p>
        <h2>ホーム画面に追加すると、<br>新着通知を受け取れます</h2>
        <ol>
          <li><strong>共有ボタンをタップ</strong><span>画面下部の共有アイコンを開きます</span></li>
          <li><strong>「ホーム画面に追加」を選ぶ</strong><span>SECOND TAKEをホーム画面へ追加します</span></li>
          <li><strong>ホーム画面から開いて通知をON</strong><span>メニューから、もう一度通知ボタンを押してください</span></li>
        </ol>
        <button class="button button--red" type="button" data-close>閉じる</button>
      </div>
    </dialog>`;

  body.insertAdjacentHTML("beforeend", dialogs);

  const footer = `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="footer-grid">
          <nav class="footer-nav" aria-label="フッターナビゲーション">
            <a href="/#articles">新着記事</a>
            <a href="/#popular">人気記事</a>
            <a href="/#themes">テーマ</a>
            <a href="/#about">私たちについて</a>
            <a href="/#podcast">Podcast</a>
            <button class="footer-button" type="button" data-open="cookies">Cookie設定</button>
            <a href="https://music-japan.pages.dev/company/" target="_blank" rel="noopener">運営会社公式サイト ↗</a>
          </nav>
        </div>
        <p class="copyright">© 2026 MUSIC JAPAN LLC　PHOTO: SAMPLE / UNSPLASH</p>
      </div>
    </footer>`;

  body.insertAdjacentHTML("beforeend", footer);

  const cookie = `
    <section class="cookie-banner" id="cookie-banner" aria-label="Cookieについて" hidden>
      <h2>Cookieについて</h2>
      <p>読みかけ位置や文字サイズの保存、利用状況の把握にCookieを使用します。</p>
      <div class="cookie-actions">
        <button type="button" data-cookie-essential>必要なものだけ</button>
        <button class="accept-all" type="button" data-cookie-accept>すべて許可</button>
      </div>
    </section>
    <button class="scroll-top" id="scroll-top" type="button" aria-label="ページ上部へ戻る">↑</button>`;

  body.insertAdjacentHTML("beforeend", cookie);

  if (isArticle) {
    const dock = `
      <nav class="bottom-dock" id="bottom-dock" aria-label="記事クイックメニュー">
        <button type="button" data-open="toc">目次</button>
        <button type="button" data-open="search">検索</button>
        <a href="/">トップ</a>
        <a href="${nextArticle}">次へ</a>
      </nav>`;
    body.insertAdjacentHTML("beforeend", dock);

    const tocList = document.querySelector("#toc-list");
    document.querySelectorAll(".article-body h2").forEach((heading, index) => {
      if (!heading.id) heading.id = `chapter-${index + 1}`;
      const link = document.createElement("a");
      const number = document.createElement("span");
      const title = document.createElement("span");
      const headingCopy = heading.cloneNode(true);
      headingCopy.querySelector(".chapter")?.remove();
      link.href = `#${heading.id}`;
      number.className = "toc-list__number";
      number.textContent = `${String(index + 1).padStart(2, "0")}.`;
      title.className = "toc-list__title";
      title.textContent = headingCopy.textContent.trim();
      link.append(number, title);
      link.addEventListener("click", () => document.querySelector("#toc-dialog")?.close());
      tocList?.appendChild(link);
    });
  }
})();
