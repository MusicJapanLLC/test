# てうちラーメン いよ丸水産 — 公式サイト

北海道富良野市の手打ちラーメン店「てうちラーメン いよ丸水産」公式サイト。
日本語・英語・簡体中国語・韓国語の4言語対応、フレームワーク非依存の静的サイトです。

## ディレクトリ構成

```
iyomaru-ramen/
├── build.mjs          # 静的サイトビルドスクリプト（依存パッケージ0、Node標準ライブラリのみ）
├── config/site.json    # 店舗情報・電話番号・地図クエリ・サイトURL・basePath等の共通設定
├── locales/            # 4言語分のテキストコンテンツ（ja/en/zh/ko.json）
├── src/
│   ├── template.mjs    # HTMLページを組み立てるビルダー
│   ├── icons.mjs       # インラインSVGアイコン一式
│   ├── styles.css      # デザイン一式（和モダン・レスポンシブ）
│   └── main.js         # ヘッダー制御・言語切替・スクロールフェードイン・ギャラリーの拡大表示
├── public/              # そのままdist/直下へコピーされる静的ファイル（favicon等）
└── dist/                # ビルド成果物（gitignore対象、`npm run build`で生成）
```

ビルドすると `dist/` に以下が生成されます。

```
dist/
├── index.html      # 日本語（デフォルト）
├── en/index.html   # 英語
├── zh/index.html   # 簡体中国語
├── ko/index.html   # 韓国語
├── assets/css, assets/js, assets/img
├── robots.txt
└── sitemap.xml
```

## セットアップ・ローカルプレビュー

Node.js 18以降のみ必要（npm installなし、依存パッケージ0）。

```bash
cd iyomaru-ramen
npm run build   # dist/ を生成
npm run dev     # ビルド後 http://localhost:5173 でプレビュー
```

## デプロイ方法（ホスティング非依存）

`dist/` フォルダの中身がそのまま成果物です。どのホスティングでも、
`dist/` の中身をそのままアップロードするだけで公開できます。

- **GitHub Pages**: 本リポジトリに `.github/workflows/deploy-iyomaru-ramen.yml` を同梱済み。
  デフォルトブランチ（`claude/employee-onboarding-setup-udm86`）へのpushで自動ビルド・自動デプロイされます（初回のみ下記の手動設定が必要）。
- **Netlify / Vercel**: Build command `node build.mjs` / Publish directory `dist`（Base directory `iyomaru-ramen`）を指定するだけ。
- **レンタルサーバー等**: `npm run build` 実行後、`dist/` の中身をFTP等でアップロード。

### GitHub Pagesを有効化する（初回のみ・手動）

GitHub Pagesの有効化はリポジトリ管理者の操作が必要で、Claude Codeからは
実行できません。以下を一度だけ行ってください（1分程度）。

1. GitHubで対象リポジトリの **Settings → Pages** を開く
2. "Build and deployment" の **Source** を **GitHub Actions** に変更
3. デフォルトブランチにこの変更がマージされると、自動でビルド・公開されます
4. 公開URLは `https://musicjapanllc.github.io/test/` になります
   （これは本番用の正式ドメインではなく、動作確認用のURLです。実際の
   独自ドメインが決まったら `config/site.json` の `siteUrl` と `basePath`
   を更新してください — `basePath` は独自ドメイン直下なら `/` のままでOK）

## 本番公開前にご確認いただきたい項目

実データが未確定の箇所は、サイトを止めずに仮データ／コメントで実装を進めています。
本番公開前に、以下を店舗様にご確認のうえ差し替えてください。

| # | 項目 | 現在の扱い | 確認先ファイル |
|---|---|---|---|
| 1 | **正式メニュー価格** | `¥○,○○○` のプレースホルダー表示 | `locales/*.json` の `menu.items[].price` |
| 2 | **Google評価・クチコミ件数** | いただいたスクリーンショット記載の「4.4 / 328件」を掲載。変動する情報のため、掲載日時点の参考値として明記 | `locales/*.json` の `hero.ratingBadge` |
| 3 | **写真素材** | プロ撮影写真が未着手のため、色調のみのプレースホルダー（グラデーション＋線画アイコン）で構成。差し替え推奨サイズは各CSSコメント参照（ヒーロー: 2400×1500 / メニュー: 1200×900・4:3 / ギャラリー: 1200px以上・正方形〜4:5） | `src/styles.css` 内のコメント（`.hero-media`, `.menu-photo`, `.gallery-photo` 付近） |
| 4 | **OGP画像（SNSシェア時のサムネイル）** | 画像ファイル未同梱。`dist/assets/img/og-image.jpg`（推奨1200×630px）を追加すると自動的に反映されます | `src/template.mjs` の `ogImageUrl` |
| 5 | **正式な本番ドメイン** | `config/site.json` の `siteUrl` はプレースホルダー（`https://iyomaru-ramen.example.com`）。独自ドメイン確定後に更新してください | `config/site.json` |
| 6 | **緯度・経度（構造化データ用）** | JR富良野駅周辺のおおよその値（`43.3417, 142.3823`）を暫定使用。地図表示自体は住所検索ベースの埋め込みなので実用上問題ありませんが、正確な値に更新可能です | `config/site.json` の `latitude` / `longitude` |
| 7 | **お知らせ欄** | 移転オープンとサイトリニューアルの2件のみ仮掲載 | `locales/*.json` の `news.items` |

営業時間・電話番号・住所・アクセス・駐車場・決済手段・座席数は、
いただいたGoogleビジネスプロフィールの情報をそのまま正として掲載しています。
