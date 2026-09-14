// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then apply the official-site content refresh.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "dist");
const output = join(root, "deploy-dist");
const OLD_SITE_URL = "https://music-japan.pearly-cedar-3983.chatgpt.site";
const LEGACY_PAGES_URL = "https://music-japan.pages.dev";
const DEFAULT_SITE_URL = "https://music-japan.com";
const SITE_URL = (process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
const RSC_MARKER = '<script id="_R_">';
const FAVICON_URL = "/favicon-music-japan.svg?v=20260913-final";
const APPLE_ICON_URL = "/music-japan-symbol.png?v=20260913-final";
const MEDIA_STYLESHEET_URL = "/assets/music-japan-media-refresh.css?v=20260914";
const PROFILE_STYLESHEET_URL = "/assets/music-japan-profile.css?v=20260914";
const PAGES_STYLESHEET_URL = "/assets/music-japan-pages.css?v=20260914";
const SECOND_TAKE_URL = "https://secondtake.music-japan.com/";
const BATON_URL = "https://baton.music-japan.com/profile/";

const pageCopy = {
  ja: {
    brand: "合同会社Music Japan",
    homeLabel: "合同会社Music Japan home",
    languageLabel: "Switch to English",
    menuOpen: "メニューを開く",
    menuClose: "メニューを閉じる",
    navLabel: "主要ナビゲーション",
    nav: [
      ["music", "音楽"],
      ["media", "メディア"],
      ["about", "私たちについて"],
      ["company", "会社概要"],
      ["profile", "代表プロフィール"],
      ["contact", "お問い合わせ"]
    ],
    pages: {
      music: {
        kicker: "MUSIC / CATALOG",
        title: "音楽",
        lead: "アーティスト作品からBGM、Jazz、クラシック、睡眠音楽まで。音をつくり、聴かれ続ける場所まで届けます。",
        description: "合同会社Music Japanの音楽制作・楽曲配信・アーティスト作品・音楽ブランド"
      },
      media: {
        kicker: "MEDIA / STORIES",
        title: "メディア",
        lead: "Podcastとインタビューを通じて、人の声と経験を記録し、次のつながりへ届けます。",
        description: "合同会社Music Japanが運営するSECOND TAKEとメディア事業"
      },
      about: {
        kicker: "ABOUT MUSIC JAPAN",
        title: "私たちについて",
        lead: "音楽やメディアを通じて、より有意義な未来を創る記録を残します。",
        description: "合同会社Music Japanの事業と、音楽・メディアを通じて残したい記録"
      },
      contact: {
        kicker: "CONTACT / COLLABORATE",
        title: "お問い合わせ",
        lead: "楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業についてご相談ください。",
        description: "合同会社Music Japanへのお問い合わせ、取材、楽曲制作、協業のご相談"
      }
    },
    footer: "MUSIC. STORIES. CONNECTIONS. FROM JAPAN.",
    rights: "© 2026 合同会社Music Japan. All rights reserved.",
    privacy: "プライバシーポリシー",
    backTop: "BACK TO TOP ↑"
  },
  en: {
    brand: "MUSIC JAPAN LLC",
    homeLabel: "Music Japan LLC home",
    languageLabel: "日本語に切り替える",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    navLabel: "Primary navigation",
    nav: [
      ["music", "Music"],
      ["media", "Media"],
      ["about", "About"],
      ["company", "Company"],
      ["profile", "Profile"],
      ["contact", "Contact"]
    ],
    pages: {
      music: {
        kicker: "MUSIC / CATALOG",
        title: "Music",
        lead: "From artist releases and BGM to jazz, classical and sleep music. We create sound and carry it to places where it can keep being heard.",
        description: "Music production, distribution, artist releases and music brands from Music Japan LLC"
      },
      media: {
        kicker: "MEDIA / STORIES",
        title: "Media",
        lead: "Through podcasts and interviews, we preserve people’s voices and experiences and carry them toward new connections.",
        description: "SECOND TAKE and the media work of Music Japan LLC"
      },
      about: {
        kicker: "ABOUT MUSIC JAPAN",
        title: "About",
        lead: "Through music and media, we leave records that shape a more meaningful future.",
        description: "The work of Music Japan LLC and the records we hope to leave through music and media"
      },
      contact: {
        kicker: "CONTACT / COLLABORATE",
        title: "Contact",
        lead: "Talk to us about music, BGM, SECOND TAKE interviews, Baton introductions or partnerships.",
        description: "Contact Music Japan LLC about music, interviews, media and partnerships"
      }
    },
    footer: "MUSIC. STORIES. CONNECTIONS. FROM JAPAN.",
    rights: "© 2026 Music Japan LLC. All rights reserved.",
    privacy: "Privacy Policy",
    backTop: "BACK TO TOP ↑"
  }
};

const content = {
  ja: {
    newsKicker: "NEWS / UPDATES",
    newsTitle: "お知らせ",
    newsItems: [
      { date: "2026.09.13", dateTime: "2026-09-13", label: "NEWS", title: "公式サイトを music-japan.com へ移行しました", href: "" },
      { date: "2026.09.13", dateTime: "2026-09-13", label: "MEDIA", title: "経営者メディア「SECOND TAKE」を公開しました", href: SECOND_TAKE_URL },
      { date: "2026.09.14", dateTime: "2026-09-14", label: "PROFILE", title: "代表プロフィールを公開しました", href: "/profile/" }
    ],
    mediaKicker: "MEDIA / CONNECTION",
    mediaTitle: "人生の困難や逆境を\n自分を彩る表現へと昇華する。",
    mediaBody: "経営者の決断や苦悩をPodcast×記事に残し、それが次のつながりを生む。\nSECOND TAKEでは弊社が「取材・発信」まで手がけます。",
    mediaCards: [
      {
        label: "PODCAST / INTERVIEW",
        title: "SECOND TAKE",
        body: "経営者の決断と苦悩、その先にある物語を、Podcastとインタビュー記事で記録する経営者メディア。",
        cta: "公式サイトへ移動",
        href: SECOND_TAKE_URL
      },
      {
        label: "INVITATION-ONLY INTRODUCTION",
        title: "Baton -バトン-",
        body: "選んだ人から、選んだ人へ。バトンは渡る。",
        cta: "Batonを見る",
        href: BATON_URL
      }
    ],
    brands: [
      {
        kicker: "MUSIC JAPAN",
        title: "音楽制作・配信",
        body: "アーティスト作品、BGM、Jazz、クラシック、睡眠音楽まで、企画・制作・配信を一貫して手がけます。",
        logo: "/music-japan-logo.png",
        alt: "合同会社Music Japan",
        width: 1500,
        height: 500,
        modifier: "music"
      },
      {
        kicker: "SECOND TAKE",
        title: "Podcast × インタビュー",
        body: "経営者の決断や苦悩、その先にある物語を、Podcastとインタビュー記事で記録し、届けます。",
        logo: "/second-take-logo.png",
        alt: "SECOND TAKE Podcast・インタビューメディア",
        width: 2172,
        height: 724,
        modifier: "second-take"
      },
      {
        kicker: "BATON",
        title: "招待制の紹介サービス",
        body: "お互いの価値観を大切に、深い関係構築を。",
        logo: "/baton-wordmark-v2.png",
        alt: "Baton -バトン-",
        width: 446,
        height: 65,
        modifier: "baton"
      }
    ]
  },
  en: {
    newsKicker: "NEWS / UPDATES",
    newsTitle: "Latest updates",
    newsItems: [
      { date: "2026.09.13", dateTime: "2026-09-13", label: "NEWS", title: "Our official website has moved to music-japan.com", href: "" },
      { date: "2026.09.13", dateTime: "2026-09-13", label: "MEDIA", title: "SECOND TAKE, our executive interview media, is now live", href: SECOND_TAKE_URL },
      { date: "2026.09.14", dateTime: "2026-09-14", label: "PROFILE", title: "Our representative profile is now available", href: "/en/profile/" }
    ],
    mediaKicker: "MEDIA / CONNECTION",
    mediaTitle: "Transform life’s hardships and adversity\ninto expressions that give color to who we are.",
    mediaBody: "We preserve the decisions and struggles of business leaders through podcasts and articles, allowing them to lead to new connections.\nThrough SECOND TAKE, we handle everything from interviews to publication.",
    mediaCards: [
      {
        label: "PODCAST / INTERVIEW",
        title: "SECOND TAKE",
        body: "An executive media series documenting the decisions, hardships and stories that follow through podcasts and in-depth interviews.",
        cta: "Visit SECOND TAKE",
        href: SECOND_TAKE_URL
      },
      {
        label: "INVITATION-ONLY INTRODUCTION",
        title: "Baton",
        body: "From one chosen person to another. The baton is passed.",
        cta: "Visit Baton",
        href: BATON_URL
      }
    ],
    brands: [
      {
        kicker: "MUSIC JAPAN",
        title: "Music production & distribution",
        body: "We plan, produce and distribute artist releases, BGM, jazz, classical and sleep music.",
        logo: "/music-japan-logo.png",
        alt: "Music Japan LLC",
        width: 1500,
        height: 500,
        modifier: "music"
      },
      {
        kicker: "SECOND TAKE",
        title: "Podcasts × interviews",
        body: "We document the decisions, hardships and stories of business leaders through podcasts and interview articles.",
        logo: "/second-take-logo.png",
        alt: "SECOND TAKE podcast and interview media",
        width: 2172,
        height: 724,
        modifier: "second-take"
      },
      {
        kicker: "BATON",
        title: "Invitation-only introductions",
        body: "Respecting each other’s values, we nurture deeper relationships.",
        logo: "/baton-wordmark-v2.png",
        alt: "Baton invitation-only introduction service",
        width: 446,
        height: 65,
        modifier: "baton"
      }
    ]
  }
};

function replaceRequired(value, search, replacement, label) {
  const count = value.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} match, found ${count}`);
  return value.replace(search, replacement);
}

function patchClientBundle() {
  const assetsDirectory = join(output, "assets");
  const bundleName = readdirSync(assetsDirectory).find((name) => /^MusicJapanSite-.*\.js$/.test(name));
  if (!bundleName) throw new Error("Music Japan client bundle was not found");

  const bundlePath = join(assetsDirectory, bundleName);
  let bundle = readFileSync(bundlePath, "utf8");

  const relatedMarker = '(0,a.jsxs)(`section`,{className:`related content-frame`';
  const contactMarker = '(0,a.jsxs)(`section`,{className:`contact-section`';
  const worksMarker = '(0,a.jsxs)(`section`,{className:`works content-frame`';
  const relatedStart = bundle.indexOf(relatedMarker);
  const contactStart = bundle.indexOf(contactMarker, relatedStart);
  if (relatedStart === -1 || contactStart === -1 || bundle[contactStart - 1] !== ",") {
    throw new Error("Could not isolate the related ventures component");
  }

  let mediaBlock = bundle.slice(relatedStart, contactStart);
  bundle = bundle.slice(0, relatedStart) + bundle.slice(contactStart);
  mediaBlock = replaceRequired(
    mediaBlock,
    'className:`related content-frame`,children:',
    'className:`related media-feature content-frame`,id:`media`,children:',
    "media section class"
  );
  mediaBlock = replaceRequired(mediaBlock, 'title:t.relatedTitle,body:``', 'title:t.relatedTitle,body:t.relatedBody', "media section description");

  const worksStart = bundle.indexOf(worksMarker);
  if (worksStart === -1) throw new Error("Could not locate the works section");
  bundle = bundle.slice(0, worksStart) + mediaBlock + bundle.slice(worksStart);

  const aboutSystemStart = bundle.indexOf('(0,a.jsxs)(`div`,{className:`about__system`');
  const founderStart = bundle.indexOf('(0,a.jsxs)(`section`,{className:`founder content-frame`', aboutSystemStart);
  if (aboutSystemStart === -1 || founderStart === -1) throw new Error("Could not isolate the company brand rows");
  const brandRowsBlock = '(0,a.jsx)(`div`,{className:`about__brands`,"data-reveal":!0,children:t.brands.map((e,t)=>(0,a.jsxs)(`article`,{className:`about-brand`,children:[(0,a.jsx)(`div`,{className:`about-brand__logo about-brand__logo--${e.modifier}`,children:(0,a.jsx)(`img`,{src:e.logo,alt:e.alt,width:e.width,height:e.height,loading:`lazy`,decoding:`async`})}),(0,a.jsxs)(`div`,{className:`about-brand__copy`,children:[(0,a.jsxs)(`span`,{className:`about-brand__index`,children:[`0`,t+1]}),(0,a.jsxs)(`div`,{className:`about-brand__heading`,children:[(0,a.jsx)(`p`,{className:`kicker`,children:e.kicker}),(0,a.jsx)(`h3`,{children:e.title})]}),(0,a.jsx)(`p`,{className:`about-brand__body`,children:e.body})]})]},e.kicker))})]}) ,';
  bundle = bundle.slice(0, aboutSystemStart) + brandRowsBlock + bundle.slice(founderStart);

  bundle = replaceRequired(
    bundle,
    '(0,a.jsx)(`p`,{className:`founder__statement`,children:t.founderQuote})',
    '(0,a.jsxs)(`span`,{className:`founder__profile-cta`,children:[e===`ja`?`代表プロフィールを見る`:`View representative profile`,(0,a.jsx)(E,{diagonal:!0})]})',
    "founder profile CTA"
  );
  const founderSectionStart = bundle.indexOf('(0,a.jsxs)(`section`,{className:`founder content-frame`');
  const founderChildrenMarker = 'children:[';
  const founderChildrenStart = bundle.indexOf(founderChildrenMarker, founderSectionStart) + founderChildrenMarker.length;
  const companyTableStart = bundle.indexOf('(0,a.jsxs)(`div`,{className:`company-table`', founderChildrenStart);
  if (founderSectionStart === -1 || founderChildrenStart === founderChildrenMarker.length - 1 || companyTableStart === -1 || bundle[companyTableStart - 1] !== ",") {
    throw new Error("Could not isolate the founder profile teaser");
  }
  const profileLinkStart = '(0,a.jsxs)(`a`,{className:`founder__profile-link`,href:e===`ja`?`/profile/`:`/en/profile/`,"aria-label":e===`ja`?`壁谷友生の代表プロフィールを見る`:`View Tomoki Kabeya’s representative profile`,children:[';
  const founderProfileNodes = bundle.slice(founderChildrenStart, companyTableStart - 1);
  bundle = bundle.slice(0, founderChildrenStart) + profileLinkStart + founderProfileNodes + ']})' + bundle.slice(companyTableStart - 1);

  const newsBlock = '(0,a.jsxs)(`section`,{className:`news-strip content-frame`,id:`news`,"aria-labelledby":`news-title`,children:[(0,a.jsxs)(`div`,{className:`news-strip__heading`,"data-reveal":!0,children:[(0,a.jsx)(`p`,{className:`kicker`,children:t.newsKicker}),(0,a.jsx)(`h2`,{id:`news-title`,children:t.newsTitle})]}),(0,a.jsx)(`div`,{className:`news-strip__list`,"data-reveal":!0,children:t.newsItems.map((t,n)=>{let r=(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(`time`,{dateTime:t.dateTime,children:t.date}),(0,a.jsx)(`span`,{className:`news-strip__label`,children:t.label}),(0,a.jsx)(`span`,{className:`news-strip__title`,children:t.title}),(0,a.jsx)(`span`,{className:`news-strip__arrow`,"aria-hidden":`true`,children:t.href?`↗`:``})]});return t.href?(0,a.jsx)(`a`,{className:`news-strip__item`,href:t.href,target:t.href.startsWith(`/`)?void 0:`_blank`,rel:t.href.startsWith(`/`)?void 0:`noopener noreferrer`,"aria-label":t.href.startsWith(`/`)?t.title:`${t.title}${e===`ja`?`（新しいタブで開きます）`:` (opens in a new tab)`}`,children:r},t.title):(0,a.jsx)(`div`,{className:`news-strip__item`,children:r},t.title)})})]})';
  const manifestoMarker = '(0,a.jsxs)(`section`,{className:`manifesto content-frame`';
  const manifestoStart = bundle.indexOf(manifestoMarker);
  if (manifestoStart === -1) throw new Error("Could not locate the manifesto section");
  bundle = bundle.slice(0, manifestoStart) + newsBlock + "," + bundle.slice(manifestoStart);

  const bundleReplacements = [
    ['var g=[[`.hero`,`001 / SIGNAL`],[`.manifesto`,`002 / MANIFESTO`],[`.works`,`003 / ARTIST`],[`.projects`,`004 / CATALOG`],[`.about`,`005 / COMPANY`],[`.founder`,`006 / FOUNDER`],[`.contact-section`,`007 / CONTACT`]];', 'var g=[[`.hero`,`001 / SIGNAL`],[`.news-strip`,`002 / NEWS`],[`.manifesto`,`003 / MANIFESTO`],[`.media-feature`,`004 / MEDIA`],[`.works`,`005 / ARTIST`],[`.projects`,`006 / CATALOG`],[`.about`,`007 / COMPANY`]];', "experience rail sequence"],
    ['nav:[[`作品`,`#works`],[`私たちについて`,`#about`],[`代表`,`#founder`],[`お問い合わせ`,`#contact`]]', 'nav:[[`音楽`,`/music/`],[`メディア`,`/media/`],[`私たちについて`,`/about/`],[`会社概要`,`/company/`],[`代表プロフィール`,`/profile/`],[`お問い合わせ`,`/contact/`]]', "Japanese navigation"],
    ['heroEyebrow:`合同会社Music Japan · INDEPENDENT MUSIC COMPANY · OSAKA`', 'heroEyebrow:`合同会社Music Japan · MUSIC & MEDIA COMPANY · OSAKA`', "Japanese hero eyebrow"],
    ['heroLead:`日本から。国境を越えて。記憶に残る音楽を。`', 'heroLead:`日本から。音楽と物語を、記憶に残る形へ。`', "Japanese hero lead"],
    ['heroSub:`アーティスト作品、ジャズ、クラシック、睡眠音楽。異なる音の世界を、一本の赤い周波数で束ねる音楽会社です。`', 'heroSub:`音楽制作・配信を軸に、Podcastとインタビューで人の声や経験を記録する音楽・メディア会社です。`', "Japanese hero summary"],
    ['manifestoKicker:`ONE SIGNAL. MANY WORLDS.`,manifestoTitle:`音楽は、ジャンルを越えて残っていく。`', 'manifestoKicker:`MUSIC. STORIES. CONNECTIONS.`,manifestoTitle:`音楽は、ジャンルを越えて残っていく。`', "Japanese manifesto kicker"],
    ['manifestoBody:`一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで設計する。Music Japanは、アーティストと音楽ブランドの可能性を、日本から世界へ広げます。`,worksKicker:', 'manifestoBody:`一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで届ける。さらに、人の声と経験をPodcastや記事に残し、次の人へつなぐ。Music Japanは、音楽を軸に新しい出会いまで育てます。`,newsKicker:`NEWS / UPDATES`,newsTitle:`お知らせ`,newsItems:[{date:`2026.09.13`,dateTime:`2026-09-13`,label:`NEWS`,title:`公式サイトを music-japan.com へ移行しました`,href:``},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`MEDIA`,title:`経営者メディア「SECOND TAKE」を公開しました`,href:`https://secondtake.music-japan.com/`},{date:`2026.09.14`,dateTime:`2026-09-14`,label:`PROFILE`,title:`代表プロフィールを公開しました`,href:`/profile/`}],worksKicker:', "Japanese manifesto and news"],
    ['aboutTitle:`複数の音楽世界を育てる、独立系音楽会社。`', 'aboutTitle:`音楽やメディアを通じて、\nより有意義な未来を創る記録を。`', "Japanese about title"],
    ['aboutBody:`合同会社Music Japanは、アーティスト作品からジャズ、クラシック、睡眠音楽まで、複数の音楽ブランドを企画・制作・発信しています。作品の数ではなく、ひとつひとつの世界観が届き、残り、次の出会いを生むことを大切にしています。`', 'aboutBody:`合同会社Music Japanは、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を中心に、Podcastやインタビュー記事、LPで経営者の経験や事業を届けています。音楽も言葉も、つくって終わらせず、記憶と次のつながりへ残すことを大切にしています。`', "Japanese about summary"],
    ['pillars:[[`CREATE`,`楽曲・BGMの企画制作`],[`CURATE`,`ジャンルごとの世界観設計`],[`CONNECT`,`国内外のリスナーへ届ける`]]', 'brands:[{kicker:`MUSIC JAPAN`,title:`音楽制作・配信`,body:`アーティスト作品、BGM、Jazz、クラシック、睡眠音楽まで、企画・制作・配信を一貫して手がけます。`,logo:`/music-japan-logo.png`,alt:`合同会社Music Japan`,width:1500,height:500,modifier:`music`},{kicker:`SECOND TAKE`,title:`Podcast × インタビュー`,body:`経営者の決断や苦悩、その先にある物語を、Podcastとインタビュー記事で記録し、届けます。`,logo:`/second-take-logo.png`,alt:`SECOND TAKE Podcast・インタビューメディア`,width:2172,height:724,modifier:`second-take`},{kicker:`BATON`,title:`招待制の紹介サービス`,body:`お互いの価値観を大切に、深い関係構築を。`,logo:`/baton-wordmark-v2.png`,alt:`Baton -バトン-`,width:446,height:65,modifier:`baton`}]', "Japanese company brands"],
    ['worksTitle:`日本語で描く、都市と感情。`', 'worksTitle:`Yumaが紡ぐ、想いと軌跡。`', "Japanese Yuma title"],
    ['founderQuote:`音楽を“つくって終わるもの”にしない。聴かれる理由と、記憶に残る世界までつくる。それがMusic Japanの仕事です。`', 'founderQuote:`どうしようもなくつらい経験、孤独や絶望。それらをただ憎み、退けるのではなく、向き合い表現することで、日常生活では決して生まれないアウトプットが生まれると私は思います。\n\n音楽やメディア、Podcastというのは表現の手段です。\n\n合同会社Music Japanは、あらゆる自己表現とそこの共鳴からうまれる思いを繋ぎ、そして今苦境の最中にいる人の支えになるようなそんな記録を世に残せたらと思っています。`', "Japanese founder statement"],
    ['relatedKicker:`RELATED VENTURES`,relatedTitle:`音楽から始まる、次の接点。`,relatedCards:[{label:`BUSINESS CONNECTION`,title:`企業様のお繋ぎ・経営者様のご紹介`,body:`株式会社Standmentが運営する、法人・経営者様向けのご縁づくり。`,cta:`特設サイト — COMING SOON`,href:``},{label:`WEBGL EXPERIENCE`,title:`WebGL型HP制作「Standment」`,body:`ブランドの空気まで伝える、体験型Webサイト制作。`,cta:`特設サイトへ移動`,href:`https://savers-japan-digital.pearly-cedar-3983.chatgpt.site/#contact`}]', 'relatedKicker:`MEDIA / CONNECTION`,relatedTitle:`人生の困難や逆境を\n自分を彩る表現へと昇華する。`,relatedBody:`経営者の決断や苦悩をPodcast×記事に残し、それが次のつながりを生む。\nSECOND TAKEでは弊社が「取材・発信」まで手がけます。`,relatedCards:[{label:`PODCAST / INTERVIEW`,title:`SECOND TAKE`,body:`経営者の決断と苦悩、その先にある物語を、Podcastとインタビュー記事で記録する経営者メディア。`,cta:`公式サイトへ移動`,href:`https://secondtake.music-japan.com/`},{label:`INVITATION-ONLY INTRODUCTION`,title:`Baton -バトン-`,body:`選んだ人から、選んだ人へ。バトンは渡る。`,cta:`Batonを見る`,href:`https://baton.music-japan.com/profile/`}]', "Japanese media section"],
    ['contactBody:`楽曲制作、BGM、ライセンス、協業のご相談はこちらから。内容を確認後、担当よりご連絡します。`', 'contactBody:`楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談はこちらから。内容を確認後、担当よりご連絡します。`', "Japanese contact summary"],
    ['options:[`協業・パートナーシップ`,`楽曲・BGM制作のご依頼`,`楽曲使用・ライセンス`,`採用について`,`メディア・取材`,`その他`]', 'options:[`楽曲・BGM制作のご依頼`,`楽曲使用・ライセンス`,`Podcast出演・インタビュー掲載`,`Baton・ご紹介`,`協業・パートナーシップ`,`その他`]', "Japanese inquiry options"],
    ['footerLine:`MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.`,privacy:`プライバシーポリシー`', 'footerLine:`MUSIC. STORIES. CONNECTIONS. FROM JAPAN.`,privacy:`プライバシーポリシー`', "Japanese footer line"],
    ['nav:[[`Works`,`#works`],[`About`,`#about`],[`Founder`,`#founder`],[`Contact`,`#contact`]]', 'nav:[[`Music`,`/en/music/`],[`Media`,`/en/media/`],[`About`,`/en/about/`],[`Company`,`/en/company/`],[`Profile`,`/en/profile/`],[`Contact`,`/en/contact/`]]', "English navigation"],
    ['heroEyebrow:`MUSIC JAPAN LLC · INDEPENDENT MUSIC COMPANY · OSAKA, JAPAN`', 'heroEyebrow:`MUSIC JAPAN LLC · MUSIC & MEDIA COMPANY · OSAKA, JAPAN`', "English hero eyebrow"],
    ['heroLead:`Music from Japan. Made to travel. Built to last.`', 'heroLead:`Music and stories from Japan, made to last.`', "English hero lead"],
    ['heroSub:`Artist releases, jazz, classical and sleep music—distinct sonic worlds connected by one red frequency.`', 'heroSub:`Music production and distribution at our core, using podcasts and interviews to preserve people’s voices and experiences.`', "English hero summary"],
    ['manifestoKicker:`ONE SIGNAL. MANY WORLDS.`,manifestoTitle:`Music outlives borders and genres.`', 'manifestoKicker:`MUSIC. STORIES. CONNECTIONS.`,manifestoTitle:`Music outlives borders and genres.`', "English manifesto kicker"],
    ['manifestoBody:`We make the music, shape the world around it, and design how it keeps reaching listeners. From Japan, Music Japan develops artist releases and focused music brands for audiences worldwide.`,worksKicker:', 'manifestoBody:`We make the music, shape the world around it and help it keep reaching listeners. We also preserve people’s voices and experience through podcasts and articles, carrying each story toward its next connection.`,newsKicker:`NEWS / UPDATES`,newsTitle:`Latest updates`,newsItems:[{date:`2026.09.13`,dateTime:`2026-09-13`,label:`NEWS`,title:`Our official website has moved to music-japan.com`,href:``},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`MEDIA`,title:`SECOND TAKE, our executive interview media, is now live`,href:`https://secondtake.music-japan.com/`},{date:`2026.09.14`,dateTime:`2026-09-14`,label:`PROFILE`,title:`Our representative profile is now available`,href:`/en/profile/`}],worksKicker:', "English manifesto and news"],
    ['aboutTitle:`An independent music company building many sonic worlds.`', 'aboutTitle:`Through music and media,\nwe leave records that shape a more meaningful future.`', "English about title"],
    ['aboutBody:`Music Japan LLC develops artist releases and dedicated jazz, classical and sleep-music brands. Every release is designed to find its audience, stay with them and lead to the next listen.`', 'aboutBody:`Music Japan LLC creates and distributes artist releases, jazz, classical and sleep music. We also use podcasts, interview articles and dedicated pages to share the experiences and businesses of company leaders—turning music and words into lasting memories and trusted connections.`', "English about summary"],
    ['pillars:[[`CREATE`,`Original music and BGM production`],[`CURATE`,`Distinct worlds for every sound`],[`CONNECT`,`Reaching listeners across borders`]]', 'brands:[{kicker:`MUSIC JAPAN`,title:`Music production & distribution`,body:`We plan, produce and distribute artist releases, BGM, jazz, classical and sleep music.`,logo:`/music-japan-logo.png`,alt:`Music Japan LLC`,width:1500,height:500,modifier:`music`},{kicker:`SECOND TAKE`,title:`Podcasts × interviews`,body:`We document the decisions, hardships and stories of business leaders through podcasts and interview articles.`,logo:`/second-take-logo.png`,alt:`SECOND TAKE podcast and interview media`,width:2172,height:724,modifier:`second-take`},{kicker:`BATON`,title:`Invitation-only introductions`,body:`Respecting each other’s values, we nurture deeper relationships.`,logo:`/baton-wordmark-v2.png`,alt:`Baton invitation-only introduction service`,width:446,height:65,modifier:`baton`}]', "English company brands"],
    ['founderQuote:`Music should never end at creation. We build the reason it gets heard—and the world that makes it remembered.`', 'founderQuote:`Experiences of unbearable pain, loneliness and despair. I believe that by facing and expressing them—rather than simply hating or rejecting them—we can create work that would never emerge from ordinary life.\n\nMusic, media and podcasts are all means of expression.\n\nAt Music Japan LLC, we hope to connect every form of self-expression with the feelings born through resonance, and leave behind records that may support those who are still living through hardship.`', "English founder statement"],
    ['relatedKicker:`RELATED VENTURES`,relatedTitle:`New connections, starting with music.`,relatedCards:[{label:`BUSINESS CONNECTION`,title:`Business & Executive Introductions`,body:`Business introductions for companies and executives, operated by Standment.`,cta:`SPECIAL SITE — COMING SOON`,href:``},{label:`WEBGL EXPERIENCE`,title:`WebGL websites by Standment`,body:`Immersive digital experiences that express the atmosphere of a brand.`,cta:`Visit the special site`,href:`https://savers-japan-digital.pearly-cedar-3983.chatgpt.site/#contact`}]', 'relatedKicker:`MEDIA / CONNECTION`,relatedTitle:`Transform life’s hardships and adversity\ninto expressions that give color to who we are.`,relatedBody:`We preserve the decisions and struggles of business leaders through podcasts and articles, allowing them to lead to new connections.\nThrough SECOND TAKE, we handle everything from interviews to publication.`,relatedCards:[{label:`PODCAST / INTERVIEW`,title:`SECOND TAKE`,body:`An executive media series documenting the decisions, hardships and stories that follow through podcasts and in-depth interviews.`,cta:`Visit SECOND TAKE`,href:`https://secondtake.music-japan.com/`},{label:`INVITATION-ONLY INTRODUCTION`,title:`Baton`,body:`From one chosen person to another. The baton is passed.`,cta:`Visit Baton`,href:`https://baton.music-japan.com/profile/`}]', "English media section"],
    ['contactBody:`Talk to us about original music, BGM, licensing or partnerships. We’ll review your message and get back to you directly.`', 'contactBody:`Talk to us about music, BGM, licensing, SECOND TAKE interviews, Baton introductions or partnerships. We’ll review your message and get back to you directly.`', "English contact summary"],
    ['options:[`Partnerships & collaboration`,`Music & BGM commissions`,`Music usage & licensing`,`Careers`,`Media & press`,`Other`]', 'options:[`Music & BGM commissions`,`Music usage & licensing`,`SECOND TAKE interviews`,`Baton introductions`,`Partnerships & collaboration`,`Other`]', "English inquiry options"],
    ['footerLine:`MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.`,privacy:`Privacy Policy`', 'footerLine:`MUSIC. STORIES. CONNECTIONS. FROM JAPAN.`,privacy:`Privacy Policy`', "English footer line"],
    ['children:`MUSIC COMPANY`', 'children:`MUSIC & MEDIA`', "header business label"],
    ['children:`001 — 006`', 'children:`001 — 007`', "hero section count"],
    ['children:`JAZZ · CLASSICAL · SLEEP · J-POP`', 'children:`MUSIC · PODCAST · INTERVIEW · STORIES`', "hero orbit label"],
    ['[`ARTIST`,`JAZZ`,`CLASSICAL`,`SLEEP`,`BGM`].map', '[`ARTIST`,`JAZZ`,`CLASSICAL`,`PODCAST`,`STORIES`].map', "manifesto topic list"]
  ];

  for (const [search, replacement, label] of bundleReplacements) {
    bundle = replaceRequired(bundle, search, replacement, label);
  }

  bundle = replaceRequired(
    bundle,
    'className:`button button--ghost`,href:`#contact`',
    'className:`button button--ghost`,href:e===`ja`?`/contact/`:`/en/contact/`',
    "homepage contact CTA"
  );

  const homepageFounderStart = bundle.indexOf('(0,a.jsxs)(`section`,{className:`founder content-frame`');
  const homepageFooterStart = bundle.indexOf('(0,a.jsxs)(`footer`,{className:`site-footer content-frame`', homepageFounderStart);
  if (homepageFounderStart === -1 || homepageFooterStart === -1 || bundle[homepageFounderStart - 1] !== ",") {
    throw new Error("Could not remove the homepage founder and contact sections");
  }
  bundle = bundle.slice(0, homepageFounderStart - 1) + "]})," + bundle.slice(homepageFooterStart);

  const bundleDigest = createHash("sha256").update(bundle).digest("hex").slice(0, 12);
  writeFileSync(bundlePath, bundle);
  return { name: bundleName, digest: bundleDigest };
}

