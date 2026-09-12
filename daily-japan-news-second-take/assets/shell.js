(function () {
  const body = document.body;

  const header = `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-logo daily-wordmark" href="/" aria-label="Daily Japan News トップへ">
          <span class="daily-wordmark__top">DAILY</span><span class="daily-wordmark__main">JAPAN <em>NEWS</em></span>
        </a>
        <nav class="desktop-nav" aria-label="メインナビゲーション">
          <a href="#articles">LATEST</a>
          <a href="#briefs">QUICK BRIEF</a>
          <a href="#popular">POPULAR</a>
          <a href="#themes">TOPICS</a>
          <a href="#about">ABOUT</a>
        </nav>
        <div class="header-actions">
          <a class="edition-switch" href="https://daily-japan-news.vocal-shore-1441.chatgpt.site/en/" aria-label="English edition">EN</a>
          <button class="icon-button" type="button" data-open="search" aria-label="記事を検索"><span class="search-icon" aria-hidden="true"></span></button>
          <button class="icon-button" type="button" data-open="menu" aria-label="メニューを開く"><span class="menu-icon" aria-hidden="true"></span></button>
        </div>
      </div>
    </header>`;

  const skipLink = body.querySelector('.skip-link');
  if (skipLink) skipLink.insertAdjacentHTML('afterend', header);
  else body.insertAdjacentHTML('afterbegin', header);

  const dialogs = `
    <dialog class="menu-dialog" id="site-menu" aria-label="サイトメニュー">
      <div class="dialog-head"><span class="dialog-title">DAILY JAPAN NEWS</span><button class="dialog-close" type="button" data-close aria-label="メニューを閉じる">×</button></div>
      <div class="menu-body">
        <div class="menu-search"><label class="visually-hidden" for="menu-search-input">記事を検索</label><input id="menu-search-input" type="search" placeholder="テーマ、企業、キーワードから探す" autocomplete="off"><button class="icon-button" type="button" data-open="search" aria-label="検索画面を開く"><span class="search-icon" aria-hidden="true"></span></button><div class="menu-quick-results" id="menu-search-results" hidden></div></div>
        <nav class="menu-primary" aria-label="メニュー">
          <a href="#articles" data-close-menu-link>最新ニュース</a>
          <a href="#briefs" data-close-menu-link>3分で要点</a>
          <a href="#popular" data-close-menu-link>よく読まれている記事</a>
          <a href="#themes" data-close-menu-link>テーマから読む</a>
          <a href="#about" data-close-menu-link>Daily Japan Newsについて</a>
          <a href="https://daily-japan-news.vocal-shore-1441.chatgpt.site/en/">English Edition</a>
        </nav>
        <div class="menu-utility"><button type="button" data-reader-size>Aa　文字サイズ</button><button type="button" data-open="cookies">Cookie設定</button><a href="https://music-japan.pages.dev/">運営会社</a></div>
      </div>
    </dialog>

    <dialog class="search-dialog" id="search-dialog" aria-label="記事検索">
      <div class="dialog-head"><span class="dialog-title">SEARCH</span><button class="dialog-close" type="button" data-close aria-label="検索を閉じる">×</button></div>
      <div class="search-body"><label class="visually-hidden" for="page-search-input">記事を検索</label><input class="page-search-input" id="page-search-input" type="search" placeholder="AI、経済、半導体、外交…" autocomplete="off"><p class="search-count" id="search-count">6 ARTICLES</p><div class="search-results" id="search-results"></div></div>
    </dialog>

    <dialog class="cookie-dialog" id="cookie-dialog" aria-label="Cookie設定">
      <div class="dialog-head"><span class="dialog-title">PRIVACY</span><button class="dialog-close" type="button" data-close aria-label="Cookie設定を閉じる">×</button></div>
      <div class="cookie-body"><p class="eyebrow">Cookie settings</p><h2 class="section-title">読む体験を<br>自分のものに</h2><div class="cookie-choice"><span><strong>必要なCookie</strong><small>検索設定や文字サイズの保存に使用</small></span><span>常にON</span></div><div class="cookie-choice"><span><strong>アクセス解析</strong><small>読まれている記事や改善点の把握に使用</small></span><label class="switch"><input id="cookie-analytics" type="checkbox"><span aria-hidden="true"></span><span class="visually-hidden">アクセス解析を許可</span></label></div><button class="button button--red" id="cookie-save" type="button">設定を保存</button></div>
    </dialog>`;
  body.insertAdjacentHTML('beforeend', dialogs);

  const footer = `
    <footer class="site-footer"><div class="site-footer__inner">
      <div class="footer-news-brand"><strong>DAILY JAPAN NEWS</strong><span>Japan, made clear.</span></div>
      <div class="footer-grid"><nav class="footer-nav" aria-label="フッターナビゲーション"><a href="#articles">最新ニュース</a><a href="#popular">人気記事</a><a href="#themes">テーマ</a><a href="#about">私たちについて</a><a href="https://daily-japan-news.vocal-shore-1441.chatgpt.site/en/">English</a><button class="footer-button" type="button" data-open="cookies">Cookie設定</button></nav></div>
      <p class="copyright">© 2026 MUSIC JAPAN LLC</p>
    </div></footer>`;
  body.insertAdjacentHTML('beforeend', footer);

  const cookie = `<section class="cookie-banner" id="cookie-banner" aria-label="Cookieについて" hidden><h2>Cookieについて</h2><p>文字サイズの保存、利用状況の把握にCookieを使用します</p><div class="cookie-actions"><button type="button" data-cookie-essential>必要なものだけ</button><button class="accept-all" type="button" data-cookie-accept>すべて許可</button></div></section><button class="scroll-top" id="scroll-top" type="button" aria-label="ページ上部へ戻る">↑</button>`;
  body.insertAdjacentHTML('beforeend', cookie);
})();
