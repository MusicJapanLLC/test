import type { ProfileField, Service } from '../types';

/**
 * LegalOn 単独サイト。
 * Baton とは別デプロイ・別スプレッドシートで、相互に影響しない。
 *
 * 構造は Baton と同じ「テンプレート × 設定ファイル」のまま残してある。
 * 将来ページを増やすときも、ここに1件足すだけで済む。
 */

/** 属性入力。会社情報と担当者情報の2画面に分ける */
const PROFILE: ProfileField[] = [
  { id: 'company', label: '会社名', type: 'text', required: true, group: '会社について' },
  {
    id: 'capital',
    label: '資本金',
    type: 'number',
    required: true,
    unit: '万円',
    placeholder: '1000',
    group: '会社について',
  },
  {
    id: 'employees',
    label: '従業員数',
    type: 'number',
    required: true,
    unit: '名',
    placeholder: '50',
    group: '会社について',
  },
  { id: 'name', label: 'ご担当者名', type: 'text', required: true, group: 'ご担当者について' },
  {
    id: 'role',
    label: '役職',
    type: 'select',
    required: true,
    options: ['代表取締役', '取締役', '役員', '法務責任者', '管理職', '担当者', 'その他'],
    group: 'ご担当者について',
  },
  { id: 'email', label: 'メールアドレス', type: 'email', required: true, group: 'ご担当者について' },
  { id: 'tel', label: '電話番号', type: 'tel', required: true, group: 'ご担当者について' },
];

/** Baton と同じ並び */
export const CONTACT_METHODS = ['メール', '電話', 'LINE'] as const;

export const services: Service[] = [
  {
    id: 'legal',
    slug: '',
    company: '株式会社LegalOn Technologies',
    serviceName: 'LegalOn',
    tagline: '契約書レビューから契約管理・法令対応まで',
    description:
      'AI×弁護士知見で企業法務を支援する、世界水準のリーガルAI。東京・大阪・福岡・サンフランシスコに拠点を持ち、2022年に米国、2024年に英国へ進出しています。',
    // LegalOn公式の紺 + ゴールド。信頼感を最優先に、派手にしない
    theme: { primary: '#16294D', accent: '#C9A227', bg: '#F7F9FC', text: '#101B2E' },
    monument: 'lattice',
    problems: [
      { title: '契約レビュー負荷', detail: 'レビューの負担が大きい' },
      { title: '品質のばらつき', detail: 'レビュー品質にばらつきがある' },
      { title: '属人化', detail: '案件管理が属人化しやすい' },
      { title: '情報検索に時間がかかる', detail: '契約書や過去情報を探すのに時間がかかる' },
    ],
    features: [
      {
        title: 'LegalOnアシスタント',
        detail: '契約に関する質問、修正案の検討、条文反映までを支援',
      },
      { title: 'AI契約書レビュー', detail: 'リスク検出と修正案提示で、レビューを効率化' },
      { title: 'マターマネジメント', detail: '相談案件を集約し、要約・過去案件レコメンド' },
      { title: 'コントラクトマネジメント', detail: '締結済み契約書を一元管理' },
      { title: '法令調査・法改正対応', detail: '法改正への対応をサポート' },
      { title: 'CorporateOn', detail: 'コーポレート業務の相談対応を支援' },
    ],
    featuresNote: '32言語に対応し、グローバル法務にも使えます。',
    strengths: [
      { title: 'AI×弁護士知見', detail: '高度なAIと弁護士の知見を融合' },
      { title: '一つのプラットフォーム', detail: '法務業務を一つのプラットフォームに集約' },
      { title: 'ナレッジを蓄積・活用', detail: '使うほどナレッジが蓄積し、AIがより賢く' },
      { title: '判断業務へ集中', detail: '法務担当者が「作業」ではなく「判断」に集中できる' },
    ],
    stats: [
      { label: '有償導入社数（グローバル）', value: '8,000', unit: '社以上' },
      { label: '国内上場企業の導入率', value: '30', unit: '%以上' },
      { label: 'ARR', value: '100', unit: '億円突破', note: '日本発AI企業最速／海外売上 前年比4倍' },
    ],
    links: [{ label: '会社HP', url: 'https://www.legalontech.com/jp/' }],
    survey: {
      questions: [
        {
          id: 'q1',
          label: '契約書は月にどのくらい見ますか',
          type: 'single',
          options: ['0〜1件', '2〜4件', '5〜10件', '11〜30件', '31件以上'],
        },
        {
          id: 'q2',
          label: 'いまの法務体制はどれが近いですか',
          type: 'single',
          options: [
            '専任の担当者はいない',
            '顧問弁護士のみに依頼している',
            '法務経験のない担当者が対応している',
            '法務担当が1〜3名いる',
            '法務担当が4名以上いる',
          ],
        },
        {
          id: 'q3',
          label: '契約書のレビューで感じていることはどれですか',
          type: 'multi',
          options: [
            '時間がかかる',
            '見落としがないか不安',
            '顧問弁護士の費用が高い',
            '属人化していて引き継げない',
            'ChatGPTを試したが精度とセキュリティが不安',
          ],
        },
        {
          id: 'q4',
          label: '知りたいことはどれですか',
          type: 'multi',
          options: [
            '料金プラン',
            '機能とAIの精度',
            '同業種の導入事例',
            '顧問弁護士との役割分担',
            'ChatGPTなど生成AIとの違い',
            '導入の流れとサポート体制',
          ],
        },
      ],
      profileFields: PROFILE,
    },
  },
];

export const getService = (id: string): Service => {
  const found = services.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown service id: ${id}`);
  return found;
};
