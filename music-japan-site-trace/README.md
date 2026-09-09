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

- このディレクトリは保存専用です
- デプロイ設定、ホスティング設定、公開処理は含めていません
- 既存リポジトリの他ディレクトリには変更を加えていません
