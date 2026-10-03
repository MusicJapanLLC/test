# SEO・AIO・LLMO 出典リスト（Baton Partners）

調査日：2026-09-30〜10-01　／　調査者：Claude（Baton Partners の実装担当）

- 海外の一次情報を優先し、検索で本文または抜粋を確認できたものだけを載せる。
- 根拠の強さ：**公式**（検索エンジン・AI企業・仕様策定者の文書）／**研究**（査読・プレプリント論文）／**データ**（大規模データ調査）／**解説**（専門メディア・実務家の意見）。
- 「確認」は、本文を取得して読んだものを **本文**、検索結果の抜粋で要点を確認したものを **抜粋** とした。
- 実装に採用するのは、**公式**、または**複数のデータ調査で裏付けがある**ものだけ。迷信（キーワード密度、meta keywords など）は採用しない。

件数：**120件**（公式 62／研究 6／データ 20／解説 32）

---

## A. Google 検索セントラル（公式）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 1 | https://developers.google.com/search/docs/fundamentals/seo-starter-guide | 検索エンジンが内容を理解し、人が訪問を決められるようにするのがSEO。サイトマップとリンクで発見、独自で役立つ内容、URL・タイトル・説明・画像の最適化 | 公式 | 抜粋 |
| 2 | https://developers.google.com/search/blog/2024/02/ssg-gets-a-makeover | スターターガイド改訂。重複コンテンツ、よくあるSEOの俗説、成果が出るまでの期間の節を追加 | 公式 | 抜粋 |
| 3 | https://developers.google.com/search/docs | 検索セントラルのドキュメント目次 | 公式 | 抜粋 |
| 4 | https://developers.google.com/search/docs/fundamentals/get-started-developers | 開発者向けSEOガイド | 公式 | 抜粋 |
| 5 | https://developers.google.com/search/docs/fundamentals/get-on-google | Googleに載る方法（発見・クロール・インデックス） | 公式 | 抜粋 |
| 6 | https://developers.google.com/search/docs/appearance/ai-features | AI Overviews / AI Mode に出るための追加要件はない。インデックスされ、スニペット表示の対象であること。特別な構造化データも不要 | 公式 | 抜粋 |
| 7 | https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search | AI検索で成果を出すための公式ブログ。従来のSEOの基本がそのまま有効 | 公式 | 抜粋 |
| 8 | https://blog.google/products-and-platforms/products/search/new-controls-website-owners/ | サイト運営者向けの新しい制御と洞察（AI機能関連） | 公式 | 抜粋 |
| 9 | https://developers.google.com/search/docs/appearance/structured-data/sd-policies | 構造化データはページに見えている内容の正確な表現であること。欺く目的の使用は禁止 | 公式 | 抜粋 |
| 10 | https://developers.google.com/search/docs/appearance/structured-data/breadcrumb | BreadcrumbList は2つ以上の ListItem。URL構造ではなく、典型的なユーザーの経路を表す | 公式 | 抜粋 |
| 11 | https://developers.google.com/search/docs/appearance/structured-data/search-gallery | Googleが対応する構造化データの一覧 | 公式 | 抜粋 |
| 12 | https://developers.google.com/search/docs/appearance/structured-data/organization | Organization をホームページに置くと、組織の情報理解と識別に役立つ。最も具体的なサブタイプを使う | 公式 | 抜粋 |
| 13 | https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data | 構造化データの仕組み。JSON-LD推奨 | 公式 | 抜粋 |
| 14 | https://developers.google.com/search/docs/appearance/structured-data/article | Article に必須プロパティはない。該当するもの（著者・日付・画像など）を足す | 公式 | 抜粋 |
| 15 | https://developers.google.com/search/docs/appearance/structured-data/faqpage | FAQPage の文書（リッチリザルトは縮小のち終了） | 公式 | 抜粋 |
| 16 | https://developers.google.com/search/blog/2023/08/howto-faq-changes | 2023年8月、FAQリッチリザルトを政府・医療の著名サイトに限定。HowToはモバイルで廃止 | 公式 | 抜粋 |
| 17 | https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce | EC向け構造化データ（参考。今回は対象外） | 公式 | 抜粋 |
| 18 | https://developers.google.com/search/docs/appearance/snippet | meta description は内容を正確に要約すると表示に使われやすい。クリック率に効くが順位には影響しない | 公式 | 抜粋 |
| 19 | https://developers.google.com/search/docs/appearance/title-link | すべてのページに固有で説明的な title。「ホーム」のような曖昧な語や冗長な長さを避ける | 公式 | 抜粋 |
| 20 | https://developers.google.com/search/blog/2017/06/better-snippets-for-your-users | 良いスニペットのための説明文の書き方 | 公式 | 抜粋 |
| 21 | https://developers.google.com/search/docs/appearance/google-images | 画像の alt は内容を具体的に。詰め込みはスパム扱いの恐れ。装飾画像は alt="" | 公式 | 抜粋 |
| 22 | https://developers.google.com/search/help/site-appearance-faq | 検索結果での見え方のFAQ | 公式 | 抜粋 |
| 23 | https://developers.google.com/search/docs/crawling-indexing/special-tags | Googleが対応するmetaタグ一覧（keywords は含まれない） | 公式 | 抜粋 |
| 24 | https://developers.google.com/search/docs/crawling-indexing/links-crawlable | リンクは href 付きの `<a>` でないと辿れない。アンカーテキストは説明的・簡潔・関連性。「こちら」は避ける。大事なページには他ページから最低1本のリンク | 公式 | 抜粋 |
| 25 | https://developers.google.com/search/blog/2008/10/importance-of-link-architecture | リンク構造（内部リンクの設計）の重要性 | 公式 | 抜粋 |
| 26 | https://developers.google.com/search/docs/crawling-indexing/url-structure | URLは単純で読める構造に | 公式 | 抜粋 |
| 27 | https://developers.google.com/search/docs/appearance/sitelinks | サイトリンクは自動生成。明確な構造と説明的なアンカーが助けになる | 公式 | 抜粋 |
| 28 | https://developers.google.com/search/docs/essentials | Search Essentials（旧ウェブマスター向けガイドライン） | 公式 | 抜粋 |
| 29 | https://developers.google.com/search/docs/essentials/technical | 技術要件：Googlebotをブロックしない、HTTP 200、インデックス可能な内容 | 公式 | 抜粋 |
| 30 | https://developers.google.com/search/docs/essentials/spam-policies | キーワードの詰め込み、隠しテキストは違反。アコーディオンやタブは違反ではない | 公式 | 抜粋 |
| 31 | https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag | Googleは meta keywords を順位に使わない | 公式 | 抜粋 |
| 32 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | lastmod は内容・構造化データ・リンクなど重要な更新の日時。著作権年の更新は含めない。canonical URLだけを載せる | 公式 | 抜粋 |
| 33 | https://developers.google.com/search/blog/2014/10/best-practices-for-xml-sitemaps-rssatom | 各URLに lastmod を付ける。意味のある変更時刻にする | 公式 | 抜粋 |
| 34 | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | 正規化の強さ：リダイレクト＞rel=canonical＞サイトマップ掲載 | 公式 | 抜粋 |
| 35 | https://developers.google.com/search/docs/crawling-indexing/canonicalization | URLの正規化とは | 公式 | 抜粋 |
| 36 | https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting | 正規化の問題の直し方 | 公式 | 抜粋 |
| 37 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps | サイトマップインデックス（大規模向け。今回は不要） | 公式 | 抜粋 |
| 38 | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag | robots meta / X-Robots-Tag の仕様。max-snippet 等 | 公式 | 抜粋 |
| 39 | https://developers.google.com/search/docs/crawling-indexing/robots/intro | robots.txt はクロール制御用で、インデックス除外の仕組みではない | 公式 | 抜粋 |
| 40 | https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec | Googleによる robots.txt 仕様の解釈 | 公式 | 抜粋 |
| 41 | https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt | robots.txt はサイト最上位、UTF-8のプレーンテキスト | 公式 | 抜粋 |
| 42 | https://developers.google.com/search/blog/2025/03/robots-refresher-page-level | ページ単位の制御（robots meta）の再確認 | 公式 | 抜粋 |
| 43 | https://developers.google.com/search/docs/appearance/site-names | サイト名はホームの WebSite 構造化データが最重要。og:site_name や title も参照 | 公式 | 抜粋 |
| 44 | https://developers.google.com/search/docs/appearance/favicon-in-search | ファビコンは正方形・48px以上推奨。対応形式は BMP/GIF/ICO/PNG/JPEG 等（SVGは一覧にない）。URLは安定させる | 公式 | 抜粋 |
| 45 | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl | 個別URLはURL検査ツールで再クロール依頼。多数はサイトマップ送信 | 公式 | 抜粋 |
| 46 | https://support.google.com/webmasters/answer/9012289?hl=en | URL検査ツール。インデックス登録のリクエスト（オーナー権限が必要） | 公式 | 抜粋 |
| 47 | https://support.google.com/webmasters/answer/7440203?hl=en | ページのインデックス登録レポート | 公式 | 抜粋 |
| 48 | https://developers.google.com/search/help/crawling-index-faq | 新しいサイトのクロール・インデックスには数日〜1週間程度かかることがある | 公式 | 抜粋 |
| 49 | https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing | モバイル版で評価。PCと同じ内容・同じ構造化データ。主要コンテンツをユーザー操作で遅延読み込みしない | 公式 | 抜粋 |
| 50 | https://developers.google.com/search/blog/2023/10/mobile-first-is-here | モバイルファーストインデックスの移行完了 | 公式 | 抜粋 |
| 51 | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics | JSは描画されるが、サーバー側描画・事前描画は速く、全ボットが読める | 公式 | 抜粋 |
| 52 | https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t | E-A-T に Experience が加わり E-E-A-T に。Trust が中心 | 公式 | 抜粋 |
| 53 | https://services.google.com/fh/files/misc/hsw-sqrg.pdf | 品質評価ガイドラインの概要（評価者用。順位を直接決めるものではない） | 公式 | 抜粋 |

