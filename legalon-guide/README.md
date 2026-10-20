# LegalOn ご紹介ページ

LegalOn（リーガルオン）を紹介するための、1ファイルのページ。検索に出さない（`noindex`）。独自ドメインは使わず、Vercel の `*.vercel.app` で公開する。

- 構成は Baton Partners と同じ5ページ（トップ／取り組み／記事／サービス／話してみる）。`#about` のようにハッシュで切り替える
- 世界観：夜のレビュールーム。トップは契約書を走査する光（three.js r128、cdnjs から SRI 付きで読み込み）
- 載せていないもの：LegalOn のロゴ、Baton Partners のロゴ、運営会社の名前、「許可を得ている」という記載、料金
- フッターに「非公式の紹介ページで、LegalOn Technologies の公式サイトではない」と明記している（なりすましに見えないように）
- 数字・機能・事例は、LegalOn Technologies の公式サイト、会社案内、プレスリリースで確認できたものだけ（2026年10月時点）

## 回答の届き方

```
話してみる（アンケート）→ /api/answer（Vercel の関数。形と長さを確認）→ GAS（gas/Code.gs）→ music.japan.llc@gmail.com にメール
```

- メールの宛先は `gas/Code.gs` の `NOTIFY_TO` だけ。ページのソースには宛先も GAS の URL も出ない
- GAS の URL は Vercel の環境変数 `GAS_ENDPOINT` に入れる。未設定のあいだ、送信は失敗表示になり、回答をコピーして担当者へ送る画面に切り替えられる
- おとりの欄が埋まっている送信、開いて4秒未満の送信は、成功に見せて捨てる

GAS の設置手順は `gas/Code.gs` の先頭。

## ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | ページ本体（CSS・JS込み） |
| `api/answer.js` | 回答を受けて GAS へ渡す関数 |
| `gas/Code.gs` | 回答をメールで送る Google Apps Script |
| `vercel.json` | `X-Robots-Tag: noindex`、CSP などのヘッダー |
