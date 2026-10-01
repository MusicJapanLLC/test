import type { TalkProfile } from '../types';

/**
 * Baton Introduction System のプロフィール一覧。
 * 実在の人物1件ずつを、ここに手で追加していく（テンプレートからの自動生成はしない）。
 *
 * 掲載者の連絡先（recipient_email）はここには置かない。
 * GAS側（スプレッドシート）だけが非公開情報として持つ。
 */

/**
 * 実データで作った1件目のプロフィール。
 * 「その人専用の小さなLP」として、人物紹介・事業内容・運営メディア・
 * メディア・話したいCTAまでを1ページに収める。
 * 今後、出演コンテンツが増えるたびに media / services を追記していく想定。
 */
const kabeyaProfile: TalkProfile = {
  id: 'kabeya',
  slug: 'kabeya',
  name: '壁谷 友生',
  company: '合同会社Music Japan',
  title: '代表社員',
  tagline: '学び、紡ぎ、繋いでいく。',
  photo: {
    src: '/profile-kabeya-hd.webp',
    alt: '壁谷 友生',
    caption: 'OSAKA / JAPAN · 2026',
  },
  bio:
    'Podcast「SECOND TAKE（セカンドテイク）」にて、経営者の決断や苦悩、それらをどう乗り越えてきたのか。' +
    'その人自身の言葉や経験を「インタビュー記事」として記録していく経営者メディアを運営しています。',
  business: [
    '「音楽制作・メディア運営・法人紹介」の三事業を展開。' +
      '招待制の紹介サービス「Baton -バトン-」では、運営が実際に面談した経営者・事業者の中から、' +
      '双方に可能性があると判断した相手を紹介しています。',
  ],
  services: [
    { name: 'Music Japan', description: '海外向け音楽、Jazz、BGMの制作・配信' },
    { name: 'SECOND TAKE', description: '経営者の決断と苦悩を記録するPodcast' },
    { name: 'Interview', description: '経営者の人生と事業を残す記事メディア' },
    { name: 'Baton -バトン-', description: '招待制紹介サービスで深く長い関係づくりを。' },
  ],
  // 松浦プロフィールと同じ「大きなカード＋一覧」の見せ方。説明文は本文・サービス欄にある事実だけ
  media: [
    {
      label: 'SECOND TAKE（セカンドテイク）',
      url: 'https://secondtake.music-japan.com/',
      image: '/media-secondtake-logo.webp',
      kind: '運営',
      note: '経営者の決断や苦悩、それらをどう乗り越えてきたのかを、その人自身の言葉で記録するインタビュー記事メディア。',
      featured: true,
    },
    {
      label: '合同会社Music Japan 公式サイト',
      url: 'https://music-japan.com/',
      image: '/media-musicjapan-hp.png',
      kind: '公式',
      note: '海外向け音楽・Jazz・BGMの制作・配信、メディア運営、法人紹介の三事業。',
      featured: true,
    },
    {
      label: 'Baton -バトン-',
      url: 'https://baton.music-japan.com/profile/',
      image: '/og/baton.jpg',
      kind: '運営',
      note: '運営が実際に面談した経営者・事業者の中から、双方に可能性があると判断した相手を紹介する招待制の紹介サービス。',
      featured: true,
    },
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/',
      kind: '発信',
      owner: 'person',
    },
    {
      label: 'Instagram @music.japan.llc2',
      url: 'https://www.instagram.com/music.japan.llc2/',
      kind: '発信',
      owner: 'company',
    },
  ],
  mediaFirst: true,
  mediaTitle: '運営メディア・発信',
  mediaLabel: 'Media & Works',
  location: '大阪',
  updatedAt: '2026-09-30',
  listSummary: '招待制紹介サービス「Baton」の運営',
  businessTags: ['音楽制作', 'メディア運営', '法人紹介'],
  keywordTags: ['洋楽/Jazz', '経営者対談', '完全招待制'],
  theme: { primary: '#C8102E', accent: '#D9A441', bg: '#0A0A0C', text: '#EDEAE4' },
  heavyWebGL: true,
  active: true,
};

