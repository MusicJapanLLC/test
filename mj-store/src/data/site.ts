import type { NewsItem } from './types';

export const site = {
  name: 'MJ STORE',
  nameJa: 'MJストア',
  tagline: 'ぜんぶ自社製のゲームストア',
  description:
    '合同会社Music Japanが音楽も物語もシステムも一から作ったゲームだけが並ぶ、公式ゲームストア。The World、灯の旅路、村長、世界まで行くんですか？、ギルドの灯。全作品ブラウザで遊べて、基本プレイ無料。',
  /**
   * 本番の URL（末尾スラッシュなし）。canonical・OGP・sitemap・構造化データの基準になる。
   * 環境変数 VITE_SITE_URL があればそちらが優先される。
   */
  url: 'https://store.music-japan.com',
  /** ゲームそのものが動いている場所 */
  gamesHost: 'https://game.music-japan.com/',
  locale: 'ja_JP',
  operator: {
    name: '合同会社Music Japan',
    nameEn: 'Music Japan LLC',
    url: 'https://music-japan.com/',
    /** 同じ組織を指す公式ページ（構造化データの sameAs） */
    sameAs: ['https://music-japan.com/', 'https://music-japan.com/en/', 'https://partners.music-japan.com/'],
    address: { locality: '大阪市', region: '大阪府', country: 'JP' },
  },
  year: 2026,
  /** ストア全体のお知らせ（新しい順） */
  news: [
    {
      date: '2026-10-09',
      tag: 'お知らせ',
      title: 'MJ STORE、オープンしました。',
      body: '音楽も、物語も、システムも、ぜんぶ自社製。Music Japanのゲームだけが並ぶストアです。',
    },
    {
      date: '2026-10-09',
      tag: 'お知らせ',
      title: 'ご要望・バグ報告の受付をはじめました',
      body: 'バグの報告も、「こうしたらいいやん」も、開発チームに直接届きます。',
    },
  ] satisfies NewsItem[],
  /** トップページの「よくある質問」 */
  faq: [
    {
      q: 'MJ STOREとは何ですか？',
      a: '合同会社Music Japanが自社で制作したゲームだけを並べた、公式のゲームストアです。音楽・物語・システムまで、すべて自社製です。',
    },
    {
      q: 'どんなゲームがありますか？',
      a: 'PC向けの暮らし・街づくり「The World」、ドット絵の戦術RPG「灯の旅路」、村づくり×防衛「村長、世界まで行くんですか？」、ギルド経営×放置「ギルドの灯」の4作品です。これからも増えていきます。',
    },
    {
      q: 'お金はかかりますか？',
      a: '全作品、基本プレイ無料です。ゲーム内課金（任意）があります。',
    },
    {
      q: 'アプリのインストールは必要ですか？',
      a: 'いりません。すべてブラウザで、ページを開くだけで遊べます。',
    },
    {
      q: 'バグを見つけたら、どうすればいいですか？',
      a: '「ご要望・バグ報告」のページから送ってください。「こうしたらいいやん」という提案も大歓迎です。',
    },
  ],
} as const;
