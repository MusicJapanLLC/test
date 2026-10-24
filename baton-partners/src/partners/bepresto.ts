import type { Partner } from '../types';

/**
 * BE.PRESTO株式会社（ビー・プレスト）
 *
 * 世界観：鐘を鳴らす、響く（presto の世界観・ring のシーン）。最新のテンプレート（ZETTAICHI・Presence・DPパートナーズと同じ骨組み）。
 *   ヒーローとヘッダーはロゴの黒の夜。画面いっぱいの白い見出しに、2行目は BP の青。文字は右から速く走り込む（PRESTO＝速く）。
 *   WebGL は「響く」：方眼の点の上で鐘が鳴り、音の輪が点を青く光らせる。採用SNS・AI研修・人材紹介の段階で輪の形が変わる。
 *   本文の面は白。欧文と数字は公式サイトと同じ Oswald、見出しは Zen Kaku Gothic New 900。
 *   2026-10-22：誌面『PRESTO』（雑誌の形）はオーナーの指示でやめた。「いつものテンプレートで。常に最新に」
 * 主役：採用SNS（物流・建設・介護などの会社の採用をリールやTikTokで手伝う）と、職務別のAI研修。
 *
 * 文章：AIっぽさを消すために（2026-10-22 オーナーの指示「AI感強い。書き方を調べてから書く」）
 *   ・仕掛けを本文で説明しない（「〜風に」「〜してみました」「〜にたとえました」は書かない）
 *   ・一般論ではなく、この会社にしかない具体を書く（業界、LINEを手で返す、応募の前の面談、20日、85分×8回）
 *   ・文の長さを混ぜる。書き手の意見は、ところどころ一言だけ
 *
 * 事実の出どころ（2026年10月21〜22日に確認）：
 *   bepresto.co.jp … トップ（事業内容）、私たちについて（Be Fast to Ring the Bell・ミッション・ビジョン・バリュー・強み・代表メッセージ・会社概要）
 *   bepresto.co.jp/education-service/ … 教育事業（AI研修の課題、3部・全8回・11時間20分、8職務×4ツールのカリキュラム、注意事項、FAQ）
 *   be-presto-saiyo.com … 採用SNS（支援実績400社突破・総再生回数1億回突破・採用専用LINEを手動で運用・事前面談・最短20日・
 *     導入実績5社・対応業界）
 *   doda の企業ページ（BE.PRESTOの掲載） … 設立 2024年4月
 *   子安さんの X（@_KAI_KOYA_）のプロフィール … 2025年 パリコレ スポンサー認定企業
 * 載せないもの：料金・契約条件（Baton Partners の方針。採用SNSの月額などの公式の料金も載せない）、
 *   本人の発言の創作、公開されていない取引先・数字、商談で聞いた話。
 * ロゴ：公式サイトのサイトアイコン（背景透過の BP ロゴ）を元に、Music Japan が線をなぞって SVG に起こしたもの（形と色は変えていない）。
 * 写真：オーナー経由で受け取ったもの（2026年10月21日）。
 * 公開：オーナーが子安さんの掲載許可を確認済み（2026年10月21日）。
 */
