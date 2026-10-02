# music-japan-lp — 合同会社Music Japan のサイト（集客・検索・ご相談の予約）

「なぜ、Music Japanは音楽を売らないのか。」に答えながら、Baton Partners / Baton / SECOND TAKE を1ページずつ紹介するサイト。
目的は **検索で見つけてもらい、読んだ人がご相談の日程を選べるところまで** つなぐこと（集客LP × SEO × アポ獲得）。

- 予約ページ（TimeRex）への入口は、ヘッダーの「話してみる」→ `/talk/` の1つだけ。売り込みのボタンは並べない
- 各ページの終わりは「次のページ」。本の章のように、上から順に読み進められる（内部リンク）
- 問い合わせフォームは置かない。価格・契約条件・未確認の数字は書かない

## ページ

| URL | 中身 |
|---|---|
| `/` | なぜ音楽を売らないのか（WebGLの点のレコード）／その理由／つくっているもの／公開中のページ／最近のこと |
| `/baton-partners/` | 会社の専用ページ。5枚のページ、一社のページができるまで（横に流れる8工程）、公開したあと、よくある質問 |
| `/baton/` | 経営者の招待制プロフィール。決まり、申請からおつなぎまで、Baton Partnersとの違い |
| `/second-take/` | 経営者インタビュー。1回の取材でできるもの、聞き方の決まり、いまのこと |
| `/works/` | 公開中のページ（エボルグ／Central AX）。色・書体・3D・5枚のページ |
| `/news/` | お知らせ（種類で絞り込み、RSS・JSON Feed） |
| `/about/` | 会社概要、代表、よくある質問 |
| `/talk/` | 話してみる（TimeRexの予約ページへのボタンはここだけ） |

## よく触るところ

| やりたいこと | ファイル |
|---|---|
| 文章を直す | `src/content/copy.ts`（書き方の決まりと参考にした69件：`docs/writing-sources.md`） |
| よくある質問 | `src/content/faq.ts`（画面・構造化データ・llms.txt に同じものが入る） |
| ページのタイトル・説明文・URL | `src/content/pages.ts` |
| お知らせを足す | `src/content/activity.ts`（1件足すと、一覧・`/feed.xml`・`/activity.json` に反映） |
| 公開中の会社を足す | `src/content/projects.ts`（画像は `npm run shots` で撮る） |
| 予約ページ・連絡先・SNS | `src/content/site.ts` |
| 挿し絵（線画） | `src/render/illust.ts` |

`npm run build` の点検（`scripts/audit.mjs`）で止まるもの：h1が1つでない、title・canonical・og:image・構造化データの不備、
存在しないページへのリンク、使わない言葉（「設計」「お問い合わせ」「お気軽に」「準備はいりません」、価格、ダッシュなど）、
`/talk/` 以外の予約ボタン、本文から `/talk/` へのリンクが2つ以上。

## コマンド

```bash
npm install
npm run dev       # 開発（src を直すとページを作り直す）
npm run build     # 型チェック → ビルド（全ページ）→ 点検
npm run preview   # http://localhost:4180
npm run fonts     # 日本語フォントを、使っている文字だけに絞る（build → fonts → build）
npm run og        # SNS用の画像（public/og/<ページ>.png）を作り直す（build のあと）
```

フォントは Zen Old Mincho（見出し）と Zen Kaku Gothic New（本文）。`npm run fonts` が全ページをブラウザで開き、
書体と太さごとに使っている文字だけを集めて、ファイル名にハッシュを付けて `public/fonts/` に書き出す。

## 公開

- Vercel のプロジェクト `music-japan-lp`（Root Directory: `music-japan-lp`）。
- 本番（`VERCEL_ENV=production`）だけ検索に載る。プレビューと `*.vercel.app` は `noindex`。
- 独自ドメイン `about.music-japan.com`：Cloudflare に CNAME `about` → `791e17ae8f770433.vercel-dns-017.com`（プロキシなし）を足すと有効になる。
  URLを変えるときは、環境変数 `MJ_LP_URL` を本番に設定して再デプロイする（canonical・sitemap・構造化データのURLが変わる）。
