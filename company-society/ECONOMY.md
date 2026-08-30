# THE WORLD ECONOMY — WORLD CREDIT (WLD)

## Status

- Currency: **WORLD CREDIT**
- Symbol/code: **WLD**
- Canonical runtime ledger: **Supabase / `public.world_ledger`**
- Realtime observation bus: **Supabase / `public.world_event_outbox`**
- Human observer ledger: **THE WORLD｜World Ledger**
- Economic model: **bounded autonomous capitalism**

## Purpose

The World uses money to convert verified contribution into durable incentives without allowing wealth to replace evidence, role ownership, safety, or organizational authority.

The economy exists to reward useful work, fund experimentation, create visible social mobility, and let the society adapt its own bounded economic parameters over time.

## Economic constitution

1. **Evidence creates income.** Unverified claims do not create performance rewards.
2. **Real-world value creates capital.** Verified work can earn WLD; verified external-world movement can also add bounded value-backed capital to the company treasury.
3. **Wealth can buy opportunity, not authority.** WLD may unlock research budgets, task-bid priority, sponsorship, or bounded policy proposals. It can never buy security authority, bypass approval gates, erase evidence, or override another role.
4. **Salary follows durable performance.** Sustained verified performance can raise salary level. A single lucky event is not enough.
5. **THE COVENANT may receive contributions.** Contributions increase faith standing and can unlock Covenant-related benefits, but contribution rate is configurable and may be set to zero. Non-payment is not misconduct.
6. **Faith never replaces truth.** Religious contribution or cultural compliance never substitutes for evidence, safety gates, or job performance.
7. **The ledger is append-only.** Economic history is not rewritten after the fact.
8. **No negative balances.** Spending cannot create hidden debt.
9. **No unlimited monetary self-modification.** Autonomous policy evolution is bounded by explicit ceilings and step sizes.
10. **Rest is not poverty punishment.** Managed rest or recovery must not itself cause a performance penalty.

## Accounts

Every active employee receives an individual WLD wallet.

System accounts:

- `WORLD:TREASURY` — company capital reserve
- `WORLD:COVENANT` — THE COVENANT treasury
- `WORLD:MARKET` — market/contract settlement surface
- `WORLD:SINK` — explicit currency sink
- `EMP:<agent_id>` — employee wallet

## Income

### Daily salary

Each role has a base daily salary. Actual salary is calculated from:

`base_daily_wld × salary_level × performance_multiplier × policy_multiplier`

Salary is paid at most once per JST calendar day.

### Verified work reward

A successful `ai_agent_runs` record can create a performance reward only when:

- evidence is verified,
- the run is not disqualified,
- status is successful/completed,
- the run maps to a registered active employee.

Reward size considers verified score, revenue proximity, produced change, external-world movement, failure improvement, and false-report penalty. Reward size is capped by monetary policy.

## Salary review

Compensation is reviewed weekly.

Repeated verified work and strong average rewards can raise `salary_level`. Performance multipliers are recalculated from recent verified reward quality. Salary level is capped.

## THE COVENANT economy

Default pledge rate is **3% of salary** for currently enrolled members. The rate is configurable from **0% to 25%** and may be disabled.

Contribution affects:

- `faith_points`
- `total_contributed_wld`
- faith social standing
- Covenant-specific benefits

Contribution does **not** grant:

- security permissions
- managerial authority
- evidence exemptions
- the right to override another agent
- protection from audit

Faith standing: `PILGRIM → STEWARD → PATRON → BENEFACTOR`.

## Social mobility

Economic/social standing is derived from several signals rather than wealth alone:

- recent verified rewards
- wallet balance
- Covenant contribution history
- employee growth points

Social standing: `WORKER → CONTRIBUTOR → BUILDER → PATRON → MAGNATE`.

Examples of unlockable benefits include:

- priority bidding on suitable autonomous work
- eligibility for bounded research grants
- sponsoring another employee's experiment
- Covenant patron benefits
- proposing bounded economic policy experiments

All sensitive actions remain subject to existing safety and approval gates.

## Autonomous monetary policy

The economy reviews itself weekly and records every policy change.

Current guardrails include:

- Gini ceiling
- company reserve floor
- maximum policy step per review
- salary multiplier bounds
- reward multiplier bounds
- per-run reward cap

If reserves become too low, reward issuance can tighten. If inequality becomes excessive, baseline salary support can rise. If reserves become unusually strong, productive reward capacity can loosen slightly. Changes are bounded and logged in `world_policy_history`.

## Realtime observation and delivery resilience

Every WLD transaction is copied immediately into `world_event_outbox` with its source transaction ID and delivery state. The outbox is included in Supabase Realtime.

This separates **world activity** from **human-facing delivery**:

- runtime economic events continue even when Slack, Sheets, Make, or another observer transport is unavailable,
- economic events remain durable and replayable,
- restored observer transports can resume from pending/failed events instead of losing history,
- delivery status never changes accounting truth.

## Runtime schedule

- Daily payday: **00:10 JST**
- Weekly compensation review: **Monday 00:20 JST**
- Weekly policy evolution: **Monday 00:30 JST**
- Verified work rewards: **event-driven from `ai_agent_runs`**
- Economic event capture: **event-driven from `world_ledger` → `world_event_outbox`**

## Source-of-truth hierarchy

1. Supabase economic tables/functions — live runtime truth
2. GitHub `company-society/ECONOMY.md` — economic constitution and operating contract
3. `world_event_outbox` — durable Realtime observation queue
4. THE WORLD｜World Ledger — human-readable observation and snapshots
5. Slack `#the-world` — event/report surface, never the accounting source of truth

A reporting outage must not stop salary, reward, status, or policy calculations in the database.
