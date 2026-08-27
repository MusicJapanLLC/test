# Baton -バトン-

合同会社Music Japanが提携する6つのBtoBサービスを紹介するハブ型サイト。

- ハブページ1枚（Baton）＝ 6サービスへの目次
- サービス紹介ページ6枚 ＝ それぞれがミニLPとして完結
- 各ページ末尾に、カード送り式のアンケート（4問＋属性）
- 回答は Google Apps Script 経由でスプレッドシートへ

## 構造の考え方

**6ページを6回作っていない。** 1つのテンプレート × 6つの設定で動く。

色・ロゴ・コピー・実績数値・設問・送信先は、すべて `src/data/services.ts` にある。
7個目（LegalOn など）を足すときの作業は3つだけ:

1. `src/data/services.ts` の `services` 配列に1件追加する
2. `<slug>/index.html` をコピーして、script の参照先だけ変える
3. `src/entries/<id>.ts` を1行で作る（`mountServicePage('<id>')`）

`vite.config.ts` のエントリ一覧は `services` から自動生成されるので、触らなくてよい。
GAS 側は `gas/Code.gs` の `SERVICES` に1件足す。

## 開発

```bash
npm install
cp .env.example .env.local   # 値を埋める
npm run dev                  # http://localhost:5173
npm run build                # 型チェック + 本番ビルド
npm run preview              # ビルド結果の確認
```

## ページ

| パス | 内容 |
|---|---|
| `/` | ハブ（Baton） |
| `/engineer/` | テクフリ / 株式会社アイデンティティー |
| `/webgl/` | Standment |
| `/system/` | ZOOA / 株式会社ZOOA |
| `/newgrad/` | PEP lab |
| `/wordpress/` | サイト引越し屋さん / 株式会社DPパートナーズ |
| `/crm/` | Empro / 株式会社エボルグ |
| `/privacy/` | プライバシーポリシー |

各サービスページは `#survey` で設問部分に直接飛べる（テレアポ後の共有用）。
例: `/engineer/#survey`

## 環境変数

`.env.example` を参照。すべて `VITE_` 始まりなので、ビルド時にバンドルへ埋め込まれる（＝公開情報）。
秘密にしたい値は置かないこと。

| 変数 | 用途 |
|---|---|
| `VITE_GAS_ENDPOINT` | アンケートの送信先（GASウェブアプリのURL） |
| `VITE_GA4_ID` | GA4測定ID。空なら読み込まない |
| `VITE_META_PIXEL_ID` | MetaピクセルID。空なら読み込まない |

## パフォーマンス方針

- ヒーローの見出しはビルド時に静的HTMLへ焼き込む（LCPをJS待ちにしない）
- Three.js は初期ロードに入れない。`requestIdleCallback` で後から読む
- ハブはフルWebGL、サービスページは板1枚のシェーダー背景のみ
- 例外は Standment（`heavyWebGL: true`）。ページ自体がWebGL制作のデモになる
- `prefers-reduced-motion` がONなら3DとGSAPを止めて静的に
- WebGL非対応環境はCSSの静的グラデーションで成立する

## ロゴ

`public/logo-musicjapan.png` と `public/logo-standment.png` を置く。
未設置の間は同寸のSVGプレースホルダーが自動で出る。

## バックエンド

`gas/Code.gs` の先頭に設置手順がある。スプレッドシートの Apps Script に貼って
`setupSheets()` を実行 → ウェブアプリとしてデプロイ → URLを `VITE_GAS_ENDPOINT` へ。

## デプロイ（Vercel）

Root Directory を `baton` に設定すること。それ以外は `vercel.json` のとおり。