/**
 * 松浦 淳（株式会社Central AX）。
 * 掲載内容は、Ownerが取りまとめた調査メモ（2026-09-30時点）に書かれた事実のみ。
 * 資本金・従業員数・売上などの企業スペックは載せない（ADDING_A_PROFILE.md の方針）。
 * 公式サイト（https://central-ax.co.jp/）は Owner から提供されたURL。
 * label を「公式サイト」にしてあるので、構造化データの会社URLにも反映される。
 */
const matsuuraProfile: TalkProfile = {
  id: 'matsuura',
  slug: 'matsuura',
  name: '松浦 淳',
  company: '株式会社Central AX',
  title: '代表取締役CEO',
  tagline: 'AIを、現場で使われるところまで。',
  photo: {
    src: '/profile-matsuura.webp',
    alt: '松浦 淳',
    caption: 'NAGOYA / JAPAN · 2026',
  },
  bio:
    '名古屋を拠点に、企業のAI実装を支援する株式会社Central AXの代表。' +
    '生成AI研修から業務改善・システム開発、AI検索対策（LLMO）まで、' +
    'AIを「導入して終わり」にせず、社員が実際に使って業務が変わるところまで伴走しています。',
  business: [
    '2026年5月に設立したAI実装会社として、AI研修・人材育成、AI受託開発・業務改善、LLMO／AI検索対策の3つを一社で手がけています。' +
      '設立から2026年8月末までに、20社を支援しました。',
    'ChatGPT・Claude・Claude Code・Gemini・Microsoft 365 Copilot・RAG・MCPなどを扱いながら、ツールありきではなく、' +
      '企業ごとの業務から「何を楽にするか」を決めて設計します。松浦自身はClaude Codeをリリース日から活用しています。' +
      '愛知・岐阜・三重・静岡の東海4県を重点に、製造・建設・物流・観光など、現場へ足を運ぶ支援を続けています。',
    '登壇・発信も設立直後から積極的に行っており、公認会計士向けのClaude Code実演デモ、Microsoft 365 Copilotのセミナー、' +
      '製造業向け展示会でのAIセキュリティ講演、四日市商工会議所での経営者向けAIセミナーなどに登壇しています。',
  ],
  services: [
    {
      name: '研修・人材育成',
      description: 'ChatGPT・Claude・Copilotなどを、自社の実業務を題材に、社員が使える状態まで',
    },
    {
      name: '受託開発・業務改善',
      description: 'ヒアリング→業務整理→PoC→実装→定着。小さく検証してから広げる',
    },
    {
      name: 'LLMO／AI検索',
      description: 'ChatGPTやGeminiなどに、企業情報が参照・引用されやすい状態をつくる',
    },
  ],
  media: [
    {
      label: 'AIで変わる会計士実務 ― Claude Code実演デモ',
      url: 'https://luma.com/ud5yi7ed',
      kind: '登壇',
      date: '2026.08.10',
      note: '公認会計士・税理士の畠山謙人氏と共同開催。監査調書・財務DD・企業分析をClaude Codeで処理する実演に、120名が申込。',
      featured: true,
    },
    {
      label: '製造業向け展示会セミナー｜生成AIの機密情報・シャドーAI対策',
      url: 'https://biz.q-pass.jp/f/13216/inw_autumn_seminar26/seminar_register?fid=E1mNKjK3Zn03kn05&tag=16009',
      kind: '登壇',
      date: '2026.09',
      note: 'ネプコン ジャパン／オートモーティブ ワールド／ファクトリーイノベーション Week 関連。図面・仕様書・原価表などをAIへ入力する際の線引きを解説。',
      featured: true,
    },
    {
      label: 'Central AX 設立プレスリリース',
      url: 'https://prtimes.jp/main/html/rd/p/000000003.000188813.html',
      kind: '掲載',
      note: 'PR TIMES。設立の背景、創業コメント、事業内容、東海でAI実装を進める理由。',
      featured: true,
    },
    {
      label: 'Microsoft 365 Copilot活用ユースケース徹底攻略20選',
      url: 'https://luma.com/aideeplive_260914',
      kind: '登壇',
      date: '2026.09.14',
      note: 'Outlook・Teams・Word・Excel・PowerPointなど、既に使っている環境へのAI導入を解説。',
      featured: true,
    },
    {
      label: '公式サイト',
      url: 'https://central-ax.co.jp/',
      kind: '公式',
      note: '株式会社Central AX。AI研修・AI受託開発・LLMO対策のサービス詳細。',
    },
    {
      label: 'ATIS × Central AX 経営者向けAI活用セミナー（四日市）',
      url: 'https://prtimes.jp/main/html/rd/p/000000005.000188813.html',
      kind: '掲載',
      date: '2026.10.05 開催予定',
      note: 'PR TIMES。四日市商工会議所にて開催。松浦のコメントも掲載。',
    },
    {
      label: 'テレ東プラス',
      url: 'https://www.tv-tokyo.co.jp/plus/external-pr/entry/255701.html',
      kind: '掲載',
      note: '上記PR TIMESリリース（四日市セミナー）の転載掲載。',
    },
    {
      label: 'Central AX 公式note',
      url: 'https://note.com/central_ax',
      kind: '発信',
      owner: 'company',
      note: 'AI導入・業務効率化・Claude Code・生成AIの現場定着などを継続的に発信。',
    },
    {
      label: 'X @JunP1ayer',
      url: 'https://x.com/JunP1ayer',
      kind: '発信',
      owner: 'person',
      note: 'AI×業務改善、Claude Code、企業へのAI導入について本人が発信。',
    },
  ],
  mediaFirst: true,
  servicesTitle: '事業領域',
  location: '名古屋',
  updatedAt: '2026-09-30',
  listSummary: '企業のAI実装を現場まで伴走',
  businessTags: ['AI研修', '受託開発', 'LLMO対策'],
  keywordTags: ['現場定着', 'Claude Code', '東海発'],
  // 淡い水色の地は野暮ったく見えるため、深い紺の地に電光のような青を差す
  theme: { primary: '#2F5BEA', accent: '#5CC8FF', bg: '#050914', text: '#E6ECF8' },
  active: true,
};

