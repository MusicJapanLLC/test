import type { Partner } from '../types';

/**
 * 合同会社Music Japan（運営会社）／Baton Partners
 *
 * 世界観：公式サイト music-japan.com（NEEDLE DROP）へのオマージュ（needle / vinyl）。
 *         黒い盤面、公式シンボルを刷った赤いラベル、CUT → SPIN → DROP。公式サイトのちびロボ5体も出す。
 *         オーナーの指示：音楽やレコードは見た目に使ってよい。文章で音楽の話はしない。
 * 文章：大阪の小さな会社の「ひとり」が、相手ひとりに宛てて書く体裁（music-japan-lp/docs/writing-sources.md の決まり）。
 *       否定から入る対比・三つ並べ・ダッシュ・比喩の抽象語を使わない。言えることだけを言い切る。
 *
 * 載せないもの（オーナーの指示）：音楽の話、SECOND TAKE、紹介業を始めた経緯、料金・契約条件。
 *   「料金は出さない」「公開前に必ず見せる」とページに書くこともしない（オーナーの指示）。
 * 事実の出どころ：
 *   公式サイト（music-japan.com）… 会社概要、所在地、法人番号、代表者、ジャケット写真
 *   このサイトの実装 …………………… 5ページの構成、robots.txt で許可しているAIクローラー12種、llms.txt、紹介の流れ（gas/Code.gs）
 *   ミラエラ（miraerror.jp）……… 2020年から運営、450社超の経営者インタビュー、掲載企業（オーナーの案内文より）
 *   Batonの代表プロフィール ………… 「学び、紡ぎ、繋いでいく。」
 * パートナー企業のロゴ：エボルグ・Central AX・Smartaleck は掲載了承済み（黒地なので白抜き版を使う）。
 */
