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
export const profiles: TalkProfile[] = services.map((s) => ({
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

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
