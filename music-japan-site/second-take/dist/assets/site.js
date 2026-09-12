(function () {
  const articles = window.SECOND_TAKE_ARTICLES || [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function rootPath(path) {
    return path;
  }

  function openDialog(dialog) {
    if (!dialog) return;
    $$('dialog[open]').forEach((open) => {
      if (open !== dialog) open.close();
    });
    if (dialog.open) return;
    dialog.showModal();
    document.body.classList.add("modal-open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.close();
    if (!$("dialog[open]")) document.body.classList.remove("modal-open");
  }

  const menu = $("#site-menu");
  const searchDialog = $("#search-dialog");
  const tocDialog = $("#toc-dialog");
  const cookieDialog = $("#cookie-dialog");

  $$('[data-open="menu"]').forEach((button) => button.addEventListener("click", () => openDialog(menu)));
  $$('[data-open="search"]').forEach((button) => button.addEventListener("click", () => {
    const query = button.dataset.searchQuery;
    openDialog(searchDialog);
    if (query && pageSearch) {
      pageSearch.value = query;
      pageSearch.dispatchEvent(new Event("input"));
    }
    window.setTimeout(() => pageSearch?.focus(), 40);
  }));
  $$('[data-open="toc"]').forEach((button) => button.addEventListener("click", () => openDialog(tocDialog)));
  $$('[data-open="cookies"]').forEach((button) => button.addEventListener("click", () => openDialog(cookieDialog)));

  $$('[data-close]').forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && !dialog.classList.contains("menu-dialog")) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!$("dialog[open]")) document.body.classList.remove("modal-open");
    });
  });

  function articleMatches(article, query) {
    const haystack = [
      article.title,
      article.shortTitle,
      article.person,
      article.company,
      article.role,
      article.theme,
      article.description,
      ...(article.tags || [])
    ].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }

  function quickResultMarkup(article) {
    return `<a class="quick-result" href="${rootPath(article.href)}">
      <img src="${rootPath(article.image)}" width="56" height="56" alt="" loading="lazy">
      <span><strong>${article.shortTitle}</strong><span>${article.company} / ${article.person}</span></span>
    </a>`;
  }

  const quickInput = $("#menu-search-input");
  const quickResults = $("#menu-search-results");
  if (quickInput && quickResults) {
    quickInput.addEventListener("input", () => {
      const query = quickInput.value;
      const matches = query ? articles.filter((article) => articleMatches(article, query)) : [];
      quickResults.innerHTML = matches.slice(0, 3).map(quickResultMarkup).join("");
      quickResults.hidden = !query;
      if (query && matches.length === 0) {
        quickResults.innerHTML = '<p class="empty-state">一致するサンプル記事はありません</p>';
      }
    });
  }

  function searchResultMarkup(article) {
    return `<a class="search-result-card" href="${rootPath(article.href)}">
      <img src="${rootPath(article.image)}" width="150" height="180" alt="${article.company} ${article.person}のサンプル写真" loading="lazy">
      <span>
        <span class="tag-line">${article.theme} · ${article.readTime}</span>
        <h2>${article.title}</h2>
        <p>${article.description}</p>
      </span>
    </a>`;
  }

  const pageSearch = $("#page-search-input");
  const pageResults = $("#search-results");
  const searchCount = $("#search-count");
  if (pageSearch && pageResults) {
    const renderSearch = () => {
      const query = pageSearch.value;
      const matches = query ? articles.filter((article) => articleMatches(article, query)) : articles;
      pageResults.innerHTML = matches.length
        ? matches.map(searchResultMarkup).join("")
        : '<p class="empty-state">一致するサンプル記事はありません<br>人物名、会社名、テーマを変えて検索してください</p>';
      if (searchCount) searchCount.textContent = `${matches.length} ARTICLES`;
    };
    pageSearch.addEventListener("input", renderSearch);
    renderSearch();
  }

  const readerModes = ["reader-compact", "", "reader-large"];
  let readerIndex = Number(localStorage.getItem("st-reader-index") || 1);
  function applyReaderMode() {
    document.body.classList.remove("reader-compact", "reader-large");
    if (readerModes[readerIndex]) document.body.classList.add(readerModes[readerIndex]);
    $$('[data-reader-size]').forEach((button) => {
      button.setAttribute("aria-label", `文字サイズを変更 現在${readerIndex === 0 ? "小" : readerIndex === 2 ? "大" : "標準"}`);
    });
  }
  applyReaderMode();
  $$('[data-reader-size]').forEach((button) => {
    button.addEventListener("click", () => {
      readerIndex = (readerIndex + 1) % readerModes.length;
      localStorage.setItem("st-reader-index", String(readerIndex));
      applyReaderMode();
    });
  });

  const progress = $("#reading-progress");
  const dock = $("#bottom-dock");
  const scrollTop = $("#scroll-top");
  const articleBody = $(".article-body");
  let lastY = window.scrollY;
  let progressWriteTimer;

  function updateScrollUi() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? Math.min(100, (y / max) * 100) : 0;
    if (progress) progress.style.width = `${percent}%`;
    if (scrollTop) scrollTop.classList.toggle("is-visible", y > 520);
    if (dock) {
      dock.classList.toggle("is-hidden", y > lastY && y > 180);
      lastY = y;
    }
    if (articleBody && y > 240) {
      clearTimeout(progressWriteTimer);
      progressWriteTimer = setTimeout(() => {
        localStorage.setItem(`st-progress:${location.pathname}`, String(Math.round(percent)));
      }, 250);
    }
  }

  window.addEventListener("scroll", updateScrollUi, { passive: true });
  updateScrollUi();

  if (scrollTop) {
    scrollTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const savedProgress = Number(localStorage.getItem(`st-progress:${location.pathname}`) || 0);
  if (articleBody && savedProgress >= 10 && savedProgress <= 90) {
    const banner = document.createElement("div");
    banner.className = "continue-banner";
    banner.innerHTML = `前回は${savedProgress}%まで読みました　<button type="button" data-resume>続きから読む</button><button type="button" class="continue-banner__close" aria-label="閉じる">×</button>`;
    document.body.appendChild(banner);
    $("[data-resume]", banner).addEventListener("click", () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * (savedProgress / 100), behavior: "smooth" });
      banner.remove();
    });
    $(".continue-banner__close", banner).addEventListener("click", () => banner.remove());
  }

  async function enableNotifications(button) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      button.textContent = "このブラウザは通知に未対応です";
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        localStorage.setItem("st-notifications", "enabled");
        await registration.showNotification("SECOND TAKE", {
          body: "新着通知の準備ができました　これはサンプル通知です",
          icon: "/assets/second-take-cover.png",
          badge: "/favicon.svg"
        });
        $$('[data-enable-notifications]').forEach((target) => { target.textContent = "通知はONです"; });
      } else {
        button.textContent = "通知は許可されませんでした";
      }
    } catch (error) {
      button.textContent = "通知設定を確認してください";
    }
  }

  $$('[data-enable-notifications]').forEach((button) => {
    if (localStorage.getItem("st-notifications") === "enabled") button.textContent = "通知はONです";
    button.addEventListener("click", () => enableNotifications(button));
  });

  $$('[data-newsletter-form]').forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = $("input[type=email]", form);
      const status = $(".form-status", form);
      if (!email || !email.checkValidity()) {
        if (status) status.textContent = "メールアドレスを確認してください";
        return;
      }
      localStorage.setItem("st-newsletter-demo", "registered");
      if (status) status.textContent = "表示テスト完了　入力内容は保存・送信していません";
      email.value = "";
    });
  });

  const cookieBanner = $("#cookie-banner");
  const consentKey = "st-cookie-consent";
  if (cookieBanner && !localStorage.getItem(consentKey)) cookieBanner.hidden = false;

  function saveConsent(analytics) {
    localStorage.setItem(consentKey, JSON.stringify({ essential: true, analytics, updatedAt: new Date().toISOString() }));
    if (cookieBanner) cookieBanner.hidden = true;
    closeDialog(cookieDialog);
  }

  $$('[data-cookie-accept]').forEach((button) => button.addEventListener("click", () => saveConsent(true)));
  $$('[data-cookie-essential]').forEach((button) => button.addEventListener("click", () => saveConsent(false)));
  const cookieSave = $("#cookie-save");
  if (cookieSave) {
    cookieSave.addEventListener("click", () => {
      const analytics = $("#cookie-analytics");
      saveConsent(Boolean(analytics && analytics.checked));
    });
  }

  const currentConsent = localStorage.getItem(consentKey);
  if (currentConsent) {
    try {
      const parsed = JSON.parse(currentConsent);
      const analytics = $("#cookie-analytics");
      if (analytics) analytics.checked = Boolean(parsed.analytics);
    } catch (_) {}
  }

  $$('[data-close-menu-link]').forEach((link) => link.addEventListener("click", () => closeDialog(menu)));
})();
