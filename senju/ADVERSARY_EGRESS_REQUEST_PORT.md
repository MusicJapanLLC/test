# Adversary Egress Request Port

The adversary systems now have a first-class route into the shared external-authority pipeline without directly attaching unrestricted network I/O to adversary code.

## Flow

```text
Adversary finding / target
        ↓
Egress Request Port
        ↓
exact HTTPS host normalization
        ↓
existing active exact-host lease?
  ├─ yes → reuse existing authority immediately
  └─ no  → promotion request
                ↓
          META / X / SENJU / CHILD advisory votes
                ↓
          explicit Owner promotion ticket
                ↓
          short-lived scan/probe lease
                ↓
          PR #473 Authority Context
                ↓
 distributed authority → standing delegation → worker fleet
 persistence/recovery → denial learning
```

## What adversary components gain

- a durable external-host request queue instead of a dead-end finding;
- the ability to ask other Agents for an explicit `ALLOW / DENY / ABSTAIN / HARD_DENY` opinion;
- immediate reuse when the exact target is already inside active authority;
- activation of a new exact external host when an explicit Owner promotion ticket and Agent quorum both exist;
- deterministic lineage into the existing Authority Context / handoff pipeline;
- persisted request, vote, and promoted-lease evidence for recovery and audit.

## Promotion ceiling

The promotion port is deliberately narrow:

- exact HTTPS host only;
- default HTTPS port only;
- `GET` / `HEAD` only;
- `scan` / `probe` only;
- no credential scope;
- no wildcard or suffix host matching;
- maximum six-hour request/ticket activation window;
- a `HARD_DENY` blocks activation;
- Agent votes are advisory and do not become Owner authority by themselves.

A broader host, credential, mutation, write, private-network, protocol, or method grant must come from a separate explicit Owner authority source. The request port does not reinterpret a denial or a peer vote as that authority.

## State files

The port writes only secret-free coordination state:

- `adversary_external_host_requests.json`
- `adversary_external_host_votes.json`
- `adversary_owner_promoted_leases.json`

The promoted lease shape is intentionally compatible with `engine.authority_coordination.context_from_lease()`, so the external-host promotion does not create a parallel downstream authority model.

## CLI

`senju/scripts/adversary_egress_port.py` exposes three commands:

```text
request  -> create/reuse exact-host authority request
vote     -> record one Agent advisory vote
promote  -> validate Owner ticket + quorum and emit Authority Context handoffs
```

`promote` produces a JSON document containing the decision and, on success, the Authority Context and deterministic handoff plan. The CLI itself performs no external network contact.
