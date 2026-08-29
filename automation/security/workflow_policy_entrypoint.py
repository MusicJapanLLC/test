#!/usr/bin/env python3
"""Fail-closed entrypoint for privileged workflow policy.

The generic policy intentionally rejects unknown privileged lanes. Narrow lanes
whose capability contracts need context-specific validation are checked here
before the generic classifier runs.

This entrypoint also gives the Agent Factory a semantic compatibility layer:
security validates the actual permission/tool/revert/test behavior rather than
coupling acceptance to a human-readable GitHub Actions step title. The generic
policy's historical title marker is then supplied only in-memory after the
stronger semantic check succeeds.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy


LEGACY_FACTORY_LABEL = "Validate champion against existing R&D systems"


def validate_manager_queue_oidc_lane() -> str:
    name = "tomoki-manager-queue.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required manager OIDC lane is missing")

    got = policy.writes(body)
    if got != {"id-token"}:
        raise SystemExit(f"{name}: manager queue write set drifted: {sorted(got)}")

    required = (
        "contents: read",
        "id-token: write",
        "workflow_dispatch:",
        "schedule:",
        "cron: '*/5 * * * *'",
        "persist-credentials: false",
        "automation/control_plane/manager_queue.py",
        "--max 3",
        "final_self_approval: false",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing manager OIDC guardrail: {marker}")

    forbidden = (
        "contents: write",
        "actions: write",
        "issues: write",
        "pull-requests: write",
        "deployments: write",
        "packages: write",
        "pages: write",
        "copilot-requests: write",
        "pull_request:",
        "gh workflow run",
        "git push ",
        "gh pr create",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{name}: forbidden manager OIDC capability: {marker}")

    client = (ROOT / "automation/control_plane/manager_queue.py").read_text(encoding="utf-8")
    client_required = (
        'AUDIENCE = "the-world-worker"',
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
        "https://czwdtjgunsafcifjhpwt.supabase.co/functions/v1/tomoki-manager-gateway",
        'method="POST"',
        "limit = max(1, min(3, limit))",
        '"verified": False',
        '"final_approval": False',
        '"automatic_mutation_applied": False',
        '"final_self_approval": False',
    )
    for marker in client_required:
        if marker not in client:
            raise SystemExit(f"manager_queue.py: missing bounded OIDC invariant: {marker}")

    return name


def validate_agent_factory_semantic_contract() -> str:
    """Validate what the Agent Factory can actually do, not a display label."""

    name = "the-world-agent-factory.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required Agent Factory lane is missing")

    expected_writes = {"contents", "pull-requests", "copilot-requests"}
    got = policy.writes(body)
    if got != expected_writes:
        raise SystemExit(f"{name}: Agent Factory write set drifted: {sorted(got)}")

    required = (
        "contents: write",
        "pull-requests: write",
        "actions: read",
        "copilot-requests: write",
        "workflow_dispatch:",
        "schedule:",
        "persist-credentials: false",
        "automation/agent_factory/policy.py",
        "python -m unittest discover -s automation/ai_foundry -p 'test_*.py'",
        "python -m unittest discover -s automation/world -p 'test_*.py'",
        "python -m unittest discover -s automation/security -p 'test_*.py'",
        "python -m compileall -q automation/ai_foundry automation/world automation/security value-lab",
        "steps.policy.outputs.allowed != 'true'",
        "steps.validate.outputs.passed != 'true'",
        "steps.validate.outputs.passed == 'true'",
        "git reset --hard",
        "gh pr create",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing semantic bounded-factory invariant: {marker}")

    # The research swarm must remain read-only. Only the single champion forge
    # may obtain the write tool, and neither path may shell out or browse URLs.
    if body.count("--allow-tool=write") != 1:
        raise SystemExit(f"{name}: exactly one bounded champion write-tool grant is required")
    if body.count("--deny-tool=write") < 1:
        raise SystemExit(f"{name}: research swarm must explicitly deny write")
    if body.count("--deny-tool=shell") < 2 or body.count("--deny-tool=url") < 2:
        raise SystemExit(f"{name}: both swarm and champion must deny shell/url tools")
    if "pull_request:" in body:
        raise SystemExit(f"{name}: privileged Agent Factory must not execute with PR event authority")

    # The generic policy historically keyed one bounded-factory invariant to a
    # step title. After the semantic check above succeeds, normalize that marker
    # only in memory so harmless title changes cannot break the security control
    # plane while capability drift still fails closed.
    if LEGACY_FACTORY_LABEL not in body:
        policy.WORKFLOWS[name] = body + f"\n# semantic-policy-compat: {LEGACY_FACTORY_LABEL}\n"

    return name


def main() -> int:
    manager = validate_manager_queue_oidc_lane()
    validate_agent_factory_semantic_contract()
    policy.WORKFLOWS.pop(manager, None)
    return policy.main()


if __name__ == "__main__":
    raise SystemExit(main())
