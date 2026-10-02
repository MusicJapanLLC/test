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

export type Partner = {
  id: string;
  no: string;
  name: L10n;
  logo: string;
  logoW: number;
  logoH: number;
  service?: { name: string; logo: string; w: number; h: number };
  category: L10n;
  title: L10n;
  body: L10n;
  base: L10n;
  href: string;
  colors: [string, string];
};

export const partners: Partner[] = [
  {
    id: 'evorg',
    no: 'BP-001',
    name: { ja: '株式会社エボルグ', en: 'Evorg Inc.' },
    logo: '/partners/evorg-white.png',
    logoW: 517,
    logoH: 137,
    service: { name: 'Empro', logo: '/partners/empro-white.png', w: 525, h: 154 },
    category: { ja: '人材紹介 / CRM・MA', en: 'RECRUITMENT / CRM & MA' },
    title: { ja: '人材紹介の可能性を、次の成長へ。', en: 'Helping recruitment businesses grow.' },
    body: {
      ja: '人材紹介会社向けのワンストップCRM・MA「Empro」を提供。データとAI、専任コンサルタントの伴走を通じて、採用決定と事業の成長を支援します。',
      en: 'Evorg provides Empro, a CRM and marketing automation platform for recruitment agencies, combining data, AI and dedicated consulting to support placements and business growth.',
    },
    base: { ja: '福岡', en: 'FUKUOKA' },
    href: 'https://partners.music-japan.com/evorg/',
    colors: ['#e0142f', '#1fb5d6'],
  },
  {
    id: 'central-ax',
    no: 'BP-002',
    name: { ja: '株式会社Central AX', en: 'Central AX Inc.' },
    logo: '/partners/central-ax-white.png',
    logoW: 691,
    logoH: 210,
    category: { ja: 'AI研修 / 開発・業務改善', en: 'AI TRAINING / DEVELOPMENT' },
    title: { ja: 'AIを学ぶ、その先の実装まで。', en: 'From learning AI to putting it to work.' },
    body: {
      ja: '生成AI研修、AI受託開発・業務改善、LLMO対策を手がけるAI実装支援会社。名古屋を拠点に、全国の企業のAI活用を支援します。',
      en: 'Based in Nagoya and serving companies across Japan, Central AX supports generative AI training, custom AI development, workflow improvements and AI search optimization.',
    },
    base: { ja: '名古屋', en: 'NAGOYA' },
    href: 'https://partners.music-japan.com/central-ax/',
    colors: ['#eeeef2', '#5b5bf0'],
  },
  {
    id: 'smartaleck',
    no: 'BP-003',
    name: { ja: '株式会社Smartaleck', en: 'Smartaleck Inc.' },
    logo: '/partners/smartaleck-white.png',
    logoW: 800,
    logoH: 126,
    category: { ja: 'SNS・動画 / デジタルマーケティング', en: 'SOCIAL & VIDEO / DIGITAL MARKETING' },
    title: { ja: '採用も、認知も、スマホの画面から。', en: 'Hiring and awareness, starting on the phone screen.' },
    body: {
      ja: 'Instagram、YouTube、インフルエンサー、LINE公式アカウント、AIの検索。企業の採用と集客を、企画から撮影、運用、分析までまとめて引き受ける大阪・淀屋橋の会社です。',
      en: 'Instagram, YouTube, influencers, LINE official accounts and AI search. Based in Yodoyabashi, Osaka, Smartaleck takes on companies’ recruiting and marketing, from planning and filming to running accounts and reading the numbers.',
    },
    base: { ja: '大阪', en: 'OSAKA' },
    href: 'https://partners.music-japan.com/smartaleck/',
    colors: ['#1f92ca', '#eef4f8'],
  },
];