/**
 * 石井 嵩大（株式会社C.C）。
 * 掲載内容は、Ownerから受け取った調査メモ（2026-10-01、公開ページ50件以上を5周で照合）と、
 * 本人が公開しているLinkedIn・X、C.C公式サイト、インタビュー・Podcastで確認できる事実のみ。
 * 調査メモの注意点に従い、次は載せない／書き方を変えている:
 *  - 設立月（公式2025年5月とPR TIMES 2025年4月で食い違い）→「2025年設立」とだけ書く
 *  - 年齢（誕生日が未確認）→ 載せない
 *  - 売上・資本金・従業員数（企業スペック）→ 載せない（ADDING_A_PROFILE.md の方針）
 *  - 開発事例の数値 → 「同社公開事例では」と出典を明記する
 *  - PASの料金・条件（変わりやすい）→ 公式サイト参照とする
 * Facebook は本人のアカウントを確認できなかったため載せていない。
 */
const ishiiProfile: TalkProfile = {
  id: 'ishii',
  slug: 'ishii',
  name: '石井 嵩大',
  company: '株式会社C.C',
  title: '代表取締役社長',
  tagline: '経営に、余白を。人生に、本質を。',
  photo: {
    src: '/profile-ishii.webp',
    alt: '石井 嵩大',
    caption: 'TOKYO / JAPAN · 2026',
  },
  bio:
    '経営者コミュニティ・人材紹介・SES営業など、人と人をつなぐ事業を経験したのち、' +
    '自身が業務に追われた経験を原点に、双子の弟・石井皓晟と株式会社C.Cを経営。' +
    'AIとシステムで、経営者が本当に向き合うべきことに時間を使える「余白」をつくっています。',
  story: {
    paragraphs: [
      '転機は大学3年の頃。母親の病気を知り、「普通に就職して少しずつ貯金して親孝行していたのでは、間に合わないかもしれない」と考えたことから、起業を目標にBtoB営業の世界に入りました。インターン、事業責任者、会社づくりを経験していきます（本人がPodcast「経営者の志」で語った内容）。',
      '経営者コミュニティや人材紹介など、人と人・企業と企業をつなぐ仕事に携わるなかで、日々はどんどん忙しくなり、本来の目的だった家族との時間からは、むしろ遠ざかっていきました。',
      'そこで双子の弟・皓晟が、人材紹介の業務用システムを作り、履歴書・推薦文・企業選定などを効率化。仕組みで時間が戻ってきたこの経験が、「余白をつくる」という株式会社C.Cの発想の原点になっています。',
      '様々な事業に手を出していた時期を、本人は「キャリアロンダリングになりかけた」と振り返ります。大学卒業前に「何をしたいのか」から逆算して事業を整理し、一つに振り切りました（未来共創のインタビューより）。',
    ],
    image: { src: '/profile-ishii-2.webp', alt: '石井 嵩大' },
    timeline: [
      { org: '株式会社ボードルア', role: '事業統括本部', note: 'SES領域の営業・採用構築' },
      {
        org: '株式会社ポロック',
        role: '経営者コミュニティ「Bowers」事業部長',
        note: '本人プロフィールでは、約2,100名規模から3,500名規模へ拡大',
      },
      { org: '株式会社バジェットアドテクノロジーズ', role: 'CSO', note: 'SNSマーケティング、BtoB営業戦略' },
      {
        org: '株式会社FUBAR',
        role: '人材紹介事業「咲縁」の立ち上げ・運営',
        note: '本人プロフィールでは、月100名以上を集客',
      },
      { org: '株式会社C.C', role: '代表取締役社長（2025年設立）', note: '営業・マーケティング・事業構築を担当' },
    ],
  },
  businessTitle: '現在の事業',
  business: [
    '株式会社C.Cの代表取締役社長として、主に営業・マーケティング・事業構築を担当しています。技術面は、双子の弟でフルスタックエンジニアの石井皓晟がバックオフィスとエンジニアリングを担い、「事業をつくる兄」と「仕組みをつくる弟」の共同経営で会社を動かしています。',
    'C.Cは「余白を設計する会社」として、AI導入支援・DXコンサルティング、CAIO顧問、AIシステムの受託開発、経営者向けサービス「PAS」を手がけています。支援は「棚卸 → 余白設計 → 仕組化 → 伴走」の順に進め、繰り返し作業・転記・確認・集計などを特定したうえで、既存のSaaS・AI・自動化・独自開発を組み合わせます。システムを納品して終わりではなく、現場で使われ続け、属人化が消えるところまでを扱います。',
    '2026年8月に正式提供を始めた「PAS」は、日程調整・紹介文・お繋ぎ文・商談準備・紹介履歴などの反復業務をLINE中心で簡略化しつつ、人脈そのものを交換できる経営者向けのサービスです。C.Cが直接会った500社以上の経営者のデータベースから、相性の良い経営者を紹介する仕組みも持っています（同社公表）。',
    '既存の経営者マッチングでは「営業したい人同士がマッチングすると、お互いが営業になる」という問題意識から、PASではAさんとBさんを直接ではなく、Bさんが持っている人脈とAさんをつなぐ設計にしています（Podcastでの本人談）。',
  ],
  about: {
    title: '株式会社C.Cについて',
    paragraphs: [
      '社長が業務に追われ、本当に向き合うべきことに時間を使えない。その状態を、AIとシステムで終わらせるために生まれた会社です。「社長は、本来忙しくあるべきではない」という考えが創業の原点にあります。',
    ],
    facts: [
      { term: 'MISSION', value: '経営に余白を。人生に本質を。' },
      { term: 'VISION', value: '時間に追われる状態を終わらせる。すべての人が、本質に時間を使える社会へ' },
      {
        term: 'VALUE',
        value: 'PURPOSE FIRST／VALUE OVER BUSY／CREATE TIME／COMMIT TO CONTINUITY／SYSTEMIZE RESULTS',
      },
      { term: '経営体制', value: '石井嵩大（営業・マーケティング・事業構築）／石井皓晟（バックオフィス・エンジニアリング）' },
      { term: '設立', value: '2025年' },
      { term: '所在地', value: '東京都港区北青山' },
    ],
  },
  servicesTitle: 'サービス・強み',
  services: [
    { name: 'ニブンノイチ', description: '価格・納期・作業時間を、従来のおよそ半分にするAI／システム導入支援' },
    { name: 'CAIO顧問', description: '企業の最高AI責任者に近い立場で、何をAI化すべきかの戦略から実装まで伴走' },
    { name: 'AI受託開発', description: 'SaaS・AI・自動化・独自開発を組み合わせ、現場で使われ続ける仕組みに' },
    { name: 'PAS', description: '日程調整・紹介文・商談準備をLINEで簡略化し、人脈を交換できる経営者向けサービス' },
  ],
  values: [
    { title: '愛のない行動は、しない', body: 'C.C公式サイトに、石井自身の行動基準として掲げている言葉。' },
    {
      title: '社長は、本来忙しくあるべきではない',
      body: '自身が業務に追われた経験からたどり着いた、C.C創業の原点となる考え。',
    },
    {
      title: 'できないことを、はっきりさせる',
      body: '経験で年上に敵わない部分は教えてもらう。一方で、AI・システムの領域では「任せてください」と言い切る（インタビューより）。',
    },
    {
      title: '「何をしたいのか」から逆算する',
      body: '手を広げすぎた時期を振り返り、大学卒業前に事業を一つに絞った経験から。',
    },
  ],
  wantToMeet: {
    lead: 'C.Cの事業内容から、Batonが特にご縁をつなぎたいと考えている方です。',
    items: [
      'AI・DXを進めたいが、何から始めるかが決まっていない経営者',
      '営業やバックオフィスが属人化している企業',
      'SFA／CRMや業務システムの導入・見直しを考えている企業',
      '経営者紹介・コミュニティ・人脈を軸にした事業を営む方',
    ],
  },
  media: [
    {
      label: '株式会社C.C石井嵩大が「社長の100時間を創る」理由',
      url: 'https://miraikyoso.jp/interview/ishiishuta/',
      kind: '掲載',
      date: '2026',
      note: '未来共創によるロングインタビュー。事業を一つに絞った経緯、「できないことをはっきりさせる」という考え方、これからの会社像を語っている。',
      featured: true,
    },
    {
      label: 'Podcast「経営者の志」#1117 石井嵩大さん',
      url: 'https://spirit.koelab.net/1117/',
      kind: '出演',
      date: '2026.09',
      note: '起業の原点となった家族の話と、PASに込めた「人脈そのものをつなぐ」という考えを語っている。',
      featured: true,
    },
    {
      label: '経営者向けサービス「PAS」',
      url: 'https://www.cc-official.jp/PAS/',
      kind: '事業',
      date: '2026.08',
      note: '日程調整・紹介文・商談準備などをLINE中心で簡略化し、人脈を交換できる経営者向けサービス。料金・条件は公式サイトを参照。',
      featured: true,
    },
    {
      label: '開発事例：営業案件管理Webアプリ',
      url: 'https://www.cc-official.jp/works/sales-management-app/',
      kind: '事例',
      note: '顧客情報・商談履歴・案件進捗・見込み売上・次回アクションを一元化。同社公開事例では、営業管理作業が月約40時間から約15時間に。',
      featured: true,
    },
    {
      label: '株式会社C.C 公式サイト',
      url: 'https://www.cc-official.jp/',
      kind: '公式',
      note: 'CAIO・AI受託開発・企業のAI導入支援。',
      owner: 'company',
    },
    {
      label: 'サービス一覧',
      url: 'https://www.cc-official.jp/service/',
      kind: '公式',
      note: 'ニブンノイチ・CAIO顧問・AI受託開発・AI導入支援／DXコンサルティング。',
    },
    {
      label: '開発事例：AIナレッジ検索',
      url: 'https://www.cc-official.jp/works/ai-knowledge-system/',
      kind: '事例',
      note: 'PDF・Word・スプレッドシートなどの社内資料を横断検索。同社公開事例では、情報検索が平均約15分から約2分に。',
    },
    {
      label: '開発実績一覧（WORKS）',
      url: 'https://www.cc-official.jp/works/',
      kind: '事例',
      note: '営業案件管理・問い合わせ管理・申請ワークフロー・AIナレッジ検索・経営KPIダッシュボード・予約／顧客管理など。',
    },
    {
      label: 'PAS 提供開始のお知らせ（PR TIMES）',
      url: 'https://prtimes.jp/main/html/rd/p/000000002.000188300.html',
      kind: 'リリース',
      date: '2026.08',
      note: '株式会社C.Cによるプレスリリース。',
    },
    {
      label: '「経営者の志」同エピソード（LISTEN）',
      url: 'https://listen.style/p/spirit/jqkb2rwq',
      kind: '出演',
      note: '文字起こし付きで読めるPodcastページ。',
    },
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/%E5%B5%A9%E5%A4%A7-%E7%9F%B3%E4%BA%95-9390b2313/',
      kind: '発信',
      note: '経歴と、AI導入・ニブンノイチについての発信。',
      owner: 'person',
    },
    {
      label: 'X @IshiiShuta',
      url: 'https://x.com/IshiiShuta',
      kind: '発信',
      owner: 'person',
    },
  ],
  mediaTitle: '実績・メディア',
  mediaLabel: 'Works & Media',
  location: '東京',
  updatedAt: '2026-10-01',
  listSummary: 'AIとシステムで、経営者に余白をつくる',
  businessTags: ['AI導入支援', 'AI受託開発', '経営者向けSaaS'],
  keywordTags: ['余白の設計', '双子で共同経営', 'CAIO顧問'],
  // C.Cの「余白」を、象牙色の紙と墨の文字で。写真の赤を差し色に
  theme: { primary: '#B3121C', accent: '#1F2C4D', bg: '#F5F2EC', text: '#17181C' },
  active: true,
};

