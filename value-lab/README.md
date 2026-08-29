# Real World Value Lab — R&D × Senju

## Mission

R&D decides **what uncertainty should be reduced**. Senju supplies **competition, mutation, robustness testing and champion selection** inside the closed simulator. The result returns to R&D as technical evidence or counterevidence.

```text
R&D research queue
  ↓ bounded focus only
Senju proposal
  ↓ R&D numeric adapter
multi-candidate Shadow league
  ↓ worst-case selection
unseen holdout
  ↓
technical evidence / counterevidence
  ↓
R&D next hypothesis
  ↓
MANAGER → TOMOKI → BOSS
  ↓ when customer proof exists
Proof Pack / market test / Revenue Bridge
```

## Separation of truth

Senju may prove that a strategy is safer, more stable, better balanced or more efficient in the simulator. It may **not** prove willingness to pay, urgency, market demand, a contract, a payment or revenue.

A high Senju score therefore never changes `real_revenue_yen`. Customer and payment evidence remain separate.

## Allowed R&D influence on Senju

R&D may send only:

- `research_id`
- `focus`: `robustness`, `learning`, `balance`, or `efficiency`
- bounded `candidate_count` (3–9)
- a research hypothesis

The adapter may only alter Senju's existing numeric simulator parameters. Targets, URLs, hosts, network scope, permissions, credentials, secrets, workflows and executable attack surfaces are outside the coupling contract.

## Daily cycle

- **07:20 JST** — `R&D x Senju Coupled Loop` reads the active research queue and latest Senju evidence, then emits a bounded directive and R&D evidence return.
- **07:30 JST** — Senju restores that directive, shapes its numeric proposal, runs a smoke test, compares multiple nearby strategies on five common seeds, and re-tests the preliminary champion on unseen holdout seeds.
- Only a safe and stable holdout winner can enter the existing state-only promotion path.
- The next R&D cycle reads the resulting technical evidence and counterevidence.

Normal research stays internal. Material customer value still follows the company route: `WORKER → MANAGER → TOMOKI triad → BOSS → CEO`.
