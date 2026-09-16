import type { TalkProfile } from '../types';

/**
 * Baton Introduction System のプロフィール一覧。
 * 実在の人物1件ずつを、ここに手で追加していく（テンプレートからの自動生成はしない）。
 *
 * 掲載者の連絡先（recipient_email）はここには置かない。
 * GAS側（スプレッドシート）だけが非公開情報として持つ。
 */

/**
 * 実データで作った1件目のプロフィール。
 * 「その人専用の小さなLP」として、人物紹介・事業内容・運営メディア・
 * メディア・話したいCTAまでを1ページに収める。
 * 今後、出演コンテンツが増えるたびに media / services を追記していく想定。
 */
const kabeyaProfile: TalkProfile = {
  id: 'kabeya',
  slug: 'kabeya',
  name: '壁谷 友生',
  company: '合同会社Music Japan',
  title: '代表社員',
  tagline: '学び、紡ぎ、繋いでいく。',
  photo: {
    src: '/profile-kabeya.webp',
    alt: '壁谷 友生',
    caption: 'OSAKA / JAPAN · 2026',
  },
  bio:
    'Podcast「SECOND TAKE（セカンドテイク）」にて、経営者の決断や苦悩、それらをどう乗り越えてきたのか。' +
    'その人自身の言葉や経験を「インタビュー記事」として記録していく経営者メディアを運営しています。',
  business: [
    '「音楽制作・メディア運営・法人紹介」の三事業を展開。' +
      '招待制の紹介サービス「Baton -バトン-」では、運営が実際に面談した経営者・事業者の中から、' +
      '双方に可能性があると判断した相手を紹介しています。',
  ],
  services: [
    { name: 'Music Japan', description: '海外向け音楽、Jazz、BGMの制作・配信' },
    { name: 'SECOND TAKE', description: '経営者の決断と苦悩を記録するPodcast' },
    { name: 'Interview', description: '経営者の人生と事業を残す記事メディア' },
    { name: 'Baton -バトン-', description: '招待制紹介サービスで深く長い関係づくりを。' },
  ],
  media: [
    { label: '公式HP', url: 'https://music-japan.com/', image: '/media-musicjapan-hp.png' },
    {
      label: 'SECOND TAKE インタビュー',
      url: 'https://secondtake.music-japan.com/',
      image: '/media-secondtake-logo.webp',
    },
  ],
  listSummary: '招待制紹介サービス「Baton」の運営',
  businessTags: ['音楽制作', 'メディア運営', '法人紹介'],
  keywordTags: ['洋楽/Jazz', '経営者対談', '完全招待制'],
  theme: { primary: '#C8102E', accent: '#D9A441', bg: '#0A0A0C', text: '#EDEAE4' },
  heavyWebGL: true,
  active: true,
};

/**
 * 2件目のプロフィール。株式会社unveil代表・古谷祐麻氏。
 * ブランディング／クリエイティブ制作／プロダクト開発支援／プロジェクト伴走支援を
 * 軸にする独立したパートナーのため、資本金・従業員数などの企業スペックは載せない
 * （このシステムの設計方針どおり、実績は文章の中でのみ触れる）。
 */
const unveilProfile: TalkProfile = {
  id: 'unveil',
  slug: 'unveil',
  name: '古谷 祐麻',
  company: '株式会社unveil',
  title: '代表取締役CEO',
  tagline: '言葉にし、かたちにし、伴走する。',
  bio:
    '大学卒業後、地域密着型のWebメディア立ち上げを経て、カンボジア政府のプロジェクトなど国内外の案件に携わる。' +
    '現在は株式会社unveilの代表取締役として、企業や商品、地域にある「まだ言葉になっていない価値」を、' +
    'ブランディングとクリエイティブの力でかたちにしています。',
  business: [
    'ブランディング・クリエイティブ制作・プロダクト開発支援・プロジェクト伴走支援を軸に、' +
      '企業や商品、地域が持つ魅力を言語化し、コンセプト設計から実装まで一貫して手がけています。' +
      'Web制作やUI/UXにとどまらず、採用戦略、SEO・コンテンツマーケティング、撮影・グラフィック、' +
      '市場調査、業務改善まで、必要な領域を横断して伴走するのが特徴です。',
  ],
  services: [
    { name: 'ブランディング', description: '企業・商品・地域にある価値を整理し、コンセプトから設計' },
    { name: 'Web制作・UI/UX', description: 'コーポレート・採用・LP・サービスサイトを一貫設計' },
    { name: '採用支援', description: 'ペルソナ設計から求人原稿・媒体連携までワンストップで支援' },
    { name: 'プロダクト開発支援', description: '商品・プロダクトの企画から市場調査、磨き込みまで伴走' },
  ],
  media: [
    {
      label: '公式サイト',
      url: 'https://unveil.style/',
      image: '/media-unveil-hp.webp',
    },
  ],
  listSummary: 'ブランディング・Web制作・採用支援',
  businessTags: ['ブランディング', 'Web制作', 'プロダクト開発'],
  keywordTags: ['世界観の設計', '徹底ヒアリング', 'SEO対策'],
  // unveil.style（本人の会社サイト）の、余白の多い・淡いグレイに
  // 花影を落としたような世界観に合わせた配色。
  theme: { primary: '#2B2622', accent: '#B08968', bg: '#F2EEE6', text: '#3A342C' },
  // 壁谷さんのフルWebGL演出（heavyWebGL）ではなく、本人のブランドの
  // 雰囲気を汲んだ写真的な静的ヒーロー（editorial）を使う。
  // 3D不要で軽量、かつプロフィールごとに異なる世界観を出せる。
  heroVariant: 'editorial',
  active: true,
};

export const profiles: TalkProfile[] = [kabeyaProfile, unveilProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
