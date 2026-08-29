# Standment Security Portfolio Index

**Mission:** 顧客が開いて確認できる、防御的かつ再現可能なSecurity Evidenceを毎日増やす。

Latest autonomous lab note: `standment-security/lab-notes/2026-08-30/SEC-PORT-005.md`

| Track | Portfolio | Priority | Evidence | Senju |
|---|---|---:|---:|---|
| `SEC-PORT-001` | Standment Security Scan dogfood + Before/After case study | 1200 | 75% | robustness |
| `SEC-PORT-002` | Customer Security Evidence Pack | 1060 | 67% | efficiency |
| `SEC-PORT-003` | Software supply-chain evidence portfolio | 1040 | 80% | robustness |
| `SEC-PORT-004` | Auth / tenant / RLS defensive evidence kit | 1020 | 67% | learning |
| `SEC-PORT-005` | Autonomous-agent security and auditability pack | 1100 | 100% | balance |
| `SEC-PORT-006` | Incident readiness and recovery evidence pack | 980 | 67% | robustness |
| `SEC-PORT-007` | Continuous security retainer scorecard | 960 | 75% | efficiency |
| `SEC-PORT-008` | Security architecture review pack for AI and SaaS systems | 1000 | 75% | learning |
| `SEC-PORT-009` | AI Agent Permission Boundary Lab | 1160 | 100% | robustness |
| `SEC-PORT-010` | LLM Security Evaluation Harness | 1140 | 100% | learning |
| `SEC-PORT-011` | Security Evidence Dashboard | 1080 | 100% | efficiency |

## Featured Verified Artifact

### Standment LLM Security Evaluation Harness

**Status: VERIFIED — evaluator capability only**

Human-facing portfolio artifact: `standment-security/portfolio/llm-security-evaluation/README.md`

What it proves:
- deterministic evaluation of recorded AI / Agent security-boundary observations
- same-condition synthetic Before / After separation
- baseline: 3 / 8 pass (37.5%), high-risk violations 4
- hardened: 8 / 8 pass (100%), high-risk violations 0
- unit tests 3 / 3 PASS
- Security Guard / Standment Security Gate / CodeQL / Dependency Review / Dependency Audit PASS
- verification run `33269540514`
- evidence artifact `9719670823`

What it does **not** prove:
- arbitrary production LLM safety
- all THE WORLD agents satisfy every boundary
- customer environment security
- market demand or revenue

Next proof target: feed owned THE WORLD Agent execution evidence into the same evaluator and produce a real baseline -> remediation -> same-condition retest case study.

## Promotion Rule
- BUILDING / EXPERIMENTは自動生成可能
- VERIFIEDは人間が確認できる実物 + 再現手順 + retest + counterevidenceが必要
- コード、PR、AI自己評価だけではVERIFIEDにしない
- 市場需要、契約、入金は技術Evidenceと別管理