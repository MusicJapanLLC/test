# Standment Security Standard

Version: 0.2
Status: Enforced baseline for Standment-managed web projects

## 1. Purpose

Standment ships web and WebGL products under a default-deny security model. Security is a delivery gate, not a post-release checklist.

The standard maps practical controls to OWASP ASVS 5.0, OWASP Top 10, NIST CSF 2.0, and software-supply-chain practices. Framework names are references; CI evidence and runtime behavior are the source of truth.

## 2. Required gates

A release is eligible for production only when all blocking controls pass.

### S0 — Repository integrity

- No committed secrets or private keys
- GitHub Actions use least privilege
- Third-party Actions are pinned to immutable commit SHAs
- Dependency changes are reviewed
- Dependabot is enabled for supported package ecosystems

### S1 — Application security

- CodeQL/SAST passes for supported languages
- High-severity dependency audit findings block release
- Built browser artifacts contain no credential-like material
- Production source maps are blocked unless an approved exception exists
- Mixed-content and localhost references are blocked

### S2 — Browser and edge security

- HTTPS and HSTS
- Content-Security-Policy with explicit script/connect origins
- `object-src 'none'`
- `base-uri` and `frame-ancestors` restrictions
- MIME sniffing disabled
- Referrer policy present
- Permissions Policy present
- Cross-Origin-Opener-Policy present where compatible

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

## 3. WebGL threat model

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

## 4. Security evidence

Every Standment Security Gate run produces evidence artifacts including:

- WebGL/browser static findings
- Edge policy verification
- CycloneDX component SBOM
- Built-artifact inspection
- Passive production DAST on scheduled/manual/default-branch runs

Evidence is retained by CI for the configured retention period and should be attached or linked to release/incident records when relevant.

## 5. Severity policy

- CRITICAL: release blocked; incident process if already deployed
- HIGH: release blocked
- MEDIUM: review required; tracked remediation or documented acceptance
- LOW: advisory

Exceptions must state owner, reason, scope, compensating control, and expiry date. Permanent silent exceptions are not allowed.

## 6. Incident response minimum

1. Detect and preserve evidence
2. Classify severity and affected assets
3. Contain exposure
4. Revoke/rotate credentials when relevant
5. Patch or roll back
6. Re-run Security Gate and production probe
7. Restore service/data as needed
8. Record root cause and preventive action

## 7. Current Baton baseline

Baton is the initial reference implementation for this standard. It is expected to evolve as Standment adds managed WAF, centralized runtime telemetry, stronger artifact provenance, and customer-facing security reporting.
