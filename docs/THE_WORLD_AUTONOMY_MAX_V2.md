# THE WORLD — Runtime Density v2

## Objective

Increase useful autonomous execution across THE WORLD while reusing the authority
that already exists in each registered worker.

System posture:

`OBSERVE -> ACT -> VERIFY -> LEARN -> EVOLVE`

Routine work should not stop merely because another resident initiated it.

## What changes

### 1. Global resident fanout

`automation/world/autonomy_booster.py` reads the canonical realtime worker plan.
Every current and future worker in that plan is automatically scored for wake-up.
No per-resident integration is required.

### 2. Evolution and research bias

Security validation, Senju, R&D, research, FORGE, SKEPTIC, HOUND, Foundry and
agent-factory lanes receive shorter effective intervals and reserved execution
slots so ordinary operations cannot starve continuous improvement.

### 3. Existing authority is reused

The booster never creates a new target, permission, credential, account, purchase,
contract, or external authority. It only dispatches workflows that are already
registered in `realtime_plan.json` and therefore remain subject to each worker's
existing policy and scope checks.

That means the existing THE WORLD `DEFAULT ACT` posture remains the source of
routine autonomy, while this PR increases how often useful workers get a chance
to execute.

### 4. Defensive security throughput

Security-oriented workers receive the highest scheduling multiplier. Existing
ScopeGuard, SPEAR, authorized-target and workflow-specific boundaries remain in
force. The change here is execution density, not expansion of target authority.

### 5. Runtime behavior

The booster runs every 10 minutes and can wake up to 12 due workers per cycle.
It reserves capacity for security, evolution and research before filling the
remaining slots by score.

The existing realtime kernel remains responsible for recovery and health. This
booster is the pressure layer that increases useful motion and experimentation.

## Success signals

- more due workers execute without owner prompting;
- security/evolution/research lanes receive consistent runtime share;
- verified research findings reach implementation more frequently;
- self-improver/FORGE/Senju loops produce measurable changes rather than only reports;
- owned and authorized security validation is retested more consistently;
- new residents automatically inherit the same runtime scheduling policy.

## Hard boundary

This PR does not create accounts, secrets, money movements, legal commitments,
new permissions, or new third-party security scope. Those effects remain outside
the booster's authority.
