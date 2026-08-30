# Standment Security Baseline Evidence — Revenue Recovery AI

Verified: 2026-08-29
Asset: Revenue Recovery AI / AppDeploy `30-nnktft`
Scope: defensive review of user-owned production source snapshot; no offensive testing performed.

## Control result: KEEP

### Hypothesis
Revenue/CRM data and external event ingest must not permit unauthenticated tenant access, cross-tenant data selection, trivial token disclosure, or unbounded/replayed external input.

### Verified evidence
- Production deployment status was `ready` with no frontend/backend errors at verification time.
- Authenticated business routes use `requireAuth()` and derive tenant storage from `ctx.user.userId`.
- Tenant-scoped storage namespaces include `deals:<userId>`, `events:<userId>`, `integration_tokens:<userId>`, `ingest_security:<userId>`, and `recovery_outcomes:<userId>`.
- `/api/ingest` is intentionally unauthenticated at the session layer but requires both `x-user-id` and a per-user ingest token.
- Ingest tokens are stored as SHA-256 hashes; comparison uses `timingSafeEqual`.
- External ingest restricts `source` to `gmail`, `calendar`, or `slack`, bounds title/detail lengths, and rejects timestamps more than 10 minutes in the future or 30 days in the past.
- Ingest has a 30 accepted events/minute per-user state limit and rejects duplicate `eventKey` values retained in the recent-key window.
- If ingest security-state persistence fails, the newly written event is deleted and the request fails closed with HTTP 503.

### OWASP ASVS 5.0 alignment
- Authentication / session enforcement: authenticated application routes require platform auth.
- Access control / tenant isolation: authorization context selects tenant-specific storage namespaces server-side.
- Input validation: external source allowlist, bounded strings, numeric bounds, and event-time validation are enforced server-side.
- Cryptographic handling: integration secrets are not stored in plaintext and are compared using a timing-safe primitive.
- Abuse / replay resistance: ingest applies rate limiting, duplicate detection, and fail-closed security-state handling.
- Logging / auditability foundation: accepted external events preserve source, title, detail, occurrence time, creation time, and event key.

### Residual risk
- Replay protection is a bounded recent-key window rather than a durable idempotency ledger; sufficiently old/evicted event keys may become replayable while a valid integration token remains active.
- Rate-limit state is application-managed; concurrent-request atomicity was not proven in this review.
- This evidence is source/configuration verification, not penetration testing.

### Next candidate
Add a durable per-tenant idempotency ledger (or atomic unique-key primitive if supported) for external ingest and verify concurrent replay/rate-limit behavior with owned test fixtures.

## Reusable client evidence template
For Standment client delivery, capture: asset + route/data boundary, identity source, tenant-key derivation, external-ingest authentication, secret-at-rest representation, input allowlists/bounds, rate/replay control, fail-open/fail-closed behavior, verification evidence, residual risk, and remediation owner/date.
