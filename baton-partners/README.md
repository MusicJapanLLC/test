# Baton Partners — 企業別ページ

partners.music-japan.com に載せる、Baton Partners の企業別ページ（静的HTML）。
ビルド不要。フォルダごと配信先の `/<企業ID>/` に置けばそのまま動く。

| フォルダ | 企業 | 番号 | テーマ |
|---|---|---|---|
| `bepresto/` | BE.PRESTO株式会社（代表取締役CEO 子安 魁） | BP-008 | 社名の PRESTO（速度記号）と「Be Fast to Ring the Bell」から、テンポと鐘 |

## bepresto/ の中身

```
bepresto/
  index.html              本文・メタ情報・構造化データ
  assets/style.css        見た目（インク / 紙 / ティール / 真鍮）
  assets/main.js          五線譜ヒーロー、鐘と和音（押したときだけ音が出る）、メトロノーム、AI研修スコア
  assets/koyasu-*.jpg     代表写真（位置情報などのメタデータは削除済み）
  assets/og.jpg           SNS共有用（1200×630）
```

セクション: ヒーロー → PRESTOの意味 → 発信のテンポ（メトロノーム） → 3つの鐘（事業） → 数字 → AI研修8小節スコア → バリューの和音 → 雑誌の表紙風プロフィール → 代表メッセージ → 会社概要 → 相談導線。

`prefers-reduced-motion` のときはアニメーションを止め、静止画で成立する。

## 公開前に確認すること

- [ ] 写真・会社名・掲載内容について、子安さんの了承（ページ初稿の確認）
- [ ] 「話してみる」の送り先 `bepresto/contact/` を、既存企業と同じ相談フォームで用意する
- [ ] 「Baton Partners｜企業設定」シートに `bepresto` の行（企業名・通知先メール）を追加する
- [ ] 番号 BP-008 でよいか（パートナー一覧では BP-004 が空いている）
- [ ] music-japan.com/partners/ の一覧に BE.PRESTO のカードを追加する
- [ ] ロゴ画像が届いたら、ヘッダーの文字ロゴ `BE.PRESTO` と差し替える

## 掲載情報の出典（2026年10月時点）

- 会社概要・理念・代表メッセージ: https://bepresto.co.jp/about/
- 事業: https://bepresto.co.jp/ / 教育事業 https://bepresto.co.jp/education-service/
- 支援実績400社・総再生回数1億回・最短20日・月額10万円: https://be-presto-saiyo.com/
- 2025年パリコレ スポンサー認定企業: 子安さんの X（@_KAI_KOYA_）のプロフィール
- 設立 2024年4月: 公開企業情報（doda 等）
