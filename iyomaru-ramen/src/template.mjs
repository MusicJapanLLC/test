import { icon } from './icons.mjs';

const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const FEATURE_ICONS = ['noSmoking', 'wifi', 'plug', 'chair'];
const HREFLANG = { ja: 'ja', en: 'en', zh: 'zh-Hans', ko: 'ko' };
const FONT_FAMILIES = {
  ja: 'family=Shippori+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900',
  en: 'family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700;800',
  zh: 'family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500;600;700',
  ko: 'family=Noto+Serif+KR:wght@600;700&family=Noto+Sans+KR:wght@400;500;600;700',
};

function fontHref(locale) {
  return `https://fonts.googleapis.com/css2?${FONT_FAMILIES[locale]}&display=swap`;
}

function buildJsonLd({ locale, data, config, canonicalUrl, ogImageUrl }) {
  const openingHoursSpecification = data.hours.days
    .filter((d) => !d.closed)
    .map((d, i) => {
      const [opens, closes] = d.hours.split(/[–-]/).map((s) => s.trim());
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${{
          Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
        }[DAY_CODES[data.hours.days.indexOf(d)]]}`,
        opens,
        closes,
      };
    });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: config.storeName.ja,
    alternateName: config.storeName.en,
    url: canonicalUrl,
    image: [ogImageUrl],
    telephone: config.phoneDisplay,
    priceRange: config.priceRange,
    servesCuisine: 'Ramen',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '日の出町11-5',
      addressLocality: '富良野市',
      addressRegion: '北海道',
      postalCode: '076-0025',
      addressCountry: 'JP',
    },
    geo: { '@type': 'GeoCoordinates', latitude: config.latitude, longitude: config.longitude },
    openingHoursSpecification,
    sameAs: [config.instagramUrl],
    inLanguage: HREFLANG[locale],
  };
  return JSON.stringify(jsonLd);
}

function renderHead({ locale, data, config, url, canonicalUrl, ogImageUrl, alternates }) {
  const hreflangLinks = alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}">`)
    .join('\n    ');
  const jsonLd = buildJsonLd({ locale, data, config, canonicalUrl, ogImageUrl });
  return `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${data.meta.title}</title>
    <meta name="description" content="${data.meta.description}">
    <link rel="canonical" href="${canonicalUrl}">
    ${hreflangLinks}
    <link rel="alternate" hreflang="x-default" href="${alternates.find((a) => a.locale === config.defaultLocale).href}">
    <meta property="og:type" content="restaurant.restaurant">
    <meta property="og:site_name" content="${config.storeName[locale]}">
    <meta property="og:title" content="${data.meta.ogTitle}">
    <meta property="og:description" content="${data.meta.ogDescription}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${ogImageUrl}">
    <meta property="og:locale" content="${data.meta.ogLocale}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#23211d">
    <link rel="icon" href="${url('assets/img/favicon.svg')}" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${fontHref(locale)}">
    <link rel="stylesheet" href="${url('assets/css/styles.css')}">
    <script type="application/ld+json">${jsonLd}</script>`;
}

function renderHeader({ data, config, locale, url }) {
  const navItems = [
    ['concept', data.nav.concept],
    ['menu', data.nav.menu],
    ['hours', data.nav.hours],
    ['gallery', data.nav.gallery],
    ['news', data.nav.news],
  ];
  const langLinks = config.locales
    .map(
      (loc) =>
        `<a href="${url(loc === config.defaultLocale ? '' : `${loc}/`)}" aria-current="${loc === locale}">${data.langSwitcher[loc]}</a>`
    )
    .join('');
  return `<header class="site-header" id="siteHeader">
    <div class="container">
      <a class="brand" href="${url(locale === config.defaultLocale ? '' : `${locale}/`)}">
        <span class="brand-ja">${config.storeName[locale]}</span>
        <span class="brand-sub">FURANO, HOKKAIDO</span>
      </a>
      <nav class="primary-nav" aria-label="Primary">
        <ul>
          ${navItems.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('\n          ')}
        </ul>
      </nav>
      <div class="header-actions">
        <a class="btn btn-primary btn-call-header" href="tel:${config.phoneHref}">
          ${icon('phone')}${data.nav.call}
        </a>
        <div class="lang-switch" data-lang-switch>
          <button class="lang-switch-btn" type="button" data-lang-toggle aria-haspopup="true" aria-expanded="false" aria-label="${data.a11y.langSwitcherLabel}">
            ${icon('globe')}<span>${locale.toUpperCase()}</span>
          </button>
          <div class="lang-menu" role="menu">${langLinks}</div>
        </div>
        <button class="nav-toggle" type="button" data-mobile-nav-open aria-label="${data.a11y.openMenu}">
          ${icon('menuBars')}
        </button>
      </div>
    </div>
  </header>
  <div class="mobile-nav" data-mobile-nav>
    <div class="mobile-nav-head">
      <span class="brand-ja">${config.storeName[locale]}</span>
      <button class="mobile-nav-close" type="button" data-mobile-nav-close aria-label="${data.a11y.closeMenu}">${icon('close')}</button>
    </div>
    <ul>
      ${navItems.map(([id, label]) => `<li><a href="#${id}" data-mobile-nav-link>${label}</a></li>`).join('\n      ')}
    </ul>
    <a class="btn btn-primary" style="margin-top:1.5rem;align-self:flex-start" href="tel:${config.phoneHref}">${icon('phone')}${data.nav.call}</a>
    <div class="mobile-nav-lang">
      ${config.locales
        .map(
          (loc) =>
            `<a href="${url(loc === config.defaultLocale ? '' : `${loc}/`)}" aria-current="${loc === locale}">${data.langSwitcher[loc]}</a>`
        )
        .join('')}
    </div>
    <p class="mobile-nav-foot">${config.addressJa}</p>
  </div>`;
}

function renderHero({ data, config }) {
  const showPaymentBadge = data.ui.showPaymentBadge;
  return `<section class="hero" id="hero">
    <div class="hero-media" aria-hidden="true"></div>
    <div class="steam" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="hero-inner container">
      <p class="eyebrow hero-eyebrow">${data.hero.eyebrow}</p>
      <h1 class="hero-title">${data.hero.titleLines.map((l) => `<span>${l}</span>`).join('')}</h1>
      <p class="hero-tagline">${data.hero.tagline}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#menu">${icon('bowlMark')}${data.hero.ctaMenu}</a>
        <a class="btn btn-ghost" href="#hours">${icon('pin')}${data.hero.ctaHours}</a>
      </div>
      <div class="rating-badge">
        <span class="stars">★★★★☆</span>
        <span>${data.hero.ratingBadge}</span>
      </div>
      ${showPaymentBadge ? `<div class="payment-badge">${icon('qr')}<span>${data.ui.paymentBadgeText}</span></div>` : ''}
    </div>
    <div class="scroll-hint" aria-hidden="true"><span>${data.hero.scrollHint}</span>${icon('chevronDown')}</div>
  </section>`;
}

function renderConcept({ data }) {
  return `<section class="concept alt-bg" id="concept">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${data.concept.eyebrow}</p>
        <h2 class="section-title">${data.concept.title}</h2>
      </div>
      <div class="concept-grid reveal-stagger">
        ${data.concept.items
          .map(
            (item, i) => `<div class="concept-card reveal" style="--i:${i}">
          <div class="concept-icon">${icon(item.icon)}</div>
          <h3>${item.title}</h3>
          <p>${item.text}</p>
        </div>`
          )
          .join('\n        ')}
      </div>
    </div>
  </section>`;
}

function renderMenu({ data }) {
  return `<section class="menu" id="menu">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${data.menu.eyebrow}</p>
        <h2 class="section-title">${data.menu.title}</h2>
      </div>
      <div class="menu-grid reveal-stagger">
        ${data.menu.items
          .map(
            (item, i) => `<article class="menu-card reveal" style="--i:${i}">
          <div class="menu-photo">
            <span class="menu-tag">${item.tag}</span>
            ${icon('bowlMark', 'bowl-mark')}
          </div>
          <div class="menu-body">
            <h3>${item.name}</h3>
            <p>${item.desc}</p>
            <span class="menu-price">${item.price}</span>
          </div>
        </article>`
          )
          .join('\n        ')}
      </div>
      <p class="menu-note">${data.menu.priceNote}</p>
    </div>
  </section>`;
}

function renderHours({ data, config }) {
  const mapQuery = encodeURIComponent(config.mapsQuery);
  const mapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  return `<section class="hours alt-bg" id="hours">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${data.hours.eyebrow}</p>
        <h2 class="section-title">${data.hours.title}</h2>
      </div>
      <div class="hours-grid">
        <div class="reveal">
          <div class="hours-card">
            <table class="hours-table">
              <caption class="sr-only">${data.hours.hoursLabel}</caption>
              <tbody>
                ${data.hours.days
                  .map(
                    (d) => `<tr class="${d.closed ? 'is-closed' : ''}">
                  <th scope="row">${d.label}</th>
                  <td>${d.closed ? `<span class="closed-pill">${d.hours}</span>` : d.hours}</td>
                </tr>`
                  )
                  .join('\n                ')}
              </tbody>
            </table>
            <div class="hours-meta">
              <p class="closed-note">${data.hours.closedNote}</p>
              <p class="vary-note">${data.hours.varyNote}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-list">
              <div class="info-row">
                <span class="info-icon">${icon('pin')}</span>
                <div>
                  <h4>${data.hours.addressLabel}</h4>
                  <p>${data.hours.address}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">${icon('chair')}</span>
                <div>
                  <h4>${data.hours.accessLabel}</h4>
                  <p>${data.hours.access}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">${icon('parking')}</span>
                <div>
                  <h4>${data.hours.parkingLabel}</h4>
                  <p>${data.hours.parking}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">${icon('chair')}</span>
                <div>
                  <h4>${data.hours.seatsLabel}</h4>
                  <p>${data.hours.seats}</p>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">${icon('wifi')}</span>
                <div>
                  <h4>${data.hours.featuresLabel}</h4>
                  <div class="feature-chips">
                    ${data.hours.features
                      .map((f, i) => `<span class="chip">${icon(FEATURE_ICONS[i] || 'chair')}${f}</span>`)
                      .join('')}
                  </div>
                </div>
              </div>
              <div class="info-row">
                <span class="info-icon">${icon('card')}</span>
                <div>
                  <h4>${data.hours.paymentLabel}</h4>
                  <div class="payment-chips">
                    ${data.hours.payments.map((p) => `<span class="chip">${icon('qr')}${p}</span>`).join('')}
                  </div>
                </div>
              </div>
            </div>
            <a class="btn btn-primary call-cta" href="tel:${config.phoneHref}">${icon('phone')}${data.hours.callCta}</a>
          </div>
        </div>
        <div class="reveal">
          <div class="map-card">
            <iframe class="map-frame" src="${mapEmbedSrc}" title="${config.storeName.ja} — Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            <div class="map-foot">
              <span>${config.addressJa}</span>
              <a href="${mapLink}" target="_blank" rel="noopener">${data.hours.mapCaption}${icon('chevronRight')}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderGallery({ data }) {
  return `<section class="gallery" id="gallery">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${data.gallery.eyebrow}</p>
        <h2 class="section-title">${data.gallery.title}</h2>
      </div>
      <div class="gallery-grid reveal-stagger">
        ${data.gallery.items
          .map(
            (item, i) => `<button class="gallery-item tone-${(i % 6) + 1} reveal" style="--i:${i}" type="button" data-lightbox-trigger data-index="${i}" data-caption="${item.caption}">
          <span class="gallery-photo" aria-hidden="true"></span>
          <span class="gallery-caption">${item.caption}</span>
        </button>`
          )
          .join('\n        ')}
      </div>
    </div>
  </section>
  <div class="lightbox" id="lightbox" data-lightbox hidden>
    <div class="lightbox-figure">
      <button class="lightbox-close" type="button" data-lightbox-close aria-label="${data.a11y.closeLightbox}">${icon('close')}</button>
      <button class="lightbox-nav prev" type="button" data-lightbox-prev aria-label="${data.a11y.prevImage}">${icon('chevronLeft')}</button>
      <button class="lightbox-nav next" type="button" data-lightbox-next aria-label="${data.a11y.nextImage}">${icon('chevronRight')}</button>
      <div class="lightbox-photo" data-lightbox-photo></div>
      <p class="lightbox-caption" data-lightbox-caption></p>
    </div>
  </div>`;
}

function renderNews({ data }) {
  return `<section class="news alt-bg" id="news">
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${data.news.eyebrow}</p>
        <h2 class="section-title">${data.news.title}</h2>
      </div>
      <div class="news-list reveal-stagger">
        ${data.news.items
          .map(
            (item, i) => `<div class="news-item reveal" style="--i:${i}">
          <span class="news-date">${item.date}</span>
          <span class="news-text">${item.text}</span>
        </div>`
          )
          .join('\n        ')}
      </div>
    </div>
  </section>`;
}

function renderFooter({ data, config, locale, url }) {
  const navItems = [
    ['concept', data.nav.concept],
    ['menu', data.nav.menu],
    ['hours', data.nav.hours],
    ['gallery', data.nav.gallery],
    ['news', data.nav.news],
  ];
  return `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <span class="brand-ja">${config.storeName[locale]}</span>
          <p class="brand-sub">${config.storeName.en.toUpperCase()}</p>
          ${data.footer.note ? `<p class="footer-note">${data.footer.note}</p>` : ''}
        </div>
        <div class="footer-col">
          <h4>${data.nav.menu} / ${data.nav.hours}</h4>
          <ul>
            ${navItems.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join('')}
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <ul>
            <li><a href="${config.instagramUrl}" target="_blank" rel="noopener">${icon('instagram')}${data.footer.instagramLabel} ${config.instagramHandle}</a></li>
            <li><a href="tel:${config.phoneHref}">${icon('phone')}${config.phoneDisplay}</a></li>
            <li><a href="#hours">${icon('pin')}${data.hours.address}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>${data.footer.rightsText}</span>
        <span>${data.footer.disclaimer}</span>
      </div>
    </div>
  </footer>
  <div class="mobile-cta">
    <a href="tel:${config.phoneHref}">${icon('phone')}${data.nav.call}</a>
    <a class="is-primary" href="#menu">${icon('bowlMark')}${data.nav.menu}</a>
  </div>`;
}

export function renderPage({ locale, data, config, url, canonicalUrl, ogImageUrl, alternates }) {
  return `<!doctype html>
<html lang="${data.meta.htmlLang}" dir="${data.meta.dir}">
<head>
    ${renderHead({ locale, data, config, url, canonicalUrl, ogImageUrl, alternates })}
</head>
<body>
  <a class="skip-link" href="#main">${data.a11y.skipToContent}</a>
  ${renderHeader({ data, config, locale, url })}
  <main id="main">
    ${renderHero({ data, config })}
    ${renderConcept({ data })}
    ${renderMenu({ data })}
    ${renderHours({ data, config })}
    ${renderGallery({ data })}
    ${renderNews({ data })}
  </main>
  ${renderFooter({ data, config, locale, url })}
  <script src="${url('assets/js/main.js')}" defer></script>
</body>
</html>
`;
}
