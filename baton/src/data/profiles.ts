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
    '大阪・梅田の合同会社Music Japan代表。海外に向けてJazzやBGMをつくって配信し、' +
    'Podcast「SECOND TAKE」では経営者の決断と苦悩を記事に残し、話を聞いた人どうしを招待制の「Baton -バトン-」でつないでいます。',
  // 経歴の年表は、本人から公開してよい内容をもらってから足す（いまは事業と考え方だけ）
  story: {
    title: '音と、言葉と、人のあいだで',
    paragraphs: [
      '大阪・梅田を拠点に、音楽、メディア、紹介という三つの仕事をしています。並べるとばらばらに見えますが、やっていることは似ています。',
      '音楽では、海外のリスナーに向けてJazzやBGMをつくる。SECOND TAKEでは、経営者が積み上げてきた決断と遠回りを、その人自身の言葉のまま記事にして残す。',
      'そして話を聞いた人のなかから、この二人は会ったほうがいいと思える相手どうしを引き合わせる。それがBatonです。名簿から選ぶのではなく、実際に会って話した人だけを、自分の判断でつなぎます。',
      '受け取って、形にして、次の人へ渡す。タグラインの「学び、紡ぎ、繋いでいく。」は、その順番をそのまま言葉にしたものです。',
    ],
  },
  business: [
    '事業は三つ。音楽制作・配信、メディア運営、法人紹介です。',
    '音楽では、海外のリスナーに向けたJazzやBGMを制作し、配信しています。',
    'メディアの中心はPodcast「SECOND TAKE（セカンドテイク）」。経営者に、何を決め、どこで迷い、どう越えてきたかを聞き、本人の言葉のまま記事にして残しています。',
    '法人紹介は、招待制の「Baton -バトン-」。運営が実際に会って話した経営者・事業者のなかから、双方に可能性があると判断した相手どうしを紹介します。紹介の数を増やすより、長く続く関係をひとつずつつくるためのサービスです。',
  ],
  about: {
    title: '合同会社Music Japanについて',
    paragraphs: ['大阪・梅田にある、音楽とメディアと紹介の会社です。Batonの運営元でもあります。'],
    facts: [
      { term: '代表', value: '壁谷 友生（代表社員）' },
      { term: '所在地', value: '大阪市北区梅田' },
      { term: '事業', value: '音楽制作・配信／メディア運営（SECOND TAKE）／法人紹介（Baton -バトン-）' },
      { term: '公式サイト', value: 'music-japan.com' },
    ],
  },
  services: [
    { name: 'Music Japan', description: '海外向けのJazz・BGMの制作と配信' },
    { name: 'SECOND TAKE', description: '経営者の決断と苦悩を聞くPodcast' },
    { name: 'Interview', description: '経営者の人生と事業を、記事で残す' },
    { name: 'Baton -バトン-', description: '会って話した人どうしを紹介する、招待制のサービス' },
  ],
  valuesTitle: '学び、紡ぎ、繋いでいく。',
  values: [
    {
      title: '学ぶ',
      body: '経営者の話を、先入観を持たずに最後まで聞く。SECOND TAKEの取材も、Batonの面談も、ここから始まります。',
    },
    {
      title: '紡ぐ',
      body: '聞いた話は、その人自身の言葉で残す。音も言葉も、つくったものが誰かの手元に届いて、はじめて意味を持つ。',
    },
    {
      title: '繋ぐ',
      body: '会って話した人だけを、双方に意味があると思えたときだけ紹介する。数より、長く続く関係を。',
    },
  ],
  wantToMeet: {
    lead: '壁谷がいま会いたい方です。',
    items: [
      'SECOND TAKEで、自分の決断や遠回りを言葉にして残したい経営者',
      '紹介でしか出会えない相手と、時間をかけて関係をつくりたい方',
      'Batonに掲載して、紹介の輪に加わりたい経営者・事業者',
      '音楽やメディアの分野で、一緒に何かをつくりたい方',
    ],
  },
  // 松浦プロフィールと同じ「大きなカード＋一覧」の見せ方。説明文は本文・サービス欄にある事実だけ
  media: [
    {
      label: 'SECOND TAKE（セカンドテイク）',
      url: 'https://secondtake.music-japan.com/',
      image: '/media-secondtake-logo.webp',
      kind: '運営',
      note: '経営者が何を決め、どこで迷い、どう越えてきたか。本人の言葉のまま残すインタビュー記事メディア。',
      featured: true,
    },
    {
      label: '合同会社Music Japan 公式サイト',
      url: 'https://music-japan.com/',
      image: '/media-musicjapan-hp.png',
      kind: '公式',
      note: '海外向けのJazz・BGMの制作と配信、メディア運営、法人紹介。',
      featured: true,
    },
    {
      label: 'Baton -バトン-',
      url: 'https://baton.music-japan.com/profile/',
      image: '/og/baton.jpg',
      kind: '運営',
      note: '実際に会って話した経営者・事業者のなかから、双方に可能性があると判断した相手どうしを紹介する、招待制のサービス。',
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
  updatedAt: '2026-10-02',
  listSummary: '招待制紹介サービス「Baton」の運営',
  businessTags: ['音楽制作', 'メディア運営', '法人紹介'],
  keywordTags: ['洋楽/Jazz', '経営者対談', '完全招待制'],
  theme: { primary: '#C8102E', accent: '#D9A441', bg: '#0A0A0C', text: '#EDEAE4' },
  heavyWebGL: true,
  active: true,
};

/**
 * 松浦 淳（株式会社Central AX）。
 * 掲載内容は、Ownerが取りまとめた調査メモ（2026-09-30時点）と、
 * 設立プレスリリース（PR TIMES 2026-08-31）・公式サイトの会社概要／沿革で確認できる事実のみ。
 * 年齢は打ち合わせで聞いた話で、公開情報ではないため載せない。
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
    '名古屋大学に在学しながら、名古屋で株式会社Central AXを設立。' +
    'AI研修から受託開発・業務改善、AI検索対策（LLMO）まで、AIを入れて終わりにせず、' +
    '社員が実際に使って仕事が変わるところまで一緒に進めています。',
  // 経歴・会社の事実は、設立プレスリリース（PR TIMES 2026-08-31）と公式サイトの会社概要・沿革から
  story: {
    paragraphs: [
      '名古屋大学に在学しながら、2026年5月に株式会社Central AXを設立しました。きっかけは、東京へ行くたびに感じていた温度差です。東京ではAIを当たり前に使う会社が増え続けているのに、東海ではまだそうなっていない。',
      '設立時のプレスリリースに、松浦はこう書いています。「東海をAIで盛り上げたい」。東京で見てきたあの当たり前を、東海に持ち帰る。それが会社をつくった理由です。',
      '社名のCentralは、名古屋・中部を拠点に日本のAXの中心へ、という意味。AXはAI Transformation、AIで業務と事業を変えることです。やることを、そのまま社名にしています。',
      '自分でも手を動かします。Claude Codeはリリース日から使っていて、Xやnoteでは、AIで仕事をどう変えるかを書き続けています。',
    ],
    timeline: [
      { org: '名古屋大学', role: '在学中に起業' },
      { org: '株式会社Central AX', role: '設立・代表取締役CEO（2026年5月）', note: 'COOの近藤 活と2人代表' },
      { org: 'LLMO対策（AI検索最適化）', role: '提供開始（2026年7月）' },
      { org: '会計士向けClaude Code実演デモ', role: '登壇（2026年8月）', note: '公認会計士・税理士の畠山謙人氏と共同開催' },
      { org: '四日市商工会議所 経営者向けAIセミナー', role: '登壇予定（2026年10月）' },
    ],
  },
  businessTitle: '現在の事業',
  business: [
    'Central AXの仕事は三つ。AI研修・人材育成、AI受託開発・業務改善、そしてLLMO対策（ChatGPTやGeminiの回答に自社が出てくるようにする対策）です。同社によれば、設立から2026年8月末までに20社を支援しています。',
    '出発点は、AIを入れたのに現場の仕事が変わらない、という悩みです。ツールから選ぶのではなく、その会社の業務を見て「何を楽にするか」を先に決める。研修は自社の実際の業務を題材にし、開発は小さく試してから広げます。',
    '本社は名古屋。愛知・岐阜・三重・静岡を中心に、製造・建設・物流・観光の現場へ足を運んでいます。オンラインだけでは業務の流れが見えない、というのが理由です。対面での支援は東海に限っていません。',
    '設立直後から人前にもよく立っています。公認会計士向けのClaude Code実演デモ、Microsoft 365 Copilotのセミナー、製造業向け展示会でのAIセキュリティ講演。2026年10月5日には、四日市商工会議所で経営者向けのAIセミナーを予定しています。',
  ],
  about: {
    title: '株式会社Central AXについて',
    paragraphs: [
      '名古屋・名駅にある、AI実装の会社です。掲げているのは「日本に、AI実装を。」。製造、建設、物流、観光と、どの現場にもAIで楽にできる仕事がまだ眠っている。それを一社ずつ、現場で使われる形にしています。',
    ],
    facts: [
      { term: '代表', value: '松浦 淳（代表取締役CEO）／近藤 活（代表取締役COO）' },
      { term: '設立', value: '2026年5月29日' },
      { term: '所在地', value: '愛知県名古屋市中村区名駅' },
      { term: '事業', value: 'AI研修・人材育成／AI受託開発・業務改善／LLMO対策' },
      { term: '対応エリア', value: '全国（対面対応可）' },
    ],
  },
  services: [
    { name: '研修・人材育成', description: '自社の実際の業務を題材に、社員が使える状態まで' },
    { name: '受託開発・業務改善', description: '業務を整理して、小さく試してから広げる' },
    { name: 'LLMO／AI検索', description: 'ChatGPTやGeminiの回答に、自社が出てくる状態をつくる' },
  ],
  valuesTitle: '大切にしている考え方',
  values: [
    {
      title: '東海を、AIで盛り上げる',
      body: '創業の理由そのもの。東京で当たり前になりつつあるAIの使い方を、東海に持ち帰る。',
    },
    {
      title: '現場に行って、見る',
      body: 'オンラインだけでは業務の流れは見えない。AIを入れる場所は、現場で決める。',
    },
    {
      title: 'ツールより先に、業務',
      body: 'どのAIを使うかより、何を楽にするか。決める順番を間違えない。',
    },
    {
      title: '日本に、AI実装を。',
      body: 'Central AXが掲げる言葉。入れて終わりではなく、現場で使われるところまで。',
    },
  ],
  wantToMeet: {
    lead: 'Batonから見て、松浦さんと話すと面白いと思う方です。',
    items: [
      'AIを入れたいけれど、何から手をつければいいか分からない経営者',
      'AIを導入したのに、現場の仕事が変わっていない企業',
      'ChatGPTやGeminiで自社がどう紹介されているか気になっている企業',
      '東海で、製造・建設・物流・観光の現場を持つ会社',
    ],
  },
  media: [
    {
      label: 'AIで変わる会計士実務 ― Claude Code実演デモ',
      url: 'https://luma.com/ud5yi7ed',
      kind: '登壇',
      date: '2026.08.10',
      note: '公認会計士・税理士の畠山謙人氏と共同開催。監査調書や財務DD、企業分析をClaude Codeで処理する様子を実演し、120名が申し込んだ。',
      featured: true,
    },
    {
      label: '製造業向け展示会セミナー｜生成AIの機密情報・シャドーAI対策',
      url: 'https://biz.q-pass.jp/f/13216/inw_autumn_seminar26/seminar_register?fid=E1mNKjK3Zn03kn05&tag=16009',
      kind: '登壇',
      date: '2026.09',
      note: 'ネプコン ジャパンなどの関連セミナー。図面や仕様書、原価表をAIに入れるときの線引きを解説。',
      featured: true,
    },
    {
      label: 'Central AX 設立プレスリリース',
      url: 'https://prtimes.jp/main/html/rd/p/000000003.000188813.html',
      kind: '掲載',
      note: 'PR TIMES。設立の背景と創業コメント、東海でAI実装を進める理由。',
      featured: true,
    },
    {
      label: 'Microsoft 365 Copilot活用ユースケース徹底攻略20選',
      url: 'https://luma.com/aideeplive_260914',
      kind: '登壇',
      date: '2026.09.14',
      note: 'Outlook、Teams、Word、Excel、PowerPoint。すでに使っている環境にAIを入れる方法を解説。',
      featured: true,
    },
    {
      label: '公式サイト',
      url: 'https://central-ax.co.jp/',
      kind: '公式',
      note: '株式会社Central AX。AI研修・受託開発・LLMO対策のサービス詳細。',
    },
    {
      label: 'ATIS × Central AX 経営者向けAI活用セミナー（四日市）',
      url: 'https://prtimes.jp/main/html/rd/p/000000005.000188813.html',
      kind: '掲載',
      date: '2026.10.05 開催予定',
      note: 'PR TIMES。四日市商工会議所で開催。松浦のコメントも載っている。',
    },
    {
      label: 'テレ東プラス',
      url: 'https://www.tv-tokyo.co.jp/plus/external-pr/entry/255701.html',
      kind: '掲載',
      note: '四日市セミナーのリリースの転載。',
    },
    {
      label: 'Central AX 公式note',
      url: 'https://note.com/central_ax',
      kind: '発信',
      owner: 'company',
      note: 'AI導入、業務効率化、Claude Code、現場への定着について書き続けている。',
    },
    {
      label: 'X @JunP1ayer',
      url: 'https://x.com/JunP1ayer',
      kind: '発信',
      owner: 'person',
      note: 'AIでの業務改善、Claude Code、企業へのAI導入について本人が発信。',
    },
  ],
  mediaFirst: true,
  servicesTitle: '事業領域',
  location: '名古屋',
  updatedAt: '2026-10-02',
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
    '経営者コミュニティ、人材紹介、SES営業と、人と人をつなぐ仕事を経て、双子の弟・石井皓晟と株式会社C.Cを経営。' +
    '自分が業務に追われた経験から、AIとシステムで経営者に「余白」をつくっています。',
  story: {
    paragraphs: [
      '転機は大学3年のとき。母親の病気を知り、普通に就職して少しずつ貯金していたのでは親孝行に間に合わないかもしれない、と考えました。Podcast「経営者の志」で本人が語っている話です。そこから起業を目標にBtoB営業の世界に入り、インターン、事業責任者、会社づくりと経験を重ねていきます。',
      '経営者コミュニティや人材紹介など、人と会社をつなぐ仕事をするうちに、毎日はどんどん忙しくなりました。気づけば、いちばんの目的だった家族との時間からは、むしろ遠ざかっていた。',
      'そこで双子の弟・皓晟が、人材紹介の業務システムをつくります。履歴書、推薦文、企業選び。手作業だった仕事が仕組みに置き換わり、時間が戻ってきた。この経験が、C.Cの「余白をつくる」という考えの出発点です。',
      'いろいろな事業に手を出していた時期を、本人は未来共創のインタビューで「キャリアロンダリングになりかけた」と振り返っています。大学を出る前に「何をしたいのか」から逆算して事業を整理し、ひとつに絞りました。',
    ],
    image: { src: '/profile-ishii-2.webp', alt: '石井 嵩大' },
    timeline: [
      { org: '株式会社ボードルア', role: '事業統括本部', note: 'SES領域の営業・採用の立ち上げ' },
      {
        org: '株式会社ポロック',
        role: '経営者コミュニティ「Bowers」事業部長',
        note: '本人によれば、約2,100名規模から3,500名規模へ',
      },
      { org: '株式会社バジェットアドテクノロジーズ', role: 'CSO', note: 'SNSマーケティング、BtoB営業戦略' },
      {
        org: '株式会社FUBAR',
        role: '人材紹介事業「咲縁」の立ち上げ・運営',
        note: '本人によれば、月100名以上を集客',
      },
      { org: '株式会社C.C', role: '代表取締役社長（2025年設立）', note: '営業・マーケティング・事業づくり' },
    ],
  },
  businessTitle: '現在の事業',
  business: [
    '石井は代表取締役社長として、営業・マーケティング・事業づくりを担当しています。技術は、双子の弟でフルスタックエンジニアの石井皓晟が、バックオフィスと一緒に受け持つ。事業をつくる兄と、仕組みをつくる弟の共同経営です。',
    'C.Cは自らを「余白を設計する会社」と呼び、AI導入支援・DXコンサルティング、CAIO顧問、AIシステムの受託開発、経営者向けサービス「PAS」を手がけています。進め方は、棚卸、余白設計、仕組化、伴走の順。繰り返しの作業や転記、確認、集計を洗い出し、既存のSaaSやAI、自動化、独自開発を組み合わせます。納品して終わりではなく、現場で使われ続けて、属人化がなくなるところまでが仕事です。',
    '2026年8月に正式提供を始めた「PAS」は、日程調整、紹介文、お繋ぎ文、商談準備、紹介履歴といった繰り返しの仕事をLINEで簡単にしながら、人脈そのものを交換できる経営者向けのサービスです。同社によれば、直接会った500社以上の経営者のデータベースから、相性のいい相手を紹介する仕組みもあります。',
    '発想のもとにあるのは、既存の経営者マッチングへの違和感です。営業したい人どうしが出会うと、お互いが相手の営業先になってしまう。だからPASでは、AさんとBさんを直接つなぐのではなく、Bさんが持っている人脈とAさんをつなぎます。Podcastで本人が語っていた設計です。',
  ],
  about: {
    title: '株式会社C.Cについて',
    paragraphs: [
      '社長が業務に追われ、本当に向き合うべきことに時間を使えない。その状態を、AIとシステムで終わらせるためにつくられた会社です。根っこには「社長は、本来忙しくあるべきではない」という考えがあります。',
    ],
    facts: [
      { term: 'MISSION', value: '経営に余白を。人生に本質を。' },
      { term: 'VISION', value: '時間に追われる状態を終わらせる。すべての人が、本質に時間を使える社会へ' },
      {
        term: 'VALUE',
        value: 'PURPOSE FIRST／VALUE OVER BUSY／CREATE TIME／COMMIT TO CONTINUITY／SYSTEMIZE RESULTS',
      },
      { term: '経営体制', value: '石井嵩大（営業・マーケティング・事業づくり）／石井皓晟（バックオフィス・エンジニアリング）' },
      { term: '設立', value: '2025年' },
      { term: '所在地', value: '東京都港区北青山' },
    ],
  },
  servicesTitle: 'サービス・強み',
  services: [
    { name: 'ニブンノイチ', description: '価格・納期・作業時間を、これまでのおよそ半分にするAI／システム導入支援' },
    { name: 'CAIO顧問', description: '社外の最高AI責任者のような立場で、何をAI化するかの戦略から実装まで' },
    { name: 'AI受託開発', description: 'SaaS・AI・自動化・独自開発を組み合わせて、現場で使われ続ける仕組みに' },
    { name: 'PAS', description: '日程調整・紹介文・商談準備をLINEで簡単にし、人脈を交換できる経営者向けサービス' },
  ],
  valuesTitle: '大切にしている考え方',
  values: [
    { title: '愛のない行動は、しない', body: 'C.Cの公式サイトに、石井が自分の行動基準として掲げている言葉。' },
    {
      title: '社長は、本来忙しくあるべきではない',
      body: '自分が業務に追われた経験からたどり着いた、C.Cの出発点。',
    },
    {
      title: 'できないことを、はっきりさせる',
      body: '経験で年上にかなわないところは教えてもらう。そのかわり、AIとシステムの領域では「任せてください」と言い切る。インタビューで語っていた考え方です。',
    },
    {
      title: '「何をしたいのか」から逆算する',
      body: '手を広げすぎた時期を経て、大学卒業前に事業をひとつに絞ったときの判断軸。',
    },
  ],
  wantToMeet: {
    lead: 'Batonから見て、石井さんと話すと面白いと思う方です。',
    items: [
      'AIやDXを進めたいけれど、何から始めるか決まっていない経営者',
      '営業やバックオフィスが、特定の人に頼りきりになっている企業',
      'SFA／CRMや業務システムの導入・見直しを考えている企業',
      '経営者紹介やコミュニティなど、人脈を軸に事業をしている方',
    ],
  },
  media: [
    {
      label: '株式会社C.C石井嵩大が「社長の100時間を創る」理由',
      url: 'https://miraikyoso.jp/interview/ishiishuta/',
      kind: '掲載',
      date: '2026',
      note: '未来共創のロングインタビュー。事業をひとつに絞った経緯、「できないことをはっきりさせる」という考え方、これからの会社像。',
      featured: true,
    },
    {
      label: 'Podcast「経営者の志」#1117 石井嵩大さん',
      url: 'https://spirit.koelab.net/1117/',
      kind: '出演',
      date: '2026.09',
      note: '起業の原点になった家族の話と、PASに込めた「人脈そのものをつなぐ」という考え。',
      featured: true,
    },
    {
      label: '経営者向けサービス「PAS」',
      url: 'https://www.cc-official.jp/PAS/',
      kind: '事業',
      date: '2026.08',
      note: '日程調整・紹介文・商談準備などをLINEで簡単にし、人脈を交換できる経営者向けサービス。料金や条件は公式サイトで。',
      featured: true,
    },
    {
      label: '開発事例：営業案件管理Webアプリ',
      url: 'https://www.cc-official.jp/works/sales-management-app/',
      kind: '事例',
      note: '顧客情報、商談履歴、案件の進み具合、見込み売上、次の一手をひとつに。同社の公開事例では、営業管理の作業が月約40時間から約15時間に。',
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
      note: '社内のPDF・Word・スプレッドシートをまとめて検索。同社の公開事例では、探す時間が平均約15分から約2分に。',
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
      note: '経歴と、AI導入やニブンノイチについての発信。',
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
  updatedAt: '2026-10-02',
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
    tint: '#141114',
  },
  bio:
    '読売広告社の営業、サイバーエージェントでの広告運用、AddBoxの取締役COOを経て、2026年7月に株式会社ZETTAICHIを設立。' +
    '決裁者に直接つなぐ営業支援、人柄で経営者同士を引き合わせる「n1a」、人狼やボードゲームで出会う交流会「ASOBMENT」を手がけています。',
  story: {
    paragraphs: [
      '青山学院大学法学部を出て、新卒で博報堂DYグループの読売広告社へ。営業として、不動産デベロッパーの広告、ゲームIPのプロモーション、スポーツメディアでのアスリート取材、テレビCMの制作と、ジャンルを問わず現場を回りました。',
      'その後は独立し、フリーランスとしてサイバーエージェントの広告運用に参加。クライアントとのやり取りからレポートまでを、ひとりで受け持っていました。',
      '2024年6月、株式会社AddBoxの取締役COOに就任。営業代行とBtoBのマッチング、フリーランス人材の紹介、経営者交流会「Next Meet Up」を見ながら、社内のDXにも手をつけました。',
      '広告、営業、人材、コミュニティ。肩書きは何度も変わりましたが、やってきたことはずっと「人と会社をつなぐこと」でした。2026年7月にZETTAICHIを設立し、いまは規模や業界より先に、人柄や価値観が合うかどうかで経営者同士を引き合わせています。',
    ],
    timeline: [
      { org: '青山学院大学 法学部', role: '卒業' },
      { org: '株式会社読売広告社（博報堂DYグループ）', role: '営業', note: '不動産・ゲーム・スポーツ・テレビCM' },
      { org: '株式会社サイバーエージェント', role: 'フリーランスとして参画', note: '広告運用' },
      { org: '株式会社AddBox', role: '取締役COO（2024年6月〜2026年6月）', note: '営業代行・人材紹介・経営者交流会を統括' },
      { org: '株式会社ZETTAICHI', role: '代表取締役（2026年7月設立）', note: '営業支援／n1a／ASOBMENT／Biz Summit!' },
    ],
  },
  businessTitle: '現在の事業',
  business: [
    'ZETTAICHIの仕事を一言でいえば、経営者と経営者を会わせること。入口は4つあります。決裁者に直接つなぐ営業支援、1対1で引き合わせる「n1a」、15人ほどでゲームを囲む「ASOBMENT」、スポンサー企業も加わるカンファレンス「Biz Summit!」。公式サイトでは、営業支援（SALES）・n1a・CxO MEET UPの3事業として紹介されています。',
    '営業支援は、担当者を飛ばして決裁者に直接アプローチします。初期費用も月額もなく、料金は商談1件ごとの成果報酬。リストを大量に渡すより、話が早い相手と確実に会えることを優先しています。',
    '「n1a」が見るのは、売上や業界、役職ではありません。その人が何を大事にしていて、誰となら気持ちよく仕事ができるか。ZETTAICHIはそれを「見えない波長」と呼んでいます。',
    '「ASOBMENT」は、名刺交換から始まらない交流会です。人狼やボードゲームを一緒にやると、考え方の癖も、決めるときの速さも隠しようがなく出てくる。参加は役員以上、15人ほどに絞っています。2026年9月25日に第6回を開き、第7回は10月27日。ティーズエージェンシーホールディングス、ROCKTOONとの共催です。',
    '本人によれば、営業代行で携わったマッチングは1,500社。10万人を超えるフリーランス人材を紹介できるネットワークもあります。',
  ],
  about: {
    title: '株式会社ZETTAICHIについて',
    paragraphs: ['経営者・決裁者どうしの出会いをつくる会社です。2026年7月、宮本が設立しました。'],
    facts: [
      { term: '代表', value: '宮本 康太（代表取締役）' },
      { term: '設立', value: '2026年7月' },
      { term: '所在地', value: '東京都狛江市' },
      { term: '事業', value: '営業支援（SALES）／n1a／CxO MEET UP（ASOBMENT・Biz Summit!）' },
      { term: '資格', value: '宅地建物取引士（宮本）' },
    ],
  },
  servicesTitle: '事業・サービス',
  services: [
    { name: '営業支援', description: '決裁者に直接アプローチ。初期費用・月額なし、商談ごとの成果報酬' },
    { name: 'n1a', description: '人柄と価値観の相性で、経営者を1対1で引き合わせる' },
    { name: 'ASOBMENT', description: '人狼やボードゲームを囲む、15人ほどの経営者交流会' },
    { name: 'Biz Summit!', description: 'スポンサー企業も加わる、カンファレンス形式の経営者の集まり' },
  ],
  valuesTitle: '大切にしている考え方',
  values: [
    {
      title: 'アソビの先で、ビジネスを',
      body: '一緒に遊ぶと、肩書きより先に人柄が見える。ASOBMENTの出発点です。',
    },
    {
      title: '見えない波長を、つなぐ',
      body: 'スペックが合っても、人が合わなければ続かない。n1aはそこから考えています。',
    },
    {
      title: '受注までの距離を、短くする',
      body: 'リストの件数より、決める人に会えるかどうか。営業支援はそのための仕組みです。',
    },
    {
      title: '最適なつながりを、デザインする',
      body: 'AddBox時代のインタビューで語っていた言葉。営業でも採用でもなく、人と会社のいちばんいい組み合わせを探す。',
    },
  ],
  wantToMeet: {
    lead: 'Batonから見て、宮本さんと話すと面白いと思う方です。',
    items: [
      '決裁者に直接会える営業の方法を探している会社',
      '肩書き抜きで付き合える経営者仲間がほしい方',
      '経営者向けのイベントやコミュニティに、協賛・共催で関わりたい会社',
      'フリーランス人材の活用を考えている会社',
    ],
  },
  media: [
    {
      label: 'ASOBMENT（アソビの先でビジネスを）',
      url: 'https://asobment.studio.site/',
      kind: '主催',
      date: '2026.09',
      note: '役員以上が集まる、人狼とボードゲームの交流会。第6回は2026年9月25日、第7回は10月27日。',
      featured: true,
    },
    {
      label: 'n1a（人柄でつなぐ経営者マッチング）',
      url: 'https://n1a-cxo.com/',
      kind: '事業',
      note: '売上や業界ではなく、価値観と人柄で経営者を1対1でつなぐ。',
      featured: true,
    },
    {
      label: '営業でも採用でもない。“最適なつながり”をデザインする会社',
      url: 'https://media.tunakare.jp/jinji-no-koe/1387861076/',
      kind: '掲載',
      date: '2026.01.28',
      note: 'AddBox取締役COO時代のロングインタビュー。創業の経緯から、営業代行・人材・交流会、経営者プラットフォームの構想まで。',
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
      note: 'スポンサー企業も加わる、カンファレンス形式の経営者の集まり。',
    },
    {
      label: 'LinkedIn',
      url: 'https://jp.linkedin.com/in/%E5%BA%B7%E5%A4%AA-%E5%AE%AE%E6%9C%AC-3a5826327',
      kind: '発信',
      note: '経歴と、交流会や事業の近況。',
      owner: 'person',
    },
    {
      label: 'Wantedly',
      url: 'https://www.wantedly.com/id/kota_miyamoto3838',
      kind: '発信',
      note: '読売広告社からサイバーエージェント、独立までの経緯。',
      owner: 'person',
    },
  ],
  mediaTitle: '実績・メディア',
  mediaLabel: 'Works & Media',
  location: '東京',
  updatedAt: '2026-10-01',
  listSummary: '人柄で、経営者同士をつなぐ',
  businessTags: ['営業支援', 'マッチング', '交流会運営'],
  keywordTags: ['元広告代理店', '人柄でつなぐ', 'ゲーム交流会'],
  // モノクロの写真に合わせた、黒と生成りのノワール。紫はアクセントの灰色にかすかに残すだけ
  theme: { primary: '#E7E2D9', accent: '#9D8FA3', bg: '#0B0A0C', text: '#ECE9E4' },
  active: true,
};

export const profiles: TalkProfile[] = [kabeyaProfile, matsuuraProfile, ishiiProfile, miyamotoProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
