#!/usr/bin/env python3
"""Fail-closed classifier bridge for META/X production continuity.

The continuity lane keeps exactly one write family: GitHub Actions dispatch. This
entrypoint validates global workflow safety first, then validates that lane's exact
capability and purpose before delegating every remaining workflow to the existing
fail-closed classifier.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_entrypoint as base

# workflow_policy.PIN_RE historically searched for the substring ``uses:``
# anywhere on a line. YAML permission keys such as ``statuses: write`` therefore
# contained a false ``uses: write`` match. Keep the same immutable-SHA policy,
# but recognize only an actual YAML ``uses:`` key at the start of an indented line.
policy.PIN_RE = re.compile(r"(?m)^\s*uses:\s+([^\s#]+)")


def validate_continuity_lane() -> str:
    name = "meta-x-production-continuity.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required production continuity lane is missing")

    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(
            f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}"
        )

    required = (
        "contents: read",
        "actions: write",
        "schedule:",
        'cron: "37 * * * *"',
        "workflow_dispatch:",
        "push:",
        "pull_request:",
        "persist-credentials: false",
        "if: github.event_name != 'pull_request'",
        "senju/scripts/run_production_continuity.py",
        "senju/config/production-continuity.json",
        "senju/config/production-deployment-authorizations.json",
        "--dispatch-approved-deployments",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing continuity invariant: {marker}")

    forbidden = (
        "contents: write",
        "id-token: write",
        "issues: write",
        "pull-requests: write",
        "deployments: write",
        "packages: write",
        "pages: write",
        "copilot-requests: write",
        "permissions: write-all",
        "runs-on: self-hosted",
        "pull_request_target:",
        "repository_dispatch:",
        "workflow_run:",
        "git push ",
        "gh pr create",
        "gh workflow run",
        "${{ secrets.",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{name}: forbidden continuity capability: {marker}")

    return name


def main() -> int:
    policy.validate_global_safety()
    name = validate_continuity_lane()
    policy.WORKFLOWS.pop(name, None)
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
