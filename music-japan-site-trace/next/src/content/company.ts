import feed from './partners.json';
import type { L10n } from './releases';

export const facts: { label: L10n; value: L10n; href?: string }[] = [
  { label: { ja: '会社名', en: 'Company' }, value: { ja: '合同会社Music Japan', en: 'Music Japan LLC' } },
  { label: { ja: '英語表記', en: 'Japanese name' }, value: { ja: 'Music Japan LLC', en: '合同会社Music Japan' } },
  { label: { ja: '代表社員', en: 'Representative Member' }, value: { ja: '壁谷 友生 / Kabeya Tomoki', en: 'Tomoki Kabeya / 壁谷 友生' } },
  {
    label: { ja: '所在地', en: 'Address' },
    value: {
      ja: '〒530-0001 大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル12-12',
      en: 'Osaka Ekimae No. 2 Building 12-12, 1-2-2 Umeda, Kita-ku, Osaka 530-0001, Japan',
    },
  },
  { label: { ja: '電話', en: 'Phone' }, value: { ja: '070-3175-7567', en: '+81 70-3175-7567' }, href: 'tel:+817031757567' },
  { label: { ja: 'メール', en: 'Email' }, value: { ja: 'music.japan.llc@gmail.com', en: 'music.japan.llc@gmail.com' }, href: 'mailto:music.japan.llc@gmail.com' },
  { label: { ja: '法人番号', en: 'Corporate No.' }, value: { ja: '8120003031493', en: '8120003031493' } },
];

export const businesses: { name: string; body: L10n }[] = [
  { name: 'ARTIST RELEASES', body: { ja: 'アーティスト作品の企画・楽曲制作・配信', en: 'Planning, production and distribution of artist releases' } },
  { name: 'MUSIC / BGM', body: { ja: 'オリジナル楽曲・BGMの企画制作', en: 'Original music and BGM planning and production' } },
  { name: 'SECOND TAKE', body: { ja: 'Podcast・インタビュー記事の企画・取材・発信', en: 'Planning, interviews and publication for podcasts and editorial stories' } },
  { name: 'MEDIA / PARTNERSHIP', body: { ja: 'LP掲載・メディア運営・協業', en: 'Dedicated pages, media operations and partnerships' } },
];

export const brandNames = ['Yuma', 'Cozy Cafe Jazz BGM', 'Relaxing Classical Music Live', 'Deep Sleep Music Radio'];

export const profile = {
  name: { ja: '壁谷 友生', en: 'Tomoki Kabeya' },
  roman: { ja: 'KABEYA TOMOKI', en: '壁谷 友生' },
  role: { ja: '合同会社Music Japan 代表社員', en: 'Representative Member, Music Japan LLC' },
  alt: { ja: '合同会社Music Japan 代表社員 壁谷友生', en: 'Tomoki Kabeya, representative member of Music Japan LLC' },
  statement: {
    ja: [
      'どうしようもなくつらい経験、孤独や絶望。それらをただ憎み、退けるのではなく、向き合い表現することで、日常生活では決して生まれないアウトプットが生まれると私は思います。',
      '音楽やメディア、Podcastというのは表現の手段です。',
      '合同会社Music Japanは、あらゆる自己表現とそこの共鳴からうまれる思いを繋ぎ、そして今苦境の最中にいる人の支えになるようなそんな記録を世に残せたらと思っています。',
    ],
    en: [
      'Experiences of unbearable pain, loneliness and despair. I believe that by facing and expressing them—rather than simply hating or rejecting them—we can create work that would never emerge from ordinary life.',
      'Music, media and podcasts are all means of expression.',
      'At Music Japan LLC, we hope to connect every form of self-expression with the feelings born through resonance, and leave behind records that may support those who are still living through hardship.',
    ],
  },
};

/**
 * パートナー（Baton Partners の掲載企業）。中身は partners.music-japan.com/partners.json の写し（partners.json）。
 * 社名・拠点・紹介文・ロゴは Baton Partners 側（baton-partners/src/partners/）だけで直す。ここには書かない。
 * ビルドのたびに scripts/sync-partners.mjs が最新を取りにいき、取れなかったときはこの写しのまま作る。
 * ロゴは同じパス（/partners/<slug>/...）で next/public/ に置く（同期のときに一緒に取ってくる）。
 */
type FeedLogo = { src: string; alt: string; width: number; height: number };
type FeedEntry = {
  id: string;
  no: string;
  href: string;
  name: L10n;
  base: L10n;
  category: L10n;
  title: L10n;
  body: L10n;
  service: string | null;
  logos: FeedLogo[];
  colors: string[];
};

export type Logo = { src: string; alt: string; w: number; h: number };

export type Partner = {
  id: string;
  no: string;
  name: L10n;
  logo: string;
  logoW: number;
  logoH: number;
  /** ロゴの帯に流すロゴ（会社のロゴと、あればサービスのロゴ） */
  logos: Logo[];
  service?: string;
  category: L10n;
  title: L10n;
  body: L10n;
  base: L10n;
  href: string;
  colors: [string, string];
};

/** 写しのURL（https://partners.music-japan.com/partners/...）を、このサイトに置いたロゴのパスにする */
const local = (src: string) => new URL(src).pathname;

function toPartner(e: FeedEntry): Partner {
  const logos = e.logos.map((l) => ({ src: local(l.src), alt: l.alt, w: l.width, h: l.height }));
  return {
    id: e.id,
    no: e.no,
    name: e.name,
    logo: logos[0].src,
    logoW: logos[0].w,
    logoH: logos[0].h,
    logos,
    ...(e.service ? { service: e.service } : {}),
    category: e.category,
    title: e.title,
    body: e.body,
    base: e.base,
    href: e.href,
    colors: [e.colors[0], e.colors[1] ?? e.colors[0]],
  };
}

/** 掲載企業（番号順）。件数・並び・文言は Baton Partners の公開中の一覧と同じ */
export const partners: Partner[] = (feed.partners as FeedEntry[]).map(toPartner);

/** Baton Partners そのもの（BP-000・運営：Music Japan）。掲載企業の最後に、別の札として置く */
export const operatorCard: Partner = toPartner(feed.operator as FeedEntry);

/** 写しの更新日（掲載企業の中でいちばん新しい日） */
export const PARTNERS_UPDATED: string = feed.updated;
