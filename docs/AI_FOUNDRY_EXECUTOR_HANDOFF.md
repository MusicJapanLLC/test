# AI FOUNDRY Sandbox Executor — assist-only handoff

This patch is intentionally isolated from the existing AI FOUNDRY chat/build/runtime implementation.

It adds one sidecar endpoint: `POST /api/develop`.

## What changes

The existing FOUNDRY can already discuss AI development, compile a conversation into an AI specification, smoke-test that specification, and issue a generated-agent URL.

The new executor adds an actual engineering workbench backed by Vercel Sandbox:

- create/edit files inside an isolated workspace
- inspect files
- run shell commands
- install dependencies
- run build/test/lint/smoke commands
- retry after failures
- return an execution trace and final file manifest

No existing `api/foundry.js`, `public/app.js`, or UI file is changed by this patch.

## Runtime contract

`POST /api/develop`

```json
{
  "task": "Build a minimal Node.js API with one /health route, add tests, and run them.",
  "maxSteps": 12,
  "seedFiles": [
    {
      "path": "README.md",
      "content": "Existing project context"
    }
  ]
}
```

Response includes:

- `text`: final engineering summary from the coding agent
- `events`: file/command execution evidence
- `files`: final workspace manifest
- `verification.commandsRun`
- `verification.successfulCommands`
- `verification.failedCommands`

## Conditions required for real execution

1. The deployed Vercel project must be allowed to create Vercel Sandbox sessions.
2. AI Gateway/model access must be available to the function. The current FOUNDRY already uses `openai/gpt-5.6-sol`, so this sidecar reuses the same model route.
3. Vercel must install `@vercel/sandbox` and `zod` from `package.json` during the deployment build.
4. The sandbox receives no application secrets from this endpoint. Package installation/network access happens inside the isolated sandbox.
5. If the current Vercel plan/function-duration limits are insufficient, keep the endpoint contract and move only the executor runtime to a worker/container plan. Do not rewrite the FOUNDRY UI/core just to change compute.

## Recommended integration order

### Phase 1 — prove the hand

Deploy this branch as Preview and call `/api/develop` directly with a tiny build-and-test task. Success means there is evidence of at least one file write and one real command execution.

### Phase 2 — connect the existing UI

Add a separate `EXECUTE IN SANDBOX` action beside the current build pipeline. Do not replace the current `BUILD -> SMOKE -> generated AI URL` pipeline.

### Phase 3 — repository handoff

After sandbox execution is stable, add an explicit GitHub publish tool that can create a branch/commit/PR from selected generated files. Keep repository writes separate from arbitrary sandbox command execution so auditability stays clean.

### Phase 4 — deploy verification

For app-building tasks, let the agent produce a candidate branch, trigger Preview deployment, then inspect build/runtime results before proposing merge.

## Definition of done

The feature is not considered working merely because the model returns code.

A passing vertical slice must show:

`user task -> model tool call -> sandbox file write -> real command -> test/build evidence -> final report`

That is the boundary between an AI that *describes development* and an AI that *performs development*.
