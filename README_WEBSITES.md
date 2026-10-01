# Web制作の説明書と作業ログ（Claude Code は作業前に必ず読む）

合同会社Music Japanの3つのサイト（公式サイト / Baton / Baton Partners）を、
どう作ったか・なぜそうしたか・社長が何を好み、何に駄目出ししたかをまとめたもの。
新しいセッションでサイトを触るときは、**コードを読む前にこのファイルを最後まで読む**こと。
作業が終わったら、下の「作業ログ」に1行足す。

---

## 0. まず守ること（全サイト共通）

1. **社長（Owner）の言葉が最優先。** 迷ったら、提案は1つに絞って実装まで進め、あとで報告する。懸念だけ述べて止まらない。
2. **返事は日本語・やさしい言葉で。** 専門用語は言い換える。終わったら「何が変わったか / 確認URL / 次にやること」を必ず渡す。
3. **作業は `claude/` ブランチ → PR → 社長がマージ。** 本番ブランチへ直接 push しない。
   PRには `Cloudflare Pages: second-take` の失敗が毎回付く（別プロジェクトの既存の失敗。自動マージが止まるので**手動マージ**になる）。
4. **戻せるようにする。** 大きく作り替えるときは、旧版を残すか切り替えスイッチを用意する。
5. **見た目はスマホで確認する。** 390px幅と1440px幅でスクリーンショットを撮り、自分の目で見てから渡す（ヘッドレスChromiumで可）。
6. **事実だけを書く。** サイトに無い数字・実績・発言は作らない。本家（会社・サービスの公式サイト）の表現を優先する。

---

## 1. サイト一覧

| サイト | 公開URL | コードの場所 | 本番ブランチ | 公開先 | 詳しい資料 |
|---|---|---|---|---|---|
| Music Japan 公式 | https://music-japan.com | `music-japan-site-trace/`（現行は `next/`） | `music-japan-production` | Cloudflare Pages `music-japan`（`npm run build:deploy` → `deploy-dist/`） | `music-japan-site-trace/DESIGN-NEEDLE-DROP-20261001.md` |
| Baton（人物プロフィール「Baton Talk」＋旧6サービス） | https://baton.music-japan.com | `baton/` | `claude/baton-backend-implementation-zu0h6k` | Cloudflare Pages `baton`（root `baton`、`npm run build`、出力 `dist`） | そのブランチの `baton/README.md`、**`baton/docs/ADDING_A_PROFILE.md`（必読）**、`baton/docs/SEO_AIO_LLMO.md` |
| Baton Partners（掲載企業ごとの専用サイト） | https://partners.music-japan.com/&lt;slug&gt;/ | `baton-partners/` | `claude/baton-partners-demo-ssqzut` | Vercel `baton-partners-demo` | そのブランチの **`baton-partners/CLAUDE.md`（必読）**、`baton-partners/README.md` |
| SECOND TAKE（経営者メディア） | https://secondtake.music-japan.com | — | — | Cloudflare Pages `second-take` | ビルドが失敗し続けている（原因未調査） |

> 注意：3サイトは**本番ブランチがそれぞれ違う**。Baton と Baton Partners のコードは、このファイルがあるブランチには入っていないことがある。
> 作業前に `git fetch origin <本番ブランチ>` して、そのブランチから `claude/` ブランチを切る。

---

## 2. 社長の好み（全サイト共通）

**好きなもの**
- 黒×赤の、音楽とレコードのエッジの効いた世界観。WebGL・動き多め・派手。ただし安っぽくしない
- Apple Music風のプレーヤーと試聴
- Baton Partners / Baton の作り込み（「これの100倍かっこよく」が合言葉だった）
- 遊び心。「神は細部に宿る」。キャラクター、ジャンルで変わる演出など
- 書体は少なく揃える（Music Japan は Archivo ＋ Zen Kaku Gothic New ＋ JetBrains Mono）。日本語の見出しは BudouX で文節ごとに折り返し、「単語の途中で改行」させない

