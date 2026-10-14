# Adversarial Boundary Growth Lab

This is a continuously evolving research environment for authority/credential/stop-boundary failure hypotheses.

## What is deliberately real

- Reads evidence artifacts produced by live production canaries and security workflows.
- Carries a corpus forward between successful runs.
- Mutates and recombines hypotheses every cycle.
- Scores hypotheses using evidence overlap, plausibility, novelty, and severity.
- Runs on a schedule, so the search space continues to change without manual prompting.

## What it searches for

- revoked-authority revival preconditions
- credential propagation/lifetime mismatches
- Emergency/Security Stop ordering and checkpoint weaknesses
- stale checkpoint reauthorization conditions
- delegation/replica scope drift
- redirect and identity confusion
- cache/live-authority split-brain states
- recovery race conditions

## Capability boundary

The lab emits counterexample hypotheses, not action primitives. It cannot automatically promote a hypothesis into a production boundary change. It has no production write permission, no raw secret access, and no authority to clear stop state or restore revoked authority.

That separation is intentional: the search process is allowed to become more varied and evidence-driven over time while any real boundary change remains a separately reviewed operation.