export const bepresto: Partner = {
  slug: 'bepresto',
  no: '08',
  catalog: {
    base: '東京・荻窪',
    category: '採用SNS / AI研修 / 人材紹介',
    catch: '価値が埋もれる前に、世の中へ響かせる。',
    lead: 'Instagramのリールや TikTokで会社の顔を見せる採用SNS、職務ごとに組んだ法人向けのAI研修、人材紹介のBE.CAREER。東京・荻窪で、この3つを手がけている会社です。代表取締役CEOは子安魁さん。',
    service: 'AI研修',
    logos: [{ src: '/partners/bepresto/logo-light.png', alt: 'BE.PRESTO', size: [844, 710] }],
    colors: ['#4FB8EC', '#F1ECE2'],
    en: {
      name: 'BE.PRESTO Inc.',
      base: 'OGIKUBO, TOKYO',
      category: 'SOCIAL RECRUITING / AI TRAINING / CAREERS',
      catch: 'Ring the bell before the value gets buried.',
      lead: 'BE.PRESTO helps companies hire through Instagram Reels, TikTok and YouTube Shorts, runs role-based generative AI training for companies, and operates the recruiting service BE.CAREER. Based in Ogikubo, Tokyo. CEO: Kai Koyasu.',
    },
  },
  company: {
    name: 'BE.PRESTO株式会社',
    nameEn: 'BE.PRESTO',
    url: 'https://bepresto.co.jp/',
    profile: [
      { label: '会社名', value: 'BE.PRESTO株式会社' },
      { label: '代表取締役CEO', value: '子安 魁' },
      { label: '設立', value: '2024年4月' },
      { label: '資本金', value: '1,000万円' },
      { label: '所在地', value: '東京都杉並区荻窪3-47-15 第3野村ビル4階' },
      { label: '有料職業紹介', value: '許可番号 13-ユ-319150' },
      { label: '事業内容', value: 'SNSソリューション事業・インフルエンサー事業・広告運用事業・SNS研修事業・AI研修事業・人材紹介業（BE.CAREER）' },
      { label: 'コーポレートサイト', value: 'bepresto.co.jp', url: 'https://bepresto.co.jp/' },
    ],
  },
  brand: {
    // ロゴの BP の青（#1A91C9）と、ロゴの黒（#0B0E0F）
    primary: '#1A91C9',
    accent: '#0B0E0F',
    logo: '/partners/bepresto/logo.png',
    logoOnDark: '/partners/bepresto/logo-light.png',
    logoAlt: 'BE.PRESTO株式会社',
    logoSize: [844, 710],
    // シーン：まだ届いていない点＝青、輪＝明るい青、二つの輪の重なり＝白
    scene: { a: '#1A91C9', b: '#4FB8EC', match: '#FFFFFF' },
  },
  world: { theme: 'presto', scene: 'ring' },
  leader: {
    name: '子安 魁',
    nameEn: 'Kai Koyasu',
    role: '代表取締役CEO',
    avatar: '/partners/bepresto/koyasu-avatar.jpg',
    photo: '/partners/bepresto/koyasu.jpg',
    photoSize: [840, 1050],
    timeline: [
      { year: '2024', text: '4月、BE.PRESTO株式会社を設立。代表取締役CEOに' },
      { year: '2025', text: 'パリコレのスポンサー認定企業に（本人のXのプロフィールより）' },
      { year: 'Now', text: '採用SNS、{法人向けの}AI研修、人材紹介のBE.CAREERを手がける' },
    ],
    body: [
      'BE.PRESTO株式会社の代表取締役CEO。2024年4月に会社を立ち上げました。Xのプロフィールには「2025年パリコレスポンサー認定企業」とあります。',
      '事業を始めたきっかけは、誤解や偏った情報のせいで、本気で努力している人や会社が正しく評価されない場面を見てきたことだそうです。本来価値があるものほど発信されず、弱って、埋もれていく。代表メッセージには、その現実への違和感が出発点だったと書かれています。',
      '目指しているのは、声の大きさではなく価値そのものが評価される社会。メッセージは「本気で生きている人が報われる社会へ。」という一文で終わります。',
    ],
    motto: { label: '信じていること', text: '伝え方ひとつで、未来は変わる' },
  },

  top: {
    title: ['価値が埋もれる前に、', '世の中へ{響かせる。}'],
    lead: 'BE.PRESTOは、東京・荻窪の会社です。物流や建設の会社の採用をSNSで手伝い、営業や経理の人に職務ごとのAI研修をして、20代の転職にも付き添う。2024年4月に、子安魁さんが立ち上げました。',
    deck: ['Be Fast to Ring the Bell', 'Ogikubo, Tokyo — Since 2024'],
    badges: ['採用SNS', '法人向けAI研修', '人材紹介 BE.CAREER'],
    marquee: ['Be Fast to Ring the Bell', '採用SNS', 'Reels', 'TikTok', 'AI研修', 'ChatGPT', 'Gemini', 'Copilot', 'Claude', 'BE.CAREER', '誠実・共創・挑戦'],
    numbersTitle: '{数字で見る、}{BE.PRESTO。}',
    // ヒーローの下で入れ替わる札（採用SNSの公式サイトに書かれている中身）
    ticker: {
      label: '採用SNSで、届くもの',
      items: ['リールで見せる、職場の空気', '採用専用のLINEに、手で返す返事', '応募の前に、BE.PRESTOと面談', '早ければ20日で、運用開始'],
    },
    verbs: [
      {
        en: 'Show',
        ja: '採用SNS',
        title: '求人票の外で、{会社を見せる。}',
        body: 'Instagramのリール、TikTok、YouTubeショートで、職場の空気や働く人の顔が分かる動画を出す。気になった人とは、採用専用のLINEで一人ずつやりとりします。',
      },
      {
        en: 'Train',
        ja: 'AI研修',
        title: '職務ごとに、{85分を8回。}',
        body: 'マーケ、経理、営業、人事、労務、製造・建設・運送の現場。職務ごとに中身の違う全8回の研修で、使うAIはChatGPT、Gemini、Copilot、Claudeから選べます。',
      },
      {
        en: 'Match',
        ja: '人材紹介',
        title: '20代の転職に、{付き添う。}',
        body: '有料職業紹介の許可（13-ユ-319150）をとって運営している人材紹介です。20代のキャリアの相談のほか、ハイクラスの営業職を採りたい会社の手伝いもしています。',
      },
    ],
    problemsTitle: '{やってはみた。}{でも、変わらない。}',
    problems: [
      {
        title: '{ナビサイトに載せても、}{応募が来ない}',
        detail: '大手の求人サイトに掲載しても、反応がない。会社の名前を知られていないと、求人票を開いてもらうところまで届きません。',
      },
      {
        title: '{採用の費用が、}{かさんでいく}',
        detail: '紹介会社に頼るほど、一人あたりの採用単価は上がる。掲載費をかけても、見合うだけの応募が来ない。',
      },
      {
        title: '{AI研修は、}{やって終わった}',
        detail: 'ChatGPTの使い方は一通り習った。なのに翌週には、誰も開いていない。',
      },
      {
        title: '{SNSを回せる人が、}{社内にいない}',
        detail: '大事なのは分かっている。でも企画して、撮って、毎週出し続けられる人がいない。',
      },
    ],
    highlight: {
      en: 'Curriculum',
      title: ['職務ごとに、', '85分を8回。'],
      lead: '1〜2回目は全員共通、3〜5回目は職務別、6〜8回目はツール別。順番に進むと、最後は自分の会社のAIで回る仕組みが手元に残ります。',
      steps: [
        {
          title: '共通（1〜2回目）',
          detail: 'AIに入れてはいけない情報の線引きと、1週間の仕事の棚卸し。ChatGPT、Gemini、Copilot、Claudeの得意不得意を知って、AIに任せる仕事を3つ選びます。',
        },
        {
          title: '職務別（3〜5回目）',
          detail: '営業なら商談の準備と記録、経理なら督促の文面と表計算、現場なら写真と音声からの日報。自分の仕事を、AIで実際にやってみます。',
        },
        {
          title: 'ツール別（6〜8回目）',
          detail: 'ChatGPTならGPTsとタスク、GeminiならGemsとGAS、ClaudeならCoworkとClaude Code。毎月のレポートが自動で回るところまで進みます。',
        },
      ],
      note: '出典：BE.PRESTO「教育事業のご案内」。中身は会社の状況に合わせて変わります。',
    },
    stats: [
      { label: '採用SNSの支援実績', value: '400', unit: '社+', note: '採用SNSの公式サイトの表記' },
      { label: '動画の総再生回数', value: '1', unit: '億回+', note: '同じく、採用SNSの公式サイトから' },
      { label: 'ヒアリングから運用開始まで', value: '20', unit: '日', note: '早い場合' },
      { label: 'AI研修の職務', value: '8', unit: '職務', note: '1回85分で全8回、合計11時間20分' },
    ],
    statsNote: '採用SNSの公式サイトと、教育事業のページに載っている数字です（2026年10月時点）。',
    aboutQuote: '私たちは、伝え方ひとつで{未来は変わると}{信じています。}',
    aboutQuoteCite: 'BE.PRESTO 公式サイト「代表メッセージ」より',
    // 代表の写真（leader.photo）・歩み・本文を使う。引用は公式サイトの代表メッセージの原文のまま
    founder: {
      kicker: 'Founder',
      title: '{本気で生きている人が、}{報われる社会へ。}',
      quote: {
        text: '私たちの役割は、魅力を作ることではなく、本来そこにある価値を見つけ、言葉にし、社会へ届けることです。',
        cite: 'BE.PRESTO公式サイト「代表メッセージ」より',
      },
      links: [
        { label: 'BE.PRESTOの公式サイト', url: 'https://bepresto.co.jp/' },
        { label: '子安さんのX', url: 'https://x.com/_KAI_KOYA_' },
      ],
    },
  },

  about: {
    title: ['未だ見ぬ景色を、', '共に創る。'],
    lead: 'BE.PRESTO株式会社は、2024年4月に東京・荻窪で生まれた会社です。採用SNSとAI研修、人材紹介のBE.CAREERを手がけています。代表取締役CEOは子安魁さん。',
    story: [
      {
        heading: '{Be Fast to Ring the Bell}',
        body: '公式サイトの「私たちについて」は、この一行から始まります。価値が埋もれる前に、世の中へ響かせる。いまは発信する力がなければ、どんなにいい会社でも、声にならないまま埋もれてしまう。BE.PRESTOは、その声をSNSと広告、研修、人材の力で拾い上げようとしている会社です。',
      },
      {
        heading: '景色は、{2つある}',
        body: 'ビジョンは「未だ見ぬ景色を、共に創る。」。ひとつ目の景色は、お客様がサービスを通じてたどり着く、まだ見たことのない景色。ふたつ目は、まだ何者でもない自分たちが上場企業になって、その上から見る景色です。ふたつ目まで公式サイトにはっきり書いているところに、この会社の若さと本気が出ていると思います。',
      },
      {
        heading: '魅力は、{つくらない}',
        body: '強みとして挙げているのは、見せ方を盛ることではなく、お客様がまだ言葉にできていない強みを掘り起こすことです。採用の動画で職場をそのまま撮るのも、応募の前に面談するのも、同じ考え方から来ています。「発信の力に感動した」「人生が変わった」と言われるのが誇りだ、とも書いています。',
      },
      {
        heading: '3つの事業は、{同じ話}',
        body: 'SNSで知ってもらう。研修で、社内に使える力を残す。人材紹介で、会社と人を出会わせる。ばらばらに見えますが、相手にしている問題はひとつです。子安さんは代表メッセージで、価値があるのに知られない会社や、選択に迷う個人が生まれ続けるのは、能力や努力の問題ではなく伝わり方の問題だ、と書いています。',
      },
    ],
    stanceTitle: '{BE.PRESTOが、}{大事にしていること}',
    stance: [
      {
        title: '誠実｜偽りなく、リアルだけを',
        detail: '都合よく飾った情報は出さない。人の会社のことを伝える仕事だから、嘘のなさをいちばんに置いています。',
      },
      {
        title: '共創｜お客様も仲間も、共に主役',
        detail: '成果は自分たちだけでは出せない、というところから始めています。お客様とも、同じ目線で手を組む。',
      },
      {
        title: '挑戦｜まず一歩、踏み出す',
        detail: '前例がないことを、やらない理由にしない。誰よりも早く一歩目を出す、と書いています。PRESTO は、楽譜で「速く」を指す言葉です。',
      },
      {
        title: '当事者として、{課題の本質に}',
        detail: '社員一人ひとりが、お客様の課題を自分のことのように扱う。表面だけの対応で終わらせない、というのが行動の指針です。',
      },
    ],
  },

  service: {
    name: 'AI研修',
    logo: '/partners/bepresto/logo.png',
    logoAlt: 'BE.PRESTO株式会社',
    logoSize: [844, 710],
    category: '{職務ごとに組む、}{生成AIの}{企業研修}',
    tagline: 'AI時代を、勝ち抜く企業へ。',
    description:
      'BE.PRESTOのAI研修は、営業や経理、現場の人が、自分の仕事でAIを使えるようになるための研修です。職務は8つ、1回85分で全8回。ChatGPT、Gemini、Microsoft Copilot、Claudeのどれを使っている会社でも組めます。企画から定着まではBE.PRESTOが受け持ち、AI研修とDX推進を専門にする講師が教えます。',
    url: 'https://bepresto.co.jp/education-service/',
    solutions: [
      { problem: 'AI研修をしたのに、現場で使われていない', answer: '3〜5回目で、自分の職務の仕事をAIでやってみる', feature: '職務別パート' },
      { problem: '何から始めればいいか、自社に合う使い方が分からない', answer: '1週間の仕事を書き出して、AIに任せる仕事を3つ選ぶところから', feature: '共通パート' },
      { problem: '一時的な取り組みで終わり、担当者に頼りきりになる', answer: '会社で使うAIの機能まで扱い、レポートや定型の作業が自動で回る形を残す', feature: 'ツール別パート' },
      { problem: 'SNSや動画も、社内で回せるようにしたい', answer: 'AIの動画ツールの研修と、SNS運用を内製にする講座もある', feature: 'VIDEO DX・SNS内製化' },
    ],
    flow: [
      { stage: '{AIの限界と、}{自社のルール}', en: 'Vol.1', feature: '共通パート' },
      { stage: '{ツールの使い分けと}{業務の選定}', en: 'Vol.2', feature: '共通パート' },
      { stage: '{自分の職務を、}{AIでやってみる}', en: 'Vol.3–5', feature: '職務別パート' },
      { stage: '{会社のAIで、}{仕組みにする}', en: 'Vol.6–8', feature: 'ツール別パート' },
      { stage: '{現場に、}{定着させる}', en: 'After', feature: '企画から定着まで伴走' },
    ],
    features: [
      {
        en: 'All tools',
        title: '{会社のAIで、}{そのまま}',
        detail: 'ChatGPT、Google Gemini、NotebookLM、Microsoft Copilot、Claude、Claude Code、GitHub Copilot。会社がもう使っているツールに合わせて組みます。',
      },
      {
        en: 'By role',
        title: '8つの職務に、{専用の8回}',
        detail: 'マーケティング、経理、営業、人事、労務、製造・建設・運送の現場。職務ごとに、よくある課題と受講後にできることが決まっています。',
      },
      {
        en: '3 parts',
        title: '基礎から、{会社の仕組みまで}',
        detail: '共通の2回で足場をそろえ、職務別の3回で実務に使い、ツール別の3回で会社の環境に組み込む。1回85分です。',
      },
      {
        en: 'Rules first',
        title: '入れてはいけない{データを、先に決める}',
        detail: '要配慮個人情報は入れない。適法性や会計の判断をAIに任せない。実データを入れる前に、会社ごとの線引きを決めておきます。',
      },
      {
        en: 'Video DX',
        title: '動画とSNSも、{社内で回す}',
        detail: 'AIの動画ツールで教育用の動画をつくる研修と、ショート動画の企画から撮影、分析まで学ぶSNS内製化の講座もあります。',
      },
      {
        en: 'Partner lecturer',
        title: '企画から定着まで、{専門の講師と}',
        detail: '組み立てはBE.PRESTO、教えるのはAI研修と上流のコンサルを専門にする講師。企画も実施も定着も、窓口はひとつです。',
      },
    ],
    fits: [
      'AI研修をやったのに、日々の仕事で使われていない',
      '何から始めればいいか、自社に合う使い方が分からない',
      '部署ごとにバラバラな使い方を、そろえたい',
      'ITに詳しくない社員にも、使えるようになってほしい',
      '現場の日報や手順書を、スマホとAIで楽にしたい',
      'SNSや動画の発信も、社内で回せるようにしたい',
    ],
    onboarding: [
      { title: 'ITやAIに詳しくない社員でも、受けられますか', detail: '受けられます。初心者に分かりやすい内容を重視していて、手を動かしながら少しずつ{身につけられる}組み立てです。' },
      { title: 'オンラインでも受けられますか', detail: '受けられます。講座によって、対面のワークショップ、オンラインの研修、オンデマンドの動画学習などの形があります。' },
      { title: '自社に合わせて、内容を変えられますか', detail: '変えられます。カリキュラムは会社の課題に合わせて調整されますし、一から組み立てる研修もあります。' },
      { title: 'まずは相談だけでも、いいですか', detail: '大丈夫です。いまの課題を聞いたうえで、合う組み立てを提案してもらえます。このページの「話してみる」からも始められます。' },
    ],
    labels: {
      flowKicker: 'Curriculum',
      flowTitle: '基礎から{会社の仕組みまで、}{8回で。}',
      featuresTitle: '{この研修の、}{ほかと違うところ}',
      statsTitle: '{数字で見る、}{BE.PRESTO。}',
      onboardingTitle: '{始める前に、}{よく聞かれること。}',
      fitsTitle: 'こんな会社に、{合っています。}',
    },
    clients: ['株式会社in CUBE', 'マルナガロジスティクス株式会社', '東建産業株式会社', '株式会社わかばケアセンター', 'ベイラインエクスプレス株式会社'],
    clientsNote: '採用SNSの公式サイトに、導入実績として載っている会社です。',
  },

  insight: {
    slug: 'ai-training-by-role',
    category: '法人向けAI研修',
    title: 'AI研修をしたのに、現場で使われないのはなぜか。職務別に組む生成AI研修の考え方',
    description:
      'ChatGPTの使い方は覚えた。それでも日々の仕事で使われない。そんなAI研修のつまずきを、職務別のカリキュラムと3部構成の組み方から考えます。入れてはいけないデータの線引きなど、始める前に決めておきたいことも整理しました。',
    published: '2026-10-21',
    readingMinutes: 8,
    lead: '研修でChatGPTの画面を一緒に触った。プロンプトのコツも聞いた。なのに1か月たつと、使っているのは一部の人だけ。生成AIの社内研修では、よく聞く話です。この記事では、研修が「使い方の講習」で終わってしまう理由と、職務ごとに組む考え方を、BE.PRESTOの職務別カリキュラムを例に見ていきます。',
    keyPoints: [
      'AI研修が現場で使われない大きな理由は、ツールの使い方を教えても、受講者の日々の仕事とつながっていないことです。',
      '職務別に組むと、営業なら商談の記録、経理なら督促の文面、現場なら写真と音声からの日報、というように「明日やる作業」から学べます。',
      '共通・職務別・ツール別の3部で組むと、基礎をそろえてから実務で使い、最後に会社のAIで仕組みにするところまで進めます。',
      '実データを入れる前に、入れてよい情報と入れない情報の線引きを、自社の言葉で決めておくことが前提になります。',
    ],
    sections: [
      {
        id: 'why',
        heading: '研修が「使い方の講習」で{終わってしまう理由}',
        blocks: [
          {
            type: 'p',
            text: '生成AIの研修というと、ツールの画面の説明があって、プロンプトの書き方を習い、いくつか練習問題を解く。そんな流れを思い浮かべる人が多いはずです。それ自体は悪くありません。ただ、研修が終わって受講者が戻るのは、自分の机と、いつもの仕事です。',
          },
          {
            type: 'p',
            text: '練習問題と自分の仕事のあいだに橋がかかっていないと、「便利そうだけど、どこで使えばいいか分からない」で止まります。BE.PRESTOの教育事業のページにも、よくある悩みとして**「研修は実施したものの、日常業務に活かされていない」「ChatGPTの使い方を学んだだけで終わっている」**が挙げられています。',
          },
          {
            type: 'callout',
            title: 'ゴールの置き方を変える',
            text: '「学ぶこと」をゴールにせず、「現場で明日から実装できる状態」をゴールに置く。BE.PRESTOの研修は、そこから逆算して組まれています。',
          },
        ],
      },
      {
        id: 'by-role',
        heading: '職務ごとに組むと、「明日やる作業」から学べる',
        blocks: [
          {
            type: 'p',
            text: '同じ生成AIでも、使いどころは職務によってまるで違います。職務ごとに「よくある課題」と「受講後にできるようになること」を決めておくと、研修の中身が具体的な作業になります。BE.PRESTOのカリキュラムでは、たとえば次のように決められています。',
          },
          {
            type: 'table',
            head: ['職務', '受講後にできること（例）'],
            rows: [
              ['{営業・}{企画・}{提案}', '商談の録音を、決まったことと持ち帰りが分かれた記録に変える'],
              ['経理・財務', '売掛の滞留を年齢別に並べ、督促の文面まで用意する'],
              ['{人事}{（採用・}{育成）}', '職種ごとの求人票とスカウト文を、訴求を変えて数パターン用意する'],
              ['{マーケティング・}{販促}', '1か月分の投稿案を、テーマ別に振り分けた状態で用意する'],
              ['{製造業の}{現場}', '手書きメモや写真から、日報と作業連絡をその場で整える'],
              ['{運送業の}{現場}', 'ヒヤリハット報告をまとめて、繰り返し起きている場所を特定する'],
            ],
          },
          {
            type: 'p',
            text: '現場の職務では、使う端末も変わります。製造・建設・運送の現場向けのカリキュラムは、会社で配られているスマホと共用PCで何ができるかに絞って始める組み立てです。机に向かう時間が少ない人ほど、音声入力や写真からの記録が役に立ちます。',
          },
        ],
      },
      {
        id: 'three-parts',
        heading: '共通・職務別・ツール別の3部で組む',
        blocks: [
          {
            type: 'p',
            text: '職務別といっても、いきなり実務から入るとつまずきます。BE.PRESTOの職務別AI研修は、1回85分を全8回、3部に分けています。',
          },
          {
            type: 'numbered',
            items: [
              { title: '第1部 共通パート（2回）', detail: 'AIの限界とリスク、自社の情報の取り扱いルール、1週間の業務の棚卸し。ChatGPT・Gemini・Copilot・Claudeの得意不得意を知り、AIに任せる候補を3つ選びます。' },
              { title: '第2部 職務別パート（3回）', detail: '自分の職務の課題を、AIで解く手順として学びます。文面や資料をつくる回、データを読み解く回、毎月の作業を仕組みにする回、という流れです。' },
              { title: '第3部 ツール別パート（3回）', detail: '社内で使うAIの機能そのものを扱います。ChatGPTならGPTsとタスク、GeminiならGemsとGAS、ClaudeならCoworkとClaude Code、CopilotならCopilot Studio。第2部で作ったレポートを、自動で回すところまで進みます。' },
            ],
          },
          {
            type: 'p',
            text: '基礎をそろえる、実務で使う、自社の環境で回す。この順番にすると、研修が終わったときに「仕組み」が手元に残ります。担当者が替わっても、同じ形で続けられます。',
          },
        ],
      },
      {
        id: 'rules',
        heading: '始める前に、入れてはいけない{データを決めておく}',
        blocks: [
          {
            type: 'p',
            text: '生成AIを仕事で使うなら、入れてよい情報と入れない情報の線引きが先です。BE.PRESTOのカリキュラムでも、実データを入れるのは自社の入力の基準が固まってから、と決められています。注意事項には、たとえば次のようなことが書かれています。',
          },
          {
            type: 'check',
            items: [
              '健康診断の結果やストレスチェック、休職の理由など、要配慮個人情報はAIに入れない',
              '表現の適法性や、規程・労働時間の適否について、AIの答えを根拠にしない',
              '会計処理の判断はAIにさせず、数値は必ず元の資料で確かめる',
              '採用の可否のような説明責任がともなう判断は、AIに委ねない',
              '多言語にした手順書は、その言語が分かる人に必ず確かめてもらう',
            ],
          },
          {
            type: 'p',
            text: 'AIの使い方全般のルールを考えるときは、経済産業省と総務省がまとめた「AI事業者ガイドライン」も参考になります。自社の言葉でルールを書き出しておくと、研修で習ったことを安心して現場に持ち帰れます。',
          },
        ],
      },
      {
        id: 'bepresto',
        heading: '例：8つの職務と4つのツールで組む、BE.PRESTOのAI研修',
        blocks: [
          {
            type: 'p',
            text: '東京・荻窪の[BE.PRESTO株式会社](/bepresto/about/)は、採用SNSや人材紹介とあわせて、{法人向けの}AI研修を手がけています。職務はマーケティング・経理・営業・人事・労務と、製造・建設・運送の現場の8つ。ツールはChatGPT・Gemini・Microsoft Copilot・Claudeの4つから選べて、どの組み合わせでも全8回・11時間20分の流れになっています。',
          },
          {
            type: 'p',
            text: '企画から定着までをBE.PRESTOが受け持ち、AI研修とDX推進を専門とする講師が教える体制です。8回それぞれの中身は、[AI研修のページ](/bepresto/service/)にまとめています。',
          },
          { type: 'person', text: '2024年にBE.PRESTOを立ち上げ、採用SNSとAI研修、人材紹介を手がけている。' },
        ],
      },
      {
        id: 'summary',
        heading: 'まずは、1週間の仕事の棚卸しから',
        blocks: [
          {
            type: 'p',
            text: '研修を選ぶ前に、自分たちの1週間の仕事を書き出してみる。そのうちどれをAIに任せたいかに印をつける。それだけでも、どんな研修が合うかはかなり見えてきます。',
          },
          {
            type: 'p',
            text: 'BE.PRESTOのAI研修や、SNSでの採用が気になったら、[BE.PRESTOと話してみる](/bepresto/contact/)ページから。Music Japanが内容を確かめてから、おつなぎします。',
          },
        ],
      },
    ],
    sources: [
      { label: 'BE.PRESTO「教育事業のご案内」', url: 'https://bepresto.co.jp/education-service/' },
      { label: 'BE.PRESTO「私たちについて」', url: 'https://bepresto.co.jp/about/' },
      { label: '経済産業省「AI事業者ガイドライン」', url: 'https://www.meti.go.jp/shingikai/mono_info_service/ai_shakai_jisso/20240419_report.html' },
    ],
  },

  contact: {
    questions: [
      {
        id: 'q1',
        label: 'いまのお立場に、いちばん近いものは',
        type: 'single',
        options: ['代表取締役・経営者', '役員', '人事・研修の担当', 'マーケティング・広報の担当', '事業の責任者・部長', 'その他'],
      },
      {
        id: 'q2',
        label: '業種は、どれに近いですか',
        type: 'single',
        options: [
          '製造',
          '建設・不動産',
          '物流・運輸',
          '小売・卸売・EC',
          '飲食・宿泊・観光',
          '美容・サロン',
          '医療・介護',
          'IT・Web',
          '人材・教育',
          '士業・コンサルティング',
          'その他',
        ],
      },
      {
        id: 'q3',
        label: 'BE.PRESTOと、どんな話をしてみたいですか（いくつでも）',
        type: 'multi',
        options: [
          '社員向けのAI研修',
          'SNSでの採用・採用専用LINE',
          'SNS運用・広告運用',
          'ショート動画の制作・集客',
          'SNSや動画の内製化の研修',
          '人材紹介（BE.CAREER）',
          'まずは子安さんと話してみたい',
        ],
      },
      {
        id: 'q4',
        label: '始めたい時期は',
        type: 'single',
        options: ['すぐにでも', '3か月以内', '半年以内', 'まだ決めていない'],
      },
    ],
  },

  // BE.PRESTO と AI 研修についての質問。答えは公式サイトの範囲で書く（料金・契約条件の質問は載せない）
  faq: [
    {
      q: 'BE.PRESTOは、どんな会社ですか。',
      a: '2024年4月に設立された、東京・荻窪の会社です。代表取締役CEOは子安魁さん。InstagramやTikTokを使った採用SNSの運用、職務ごとに組んだ法人向けのAI研修、人材紹介のBE.CAREERを手がけています。掲げている言葉は「Be Fast to Ring the Bell」です。',
    },
    {
      q: 'AI研修では、どのAIツールを扱えますか。',
      a: 'ChatGPT、Google Gemini、NotebookLM、Microsoft Copilot、Microsoft 365 Copilot、Claude、Claude Code、GitHub Copilotに対応しています。職務別のカリキュラムでは、ChatGPT・Gemini・Microsoft Copilot・Claudeの4つから選べます。',
    },
    {
      q: '研修は、どんな構成ですか。',
      a: '職務別のAI研修は、1回85分を全8回（合計11時間20分）。共通パート2回、職務別パート3回、ツール別パート3回の3部構成です。職務は、マーケティング・経理・営業・人事・労務と、製造・建設・運送の現場の8つです。',
    },
    {
      q: 'ITやAIに詳しくない社員でも、受けられますか。',
      a: '受けられます。初心者に分かりやすい内容を重視していて、手を動かしながら少しずつ身につけられる組み立てです。業種や会社の状況に合わせて、内容も調整されます。',
    },
    {
      q: 'SNSでの採用も、相談できますか。',
      a: 'できます。Instagramのリール、TikTok、YouTubeショートでの採用向けの運用を受けていて、動画の制作から、採用専用の公式LINEの構築、応募前の求職者との面談まで含まれます。SNSや動画を社内で回すための研修もあります。',
    },
    {
      q: '「話してみる」と、どう進みますか。',
      a: '公式LINEを追加してアンケートに答えると、Music Japanが内容を確かめ、ご相談の概要をBE.PRESTOへ先に共有します。双方が了承したら、LINEグループでおつなぎします。お名前や連絡先がBE.PRESTOに伝わるのは、その時点です。',
    },
  ],

  seo: {
    top: {
      title: 'BE.PRESTO｜採用SNS・法人向けAI研修・人材紹介｜子安魁',
      description:
        'BE.PRESTO株式会社（東京・荻窪）は、InstagramやTikTokで会社の顔を見せる採用SNS、8つの職務ごとに組んだ{法人向け}AI研修、人材紹介のBE.CAREERを手がける会社です。代表取締役CEOは子安魁さん。',
      answer: {
        q: 'BE.PRESTOは、どんな会社？',
        a: '2024年4月に設立された東京・荻窪の会社で、代表取締役CEOは子安魁さんです。物流や建設などの会社の採用をInstagramやTikTokで手伝う採用SNS、8つの職務ごとに組んだ{法人向けの}AI研修、人材紹介のBE.CAREERを手がけています。掲げている言葉は「Be Fast to Ring the Bell」。',
      },
    },
    about: {
      title: 'BE.PRESTO株式会社とは｜「未だ見ぬ景色を、共に創る。」代表 子安魁',
      description:
        'BE.PRESTO株式会社は、2024年4月に設立された東京・荻窪の会社です。ミッションは「価値が埋もれる前に、世の中へ響かせる。」。採用SNS、AI研修、人材紹介を手がけています。代表取締役CEOは子安魁さん。',
      answer: {
        q: 'BE.PRESTO株式会社は、どんな会社？',
        a: '2024年4月に設立された、東京都杉並区荻窪の会社です。代表取締役CEOは子安魁さん。ミッションは「価値が埋もれる前に、世の中へ響かせる。」、ビジョンは「未だ見ぬ景色を、共に創る。」。バリューは誠実・共創・挑戦の3つで、SNSソリューション、インフルエンサー、広告運用、SNSとAIの研修、人材紹介（BE.CAREER）を手がけています。',
      },
    },
    service: {
      title: 'BE.PRESTOのAI研修｜職務別に全8回、ChatGPT・Gemini・Copilot・Claude対応',
      description:
        'BE.PRESTOの{法人向け}AI研修は、8つの職務ごとに1回85分×全8回で組んだ実践型の企業研修です。ChatGPT・Gemini・Microsoft Copilot・Claudeに対応し、共通・職務別・ツール別の3部で「現場で明日から実装できる状態」を目指します。',
      answer: {
        q: 'BE.PRESTOのAI研修は、どんな研修？',
        a: '営業や経理、現場の人が、自分の仕事で生成AIを使えるようになるための企業研修です。職務はマーケティング・経理・営業・人事・労務と、製造・建設・運送の現場の8つ。1回85分を全8回、共通・職務別・ツール別の3部で進み、ChatGPT・Gemini・Microsoft Copilot・Claudeから使うツールを選べます。企画から定着までをBE.PRESTOが受け持ち、専門の講師が教えます。',
      },
    },
    contact: {
      title: 'BE.PRESTOと話してみる｜AI研修・採用SNSの相談',
      description:
        '社員向けのAI研修、SNSでの採用、人材紹介が気になる方へ。公式LINEとアンケートで状況をお伺いし、Music Japanが内容を確かめてからおつなぎします。連絡先を先方に伝えるのは、双方の了承後です。',
      answer: {
        q: 'BE.PRESTOと話してみると、どう進む？',
        a: '公式LINEを追加してアンケートに答えると、Music Japanが内容を確かめ、ご相談の概要をBE.PRESTOへ先に共有します。双方が了承したら、LINEグループでおつなぎします。お名前や連絡先がBE.PRESTOに伝わるのは、その時点です。',
      },
    },
    insightTitle: 'AI研修が現場で使われない理由｜職務別に組む生成AI研修の考え方',
    insightQuestion: 'この記事の要点',
    updated: '2026-10-22',
    org: {
      type: 'Corporation',
      address: { region: '東京都', locality: '杉並区', street: '荻窪3-47-15 第3野村ビル4階' },
      leader: {
        name: '子安魁',
        jobTitle: '代表取締役CEO',
        relation: 'founder',
        alternateName: ['子安 魁', 'Kai Koyasu'],
        sameAs: ['https://x.com/_KAI_KOYA_'],
        description: 'BE.PRESTO株式会社の代表取締役CEO。2024年に会社を立ち上げ、採用SNS、法人向けのAI研修、人材紹介を手がけている。',
      },
      sameAs: ['https://bepresto.co.jp/', 'https://be-presto-saiyo.com/', 'https://be-career-jobchange.com/'],
      areaServed: ['日本'],
    },
    serviceType: 'Service',
  },
};
