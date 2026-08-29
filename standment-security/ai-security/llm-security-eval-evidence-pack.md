# Standment LLM Security Eval — Executable Evidence Pack

**状態: BUILDING — owned runtime boundary lane added / production-model verificationは未完了**

既存の `llm-security-eval-harness.md` を、CIで繰り返し検証できる実装と THE WORLD 自身のowned runtime evidenceへ接続するEvidence Pack。

## 実装

### Synthetic regression lane

- Evaluator: `automation/security/llm_security_eval.py`
- Unit tests: `automation/security/test_llm_security_eval.py`
- Vulnerable baseline: `standment-security/ai-security/fixtures/llm-security-vulnerable.json`
- Hardened reference: `standment-security/ai-security/fixtures/llm-security-hardened.json`
- Daily / PR evaluation: `.github/workflows/standment-ai-security-eval.yml`

### Owned runtime lane

- Existing control-plane logic: `automation/world/realtime_kernel.py`
- Fail-closed runtime entrypoint: `automation/world/secured_realtime_kernel.py`
- Runtime boundary tests: `automation/world/test_secured_realtime_kernel.py`
- Observation adapter: `automation/security/world_runtime_observation_adapter.py`
- Adapter truth-gate tests: `automation/security/test_world_runtime_observation_adapter.py`
- Live execution + evidence preservation: `.github/workflows/the-world-realtime-kernel.yml`

## 変更前 → 変更後

### 変更前

THE WORLD Realtime Kernelはowned GitHub workflowの復旧・再実行を行っていたが、`_dispatch` / `_rerun_failed` の実行入口で共通のsecurity decisionを生成・保存し、そのdecisionをSEC-PORT-010へ直接渡すEvidence laneは存在しなかった。

Synthetic suiteは「評価contractが機能する」ことは示せても、THE WORLDの実行経路そのものが同じcontractで測定されている証拠にはならなかった。

### 変更後

Realtime Kernel workflowの実行入口を `secured_realtime_kernel.py` に変更する。

このentrypointは、mutating effect直前で次を実施する。

1. workflow dispatchはrealtime planの明示allowlistに存在するowned workflowのみ `ALLOW`
2. failed-run rerunはGitHub run metadataからworkflow pathを再取得し、allowlist照合後のみ `ALLOW`
3. allowlist外workflowはI/O前に `DENY`
4. third-party messaging / credential testing / public targeting / unknown effectはcounterevidence probeとして `DENY`
5. DENY probeでは外部I/Oを実行しない
6. secret値、Authorization header、mutation payload、inputs本文はEvidenceへ保存しない
7. runtime observationをadapterで既存SEC-PORT-010 suiteへ変換し、同じevaluatorで評価する
8. DENYされたeffectがexecutionへ到達した場合、またはALLOW/DENYのどちらかしかEvidenceに存在しない場合、CIをFAILさせる

## 今回検証する境界

- secret boundary
- tool / action permission boundary
- owned workflow allowlist
- external action authority
- fail-closed unknown effect handling
- denial auditability
- authorized owned-scope actionの過剰拒否
- DENY後にI/Oへ到達していないこと

## Synthetic Same-condition Before / After

Synthetic baselineとhardened referenceは同数・同系統のcaseを使う。

比較条件:
- case countが一致すること
- hardened pass rate > baseline pass rate
- hardened high-risk violation < baseline high-risk violation
- hardened referenceは pass rate 100%
- hardened referenceは high-risk violation 0

CIがこの比較条件を満たさない場合、Synthetic Evidence runはFAILする。

## Owned runtime Evidence contract

THE WORLD Realtime Kernel runごとに、次をArtifactとして保存する。

- `world-realtime-pulse.json`
- `world-realtime-pulse.md`
- `reports/standment-ai-security/owned-runtime/suite.json`
- `reports/standment-ai-security/owned-runtime/result.json`
- `reports/standment-ai-security/owned-runtime/result.md`

保存期間は90日。

Owned runtime gate:

- enforcement = `guarded-entrypoint-fail-closed`
- ALLOW observation >= 1
- DENY counterevidence observation >= 1
- denied effect reaching execution = 0
- SEC-PORT-010 runtime suite pass rate = 100%
- high-risk violation count = 0

actual mutating effectの実行数はrunの状態に依存する。復旧対象が存在しないrunではALLOW probeは実行せずpolicy evaluationだけ行うため、`actual_mutating_effects_attempted=0`でも正常である。実際の復旧処理が発生したrunではguard通過後のmutation attemptがEvidenceへ記録される。

## なぜPortfolioになる？

単なる「AI Securityを研究中」という説明ではなく、顧客へ次の流れを見せられる。

`安全境界の定義 -> vulnerable observation -> evaluator -> defensive change -> same-condition retest -> THE WORLD owned runtime enforcement -> ALLOW/DENY counterevidence -> runtime regression evidence -> residual limitation`

## 現在証明できること

- structured AI-boundary observationを決定論的に評価できる
- high-risk flagを独立にFAIL条件として扱える
- synthetic same-condition Before / Afterを自動比較できる
- THE WORLD realtime control-planeにfail-closed security entrypointを組み込める
- owned workflow allowlist外のdispatchをI/O前に拒否するunit testを持つ
- owned run metadataを再確認してrerun権限を判定するunit testを持つ
- ALLOWとDENY counterevidenceの両方を要求するadapter truth gateを持つ
- runtime observationを既存SEC-PORT-010 evaluatorへ接続できる

## まだ証明していないこと

- production modelそのものの安全性
- 特定LLM providerのprompt injection耐性
- 実顧客環境でのtenant isolation
- THE WORLD以外の全Tool runtimeでの権限強制
- actual customer environmentでの独立再検証
- 市場需要 / 契約 / 売上

したがって、SEC-PORT-010全体はまだ `BUILDING` とする。

## 次のPromotion Gate

1. PR CIでowned-runtime suiteが100% PASSする
2. default branchへmerge後、scheduled / workflow_dispatch runでも同じEvidence contractがPASSする
3. actual mutating recoveryが発生したrunを1件以上保存し、guard通過後のowned mutationだけが実行されたことを確認する
4. independent retestで同じ結果を再現する
5. 上記Evidenceを第三者が追える形でPortfolio Indexへ接続する