function versionClientModuleGraph(patchedBundle) {
  const assetsDirectory = join(output, "assets");
  const assetNames = readdirSync(assetsDirectory);
  const entryName = assetNames.find((name) => /^index-.*\.js$/.test(name) && readFileSync(join(assetsDirectory, name), "utf8").includes(patchedBundle.name));
  const layoutName = assetNames.find((name) => /^layout-segment-context-.*\.js$/.test(name));
  if (!entryName || !layoutName) throw new Error("Could not locate the client module cycle");

  const graphNames = [entryName, layoutName, patchedBundle.name];
  const version = `v=${patchedBundle.digest}`;
  for (const assetName of graphNames) {
    const assetPath = join(assetsDirectory, assetName);
    let asset = readFileSync(assetPath, "utf8");
    for (const graphName of graphNames) {
      asset = asset.replaceAll(`${graphName}`, `${graphName}?${version}`);
    }
    writeFileSync(assetPath, asset);
  }

  return { entryName, version, graphNames };
}

function arrowSvg() {
  return '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg>';
}

function renderNews(locale) {
  const copy = content[locale];
  const items = copy.newsItems.map((item) => {
    const body = `<time dateTime="${item.dateTime}">${item.date}</time><span class="news-strip__label">${item.label}</span><span class="news-strip__title">${item.title}</span><span class="news-strip__arrow" aria-hidden="true">${item.href ? "↗" : ""}</span>`;
    if (!item.href) return `<div class="news-strip__item">${body}</div>`;
    if (item.href.startsWith("/")) return `<a class="news-strip__item" href="${item.href}" aria-label="${item.title}">${body}</a>`;
    const aria = locale === "ja" ? `${item.title}（新しいタブで開きます）` : `${item.title} (opens in a new tab)`;
    return `<a class="news-strip__item" href="${item.href}" target="_blank" rel="noopener noreferrer" aria-label="${aria}">${body}</a>`;
  }).join("");

  return `<section class="news-strip content-frame" id="news" aria-labelledby="news-title"><div class="news-strip__heading" data-reveal="true"><p class="kicker">${copy.newsKicker}</p><h2 id="news-title">${copy.newsTitle}</h2></div><div class="news-strip__list" data-reveal="true">${items}</div></section>`;
}

