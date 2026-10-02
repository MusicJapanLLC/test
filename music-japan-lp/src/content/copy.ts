/**
 * このLPの文章（日本語）。HTMLはここから組み立てる。
 *
 * 書き方の決まり（社長の「口調・言葉選び」シートと baton-partners/CLAUDE.md より）
 * - 結論から。短く。同じ言い回しをくり返さない。誇張しない。未確定のことは確定のように書かない
 * - 使わない言葉：「設計」「リード獲得」「〜を実現」「〜に寄り添い」「〜を加速」、ダッシュでつなぐ文、絵文字
 * - 数字・実績は、公開用シート（確認済み実績）・公式サイト・各サービスの公開ページで確かめられるものだけ
 * - 価格・契約条件は書かない。ボタンは「話してみる」。問い合わせフォームは置かない（予約は TimeRex へ直接）
 *
 * 見出しの {波かっこ} は「ここで改行させない」印（表示されない）。本文は **強調** と [リンク](https://…) が使える。
 */

export const meta = {
  title: '合同会社Music Japanとは｜企業ページ制作と紹介「Baton Partners」',
  description:
    '合同会社Music Japan（大阪）の仕事を1ページにまとめました。会社ごとの専用ページと記事で検索から見つかる状態をつくり、話したいという人が現れたら、双方に確認してからおつなぎします。Baton Partners・Baton・SECOND TAKEのつながりと、掲載のご相談はこちら。',
  ogTitle: '会社を、見つけてもらう。知ってもらう。そして、話したくなるところまで。',
};

export const nav = [
  { id: 'what', label: '仕事', en: 'What we do' },
  { id: 'ecosystem', label: 'つながり', en: 'Ecosystem' },
  { id: 'partners', label: 'Baton Partners', en: 'Baton Partners' },
  { id: 'live', label: '公開中のページ', en: 'Live' },
  { id: 'now', label: 'いま', en: 'Now' },
  { id: 'about', label: '会社と代表', en: 'About' },
];

/** 打ち合わせのハードルを下げる言葉（ボタンの近くに置く） */
export const talk = {
  button: '話してみる',
  sub: '空いている日時を選ぶだけ',
  partners: 'Baton Partnersについて話してみる',
  float: '話してみる',
  floatSub: '日程を見る',
  ease: ['準備はいりません', '予約しても、何かが決まるわけではありません', '「まだ何も決まっていない」段階で大丈夫です'],
  steps: [
    { no: '1', title: '日時を選ぶ', body: 'TimeRexで、空いている枠から選ぶだけです。' },
    { no: '2', title: '会社のことを聞かせてもらう', body: 'いまの事業と、困っていること。準備はいりません。' },
    { no: '3', title: '合いそうなら、ページの話を', body: '掲載するかどうかは、話したあとで決めてください。' },
  ],
};

export const hero = {
  kicker: 'MUSIC JAPAN LLC — OSAKA',
  rotateLead: 'THIS PAGE IS ABOUT',
  rotate: ['COMPANIES', 'PEOPLE', 'STORIES', 'CONNECTIONS'],
  pre: 'Music Japanという名前ですが、このページで紹介するのは{音楽ではありません}。',
  title: ['会社を、{見つけてもらう}。', '{知ってもらう}。', 'そして、{話したくなる}ところまで。'],
  lead: '合同会社Music Japanは、大阪の会社です。企業ごとに専用のWebページをつくり、記事を書き、検索から見つかるページを増やしています。そのページを読んで「この会社と話してみたい」という人が現れたら、内容を確かめ、双方に確認してからおつなぎします。',
  secondary: '公開中のページを見る',
  live: 'LIVE',
  scroll: 'SCROLL — 点が、線になるまで',
};

