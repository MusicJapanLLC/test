# Baton Partners（非公開デモ）

合同会社Music Japanが運営する法人向けパートナープログラム「Baton Partners」の、**掲載企業ごとの専用サイト**。
1社目は株式会社エボルグ（Empro）。

- 既存の `baton/`（Baton本体）とは別プロジェクト。`baton/` には一切手を入れていない
- デモの間は **noindex**（meta・robots.txt・X-Robots-Tag の3重）。本番サイトからもリンクしない

## 1社＝5ページのテンプレート

| # | ページ | URL（エボルグの場合） | 中身 |
|---|---|---|---|
| 1 | トップ（ヒーロー） | `/evorg/` | WebGLのステージ（集める→つなぐ→決める）、課題、数字、取り組み・サービス・記事への導線 |
| 2 | 取り組み | `/evorg/about/` | どんな会社で、何をしているか（Batonでいうプロフィール）、会社概要 |
| 3 | LP（SEO記事） | `/evorg/insights/spreadsheet-to-crm/` | 見込み客の悩みから入る記事。目次・構造化データ付き。最後にサービスと相談へ |
| 4 | サービス | `/evorg/service/` | 商品説明（エボルグならEmpro）。Before/After、流れ、機能、FAQ |
| 5 | お問い合わせ | `/evorg/contact/` | 独立ページ。公式LINE追加 → アンケート → Music Japanが確認 → 双方了承でLINEグループ |

価格・契約条件はこのサイトには出さない。

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

## 確認待ち（エボルグ）

公式サイト（evorg.co.jp / getempro.jp）はこの作業環境から直接読めなかったため、既存Batonの掲載内容と公開情報をもとに書いている。公開前に次を確認すること。

- [ ] 正式ロゴの支給（いまは仮のワードマーク `public/partners/evorg/logo.svg`）
- [ ] 英語表記「Evorg Inc.」で正しいか
- [ ] 取り組みページの代表の経歴（法人営業 → 中途人材紹介の拠点責任者）の表現
- [ ] 数値（AIマッチング精度+35%、入力時間-80%）の出典表記
- [ ] 代表者名・設立年月を会社概要に載せるか
- [ ] ブランドカラー（いまは `#147F6E`）
- [ ] 記事の内容（エボルグ側の監修を入れるか）
