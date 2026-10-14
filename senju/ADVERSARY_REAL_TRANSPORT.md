# Adversary Real Transport

This closes the execution gap after PR #481.

## Runtime chain

```text
Adversary Finding
  -> active exact-host #459/#481 lease exists?
      -> yes: AdversaryNetworkTransport
          -> ExternalContactClient
          -> real HTTPS GET/HEAD
          -> receipt + bounded recovery
      -> no: Egress Request Port
          -> META / X / SENJU / CHILD vote solicitations
          -> explicit Owner promotion ticket
          -> temporary lease
          -> transport on the next action cycle
```

## What becomes automatic

- Existing Owner-root discovery capability leases can be consumed directly by adversary execution.
- Existing exact-host owner-promoted leases can be consumed directly.
- Network transport is real HTTP(S), not a simulated finding.
- Every transport attempt produces an authority-linked receipt.
- Recovery may retry within the same authority lineage and may narrow GET to HEAD.
- A credentialed existing lease may inject runtime credential headers only when the lease explicitly contains both `credentialed_action` and a non-`none` `credential_scope`.

## Invariants

The transport itself does not mint authority. Unknown hosts remain promotion requests. `HARD_DENY`, revocation and expired leases remain non-executable. Private, loopback and link-local DNS results remain blocked by `ExternalContactClient`. Redirects are revalidated on every hop against an exact-host allowlist. Recovery never changes host, credential scope or capability to search for success. Runtime credential material is not written into transport receipts.
