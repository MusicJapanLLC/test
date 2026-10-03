import { brandNames, businesses, facts, partners, profile } from '../../content/company';
import { privacy } from '../../content/privacy';
import type { Locale } from '../../content/releases';
import { BATON_PARTNERS_URL, copy, EMAIL, path, SITE_URL, SOCIAL_IMAGE, TIMEREX_URL } from '../../content/site';
import { arrow, esc, phrases, prose } from '../html';
import { innerHero, page } from '../layout';
import { mark } from '../mark';
import { button, crate, crumbs, ctaBlock, faqGraph, faqSection, joinSleeve, kicker, partnerSleeve, player } from '../parts';
import { aboutSection, mediaSection } from './home';

export function renderBusiness(locale: Locale) {
  const p = copy[locale].pages.business;
  const body = `${innerHero(locale, 'business')}
${aboutSection(locale, '01')}
${crate(locale, { no: '02' })}
${mediaSection(locale, '03')}
${ctaBlock(locale)}
${player(locale)}`;
  return page({ locale, page: 'business', title: p.seo, description: p.description, body });
}

export function renderCompany(locale: Locale) {
  const p = copy[locale].pages.company;
  const ja = locale === 'ja';
  const body = `${innerHero(locale, 'company')}
<section class="spec" aria-labelledby="spec-title">
  <div class="sec-head">${kicker(ja ? 'COMPANY INFORMATION' : 'COMPANY INFORMATION', '01')}<h2 class="hx" id="spec-title" data-split>${phrases(ja ? '会社概要' : 'Company information')}</h2></div>
  <dl class="spec-sheet">${facts
    .map((f, i) => `<div class="spec-row" data-reveal><dt><i>${String(i + 1).padStart(2, '0')}</i>${esc(f.label[locale])}</dt><dd>${f.href ? `<a href="${f.href}">${esc(f.value[locale])}</a>` : esc(f.value[locale])}</dd></div>`)
    .join('')}</dl>
</section>
<section class="spec" aria-labelledby="biz-title">
  <div class="sec-head">${kicker(ja ? 'MUSIC BUSINESS' : 'MUSIC BUSINESS', '02')}<h2 class="hx" id="biz-title" data-split>${phrases(ja ? '事業内容' : 'What we do')}</h2></div>
  <ol class="tracklist">${businesses
    .map((b, i) => `<li data-reveal><span class="tl-no">A${i + 1}</span><span class="tl-name">${esc(b.name)}</span><span class="tl-body">${esc(b.body[locale])}</span></li>`)
    .join('')}</ol>
</section>
<section class="spec" aria-labelledby="brands-title">
  <div class="sec-head">${kicker(ja ? 'ARTISTS & MUSIC BRANDS' : 'ARTISTS & MUSIC BRANDS', '03')}<h2 class="hx" id="brands-title" data-split>${phrases(ja ? '展開ブランド・アーティスト' : 'Artists & music brands')}</h2></div>
  <ol class="tracklist tracklist--b">${brandNames.map((n, i) => `<li data-reveal><span class="tl-no">B${i + 1}</span><span class="tl-name">${esc(n)}</span><span class="tl-body"></span></li>`).join('')}</ol>
  <div class="sec-cta">${button(ja ? '作品を聴く' : 'Explore the music', `${path(locale, 'business')}#catalog`)}${button(ja ? 'お問い合わせ' : 'Contact us', path(locale, 'contact'), 'line')}</div>
</section>
${faqSection(locale, '04')}
${ctaBlock(locale)}`;
  return page({ locale, page: 'company', title: p.seo, description: p.description, body, graph: [faqGraph(locale, 'company')] });
}

export function renderProfile(locale: Locale) {
  const p = copy[locale].pages.profile;
  const body = `<section class="pf" data-world-zone="portrait" aria-labelledby="pf-title">
  <p class="ih-display" aria-hidden="true" data-split-display>PROFILE</p>
  <figure class="pf-portrait" data-reveal>
    <span class="pf-rings" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <img src="/kabeya-tomoki.png" alt="${esc(profile.alt[locale])}" width="861" height="859" decoding="async" fetchpriority="high">
    <figcaption>OSAKA / JAPAN — 2026</figcaption>
  </figure>
  <div class="pf-copy">
    ${crumbs(locale, 'profile')}
    ${kicker(p.kicker)}
    <h1 class="pf-name" id="pf-title" data-split>${esc(profile.name[locale])}</h1>
    <p class="pf-roman">${esc(profile.roman[locale])}</p>
    <p class="pf-role">${esc(profile.role[locale])}</p>
    <div class="pf-statement">${profile.statement[locale].map((s, i) => `<p${i === 1 ? ' class="pf-pull"' : ''}>${prose(s)}</p>`).join('')}</div>
    <div class="sec-cta">${button(locale === 'ja' ? '事業概要を見る' : 'See our business', path(locale, 'business'))}</div>
  </div>
</section>
${ctaBlock(locale)}`;
  return page({
    locale,
    page: 'profile',
    title: p.seo,
    description: p.description,
    body,
  });
}

export function renderPartners(locale: Locale) {
  const p = copy[locale].pages.partners;
  const ja = locale === 'ja';
  const roster = partners
    .map(
      (pt, i) => `<article class="roster" id="${pt.id}" style="--c1:${pt.colors[0]};--c2:${pt.colors[1]}" data-reveal>
    <a class="roster-sleeve" href="${pt.href}" aria-label="${esc(`${pt.name[locale]} — ${ja ? '事業を見る' : 'Explore'}`)}" data-cursor-label="OPEN">${partnerSleeve(locale, i)}</a>
    <div class="roster-copy">
      <p class="roster-no"><span>${pt.no}</span><i></i><span>${esc(pt.category[locale])}</span></p>
      <h2 class="roster-name" data-split>${phrases(pt.name[locale])}</h2>
      <p class="roster-title">${prose(pt.title[locale])}</p>
      <p class="roster-body">${prose(pt.body[locale])}</p>
      <dl class="roster-facts"><div><dt>BASE</dt><dd>${esc(pt.base[locale])}</dd></div>${pt.service ? `<div><dt>SERVICE</dt><dd>${esc(pt.service.name)}</dd></div>` : ''}<div><dt>SERIES</dt><dd>BATON PARTNERS</dd></div></dl>
      ${button(ja ? `${pt.name.ja.replace('株式会社', '')}を見る` : `Explore ${pt.name.en.replace(' Inc.', '')}`, pt.href)}
    </div>
  </article>`,
    )
    .join('');
  // 最後の1枚は、ここに並ぶページをつくっている Baton Partners そのもの（運営：Music Japan）
  const join = `<article class="roster roster--join" id="baton-partners" style="--c1:#e1222f;--c2:#ff3a48" data-reveal>
    <a class="roster-sleeve" href="${BATON_PARTNERS_URL}" target="_blank" rel="noopener" aria-label="${esc(ja ? 'Baton Partnersを見る（新しいタブで開きます）' : 'Visit Baton Partners (opens in a new tab)')}" data-cursor-label="VISIT">${joinSleeve(locale)}</a>
    <div class="roster-copy">
      <p class="roster-no"><span>BP-000</span><i></i><span>${ja ? '専用LP / SEO / AIO / 紹介' : 'LP / SEO / AIO / REFERRAL'}</span></p>
      <h2 class="roster-name" data-split>Baton Partners</h2>
      <p class="roster-title">${prose(ja ? '検索から、商談まで。バトンをつなぐ。' : 'From search to a first meeting, we pass the baton.')}</p>
      <p class="roster-body">${prose(ja ? '会社ごとの専用ページを5枚つくり、Googleの検索結果とAIの答えに出るよう整えます。ページを読んで「話してみたい」と思った人の相談は、Music Japanが確かめてからおつなぎします。上の各社のページも、Baton Partnersでつくりました。' : 'We build five dedicated pages for each company and shape them to be found in Google results and AI answers. When a reader wants to talk, Music Japan reviews the request and makes the introduction. Every partner page above was made with Baton Partners.')}</p>
      <dl class="roster-facts"><div><dt>BASE</dt><dd>${ja ? '大阪・梅田' : 'UMEDA, OSAKA'}</dd></div><div><dt>BY</dt><dd>MUSIC JAPAN</dd></div><div><dt>SERIES</dt><dd>BATON PARTNERS</dd></div></dl>
      ${button(ja ? 'Baton Partnersを見る' : 'Visit Baton Partners', BATON_PARTNERS_URL, 'solid', locale)}
    </div>
  </article>`;
  const logos = [
    ...partners.map((pt) => ({ src: pt.logo, w: pt.logoW, h: pt.logoH, alt: pt.name[locale] })),
    { src: '/partners/empro-white.png', w: 525, h: 154, alt: 'Empro' },
  ];
  const strip = logos.map((l) => `<span class="lg-item"><img src="${l.src}" alt="" width="${l.w}" height="${l.h}" loading="lazy" decoding="async">${mark({ id: `lg${l.w}`, cls: 'mj-mark lg-sep' })}</span>`).join('');
  const body = `${innerHero(locale, 'partners', `<p class="ih-note"><span>${partners.length.toString().padStart(2, '0')}</span>${ja ? '社 — BATON PARTNERS / MUSIC JAPAN' : 'COMPANIES — BATON PARTNERS / MUSIC JAPAN'}</p>`)}
<section class="lg" aria-label="${ja ? 'パートナー企業とサービス' : 'Partner companies and services'}">
  <div class="lg-track" data-velocity-marquee>${strip.repeat(4)}</div>
</section>
<section class="rosters" aria-label="${ja ? 'パートナー企業' : 'Partner companies'}">
  <div class="sec-head">${kicker('CATALOG — BATON PARTNERS', '01')}<h2 class="hx" data-split>${phrases(ja ? '一社ずつ、\n盤に刻むように。' : 'Each partner,\ncut like a record.')}</h2><p class="sec-body">${prose(ja ? '一社ずつ、レコードのように番号をつけて並べています。それぞれの事業とサービスは、各社のページで詳しくご覧いただけます。' : 'Each partner is numbered like a release in our catalog. Their business and services are covered in detail on each partner page.')}</p></div>
  ${roster}
  ${join}
</section>
${ctaBlock(locale)}`;
  return page({
    locale,
    page: 'partners',
    title: p.seo,
    description: p.description,
    body,
    graph: [
      {
        '@type': 'ItemList',
        name: 'Baton Partners',
        itemListElement: partners.map((pt, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Organization', name: pt.name.ja, alternateName: pt.name.en, url: pt.href } })),
      },
    ],
  });
}

export function renderContact(locale: Locale) {
  const p = copy[locale].pages.contact;
  const c = copy[locale].cta;
  const ja = locale === 'ja';
  const options = ja
    ? ['楽曲・BGM制作のご依頼', '楽曲使用・ライセンス', 'Podcast出演・インタビュー掲載', 'Baton・ご紹介', '協業・パートナーシップ', 'その他']
    : ['Music & BGM commissions', 'Music usage & licensing', 'SECOND TAKE interviews', 'Baton introductions', 'Partnerships & collaboration', 'Other'];
  const f = ja
    ? { type: 'お問い合わせ種別', name: 'お名前', company: '会社名', email: 'メールアドレス', message: 'お問い合わせ内容', req: '必須', opt: '任意', select: '選択してください', send: 'メールアプリで送る', note: `送信ボタンを押すとメールアプリが開きます。開かない場合は ${EMAIL} へ直接ご連絡ください。`, schedule: '打ち合わせ日程を選ぶ', scheduleNote: 'TimeRexで空いている日時を選択できます', mail: 'メールで直接' }
    : { type: 'Inquiry type', name: 'Name', company: 'Company', email: 'Email address', message: 'Message', req: 'Required', opt: 'Optional', select: 'Please select', send: 'Open email draft', note: `The button opens your email app. If it does not open, contact ${EMAIL} directly.`, schedule: 'Schedule a meeting', scheduleNote: 'Choose an available time through TimeRex', mail: 'Email us directly' };
  const field = (label: string, required: boolean, control: string) =>
    `<label class="fld"><span class="fld-label">${esc(label)}<em>${required ? f.req : f.opt}</em></span>${control}</label>`;
  const body = `${innerHero(locale, 'contact')}
<section class="ct" aria-labelledby="ct-title">
  <div class="ct-side">
    <h2 class="hx ct-title" id="ct-title" data-split>${phrases(c.title)}</h2>
    <p class="sec-body">${prose(c.body)}</p>
    <a class="ct-link" href="${TIMEREX_URL}" target="_blank" rel="noopener noreferrer" data-magnetic><span class="ct-link-icon">${arrow('up-right')}</span><span><strong>${f.schedule}</strong><small>${f.scheduleNote}</small></span><span class="sr">${copy[locale].newTab}</span></a>
    <a class="ct-link" href="mailto:${EMAIL}" data-magnetic><span class="ct-link-icon">@</span><span><strong>${f.mail}</strong><small>${EMAIL}</small></span></a>
  </div>
  <form class="ct-form" data-contact-form data-locale="${locale}" novalidate>
    ${field(f.type, true, `<select name="type" required><option value="" disabled selected>${f.select}</option>${options.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`)}
    <div class="fld-row">${field(f.name, true, '<input type="text" name="name" autocomplete="name" required>')}${field(f.company, false, '<input type="text" name="company" autocomplete="organization">')}</div>
    ${field(f.email, true, '<input type="email" name="email" autocomplete="email" required>')}
    ${field(f.message, true, '<textarea name="message" rows="6" required></textarea>')}
    <p class="ct-note">${prose(f.note)}</p>
    <p class="ct-error" data-form-error role="alert" hidden>${ja ? '必須項目を入力してください。' : 'Please fill in the required fields.'}</p>
    <button class="btn btn--solid ct-send" type="submit" data-magnetic><span class="btn-label">${f.send}</span>${arrow()}</button>
  </form>
</section>`;
  return page({ locale, page: 'contact', title: p.seo, description: p.description, body, bodyClass: 'is-contact' });
}

export function renderPrivacy(locale: Locale) {
  const p = copy[locale].pages.privacy;
  const d = privacy[locale];
  const body = `${innerHero(locale, 'privacy')}
<section class="doc" aria-label="${esc(p.title)}">
  <p class="doc-intro">${prose(d.intro ?? '')}</p>
  ${d.sections
    .map(
      (s) => `<section class="doc-sec"><h2>${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t).replaceAll('\n', '<br>')}</p>`).join('')}${s.li.length ? `<ul>${s.li.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</section>`,
    )
    .join('')}
