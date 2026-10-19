// Public-page views only. No form answers, recordings, URL queries or private hashes.
(function () {
  'use strict';
  var tag = document.currentScript;
  var id = tag && tag.getAttribute('data-ga4-id');
  var host = tag && tag.getAttribute('data-ga4-host');
  var router = tag && tag.getAttribute('data-ga4-router');
  if (!id || !/^G-[A-Z0-9]+$/.test(id) || location.hostname !== host || window.__musicJapanGa4Loaded) return;
  window.__musicJapanGa4Loaded = true;

  // Query strings/fragments can contain contact details or private tokens.
  function publicUrl(value) {
    try { var url = new URL(value); return url.origin + url.pathname; }
    catch (_) { return ''; }
  }
  function pageUrl() {
    var url = publicUrl(location.href);
    if (router !== 'learning') return url;
    // Only these public app sections may become virtual page paths.
    var route = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
    if (/^(?:learn|lesson|words|word|review|saved|speak|phrases|dialogue|dialogues|settings|records|shuffle|me|r)(?:\/[a-z0-9_-]{1,80}){0,3}$/i.test(route)) {
      return url.replace(/\/?$/, '/') + '_view/' + route;
    }
    return url;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    send_page_view: false,
    page_location: publicUrl(location.href),
    page_referrer: publicUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var previous = '';
  function view() {
    var current = pageUrl();
    if (current === previous) return;
    window.gtag('event', 'page_view', {
      send_to: id,
      page_location: current,
      page_referrer: previous || publicUrl(document.referrer),
      page_title: document.title
    });
    previous = current;
  }
  view();
  window.addEventListener('hashchange', view);
  window.addEventListener('popstate', view);
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      view();
      return result;
    };
  });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
})();
