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
  type: 'text' | 'email' | 'tel' | 'select' | 'number';
  required: boolean;
  options?: string[];
  /** number のとき、入力欄の右に出す単位（例: 万円）。送信値にも付く */
  unit?: string;
  placeholder?: string;
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

/**
 * ═══════════════════════════════════════════════════════════════
 *  Baton Introduction System（紹介システム）
 *  仕様: Baton MVP Backend Specification v1.1
 * ═══════════════════════════════════════════════════════════════
 *  既存の6サービスページ・アンケートとは完全に独立した別機能。
 *  「この人と話したい」→ メール認証 → 掲載者承認/辞退 → 社長へ紹介、を扱う。
 *  掲載者メール（recipient_email）はここには置かない。非公開情報は
 *  GAS側（Google Sheets の PROFILES シート）だけが持つ。
 */

/** プロフィールに公開する情報だけを持つ。個人の連絡先は一切含めない */
export type TalkProfile = {
  id: string;
  slug: string;
  name: string;
  company: string;
  title: string;
  /** 人物紹介（今後、実際の経歴文に差し替えていく前提） */
  bio: string;
  /** 話せるテーマ */
  topics: string[];
  /** SECOND TAKE記事 / Podcast など */
  media?: { label: string; url: string }[];
  theme: Theme;
  active: boolean;
};

/** 申請フォームの目的（仕様書どおりの固定選択肢） */
export const TALK_PURPOSES = ['協業', '情報交換', '発注・相談', '紹介', 'その他'] as const;
export type TalkPurpose = (typeof TALK_PURPOSES)[number];
