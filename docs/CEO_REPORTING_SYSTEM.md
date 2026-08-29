# CEO Reporting System

## Purpose

The engineering factory can only be considered useful when verified work is translated into owner-visible outcomes.

This reporting layer separates raw engineering evidence from CEO communication.

## Roles

### 1. Builders
AI Engineer, Security Agent, Revenue Ops, SRE, Research Scout and other workers create changes, tests, evidence and operational events.

They do **not** report raw logs directly as the main CEO interface.

### 2. Evidence Layer
GitHub PRs / commits / Actions, Supabase run logs, deployment status and Slack operational channels are the evidence source of truth.

Unverified claims, plans and generated text are not counted as completed work.

### 3. AI Factory CEO Reporter
The Reporter translates verified evidence into plain Japanese for the owner.

Every report answers only these questions:

1. **何を作った？**
2. **何に使える？**
3. **何が前より良くなった？**
4. **いま本当に動いている？**
5. **売れる／経営に効く？**
6. **次に何を改善する？**
7. **社長がやることはある？**

## Output Contract

Each project update should use this format:

### [Project name]
- 状態: RUNNING / VERIFIED / BUILDING / BLOCKED / EXPERIMENT
- 作ったもの:
- 用途:
- 今回の成果:
- 証拠:
- 経営メリット:
- 次の改善:
- Owner action: NONE or one concrete action

## Notification Routing

- `#ai-dev`: technical incidents, CI/security details, engineering evidence
- `#ai-mail`: email/inbox operations
- `#ai-calendar`: calendar events
- `#ai-command-center`: operational coordination and raw agent summaries
- `#ai-ceo-brief`: **owner-facing final reports only**

The CEO channel must not become a log stream. Post only material outcomes, product milestones, critical blockers and twice-daily executive summaries.

## Portfolio Rule

`PORTFOLIO.md` is the human-readable index of what the AI factory has actually built.

A project enters the portfolio only when at least one concrete artifact exists. The reporter must distinguish:

- VERIFIED: implemented and validated with evidence
- BUILDING: concrete artifact exists but final verification/merge/deploy is incomplete
- EXPERIMENT: prototype/lab result only
- BLOCKED: work exists but a dependency prevents useful operation

Plans without artifacts do not enter the portfolio as completed work.

## Anti-noise Rule

Do not report commit counts as outcomes by themselves. Convert implementation into business meaning.

Bad:
> 8 commits, 1,200 additions, workflow updated.

Good:
> 会社内の人物・案件を表記揺れ込みで同一人物として検索できる Company Memory v1 を構築。営業前に過去履歴を探し直す時間を減らせる。現在は本番Supabaseで検索・更新監査まで実測済み、GitHub側は公開repoのためDraft運用。

## Definition of Done for the Reporting Layer

The reporting system is working only when:

- owner-facing summaries arrive in `#ai-ceo-brief`
- the owner is explicitly mentioned on material reports
- `PORTFOLIO.md` reflects verified project status
- technical logs remain outside the CEO channel
- every claimed result links back to evidence
- blockers are described in plain language
