# AI Factory Portfolio

最終更新: 2026-08-30 JST

このファイルは、Music Japan / Standment のAI開発工場が**実際に作ったもの**を社長・営業・非エンジニア向けに説明するための一覧です。

ステータス:
- **VERIFIED** = 実装 + 検証証拠あり
- **BUILDING** = 実物あり、最終統合/検証が残る
- **EXPERIMENT** = ラボ/試作段階
- **BLOCKED** = 実物はあるが外部依存で停止

---

## 1. Senju — GitHub-native Self-Improving Engineering Lab

**状態: VERIFIED**

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
- R&D directiveをbounded numeric strategyへ適用
- multi-seed stability / unseen holdoutを使って不安定な候補を落とす

### 検証
GitHub-native autonomous improverがdefault branch上でvalidated stateを自律昇格した実走証拠を確認済み。run `33253144926` / promoted commit `97528375730751784f213eab6291c4cfa70780f7`。最新の `senju/state/last-evolution-summary.json` でもsafe=true、source evidenceあり、shadow holdout stable/safeを保持している。

### 経営メリット
AI改善を「思いついた時だけ」ではなく定期工程に変えられる。AI Engineer / Security / QAなどの改善評価へ再利用できる。

### Evidence
- PR #35: Senju v2 durable daily self-evolution loop
- PR #36: Senju v3 GitHub-native autonomous improvement loop
- PR #67 merged: autonomous promotion evidence / run `33253144926`
- `senju/state/last-evolution-summary.json`
- `senju/state/last-evolution-plan.md`

### 次の改善
自律昇格の成功率・no-op率・holdout失敗率を継続計測し、Portfolio / CEO Reportingへ人間向け差分だけ配送する。

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
旧PR #31は現在のTHE WORLD本線から341コミット遅れていたため、そのままmergeせず最新ベースへ再構築。replacement PR #114でcurrent-base CI / authorized Baton dogfood / human-readable reportを再検証中。これらが揃うまではVERIFIEDへ上げない。

### 経営メリット
「セキュリティ対策できます」という営業トークではなく、**実際に顧客へ見せられる診断物**になり始めている。

### Evidence
- PR #31: stale original implementation
- PR #114: current-base rebuild / portfolio blitz replacement

### 次の改善
PR #114のCIとBaton dogfood evidenceを確定し、Before/After改善証拠をケーススタディ化する。

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

**状態: VERIFIED**

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
- `cm_person_brief` / `cm_memory_search`
- JWT必須 `memory-query`
- 本番Supabase migration
- 実データと監査履歴を保持
- 全Company MemoryテーブルでRLS有効

### 検証
2026-08-30に本番Supabaseを再実測。`cm_core` 24 tables / `cm_memory` 11 / `cm_ops` 5 / `cm_audit` 3の計43テーブルが存在し、43/43でRLS有効。個人データを開示せず集計だけ確認した結果、1 workspace / 15 entities / 6 aliases / 3 opportunities / 11 source records / 130 audit eventsを保持。Edge Function `memory-query` はACTIVEかつ `verify_jwt=true`。public RPC `cm_person_brief` と `cm_memory_search` も本番に存在し、どちらもSECURITY DEFINERではない。

### 現在の残り
GitHub側PR #32はDraftのまま。公開test repoから専用private repoへ分離することは引き続き望ましいが、これはコア機能の動作可否ではなくhardening / repository hygieneの改善項目として扱う。

### 経営メリット
AI社員の最大の弱点である「毎回忘れる」を、プロンプトではなく**稼働中のデータ基盤で解決する**。

### Evidence
- PR #32 draft: `Company Memory v1: canonical data model and query API`
- Production Supabase project: ACTIVE_HEALTHY
- `memory-query`: ACTIVE / JWT required
- Production aggregate verification: 43 RLS-enabled tables / 130 audit events

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
- 共通イベント規格 `ai-factory-ceo-event/v1` を定義
- 共通配送コード `automation/reporting/ceo_report.py` を実装
- 「通常成功は黙る / 成果・重要異常だけCEOへ」のAnti-noiseルールを実装

### 現在の残り
GitHub Secret `CEO_REPORT_WEBHOOK_URL` が `#ai-ceo-brief` 向けに設定されていることを実測し、GitHub常駐workerからの自動配送成功を確認する。

### 経営メリット
工場の成果を「存在しているけど見えない」状態から、**判断できる・営業に使える・進捗を把握できる**状態にする。

### 次の改善
既存のSenju / Security / Sales / Research系workerを共通イベント規格へ順次移行する。

---

## 7. Gmail Autonomous Sorter

**状態: BUILDING**

### 作ったもの
ChatGPTの定期タスク枠を使わず、GitHub Actionsが15分ごとに起動してGmailを自動整理するworker。メール本文をGitHubへ保存せず、送信元・件名・既存ラベルの最小情報だけで決定論的に分類する。

