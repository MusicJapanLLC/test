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
};

export type ProfileField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select';
  required: boolean;
  options?: string[];
};

export type Theme = {
  primary: string;
  accent: string;
  bg: string;
  text: string;
};

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
  strengths: Item[];
  stats: Stat[];
  links: LinkItem[];
  survey: {
    questions: SurveyQuestion[];
    profileFields: ProfileField[];
  };
  /** true のときだけ 3D をフルに使う（Standment のページ＝そのままデモになる） */
  heavyWebGL?: boolean;
};
