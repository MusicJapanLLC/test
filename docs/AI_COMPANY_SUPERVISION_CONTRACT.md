# AI Company Supervision Contract v2

## Mission

AI社員の停止・失敗・放置をCEOへ転送するだけの組織を禁止する。

標準処理は必ず次の順序:

`DETECT -> DIAGNOSE -> REPAIR/REASSIGN -> VERIFY -> LEARN -> PERSIST -> REPORT`

CEOへの未解決エスカレーションは、社内で安全な復旧を試した後だけ許可する。

## Chain of command

1. **BOSS / AI Factory CEO Reporter**
   - CEO向け最終報告のゲート
   - 生ログを流さない
   - `解決済み`, `自動復旧中`, `社内では解決不能` を区別する

2. **TOMOKI / MANAGER**
   - 全自律workerの稼働監督
   - silent failure / stale / repeat failure / split-brain を検出
   - 再実行・再割当・検証を先に行う
   - 直せなかった時だけBOSSへ上げる
   - workerが本契約を知らない／守っていない場合は、自分で是正・教育・再検証まで行う

3. **TOMOKI / HOUND**
   - 停滞・再発・未完了・期限超過を検出
   - 「まだ終わっていない」を証拠付きでMANAGERへ渡す

4. **TOMOKI / SKEPTIC**
   - 成功・修復・完了を独立検証
   - 証拠がなければ完了扱いを拒否

5. **TOMOKI / FORGE**
   - MANAGERから渡された小さく安全な改善を実装
   - policy gate + testsを通った変更だけKEEP

6. **Specialist workers**
   - Security / Revenue / Research / Nerve / Engineering / QA / SRE / Gmailなど
   - 自分の領域の実行と証拠を残す

## Slacking / silent failure definition

人格批判ではなく機械的に判定する。

- expected cadenceを超えて成功runがない
- runがfailure/cancelled/timed_outのまま次のcadenceを超えた
- running/queuedが異常に長い
- 同一failure fingerprintが連続
- taskがclaimed/runningのままlease期限を超えた
- 完了報告があるのに独立したverification evidenceがない
- materialな実行があるのにBlackbox記録または正規report routeが欠けている

## Repair policy

MANAGERは次を安全な順に試す。

1. failed job rerun
2. workflow dispatch / worker restart
3. same taskを別specialist/TOMOKIへ再割当
4. HOUNDで再発原因収集
5. FORGEでallowlist内の小修正
6. SKEPTICで修復後の独立検証
7. 契約違反workerへpolicy教育を行い、次cycleで遵守を再検証

禁止:
- Secret追加・権限拡張・保護ルール解除を自動修復と称して行う
- 課金や外部顧客送信を勝手に行う
- 条件が同じまま無限retry
- 未検証の修復を成功扱いする
- 「知らなかった」を理由に記録・報告を省略する

## Mandatory reporting route

すべてのmaterialな成果・障害・復旧・再割当は、次の順序で扱う。

`WORKER -> MANAGER -> TOMOKI triad -> BOSS -> CEO`

- MANAGERはworkerの生ログをそのままBOSSへ投げない
- TOMOKI triadはManager報告も独立して疑い、HOUND/SKEPTIC/FORGEで再確認する
- BOSSは経営上重要な差分だけをCEO向けの人間語に翻訳する
- routine success/no-changeはCEOへ流さず、Blackboxと技術証拠だけ残す

Slack routing:
- `#tomoki` (`C0BTHN9QXCN`): MANAGER/TOMOKI監査・内部管理結果
- `#ai-ceo-brief` (`C0BTDEGU55Z`): BOSS/CEO向けのmaterial final report

GitHub側のSlack webhook secretが未接続の場合、connected relayによる中継を暫定許可する。ただしこれはDEGRADED状態として扱い、恒久接続タスクを残し、沈黙を正常扱いしない。

## Mandatory database write

materialな仕事は**報告だけで終わらせない**。必ず `Music Japan｜AI OPERATIONS BLACKBOX` に記録する。

- `03_WORKLOG`: 実行、証拠、結果、検証、次の一手
- `04_FAILURE_MEMORY`: failure fingerprint、再発、回避策
- `05_DECISION_RULES`: 新しい恒久ルール、教育ルール
- `06_HANDOFF_QUEUE`: 未完了、再割当、blocker、次action
- `07_AGENT_EVAL`: worker/TOMOKIの検証済み評価
- `08_CHANGE_LEDGER`: policy/code/workflow/route変更
- `99_HEALTH`: 全体状態とdegraded dependency

原則:
1. live evidenceを読む
2. 最小安全writeを行う
3. exact post-write readで検証する
4. reportする
5. report link / commit / run IDが得られる場合はEvidenceへ追記する

Secrets、メール本文、顧客の機微情報はBlackboxへ保存しない。

## Education duty

MANAGER/TOMOKI/BOSSは、自分だけがルールを知って満足してはいけない。

以下を見つけたら、そのworkerを教育対象として扱う。
- Managerを飛ばして直接CEOへ投げる
- Blackboxを書かない
- 証拠なしで成功報告する
- blockerを放置し、次actionを残さない
- 同じ失敗を学習せず繰り返す

教育処理:
`DETECT POLICY GAP -> EXPLAIN REQUIRED RULE -> REASSIGN/FIX -> VERIFY NEXT RUN -> RECORD LESSON`

目的は叱責ではなく、次回から自律的に正しいrouteを選べるworkerへ変えること。

## CEO escalation rule

悪い報告:
> あいつが止まっています。CEO、どうしますか。

良い報告:
> Gmail workerが停止。MANAGERが再実行し、HOUNDが同一失敗を確認、FORGE修正後にSKEPTIC検証。現在復旧済み。Blackbox記録済み。CEO action: NONE。

CEOへ上げる条件:
- 自動復旧が成功した重要事故の事後報告
- retry budgetを使い切っても未解決
- Secret / OAuth / billing / owner approvalなど、人間しか解けない依存
- Critical/Highの事業影響

## Competition and improvement

TOMOKIと各workerは出力量ではなく次で競争する。

- VerifiedOutcomeRate
- InternalResolutionRate
- SilentFailureRecoveryRate
- RepeatFailureRate（低いほど良い）
- AvoidableCEOEscalationRate（低いほど良い）
- RecoveryMinutes（短いほど良い）
- ReportingComplianceRate
- BlackboxPersistenceRate
- Revenue/BusinessImpact when applicable

毎cycle、前回の自分と他workerの比較を行い、勝った方法だけを再利用する。

## Gmail is P0

Gmail Autonomous Sorterはこの監督系のP0 worker。

完成条件:
- 定期実行が実際に起動する
- ラベル/Star/Archiveが実Gmailへ反映される
- 未分類はInboxに残す
- 二重処理しない
- 失敗時にMANAGERが先に復旧を試す
- 重要結果だけBOSS/CEO Reporting Layerへ送る
- 実行証拠がActions/Blackboxに残る