</section>`;
  return page({ locale, page: 'privacy', title: p.seo, description: p.description, body });
}

/** LINE share URL that shows the corporate-logo card, then opens the home page. */
export function renderOfficial() {
  const title = '合同会社Music Japan 公式サイト | 音楽・メディア';
  const description = '音楽制作・配信を軸に、Podcast、経営者インタビュー、記事制作を手がける音楽・メディア会社。';
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><meta name="description" content="${description}"/><meta name="robots" content="noindex,follow"/><link rel="canonical" href="${SITE_URL}/"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Music Japan LLC"/><meta property="og:locale" content="ja_JP"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${SITE_URL}/official/"/><meta property="og:image" content="${SITE_URL}${SOCIAL_IMAGE}"/><meta property="og:image:width" content="1500"/><meta property="og:image:height" content="500"/><meta property="og:image:alt" content="Music Japan LLC corporate logo"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${title}"/><meta name="twitter:description" content="${description}"/><meta name="twitter:image" content="${SITE_URL}${SOCIAL_IMAGE}"/><meta http-equiv="refresh" content="0;url=/"/><script>location.replace("/")</script></head><body><p><a href="/">合同会社Music Japan 公式サイトへ移動</a></p></body></html>`;
}

/** Served by Cloudflare Pages for any unknown URL (root /404.html). Bilingual, not indexed. */
export function renderNotFound() {
  const body = `<section class="ih nf" data-world-zone="inner-hero">
  <p class="ih-display" aria-hidden="true" data-split-display>404</p>
  <div class="ih-copy">
    <p class="kicker">404 — NEEDLE SKIPPED</p>
    <h1 class="ih-title" data-split>${phrases('ページが見つかりません')}</h1>
    <p class="ih-lead">お探しのページは移動したか、削除された可能性があります。<br>The page you were looking for could not be found.</p>
    <div class="sec-cta">${button('トップへ', path('ja', 'home'))}${button('作品を聴く', path('ja', 'works'), 'line')}${button('English', path('en', 'home'), 'line')}</div>
  </div>
</section>`;
  return page({ locale: 'ja', page: 'home', title: 'ページが見つかりません（404）｜合同会社Music Japan', description: 'お探しのページは見つかりませんでした。', body, noindex: true });
}
