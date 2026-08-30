# Standment Security Company Plan

Status: Execution baseline
Owner: Standment

## Mission

Standment becomes an IT and defensive-security company by shipping secure systems and proving security improvements with evidence. The product is not fear, dashboards, or reports alone. The product is reduced operational risk with verified remediation.

## Initial commercial wedge

### Standment Security Baseline

A fixed-scope security hardening engagement for small B2B companies, SaaS teams and web operators.

Core outcome:
- identify the highest-risk exposure in the customer's owned environment
- fix the low-risk/high-confidence items within scope
- provide evidence of what changed
- leave continuous controls running where practical

### Delivery modules

1. GitHub / CI/CD hardening
   - repository visibility/classification
   - branch/ruleset protection
   - CODEOWNERS
   - Actions least privilege and immutable action references
   - dependency/SBOM/security checks
   - secret handling and push protection

2. Web / WebGL hardening
   - browser/edge headers and CSP
   - dependency and artifact inspection
   - WebGL asset/origin/resource-abuse controls
   - passive production verification

3. SaaS / AI application hardening
   - auth and authorization boundaries
   - tenant isolation
   - external input/webhook protection
   - secrets and token lifecycle
   - logging/auditability
   - abuse/rate controls where supported

4. Recovery / operations readiness
   - backup configuration review
   - restore test
   - incident runbook
   - monitoring and escalation path

## Evidence package

Every engagement should end with:
- asset/scope record
- baseline score and prioritized findings
- evidence for each finding
- implemented fixes
- retest result: FIXED / PARTIAL / OPEN
- residual-risk register
- 30-day next-action plan

Claims without evidence are prohibited.

## Product ladder

### A. Baseline Assessment
One-time diagnosis and prioritized remediation plan.

### B. Hardening Sprint
Implementation of agreed defensive controls and retesting.

### C. Continuous Defense
Monthly monitoring, dependency/security-control verification, configuration drift detection, incident readiness and prioritized hardening improvements.

Pricing is not fixed by this document; it must be tested against sales conversion, delivery time, external SaaS cost and verified customer value.

## Internal dogfooding

Before selling a control, Standment applies it to its own assets where technically applicable.

Reference assets:
- GitHub `MusicJapanLLC/test`
- Baton / Standment web properties
- Revenue Recovery AI
- connected deployment and automation infrastructure

Internal weaknesses become product research. Verified internal fixes become reusable delivery playbooks.

## Autonomous improvement loop

Every security iteration uses:

OBSERVE -> RANK -> HYPOTHESIZE -> CHANGE -> VERIFY -> KEEP/REVERT -> RECORD -> REPEAT

Only one highest-leverage safe experiment is selected per autonomous cycle to preserve attribution.

Metrics:
- verified findings discovered
- verified findings fixed
- mean time from finding to fix
- regressions caught before production
- failed experiments / reverted changes
- security automation cycles completed
- percentage of production assets with required gates
- restore tests passed
- customer remediation conversion when commercialized

## Safety boundary

Testing is defensive and limited to owned or explicitly authorized assets. No unapproved third-party exploitation, credential attacks, destructive tests or denial-of-service behavior.

## Current priority backlog

P0
- isolate internal security/revenue/operations code from public repositories
- protect production default branches with rulesets/required checks
- enable secret scanning and push protection
- require strong MFA/passkeys on privileged accounts

P1
- verify backup/restore and RPO/RTO for production data
- add runtime/audit telemetry for production apps
- add replay/dedup/abuse protections to public ingestion surfaces
- centralize vulnerability/remediation evidence

P2
- standard customer security report
- repeatable onboarding/scope authorization template
- service packaging and pricing experiments
- monthly Continuous Defense scorecard
