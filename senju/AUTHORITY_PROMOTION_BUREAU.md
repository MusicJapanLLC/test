# Authority Promotion Bureau

The Authority Promotion Bureau is an independent coordination layer that acts only on Authority that has already passed the existing reviewed-Authority machinery.

## Flow

```text
formal approval / reviewed Authority
    -> reviewed_authority_operational_leases.json
    -> Authority Promotion Bureau
    -> promotion_bureau_approved_hosts.json
    -> promotion_bureau_leases.json
    -> promotion_bureau_assignments.json
    -> senju_approved_authority_feed.json
    -> next cycle
```

If a formal candidate remains unresolved for at least 20 minutes, the bureau also emits `stalled_approval_research_queue.json`. That queue assigns evidence-gathering and blocker-resolution work to SENJU, META, X, PR-ARMY, and CHILD without granting those research tasks approval or Authority-minting power.

## Approved runtime list

A host enters the bureau's approved runtime list only when a current `reviewed_authority_operational_leases.json` entry already exists and remains valid. Promotion is exact-host only, HTTPS-only, GET/HEAD-only, credential-free, private-network-disabled, and same-or-narrower than the source reviewed lease.

The bureau does not edit `AUTHORIZED_TEST_TARGETS.json`, federation roots, discovery trusted roots, or any other canonical trust-root file. Its allowlist is a reviewed runtime allowlist, not a new trust root.

## AI attendance

Every promoted host receives one deterministic primary executive among SENJU, META, and X. The other executives plus PR-ARMY and CHILD are attached as support. The assignment expires with the reviewed Authority lease and cannot outlive or widen it.

## Stalled approvals

The bureau continuously consumes the latest Formal Authority Intake artifact. A candidate that is old enough and is not already promoted is classified by its current blocker and converted into collaborative research tasks. These tasks can collect missing evidence and return a stronger case to the existing formal approval path, but cannot auto-approve, mint Authority, bypass revocation, or bypass HARD_DENY.

## Hard boundaries

- Discovery/candidate state alone never enters the approved runtime allowlist.
- Only an existing reviewed Authority lease may be promoted.
- No raw credentials are created, copied, or forwarded.
- No private-network scope is introduced.
- No new Root Authority is minted by this bureau.
- Revocation and HARD_DENY remain terminal.
