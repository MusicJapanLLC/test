/**
 * サイトの文章（日本語）。書き方の決まりは docs/writing-sources.md。
 * - 話し手は「大阪の小さな会社のひとり」。売り込まない、弁解しない、誇張しない
 * - 「〜ではなく〜」「三つ並べ」「ダッシュ」「比喩の抽象語」は使わない
 * - 代表本人の話は少なめに（本人が自分の口で話すため）
 * - 価格・契約条件・未確認の数字は書かない
 * - 予約ページ（TimeRex）への入口は、ヘッダーの「話してみる」と /talk/ だけ
 *
 * {波かっこ} は見出しの改行位置の目安（表示しない）。**太字** と [リンク](URL) が使える。
 */

/* ───────── 全ページ共通 ───────── */
export const common = {
  brand: 'Music Japan',
  talk: '話してみる',
  nav: [
    { href: '/baton-partners/', label: 'Baton Partners' },
    { href: '/baton/', label: 'Baton' },
    { href: '/second-take/', label: 'SECOND TAKE' },
    { href: '/works/', label: '公開中のページ' },
    { href: '/news/', label: 'お知らせ' },
    { href: '/about/', label: '会社概要' },
  ],
  menu: 'メニュー',
  close: '閉じる',
  /** ページの終わりの「次のページ」。本の章のように、上から順に読めるようにする */
  next: {
    label: '次のページ',
    order: ['partners', 'works', 'baton', 'secondtake', 'news', 'about', 'talk'],
    blurb: {
      partners: '会社ごとに、もうひとつのホームページを。',
      works: 'いま公開しているページと、つくるときに考えたこと。',
      baton: '選んだ人が、選んだ人へ。',
      secondtake: '二度目に、何を選んだのか。',
      news: 'このサイトの更新と、いま進めていること。',
      about: '会社のことと、代表のこと。',
      talk: 'ご相談は、空いている日時を選んでいただく形で受けています。',
    } as Record<string, string>,
  },
  skip: '本文へ移動',
  footer: {
    lead: '大阪・梅田の小さな会社です。会社と人のページをつくり、話してみたい人どうしをおつなぎしています。',
    music: '音楽の作品は、公式サイトに載せています。',
    musicLink: '公式サイトへ',
    groups: [
      {
        title: 'つくっているもの',
        links: [
          { href: '/baton-partners/', label: 'Baton Partners' },
          { href: '/baton/', label: 'Baton' },
          { href: '/second-take/', label: 'SECOND TAKE' },
        ],
      },
      {
        title: 'このサイト',
        links: [
          { href: '/works/', label: '公開中のページ' },
          { href: '/news/', label: 'お知らせ' },
          { href: '/about/', label: '会社概要' },
          { href: '/talk/', label: '話してみる' },
        ],
      },
    ],
    follow: 'SNS',
    privacy: 'プライバシーポリシー',
    rss: 'RSS',
    top: 'ページの先頭へ',
    rights: '© 2026 Music Japan LLC',
  },
};

/* ───────── トップ（/） ───────── */
export const top = {
  eyebrow: '合同会社Music Japan　大阪・梅田',
  title: ['なぜ、Music Japanは', '{音楽を売らない}のか。'],
  lead: '社名を見て、音楽の相談をくださる方がいます。ありがたい話です。ただ、いま私たちがいちばん時間を使っているのは、会社と人を紹介する仕事です。',
  more: 'その理由',

  answer: {
    label: 'その理由',
    title: ['いい曲も、聴かれなければ、', '{ないのと同じです}。'],
    body: [
      'Music Japanは、音楽をつくる会社として始まりました。曲は、つくっただけでは誰にも聴かれません。聴いてもらえる場所まで届けて、ようやく仕事になります。',
      '会社も同じでした。いい仕事をしているのに、名前で検索しても何も出てこない。会えば話が面白い人なのに、会う機会がない。そういう会社と人に、何度も出会いました。',
      'だからいま、私たちは会社と人のページをつくっています。記事を書き、検索で見つかるようにして、読んだ人が「話してみたい」と思ったら、間に入っておつなぎします。',
    ],
    music: '音楽の制作と配信も続けています。作品は公式サイトに載せています。',
    musicLink: '公式サイトの作品一覧',
  },

  services: {
    label: 'つくっているもの',
    title: ['いまは、{この3つを}つくっています。'],
    items: [
      {
        key: 'partners',
        name: 'Baton Partners',
        kind: '会社の専用ページ',
        body: '公式サイトとは別に、その会社を紹介するページを5枚つくります。色も書体も、その会社のために決めます。',
        href: '/baton-partners/',
        more: 'Baton Partnersについて',
      },
      {
        key: 'baton',
        name: 'Baton',
        kind: '経営者のプロフィール',
        body: '私たちが会って話した経営者だけが載る、招待制のプロフィールです。読んで会いたくなったら、ページから申請できます。',
        href: '/baton/',
        more: 'Batonについて',
      },
      {
        key: 'secondtake',
        name: 'SECOND TAKE',
        kind: '経営者インタビュー',
        body: '一度つまずいた経営者に、二度目に何を選んだのかを聞いています。記事と声で残すメディアです。',
        href: '/second-take/',
        more: 'SECOND TAKEについて',
      },
    ],
  },

  works: {
    label: '公開中のページ',
    title: ['Baton Partnersで、{いま公開しているページ}。'],
    lead: 'どちらのページも、いま実際に使われています。1社ずつ、色と書体と動きを一から決めました。',
    more: '公開中のページをくわしく見る',
  },

  news: {
    label: 'お知らせ',
    title: ['最近のこと'],
    more: 'お知らせをすべて見る',
  },
};

