# リーガルチェック（LegalOn 紹介サイト）

株式会社LegalOn Technologies の「LegalOn」を紹介する1ページ完結のLP。

## Baton とは完全に独立している

リスク分離のため、次のすべてを分けている。**混ぜないこと。**

| | Baton | このサイト |
|---|---|---|
| ディレクトリ | `baton/` | `legal-check/` |
| Vercel プロジェクト | 別 | 別 |
| `VITE_GAS_ENDPOINT` | 別 | 別 |
| GAS ファイル | `baton/gas/Code.gs` | `legal-check/gas/LegalCode.gs` |
| 書き込み先シート | `engineer` ほか6枚 | `legal` の1枚のみ |
| 相互リンク | なし | なし |

スプレッドシートのファイル自体は同じものを使うが、**シートは `legal` の1枚だけ**を使い、
既存シートには触れない。

## 構造

Baton のテンプレート・アンケートUI・CSS設計をそのまま流用している。
中身は `src/data/services.ts` の1件だけ。文言・色・設問はすべてそこにある。

```
index.html            → LP + アンケート
privacy/index.html    → プライバシーポリシー
gas/LegalCode.gs      → 受け口（手動で Apps Script に貼る）
```

## Baton との作りの違い

- ハブページが無い。1ページ完結
- Baton へのリンクを張らない
- 動きを2割ほど抑えている（信頼感を優先）
- 配色は紺主体。ゴールドは縁のアクセントだけ
- 属性入力を「会社について」「ご担当者について」の2画面に分けている
- 電話番号を取る。ハイフンの有無どちらでも通る

## 開発

```bash
npm install
cp .env.example .env.local   # 値を埋める
npm run dev
npm run build                # 型チェック + 本番ビルド
npm run preview
```

## デプロイ（Vercel）

**新規プロジェクト**として作成する。Baton のプロジェクトにリンクしないこと。
Root Directory は `legal-check` を指定する。
