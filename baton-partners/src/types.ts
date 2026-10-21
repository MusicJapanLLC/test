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
  | { type: 'numbered'; items: Pair[] }
  /** この記事に登場する人：掲載企業の代表のカード（写真・会社名・役職・名前と、取り組みページへのリンク）。text は一言の紹介 */
  | { type: 'person'; text: string };

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
    /**
     * music-japan.com のパートナー欄（レコードのスリーブ）の2色。盤の溝とラベルに使う。
     * 省くと brand.primary / accent。黒地で沈む色の会社だけ明るい色を入れる
     */
    colors?: [string, string];
    /** music-japan.com の英語ページ（/en/partners/）に出す文言。日本語の base / category / catch / lead と同じ内容 */
    en: { name: string; base: string; category: string; catch: string; lead: string };
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
    /** 暗い背景の上（ヒーローが夜の色の世界観）で、スクロール前のヘッダーに出す白抜きのロゴ。logo と同じ実寸 */
    logoOnDark?: string;
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
   *          'cheer'     … 応援と、星をまとったカメ。白地に紺とオレンジ、亀甲（六角形）の地紋、星のきらめき、
   *                        招待状・ステッカー・トレーディングカード・応援ボタン（Presence）
   *          'orbit'     … 絶対値と、波長。白地に ZETTAICHI の紺と n1a の藍・水色・ピンク、惑星の軌道、絶対値の縦棒 | |、
   *                        重なる吹き出し・Big Five の五角形・数直線・プロフィールカード（ZETTAICHI / n1a）
   *          'presto'    … 夜の楽譜と鐘。黒地にロゴの BP の青と鐘の真鍮、明朝＋速度記号のような Bodoni のイタリック、
   *                        五線・速度記号・メトロノーム・8小節のスコア・和音・雑誌の表紙（BE.PRESTO）
   *   scene  'network'   … 点と線の球体（集める→つなぐ→決める）
   *          'pair'      … 赤い三角（求職者）と水色の三角（求人）。散らばる→表に並ぶ→線でつながる→重なって大きな Empro の印になる
   *          'lattice'   … 立方体の建築模型（散らばる→組み上がる→スキャンされ光の柱が立つ）
   *          'vault'     … サーバーの引越し（移す→守る→戻す。壊れても、別の場所の控えから戻る）
   *          'en'        … 縁（散らばった検索の札が格子に並び、赤い糸で一つのサイトに結ばれる）
   *          'feed'      … 画面の壁（散らばったリール・動画・トーク画面が壁に並び、集中線になって中心の一点に集まる）
   *          'vinyl'     … 公式シンボルのレコード（CUTで溝が刻まれ、SPINでジャケットが回り、DROPで針が落ちて波形になる）
   *          'enjin'     … 円陣（縁陣）。六角形のタイル（人）が散らばる→亀甲に並び、縁の糸でつながる→円陣を組んで光る甲羅になる
   *          'wave'      … 波長。人柄の五角形（Big Five）が漂う→惑星の軌道に並び、合う二人を波の糸が結ぶ→重なる吹き出しの点描になる
   *          'bell'      … 鐘。五線から外れて散らばった音符→五線に並んで楽譜になる→集まって鐘の形になり、波紋が広がる
   */
  world: {
    theme: 'editorial' | 'mono' | 'console' | 'minka' | 'studio' | 'needle' | 'match' | 'cheer' | 'orbit' | 'presto';
    scene: 'network' | 'lattice' | 'vault' | 'en' | 'feed' | 'vinyl' | 'pair' | 'enjin' | 'wave' | 'bell';
  };
  /** 代表の紹介（写真がある企業だけ）。発言は作らず、公開されている事実だけを書く */
  leader?: {
    name: string;
    nameEn: string;
    role: string;
    /** 正方形の顔写真（丸く切り抜いて使う：記事の「登場する人」、トップの引用）。なければ photo を使う */
    avatar?: string;
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
    /**
     * 送り状（console の世界観）。ヒーローに貼る、サイトの引越しの伝票（イメージ）。
     * 追跡の欄はトップのステージの段階（0〜3）と同じ数だけ並べ、スクロールに合わせて1つずつ進む。
     * 動きを減らす設定・WebGLなしでは、ヒーローの下に置いた伝票として全部の欄を読める
     */
    waybill?: {
      label: string;
      no: string;
      from: { k: string; v: string };
      to: { k: string; v: string };
      items: string[];
      /** 取扱注意の判子（2〜4字） */
      care: string[];
      track: { en: string; ja: string }[];
      note: string;
    };
    /**
     * 控えの置き場所（console の世界観）。WordPress とバックアップの保管庫を分け、削除の権限を渡さない仕組みの図。
     * 「乗っ取られたら」を押すと、WordPress 側が赤くなり、削除が通らない様子を見せる（client/console.ts）。中身は公式の発表の範囲で
     */
    locker?: {
      kicker: string;
      title: string;
      lead: string;
      server: { name: string; sub: string };
      store: { name: string; sub: string };
      perms: { label: string; ok: boolean }[];
      /** 保管庫の中の、サイトごとの棚 */
      sites: string[];
      attack: { button: string; reset: string; done: string };
      points: Pair[];
      note: string;
      source?: { label: string; url: string };
    };
    /**
     * 切り替えの日（console の世界観）。DNS を切り替えたあと、見に来る人が古いサーバーから新しいサーバーへ
     * 少しずつ移っていく様子（イメージ図）と、引越しの前後で確かめること。手順の詳しい解説は公式の記事へ
     */
    cutover?: {
      kicker: string;
      title: string;
      lead: string;
      old: { name: string; sub: string };
      next: { name: string; sub: string };
      legend: { before: string; after: string };
      steps: { title: string; detail: string; link?: { label: string; url: string } }[];
      note: string;
    };
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
      /** 省くと、公開中の掲載企業（draft を除く）から自動で並べる。企業を足せば、ここにも並ぶ */
      items?: { name: string; no: string; href?: string; status?: string; tint: string; logo: { src: string; size: [number, number] } }[];
      /** 自動で並べるときの、会社ごとのにじみの色（slug → 色）。省くと brand.primary */
      tints?: Record<string, string>;
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
    /**
     * 招待状（cheer の世界観）。コミュニティのきまりを、表と裏のある招待状のカードで見せる。
     * 横には、判子を押された名刺（「名刺交換は、しない」の印）。文言は公開されている告知の範囲で
     */
    invite?: {
      kicker: string;
      title: string;
      lead: string;
      /** 招待状の表（経営者のコミュニティ）と裏（もう一つの会）。押すと返る */
      card: { name: string; sub: string; line: string; serial: string; back: { name: string; sub: string; line: string } };
      rules: { no: string; title: string; text: string }[];
      /** 名刺に押す判子の文字（2〜3字） */
      stamp: string;
      note: string;
    };
    /**
     * 代表のトレーディングカード（cheer の世界観）。表は写真（leader.photo）、裏は公開プロフィールの項目。
     * 写真を受け取る前は、写真待ちの面を出す（作った写真や似顔絵は置かない）
     */
    card?: {
      kicker: string;
      title: string;
      lead: string;
      team: string;
      position: string;
      tags: string[];
      back: { label: string; value: string }[];
      /** カードの表の写真（なければ leader.photo）。focus は object-position（%） */
      photo?: { src: string; size: [number, number]; focus?: [number, number] };
      /** 写真がないときに表に出す一言 */
      pending: string;
      note: string;
    };
    /**
     * チームの写真（cheer の世界観）。ステッカーで留めた大きな写真と、短い本文。
     * 写真は会社から受け取ったものだけ。写っている人の名前は、会社が公開している人だけ書く
     */
    team?: {
      kicker: string;
      title: string;
      body: string[];
      photo: { src: string; small: string; size: [number, number]; alt: string; focus?: [number, number] };
      caption: string;
      tags: string[];
    };
    /**
     * 応援ボタン（cheer の世界観）。押すたびに甲羅の星が一つずつ灯り、紙吹雪が舞う。
     * 押した回数はこの端末の中（localStorage）にだけ残し、どこにも送らない
     */
    cheer?: { kicker: string; title: string; lead: string; button: string; done: string; note: string; link?: { label: string; url: string } };
    /**
     * 絶対値の数直線（orbit の世界観）。会社の PHILOSOPHY を引用し、マイナスの側に置いた言葉が
     * 0 を軸に折り返されて、プラスの側の一つの言葉（value）になる。lines は公式サイトの原文のまま
     */
    absolute?: { kicker: string; title: string; lines: string[]; cite: string; marks: string[]; value: string; body: string; note: string };
    /** 事業を惑星として並べる（orbit の世界観。公式サイトの PLANET A / B / C の呼び方にならう） */
    planets?: {
      title: string;
      lead: string;
      items: { planet: string; en: string; ja: string; title: string; body: string; points: string[]; url?: string; status?: string }[];
      note: string;
    };
    /**
     * 2人の Big Five を五角形で描いて重ねる図（イメージ）。重なった所はロゴの藍色、はみ出した所は水色とピンク。
     * 数値は説明のための例（実在の人の診断結果ではない）。topic は「話すと盛り上がりそうなテーマ」の例
     */
    tune?: {
      kicker: string;
      title: string;
      lead: string;
      axes: string[];
      pairs: { label: string; a: { role: string; v: number[] }; b: { role: string; v: number[] }; topic: string }[];
      note: string;
    };
    /** サービスのプロフィール画面にならったカード（代表の公開情報だけ）。写真は leader.photo */
    profile?: {
      kicker: string;
      title: string;
      lead: string;
      company: string;
      role: string;
      rows: { k: string; v: string }[];
      tags: string[];
      hobby: string;
      /** カードに載せる小さな写真（なければ leader.photo） */
      photo?: { src: string; size: [number, number] };
      note: string;
    };
    /**
     * 速度記号の目盛り（presto の世界観）。社名や合言葉にちなんだ音楽の言葉を、遅い順に並べて mark に鐘を止める。
     * 社名の由来を会社が説明していないときは、そう書く
     */
    prologue?: { kicker: string; title: string; body: string[]; scale: { name: string; bpm: string }[]; mark: string; note: string };
    /**
     * メトロノーム（presto の世界観）。よくある悩みを遅い順に速度記号へ置き換え、つまみで切り替える（client/presto.ts）。
     * 振り子の速さは bpm。動きを減らす設定では止めたまま、文字だけ切り替わる
     */
    tempo?: {
      kicker: string;
      title: string;
      lead: string;
      stages: { name: string; bpm: number; jp: string; state: string; pain: string; fix: string }[];
      note: string;
    };
    /** 事業を3つの鐘として並べる（presto の世界観）。鐘を押すと pitch（Hz）の高さで鳴る。音は押したときだけ */
    bells?: {
      title: string;
      lead: string;
      items: { no: string; en: string; ja: string; title: string; body: string; points: string[]; url?: string; link?: string; pitch: number }[];
      note: string;
    };
    /**
     * 研修のカリキュラムを、8小節の楽譜で見せる（presto の世界観）。職務とツールを選ぶと小節の中身が入れ替わる。
     * 小節 1〜2 は共通（field: true の職務は common.field）、3〜5 は職務、6〜8 はツール
     */
    score?: {
      kicker: string;
      title: string;
      lead: string;
      parts: [string, string, string];
      common: { office: [string, string]; field: [string, string] };
      jobs: { name: string; field?: boolean; parts: [string, string, string]; outcomes: string[] }[];
      tools: { name: string; by: string; parts: [string, string, string] }[];
      note: string;
    };
    /** 価値観を三和音で見せる（presto の世界観）。音符を押すとその音が鳴る。言葉は公式サイトの原文のまま */
    chord?: { kicker: string; title: string; lead: string; button: string; notes: { name: string; text: string; pitch: number }[]; note: string };
    /** 代表を雑誌の表紙風に（presto の世界観）。コピーは公開情報だけ。実在の雑誌ではないと書く */
    cover?: {
      kicker: string;
      title: string;
      lead: string;
      masthead: string;
      issue: string;
      date: string;
      kick: string;
      headline: string;
      side: { b: string; t: string }[];
      facts: { k: string; v: string; url?: string }[];
      photo: { src: string; size: [number, number]; focus?: [number, number] };
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
        art: 'ledger' | 'shield' | 'office' | 'hall' | 'cheers' | 'studio' | 'summit' | 'grill' | 'mystery' | 'wolf' | 'pad';
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
      leader?: {
        name: string;
        jobTitle: string;
        relation: 'founder' | 'employee';
        /** 名前の別の書き方（スペース入り・ローマ字など）。ページに出ているものだけ */
        alternateName?: string[];
        /** 本人の公開プロフィール（SNS など）。ページからリンクしているものだけ */
        sameAs?: string[];
        /** 人物の短い紹介。ページに書いてある内容の範囲で */
        description?: string;
      };
      /** 社名の別の書き方（カタカナなど）。ページに出ているものだけ */
      alternateName?: string[];
      /** 設立日（YYYY-MM-DD）。会社概要に載っているときだけ */
      foundingDate?: string;
      /** 従業員数。会社概要に載っているときだけ */
      numberOfEmployees?: number;
      /** 公式サイト・サービスサイトなど、同じ会社を指すURL */
      sameAs: string[];
      /** 提供地域（Service.areaServed） */
      areaServed: string[];
    };
    /** サービスの構造化データの種類。ソフトウェアなら SoftwareApplication */
    serviceType: 'SoftwareApplication' | 'Service';
  };
};
