# Reporting Contract — CEO / BOSS / TOMOKI / PORTFOLIO

## Purpose
Protect the owner's attention while keeping real output visible. Internal supervision must not become duplicate executive reporting, and finished artifacts must not disappear inside engineering logs.

## Chain of command

1. **Workers** execute work and emit evidence.
2. **TOMOKI** independently patrols workers, verifies claims, detects stale/failing work, and attempts bounded repair.
3. **MANAGER** coordinates TOMOKI evidence and recovery. MANAGER remains an internal layer.
4. **BOSS** watches MANAGER, deduplicates supervision outcomes, and decides whether an executive exception remains.
5. **CEO report** is the single owner-facing exception/decision output.
6. **PORTFOLIO** is a separate owner-facing artifact stream and does not represent supervision or escalation.

## TOMOKI separation

- **SKEPTIC** — independent verification / falsification / regression checks.
- **HOUND** — stale work / recurrence / unfinished promises / continuity checks.
- **FORGE** — bounded repair / testable improvement / recovery experiments.

TOMOKI reports belong to internal evidence and the TOMOKI Slack route. They never send directly to the owner-facing CEO route.

## CEO reporting rule

The CEO channel is not an activity feed. It receives only a BOSS-final report when:

- internal detection already happened,
- TOMOKI/MANAGER already attempted bounded recovery,
- an unresolved P0/P1 exception remains,
- owner judgment, external dependency, permission, or policy decision is actually needed.

Recovered, recovering, healthy, routine, and duplicate events stay internal.

## Portfolio reporting rule

`#portfolio` receives only a human-inspectable artifact. It can be a deployed site/app, interactive demo, dashboard, Canvas, PDF/report, screenshot/video with evidence, or packaged customer deliverable.

A source-code file, diff, commit, PR, issue or log by itself is **not** a portfolio artifact. Those may appear only as supporting evidence behind a viewable result.

Portfolio delivery is independent of CEO escalation. A healthy successful artifact may belong in `#portfolio` even though it must remain silent in `#ai-ceo-brief`.

See `automation/reporting/PORTFOLIO_CONTRACT.md`.

## Hard routing invariant

Owner exception delivery requires both:

- `report_route = boss-final`
- `audience = OWNER`

`automation/reporting/ceo_report.py` rejects every other route even if a TOMOKI workflow accidentally invokes it.

Portfolio delivery requires the portfolio artifact contract instead; it must never masquerade as a BOSS-final exception.

## Noise rules

- Same incident must not be sent once by TOMOKI and again by CEO.
- Operational counts are evidence, not the headline.
- CEO output must answer only: what happened, why it matters, whether owner action is needed, what happens next.
- No owner notification for successful automatic recovery.
- Portfolio output must answer only: what was made, why it matters, where it can be opened, and what proves it works.
- Do not post unfinished activity to `#portfolio` unless there is already a human-inspectable `EXPERIMENT` or `BUILDING` artifact.