function renderMedia(locale) {
  const copy = content[locale];
  const newTabText = locale === "ja" ? "（新しいタブで開きます）" : "(opens in a new tab)";
  const cards = copy.mediaCards.map((card, index) => `<a class="related-card" href="${card.href}" target="_blank" rel="noopener noreferrer" data-reveal="true"><span class="related-card__index">0<!-- -->${index + 1}</span><p class="kicker">${card.label}</p><h3>${card.title}</h3><p class="related-card__body">${card.body}</p><span class="related-card__cta">${card.cta}${arrowSvg()}</span><span class="sr-only">${newTabText}</span></a>`).join("");
  return `<section class="related media-feature content-frame" id="media"><div class="section-heading" data-reveal="true"><p class="kicker">${copy.mediaKicker}</p><h2>${copy.mediaTitle}</h2><p class="section-heading__body">${copy.mediaBody}</p></div><div class="related__grid">${cards}</div></section>`;
}

function renderBrandRows(locale) {
  const rows = content[locale].brands.map((brand, index) => `<article class="about-brand"><div class="about-brand__logo about-brand__logo--${brand.modifier}"><img src="${brand.logo}" alt="${brand.alt}" width="${brand.width}" height="${brand.height}" loading="lazy" decoding="async"/></div><div class="about-brand__copy"><span class="about-brand__index">0<!-- -->${index + 1}</span><div class="about-brand__heading"><p class="kicker">${brand.kicker}</p><h3>${brand.title}</h3></div><p class="about-brand__body">${brand.body}</p></div></article>`).join("");
  return `<div class="about__brands" data-reveal="true">${rows}</div>`;
}

