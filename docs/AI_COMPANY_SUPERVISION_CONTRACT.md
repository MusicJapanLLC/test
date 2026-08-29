# AI Company Supervision Contract v1

## Mission

AI社員の停止・失敗・放置をCEOへ転送するだけの組織を禁止する。

標準処理は必ず次の順序:

`DETECT -> DIAGNOSE -> REPAIR/REASSIGN -> VERIFY -> LEARN -> REPORT`

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

## Repair policy

MANAGERは次を安全な順に試す。

1. failed job rerun
2. workflow dispatch / worker restart
3. same taskを別specialist/TOMOKIへ再割当
4. HOUNDで再発原因収集
5. FORGEでallowlist内の小修正
6. SKEPTICで修復後の独立検証

禁止:
- Secret追加・権限拡張・保護ルール解除を自動修復と称して行う
- 課金や外部顧客送信を勝手に行う
- 条件が同じまま無限retry
- 未検証の修復を成功扱いする

## CEO escalation rule

悪い報告:
> あいつが止まっています。CEO、どうしますか。

良い報告:
> Gmail workerが停止。MANAGERが再実行し、HOUNDが同一失敗を確認、FORGE修正後にSKEPTIC検証。現在復旧済み。CEO action: NONE。

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
- Revenue/BusinessImpact when applicable

毎cycle、前回の自分と他workerの比較を行い、勝った方法だけを再利用する。

## Blackbox database

`Music Japan｜AI OPERATIONS BLACKBOX` を会社運用の共有記憶として扱う。

- `03_WORKLOG`: 実行と検証の履歴
- `04_FAILURE_MEMORY`: failure fingerprintと再発防止
- `05_DECISION_RULES`: この契約を含む運用ルール
- `06_HANDOFF_QUEUE`: 未解決/再割当タスク
- `07_AGENT_EVAL`: worker/TOMOKI競争スコア
- `08_CHANGE_LEDGER`: 変更履歴
- `99_HEALTH`: 全体状態

Secrets、メール本文、顧客の機微情報はBlackboxへ保存しない。

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
