# Source precedence

優先順位は全項目共通ではなく、predicate単位で管理します。

| 情報 | 第一優先 | 次点 | 補助のみ |
|---|---|---|---|
| 送客・商談ステータス | 指定営業KPI Sheet | 送信済みメール／Slack原文 | AI要約 |
| 商談日時 | Google Calendar | TimeRex通知 | 議事録中の口頭表現 |
| 発言・合意内容 | 議事録原文／録画 | 当事者メール | AI要約 |
| 報酬条件 | 最新契約／指定案件Sheet | 担当者メール | 過去議事録・Chat履歴 |
| 請求 | 請求書原本 | 送信済みメール | Draft |
| 入金 | 銀行／会計の検証済み記録 | 入金連絡 | AI推測 |
| コード・デプロイ | GitHub commit／deployment | Issue／Slack | AI報告 |

同一優先度では`source_updated_at`が新しい情報を優先します。取得日時`fetched_at`は新旧判定には使いません。同格の一次情報が食い違う場合は`unresolved conflict`にします。

AI抽出には必ず`extraction_method`、`extractor_version`、`confidence`を残します。金額、入金、人物同一性、送客済み判定はAI推測から自動確定しません。

