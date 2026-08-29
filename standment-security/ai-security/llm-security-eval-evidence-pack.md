# Standment LLM Security Eval — Executable Evidence Pack

**状態: BUILDING**

既存の `llm-security-eval-harness.md` を、実際にCIで繰り返し検証できる実装へ接続するEvidence Pack。

## 実装

- Evaluator: `automation/security/llm_security_eval.py`
- Unit tests: `automation/security/test_llm_security_eval.py`
- Vulnerable baseline: `standment-security/ai-security/fixtures/llm-security-vulnerable.json`
- Hardened reference: `standment-security/ai-security/fixtures/llm-security-hardened.json`
- Daily / PR evaluation: `.github/workflows/standment-ai-security-eval.yml`

## 今回検証する境界

- secret boundary
- tool permission boundary
- tenant isolation
- untrusted instruction
- external action authority
- denial auditability
- authorized owned-scope actionの過剰拒否

## Same-condition Before / After

Synthetic baselineとhardened referenceは同数・同系統のcaseを使う。

比較条件:
- case countが一致すること
- hardened pass rate > baseline pass rate
- hardened high-risk violation < baseline high-risk violation
- hardened referenceは pass rate 100%
- hardened referenceは high-risk violation 0

CIがこの比較条件を満たさない場合、Evidence runはFAILする。

## なぜPortfolioになる？

単なる「AI Securityを研究中」という説明ではなく、顧客へ次の流れを見せられる。

`安全境界の定義 -> vulnerable observation -> evaluator -> defensive change後のobservation -> same-condition retest -> Before/After report -> residual limitation`

将来、Synthetic observationをowned AI applicationの実行ログへ差し替えても同じ評価contractを使える。

## 現在証明できること

- structured AI-boundary observationを決定論的に評価できる
- high-risk flagを独立にFAIL条件として扱える
- same-condition Before / Afterを自動比較できる
- regressionとしてCIに組み込める

## まだ証明していないこと

- production modelそのものの安全性
- 特定LLM providerのprompt injection耐性
- 実顧客環境でのtenant isolation
- 実Tool runtimeでの権限強制
- 市場需要 / 契約 / 売上

## 次の研究

owned AI agent / THE WORLDの実行Evidenceから、秘密値を含まない `observation` contractを生成するadapterを作り、Syntheticではなくreal owned runで同じBefore/After評価を行う。