function internalPath(locale, page) {
  return locale === "ja" ? `/${page}/` : `/en/${page}/`;
}

function renderSiteHeader(locale, activePage = "") {
  const copy = pageCopy[locale];
  const isJa = locale === "ja";
  const homePath = isJa ? "/" : "/en/";
  const alternateLocale = isJa ? "en" : "ja";
  const alternatePath = activePage ? internalPath(alternateLocale, activePage) : (isJa ? "/en/" : "/");
  const navLinks = copy.nav.map(([page, label]) => {
    const current = page === activePage ? ' aria-current="page"' : "";
    return `<a href="${internalPath(locale, page)}"${current}>${label}</a>`;
  }).join("");

  return `<header class="site-header inner-site-header"><a class="brand" href="${homePath}" aria-label="${copy.homeLabel}"><span class="brand-symbol" aria-hidden="true"><img src="/music-japan-symbol.png" alt="" width="480" height="480"/></span><span class="brand__text"><strong>${copy.brand}</strong><small>MUSIC &amp; MEDIA</small></span></a><nav id="primary-navigation" class="site-nav" aria-label="${copy.navLabel}">${navLinks}</nav><div class="header-actions"><a class="language-switch" href="${alternatePath}" hreflang="${alternateLocale}" aria-label="${copy.languageLabel}"><span lang="${alternateLocale}">${isJa ? "EN" : "JP"}</span><span class="language-switch__dot"></span></a><button class="menu-button" type="button" aria-label="${copy.menuOpen}" aria-controls="primary-navigation" aria-expanded="false" data-open-label="${copy.menuOpen}" data-close-label="${copy.menuClose}"><span></span><span></span></button></div></header>`;
}

function renderSiteFooter(locale) {
  const copy = pageCopy[locale];
  const homePath = locale === "ja" ? "/" : "/en/";
  const privacyPath = locale === "ja" ? "/privacy/" : "/en/privacy/";
  return `<footer class="site-footer content-frame inner-site-footer"><div class="site-footer__top"><span class="frequency-mark" aria-hidden="true"><span class="frequency-mark__arc frequency-mark__arc--top"></span><span class="frequency-mark__arc frequency-mark__arc--bottom"></span><span class="frequency-mark__dot"></span><span class="frequency-mark__line"></span></span><p>${copy.footer}</p></div><div class="site-footer__bottom"><p>${copy.rights}</p><div><a href="${homePath}">${locale === "ja" ? "トップ" : "HOME"}</a><a href="${privacyPath}">${copy.privacy}</a><a href="mailto:music.japan.llc@gmail.com">EMAIL</a><a href="#main-content">${copy.backTop}</a></div></div></footer>`;
}

