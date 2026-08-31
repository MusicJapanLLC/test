#!/usr/bin/env python3
"""Fail-closed bridge for the META/X production continuity workflow.

This wrapper exists only to classify the reviewed actions-write continuity lane.
It runs repository-wide global workflow safety before removing that lane, validates
its exact capability/trigger contract, then delegates every remaining workflow to
the existing fail-closed workflow policy entrypoint.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_entrypoint as base


def validate_meta_x_production_continuity_lane() -> str:
    name = "meta-x-production-continuity.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required production continuity lane is missing")

    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(
            f"{name}: continuity write set drifted: expected=['actions'] actual={sorted(got)}"
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

    # The actions-write capability is consumed only by the validated runtime.
    # Keep direct repository mutation, extra privilege families, arbitrary shell
    # dispatch and external secret injection out of this lane.
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
    # The custom lane is still covered by every global workflow invariant before
    # it is removed from the generic unknown-privileged-lane classifier.
    policy.validate_global_safety()
    continuity = validate_meta_x_production_continuity_lane()
    policy.WORKFLOWS.pop(continuity, None)
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
