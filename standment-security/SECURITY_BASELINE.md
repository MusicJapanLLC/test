# Standment Security Baseline

Purpose: turn Standment's own defensive controls into a repeatable, sellable managed IT / security service.

## Service promise

Standment does not sell unauthorized intrusion. The service verifies, hardens, monitors, and documents defensive controls for customer-owned or explicitly authorized systems.

## Baseline scope

1. GitHub / CI-CD
- Protected default branch or ruleset
- Pull request required before production changes
- Required status checks before merge
- Force-push blocked on protected branches
- Workflow permissions explicitly minimized
- Third-party GitHub Actions pinned to immutable commit SHAs where practical
- Secret scanning / push protection reviewed
- Dependency and code scanning reviewed
- Deploy credentials moved to OIDC / short-lived credentials where supported

2. Authentication / authorization
- Proven authentication mechanism
- Tenant / user data access scoped server-side
- Sensitive operations protected by authorization checks
- Integration credentials are revocable and rotated
- Failed authorization and security-relevant events are auditable

3. External input / API security
- Server-side positive validation / allowlists
- Input length and range limits
- Replay / duplicate protection for webhooks and integrations
- Rate limiting / anti-automation controls
- Secure failure behavior
- No secrets or raw credentials in logs

4. Secrets / data protection
- No production secrets committed to repositories
- Secrets stored in managed secret stores
- Logs avoid credentials, tokens, payment data, and unnecessary personal data
- Public repositories contain no customer data or sensitive vulnerability details

5. Backup / recovery
- Backup coverage documented
- Restore procedure documented
- Restore test performed on a defined cadence
- RPO / RTO expectations recorded

6. Monitoring / incident readiness
- Build and runtime failures observable
- Security-relevant events recorded with timestamp, actor/context, event type, and result
- Critical / High findings have an escalation path
- Incident response owner and first actions documented

7. Monthly re-verification
- Re-run applicable controls
- Compare drift from previous month
- Record finding -> evidence -> remediation -> verification -> residual risk
- Deliver a concise customer evidence report

## Verification levels

- PASS: control verified with current evidence
- PARTIAL: control exists but evidence or coverage is incomplete
- FAIL: control absent or verification failed
- N/A: not applicable, with reason

Never mark PASS from configuration intent alone. Require evidence from the live system, test result, repository setting, runtime status, or an equivalent verifiable source.

## Reference framework

Use OWASP ASVS 5.0 as the primary application-security reference where applicable, supplemented by current GitHub security guidance and platform-specific security documentation.

## First internal proof asset

Revenue Recovery AI (`30-nnktft`) is the current internal proving ground. Verified controls already implemented include:
- authenticated per-user application data
- hashed external integration tokens
- source allowlisting for ingest
- server-side event-time validation
- replay / duplicate event protection
- bounded per-user ingest security state
- per-minute accepted-event limiting
- constant-time comparison for stored token hashes
- fail-closed rollback when ingest security state cannot be persisted

Residual risk must still be tracked. The current rate-limit state is application-level and not a substitute for an upstream edge/WAF rate limiter under high-concurrency abuse.