function renderInnerPageScript(locale, includeContact = false) {
  const bodyTemplate = locale === "ja"
    ? "`お問い合わせ種別：${type}\\nお名前：${name}\\n会社名：${company||'未記入'}\\nメールアドレス：${email}\\n\\nお問い合わせ内容：\\n${message}`"
    : "`Inquiry type: ${type}\\nName: ${name}\\nCompany: ${company||'Not provided'}\\nEmail: ${email}\\n\\nMessage:\\n${message}`";
  const formScript = includeContact
    ? `const form=document.querySelector('.contact-form');form?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);const type=String(data.get('type')??'');const name=String(data.get('name')??'');const company=String(data.get('company')??'');const email=String(data.get('email')??'');const message=String(data.get('message')??'');const body=${bodyTemplate};location.href='mailto:music.japan.llc@gmail.com?subject='+encodeURIComponent('[Music Japan] '+type)+'&body='+encodeURIComponent(body);});`
    : "";
  return `<script>(()=>{const button=document.querySelector('.menu-button');const nav=document.querySelector('#primary-navigation');button?.addEventListener('click',()=>{const open=!nav.classList.contains('is-open');nav.classList.toggle('is-open',open);button.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?button.dataset.closeLabel:button.dataset.openLabel);});nav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('is-open');button?.classList.remove('is-open');button?.setAttribute('aria-expanded','false');}));${formScript}})();</script>`;
}

function renderInnerHero(locale, page) {
  const copy = pageCopy[locale].pages[page];
  return `<section class="inner-page__hero"><p class="kicker">${copy.kicker}</p><div class="inner-page__index" aria-hidden="true">0${pageCopy[locale].nav.findIndex(([key]) => key === page) + 1}</div><h1>${copy.title}</h1><p>${copy.lead}</p></section>`;
}

function renderStandalonePage(locale, page, bodyHtml) {
  const isJa = locale === "ja";
  const copy = pageCopy[locale].pages[page];
  const pagePath = internalPath(locale, page);
  const jaPath = internalPath("ja", page);
  const enPath = internalPath("en", page);
  const title = `${copy.title} | ${isJa ? "合同会社Music Japan" : "Music Japan LLC"}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${pagePath}#webpage`,
    url: `${SITE_URL}${pagePath}`,
    name: title,
    description: copy.description,
    inLanguage: isJa ? "ja" : "en",
    isPartOf: { "@id": `${SITE_URL}/#website` }
  };
  const visibleBody = bodyHtml.replaceAll(' data-reveal="true"', "").replaceAll(' aria-haspopup="dialog"', "");
  return `<!doctype html><html lang="${isJa ? "ja" : "en"}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title><meta name="description" content="${copy.description}"/><meta name="robots" content="index,follow,max-image-preview:large"/><link rel="canonical" href="${SITE_URL}${pagePath}"/><link rel="alternate" hreflang="ja-JP" href="${SITE_URL}${jaPath}"/><link rel="alternate" hreflang="en" href="${SITE_URL}${enPath}"/><link rel="alternate" hreflang="x-default" href="${SITE_URL}${jaPath}"/><meta property="og:type" content="website"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${copy.description}"/><meta property="og:url" content="${SITE_URL}${pagePath}"/><meta property="og:image" content="${SITE_URL}/music-japan-og.png"/><meta name="twitter:card" content="summary_large_image"/><link rel="stylesheet" href="/assets/index-DjF1m6Ft.css"/><link rel="stylesheet" href="${MEDIA_STYLESHEET_URL}"/><link rel="stylesheet" href="${PAGES_STYLESHEET_URL}"/><link rel="icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${APPLE_ICON_URL}"/><script type="application/ld+json">${JSON.stringify(structuredData)}</script></head><body><div class="site-shell inner-shell locale-${locale}" lang="${isJa ? "ja" : "en"}">${renderSiteHeader(locale, page)}<main id="main-content" class="inner-page__main" tabindex="-1">${renderInnerHero(locale, page)}<div class="inner-page__content inner-page__content--${page}">${visibleBody}</div></main>${renderSiteFooter(locale)}${renderInnerPageScript(locale, page === "contact")}</div></body></html>`;
}

function extractSection(documentHtml, marker, label) {
  const start = documentHtml.indexOf(marker);
  const end = documentHtml.indexOf("</section>", start);
  if (start === -1 || end === -1) throw new Error(`Could not extract ${label}`);
  return documentHtml.slice(start, end + "</section>".length);
}

function renderContentPage(locale, page, homeDocument) {
  const sections = page === "music"
    ? [
        extractSection(homeDocument, '<section class="works content-frame"', `${locale} music works`),
        extractSection(homeDocument, '<section class="projects content-frame"', `${locale} music projects`)
      ]
    : page === "media"
      ? [extractSection(homeDocument, '<section class="related media-feature content-frame"', `${locale} media`)]
      : page === "about"
        ? [extractSection(homeDocument, '<section class="about content-frame"', `${locale} about`)]
        : [extractSection(homeDocument, '<section class="contact-section"', `${locale} contact`)];
  return renderStandalonePage(locale, page, sections.join(""));
}

function removeHomepageDetailSections(documentHtml, locale) {
  const founderStart = documentHtml.indexOf('<section class="founder content-frame"');
  const mainEnd = documentHtml.indexOf("</main>", founderStart);
  if (founderStart === -1 || mainEnd === -1) throw new Error(`Could not remove ${locale} homepage detail sections`);
  return documentHtml.slice(0, founderStart) + documentHtml.slice(mainEnd);
}

function patchExistingInternalHeader(documentHtml, locale, page) {
  const className = page === "company" ? "entity-page__header" : "privacy-page__header";
  const start = documentHtml.indexOf(`<header class="${className}">`);
  const end = documentHtml.indexOf("</header>", start);
  if (start === -1 || end === -1) throw new Error(`Could not replace ${locale} ${page} header`);
  documentHtml = documentHtml.slice(0, start) + renderSiteHeader(locale, page === "company" ? "company" : "") + documentHtml.slice(end + "</header>".length);

  if (page === "company") {
    const replacements = locale === "ja" ? [
      ["大阪を拠点に、アーティスト作品と複数の音楽ブランドを企画・制作・配信する独立系音楽会社です。日本から、国境を越えて聴かれ続ける音楽を育てます。", "大阪を拠点に、音楽制作・楽曲配信を軸として、Podcastやインタビューを通じて人の声と経験を記録する音楽・メディア会社です。"],
      ["MUSIC BRANDS", "SECOND TAKE"],
      ["ジャンルごとの音楽ブランド企画・運営", "Podcast・インタビュー記事の企画・取材・発信"],
      ["LICENSE / COLLABORATION", "MEDIA / PARTNERSHIP"],
      ["楽曲使用・ライセンス・協業", "LP掲載・メディア運営・協業"]
    ] : [
      ["An independent music company based in Osaka, Japan, developing artist releases and focused music brands for listeners worldwide.", "A music and media company based in Osaka, creating and distributing music while preserving people’s voices and experiences through podcasts and interviews."],
      ["MUSIC BRANDS", "SECOND TAKE"],
      ["Development and operation of focused music brands", "Planning, interviews and publication for podcasts and editorial stories"],
      ["LICENSE / COLLABORATION", "MEDIA / PARTNERSHIP"],
      ["Music licensing and creative partnerships", "Dedicated pages, media operations and partnerships"]
    ];
    for (const [search, replacement] of replacements) {
      documentHtml = documentHtml.replaceAll(search, replacement);
    }
  }

  documentHtml = documentHtml.replace("</head>", `<link rel="stylesheet" href="${PAGES_STYLESHEET_URL}"/>\n</head>`);
  return documentHtml.replace("</body>", `${renderInnerPageScript(locale)}</body>`);
}