## B. web.dev / Chrome（公式）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 54 | https://web.dev/articles/vitals | Core Web Vitals は LCP・INP・CLS | 公式 | 抜粋 |
| 55 | https://web.dev/articles/lcp | LCP は2.5秒以内 | 公式 | 抜粋 |
| 56 | https://web.dev/articles/cls | CLS は0.1以下 | 公式 | 抜粋 |
| 57 | https://web.dev/articles/defining-core-web-vitals-thresholds | 閾値は訪問の75パーセンタイルで判定 | 公式 | 抜粋 |
| 58 | https://web.dev/articles/top-cwv | Core Web Vitals を改善する効果の大きい方法 | 公式 | 抜粋 |
| 59 | https://web.dev/articles/preload-critical-assets | 重要な資源の preload | 公式 | 抜粋 |
| 60 | https://developer.chrome.com/docs/lighthouse/performance/font-display | Webフォント読み込み中も文字を表示（font-display） | 公式 | 抜粋 |

## C. Bing / IndexNow（公式）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 61 | https://www.bing.com/webmasters/help/Webmaster-Guidelines-30fba23a | Bing ウェブマスターガイドライン | 公式 | 抜粋 |
| 62 | https://blogs.bing.com/search/May-2026/Evolving-role-of-the-index-From-ranking-pages-to-supporting-answers | 索引の役割が「ページの順位付け」から「答えを支える情報の選択」へ | 公式 | 抜粋 |
| 63 | https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview | Bing Webmaster Tools に AI Performance（AI回答での表示状況） | 公式 | 抜粋 |
| 64 | https://blogs.bing.com/webmaster/ | 2025年10月「AI検索の回答に採用されるための最適化」：明確な構造、事実の文、適切なマークアップ。重要情報をタブ・スクリプト・altなし画像に隠さない | 公式 | 抜粋 |
| 65 | https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools | Search Console から Bing へサイトを取り込むと自動で所有確認 | 公式 | 抜粋 |
| 66 | https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b | サイトの追加と確認 | 公式 | 抜粋 |
| 67 | https://www.bing.com/webmasters/help/Sitemaps-3b5cf6ed | Bing のサイトマップ | 公式 | 抜粋 |
| 68 | https://www.bing.com/webmasters/help/getting-started-checklist-66a806de | Bing の開始チェックリスト | 公式 | 抜粋 |
| 69 | https://www.bing.com/indexnow/getstarted | IndexNow の導入方法 | 公式 | 抜粋 |
| 70 | https://www.indexnow.org/documentation | IndexNow 仕様。キーは8〜128文字、サイト直下の key.txt で所有確認 | 公式 | 抜粋 |
| 71 | https://blogs.bing.com/webmaster/september-2021/Access-to-Instant-Indexing-%C2%A0Bing%C2%A0URL-submission-API | Bing URL 送信 API | 公式 | 抜粋 |

