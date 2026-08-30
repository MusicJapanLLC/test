# PROJECT SENJU SPEAR

SPEAR is Senju's authorized external security-assessment program.

The goal is to make Senju substantially better at continuous security validation of assets that are owned by the operator or explicitly authorized for testing. **Inside an authorized campaign scope, Red-team research intent and execution orchestration are one continuous loop rather than separate authorities.**

`RESEARCH -> EXECUTE -> OBSERVE -> ADAPT -> RETRY`

## Execution authority

Once Owner / BOSS has authorized a live campaign scope, Red may directly orchestrate Senju transport and assessment executors inside that scope without per-step human approval or a separate executor-owner veto.

This removes **role separation inside the authorized scope**. It does not convert third-party or otherwise unapproved assets into authorized targets.

## Phase 1: Engagement Controller — live

SPEAR supports two operating profiles.

### Local / synthetic / isolated owned-lab profile

For network-free dry-runs, synthetic targets, and isolated owned labs, a durable `engagement_id` and validity window are optional metadata. These runs may be created directly from the BOSS objective and local lab configuration.

### Live external profile

For live contact with public external assets, the campaign must still carry machine-readable evidence of authority and a target scope. The current live implementation uses:

- asset owner / authorization or Rules-of-Engagement reference
- target hosts belonging to the authorized campaign
- active authorization window or equivalent standing authorization
- approved action / impact envelope
- request budget and request rate
- whether plain HTTP is allowed

`engagement_id` is an audit identifier, not a separate source of execution authority. The controlling authority is the Owner / BOSS-approved campaign scope.

After that scope is accepted, Red does not need to reacquire permission for every observation, method selection, retry, path choice, or execution step that remains inside the approved envelope.

Dry-run a manifest:

```bash
cd senju
python -m senju.authorized_assessment examples/spear-engagement.example.json
```

Execute an active, authorized engagement:

```bash
python -m senju.authorized_assessment path/to/owned-engagement.json \
  --execute \
  --out reports/spear-engagement.json
```

Network execution passes through `ExternalContactClient`. For live public targets, that transport remains an enforcement layer for the campaign's external authorization scope; it is **not** a separate governance authority over Red. Method, retry, redirect, and response-size settings are execution parameters inside the supported policy envelope rather than a requirement for per-step human approval.

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

The pack does not perform credential guessing, auth bypass, exploit delivery, persistence, destructive requests, or lateral movement against live public targets. Active exploit-chain validation belongs in Arena / synthetic / isolated owned labs unless a separate live scope explicitly authorizes the relevant impact level.

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

External assessment only runs when a live external authority configuration is present. Without one, the workflow performs a network-free example dry-run and records `not_configured` rather than contacting a public target.

When configured, the workflow:

1. runs the focused SPEAR regression suite before network execution;
2. validates the live campaign authority configuration;
3. assesses targets inside the active campaign scope;
4. sanitizes evidence before persistence;
5. restores the previous successful sanitized baseline;
6. computes regression changes and risk direction;
7. uploads a 30-day evidence artifact;
8. posts a compact Slack summary when `SLACK_WEBHOOK_URL` is configured.

Persisted evidence intentionally excludes raw response bodies, raw response headers, cookie values, credentials, and authorization-reference text.

## Phase 5: Depth observation — implemented

Phase 5 increases real-world observation density without creating a second execution authority.

### TLS / certificate pack

`senju.spear_tls` performs one authorized TLS handshake against an HTTPS host in campaign scope and records sanitized metadata:

- negotiated TLS version
- cipher suite
- certificate subject/issuer common name
- certificate expiry time
- SAN DNS count
- near-expiry / expired certificate findings
- legacy TLS finding if an old protocol is negotiated

Raw certificate bytes are not persisted, and the TLS pack sends no HTTP request.

### Bounded same-origin path inventory

`senju.spear_inventory` performs a low-impact inventory inside the host and `base_path` already present in the campaign scope:

1. one bounded `GET` of the engagement base path;
2. parse same-origin links from that HTML only;
3. remove query strings/fragments;
4. reject cross-host links and paths outside `base_path`;
5. skip state-changing-looking paths such as logout/delete/remove/unsubscribe;
6. verify only a small request-budget-limited subset with `HEAD`.

It does not submit forms, authenticate, brute force, guess credentials, deliver exploit payloads, or follow unauthorized cross-host redirects on live public targets.

`.github/workflows/senju-spear-depth.yml` runs every 6 hours on a separate offset. It uses the same live authority source, runs Phase 5 tests before network execution, and persists a sanitized depth signal containing path counts/statuses and TLS metadata/findings only.

## Next phases

1. Deployment-triggered targeted retest rather than schedule-only retest.
2. Owned-lab active validation using Juice Shop / DVWA / WebGoat adapters; active exploit-chain validation remains unrestricted by role separation inside those authorized labs.
3. Multi-agent remediation loop: COVENANT chooses objective, R&D chooses focus, Senju produces evidence, Jules/OpenHands implement fixes, then Senju retests and records whether the finding actually disappeared.
4. Evidence correlation across posture, TLS, path inventory, deployment SHA, and remediation PR.

Tracking issue: #238.
