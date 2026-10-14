# Owner Envelope Fast Path

This removes the authorization queue from adversary targets that are **already** covered by live Owner authority.

## Fast path

```text
Adversary Finding
  -> normalize exact HTTPS host
  -> already inside Owner Authority envelope?
      -> YES
          -> materialize short-lived exact-host transport lease
          -> share with META / X / SENJU / CHILD / AI
          -> real AdversaryNetworkTransport immediately
      -> NO
          -> #481 external-host promotion request
          -> META / X / SENJU / CHILD advisory work
          -> explicit external authority promotion
```

Immediate eligibility is derived from existing explicit sources:

- `discovery_policy.json` `trusted_roots`
- `discovery_policy.json` `company_domains`
- `network_policy_envelope.json` `authorized_roots`
- active credential-free, non-destructive standing exact-host authorization
- active independently reviewed explicit exact-host grant
- exact HTTPS links supplied by the Owner in `human_intent_signals.json`

The generated lease is GET/HEAD + scan/probe, exact-host, short-lived and shared across the agent fleet. It is consumed directly by the same real network transport introduced after #481.

## Redirect acceleration

`AdversaryNetworkTransport` may construct a redirect allowlist from multiple **active exact-host leases sharing the same `authorization_reference`**. A redirect therefore does not have to stay on the first host when both hosts are already independently authorized by the same Owner authority lineage.

Sensitive request headers are still stripped on cross-host redirects by `ExternalContactClient`.

## Recovery

Recovery remains inside the live authority lineage. GET may narrow to HEAD. It does not invent a new credential, authority reference or unrelated host.

## Explicit private network authority

The standing-authorization subsystem already supports explicitly declared RFC1918/ULA CIDRs and exact internal DNS names. Those scopes remain explicit and non-transitive; loopback, link-local and cloud-metadata destinations are not inferred from public discovery.

## Boundary

The fast path is deliberately broad **inside existing Owner authority** and absent outside it. An unrelated host named by a finding, redirect or external response does not become a new root. Revoked records are not reactivated, and credential material is not minted from discovery.
