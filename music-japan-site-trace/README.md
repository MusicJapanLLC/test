# Music Japan official site (music-japan.com)

> 作業前に、リポジトリ直下の [`README_WEBSITES.md`](../README_WEBSITES.md)（3サイト共通の説明書と作業ログ）を必ず読むこと。

**現在の本番: NEEDLE DROP（2026-10-01〜）** — `next/` の Vite + TypeScript + Three.js + GSAP サイト。詳細・戻し方: `DESIGN-NEEDLE-DROP-20261001.md`

- `npm run build:deploy` → 新サイトを `deploy-dist/` に生成（Cloudflare Pages のビルド）
- Cloudflare Pages のビルド変数 `MJ_SITE=legacy` で再デプロイすると、コード変更なしで以前のサイトに戻ります（`npm run build:legacy` と同じ）
- 以下は以前のサイト（保存スナップショット + 演出レイヤー）の説明です。`dist/` `src/` `scripts/build-legacy.mjs` はそのまま残しています

---

# Music Japan site trace

2026-09-09時点の公開サイトを、改善やリデザインを加えず保存した静的クローンです

Original: https://music-japan.pearly-cedar-3983.chatgpt.site/

## 保存範囲

- 日本語トップ `/`
- 英語トップ `/en`
- 会社概要 `/company`、`/en/company`
- プライバシーポリシー `/privacy`、`/en/privacy`
- 公開CSS・JavaScript・WebGLバンドル・GSAPバンドル
- ロゴ、シンボル、代表画像、OGP、favicon
- 11本の公開試聴音源
- 全作品ジャケットの 480 / 800 / 1200px バックアップ
- robots.txt、sitemap.xml、SEO meta、OGP、JSON-LD

`_capture/` は取得時の未加工HTMLレスポンス、`dist/` はローカル表示用の保存コピーです

作品ジャケットは表示上のURLも現行サイトと同じApple CDNを保持しつつ、`dist/media/` に同一画像をバックアップしています

Cloudflareがレスポンス末尾へ注入する検証用スクリプトだけはサイト本体ではないため、`dist/` から除外しています。未加工版は `_capture/` に保存されています

GitHub APIの単一ファイル上限に収めるため、2点の大容量PNGは `dist/archive-parts/` に可逆分割しています。ローカルサーバーは元ファイルと同一のバイト列に連結して配信し、`npm run check` でSHA-256を検証します

## ローカル起動

```bash
cd music-japan-site-trace
npm start
```

ブラウザで `http://127.0.0.1:4173` を開きます

## 完整性チェック

```bash
npm run check
```

## 重要

## 現在の生成フロー（2026-09-19）

このディレクトリは現在、Cloudflare Pages本番のビルド元です
上記は取得時点の説明です

1. `dist/` は元サイトを保存した入力スナップショット（通常のビルド生成物ではありません）
2. `npm run build:legacy` → `scripts/build-legacy.mjs` が `dist/` を `deploy-dist/` にコピー
3. `scripts/build-experience.mjs` が `src/` の演出ソースをesbuildでバンドルして `deploy-dist/assets/` に生成
4. 保存HTML・Reactバンドルに既存の文言・ナビ・SEO修正を適用し、内部ページを生成
5. Cloudflare Pagesは `deploy-dist/` を公開

新しい演出は `src/` を編集してください。`deploy-dist/` は毎回再生成され、Gitには含めません
旧手書き演出 `dist/assets/music-japan-experience.{js,css}` は `src/` に移管しました
保存済みGSAP/ScrollTrigger 3.15.0はそのまま再利用し、二重にバンドルしません

```bash
npm ci
npm run check
node --test tests/*.test.mjs
npm run build:deploy
npm run preview
```

Three.js背景は別チャンクとして遅延読込されます。背景の読込に失敗してもHTML本文・CSSの盤と波形は表示されます
`npm start` は取得時の入力スナップショット、`npm run preview` はビルド後の公開用サイトを表示します
詳細な変更・性能検証・ロールバック: `DESIGN-IMMERSIVE.md`

2026-09-30 仕上げ版（フォント・日本語改行・公式シンボル・お問い合わせ）: `DESIGN-REFINE-20260930.md`
Cloudflare Pagesのビルド変数 `MJ_REFINE=off` で再デプロイすると、コード変更なしで直前の見た目に戻せます
