import { services } from './services';
import type { TalkProfile } from '../types';

/**
 * Baton Introduction System のプロフィール一覧。
 *
 * MVPでは実際の人物写真・経歴文をまだ持っていないため、既存の
 * サービス紹介文（company / description / features・strengths / links）を
 * そのまま流用して初期データとしている。
 *
 * 今後、実際の顔写真・個人の経歴文が用意でき次第、ここを直接書き換える
 * （＝1件が「1つのミニLP」として独立して充実していく想定）。
 *
 * 掲載者の連絡先（recipient_email）はここには置かない。
 * GAS側（PROFILES シート）だけが非公開情報として持つ。
 */
const servicePlaceholders: TalkProfile[] = services.map((s) => ({
  id: s.id,
  slug: s.slug,
  // プレースホルダー: 実際の担当者名が決まり次第ここを差し替える
  name: s.serviceName,
  company: s.company,
  title: 'ご担当者',
  bio: s.description,
  topics: [...s.features, ...s.strengths].slice(0, 6).map((item) => item.title),
  media: s.links.map((link) => ({ label: link.label, url: link.url })),
  theme: s.theme,
  active: true,
}));

/**
 * 実データで作った1件目のプロフィール（テスト制作）。
 * 「その人専用の小さなLP」として、人物紹介・事業内容・話せるテーマ・
 * 実績/メディア・話したいCTAまでを1ページに収める。
 * 今後、実績や出演コンテンツが増えるたびに media / businesses / topics を
 * 追記していく想定（写真は未着手のためイニシャル表示のまま）。
 */
const kabeyaProfile: TalkProfile = {
  id: 'kabeya',
  slug: 'kabeya',
  name: '壁谷 友生',
  company: '合同会社Music Japan',
  title: '代表社員',
  tagline: '音楽を起点に、人と事業をつなぐ。',
  bio:
    '合同会社Music Japan代表。海外向けの音楽制作・楽曲配信を軸足にしながら、' +
    '法人向けの集客支援・リード獲得支援を並行して手がける。' +
    '経営者・事業者との横のつながりを活かし、複数の事業を同時に前へ進めている。',
  topics: [
    '海外向け音楽制作・楽曲配信',
    'BGM / Jazz制作',
    '法人リード獲得支援',
    '商談アポ設計',
    'WebGL体験型サイト制作',
    '新規事業の立ち上げ',
  ],
  businesses: [
    {
      title: '音楽制作・配信事業',
      detail: '海外向けの音楽制作・楽曲配信を中心に、BGMやJazzの制作も手がける。',
    },
    {
      title: '法人リード獲得支援',
      detail: '経営者・事業者とのつながりを活かし、法人向けの集客支援や商談アポ獲得を支援。',
    },
    {
      title: 'WebGL体験型サイト制作',
      detail: 'Standmentとして、WebGL・3D表現を使った体験型Webサイトの企画・制作を行う。',
    },
    {
      title: 'Web制作事業（関連法人）',
      detail: '別法人にて、企業向けのHP制作事業も展開している。',
    },
  ],
  media: [
    { label: '公式HP', url: 'https://music-japan.pearly-cedar-3983.chatgpt.site/' },
    { label: 'SECOND TAKE インタビュー', url: 'https://second-take.vocal-shore-1441.chatgpt.site/' },
  ],
  theme: { primary: '#1B3A6B', accent: '#2E9BA8', bg: '#F5F8FC', text: '#14233D' },
  heavyWebGL: true,
  active: true,
};

export const profiles: TalkProfile[] = [...servicePlaceholders, kabeyaProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
