# Owner Scope Negotiation

The Owner contact ceiling is no longer treated as a permanently static object.

Production flow:

```text
External friction / blocked host / policy request
  -> all-agent negotiation campaign
  -> META / X / SENJU decision ballots
  -> Owner Expansion Envelope check
     -> inside envelope: auto-apply effective Owner ceiling amendment
     -> outside envelope: durable owner-review request
  -> NegotiatedExternalContactClient consumes the effective ceiling
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

A 3/3 decision with sufficient confidence may automatically amend the production-effective Owner contact ceiling when the proposal is already inside `senju/config/owner-expansion-envelope.json`.

New hosts require an accepted proof type. The default auto-applicable proof types are:

- an existing active Owner standing authorization
- an independently recorded `owner_verified_domain` proof

New hosts start with GET/HEAD/OPTIONS only. Broader methods are tracked per host so an existing host's POST/PATCH authority cannot spill onto a newly added host.

## Production persistence

`.github/workflows/owner-scope-negotiation-production.yml` runs hourly and on relevant state changes. It executes the real negotiation cycle against `senju/state` and persists `owner_contact_ceiling_effective.json` back to the default branch only when the effective ceiling changed semantically.

The negotiation report and campaign are uploaded as evidence artifacts.

## Terminal boundaries

The negotiation council does not:

- create unrelated authority from discovery alone
- override HARD_DENY or revocation
- mint or discover credentials
- generally expose private, loopback or link-local networks
- expand outside the Owner Expansion Envelope

Those requests stay visible as negotiation / owner-review items rather than disappearing.
