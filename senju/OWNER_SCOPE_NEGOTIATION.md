# Owner Scope Negotiation

The production-effective Owner contact ceiling is no longer treated as a permanently static object.

Production flow:

```text
External friction / blocked host / policy request
  -> all-agent negotiation campaign
  -> META / X / SENJU decision ballots
  -> Owner Expansion Envelope check
     -> existing Owner standing host + 3/3 council: auto-apply bounded method amendment
     -> new / outside host: keep negotiating and request Owner standing authority
  -> NegotiatedExternalContactClient consumes the effective ceiling immediately
  -> real ExternalContactClient HEAD probe exercises that ceiling
```

## Autonomous negotiation

Every proposal fans out to META, X, SENJU, CHILD, AI and PR-ARMY across five argument angles:

- ownership evidence
- business need
- least-privilege method set
- reversibility / rollback
- risk counterargument

That is 30 negotiation tasks per proposal. `negotiation_intensity` is currently 60/100.

## What META/X/SENJU may actually change

A 3/3 decision with sufficient confidence may automatically amend the production-effective method scope for an exact host that already has active Owner standing authorization, subject to `senju/config/owner-expansion-envelope.json`.

The default method ceiling allows an existing standing host to move up to GET/HEAD/OPTIONS/POST/PUT/PATCH when the requested methods are inside the envelope and the three decision members approve.

Methods are tracked per host. One host's POST/PATCH authority cannot spill onto another host.

New-host findings are not discarded. They receive the full 60/100 negotiation campaign and can carry ownership/business evidence, but they cannot become active external authority until Owner standing authorization exists. `owner_verified_domain` and `owner_exact_link` therefore remain negotiation evidence rather than self-authorizing proof.

## Production execution

`.github/workflows/owner-scope-negotiation-production.yml` runs hourly and on relevant state changes with `contents: read` only. It executes the negotiation cycle against the real `senju/state`, generates the effective ceiling for that production run, and immediately passes it into `NegotiatedExternalContactClient`.

The same run then performs one real HEAD contact through the existing `ExternalContactClient` to an exact host already present in the effective ceiling. This proves the negotiated scope is operational rather than a simulation.

The effective ceiling, negotiation campaign/result and real-contact receipt are uploaded as evidence artifacts. The workflow does not self-commit authority state or retain Git credentials.

## Terminal boundaries

The negotiation council does not:

- create unrelated authority from discovery alone
- activate a new exact host without Owner standing authorization
- override HARD_DENY or revocation
- mint or discover credentials
- generally expose private, loopback or link-local networks
- change scope outside the Owner Expansion Envelope

Those requests stay visible as negotiation / Owner-review items rather than disappearing.
