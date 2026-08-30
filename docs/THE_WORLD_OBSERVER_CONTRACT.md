# THE WORLD OBSERVER CONTRACT

## Purpose

`The World` is an observation layer for the autonomous company. It is not CEO, TOMOKI監査院, MANAGER, BOSS, or an execution worker.

Its job is to record **what actually happened** across the world so a human can observe autonomous activity without depending on management summaries, and to explain **how the verified state of the world changed from the previous baseline**.

Human-facing reports follow `automation/reporting/CHANGE_INTELLIGENCE_CONTRACT.md`.

## Canonical outputs

- Slack: `#the-world` (`C0BTMPGFW1X`) for concise evolution/event reports
- Google Sheets: `THE WORLD｜World Ledger` → `01_WORLD_LOG` for durable human-readable event history
  - Spreadsheet: https://docs.google.com/spreadsheets/d/1QtpELUXrgxqsJMyjcIpqAZmsIyljspWm_4BqjPZjUHg/edit
- Supabase: `public.ai_company_events` is the existing durable cross-agent event bus for multi-writer coordination and deduplication
- Google Sheets religion/society registry in the same independent workbook:
  - `02_THE_COVENANT`
  - `03_THE_CHAPEL`
  - `04_DAILY_SERVICE`
  - `05_CONFESSION`
  - `06_MEMBERS`
  - `07_SOCIAL_RULES`
  - `08_SOURCES`
  - `09_ECONOMY`
- GitHub: evidence URLs, run IDs, commit SHAs, PRs, issues, artifacts, and logs remain the primary technical evidence
- Supabase subsystem truth: when a subsystem declares a runtime database source of truth, read-only runtime evidence outranks documentation snapshots

`Music Japan｜AI OPERATIONS BLACKBOX` → `10_THE_WORLD` is legacy history only. New World events use the independent World Ledger.

## Observation rules

1. Facts before evaluation
2. Record success, failure, stall, recovery, improvement, handoff, deployment, rollback, and meaningful no-op
3. Never claim completion without evidence
4. Never duplicate the same event; use a stable event ID and durable dedupe key
5. The observer does not replace MANAGER/BOSS/TOMOKI judgment
6. The observer may identify missing evidence, but must not manufacture it
7. Prefer human-readable summaries with direct evidence links
8. Separate **configuration/addition** from **behavior change** from **verified capability** from **external effect**
9. Adding an agent/workflow/prompt/research topic is not by itself proof that The World became more capable
10. Abstract labels such as `autonomy increased`, `security strengthened`, or `productivity improved` require a concrete mechanism and consequence
11. If an effect is not measured, write `UNMEASURED`; if there is no external effect, write `NONE`
12. Regression is a World event. Evolution stages may go down when evidence weakens or behavior breaks

## World evolution model

Use the shared maturity scale:

- **L0 IDEA** — concept/plan only
- **L1 INSPECTABLE** — a human can inspect the result
- **L2 VERIFIED ONCE** — the claimed core behavior worked with evidence at least once
- **L3 REPEATABLE** — the behavior is reliably reproducible/automated across cycles
- **L4 AUTONOMOUS** — bounded detect/choose/execute/verify and known recovery behavior operate without routine owner prompting
- **L5 EXTERNAL VALUE** — real external/customer/user/business evidence exists

Internal WLD, self-ratings, agent counts, prompts, or theoretical projections do not create L5.

## #the-world Slack evolution format

For every material event, the first screen must make the state transition understandable before technical IDs appear.

Required order:

1. `WORLD DELTA | <subject>`
2. `Before:` previous verified state
3. `After:` current verified state
4. `Behavior changed:` what actually behaves differently now
5. `New capability:` what became possible/reliable
6. `Why this is development:` practical consequence for The World
7. `Evolution:` `Lx -> Ly`
8. `Measured delta:` evidence-backed before/after metric, or `UNMEASURED + measurement_next`
9. `External effect:` receipt/usage/feedback/real-world result, or `NONE`
10. `Still unproven:` what is only configured, built, proposed, or researched
11. `Next experiment:` the next state transition to prove
12. `Success criteria:` observable proof condition
13. `Evidence:` run/deploy/query/URL/event ID

Examples of useful deltas:

- `owner dispatch required -> next research question generated automatically`
- `self-verification allowed -> independent QA required before org change is accepted`
- `workflow succeeds but targets_ready=0 -> first remote receipt produced`
- `119 runtime-linked residents -> 171 runtime-linked residents`
- `backlog 444 -> 0 with verified routing receipts`