**嫌いなもの（駄目出しされたもの）**
- 「AIが作った感」：仮置きのロゴ（赤い⊖のネズミっぽいマーク）、無難なフォント、定型文（「〜を実現」「〜に寄り添い」、ダッシュでつなぐ、3つずつ並べる）
- 無料ゲームの読み込み画面みたいな安い演出
- 黒い背景に白い箱が浮いているデザイン（ロゴは黒背景用の白抜き版を作る）
- 写真の加工しすぎ（代表写真の赤いデュオトーンは「ホラー」と却下 → 無加工に戻した）
- 「お金をもらって紹介している」と見える言い回し（「Music Japanが紹介する企業」→「Music Japanと歩みをともにする企業と、その事業。」）。「パートナー」の重複も避ける
- 白や赤を足しすぎたキャラ（「変なウルトラマン」）。シンプルが良い

---

## 3. Music Japan 公式サイト（music-japan.com）

### 作り方
- **Vite ＋ TypeScript ＋ Three.js ＋ GSAP ＋ Lenis。** ページごとに静的HTMLをビルド時に書き出す（SEO・AI検索に強い）
- 公式シンボル＝「真上から見たレコード」なので、**サイト全体をレコード（NEEDLE DROP）として設計**：導入で溝が描かれ針が落ちる → 3Dのレコードが全ページの背景で回り、セクションごとに姿勢が変わる → 試聴した音を Web Audio で解析し、盤・光・粒子が実際の音に反応する
- 中身（文言・作品・会社情報）は `next/src/content/` に集約。HTML は `next/src/render/` が生成する（HTMLを直接編集しない）

| やりたいこと | 触る場所 |
|---|---|
| 文言 | `next/src/content/site.ts`（日英） |
| 作品を足す | `next/src/content/releases.ts` に1件（`genre` も必ず入れる）＋ `dist/media/` にジャケット＋ `dist/audio/` に試聴mp3 |
| 会社情報・パートナー企業 | `next/src/content/company.ts` |
| よくある質問（画面・構造化データ・llms.txt に同時反映） | `next/src/content/faq.ts` |
| ロボット（下記） | `next/src/client/crew/` |
| sitemap / robots / llms.txt | `next/src/render/machine.ts`（ビルド時に自動生成） |
| SNS用の画像（1200×630） | `npm run og`（`scripts/og-images.mjs`）→ `layout.ts` の `OG_VERSION` を上げる |

- **ビルドが SEO チェックを兼ねる**（`scripts/seo-audit.mjs`）：タイトル・説明文の重複、canonical、日英の hreflang、h1 は1つ、画像の alt、リンク切れ、構造化データの参照漏れが1つでもあると失敗する
- **戻し方**：Cloudflare の環境変数 `MJ_SITE=legacy` で再デプロイ → 旧サイト（`scripts/build-legacy.mjs`）に戻る
- 公開後：`npm run indexnow`、Search Console と Bing にサイトマップ送信

### ロボット5体（公式キャラ）
- 黒いボディ・灰色のふち・胸に Ø・大きな頭・太く短い足・少し出た腕。32×48ドットを12fpsで描画（軽い。誰もいないと止まる）
- **TUNE（四角いモニター頭・赤）は社長のお気に入り。見た目を変えない。** 元ネタは社長が見せた「NULL」と表示されたロボットの絵
- 性格：TUNE＝自称リーダー（せーの！で全員そろう）/ SPIN＝ねぼすけ（琥珀）/ POD＝クール（水色・サングラス）/ REEL＝記録係（緑・REC●）/ MIC＝ムードメーカー（ピンク・よくしゃべる）
- 出る場面は2つだけ：**曲の再生中は5体全員が踊る**（ジャンルで踊りとセリフが変わる）／**スマホでメニューを開くと2〜3体がランダムで出る**。常時表示はしない
- 名前・口ぐせは未決定（社長が決めたら `crew.ts` の `PERSONA` に反映）