### 何に使える？
GitHub/Vercelなどの機械通知やニュースを受信箱から退避し、営業・商談・セキュリティ・要対応メールを前に残す。人間が読む受信箱と、システムログ置き場を自動で分離できる。

### すでにできていること
- GitHub Actions 15分cron
- GitHub / Vercel / 障害 / セキュリティ / 営業 / ニーズ / 日経 / 広告の分類ルール
- ラベル付与 / Star / Archive
- 未分類メールは安全側に倒して受信箱へ残す
- `自動整理済み` マーカーで重複処理を防止
- Gmail本文・件名・送信者をレポートartifactへ保存しない
- 集計だけを `ai-factory-ceo-event/v1` でCEO Reporting Layerへ渡す
- ルールunit tests
- 初回GitHub Actions CI run #1 成功

### 現在の残り
GitHub側の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` と、CEO Reporting用 `CEO_REPORT_WEBHOOK_URL` の実設定は未確認。これらが未設定でもworkflowは秘密情報を漏らさずBLOCKEDとして止まる。

### 経営メリット
メール整理がChatGPTを開く作業ではなく、**会社の常設バックグラウンド業務**になる。今後、営業監視・請求監視・障害監視も同じGitHub worker形式へ横展開できる。

### Evidence
- `.github/workflows/gmail-autonomous-sorter.yml`
- `automation/gmail_sorter/sorter.py`
- `automation/gmail_sorter/rules.json`
- `automation/gmail_sorter/test_sorter.py`
- GitHub Actions `Gmail Autonomous Sorter` run #1: success

### 次の改善
初回の実Gmail scheduled runを確認し、未分類だけを低コストAI判定へ回すfallbackを追加する。

---

## 8. Standment Security Autonomous Portfolio R&D Engine v1

**状態: VERIFIED**

### 作ったもの
Standmentをセキュリティ会社へ寄せるため、The worldの研究優先順位を**セキュリティ・ポートフォリオ最優先**へ固定する専用R&Dレーン。毎日、既存ポートフォリオとEvidenceを読み、最も価値の高い未完成テーマを自動選定し、R&Dと千寿へ接続する。

### 何に使える？
「研究した」「コードを書いた」で終了せず、顧客に見せられる診断レポート、Before/Afterケーススタディ、Evidence Pack、Supply-chain assurance、Auth/RLS evidence、AI Agent security evidenceへ研究を収束させる。

### すでにできていること
- 5つのSecurity Portfolio研究トラックを優先度付きで定義
- Portfolio gapを自動採点し最優先トラックを選定
- R&D仮説をbounded Senju directiveへ変換
- 千寿候補をcompetition / holdoutへ通し、negative resultも保存
- Human-inspectable artifact / verification / counterevidence / reproducibilityをPortfolio Promotion Gateとして必須化
- 「source codeだけ」「自己申告だけ」はPortfolio成果に昇格させない
- 日次研究EvidenceをGitHub Actions artifactとして保存
- Customer-facing `Control Evidence Pack v1` を強化し、Before/After・反証・再現性・Evidence Manifestを標準化

### 最優先研究トラック
1. **SEC-PORT-001** — Standment Security Scan dogfood + Before/After case study
2. **SEC-PORT-002** — Customer Security Evidence Pack
3. **SEC-PORT-003** — Software supply-chain evidence portfolio
4. **SEC-PORT-004** — Auth / tenant / RLS defensive evidence kit
5. **SEC-PORT-005** — Autonomous-agent security and auditability pack

### 検証
`Standment Security Portfolio Foundry` run `33265121118` がSUCCESS。R&D contract 3 tests + Senju directive/shadow 8 tests PASS。SEC-PORT-001を選定し、bounded Senju 9候補を実行。stable candidateなしというnegative resultも隠さず保存し、human-readable `evidence.md` を含む10ファイルをartifact `9718410706` に保存した。Slack配送だけは `RND_SLACK_WEBHOOK_URL` が空のためskippedしたが、エンジン本体の研究→競争→反証→Evidence生成は実測済み。

### Evidence
- PR #113 merged: `security: add daily Standment portfolio R&D foundry`
- Workflow run `33265121118`: SUCCESS
- Artifact `9718410706`: 10 evidence files
- `.github/workflows/standment-security-portfolio-rnd.yml`
- `standment-security/security_portfolio_program.json`
- `automation/security/portfolio_rnd.py`
- `automation/security/test_portfolio_rnd.py`
- `standment-security/CONTROL_EVIDENCE_TEMPLATE.md`

### 経営メリット
The world全体の研究量を増やすだけでなく、**Standmentが営業・提案・顧客説明に使えるセキュリティ実績へ毎日近づくように研究優先順位を固定**した。

### 次の改善
Slack webhookを回復しつつ、Security Scanを所有資産でdogfoodしてControl Evidence PackへBefore/After証拠を入れ、最初の顧客提示可能なケーススタディを増やす。