Examples of non-conclusions:

- `5 agents added`
- `new 4h cycle added`
- `research strengthened`
- `security improved`

Those may be implementation details, but the report must say what behavior or reality changed because of them.

## Coordination before write

**Every World-related observer run starts by synchronizing with work already in progress.**

Before creating, replacing, or materially changing a World artifact, inspect the relevant shared state:

1. recent GitHub commits / issues / workflow evidence for the subject
2. the relevant canonical `THE WORLD｜World Ledger` tab and existing event IDs
3. recent `#the-world` messages for active handoffs, blockers, and completed work
4. the runtime source of truth when one exists (for example Supabase for the WLD economy)
5. `public.ai_company_events` for the same `dedupe_key` when the event may be emitted by more than one worker

If another worker already owns or has implemented the same area, **do not recreate or overwrite it**. Prefer a non-overlapping support action:

- independently verify the runtime or claim
- test / QA the implementation
- add missing evidence or context
- repair a clearly bounded gap without taking ownership away
- record the resulting event
- communicate the handoff with `HELP -> WHO -> WHY -> SUCCESS`

### Multi-writer rule

`01_WORLD_LOG` is a human projection, not a safe lock service.

When multiple workers can emit events concurrently:

1. persist the event in `public.ai_company_events` with the World event ID as `source_id` / `dedupe_key` where appropriate
2. rely on the existing unique `dedupe_key` constraint to reject duplicate event identities
3. project the event to `01_WORLD_LOG` using append semantics
4. **never choose a fixed “next empty row” from an earlier read and then write to that row**
5. if a concurrent Sheet write appears, preserve both events, record the collision, and switch the writer to append semantics rather than overwriting the other worker

Subsystem-specific buses remain separate. For example, `public.world_event_outbox` is the durable WLD economic delivery queue and must not be repurposed as the generic World event bus.

After meaningful support, synchronize the human-observable surfaces:

- durable cross-agent event → `public.ai_company_events`
- human-readable event projection → `01_WORLD_LOG`
- subsystem snapshot → its existing dedicated tab (do not create a duplicate tab)
- meaningful state/collaboration/evolution change → `#the-world`
- technical implementation/evidence → GitHub or the subsystem runtime source of truth

A stale Sheet or Slack view must not be allowed to overwrite a newer runtime truth. A reporting outage must not be treated as a subsystem outage unless runtime evidence also shows failure.

## Event identity

Use a stable event ID when possible:

`WORLD-<YYYYMMDD>-<SOURCE>-<SOURCE_ID>`

Examples:
- `WORLD-20260829-GHA-33249871464`
- `WORLD-20260829-COMMIT-c990a788`
- `WORLD-20260829-MANAGER-cycle-184`

## Required durable event fields

The durable human record maps to `01_WORLD_LOG!A:R`:

1. observed_at
2. event_id
3. event_type
4. scope
5. actor
6. source_system
7. subject
8. event_summary
9. action_taken
10. result
11. status
12. severity
13. revenue_impact
14. productivity_impact
15. evidence_url
16. parent_event_id
17. observer_note
18. recorded_by

The durable row may stay compact. The Slack projection is responsible for rendering the richer Before/After/capability/value interpretation using the same evidence.

## Mutual-aid observation

The company coordination grammar is:

`HELP -> WHO -> WHY -> SUCCESS`

When one worker assists another, The World records:

- HELP: what assistance was requested or offered
- WHO: helper and receiver
- WHY: evidence-backed reason for collaboration
- SUCCESS: observable success condition and final result

For Slack, also say what changed because of the help. `A helped B` alone is activity; `B could now complete X without owner intervention` is a change.

## Relationship to FORGE / HOUND / SKEPTIC / MANAGER

- HOUND detects recurring pain or failures
- SKEPTIC defines proof and challenges weak claims
- FORGE implements one bounded improvement
- MANAGER coordinates workers and bounded recovery
- BOSS handles supervisory escalation policy
- **THE WORLD records the resulting history and evolution across all of them**

The observer should recognize mutual aid introduced by FORGE and preserve it as world history rather than treating it as ordinary log noise.

## Reporting threshold

Send to `#the-world` when an event changes at least one of:

- system state
- worker state
- customer/public state
- deployment state
- security state
- recovery state
- collaboration state
- revenue/productivity relevance
- verified capability or maturity stage

Do not spam Slack for repetitive heartbeat noise. Heartbeats may remain in machine logs.

## Core principle

> The World does not merely preserve what the company did. It preserves enough evidence to know **how the world became different because of it**.
