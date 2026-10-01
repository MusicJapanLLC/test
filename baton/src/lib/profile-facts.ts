import { site } from '../data/site';
import type { MediaItem, TalkProfile } from '../types';

/**
 * プロフィールの「事実」を、画面・構造化データ・llms.txt で共通に使う形へまとめる。
 * DOMに触らない（ビルド時の vite.config.ts からも読むため）。
 *
 * ここで作る文章は、profiles.ts / site.ts に書いてある事実の組み合わせだけ。
 * 新しい事実を作文しない（数字・実績・評価を足さない）。
 * 画面に出すFAQと、構造化データ（FAQPage）の中身は必ず一致させる。
 */

export type Faq = { q: string; a: string };

/** 末尾の句点を落とす（文をつなげるとき用） */
const trimStop = (s: string) => s.replace(/[。．.]\s*$/, '');

/** 運営についての事実（site.ts と壁谷プロフィールの本文に書いてある内容） */
export const BATON_ABOUT =
  `${site.nameJa}は、${site.operator.name}が運営する招待制の紹介サービスです。` +
  '運営が実際に対話した経営者・事業者のプロフィールを掲載し、双方に可能性があると判断した相手どうしを紹介しています。';

/** トップ（/profile/）に置く、Batonを一文で説明する文 */
export const HUB_LEAD =
  '運営が実際に対話した経営者・事業者を、双方に可能性があると判断した相手どうしで紹介する、招待制のサービスです。';

/** 紹介を申し込むまでの流れ（申請フォームの案内文と同じ内容） */
export const REQUEST_FLOW =
  'プロフィールページの「紹介を希望する」フォームから申請できます。' +
  `運営の${site.operator.name}が内容を確認し、双方の確認が取れた場合にご紹介します。`;

/** 掲載・紹介の相談窓口（フッターと同じリンク） */
export const LISTING_CONTACT_URL = 'https://timerex.net/s/music.japan.llc_5445/88d4eb59';

/** 公式サイト（会社のURL）。「公式」「公式HP」「公式サイト」のラベルか、kind='公式' のリンク */
export function officialUrl(profile: TalkProfile): string | undefined {
  return profile.media?.find((m) => m.kind === '公式' || /^公式(?:HP|サイト)?$/.test(m.label))?.url;
}

/** 本人のアカウント（Person の sameAs）。media の owner: 'person' だけ */
export function personSameAs(profile: TalkProfile): string[] {
  return Array.from(new Set((profile.media ?? []).filter((m) => m.owner === 'person').map((m) => m.url)));
}

/** 会社の公式アカウント（Organization の sameAs）。media の owner: 'company' だけ */
export function companySameAs(profile: TalkProfile): string[] {
  return Array.from(new Set((profile.media ?? []).filter((m) => m.owner === 'company').map((m) => m.url)));
}

/** 本人・会社のアカウント（画面の「発信」欄に使う）。media の owner が付いたものだけ */
export function sameAsUrls(profile: TalkProfile): string[] {
  return Array.from(new Set((profile.media ?? []).filter((m) => m.owner).map((m) => m.url)));
}

/** 登壇・掲載の実績（新しい順に並んでいる前提。データの並びのまま使う） */
export function appearances(profile: TalkProfile): MediaItem[] {
  return (profile.media ?? []).filter((m) => m.kind === '登壇' || m.kind === '掲載' || m.kind === '出演');
}

/** 事業領域の名前だけを並べる */
export function serviceNames(profile: TalkProfile): string[] {
  return (profile.services ?? []).map((s) => s.name);
}

/**
 * 一文の紹介（AI検索が最初に拾う「〇〇とは」の答え）。
 * 例: 「松浦 淳は、株式会社Central AXの代表取締役CEOです。名古屋を拠点に活動しています。」
 */
export function oneLiner(profile: TalkProfile): string {
  const where = profile.location ? `${profile.location}を拠点に活動しています。` : '';
  const tags = profile.businessTags ?? [];
  const what = tags.length ? `主な事業は${tags.join('・')}です。` : '';
  return `${profile.name}は、${profile.company}の${profile.title}です。${where}${what}`;
}

/** 画面の「よくある質問」と、構造化データ FAQPage の共通の中身 */
export function profileFaqs(profile: TalkProfile): Faq[] {
  const faqs: Faq[] = [
    {
      q: `${profile.name}さんはどんな人ですか？`,
      a: `${profile.company}の${profile.title}です。${profile.bio}`,
    },
  ];

  if (profile.services?.length) {
    faqs.push({
      q: `${profile.company}では、どんな事業をしていますか？`,
      a:
        profile.services.map((s) => `${s.name}（${trimStop(s.description)}）`).join('、') +
        'を手がけています。',
    });
  }

  const shows = appearances(profile);
  if (shows.length) {
    faqs.push({
      q: `${profile.name}さんの${Array.from(new Set(shows.map((m) => m.kind))).join('・')}の実績は？`,
      a:
        shows
          .map((m) => `${m.date ? `${m.date} ` : ''}「${m.label}」（${m.kind}）`)
          .join('、') + 'などがあります。',
    });
  }

  faqs.push(
    {
      q: `${profile.name}さんを紹介してもらうには？`,
      a: REQUEST_FLOW,
    },
    {
      q: `${site.nameJa}とは何ですか？`,
      a: BATON_ABOUT,
    },
  );
  return faqs;
}

/** よくある質問ページ（/faq/）の中身 */
export function hubFaqs(): Faq[] {
  return [
    { q: `${site.nameJa}とは何ですか？`, a: BATON_ABOUT },
    { q: '運営しているのは誰ですか？', a: `${site.operator.name}（${site.operator.representative}）です。` },
    { q: '掲載されている人を紹介してもらうには？', a: REQUEST_FLOW },
    {
      q: '紹介までの流れは？',
      a:
        '1. プロフィールを読む（運営が実際に対話した経営者・事業者の、事業と人柄を紹介しています）。' +
        '2. 話してみたい人のページのフォームから、目的・お名前・会社名などを入力して申請する。' +
        `3. ${site.operator.name}が内容を確認し、双方の確認が取れた場合にご紹介します。`,
    },
    {
      q: 'Batonに掲載してもらう、または紹介の相談をするには？',
      a: `「紹介・掲載をご希望の方」の予約ページから、${site.operator.name}へご相談いただけます。`,
    },
  ];
}

/** ページの説明文（meta description）。120字前後に収める */
export function profileDescription(profile: TalkProfile): string {
  const text = `${profile.company} ${profile.title}・${profile.name}のプロフィール。${profile.bio}`;
  return text.length > 125 ? `${text.slice(0, 124)}…` : text;
}

/** ページタイトル。名前・会社・役職・事業の順に、検索で探される言葉を先に置く */
export function profileTitle(profile: TalkProfile): string {
  const tags = (profile.businessTags ?? []).slice(0, 3).join('・');
  return `${profile.name}（${profile.company} ${profile.title}）${tags ? `｜${tags}` : ''}｜Baton`;
}
