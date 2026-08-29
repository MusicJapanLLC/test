# AI Factory Portfolio

最終更新: 2026-08-29 JST

このファイルは、Music Japan / Standment のAI開発工場が**実際に作ったもの**を社長・営業・非エンジニア向けに説明するための一覧です。

ステータス:
- **VERIFIED** = 実装 + 検証証拠あり
- **BUILDING** = 実物あり、最終統合/検証が残る
- **EXPERIMENT** = ラボ/試作段階
- **BLOCKED** = 実物はあるが外部依存で停止

---

## 1. Senju — GitHub-native Self-Improving Engineering Lab

**状態: BUILDING**

### 作ったもの
GitHub Actions上で、前日のChampionを引き継ぎ、候補戦略を生成・比較・評価し、安全条件を通った状態だけを次世代へ昇格させる自己改善ループ。

### 何に使える？
AIエージェントの戦略や評価方法を、毎回人間が手で試すのではなく、継続的に比較・改善する研究基盤として使える。

### すでにできていること
- 前日のChampion/Strategyを引き継ぐ
- 候補をTournament/Evaluatorで比較
- public target / scope違反を拒否
- pytest / smoke evaluationを通す
- AIが変更できる範囲を限定
- GitHub自身をscheduler/orchestratorとして使う
- state-only PRを作る昇格フロー

### 現在の残り
コードとPRはmerge済み。**最初の完全な定期自動サイクル成功証拠を確認するまではVERIFIED運用とは呼ばない。**

### 経営メリット
AI改善を「思いついた時だけ」ではなく定期工程に変えられる。将来的にはAI Engineer / Security / QAなどの改善評価にも再利用可能。

### Evidence
- PR #35: Senju v2 durable daily self-evolution loop
- PR #36: Senju v3 GitHub-native autonomous improvement loop

### 次の改善
最初のscheduled runを観測し、成功/失敗・Champion差分・改善量をCEO Reporterへ配送する。

---

## 2. Standment Security Company Baseline v0.3

**状態: VERIFIED**

### 作ったもの
Standment自身が守るべき開発・運用・認証・データ・CI/CDの最低基準を、会社共通のセキュリティ標準としてコード化。

### 何に使える？
自社開発のチェックリストだけでなく、将来顧客へ提供する「セキュリティ初期診断 / 継続保守」の納品基準として再利用できる。

### すでにできていること
- owned / authorized scope境界
- PUBLIC / INTERNAL / RESTRICTED分類
- MFA/passkey・secret管理基準
- auth / tenant / external ingest基準
- backup / RPO / RTO / observability基準
- customer evidence / delivery基準
- KEEP / REVERT / BLOCKEDによる自動改善ルール

### 経営メリット
セキュリティを個人の知識ではなく、**会社の商品・品質基準**へ変え始めている。

### Evidence
- PR #29 merged: `security: Standment company security baseline v0.3`

### 次の改善
実サービスの診断結果をこの標準へマッピングし、顧客向けEvidence Packへ変換する。

---

## 3. Standment Security Scan v1

**状態: BUILDING**

### 作ったもの
許可済みWebサイトだけを対象にした、読み取り専用の継続セキュリティ監査エンジン。

### 何に使える？
Webサイト/SaaSの最低限のセキュリティ状態を自動確認し、日本語の改善レポートと証拠JSONを出す。月額保守サービスの土台にできる。

### すでにできていること
- HTTPS / TLS
- Security Headers
- Cookie
- HTML設定
- 限定的な accidental exposure確認
- 0-100 risk score / A-F grade
- 日本語remediation report
- JSON evidence
- allowlist authorization gate
- 日次監査設計
- 90日証拠保持
- unit tests
- security-critical change control

### 現在の残り
PR #31はopen。最終mergeと本番dogfooding結果の確定が必要。

### 経営メリット
「セキュリティ対策できます」という営業トークではなく、**実際に顧客へ見せられる診断物**になり始めている。

### Evidence
- PR #31 open: `security: productize Standment Security Scan v1`

### 次の改善
Baton等の所有資産でレポート品質をdogfoodし、Before/Afterの改善証拠をケーススタディ化する。

---

## 4. Revenue Recovery AI — External Ingest Hardening

**状態: VERIFIED**

### 作ったもの
営業イベントを受け取るRevenue Recovery AIの外部入力経路を、重複・リプレイ・大量投入に強くした。

### 何に使える？
Gmail/CRM/Slack等のイベントを営業AIへ渡す際、同じイベントの二重処理や異常な大量入力でデータや営業処理が壊れるリスクを減らす。

### すでにできていること
- 未承認source拒否
- timestamp validation
- idempotency key
- exact replayの重複書込み防止
- integration workspace単位rate limit
- bounded input

### 検証
AppDeploy `30-nnktft` へ同等backendを反映しREADY。frontend/backend/network error logは空。E2Eは未確認のためE2E PASSとは扱わない。

### 経営メリット
Revenue Recoveryを「AIデモ」から、外部サービスと接続して継続利用できる業務システムへ近づける。

### Evidence
- PR #30 merged: `security: harden Revenue Recovery external ingest`

### 次の改善
実際の営業イベントでreplay/idempotency/rate-limitの運用証拠を増やし、顧客向けSaaS品質へ寄せる。

---

## 5. Company Memory v1

**状態: BUILDING**

### 作ったもの
会社・人物・案件・紹介履歴などをSupabaseへ集約し、「どれが最新の事実か」「同一人物か」をAIが追える共通知識基盤。

### 何に使える？
AIに毎回同じ人物・会社・案件説明をやり直す時間を減らし、営業・紹介・議事録・次回アクションを一貫した情報から引ける。

### すでにできていること
- canonical person/company/deal ID
- 表記揺れ・重複排除
- bitemporal facts
- evidence URL / confidence / source precedence
- append-only history
- AI change audit
- retry / dead-letter設計
- 日本語全文検索
- `cm_person_brief`
- JWT必須 `memory-query`
- 本番Supabase migration
- 実データで検索・更新監査を実測

### 現在の残り
GitHub側PR #32はDraft。公開test repoなので、private repoへの分離が望ましい。

### 経営メリット
AI社員の最大の弱点である「毎回忘れる」を、プロンプトではなく**データ基盤で解決する**方向へ進んでいる。

### Evidence
- PR #32 draft: `Company Memory v1: canonical data model and query API`

### 次の改善
専用private repo化と、営業・議事録・Revenue Opsからの自動同期を安定化する。

---

## 6. AI Factory CEO Reporting Layer

**状態: BUILDING**

### 作ったもの
開発者向けログと、社長が読む成果報告を分離するReporting Layer。

### 何に使える？
大量のPR、セキュリティログ、AI Agent出力を「何を作った / 何に使える / 何が改善 / 売上や生産性にどう効く / 次は何」の日本語に変換して経営者へ配送する。

### すでにできていること
- private Slack `#ai-ceo-brief` を作成
- CEO Reporterの報告契約を `docs/CEO_REPORTING_SYSTEM.md` に定義
- 本ポートフォリオを正本化

### 現在の残り
ChatGPT automationをCEO Reporterへ変更し、1日2回のowner mention付き配送を実測する。

### 経営メリット
工場の成果を「存在しているけど見えない」状態から、**判断できる・営業に使える・進捗を把握できる**状態にする。

### 次の改善
CEO Briefの配送成功を確認し、各プロジェクトの状態差分を自動で本ファイルへ反映する。
