/** Baton Partners 全体の設定。企業ごとに変わらないものだけを置く */
export const site = {
  name: 'Baton Partners',
  /** パンくずの先頭・一覧ページの呼び名（本体サイトの「パートナー」と同じ位置づけ） */
  hubName: 'Music Japan パートナー',
  description:
    '合同会社Music Japanのパートナー企業。各社の事業とサービスを、一社ずつ専用のページで紹介しています。',
  operator: {
    name: '合同会社Music Japan',
    nameEn: 'Music Japan LLC',
    representative: '代表社員 壁谷友生',
    address: '大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル12-12',
    email: 'music.japan.llc@gmail.com',
    url: 'https://music-japan.com/',
  },
  /** 本体サイト（music-japan.com）のメニュー。パートナーのページも同じ並びで見せる */
  mainNav: [
    { no: '01', label: '事業概要', url: 'https://music-japan.com/business/' },
    { no: '02', label: '作品', url: 'https://music-japan.com/works/' },
    { no: '03', label: '会社概要', url: 'https://music-japan.com/company/' },
    { no: '04', label: '代表プロフィール', url: 'https://music-japan.com/profile/' },
    { no: '05', label: 'パートナー', url: 'https://music-japan.com/partners/' },
    { no: '06', label: 'お問い合わせ', url: 'https://music-japan.com/contact/' },
  ],
  social: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/' },
    { label: 'Instagram', url: 'https://www.instagram.com/music.japan.llc2/' },
    { label: 'X', url: 'https://x.com/Music_Japan_LLC' },
  ],
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
