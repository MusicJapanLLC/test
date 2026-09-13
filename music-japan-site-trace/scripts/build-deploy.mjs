// Cloudflare Pages deploy build
// Keep the known-good static copy/reassembly path intact, then apply the official-site content refresh.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
const MEDIA_STYLESHEET_URL = "/assets/music-japan-media-refresh.css?v=20260913";
const SECOND_TAKE_URL = "https://secondtake.music-japan.com/";
const BATON_URL = "https://baton.music-japan.com/";

const content = {
  ja: {
    newsKicker: "NEWS / UPDATES",
    newsTitle: "お知らせ",
    newsItems: [
      { date: "2026.09.13", dateTime: "2026-09-13", label: "NEWS", title: "公式サイトを music-japan.com へ移行しました", href: "" },
      { date: "2026.09.13", dateTime: "2026-09-13", label: "MEDIA", title: "経営者メディア「SECOND TAKE」を公開しました", href: SECOND_TAKE_URL },
      { date: "2026.09.13", dateTime: "2026-09-13", label: "SERVICE", title: "招待制の紹介サービス「Baton」を公開しました", href: BATON_URL }
    ],
    mediaKicker: "MEDIA / CONNECTION",
    mediaTitle: "声を記録し、記事に残し、人へつなぐ。",
    mediaBody: "経営者の決断や苦悩をPodcastと記事で届け、そこから生まれた信頼を次のつながりへ。Music Japanが「取材・発信・紹介」まで一貫して手がけます。",
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
        body: "取材や面談で知った人同士を、双方の意思を大切にしながらつなぐ招待制の紹介サービス。",
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
        title: "Podcast × インタビュー記事",
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
        body: "面談済みの方を対象に、双方の意思を大切にしながら人と人をつなぎます。",
        logo: "/baton-logo.png",
        alt: "Baton -バトン-",
        width: 580,
        height: 174,
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
      { date: "2026.09.13", dateTime: "2026-09-13", label: "SERVICE", title: "Baton, our invitation-only introduction service, is now live", href: BATON_URL }
    ],
    mediaKicker: "MEDIA / CONNECTION",
    mediaTitle: "Record the voice. Publish the story. Pass it on.",
    mediaBody: "We turn the decisions and struggles of business leaders into podcasts and interview articles, then help trusted relationships lead to thoughtful introductions.",
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
        body: "An invitation-only service connecting people we have met through interviews and conversations, with care for both sides.",
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
        title: "Podcasts × interview articles",
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
        body: "We connect people we have met with, respecting the intent and trust of both sides.",
        logo: "/baton-logo.png",
        alt: "Baton invitation-only introduction service",
        width: 580,
        height: 174,
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

  const newsBlock = '(0,a.jsxs)(`section`,{className:`news-strip content-frame`,id:`news`,"aria-labelledby":`news-title`,children:[(0,a.jsxs)(`div`,{className:`news-strip__heading`,"data-reveal":!0,children:[(0,a.jsx)(`p`,{className:`kicker`,children:t.newsKicker}),(0,a.jsx)(`h2`,{id:`news-title`,children:t.newsTitle})]}),(0,a.jsx)(`div`,{className:`news-strip__list`,"data-reveal":!0,children:t.newsItems.map((t,n)=>{let r=(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(`time`,{dateTime:t.dateTime,children:t.date}),(0,a.jsx)(`span`,{className:`news-strip__label`,children:t.label}),(0,a.jsx)(`span`,{className:`news-strip__title`,children:t.title}),(0,a.jsx)(`span`,{className:`news-strip__arrow`,"aria-hidden":`true`,children:t.href?`↗`:``})]});return t.href?(0,a.jsx)(`a`,{className:`news-strip__item`,href:t.href,target:`_blank`,rel:`noopener noreferrer`,"aria-label":`${t.title}${e===`ja`?`（新しいタブで開きます）`:` (opens in a new tab)`}`,children:r},t.title):(0,a.jsx)(`div`,{className:`news-strip__item`,children:r},t.title)})})]})';
  const manifestoMarker = '(0,a.jsxs)(`section`,{className:`manifesto content-frame`';
  const manifestoStart = bundle.indexOf(manifestoMarker);
  if (manifestoStart === -1) throw new Error("Could not locate the manifesto section");
  bundle = bundle.slice(0, manifestoStart) + newsBlock + "," + bundle.slice(manifestoStart);

  const bundleReplacements = [
    ['var g=[[`.hero`,`001 / SIGNAL`],[`.manifesto`,`002 / MANIFESTO`],[`.works`,`003 / ARTIST`],[`.projects`,`004 / CATALOG`],[`.about`,`005 / COMPANY`],[`.founder`,`006 / FOUNDER`],[`.contact-section`,`007 / CONTACT`]];', 'var g=[[`.hero`,`001 / SIGNAL`],[`.news-strip`,`002 / NEWS`],[`.manifesto`,`003 / MANIFESTO`],[`.media-feature`,`004 / MEDIA`],[`.works`,`005 / ARTIST`],[`.projects`,`006 / CATALOG`],[`.about`,`007 / COMPANY`],[`.founder`,`008 / FOUNDER`],[`.contact-section`,`009 / CONTACT`]];', "experience rail sequence"],
    ['nav:[[`作品`,`#works`],[`私たちについて`,`#about`],[`代表`,`#founder`],[`お問い合わせ`,`#contact`]]', 'nav:[[`音楽`,`#works`],[`メディア`,`#media`],[`私たちについて`,`#about`],[`お問い合わせ`,`#contact`]]', "Japanese navigation"],
    ['heroEyebrow:`合同会社Music Japan · INDEPENDENT MUSIC COMPANY · OSAKA`', 'heroEyebrow:`合同会社Music Japan · MUSIC & MEDIA COMPANY · OSAKA`', "Japanese hero eyebrow"],
    ['heroLead:`日本から。国境を越えて。記憶に残る音楽を。`', 'heroLead:`日本から。音楽と物語を、記憶に残る形へ。`', "Japanese hero lead"],
    ['heroSub:`アーティスト作品、ジャズ、クラシック、睡眠音楽。異なる音の世界を、一本の赤い周波数で束ねる音楽会社です。`', 'heroSub:`音楽制作・配信を軸に、Podcast、インタビュー記事、招待制の紹介サービスを手がける音楽・メディア会社です。`', "Japanese hero summary"],
    ['manifestoKicker:`ONE SIGNAL. MANY WORLDS.`,manifestoTitle:`音楽は、ジャンルを越えて残っていく。`', 'manifestoKicker:`MUSIC. STORIES. CONNECTIONS.`,manifestoTitle:`音楽は、ジャンルを越えて残っていく。`', "Japanese manifesto kicker"],
    ['manifestoBody:`一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで設計する。Music Japanは、アーティストと音楽ブランドの可能性を、日本から世界へ広げます。`,worksKicker:', 'manifestoBody:`一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで届ける。さらに、人の声と経験をPodcastや記事に残し、次の人へつなぐ。Music Japanは、音楽を軸に新しい出会いまで育てます。`,newsKicker:`NEWS / UPDATES`,newsTitle:`お知らせ`,newsItems:[{date:`2026.09.13`,dateTime:`2026-09-13`,label:`NEWS`,title:`公式サイトを music-japan.com へ移行しました`,href:``},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`MEDIA`,title:`経営者メディア「SECOND TAKE」を公開しました`,href:`https://secondtake.music-japan.com/`},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`SERVICE`,title:`招待制の紹介サービス「Baton」を公開しました`,href:`https://baton.music-japan.com/`}],worksKicker:', "Japanese manifesto and news"],
    ['aboutTitle:`複数の音楽世界を育てる、独立系音楽会社。`', 'aboutTitle:`音楽を軸に、声と経験を残す会社。`', "Japanese about title"],
    ['aboutBody:`合同会社Music Japanは、アーティスト作品からジャズ、クラシック、睡眠音楽まで、複数の音楽ブランドを企画・制作・発信しています。作品の数ではなく、ひとつひとつの世界観が届き、残り、次の出会いを生むことを大切にしています。`', 'aboutBody:`合同会社Music Japanは、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を中心に、Podcastやインタビュー記事、LPで経営者の経験や事業を届けています。音楽も言葉も、つくって終わらせず、記憶と次のつながりへ残すことを大切にしています。`', "Japanese about summary"],
    ['pillars:[[`CREATE`,`楽曲・BGMの企画制作`],[`CURATE`,`ジャンルごとの世界観設計`],[`CONNECT`,`国内外のリスナーへ届ける`]]', 'brands:[{kicker:`MUSIC JAPAN`,title:`音楽制作・配信`,body:`アーティスト作品、BGM、Jazz、クラシック、睡眠音楽まで、企画・制作・配信を一貫して手がけます。`,logo:`/music-japan-logo.png`,alt:`合同会社Music Japan`,width:1500,height:500,modifier:`music`},{kicker:`SECOND TAKE`,title:`Podcast × インタビュー記事`,body:`経営者の決断や苦悩、その先にある物語を、Podcastとインタビュー記事で記録し、届けます。`,logo:`/second-take-logo.png`,alt:`SECOND TAKE Podcast・インタビューメディア`,width:2172,height:724,modifier:`second-take`},{kicker:`BATON`,title:`招待制の紹介サービス`,body:`面談済みの方を対象に、双方の意思を大切にしながら人と人をつなぎます。`,logo:`/baton-logo.png`,alt:`Baton -バトン-`,width:580,height:174,modifier:`baton`}]', "Japanese company brands"],
    ['founderQuote:`音楽を“つくって終わるもの”にしない。聴かれる理由と、記憶に残る世界までつくる。それがMusic Japanの仕事です。`', 'founderQuote:`音楽も、人の経験も、つくって終わるものにしない。聴かれ、読まれ、次の出会いへつながるところまで手がける。それがMusic Japanの仕事です。`', "Japanese founder statement"],
    ['relatedKicker:`RELATED VENTURES`,relatedTitle:`音楽から始まる、次の接点。`,relatedCards:[{label:`BUSINESS CONNECTION`,title:`企業様のお繋ぎ・経営者様のご紹介`,body:`株式会社Standmentが運営する、法人・経営者様向けのご縁づくり。`,cta:`特設サイト — COMING SOON`,href:``},{label:`WEBGL EXPERIENCE`,title:`WebGL型HP制作「Standment」`,body:`ブランドの空気まで伝える、体験型Webサイト制作。`,cta:`特設サイトへ移動`,href:`https://savers-japan-digital.pearly-cedar-3983.chatgpt.site/#contact`}]', 'relatedKicker:`MEDIA / CONNECTION`,relatedTitle:`声を記録し、記事に残し、人へつなぐ。`,relatedBody:`経営者の決断や苦悩をPodcastと記事で届け、そこから生まれた信頼を次のつながりへ。Music Japanが「取材・発信・紹介」まで一貫して手がけます。`,relatedCards:[{label:`PODCAST / INTERVIEW`,title:`SECOND TAKE`,body:`経営者の決断と苦悩、その先にある物語を、Podcastとインタビュー記事で記録する経営者メディア。`,cta:`公式サイトへ移動`,href:`https://secondtake.music-japan.com/`},{label:`INVITATION-ONLY INTRODUCTION`,title:`Baton -バトン-`,body:`取材や面談で知った人同士を、双方の意思を大切にしながらつなぐ招待制の紹介サービス。`,cta:`Batonを見る`,href:`https://baton.music-japan.com/`}]', "Japanese media section"],
    ['contactBody:`楽曲制作、BGM、ライセンス、協業のご相談はこちらから。内容を確認後、担当よりご連絡します。`', 'contactBody:`楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談はこちらから。内容を確認後、担当よりご連絡します。`', "Japanese contact summary"],
    ['options:[`協業・パートナーシップ`,`楽曲・BGM制作のご依頼`,`楽曲使用・ライセンス`,`採用について`,`メディア・取材`,`その他`]', 'options:[`楽曲・BGM制作のご依頼`,`楽曲使用・ライセンス`,`Podcast出演・インタビュー掲載`,`Baton・ご紹介`,`協業・パートナーシップ`,`その他`]', "Japanese inquiry options"],
    ['footerLine:`MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.`,privacy:`プライバシーポリシー`', 'footerLine:`MUSIC. STORIES. CONNECTIONS. FROM JAPAN.`,privacy:`プライバシーポリシー`', "Japanese footer line"],
    ['nav:[[`Works`,`#works`],[`About`,`#about`],[`Founder`,`#founder`],[`Contact`,`#contact`]]', 'nav:[[`Music`,`#works`],[`Media`,`#media`],[`About`,`#about`],[`Contact`,`#contact`]]', "English navigation"],
    ['heroEyebrow:`MUSIC JAPAN LLC · INDEPENDENT MUSIC COMPANY · OSAKA, JAPAN`', 'heroEyebrow:`MUSIC JAPAN LLC · MUSIC & MEDIA COMPANY · OSAKA, JAPAN`', "English hero eyebrow"],
    ['heroLead:`Music from Japan. Made to travel. Built to last.`', 'heroLead:`Music and stories from Japan, made to last.`', "English hero lead"],
    ['heroSub:`Artist releases, jazz, classical and sleep music—distinct sonic worlds connected by one red frequency.`', 'heroSub:`Music production and distribution at our core, joined by podcasts, interview articles and invitation-only introductions.`', "English hero summary"],
    ['manifestoKicker:`ONE SIGNAL. MANY WORLDS.`,manifestoTitle:`Music outlives borders and genres.`', 'manifestoKicker:`MUSIC. STORIES. CONNECTIONS.`,manifestoTitle:`Music outlives borders and genres.`', "English manifesto kicker"],
    ['manifestoBody:`We make the music, shape the world around it, and design how it keeps reaching listeners. From Japan, Music Japan develops artist releases and focused music brands for audiences worldwide.`,worksKicker:', 'manifestoBody:`We make the music, shape the world around it and help it keep reaching listeners. We also preserve people’s voices and experience through podcasts and articles, carrying each story toward its next connection.`,newsKicker:`NEWS / UPDATES`,newsTitle:`Latest updates`,newsItems:[{date:`2026.09.13`,dateTime:`2026-09-13`,label:`NEWS`,title:`Our official website has moved to music-japan.com`,href:``},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`MEDIA`,title:`SECOND TAKE, our executive interview media, is now live`,href:`https://secondtake.music-japan.com/`},{date:`2026.09.13`,dateTime:`2026-09-13`,label:`SERVICE`,title:`Baton, our invitation-only introduction service, is now live`,href:`https://baton.music-japan.com/`}],worksKicker:', "English manifesto and news"],
    ['aboutTitle:`An independent music company building many sonic worlds.`', 'aboutTitle:`A music company preserving sound, voices and experience.`', "English about title"],
    ['aboutBody:`Music Japan LLC develops artist releases and dedicated jazz, classical and sleep-music brands. Every release is designed to find its audience, stay with them and lead to the next listen.`', 'aboutBody:`Music Japan LLC creates and distributes artist releases, jazz, classical and sleep music. We also use podcasts, interview articles and dedicated pages to share the experiences and businesses of company leaders—turning music and words into lasting memories and trusted connections.`', "English about summary"],
    ['pillars:[[`CREATE`,`Original music and BGM production`],[`CURATE`,`Distinct worlds for every sound`],[`CONNECT`,`Reaching listeners across borders`]]', 'brands:[{kicker:`MUSIC JAPAN`,title:`Music production & distribution`,body:`We plan, produce and distribute artist releases, BGM, jazz, classical and sleep music.`,logo:`/music-japan-logo.png`,alt:`Music Japan LLC`,width:1500,height:500,modifier:`music`},{kicker:`SECOND TAKE`,title:`Podcasts × interview articles`,body:`We document the decisions, hardships and stories of business leaders through podcasts and interview articles.`,logo:`/second-take-logo.png`,alt:`SECOND TAKE podcast and interview media`,width:2172,height:724,modifier:`second-take`},{kicker:`BATON`,title:`Invitation-only introductions`,body:`We connect people we have met with, respecting the intent and trust of both sides.`,logo:`/baton-logo.png`,alt:`Baton invitation-only introduction service`,width:580,height:174,modifier:`baton`}]', "English company brands"],
    ['founderQuote:`Music should never end at creation. We build the reason it gets heard—and the world that makes it remembered.`', 'founderQuote:`Music and human experience should never end at creation. We carry them forward until they are heard, read and connected to the next person.`', "English founder statement"],
    ['relatedKicker:`RELATED VENTURES`,relatedTitle:`New connections, starting with music.`,relatedCards:[{label:`BUSINESS CONNECTION`,title:`Business & Executive Introductions`,body:`Business introductions for companies and executives, operated by Standment.`,cta:`SPECIAL SITE — COMING SOON`,href:``},{label:`WEBGL EXPERIENCE`,title:`WebGL websites by Standment`,body:`Immersive digital experiences that express the atmosphere of a brand.`,cta:`Visit the special site`,href:`https://savers-japan-digital.pearly-cedar-3983.chatgpt.site/#contact`}]', 'relatedKicker:`MEDIA / CONNECTION`,relatedTitle:`Record the voice. Publish the story. Pass it on.`,relatedBody:`We turn the decisions and struggles of business leaders into podcasts and interview articles, then help trusted relationships lead to thoughtful introductions.`,relatedCards:[{label:`PODCAST / INTERVIEW`,title:`SECOND TAKE`,body:`An executive media series documenting the decisions, hardships and stories that follow through podcasts and in-depth interviews.`,cta:`Visit SECOND TAKE`,href:`https://secondtake.music-japan.com/`},{label:`INVITATION-ONLY INTRODUCTION`,title:`Baton`,body:`An invitation-only service connecting people we have met through interviews and conversations, with care for both sides.`,cta:`Visit Baton`,href:`https://baton.music-japan.com/`}]', "English media section"],
    ['contactBody:`Talk to us about original music, BGM, licensing or partnerships. We’ll review your message and get back to you directly.`', 'contactBody:`Talk to us about music, BGM, licensing, SECOND TAKE interviews, Baton introductions or partnerships. We’ll review your message and get back to you directly.`', "English contact summary"],
    ['options:[`Partnerships & collaboration`,`Music & BGM commissions`,`Music usage & licensing`,`Careers`,`Media & press`,`Other`]', 'options:[`Music & BGM commissions`,`Music usage & licensing`,`SECOND TAKE interviews`,`Baton introductions`,`Partnerships & collaboration`,`Other`]', "English inquiry options"],
    ['footerLine:`MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.`,privacy:`Privacy Policy`', 'footerLine:`MUSIC. STORIES. CONNECTIONS. FROM JAPAN.`,privacy:`Privacy Policy`', "English footer line"],
    ['children:`MUSIC COMPANY`', 'children:`MUSIC & MEDIA`', "header business label"],
    ['children:`001 — 006`', 'children:`001 — 009`', "hero section count"],
    ['children:`JAZZ · CLASSICAL · SLEEP · J-POP`', 'children:`MUSIC · PODCAST · INTERVIEW · BATON`', "hero orbit label"],
    ['[`ARTIST`,`JAZZ`,`CLASSICAL`,`SLEEP`,`BGM`].map', '[`ARTIST`,`JAZZ`,`CLASSICAL`,`PODCAST`,`BATON`].map', "manifesto topic list"]
  ];

  for (const [search, replacement, label] of bundleReplacements) {
    bundle = replaceRequired(bundle, search, replacement, label);
  }

  writeFileSync(bundlePath, bundle);
  return bundleName;
}

