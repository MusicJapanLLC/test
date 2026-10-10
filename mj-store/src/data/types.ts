export type Platform = 'スマホ' | 'PC';

/** 配信状況。playUrl があれば live、なければ soon として扱う（status で上書きも可） */
export type GameStatus = 'live' | 'soon' | 'dev';

/** ストアページの見た目の系統 */
export type Skin = 'pixel' | 'lantern' | 'paper' | 'feed';

/** ヒーローに漂わせる光の粒 */
export type Ambient = 'fireflies' | 'lanterns' | 'embers' | 'leaves';

export interface NewsItem {
  date: string; // YYYY-MM-DD
  tag: 'お知らせ' | 'アップデート' | '配信' | 'イベント';
  title: string;
  body?: string;
  /** 押したときの行き先（サイト内のパス）。作品のお知らせは作品ページへ自動でつながる */
  href?: string;
}

/** Music Japan のちびロボ5体（公式サイトと同じドット絵。名前はまだ無い） */
export type BotId = 'tune' | 'spin' | 'pod' | 'reel' | 'mic';

export interface VersionEntry {
  /** 表示そのまま（例: v0.18 / prototype05 / 2026.10.08） */
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  notes: string[];
}

export interface Feature {
  title: string;
  body: string;
}

export interface Faq {
  q: string;
  a: string;
}

/** 実際のゲーム画面。public/ からのパス */
export interface Shot {
  src: string;
  w: number;
  h: number;
  /** 何が写っているか（検索エンジン・読み上げ向け） */
  alt: string;
  /** 画像の下に出す短い見出し */
  caption: string;
  /** 一覧で縦横比をそろえて切り抜くときに残す位置（object-position） */
  focus?: string;
}

export interface GameTheme {
  skin: Skin;
  /** 見出しに使う書体（CSS の font-family） */
  font: string;
  /** その書体で、英数字が全角の何倍の幅になるか。キャッチコピーを画面幅いっぱいに収める計算に使う */
  latinWidth: number;
  scheme: 'dark' | 'light';
  bg: string;
  surface: string;
  ink: string;
  mute: string;
  line: string;
  accent: string;
  accent2: string;
  onAccent: string;
  ambient: Ambient;
}

export interface Game {
  id: string;
  /** URL の一部になる。/games/<slug>/ */
  slug: string;
  /** ゲーム内の正式タイトル */
  title: string;
  /** 正式な副題（ゲームのタイトル画面の表記） */
  subtitle: string;
  titleEn: string;
  /** でっかく出すキャッチコピー。1要素が1行 */
  catch: string[];
  /** キャッチの下に小さく添える一言 */
  catchNote: string;
  lead: string;
  description: string[];
  genre: string;
  platforms: Platform[];
  /** 遊べる言語 */
  languages: string[];
  /** 遊ぶ先の URL。空なら「近日配信」表示になる */
  playUrl: string;
  status?: GameStatus;
  /** 現在のバージョン（ゲーム内表記） */
  currentVersion: string;
  tags: string[];
  features: Feature[];
  /** 開発者レビュー（★5 固定） */
  review: string;
  /** 操作方法の要約 */
  controls: string;
  /** セーブの仕組み */
  save: string;
  /** 音楽について */
  music: string;
  /** 作品固有のよくある質問（共通の質問に追加される） */
  faq: Faq[];
  theme: GameTheme;
  /** 実機の画面の形。phone なら縦長、browser なら PC のブラウザ */
  device: 'phone' | 'browser';
  /** カードに使う画面（shots の番号。省略時は1枚目）。タイトル文字が大きい画面は、カードの題名とぶつかるので避ける */
  cardShot?: number;
  /** カードで切り抜くときの位置（object-position） */
  cardFocus: string;
  /** ストアページで、ちびロボがひとこと添える */
  bot: { id: BotId; line: string };
  shots: Shot[];
  news: NewsItem[];
  /** 新しい順に並べる */
  versions: VersionEntry[];
}
