# PROJECT SENJU SPEAR

SPEAR is Senju's authorized external security-assessment program.

The goal is to make Senju substantially better at continuous security validation of assets that are owned by the operator or explicitly authorized for testing, while keeping execution authority separate from Red-team research intent.

## Phase 1: Engagement Controller

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

## Current check pack

- `reachability`: bounded `HEAD` request to the declared base path
- `root_snapshot`: bounded `GET` plus body hash/size evidence
- `security_txt`: fetch `/.well-known/security.txt`
- `robots_txt`: fetch `/robots.txt`
- `options`: low-impact `OPTIONS` observation

Every run emits machine-readable evidence containing the engagement ID, authorization reference, manifest SHA-256, exact contacted hosts, request count, provider status, response fingerprints, and timestamps.

## Next phases

1. Web posture pack: TLS/certificate metadata, security headers, cookie flags, cache/CORS posture and explicit path inventory.
2. Owned-lab active validation: Juice Shop / DVWA / WebGoat adapters and lab-only exploit-chain verification.
3. Continuous assessment: deployment-triggered retests, diff-only campaigns, severity/confidence scoring and Slack evidence.
4. Multi-agent loop: COVENANT chooses objective, R&D chooses focus, Senju tests, Jules/OpenHands implement fixes, Senju retests and closes the loop.

Tracking issue: #238.
