/**
 * ページの一覧。URL・タイトル・説明文・パンくずの名前をここで決める。
 * ビルド時に1ページずつHTMLを書き出し、sitemap.xml と llms.txt にも同じ順で載せる。
 */
export type PageKey = 'top' | 'partners' | 'baton' | 'secondtake' | 'works' | 'news' | 'about' | 'talk';

export type PageMeta = {
  key: PageKey;
  path: string; // 末尾は /（トップは /）
  crumb: string; // パンくず・ナビの名前
  title: string; // <title>
  description: string;
  priority: string; // sitemap
  changefreq: string;
};

export const PAGES: PageMeta[] = [
  {
    key: 'top',
    path: '/',
    crumb: 'トップ',
    title: 'なぜ、Music Japanは音楽を売らないのか｜合同会社Music Japan',
    description:
      '合同会社Music Japan（大阪・梅田）は、会社の専用ページ「Baton Partners」、経営者の招待制プロフィール「Baton」、経営者インタビュー「SECOND TAKE」をつくっています。音楽の会社として始まり、いまは会社と人を紹介する仕事に力を入れています。',
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    key: 'partners',
    path: '/baton-partners/',
    crumb: 'Baton Partners',
    title: 'Baton Partners｜会社ごとの専用ページと紹介｜Music Japan',
    description:
      'Baton Partnersは、合同会社Music Japanがつくる会社ごとの専用ページです。トップ、取り組み、記事、サービス、話してみるの5ページを、その会社の色と書体でつくり、検索で見つかるようにします。読んだ人が話してみたいと思ったら、私たちがおつなぎします。',
    priority: '0.9',
    changefreq: 'monthly',
  },
  {
    key: 'baton',
    path: '/baton/',
    crumb: 'Baton',
    title: 'Baton｜招待制の経営者プロフィール｜Music Japan',
    description:
      'Batonは、合同会社Music Japanが運営する経営者の招待制プロフィールです。載っているのは、私たちが実際に会って話した人だけ。プロフィールを読んで話してみたいと思ったら、ページから申請できます。',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    key: 'secondtake',
    path: '/second-take/',
    crumb: 'SECOND TAKE',
    title: 'SECOND TAKE｜経営者インタビュー｜Music Japan',
    description:
      'SECOND TAKEは、合同会社Music Japanが運営する経営者インタビューです。一度つまずいた経営者が二度目に何を選んだのかを聞き、記事とPodcastで残します。',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    key: 'works',
    path: '/works/',
    crumb: '公開中のページ',
    title: '公開中のページ｜Baton Partnersの実績｜Music Japan',
    description:
      'Baton Partnersで公開している会社の専用ページです。株式会社エボルグ（福岡・人材紹介）と株式会社Central AX（名古屋・AI研修と開発）のページを、どう考えてつくったかと合わせて紹介します。',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    key: 'news',
    path: '/news/',
    crumb: 'お知らせ',
    title: 'お知らせ｜Music Japan',
    description: '合同会社Music Japanのお知らせです。公開したページ、いま進めていること、つくったもの、決めたことを、日付の新しい順に書いています。',
    priority: '0.6',
    changefreq: 'weekly',
  },
  {
    key: 'about',
    path: '/about/',
    crumb: '会社概要',
    title: '会社概要｜合同会社Music Japan',
    description:
      '合同会社Music Japanの会社概要です。大阪・梅田を拠点に、音楽の制作と配信、経営者インタビュー、会社と人を紹介するページづくりをしています。',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    key: 'talk',
    path: '/talk/',
    crumb: '話してみる',
    title: '話してみる｜ご相談の日程を選ぶ｜Music Japan',
    description:
      '合同会社Music Japanへのご相談は、TimeRexで空いている日時を選んでいただく形で受けています。Baton Partners、Baton、SECOND TAKE、Webサイトの制作について、代表の壁谷がお話しします。',
    priority: '0.7',
    changefreq: 'yearly',
  },
];

export const page = (key: PageKey): PageMeta => PAGES.find((p) => p.key === key)!;
