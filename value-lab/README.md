# Real World Value Lab

## Mission

The World is the internal factory. It is **not** the customer product.

Real World Value Lab reuses the existing company stack to turn research, simulations, data analysis, coding and agent competition into customer-facing value that can survive external validation.

The lab must optimize for one question:

> Would a real buyer pay for the problem to disappear, and do we have evidence?

Internal sophistication, agent count, code volume, dashboards, roleplay, prompts, or autonomous activity are not market validation.

## Existing resources reused

- **Senju** — competition, ranking, champion selection, mutation/improvement, failure memory
- **Supabase control plane** — `ai_missions`, `ai_competitions`, `ai_competition_entries`, `ai_agent_runs`, `ai_tasks`
- **The World economy** — WLD / WORLD CREDIT, employee wallets, append-only ledger, verified-work rewards
- **MANAGER** — first governance gate, repair/reassignment and operational ownership
- **TOMOKI triad** — SKEPTIC / HOUND / FORGE independent review
- **BOSS** — final owner-report gate and market-test authorization layer
- **BLACKBOX** — material work, decisions, failures, handoffs and changes
- **CEO Reporting** — material deltas only, translated into ordinary Japanese
- existing products/systems such as Revenue Recovery, Integration OS, Baton and the defensive Security Platform as reusable components, not automatically sellable products

## Canonical lifecycle

```text
DISCOVERY
   ↓ evidence + counterevidence
MANAGER_REVIEW
   ↓ approved
EXPERIMENTING
   ↓ working customer-facing artifact
DEMO_READY
   ↓
TOMOKI_REVIEW
   ├─ SKEPTIC: challenge claims / evidence
   ├─ HOUND: recurrence / stale / hidden failure
   └─ FORGE: bounded improvement or not-required
   ↓ all clear
BOSS_REVIEW
   ↓ approved
MARKET_TEST
   ↓ real external validation
VALIDATED
```

A failed gate sends the project backward or rejects it. No stage may be skipped by adding more AI prose.

## Database contract

The live implementation is in Supabase:

- `ai_governed_items` — universal governance registry for material systems, products, research, experiments, artifacts, workflows, policies and data models
- `ai_governance_events` — append-only governance decisions/evidence
- `ai_value_projects` — real-world value candidates and lifecycle
- `ai_value_stage_events` — append-only lifecycle transitions, including WLD reward transaction refs

Existing tables remain canonical for execution:

- `ai_missions`
- `ai_competitions`
- `ai_competition_entries`
- `ai_agent_runs`
- `ai_tasks`

## Universal governance rule

From this system onward, every **material** new system, product, research program, experiment, customer-facing artifact, workflow, policy or data model must be registered in `ai_governed_items`.

Unregistered material work is a governance error. The Manager must repair the gap before the item can be reported as complete or promoted.

No worker may self-approve its own governance gate.

## Competition contract

A Value Lab competition compares at most three candidates at once. Use the existing Senju principle: compete, preserve evidence, retain the winner, kill or mutate weak candidates.

The business-value score is weighted toward willingness to pay, urgency, measurable customer outcome, delivery feasibility, recurring potential, differentiation, proof strength, low owner effort and low safety/compliance risk.

Counterevidence is mandatory. A candidate that never tried to disprove itself is disqualified from becoming champion.

`controller.py` provides deterministic scoring/gating helpers. `policy.json` is the machine-readable policy.

## WLD economy integration

WLD stays an internal incentive currency. It never becomes evidence that customers care.

Existing `world_reward_run()` continues to reward verified `ai_agent_runs`.

Value Lab adds bounded milestone rewards only for verified runs associated with real-value stage progression:

- `demo_ready` → 20 WLD
- `market_test` → 40 WLD
- `validated` → 100 WLD

The database transition function checks that the source run is evidence-verified, successful and not disqualified before a stage reward can move from `WORLD:TREASURY` to the lead employee wallet.

So: **research activity does not mint prestige by itself; verified progression does.**

## CEO reporting

Normal research stays silent.

CEO reporting is allowed for a genuinely demo-ready deliverable, a material candidate killed with useful evidence, market-test readiness, material external evidence, validation, or an owner-only blocker.

Mandatory route:

`WORKER → MANAGER → TOMOKI triad → BOSS → CEO`

CEO reports must answer in ordinary Japanese: what changed, whose problem it solves, why they may pay, current evidence, what remains unproven, the next external test, and Owner action: NONE or exactly one action.

## Safety boundary

The Lab may reuse defensive security engineering and isolated simulations, but offensive security capability is not a default commercial path. Customer-facing security candidates should favor hardening, monitoring, configuration review, backup/recovery evidence, secure delivery and operational reporting.

## Success

Success is evidence that a real buyer has the problem and willingness to pay, a testable customer-facing deliverable, a repeatable delivery process with measurable benefit, verified external progress, or a weak idea killed early with a reusable reason.

Everything else is intermediate work.
