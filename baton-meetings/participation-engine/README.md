# Music Japan Meeting Participation Engine — v0.1.0

**Scope**: Prototype meeting-join controller for Baton AI Minutes (GitHub Issue #1054). Not production-deployed.

## Working routes

- `browser`: A dedicated, user-approved Playwright profile drives supported Zoom/Google Meet/Teams join controls. Joins require three explicit flags, and host admission is never bypassed. Only a detected in-call Leave control counts as joined. This is an initial heuristic requiring real account acceptance tests.
- `recall`: Direct official Recall Bot Create + Retrieve lifecycle through a selected official region. Requires region/key and `--allow-billable`. A successful create request is NOT considered joined; only `in_call_*` provider status counts.
- `desktop`: Windows OS URL handler opens the supported meeting link; returns `LAUNCHED_UNVERIFIED`, not a success. Desktop UI verification is a future increment.

## Critical limits

- This release has not joined a real meeting. Do not label it production ready.
- The browser adapter now keeps a verified session open while a resident watch observes the in-call control. It allows up to 2 sequential reconnects after confirmed disconnect, closing the old browser before restarting. Real platform E2E is still unverified.
- Browser OAuth/permissions require the user to authorize the dedicated profile. Never use someone else's signed-in profile or bypass a host denial.
- Only stop/fallback on a verified technical failure. A waiting room, host refusal, auth requirement, or uncertain bot state MUST NOT trigger a second simultaneous attendee.
- In-call audio capture and transcription are not yet integrated; an observed audio track count is diagnostic only.
- No recordings, transcripts, paid API requests, external messages, or production deployments occur during tests.

## Use (Windows, local only)

`node --version` should be >=20 and `node --test tests/*.test.mjs` must pass.

`node src/cli.mjs doctor`

To prepare an authorized self-hosted test, put its private HTTPS meeting URL in a file OUTSIDE Git. Example commands:

```powershell
$env:MJ_PLAYWRIGHT_MODULE='C:\path\to\trusted\playwright\index.mjs'
node src/cli.mjs plan --url-file C:\private\meeting-url.txt
node src/cli.mjs join --url-file C:\private\meeting-url.txt --authorized --consent --live --routes browser,recall,desktop --browser-channel msedge
```

Recall additionally requires `RECALL_REGION=ap-northeast-1` (or other official region), `RECALL_API_KEY` and `--allow-billable`.
Do not paste sensitive URLs/API keys into logs or GitHub. Encrypted secret configuration is independent of this prototype.

## Acceptance sequence

1. Validate synthetic route selection and no false-positive joins via `node --test tests/*.test.mjs`.
2. Verify the resident browser lifecycle (session stays open after join; disconnect detection and bounded reconnect) with platform-specific live tests.
3. Join one owner-controlled test Zoom room with permission, confirm attendee in host UI and outbound/inbound media.
4. Repeat with Google Meet and Teams. Confirm waiting room, refused entry, auth expiry, technical failure, and reconnection separately.
5. Link the verified meeting session ID to Baton Minutes and DataHub with tenant isolation, consent provenance, retention and deletion.

**Official references**: https://docs.recall.ai/reference/bot_create ; https://docs.recall.ai/docs/agent-quickstarts ; https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/calls-meetings-bots-overview ; https://developers.google.com/workspace/meet/media-api/guides/overview