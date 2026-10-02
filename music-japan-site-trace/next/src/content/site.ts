import type { Locale } from './releases';

export const SITE_URL = 'https://music-japan.com';
export const EMAIL = 'music.japan.llc@gmail.com';
export const SECOND_TAKE_URL = 'https://secondtake.music-japan.com/';
export const BATON_URL = 'https://baton.music-japan.com/profile/';
export const TIMEREX_URL = 'https://timerex.net/s/music.japan.llc_5445/2f8e527f';
export const SOCIAL_IMAGE = '/music-japan-logo.png?v=20260921';
export const LAST_MODIFIED = '2026-10-01';

export type PageKey = 'home' | 'business' | 'works' | 'company' | 'profile' | 'partners' | 'contact' | 'privacy';

export const path = (locale: Locale, page: PageKey) => {
  const base = locale === 'ja' ? '/' : '/en/';
  return page === 'home' ? base : `${base}${page}/`;
};
/** One page per release: /works/<id>/ and /en/works/<id>/ */
export const workPath = (locale: Locale, id: string) => `${path(locale, 'works')}${id}/`;

export const socials = [
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/' },
  { name: 'Instagram', href: 'https://www.instagram.com/music.japan.llc2/' },
  { name: 'X', href: 'https://x.com/Music_Japan_LLC' },
];

export const nav: PageKey[] = ['business', 'works', 'company', 'profile', 'partners', 'contact'];