export const musicJapan: Partner = {
  slug: 'music-japan',
  operator: true,
  no: '00',
  catalog: {
    base: '大阪・梅田',
    category: '専用LP / SEO / AIO / 紹介',
    catch: '検索から、商談まで。',
    lead: 'Baton Partnersを運営する、大阪・梅田の会社です。会社ごとの専用ページをつくり、検索とAIに見つかるよう整えて、話してみたい人どうしをおつなぎします。',
    service: 'Baton Partners',
    logos: [{ src: '/partners/music-japan/logo-white.png', alt: 'MUSIC JAPAN LLC', size: [809, 190] }],
  },
  company: {
    name: '合同会社Music Japan',
    nameEn: 'Music Japan LLC',
    url: 'https://music-japan.com/',
    profile: [
      { label: '会社名', value: '合同会社Music Japan（Music Japan LLC）' },
      { label: '代表者', value: '代表社員 壁谷 友生（かべや ともき）' },
      { label: '所在地', value: '〒530-0001 大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル12-12' },
      { label: '法人番号', value: '8120003031493' },
      { label: '事業内容', value: '会社の専用ページと紹介「Baton Partners」／経営者の招待制プロフィール「Baton」／経営者インタビュー' },
      { label: 'メール', value: 'music.japan.llc@gmail.com' },
      { label: 'コーポレートサイト', value: 'music-japan.com', url: 'https://music-japan.com/' },
      { label: '代表のプロフィール', value: 'baton.music-japan.com/profile/kabeya/', url: 'https://baton.music-japan.com/profile/kabeya/' },
    ],
  },
  brand: {
    // 公式サイトと同じ黒地。文字は生成り（#efe9e0）、赤（#e1222f）はラベルと要所だけ
    primary: '#e1222f',
    accent: '#ff3a48',
    logo: '/partners/music-japan/logo-white.png',
    logoAlt: 'MUSIC JAPAN LLC 合同会社Music Japan',
    logoSize: [809, 190],
    scene: { a: '#efe9e0', b: '#e1222f', match: '#ff3a48' },
  },
  world: { theme: 'needle', scene: 'vinyl' },
  leader: {
    name: '壁谷 友生',
    nameEn: 'Tomoki Kabeya',
    role: '合同会社Music Japan 代表社員',
    photo: '/partners/music-japan/kabeya.webp',
    photoSize: [800, 1000],
    body: [
      '北海道で生まれ、東京を経て、いまは大阪・梅田で仕事をしています。',
      '経営者メディア『ミラエラ』の認定インタビュアーでもあります。Baton Partnersのページも、取材と同じように、まず話を聞くところから始めます。',
      'プロフィールは、経営者の招待制プロフィール「[Baton](https://baton.music-japan.com/profile/kabeya/)」に載せています。',
    ],
    motto: { label: 'プロフィールのことば', text: '学び、紡ぎ、繋いでいく。' },
  },

  top: {
    display: ['PASS', 'THE', 'BATON.'],
    deck: ['45 RPM', 'SIDE A', 'NOW SPINNING — BP-000'],
    title: ['検索から、商談まで。', 'バトンをつなぐ。'],
    lead: 'Baton Partnersは大阪・梅田の合同会社Music Japanが運営する、法人向けのサービスです。御社のためだけのページを5枚つくり、Googleの検索結果とAIの答えに出るよう整えます。読んだ人から「話してみたい」と声がかかれば、私たちが間に入っておつなぎします。',
    badges: ['大阪・梅田', '1社につき5ページ', '全国オンライン対応'],
    marquee: ['Baton Partners', 'Landing Page', 'SEO', 'AIO', 'LLMO', 'Referral', 'Structured Data', 'llms.txt', 'Umeda, Osaka'],
    numbersTitle: 'ページの裏側を、{数字で}。',
    verbs: [
      {
        en: 'Cut',
        ja: 'つくる',
        title: '御社だけの、{5枚のページ}。',
        body: 'トップ、取り組み、記事、サービス、話してみる。公式サイトとは別の入口を、partners.music-japan.com の下につくります。色と書体と動きは、ロゴを見て決めます。',
      },
      {
        en: 'Spin',
        ja: '見つかる',
        title: '検索にも、{AIの答えにも}。',
        body: '悩みの言葉で記事を書き、会社の情報は構造化データとllms.txtでつなぎます。Googleで探す人にも、ChatGPTに聞く人にも、名前が届くように。',
      },
      {
        en: 'Drop',
        ja: 'つなぐ',
        title: '最後は、{人の手で渡す}。',
        body: '相談はそのまま流さず、Music Japanが一度読んでから御社へ渡します。検索から来た人も、AIの答えで名前を知った人も、最後は同じ窓口です。',
      },
    ],
    problemsTitle: '問い合わせが増えない会社で、{よく聞く話}。',
    problems: [
      { title: '社名で検索しても、{出てこない}', detail: '名刺を渡した相手があとで調べても、公式サイトは3ページ目。似た名前の別の会社が先に出てくる。' },
      { title: 'ホームページが、{会社案内のまま}', detail: '事業内容と会社概要は載っている。でも、お客さんが抱えている悩みには、どこにも答えていない。' },
      { title: 'AIに聞いても、{名前が挙がらない}', detail: '「大阪でSEOに強い会社は？」とChatGPTに聞いてみる。返ってくるのは、いつも同じ大手の名前ばかり。' },
      { title: '紹介が、{たまにしか来ない}', detail: '紹介で決まった仕事は話が早い。ただ、その紹介がいつ来るかは、相手しだいになっている。' },
    ],
    stats: [
      { label: '1社ぶんの専用ページ', value: '5', unit: '枚', note: 'トップ、取り組み、記事、サービス、話してみる' },
      { label: '名前を挙げて許可しているAIのクローラー', value: '12', unit: '種', note: 'GPTBot、ClaudeBot、PerplexityBot、Google-Extendedなど' },
      { label: 'おつなぎまでの目安', value: '2', unit: '営業日前後', note: '相談が届いてから、LINEのグループをつくるまで' },
    ],
    statsNote: 'AIのクローラーの数は、partners.music-japan.com の robots.txt に名前を書いて許可しているものです（2026年10月時点）。おつなぎまでの日数は目安です。',
    aboutQuote: '自分に時間をくれてる人はどんな人かを、まず知るべき。',
    aboutQuoteCite: '壁谷 友生（合同会社Music Japan 代表社員）',
    highlight: {
      en: 'Pass',
      title: ['紹介は、', '{人が決める}。'],
      lead: 'ページから届いた相談を、そのまま御社に流すことはしません。まずMusic Japanが中身を読み、話す意味がありそうなものだけを、御社に確かめてから渡します。問い合わせの窓口が営業メールで埋まらないように、と決めたやり方です。',
      steps: [
        { title: '相談が届く', detail: '各社のページの「話してみる」から、公式LINEとアンケートで受け付けます。御社には「1件届いた」という通知と、受付番号だけが届きます。' },
        { title: 'Music Japanが読む', detail: '相談の目的と状況を読んで、御社と話す意味がある相談かどうかを確かめます。' },
        { title: '双方の了承でつなぐ', detail: '概要を御社に伝え、両方が「話したい」となったらLINEのグループをつくります。目安は2営業日前後です。' },
      ],
      note: '月のはじめに、前の月に届いた相談と、おつなぎした件数をメールでお知らせします。',
    },
    serp: {
      title: '検索結果の、{どこに効くのか}。',
      lead: 'Baton Partnersでつくるページが、検索結果の画面のどこに出るのかを重ねてみました。上から、AIによる概要、記事、社名のページです。',
      query: '問い合わせ 増やす 方法 BtoB',
      rows: [
        { kind: 'ai', label: 'AIによる概要', service: 'AIO', note: 'ページ冒頭の問いと答え、構造化データ、よくある質問。AIが引用しやすい形で書きます。' },
        { kind: 'organic', label: '検索結果（記事）', service: 'SEO記事', note: '悩みの言葉から書いた記事が入口になります。読み終えたら、御社のサービスと相談のページへ。' },
        { kind: 'organic', label: '検索結果（社名）', service: '専用LP', note: '社名で検索したとき、公式サイトと並んで、御社を説明するページが出ます。' },
      ],
      note: 'イメージ図です。順位や表示のされ方を約束するものではありません。',
    },
    tracklist: {
      title: ['専用LP×SEO×AIO×紹介。', '{4つを}、{ひとつの窓口で}。'],
      lead: 'ページをつくる会社、記事を書く会社、AI検索の対策をする会社、紹介してくれる人。ふつうは別々に頼むものを、Baton Partnersではまとめて引き受けます。頼む先が分かれていると、途中で話が止まりやすいからです。',
      jacket: { title: 'BATON PARTNERS', sub: 'LP × SEO × AIO × REFERRAL' },
      tracks: [
        {
          no: 'A1',
          name: '専用LP',
          meta: '5 PAGES',
          title: '社名で検索されたとき、{もう1枚}。',
          body: '名刺を受け取った人は、たいてい帰りの電車で社名を検索します。そのとき公式サイトの隣に、御社を説明するページが並ぶように。トップ、取り組み、記事、サービス、話してみるの5枚をつくります。',
        },
        {
          no: 'A2',
          name: 'SEO',
          meta: 'ARTICLE',
          title: '悩みの言葉から、{記事を書く}。',
          body: 'まだ御社の名前を知らない人は、悩みの言葉で検索します。その言葉を調べて記事を1本書き、タイトル、説明文、見出し、内部リンクまで、検索の決まりに沿ってそろえます。',
        },
        {
          no: 'B1',
          name: 'AIO',
          meta: 'STRUCTURED DATA',
          title: 'AIの答えに、{拾われる形に}。',
          body: 'ChatGPTやGeminiが答えをつくるときに読みやすいよう、ページの冒頭に問いと答えを置きます。会社名、所在地、代表者、サービスは、構造化データとllms.txtでつなぎます。',
        },
        {
          no: 'B2',
          name: '紹介',
          meta: 'REFERRAL',
          title: '紹介を、{待つだけにしない}。',
          body: 'ページを読んで「話してみたい」と思った人の相談を、Music Japanが先に読みます。合いそうなら御社に確かめて、双方が了承したらLINEでおつなぎします。',
        },
      ],
      note: '公開先は https://partners.music-japan.com/ です。社名のURLで、1社につき5ページを公開します。',
    },
    spotlight: {
      kicker: 'Media',
      title: ['{経営者メディア}', '{『ミラエラ』に、}', '{載るという道も。}'],
      lead: '代表の壁谷友生は、経営者メディア『ミラエラ』の認定インタビュアーとして、経営者への取材をしています。ご希望があれば、Baton Partnersのページとあわせて、ミラエラのインタビューもご案内します。',
      name: 'ミラエラ',
      url: 'https://miraerror.jp/',
      facts: [
        { label: '運営', value: '2020', unit: '年から' },
        { label: 'インタビューした経営者', value: '450', unit: '社超' },
      ],
      questionsTitle: '取材で聞くこと',
      questions: ['なぜ、この事業を始めたのか', 'どんな経験や転機があったのか', '経営者として、何を大切にしているのか'],
      namesTitle: '掲載されている会社（一部）',
      names: [
        { name: '株式会社タイミー', detail: 'スキマバイトの「タイミー」' },
        { name: '株式会社セガ エックスディー', detail: 'SEGAブランドの会社' },
        { name: 'akippa株式会社', detail: '駐車場予約の「akippa」' },
        { name: 'ラクサス・テクノロジーズ株式会社', detail: 'ブランドバッグのサブスク「Laxus」' },
        { name: '株式会社i-plug', detail: '新卒採用の「OfferBox」' },
        { name: '株式会社EventHub', detail: '法人イベントのDX' },
      ],
      note: '数字と掲載企業は、ミラエラの公表情報にもとづきます。取材の可否と時期は、ミラエラの方針によります。',
    },
    partnerLogos: {
      title: 'Baton Partnersに、{載っている会社}。',
      lead: '公開しているページは、どれも1社ずつ、色と書体を決めてつくっています。',
      items: [
        { name: '株式会社エボルグ', no: 'BP-001', href: '/evorg/', tint: '#e83c4f', logo: { src: '/partners/evorg/logo-light.png', size: [517, 137] } },
        { name: '株式会社Central AX', no: 'BP-002', href: '/central-ax/', tint: '#5b6170', logo: { src: '/partners/central-ax/logo-white.png', size: [691, 210] } },
        { name: '株式会社Smartaleck', no: 'BP-005', href: '/smartaleck/', tint: '#1f92ca', logo: { src: '/partners/smartaleck/logo-light.png', size: [800, 126] } },
      ],
      note: 'ロゴと社名は、各社の了承を得て掲載しています。',
    },
    crate: {
      label: 'Music Japanの公式サイトへ',
      href: 'https://music-japan.com/',
      items: [
        '/partners/music-japan/jackets/tokyo-junkies.webp',
        '/partners/music-japan/jackets/kokoni-aru.webp',
        '/partners/music-japan/jackets/beach-sunset.webp',
        '/partners/music-japan/jackets/late-night-jazz.webp',
        '/partners/music-japan/jackets/fairytale-classical.webp',
        '/partners/music-japan/jackets/soft-rain-piano.webp',
        '/partners/music-japan/jackets/all-i-need.webp',
        '/partners/music-japan/jackets/i-know-but-tried.webp',
        '/partners/music-japan/jackets/like-a-drug.webp',
      ],
    },
  },

  about: {
    title: ['会う前に、', '{読んでもらう}。'],
    lead: '合同会社Music Japanは、大阪・梅田の会社です。会社と経営者のページをつくり、検索で見つかるように整えて、話してみたい人どうしをおつなぎしています。Baton Partnersは、そのうち会社のためのサービスです。',
    story: [
      {
        heading: 'ページは、会う前の名刺がわり',
        body: '知らない会社から連絡が来たら、たいていの人はまず名前で検索します。そこで中身のあるページが出てくれば、話は早い。何も出てこなければ、そこで終わることもあります。Baton Partnersのページは、その最初の数分のためにあります。',
      },
      {
        heading: 'つなぐ前に、こちらで読む',
        body: '問い合わせを全部そのまま流すと、掲載している会社は営業メールの対応に追われます。だから相談は、まずMusic Japanが読みます。合いそうな相談だけを、先方に確かめてから渡す。手間はかかりますが、つないだあとの話が進みやすくなります。',
      },
      {
        heading: '1社ずつ、見た目を変える',
        body: 'エボルグのページは紙と明朝体、Central AXは白黒の建築模型、Smartaleckは漫画のヒーロー。どれも、その会社のロゴと、代表がよく使う言葉から決めました。同じ型の色違いにすると、どの会社も同じに見えてしまうからです。',
      },
    ],
    stanceTitle: '決めていること',
    stance: [
      { title: '最初に、話を聞く', detail: '取材と同じで、まずは御社の話を聞くところから始めます。公式サイトに載っていない話ほど、ページの芯になります。', bot: 'mic' },
      { title: '書けることだけ書く', detail: '数字や実績は、公表されているものだけを使います。確かめられなかったことは書きません。', bot: 'reel' },
      { title: '1社ずつ、見た目を変える', detail: '色と書体と動きは、ロゴと会社の言葉から決めます。ほかの会社の色違いには、しません。', bot: 'pod' },
      { title: '紹介は人が決める', detail: '受付と通知は仕組みに任せて、誰と誰をつなぐかは、毎回、人が決めます。', bot: 'tune' },
      { title: '公開してからも育てる', detail: '記事を足したり、実績が増えたら書き換えたり。ページは、公開した日がいちばん古い状態です。', bot: 'spin' },
    ],
  },

  service: {
    name: 'Baton Partners',
    logo: '/brand/baton-partners-logo-white.svg',
    logoAlt: 'Baton Partners',
    logoSize: [330, 64],
    category: '{専用LP・}{SEO・}{AIO・}{紹介}',
    tagline: '見つけてもらって、紹介でつなぐ。',
    description:
      'Baton Partnersは、会社ごとの専用ページを5枚つくり、検索とAIの答えに出るよう整え、読んだ人からの相談をMusic Japanが確かめておつなぎするサービスです。ページづくりから紹介までを、ひとつの窓口で引き受けます。',
    url: 'https://partners.music-japan.com/',
    solutions: [
      { problem: '社名で検索しても、公式サイトしか出てこない', answer: '公式サイトの隣に並ぶ、御社を説明するページを5枚つくる', feature: '専用LP' },
      { problem: 'ホームページに来た人が、何も聞かずに帰っていく', answer: 'お客さんの悩みから入る記事を書き、サービスと相談へつなげる', feature: 'SEO記事' },
      { problem: 'AIに業界名で聞いても、名前が挙がらない', answer: '問いと答え、構造化データ、llms.txtで、AIが読める形に整える', feature: 'AIO' },
      { problem: '紹介が、たまにしか来ない', answer: 'ページを読んで興味を持った人を、Music Japanが確かめてからおつなぎする', feature: '紹介' },
    ],
    flow: [
      { stage: '話を聞く', en: 'Step 01', feature: 'まずはオンラインで' },
      { stage: '調べる', en: 'Step 02', feature: '公式サイトと資料を読む' },
      { stage: 'つくる', en: 'Step 03', feature: '色・書体・3D・文章' },
      { stage: '公開する', en: 'Step 04', feature: '5ページと記事を公開' },
      { stage: 'つなぐ', en: 'Step 05', feature: '紹介と、記事の追加' },
    ],
    features: [
      { en: '5 Pages', title: '専用ページ5枚', detail: 'トップ、取り組み、記事、サービス、話してみる。御社のことが、ひと通りわかる枚数です。' },
      { en: 'Design', title: '色と書体と3D', detail: 'ロゴの色から配色を決め、書体と3Dの演出も御社のためにつくります。スマホでも1画面ずつ確かめます。' },
      { en: 'SEO', title: '検索の土台', detail: 'タイトル、説明文、見出し、内部リンク、sitemap.xml。検索エンジンに正しく読まれるための基本を、全ページでそろえます。' },
      { en: 'Article', title: '悩みから入る記事', detail: 'お客さんが検索しそうな悩みを選び、記事を1本書きます。数字と事例は、公表されているものだけを使います。' },
      { en: 'AIO', title: 'AIに読まれる形', detail: 'ページ冒頭の問いと答え、構造化データ、よくある質問、llms.txt。ChatGPTやGeminiが答えをつくるときに拾いやすくします。' },
      { en: 'Referral', title: '人が確かめる紹介', detail: '相談はMusic Japanが先に読み、双方の了承を得てからLINEでおつなぎします。御社には通知と受付番号が届きます。' },
    ],
    fits: [
      'いい仕事をしているのに、社名で検索しても情報が少ない',
      'ホームページはあるけれど、問い合わせにつながっていない',
      'ChatGPTに業界名で聞いても、自社の名前が出てこない',
      '紹介で決まる仕事が多く、その入口を増やしたい',
      '記事を書きたいけれど、社内に書く人も時間もない',
      '営業メールばかり届く問い合わせ窓口に、疲れている',
    ],
    onboarding: [
      { title: 'まずは公式サイトから', detail: '公式サイト、会社案内、代表のインタビュー記事。公開されているものを先に読んでから、お話を伺います。', bot: 'reel' },
      { title: '用意してもらうものは、少しだけ', detail: 'ロゴのデータと、載せてよい実績や写真。文章と画像の手配は、こちらで進めます。', bot: 'tune' },
      { title: '公開したあとも', detail: '記事を足したり、実績が増えたら書き換えたり。ページは公開してからも育てます。', bot: 'spin' },
      { title: '取材の相談も', detail: 'ご希望があれば、経営者メディア『ミラエラ』のインタビューもご案内します。', bot: 'mic' },
    ],
    labels: {
      flowKicker: 'Process',
      flowTitle: '話を聞いてから、公開するまで。',
      featuresTitle: 'Baton Partnersで、つくるもの',
      statsTitle: 'ページの裏側を、数字で',
      onboardingTitle: '始める前に、よく聞かれること。',
      fitsTitle: 'こんな会社に、向いています。',
    },
    clients: ['構造化データ', 'llms.txt', 'robots.txt', 'sitemap.xml', 'FAQ', 'OGP', 'IndexNow', 'BudouX', 'three.js'],
    clientsNote: 'ページの裏側で、使っているもの。',
  },

  insight: {
    slug: 'more-inquiries',
    category: 'Web集客・SEO',
    title: 'ホームページから問い合わせが来ない会社が、最初に見直す4つのこと',
    description:
      '問い合わせが増えないとき、原因はデザインより「見つからない」「読む理由がない」「AIに拾われない」「相談しにくい」のどれかにあることが多いです。自分で確かめる方法と、直す順番をまとめました。',
    published: '2026-10-02',
    readingMinutes: 8,
    lead: 'ホームページをつくり直したのに、問い合わせが増えない。経営者の方から、よく聞く話です。中身を見せてもらうと、デザインに問題がある会社はあまり多くありません。多いのは、そもそも見つかっていないか、見つかっても読む理由がないか、のどちらかです。この記事では、自分で確かめる方法と、直す順番を書いていきます。',
    keyPoints: [
      'ホームページから問い合わせが来ない原因は、多くの場合「見つからない」「読む理由がない」「AIに拾われない」「相談しにくい」のどれかです。',
      'まず社名と、お客さんが使う悩みの言葉で検索して、自社のページが何番目に出るかを確かめます。',
      '会社案内だけのサイトは、悩みで検索する人に届きません。悩みから入る記事を1本書くと、入口が増えます。',
      'ChatGPTなどのAI検索に名前が挙がるには、ページの冒頭で問いに答え、構造化データで会社の情報をつなぐことが土台になります。',
      '問い合わせフォームの手前に「誰が読むのか」「次に何が起きるのか」を書くと、相談しやすくなります。',
    ],
    sections: [
      {
        id: 'check',
        heading: 'まず、自社の状況を確かめる',
        blocks: [
          { type: 'p', text: 'パソコンでもスマホでもかまいません。5分ほどで終わります。当てはまるものに、印をつけてみてください。' },
          {
            type: 'check',
            items: [
              '社名で検索すると、公式サイトが1ページ目の上のほうに出る',
              'お客さんが使う悩みの言葉で検索すると、自社のページがどこかに出る',
              'ChatGPTに「（地域）で（業種）の会社は？」と聞くと、自社の名前が挙がる',
              'ホームページに、お客さんの悩みに答えるページが1枚以上ある',
              '問い合わせフォームの近くに、送ったあとの流れが書いてある',
            ],
          },
          { type: 'p', text: '印がつかなかった項目が、伸びしろです。上から順に見ていきます。' },
        ],
      },
      {
        id: 'found',
        heading: '見つからない：社名で検索されたときの入口が足りない',
        blocks: [
          { type: 'p', text: '社名で検索しても出てこない場合、まず疑うのはページの数と中身です。会社案内が1枚あるだけだと、検索エンジンが「この会社は何をしているのか」を判断する材料が足りません。' },
          { type: 'p', text: '公式サイトとは別に、会社を説明するページがもう1つあると、社名で検索したときの選択肢が増えます。名刺を受け取った人が帰りの電車で検索したとき、中身のあるページが2つ並んでいる。それだけで、受け取る印象はかなり変わります。' },
          { type: 'callout', title: 'ひとことで言えば', text: '社名で検索されたときに、読む価値のあるページが並んでいるか。最初に確かめるのはここです。' },
        ],
      },
      {
        id: 'read',
        heading: '読む理由がない：会社案内は、悩みで探す人に届かない',
        blocks: [
          { type: 'p', text: 'お客さんが検索窓に打ちこむのは、たいてい社名ではなく悩みです。「求職者 管理 スプレッドシート 限界」「生成AI 社内 定着しない」。こうした言葉で探している人は、まだ御社の名前を知りません。' },
          { type: 'p', text: 'そこに届くのは、悩みに正面から答える記事です。原因を書き、自分で確かめる方法を書き、最後に相談先のひとつとして自社を紹介する。売り込みは、最後の数行で足ります。' },
          {
            type: 'table',
            head: ['会社案内だけのサイト', '悩みから入る記事があるサイト'],
            rows: [
              ['社名を知っている人しか来ない', '悩みで検索した人が来る'],
              ['事業内容を並べて終わる', '原因と確かめ方を書いてから、サービスへ'],
              ['問い合わせる理由が見えにくい', '読んだあとに、相談する理由が残る'],
            ],
          },
        ],
      },
      {
        id: 'ai',
        heading: 'AIに拾われない：答えの形で書かれていない',
        blocks: [
          { type: 'p', text: 'ChatGPTやGemini、Perplexityで調べものをする人が増えました。AIは答えをつくるときにウェブのページを読み、引用しやすいところを探します。Googleも、AIによる概要に出るために特別な対策はいらず、検索の基本を守ることが大事だと説明しています。' },
          { type: 'p', text: 'そのうえで、AIに拾われやすいページには共通点があります。' },
          {
            type: 'list',
            items: [
              'ページの冒頭で、問いに一言で答えている',
              '会社名、所在地、代表者、事業内容が、構造化データでつながっている',
              'よくある質問が、質問と答えの形で並んでいる',
              'AIのクローラーを、robots.txtで締め出していない',
            ],
          },
          { type: 'p', text: 'どれも、特別な技術というより書き方の問題です。ただ、全部をそろえるには手間がかかります。' },
        ],
      },
      {
        id: 'ask',
        heading: '相談しにくい：送ったあとが見えない',
        blocks: [
          { type: 'p', text: '問い合わせフォームだけがぽつんと置いてあると、送る側は身構えます。送ったら、営業の電話が何度もかかってくるかもしれないと考えるからです。' },
          { type: 'p', text: 'フォームの手前に、誰が読むのか、いつ返事が来るのか、何を聞かれるのかを書いておく。それだけで、ずいぶん送りやすくなります。' },
        ],
      },
      {
        id: 'baton-partners',
        heading: '4つをまとめて引き受ける、Baton Partners',
        blocks: [
          { type: 'p', text: '[Baton Partners](/music-japan/service/)は、大阪・梅田の[合同会社Music Japan](/music-japan/about/)が運営するサービスです。会社ごとに専用のページを5枚つくり、検索とAIの両方に読まれる形に整え、読んだ人からの相談を確かめておつなぎします。' },
          {
            type: 'list',
            items: [
              '専用LP：トップ、取り組み、記事、サービス、話してみるの5ページ',
              'SEO：悩みの言葉から書く記事と、タイトル・説明文・内部リンク',
              'AIO：冒頭の問いと答え、構造化データ、llms.txt',
              '紹介：相談はMusic Japanが先に読み、双方の了承を得てからおつなぎ',
            ],
          },
          { type: 'p', text: 'いま公開しているページは、[エボルグ](/evorg/)、[Central AX](/central-ax/)、[Smartaleck](/smartaleck/)の3社です。どれも、その会社のロゴと言葉から色と書体を決めています。' },
        ],
      },
      {
        id: 'summary',
        heading: 'まずは、社名で検索してみる',
        blocks: [
          { type: 'p', text: '問い合わせを増やす方法は、たくさんあります。ただ、順番を間違えると、お金をかけても手応えが出ません。まず見つかるようにして、それから読む理由をつくる。相談の受け皿を整えるのは、そのあとでかまいません。' },
          { type: 'p', text: '手始めに、社名と、お客さんが使いそうな悩みの言葉で、検索してみてください。' },
          { type: 'p', text: '結果を見て気になったことがあれば、[Music Japanと話してみる](/music-japan/contact/)ページから日程を選べます。' },
        ],
      },
    ],
    sources: [
      { label: 'Google 検索セントラル「SEO スターター ガイド」', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
      { label: 'Google 検索セントラル「AI 機能とウェブサイト」', url: 'https://developers.google.com/search/docs/appearance/ai-features' },
      { label: 'Google 検索セントラル ブログ「AI 検索でコンテンツを成功させるためのヒント」（2025年5月）', url: 'https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search' },
      { label: 'Google 検索セントラル「組織（Organization）の構造化データ」', url: 'https://developers.google.com/search/docs/appearance/structured-data/organization' },
      { label: 'llms.txt の提案仕様', url: 'https://llmstxt.org/' },
    ],
  },

  contact: {
    questions: [],
    booking: {
      url: 'https://timerex.net/s/music.japan.llc_5445/2f8e527f',
      service: 'TimeRex',
      steps: [
        { title: '日程を選ぶ', detail: 'TimeRexの予約ページで、空いている日時を選びます。' },
        { title: '確認のメールが届く', detail: '予約が確定すると、TimeRexから確認のメールが届きます。' },
        { title: 'オンラインで話す', detail: 'お話しするのは代表の壁谷です。いまの集客のことと、困っていることを聞かせてください。' },
      ],
      faq: [
        {
          q: 'どんな話をしますか。',
          a: 'いまの集客の状況と、困っていることを伺います。そのうえで、御社のページをつくるなら何を書くかを、具体的にお話しします。',
        },
        {
          q: '掲載している会社と話してみたいときは？',
          a: '[エボルグ](/evorg/contact/)、[Central AX](/central-ax/contact/)、[Smartaleck](/smartaleck/contact/)など、各社のページにある「話してみる」から相談できます。',
        },
        { q: 'ミラエラの取材について聞くこともできますか。', a: 'できます。取材の流れや、どんな記事になるのかをお話しします。' },
      ],
      alt: '日程が合わないときは、[公式LINE](https://lin.ee/YPbe3ti)か、メール（music.japan.llc@gmail.com）でご連絡ください。',
    },
  },

  faq: [
    {
      q: 'Baton Partnersとは、何ですか。',
      a: '合同会社Music Japanが運営する法人向けのサービスです。会社ごとに専用のページを5枚つくり、SEOとAIO（AI検索への対策）で見つかるように整え、ページを読んで興味を持った人を、Music Japanが確かめてからおつなぎします。',
    },
    {
      q: '公式サイトがあるのに、別のページをつくる意味はありますか。',
      a: '社名で検索されたとき、公式サイトの隣に御社を説明するページが並ぶので、入口が増えます。記事のページは、まだ社名を知らない人が悩みの言葉で探したときの入口になります。',
    },
    {
      q: 'ページは、どこに公開されますか。',
      a: 'https://partners.music-japan.com/ の下に、御社の名前のURLで公開します。たとえばエボルグなら /evorg/ です。',
    },
    {
      q: 'AIO（AI検索への対策）では、何をしますか。',
      a: 'ページの冒頭に問いと一言の答えを置き、会社名・所在地・代表者・サービスを構造化データでつなぎます。よくある質問とllms.txtも用意し、ChatGPTやGeminiなどのクローラーをrobots.txtで許可しています。AIの答えに必ず載るとは約束できませんが、読まれるための土台はそろえます。',
    },
    { q: '検索の順位は、保証されますか。', a: '順位はお約束できません。検索エンジンの決まりに沿って、読まれるページをつくることに力を使います。' },
    {
      q: '紹介は、どう届きますか。',
      a: 'ページの「話してみる」から届いた相談は、まずMusic Japanが読みます。御社には「1件届いた」という通知と受付番号が届き、内容を確かめたうえで、双方が了承したらLINEのグループでおつなぎします。',
    },
    { q: 'ミラエラのインタビューは、必ず受けられますか。', a: 'ご希望があればご案内しますが、取材の可否と時期は、ミラエラの方針によります。' },
    { q: 'どんな会社に向いていますか。', a: 'いい仕事をしているのに名前が知られていない会社や、紹介で決まる仕事が多い会社です。業種と地域は限っていません。' },
  ],

  seo: {
    top: {
      title: 'Baton Partners｜専用LP・SEO・AIO・紹介で問い合わせを増やす',
      description:
        'Baton Partners（バトンパートナーズ）は、大阪・梅田の合同会社Music Japanが運営する法人向けサービスです。会社ごとの専用ページを5枚つくり、検索とAIの答えに出るよう整え、読んだ人からの相談をおつなぎします。代表は壁谷友生。',
      answer: {
        q: 'Baton Partnersとは？',
        a: 'Baton Partners（バトンパートナーズ）は、合同会社Music Japan（大阪・梅田、代表社員 壁谷友生）が運営する法人向けのサービスです。会社ごとに専用のページを5枚つくり、SEOとAIO（AI検索への対策）で見つかるように整え、ページを読んで興味を持った人を、Music Japanが内容を確かめてからおつなぎします。',
      },
    },
    about: {
      title: '合同会社Music Japanとは｜代表 壁谷友生とBaton Partners',
      description:
        '合同会社Music Japanは、大阪・梅田の会社です。代表社員は壁谷友生。会社の専用ページと紹介「Baton Partners」、経営者の招待制プロフィール「Baton」を運営し、経営者メディア『ミラエラ』の認定インタビュアーとしても取材をしています。',
      answer: {
        q: '合同会社Music Japanは、どんな会社？',
        a: '大阪市北区梅田に拠点を置く会社です。代表社員は壁谷友生（かべや ともき）。法人向けの「Baton Partners」で会社ごとの専用ページをつくり、検索とAIの答えに出るよう整えて、話してみたい人どうしをおつなぎしています。壁谷は経営者メディア『ミラエラ』の認定インタビュアーでもあります。',
      },
    },
    service: {
      title: 'Baton Partnersのサービス内容｜専用LP・SEO・AIO・紹介',
      description:
        '1社につき5枚の専用ページ、悩みの言葉から書くSEO記事、AI検索に読まれる構造化データとllms.txt、Music Japanが確かめてからの紹介。Baton Partnersで引き受けることと、公開までの流れをまとめました。',
      answer: {
        q: 'Baton Partnersには、何を頼める？',
        a: '会社ごとの専用ページ5枚（トップ・取り組み・記事・サービス・話してみる）の制作、悩みの言葉から書くSEO記事、AI検索に読まれるための構造化データやllms.txtの整備、そしてページから届いた相談の確認とおつなぎです。ご希望があれば、経営者メディア『ミラエラ』のインタビューもご案内します。',
      },
    },
    contact: {
      title: 'Music Japanと話してみる｜Baton Partnersのご相談',
      description:
        'Baton Partnersのご相談は、TimeRexの予約ページで空いている日時を選んでいただく形で受けています。お話しするのは、合同会社Music Japan代表の壁谷友生です。',
      answer: {
        q: 'Baton Partnersの相談は、どう申し込む？',
        a: 'このページの「日程を選ぶ」から、TimeRexの予約ページで空いている日時を選んでください。予約が確定すると確認のメールが届き、オンラインで代表の壁谷友生がお話を伺います。',
      },
    },
    insightTitle: 'ホームページから問い合わせが来ない4つの理由と、直す順番',
    insightQuestion: 'この記事の要点',
    updated: '2026-10-02',
    org: {
      type: 'Organization',
      address: { region: '大阪府', locality: '大阪市北区', street: '梅田1丁目2番2号 大阪駅前第2ビル12-12' },
      leader: { name: '壁谷友生', jobTitle: '代表社員', relation: 'founder' },
      sameAs: ['https://music-japan.com/', 'https://x.com/Music_Japan_LLC', 'https://www.instagram.com/music.japan.llc2/'],
      areaServed: ['日本'],
    },
    serviceType: 'Service',
  },
};