## D. AI クローラーと LLM 向け仕様（公式・仕様策定者）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 72 | https://developers.openai.com/api/docs/bots | OpenAI：GPTBot（学習）、OAI-SearchBot（ChatGPT検索）、ChatGPT-User（ユーザー操作）を robots.txt で個別に制御。反映に約24時間 | 公式 | 抜粋 |
| 73 | https://docs.perplexity.ai/guides/bots | Perplexity：PerplexityBot（検索の索引）、Perplexity-User（ユーザー操作） | 公式 | 抜粋 |
| 74 | https://www.searchenginejournal.com/anthropics-claude-bots-make-robots-txt-decisions-more-granular/568253/ | Anthropic：ClaudeBot（学習）、Claude-SearchBot（検索の索引）、Claude-User（ユーザー操作）。3つとも robots.txt に従う | 解説（公式文書の報道） | 抜粋 |
| 75 | https://www.answer.ai/posts/2024-09-03-llmstxt.html | llms.txt の提案（Jeremy Howard, 2024-09-03）。H1のみ必須のMarkdown。サイトの要約と主要ページへのリンク | 公式（提案者） | 抜粋 |
| 76 | https://arxiv.org/abs/2311.09735 | GEO論文。出典付きの引用、統計の追加が生成AIでの可視性を最も押し上げた | 研究 | 抜粋 |
| 77 | https://arxiv.org/pdf/2311.09735v2 | 同上（PDF） | 研究 | 抜粋 |
| 78 | https://collaborate.princeton.edu/en/publications/geo-generative-engine-optimization/ | 同論文のプリンストン大学の書誌 | 研究 | 抜粋 |
| 79 | https://arxiv.org/pdf/2601.13938 | IF-GEO：複数クエリにまたがるGEOの研究 | 研究 | 抜粋 |
| 80 | https://arxiv.org/pdf/2609.02964 | 悪意あるGEOへの防御（操作的な手法は検出・無効化の対象になる） | 研究 | 抜粋 |
| 81 | https://arxiv.org/pdf/2405.14034 | 生成AI検索エンジンの権威性とバイアスの監査 | 研究 | 抜粋 |

