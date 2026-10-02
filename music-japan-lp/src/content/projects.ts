/**
 * LIVE PROJECTS — Baton Partnersで公開・運用している企業ページ。
 * スクリーンショットは scripts/shots.mjs で baton-partners の本番ビルドから撮る（public/projects/）。
 * 公式サイトのパートナー一覧（BP-001 / BP-002）と同じ番号・表記にそろえる。
 */
export type Project = {
  id: string;
  no: string;
  name: string;
  service?: string;
  category: string;
  base: string;
  catch: string;
  world: { theme: string; scene: string; note: string };
  palette: string[];
  type: string;
  motif: string;
  href: string;
  logo: { src: string; w: number; h: number };
  pages: { label: string; href: string }[];
  shots: { desktop: string; desktop2: string; mobile: string };
};

export const projects: Project[] = [
  {
    id: 'evorg',
    no: 'BP-001',
    name: '株式会社エボルグ',
    service: 'Empro',
    category: '人材紹介 / CRM・MA',
    base: '福岡',
    catch: '人材紹介の可能性を、次の成長へ。',
    world: {
      theme: 'EDITORIAL',
      scene: 'NETWORK',
      note: '赤と水色のロゴ。人と求人が「つながる」様子を、紙と墨と明朝の誌面に、点と線の球体で重ねました。',
    },
    palette: ['#E40010', '#1CCCE8', '#F4F1EA', '#14110F'],
    type: '明朝 × イタリック',
    motif: '点と線の球体',
    href: 'https://partners.music-japan.com/evorg/',
    logo: { src: '/brand/evorg-white.png', w: 517, h: 137 },
    pages: [
      { label: 'トップ', href: 'https://partners.music-japan.com/evorg/' },
      { label: '取り組み', href: 'https://partners.music-japan.com/evorg/about/' },
      { label: '記事：休眠求職者を掘り起こす5つの手順', href: 'https://partners.music-japan.com/evorg/insights/dormant-candidates/' },
      { label: 'Empro', href: 'https://partners.music-japan.com/evorg/service/' },
      { label: '話してみる', href: 'https://partners.music-japan.com/evorg/contact/' },
    ],
    shots: { desktop: '/projects/evorg-desktop.webp', desktop2: '/projects/evorg-desktop-2.webp', mobile: '/projects/evorg-mobile.webp' },
  },
  {
    id: 'central-ax',
    no: 'BP-002',
    name: '株式会社Central AX',
    category: 'AI研修 / 開発・業務改善',
    base: '名古屋',
    catch: 'AIを学ぶ、その先の実装まで。',
    world: {
      theme: 'MONO',
      scene: 'LATTICE',
      note: '黒一色の四角い枠のロゴ。「現場」と「実装」を、モノクロの方眼と立方体の建築模型で見せています。',
    },
    palette: ['#0E0F12', '#FFFFFF', '#2B4BFF', '#8A8D96'],
    type: '太いゴシック × 方眼',
    motif: '立方体の建築模型',
    href: 'https://partners.music-japan.com/central-ax/',
    logo: { src: '/brand/central-ax-white.png', w: 691, h: 210 },
    pages: [
      { label: 'トップ', href: 'https://partners.music-japan.com/central-ax/' },
      { label: '取り組み', href: 'https://partners.music-japan.com/central-ax/about/' },
      { label: '記事：生成AI、全社で入れたのに誰も使っていない', href: 'https://partners.music-japan.com/central-ax/insights/ai-adoption/' },
      { label: 'AI実装支援', href: 'https://partners.music-japan.com/central-ax/service/' },
      { label: '話してみる', href: 'https://partners.music-japan.com/central-ax/contact/' },
    ],
    shots: { desktop: '/projects/central-ax-desktop.webp', desktop2: '/projects/central-ax-desktop-2.webp', mobile: '/projects/central-ax-mobile.webp' },
  },
];