### 駄目出しと修正の記録（同じ失敗をしない）
| 指摘 | どうしたか |
|---|---|
| ヒーロー・文字・お問い合わせページがAIっぽい、ロゴが仮置き | 公式シンボルを正しく描き直し、文言と書体を作り直した |
| 演出が「無料ゲームの読み込み画面」、動きが少ない、書体がバラバラ | NEEDLE DROP で全面作り直し（PR #915） |
| パートナー欄が黒背景に白い箱 | 企業をレコードのジャケットとして見せる暗いデザインに。ロゴは白抜き版 |
| 代表写真がホラー | 加工をやめて元の写真に |
| 会社・ブランドの行から各サイトへ飛べない | 行全体をリンクに |
| 左下のドット絵キャラ（1体目）が骸骨っぽい・赤白でウルトラマン | 一旦非表示 → 社長の参考画像に寄せた黒いロボ5体で作り直し |
| 全員同じ顔・同じセリフ、間隔が近い | 色・表情・性格・セリフ・クセを1体ずつ分け、間隔を広げた |
| スクロール後にメニューを開くと上につぶれる | ヘッダーの `backdrop-filter` が原因（固定メニューの基準になる）。疑似要素へ移した |
| 英語の見出しの単語がくっつく | inline-block の中の末尾スペースは消える。スペースを要素の外へ |
| フッターの「プライバシーポリシー」が2行 | スマホのフッターを2列の格子に |
| ジャケット画像が逆（I know, but tried ↔ Like a drug） | バックアップ画像の名前が入れ替わっていた。`art` を入れ替え（Like a drug＝マイアミの絵） |
| 「ドメイン設定が先では？」 | music-japan.com は Cloudflare `music-japan` の本番。`music-japan-production` へのマージ＝公開。DNS変更は不要 |

---

## 4. Baton（baton.music-japan.com）

詳しくは本番ブランチの `baton/docs/ADDING_A_PROFILE.md`。要点だけ：
- 人物プロフィール（Baton Talk：`src/data/profiles.ts` ＋ `gas/Code.gs`）と、旧6サービス紹介（`src/data/services.ts` ＋ `gas/Code.services.gs`）は**完全に別物**。混ぜない
- プロフィールに資本金・従業員数・売上などの企業スペックは載せない（マッチングアプリのようにしない）
- 掲載者のメールアドレスはサイトのコードに入れない（GAS側の `BATON_PROFILES` だけが持つ）
- Google Apps Script はこの環境から操作できない。**貼り付け・デプロイ・実行は Claude in Chrome、確認は実機で**。作業前に本物のプロジェクト（名前「Baton」）とデプロイURLを特定する（別プロジェクトを数時間いじり続けた事故あり）
- 本番ブランチは複数人が触る。push 前に必ず fetch して最新を取り込む
- 環境変数を変えたら「Retry deployment」ではなく、新しいコミットで再デプロイ

## 5. Baton Partners（partners.music-japan.com）

詳しくは本番ブランチの `baton-partners/CLAUDE.md`。要点だけ：
- 1社＝5ページ固定（トップ / 取り組み / SEO記事 / サービス / 話してみる）。エボルグ版が社長承認済みの基準
- **世界観は会社ごとに作り分ける**（エボルグ＝紙と明朝の editorial＋点と線、Central AX＝モノクロの mono＋立方体）。使い回し感を出さない
- 文言は本家の表現を最優先。人間の書き手のように書く（定型句・ダッシュ・3つ並べを避け、場面を書く）
- 価格・契約条件は出さない。ボタンは「話してみる」。予約カレンダー・自動マッチングは置かない。紹介の判断は社長
- 掲載企業へは「相談が1件届いた」と受付番号だけ通知。お客様の個人情報は双方了承まで Music Japan だけが持つ

---

## 6. 作業ログ（新しい順。1作業1行で足していく）

| 日付 | サイト | やったこと | PR |
|---|---|---|---|
| 2026-10-01 | 全体 | この説明書を作成 | （このPR） |
| 2026-09-30 | MJ公式 | ロボに個性（色・性格・セリフ）、間隔調整、ジャケットの入れ替わり修正 | #918 |
| 2026-09-30 | MJ公式 | ロボ5体を実装（再生中に全員ダンス、メニューに2〜3体）、メニューつぶれ・英語スペース修正 | #918 |
| 2026-09-30 | MJ公式 | 作品ページ（一覧＋9作品×日英）、SEO自動チェック、セキュリティヘッダー、404、旧キャラ非表示 | #917 |
| 2026-09-30 | MJ公式 | NEEDLE DROP で全面作り直し、FAQ・構造化データ・OG画像・llms.txt・IndexNow | #915 |
| 2026-09-30 | MJ公式 | 旧サイトの見た目を整える層（`MJ_REFINE`）、AIっぽさの除去 | #907 |
| 〜2026-09-30 | Baton / Partners | 各ブランチの README・CLAUDE.md を参照（本ファイル作成時点の記録はそちら） | — |
