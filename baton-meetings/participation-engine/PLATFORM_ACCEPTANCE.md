# Baton AI Minutes — mandatory 3-platform acceptance (2026-10-18)

## Product completion rule

**Never claim the participation system is complete based on Zoom alone.**
The product must join all three: Zoom, Google Meet, Microsoft Teams.
An authorized, human-reviewed real meeting is required for each platform.

Run `node scripts/check-acceptance.mjs <LOCAL_PRIVATE_EVIDENCE_METADATA>.json` for a **fail-closed metadata checklist**.
It does not independently authenticate the evidence. Never commit meeting links, tokens, audio, private participant data or raw screenshots.

For **each** platform, acceptance requires all of:

1. Approved test meeting with organizer consent and disclosed recording if recording is needed.
2. Human-observed Music Japan AI participant in host's participant list.
3. Actual incoming media evidence, independent of pressing Join.
4. Live session connected for at least 60 seconds; disconnection and end states recorded.
5. Reviewed provenance IDs and timestamped test evidence.
6. Explicit waiting room, denial, OTP, and network recovery cases, with no false joined status.
7. No re-entry attempts after host rejection or organization-policy denial.

## Current state — not production ready

| Platform | Browser implementation | Independent path | Live join evidence |
|---|---|---|---|
| Zoom | Edge and Chrome, in-call observation | Recall.ai optional; Windows Zoom URI opened on owned PC | **NOT VERIFIED** — host view/audio proof missing |
| Google Meet | Edge/Chrome: Join now, Ask to join, waiting room | Recall.ai optional; Windows URL handler is not a separate native Meet client | **NOT VERIFIED** — no owned live admission test completed |
| Teams | Edge/Chrome: Continue on this browser → name → Join now; OTP/lobby detection | Recall.ai optional; Teams installed, native session automation still unverified | **NOT VERIFIED** — no owned live admission test completed |

Owned Zoom test: headless Edge HTTP 403; headed Edge displayed join landing; official app opened through Windows URI. None establishes meeting admission.

## Automated checks

- All three platform-specific mock UI tests must pass.
- Clicking Join is not admissible evidence of having entered a call.
- Waiting-room, OTP, and explicit denial states must not generate a duplicate bot.
- The three-platform acceptance gate MUST remain red without real evidence from all three platforms.
- Browser profiles must be separate per Edge/Chrome and platform.

## Official references

- Google Meet joining: https://support.google.com/meet/answer/9303069
- Teams browser joining: https://support.microsoft.com/en-us/teams/meetings/join-a-meeting-without-an-account-in-microsoft-teams
- Teams desktop deep links: https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links

## Next delivery increments

1. Run an owned Google Meet test meeting, with organizer confirmation and received-media proof.
2. Run an owned Teams test meeting with the same independent evidence.
3. Complete Zoom admission and audio verification.
4. Add native session monitoring and two-device recovery when feasible.
5. Connect only proven sessions to Baton AI Minutes and DataHub, with consent and tenant separation.
