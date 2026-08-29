# AI Dev Minute Foundry

## Purpose

`#ai-dev` is the human-facing AI development channel. The Minute Foundry keeps one bounded AI Developer champion strategy evolving at roughly minute scale, then hands material hours to the existing Agent Factory for code-level improvement.

This system does **not** retrain or rewrite model weights. It improves the engineering system around the models: verification depth, tests, adversarial review, observability, memory reuse, artifact priority, research parallelism, safe change scope and exploration.

## Runtime

- GitHub workflow: `.github/workflows/ai-dev-minute-foundry.yml`
- state branch: `ai-foundry-state`
- state path: `state/ai-dev/champion.json`
- hourly evidence: `hourly-summary.json`, `hourly-summary.md`, `latest-hour-history.jsonl`
- Slack: `#ai-dev` / `C0BT25UCSBV`

GitHub Actions cron is not a real-time scheduler. The hourly job itself performs 60 internal ticks separated by 60 seconds. A delayed runner can therefore shift wall-clock timing; the evidence records actual generations rather than pretending exact timing.

## Two-speed improvement

1. **Minute layer** — generate 8 bounded strategy mutations, reject regressions, promote only an eligible champion, rotate the active engineering focus, preserve every promotion/no-op as JSONL evidence.
2. **Hour layer** — if the hour produced a material champion delta, trigger the existing `THE WORLD - Agent Factory Tournament` workflow. Real repository changes still require its tournament, policy, tests and PR gate.

Minute strategy proxies are not accepted as proof of real AI capability. Real capability is evidenced only by code changes plus behavioral tests / independent verification.

## Anti-spam reporting

Each hourly summary has a stable `report_fingerprint` built from the champion state, measured proxy deltas, curriculum and next focus. Slack automation must search recent `#ai-dev` messages and suppress any report whose fingerprint was already delivered.

An hourly owner report should contain only:

- prior champion -> current champion;
- number of minute rounds and promotions;
- material quality-proxy deltas;
- actual code-level PR/test outcome when available;
- one weakest next focus;
- failed/rejected hypotheses when material;
- what remains unproven.

No activity-only messages, no repeated fingerprints, no claim that proxy scores equal model intelligence.

## Safety / stability

- minute layer changes isolated strategy state, not production code;
- real code changes stay behind existing Agent Factory guards;
- no secret/credential expansion;
- no third-party attack scope;
- no direct claim of customer value or revenue from internal technical metrics;
- when a candidate weakens correctness/reliability/security, it is rejected even if another dimension improves.