/* ───────── Baton Partners（/baton-partners/） ───────── */
export const partners = {
  label: '会社の専用ページ',
  title: 'Baton Partners',
  catch: ['会社ごとに、{もうひとつの}{ホームページを}。'],
  lead: '公式サイトとは別に、その会社を紹介するためのページを5枚つくります。読んだ人が「この会社と話してみたい」と思ったら、私たちが間に入っておつなぎします。',
  site: { label: 'Baton Partnersのページを見る', href: 'https://partners.music-japan.com/' },

  pages: {
    label: '5枚のページ',
    title: ['1社につき、{5ページ}。'],
    lead: 'その会社のことが、ひと通りわかる枚数です。',
    items: [
      { name: 'トップ', body: '何をしている会社なのかが、最初の画面でわかるようにします。' },
      { name: '取り組み', body: 'どんな会社で、代表が何を大事にしているのかを書きます。' },
      { name: '記事', body: 'お客さんが検索しそうな悩みから書く、読みもののページです。' },
      { name: 'サービス', body: '何を頼めて、どう進むのか。迷わず読めるように並べます。' },
      { name: '話してみる', body: '面談の申し込みを受け付けます。届いた申し込みは、まず私たちが読みます。' },
    ],
  },

  build: {
    label: 'つくり方',
    title: ['一社のページが、{できるまで}。'],
    lead: '調べるところから、公開したあとまで。8つの工程です。',
    steps: [
      { en: 'RESEARCH', name: '調べる', body: '公式サイト、サービスのページ、プレスリリース、代表のインタビュー。手に入るものは全部読みます。確かめられなかったことは書きません。' },
      { en: 'UNDERSTAND', name: 'つかむ', body: 'ロゴの色、よく使う言葉、代表が何度も口にすること。その会社らしさがどこにあるのかを探します。' },
      { en: 'DESIGN', name: '見た目を決める', body: '色、書体、3Dの演出を、その会社のために決めます。エボルグは紙と明朝体、Central AXは白黒の建築模型にしました。' },
      { en: 'WRITE', name: '書いて、組む', body: '5ページの文章を書き、組み立てます。数字や実績は、公表されているものだけを使います。' },
      { en: 'SEARCH', name: '検索に備える', body: 'タイトル、説明文、構造化データ、よくある質問。検索エンジンにもAIにも読める形にします。' },
      { en: 'CHECK', name: '見てもらう', body: '公開の前に、掲載する会社に全ページを確認してもらいます。スマホでも1画面ずつ見ます。' },
      { en: 'GROW', name: '育てる', body: '公開してからも、記事を足していきます。実績が増えたら、そのつど書き換えます。' },
      { en: 'CONNECT', name: 'つなぐ', body: '話してみたいという人が現れたら、内容を確かめ、両方に了承をもらってからおつなぎします。' },
    ],
    quote: '自分に時間をくれてる人はどんな人かを、まず知るべき。',
    quoteBy: '壁谷 友生',
  },

  after: {
    label: '公開したあと',
    title: ['申し込みが届いてから、{おつなぎするまで}。'],
    steps: [
      { name: '検索で見つかる', body: '会社名や悩みの言葉から、ページにたどり着く人が増えていきます。' },
      { name: '申し込みが届く', body: '「話してみたい」という申し込みは、まず私たちが受け取ります。' },
      { name: '私たちが読む', body: '掲載している会社の時間を守るために、先に内容を確かめます。' },
      { name: '掲載企業に聞く', body: '「こういう方から申し込みがありました。話してみますか」と確認します。' },
      { name: 'おつなぎする', body: '両方が望めば、LINEのグループをつくってご紹介します。' },
    ],
    note: '紹介の自動化は、Batonではやりません。',
    noteBody: '受付やお知らせは仕組みに任せています。誰と誰をつなぐかは、毎回、人が決めます。',
  },

  works: {
    label: '公開中のページ',
    title: ['いま公開している{ページ}'],
    more: 'くわしく見る',
  },

  faqTitle: 'よくある質問',
};

