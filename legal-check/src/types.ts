/**
 * Baton の全ページはこの型に沿った設定ファイル1枚から組み立てられる。
 * サービスを追加するときは services.ts に1件足して、
 * <slug>/index.html と src/entries/<id>.ts を1枚ずつ増やすだけでよい。
 */

export type SurveyQuestion = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  options: string[];
  /**
   * true にすると末尾に「その他」が並び、選んだときだけ
   * その場に自由記述欄が開く。別画面へは飛ばさない。
   * 未入力でも次へ進める。
   */
  allowOther?: boolean;
};

export type ProfileField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'number';
  required: boolean;
  options?: string[];
  /** number のとき、入力欄の右に出す単位（例: 万円）。送信値にも付く */
  unit?: string;
  placeholder?: string;
  /**
   * 属性入力をまとめる見出し。同じ値のものが1画面にまとまる。
   * 未指定なら全部で1画面。
   */
  group?: string;
};

export type Theme = {
  primary: string;
  accent: string;
  bg: string;
  text: string;
};

/**
 * stack   積み上がる      … 人やスキルが集まって形になる
 * lattice 組み合わさる    … 部品が噛み合ってシステムになる
 * cluster 寄り集まる      … 人が集まって輪になる
 * shield  包む            … 中心を層で守る
 * funnel  絞り込まれる    … 集めて、つないで、決まる
 */
export type MonumentKind = 'stack' | 'lattice' | 'cluster' | 'shield' | 'funnel';

export type Item = { title: string; detail: string };

export type Stat = { label: string; value: string; unit: string; note?: string };

export type LinkItem = { label: string; url: string };

export type Service = {
  id: string;
  slug: string;
  company: string;
  serviceName: string;
  tagline: string;
  description: string;
  theme: Theme;
  problems: Item[];
  features: Item[];
  /** できることの下に1行だけ添える補足 */
  featuresNote?: string;
  strengths: Item[];
  stats: Stat[];
  links: LinkItem[];
  survey: {
    questions: SurveyQuestion[];
    profileFields: ProfileField[];
  };
  /** true のときだけ 3D をフルに使う（Standment のページ＝そのままデモになる） */
  heavyWebGL?: boolean;
  /**
   * ヒーローに置く立体のかたち。サービスの中身を抽象化したもの。
   * heavyWebGL のページでは使わない（あちらは専用の立体を持つ）。
   */
  monument?: MonumentKind;
};
