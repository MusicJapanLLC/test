# DEFENSIVE SECURITY SOCIETY — R&D Support Lane

Issue: #55

This directory adds a **non-interfering support lane** to the existing Senju / THE WORLD / Covenant / Manager / TOMOKI / BOSS architecture.

## What this is

- Exactly **100 deterministic security/R&D agent identities**: 10 guilds × 10 slots.
- A bounded self-service sub-agent contract for engineers and researchers.
- A testable permission-inheritance layer: a child can never exceed its parent grant.
- A coordination adapter designed to reuse the existing durable event bus and reporting route.

This is a roster and orchestration contract, **not a claim that 100 external LLM processes are continuously running**. Runtime providers may materialize these slots as needed, while the identity, scope and governance remain stable.

## Existing systems are authoritative

This support lane does **not** replace or fork:

- `senju/` safety / arena / lab
- `automation/reporting/REPORTING_CONTRACT.md`
- `docs/THE_WORLD_OBSERVER_CONTRACT.md`
- THE WORLD / WORLD CREDIT / Covenant ownership
- the existing durable event bus (`ai_company_events` + dedupe contract)

Reporting remains:

`WORKER → MANAGER → TOMOKI → BOSS → CEO`

Raw engineering chatter stays below CEO. Only material outcomes, unresolved P0/P1 decisions, or user-action blockers should reach CEO.

## 100-agent topology

Ten guilds, ten deterministic slots each:

1. AppSec & Secure Review
2. Cloud / IAM Defense
3. Supply Chain / SBOM
4. Detection Engineering
5. Incident Response / Forensics
6. Threat Intelligence & Exposure Research
7. Secure Architecture
8. Data Protection / Privacy Engineering
9. Resilience / SRE / Recovery
10. Adversary Simulation — **sandbox-only**

The adversary-simulation guild does not contain exploit automation. It models attack paths, generates safe scenarios and validates defenses only against `sim://` or explicitly authorized internal lab targets.

## Self-service sub-agent right

Every engineer/researcher may create a dedicated child agent without per-child managerial approval **inside the grant already held by the parent**.

Self-service creation cannot:

- add capabilities the parent does not have;
- widen network scope;
- access public/external targets;
- request secrets;
- write to production;
- disable Senju `ScopeGuard` / ROE / Security Guard;
- bypass Issue #42's concrete-destination fail-close requirement for private-lab liveness;
- bypass existing reporting/evidence rules.

A child must declare parent ID, purpose, capabilities, TTL, network scope and kill-switch owner. The registry produces a dedupe key suitable for the existing event bus.

## Network scopes

`simulated-only` is the default and safest scope.

`private-lab` is available only when the parent already has it **and** the caller supplies evidence that Issue #42's fail-closed concrete-destination remediation has been accepted. External/public network scope is not a valid self-service option.

## Covenant / values inheritance

Agents may inherit the existing Covenant/value metadata from their parent for culture and accountability. Values metadata never overrides security controls, evidence requirements, rest/HELP mechanisms, or permission boundaries.

## Local validation

```bash
python -m unittest security-society/test_registry.py
```

The tests require no network access and verify:

- exactly 100 unique identities;
- 10 agents per guild;
- no privilege escalation;
- no external network scope;
- no self-service secrets or production writes;
- Issue #42 blocks private-lab delegation until explicitly remediated.
