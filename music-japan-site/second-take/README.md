# SECOND TAKE media sample

スマートフォンで読み続けたくなる体験を優先した、記事蓄積型オウンドメディアのデザインサンプルです

## Preview

```sh
npm start
```

`http://127.0.0.1:4173` を開きます

## Validate

```sh
npm run check
```

## Deployment boundary

- 公開対象は `dist` ディレクトリです
- リンクとアセットはサブドメイン直下へ移せるルート相対パスです
- 現在のサンプルは `noindex` と `robots.txt` で検索登録を止めています
- canonical、OGP、記事情報、パンくず、サイトマップ、RSSは `https://secondtake.music-japan.com` で設定済みです
- メール登録は表示テストのみ、通知はブラウザ権限確認までのデモです

## Cloudflare Pages

- Root directory: `music-japan-site/second-take`
- Build command: `npm run check`
- Build output directory: `dist`
- Custom domain: `secondtake.music-japan.com`

## 本公開前チェック

1. サンプル記事を実在人物の記事へ差し替える
2. 全HTMLの `noindex,nofollow` を `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1` へ変更する
3. `robots.txt` を `Allow: /` に変更する
4. `_headers` の `X-Robots-Tag` を削除する
5. `sitemap.xml` と `feed.xml` を実記事のURL・公開日へ更新する
6. 人物名、会社名、写真、Podcastリンク、公開日、更新日を実データへ変更する
7. Google Search Consoleへサイトマップを送信し、構造化データとURL検査を確認する
