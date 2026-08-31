#!/usr/bin/env python3
"""Strict classifier for Owner-scope negotiation and rights-request federation lanes.

These two workflows are privileged, but their authority is intentionally narrow:
- Owner Scope Negotiation may update exactly one effective-ceiling state file.
- Rights Request Federation may update exactly six negotiation state files and post
  deduplicated summaries to a bounded number of PRs in the same repository.

After validating those invariants, remove only these two workflow names from the shared
policy registry and delegate every other workflow to the existing fail-closed classifier.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_capability_entrypoint as capability

OWNER_WORKFLOW = "owner-scope-negotiation-production.yml"
RIGHTS_WORKFLOW = "rights-request-federation.yml"
OWNER_STATE_PATH = "senju/state/owner_contact_ceiling_effective.json"
RIGHTS_STATE_PATHS = {
    "senju/state/rights_request_ledger.json",
    "senju/state/rights_request_federation.json",
    "senju/state/owner_scope_negotiation_signals.json",
    "senju/state/owner_scope_negotiation_campaign.json",
    "senju/state/owner_scope_negotiation_result.json",
    "senju/state/owner_contact_ceiling_effective.json",
}


def _require_all(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker not in body:
            raise SystemExit(f"{name}: missing bounded rights-lane invariant: {marker}")


def _forbid_all(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker in body:
            raise SystemExit(f"{name}: forbidden rights-lane capability: {marker}")


def validate_owner_scope_lane() -> str:
    name = OWNER_WORKFLOW
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required Owner-scope production lane is missing")
    if policy.writes(body) != {"contents"}:
        raise SystemExit(f"{name}: write set must remain contents-only: {sorted(policy.writes(body))}")
    _require_all(
        name,
        body,
        (
            "workflow_dispatch:",
            "schedule:",
            "persist-credentials: false",
            "GH_TOKEN: ${{ github.token }}",
            "senju/scripts/owner_scope_negotiation.py",
            OWNER_STATE_PATH,
            'BASE="claude/employee-onboarding-setup-udm86"',
            'BRANCH="owner-scope-state-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-${attempt}"',
            'gh api -X POST "repos/$REPO/git/refs"',
            'gh api -X PUT "repos/$REPO/contents/$PATH_IN_REPO"',
            'gh api "repos/$REPO/compare/$BASE_SHA...$HEAD_SHA"',
            'grep -Fxq "$PATH_IN_REPO" /tmp/owner-scope-changed.txt',
            'gh api -X PATCH "repos/$REPO/git/refs/heads/$BASE"',
            "-F force=false",
            "Base moved; safe Owner ceiling promotion retry",
        ),
    )
    _forbid_all(
        name,
        body,
        (
            "pull_request:",
            "git push ",
            "gh pr create",
            "gh pr comment",
            "issues: write",
            "pull-requests: write",
            "id-token: write",
            "${{ secrets.",
        ),
    )
    if body.count(OWNER_STATE_PATH) < 3:
        raise SystemExit(f"{name}: Owner ceiling path must be explicit in source, target, and evidence")
    return name


def validate_rights_federation_lane() -> str:
    name = RIGHTS_WORKFLOW
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required rights federation lane is missing")
    want = {"contents", "issues", "pull-requests"}
    if policy.writes(body) != want:
        raise SystemExit(f"{name}: write set drifted: expected={sorted(want)} actual={sorted(policy.writes(body))}")
    _require_all(
        name,
        body,
        (
            "workflow_dispatch:",
            "schedule:",
            "cron: '7,22,37,52 * * * *'",
            "pull_request:",
            "persist-credentials: false",
            "GH_TOKEN: ${{ github.token }}",
            "senju/scripts/rights_request_federation.py",
            "senju/scripts/owner_scope_negotiation.py",
            'BASE="claude/employee-onboarding-setup-udm86"',
            'for path in "${ALLOWED[@]}"',
            "forbidden = changed - allowed",
            'gh api -X PATCH "repos/$REPO/git/refs/heads/$BASE"',
            "-F force=false",
            "if: github.event_name != 'pull_request'",
            'gh pr list --repo "$GITHUB_REPOSITORY"',
            "head -n 8",
            'gh pr comment "$PR" --repo "$GITHUB_REPOSITORY"',
            "rights-request-federation:",
        ),
    )
    for path in sorted(RIGHTS_STATE_PATHS):
        if body.count(path) < 2:
            raise SystemExit(f"{name}: bounded state path is not explicit enough: {path}")
    _forbid_all(
        name,
        body,
        (
            "git push ",
            "gh pr create",
            "id-token: write",
            "deployments: write",
            "packages: write",
            "pages: write",
            "copilot-requests: write",
            "${{ secrets.",
        ),
    )
    if body.count("if: github.event_name != 'pull_request'") < 2:
        raise SystemExit(f"{name}: PR-triggered runs must suppress state and PR writes")
    if body.count("gh pr comment") != 1:
        raise SystemExit(f"{name}: PR sharing must remain one bounded comment loop")
    return name


def main() -> int:
    # First run global invariants while both privileged workflows are still visible.
    policy.validate_global_safety()
    lanes = {validate_owner_scope_lane(), validate_rights_federation_lane()}
    for name in lanes:
        policy.WORKFLOWS.pop(name, None)
    # Existing classifier remains authoritative for every other workflow.
    return capability.main()


if __name__ == "__main__":
    raise SystemExit(main())