function arrowSvg() {
  return '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg>';
}

function renderNews(locale) {
  const copy = content[locale];
  const items = copy.newsItems.map((item) => {
    const body = `<time dateTime="${item.dateTime}">${item.date}</time><span class="news-strip__label">${item.label}</span><span class="news-strip__title">${item.title}</span><span class="news-strip__arrow" aria-hidden="true">${item.href ? "↗" : ""}</span>`;
    if (!item.href) return `<div class="news-strip__item">${body}</div>`;
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

function patchHomeDocument(documentHtml, locale) {
  const visibleReplacements = locale === "ja" ? [
    ["MUSIC COMPANY", "MUSIC &amp; MEDIA"],
    ["合同会社Music Japan · INDEPENDENT MUSIC COMPANY · OSAKA", "合同会社Music Japan · MUSIC &amp; MEDIA COMPANY · OSAKA"],
    ["日本から。国境を越えて。記憶に残る音楽を。", "日本から。音楽と物語を、記憶に残る形へ。"],
    ["アーティスト作品、ジャズ、クラシック、睡眠音楽。異なる音の世界を、一本の赤い周波数で束ねる音楽会社です。", "音楽制作・配信を軸に、Podcast、インタビュー記事、招待制の紹介サービスを手がける音楽・メディア会社です。"],
    ["ONE SIGNAL. MANY WORLDS.", "MUSIC. STORIES. CONNECTIONS."],
    ["一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで設計する。Music Japanは、アーティストと音楽ブランドの可能性を、日本から世界へ広げます。", "一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで届ける。さらに、人の声と経験をPodcastや記事に残し、次の人へつなぐ。Music Japanは、音楽を軸に新しい出会いまで育てます。"],
    ["複数の音楽世界を育てる、独立系音楽会社。", "音楽を軸に、声と経験を残す会社。"],
    ["合同会社Music Japanは、アーティスト作品からジャズ、クラシック、睡眠音楽まで、複数の音楽ブランドを企画・制作・発信しています。作品の数ではなく、ひとつひとつの世界観が届き、残り、次の出会いを生むことを大切にしています。", "合同会社Music Japanは、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を中心に、Podcastやインタビュー記事、LPで経営者の経験や事業を届けています。音楽も言葉も、つくって終わらせず、記憶と次のつながりへ残すことを大切にしています。"],
    ["音楽を“つくって終わるもの”にしない。聴かれる理由と、記憶に残る世界までつくる。それがMusic Japanの仕事です。", "音楽も、人の経験も、つくって終わるものにしない。聴かれ、読まれ、次の出会いへつながるところまで手がける。それがMusic Japanの仕事です。"],
    ["楽曲制作、BGM、ライセンス、協業のご相談はこちらから。内容を確認後、担当よりご連絡します。", "楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談はこちらから。内容を確認後、担当よりご連絡します。"],
    ["MUSIC FROM JAPAN. MADE TO TRAVEL. BUILT TO LAST.", "MUSIC. STORIES. CONNECTIONS. FROM JAPAN."]
  ] : [
    ["MUSIC COMPANY", "MUSIC &amp; MEDIA"],
    ["MUSIC JAPAN LLC · INDEPENDENT MUSIC COMPANY · OSAKA, JAPAN", "MUSIC JAPAN LLC · MUSIC &amp; MEDIA COMPANY · OSAKA, JAPAN"],
    ["Music from Japan. Made to travel. Built to last.", "Music and stories from Japan, made to last."],
    ["Artist releases, jazz, classical and sleep music—distinct sonic worlds connected by one red frequency.", "Music production and distribution at our core, joined by podcasts, interview articles and invitation-only introductions."],
    ["ONE SIGNAL. MANY WORLDS.", "MUSIC. STORIES. CONNECTIONS."],
    ["We make the music, shape the world around it, and design how it keeps reaching listeners. From Japan, Music Japan develops artist releases and focused music brands for audiences worldwide.", "We make the music, shape the world around it and help it keep reaching listeners. We also preserve people’s voices and experience through podcasts and articles, carrying each story toward its next connection."],
    ["An independent music company building many sonic worlds.", "A music company preserving sound, voices and experience."],
    ["Music Japan LLC develops artist releases and dedicated jazz, classical and sleep-music brands. Every release is designed to find its audience, stay with them and lead to the next listen.", "Music Japan LLC creates and distributes artist releases, jazz, classical and sleep music. We also use podcasts, interview articles and dedicated pages to share the experiences and businesses of company leaders—turning music and words into lasting memories and trusted connections."],
    ["Music should never end at creation. We build the reason it gets heard—and the world that makes it remembered.", "Music and human experience should never end at creation. We carry them forward until they are heard, read and connected to the next person."],
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
    .replace('<div class="hero__index" aria-hidden="true">001 — 006</div>', '<div class="hero__index" aria-hidden="true">001 — 009</div>')
    .replace('JAZZ · CLASSICAL · SLEEP · J-POP', 'MUSIC · PODCAST · INTERVIEW · BATON');

  const oldGenres = ["ARTIST", "JAZZ", "CLASSICAL", "SLEEP", "BGM"];
  const newGenres = ["ARTIST", "JAZZ", "CLASSICAL", "PODCAST", "BATON"];
  for (let index = 0; index < oldGenres.length; index += 1) {
    const oldGenre = `<span><i>0<!-- -->${index + 1}</i>${oldGenres[index]}</span>`;
    const newGenre = `<span><i>0<!-- -->${index + 1}</i>${newGenres[index]}</span>`;
    documentHtml = documentHtml.replace(oldGenre, newGenre);
  }

  const nav = locale === "ja"
    ? [["作品", "音楽", "#works"], ["私たちについて", "メディア", "#media"], ["代表", "私たちについて", "#about"], ["お問い合わせ", "お問い合わせ", "#contact"]]
    : [["Works", "Music", "#works"], ["About", "Media", "#media"], ["Founder", "About", "#about"], ["Contact", "Contact", "#contact"]];
  const navStart = documentHtml.indexOf('<nav id="primary-navigation"');
  const navEnd = documentHtml.indexOf("</nav>", navStart);
  if (navStart === -1 || navEnd === -1) throw new Error(`Could not locate ${locale} navigation`);
  let navHtml = documentHtml.slice(navStart, navEnd + 6);
  const navLinks = nav.map(([, label, href]) => `<a href="${href}">${label}</a>`).join("");
  navHtml = navHtml.replace(/<a href="#[^"]+">[^<]+<\/a>/g, "");
  navHtml = navHtml.replace(/<\/nav>$/, `${navLinks}</nav>`);
  documentHtml = documentHtml.slice(0, navStart) + navHtml + documentHtml.slice(navEnd + 6);

  return documentHtml;
}

function updateHomeMetadata(documentHtml, locale) {
  const replacements = locale === "ja" ? [
    ["合同会社Music Japan 公式サイト | 音楽制作・楽曲配信", "合同会社Music Japan 公式サイト | 音楽制作・Podcast・インタビュー"],
    ["大阪の音楽会社・合同会社Music Japan公式サイト。Yumaのアーティスト作品、ジャズ、クラシック、睡眠音楽、オリジナル楽曲・BGMを企画、制作、配信しています。", "合同会社Music Japan公式サイト。音楽制作・楽曲配信を軸に、Podcast『SECOND TAKE』、インタビュー記事、招待制の紹介サービス『Baton』を運営しています。"],
    ["合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,大阪 音楽会社,Yuma", "合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,Podcast,ポッドキャスト,経営者インタビュー,SECOND TAKE,Baton,大阪 音楽会社,Yuma"],
    ["大阪から世界へ。アーティスト作品と複数の音楽ブランドを企画・制作・配信する音楽会社。", "音楽制作・配信を軸に、Podcast、経営者インタビュー、記事制作、招待制の紹介サービスを展開する音楽・メディア会社。"],
    ["大阪を拠点に、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を行う独立系音楽会社。", "大阪を拠点に、音楽制作・配信、Podcast、経営者インタビュー、記事制作、招待制の紹介サービスを手がける音楽・メディア会社。"],
    ["アーティスト作品、ジャズ、クラシック、睡眠音楽を企画・制作・配信する音楽会社の公式サイト。", "音楽制作・配信、Podcast、インタビュー記事、招待制の紹介サービスを手がける合同会社Music Japanの公式サイト。"]
  ] : [
    ["Music Japan LLC Official Website | Music Production &amp; Distribution", "Music Japan LLC | Music, Podcasts &amp; Interviews"],
    ["The official website of Music Japan LLC, an independent music company in Osaka creating and distributing Yuma releases, jazz, classical, sleep music, original music and BGM.", "The official website of Music Japan LLC: music production and distribution, the SECOND TAKE podcast and interviews, and Baton invitation-only introductions."],
    ["合同会社Music Japan,Music Japan LLC,音楽制作,楽曲制作,BGM制作,音楽配信,大阪 音楽会社,Yuma", "Music Japan LLC,music production,music distribution,BGM,podcast,executive interviews,SECOND TAKE,Baton,Osaka music company,Yuma"],
    ["An independent music company in Osaka building artist releases and focused music brands for listeners worldwide.", "A music and media company in Osaka creating music, podcasts, executive interviews, editorial content and trusted introductions."],
    ["大阪を拠点に、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を行う独立系音楽会社。", "大阪を拠点に、音楽制作・配信、Podcast、経営者インタビュー、記事制作、招待制の紹介サービスを手がける音楽・メディア会社。"],
    ["The official website of an independent music company creating and distributing artist releases, jazz, classical and sleep music.", "The official website of Music Japan LLC, creating music, podcasts, executive interviews, editorial content and invitation-only introductions."]
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

const publicHtmlFiles = [
  "index.html",
  "en/index.html",
  "company/index.html",
  "en/company/index.html",
  "privacy/index.html",
  "en/privacy/index.html"
];

let rewrittenReferences = 0;

for (const relativePath of publicHtmlFiles) {
  const fullPath = join(output, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Missing public HTML during deploy: ${relativePath}`);

  const original = readFileSync(fullPath, "utf8");
  const markerIndex = original.indexOf(RSC_MARKER);
  if (markerIndex === -1) throw new Error(`RSC marker missing: ${relativePath}`);

  // Vinext/React Server Components append a length-prefixed serialized payload after this marker.
  // Never mutate that payload. All SEO/favicon rewrites stay inside the real document HTML only.
  let documentHtml = original.slice(0, markerIndex);
  const rscPayload = original.slice(markerIndex);
  const referenceCount = documentHtml.split(OLD_SITE_URL).length - 1;
  if (referenceCount === 0) throw new Error(`Expected legacy host reference missing in document HTML: ${relativePath}`);

  // Canonical/OGP/JSON-LD host migration
  documentHtml = documentHtml.replaceAll(OLD_SITE_URL, SITE_URL);

  if (relativePath === "index.html" || relativePath === "en/index.html") {
    const locale = relativePath === "index.html" ? "ja" : "en";
    documentHtml = patchHomeDocument(documentHtml, locale);
    documentHtml = updateHomeMetadata(documentHtml, locale);
    documentHtml = documentHtml.replace(
      "</head>",
      `<link rel="stylesheet" href="${MEDIA_STYLESHEET_URL}"/>\n</head>`
    );
  }

  // Remove every pre-existing favicon declaration so Chrome has one unambiguous browser-tab icon.
  documentHtml = documentHtml
    .replace(/<link\s+rel="shortcut icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="icon"[^>]*\/>/gi, "")
    .replace(/<link\s+rel="apple-touch-icon"[^>]*\/>/gi, "");

  const faviconTags = `<link rel="icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"/><link rel="apple-touch-icon" href="${APPLE_ICON_URL}"/>`;
  if (!documentHtml.includes("</head>")) throw new Error(`Head close tag missing: ${relativePath}`);
  documentHtml = documentHtml.replace("</head>", `${faviconTags}\n</head>`);

  const rewritten = documentHtml + rscPayload;

  // Byte-for-byte protection for hydration data
  if (rewritten.slice(documentHtml.length) !== rscPayload) {
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

for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = html.slice(0, markerIndex);

  if (documentHtml.includes(OLD_SITE_URL)) throw new Error(`Legacy host remains in document HTML: ${relativePath}`);
  if (!documentHtml.includes(SITE_URL)) throw new Error(`Canonical host missing in document HTML: ${relativePath}`);
  if (!documentHtml.includes('rel="canonical"')) throw new Error(`Canonical link missing: ${relativePath}`);
  if (!documentHtml.includes('application/ld+json')) throw new Error(`Structured data missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="shortcut icon" type="image/svg+xml" href="${FAVICON_URL}"`)) throw new Error(`New shortcut favicon missing: ${relativePath}`);
  if (!documentHtml.includes(`rel="apple-touch-icon" href="${APPLE_ICON_URL}"`)) throw new Error(`Apple touch icon missing: ${relativePath}`);

  if (relativePath === "index.html" || relativePath === "en/index.html") {
    if (!documentHtml.includes('id="news"')) throw new Error(`News section missing: ${relativePath}`);
    if (!documentHtml.includes('id="media"')) throw new Error(`Media section missing: ${relativePath}`);
    if (!documentHtml.includes(SECOND_TAKE_URL)) throw new Error(`SECOND TAKE link missing: ${relativePath}`);
    if (!documentHtml.includes(BATON_URL)) throw new Error(`Baton link missing: ${relativePath}`);
    if (!documentHtml.includes(`href="${MEDIA_STYLESHEET_URL}"`)) throw new Error(`Media refresh stylesheet missing: ${relativePath}`);
    if (documentHtml.includes("Standment")) throw new Error(`Legacy Standment copy remains: ${relativePath}`);
    if (!(documentHtml.indexOf('id="news"') < documentHtml.indexOf('class="manifesto content-frame"') &&
      documentHtml.indexOf('class="manifesto content-frame"') < documentHtml.indexOf('id="media"') &&
      documentHtml.indexOf('id="media"') < documentHtml.indexOf('class="works content-frame"'))) {
      throw new Error(`Homepage section order is incorrect: ${relativePath}`);
    }
  }
}

const patchedBundleContents = readFileSync(join(output, "assets", patchedClientBundle), "utf8");
for (const requiredToken of ["news-strip", "media-feature", SECOND_TAKE_URL, BATON_URL]) {
  if (!patchedBundleContents.includes(requiredToken)) throw new Error(`Client bundle token missing: ${requiredToken}`);
}
if (patchedBundleContents.includes("Standment")) throw new Error("Legacy Standment copy remains in client bundle");

for (const relativePath of machineReadableFiles) {
  const content = readFileSync(join(output, relativePath), "utf8");
  if (content.includes(OLD_SITE_URL) || content.includes(LEGACY_PAGES_URL)) {
    throw new Error(`Legacy host remains in SEO/AIO file: ${relativePath}`);
  }
}

for (const requiredFile of ["music-japan-og.png", "kabeya-tomoki.png", "music-japan-symbol.png", "favicon-music-japan.svg", "music-japan-logo.png", "second-take-logo.png", "baton-logo.png"]) {
  const fullPath = join(output, requiredFile);
  if (!existsSync(fullPath) || statSync(fullPath).size === 0) {
    throw new Error(`Required branding/SEO file is missing or empty: ${requiredFile}`);
  }
}

const localAssetRefs = new Set();
for (const relativePath of publicHtmlFiles) {
  const html = readFileSync(join(output, relativePath), "utf8");
  const markerIndex = html.indexOf(RSC_MARKER);
  const documentHtml = html.slice(0, markerIndex);
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
console.log(`Patched homepage content and client bundle: ${patchedClientBundle}`);
console.log(`Safely rewrote ${rewrittenReferences} SEO references across ${publicHtmlFiles.length} public HTML documents.`);
console.log(`Preserved all RSC hydration payloads byte-for-byte.`);
console.log(`Validated ${machineReadableFiles.length} SEO/AIO files, ${localAssetRefs.size} local assets, and required branding files.`);
