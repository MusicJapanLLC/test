# Standment Security Portfolio Index

Status: **BUILDING**

> Standment Security R&Dの成果を、研究量ではなく「顧客が確認できるEvidence」で追跡するためのTruth Index。

## Company Priority

**THE WORLD P0 — Standment Security Portfolio R&D**

Operating rule: `LIMITLESS MIND / BOUNDED EXECUTION / EVIDENCE BEFORE CLAIMS`

## Promotion States

- `ABSENT` — 顧客が確認できる成果物なし
- `BUILDING` — 成果物あり / Evidence不足
- `PROMOTION_READY` — 必須Evidenceが揃い最終確認待ち
- `VERIFIED` — 再現・独立retest・counterevidence・limitationsまで確認済み
- `BLOCKED` — 次の実験を止める具体的依存あり

## Security Portfolio

| Track | Portfolio Asset | Current truth | Evidence target |
|---|---|---|---|
| `SEC-PORT-001` | Security Scan dogfood + Before/After | BUILDING | same-condition before/after + independent retest |
| `SEC-PORT-002` | Customer Security Evidence Pack | BUILDING | complete buyer-readable example bundle |
| `SEC-PORT-003` | Software Supply-Chain Evidence Portfolio | BUILDING | reproducible CodeQL/dependency/SBOM/gate proof |
| `SEC-PORT-004` | Auth / Tenant / RLS Defensive Evidence Kit | BUILDING | owned fixture authorization before/after evidence |
| `SEC-PORT-005` | Autonomous-Agent Security & Auditability Pack | BUILDING | allowed/denied/logged/recovered action proof |
| `SEC-PORT-006` | Incident Readiness & Recovery Evidence Pack | BUILDING | rollback/restore/recovery retest evidence |
| `SEC-PORT-007` | Continuous Security Retainer Scorecard | BUILDING | recurring freshness/regression evidence |
| `SEC-PORT-008` | Security Architecture Review Pack | BUILDING | inspectable sample assessment + evidence links |
| `SEC-PORT-009` | AI Agent Permission Boundary Lab | BUILDING | permission matrix + fail-closed independent retest |
| `SEC-PORT-010` | LLM Security Evaluation Harness | BUILDING | reproducible AI boundary cases + regression evidence |
| `SEC-PORT-011` | Security Evidence Dashboard | BUILDING | machine-readable daily truth + promotion readiness |

> この表の `BUILDING` は完成を意味しない。`VERIFIED` は自動昇格しない。

## Daily Portfolio Loop

`Observe evidence -> Select smallest high-value gap -> Senju reframe/counterevidence -> White-Hat challenge -> bounded experiment -> remediation -> independent retest -> package -> re-measure -> Slack delta`

### Anti-stagnation

- 1回停滞: smallest missing Evidenceへ集中
- 2回停滞: Senjuが仮説を再構成しcounterevidenceを優先
- 3回停滞: 同じ実験を繰り返さず別Evidence path / Trackへローテーション

## White-Hat Candidate Rule

White-Hatの発見数は成果KPIにしない。

Portfolioへ価値を持つには、最低でも以下が必要。

- owned / explicitly authorized scope
- falsifiable hypothesis
- safe reproducible experiment
- counterevidence / falsifier
- smallest defensive remediation
- independent retest criterion
- residual risk
- buyer-readable impact

## Senju Rule

Senjuは次を改善する。

- hypothesis quality
- reproducibility
- counterevidence quality
- experiment efficiency
- selection robustness

Senju score単体はSecurity Evidenceではない。

## VERIFIED Gate

`VERIFIED`を名乗るには最低限:

- [ ] authorization basis
- [ ] human-inspectable artifact
- [ ] reproducible test / fixture
- [ ] before/after evidence where applicable
- [ ] independent retest
- [ ] counterevidence / falsifier
- [ ] limitations / residual risk
- [ ] rollback / recovery note
- [ ] no raw credentials or sensitive customer data

1つでも欠ける場合は `BUILDING` / `PROMOTION_READY` / `BLOCKED` のいずれかに留める。

## Reporting Contract

毎日のR&D Slack報告は次の7項目に固定する。

1. **WHAT CHANGED**
2. **WHY IT MATTERS**
3. **PORTFOLIO DELTA**
4. **WHITE-HAT**
5. **SENJU**
6. **TRUTH / LIMITATIONS**
7. **NEXT MOVE**

「何件研究した」「何文字生成した」「何体Agentが動いた」は、Portfolioが強くなった証明として扱わない。