## E. schema.org / OGP（仕様）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 82 | https://schema.org/Organization | Organization。sameAs、founder、address など | 公式 | 抜粋 |
| 83 | https://schema.org/Service | Service。provider、areaServed、serviceType | 公式 | 抜粋 |
| 84 | https://schema.org/SoftwareApplication | SoftwareApplication。applicationCategory、operatingSystem | 公式 | 抜粋 |
| 85 | https://schema.org/applicationCategory | ソフトウェアの種別 | 公式 | 抜粋 |
| 86 | https://schema.org/areaServed | 提供地域 | 公式 | 抜粋 |
| 87 | https://schema.org/provider | 提供者 | 公式 | 抜粋 |
| 88 | https://schema.org/Corporation | 株式会社は Corporation（Organization のサブタイプ） | 公式 | 抜粋 |
| 89 | https://env.dev/guides/opengraph | OGP の og:image は 1200×630、HTTPS の絶対URL、5MB未満 | 解説 | 抜粋 |
| 90 | https://coywolf.com/guides/open-graph-twitter-card-image-optimization/ | X は OGP にフォールバック。twitter:card=summary_large_image だけ指定すればよい | 解説 | 抜粋 |
| 91 | https://og-image.org/docs/platforms/twitter | X のカード画像は1.91:1、最小600×314 | 解説 | 抜粋 |