/**
 * 宮本 康太（株式会社ZETTAICHI）。
 * 掲載内容は、Ownerから受け取った調査メモ（調査基準日 2026-10-02、80件以上をスクリーニング）のうち、
 * 公式サイト・本人LinkedIn／Wantedly・外部インタビュー・イベント実績で確認できる事実のみ。
 * 調査メモの「書かない方がいい」に従い、次は載せない／書き方を変えている:
 *  - ZETTAICHIの従業員数・売上・資本金（企業スペック。ADDING_A_PROFILE.md の方針）→ 載せない
 *  - n1a の会員数（確認不能）→ 載せない
 *  - 10万人は「保有」ではなく「紹介可能」（本人表現）
 *  - Biz Summit! の1,000名は「開催済み」ではなく、同社が掲げるイベントの形 → 人数は書かない
 *  - AddBox の実績（900件超・継続率90%など）は別法人のため ZETTAICHI の実績にしない
 *  - 生年月日・年齢は個人情報で、年齢は毎年変わるため載せない
 * X・Instagram は本人と確実に特定できる公開アカウントが無いため載せていない。
 */
const miyamotoProfile: TalkProfile = {
  id: 'miyamoto',
  slug: 'miyamoto',
  name: '宮本 康太',
  company: '株式会社ZETTAICHI',
  title: '代表取締役',
  tagline: '見えない波長を、つなぐ。',
  photo: {
    src: '/profile-miyamoto.webp',
    alt: '宮本 康太',
    caption: 'TOKYO / JAPAN · 2026',
    tint: '#3A1A78',
  },
  bio:
    '博報堂DYグループの読売広告社、サイバーエージェントでの広告運用、AddBox取締役COOを経て、' +
    '2026年7月に株式会社ZETTAICHIを設立。決裁者と直接つなぐ営業支援、人柄で経営者をつなぐ「n1a」、' +
    '遊びを通じて出会う経営者交流会「ASOBMENT」などで、経営者同士の出会いを設計しています。',
  story: {
    paragraphs: [
      '青山学院大学法学部を卒業後、新卒で博報堂DYグループの読売広告社に入社。営業として、国内大手デベロッパーの支援、人気ゲームIPの広告プランニング、スポーツメディアでのアスリート取材、公営競技領域のテレビCM制作などに携わりました（本人LinkedInより）。',
      'その後、フリーランスとしてサイバーエージェントに参画。月間1億円規模の広告運用で、クライアント対応からレポーティングまでを一気通貫で担当しました。',
      '2024年6月からの約2年間は、株式会社AddBoxの取締役COOとして、営業代行・BtoBマッチング、フリーランス人材紹介、経営者交流会「Next Meet Up」などの事業を統括。AI開発を軸にした社内DXにも取り組みました。',
      '広告、営業、人材、コミュニティ運営と立場は変わっても、仕事の中心にはいつも「人と人、企業と企業をつなぐこと」がありました。2026年7月に株式会社ZETTAICHIを立ち上げ、いまは会社の規模や肩書きだけでなく、人柄や価値観、共通の体験まで含めた経営者同士の出会いを設計しています。',
    ],
    timeline: [
      { org: '青山学院大学 法学部', role: '卒業' },
      {
        org: '株式会社読売広告社（博報堂DYグループ）',
        role: '営業',
        note: '本人LinkedInでは、大手デベロッパー4社の支援、ゲームIP 2案件の広告プランニング、アスリート50名超の取材、テレビCM10本の制作',
      },
      { org: '株式会社サイバーエージェント', role: 'フリーランスとして参画', note: '月間1億円規模の広告運用' },
      { org: '株式会社AddBox', role: '取締役COO（2024年6月〜2026年6月）', note: '全事業の統括、AI開発を軸にした社内DX' },
      { org: '株式会社ZETTAICHI', role: '代表取締役（2026年7月設立）', note: '営業支援・n1a・ASOBMENT・Biz Summit!' },
    ],
  },
  businessTitle: '現在の事業',
  business: [
    'ZETTAICHIの事業は、営業支援（SALES）、経営者マッチング「n1a」、経営者コミュニティ・イベント「CxO MEET UP」の3つ。経営者同士の出会いを、関係の深さと人数に合わせて複数の入口で設計しています。1対1でつなぐ「n1a」、15名ほどの少人数で遊びを通じて出会う「ASOBMENT」、スポンサー企業を迎えるカンファレンス形式の「Biz Summit!」、そして決裁者と直接つなぐ成果報酬型の営業支援です。',
    '営業支援では、担当者ではなく経営者・決裁者へ直接アプローチします。初期費用・月額利用料はなく、商談単位の成果報酬型。リードを大量に渡すのではなく、決裁者と直接つなぎ、受注までの距離を短くすることを狙っています。',
    '「n1a」は、会社の規模・売上・業界・役職といったスペックだけでなく、経営者個人の価値観・人柄・相性を軸に経営者同士をつなぐサービスです。同社はこれを「見えない波長を分析し、つなぐ」と表現しています。',
    '「ASOBMENT」のコンセプトは「アソビの先でビジネスを」。名刺と会社概要から入るのではなく、人狼やボードゲームなどを一緒に楽しむなかで、思考力・判断力・人柄が自然に見え、その先でビジネスにつながる経営者交流会です。役員以上を対象に15名ほどに絞って開催しており、2026年9月25日に第6回を開催、第7回は10月27日に予定しています（ティーズエージェンシーホールディングス・ROCKTOONとの3社共催）。',
    '本人公表では、これまでに営業代行で1,500企業のマッチングに携わり、10万人を超えるフリーランス人材を紹介できるネットワークを持っています。',
  ],
  about: {
    title: '株式会社ZETTAICHIについて',
    paragraphs: [
      '経営者・決裁者どうしの出会いを、営業支援・1対1のマッチング・経営者コミュニティとイベントという形でつくる会社です。2026年7月に、宮本が立ち上げました。',
    ],
    facts: [
      { term: '代表', value: '宮本 康太（代表取締役）' },
      { term: '設立', value: '2026年7月' },
      { term: '所在地', value: '東京都狛江市' },
      { term: '事業', value: '営業支援（SALES）／n1a／CxO MEET UP（ASOBMENT・Biz Summit!）' },
      { term: '資格', value: '宮本は宅地建物取引士の資格も持つ' },
    ],
  },
  servicesTitle: '事業・サービス',
  services: [
    { name: '営業支援', description: '経営者・決裁者へ直接アプローチする、商談単位の成果報酬型（初期費用・月額なし）' },
    { name: 'n1a', description: '価値観・人柄・相性を軸に、経営者同士を1対1でつなぐマッチング' },
    { name: 'ASOBMENT', description: '人狼やボードゲームを通じて出会う、15名ほどの少人数の経営者交流会' },
    { name: 'Biz Summit!', description: 'スポンサー企業を迎える、カンファレンス形式の経営者コミュニティ' },
  ],
  valuesTitle: '大切にしている考え方',
  values: [
    {
      title: 'アソビの先で、ビジネスを',
      body: 'ASOBMENTのコンセプト。肩書きより先に、人柄や判断の仕方が見える出会いを。',
    },
    {
      title: '見えない波長を、つなぐ',
      body: 'n1aの考え方。会社のスペックではなく、価値観と人柄の相性で経営者同士をつなぐ。',
    },
    {
      title: '受注までの距離を、短くする',
      body: '営業支援の考え方。リードの数ではなく、決裁者と直接つながる商談を届ける。',
    },
    {
      title: '“最適なつながり”をデザインする',
      body: 'AddBox時代のインタビューの言葉。営業でも採用でもなく、人と企業の最適な関係をつくる。',
    },
  ],
  wantToMeet: {
    lead: 'ZETTAICHIの事業内容から、Batonが特にご縁をつなぎたいと考えている方です。',
    items: [
      '決裁者と直接つながる営業の手段を探している企業',
      '規模や肩書きではなく、人柄で付き合える経営者仲間を探している方',
      '経営者向けイベント・コミュニティへの協賛や共催を考えている企業',
      'フリーランス人材の活用を考えている企業',
    ],
  },
  media: [
    {
      label: 'ASOBMENT（アソビの先でビジネスを）',
      url: 'https://asobment.studio.site/',
      kind: '主催',
      date: '2026.09',
      note: '人狼やボードゲームを通じて出会う、役員以上の経営者向け交流会。2026年9月25日に第6回を開催、第7回は10月27日に予定。',
      featured: true,
    },
    {
      label: 'n1a（人柄でつなぐ経営者マッチング）',
      url: 'https://n1a-cxo.com/',
      kind: '事業',
      note: 'スペックではなく、経営者個人の価値観・人柄・相性を軸にした1対1のマッチング。',
      featured: true,
    },
    {
      label: '営業でも採用でもない。“最適なつながり”をデザインする会社',
      url: 'https://media.tunakare.jp/jinji-no-koe/1387861076/',
      kind: '掲載',
      date: '2026.01.28',
      note: 'ツナカレメディアによるロングインタビュー（AddBox取締役COO当時）。創業背景、営業代行・人材・交流会、経営者プラットフォーム構想を語っている。',
      featured: true,
    },
    {
      label: 'ホンマルラジオ「サクトーーク！！」第141回',
      url: 'https://stage.honmaru-radio.com/sakuma0141/',
      kind: '出演',
      date: '2026.05.10',
      note: 'AddBox取締役としてゲスト出演。',
      featured: true,
    },
    {
      label: '株式会社ZETTAICHI 公式サイト',
      url: 'https://zettaichi.co.jp/',
      kind: '公式',
      note: '営業支援（SALES）・n1a・CxO MEET UP。',
      owner: 'company',
    },
    {
      label: 'Biz Summit!',
      url: 'https://biz-summit.studio.site/',
      kind: '事業',
      note: 'スポンサー企業を迎える、カンファレンス形式の経営者コミュニティ。',
    },
    {
      label: 'LinkedIn',
      url: 'https://jp.linkedin.com/in/%E5%BA%B7%E5%A4%AA-%E5%AE%AE%E6%9C%AC-3a5826327',
      kind: '発信',
      note: '経歴と、経営者交流会・事業についての発信。',
      owner: 'person',
    },
    {
      label: 'Wantedly',
      url: 'https://www.wantedly.com/id/kota_miyamoto3838',
      kind: '発信',
      note: '読売広告社からサイバーエージェント、独立までのキャリア。',
      owner: 'person',
    },
  ],
  mediaTitle: '実績・メディア',
  mediaLabel: 'Works & Media',
  location: '東京',
  updatedAt: '2026-10-02',
  listSummary: '人柄でつなぐ、経営者の出会いを設計',
  businessTags: ['営業支援', 'マッチング', '交流会運営'],
  keywordTags: ['元広告代理店', '人柄でつなぐ', 'ゲーム交流会'],
  // 濃いダーク、深淵のような深紫。モノクロの写真が浮かび上がるように
  theme: { primary: '#7A3FE0', accent: '#B892FF', bg: '#0A0612', text: '#ECE7F6' },
  active: true,
};

export const profiles: TalkProfile[] = [kabeyaProfile, matsuuraProfile, ishiiProfile, miyamotoProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
