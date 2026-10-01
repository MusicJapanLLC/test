# SECOND TAKE

経営者が「二度目に何を選んだか」を聞くインタビューメディア。日本語（`/`）と英語（`/en/`）の二言語サイトです。

デザインは三層構成です。

- **入口（Cinema）** — 黒のレターボックス、タイムコード、字幕、ロゴの赤いスラッシュ
- **読む部分（Editorial）** — しっぽり明朝B1の本文、Scene構成、字幕フレームの引用
- **細部（Record）** — ロゴのレコード盤。初回のみのオープニング、SIDE B（ポッドキャスト枠）

## 構成

```
src/articles.mjs   記事データ（日本語・英語を1記事ずつ並べて管理）
src/copy.mjs       画面の文言・外部リンク（TimeRex / LinkedIn / 運営会社）
scripts/build.mjs  HTML・RSS・サイトマップ・検索インデックスを dist/ に生成
scripts/check.mjs  公開前チェック（リンク切れ・日英ペア・alt・h1・noindex）
scripts/fonts.mjs  フォントを @fontsource から dist/assets/fonts へ配置
dist/assets/       CSS・JS・画像・フォント（手で編集する静的ファイル）
```

HTMLは生成物です。文章や記事を変えるときは `src/` を編集してから `npm run build` を実行します。

## コマンド

```sh
npm install      # 初回のみ（BudouX・フォント）
npm run build    # dist/ のHTMLを生成
npm run check    # 検証
npm start        # http://127.0.0.1:4173 でプレビュー
```

## 記事を追加する

1. `dist/assets/` に写真を置く（`.webp` と OGP用の `.jpg`）
2. `src/articles.mjs` に1件追加する。`ja` と `en` の両方が必要
3. `npm run build && npm run check`

日本語の見出しは BudouX で文節ごとに区切り、単語の途中で改行しないようにしています。

## Cloudflare Pages

- Root directory: `music-japan-site/second-take`
- Build command: `npm run check`
- Build output directory: `dist`
- Custom domain: `secondtake.music-japan.com`

## 本公開前チェック

1. サンプル記事を実在人物の記事へ差し替える
2. `scripts/build.mjs` の `noindex,nofollow` を外し、`scripts/check.mjs` の noindex チェックを削除する
3. `dist/robots.txt` を `Allow: /` に変更し、`dist/_headers` の `X-Robots-Tag` を削除する
4. `npm run build` でサイトマップとRSSを再生成する
5. Google Search Consoleへサイトマップを送信する
