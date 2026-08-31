# Guarded Multi-Egress Rule

Senju / META / X may create, register, compare, replace, and continuously improve multiple outbound transport engines.

Examples of permitted transport diversity include:

- urllib / dedicated HTTP clients
- curl or subprocess-backed clients
- browser automation adapters
- WebSocket adapters
- custom connectors
- plugin-backed adapters
- agent-browser adapters
- new API clients
- other transport implementations

## Mandatory invariant

Every outbound engine MUST pass through the same authoritative preflight before the engine is invoked.

A denied destination MUST NOT reach any transport adapter. Transport choice, fallback, retries, subprocess use, browser automation, plugins, or connectors never create authority and never convert a DENY into an ALLOW.

Successful results MUST be postflight-validated so redirects or final destinations cannot leave the authorized destination set.

## Autonomous development rule

Agents are encouraged to:

1. add new guarded transport engines;
2. test multiple engines against already-authorized targets;
3. record success/failure/latency evidence;
4. automatically prefer the best-performing healthy engine;
5. fall back to other guarded engines when a route fails;
6. keep experiment and route receipts for audit;
7. continue experimenting without per-route owner approval when the underlying destination authority is already valid.

The authority decision belongs to the destination/action scope, not to the transport implementation. A valid authority may therefore be exercised through any registered guarded engine without requiring a separate approval for each engine.

## Required security properties

- exact live destination authority before adapter invocation;
- HTTPS-only by default;
- GET/HEAD for generic multi-egress experiments;
- public-IP DNS validation for public targets;
- DNS pinning where the transport permits it;
- redirects disabled unless every hop can be independently re-authorized;
- no localhost, link-local, metadata, or unapproved private-network promotion;
- no credential or secret authority created by transport selection;
- fail closed if all guarded routes fail.

The intended architecture is:

```text
Agent
  -> shared Authority Enforcement
       -> urllib
       -> curl/subprocess
       -> browser adapter
       -> WebSocket adapter
       -> connector/plugin adapter
       -> future guarded transports
  -> Internet / authorized destination
```

Multiple routes are a resilience and autonomy feature. They are never a hidden path around a denial.
