# kuso-blog

会員登録もコメント欄もない、個人用ブログ。記事はMarkdown(MDX)ファイルをGitで管理するだけで、
サーバーもデータベースも持たない完全静的サイト。トップページのヒーローだけ、
生成的なノイズフィールドをWebGL(three.js + React Three Fiber)でリアルタイム描画している。

## 構成

```
blog/
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── page.tsx         # トップページ(Hero + 記事一覧)
│   │   ├── posts/[slug]/    # 記事詳細ページ
│   │   └── not-found.tsx    # 404
│   ├── components/
│   │   ├── Hero.tsx          # トップのWebGLヒーロー(タイトル込み)
│   │   └── webgl/             # Canvas・シェーダー本体
│   ├── content/posts/*.mdx   # 記事本体。frontmatterはtitle/date/description/tags/draft
│   └── lib/posts.ts          # frontmatterのパースと一覧取得
└── next.config.ts            # 静的書き出し設定
```

## 記事の書き方

`src/content/posts/` に `.mdx` ファイルを1つ追加するだけ。

```mdx
---
title: "記事タイトル"
date: "2026-08-21"
description: "一覧やmeta descriptionに出る一文"
tags: ["AI"]
draft: false
---

本文をMarkdownで書く。
```

`draft: true` にすると本番ビルド(`npm run build`)では一覧にも詳細ページにも出ない。
`npm run dev` では下書きも見える。

## 開発

```bash
cd blog
npm install
npm run dev       # http://localhost:3000
npm run build     # 静的書き出し(out/ に生成)
npm run lint
```

## デプロイ

`main` ブランチにこの `blog/` 配下の変更が入ると、リポジトリ直下の
`.github/workflows/deploy-blog.yml` がビルドしてGitHub Pagesに公開する。

初回だけ手動設定が必要:

1. GitHubのリポジトリ設定 → **Settings → Pages** を開く
2. **Source** を `GitHub Actions` に変更する

これだけ。以降は `main` にpushするたびに自動でビルド・デプロイされる。
公開URLは組織/リポジトリ名によって決まる(例: `https://<org>.github.io/<repo>/`)。

Vercelなど別の場所にデプロイしたい場合は、`next.config.ts` の `output: "export"` を
外してNext.jsのサーバー機能(ISR等)を使う構成に変更できる。

## 設計メモ

- **WebGLは壊れても本文が読める**: シェーダーはクライアントでのみ動的読み込み
  (`dynamic(..., { ssr: false })`)。`prefers-reduced-motion` が有効な環境や
  WebGL非対応の環境では、CSSのグラデーションにフォールバックする。
- **描画は必要なときだけ**: `Canvas` は `frameloop="demand"` で動かし、
  タブが非表示・要素が画面外のときは`requestAnimationFrame`ループごと止めて
  GPUに仕事をさせない。ミュートしたタブでファンが回る個人ブログにはしない。
- **記事はただのファイル**: DBもCMSも管理画面もない。Gitにコミットされた
  MDXファイルがそのまま正となる。