## F. 大規模データ調査

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 92 | https://ahrefs.com/blog/ai-overviews-reduce-clicks/ | AI Overviews があると1位のクリック率が34.5%低下（2025年4月）、12月時点で58%低下 | データ | 抜粋 |
| 93 | https://ppc.land/googles-ai-summaries-now-swallow-58-of-clicks-that-once-went-to-websites/ | 上記 Ahrefs 更新版（30万キーワード）の報道 | データ | 抜粋 |
| 94 | https://www.semrush.com/blog/ai-overviews-study/ | 20万件のAI Overviews分析。質問形（how/what）のクエリで出やすく、長い語句・月100回以下の検索が約6割 | データ | 抜粋 |
| 95 | https://www.semrush.com/blog/ai-overviews-commercial-search-study/ | AI Overviews が商用・取引型クエリにも拡大（2025年） | データ | 抜粋 |
| 96 | https://searchengineland.com/google-ai-overviews-surge-pullback-data-466314 | AI Overviews の表示率は2025年7月に約25%でピーク、11月に16%未満 | データ | 抜粋 |
| 97 | https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-september-2025-update | AI Overviews のあるクエリで自然検索CTRが61%低下。一方、引用されたブランドは自然クリック35%増 | データ | 抜粋 |
| 98 | https://www.seerinteractive.com/insights/87-percent-of-searchgpt-citations-match-bings-top-results | ChatGPT検索の引用の87%が Bing の上位10件と一致（Googleは56%） | データ | 抜粋 |
| 99 | https://aiplusautomation.com/blog/bing-replication-chatgpt-citations | 上記の再現調査では一致率27%。Bingとの関係は時期で揺れる | データ | 抜粋 |
| 100 | https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/ | AI要約が出ると結果リンクのクリックは15%→8%。要約内リンクのクリックは1% | データ | 抜粋 |
| 101 | https://www.5wpr.com/research/state-of-ai-citations-2026/ | AI引用の現状レポート2026 | データ | 抜粋 |
| 102 | https://backlinko.com/google-ctr-stats | 400万件の検索結果分析。40〜60文字のタイトルでCTRが高い傾向 | データ | 抜粋 |
| 103 | https://zyppy.com/title-tags/meta-title-tag-length/ | タイトルの長さと書き換え率のデータ | データ | 抜粋 |
| 104 | https://x.com/mattdiggityseo/status/1940303316157936113 | Ahrefs 7.5万ブランド調査：AI可視性とWeb上の言及の相関0.664、被リンクは0.218 | データ | 抜粋 |
| 105 | https://thenextweb.com/news/ahrefs-youtube-mentions-ai-visibility-brand-search | 同調査：YouTubeでの言及がAI可視性と最も強く相関 | データ | 抜粋 |
| 106 | https://www.citeflow.io/blog/brand-mentions-vs-backlinks | ブランド言及と被リンクのAI引用への影響比較（Ahrefs 2025） | データ | 抜粋 |
| 107 | https://websearchapi.ai/blog/what-is-query-fan-out-and-insights | 6万クエリの fan-out 分析。1つの質問が複数の下位クエリに分かれる | データ | 抜粋 |
| 108 | https://www.ekamoira.com/blog/query-fan-out-original-research-on-how-ai-search-multiplies-every-query-and-why-most-brands-are-invisible | 1つの質問が約12の下位クエリに増える、という独自調査 | データ | 抜粋 |
| 109 | https://en.wikipedia.org/wiki/AI_Overviews | AI Overviews の経緯（二次資料） | 解説 | 抜粋 |
| 110 | https://en.wikipedia.org/wiki/IndexNow | IndexNow の経緯（二次資料） | 解説 | 抜粋 |

## G. 専門メディア・実務家の解説（採用の根拠にはせず、公式・データの補強に使う）

| # | URL | 要点 | 強さ | 確認 |
|---|---|---|---|---|
| 111 | https://www.searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-still-seo/575026/ | GoogleのAI検索ガイドは「AEOもGEOもSEOの延長」と明言 | 解説 | 抜粋 |
| 112 | https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/ | FAQリッチリザルトは2026年5月7日に完全終了 | 解説 | 抜粋 |
| 113 | https://www.searchenginejournal.com/google-h1-headings-seo/328459/ | h1は有用だが決定的ではない。階層構造はアクセシビリティにも重要 | 解説 | 抜粋 |
| 114 | https://www.seroundtable.com/301-404-pages-to-your-home-page-26923.html | 消えたページをトップへ301すると soft 404 扱い。役立つ404ページを用意する | 解説 | 抜粋 |
| 115 | https://searchengineland.com/decoding-llms-generative-ai-search-results-448630 | 生成AIに出るには「取得される→順位付け→統合に選ばれる」。抜き出しやすく引用しやすい文が有利 | 解説 | 抜粋 |
| 116 | https://searchengineland.com/a-90-day-seo-playbook-for-ai-driven-search-visibility-466751 | AI検索時代の90日プレイブック | 解説 | 抜粋 |
| 117 | https://wordlift.io/blog/en/query-fan-out-ai-search/ | fan-out では段落単位で引用が選ばれる。各節が単独で意味を持つ構成が有利 | 解説 | 抜粋 |
| 118 | https://digiday.com/media/wtf-is-query-fan-out-in-googles-ai-mode/ | AI Mode の query fan-out の解説 | 解説 | 抜粋 |
| 119 | https://www.jonoalderson.com/performance/youre-loading-fonts-wrong/ | フォントの読み込みと表示速度 | 解説 | 抜粋 |
| 120 | https://github.com/amplifying-ai/awesome-generative-engine-optimization | GEO資料の網羅リスト（追加調査の索引として利用） | 解説 | 抜粋 |

