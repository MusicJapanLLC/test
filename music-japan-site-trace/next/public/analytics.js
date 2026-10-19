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
  function pageInfo() {
    var url = publicUrl(location.href);
    if (router !== 'learning') return {url: url, key: url};
    // Send screen names only. Public content IDs stay in the browser.
    var route = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
    if (!route && host === 'music-japan.com' && location.pathname === '/english/') route = 'learn';
    if (/^(?:learn|lesson|library|practice|session|quest|topic|unit|words|word|review|saved|speak|phrases|dialogue|dialogues|settings|records|shuffle|me|r)(?:\/[a-z0-9_-]{1,80}){0,3}$/i.test(route)) {
      var screen = route.split('/')[0].toLowerCase();
      var page = url.replace(/\/?$/, '/') + '_view/' + screen;
      var detail = /^(?:lesson|topic|unit|word|dialogue|r)$/.test(screen);
      return {url: page, key: detail ? url + '#' + route : page};
    }
    return {url: url, key: url};
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
  var previousKey = '';
  function view() {
    var info = pageInfo();
    var current = info.url;
    if (info.key === previousKey) return;
    window.gtag('event', 'page_view', {
      send_to: id,
      page_location: current,
      page_referrer: previous || publicUrl(document.referrer),
      page_title: document.title
    });
    previous = current;
    previousKey = info.key;
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
