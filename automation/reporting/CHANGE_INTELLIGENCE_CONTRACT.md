# Change Intelligence Reporting Contract v2

## Purpose
Reports exist to explain **state change**, not activity volume. Every owner-visible or portfolio-visible report must make it possible to answer, in under 30 seconds:

1. What was true before?
2. What is true now?
3. What new capability exists because of the change?
4. What became easier, faster, safer, cheaper, more reliable, more valuable, or closer to revenue?
5. What evidence proves the change?
6. What measurable condition would count as the next evolution?

A list of commits, agents, workflows, tasks, messages, meetings, or research topics is evidence/context only. It is never the main conclusion.

## Mandatory delta block
Every material report must contain the following semantic fields. Producers may use JSON keys or human-readable headings, but the meaning must be preserved.

- `before_state` — last verified baseline, not a vague historical description.
- `after_state` — current verified state after the work.
- `change_summary` — one sentence describing the transition: `BEFORE -> AFTER`.
- `capability_gain` — what the system/person can now do that it could not reliably do before.
- `owner_benefit` — what changes for the owner/operator/customer in practical terms.
- `business_effect` — effect on revenue distance, cost, cycle time, quality, risk, reliability, decision speed, customer value, or product readiness.
- `evolution_stage_before` / `evolution_stage_after` — maturity stage 0-5.
- `metrics` — measured before/after deltas when evidence exists.
- `measurement_next` — if a useful metric is not yet available, write `UNMEASURED` and state exactly what will be measured next. Never invent a number.
- `proof` / `evidence` — URL, run, deploy, query, receipt, test, readback, or other verification.
- `next_target` — the next state transition, not merely the next task.
- `success_criteria` — observable condition that proves the next target was achieved.

## Evolution scale
Use the same scale across CEO, TOMOKI, THE WORLD, and PORTFOLIO.

- **L0 — IDEA:** concept/plan only.
- **L1 — INSPECTABLE:** human can open or inspect an artifact/result.
- **L2 — VERIFIED ONCE:** core behavior has been demonstrated with evidence at least once.
- **L3 — REPEATABLE:** behavior is automated or reliably reproducible across cycles.
- **L4 — AUTONOMOUS:** system can detect/choose/execute/verify bounded work with little or no owner prompting and can handle known failure paths.
- **L5 — EXTERNAL VALUE:** real external/customer/user/business evidence exists (usage, validated feedback, meeting/order/revenue, externally verified outcome, or equivalent).

Stages may move down when regression is detected. A downgrade is a valid and important report.

## Metric rules
Prefer deltas that explain consequences, for example:

- manual owner actions: `3 -> 1`
- queue backlog: `444 -> 120`
- recovery time: `60m -> 18m`
- verified artifacts: `2 -> 4`
- external receipts: `0 -> 1`
- runtime-linked residents: `119 -> 171`
- failing security gates: `2 -> 0`
- revenue distance: `D5 -> D4`

Do not use invented precision. If the real value is unavailable, say `UNMEASURED` and specify the next measurement.

## Forbidden report patterns
Do not use these as the conclusion:

- `5 agents added`
- `3 workflows created`
- `research completed`
- `productivity improved`
- `security strengthened`
- `autonomy increased`
- `portfolio improved`

They are acceptable only when followed by the concrete state change and evidence. Example: `5 agents added` is not enough; `the system can now independently falsify, repair, and re-check one candidate per cycle without owner dispatch; 3 consecutive cycles verified` is a reportable change.

## Role-specific owner views

### CEO — company evolution, not engineering diary
CEO reports must lead with the **company-level delta** and owner consequence.

Required order:
1. **結論 / Company delta** — one sentence `Before -> After`.
2. **何が変わった** — max 3 material transitions.
3. **新しく可能になったこと** — capabilities now available.
4. **経営メリット** — concrete benefit and measured delta; use `UNMEASURED` when needed.
5. **Portfolio movement** — only artifacts whose maturity/value stage changed.
6. **残るリスク / regression** — what is still not true.
7. **Owner decision** — only if truly required.
8. **Next evolution + success criteria**.
9. **Evidence**.

CEO must not copy TOMOKI internals or raw worker logs.

### TOMOKI — repair and reliability delta
TOMOKI reports must explain what supervision actually changed.

Required order:
1. **監査結論**.
2. **Before -> After** for the broken/uncertain state.
3. **Diagnosed vs actually changed** — keep diagnosis, proposal, temporary bootstrap, production repair, and verification separate.
4. **Reliability/autonomy gain** — what intervention is no longer needed or what failure can now be detected/recovered.
5. **Regression risk / recurrence fingerprint**.
6. **Measured delta**.
7. **Next verification target + success criteria**.
8. Technical evidence/run IDs last.

Do not make SKEPTIC/HOUND/FORGE status labels the headline unless their disagreement itself changes the decision.

### THE WORLD — evolution history, not feature inventory
THE WORLD reports must distinguish `something was added` from `the world actually became able to do something`.

Required order:
1. **World delta** — verified behavior/state transition.
2. **Before -> After**.
3. **What behavior actually changed** — not configuration only.
4. **Why the world is more capable / coherent / autonomous**.
5. **External reality effect** — receipts, usage, feedback, or `NONE/UNMEASURED`.
6. **Evolution stage movement**.
7. **What is still only research/configuration and has not yet changed reality**.
8. **Next experiment + success criteria**.
9. Evidence last.

### PORTFOLIO — artifact evolution and value
Portfolio reports must make the artifact's progression obvious without reading engineering details.

Required order:
1. **Artifact + open URL**.
2. **Evolution:** `Lx -> Ly`.
3. **Before**.
4. **After**.
5. **New capability**.
6. **Owner/user benefit**.
7. **Business effect**.
8. **Measured delta** or `UNMEASURED + measurement_next`.
9. **Why it matters**.
10. **Next target + success criteria**.
11. **Proof**.

`What changed` must describe a meaningful before/after transition, not a list of files or implementation steps.

## Compression rule
Detail is welcome, but the first screen must contain the answer. Put IDs, commits, queries, worker statuses, and logs after the human-readable delta.

The reporting system succeeds when the owner can read only the first 8-12 lines and understand **how the company/world/artifact is different from the previous verified state**.
