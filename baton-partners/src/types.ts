/**
 * Baton Partners の企業サイトは「1テンプレート × 企業データ」で動く。
 * 企業を増やすときは src/partners/<slug>.ts を1つ足して、partners/index.ts に登録するだけ。
 */

export type Bot = 'tune' | 'spin' | 'pod' | 'reel' | 'mic';

/** bot を入れると、その項目に Music Japan のロボット（公式サイトの5体）が付く（needle の世界観） */
export type Pair = { title: string; detail: string; bot?: Bot };

export type Stat = { label: string; value: string; unit: string; note?: string };

/** 記事本文のブロック。本文中の **強調** は太字になる */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'check'; items: string[] }
  | { type: 'callout'; title: string; text: string }
  | { type: 'table'; head: [string, string]; rows: [string, string][] }
  | { type: 'numbered'; items: Pair[] };

export type ArticleSection = { id: string; heading: string; blocks: Block[] };

/** 検索結果に出す title と description、ページ冒頭の「一言で答える」要約 */
export type PageSeo = {
  /** <title>。全角30字前後。見込み客が検索する言葉を入れる */
  title: string;
  /** meta description。全角80〜120字。ページの中身を正確に要約する */
  description: string;
  /** ページ冒頭に置く「問い」と「一言の答え」。AIが抜き出しやすいよう、単独で意味が通る文にする */
  answer: { q: string; a: string };
};

export type Question = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  options: string[];
};

