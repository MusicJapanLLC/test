/**
 * Baton Partners の企業サイトは「1テンプレート × 企業データ」で動く。
 * 企業を増やすときは src/partners/<slug>.ts を1つ足して、partners/index.ts に登録するだけ。
 */

export type Pair = { title: string; detail: string };

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

export type Question = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  options: string[];
};

export type Partner = {
  slug: string;
  /** Baton Partners 内での掲載番号（表紙の「No.01」） */
  no: string;
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
   *   scene  'network'   … 点と線の球体（集める→つなぐ→決める）
   *          'lattice'   … 立方体の建築模型（散らばる→組み上がる→スキャンされ光の柱が立つ）
   */
  world: { theme: 'editorial' | 'mono'; scene: 'network' | 'lattice' };
  /** 代表の紹介（写真がある企業だけ）。発言は作らず、公開されている事実だけを書く */
  leader?: {
    name: string;
    nameEn: string;
    role: string;
    photo: string;
    photoSize: [number, number];
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
    /** 看板機能を1つ大きく見せる帯（エボルグなら休眠求職者の掘り起こし） */
    highlight: { en: string; title: string[]; lead: string; steps: Pair[]; note: string };
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
    sections: ArticleSection[];
  };
  contact: {
    questions: Question[];
  };
  faq: { q: string; a: string }[];
};
