import type { Locale } from './releases';

/**
 * Questions people (and AI search) ask about Music Japan. Every answer restates facts
 * already published on this site — nothing here is new information. The same items feed
 * the visible FAQ, FAQPage JSON-LD and llms.txt, so they can never drift apart.
 */
export const faq: Record<Locale, { q: string; a: string }[]> = {
  ja: [
    { q: '合同会社Music Japanとはどんな会社ですか？', a: '大阪を拠点に、音楽制作・楽曲配信を軸として、Podcastやインタビューを通じて人の声と経験を記録する音楽・メディア会社です。' },
    { q: 'どんな事業をしていますか？', a: 'アーティスト作品の企画・楽曲制作・配信、オリジナル楽曲・BGMの企画制作、経営者メディア「SECOND TAKE」のPodcast・インタビュー記事の企画・取材・発信、LP掲載・メディア運営・協業を行っています。' },
    { q: '展開している音楽ブランド・アーティストは？', a: 'アーティストのYumaと、Cozy Cafe Jazz BGM（ジャズ）、Relaxing Classical Music Live（クラシック）、Deep Sleep Music Radio（睡眠音楽）の音楽ブランドを展開しています。' },
    { q: '作品はどこで聴けますか？', a: 'このサイトの「作品」ページで各作品を試聴できます。フル尺はYouTubeやApple Musicなどの配信先でお聴きいただけます。' },
    { q: 'SECOND TAKEとは何ですか？', a: '経営者の決断と苦悩、その先にある物語を、Podcastとインタビュー記事で記録する経営者メディアです。合同会社Music Japanが取材・発信まで手がけています。' },
    { q: 'Batonとは何ですか？', a: '合同会社Music Japanが運営する招待制の紹介サービスです。選んだ人から、選んだ人へ。お互いの価値観を大切に、深い関係構築を目指しています。' },
    { q: '代表者は誰ですか？', a: '代表社員は壁谷 友生（Kabeya Tomoki）です。' },
    { q: '所在地と連絡先を教えてください。', a: '〒530-0001 大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル12-12。メールは music.japan.llc@gmail.com、電話は 070-3175-7567 です。' },
    { q: '仕事の依頼や相談はどうすればいいですか？', a: 'お問い合わせページのフォームかメールでご連絡ください。TimeRexで打ち合わせの日程を選ぶこともできます。楽曲制作、BGM、Podcast出演、インタビュー掲載、Batonや協業のご相談を受け付けています。' },
  ],
  en: [
    { q: 'What is Music Japan LLC?', a: 'A music and media company based in Osaka, Japan, creating and distributing music while preserving people’s voices and experiences through podcasts and interviews.' },
    { q: 'What does Music Japan do?', a: 'Planning, production and distribution of artist releases; original music and BGM; planning, interviews and publication for the SECOND TAKE podcast and editorial stories; and dedicated pages, media operations and partnerships.' },
    { q: 'Which artists and music brands does Music Japan run?', a: 'The artist Yuma, and the music brands Cozy Cafe Jazz BGM (jazz), Relaxing Classical Music Live (classical) and Deep Sleep Music Radio (sleep music).' },
    { q: 'Where can I listen to the music?', a: 'Every release can be previewed on the Works page of this site. Full tracks are available on YouTube, Apple Music and other platforms.' },
    { q: 'What is SECOND TAKE?', a: 'An executive media series documenting the decisions, hardships and stories of business leaders through podcasts and in-depth interviews. Music Japan handles everything from interviews to publication.' },
    { q: 'What is Baton?', a: 'An invitation-only introduction service run by Music Japan LLC. From one chosen person to another: respecting each other’s values, it nurtures deeper relationships.' },
    { q: 'Who runs Music Japan?', a: 'The representative member is Tomoki Kabeya (壁谷 友生).' },
    { q: 'Where is Music Japan located and how can I reach it?', a: 'Osaka Ekimae No. 2 Building 12-12, 1-2-2 Umeda, Kita-ku, Osaka 530-0001, Japan. Email music.japan.llc@gmail.com, phone +81 70-3175-7567.' },
    { q: 'How do I start a project or ask a question?', a: 'Use the form on the contact page or email us. You can also pick a meeting time through TimeRex. We welcome enquiries about music, BGM, licensing, SECOND TAKE interviews, Baton introductions and partnerships.' },
  ],
};