export const copy = {
  ja: {
    brand: '合同会社Music Japan',
    navLabels: { home: 'トップ', business: '事業概要', works: '作品', company: '会社概要', profile: '代表プロフィール', partners: 'パートナー', contact: 'お問い合わせ', privacy: 'プライバシーポリシー' },
    menu: ['メニューを開く', 'メニューを閉じる'],
    skip: '本文へ移動',
    newTab: '（新しいタブで開きます）',
    sound: ['音に反応', 'OFF'],
    hero: {
      kicker: '合同会社Music Japan — MUSIC & MEDIA / OSAKA',
      lead: '日本から。\n音楽と物語を、記憶に残る形へ。',
      sub: '音楽制作・配信を軸に、Podcastとインタビューで人の声や経験を記録する音楽・メディア会社です。',
      listen: '作品を聴く',
      talk: '話を始める',
      scroll: 'SCROLL — DROP THE NEEDLE',
    },
    stage: [
      { no: 'A1', word: 'CUT.', title: '一曲をつくる。\n世界観をつくる。', body: 'アーティスト作品、BGM、Jazz、クラシック、睡眠音楽まで、企画・制作・配信を一貫して手がけます。' },
      { no: 'A2', word: 'SPIN.', title: '聴かれ続ける場所まで、\n届ける。', body: '夜の街、読書の時間、深い眠り。用途ではなく体験から逆算し、長く愛される音の世界を育てています。' },
      { no: 'A3', word: 'RECORD.', title: '人の声と経験を、\n次の人へ。', body: '経営者の決断や苦悩をPodcast×記事に残し、それが次のつながりを生む。SECOND TAKEでは弊社が「取材・発信」まで手がけます。' },
    ],
    manifesto: {
      kicker: 'MUSIC. STORIES. CONNECTIONS.',
      title: '音楽は、\nジャンルを越えて\n残っていく。',
      body: '一曲をつくる。世界観をつくる。そして、聴かれ続ける場所まで届ける。さらに、人の声と経験をPodcastや記事に残し、次の人へつなぐ。Music Japanは、音楽を軸に新しい出会いまで育てます。',
    },
    news: {
      kicker: 'NEWS',
      title: 'お知らせ',
      items: [
        { date: '2026.10.02', label: 'PARTNERS', title: '株式会社Smartaleckのページを公開しました', href: '/partners/#smartaleck' },
        { date: '2026.09.30', label: 'PARTNERS', title: 'パートナー企業のページを公開しました', href: '/partners/' },
        { date: '2026.09.14', label: 'PROFILE', title: '代表プロフィールを公開しました', href: '/profile/' },
        { date: '2026.09.13', label: 'MEDIA', title: '経営者メディア「SECOND TAKE」を公開しました', href: SECOND_TAKE_URL },
        { date: '2026.09.13', label: 'NEWS', title: '公式サイトを music-japan.com へ移行しました', href: '' },
      ],
    },
    crate: {
      kicker: 'THE CRATE — CATALOG',
      title: '盤を選んで、\n針を落とす。',
      body: 'Yumaのアーティスト作品と、Jazz・クラシック・睡眠音楽のブランド。ジャケットを選ぶと、その場で試聴できます。サイト全体が、流れる音に反応します。',
      filters: { all: 'ALL', yuma: 'YUMA', brand: 'MUSIC BRANDS' },
      open: '試聴する',
      yumaTitle: 'Yumaが紡ぐ、想いと軌跡。',
      yumaBody: 'Yumaは、日常や心の機微を独自の視点で切り取り、言葉にならない想いを音と物語に変えるアーティストです。',
      brandTitle: '聴く時間そのものを、ブランドにする。',
    },
    player: {
      close: '閉じる',
      play: '再生',
      pause: '一時停止',
      preview: '30秒プレビュー',
      tracks: '試聴曲',
      listen: (p: string) => `${p}で聴く`,
      error: 'プレビューを再生できませんでした。配信先でお聴きください。',
      prev: '前の作品',
      next: '次の作品',
    },
    media: {
      kicker: 'MEDIA / CONNECTION',
      title: '人生の困難や逆境を\n自分を彩る表現へと昇華する。',
      body: '経営者の決断や苦悩をPodcast×記事に残し、それが次のつながりを生む。\nSECOND TAKEでは弊社が「取材・発信」まで手がけます。',
      cards: [
        { label: 'PODCAST / INTERVIEW', title: 'SECOND TAKE', body: '経営者の決断と苦悩、その先にある物語を、Podcastとインタビュー記事で記録する経営者メディア。', cta: '公式サイトへ', href: SECOND_TAKE_URL },
        { label: 'INVITATION-ONLY', title: 'Baton', sub: '-バトン-', body: '選んだ人から、選んだ人へ。バトンは渡る。お互いの価値観を大切に、深い関係構築を。', cta: 'Batonを見る', href: BATON_URL },
      ],
    },
    partnersTeaser: {
      kicker: 'BATON PARTNERS',
      title: '事業の強みを知り、\n次のつながりへ。',
      body: 'Music Japanと歩みをともにする企業と、その事業。',
      cta: 'パートナー一覧へ',
    },
    about: {
      kicker: 'ABOUT MUSIC JAPAN',
      title: '音楽やメディアを通じて、\nより有意義な未来を創る記録を。',
      body: '合同会社Music Japanは、アーティスト作品、ジャズ、クラシック、睡眠音楽などの企画・制作・配信を中心に、Podcastやインタビュー記事、LPで経営者の経験や事業を届けています。音楽も言葉も、つくって終わらせず、記憶と次のつながりへ残すことを大切にしています。',
      brands: [
        { kicker: 'MUSIC JAPAN', title: '音楽制作・配信', body: 'アーティスト作品、BGM、Jazz、クラシック、睡眠音楽まで、企画・制作・配信を一貫して手がけます。' },
        { kicker: 'SECOND TAKE', title: 'Podcast × インタビュー', body: '経営者の決断や苦悩、その先にある物語を、Podcastとインタビュー記事で記録し、届けます。' },
        { kicker: 'BATON', title: '招待制の紹介サービス', body: 'お互いの価値観を大切に、深い関係構築を。' },
      ],
    },
    cta: {
      kicker: 'CONTACT / COLLABORATE',
      title: '次の音を、\n一緒につくろう。',
      body: '楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談はこちらから。内容を確認後、担当よりご連絡します。',
      button: '話を始める',
    },
    footer: {
      line: 'MUSIC. STORIES. CONNECTIONS. FROM JAPAN.',
      follow: 'FOLLOW',
      rights: '© 2026 合同会社Music Japan',
      top: 'BACK TO TOP',
    },
    pages: {
      business: { seo: '事業概要｜音楽制作・楽曲配信・Podcast・経営者インタビュー｜合同会社Music Japan', kicker: 'BUSINESS / MUSIC & MEDIA', title: '事業概要', display: 'BUSINESS', lead: '音楽やメディアを通じて、より有意義な未来を創る記録を。', description: '合同会社Music Japanの事業概要。音楽制作・配信、SECOND TAKEのPodcast・インタビュー、Batonと私たちの考え方。' },
      works: { seo: '作品一覧｜Yuma・Cozy Cafe Jazz BGM・睡眠音楽ほか｜合同会社Music Japan', kicker: 'CATALOG / WORKS', title: '作品', display: 'WORKS', lead: 'Yumaのアーティスト作品と、Jazz・クラシック・睡眠音楽のブランド。ジャケットを選ぶと、その場で試聴できます。', description: '合同会社Music Japanの作品一覧。アーティストYumaの楽曲と、Cozy Cafe Jazz BGM、Relaxing Classical Music Live、Deep Sleep Music Radioの作品を試聴できます。' },
      company: { seo: '会社概要｜大阪の音楽・メディア会社｜合同会社Music Japan', kicker: 'OFFICIAL COMPANY PROFILE / OSAKA, JAPAN', title: '会社概要', display: 'COMPANY', lead: '大阪を拠点に、音楽制作・楽曲配信を軸として、Podcastやインタビューを通じて人の声と経験を記録する音楽・メディア会社です。', description: '合同会社Music Japanの会社概要。所在地、代表社員、事業内容、展開ブランド。' },
      profile: { seo: '代表プロフィール｜壁谷 友生（代表社員）｜合同会社Music Japan', kicker: 'REPRESENTATIVE MEMBER', title: '代表プロフィール', display: 'PROFILE', lead: '', description: '合同会社Music Japan 代表社員・壁谷友生のプロフィールと、音楽・メディア・Podcastを通じて残したい記録への思い' },
      partners: { seo: 'パートナー企業｜エボルグ・Central AX・Smartaleck｜合同会社Music Japan', kicker: 'BATON PARTNERS / CONNECTIONS', title: 'パートナー', display: 'PARTNERS', lead: '事業の強みを知り、次のつながりへ。', description: '合同会社Music JapanのBaton Partners。株式会社エボルグ、株式会社Central AX、株式会社Smartaleck。Music Japanと歩みをともにする企業の事業とサービス。' },
      contact: { seo: 'お問い合わせ｜楽曲制作・BGM・Podcast出演・取材のご相談｜合同会社Music Japan', kicker: 'CONTACT / COLLABORATE', title: 'お問い合わせ', display: 'CONTACT', lead: '楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業についてご相談ください。', description: '合同会社Music Japanへのお問い合わせ、取材、楽曲制作、協業のご相談' },
      privacy: { seo: 'プライバシーポリシー｜合同会社Music Japan', kicker: 'PRIVACY / INFORMATION POLICY', title: 'プライバシーポリシー', display: 'PRIVACY', lead: '', description: '合同会社Music Japanのプライバシーポリシー。お問い合わせ等で取得する個人情報の利用目的、管理、第三者提供、開示請求の窓口について定めています。' },
    },
    home: {
      title: '合同会社Music Japan 公式サイト | 音楽制作・Podcast・インタビュー',
      description: '合同会社Music Japan公式サイト。音楽制作・楽曲配信を軸に、Podcast『SECOND TAKE』とインタビューを通じて、人の声や経験を記録・発信しています。',
    },
  },
  en: {
    brand: 'MUSIC JAPAN LLC',
    navLabels: { home: 'Home', business: 'Business', works: 'Works', company: 'Company', profile: 'Profile', partners: 'Partners', contact: 'Contact', privacy: 'Privacy Policy' },
    menu: ['Open menu', 'Close menu'],
    skip: 'Skip to content',
    newTab: ' (opens in a new tab)',
    sound: ['Reactive', 'OFF'],
    hero: {
      kicker: 'MUSIC JAPAN LLC — MUSIC & MEDIA / OSAKA',
      lead: 'Music and stories\nfrom Japan, made to last.',
      sub: 'Music production and distribution at our core, using podcasts and interviews to preserve people’s voices and experiences.',
      listen: 'Explore the music',
      talk: 'Start a conversation',
      scroll: 'SCROLL — DROP THE NEEDLE',
    },
    stage: [
      { no: 'A1', word: 'CUT.', title: 'We make the music.\nWe shape its world.', body: 'We plan, produce and distribute artist releases, BGM, jazz, classical and sleep music.' },
      { no: 'A2', word: 'SPIN.', title: 'And we carry it to where\nit keeps being heard.', body: 'Late-night cities, reading hours, deep sleep. We start from the listening experience, not the use case, and grow sound worlds people keep coming back to.' },
      { no: 'A3', word: 'RECORD.', title: 'Voices and experience,\npassed to the next person.', body: 'We preserve the decisions and struggles of business leaders through podcasts and articles. Through SECOND TAKE, we handle everything from interviews to publication.' },
    ],
    manifesto: {
      kicker: 'MUSIC. STORIES. CONNECTIONS.',
      title: 'Music outlives\nborders and genres.',
      body: 'We make the music, shape the world around it and help it keep reaching listeners. We also preserve people’s voices and experience through podcasts and articles, carrying each story toward its next connection.',
    },
    news: {
      kicker: 'NEWS',
      title: 'Latest updates',
      items: [
        { date: '2026.10.02', label: 'PARTNERS', title: 'Smartaleck joins Baton Partners', href: '/en/partners/#smartaleck' },
        { date: '2026.09.30', label: 'PARTNERS', title: 'Our partner directory is now live', href: '/en/partners/' },
        { date: '2026.09.14', label: 'PROFILE', title: 'Our representative profile is now available', href: '/en/profile/' },
        { date: '2026.09.13', label: 'MEDIA', title: 'SECOND TAKE, our executive interview media, is now live', href: SECOND_TAKE_URL },
        { date: '2026.09.13', label: 'NEWS', title: 'Our official website has moved to music-japan.com', href: '' },
      ],
    },
    crate: {
      kicker: 'THE CRATE — CATALOG',
      title: 'Pick a record.\nDrop the needle.',
      body: 'Artist releases by Yuma, and our jazz, classical and sleep-music brands. Choose a sleeve to preview it right here — the whole site reacts to the sound.',
      filters: { all: 'ALL', yuma: 'YUMA', brand: 'MUSIC BRANDS' },
      open: 'Preview',
      yumaTitle: 'Feelings and footprints, by Yuma.',
      yumaBody: 'Yuma captures the small movements of everyday life and the heart, turning feelings beyond words into sound and story.',
      brandTitle: 'Turning the listening hour into a brand.',
    },
    player: {
      close: 'Close',
      play: 'Play',
      pause: 'Pause',
      preview: '30-second preview',
      tracks: 'Preview tracks',
      listen: (p: string) => `Listen on ${p}`,
      error: 'The preview could not be played. Please listen on the release platform.',
      prev: 'Previous release',
      next: 'Next release',
    },
    media: {
      kicker: 'MEDIA / CONNECTION',
      title: 'Transform life’s hardships\ninto expressions that give color to who we are.',
      body: 'We preserve the decisions and struggles of business leaders through podcasts and articles, allowing them to lead to new connections.\nThrough SECOND TAKE, we handle everything from interviews to publication.',
      cards: [
        { label: 'PODCAST / INTERVIEW', title: 'SECOND TAKE', body: 'An executive media series documenting the decisions, hardships and stories that follow through podcasts and in-depth interviews.', cta: 'Visit SECOND TAKE', href: SECOND_TAKE_URL },
        { label: 'INVITATION-ONLY', title: 'Baton', sub: '', body: 'From one chosen person to another. The baton is passed. Respecting each other’s values, we nurture deeper relationships.', cta: 'Visit Baton', href: BATON_URL },
      ],
    },
    partnersTeaser: {
      kicker: 'BATON PARTNERS',
      title: 'Discover the companies\nbehind our next connections.',
      body: 'Companies walking alongside Music Japan, and what they do.',
      cta: 'See all partners',
    },
    about: {
      kicker: 'ABOUT MUSIC JAPAN',
      title: 'Through music and media,\nwe leave records that shape a more meaningful future.',
      body: 'Music Japan LLC creates and distributes artist releases, jazz, classical and sleep music. We also use podcasts, interview articles and dedicated pages to share the experiences and businesses of company leaders—turning music and words into lasting memories and trusted connections.',
      brands: [
        { kicker: 'MUSIC JAPAN', title: 'Music production & distribution', body: 'We plan, produce and distribute artist releases, BGM, jazz, classical and sleep music.' },
        { kicker: 'SECOND TAKE', title: 'Podcasts × interviews', body: 'We document the decisions, hardships and stories of business leaders through podcasts and interview articles.' },
        { kicker: 'BATON', title: 'Invitation-only introductions', body: 'Respecting each other’s values, we nurture deeper relationships.' },
      ],
    },
    cta: {
      kicker: 'CONTACT / COLLABORATE',
      title: 'Let’s create\nthe next frequency.',
      body: 'Talk to us about music, BGM, licensing, SECOND TAKE interviews, Baton introductions or partnerships. We’ll review your message and get back to you directly.',
      button: 'Start a conversation',
    },
    footer: {
      line: 'MUSIC. STORIES. CONNECTIONS. FROM JAPAN.',
      follow: 'FOLLOW',
      rights: '© 2026 Music Japan LLC',
      top: 'BACK TO TOP',
    },
    pages: {
      business: { seo: 'Business: Music Production, Podcasts & Interviews | Music Japan LLC', kicker: 'BUSINESS / MUSIC & MEDIA', title: 'Our Business', display: 'BUSINESS', lead: 'Through music and media, we leave records that shape a more meaningful future.', description: 'Music Japan LLC’s work: music production and distribution, SECOND TAKE podcasts and interviews, Baton, and our approach.' },
      works: { seo: 'Works: Yuma, Cozy Cafe Jazz BGM, Sleep Music & More | Music Japan LLC', kicker: 'CATALOG / WORKS', title: 'Works', display: 'WORKS', lead: 'Releases by the artist Yuma and our jazz, classical and sleep music brands. Pick a sleeve to preview it right here.', description: 'The Music Japan LLC catalogue: releases by the artist Yuma and by Cozy Cafe Jazz BGM, Relaxing Classical Music Live and Deep Sleep Music Radio, with previews.' },
      company: { seo: 'Company Information: Music & Media Company in Osaka | Music Japan LLC', kicker: 'OFFICIAL COMPANY PROFILE / OSAKA, JAPAN', title: 'Company', display: 'COMPANY', lead: 'A music and media company based in Osaka, creating and distributing music while preserving people’s voices and experiences through podcasts and interviews.', description: 'Company information for Music Japan LLC: address, representative, business and music brands.' },
      profile: { seo: 'Tomoki Kabeya, Representative Member | Music Japan LLC', kicker: 'REPRESENTATIVE MEMBER', title: 'Profile', display: 'PROFILE', lead: '', description: 'The profile of Tomoki Kabeya, representative member of Music Japan LLC, and his thoughts on the records he hopes to leave through music, media and podcasts' },
      partners: { seo: 'Partners: Evorg, Central AX and Smartaleck | Music Japan LLC', kicker: 'BATON PARTNERS / CONNECTIONS', title: 'Partners', display: 'PARTNERS', lead: 'Discover the companies behind our next connections.', description: 'Baton Partners of Music Japan LLC: Evorg, Central AX and Smartaleck — companies walking alongside Music Japan, and their businesses and services.' },
      contact: { seo: 'Contact: Music, BGM, Podcast & Interview Enquiries | Music Japan LLC', kicker: 'CONTACT / COLLABORATE', title: 'Contact', display: 'CONTACT', lead: 'Talk to us about music, BGM, SECOND TAKE interviews, Baton introductions or partnerships.', description: 'Contact Music Japan LLC about music, interviews, media and partnerships' },
      privacy: { seo: 'Privacy Policy | Music Japan LLC', kicker: 'PRIVACY / INFORMATION POLICY', title: 'Privacy Policy', display: 'PRIVACY', lead: '', description: 'Privacy policy of Music Japan LLC: how we use, manage and share personal information received through enquiries, and how to request disclosure.' },
    },
    home: {
      title: 'Music Japan LLC | Music, Podcasts & Interviews',
      description: 'The official website of Music Japan LLC: music production and distribution, alongside the SECOND TAKE podcast and interviews that preserve people’s voices and experiences.',
    },
  },
} as const;

export type Copy = (typeof copy)[Locale];