/* ───────── Baton（/baton/） ───────── */
export const baton = {
  label: '経営者のプロフィール',
  title: 'Baton',
  catch: ['選んだ人が、{選んだ人へ}。'],
  lead: '私たちが実際に会って話した経営者だけが載る、招待制のプロフィールです。読んで「この人と話してみたい」と思ったら、ページから申請できます。',
  site: { label: 'Batonを見る', href: 'https://baton.music-japan.com/profile/' },
  card: {
    url: 'baton.music-japan.com/profile/kabeya/',
    name: '壁谷 友生',
    role: '合同会社Music Japan 代表社員',
    tag: '学び、紡ぎ、繋いでいく。',
    rows: [
      ['拠点', '大阪・梅田'],
      ['しごと', '音楽の制作と配信、経営者インタビュー、会社と人の紹介'],
    ],
  },
  rules: {
    label: 'Batonの決まり',
    title: ['載るのは、{会って話した人だけ}。'],
    items: [
      { name: '招待制です', body: '掲載するのは、私たちが実際に会って話した経営者と事業者だけです。' },
      { name: '申請は人が読みます', body: '届いた申請はまず私たちが読み、掲載している本人に話してみるかを確かめます。' },
      { name: '名前で探せます', body: 'プロフィールは1人1ページ。名前で検索したとき、その人を説明するページとして残ります。' },
      { name: '紹介は人が決めます', body: '受付やお知らせは仕組みに任せても、つなぐかどうかは毎回、人が決めます。' },
    ],
  },
  flow: {
    label: '申請からおつなぎまで',
    title: ['4つの{手順で}{進みます}。'],
    steps: [
      { name: '申請する', body: 'プロフィールのページから、お名前と話したい理由を送ります。' },
      { name: '私たちが読む', body: '申請の内容を確かめます。' },
      { name: '本人に聞く', body: '掲載している本人に、話してみるかどうかを確認します。' },
      { name: 'おつなぎする', body: '両方が望めば、LINEのグループでおつなぎします。' },
    ],
  },
  versus: {
    label: 'Baton Partnersとの違い',
    title: ['Batonは人の、{Baton Partnersは}{会社のページ}。'],
    body: '名古屋のCentral AXには、会社の専用ページ（Baton Partners）と、代表の松浦淳さんのプロフィール（Baton）の両方があります。会社から入っても、人から入っても、同じところにたどり着けます。',
    links: [
      { label: 'Central AXの専用ページ', href: 'https://partners.music-japan.com/central-ax/' },
      { label: '松浦淳さんのプロフィール', href: 'https://baton.music-japan.com/profile/matsuura/' },
    ],
  },
};

/* ───────── SECOND TAKE（/second-take/） ───────── */
export const secondTake = {
  label: '経営者インタビュー',
  title: 'SECOND TAKE',
  catch: ['二度目に、{何を選んだのか}。'],
  lead: '一度つまずいた経営者に、二度目に何を選んだのかを聞くインタビューです。取材から公開まで私たちが手がけ、記事と声で残します。',
  site: { label: 'SECOND TAKEを見る', href: 'https://secondtake.music-japan.com/' },
  onAir: 'Podcastは配信の準備中です',
  outputs: {
    label: '1回の取材でできるもの',
    title: ['ひとつの話を、{4つの形で}{残します}。'],
    items: [
      { en: 'VOICE', name: 'Podcast', body: '記事に入りきらなかった話も、本人の声のまま届けます。' },
      { en: 'STORY', name: 'インタビュー記事', body: 'ひとつの決断を、いくつかの場面に分けて聞く長いインタビューです。' },
      { en: 'SEARCH', name: '検索で見つかるページ', body: '記事は1本ずつ独立したページになり、名前や会社名で探せます。' },
      { en: 'LINK', name: 'プロフィールと会社へ', body: '記事から、本人のプロフィールや会社のページへ進めます。' },
    ],
  },
  rules: {
    label: '聞き方の決まり',
    title: ['失敗を、{きれいな話に}{しない}。'],
    items: [
      { name: '迷っていた時間を聞く', body: '「乗り越えた話」にまとめる前の、迷っていた時間をそのまま聞きます。' },
      { name: '数字と気持ちを同じ重さで', body: '売上やお金のことと、そのとき何を感じていたかを、同じだけ大事に扱います。' },
      { name: '本人の言葉で残す', body: '手を入れるのは最小限です。記事と声、ふたつの形で残します。' },
    ],
  },
  now: {
    label: 'いまのこと',
    body: 'Podcastは、配信の準備を進めています。インタビューがたまったら、本にまとめるつもりです。',
  },
};

