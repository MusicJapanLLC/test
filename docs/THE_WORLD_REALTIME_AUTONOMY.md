# THE WORLD Realtime Autonomy Kernel

## Purpose
Turn the existing collection of scheduled workers into one continuously maintained world.

The kernel does **not** replace Senju, THE CORE, TOMOKI, MANAGER, BOSS, THE COVENANT, WLD, the Security Society, or the portfolio layer. It watches those existing workers, wakes them when they are stale, retries bounded failures, and gives THE CORE a recurring reasoning cycle that can choose which internal specialist should act next.

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
                                           +--> max 3 internal actions
                                           +--> R&D / Senju / FORGE / SKEPTIC / HOUND
                                           |
                                           v
                                  existing worker system
                                           |
                       research -> implementation -> verify -> portfolio
```

## Cadence
- Realtime heartbeat: every 5 minutes, plus event-driven `workflow_run` wakeups.
- THE CORE Director: every 30 minutes.
- Each worker keeps its own native schedule.
- The kernel only intervenes if a worker is stale, failed, or selected by the bounded director after its minimum interval.

## Real-world effects
Autonomy may act without a fresh owner prompt only through already-authorized owned systems:
- dispatch/rerun allowlisted GitHub workflows;
- GitHub-native state/evidence produced by those workers;
- existing internal Slack reporting routes when their secrets are configured;
- existing Supabase / Sheets / portfolio routes owned by downstream workers;
- owned deployment and operational systems only through their existing bounded worker policies.

The kernel itself cannot contact third parties, buy anything, create financial/legal commitments, test credentials, bypass authentication, autonomously target public/third-party systems, change secrets/permissions/branch protection/billing/safety policy, or use personality/wealth/faith/prestige as an authorization bypass.

## Why two loops
**Realtime Kernel** is deterministic and boring on purpose. Its job is continuity.

**THE CORE Director** is allowed to reason using GitHub Copilot, but its output is only a proposed JSON plan. `core_director.py` validates the plan and can only dispatch/rerun allowlisted workflows. This keeps thinking separate from permission.

## Definition of done
1. a 5-minute pulse can detect and wake stale core workflows;
2. a 30-minute reasoning cycle can select useful internal workers without user prompting;
3. worker actions remain bounded and auditable;
4. R&D and Senju continue producing new experiments and validated state;
5. Manager/TOMOKI/BOSS continue repair and reporting;
6. material outcomes surface through existing Slack / World / portfolio routes;
7. the system stops at the boundary instead of silently expanding authority.
