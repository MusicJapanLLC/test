# Music Japan / Standment Company Memory

Supabaseを正史、GitHubをスキーマ・処理ロジックの変更履歴、Google Sheetsを人間用画面、Slackを通知画面として使う共通知識基盤です。

このリポジトリには個人情報や実在顧客データを保存しません。実データはSupabaseだけに保存し、各値は出典・元更新日時・取得日時・信頼度・検証状態を持ちます。

## 設計原則

- 人物・企業・案件・プロジェクトに不変のpublic IDを付与
- 別名と強い識別子を分離し、人名一致だけで自動統合しない
- 状態変更はイベント追記。履歴を消さない
- Factはvalid timeとrecorded timeを分離
- AIの推測は`ai_inferred`として保存し、事実のcurrent値に自動昇格させない
- Sheetsの送客状況、Calendarの日時、議事録の発言、GitHubのコード状態など、項目別にSource of Truthを指定
- 同格の強いソースが競合したら`unresolved`にし、勝手に選ばない
- 同期はat-least-once + idempotency key。失敗は指数バックオフ後にdead-letterへ送る

## API

認証済みSupabaseユーザーだけが利用できます。対象ユーザーは`cm_core.workspace_members`に登録します。

```http
POST /rest/v1/rpc/cm_person_brief
Authorization: Bearer <user JWT>
apikey: <publishable key>
Content-Type: application/json

{"p_name":"岡藤さん"}
```

全文・別名検索：

```http
POST /rest/v1/rpc/cm_memory_search
Authorization: Bearer <user JWT>
apikey: <publishable key>
Content-Type: application/json

{"p_query":"岡藤","p_limit":20}
```

service roleはサーバー側だけで利用し、ブラウザやSheetsへ置きません。

AI社員は認証済みEdge Functionも利用できます。

```http
POST /functions/v1/memory-query
Authorization: Bearer <user JWT>
Content-Type: application/json

{"question":"岡藤さんどうなった？"}
```

## ディレクトリ

- `supabase/migrations/`：正規化モデル、RLS、検索RPC、監査・再処理基盤
- `supabase/functions/memory-query/`：AI社員向け認証済み読み取りAPI
- `docs/source-precedence.md`：項目別Source of Truth
- `docs/sync-contract.md`：毎日同期と再処理の契約

## 「岡藤さんどうなった？」の処理

1. `岡藤さん`を正規化し、canonical nameとaliasを検索
2. 複数候補なら曖昧として停止
3. 商談、紹介、保存済み次回アクション、Factをas-of時点で集約
4. 各状態にsource record・confidence・verification stateを付けて返す
5. AIが考えた提案は保存済みタスクと混ぜない
