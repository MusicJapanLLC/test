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
 * 「その人専用の小さなLP」として、人物紹介・事業内容・実績・
 * メディア・話したいCTAまでを1ページに収める。
 * 今後、実績や出演コンテンツが増えるたびに media / achievements を
 * 追記していく想定（写真は未着手のためイニシャル表示のまま）。
 *
 * achievements は現時点で正確な件数・年数を把握できていないため、
 * 事実として言える範囲の書き方にしてある。実数が分かり次第、具体的な
 * 数字（〜件、〜年、など）に差し替えるとより説得力が増す。
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
  business: [
    '中心事業は音楽制作・配信。海外向けの楽曲制作や配信のほか、BGM・Jazzの制作にも対応する。',
    'あわせて、経営者・事業者とのつながりを活かした法人向けの集客支援・商談アポ獲得支援を展開。' +
      'Standmentとしては、WebGL・3D表現を用いた体験型Webサイトの企画・制作も手がける。' +
      '別法人では、企業向けのHP制作事業も進めている。',
  ],
  achievements: [
    '海外向けの音楽制作・楽曲配信を継続的に手がけ、Jazz・BGMなど制作領域は多岐にわたる。',
    '経営者ネットワークを活かした法人紹介・商談アポ支援を、複数の企業に対して並行して実施中。',
    'WebGL体験型サイトの制作実績としては、Standmentのポートフォリオを参照。',
  ],
  media: [
    { label: '公式HP', url: 'https://music-japan.pearly-cedar-3983.chatgpt.site/' },
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