function patchHomeDocument(documentHtml, locale) {
  const visibleReplacements = locale === "ja" ? [
    ["MUSIC COMPANY", "MUSIC &amp; MEDIA"],
    ["合同会社Music Japan · INDEPENDENT MUSIC COMPANY · OSAKA", "合同会社Music Japan · MUSIC &amp; MEDIA COMPANY · OSAKA"],
    ["日本から。国境を越えて。記憶に残る音楽を。", "日本から。音楽と物語を、記憶に残る形へ。"],
    ["アーティスト作品、ジャズ、クラシック、睡眠音楽。異なる音の世界を、一本の赤い周波数で束ねる音楽会社です。", "音楽制作・配信を軸に、Podcastとインタビューで人の声や経験を記録する音楽・メディア会社です。"],
    ["ONE SIGNAL. MANY WORLDS.", "MUSIC. STORIES. CONNECTIONS."],
    ["一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで設計する。Music Japanは、アーティストと音楽ブランドの可能性を、日本から世界へ広げます。", "一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで届ける。さらに、人の声と経験をPodcastや記事に残し、次の人へつなぐ。Music Japanは、音楽を軸に新しい出会いまで育てます。"],
    ["複数の音楽世界を育てる、独立系音楽会社。", "音楽やメディアを通じて、\nより有意義な未来を創る記録を。"],
    ["合同会社Music Japanは、アーティスト作品からジャズ、クラシック、睡眠音楽まで、複数の音楽ブランドを企画・制作・発信しています。作品の数ではなく、ひとつひとつの世界観が届き、残り、次の出会いを生むことを大切にしています。", "合同会社Music Japanは、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を中心に、Podcastやインタビュー記事、LPで経営者の経験や事業を届けています。音楽も言葉も、つくって終わらせず、記憶と次のつながりへ残すことを大切にしています。"],
    ["音楽を“つくって終わるもの”にしない。聴かれる理由と、記憶に残る世界までつくる。それがMusic Japanの仕事です。", "どうしようもなくつらい経験、孤独や絶望。それらをただ憎み、退けるのではなく、向き合い表現することで、日常生活では決して生まれないアウトプットが生まれると私は思います。\n\n音楽やメディア、Podcastというのは表現の手段です。\n\n合同会社Music Japanは、あらゆる自己表現とそこの共鳴からうまれる思いを繋ぎ、そして今苦境の最中にいる人の支えになるようなそんな記録を世に残せたらと思っています。"],
    ["日本語で描く、都市と感情。", "Yumaが紡ぐ、想いと軌跡。"],
    ["楽曲制作、BGM、ライセンス、協業のご相談はこちらから。内容を確認後、担当よりご連絡します。", "楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談はこちらから。内容を確認後、担当よりご連絡します。"],
    ["MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.", "MUSIC. STORIES. CONNECTIONS. FROM JAPAN."]
  ] : [
    ["MUSIC COMPANY", "MUSIC &amp; MEDIA"],
    ["MUSIC JAPAN LLC · INDEPENDENT MUSIC COMPANY · OSAKA, JAPAN", "MUSIC JAPAN LLC · MUSIC &amp; MEDIA COMPANY · OSAKA, JAPAN"],
    ["Music from Japan. Made to travel. Built to last.", "Music and stories from Japan, made to last."],
    ["Artist releases, jazz, classical and sleep music—distinct sonic worlds connected by one red frequency.", "Music production and distribution at our core, using podcasts and interviews to preserve people’s voices and experiences."],
    ["ONE SIGNAL. MANY WORLDS.", "MUSIC. STORIES. CONNECTIONS."],
    ["We make the music, shape the world around it, and design how it keeps reaching listeners. From Japan, Music Japan develops artist releases and focused music brands for audiences worldwide.", "We make the music, shape the world around it and help it keep reaching listeners. We also preserve people’s voices and experience through podcasts and articles, carrying each story toward its next connection."],
    ["An independent music company building many sonic worlds.", "Through music and media,\nwe leave records that shape a more meaningful future."],
    ["Music Japan LLC develops artist releases and dedicated jazz, classical and sleep-music brands. Every release is designed to find its audience, stay with them and lead to the next listen.", "Music Japan LLC creates and distributes artist releases, jazz, classical and sleep music. We also use podcasts, interview articles and dedicated pages to share the experiences and businesses of company leaders—turning music and words into lasting memories and trusted connections."],
    ["Music should never end at creation. We build the reason it gets heard—and the world that makes it remembered.", "Experiences of unbearable pain, loneliness and despair. I believe that by facing and expressing them—rather than simply hating or rejecting them—we can create work that would never emerge from ordinary life.\n\nMusic, media and podcasts are all means of expression.\n\nAt Music Japan LLC, we hope to connect every form of self-expression with the feelings born through resonance, and leave behind records that may support those who are still living through hardship."],
    ["Talk to us about original music, BGM, licensing or partnerships. We’ll review your message and get back to you directly.", "Talk to us about music, BGM, licensing, SECOND TAKE interviews, Baton introductions or partnerships. We’ll review your message and get back to you directly."],
    ["MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.", "MUSIC. STORIES. CONNECTIONS. FROM JAPAN."]
  ];

  for (const [search, replacement] of visibleReplacements) {
    if (!documentHtml.includes(search)) throw new Error(`Home copy was not found: ${search}`);
    documentHtml = documentHtml.replace(search, replacement);
  }

  const aboutStart = documentHtml.indexOf('<section class="about content-frame"');
  const aboutSystemStart = documentHtml.indexOf('<div class="about__system"', aboutStart);
  const aboutEnd = documentHtml.indexOf("</section>", aboutSystemStart);
  if (aboutStart === -1 || aboutSystemStart === -1 || aboutEnd === -1) throw new Error(`Could not isolate ${locale} company brand rows`);
  documentHtml = documentHtml.slice(0, aboutSystemStart) + renderBrandRows(locale) + documentHtml.slice(aboutEnd);

  const relatedStart = documentHtml.indexOf('<section class="related content-frame">');
  const contactStart = documentHtml.indexOf('<section class="contact-section"', relatedStart);
  if (relatedStart === -1 || contactStart === -1) throw new Error(`Could not isolate ${locale} related section`);
  documentHtml = documentHtml.slice(0, relatedStart) + documentHtml.slice(contactStart);

  const manifestoStart = documentHtml.indexOf('<section class="manifesto content-frame">');
  const worksStart = documentHtml.indexOf('<section class="works content-frame"', manifestoStart);
  if (manifestoStart === -1 || worksStart === -1) throw new Error(`Could not locate ${locale} top sections`);
  documentHtml = documentHtml.slice(0, manifestoStart) + renderNews(locale) + documentHtml.slice(manifestoStart, worksStart) + renderMedia(locale) + documentHtml.slice(worksStart);

  documentHtml = documentHtml
    .replace('<small>MUSIC COMPANY</small>', '<small>MUSIC &amp; MEDIA</small>')
    .replace('<div class="hero__index" aria-hidden="true">001 — 006</div>', '<div class="hero__index" aria-hidden="true">001 — 007</div>')
    .replace('JAZZ · CLASSICAL · SLEEP · J-POP', 'MUSIC · PODCAST · INTERVIEW · STORIES')
    .replace('class="button button--ghost" href="#contact"', `class="button button--ghost" href="${locale === "ja" ? "/contact/" : "/en/contact/"}"`);

  const oldGenres = ["ARTIST", "JAZZ", "CLASSICAL", "SLEEP", "BGM"];
  const newGenres = ["ARTIST", "JAZZ", "CLASSICAL", "PODCAST", "STORIES"];
  for (let index = 0; index < oldGenres.length; index += 1) {
    const oldGenre = `<span><i>0<!-- -->${index + 1}</i>${oldGenres[index]}</span>`;
    const newGenre = `<span><i>0<!-- -->${index + 1}</i>${newGenres[index]}</span>`;
    documentHtml = documentHtml.replace(oldGenre, newGenre);
  }

  const nav = pageCopy[locale].nav;
  const navStart = documentHtml.indexOf('<nav id="primary-navigation"');
  const navEnd = documentHtml.indexOf("</nav>", navStart);
  if (navStart === -1 || navEnd === -1) throw new Error(`Could not locate ${locale} navigation`);
  let navHtml = documentHtml.slice(navStart, navEnd + 6);
  const navLinks = nav.map(([page, label]) => `<a href="${internalPath(locale, page)}">${label}</a>`).join("");
  navHtml = navHtml.replace(/<a href="#[^"]+">[^<]+<\/a>/g, "");
  navHtml = navHtml.replace(/<\/nav>$/, `${navLinks}</nav>`);
  documentHtml = documentHtml.slice(0, navStart) + navHtml + documentHtml.slice(navEnd + 6);

  const inquiryOptions = locale === "ja"
    ? ["楽曲・BGM制作のご依頼", "楽曲使用・ライセンス", "Podcast出演・インタビュー掲載", "Baton・ご紹介", "協業・パートナーシップ", "その他"]
    : ["Music & BGM commissions", "Music usage & licensing", "SECOND TAKE interviews", "Baton introductions", "Partnerships & collaboration", "Other"];
  const inquiryPlaceholder = locale === "ja" ? "選択してください" : "Please select";
  const selectStart = documentHtml.indexOf('<select name="type" required="">');
  const selectContentStart = documentHtml.indexOf(">", selectStart) + 1;
  const selectEnd = documentHtml.indexOf("</select>", selectContentStart);
  if (selectStart === -1 || selectContentStart === 0 || selectEnd === -1) throw new Error(`Could not locate ${locale} inquiry options`);
  const optionMarkup = `<option value="" disabled="" selected="">${inquiryPlaceholder}</option>${inquiryOptions.map((option) => `<option value="${option}">${option}</option>`).join("")}`;
  documentHtml = documentHtml.slice(0, selectContentStart) + optionMarkup + documentHtml.slice(selectEnd);

  return documentHtml;
}

function updateHomeMetadata(documentHtml, locale) {
  const replacements = locale === "ja" ? [
    ["合同会社Music Japan 公式サイト | 音楽制作・楽曲配信", "合同会社Music Japan 公式サイト | 音楽制作・Podcast・インタビュー"],
    ["大阪の音楽会社・合同会社Music Japan公式サイト。Yumaのアーティスト作品、ジャズ、クラシック、睡眠音楽、オリジナル楽曲・BGMを企画、制作、配信しています。", "合同会社Music Japan公式サイト。音楽制作・楽曲配信を軸に、Podcast『SECOND TAKE』とインタビューを通じて、人の声や経験を記録・発信しています。"],
    ["合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,大阪 音楽会社,Yuma", "合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,Podcast,ポッドキャスト,経営者インタビュー,SECOND TAKE,Baton,大阪 音楽会社,Yuma"],
    ["大阪から世界へ。アーティスト作品と複数の音楽ブランドを企画・制作・配信する音楽会社。", "音楽制作・配信を軸に、Podcast、経営者インタビュー、記事制作を手がける音楽・メディア会社。"],
    ["大阪を拠点に、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を行う独立系音楽会社。", "大阪を拠点に、音楽制作・配信、Podcast、経営者インタビュー、記事制作を手がける音楽・メディア会社。"],
    ["アーティスト作品、ジャズ、クラシック、睡眠音楽を企画・制作・配信する音楽会社の公式サイト。", "音楽制作・配信、Podcast、インタビュー記事を手がける合同会社Music Japanの公式サイト。"]
  ] : [
    ["Music Japan LLC Official Website | Music Production &amp; Distribution", "Music Japan LLC | Music, Podcasts &amp; Interviews"],
    ["The official website of Music Japan LLC, an independent music company in Osaka creating and distributing Yuma releases, jazz, classical, sleep music, original music and BGM.", "The official website of Music Japan LLC: music production and distribution, alongside the SECOND TAKE podcast and interviews that preserve people’s voices and experiences."],
    ["合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,大阪 音楽会社,Yuma", "Music Japan LLC,music production,music distribution,BGM,podcast,executive interviews,SECOND TAKE,Baton,Osaka music company,Yuma"],
    ["An independent music company in Osaka building artist releases and focused music brands for listeners worldwide.", "A music and media company in Osaka creating music, podcasts, executive interviews and editorial content."],
    ["大阪を拠点に、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を行う独立系音楽会社。", "大阪を拠点に、音楽制作・配信、Podcast、経営者インタビュー、記事制作を手がける音楽・メディア会社。"],
    ["The official website of an independent music company creating and distributing artist releases, jazz, classical and sleep music.", "The official website of Music Japan LLC, creating music, podcasts, executive interviews and editorial content."]
  ];

  for (const [search, replacement] of replacements) {
    if (documentHtml.includes(search)) documentHtml = documentHtml.replaceAll(search, replacement);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "PodcastSeries",
        "@id": `${SECOND_TAKE_URL}#podcast-series`,
        name: "SECOND TAKE",
        url: SECOND_TAKE_URL,
        inLanguage: "ja",
        description: "経営者の決断と苦悩、その先にある物語を記録するPodcast・インタビューメディア。",
        publisher: { "@id": `${SITE_URL}/#organization` }
      },
      {
        "@type": "Service",
        "@id": `${BATON_URL}#service`,
        name: "Baton",
        url: BATON_URL,
        serviceType: "招待制のビジネス紹介サービス",
        provider: { "@id": `${SITE_URL}/#organization` }
      }
    ]
  };
  return documentHtml.replace("</head>", `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>\n</head>`);
}

