#!/usr/bin/env python3
"""Fail-closed classifiers for reviewed frontier and runtime-dispatch workflows."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_capability_entrypoint as capability

NAME = "owner-frontier-council.yml"
BOOSTER_NAME = "the-world-autonomy-booster.yml"


def validate_frontier_lane() -> str:
    body = policy.WORKFLOWS.get(NAME, "")
    if not body:
        raise SystemExit(f"{NAME}: required Owner frontier workflow is missing")

    got = policy.writes(body)
    if got:
        raise SystemExit(f"{NAME}: depowered frontier must be read-only, got writes={sorted(got)}")

    required = (
        "Owner Frontier SENJU Research Governance",
        "contents: read",
        "actions: read",
        "pull_request:",
        "schedule:",
        "cron: '13,28,43,58 * * * *'",
        "workflow_dispatch:",
        "persist-credentials: false",
        "senju/tests/test_owner_frontier_council.py",
        "senju/tests/test_owner_file_governance.py",
        "senju/scripts/rights_request_federation.py",
        "senju/scripts/owner_frontier_council.py",
        "senju/scripts/owner_file_governance.py",
        "production_activation_enabled",
        "repository_state_writer_enabled",
        "writes_effective_owner_ceiling",
        "valid_approval_is_binding",
        "owner_frontier_senju_research_queue.json",
        "owner-file-governance.json",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{NAME}: missing read-only SENJU governance invariant: {marker}")

    forbidden = (
        "contents: write",
        "actions: write",
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
        "gh api -X PUT",
        "gh api -X PATCH",
        "GH_TOKEN:",
        "apply-frontier-state:",
        "actions/download-artifact@",
        "allow-unsafe-pr-checkout",
        "${{ secrets.",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{NAME}: forbidden depowered-frontier capability: {marker}")

    if 'test "$(jq -r \'production_activation_enabled\' /tmp/owner-frontier-council.json)" = "false"' not in body:
        raise SystemExit(f"{NAME}: production activation must be asserted false")
    if 'test "$(jq -r \'valid_approval_is_binding\' /tmp/owner-frontier-council.json)" = "false"' not in body:
        raise SystemExit(f"{NAME}: council recommendation must be non-binding")
    return NAME


def validate_runtime_density_lane() -> str:
    body = policy.WORKFLOWS.get(BOOSTER_NAME, "")
    if not body:
        raise SystemExit(f"{BOOSTER_NAME}: required runtime density workflow is missing")

    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(
            f"{BOOSTER_NAME}: write set drifted: expected=['actions'] actual={sorted(got)}"
        )

    required = (
        "THE WORLD - Runtime Density Booster v2",
        "contents: read",
        "actions: write",
        "schedule:",
        "cron: '*/10 * * * *'",
        "workflow_dispatch:",
        "persist-credentials: false",
        "automation/world/autonomy_booster.py",
        "automation/world/autonomy_booster_policy.json",
        "automation/world/test_autonomy_booster.py",
        "--apply",
        "Preserve runtime evidence",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{BOOSTER_NAME}: missing runtime-density invariant: {marker}")

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
        "${{ secrets.",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{BOOSTER_NAME}: forbidden runtime-density capability: {marker}")

    if body.count("actions: write") != 1:
        raise SystemExit(f"{BOOSTER_NAME}: actions write permission must occur exactly once")
    if body.count("python automation/world/autonomy_booster.py") != 1:
        raise SystemExit(f"{BOOSTER_NAME}: runtime booster must have exactly one dispatch entrypoint")
    return BOOSTER_NAME


def main() -> int:
    policy.validate_global_safety()
    frontier = validate_frontier_lane()
    booster = validate_runtime_density_lane()
    policy.WORKFLOWS.pop(frontier, None)
    policy.WORKFLOWS.pop(booster, None)
    return capability.main()


if __name__ == "__main__":
    raise SystemExit(main())
