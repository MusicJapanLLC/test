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
  /** ヒーローに置く一行の位置づけ（未指定なら簡易版ヒーローになる） */
  tagline?: string;
  /**
   * ヒーローに置く本人写真。未指定・読み込み失敗のときは頭文字表示に戻る。
   * src は public/ 直下からの絶対パス（例: '/profile-kabeya.jpg'）。
   */
  photo?: { src: string; alt?: string; caption?: string };
  /** 人物紹介（今後、実際の経歴文に差し替えていく前提） */
  bio: string;
  /** 事業内容（文章。段落ごとに配列。未指定なら表示しない） */
  business?: string[];
  /** 運営メディア・サービス（名称＋説明の一覧。未指定なら表示しない） */
  services?: { name: string; description: string }[];
  /** SECOND TAKE記事 / Podcast / 公式サイトなど。今後増える想定でそのまま並べる */
  media?: { label: string; url: string; image?: string }[];
  /** プロフィール一覧(/profile/)の真ん中に出す一行説明。未指定なら tagline を使う */
  listSummary?: string;
  /** プロフィール一覧(/profile/)の右側上段に出す小さなタグ。事業。最大3件 */
  businessTags?: string[];
  /** プロフィール一覧(/profile/)の右側下段に出す小さなタグ。事業内のキーワード。最大3件 */
  keywordTags?: string[];
  theme: Theme;
  /** ヒーローに出す立体（未指定ならCSSグラデーションのみの簡易ヒーロー） */
  monument?: MonumentKind;
  /** true のときは Standment ページと同じ、フルの3Dヒーローを使う（monumentより優先） */
  heavyWebGL?: boolean;
  /**
   * 個別デザインのヒーロー演出。指定するとWebGL（monument/heavyWebGL）の
   * 代わりに使われる。'editorial': 写真的な陰影＋グレインの、雑誌広告的な
   * 静的ヒーロー（3D不要・軽量）。本人のブランドの雰囲気を汲んだ、
   * プロフィールごとに異なる世界観を作りたいときに使う。
   */
  heroVariant?: 'template' | 'editorial' | 'simple';
  active: boolean;
};

/** 申請フォームの目的（仕様書どおりの固定選択肢） */
export const TALK_PURPOSES = ['協業', '情報交換', '発注・相談', '紹介', 'その他'] as const;
export type TalkPurpose = (typeof TALK_PURPOSES)[number];
