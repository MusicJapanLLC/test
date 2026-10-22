# Music Japan Meeting Participation Engine — v0.1.0

**Scope**: Prototype meeting-join controller for Baton AI Minutes (GitHub Issue #1054). Not production-deployed.

## Required product coverage — all three are mandatory

| Platform | Implemented browser controls | Approval/identity states | Verified real meeting join |
| --- | --- | --- | --- |
| Zoom | Join from browser / Join | Denied and waiting room | **NOT YET** |
| Google Meet | Join now / Ask to join / guest name | Host admission kept alive, refusal, sign-in requirement | **NOT YET** |
| Microsoft Teams | Continue on this browser / Join now / guest name | Lobby kept alive, host refusal, organization OTP/sign-in | **NOT YET** |

Missing any of these three is a release blocker. Mocked tests are not real meeting admission.

## Working routes

- `edge` / `chrome`: Independent approved Playwright browser profiles. Each has platform-specific joining controls. A detected in-call Leave control is preliminary UI admission evidence; real audio/video attendance still needs platform-specific validation.
- `recall`: Direct official Recall Bot Create + Retrieve lifecycle through a selected official region. Requires region/key and `--allow-billable`. A successful create request is NOT considered joined; only `in_call_*` provider status counts.
- `desktop`: Windows OS URL handler opens the supported meeting link; returns `LAUNCHED_UNVERIFIED`, not a success. Desktop UI verification is a future increment.

## Critical limits

- This release has not joined a real meeting. Do not label it production ready.
- The browser adapter retains an admitted session and monitors it. Google Meet/Teams lobby requests remain open while the host admits the participant; they are **never** considered joined prematurely. Up to 2 sequential reconnects are permitted only on confirmed technical disconnect. Real platform E2E remains unverified.
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
node src/cli.mjs join --url-file C:\private\meeting-url.txt --authorized --consent --live --routes edge,chrome,recall,desktop
```

Recall additionally requires `RECALL_REGION=ap-northeast-1` (or other official region), `RECALL_API_KEY` and `--allow-billable`.
Do not paste sensitive URLs/API keys into logs or GitHub. Encrypted secret configuration is independent of this prototype.

## Acceptance sequence

1. Validate synthetic route selection and no false-positive joins via `node --test tests/*.test.mjs`.
2. Verify the resident browser lifecycle (session stays open after join; disconnect detection and bounded reconnect) with platform-specific live tests.
3. Join an owner-controlled Zoom test room, independently verify admission, participant listing, actual audio reception and session longevity.
4. Join an owner-controlled Google Meet test room, verify signed-in and guest-request behavior, host approval, audio reception, reconnection and exit.
5. Join an owner-controlled Microsoft Teams test room, verify browser interstitial, lobby, conditional identity check, audio reception, reconnection and exit.
6. Do not release unless **all three** meet an end-to-end admission-and-media acceptance matrix.
7. Link the verified meeting session ID to Baton Minutes and DataHub with tenant isolation, consent provenance, retention and deletion.

**Official references**: https://docs.recall.ai/reference/bot_create ; https://docs.recall.ai/docs/agent-quickstarts ; https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/calls-meetings-bots-overview ; https://developers.google.com/workspace/meet/media-api/guides/overview