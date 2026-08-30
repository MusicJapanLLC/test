# Standment Security Standard

Version: 0.3
Status: Enforced baseline for Standment-managed systems and security delivery

## 1. Purpose

Standment ships web, WebGL, AI/automation and managed IT products under a default-deny security model. Security is a delivery gate, not a post-release checklist.

The standard maps practical controls to OWASP ASVS 5.0, OWASP Top 10, NIST CSF 2.0, and software-supply-chain practices. Framework names are references; CI evidence and runtime behavior are the source of truth.

## 2. Scope and authorization

- Active testing is limited to Standment-owned assets, localhost/lab targets, or customer assets with explicit written authorization and a defined scope.
- Third-party systems are never scanned, exploited, credential-tested, or stress-tested without authorization.
- Production testing defaults to passive or non-destructive methods.
- Security findings, credentials, customer data, internal architecture, incident evidence and revenue/operations data belong in private systems only.

## 3. Repository and identity baseline

### R0 — Repository classification

Every repository is classified before use:

- PUBLIC: intentionally publishable source only; no customer, security-operations, revenue-operations or incident data.
- INTERNAL: company source, runbooks, automation and non-customer operational data.
- RESTRICTED: customer data, incident evidence, credentials, sensitive security research or regulated data.

PUBLIC repositories must not become the long-term home of internal security/revenue/operations systems.

### R1 — Default branch protection

Production repositories require:

- protected default branch or an enforced repository ruleset
- pull request review before merge for security-critical paths
- required security/build checks before merge
- deletion/force-push restrictions
- CODEOWNERS for security-critical paths
- signed/verified changes where supported

### R2 — Identity and credentials

- MFA/passkey required for privileged engineering accounts
- Prefer short-lived/OIDC credentials over long-lived tokens
- PAT, SSH key, OAuth app and service-account access is reviewed regularly
- Least privilege for GitHub Actions and deployment identities
- Real credentials never enter source, issues, chat logs or build artifacts
- Secret scanning and push protection enabled where the platform supports them

## 4. Required release gates

A release is eligible for production only when all blocking controls pass.

### S0 — Repository integrity

- No committed secrets or private keys
- GitHub Actions use least privilege
- Third-party Actions are pinned to immutable commit SHAs
- Dependency changes are reviewed
- Dependabot is enabled for supported package ecosystems
- Build/deploy privileges are separated where practical

### S1 — Application security

- CodeQL/SAST passes for supported languages
- High-severity dependency audit findings block release
- Built browser artifacts contain no credential-like material
- Production source maps are blocked unless an approved exception exists
- Mixed-content and localhost references are blocked
- Authentication, authorization and tenant-isolation boundaries are tested for state-changing routes
- External ingestion endpoints validate authentication, input size/type and replay/duplicate behavior where relevant

### S2 — Browser and edge security

- HTTPS and HSTS
- Content-Security-Policy with explicit script/connect origins
- `object-src 'none'`
- `base-uri` and `frame-ancestors` restrictions
- MIME sniffing disabled
- Referrer policy present
- Permissions Policy present
- Cross-Origin-Opener-Policy present where compatible
- Rate/abuse controls on externally reachable state-changing endpoints where the hosting platform permits them

### S3 — WebGL security

- Browser/client state is never an authorization boundary
- WebGL assets are treated as untrusted parser input when externally supplied
- Remote texture/model origins require an explicit allowlist
- Runtime string-to-code execution (`eval`, `new Function`) is forbidden
- Wildcard `postMessage` targets are forbidden
- Large GLB/GLTF/HDR/KTX assets are budgeted before release
- Renderer pixel ratio and frame loops must be bounded to reduce GPU exhaustion risk
- `preserveDrawingBuffer` is disabled unless documented and reviewed
- Context-loss handling is required for long-lived/critical WebGL experiences

### S4 — Data, recovery and observability

