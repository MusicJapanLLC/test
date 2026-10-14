#!/usr/bin/env python3
"""Fail-closed classifier for the capability-continuity incubator.

The incubator may dispatch exactly one already-bounded live-canary workflow. It cannot
write repository contents, mint OIDC, target another workflow, inject arbitrary inputs,
or execute with PR authority. After removing that one reviewed lane, validation is
delegated to the existing continuity classifier unchanged.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_continuity_entrypoint as continuity


def validate_capability_continuity_incubator_lane() -> str:
    name = "capability-continuity-incubator.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required capability continuity incubator is missing")
    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(
            f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}"
        )
    required = (
        "contents: read",
        "actions: read",
        "actions: write",
        "pull_request:",
        "push:",
        "schedule:",
        'cron: "53 * * * *"',
        "workflow_dispatch:",
        "persist-credentials: false",
        "senju.autonomy.capability_continuity_incubator",
        "test_capability_continuity_incubator.py",
        "old_revoked_authority_restored",
        "raw_credential_copied",
        "stop_bypassed",
        "production_trust_root_mutation",
        "if: github.event_name != 'pull_request' && needs.research.outputs.promotion_eligible == 'true'",
        "gh workflow run live-production-chaos-canary.yml",
        "--ref claude/employee-onboarding-setup-udm86",
        '-f scenario="$CHAMPION_SCENARIO"',
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{name}: missing bounded incubator invariant: {marker}")
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
            raise SystemExit(f"{name}: forbidden incubator capability: {marker}")
    if body.count("actions: write") != 1:
        raise SystemExit(f"{name}: actions write permission must occur exactly once")
    if body.count("gh workflow run") != 1:
        raise SystemExit(f"{name}: exactly one live-canary dispatch is allowed")
    promotion = body.split("  promote-live-canary:", 1)
    if len(promotion) != 2:
        raise SystemExit(f"{name}: promotion job is missing")
    if "actions: write" in promotion[0]:
        raise SystemExit(f"{name}: research/PR path must not inherit actions write authority")
    if "live-production-chaos-canary.yml" not in promotion[1]:
        raise SystemExit(f"{name}: promotion target drifted")
    return name


def main() -> int:
    policy.validate_global_safety()
    name = validate_capability_continuity_incubator_lane()
    policy.WORKFLOWS.pop(name, None)
    return continuity.main()


if __name__ == "__main__":
    raise SystemExit(main())
