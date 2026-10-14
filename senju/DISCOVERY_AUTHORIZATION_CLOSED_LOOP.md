# Discovery Authorization Closed Loop

META, X, Senju, child agents, crawlers, and other AI workers may publish discovered HTTPS URLs into one shared discovery knowledge stream.

## Production rule

```text
URL discovered by any AI
  -> shared immediately
  -> interesting=true
  -> target candidate immediately
  -> if already inside an explicit Owner authority envelope: probationary read-only authorization
  -> the exact discovered URL becomes a scan/probe target
  -> automatic credential-free GET probe
  -> links found in the authorized response return to shared discovery
  -> authorization is evaluated again in the same closed loop
```

This loop is designed to make Discovery operational rather than advisory.

## Automatic authority inside an existing Owner envelope

A discovered host may be promoted automatically when its authority is inherited from an already established Owner-controlled source, including configured trusted roots/company domains, active standing exact-host authority, reviewed explicit exact-host grants, or exact Owner-supplied hosts under the production discovery rules.

Once the host has a live inherited read-only grant, each discovered HTTPS URL on that authorized host becomes a URL-granular scan/probe candidate. The host authority remains the controlling envelope; URL-level crawling does not create a broader host or network authority.

The default discovery-derived execution profile is:

- HTTPS only
- exact promoted host
- exact discovered URL/path for probing
- scan/probe
- bounded GET/HEAD style read-only interaction
- no credentials
- no destructive effect
- short expiry / re-evaluation

No separate per-URL approval is required for those read-only actions while the inherited Owner authority remains live.

## Shared AI knowledge

All discovery producers may publish to the common event bus. Actor identity and source are retained so META/X/Senju/child discoveries can be merged, deduplicated, audited, and consumed by the same production loop.

Crawler and probe responses may publish additional discovered URLs back into the same bus. The loop may immediately promote and probe newly discovered in-scope descendants and individual paths in subsequent rounds of the same bounded run.

## Higher-impact action profiles

Write, mutation, and credentialed-action capabilities are never invented from a URL alone. They may appear in the action queue only when the exact discovered host already has an explicit Owner action profile declaring those capabilities and, for credentialed action, a non-empty credential scope.

The generic discovery crawler does not execute those higher-impact capabilities. It continues to execute only credential-free scan/probe. Higher-impact executors must consume the separately established exact-host action authority.

## External discoveries

A URL outside the active Owner authority envelope is still:

- shared with all AI workers;
- marked interesting;
- retained as a target candidate;
- ranked for authorization review.

It is not automatically converted into a new unrelated Internet authority root and is not probed merely because it was linked from an authorized page.

## Closed-loop invariants

1. Discovery is always knowledge immediately.
2. In-scope discovery becomes read-only target authority automatically.
3. The exact discovered URL/path on an authorized host becomes a scan/probe candidate automatically.
4. Authorized responses can create more discoveries automatically.
5. Newly discovered in-scope descendants and paths can be promoted and probed in the same run.
6. The loop is bounded by round, target, response-size, and link limits.
7. A live grant is re-checked before each probe.
8. Credentials are never added by the discovery crawler.
9. Out-of-envelope URLs cannot be reached merely because they were linked by an authorized page.
10. Every round emits machine-readable receipts.
11. Runtime state may persist independently of repository writes through the scheduled production workflow cache.
