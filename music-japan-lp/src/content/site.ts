/**
 * Music Japan の集客LP — 固定の値（URL・連絡先・SNS）。
 * 会社情報は公式サイト（music-japan.com）の会社概要と同じ表記にそろえる。
 */

/** このLPの公開URL。独自ドメインが決まったら、ここ（または MJ_LP_URL）だけ変える */
export const LP_URL = (globalThis.process?.env?.MJ_LP_URL ?? 'https://about.music-japan.com').replace(/\/$/, '');

/** 公式サイト・各サービス */
export const OFFICIAL_URL = 'https://music-japan.com';
export const PARTNERS_URL = 'https://partners.music-japan.com/';
export const BATON_URL = 'https://baton.music-japan.com/profile/';
export const BATON_KABEYA_URL = 'https://baton.music-japan.com/profile/kabeya/';
export const BATON_MATSUURA_URL = 'https://baton.music-japan.com/profile/matsuura/';
export const SECOND_TAKE_URL = 'https://secondtake.music-japan.com/';

/** 打ち合わせの予約（公式サイトと同じ TimeRex のページ）。ボタンはすべてここへ */
export const TIMEREX_URL = 'https://timerex.net/s/music.japan.llc_5445/2f8e527f';

export const EMAIL = 'music.japan.llc@gmail.com';
export const TEL = '070-3175-7567';

/** 公式サイトの構造化データと同じ @id を使い、同じ会社・同じ人物として結びつける */
export const ORG_ID = `${OFFICIAL_URL}/#organization`;
export const FOUNDER_ID = `${OFFICIAL_URL}/#founder`;
export const BATON_SERVICE_ID = `${BATON_URL}#service`;
export const SECOND_TAKE_ID = `${SECOND_TAKE_URL}#podcast-series`;

/** 中身を大きく変えた日（sitemap・構造化データ） */
export const UPDATED = '2026-10-02';

export const company = {
  name: '合同会社Music Japan',
  nameEn: 'Music Japan LLC',
  representative: '壁谷 友生',
  representativeKana: 'かべや ともき',
  representativeEn: 'Tomoki Kabeya',
  role: '代表社員',
  postal: '530-0001',
  address: '大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル12-12',
  corporateNo: '8120003031493',
};

export const socials = [
  { name: 'LinkedIn', owner: '壁谷 友生', href: 'https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/' },
  { name: 'X', owner: 'Music Japan', href: 'https://x.com/Music_Japan_LLC' },
  { name: 'Instagram', owner: 'Music Japan', href: 'https://www.instagram.com/music.japan.llc2/' },
];
