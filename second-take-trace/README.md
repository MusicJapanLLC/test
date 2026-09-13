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
- 本番化時は両方を解除し、canonical、OGP、実URLを設定します
- メール登録は表示テストのみ、通知はブラウザ権限確認までのデモです
