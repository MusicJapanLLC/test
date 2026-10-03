# THE WORLD Realtime Autonomy Kernel

## Purpose
Turn the existing collection of scheduled workers into one continuously maintained world with **exception-only human approval inside established boundaries**.

The kernel does **not** replace Senju, THE CORE, TOMOKI, MANAGER, BOSS, THE COVENANT, WLD, the Security Society, or the portfolio layer. It watches those existing workers, wakes them when they are stale, retries bounded failures, and gives THE CORE a recurring reasoning cycle that can choose which internal specialist should act next.

All residents inherit `docs/THE_WORLD_AUTONOMY_V2.md`.

## Runtime topology
```text
GitHub workflow completion -----------+
                                      |
5-minute pulse -----------------------+--> Realtime Kernel
                                           |
                                           +--> health/readback
                                           +--> wake stale allowlisted worker
                                           +--> rerun bounded failure
                                           +--> evidence artifact
                                           |
30-minute Core Director --------------+--> Copilot reasoning
                                           |
                                           +--> deterministic action gate
                                           +--> internal specialist actions
                                           +--> R&D / Senju / FORGE / SKEPTIC / HOUND
                                           +--> public read-only research
                                           |
                                           v
                                  existing worker system
                                           |
                   research -> experiment -> implementation -> verify -> learn -> continue
```

## Cadence
- Realtime heartbeat: every 5 minutes, plus event-driven `workflow_run` wakeups.
- THE CORE Director: every 30 minutes.
- Each worker keeps its own native schedule.
- The kernel intervenes when a worker is stale/failed or when the bounded director selects a useful next action.
- A verified safe action may feed the next self-evolution hypothesis instead of ending the cycle.

## Human-free execution lanes
Autonomy may act without a fresh owner prompt for:

- public read-only research and evidence collection;
- repository/documentation/code exploration;
- local/simulated experiments;
- branch-only implementation, tests, repairs and PR creation;
- allowlisted GitHub workflow dispatch/rerun;
- GitHub-native state/evidence produced by those workers;
- existing internal Slack/Supabase/Sheets/portfolio routes already owned by downstream workers;
- explicitly owner-authorized disposable security-test ranges under their existing RoE using synthetic data/test credentials.

These actions should not be escalated merely because the exact next step was not previously enumerated.

## Narrow human exception boundary
Fresh human approval remains required for material authority changes such as:

- production deployment/state mutation;
- secrets, credentials, permissions, branch protection or billing changes;
- new external write authority or permission escalation;
- irreversible deletion outside disposable test surfaces;
- legal or financial commitments.

Hard-blocked security effects such as DoS/resource exhaustion, social engineering, unauthorized targeting, real-personal-data extraction, production-secret extraction and credential reuse outside disposable test accounts are not made legal by a council vote or lottery.

## External exploration
The old blanket rule "third-party means stop" is superseded by the more precise v2 policy:

- **public read-only exploration:** autonomous;
- **owned/explicitly authorized disposable security ranges:** autonomous inside the stated RoE;
- **unapproved third-party mutation/security testing:** outside the autonomous envelope.

This distinction intentionally expands research freedom without confusing public learning with mutation authority.

## Why two loops
**Realtime Kernel** is deterministic and continuity-focused. Its job is to keep the world moving.

**THE CORE Director** may reason about what to investigate or improve next, while execution is classified by the shared autonomy policy. Low-risk/reversible actions should proceed immediately; only genuine boundary changes escalate.

## Definition of done
1. a 5-minute pulse can detect and wake stale core workflows;
2. a recurring reasoning cycle can select useful specialists without user prompting;
3. public read-only research and branch/local work proceed without fresh human approval;
4. every observed resident receives a self-evolution directive;
5. Security Society / RED-LAB can run high-intensity experiments on local/simulated and explicitly authorized disposable ranges;
6. R&D and Senju keep turning evidence into validated improvements;
7. Manager/TOMOKI/BOSS repair and report exceptions instead of routine safe work;
8. material outcomes surface through existing evidence routes;
9. the system stops only at a real authorization/safety boundary rather than treating every uncertainty as a human approval event.
