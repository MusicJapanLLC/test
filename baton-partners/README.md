# Baton Partners（非公開デモ）

合同会社Music Japanが運営する法人向けパートナープログラム「Baton Partners」の、**掲載企業ごとの専用サイト**。
1社目は株式会社エボルグ（Empro）。

- 既存の `baton/`（Baton本体）とは別プロジェクト。`baton/` には一切手を入れていない
- デモの間は **noindex**（meta・robots.txt・X-Robots-Tag の3重）。本番サイトからもリンクしない

## 運営会社のページ（BP-000）

`/music-japan/` は、合同会社Music Japan が運営する Baton Partners そのものの紹介（専用LP × SEO × AIO × 紹介）。
同じ5ページの骨組みに、独自の世界観（relay：トラックとバトン）と、予約ページ（TimeRex）で日程を選ぶ「話してみる」を載せている。
詳しい決まりは `CLAUDE.md` の「運営会社のページ」。

## 1社＝5ページのテンプレート

| # | ページ | URL（エボルグの場合） | 中身 |
|---|---|---|---|
| 1 | トップ（ヒーロー） | `/evorg/` | WebGLのステージ（集める→つなぐ→決める）、課題、数字、取り組み・サービス・記事への導線 |
| 2 | 取り組み | `/evorg/about/` | どんな会社で、何をしているか（Batonでいうプロフィール）、会社概要 |
| 3 | LP（SEO記事） | `/evorg/insights/spreadsheet-to-crm/` | 見込み客の悩みから入る記事。目次・構造化データ付き。最後にサービスと相談へ |
| 4 | サービス | `/evorg/service/` | 商品説明（エボルグならEmpro）。Before/After、流れ、機能、FAQ |
| 5 | お問い合わせ | `/evorg/contact/` | 独立ページ。公式LINE追加 → アンケート → Music Japanが確認 → 双方了承でLINEグループ |

価格・契約条件はこのサイトには出さない。

## ロゴ

Baton（シンプル）をベースに、Baton Partners（リッチ）を作っている。

- 実装：`src/render/logo.ts`（`bpMark` がマーク、`bpLogo` が文字組み込み）
- 単体ファイル：`public/brand/baton-partners-mark.svg` / `baton-partners-logo.svg` / `baton-partners-logo-white.svg`、ファビコン（`public/favicon.svg`）。どれもビルド時に `logo.ts` から自動生成
- サイト上では、ページ切り替えの幕とトップ一覧のロゴだけ、白い丸から赤い丸へ光が渡るアニメーション付き

## 企業を追加する手順

1. `src/partners/evorg.ts` をコピーして `src/partners/<slug>.ts` を作り、中身を書き換える
2. `src/partners/index.ts` の配列に追加する
3. `public/partners/<slug>/logo.svg`（または png）を置く
4. `.gitignore` に `/<slug>/` を1行足す（ビルド時に自動生成されるページのため）
5. `gas/Code.gs` 側のスクリプトプロパティ `PARTNERS` に、企業IDと通知先を1件足す

HTMLはビルド時に `src/render/` のテンプレートから自動生成される。HTMLを直接編集しない。

## 相談の流れと通知（中抜き対策）

```
Webから来た人 → 公式LINEを追加 → アンケート回答（受付番号を発行）
   ├─ 社長へ：回答の全文（会社名・氏名・連絡先・回答）
   ├─ 掲載企業へ：「新しい相談が1件」＋受付番号＋今月の件数だけ（個人情報・回答は送らない）
   └─ スプレッドシートへ記録（ステータス・商談化を社長が更新）
月初 → 前月の件数（相談・紹介済み・商談化）を各企業と社長へ自動送信
```

- 自動マッチング・予約カレンダー（TimeRex）は置かない
- 紹介するかどうかとタイミングは、社長が一件ずつ判断する
- 掲載企業は「BP-EVORG-260928-XXXX の件、つないでください」と受付番号で依頼できる

設置手順は `gas/Code.gs` の先頭に書いてある。`VITE_GAS_ENDPOINT` が空の間は**デモモード**で、送信ボタンは動くが実際には送らない（完了画面にその旨を表示）。

## 開発

```bash
npm install
npm run dev       # http://localhost:5173/evorg/
npm run build     # 型チェック + ページ生成 + 本番ビルド
npm run preview   # http://localhost:4174/evorg/
```

## 品質面でやっていること

- **日本語の改行**：BudouXで文節に区切り、見出しは文節単位で折り返す（「理｜由」のような泣き別れを防ぐ）。
  BudouXが割ってしまう語は、データ側で `{取りこぼさずに}` と波かっこで囲むと1文節として扱う
- **スマホ**：見出しは `clamp()` でサイズの上限と下限を決めている。375 / 390 / 430px と 1440 / 1920px で、全ページの横はみ出しゼロを確認済み
- **WebGL**：three.js はアイドル時に遅延読み込み（初期表示のJSは約9KB gzip）。画面外では描画を止める。
  「動きを減らす」設定では静止画、WebGL非対応ならCSSの代替表示
- **フォント**：自前配信（Google Fontsに依存しない）で、非同期読み込み。描画をブロックするCSSは約9KB gzip
- **SEO**：ページごとの title / description / canonical / OGP、構造化データ（Organization・WebPage・AboutPage・Service・FAQPage・Article・BreadcrumbList）、sitemap.xml。
  公開するときは `BP_INDEX=1` でビルドし、`vercel.json` の `X-Robots-Tag` を外す

## 文言の出どころ（エボルグ）

本家（evorg.co.jp / getempro.jp）の表現を最優先にしている。作業環境から公式サイトを直接開けないため、
検索エンジン経由で確認できた公式の記載をもとにした。

| 使っている内容 | 出どころ |
|---|---|
| 「データとAIで人材紹介会社の採用決定数を最大化するワンストップCRM/MA」 | Empro公式 |
| 求職者管理・企業開拓・選考進捗・コミュニケーションの集約 | Empro公式 |
| LINE公式アカウント連携のシナリオ配信、休眠求職者の掘り起こし（既定60日） | Empro公式 |
| 履歴書・求人票PDFからのAIデータ自動入力、AIマッチング | Empro公式 |
| AIマッチング精度+35%・入力時間-80%（社内調査、一部β版） | Empro公式 |
| 1IDから・最短即日導入・データ移行・専任スタッフのサポート | Empro公式 |
| 社名の由来（Evolve + Organization）、組織最適化・戦略的採用の支援 | エボルグ公式 |
| 代表の経歴 | 公開プロフィール＋社長の調査メモ |
| 「休眠求職者＝費用をかけた資産」「属人化・引き継ぎ損失」「向いている会社」 | 社長の調査メモ（本家と矛盾しない範囲で採用） |

載せていないもの：導入事例の発言（未確認）、他社との価格比較、Pマーク等のセキュリティ表記。

## 確認待ち（エボルグ）

- [ ] 代表の経歴の書き方（本人確認）
- [ ] 数値（+35% / −80%）の出典表記の書き方
- [ ] 事業内容の書き方（Emproと組織・採用支援の両方を載せてよいか）
- [ ] 記事の内容（エボルグ側の監修を入れるか）
