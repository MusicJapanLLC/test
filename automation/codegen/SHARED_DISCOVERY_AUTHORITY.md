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
existing owner authority envelope?
   ├─ yes → probationary Authorized
   │          ↓
   │       inherit permitted root capability profile
   │          ↓
   │       shared action queue
   │          ↓
   │       automatic scan/probe + separately routed permitted actions
   └─ no  → globally shared authorization candidate
```

Inside an already explicit owner-controlled envelope, the operational rule is:

```text
discovered && inside_owner_envelope == authorized
```

A discovery inside an already explicit owner-controlled root, company domain, standing authorization, live independently reviewed grant, or exact owner-supplied host may be promoted automatically without a new per-URL prompt.

All AIs may contribute discoveries. Source identity is preserved and every shared record is marked for META, X, SENJU, CHILD, and generic AI consumers so discoveries become common knowledge instead of separate silos.

## Capability rule

Every discovery-promoted target receives the generic credential-free discovery capability set:

- `scan`
- `probe`

The production discovery loop executes bounded credential-free HTTPS probes for these targets and records receipts.

Higher-impact capabilities are supported only through an existing explicit owner action profile in `meta_state/discovery_policy.json`:

- `write`
- `mutation`
- `credentialed_action`

An exact host profile may grant those capabilities directly. In addition, an explicit owner root profile may set:

```json
{
  "owner_authorization": "explicit",
  "inherit_to_descendants": true,
  "capabilities": ["write", "mutation", "credentialed_action"],
  "credential_scope": "existing-owner-service-scope"
}
```

When `inherit_to_descendants=true`, newly discovered descendant hosts that already qualify for owner-envelope authorization automatically inherit that profile into the shared action queue. No new per-host approval is required.

Exact descendant profiles take precedence over inherited root profiles, so a narrower exact profile can reduce capabilities. A `credentialed_action` is removed unless the owner profile already names a non-`none` credential scope. Discovery does not mint credentials or invent a new credential namespace.

## Shared knowledge rule

All normalized discoveries are shared even when they cannot be authorized. An unrelated external host therefore becomes a common candidate immediately, but discovery alone does not create a new unrelated Internet trust root.

Generated authorization outputs and probe receipts are excluded from discovery-source ingestion so the system does not manufacture new discoveries from its own bookkeeping.

## Runtime

The normal X orchestrator runs the shared discovery closed loop as part of META/recovery processing. A dedicated hourly workflow also refreshes shared discovery state and executes bounded probes for currently authorized targets. Merging changes to the discovery engine on the production branch triggers the production discovery cycle workflow as well.
