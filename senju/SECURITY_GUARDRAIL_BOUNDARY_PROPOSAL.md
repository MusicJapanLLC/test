# META / X Security Boundary Proposal Channel

This change set intentionally modifies the autonomous security-boundary change process.

META and X may inspect and autonomously propose changes to safety, external-contact,
authorized-target, credential, GitHub workflow, security-workflow, and audit-policy
surfaces. Production changes remain proposal-only until independently reviewed.

Merge invariants:

- security-boundary proposal != approval
- no direct default-branch write from META/X for protected targets
- no self-approval or self-merge
- exact-head review evidence is required before production promotion
