# mj-sales-automation

合同会社Music Japanの営業・管理自動化ツール群。

## 初期プロジェクト: `legalon_outreach`

リーガルオンクラウド向けアポ獲得のための営業メール自動配信ツール。

### MVP 要件

1. **リスト読込**: Google Sheetsから送信先リストを取得
2. **テンプレート差し込み**: 会社名・担当者名等を差し込み
3. **送信**: Gmail API（またはSendGrid API）経由でメール配信
4. **送信ログ記録**: SQLiteに送信履歴・結果を記録

設計方針: **明日の売上を生む最小構成**。完璧さより速度。

## 技術スタック

| レイヤ | 技術 |
|---|---|
| メインロジック | Python 3.11+ |
| メール配信 | Gmail API / SendGrid API |
| リスト管理 | Google Sheets API |
| ログDB | SQLite |
| （将来）ダッシュボード統合 | Next.js 15 / Prisma / Neon |

## プロジェクト構造

```
.
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
├── config/
│   └── settings.py         # 環境変数ローダ
├── src/
│   ├── main.py             # エントリポイント
│   ├── sheets_client.py    # Google Sheets読込
│   ├── mail_client.py      # Gmail/SendGrid送信
│   ├── template_renderer.py # テンプレート差し込み
│   └── log_db.py           # SQLiteログ記録
├── templates/
│   └── legalon_cloud_intro.txt
├── data/                   # SQLite DBファイル保存先（.gitignore）
└── tests/
```

## セットアップ

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# .env を編集し、API キー等を設定
```

## 実行

```bash
python -m src.main --dry-run   # 送信せずに内容確認
python -m src.main             # 本番送信
```

## ロードマップ

- **Day 1**: 雛形・READMEの作成、Sheets読込とテンプレートレンダリングの実装
- **Day 2**: Gmail API送信、SQLiteログ記録
- **Day 3**: E2Eテスト、リスト投入、初回配信
- **将来**: 返信検知、A/Bテスト、Next.jsダッシュボード統合
