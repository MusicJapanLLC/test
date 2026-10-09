# MJ STORE

合同会社Music Japan の公式ゲームストア。音楽も、物語も、システムも、ぜんぶ自社製のゲームだけが並ぶ。

| ページ | 内容 |
|---|---|
| `/` | ストア。特集カルーセル・全作品の棚・お知らせ・バージョン履歴・自社製の紹介・よくある質問 |
| `/games/` | 作品一覧。機種で絞り込み、グリッド／リスト表示 |
| `/games/<slug>/` | 作品のストアページ。でっかいキャッチ・実機フレームの実際の画面・特徴・お知らせ・バージョン履歴・作品情報・よくある質問 |
| `/request/` | ご要望・バグ報告（「こうしたらいいやん」も） |
| `/404.html` | 道に迷った人は、隠しモードの町を歩ける |

隠し要素：どのページでも `↑↑↓↓←→←→BA`（スマホはフッターのロゴを5回タップ）で「MJタウン」が開く。作品ごとにお店が建っていて、扉から作品ページへ入れる。

## 作品を足す

`src/data/games.ts` の配列に1件足すだけ。トップ・作品一覧・ストアページ・町・sitemap.xml・llms.txt・構造化データまで自動で増える。

1. 実際のゲーム画面を `public/shots/<id>/` に置く（WebP。縦長は幅720、PCは1440×900。1枚目はタイトル画面）
2. `games.ts` に作品を追加（`shots` / `playUrl` / `news` / `versions` / `faq` など）
3. OGP画像を作り直す：`node --experimental-strip-types scripts/og.mjs`（Playwright が必要）
4. `npm run build` で確認

お知らせ・バージョン履歴の更新も `games.ts` を書き換えるだけ。

## 開発

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:5173
npm run build      # 型チェック + 本番ビルド
npm run preview
```

## 公開（Vercel）

- Root Directory：`mj-store`
- 環境変数：`VITE_GAS_ENDPOINT`（ご要望の送信先）、必要なら `VITE_SITE_URL`
- 独自ドメイン：`store.music-japan.com` を想定（`src/data/site.ts` の `url`）。Cloudflare で CNAME を Vercel に向ける。別のドメインにするなら `site.ts` の `url` か `VITE_SITE_URL` を変える

## ご要望フォームの受け口

`gas/Code.gs` の先頭に設置手順がある。スプレッドシートに1件1行で貯まり、`music.japan.llc@gmail.com` に通知メールが届く。状態（未対応／確認中／対応済み／見送り）はシートのプルダウンで管理する。

## SEO / LLMO

- すべてのページに canonical・OGP（1200×630、実際の画面入り）・Twitter カード
- 構造化データ（JSON-LD）：Organization / WebSite、作品ページは VideoGame（スクリーンショット・価格0円・最新版・リリースノート）・BreadcrumbList・FAQPage、一覧は ItemList、ご要望は ContactPage
- 画面に見える「よくある質問」と構造化データの中身を一致させている
- `sitemap.xml`（更新日と画像つき）、`robots.txt`（主要な検索エンジンと AI クローラーを明示的に許可）
- `llms.txt`（AI 向けのサイト概要）と `llms-full.txt`（全作品の詳しい情報・FAQ・履歴）をビルド時に自動生成
- 画像はすべて幅・高さ・説明文つき。最初に見える画像は先読み

## スクリーンショットの出どころ

| 作品 | 画面 |
|---|---|
| ギルドの灯 | ソース（`claude/guild-idle-game-*` ブランチの `guild/`）を起動して実際にプレイして撮影 |
| 村長、世界まで行くんですか？ | 同ブランチの `guild/mayor/` を起動してプレイして撮影 |
| The World | タイトル・草原はソースを起動してプレイして撮影。村・家・夜の3枚は `MusicJapanLLC/the-world` の開発時の実プレイ画面 |
| 灯の旅路 | 本番サイトのタイトル画面（ゲーム内の画面は未撮影） |
