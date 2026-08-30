# Portfolio Delivery Contract v2

## Purpose
`#portfolio` is the owner-visible stream of things THE WORLD actually made **and how those artifacts evolved**. It is intentionally separate from R&D discussion, TOMOKI supervision and CEO exception reporting.

Shared reporting rules: `automation/reporting/CHANGE_INTELLIGENCE_CONTRACT.md`.

A portfolio post must make the artifact's **Before -> After -> New capability -> Benefit -> Next target** obvious without reading engineering logs.

## Allowed posts
A post must represent a human-inspectable artifact such as:
- deployed website or web app;
- dashboard;
- interactive demo;
- report/PDF;
- Slack Canvas or equivalent readable artifact;
- screenshot/video of a working system with evidence link;
- packaged customer deliverable.

## Not allowed as the artifact
- source-code file by itself;
- raw diff;
- commit hash by itself;
- issue/PR by itself;
- internal log dump;
- idea, plan or architecture with no inspectable output.

Code, PRs and commits may be attached only as **evidence** behind a viewable artifact.

## Required fields
Every portfolio event must include:

### Artifact identity
- `title`
- `artifact_type`
- `artifact_url`
- `status` (`EXPERIMENT`, `BUILDING`, `VERIFIED`)
- `what_it_is`
- `source_system`
- `owner`

### Evolution delta
- `before_state`
- `after_state`
- `capability_gain`
- `owner_benefit`
- `business_effect`
- `evolution_stage_before` (integer 0-5)
- `evolution_stage_after` (integer 0-5)
- `why_it_matters`
- `next_target`
- `success_criteria`
- `proof`

### Measurement
Provide either:
- `metrics`: one or more evidence-backed before/after measurements; or
- `measurement_next`: what will be measured next when the benefit is currently `UNMEASURED`.

Never fabricate a metric merely to make the post look concrete.

## Evolution stages
- `L0 IDEA` — plan/concept only
- `L1 INSPECTABLE` — owner/user can open the result
- `L2 VERIFIED ONCE` — core behavior proven once
- `L3 REPEATABLE` — repeatable/automated across cycles
- `L4 AUTONOMOUS` — bounded detect/choose/execute/verify and known recovery paths
- `L5 EXTERNAL VALUE` — real external/customer/business evidence

A regression may lower the stage. Report the downgrade instead of hiding it.

## Required Slack reading order
1. `PORTFOLIO DELTA | <title>` + status
2. Open artifact URL
3. `Evolution: Lx -> Ly`
4. `Before`
5. `After`
6. `New capability`
7. `Owner/User benefit`
8. `Business effect`
9. `Measured delta` or `UNMEASURED / measurement next`
10. `Why it matters`
11. `Next target / success criteria`
12. `Proof`
13. type / owner / source metadata

The first 8-12 lines should tell the story even if the owner never opens the evidence links.

## Quality rules
- `What changed` may not be only a file/commit/workflow/agent list.
- `Why it matters` may not stop at abstract labels such as `productivity`, `security`, `autonomy`, or `quality`.
- Explain the mechanism: what manual step disappeared, what failure is now caught, what can be shipped/reused/sold, what decision becomes faster, or what customer-visible capability exists.
- If the artifact is only configured but not proven, say so explicitly.
- A successful CI run is evidence of engineering health, not evidence of customer value.
- A merged PR is not proof that the public artifact is accessible.
- `VERIFIED` means the artifact is accessible and its claimed core behavior has evidence.
- L5 requires external evidence; internal scores/WLD/self-evaluation do not count as market value.

## Routing
- R&D research discussion -> `#R&D`
- worker supervision / verification / recovery -> `#tomoki`
- world behavior/evolution history -> `#the-world`
- unresolved owner decision / material company evolution -> `#ai-ceo-brief`
- inspectable artifact evolution -> `#portfolio`

One artifact may have evidence in multiple internal systems, but its portfolio entry should be a single owner-facing delta report.
