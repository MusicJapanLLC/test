# Baton の SEO・AIO・LLMO 対策（2026-09-30）

対象: `/profile/`（Batonトップ）と各プロフィール（`/profile/<slug>/`、トップ `/` を含む）。

## 結論（何をしたか）

海外の一次情報・研究・実務記事 **130件** を読んだうえで、検索エンジンとAI検索の
**両方に共通する、普遍的な部分**だけを実装した。流行りの小技や、効果が確認されていない施策は入れていない。

| # | 施策 | なぜ（根拠） |
|---|---|---|
| 1 | **本文・内部リンク・FAQを静的HTMLに焼き込む**（`src/prerender/entry.ts`） | 主要なAIクローラー（GPTBot / ClaudeBot / PerplexityBot 等）はJavaScriptを実行しない。これまで本文の大半はJSで組み立てていたため、AIからはヒーロー以外がほぼ見えていなかった |
| 2 | **「〇〇とは」に一文で答える概要＋要点の表**を本文の冒頭に置く | AI回答は、段落単体で意味が通る「答えが先」の文を引用しやすい（GEO論文・AEO調査） |
| 3 | **画面に見えるFAQ**（各プロフィール5問・トップ4問） | 本文にFAQがあるページは引用数が多い。答えはすべて既存データの事実だけで組み立てる（作文しない） |
| 4 | **構造化データを1つのグラフに**（WebSite / 運営者Organization / ProfilePage / Person / 会社Organization / BreadcrumbList / FAQPage を `@id` で接続） | 人物・会社・運営者の関係を機械が取り違えないようにする。Personには写真・所属・拠点・専門・本人アカウント（sameAs）を入れる |
| 5 | **内部リンクの設計**（パンくず・「ほかの経営者」・フッターの全プロフィール／トップ／プライバシー） | どのページからも、トップと全プロフィールへ1クリックで行けるハブ＆スポーク型。リンク文は「名前（会社）」のように中身が分かる文にする |
| 6 | **タイトル・説明文の作り直し** | 「名前（会社 役職）｜事業タグ｜Baton」。探される言葉（名前・会社名・事業）を先頭に置く |
| 7 | **OGP画像（1200×630）**を全ページに | LINE / X / Facebook での見え方と、検索の画像プレビュー（`max-image-preview:large`） |
| 8 | **robots.txt でAI検索ボットを明示的に許可**、認証ページ（/verify/, /respond/）は除外＋noindex | OAI-SearchBot を塞ぐとChatGPT検索に出ない（OpenAI公式） |
| 9 | **sitemap.xml に lastmod と画像** | 更新日を正しく伝える（中身を変えたときだけ `updatedAt` を更新する） |
| 10 | **/llms.txt・/llms-full.txt・各プロフィールの index.md** | AIに要点をMarkdownで渡す提案（llmstxt.org）。※効果の実証はまだ弱い（下記）。低コストなので置いた |
| 11 | **IndexNow**（キー: `public/384b7059….txt`、送信: `node scripts/indexnow.mjs`） | Bing / Copilot 系へ数分で更新を知らせられる。Googleは非対応 |
| 12 | 合同会社Music Japan のリンクを `https://music-japan.com/` に統一 | フッターだけ旧URL（pages.dev）になっていた。会社のURLを全ページで一致させる（エンティティの一貫性） |

## 正直に書いておくこと（期待値）

