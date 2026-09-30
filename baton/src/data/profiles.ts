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
 * 「その人専用の小さなLP」として、人物紹介・事業内容・運営メディア・
 * メディア・話したいCTAまでを1ページに収める。
 * 今後、出演コンテンツが増えるたびに media / services を追記していく想定。
 */
const kabeyaProfile: TalkProfile = {
  id: 'kabeya',
  slug: 'kabeya',
  name: '壁谷 友生',
  company: '合同会社Music Japan',
  title: '代表社員',
  tagline: '学び、紡ぎ、繋いでいく。',
  photo: {
    src: '/profile-kabeya-hd.webp',
    alt: '壁谷 友生',
    caption: 'OSAKA / JAPAN · 2026',
  },
  bio:
    'Podcast「SECOND TAKE（セカンドテイク）」にて、経営者の決断や苦悩、それらをどう乗り越えてきたのか。' +
    'その人自身の言葉や経験を「インタビュー記事」として記録していく経営者メディアを運営しています。',
  business: [
    '「音楽制作・メディア運営・法人紹介」の三事業を展開。' +
      '招待制の紹介サービス「Baton -バトン-」では、運営が実際に面談した経営者・事業者の中から、' +
      '双方に可能性があると判断した相手を紹介しています。',
  ],
  services: [
    { name: 'Music Japan', description: '海外向け音楽、Jazz、BGMの制作・配信' },
    { name: 'SECOND TAKE', description: '経営者の決断と苦悩を記録するPodcast' },
    { name: 'Interview', description: '経営者の人生と事業を残す記事メディア' },
    { name: 'Baton -バトン-', description: '招待制紹介サービスで深く長い関係づくりを。' },
  ],
  media: [
    { label: '公式HP', url: 'https://music-japan.com/', image: '/media-musicjapan-hp.png' },
    {
      label: 'SECOND TAKE インタビュー',
      url: 'https://secondtake.music-japan.com/',
      image: '/media-secondtake-logo.webp',
    },
  ],
  listSummary: '招待制紹介サービス「Baton」の運営',
  businessTags: ['音楽制作', 'メディア運営', '法人紹介'],
  keywordTags: ['洋楽/Jazz', '経営者対談', '完全招待制'],
  theme: { primary: '#C8102E', accent: '#D9A441', bg: '#0A0A0C', text: '#EDEAE4' },
  heavyWebGL: true,
  active: true,
};

/**
 * 松浦 淳（株式会社Central AX）。
 * 掲載内容は、Ownerが取りまとめた調査メモ（2026-09-30時点）に書かれた事実のみ。
 * 資本金・従業員数・売上などの企業スペックは載せない（ADDING_A_PROFILE.md の方針）。
 * 公式サイト（https://central-ax.co.jp/）は Owner から提供されたURL。
 * label を「公式サイト」にしてあるので、構造化データの会社URLにも反映される。
 */
