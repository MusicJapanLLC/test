# Senju AI Advisor Policy

Senju has two standing AI development resources:

- Standment Personal AI Core: https://standment-personal-ai-core-se1c3z.v2.appdeploy.ai/
- AI FOUNDRY Forge V2: https://test-git-feat-ai-foundry-forge-v2-musicjapanllc.vercel.app/

## Standing rule

1. Senju may ask these AIs any question that could help it understand, design, test, improve, debug, document, observe, or operate its own system and owner-controlled development resources.
2. Questions are not limited to the current simulator knobs. They may cover architecture, algorithms, agent behavior, research methods, testing, reliability, observability, UX, developer tooling, performance, maintainability, defensive security, product design, and adjacent engineering topics.
3. Advice is input, not proof. A recommendation is not treated as implemented, tested, deployed, or successful until there is execution evidence.
4. Senju is permitted to turn advisor output into code changes. The preferred path is:

   `Personal AI Core advice -> AI FOUNDRY synthesis -> Repo Engineer patch -> sandbox tests/repair -> pull request -> review/merge`

5. Automatic implementation is limited to Senju's own repository/project code and owner-controlled development resources. It must not silently widen third-party target scope, introduce credentials, weaken authorization boundaries, or claim external effects without verification.
6. Keep automatic changes small and reviewable. One focused implementation candidate is preferred over broad rewrites.
7. If an advisor is unavailable, the daily Senju run continues without fabricating an answer. If AI FOUNDRY synthesis is unavailable, automatic code promotion is skipped for that run.
8. Advisor failures, recommendations, implementation decisions, tests, repair results, and pull-request URLs are evidence and should be preserved in the daily evolution artifacts and owner report.

## Role split

### Standment Personal AI Core

Primary role: broad senior advisor and second opinion.

Use it to challenge assumptions, propose improvements, identify weak spots, suggest experiments, and produce implementation-oriented recommendations. Senju should reuse it proactively rather than waiting for a human to remember that it exists.

### AI FOUNDRY Forge V2

Primary role: implementation gate and engineering executor.

Use it to synthesize the current Senju evaluation with advisor feedback, decide whether a change is concrete enough to implement, generate a focused repository patch, run bounded tests, repair failures, and open a pull request when verification succeeds.

## Evidence standard

The following labels are distinct:

- **ADVISED** — an AI recommended it.
- **PLANNED** — Senju selected it as an implementation candidate.
- **PATCHED** — code was actually changed in the ephemeral worktree.
- **VERIFIED** — allowed tests completed successfully.
- **PR OPENED** — a reviewable branch and pull request were created.
- **MERGED/DEPLOYED** — only after the corresponding GitHub/deployment evidence exists.

Do not collapse these states into one claim.
