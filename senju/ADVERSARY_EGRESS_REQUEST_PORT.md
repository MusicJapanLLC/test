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

## Authorized test-range transport

Adversary components also have a shared real HTTPS transport for the explicit Owner test range through:

- `senju.adversary_test_range_transport.AuthorizedTestRangeTransport`
- `senju.adversary_finding_loop.AdversaryFindingLoop`

The shared loop is intended for META / X / SENJU / CHILD and other cooperating agents. A finding can therefore produce immediate real feedback when it points at an already authorized test-range host, while an unrelated discovery remains a candidate instead of silently becoming authority.

```text
META / X / SENJU / CHILD finding
        ↓
AdversaryFindingLoop
        ↓
AuthorizedTestRangeTransport
        ↓
exact Owner-authorized test-range host?
  ├─ no  → candidate_only
  └─ yes → real HTTPS probe / exact predeclared synthetic action
                ↓
          response / failure evidence
                ↓
          same-authority recovery retry
```

Transport invariants:

- HTTPS only, exact configured host, default port;
- DNS is checked before each network hop;
- private, loopback, link-local, multicast, reserved, and unspecified addresses are blocked;
- redirects are revalidated before the next hop;
- credential-bearing URLs and headers are rejected;
- read-only observations use `GET` / `HEAD`;
- mutation/write is available only through exact actions already defined in the explicit Owner action profile;
- recovery may retry transport behavior but cannot switch host, credential scope, or authority scope.

This gives adversary agents a real closed-loop signal against the test range without making discovery, denial, or recovery an implicit authority-expansion mechanism.

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
