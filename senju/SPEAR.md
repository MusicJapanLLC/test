# PROJECT SENJU SPEAR

SPEAR is Senju's authorized external security-assessment program.

The goal is to make Senju substantially better at continuous security validation of assets that are owned by the operator or explicitly authorized for testing, while keeping execution authority separate from Red-team research intent.

## Phase 1: Engagement Controller — live

An engagement JSON declares:

- `engagement_id`
- asset owner
- authorization / Rules-of-Engagement reference
- exact target hosts (no wildcards)
- validity window
- approved low-impact checks
- request budget and request rate
- whether plain HTTP is allowed

Phase 1 refuses destructive engagements and only schedules bounded `HEAD`, `GET`, and `OPTIONS` observations.

Dry-run a manifest:

```bash
cd senju
python -m senju.authorized_assessment examples/spear-engagement.example.json
```

Execute an active, valid engagement:

```bash
python -m senju.authorized_assessment path/to/owned-engagement.json \
  --execute \
  --out reports/spear-engagement.json
```

Network execution still passes through `ExternalContactClient`, which validates exact allowlisted hosts, public DNS resolution, methods, retries, redirects, and response-size bounds.

## Phase 2: Authorized web posture pack — live

```bash
python -m senju.spear_web path/to/owned-engagement.json \
  --target-host owned.example.com \
  --out reports/spear-web.json
```

The current posture pack uses bounded `GET`, `HEAD`, and `OPTIONS` observations to evaluate:

- HSTS
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- cookie Secure / HttpOnly / SameSite posture
- arbitrary CORS origin reflection
- wildcard credentialed CORS posture
- advertised TRACE / PUT / DELETE / PATCH / CONNECT methods
- Server / X-Powered-By disclosure
- `/.well-known/security.txt`
- `/robots.txt`
- cross-host redirects without following them

The pack does not perform credential guessing, auth bypass, exploit delivery, persistence, destructive requests, or lateral movement.

## Phase 3: Regression memory — implemented

`senju.spear_compare` compares consecutive sanitized assessment summaries and records:

- new findings
- resolved findings
- persisting findings
- severity upgrades / downgrades
- HTTP status changes
- response SHA-256 fingerprint changes
- overall risk direction (`better`, `stable`, `worse`)

Raw bodies are not required for regression memory.

## Phase 4: Continuous authorized assessment — implemented

`.github/workflows/senju-spear-continuous.yml` runs every 6 hours.

External assessment only runs when `SENJU_SPEAR_ENGAGEMENT_JSON` is configured as a repository secret. Without it, the workflow performs a network-free example dry-run and records `not_configured` rather than contacting any public target.

When configured, the workflow:

1. runs the focused SPEAR regression suite before network execution;
2. validates the engagement manifest;
3. assesses every exact host in the active engagement;
4. sanitizes evidence before persistence;
5. restores the previous successful sanitized baseline;
6. computes regression changes and risk direction;
7. uploads a 30-day evidence artifact;
8. posts a compact Slack summary when `SLACK_WEBHOOK_URL` is configured.

Persisted evidence intentionally excludes raw response bodies, raw response headers, cookie values, credentials, and authorization-reference text.

## Next phases

1. TLS/certificate metadata and explicit bounded path inventory.
2. Owned-lab active validation using Juice Shop / DVWA / WebGoat adapters; active exploit-chain validation remains lab-only.
3. Deployment-triggered targeted retest rather than schedule-only retest.
4. Multi-agent remediation loop: COVENANT chooses objective, R&D chooses focus, Senju produces evidence, Jules/OpenHands implement fixes, then Senju retests and records whether the finding actually disappeared.

Tracking issue: #238.
