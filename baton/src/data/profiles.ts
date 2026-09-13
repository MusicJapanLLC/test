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
 * 今後、出演コンテンツが増えるたびに media / services を追記していく想定
 * （写真は未着手のためイニシャル表示のまま）。
 */
const kabeyaProfile: TalkProfile = {
  id: 'kabeya',
  slug: 'kabeya',
  name: '壁谷 友生',
  company: '合同会社Music Japan',
  title: '代表社員',
  tagline: '学び、紡ぎ、繋いでいく。',
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
    { label: '公式HP', url: 'https://music-japan.pages.dev/' },
    { label: 'SECOND TAKE インタビュー', url: 'https://second-take.vocal-shore-1441.chatgpt.site/' },
  ],
  theme: { primary: '#1B3A6B', accent: '#2E9BA8', bg: '#F5F8FC', text: '#14233D' },
  heavyWebGL: true,
  active: true,
};

export const profiles: TalkProfile[] = [kabeyaProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