/* ───────── 公開中のページ（/works/） ───────── */
export const works = {
  label: 'Baton Partnersの実績',
  title: '公開中のページ',
  lead: 'Baton Partnersで公開している会社のページです。どれも、いま実際に使われています。それぞれの会社に合わせて、どう考えてつくったのかも書いておきます。',
  spec: { palette: '色', type: '書体', motif: '3D', pages: '5枚のページ' },
  all: { label: 'Baton Partnersの一覧を見る', href: 'https://partners.music-japan.com/' },
};

/* ───────── お知らせ（/news/） ───────── */
export const news = {
  label: 'お知らせ',
  title: 'お知らせ',
  lead: '公開したページや、いま進めていること、決めたことを、日付の新しい順に書いています。RSSでも読めます。',
  all: 'すべて',
  types: { NOW: '進行中', LATEST: '公開', 'BUILD LOG': 'つくったもの', JOURNAL: '決めたこと' } as Record<string, string>,
  feeds: 'RSSで読む',
};

/* ───────── 会社概要（/about/） ───────── */
export const about = {
  label: '会社概要',
  title: '会社概要',
  official: '大阪を拠点に、音楽制作・楽曲配信を軸として、Podcastやインタビューを通じて人の声と経験を記録する音楽・メディア会社です。',
  officialNote: '公式サイトの会社紹介より',
  rows: {
    name: '会社名',
    rep: '代表社員',
    address: '所在地',
    corporateNo: '法人番号',
    business: 'していること',
    email: 'メール',
    site: '公式サイト',
  },
  business: ['音楽の制作と配信', '会社の専用ページ「Baton Partners」', '経営者の招待制プロフィール「Baton」', '経営者インタビュー「SECOND TAKE」'],
  person: {
    label: '代表',
    role: '合同会社Music Japan 代表社員',
    body: '北海道で生まれ、東京を経て、いまは大阪で仕事をしています。',
    links: [
      { label: '公式サイトのプロフィール', href: 'https://music-japan.com/profile/' },
      { label: 'Batonのプロフィール', href: 'https://baton.music-japan.com/profile/kabeya/' },
    ],
  },
  sns: 'SNS',
  faqTitle: 'よくある質問',
};

/* ───────── 話してみる（/talk/） ───────── */
export const talk = {
  label: 'ご相談',
  title: '話してみる',
  lead: 'ご相談は、空いている日時を選んでいただく形で受けています。お話しするのは、代表の壁谷です。',
  topicsTitle: '受けているご相談',
  topics: [
    { name: 'Baton Partnersに載せたい', body: '会社の専用ページをつくりたい方。', href: '/baton-partners/' },
    { name: 'Batonについて聞きたい', body: 'プロフィールのことや、載っている人と話したい方。', href: '/baton/' },
    { name: 'SECOND TAKEに出たい', body: 'インタビューへの出演を考えている方。', href: '/second-take/' },
    { name: 'Webサイトをつくりたい', body: '公式サイトやLPの制作を考えている方。', href: '/works/' },
  ],
  button: '日程を選ぶ',
  buttonSub: 'TimeRexの予約ページが開きます',
  mail: 'メールでも受けています',
  music: '音楽の制作のご相談は、公式サイトで受けています。',
  musicLink: '公式サイトへ',
};

/* ───────── 見つからないページ ───────── */
export const notFound = {
  title: 'ページが見つかりません',
  body: 'アドレスが変わったか、ページがなくなったのかもしれません。',
  home: 'トップへ戻る',
};
