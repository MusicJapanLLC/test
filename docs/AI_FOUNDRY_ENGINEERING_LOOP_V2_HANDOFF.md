# AI FOUNDRY Engineering Loop V2 — assist-only handoff

This branch is intentionally based on the latest production FOUNDRY branch and does **not** replace the merged execution lane from PR #164.

## Why this exists

PR #164 proved that FOUNDRY can queue work, generate an AI app, run syntax/HTTP checks, commit generated files, wait for Vercel, and report a READY URL.

The remaining development-quality gap is that the current `executor_build.py` is primarily a one-shot compiler from AI specification -> fixed deployable assistant template.

Engineering Loop V2 adds the missing bounded coding loop:

`development request -> generate multi-file candidate -> run real commands -> HTTP smoke -> feed failure evidence back to AI -> replace failing files -> rerun -> VERIFIED`

## Added assets

- `automation/ai_foundry/engineering_loop.py`
  - compiles a development request into real project files
  - supports up to 16 generated files / bounded output size
  - executes local validation commands on Ubuntu
  - removes common secret/token environment variables before executing generated project commands
  - blocks shell chaining/redirection and publish/deploy/login actions
  - runs an HTTP smoke test for browser applications
  - feeds actual command stderr/stdout and smoke evidence back into the repair model
  - performs up to 3 repair rounds
  - emits structured per-round evidence and returns non-zero unless verification passes

- `tests/test_ai_foundry_engineering_loop_v2.py`
  - path traversal tests
  - command-policy tests
  - secret-env scrubbing tests
  - verification truth tests

- `tests/engineering_loop_fault_canary.py`
  - canary-only fault injector
  - deliberately appends an invalid JavaScript statement to the first generated JS file
  - proves the repair loop fixes observed execution failure rather than merely succeeding on an easy first generation

- `.github/workflows/ai-foundry-engineering-loop-v2.yml`
  - isolated `contents: read` canary
  - no repository write permission
  - no OIDC permission
  - normal generation canary + forced-failure self-repair canary

## Verified evidence

GitHub Actions run: `33300913688`

Runner: Ubuntu 24.04 / Python 3.12.

### Deterministic boundary tests

8/8 tests passed.

### Normal real-development canary

Request: build a dependency-free browser Pomodoro timer with Start/Pause/Reset, work/break switching, accessibility, keyboard controls, responsive layout and local browser state.

Result:

- generated files: `index.html`, `app.js`
- real validation command executed
- real localhost HTTP smoke executed
- `verified=true`
- repair rounds: `0`

### Forced-failure repair canary

Request: build a dependency-free browser habit tracker.

The canary deliberately injected:

`const = ; // AI_FOUNDRY_FORCED_CANARY_FAULT`

Observed result:

- round 0: FAILED as intended
- repair model root cause: `Syntax error in app.js caused by a forced canary fault line.`
- replaced file: `app.js`
- round 1: PASSED
- final `verified=true`
- repair rounds used: `1`

This proves the loop can consume real execution failure evidence and repair code before reporting success.

## Integration recommendation

Do not replace the existing production executor immediately.

Recommended adoption order:

1. Keep PR #164 execution ledger / OIDC claim / Vercel READY verification unchanged.
2. Add an execution mode field: `assistant_template` vs `engineering_loop_v2`.
3. Route general software-development requests through `engineering_loop.py` in a read/no-secret build job.
4. Only after `verified=true`, move selected files into the publish job that has repository write authority.
5. Keep AI-generated command execution isolated from the job that holds GitHub write/OIDC credentials.
6. Add browser-level visual/E2E verification as the next quality gate.

## Definition of done for the next production upgrade

A general software task should be able to show this evidence chain:

`request -> generated files -> command evidence -> failing test if present -> AI repair -> passing retest -> preview URL -> browser verification -> auditable branch/PR or approved publish`

The production FOUNDRY should not call a software task complete merely because code was generated.