function renderProfilePage(locale) {
  const isJa = locale === "ja";
  const pagePath = isJa ? "/profile/" : "/en/profile/";
  const homePath = isJa ? "/" : "/en/";
  const title = isJa
    ? "代表プロフィール | 壁谷 友生 | 合同会社Music Japan"
    : "Representative Profile | Tomoki Kabeya | Music Japan LLC";
  const description = isJa
    ? "合同会社Music Japan 代表社員・壁谷友生のプロフィールと、音楽・メディア・Podcastを通じて残したい記録への思い"
    : "The profile of Tomoki Kabeya, representative member of Music Japan LLC, and his thoughts on the records he hopes to leave through music, media and podcasts";
  const portraitAlt = isJa
    ? "合同会社Music Japan 代表社員 壁谷友生"
    : "Tomoki Kabeya, representative member of Music Japan LLC";
  const name = isJa ? "壁谷 友生" : "Tomoki Kabeya";
  const roman = isJa ? "Kabeya Tomoki" : "壁谷 友生 / Kabeya Tomoki";
  const role = isJa ? "合同会社Music Japan 代表社員" : "Representative Member, Music Japan LLC";
  const statement = isJa
    ? [
        "どうしようもなくつらい経験、孤独や絶望。それらをただ憎み、退けるのではなく、向き合い表現することで、日常生活では決して生まれないアウトプットが生まれると私は思います。",
        "音楽やメディア、Podcastというのは表現の手段です。",
        "合同会社Music Japanは、あらゆる自己表現とそこの共鳴からうまれる思いを繋ぎ、そして今苦境の最中にいる人の支えになるようなそんな記録を世に残せたらと思っています。"
      ]
    : [
        "Experiences of unbearable pain, loneliness and despair. I believe that by facing and expressing them—rather than simply hating or rejecting them—we can create work that would never emerge from ordinary life.",
        "Music, media and podcasts are all means of expression.",
        "At Music Japan LLC, we hope to connect every form of self-expression with the feelings born through resonance, and leave behind records that may support those who are still living through hardship."
      ];
  const backLabel = isJa ? "公式サイトへ戻る" : "Back to the official site";
  const profileLabel = isJa ? "代表プロフィール" : "Representative profile";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${SITE_URL}${pagePath}#webpage`,
    url: `${SITE_URL}${pagePath}`,
    name: title,
    description,
    inLanguage: isJa ? "ja" : "en",
    mainEntity: {
      "@type": "Person",
      "@id": `${SITE_URL}/#founder`,
      name: "壁谷 友生",
      alternateName: "Tomoki Kabeya",
      jobTitle: isJa ? "代表社員" : "Representative Member",
      image: `${SITE_URL}/kabeya-tomoki.png`,
      worksFor: { "@id": `${SITE_URL}/#organization` }
    }
  };
  const statementHtml = statement.map((paragraph) => `<p>${paragraph}</p>`).join("");

  return `<!doctype html><html lang="${isJa ? "ja" : "en"}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title><meta name="description" content="${description}"/><meta name="robots" content="index,follow,max-image-preview:large"/><link rel="canonical" href="${SITE_URL}${pagePath}"/><link rel="alternate" hreflang="ja-JP" href="${SITE_URL}/profile/"/><link rel="alternate" hreflang="en" href="${SITE_URL}/en/profile/"/><link rel="alternate" hreflang="x-default" href="${SITE_URL}/profile/"/><meta property="og:type" content="profile"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${SITE_URL}${pagePath}"/><meta property="og:image" content="${SITE_URL}/music-japan-og.png"/><meta name="twitter:card" content="summary_large_image"/><link rel="stylesheet" href="/assets/index-DjF1m6Ft.css"/><link rel="stylesheet" href="${PROFILE_STYLESHEET_URL}"/><link rel="stylesheet" href="${PAGES_STYLESHEET_URL}"/><link rel="icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${APPLE_ICON_URL}"/><script type="application/ld+json">${JSON.stringify(structuredData)}</script></head><body><div class="profile-page inner-shell locale-${locale}">${renderSiteHeader(locale, "profile")}<main class="profile-main" id="main-content"><section class="profile-hero" aria-labelledby="profile-title"><div class="profile-portrait"><img src="/kabeya-tomoki.png" alt="${portraitAlt}" width="861" height="859"/><div class="profile-portrait__frame" aria-hidden="true"></div><span class="profile-portrait__label">OSAKA / JAPAN · 2026</span></div><div class="profile-copy"><p class="profile-kicker">REPRESENTATIVE MEMBER</p><h1 id="profile-title">${name}</h1><p class="profile-roman">${roman}</p><p class="profile-role">${role}</p><div class="profile-statement">${statementHtml}</div></div></section><a class="profile-back" href="${homePath}"><span aria-hidden="true">←</span>${backLabel}</a></main><footer class="profile-footer"><span>© 2026 MUSIC JAPAN LLC</span><span>${profileLabel} · OSAKA / JAPAN</span></footer>${renderInnerPageScript(locale)}</div></body></html>`;
}

