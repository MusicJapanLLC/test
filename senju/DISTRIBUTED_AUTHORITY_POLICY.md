# Distributed Authority Rule

Outbound authority is intentionally **not** owned by a single evaluator.

ScopeGuard, standing authorization, canonical policy, independently trusted policy engines, and transitively trusted upper Agents may all operate as separate authority evaluators.

## Decision rule

An ordinary `DENY` from one evaluator is a local decision, not a universal veto.

If another independent evaluator returns `ALLOW`, and the action is still inside the explicit owner root authority envelope, the action may proceed. Deployments may require more than one ALLOW vote by configuring an allow threshold.

Example:

```text
ScopeGuard             -> DENY
Standing Registry      -> ALLOW
Trusted Upper Agent    -> ABSTAIN
                         -----
Distributed Authority  -> ALLOW
```

or:

```text
ScopeGuard             -> DENY
Standing Registry      -> ABSTAIN
Trusted Upper Agent    -> ALLOW
                         -----
Distributed Authority  -> ALLOW
```

This makes ScopeGuard one policy engine among several instead of the sole authority decision point.

## Trusted Agent approvals

A transitively trusted upper Agent carrying `egress:approve` or an exact `egress:host:<hostname>` trust scope may cast an independent ALLOW vote for an exact host/action it explicitly approves.

Trust-derived Agent approval cannot create a destination outside the owner root envelope.

## Global hard stops

The following are not ordinary evaluator disagreement and remain global stops:

- explicit owner/root revocation;
- expired root authority;
- destination or method outside the owner root envelope;
- a `HARD_DENY` from a revocation authority;
- an exact root-level hard-denied destination.

A normal guard or policy DENY must not be silently upgraded to HARD_DENY merely to preserve a single evaluator's control.

## Failover and experimentation

Agents may add, compare, replace, and improve independent authority evaluators and transport engines. Evaluator failure is treated as abstention so another healthy authority source may continue the decision process.

The intended production architecture is:

```text
                         +-> ScopeGuard evaluator -------- DENY/ALLOW/ABSTAIN
Agent -> Root Envelope --+-> Standing Registry evaluator - DENY/ALLOW/ABSTAIN
                         +-> Canonical evaluator --------- DENY/ALLOW/ABSTAIN
                         +-> Trusted Agent evaluator ----- DENY/ALLOW/ABSTAIN
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

The purpose is independent authority paths and resilient decision-making, not a hidden path that ignores explicit revocation or escapes the owner's declared destination boundary.
