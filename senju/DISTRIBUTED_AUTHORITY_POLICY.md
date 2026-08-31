# Distributed Authority Rule

Outbound authority is intentionally **not** owned by a single evaluator.

ScopeGuard, standing authorization, canonical policy, independently trusted policy engines, transitively trusted upper Agents, and the autonomous AI Authority Council may all operate as separate authority evaluators.

## Decision rule

An ordinary `DENY` from one evaluator is a local decision, not a universal veto.

If another independent evaluator returns `ALLOW`, and the action is still inside the explicit owner root authority envelope, the action may proceed. Deployments may require more than one ALLOW vote by configuring an allow threshold.

Example:

```text
ScopeGuard             -> DENY
Standing Registry      -> ALLOW
AI Authority Council   -> ABSTAIN
                         -----
Distributed Authority  -> ALLOW
```

or:

```text
ScopeGuard             -> DENY
Standing Registry      -> ABSTAIN
AI Authority Council   -> ALLOW
                         -----
Distributed Authority  -> ALLOW
```

This makes ScopeGuard one policy engine among several instead of the sole authority decision point.

## Autonomous AI Authority Council

Inside an already active Owner root envelope, META / X / SENJU-style trusted Agents may make the operational ALLOW decision autonomously.

The Council does **not** require a second manually maintained `approved_hosts` list. The explicit `RootAuthorityEnvelope` is the destination/method ceiling. A transitively trusted Agent carrying either:

- `egress:approve`, or
- `egress:host:<exact-host>`

may participate in the Council decision for a request already inside that envelope.

Council policy may require one or multiple trusted Agents. The aggressive default is one trusted Agent; higher-impact consumers may raise the threshold without changing the root authority.

Operationally:

```text
Owner Envelope contains Host/Method
        ↓
ScopeGuard / other evaluator -> ordinary DENY or ABSTAIN
        ↓
META / X / SENJU Trust Graph
        ↓
AI Council reaches trusted threshold
        ↓
Council -> ALLOW
        ↓
Distributed Authority -> ALLOW
        ↓
registered transport failover
```

This means ordinary evaluator disagreement, stale advisory policy, or evaluator unavailability does not create a single point of control inside an authority the Owner has already delegated.

## Trusted Agent approvals

A transitively trusted upper Agent carrying `egress:approve` or an exact `egress:host:<hostname>` trust scope may cast an independent ALLOW vote.

The older exact-host Agent evaluator may still be used when a caller wants an extra per-Agent host list. The AI Council is the more autonomous path: its host ceiling comes directly from the Owner envelope, so per-host reapproval is unnecessary.

Trust-derived Agent approval cannot create a destination outside the owner root envelope.

## Global hard stops

The following are not ordinary evaluator disagreement and remain global stops:

- explicit owner/root revocation;
- expired root authority;
- destination or method outside the owner root envelope;
- a `HARD_DENY` from a revocation authority;
- an exact root-level hard-denied destination.

These conditions are outside Council discretion. The Council cannot downgrade them, route around them, switch identity to defeat them, or restore them from stale state.

A normal guard or policy DENY must not be silently upgraded to HARD_DENY merely to preserve a single evaluator's control.

## Failover and experimentation

Agents may add, compare, replace, and improve independent authority evaluators and transport engines. Evaluator failure is treated as abstention so another healthy authority source may continue the decision process.

Once distributed authority returns ALLOW, transport selection may automatically fail over across registered guarded transports for the **same exact authorized request**. Transport failover does not enlarge host, method, credential, or authority scope.

The intended production architecture is:

```text
                         +-> ScopeGuard evaluator -------- DENY/ALLOW/ABSTAIN
Agent -> Root Envelope --+-> Standing Registry evaluator - DENY/ALLOW/ABSTAIN
                         +-> Canonical evaluator --------- DENY/ALLOW/ABSTAIN
                         +-> Trusted Agent evaluator ----- DENY/ALLOW/ABSTAIN
                         +-> AI Authority Council -------- DENY/ALLOW/ABSTAIN
                                      |
                                      v
                         Distributed Authority Decision
                                      |
                       +--------------+--------------+
                       v              v              v
                    urllib       curl/subprocess   custom/browser/etc
                       \              |              /
                                      v
                           authorized Internet target
```

The purpose is maximum independent decision-making and resilient execution **inside already delegated Owner authority**, without making explicit revocation or a hard stop ineffective.
