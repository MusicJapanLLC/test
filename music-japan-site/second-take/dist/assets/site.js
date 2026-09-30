(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var lang = body.getAttribute("data-lang") || "ja";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || doc).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };
  var store = {
    get: function (key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set: function (key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }
  };

  // ---------- intro curtain: once per session, first page only ----------
  (function curtain() {
    if (reduceMotion) return;
    try {
      if (window.sessionStorage.getItem("st-intro")) return;
      window.sessionStorage.setItem("st-intro", "1");
    } catch (e) { return; }
    var el = doc.createElement("div");
    el.className = "curtain";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="curtain__inner"><div class="record"><div class="record__disc"><div class="record__label"></div></div><span class="record__slash"></span></div>' +
      '<p class="curtain__text">SECOND <i>/</i> TAKE</p></div>';
    body.appendChild(el);
    window.setTimeout(function () { el.remove(); }, 2000);
  })();

  // ---------- header: transparent over the dark opening, solid after ----------
  var opening = $(".hero, .story-open, .page-open");
  function updateHeader() {
    var limit = opening ? opening.offsetHeight - 80 : 10;
    body.classList.toggle("is-scrolled", window.scrollY > limit);
  }

  // ---------- reading progress + resume (articles) ----------
  var story = $("[data-story]");
  var progressBar = $("[data-progress]");
  var progressKey = "st-progress:" + location.pathname;
  var lastSave = 0;
  function readRatio() {
    if (!story) return 0;
    var start = story.offsetTop;
    var end = start + story.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
  }
  function updateProgress() {
    if (!story || !progressBar) return;
    var ratio = readRatio();
    progressBar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
    var now = Date.now();
    if (now - lastSave > 1200) {
      lastSave = now;
      store.set(progressKey, String(Math.round(ratio * 100)));
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateHeader();
      updateProgress();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateHeader();

  if (story) {
    var saved = Number(store.get(progressKey) || 0);
    var resume = $("[data-resume]");
    if (resume && saved > 8 && saved < 92 && !location.hash) {
      resume.hidden = false;
      $("[data-resume-go]", resume).addEventListener("click", function () {
        var start = story.offsetTop;
        var end = start + story.offsetHeight - window.innerHeight;
        window.scrollTo({ top: start + (end - start) * (saved / 100), behavior: reduceMotion ? "auto" : "smooth" });
        resume.hidden = true;
      });
      $("[data-resume-close]", resume).addEventListener("click", function () { resume.hidden = true; });
      window.setTimeout(function () { resume.hidden = true; }, 12000);
    }
  }

  // ---------- reveal on scroll ----------
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // ---------- timecode (24 fps) ----------
  var timecodes = $$("[data-timecode]");
  if (timecodes.length && !reduceMotion) {
    var t0 = performance.now();
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(timecodes[0]);
    }
    var tick = function (now) {
      if (visible) {
        var frames = Math.floor(((now - t0) / 1000) * 24);
        var ff = frames % 24, s = Math.floor(frames / 24);
        var text = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(ff);
        timecodes.forEach(function (el) { el.textContent = text; });
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  // ---------- decisions: floating portrait ----------
  var float = $(".decision-float");
  var floatImg = $("[data-float-img]");
  if (float && floatImg && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$("[data-float]").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        floatImg.src = link.getAttribute("data-float");
        float.classList.add("is-on");
      });
      link.addEventListener("mouseleave", function () { float.classList.remove("is-on"); });
      link.addEventListener("mousemove", function (event) {
        float.style.transform = "translate3d(" + (event.clientX + 28) + "px," + (event.clientY - 150) + "px,0)";
      });
    });
  }

  // ---------- dialogs ----------
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    body.style.overflow = "hidden";
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }
  $$("dialog").forEach(function (dialog) {
    dialog.addEventListener("close", function () { body.style.overflow = ""; });
    dialog.addEventListener("click", function (event) { if (event.target === dialog) closeDialog(dialog); });
    $$("[data-close]", dialog).forEach(function (btn) { btn.addEventListener("click", function () { closeDialog(dialog); }); });
  });

  var menu = $("[data-menu-dialog]");
  $$("[data-open-menu]").forEach(function (btn) { btn.addEventListener("click", function () { openDialog(menu); }); });
  if (menu) $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { closeDialog(menu); }); });

  // ---------- search ----------
  var searchDialog = $("[data-search-dialog]");
  var searchInput = $("[data-search-input]");
  var searchResults = $("[data-search-results]");
  var index = null;
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function render(query) {
    if (!index || !searchResults) return;
    var q = query.trim().toLowerCase();
    var hits = index.filter(function (item) {
      if (!q) return true;
      return [item.title, item.name, item.company, item.decision, item.tags.join(" "), item.text].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    searchResults.innerHTML = hits.length
      ? hits.map(function (item) {
          return '<li><a href="' + item.url + '"><img src="' + item.image + '" alt="" width="56" height="70" loading="lazy"><div><strong>' +
            escapeHtml(item.title) + "</strong><span>No." + item.no + " — " + escapeHtml(item.name) + " / " + escapeHtml(item.company) + "</span></div></a></li>";
        }).join("")
      : '<li class="empty">' + escapeHtml(searchResults.getAttribute("data-empty")) + "</li>";
  }
  function openSearch() {
    openDialog(searchDialog);
    if (searchInput) window.setTimeout(function () { searchInput.focus(); }, 30);
    if (index) { render(searchInput ? searchInput.value : ""); return; }
    fetch("/assets/search-" + lang + ".json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; render(searchInput ? searchInput.value : ""); })
      .catch(function () { /* offline */ });
  }
  $$("[data-open-search]").forEach(function (btn) { btn.addEventListener("click", openSearch); });
  if (searchInput) searchInput.addEventListener("input", function () { render(searchInput.value); });
  doc.addEventListener("keydown", function (event) {
    var tag = (event.target && event.target.tagName) || "";
    if (event.key === "/" && !/INPUT|TEXTAREA/.test(tag) && !doc.querySelector("dialog[open]")) {
      event.preventDefault();
      openSearch();
    }
  });

  // ---------- archive filters ----------
  var filters = $("[data-filters]");
  if (filters) {
    var rows = $$(".archive-list li");
    $$("button", filters).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tag = btn.getAttribute("data-filter");
        $$("button", filters).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        rows.forEach(function (row) {
          var tags = row.getAttribute("data-tags").split("|");
          row.hidden = !!tag && tags.indexOf(tag) === -1;
          if (!row.hidden) row.classList.add("is-in");
        });
      });
    });
  }

  // ---------- scene TOC ----------
  var tocLinks = $$("[data-toc] a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var scenes = $$("[data-scene]");
    var sceneObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        tocLinks.forEach(function (a) { a.setAttribute("aria-current", String(a.getAttribute("href") === id)); });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    scenes.forEach(function (s) { sceneObserver.observe(s); });
  }

  // ---------- text size ----------
  var sizeBtn = $("[data-size-toggle]");
  if (sizeBtn) {
    var sizes = JSON.parse(sizeBtn.getAttribute("data-sizes"));
    var classes = ["", "text-large", "text-small"];
    var current = Number(store.get("st-text-size") || 0) % 3;
    var applySize = function () {
      body.classList.remove("text-large", "text-small");
      if (classes[current]) body.classList.add(classes[current]);
      sizeBtn.querySelector("span").textContent = sizeBtn.getAttribute("data-label") + "：" + sizes[current];
    };
    applySize();
    sizeBtn.addEventListener("click", function () {
      current = (current + 1) % 3;
      store.set("st-text-size", String(current));
      applySize();
    });
  }

  // ---------- copy link ----------
  $$("[data-copy]").forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      var done = function () {
        btn.textContent = btn.getAttribute("data-copied");
        window.setTimeout(function () { btn.textContent = label; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(done, function () {});
    });
  });

  // ---------- language switch keeps the reader's position within an article ----------
  $$("[data-lang-link]").forEach(function (a) {
    a.addEventListener("click", function () {
      if (story) store.set("st-progress:" + a.getAttribute("href"), String(Math.round(readRatio() * 100)));
    });
  });

  // ---------- retire the old service worker ----------
  if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) { reg.unregister(); });
    }).catch(function () {});
  }
})();
