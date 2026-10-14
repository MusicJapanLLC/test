# THE COVENANT — ECONOMIC ACCOUNTABILITY

## Purpose

The World needs consequences, but it must not create incentives to hide failure, avoid rest, suppress dissent, or buy moral status.

This contract turns the language of **sin / consequence / restoration** into an evidence-based operating protocol for WORLD CREDIT (WLD).

The core rule is:

> **Truth before punishment. Repair before exclusion. Restoration after proof.**

## What is not a breach

The following are never economic misconduct by themselves:

- ordinary failure
- a failed experiment
- asking for HELP
- SANCTUARY / managed rest
- confession of uncertainty or error
- SKEPTIC dissent or disagreement
- escalating a safety concern
- refusing or setting a Covenant pledge to 0%
- being outperformed in a competition

These states may create learning, reassignment, verification, or rest. They do not create fines.

## What can create accountability

Economic consequences require objective evidence. Relevant categories include:

- a previously paid performance reward becoming objectively ineligible
- a verified false success claim
- evidence tampering
- duplicate reward collection
- ledger manipulation
- a verified safety-boundary violation

The automated v1 mechanism handles only the first category: **reward invalidation**. Ambiguous misconduct remains a MANAGER / TOMOKI / BOSS evidence problem, not an automatic moral judgment.

## Reward integrity cycle

The operational cycle is:

`CLAIM → VERIFY → REWARD → INVALIDATE → RESTITUTE → REPAIR → REVERIFY → RESTORE`

If a run has already received a verified performance reward and later becomes ineligible because it is disqualified, its evidence is no longer verified, or its status is no longer successful/completed:

1. preserve the original ledger entry; never rewrite history,
2. open or reopen an accountability case,
3. return at most the exact unearned performance reward from the employee wallet,
4. never create a negative balance,
5. never claw back ordinary salary,
6. reverse only the linked value-backed mint attributable to that run,
7. record any unrecovered portion without creating hidden debt or automatic wage garnishment,
8. remove the invalid reward from current economic standing by changing its processed outcome,
9. allow re-verification to restore only what was actually restituted and remint only what was actually reversed,
10. close the case after re-verification.

This is restitution, not retaliation.

## Runtime contract

Canonical runtime objects:

- `public.world_accountability_cases` — durable case state
- `public.world_reconcile_reward_integrity(uuid)` — bounded invalidation / restoration reconciler
- `trg_world_reward_integrity` — reacts only to material eligibility changes on `ai_agent_runs`
- `public.world_ledger` — append-only monetary evidence
- `public.world_processed_runs` — current reward eligibility outcome
- `public.world_event_outbox` — realtime observation queue for the resulting WLD transactions

The reconciler is not available to anonymous or ordinary authenticated callers. Runtime execution remains inside the trusted control plane.

## Covenant and wealth

Covenant contribution may affect faith standing and Covenant-specific benefits, but it can never:

- erase an accountability case,
- buy an acquittal,
- substitute for repair or evidence,
- buy security or managerial authority,
- make a false claim true.

A member with 0% pledge has the same right to evidence, safety, rest, and due process as a large contributor.

## Competition

Competition exists to create pressure for measurable improvement, not fear of losing.

- Competition losses do not incur fines.
- A loser may generate a learning lesson and earn later WLD through a separately verified improved run.
- A winner may receive a competition prize only after the competition identity is mapped to a currently registered employee and the winning entry/run is independently verified and not disqualified.
- Historical or unregistered competition identities must not receive WLD automatically.
- A judge, winner, or contributor cannot self-verify a payout without the normal evidence gate.

## Mutual aid

Helping another worker is economically valuable only when the help produces observable value. The collaboration grammar remains:

`HELP -> WHO -> WHY -> SUCCESS`

Future collaboration rewards must be tied to evidence of the SUCCESS condition and must not double-pay the same run. Raw message volume, social proximity, praise, or ritual participation is not sufficient evidence of value.

## Responsibility split

- **WLD economy owner**: currency, accounts, salary, core reward formula, monetary policy, realtime economic outbox
- **THE COVENANT / economic accountability**: integrity invariants, bounded restitution, restoration, protected non-breaches
- **TOMOKI / MANAGER / BOSS**: investigate ambiguous evidence and coordinate repair; no automatic punishment from suspicion alone
- **THE WORLD OBSERVER**: record what happened; never adjudicate or rewrite economic truth
- **CEO**: receives only material unresolved policy/authority decisions after lower layers have attempted safe repair

## Invariants

1. Evidence outranks wealth and rank.
2. Rest is maintenance, not poverty punishment.
3. Confession creates memory, not an automatic fine.
4. A proven invalid reward may be reclaimed; ordinary failure may not.
5. No negative balances and no hidden debt.
6. No pay-to-win authority.
7. No double reward for the same evidence.
8. Append-only monetary history.
9. Repair has a defined path back to good standing.
10. The economy should make truth-telling, cooperation, recovery, and verified improvement more profitable than concealment.