補足として、以下も検索結果で参照した（要点は上の公式・データと重複するため行を分けない）：
llmpulse.ai（llms.txt・ClaudeBot）、geodocs.dev、almcorp.com（Claudeの3ボット・Semrush分析）、xseek.io（各社UA）、
anagram.ai、crawlercheck.com、ipscanner.io、51degrees.com、stackmatix.com、inblog.ai、rizenmetrics.com、marwickmarketing.co.uk、
nogood.io、higoodie.com、thruuu.com、niara.ai、americaneagle.com、shopify.com、aomark.io、quattr.com、medium.com（GEO解説）、
iodigital.com、searchatlas.com、boostability.com、ethanlazuk.com、surferseo.com、trakkr.ai、pushleads.com、crawlix.app、
jetfuel.agency、gracker.ai、indexnowtool.com、stanventures.com（Semrush・Pew・h1）、theregister.com、emarketer.com、
campaignlive.com、slatehq.com、entropyand.co、ideava.com、heybuffy.com、aeovision.ai、amicited.com、dataslayer.ai、
taylorscherseo.com、nobori.ai、quickseo.ai、wordsatscale.com、omnibound.ai、thestacc.com、rivalhound.com、ziptie.dev、
cmoeugene.com、meltwater.com、busylike.com、llmrefs.com、seranking.com、navboost.com。

---

## 実装に採用した根拠 上位20

| 順 | 採用した施策 | 根拠（#） |
|---|---|---|
| 1 | AI専用の小技ではなく、SEOの基本を固める（インデックス可能・スニペット可能・人に役立つ） | 6, 7, 111 |
| 2 | ページごとに固有で説明的な title | 19, 1, 102 |
| 3 | 内容を正確に要約した meta description（CTR向上。順位には影響しない） | 18, 20 |
| 4 | 内部リンクは `<a href>`、説明的なアンカー、全ページが最低1本のリンクを受ける | 24, 25 |
| 5 | パンくずは典型的な経路で2階層以上。表示と BreadcrumbList を一致 | 10 |
| 6 | 構造化データは見えている内容と一致。Organization はトップ、Article は著者・日付・画像 | 9, 12, 14 |
| 7 | サイト名はトップの WebSite 構造化データで指定 | 43 |
| 8 | canonical を全ページに。サイトマップは canonical のみ、lastmod は意味のある更新日 | 32, 33, 34 |
| 9 | AI検索のクローラー（OAI-SearchBot、Claude-SearchBot、PerplexityBot ほか）を robots.txt で明示許可 | 72, 73, 74 |
| 10 | 事実には出典、統計と引用を入れる（生成AIでの可視性を押し上げる） | 76, 115 |
| 11 | 各節が単独で意味を持つ構成。冒頭で質問に答える | 107, 117, 115 |
| 12 | 重要な情報を画像やタブの中だけに置かない。本文テキストで書く | 64, 30 |
| 13 | FAQ は見える形で置く。リッチリザルト目的ではなく、読み手とAIの理解のため | 16, 112, 64 |
| 14 | IndexNow とサイトマップ送信（Bing、ひいては ChatGPT 検索への反映を早める） | 69, 70, 98 |
| 15 | LCP 2.5秒以内・CLS 0.1以下を目標に計測 | 55, 56, 64 |
| 16 | ファビコンは PNG も用意（Google の対応形式に SVG がない）。48px以上 | 44 |
| 17 | OGP画像を1200×630でページごとに。X は summary_large_image | 89, 90 |
| 18 | 役立つ404ページ（トップへの301ではなく） | 114 |
| 19 | モバイルとPCで同じ内容・同じ構造化データ。主要内容を操作待ちで遅延させない | 49 |
| 20 | 外部での言及（公式サイトからのリンク、SNS、YouTube 等）を増やす運用 | 104, 105 |

## 採用しなかったもの

| 施策 | 理由 |
|---|---|
| meta keywords | Googleは使わないと明言（#31） |
| キーワード密度の調整・詰め込み | スパムポリシー違反（#30） |
| FAQリッチリザルト狙い | 表示機能は2026年5月に終了（#112）。FAQは内容として残す |
| トップへの一括301 | soft 404 扱い（#114） |
| AI専用の特別なマークアップ | Googleは不要と明言（#6） |
| llms.txt を順位の施策とみなすこと | 提案段階の仕様で効果の実証はない（#75）。低コストなので「AIが読みやすい索引」として置くだけにする |