- Data ownership and sensitivity are documented
- Production data is isolated by customer/tenant as applicable
- Backups are configured for business-critical data and restoration is tested, not assumed
- RPO/RTO targets exist for customer-facing managed systems
- Security-relevant events are logged without storing secrets
- Alerting identifies authentication failures, deployment regressions and material runtime failures where supported
- Deletion/retention follows the customer contract and internal data classification

## 5. WebGL threat model

### Trust boundaries

1. Internet -> CDN/edge
2. Browser -> application JavaScript
3. DOM/user input -> rendering and scene state
4. Application -> third-party analytics
5. Application -> form/API endpoint
6. Asset origin -> loaders/parsers/GPU
7. CI dependencies -> production bundle

### Primary threats

- DOM XSS leading to session/data compromise
- Malicious or oversized 3D/texture assets causing parser or GPU resource exhaustion
- Cross-origin asset misuse and canvas tainting
- Client-side authorization or price/state tampering
- Runtime-generated shader/code paths derived from untrusted input
- Dependency or GitHub Actions supply-chain compromise
- Accidental source map, secret, or development-file exposure
- Weak browser policies allowing framing, injection, or unnecessary device capabilities

### Required mitigations

- Server-authoritative security decisions
- CSP and explicit origin allowlists
- Asset size/dimension/count budgets
- Fixed shader programs or strongly constrained inputs
- Safe DOM APIs for untrusted text
- Locked dependencies and SBOM evidence
- Passive production DAST after deployment
- Centralized incident evidence and reproducible builds

## 6. Customer security delivery baseline

A Standment security engagement must produce evidence, not only advice. Minimum deliverables are selected by scope from:

- asset and trust-boundary inventory
- repository/CI/CD hardening evidence
- secret and dependency exposure review
- web/browser/edge policy review
- authentication/authorization/tenant-boundary review
- backup and restore verification
- monitoring/incident-readiness review
- prioritized findings with severity, evidence, remediation and retest status
- customer-facing final report separating verified facts from assumptions

No finding is marked fixed until a retest or equivalent verification succeeds.

## 7. Security evidence

Every Standment Security Gate run produces evidence artifacts where applicable including:

- WebGL/browser static findings
- Edge policy verification
- CycloneDX component SBOM
- Built-artifact inspection
- Passive production DAST on scheduled/manual/default-branch runs
- remediation/retest status

Evidence is retained by CI for the configured retention period and should be attached or linked to release/incident records when relevant. Sensitive evidence is stored only in private/restricted systems.

## 8. Severity and remediation policy

- CRITICAL: release blocked; immediate containment/incident process if deployed
- HIGH: release blocked; remediation prioritized before release
- MEDIUM: tracked remediation or documented time-bound acceptance
- LOW: advisory / backlog

Target remediation windows for managed systems are defined in the service contract. Exceptions must state owner, reason, scope, compensating control, and expiry date. Permanent silent exceptions are not allowed.

## 9. Incident response minimum

1. Detect and preserve evidence
2. Classify severity and affected assets
3. Contain exposure
4. Revoke/rotate credentials when relevant
5. Patch or roll back
6. Re-run Security Gate and production probe
7. Restore service/data as needed
8. Record root cause and preventive action
9. Validate the preventive control in a later run

## 10. Autonomous improvement rule

Standment security automation may autonomously research, create issues, add tests, improve CI checks, harden safe configuration, create branches/PRs, validate and revert low-risk changes on owned assets.

It must not autonomously expose secrets, weaken security controls, perform destructive production actions, attack unapproved systems, contact customers as if authorized, move money, or silently accept a CRITICAL/HIGH risk.

Every autonomous cycle must end with evidence-backed `KEEP`, `REVERT`, `BLOCKED`, or `NO MATERIAL CHANGE`.

## 11. Current reference implementation

Baton and Revenue Recovery AI are initial reference implementations for this standard. The baseline will evolve toward managed WAF/edge controls, centralized runtime telemetry, stronger artifact provenance, private internal engineering repositories, tested recovery, and customer-facing security reporting.
