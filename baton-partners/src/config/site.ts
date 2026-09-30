/** Baton Partners 全体の設定。企業ごとに変わらないものだけを置く */
export const site = {
  name: 'Baton Partners',
  description:
    '合同会社Music Japanが運営する、企業とサービスを紹介する法人向けパートナープログラム。',
  operator: {
    name: '合同会社Music Japan',
    nameEn: 'Music Japan LLC',
    representative: '代表社員 壁谷友生',
    address: '大阪市北区梅田1-2-2 大阪駅前第2ビル12-12',
    email: 'music.japan.llc@gmail.com',
    url: 'https://music-japan.com/',
  },
  /** Music Japan 公式LINE。Web から来た人は、ここを追加してからアンケートへ進む */
  lineUrl: 'https://lin.ee/YPbe3ti',
  /** サイト共通ページ（一覧・編集部・プライバシー）を最後に大きく見直した日。sitemap の lastmod に使う */
  updated: '2026-10-01',
  /** ご相談からおつなぎまでの目安（Web流入は約2日でグループ作成、の運用に合わせる） */
  leadTime: '2営業日前後',
  colors: {
    paper: '#F3EFE6',
    ink: '#141414',
    red: '#C8102E',
  },
} as const;

/** 各企業サイトの5ページ。URLはここだけで決める */
export const routes = {
  top: (slug: string) => `/${slug}/`,
  about: (slug: string) => `/${slug}/about/`,
  insight: (slug: string, article: string) => `/${slug}/insights/${article}/`,
  service: (slug: string) => `/${slug}/service/`,
  contact: (slug: string) => `/${slug}/contact/`,
  privacy: () => '/privacy/',
  /** Baton Partners 編集部（運営者・編集方針）。記事の著者情報の参照先 */
  editorial: () => '/editorial/',
} as const;
