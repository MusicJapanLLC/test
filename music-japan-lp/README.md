# music-japan-lp — 合同会社Music Japan の集客ページ

「Music Japanは結局何をしている会社なのか」「企業・経営者に何ができるのか」「Baton Partners / Baton / SECOND TAKE がどうつながっているのか」に1ページで答え、
**Baton Partnersの打ち合わせ（TimeRex）を増やす**ためのページ。問い合わせフォームは置かず、すべての入口を予約ページにしている。

コンセプトは **RELAY — 点が線になり、線が会話になる**。
背景のWebGLは、1つの点の群れが「会社・人（点）→ つながり（線）→ ページ → 検索 → 工程 → 公開中の2社 → 声（SECOND TAKE）→ 記録 → Music Japanのレコード → 2つの点がつながる」の順にかたちを変える。

## よく触るところ

| やりたいこと | ファイル |
|---|---|
| NOW / LATEST / BUILD LOG / JOURNAL を足す | `src/content/activity.ts`（1件足すだけで、カード・`/feed.xml`・`/activity.json` に反映） |
| 検索順位の記録を足す（確認できたものだけ） | `src/content/search-log.ts`（誰のページ・検索語・公開日・確認日・何位付近） |
| 文章を直す | `src/content/copy.ts` / よくある質問は `src/content/faq.ts` |
| 公開中の会社を足す | `src/content/projects.ts`（画像は `npm run shots` で撮る） |
| 予約ページ・連絡先・SNS | `src/content/site.ts` |

文章の決まり（`npm run build` の点検で止まる）：「設計」「リード獲得」「お問い合わせ」・価格・ダッシュ（——）は使わない。h1は1つ。予約ボタンは6か所以上。

## コマンド

```bash
npm install
npm run dev       # 開発（src を直すと index.html を作り直す）
npm run build     # 型チェック → ビルド → 点検（scripts/audit.mjs）
npm run preview   # http://localhost:4180
npm run og        # SNS用の画像（public/og/ja-top.png）を作り直す
npm run fonts     # 日本語フォントを使っている文字だけに絞って作り直す
```

## 公開

- Vercel のプロジェクト `music-japan-lp`（Root Directory: `music-japan-lp`）。
- 本番（`VERCEL_ENV=production`）だけ検索に載る。プレビューと `*.vercel.app` は `noindex`。
- 独自ドメインを付けるときは、環境変数 `MJ_LP_URL`（例：`https://about.music-japan.com`）を本番に設定して再デプロイする（canonical・sitemap・構造化データのURLが変わる）。
