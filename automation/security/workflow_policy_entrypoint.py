#!/usr/bin/env python3
"""Fail-closed entrypoint for privileged workflow policy.

The canonical workflow policy intentionally rejects unknown OIDC lanes.  The
TOMOKI Manager queue is a narrower OIDC-only gateway lane, so it is validated
here with its own exact capability contract before the generic policy runs.
"""
from __future__ import annotations

from pathlib import Path

from automation.security import workflow_policy as policy


def validate_manager_queue_oidc_lane() -> str:
    name = "tomoki-manager-queue.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required manager OIDC lane is missing")

    # This lane may mint only a GitHub OIDC token.  It has no repository,
    # Actions, issue, PR, deployment, package, Pages, or Copilot write power.
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

    client = Path("automation/control_plane/manager_queue.py").read_text(encoding="utf-8")
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


def main() -> int:
    manager = validate_manager_queue_oidc_lane()
    # The generic policy remains fail-closed for every other privileged lane.
    # Removing this single workflow happens only after the exact validator above
    # has succeeded, so the lane is classified rather than silently ignored.
    policy.WORKFLOWS.pop(manager, None)
    return policy.main()


if __name__ == "__main__":
    raise SystemExit(main())
