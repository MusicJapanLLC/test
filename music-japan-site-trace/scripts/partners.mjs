// Corporate partners and their services. Empro belongs to Evorg; it is not a third company.
export const partners = [
  {
    id: "evorg", name: "株式会社エボルグ", nameEn: "Evorg Inc.",
    logo: "/partners/evorg.png", width: 655, height: 251,
    category: "人材紹介 / CRM・MA", categoryEn: "RECRUITMENT / CRM & MA",
    title: "人材紹介の可能性を、次の成長へ。", titleEn: "Helping recruitment businesses grow.",
    body: "人材紹介会社向けのワンストップCRM・MA「Empro」を提供。データとAI、専任コンサルタントの伴走を通じて、採用決定と事業の成長を支援します。",
    bodyEn: "Evorg provides Empro, a CRM and marketing automation platform for recruitment agencies, combining data, AI and dedicated consulting to support placements and business growth.",
    href: "https://baton-partners-demo.vercel.app/evorg/", cta: "紹介ページを見る", ctaEn: "Explore Evorg"
  },
  {
    id: "central-ax", name: "株式会社Central AX", nameEn: "Central AX Inc.",
    logo: "/partners/central-ax.jpg", width: 1774, height: 887,
    category: "AI研修 / 開発・業務改善", categoryEn: "AI TRAINING / DEVELOPMENT",
    title: "AIを学ぶ、その先の実装まで。", titleEn: "From learning AI to putting it to work.",
    body: "生成AI研修、AI受託開発・業務改善、LLMO対策を手がけるAI実装支援会社。名古屋を拠点に、全国の企業のAI活用を支援します。",
    bodyEn: "Based in Nagoya and serving companies across Japan, Central AX supports generative AI training, custom AI development, workflow improvements and AI search optimization.",
    href: "https://central-ax.co.jp/", cta: "企業サイトを見る", ctaEn: "Visit company website"
  }
];

const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const logo = (item, decorative = false) => `<span class="partner-logo partner-logo--${item.id}"><img src="${item.logo}" alt="${decorative ? "" : escape(item.name)}" width="${item.width}" height="${item.height}" decoding="async"/></span>`;

export function renderPartners(locale) {
  const ja = locale === "ja";
  const brands = [partners[0], { id: "empro", name: "Empro（エボルグのサービス）", logo: "/partners/empro.png", width: 628, height: 247 }, partners[1]];
  // Two identical groups make a seamless loop. The cards below provide accessible names and links.
  const group = `<div class="partner-marquee__group">${brands.map(item => `<span class="partner-marquee__item">${logo(item, true)}</span>`).join("")}</div>`;
  return `<section class="partner-strip" aria-label="${ja ? "パートナー企業とサービス" : "Partner companies and services"}"><div class="partner-strip__heading"><span>BATON PARTNERS</span><button type="button" class="partner-motion" aria-pressed="false" data-partner-motion data-pause="${ja ? "ロゴの動きを停止" : "Pause logos"}" data-resume="${ja ? "ロゴの動きを再開" : "Resume logos"}">${ja ? "ロゴの動きを停止" : "Pause logos"}</button></div><div class="partner-marquee" aria-hidden="true"><div class="partner-marquee__track">${group}${group}</div></div></section>
  <section class="partner-directory" aria-labelledby="partner-directory-title"><div class="partner-directory__heading"><div><p class="kicker">OUR PARTNERS</p><h2 id="partner-directory-title">${ja ? "パートナー企業" : "Partner companies"}</h2></div><span class="partner-directory__count">02 COMPANIES</span></div><div class="partner-grid">${partners.map((item, index) => `<article class="partner-card"><div class="partner-card__identity"><span class="partner-card__index">0${index + 1}</span>${logo(item)}</div><div class="partner-card__body"><p class="partner-card__category">${ja ? item.category : item.categoryEn}</p><h3>${ja ? item.name : item.nameEn}</h3><p class="partner-card__title">${ja ? item.title : item.titleEn}</p><p class="partner-card__description">${ja ? item.body : item.bodyEn}</p><a class="partner-card__link" href="${item.href}">${ja ? item.cta : item.ctaEn}</a></div></article>`).join("")}</div></section>
  <script>(()=>{const button=document.querySelector('[data-partner-motion]');const strip=document.querySelector('.partner-strip');const reduce=matchMedia('(prefers-reduced-motion: reduce)');if(!button||!strip)return;let paused=reduce.matches;const update=()=>{strip.classList.toggle('is-paused',paused);button.setAttribute('aria-pressed',String(paused));button.textContent=paused?button.dataset.resume:button.dataset.pause;button.hidden=reduce.matches;};button.addEventListener('click',()=>{paused=!paused;update();});reduce.addEventListener('change',()=>{paused=reduce.matches;update();});update();})();</script>`;
}
