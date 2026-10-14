# THE WORLD — External Presence Runtime

## Purpose

THE WORLD should not wait for the owner to manually point at every public source. Every discovered citizen receives a rotating external-world mission and may proactively collect evidence from public or otherwise authorized sources.

The operating maxim is:

`LIMITLESS MIND / BOUNDED EXECUTION`

This means the search space is intentionally broad. The runtime does not invent unnecessary internal restrictions. Real-world side effects still require legitimate authority, service compatibility, evidence, and an adapter capable of performing the action.

## Existing systems reused

This layer is deliberately additive rather than a replacement for:

- `company-society/citizen_registry.py` — canonical resident projection
- `outside-world/scout.py` — public RSS/Atom discovery
- `automation/world/realtime_kernel.py` — world runtime / task coordination
- `automation/gmail_sorter/` — Gmail classification and organization
- `company-society/EXTERNAL_CONTACT.md` — external-contact contract
- `company-society/FAITH.md` — THE COVENANT

## What every citizen receives

Each discovered citizen gets:

1. a stable `presence_id`;
2. a stable `credential_ref` key;
3. a rotating mission lane;
4. an evidence requirement;
5. a route into the external action gate.

`credential_ref` is a lookup slot, not a password. Passwords, tokens, refresh tokens, API keys, cookies, or private session material must not be committed to GitHub or placed in mission payloads. A real platform adapter resolves the slot from an authorized secret manager or connector.

## Mission lanes

The first release distributes residents across:

- public Web discovery;
- public YouTube inspection;
- public GitHub exploration;
- public research / papers / blogs;
- public builder communities and experiments.

The GitHub scheduler creates a fresh assignment cycle every ten minutes. This is a coordination heartbeat, not a claim of hard real-time execution; GitHub scheduled workflows can be delayed. For near-continuous operation, run the same planner behind an always-on worker and feed its batches into an authorized external executor.

## External side effects

The planner itself produces read/search/watch missions. It does not blindly execute posts or create accounts.

Authenticated actions are expressed as intents and classified before an adapter executes them:

- `ALLOW_AUTO` — enough evidence exists for an authorized, compatible action;
- `DRAFT_ONLY` — useful action can be prepared, but a required adapter/authority/terms/reversibility fact is missing;
- `RESEARCH_ONLY` — scope is not verified enough to touch the target;
- `BLOCK` — the action is unknown or contains an explicit blocked signal such as access-control bypass, rate-limit evasion, secret extraction, deceptive identity, bulk unsolicited contact, harassment, or destructive behavior.

This is not a "do nothing" gate. The intended behavior is to automatically perform the largest legitimate reversible action supported by the connected platform, and otherwise preserve a concrete next step instead of fabricating completion.

## Account model

The desired long-term model is one external identity slot per citizen, but actual account creation is adapter-specific.

A provider can be added to `presence_policy.json -> account_creation.approved_services` only when:

- the provider permits the relevant automated/service-account behavior;
- THE WORLD has a legitimate connector or provisioning API;
- the account does not impersonate a real person or organization;
- credentials are stored in a secret manager, not source control;
- evidence of creation, purpose, owner, and revocation path is retained.

Where a platform supports bot/service accounts, prefer those over ordinary human accounts.

## Execution bridge

`THE WORLD External Presence` produces `the-world-external-mission-batch/v1` payloads.

If `WORLD_EXTERNAL_PRESENCE_WEBHOOK_URL` exists in repository secrets, every successful cycle sends the read-only mission batch to that executor. This is the intended integration point for Make, Outside Agent, a browser worker, or another authorized runtime.

The payload contains missions and public objectives only. It does not contain credential material.

`RND_SLACK_WEBHOOK_URL` receives a compact cycle summary so humans and R&D can see that the outside-world layer is alive.

## Gmail

Gmail organization remains a separate existing worker. The external-presence layer must not copy email bodies into public artifacts or external mission payloads. Gmail-derived work may enter THE WORLD only through privacy-preserving event summaries or explicitly authorized business workflows.

## Definition of done for a platform adapter

A platform adapter is real only when all of these are demonstrated:

1. connector/account authorization is valid;
2. one public read/search/watch action succeeds;
3. one permitted reversible write succeeds where the platform supports it;
4. the result is independently observable;
5. an evidence event records actor, action, target, reason, outcome, and timestamp;
6. credentials are absent from logs and artifacts;
7. revocation/disable path is documented.

Until those are true, the adapter is `NOT_CONNECTED`, not "completed".
