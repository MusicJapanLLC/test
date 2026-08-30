# Reporting Contract — CEO / BOSS / TOMOKI / THE WORLD / PORTFOLIO

## Purpose
Protect the owner's attention while keeping real output visible. Reports must explain **how reality changed**, not merely list activity.

The shared source of truth is `automation/reporting/CHANGE_INTELLIGENCE_CONTRACT.md`.

Every material report must answer, in human language:

1. **Before** — what was true at the last verified baseline?
2. **After** — what is verified now?
3. **New capability** — what can now be done that could not be done reliably before?
4. **Benefit** — what became easier/faster/safer/cheaper/more reliable/more valuable or closer to revenue?
5. **Evidence** — what proves the change?
6. **Next evolution** — what measurable state transition comes next?

If a useful metric is unavailable, say `UNMEASURED` and define the next measurement. Never invent a number.

## Chain of command

1. **Workers** execute work and emit evidence.
2. **TOMOKI** independently patrols workers, verifies claims, detects stale/failing work, and attempts bounded repair.
3. **MANAGER** coordinates TOMOKI evidence and recovery. MANAGER remains an internal layer.
4. **BOSS** watches MANAGER, deduplicates supervision outcomes, and decides whether an executive exception remains.
5. **CEO report** is the owner-facing company-evolution / exception / decision output.
6. **THE WORLD** is the evidence-backed history of how the autonomous world actually changed.
7. **PORTFOLIO** is the owner-facing artifact evolution stream and does not represent supervision or escalation.

## TOMOKI separation

- **SKEPTIC** — independent verification / falsification / regression checks.
- **HOUND** — stale work / recurrence / unfinished promises / continuity checks.
- **FORGE** — bounded repair / testable improvement / recovery experiments.

TOMOKI reports belong to internal evidence and the TOMOKI Slack route. They must not be copied verbatim into CEO reporting.

TOMOKI's headline is not `SKEPTIC=PASS / HOUND=WATCH / FORGE=SUCCESS`. The headline is the verified reliability delta: **what was broken/uncertain before, what is true now, and what intervention is no longer necessary or what failure is now recoverable.**

## CEO reporting rule

The CEO channel is not an activity feed or engineering diary. It receives:

- a BOSS-final exception/decision report when owner judgment is truly required; or
- a material verified company-level evolution whose consequence is meaningful to the owner.

The first screen of every CEO report must contain:

- `Company delta: BEFORE -> AFTER`
- up to 3 material changes
- new capabilities now available
- concrete owner/business benefit
- measured delta, or `UNMEASURED + measurement_next`
- portfolio maturity movements, if any
- what is still not true / residual risk
- owner action (`NONE` when none)
- next evolution + observable success criteria

Raw run IDs, counts and worker statuses are supporting evidence and belong at the bottom.

## THE WORLD reporting rule

`#the-world` is a world-history/evolution stream, not a feature inventory.

A World report must distinguish:

- **configuration/addition** — agent/workflow/prompt/research was added;
- **behavior change** — the world actually began doing something differently;
- **verified capability** — the changed behavior worked with evidence;
- **external reality effect** — an external receipt, user/customer signal or other real-world evidence exists.

Required headline: `World delta: BEFORE -> AFTER`.

Every material World report must include actual behavior change, capability gain, evolution stage movement, external effect (`NONE/UNMEASURED` is valid), what remains unproven, and the next experiment with success criteria.

## Portfolio reporting rule

`#portfolio` receives only a human-inspectable artifact. It can be a deployed site/app, interactive demo, dashboard, Canvas, PDF/report, screenshot/video with evidence, or packaged customer deliverable.

A source-code file, diff, commit, PR, issue or log by itself is **not** a portfolio artifact. Those may appear only as supporting evidence behind a viewable result.

Portfolio is an **evolution stream**, not merely a gallery. Each post must show:

- artifact + open URL
- maturity `L0-L5 before -> after`
- Before
- After
- New capability
- Owner/user benefit
- Business effect
- measured delta or `UNMEASURED + measurement_next`
- Why it matters
- Next target + success criteria
- Proof

See `automation/reporting/PORTFOLIO_CONTRACT.md` and `automation/reporting/CHANGE_INTELLIGENCE_CONTRACT.md`.

## Hard routing invariant

Owner exception delivery requires both:

- `report_route = boss-final`
- `audience = OWNER`

`automation/reporting/ceo_report.py` rejects every other route even if a TOMOKI workflow accidentally invokes it.

Portfolio delivery requires the portfolio artifact contract instead; it must never masquerade as a BOSS-final exception.

## Noise rules

- Same incident must not be sent once by TOMOKI and again by CEO with the same content.
- Operational counts are evidence, not the headline.
- `X agents added`, `Y workflows created`, `research completed`, `security strengthened`, `autonomy increased` are not sufficient conclusions.
- CEO explains **company consequence**.
- TOMOKI explains **repair/reliability consequence**.
- THE WORLD explains **behavior/evolution consequence**.
- PORTFOLIO explains **artifact/user/business consequence**.
- Successful automatic recovery stays out of CEO unless it materially changes the company's verified capability; when it does, report the capability gain, not the internal chatter.
- Do not post unfinished activity to `#portfolio` unless there is already a human-inspectable `EXPERIMENT` or `BUILDING` artifact.
- Diagnosis, proposal, implementation, live deployment, verification and external value are different states. Never collapse them into one `done` claim.
