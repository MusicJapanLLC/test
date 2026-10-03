// One page_view per document, on the named production host only.
(function () {
  'use strict';
  var tag = document.currentScript;
  var id = tag && tag.getAttribute('data-ga4-id');
  var host = tag && tag.getAttribute('data-ga4-host');
  if (!id || !/^G-[A-Z0-9]+$/.test(id) || location.hostname !== host || window.__musicJapanGa4Loaded) return;
  window.__musicJapanGa4Loaded = true;

  // Query strings/fragments can contain contact details or private tokens.
  function publicUrl(value) {
    try { var url = new URL(value); return url.origin + url.pathname; }
    catch (_) { return ''; }
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, {
    send_page_view: true,
    page_location: publicUrl(location.href),
    page_referrer: publicUrl(document.referrer),
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
})();
