/**
 * LIVE PROJECTS — Baton Partnersで公開・運用している企業ページ。
 * スクリーンショットは scripts/shots.mjs で baton-partners の本番ビルドから撮る（public/projects/）。
 * 公式サイトのパートナー一覧（BP-001〜）と同じ番号・表記にそろえる。並びは番号順。
 * featured の会社は、トップでも大きく見せる（ほかの会社は、その下のカードの一覧に出る）。
 * 確認中（draft）の会社は載せない。
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
  /** トップで大きく見せる */
  featured?: boolean;
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
      theme: 'MATCH',
      scene: 'PAIR',
      note: 'Emproのロゴは、赤と水色の三角が重なっています。求職者と求人が出会って、決まる。その瞬間をそのまま3Dにしました。散らばった三角が表に並び、線でつながり、重なって大きな印になります。',
    },
    palette: ['#EF2B33', '#1CCCE8', '#A8284A', '#121826'],
    type: '丸ゴシックと幾何学的な欧文',
    motif: '重なる赤と水色の三角',
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
      note: '黒い四角のロゴに合わせて、白黒の方眼紙の上に立方体を積みました。研修で終わらせず、現場で使えるまで組み上げる会社なので、建築模型の見た目にしています。',
    },
    palette: ['#0E0F12', '#FFFFFF', '#2B4BFF', '#8A8D96'],
    type: '太いゴシック体と方眼',
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
  {
    id: 'dp-partners',
    no: 'BP-003',
    name: '株式会社DPパートナーズ',
    service: 'サイト引越し屋さん',
    category: 'WordPressの引越し / 保守・復旧',
    base: '東京',
    catch: 'Webサイトを、資産にする。',
    world: {
      theme: 'CONSOLE',
      scene: 'VAULT',
      note: 'サイト引越し屋さんのロゴには、地球とトラックがいます。古いサーバーから新しいサーバーへ、オレンジのトラックがDPの箱を積んで走り、移し終えると監視の線が打ち始めます。壊れても、別の場所の控えから戻る。保守の考え方「絶対に復旧できる」を、そのまま動きにしました。',
    },
    palette: ['#0086C7', '#00B1E9', '#FF8317', '#0A2540'],
    type: '太いゴシックと等幅の英字',
    motif: '引越しのトラックと監視画面',
    href: 'https://partners.music-japan.com/dp-partners/',
    logo: { src: '/brand/dp-partners-white.png', w: 1000, h: 203 },
    pages: [
      { label: 'トップ', href: 'https://partners.music-japan.com/dp-partners/' },
      { label: '取り組み', href: 'https://partners.music-japan.com/dp-partners/about/' },
      { label: '記事：WordPressの保守、制作会社任せで大丈夫？', href: 'https://partners.music-japan.com/dp-partners/insights/wordpress-maintenance/' },
      { label: 'サイト引越し屋さん', href: 'https://partners.music-japan.com/dp-partners/service/' },
      { label: '話してみる', href: 'https://partners.music-japan.com/dp-partners/contact/' },
    ],
    shots: { desktop: '/projects/dp-partners-desktop.webp', desktop2: '/projects/dp-partners-desktop-2.webp', mobile: '/projects/dp-partners-mobile.webp' },
    featured: true,
  },
  {
    id: 'smartaleck',
    no: 'BP-005',
    name: '株式会社Smartaleck',
    category: 'SNS・動画 / デジタルマーケティング',
    base: '大阪',
    catch: '採用も、認知も、スマホの画面から。',
    world: {
      theme: 'STUDIO',
      scene: 'FEED',
      note: '公式サイトの看板は「WEBマーケティングのHERO」。撮影スタジオと漫画のヒーローを合わせて、網点と集中線、ファインダーの四隅で組みました。リールや動画の画面が漂い、最後は青い一点に集まります。',
    },
    palette: ['#1F92CA', '#231815', '#FF3B30', '#E4F2FA'],
    type: '極太の見出しと細長いイタリック',
    motif: '撮影スタジオと漫画のヒーロー',
    href: 'https://partners.music-japan.com/smartaleck/',
    logo: { src: '/brand/smartaleck-white.png', w: 800, h: 126 },
    pages: [
      { label: 'トップ', href: 'https://partners.music-japan.com/smartaleck/' },
      { label: '取り組み', href: 'https://partners.music-japan.com/smartaleck/about/' },
      { label: '記事：採用のためのInstagram、何から始める？', href: 'https://partners.music-japan.com/smartaleck/insights/instagram-recruiting/' },
      { label: 'デジタルマーケティング支援', href: 'https://partners.music-japan.com/smartaleck/service/' },
      { label: '話してみる', href: 'https://partners.music-japan.com/smartaleck/contact/' },
    ],
    shots: { desktop: '/projects/smartaleck-desktop.webp', desktop2: '/projects/smartaleck-desktop-2.webp', mobile: '/projects/smartaleck-mobile.webp' },
  },
  {
    id: 'presence',
    no: 'BP-006',
    name: 'Presence株式会社',
    service: 'P-ENJIN',
    category: '経営者コミュニティ / 採用支援',
    base: '東京・丸の内',
    catch: '肩書きより先に、人柄でつながる。',
    world: {
      theme: 'CHEER',
      scene: 'ENJIN',
      note: '企業理念は「日本一応援される会社に」。ロゴの星をまとったカメにならって、白地に亀甲の地紋を敷きました。六角形のタイルが集まって輪になり、星の光る甲羅になります。招待状や応援ボタンも、触って楽しめるようにしています。',
    },
    palette: ['#03417A', '#FF8001', '#FFB81C', '#0B1F3A'],
    type: '極太のゴシックと丸い欧文',
    motif: '輪になる亀甲と星',
    href: 'https://partners.music-japan.com/presence/',
    logo: { src: '/brand/presence-white.png', w: 702, h: 160 },
    pages: [
      { label: 'トップ', href: 'https://partners.music-japan.com/presence/' },
      { label: '取り組み', href: 'https://partners.music-japan.com/presence/about/' },
      { label: '記事：交流会に行っても、名刺が増えるだけ', href: 'https://partners.music-japan.com/presence/insights/executive-community/' },
      { label: 'P-ENJIN', href: 'https://partners.music-japan.com/presence/service/' },
      { label: '話してみる', href: 'https://partners.music-japan.com/presence/contact/' },
    ],
    shots: { desktop: '/projects/presence-desktop.webp', desktop2: '/projects/presence-desktop-2.webp', mobile: '/projects/presence-mobile.webp' },
    featured: true,
  },
];
