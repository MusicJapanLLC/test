# Baton Meeting Evidence Engine — isolated implementation

**Status: test-only development MVP, not production meeting capture**

This implementation is separate from the deployed Baton Partners frontend. It accepts an already-authorized transcript artifact from Zoom, Google Meet, Teams, or manual input, and produces a **draft requiring human review** with timestamped turn references. No AI summarization/model provider or meeting participation is claimed.

`node --test baton-meetings/tests/*.test.mjs`

`BATON_MEETING_TENANT_KEYS_JSON` must be a JSON mapping of tenant IDs to random operator tokens (32+ characters), supplied in the local process environment; never commit them. Local dev server: `node baton-meetings/src/start.mjs`, bound only to `127.0.0.1:8788`. No listener starts without an explicit tenant mapping.

`POST /api/meetings/import-transcript`: header `Authorization: Bearer <tenant token>`. Input `{provider, workspace_id, meeting_id, consent:{authorized:true,participants_notified:true}, turns:[{source_event_id,speaker_ref,start,end,text}]}`. Each turn requires a timezone-aware timestamp and source ID. Response `201 DRAFT_CREATED`, `200 ALREADY_EXISTS` for exact replay, `409 CONFLICT` for conflicting source under same meeting ID, `403 WORKSPACE_FORBIDDEN` when a token and workspace differ.

`GET /api/meetings/:id` is scoped to the token's tenant, not a client-selected tenant. Both draft and raw artifact remain in **process memory only**, never committed to GitHub, analytics, or shared R&D metadata. Restart loses the data; persistent storage, source retention policy, actual browser UI, authorized meeting capture, async ASR, LLM quality checks and user review flow still require implementation.

Do not deploy this ephemeral server as a public SaaS. The real Baton AI minutes project stays tracked in [Issue #1054](https://github.com/MusicJapanLLC/test/issues/1054).
