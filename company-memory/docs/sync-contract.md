# Daily sync contract

## 順序

1. Google Sheets差分取得
2. Google Calendar／Gmail／Slack差分取得
3. Drive／議事録ファイルの版取得
4. source recordを内容ハッシュ付きで追記
5. canonical entity候補を正規化・名寄せ
6. Fact assertionと業務イベントを追記
7. 競合解決ポリシーを実行
8. Google Sheets表示用rangeを更新
9. 変更概要と失敗だけSlackへ通知

## 冪等性

- Inbox: `source_system_id + external_event_id`
- Source record: `source_system_id + external_id + external_version`
- Outbox: `destination + idempotency_key`
- 同期元へ書き戻す行には`origin_change_id`を付け、Sheets↔DBのループを止める

## 再処理

- 一時失敗：指数バックオフ + jitter、最大8回
- 429：`Retry-After`を優先
- 永続失敗：`cm_ops.dead_letter_events`へ移動
- 再実行は元event IDを維持し、二重登録を防止

## 人間確認が必須

- 氏名一致だけの人物統合
- 報酬単価の競合
- 入金済み判定
- 送客済み／商談実施済みへの昇格
- 強い一次情報同士の不一致
