# Revenue Recovery AI — Experiment Log

## Experiment 001 — 2026-08-29

**Hypothesis**
A generic sales dashboard is not valuable enough. A daily revenue-recovery queue that ranks stale opportunities and prepares the next action should be materially closer to willingness-to-pay.

**Change**
- Replaced generic CRM-first home screen with a recovery queue.
- Added deterministic recovery scoring using stage, inactivity, overdue follow-up, deal value, missing next action, and prior recovery outcomes.
- Added AI recovery scan for the top 5 active opportunities.
- AI produces a concrete next action and short Japanese follow-up draft.
- Added outcomes: contacted / revived / lost / snoozed.
- Successful recovery drafts are stored and fed into future AI scans.
- Prior outcome recovery rate influences later stage scoring after sufficient examples.
- External Gmail/Calendar event ingestion now updates last-contact time when an existing company is reliably matched.
- Added metrics for today’s recoverable pipeline, high-risk opportunities, revived pipeline, and learning count.

**Verification**
- AppDeploy deployment status: ready.
- Frontend runtime errors: 0.
- Backend runtime errors: 0.
- Network QA errors: 0.
- Desktop and mobile QA snapshots generated.
- Full interactive e2e suite was not executed by AppDeploy in this deployment (`e2e_tests` was null), so do not treat test definitions as executed proof.

**Decision**
KEEP.

**Why**
The product now performs a revenue action workflow instead of merely displaying sales data. The next experiments should optimize activation, data import, trigger quality, recovery accuracy, and proof of ROI rather than add dashboard features.

**Known blocker**
Make organization/team remains quota-paused, so real Gmail/Calendar → app ingestion is not currently executing. Do not repeatedly retry it until capacity is restored.
