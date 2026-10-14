# Standment Security — Reporting Contract v2

**Status:** ACTIVE  
**Scope:** Standment Security Portfolio R&D / THE WORLD / Senju collaboration  
**Purpose:** Make Slack reports explain what actually changed, what evidence exists, why it matters, and what happens next.

## Core Rule

A report is not an activity log.

Do **not** report:
- agent count,
- prompt changes,
- code volume,
- generic “improved” claims,
- architecture diagrams alone,
- unchanged BUILDING status,
- raw workflow logs,
- repeated copies of the same fact.

Report a material **delta**.

## Mandatory Delta Fields

Every material report must contain these fields in this order:

1. **何が変わった？**
   - exact Before -> After state
2. **実物は何？**
   - artifact / report / workflow / evidence reference
3. **検証結果**
   - PASS / FAIL, run ID, commit SHA, artifact/evidence ID where available
4. **何に使える？**
   - customer / operator / business usefulness in plain Japanese
5. **前回との違い**
   - measurable/material difference, not generic progress
6. **失敗・反証**
   - failed test, counterevidence, limitation, or `NONE` only when genuinely none exists
7. **現在ステータス**
   - VERIFIED / BUILDING / EXPERIMENT / BLOCKED
8. **次に自動でやること**
   - exactly one next experiment/improvement
9. **Owner action**
   - NONE or exactly one owner-only action

## Slack Channel Routing

### R&D / Security Society
Channel: `C0BTFSCDDE1`

Post:
- new research result that changes the chosen tactic,
- workflow failure or recovery,
- evidence completeness materially changes,
- reproducibility changes,
- counterevidence invalidates a hypothesis,
- blocker introduced or removed,
- new Security Portfolio artifact,
- one daily digest.

Do not post routine no-change runs.

### Portfolio
Channel: `C0BTJ38SNNA`

Post only when:
- a genuinely new human-inspectable artifact exists, or
- an existing artifact materially advances status/evidence.

Never promote source code, prompts, architecture-only work, or self-reported success directly to Portfolio.

### TOMOKI Audit
Channel: `C0BTHN9QXCN`

Post:
- material failure,
- recurrence,
- contradiction,
- stale blocker,
- evidence regression,
- false-completion risk,
- verified autonomous repair of one of the above.

Group repeated failures by stable fingerprint.

### CEO Final Brief
Channel: `C0BTDEGU55Z`

Post only when:
- a major portfolio asset becomes VERIFIED,
- a serious blocker is removed,
- a material Security capability becomes customer-inspectable,
- a material regression threatens Standment delivery,
- owner action is genuinely required.

CEO receives business meaning, not worker logs.

## Failure Fingerprint

A repeated failure should be represented as one incident key where possible:

`repo + workflow + step + error_class`

First occurrence: report to R&D + TOMOKI.  
Recurrence: report only when count/severity materially changes.  
Recovery: explicitly emit `RECOVERED` with the first passing run evidence.

## Daily Digest

Exactly one digest per JST day after 09:00:

`STANDMENT SECURITY R&D DAILY｜YYYY-MM-DD`

Required content:
- today's primary bet,
- exact material change since previous digest,
- current artifact,
- current evidence,
- Senju research-process result,
- failure/counterevidence,
- status,
- blocker,
- next experiment,
- customer/business usefulness,
- Owner action.

## Status Discipline

**VERIFIED**  
Implementation + current verification evidence + human-inspectable artifact where claimed.

**BUILDING**  
Artifact exists, but runtime / integration / verification / delivery evidence remains.

**EXPERIMENT**  
Research/lab/prototype only.

**BLOCKED**  
A real external dependency prevents useful progress.

## Portfolio Promotion Gate

A report must not claim VERIFIED unless the relevant evidence supports, where applicable:
- owned or explicitly authorized scope,
- human-inspectable artifact,
- baseline evidence,
- verification evidence,
- counterevidence review,
- independent/clean-environment rerun,
- Before/After evidence for remediation work,
- explicit limitations,
- sensitive information removed,
- immutable evidence reference,
- understandable without reading source code.

## Doctrine

`OBSERVE -> DIFF -> VERIFY -> EXPLAIN VALUE -> ROUTE ONCE -> LEARN`

The reporting system exists to answer one question for the owner:

> **何が変わって、それで何が良くなったのか？**