export type Partner = {
  slug: string;
  /** 先方の確認前。true の間はプレビューにだけ出し、本番ビルドには含めない（partners/index.ts） */
  draft?: boolean;
  /**
   * 運営会社（Music Japan）自身のページ。true のとき：
   *   - 構造化データの会社は music-japan.com の @id（運営者と同じノード）を使う
   *   - 一覧（パートナー企業のカタログ）には並べず、BP-000 として別枠で案内する
   *   - 「パートナー企業です」「Music Japanが確認してから先方へ」の定型文を出さない
   */
  operator?: boolean;
  /** 掲載番号。music-japan.com/partners と同じ「BP-001」の形で表示する */
  no: string;
  /** 一覧（music-japan.com/partners と同じカタログ）に出す拠点と事業の分類 */
  catalog: {
    base: string;
    category: string;
    /** 一覧のカードに出す一言と紹介文（music-japan.com/partners と同じ文言） */
    catch: string;
    lead: string;
    /** カードの SERVICE 欄。本体サイトで出していない会社は省く */
    service?: string;
    /** 一覧の流れるロゴ帯に出す、黒背景用のロゴ */
    logos: { src: string; alt: string; size: [number, number] }[];
  };
  company: {
    name: string;
    nameEn: string;
    url: string;
    /** 会社概要の表。確認できた項目だけ載せる */
    profile: { label: string; value: string; url?: string }[];
  };
  brand: {
    primary: string;
    accent: string;
    /** public/ 以下のロゴ画像（背景透過） */
    logo: string;
    logoAlt: string;
    /** ロゴ画像の実寸（幅, 高さ）。レイアウトのずれ防止用 */
    logoSize: [number, number];
    /** WebGLシーンの色。a=求職者の点、b=求人の輪、match=決定したとき */
    scene: { a: string; b: string; match: string };
  };
  /**
   * 世界観。企業のロゴ・トーン＆マナーに合わせて、見た目と演出を切り替える。
   *   theme  'editorial' … 紙と墨、明朝＋イタリック（エボルグ）
   *          'mono'      … モノクロ、太いゴシック、グリッドと四角い枠（Central AX）
   *          'console'   … 監視画面と設計図。等幅の英字、ステータス表示、紺と復旧の緑（DPパートナーズ）
   *          'minka'     … 古民家と縁。朱と墨と生成り、明朝、麻の葉・格子・赤い糸・判子・縦書き（Cominka）
   *          'needle'    … 公式サイト（music-japan.com）の NEEDLE DROP。黒地に赤、Archivo＋Zen Kaku Gothic New＋JetBrains Mono、レコード・ジャケット・ロボット5体（Music Japan）
   *          'studio'    … 撮影スタジオと漫画のヒーロー。墨とロゴの青、極太の見出し、網点・集中線・ファインダー・吹き出し（Smartaleck）
   *          'match'     … Empro のロゴ（赤と水色の三角が重なる）。白地に赤・水色・重なりのワイン、丸ゴシックの見出し、
   *                        通知のトースト・選考ボード・面談の記録カード（エボルグ）
   *   scene  'network'   … 点と線の球体（集める→つなぐ→決める）
   *          'pair'      … 赤い三角（求職者）と水色の三角（求人）。散らばる→表に並ぶ→線でつながる→重なって大きな Empro の印になる
   *          'lattice'   … 立方体の建築模型（散らばる→組み上がる→スキャンされ光の柱が立つ）
   *          'vault'     … サーバーの引越し（移す→守る→戻す。壊れても、別の場所の控えから戻る）
   *          'en'        … 縁（散らばった検索の札が格子に並び、赤い糸で一つのサイトに結ばれる）
   *          'feed'      … 画面の壁（散らばったリール・動画・トーク画面が壁に並び、集中線になって中心の一点に集まる）
   *          'vinyl'     … 公式シンボルのレコード（CUTで溝が刻まれ、SPINでジャケットが回り、DROPで針が落ちて波形になる）
   */
  world: {
    theme: 'editorial' | 'mono' | 'console' | 'minka' | 'studio' | 'needle' | 'match';
    scene: 'network' | 'lattice' | 'vault' | 'en' | 'feed' | 'vinyl' | 'pair';
  };
  /** 代表の紹介（写真がある企業だけ）。発言は作らず、公開されている事実だけを書く */
  leader?: {
    name: string;
    nameEn: string;
    role: string;
    /** 写真がない企業は、写真の代わりに経歴の年表を出す（timeline） */
    photo?: string;
    photoSize?: [number, number];
    timeline?: { year: string; text: string }[];
    body: string[];
    motto?: { label: string; text: string };
  };
  top: {
    title: string[];
    lead: string;
    /** ヒーロー下の小さなバッジ（公式サイトの表記どおり） */
    badges: string[];
    /** ヒーロー直後に流れる英字の帯 */
    marquee: string[];
    /** 数字セクションの見出し */
    numbersTitle: string;
    verbs: { en: string; ja: string; title: string; body: string }[];
    problemsTitle: string;
    problems: Pair[];
    stats: Stat[];
    statsNote: string;
    aboutQuote: string;
    /** 引用の出どころ（公開済みの本人コメントを引くときは必ず書く） */
    aboutQuoteCite?: string;
    /** 看板機能を1つ大きく見せる帯（エボルグなら休眠求職者の掘り起こし） */
    highlight: { en: string; title: string[]; lead: string; steps: Pair[]; note: string };
    /** ヒーローに添える作業ログ風の一覧（console の世界観）。数字は入れず、扱う作業の名前だけ */
    console?: { label: string; lines: { k: string; v: string; ok?: boolean }[] };
    /** 公式サイトに掲載されているお客様の声（掲載許可を得たものとして公表されている範囲で、出典つき） */
    voices?: { title: string; note: string; items: { who: string; text: string }[] };
    /** 公開されている導入事例（企業名・期間・比較条件つき）。数字はグラフで見せる */
    cases?: {
      title: string;
      note: string;
      items: {
        company: string;
        industry: string;
        headline: string;
        period: string;
        url: string;
        /** 大きく見せる数字。kind=up は「＋◯％」、ratio は「前と比べて◯％」、rank は「◯位 → ◯位」 */
        metrics: { label: string; kind: 'up' | 'ratio' | 'rank' | 'count'; value: number; from?: number; unit?: string }[];
        /** 横棒グラフ（前年比の増加率など）。棒の長さは最大値に合わせる */
        bars?: { title: string; items: { label: string; value: number }[] };
        did: string[];
      }[];
    };
    /** 検索結果の画面に、どの施策がどこで効くかを重ねた図（イメージ図） */
    serp?: { title: string; lead: string; query: string; rows: { kind: 'ai' | 'ad' | 'map' | 'organic'; label: string; service: string; note: string }[]; note: string };
    /** 自社開発のプロダクト（あれば）。受賞は公表された部門名のまま */
    product?: { name: string; lead: string; features: string[]; awards: { title: string; items: string[] }[]; note: string };
    /** 経営理念を大きく見せる帯（縦書きの見出しと、価値観の札） */
    mission?: { glyph: string; title: string; body: string; values: string[]; note: string };
    /** 取材・登壇・提携など、外から見た実績（第三者の掲載とプレス配信は分けて書く） */
    media?: { title: string; items: { kind: string; title: string; by: string; date: string; url?: string }[] };
    /** ヒーローの見出しの上に置く、大きな英字（飾り。読み上げない） */
    display?: string[];
    /** ヒーロー右上の小さな英字の行（needle：公式サイトの「33⅓ RPM / SIDE A」にならう） */
    deck?: string[];
    /**
     * レコードの曲目リスト（needle の世界観）。サービスの中身を A面・B面の曲として並べ、
     * スクロールに合わせて「再生中」の曲が進む（client/tracklist.ts）
     */
    tracklist?: {
      title: string[];
      lead: string;
      jacket: { title: string; sub: string };
      tracks: { no: string; name: string; meta: string; title: string; body: string }[];
      note: string;
    };
    /** 外部メディアの紹介枠（掲載の可能性を伝える。数字と掲載企業は、そのメディアの公表情報だけ） */
    spotlight?: {
      kicker: string;
      title: string[];
      lead: string;
      name: string;
      url: string;
      facts: Stat[];
      questionsTitle: string;
      questions: string[];
      namesTitle: string;
      names: { name: string; detail: string }[];
      note: string;
    };
    /** 掲載中のパートナー企業をレコードのジャケットとして並べる（ロゴは掲載の了承を得たものだけ。黒地用の白抜き版） */
    partnerLogos?: {
      title: string;
      lead: string;
      items: { name: string; no: string; href?: string; status?: string; tint: string; logo: { src: string; size: [number, number] } }[];
      note: string;
    };
    /** ジャケット写真の棚（公式サイトのジャケット。飾りとして流す） */
    crate?: { label: string; href: string; items: string[] };
    /** ヒーローに添える「よく届く相談」の吹き出し。1つずつ入れ替わる（studio の世界観） */
    ticker?: { label: string; items: string[] };
    /** お客さんが会社に出会う画面ごとに、どの施策が効くかを並べた図（イメージ図） */
    channels?: {
      title: string;
      lead: string;
      items: { kind: 'reel' | 'video' | 'influencer' | 'line' | 'ai'; label: string; service: string; note: string }[];
      note: string;
    };
    /** 代表の横長の写真と、会社の歩み（ファインダー越しに見せる）。写真は本人・会社から受け取ったものだけ */
    film?: {
      kicker: string;
      title: string;
      body: string[];
      photo: { src: string; small: string; size: [number, number]; alt: string; focus: [number, number] };
      timeline: { year: string; text: string }[];
      caption: string;
    };
    /** ヒーローに添える、システムの通知（イメージ）。1つずつ入れ替わる（match の世界観） */
    activity?: { label: string; items: { tag: string; text: string; meta: string }[]; note: string };
    /**
     * 選考ボード（イメージ図）。列＝選考の段階、カード＝求職者。
     * 左の「眠っている」列のカードが、通知で目を覚まして面談の列へ戻る。callouts はボードのどこに機能が効くか
     */
    board?: {
      title: string;
      lead: string;
      sleep: { name: string; en: string };
      columns: { name: string; en: string }[];
      /** 目を覚ましたカードが戻る列の番号（columns の何番目か） */
      backTo: number;
      cards: { col: number; name: string; meta: string; tag?: string }[];
      sleepers: { name: string; meta: string; days: number }[];
      callouts: { label: string; title: string; text: string }[];
      note: string;
    };
    /** 公開されている導入事例を、取材記事のように1社深く。発言は公開された記事の原文のまま（出典つき） */
    story?: {
      title: string;
      company: string;
      industry: string;
      url: string;
      date: string;
      pull: string;
      who: string;
      profile: string;
      interviewer?: string;
      rows: { label: string; items: string[] }[];
      quotes: { text: string; context: string }[];
      /** 記事で語られている機能を、小さな画面の動きで見せる（イメージ） */
      demo?: { label: string; files: string[]; seconds: number; fields: string[] };
      note: string;
    };
    /** 市場の数字を、100個の点で見せる（share 個に色がつく）。数字は公表済みのものだけ */
    market?: {
      title: string;
      lead: string;
      big: { value: string; unit: string; label: string };
      share: number;
      shareLabel: string;
      restLabel: string;
      facts: Stat[];
      note: string;
    };
    /** 代表の歩みを、トップで大きく見せる（leader の写真・年表・本文を使う）。partner は共同代表など */
    founder?: {
      kicker: string;
      title: string;
      quote?: { text: string; cite: string };
      partner?: { name: string; role: string; body: string };
      links?: { label: string; url: string }[];
    };
    /** 端末の画面で、AIに頼む様子を1行ずつ見せる（イメージ。実際の製品の画面ではない） */
    terminal?: {
      title: string;
      lead: string;
      file: string;
      lines: { who: 'you' | 'ai' | 'ok' | 'ask'; text: string }[];
      points: Pair[];
      note: string;
    };
    /** 拠点を中心にした同心円の地図（イメージ図。方角は実際の地理に合わせ、距離は輪の段で表す） */
    radar?: {
      title: string;
      lead: string;
      center: { name: string; sub: string };
      rings: string[];
      /** ring が -1 の点は地図に描かず、横の一覧にだけ出す（真ん中に近すぎる場所など） */
      points: { name: string; sub: string; bearing: number; ring: number; event?: string }[];
      note: string;
    };
    /** 登壇・主催・共催・伴走の記録を、チケットのようなカードで（公開されている告知の範囲で） */
    events?: {
      title: string;
      lead: string;
      items: {
        date: string;
        kind: string;
        title: string;
        host: string;
        body: string;
        figure?: { value: string; unit: string; label: string };
        art: 'ledger' | 'shield' | 'office' | 'hall' | 'cheers' | 'studio';
        url?: string;
      }[];
      note: string;
    };
  };
  about: {
    title: string[];
    lead: string;
    story: { heading: string; body: string }[];
    stanceTitle: string;
    stance: Pair[];
  };
  service: {
    name: string;
    /** サービスのロゴ（背景透過）。暗い背景では白いプレートに載せる */
    logo: string;
    logoAlt: string;
    logoSize: [number, number];
    category: string;
    tagline: string;
    description: string;
    url: string;
    solutions: { problem: string; answer: string; feature: string }[];
    flow: { stage: string; en: string; feature: string }[];
    features: (Pair & { en: string })[];
    fits: string[];
    /** 導入・サポート */
    onboarding: Pair[];
    /** サービスページの各見出し。企業ごとに言い回しを変える */
    labels: {
      flowKicker: string;
      flowTitle: string;
      featuresTitle: string;
      statsTitle: string;
      onboardingTitle: string;
      fitsTitle: string;
    };
    /** 公式サイトに掲載されている利用企業（テキストで流す） */
    clients: string[];
    clientsNote: string;
  };
  insight: {
    slug: string;
    category: string;
    title: string;
    description: string;
    published: string;
    readingMinutes: number;
    lead: string;
    /** 記事冒頭の「この記事の要点」。1項目で意味が通る文にする */
    keyPoints: string[];
    sections: ArticleSection[];
    /** 本文の事実・数字・引用の出典（記事の最後に一覧で出す） */
    sources: { label: string; url: string }[];
  };
  contact: {
    questions: Question[];
    /**
     * 予約ページで日程を選んでもらう形（運営会社のページ）。あるときはアンケートの代わりに、
     * 予約ページへのボタンと、日程が決まるまでの流れ・よくある質問を出す
     */
    booking?: {
      url: string;
      service: string;
      steps: Pair[];
      faq: { q: string; a: string }[];
      /** 予約が合わないときの連絡先の案内 */
      alt: string;
    };
  };
  /** サービスについてのよくある質問（サービスページに表示）。答えは公式情報の範囲で書く */
  faq: { q: string; a: string }[];
  /** 検索・AI向けの設計。ページごとの title / description / 要約、構造化データの材料 */
  seo: {
    top: PageSeo;
    about: PageSeo;
    service: PageSeo;
    contact: PageSeo;
    /** 記事の <title>（h1 は insight.title のまま） */
    insightTitle: string;
    /** 記事冒頭の問い（答えは keyPoints） */
    insightQuestion: string;
    /** 内容を最後に大きく見直した日（sitemap の lastmod と dateModified に使う） */
    updated: string;
    /** 構造化データ用。公式サイトの会社概要と同じ表記にする */
    org: {
      type: 'Corporation' | 'Organization';
      address: { region: string; locality: string; street: string };
      /** 代表者。創業が公式に書かれていれば founder、そうでなければ employee */
      leader?: { name: string; jobTitle: string; relation: 'founder' | 'employee' };
      /** 公式サイト・サービスサイトなど、同じ会社を指すURL */
      sameAs: string[];
      /** 提供地域（Service.areaServed） */
      areaServed: string[];
    };
    /** サービスの構造化データの種類。ソフトウェアなら SoftwareApplication */
    serviceType: 'SoftwareApplication' | 'Service';
  };
};
