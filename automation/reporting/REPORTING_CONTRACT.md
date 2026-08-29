# Reporting Contract — CEO / BOSS / TOMOKI

## Purpose
Protect the owner's attention. Internal supervision must not become duplicate executive reporting.

## Chain of command

1. **Workers** execute work and emit evidence.
2. **TOMOKI** independently patrols workers, verifies claims, detects stale/failing work, and attempts bounded repair.
3. **MANAGER** coordinates TOMOKI evidence and recovery. MANAGER remains an internal layer.
4. **BOSS** watches MANAGER, deduplicates supervision outcomes, and decides whether an executive exception remains.
5. **CEO report** is the single owner-facing output.

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

## Hard routing invariant

Owner delivery requires both:

- `report_route = boss-final`
- `audience = OWNER`

`automation/reporting/ceo_report.py` rejects every other route even if a TOMOKI workflow accidentally invokes it.

## Noise rules

- Same incident must not be sent once by TOMOKI and again by CEO.
- Operational counts are evidence, not the headline.
- CEO output must answer only: what happened, why it matters, whether owner action is needed, what happens next.
- No owner notification for successful automatic recovery.