export const what = {
  kicker: 'WHAT WE DO',
  title: ['やっていることを、', '{順番に並べると}。'],
  lead: '企業や経営者と一緒にする仕事は、4つの段階に分かれます。',
  stages: [
    {
      en: 'FOUND',
      title: '見つかる',
      body: '検索で見つかるページを増やします。会社ごとの専用ページ、代表者のプロフィール、記事。どれも1枚ずつ独立したページとして公開し、関係のあるページどうしをリンクでつなぎます。',
      where: ['Baton Partners', 'Baton', 'Web / SEO'],
    },
    {
      en: 'KNOWN',
      title: '知られる',
      body: '会社の良さを、Webで伝わる形にします。ロゴの色、事業の中身、代表者の考え方を調べてから、その会社のための色や書体、動きを決めます。',
      where: ['Baton Partners', 'Web / LP'],
    },
    {
      en: 'WANTED',
      title: '話したくなる',
      body: '人と経験を、記事にします。経営者が何を決め、どこで迷ったのか。SECOND TAKEでは、本人の言葉のまま残します。',
      where: ['SECOND TAKE', 'Baton'],
    },
    {
      en: 'CONNECTED',
      title: 'つながる',
      body: '最後は、人が間に入ります。「この人と話したい」という申請を受け取ったら、内容を確かめ、双方に確認してからLINEグループをつくります。',
      where: ['Baton', 'Baton Partners'],
    },
  ],
  aside: '社名のとおり、音楽の制作と配信も続けています。ただ、企業の方と一緒にする仕事は、ここに並べた4つが中心です。',
  asideLink: { label: '音楽の作品は公式サイトへ', href: 'https://music-japan.com/works/' },
};