- **「3日で検索上位」は約束できない。** Googleには決まった処理日数がなく、新しいページは数時間〜数週間かかる（[IndexerNow](https://www.indexernow.com/blog/how-long-google-index-new-site)）。
  早めるためにできることは、下の「公開後にやること」をすぐ実行すること。
- **Googleは「AI Overviews / AI Mode 用の特別な対策は不要、通常のSEOと同じ」と明言している**（[Google](https://developers.google.com/search/docs/appearance/ai-features)）。
  なので今回の中心は、特別な裏技ではなく「中身をHTMLで読ませる・誰が何者かを明確にする・内部リンクでつなぐ」。
- **llms.txt とFAQの構造化データは、AIの引用数を増やす証拠がまだ弱い**（[SE Ranking の調査](https://visible.seranking.com/blog/answer-engine-optimization/)）。
  効くのは「本文に見えるFAQ」の方。両方置いたが、主役は本文。
- **キーワードの詰め込みは生成AIには効かない**（[GEO論文](http://arxiv.org/pdf/2311.09735)）。やっていない。
- 実績の数字を独立したバッジにしない（`ADDING_A_PROFILE.md` の方針）はそのまま守っている。

## 公開後にやること（Ownerの作業・15分）

1. **Google Search Console** に `https://baton.music-japan.com/` を登録 → 「サイトマップ」に `sitemap.xml` を送信
   → 「URL検査」で `/profile/`・`/profile/matsuura/`・`/profile/kabeya/` を1つずつ「インデックス登録をリクエスト」
2. **Bing Webmaster Tools** にも登録（Search Console から取り込める）→ サイトマップ送信
3. 本番公開を確認したら `node scripts/indexnow.mjs`（Bing / Copilot 系に即通知）
4. **外部からのリンクを増やす**（最も効く）: Music Japan 公式サイト・SECOND TAKE・Central AX の公式サイト / note / X から、
   それぞれの Baton プロフィールへリンクしてもらう。会社名・人名の表記は Baton と完全に一致させる
5. 1〜2週間後、Search Console の「検索パフォーマンス」と「生成AIパフォーマンス」レポートで確認

## 掲載者を足すとき

`docs/ADDING_A_PROFILE.md` の `location` / `updatedAt` / `media[].owner` を必ず埋める。
FAQ・構造化データ・llms.txt・OGPのうち、OGP画像以外は自動で作られる（OGP画像は `public/og/<slug>.jpg` を1200×630で置く）。

## 参照した海外ソース（130件）


### Google公式（検索の基本・AI機能）（17件）

- SEOスターターガイド（タイトル・アンカーテキスト・パンくず・サイトマップ） — https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- 同 テキスト版 — https://developers.google.com/search/docs/fundamentals/seo-starter-guide.md.txt
- 同 アーカイブ — https://web.archive.org/web/20240910220949/https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Search Central ドキュメント — https://developers.google.com/search/docs
- Search Central — https://developers.google.com/search
- 有用で信頼できるコンテンツ／E-E-A-T（誰が・どう・なぜ） — https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- メタディスクリプションの書き方 — https://developers.google.com/search/docs/appearance/snippet
- 開発者向けSEO（クロール可能な<a>、1画面1URL） — https://developers.google.cn/search/docs/fundamentals/get-started-developers?hl=en
- Google公式: AI Overviews/AI Modeに出るための特別な要件はない（通常のSEOと同じ） — https://developers.google.com/search/docs/appearance/ai-features
- AI Overviews（Wikipedia） — https://en.wikipedia.org/wiki/AI_Overviews
- AI Overviews ヘルプ — https://support.google.com/websearch/answer/14901683?hl=en&co=GENIE.Platform%3DAndroid
- Search CentralのAI Overviews指針の解説 — https://www.stackmatix.com/blog/google-search-central-ai-overviews-guidance
- Search Consoleの生成AIパフォーマンスレポート（2026/06） — https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- GoogleのAI回答に出る方法（調査） — https://proudbrands.co.uk/research/gemini-and-google-ai/
- AI Modeの仕組み — https://seonest.uz/blog/google-ai-mode
- サイト運営者向けの新しい制御と分析 — https://blog.google/products-and-platforms/products/search/new-controls-website-owners/
- AI機能とサイト運営者 2026 — https://www.rizenmetrics.com/google-ai-features-and-your-website-what-site-owners-actually-need-to-know-in-2026/

### 生成AI検索の研究（GEO）（8件）

- GEO: Generative Engine Optimization (KDD'24) — 引用・統計・引用文の追加で生成AIでの可視性が最大40%向上。キーワード詰め込みは効果なし — https://dl.acm.org/doi/10.1145/3637528.3671900
- GEO arXiv版 — 流暢さ・分かりやすさの改善でも15〜30%向上 — https://arxiv.org/html/2311.09735v3
- GEO PDF — 下位ランクのサイトほど効果が大きい（Cite Sources +115%） — http://arxiv.org/pdf/2311.09735
- GEO (Semantic Scholar) — https://www.semanticscholar.org/paper/GEO%3A-Generative-Engine-Optimization-Aggarwal-Murahari/36a8e2185dfeb65259a6ca12dbcd80266319565f
- GEO (Princeton) — 効果は分野ごとに違う — https://collaborate.princeton.edu/en/publications/geo-generative-engine-optimization/
- AI Overviews: 答えを先に・構造・エンティティの権威・一貫した事実 — https://www.geoly.ai/blog/google-ai-overviews-optimization
- GEO: AIファースト検索向けコンテンツ論文 — https://ijirt.org/publishedpaper/IJIRT189707_PAPER.pdf
- GEO (ar5iv) — https://ar5iv.labs.arxiv.org/html/2311.09735

### AI回答に引用される書き方（AEO）（9件）

- AEO調査: 本文にFAQがあるページは引用4.9回 vs 4.4回。FAQスキーマ単体はChatGPTで効果なし。llms.txtと引用頻度は相関なし — https://visible.seranking.com/blog/answer-engine-optimization/
- AEO完全ガイド2026 — https://www.airops.com/blog/aeo-answer-engine-optimization
- AEO向けFAQの書き方（冒頭40〜60語で答える） — https://blog.hubspot.com/marketing/faqs-for-aeo
- AEOとは — https://www.typeface.ai/blog/what-is-answer-engine-optimization-why-aeo-matters
- AIに引用されるためのAEO — https://monday.com/blog/marketing/answer-engine-optimization/
- HubSpot AEOガイド — https://www.hubspot.com/products/marketing/aeo-guide
- AEO 2026: 段落単体で意味が通る書き方 — https://contextbolt.com/blog/answer-engine-optimization/
- AEO/GEO完全ガイド — https://www.surmado.com/blog/answer-engine-optimization-aeo-geo-guide
- AEO 2026ガイド — https://loudscale.com/guides/answer-engine-optimization-2026-guide/

### AIクローラーとJavaScript（10件）

- AIクローラー一覧（GPTBot / OAI-SearchBot / ChatGPT-User / PerplexityBot 等） — https://help.otterly.ai/ai-crawlers
- AIクローラーUA公開データセット — https://github.com/osamamumtaz01/ai-crawler-user-agents
- 主要AIクローラーはJavaScriptを実行しない（Vercel/MERJ） — https://vercel.com/blog/the-rise-of-the-ai-crawler
- CSRページはAI検索から見えない（curl検証） — https://jangwook.net/en/blog/en/ai-crawlers-dont-render-javascript-csr-2026
- ChatGPTはJSを実行しない — https://seo.ai/blog/does-chatgpt-and-ai-crawlers-read-javascript
- SPAはLLMから見えない（GPTBot 5億フェッチでJS実行ゼロ） — https://www.getpassionfruit.com/blog/javascript-rendering-and-ai-crawlers-can-llms-read-your-spa
- 23のAIクローラーのJS対応状況 — https://www.searchviu.com/en/ai-crawlers-javascript-rendering
- robots.txtでAI検索（回答）用ボットは許可するのが基本 — https://pixis.ai/blog/robots-txt-for-ai-crawlers-gptbot-perplexitybot-geo-audit
- AIクローラーはJSを読むが実行しない — https://usehall.com/guides/chatgpt-ai-crawlers-javascript-rendering
- SSRはAI可視性の前提条件 — https://blckalpaca.at/en/knowledge-base/seo-geo/technical-seo/javascript-rendering-and-ai-crawlers-the-visibility-divide

### 静的HTMLとJavaScript描画（9件）

- SSRとSEO（Airtable） — https://medium.com/airtable-eng/server-side-rendering-and-its-relationship-with-seo-d9fff26bdde9
- CSRとSSRの比較 — https://strapi.io/blog/client-side-rendering-vs-server-side-rendering
- SSR vs CSR — https://screpy.com/blog/server-side-rendering-vs-client-side-rendering-for-seo/
- JavaScript SEO — https://d5creation.com/html-javascript-seo/
- Googleの推奨（SSR/静的生成） — https://www.stanventures.com/news/server-side-vs-client-side-rendering-what-google-recommends-1683/
- CSRのSEO課題（本文・内部リンク・構造化データがJS待ちになる） — https://www.greadme.com/blog/seo/seo-issues-with-client-side-rendering-complete-guide
- レンダリング方式の選び方 — https://scale-xpert.com/server-side-vs-client-side-rendering-seo-comparison-guide/
- SSR vs CSR 性能比較 — https://www.dzinepixel.com/blog/server-side-rendering-vs-client-side-rendering-seo-performance-comparison/
- JSレンダリングとSEO 2026 — https://www.clickrank.ai/javascript-rendering-affect-seo/

### 構造化データ（Person / ProfilePage / Organization）（10件）

- ProfilePage構造化データ（mainEntity=Person、dateModified） — https://developers.google.com/search/docs/appearance/structured-data/profile-page
- schema.org ProfilePage（significantLink等） — https://google.schema.org/ProfilePage
- Person+Organizationを@graphと@idでつなぐテンプレート — https://gist.github.com/Janady13/4f3245a2ba615e5e87f25f30f123a402
- Organization構造化データ（ホームページに置く・sameAs・logo） — https://developers.google.com/search/docs/appearance/structured-data/organization
- schema.org ProfilePage — https://schema.org/ProfilePage
- Personスキーマの構造（コミュニティ） — https://support.google.com/webmasters/thread/192956689/schema-structure-for-a-person?hl=en
- schema.org Person（jobTitle/worksFor/knowsAbout/sameAs） — https://schema.org/Person
- 構造化データ一般ガイドライン（見えている内容だけをマークアップ） — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- sameAsで同一実体を示す考え方 — https://developers.google.com/search/docs/appearance/structured-data/dataset
- ProfilePage→mainEntity→Person＋sameAsの推奨構造 — https://meta.discourse.org/t/applying-schema-org-on-the-user-profile-page-for-improved-author-authority-on-google/196054?tl=en

### エンティティ（人物・会社の同一性）（9件）

- エンティティSEO（sameAs・Wikidata） — https://www.1digitalagency.com/glossary/entity-seo/
- LLM時代のエンティティSEO — https://academy.mlforseo.com/course/ai-search-llms-entity-seo-and-knowledge-graph-strategies-for-brands/
- ブランドのナレッジグラフを作る — https://opollo.com/blog/entity-based-seo-for-aeo-how-to-build-a-brand-knowledge-graph-for-ai-search/
- ナレッジグラフSEO 2026 — https://jottler.co/blog/knowledge-graph-seo
- AI検索向けエンティティ最適化 — https://ighenatt.es/en/blog/entity-seo-ai-optimization-guide/
- エンティティSEOとナレッジグラフ — https://bbehmermedia.com/entity-seo-knowledge-graph-optimization
- 名前・説明・URLを全媒体で一致させる — https://akii.com/blog/entity-seo-for-ai-the-advanced-2026-guide
- 検索エンジンのナレッジグラフ利用 — https://www.gwcontent.com/blogs/news/entity-seo
- AIに信頼されるエンティティ — https://www.fokal.com/ai-seo/entity-seo/

### 内部リンク設計（11件）

- スターターガイドの要点 — https://glasp.co/discover?url=developers.google.com%2Fsearch%2Fdocs%2Ffundamentals%2Fseo-starter-guide
- 内部リンクとアンカーテキスト — https://gr0.com/blog/internal-linking-best-practices
- ハブ＆スポーク型の内部リンク — https://dev.to/joseph_anady_214bacedf939/internal-linking-hub-and-spoke-architecture-4dhd
- 内部リンクの戦略とクロール性 — https://www.frase.io/blog/mastering-the-internal-link-for-seo-a-strategic-framework-for-site-architecture-and-crawlability
- 内部リンク設計ガイド2026 — https://visiblefactors.com/what-is-internal-linking/
- ハブ＆スポーク戦略 — https://virayo.com/blog/hub-and-spoke-seo
- 内部リンクの最適化 — https://brandstory.in/blogs/internal-linking/
- ハブ・スポーク・サイトリンク — https://weareyellowball.com/guides/internal-linking-strategies/
- トピッククラスター — https://eseospace.com/blog/internal-linking-strategy-for-seo-how-to-build-topic-clusters-that-rank/
- 説明的なアンカーは汎用語の5倍の流入 — https://www.searchscaleai.com/blog/internal-linking-strategy-guide-2026/
- 競合から学ぶ内部リンク — https://upwardengine.com/blog/internal-linking-strategies-learn-from-competitors/

### llms.txt・AI検索ボット（10件）

- OpenAIのクローラー（OAI-SearchBotを許可するとChatGPT検索に出る） — https://developers.openai.com/api/docs/bots
- /llms.txt v2（Markdownでサイトの要点をまとめる。H1必須） — https://llmstxt.org/
- Google Indexing API / IndexNow / llms.txt検査 — https://www.indexernow.com/
- llms.txt 提案リポジトリ — https://github.com/answerdotai/llms-txt
- llms.txt 仕様と2026年の採用状況 — https://macmdviewer.com/blog/llms-txt-guide
- LLMs.txt解説（TDS） — https://medium.com/data-science/llms-txt-explained-414d5121bcb3
- llms.txtの概要（Anthropic・Cloudflare・Perplexityも公開） — https://txt-llms.com/about-llms-txt
- ChatGPT検索に出る条件（OAI-SearchBotを塞がない、utm_source=chatgpt.com） — https://help.openai.com/en/articles/12627856
- llms.txt 仕様原文 — https://github.com/AnswerDotAI/llms-txt/blob/main/nbs/index.qmd
- llms.txt 各ページの.md版を置く提案 — https://pypi.org/project/llms-txt

### インデックスを早める（sitemap / IndexNow）（10件）

- IndexNow実装手順（ルートにキーファイル） — https://indexnowtool.com/how-to/bing-indexnow-implementation
- サイトマップの作成と送信 — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- IndexNow: Bing等は数分で再クロール。Googleは非対応 — https://specification.website/okf/seo/indexnow.md
- Bing Webmaster Tools IndexNow — https://www.bing.com/webmasters/help/indexnow-0z209wby
- IndexNow公式ドキュメント — https://www.indexnow.org/documentation
- IndexNow 参加検索エンジン — https://www.indexnow.org/searchengines
- sitemapのlastmod — https://developers.google.com/search/blog/2006/04/using-lastmod-attribute
- IndexNow キーの文字種・一括送信 — https://www.indexnow.org/en_gb/documentation
- IndexNow対応エンジン一覧 — https://www.indexbolt.com/glossary/indexnow
- 新規サイトのGoogleインデックスは数時間〜数週間。Search Console・サイトマップ・内部リンクで短縮 — https://www.indexernow.com/blog/how-long-google-index-new-site

### OGP画像（9件）

- OG画像サイズ（イリノイ大学） — https://web-help.prairie.illinois.edu/social-media/open-graph-image-sizes/
- OG画像 1200x630 が共通規格 — https://www.krumzi.com/blog/open-graph-image-sizes-for-social-media-the-complete-2026-guide
- OG画像の要件 — https://doinwp.com/og-image-size-and-requirements/
- OG画像の寸法 — https://opengraphchecker.com/blog/open-graph-image-size/
- OG画像サイズガイド — https://ogdynamic.com/blog/og-image-size-guide
- OG画像完全ガイド — https://ghostlyinc.com/en-us/open-graph-images-complete-guide/
- 1200×630ルール — https://favicon.now/blog/open-graph-image-size
- OG画像ベストプラクティス（絶対URL・HTTPS） — https://onlinetools4free.com/blog/og-image-best-practices
- Open Graph SEO — https://nogood.io/blog/open-graph-seo/

### robotsメタ・スニペット制御（9件）

- 大きな画像プレビューの事例（Google） — https://developers.google.com/search/case-studies/large-images-case-study
- スニペット制御（max-snippet等） — https://searchengineland.com/google-adds-new-snippet-controls-to-enable-control-over-how-your-search-listings-are-displayed-322456
- robotsメタタグ解説 — https://ahrefs.com/blog/meta-robots/
- Discover最適化（max-image-preview:large） — https://medium.com/@matteo.arellano/google-discover-optimizations-what-if-you-just-needed-to-update-a-couple-of-html-tags-to-get-more-d0c676648571
- AI Overviewsでの大きな画像プレビュー — https://sitespeak.ai/ai-overview-glossary/max-image-preview-meta-tag
- max-snippet / max-image-preview — https://patrickstox.com/technical-seo/on-page/meta-tags/max-snippet-max-image-preview/
- max-image-preview ガイド — https://not-a-robot.com/blog/max-image-preview-guide/
- max-snippet:-1 とAEO — https://jwatte.com/blog/blog-max-snippet-robots-directive/
- robotsメタの全ディレクティブ — https://wildandfreetools.com/blog/robots-meta-tag-all-directives/

### 表示速度（Core Web Vitals）（9件）

- Core Web Vitals 2026 — https://www.w3era.com/blog/seo/core-web-vitals-guide/
- LCP<2.5s / INP<200ms / CLS<0.1 — https://www.corewebvitals.io/core-web-vitals
- CWVの改善（コード例） — https://blog.eduonix.com/2026/09/core-web-vitals-performance-engineering-in-2026-measuring-debugging-and-fixing-lcp-inp-cls-with-real-code/
- INP/LCP/CLS最適化 — https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide
- CWVの修正 — https://seoscore.tools/blog/core-web-vitals/
- CWVとUX・SEO — https://rankforge-agency.com/blog/core-web-vitals-2026
- CWVの意味と対処 — https://toolspivot.com/blog/core-web-vitals-guide
- CWVのしきい値 — https://webhelpagency.com/blog/core-web-vitals-2026/
- CWVガイド2026 — https://technovapartners.com/en/insights/core-web-vitals-guide-2026
