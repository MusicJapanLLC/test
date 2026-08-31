#!/usr/bin/env python3
"""Fail-closed classifier for the bounded Owner frontier approval writer.

The frontier workflow is privileged only in its non-PR apply job. It may persist a
fixed set of authority research/state files through GitHub's own-repository contents
and ref APIs after a read-only validation job produces a reviewed artifact. No other
repository path, PR mutation, long-lived secret, force push, or external write class is
admitted here.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_capability_entrypoint as capability

NAME = "owner-frontier-council.yml"
ALLOWED_STATE = {
    "senju/state/rights_request_ledger.json",
    "senju/state/rights_request_federation.json",
    "senju/state/owner_scope_negotiation_signals.json",
    "senju/state/owner_frontier_ballots.json",
    "senju/state/owner_frontier_council.json",
    "senju/state/owner_scope_expansion_evidence_requests.json",
    "senju/state/owner_frontier_negotiator_feed.json",
    "senju/state/owner_contact_ceiling_effective.json",
    "senju/state/owner_frontier_approved_pending.json",
    "senju/state/authority_opportunity_queue.json",
}


def validate_frontier_lane() -> str:
    body = policy.WORKFLOWS.get(NAME, "")
    if not body:
        raise SystemExit(f"{NAME}: required Owner frontier approval workflow is missing")
    got = policy.writes(body)
    if got != {"contents"}:
        raise SystemExit(f"{NAME}: write set drifted: expected=['contents'] actual={sorted(got)}")

    required = (
        "Owner Frontier Approval Council",
        "contents: read",
        "contents: write",
        "actions: read",
        "pull_request:",
        "schedule:",
        "cron: '13,28,43,58 * * * *'",
        "workflow_dispatch:",
        "persist-credentials: false",
        "senju/tests/test_owner_frontier_council.py",
        "senju/tests/test_frontier_approval_continuity.py",
        "senju/scripts/rights_request_federation.py",
        "senju/scripts/owner_frontier_council.py",
        "senju/scripts/frontier_approval_continuity.py",
        "approved_pending_next_frontier_cycle",
        "unknown_host_without_verified_evidence_auto_activated",
        "approval_quorum",
        "valid_approval_is_binding",
        "owner_frontier_negotiator_feed.json",
        "if: github.event_name != 'pull_request'",
        'REPO="$GITHUB_REPOSITORY"',
        'BASE="claude/employee-onboarding-setup-udm86"',
        "gh api -X PUT",
        "gh api -X PATCH",
        "force=false",
        "frontier writer touched forbidden paths",
        "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    )
    for marker in required:
        if marker not in body:
            raise SystemExit(f"{NAME}: missing bounded frontier invariant: {marker}")

    forbidden = (
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
        "allow-unsafe-pr-checkout",
        "${{ secrets.",
    )
    for marker in forbidden:
        if marker in body:
            raise SystemExit(f"{NAME}: forbidden frontier capability: {marker}")

    if body.count("contents: write") != 1:
        raise SystemExit(f"{NAME}: contents write permission must occur exactly once")

    split = body.split("  apply-frontier-state:", 1)
    if len(split) != 2:
        raise SystemExit(f"{NAME}: apply-frontier-state job is missing")
    before_apply, apply = split
    if "contents: write" in before_apply:
        raise SystemExit(f"{NAME}: validation/PR path must not inherit repository write authority")
    if "if: github.event_name != 'pull_request'" not in apply:
        raise SystemExit(f"{NAME}: writer job must be suppressed for pull_request events")

    allowed_match = re.search(r"(?ms)^\s+ALLOWED=\(\n(?P<body>.*?)^\s+\)\s*$", apply)
    if not allowed_match:
        raise SystemExit(f"{NAME}: bounded ALLOWED state block is missing")
    observed = {
        line.strip()
        for line in allowed_match.group("body").splitlines()
        if line.strip().startswith("senju/state/")
    }
    if observed != ALLOWED_STATE:
        raise SystemExit(
            f"{NAME}: state write allowlist drifted: expected={sorted(ALLOWED_STATE)} actual={sorted(observed)}"
        )

    if 'gh api -X PATCH "repos/$REPO/git/refs/heads/$BASE" -f sha="$HEAD_SHA" -F force=false' not in apply:
        raise SystemExit(f"{NAME}: production ref update must remain non-forced")
    if "repos/$REPO/contents/$path" not in apply or "repos/$REPO/compare/$BASE_SHA...$HEAD_SHA" not in apply:
        raise SystemExit(f"{NAME}: writer must remain bound to current repository and verified diff")
    return NAME


def main() -> int:
    policy.validate_global_safety()
    name = validate_frontier_lane()
    policy.WORKFLOWS.pop(name, None)
    return capability.main()


if __name__ == "__main__":
    raise SystemExit(main())