export type EcoNode = {
  id: 'mj' | 'partners' | 'baton' | 'secondtake' | 'search' | 'intro';
  name: string;
  sub: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export const ecosystem = {
  kicker: 'ECOSYSTEM',
  title: ['人を掲載する。', '会社を伝える。', '{経験を記事にする}。', 'そして、{必要な人どうしを}{つなぐ。}'],
  lead: 'Baton Partners、Baton、SECOND TAKE、Webと検索、そして紹介。別々のサービスに見えますが、ひとつの流れの上にあります。点を選ぶと、何をする場所で、どこへつながるのかが分かります。',
  hint: '点を選んでください',
  nodes: [
    {
      id: 'mj',
      name: 'MUSIC JAPAN',
      sub: '間に入る人',
      body: '紹介はすべて、Music Japanが内容を確かめてから。誰と誰をつなぐかは、仕組みではなく人が決めます。',
    },
    {
      id: 'partners',
      name: 'BATON PARTNERS',
      sub: '会社を伝える',
      body: '企業ごとの専用ページ。世界観、代表者、サービス、記事、話してみる窓口までを、一社分つくります。',
      href: 'https://partners.music-japan.com/',
      linkLabel: 'Baton Partnersを見る',
    },
    {
      id: 'baton',
      name: 'BATON',
      sub: '人を掲載する',
      body: '経営者・事業者の招待制プロフィール。どんな人か、何をしているか、どんな人と話したいかを1ページにまとめます。',
      href: 'https://baton.music-japan.com/profile/',
      linkLabel: 'Batonを見る',
    },
    {
      id: 'secondtake',
      name: 'SECOND TAKE',
      sub: '経験を記事にする',
      body: '経営者が一度目につまずいたあと、二度目に何を選んだのかを聞くインタビューメディア。記事と声で残します。',
      href: 'https://secondtake.music-japan.com/',
      linkLabel: 'SECOND TAKEを見る',
    },
    {
      id: 'search',
      name: 'WEB / SEO',
      sub: '見つけてもらう',
      body: 'ページと記事を、検索エンジンとAIの両方が読める形で公開します。会社名や名前で調べたときの入口になります。',
    },
    {
      id: 'intro',
      name: 'INTRODUCTION',
      sub: '必要な人どうしをつなぐ',
      body: '双方の了承をもらってから、LINEグループでおつなぎします。つないだあとも、面談まで追いかけます。',
    },
  ] as EcoNode[],
  /** 線の意味。human = 人が判断する線（赤） */
  edges: [
    { from: 'partners', to: 'search', label: '会社名で見つかる' },
    { from: 'baton', to: 'search', label: '名前で見つかる' },
    { from: 'secondtake', to: 'search', label: '記事が残る' },
    { from: 'secondtake', to: 'baton', label: '出演者のプロフィールへ' },
    { from: 'partners', to: 'baton', label: '会社と代表者' },
    { from: 'partners', to: 'mj', label: '面談の希望', human: true },
    { from: 'baton', to: 'mj', label: '話したいという申請', human: true },
    { from: 'mj', to: 'intro', label: '確かめてから、つなぐ', human: true },
  ] as { from: EcoNode['id']; to: EcoNode['id']; label: string; human?: boolean }[],
  example: {
    title: 'たとえば、名古屋のCentral AX。',
    body: '会社にはBaton Partnersの専用ページがあり、代表の松浦淳さんにはBatonのプロフィールがあります。会社と人、両方の入口があるということです。',
    links: [
      { label: 'Central AXの専用ページ', href: 'https://partners.music-japan.com/central-ax/' },
      { label: '松浦淳さんのプロフィール', href: 'https://baton.music-japan.com/profile/matsuura/' },
    ],
  },
};

export const partners = {
  kicker: 'BATON PARTNERS',
  display: 'BATON PARTNERS',
  title: ['会社ごとに、', 'もうひとつの{ホームページを}。'],
  lead: 'Baton Partnersは、ロゴを一覧に並べるだけの掲載ではありません。一社ずつ専用のページをつくり、記事を書き、検索から見つかる状態にします。その会社のための、小さな集客メディアのようなものです。ページを見て話したいと思った人がいれば、Music Japanが確かめてからおつなぎします。',
  chips: ['1社につき5ページ', '世界観は一社ずつ', '記事と検索対策まで', '紹介は人が判断する'],
  anatomy: {
    kicker: 'ANATOMY',
    title: '1社につき、5ページ。',
    lead: 'トップ、取り組み、記事、サービス、話してみる。5枚のページで、その会社をひと通り説明できるようにします。',
    pages: [
      { key: 'top', en: 'TOP', name: 'トップ', body: 'その会社だけの色と動きで迎える入口。看板の機能や数字もここに。' },
      { key: 'about', en: 'ABOUT', name: '取り組み', body: 'どんな会社で、代表者が何を大事にしているか。' },
      { key: 'article', en: 'ARTICLE', name: '記事', body: 'お客さんが検索しそうな悩みから書く、読み物のページ。' },
      { key: 'service', en: 'SERVICE', name: 'サービス', body: '何を頼めて、どう進むのか。' },
      { key: 'talk', en: 'TALK', name: '話してみる', body: '公式LINEと短いアンケートで受け付ける、面談の窓口。' },
    ],
    /** page: どのページに入るか（-1 = 全ページ） */
    parts: [
      { no: '01', name: '世界観', page: 0, body: 'ロゴの色と事業の中身から、その会社だけの色・書体・3Dの演出を決めます。' },
      { no: '02', name: '代表者', page: 1, body: '代表者の言葉や経歴を、公開されている範囲で紹介します。' },
      { no: '03', name: '会社の背景', page: 1, body: 'なぜその事業をしているのか。会社の成り立ちを書きます。' },
      { no: '04', name: 'サービス', page: 3, body: '何を頼めて、どんな順番で進むのか。公式の表現を使って説明します。' },
      { no: '05', name: '強み', page: 0, body: 'ほかではなく、この会社に頼む理由を、具体的な場面で書きます。' },
      { no: '06', name: '実績', page: 0, body: '数字や導入事例は、公表されているものだけを載せます。' },
      { no: '07', name: '記事', page: 2, body: '見込みのお客さんが抱える悩みから入る記事を、1本書きます。' },
      { no: '08', name: 'SEO', page: -1, body: 'タイトル、構造化データ、よくある質問。検索エンジンとAIが読める形にします。' },
      { no: '09', name: '検索からの入口', page: 2, body: '会社名を知らない人にも、悩みの言葉から見つけてもらう入口になります。' },
      { no: '10', name: '話してみる', page: -1, body: 'どのページからも、面談の窓口へ進めるようにします。' },
      { no: '11', name: '面談希望の受付', page: 4, body: '届いた相談は、まずMusic Japanが受け取り、内容を確かめます。' },
    ],
  },
  world: {
    kicker: 'WORLD',
    title: '社名を差し替えるだけの、{テンプレートにはしない}。',
    lead: 'ロゴの色、事業の中身、代表者の考え方を調べてから、その会社のための色・書体・3Dの演出を決めます。同じ5ページでも、見た目はまったく違います。',
  },
  after: {
    kicker: 'AFTER LAUNCH',
    title: ['ページをつくって{終わらない}。', '公開した後から、{関係が始まる}。'],
    steps: [
      { en: 'PUBLISH', name: '公開', body: '掲載企業に内容を見てもらってから、公開します。' },
      { en: 'SEARCH', name: '検索', body: '会社名や悩みの言葉で、検索から人が来ます。' },
      { en: 'READ', name: '記事', body: '記事を読んで、会社のことを知る人が増えます。' },
      { en: 'SHARE', name: 'SNS', body: 'LinkedInなどのSNSからも、ページへ案内します。' },
      { en: 'REQUEST', name: '話したい、が届く', body: '「話してみる」の窓口から、相談が届きます。' },
      { en: 'CHECK', name: 'Music Japanが確かめる', body: '掲載企業の時間を守るために、内容を先に読みます。', human: true },
      { en: 'ASK', name: '掲載企業に聞く', body: '「こういう方から相談が来ています。話してみますか」と、先に確認します。', human: true },
      { en: 'CONNECT', name: 'つなぐ', body: '双方が望めば、LINEグループをつくっておつなぎします。', human: true },
    ],
    note: '掲載企業に最初に届くのは「相談が1件届いた」という知らせと受付番号だけです。相談した方の連絡先は、双方が了承するまでMusic Japanだけが持ちます。',
    quote: '紹介の自動化は、Batonではやりません。',
    quoteBy: '壁谷 友生（合同会社Music Japan 代表社員）',
    quoteNote: '申請の受付や通知は、仕組みに任せています。誰と誰をつなぐかは、相手を知っている人が決めます。',
  },
  origin: {
    kicker: 'ORIGIN',
    title: ['紹介の仕事から、', '{会社のページが}生まれた。'],
    paragraphs: [
      'Music Japanは、経営者に話を聞き、人と人を紹介する仕事を続けてきました。2026年9月だけでも、双方の了承を取ったうえで、16組の経営者をおつなぎしています。',
      '9月のはじめ、代表の壁谷は「紹介として進めるBaton」と「事業として打ち出すBaton」を分けたいと考えていました。そして9月の終わり、提携企業との打ち合わせで、会社の強みを伝える専用ページをつくる提案が受け入れられます。こうして、人のプロフィールを載せるBatonと、会社の専用ページと紹介をひとつにしたBaton Partnersが分かれました。',
      '面談の希望が届いても、詳細を掲載企業へそのまま渡すことはしません。それでは、間に人が入らない紹介になってしまうからです。掲載企業には知らせだけを送り、内容の確認と、つなぐかどうかの判断はMusic Japanが持つ。この進め方は、提携企業にも説明して了承をもらっています。',
      'AIで情報が安く手に入るほど、相手を知っている人がつなぐことの意味は大きくなる。壁谷は、そう考えています。',
    ],
    timeline: [
      { date: '2026.09', text: '紹介の仕事を続けるなかで、Batonを2つに分ける構想' },
      { date: '2026.09.30', text: 'エボルグとCentral AXの専用ページを公開' },
      { date: '2026.10.02', text: 'このページを公開' },
    ],
  },
};

export const build = {
  kicker: 'HOW WE BUILD',
  title: ['一社のページが、', '{できるまで}。'],
  lead: '調べるところから、人をつなぐところまで。8つの工程を、順番に進めます。',
  steps: [
    { en: 'RESEARCH', name: '調べる', body: '公式サイト、サービスのページ、プレスリリース、代表者のインタビュー。まず全部読みます。読めなかったことは、断定して書きません。' },
    { en: 'UNDERSTAND', name: 'つかむ', body: 'ロゴの色、言葉づかい、代表者がくり返し話していること。その会社らしさが、どこにあるのかを探します。' },
    { en: 'WORLD', name: '世界観を決める', body: '色、書体、3Dの演出を、その会社のために決めます。エボルグは紙と明朝、Central AXはモノクロの建築模型。' },
    { en: 'BUILD', name: 'つくる', body: '1社で5ページ。文章は人が読む前提で書き、数字や実績は公表されているものだけを使います。' },
    { en: 'SEARCH', name: '検索に備える', body: 'タイトル、説明文、構造化データ、よくある質問。検索エンジンとAIの両方が読める形にします。' },
    { en: 'LAUNCH', name: '公開する', body: '公開の前に、掲載企業に内容を見てもらいます。スマホでも、一画面ずつ確かめます。' },
    { en: 'GROW', name: '育てる', body: '公開して終わりではありません。記事を足し、実績が増えたら書き換えます。' },
    { en: 'CONNECT', name: 'つなぐ', body: '話したいという人が現れたら、Music Japanが確かめ、双方の了承をもらってからおつなぎします。' },
  ],
  quote: '自分に時間をくれてる人はどんな人かを、まず知るべき。',
  quoteBy: '壁谷 友生',
};

export const live = {
  kicker: 'LIVE PROJECTS — CURRENT PARTNERS',
  title: ['いま公開している、', '{2社のページ}。'],
  lead: 'Baton Partnersで公開しているページです。どちらも、実際に運用しています。',
  all: { label: 'Baton Partnersの一覧を見る', href: 'https://partners.music-japan.com/' },
  open: 'ページを開く',
};

export const baton = {
  kicker: 'BATON',
  title: ['選んだ人が、', '{選んだ人へ}。'],
  lead: 'Batonは、経営者・事業者のための招待制のプロフィールと紹介のサービスです。載っているのは、Music Japanが実際に会って話した人だけ。プロフィールを読んで「この人と話してみたい」と思ったら、ページから申請できます。',
  points: [
    { title: '招待制', body: '掲載するのは、Music Japanが実際に会って話した経営者・事業者だけです。' },
    { title: '人が確かめる', body: '申請はまずMusic Japanが読み、掲載者本人に可否を確かめてからつなぎます。' },
    { title: '信用が残る', body: 'プロフィールは1人1ページ。名前で検索したときに、その人を説明するページとして残ります。' },
    { title: '自動化しない', body: '受付や通知は仕組みに任せても、紹介するかどうかは人が決めます。' },
  ],
  flow: [
    { en: 'APPLY', name: '申請する', body: 'プロフィールのフォームから、目的とお名前を送ります。' },
    { en: 'READ', name: 'Music Japanが読む', body: '内容を確かめます。' },
    { en: 'ASK', name: '掲載者に聞く', body: '本人に、話してみるかどうかを確認します。' },
    { en: 'PASS', name: 'バトンを渡す', body: '双方の希望が合えば、LINEグループでおつなぎします。' },
  ],
  stat: { value: '16', unit: '組', label: '2026年9月に、双方の了承を取ったうえでおつなぎした経営者の組数', source: 'Music Japanの記録より' },
  profile: {
    caption: 'プロフィールの例 — 代表・壁谷のBatonページ',
    labels: { who: 'どんな人か', what: '何をしているか', want: 'どんな人と話したいか', links: '公式サイト・SNS', media: 'メディア・実績' },
  },
  links: [
    { label: 'Batonを見る', href: 'https://baton.music-japan.com/profile/' },
    { label: '壁谷のプロフィール', href: 'https://baton.music-japan.com/profile/kabeya/' },
  ],
};

export const secondTake = {
  kicker: 'SECOND TAKE',
  title: ['失敗の続きに、', '{その人がいる}。'],
  lead: 'SECOND TAKEは、経営者が一度目につまずいたあと、二度目に何を選んだのかを聞くインタビューメディアです。Music Japanが運営し、取材から公開までを手がけます。Baton Partnersなどで関係ができた会社や経営者で、希望される方には、出演という形でも露出を広げられます。',
  outputsTitle: '1回の取材が、{4つの形で}残る。',
  outputs: [
    { en: 'VOICE', name: 'Podcast', body: '記事に入りきらなかった話も含めて、本人の声で。' },
    { en: 'STORY', name: 'インタビュー記事', body: 'ひとつの決断を、四つの場面で聞くロングインタビュー。' },
    { en: 'SEARCH', name: '検索できるWebページ', body: '記事は1本ずつ独立したページになり、名前や会社名で探せます。' },
    { en: 'LINK', name: '本人と会社への道', body: '記事から、プロフィールや会社のページへ進めます。' },
  ],
  principles: [
    { no: '01', name: '失敗を、美談にしない', body: '「乗り越えた話」にまとめる前の、迷っていた時間をそのまま聞きます。' },
    { no: '02', name: '数字と感情を、同じ重さで', body: '売上や資金の事実と、そのとき何を感じていたかを、同じ重さで扱います。' },
    { no: '03', name: '本人の言葉で、残す', body: '編集は最小限に。記事と声、二つのかたちで記録します。' },
  ],
  notAd: '広告の枠を買うのとは違います。その人の経験と背景が、ページとして残り続けます。',
  status: 'Podcastは、配信の準備を進めています。',
  link: { label: 'SECOND TAKEを見る', href: 'https://secondtake.music-japan.com/' },
  talk: '出演について話してみる',
};

export const search = {
  kicker: 'SEARCH ASSET',
  title: ['公開したページが、', '{検索の中に}積み上がっていく。'],
  lead: '会社の専用ページ、人物のプロフィール、記事、SECOND TAKE、Music Japanの公式サイト。どれも独立したページとして公開し、意味のあるところだけをリンクでつないでいます。会社名や名前で調べたときに、その人や会社を説明するページが、1枚ずつ増えていく。止めたら消える広告とは違い、ページは残ります。',
  demoQuery: '会社名　代表者名',
  demo: [
    { kind: 'Baton Partners', title: '会社の専用ページ', url: 'partners.music-japan.com/…' },
    { kind: 'Baton', title: '代表者のプロフィール', url: 'baton.music-japan.com/profile/…' },
    { kind: '記事', title: 'お客さんの悩みから書いた記事', url: 'partners.music-japan.com/…/insights/…' },
    { kind: 'SECOND TAKE', title: 'インタビュー', url: 'secondtake.music-japan.com/…' },
    { kind: '公式サイト', title: '会社の公式サイト', url: '…' },
  ],
  demoNote: '図はイメージです。実際の検索結果や順位を示すものではありません。',
  ledgerTitle: 'いま公開しているページ',
  ledger: [
    { name: '株式会社エボルグ', kind: 'Baton Partners（5ページ）', date: '2026-09-30', href: 'https://partners.music-japan.com/evorg/' },
    { name: '株式会社Central AX', kind: 'Baton Partners（5ページ）', date: '2026-09-30', href: 'https://partners.music-japan.com/central-ax/' },
    { name: '松浦 淳（Central AX）', kind: 'Baton プロフィール', date: '2026-09-30', href: 'https://baton.music-japan.com/profile/matsuura/' },
    { name: 'SECOND TAKE', kind: 'インタビューメディア', date: '2026-09-13', href: 'https://secondtake.music-japan.com/' },
    { name: '合同会社Music Japan', kind: '公式サイト（日本語・英語）', date: '2026-09-13', href: 'https://music-japan.com/' },
    { name: 'このページ', kind: 'Music Japanの仕事', date: '2026-10-02', href: '' },
  ],
  logTitle: 'SEARCH LOG — 検索での確認',
  logHead: ['誰のページ', '検索した言葉', '公開', '確認', '順位'],
  logEmpty: '確かめられたものから、ここに記録していきます。',
  rule: '順位を載せるのは、誰のページを、どの言葉で、いつ確かめたのかまで記録できたものだけです。',
  principle: '検索に出た。読まれた。相談が来た。仕事になった。この4つは、別々の成果として数えています。',
};

export const now = {
  kicker: 'NOW — LATEST / BUILD LOG / JOURNAL',
  title: ['いま、Music Japanで', '{動いていること}。'],
  lead: 'つくったもの、公開したもの、決めたこと。ここに足していきます。',
  all: 'すべて',
  more: 'もっと見る',
  feeds: 'この欄の更新は、RSSでも受け取れます。',
};

export const about = {
  kicker: 'ABOUT — COMPANY & REPRESENTATIVE',
  title: '合同会社Music Japanについて',
  /** 公式サイトの会社説明（そのまま） */
  official: '大阪を拠点に、音楽制作・楽曲配信を軸として、Podcastやインタビューを通じて人の声と経験を記録する音楽・メディア会社です。',
  own: '公式サイト、SECOND TAKE、Baton、Baton Partners。Webサイトは、すべて自社でつくり、運用しています。',
  businesses: ['企業の専用ページと紹介（Baton Partners）', '招待制のプロフィールと紹介（Baton）', '経営者インタビュー・Podcast（SECOND TAKE）', '経営者どうしの紹介', 'Webサイト・LPの制作', '音楽の制作・配信'],
  person: {
    name: '壁谷 友生',
    kana: 'かべや ともき',
    en: 'Tomoki Kabeya',
    role: '合同会社Music Japan 代表社員',
    bio: '北海道出身。東京を経て、梅田の夜景と街の熱量にひかれて大阪へ。人の話を聞くことと、人を紹介することが、いちばん好きな仕事だと話します。',
    /** 公式サイトの代表ステートメント（そのまま） */
    statement: [
      'どうしようもなくつらい経験、孤独や絶望。それらをただ憎み、退けるのではなく、向き合い表現することで、日常生活では決して生まれないアウトプットが生まれると私は思います。',
      '音楽やメディア、Podcastというのは表現の手段です。',
      '合同会社Music Japanは、あらゆる自己表現とそこの共鳴からうまれる思いを繋ぎ、そして今苦境の最中にいる人の支えになるようなそんな記録を世に残せたらと思っています。',
    ],
    tagline: '学び、紡ぎ、繋いでいく。',
    photoAlt: '合同会社Music Japan 代表社員 壁谷友生',
  },
  links: [
    { label: 'Batonのプロフィール', href: 'https://baton.music-japan.com/profile/kabeya/' },
    { label: '公式サイトの代表プロフィール', href: 'https://music-japan.com/profile/' },
  ],
};

export const faqTitle = { kicker: 'QUESTIONS', title: 'よくある質問' };

export const cta = {
  kicker: "LET'S TALK",
  title: '話してみる。',
  linkFrom: 'あなたの会社',
  linkTo: '壁谷 友生',
  lead: 'Baton Partnersへの掲載について、まずは話してみませんか。会社のこと、いま困っていることを先に聞かせてください。ページの話は、そのあとで。',
  othersTitle: 'ほかのご相談も、同じ予約ページで受けています。',
  others: ['Batonへの掲載・紹介について', 'SECOND TAKEへの出演について', 'Webサイト・LPの制作について'],
  pick: '日時を選ぶ',
  mail: 'メールで送る',
};

export const footer = {
  marquee: 'COMPANIES. PEOPLE. STORIES. CONNECTIONS. FROM OSAKA.',
  services: 'SERVICES',
  company: 'MUSIC JAPAN',
  follow: 'FOLLOW',
  rights: '© 2026 合同会社Music Japan',
  top: 'BACK TO TOP',
};