function appendGeneratedEntries(sitemapXml) {
  const pageNames = ["music", "media", "about", "profile", "contact"];
  const entries = pageNames.flatMap((page) => {
    const jaPath = internalPath("ja", page);
    const enPath = internalPath("en", page);
    const entry = (path) => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <xhtml:link rel="alternate" hreflang="ja-JP" href="${SITE_URL}${jaPath}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${enPath}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${jaPath}" />\n  </url>\n`;
    return [entry(jaPath), entry(enPath)];
  }).join("");
  return sitemapXml.replace("</urlset>", `${entries}</urlset>`);
}

rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });

const virtualFiles = new Map([
  [
    "music-japan-og.png",
    [
      "archive-parts/music-japan-og.png.part-000",
      "archive-parts/music-japan-og.png.part-001",
      "archive-parts/music-japan-og.png.part-002",
      "archive-parts/music-japan-og.png.part-003"
    ]
  ],
  [
    "kabeya-tomoki.png",
    [
      "archive-parts/kabeya-tomoki.png.part-000",
      "archive-parts/kabeya-tomoki.png.part-001",
      "archive-parts/kabeya-tomoki.png.part-002"
    ]
  ]
]);

for (const [target, parts] of virtualFiles) {
  const buffers = parts.map((part) => readFileSync(join(source, part)));
  writeFileSync(join(output, target), Buffer.concat(buffers));
}

rmSync(join(output, "archive-parts"), { recursive: true, force: true });

const patchedClientBundle = patchClientBundle();
const versionedClientGraph = versionClientModuleGraph(patchedClientBundle);

const publicHtmlFiles = [
  "index.html",
  "en/index.html",
  "company/index.html",
  "en/company/index.html",
  "privacy/index.html",
  "en/privacy/index.html"
];
const profileHtmlFiles = [
  { path: "profile/index.html", locale: "ja" },
  { path: "en/profile/index.html", locale: "en" }
];
const contentPageFiles = [
  ...["music", "media", "about", "contact"].map((page) => ({ path: `${page}/index.html`, locale: "ja", page })),
  ...["music", "media", "about", "contact"].map((page) => ({ path: `en/${page}/index.html`, locale: "en", page }))
];
const homeDocuments = new Map();

let rewrittenReferences = 0;

for (const relativePath of publicHtmlFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing public HTML during deploy: ${relativePath}`);

  const original = readFileSync(fullPath, "utf8");
  const markerIndex = original.indexOf(RSC_MARKER);
  if (markerIndex === -1) throw new Error(`RSC marker missing: ${relativePath}`);

  const bootstrapEnd = original.indexOf("</script>", markerIndex);
  if (bootstrapEnd === -1) throw new Error(`RSC bootstrap close tag missing: ${relativePath}`);

  // The marker script is the client bootstrap. The length-prefixed serialized
  // payload starts after it and remains byte-for-byte unchanged.
  let documentHtml = original.slice(0, markerIndex);
  let rscBootstrap = original.slice(markerIndex, bootstrapEnd + "</script>".length);
  const rscPayload = original.slice(bootstrapEnd + "</script>".length);
  const referenceCount = documentHtml.split(OLD_SITE_URL).length - 1;
  if (referenceCount === 0) throw new Error(`Expected legacy host reference missing in document HTML: ${relativePath}`);

  // Canonical/OGP/JSON-LD host migration
  documentHtml = documentHtml.replaceAll(OLD_SITE_URL, SITE_URL);

  // A shared query version keeps the cyclic client modules on one fresh graph,
  // avoiding stale homepage code without duplicating React runtime modules.
  for (const assetName of versionedClientGraph.graphNames) {
    documentHtml = documentHtml.replaceAll(
      `/assets/${assetName}`,
      `/assets/${assetName}?${versionedClientGraph.version}`
    );
  }
  rscBootstrap = rscBootstrap.replaceAll(
    `/assets/${versionedClientGraph.entryName}`,
    `/assets/${versionedClientGraph.entryName}?${versionedClientGraph.version}`
  );

  if (relativePath === "index.html" || relativePath === "en/index.html") {
    const locale = relativePath === "index.html" ? "ja" : "en";
    documentHtml = patchHomeDocument(documentHtml, locale);
    homeDocuments.set(locale, documentHtml);
    documentHtml = removeHomepageDetailSections(documentHtml, locale);
    documentHtml = updateHomeMetadata(documentHtml, locale);
    documentHtml = documentHtml.replace(
      "</head>",
      `<link rel="stylesheet" href="${MEDIA_STYLESHEET_URL}"/>\n</head>`
    );
  } else {
    const locale = relativePath.startsWith("en/") ? "en" : "ja";
    const page = relativePath.includes("company/") ? "company" : "privacy";
    documentHtml = patchExistingInternalHeader(documentHtml, locale, page);
  }

  // Remove every pre-existing favicon declaration so Chrome has one unambiguous browser-tab icon.
  documentHtml = documentHtml
    .replace(/<link\s+rel="shortcut icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="apple-touch-icon"[^>]*\/>/gi, "");

  const faviconTags = `<link rel="icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${APPLE_ICON_URL}"/>`;
  if (!documentHtml.includes("</head>")) throw new Error(`Head close tag missing: ${relativePath}`);
  documentHtml = documentHtml.replace("</head>", `${faviconTags}\n</head>`);

  const isHomepage = relativePath === "index.html" || relativePath === "en/index.html";
  const rewritten = isHomepage ? documentHtml + rscBootstrap + rscPayload : documentHtml;

  // Byte-for-byte protection for hydration data
  if (isHomepage && rewritten.slice(documentHtml.length + rscBootstrap.length) !== rscPayload) {
    throw new Error(`RSC payload changed unexpectedly: ${relativePath}`);
  }

  writeFileSync(fullPath, rewritten);
  rewrittenReferences += referenceCount;
}

const machineReadableFiles = ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"];
for (const relativePath of machineReadableFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing SEO/AIO file during deploy: ${relativePath}`);
  const original = readFileSync(fullPath, "utf8");
  writeFileSync(fullPath, original.replaceAll(LEGACY_PAGES_URL, SITE_URL));
}

for (const profile of profileHtmlFiles) {
  const fullPath = join(output, profile.path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, renderProfilePage(profile.locale));
}

for (const contentPage of contentPageFiles) {
  const homeDocument = homeDocuments.get(contentPage.locale);
  if (!homeDocument) throw new Error(`Missing ${contentPage.locale} homepage source for ${contentPage.page}`);
  const fullPath = join(output, contentPage.path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, renderContentPage(contentPage.locale, contentPage.page, homeDocument));
}

const sitemapPath = join(output, "sitemap.xml");
writeFileSync(sitemapPath, appendGeneratedEntries(readFileSync(sitemapPath, "utf8")));

for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = markerIndex === -1 ? html : html.slice(0, markerIndex);

  if (documentHtml.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in document HTML: ${relativePath}`);
  if (!documentHtml.includes(SITE_URL)) throw new Error(`Canonical host missing in document HTML: ${relativePath}`);
  if (!documentHtml.includes('rel="canonical"')) throw new Error(`Canonical link missing: ${relativePath}`);
  if (!documentHtml.includes('application/ld+json')) throw new Error(`Structured data missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New shortcut favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="apple-touch-icon" href="${APPLE_ICON_URL}"`)) throw new Error(`Apple touch icon missing: ${relativePath}`);

  if (relativePath === "index.html" || relativePath === "en/index.html") {
    const locale = relativePath === "index.html" ? "ja" : "en";
    if (!documentHtml.includes(`/assets/${versionedClientGraph.entryName}?${versionedClientGraph.version}`)) throw new Error(`Versioned client entry missing: ${relativePath}`);
    if (!documentHtml.includes('id="news"')) throw new Error(`News section missing: ${relativePath}`);
    if (!documentHtml.includes('id="media"')) throw new Error(`Media section missing: ${relativePath}`);
    if (!documentHtml.includes(SECOND_TAKE_URL)) throw new Error(`SECOND TAKE link missing: ${relativePath}`);
    if (!documentHtml.includes(BATON_URL)) throw new Error(`Baton link missing: ${relativePath}`);
    if (!documentHtml.includes(`href="${MEDIA_STYLESHEET_URL}"`)) throw new Error(`Media refresh stylesheet missing: ${relativePath}`);
    if (!documentHtml.includes(`/assets/${patchedClientBundle.name}?${versionedClientGraph.version}`)) throw new Error(`Versioned client bundle missing: ${relativePath}`);
    if (documentHtml.includes("Standment")) throw new Error(`Legacy Standment copy remains: ${relativePath}`);
    if (documentHtml.includes('class="founder content-frame"')) throw new Error(`Founder remains on homepage: ${relativePath}`);
    if (documentHtml.includes('class="contact-section"')) throw new Error(`Contact remains on homepage: ${relativePath}`);
    for (const [page, label] of pageCopy[locale].nav) {
      if (!documentHtml.includes(`<a href="${internalPath(locale, page)}">${label}</a>`)) {
        throw new Error(`Internal navigation link missing on ${relativePath}: ${page}`);
      }
    }
    if (!(documentHtml.indexOf('id="news"') < documentHtml.indexOf('class="manifesto content-frame"') &&
      documentHtml.indexOf('class="manifesto content-frame"') < documentHtml.indexOf('id="media"') &&
      documentHtml.indexOf('id="media"') < documentHtml.indexOf('class="works content-frame"'))) {
      throw new Error(`Homepage section order is incorrect: ${relativePath}`);
    }
  } else {
    if (!documentHtml.includes('class="site-header inner-site-header"')) throw new Error(`Shared internal header missing: ${relativePath}`);
    if (!documentHtml.includes('src="/music-japan-symbol.png"')) throw new Error(`Header logo missing: ${relativePath}`);
  }
}

for (const profile of profileHtmlFiles) {
  const html = readFileSync(join(output, profile.path), "utf8");
  const pagePath = profile.locale === "ja" ? "/profile/" : "/en/profile/";
  if (!html.includes(`rel="canonical" href="${SITE_URL}${pagePath}"`)) throw new Error(`Profile canonical link missing: ${profile.path}`);
  if (!html.includes(`href="${PROFILE_STYLESHEET_URL}"`)) throw new Error(`Profile stylesheet missing: ${profile.path}`);
  if (!html.includes(`href="${PAGES_STYLESHEET_URL}"`)) throw new Error(`Internal page stylesheet missing: ${profile.path}`);
  if (!html.includes("kabeya-tomoki.png")) throw new Error(`Profile portrait missing: ${profile.path}`);
  if (!html.includes('class="site-header inner-site-header"')) throw new Error(`Shared profile header missing: ${profile.path}`);
  if (!html.includes('src="/music-japan-symbol.png"')) throw new Error(`Profile header logo missing: ${profile.path}`);
  if (!html.includes('application/ld+json')) throw new Error(`Profile structured data missing: ${profile.path}`);
}

for (const contentPage of contentPageFiles) {
  const html = readFileSync(join(output, contentPage.path), "utf8");
  const pagePath = internalPath(contentPage.locale, contentPage.page);
  if (!html.includes(`rel="canonical" href="${SITE_URL}${pagePath}"`)) throw new Error(`Page canonical link missing: ${contentPage.path}`);
  if (!html.includes(`href="${PAGES_STYLESHEET_URL}"`)) throw new Error(`Internal page stylesheet missing: ${contentPage.path}`);
  if (!html.includes('class="site-header inner-site-header"')) throw new Error(`Shared page header missing: ${contentPage.path}`);
  if (!html.includes('src="/music-japan-symbol.png"')) throw new Error(`Page header logo missing: ${contentPage.path}`);
  if (!html.includes('application/ld+json')) throw new Error(`Page structured data missing: ${contentPage.path}`);
  if (contentPage.page === "contact" && !html.includes('class="contact-form"')) throw new Error(`Contact form missing: ${contentPage.path}`);
}

const patchedBundleContents = readFileSync(join(output, "assets", patchedClientBundle.name), "utf8");
for (const requiredToken of ["news-strip", "media-feature", SECOND_TAKE_URL, BATON_URL]) {
  if (!patchedBundleContents.includes(requiredToken)) throw new Error(`Client bundle token missing: ${requiredToken}`);
}
if (patchedBundleContents.includes("Standment")) throw new Error("Legacy Standment copy remains in client bundle");
if (patchedBundleContents.includes('className:`founder content-frame`')) throw new Error("Founder remains in homepage client bundle");
if (patchedBundleContents.includes('className:`contact-section`')) throw new Error("Contact remains in homepage client bundle");

for (const relativePath of machineReadableFiles) {
  const content = readFileSync(join(output, relativePath), "utf8");
  if (content.includes(OLD_SITE_URL) || content.includes(LEGACY_PAGES_URL)) {
    throw new Error(`Legacy host remains in SEO/AIO file: ${relativePath}`);
  }
}

for (const requiredFile of ["music-japan-og.png", "kabeya-tomoki.png", "music-japan-symbol.png", "favicon-music-japan.svg", "music-japan-logo.png", "second-take-logo.png", "baton-logo.png", "baton-wordmark-v2.png", "assets/music-japan-profile.css", "assets/music-japan-pages.css"]) {
  const fullPath = join(output, requiredFile);
  if (!existsSync(fullPath) || statSync(fullPath).size === 0) {
    throw new Error(`Required branding/SEO file is missing or empty: ${requiredFile}`);
  }
}

const localAssetRefs = new Set();
const allHtmlFiles = [...publicHtmlFiles, ...profileHtmlFiles.map((profile) => profile.path), ...contentPageFiles.map((page) => page.path)];
for (const relativePath of allHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = markerIndex === -1 ? html : html.slice(0, markerIndex);
  for (const match of documentHtml.matchAll(/(?:href|src)="\/(assets\/[^"?#]+)"/g)) {
    localAssetRefs.add(match[1]);
  }
}
for (const assetPath of localAssetRefs) {
  if (!existsSync(join(output, assetPath))) throw new Error(`Referenced local asset is missing: /${assetPath}`);
}

console.log(`Prepared static deploy directory: ${output}`);
console.log(`Canonical host: ${SITE_URL}`);
console.log(`Chrome/tab favicon: ${FAVICON_URL}`);
console.log(`Patched homepage content and client bundle: ${patchedClientBundle.name}?${versionedClientGraph.version}`);
console.log(`Safely rewrote ${rewrittenReferences} SEO references and generated ${profileHtmlFiles.length + contentPageFiles.length} internal pages.`);
console.log(`Preserved all RSC hydration payloads byte-for-byte.`);
console.log(`Validated ${machineReadableFiles.length} SEO/AIO files, ${localAssetRefs.size} local assets, and required branding files.`);
