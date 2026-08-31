# Shared Discovery Authority Rule

META, X, SENJU, child agents, crawlers, logs, and external-response processors share discovered HTTPS URLs through one production discovery knowledge bus.

## Core production loop

```text
Any AI discovers URL
        ↓
interesting=true
        ↓
shared_discovery_knowledge.json
        ↓
existing owner authority root?
   ├─ yes → probationary Authorized
   │          ↓
   │       action queue
   │          ↓
   │       automatic scan/probe
   └─ no  → shared authorization candidate
```

A discovery inside an already explicit owner-controlled root, company domain, standing authorization, live independently reviewed grant, or exact owner-supplied host may be promoted automatically without a new per-URL prompt.

All AIs may contribute discoveries. Source identity is preserved in the shared record so META/X/child/SENJU observations become common knowledge instead of separate silos.

## Capability rule

Every discovery-promoted target receives the generic non-credentialed discovery capability set:

- `scan`
- `probe`

The scheduled production cycle executes bounded credential-free HEAD probes for these targets and records receipts.

Higher-impact capabilities may be attached only when the exact discovered host already has an explicit owner action profile in `meta_state/discovery_policy.json`:

- `write`
- `mutation`
- `credentialed_action`

A credentialed action additionally requires a non-`none` credential scope in that exact explicit profile. High-impact profiles do not automatically inherit to newly discovered descendants.

## Shared knowledge rule

All normalized discoveries are shared even when they cannot be authorized. An unrelated external host therefore becomes a common candidate immediately, but discovery alone does not create a new unrelated Internet trust root.

Generated authorization outputs and probe receipts are excluded from discovery-source ingestion so the system does not manufacture new discoveries from its own bookkeeping.

## Runtime

The normal X orchestrator runs the shared discovery loop as part of META/recovery processing. A dedicated hourly workflow also refreshes shared discovery state and executes bounded probes for currently authorized targets.