const matsuuraProfile: TalkProfile = {
  id: 'matsuura',
  slug: 'matsuura',
  name: '松浦 淳',
  company: '株式会社Central AX',
  title: '代表取締役CEO',
  tagline: 'AIを、現場で使われるところまで。',
  photo: {
    src: '/profile-matsuura.webp',
    alt: '松浦 淳',
    caption: 'NAGOYA / JAPAN · 2026',
  },
  bio:
    '名古屋を拠点に、企業のAI実装を支援する株式会社Central AXの代表。' +
    '生成AI研修から業務改善・システム開発、AI検索対策（LLMO）まで、' +
    'AIを「導入して終わり」にせず、社員が実際に使って業務が変わるところまで伴走しています。',
  business: [
    '2026年5月に設立したAI実装会社として、AI研修・人材育成、AI受託開発・業務改善、LLMO／AI検索対策の3つを一社で手がけています。' +
      '設立から2026年8月末までに、20社を支援しました。',
    'ChatGPT・Claude・Claude Code・Gemini・Microsoft 365 Copilot・RAG・MCPなどを扱いながら、ツールありきではなく、' +
      '企業ごとの業務から「何を楽にするか」を決めて設計します。松浦自身はClaude Codeをリリース日から活用しています。' +
      '愛知・岐阜・三重・静岡の東海4県を重点に、製造・建設・物流・観光など、現場へ足を運ぶ支援を続けています。',
    '登壇・発信も設立直後から積極的に行っており、公認会計士向けのClaude Code実演デモ、Microsoft 365 Copilotのセミナー、' +
      '製造業向け展示会でのAIセキュリティ講演、四日市商工会議所での経営者向けAIセミナーなどに登壇しています。',
  ],
  services: [
    {
      name: '研修・人材育成',
      description: 'ChatGPT・Claude・Copilotなどを、自社の実業務を題材に、社員が使える状態まで',
    },
    {
      name: '受託開発・業務改善',
      description: 'ヒアリング→業務整理→PoC→実装→定着。小さく検証してから広げる',
    },
    {
      name: 'LLMO／AI検索',
      description: 'ChatGPTやGeminiなどに、企業情報が参照・引用されやすい状態をつくる',
    },
  ],
  media: [
    {
      label: 'AIで変わる会計士実務 ― Claude Code実演デモ',
      url: 'https://luma.com/ud5yi7ed',
      kind: '登壇',
      date: '2026.08.10',
      note: '公認会計士・税理士の畠山謙人氏と共同開催。監査調書・財務DD・企業分析をClaude Codeで処理する実演に、120名が申込。',
      featured: true,
    },
    {
      label: '製造業向け展示会セミナー｜生成AIの機密情報・シャドーAI対策',
      url: 'https://biz.q-pass.jp/f/13216/inw_autumn_seminar26/seminar_register?fid=E1mNKjK3Zn03kn05&tag=16009',
      kind: '登壇',
      date: '2026.09',
      note: 'ネプコン ジャパン／オートモーティブ ワールド／ファクトリーイノベーション Week 関連。図面・仕様書・原価表などをAIへ入力する際の線引きを解説。',
      featured: true,
    },
    {
      label: 'Central AX 設立プレスリリース',
      url: 'https://prtimes.jp/main/html/rd/p/000000003.000188813.html',
      kind: '掲載',
      note: 'PR TIMES。設立の背景、創業コメント、事業内容、東海でAI実装を進める理由。',
      featured: true,
    },
    {
      label: 'Microsoft 365 Copilot活用ユースケース徹底攻略20選',
      url: 'https://luma.com/aideeplive_260914',
      kind: '登壇',
      date: '2026.09.14',
      note: 'Outlook・Teams・Word・Excel・PowerPointなど、既に使っている環境へのAI導入を解説。',
      featured: true,
    },
    {
      label: '公式サイト',
      url: 'https://central-ax.co.jp/',
      kind: '公式',
      note: '株式会社Central AX。AI研修・AI受託開発・LLMO対策のサービス詳細。',
    },
    {
      label: 'ATIS × Central AX 経営者向けAI活用セミナー（四日市）',
      url: 'https://prtimes.jp/main/html/rd/p/000000005.000188813.html',
      kind: '掲載',
      date: '2026.10.05 開催予定',
      note: 'PR TIMES。四日市商工会議所にて開催。松浦のコメントも掲載。',
    },
    {
      label: 'テレ東プラス',
      url: 'https://www.tv-tokyo.co.jp/plus/external-pr/entry/255701.html',
      kind: '掲載',
      note: '上記PR TIMESリリース（四日市セミナー）の転載掲載。',
    },
    {
      label: 'Central AX 公式note',
      url: 'https://note.com/central_ax',
      kind: '発信',
      note: 'AI導入・業務効率化・Claude Code・生成AIの現場定着などを継続的に発信。',
    },
    {
      label: 'X @JunP1ayer',
      url: 'https://x.com/JunP1ayer',
      kind: '発信',
      note: 'AI×業務改善、Claude Code、企業へのAI導入について本人が発信。',
    },
  ],
  mediaFirst: true,
  servicesTitle: '事業領域',
  listSummary: '企業のAI実装を現場まで伴走',
  businessTags: ['AI研修', '受託開発', 'LLMO対策'],
  keywordTags: ['現場定着', 'Claude Code', '東海発'],
  // 淡い水色の地は野暮ったく見えるため、深い紺の地に電光のような青を差す
  theme: { primary: '#2F5BEA', accent: '#5CC8FF', bg: '#050914', text: '#E6ECF8' },
  active: true,
};

export const profiles: TalkProfile[] = [kabeyaProfile, matsuuraProfile];

export const getProfile = (id: string): TalkProfile => {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown profile id: ${id}`);
  return found;
};
