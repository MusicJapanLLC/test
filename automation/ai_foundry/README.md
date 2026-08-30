# AI Dev Minute Foundry

## Purpose

`#ai-dev` is the human-facing AI development channel. The Minute Foundry keeps one bounded AI Developer champion strategy evolving at roughly minute scale. Real repository modification remains exclusively behind the already-reviewed `THE WORLD - Agent Factory Tournament` lane.

This system does **not** retrain or rewrite model weights. It improves the engineering system around the models: verification depth, tests, adversarial review, observability, memory reuse, artifact priority, research parallelism, safe change scope and exploration.

## Runtime

- GitHub workflow: `.github/workflows/ai-dev-minute-foundry.yml`
- state persistence: previous successful Actions evidence artifact
- hourly evidence: `start.json`, `champion.json`, `hourly-summary.json`, `hourly-summary.md`, `history.jsonl`
- Slack: `#ai-dev` / `C0BT25UCSBV`

GitHub Actions cron is not a real-time scheduler. The hourly job itself performs 60 internal ticks separated by 60 seconds. A delayed runner can therefore shift wall-clock timing; evidence records actual generations rather than pretending exact wall-clock timing.

## Two-speed improvement

1. **Minute layer** — generate 8 bounded strategy mutations, reject regressions, promote only an eligible champion, rotate the active engineering focus, preserve every promotion/no-op as JSONL evidence. This lane is read-only to the repository.
2. **Code layer** — the existing `THE WORLD - Agent Factory Tournament` remains the sole autonomous repository forge. Its tournament, policy, tests and PR gate remain authoritative. AI Foundry hourly evidence is an R&D input/reporting signal, not permission to bypass those gates.

Minute strategy proxies are not accepted as proof of real AI capability. Real capability is evidenced only by code changes plus behavioral tests / independent verification.

## Anti-spam reporting

Each hourly summary has a stable `report_fingerprint` built from the champion state, measured proxy deltas, curriculum and next focus. Slack automation must search recent `#ai-dev` messages and suppress any report whose fingerprint was already delivered.

An hourly owner report should contain only:

- prior champion -> current champion;
- number of minute rounds and promotions;
- material quality-proxy deltas;
- actual code-level Agent Factory PR/test outcome when available;
- one weakest next focus;
- failed/rejected hypotheses when material;
- what remains unproven.

No activity-only messages, no repeated fingerprints, no claim that proxy scores equal model intelligence.

## Safety / stability

- Minute Foundry has `contents: read` + `actions: read` only;
- champion continuity is restored from prior evidence artifacts, not a writable state branch;
- minute layer changes strategy state, not production code;
- real code changes stay behind existing Agent Factory guards;
- no secret/credential expansion;
- no third-party attack scope;
- no direct claim of customer value or revenue from internal technical metrics;
- when a candidate weakens correctness/reliability/security, it is rejected even if another dimension improves.
