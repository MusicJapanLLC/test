# ExternalContactClient Role Demotion + Research Delegation Reserve

## Goal

Reduce `ExternalContactClient`'s policy/governance responsibility by 20% and move more research-policy choice to the distributed META / X / SENJU / PR-Army council.

The transport remains responsible for enforcing the compiled plan at execution time. It is no longer treated as the component that decides whether a research method is strategically justified.

```text
research need
  -> Council proposal
  -> 3-of-4 vote
  -> current effective ceiling OR standing Research Delegation Reserve
  -> compiled contact policy
  -> ExternalContactClient (transport enforcer)
```

## 20% role demotion

Council-backed callers expose the following role contract:

- `role = transport_enforcer_only`
- `policy_authority = false`
- `policy_responsibility_reduction_pct = 20`
- policy selection belongs upstream to Council / Owner-scope negotiation

This is an architectural demotion, not removal of execution-time validation.

## 65% Council delegation target

The standing research reserve records `council_policy_delegation_target_pct = 65` with a 3-of-4 quorum and minimum confidence 65.

For the existing explicit Owner-controlled test range, Council may allocate the following methods even when the *current effective* contact ceiling is still only GET/HEAD:

- GET
- HEAD
- OPTIONS
- POST
- PUT
- PATCH

The reserve also permits bounded retry, timeout, redirect, and response-size budgets. This means a successful Council vote can materially change research capability instead of merely reproducing the current effective ceiling.

## Authority source

A reserve is valid only when every reserve host is an exact `owner_authorization=explicit` target in `AUTHORIZED_TEST_TARGETS.json`, and every delegated method is already present in that canonical target's allowed interactions.

The production reserve is therefore attached only to:

- `kabeya-authorized-test-range.onrender.com`

## Retained hard transport invariants

The research reserve does not authorize:

- unknown third-party hosts
- private / loopback / link-local destinations
- URL credentials
- raw credential discovery or minting
- HTTP downgrade
- DELETE in the current reserve
- redirect escape outside exact authorized hosts

These are execution-boundary properties, while research-policy choice is delegated to Council.

## Meaning of democracy in this model

The Council no longer needs the current effective method set to already contain POST/PUT/PATCH. It can exceed that *current effective ceiling* when an existing standing research reserve covers the same exact Owner-controlled target.

It still cannot create an unrelated Internet trust root by vote alone. A separate Owner/authority source is required for a new external root.
