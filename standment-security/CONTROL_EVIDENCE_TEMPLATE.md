# Standment Security — Control Evidence Pack v1

**Status:** TEMPLATE READY  
**Purpose:** Turn authorized defensive security work into reproducible, customer-inspectable evidence instead of source-code-only claims.

> This pack is for systems owned by Standment or systems for which explicit authorization exists. Never include secrets, credentials, exploit payloads, third-party targets, or unnecessary personal data.

## 1. Executive Finding

- **Finding ID:**
- **Control / area:**
- **Observed state:**
- **Risk statement:**
- **Severity:** Informational / Low / Medium / High / Critical
- **Decision:** KEEP / REMEDIATE / REVERT / BLOCKED
- **Verified at (UTC):**

## 2. Scope & Authorization

- **System / component:**
- **Environment:**
- **Authorization owner:**
- **Authorized scope:**
- **Explicit exclusions:**
- **Test window:**

Do not proceed if ownership or authorization cannot be established.

## 3. Baseline Evidence

Describe the state before the change.

- Configuration / control state:
- Relevant version / commit:
- Reproduction command or procedure:
- Expected result:
- Actual result:
- Evidence artifact(s):
- Artifact hash(es):

## 4. Test Method

Keep the method bounded and reproducible.

1. Preconditions
2. Defensive test procedure
3. Success / failure criteria
4. Safety limits
5. Stop conditions

## 5. Observed Evidence

Record what was actually observed, not what was expected.

- Logs / screenshots / reports:
- Measured result:
- Timestamp:
- Runner / workflow ID:
- Commit SHA:
- Integrity hash:

## 6. Counterevidence & Alternative Explanations

A portfolio result is incomplete until an attempt has been made to disprove it.

- What evidence would falsify the finding?
- What alternate cause could explain the result?
- Was an independent rerun performed?
- Did any rerun disagree with the original result?
- What remains uncertain?

## 7. Risk & Impact

- Affected security objective: Confidentiality / Integrity / Availability / Accountability
- Preconditions required for impact:
- Likely operational impact:
- Customer-facing explanation:
- Assumptions:

Avoid inflated severity. State environmental dependencies explicitly.

## 8. Remediation

- Proposed defensive change:
- Owner:
- Change boundary:
- Expected effect:
- Possible regression:
- Rollback procedure:

## 9. Retest / Before → After

| Check | Before | After | Result |
|---|---|---|---|
| Primary control |  |  | PASS / FAIL |
| Regression check |  |  | PASS / FAIL |
| Independent rerun |  |  | PASS / FAIL |

Attach the same type of evidence before and after whenever possible.

## 10. Reproducibility

- Clean-environment replay possible: YES / NO
- Independent runner replayed: YES / NO
- Required dependencies pinned: YES / NO
- Exact command / workflow reference:
- Known nondeterminism:

## 11. Limitations

List what this evidence **does not** prove.

Examples:
- Technical verification does not prove buyer demand or commercial traction.
- A passing control check does not prove the entire system is secure.
- Evidence from one environment may not generalize to another.

## 12. Evidence Manifest

| Artifact | Purpose | SHA-256 / immutable reference | Captured at |
|---|---|---|---|
|  |  |  |  |

## 13. Portfolio Promotion Gate

Promote to `#portfolio` only when all required boxes are checked.

- [ ] Authorized / owned scope documented
- [ ] Human-inspectable artifact exists
- [ ] Baseline evidence exists
- [ ] Verification evidence exists
- [ ] Counterevidence / alternative explanation reviewed
- [ ] Independent or clean-environment rerun completed where practical
- [ ] Before/after evidence recorded for remediation work
- [ ] Limitations are explicit
- [ ] Secrets / credentials / sensitive data are removed
- [ ] Artifact integrity reference is preserved
- [ ] Result can be understood without reading source code

If any required evidence is missing, keep the item in R&D / BUILDING rather than presenting it as a verified portfolio result.
