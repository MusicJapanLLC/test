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

## Baton Introduction System（紹介システム）

上記のハブ＋6サービスとは完全に独立した別機能。仕様は
`Baton MVP Backend Specification v1.1` を参照。

「人物プロフィール → この人と話したい → 申請者メール認証 → 掲載者（本人）の承認/辞退
→ 社長へメール通知 → 社長が手動で紹介」という一次紹介の流れを扱う。
承認後も連絡先は自動共有しない（LINEグループなどでの紹介は人の判断で行う）。

### ページ

| パス | 内容 |
|---|---|
| `/profile/` | プロフィール一覧 |
| `/profile/<slug>/` | 人物プロフィール（6件。中身は `src/data/profiles.ts`） |
| `/verify/?t=...` | 申請者のメール認証（メール内リンク） |
| `/respond/?t=...` | 掲載者の承認/辞退（メール内リンク） |

`/verify/` `/respond/` は使い捨てトークン専用ページなので `noindex` にしてある。

### プロフィールの中身について

サイトに表示される氏名・写真・紹介文・話せるテーマは `src/data/profiles.ts` の
静的データ（現状は6サービスの紹介文を仮に流用したもの）。ここを直接書き換えて
実際の顔写真・経歴文に差し替えていく想定（1件が独立した「ミニLP」になる）。

一方、**掲載者（承認/辞退する本人）のメールアドレスと申請受付の有効/無効は、
GASのスプレッドシート側の `PROFILES` シートだけが持つ**（`recipient_email` /
`active` 列）。ここはコードに含めていない非公開情報なので、担当者が決まったら
再デプロイなしでシートを直接編集する。

### バックエンド（GAS）追加セットアップ

`gas/Code.gs` の中身は既存のアンケート受信処理に追記する形になっている
（`SERVICES` / `setupSheets` 側は無変更）。手順:

1. 既存の `setupSheets()` に加えて、関数選択で `setupBatonSheets` を選び実行する
   → `PROFILES` / `REQUESTS` / `TOKENS` / `RESULTS` の4シートができる
   → `PROFILES` には初期6件が入る（`recipient_email` は暫定で全員
     `music.japan.llc@gmail.com`）
2. 掲載者の実メールが決まり次第、`PROFILES` シートの `recipient_email` 列を
   直接書き換える
3. 「デプロイを管理」で新バージョンとして更新する（既存手順と同じ）
4. 時間主導トリガーを1つ追加する（3日リマインド・7日expireに必要）
   - 「トリガー」→「トリガーを追加」
   - 実行する関数: `batonDailyJob`
   - イベントのソース: 時間主導 → 日付ベースのタイマー → 1日1回、好きな時間帯

同じ `VITE_GAS_ENDPOINT` を使い回す（新しいエンドポイントは作らない）。

### セキュリティ・スパム対策の要点

- トークンは十分に長いランダム値（ハッシュのみシートに保存）。メール認証・
  承認/辞退のどちらも1回限り・期限付き（認証24時間、承認/辞退は認証から7日間）
- 掲載者メールはHTML・URLに一切出さない（`/respond/` は申請内容だけを表示する）
- 承認/辞退はメールのリンクを開いただけでは確定しない。確認画面でボタンを押した
  ときだけPOSTで確定する
- 同時申請数の上限（「最大3人」等）は設けていない。同一人物への重複申請の防止・
  簡易レート制限・ハニーポットだけで足りるようにしてある
- プロフィールに資本金・従業員数・売上などの企業スペック項目は持たない

### 動作確認

`testBatonFlow()` を実行すると、`engineer` プロフィールへテスト申請が1件でき、
`test@example.com` 宛の認証メールが飛ぶところまで確認できる。
