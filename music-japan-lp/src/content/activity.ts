/**
 * NOW / LATEST / BUILD LOG / JOURNAL — Music Japanの最近の動き。
 *
 * ここに1件足すだけで、ページのカード・日付・リンク、RSS（/feed.xml）、JSON（/activity.json）に反映される。
 * 新しいものを上に書く必要はない（日付で並べ替える）。
 *
 * 書いてよいのは、公開用シート（確認済み実績）・公式サイト・各サービスの公開ページで確かめられることだけ。
 * 予定を実績のように書かない。相手の名前・条件は、了承が取れるまで書かない（公式サイト掲載済みの提携企業名は可）。
 *
 * type:
 *   NOW       … いま進めていること（準備中・継続中）
 *   LATEST    … 公開・開始したこと
 *   BUILD LOG … つくったもの・直したもの
 *   JOURNAL   … 決めたこと・考えたこと
 * source: どの事業の話か（カードの左上に出る）
 * href: 外部（LinkedIn・note・各サイト）のURLでも可。なければ省略
 */
export type ActivityType = 'NOW' | 'LATEST' | 'BUILD LOG' | 'JOURNAL';

export type Activity = {
  date: string; // YYYY-MM-DD（日がはっきりしない月単位の記録は YYYY-MM）
  type: ActivityType;
  source: 'Music Japan' | 'Baton Partners' | 'Baton' | 'SECOND TAKE' | 'LinkedIn' | 'note';
  title: string;
  body?: string;
  href?: string;
};

export const activity: Activity[] = [
  {
    date: '2026-10-02',
    type: 'BUILD LOG',
    source: 'Music Japan',
    title: 'このサイトを公開しました',
    body: '「Music Japanは何をしている会社なのか」に答えるためのサイトです。Baton Partners、Baton、SECOND TAKEのことを、ページを分けて書きました。',
  },
  {
    date: '2026-10-01',
    type: 'LATEST',
    source: 'Music Japan',
    title: '公式サイトを全面的につくり直しました',
    body: '日本語と英語の両方に対応し、作品ごとのページを加えました。',
    href: 'https://music-japan.com/',
  },
  {
    date: '2026-09-30',
    type: 'LATEST',
    source: 'Baton Partners',
    title: 'エボルグとCentral AXの専用ページを公開しました',
    body: '2社とも、トップ、取り組み、記事、サービス、話してみるの5ページです。色と書体は、1社ずつ一から決めました。',
    href: 'https://partners.music-japan.com/',
  },
  {
    date: '2026-09-30',
    type: 'LATEST',
    source: 'Baton',
    title: 'Batonに、松浦淳さん（Central AX）のプロフィールを公開しました',
    href: 'https://baton.music-japan.com/profile/matsuura/',
  },
  {
    date: '2026-09-20',
    type: 'JOURNAL',
    source: 'Baton',
    title: '紹介そのものは、自動化しないと決めました',
    body: '申請の受付や通知は仕組みに任せます。誰と誰をつなぐかは、相手を知っている人が決めます。',
  },
  {
    date: '2026-09-14',
    type: 'LATEST',
    source: 'Music Japan',
    title: '公式サイトに、代表プロフィールを公開しました',
    href: 'https://music-japan.com/profile/',
  },
  {
    date: '2026-09-13',
    type: 'LATEST',
    source: 'SECOND TAKE',
    title: '経営者インタビューメディア「SECOND TAKE」のサイトを公開しました',
    body: '経営者が一度目につまずいたあと、二度目に何を選んだのかを聞くメディアです。',
    href: 'https://secondtake.music-japan.com/',
  },
  {
    date: '2026-09-13',
    type: 'BUILD LOG',
    source: 'Music Japan',
    title: '公式サイトを music-japan.com に移しました',
    body: '公式サイト、SECOND TAKE、Baton、Baton Partnersを、同じドメインの下で運用できるようになりました。',
    href: 'https://music-japan.com/',
  },
  {
    date: '2026-10',
    type: 'NOW',
    source: 'SECOND TAKE',
    title: 'SECOND TAKEのPodcastを、配信に向けて準備しています',
  },
];

/** 日付の新しい順（同じ日付なら書いた順） */
export const sortedActivity = (): Activity[] =>
  activity
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.date === y.a.date ? x.i - y.i : x.a.date < y.a.date ? 1 : -1))
    .map(({ a }) => a);

/** 2026-09-30 → 2026.09.30 / 2026-09 → 2026.09 */
export const dotDate = (d: string): string => d.replaceAll('-', '.');
