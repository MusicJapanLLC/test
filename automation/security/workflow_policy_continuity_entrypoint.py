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


def _require_markers(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker not in body:
            raise SystemExit(f"{name}: missing bounded-lane invariant: {marker}")


def _forbid_markers(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker in body:
            raise SystemExit(f"{name}: forbidden bounded-lane capability: {marker}")


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

    _require_markers(name, body, (
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
    ))
    _forbid_markers(name, body, (
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
    ))
    return name


def validate_unified_status_lane() -> str:
    """Classify the unified loop's single fixed commit-status write."""
    name = "the-world-unified-loop.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required unified production loop is missing")
    got = policy.writes(body)
    if got != {"statuses"}:
        raise SystemExit(
            f"{name}: write set drifted: expected=['statuses'] actual={sorted(got)}"
        )
    _require_markers(name, body, (
        "contents: read",
        "actions: read",
        "statuses: write",
        "schedule:",
        'cron: "*/5 * * * *"',
        "workflow_dispatch:",
        "push:",
        "paths:",
        "persist-credentials: false",
        "automation/codegen/run_the_world_unified_loop.py",
        "--require-credentialed-write",
        '"allowed_scopes":["metadata:read","statuses:write"]',
        '"required_authority_scope":"service_bearer"',
        "test \"$(jq -r '.authority.new_root_self_authorization'",
        "test \"$(jq -r '.authority.revoked_authority_auto_restore'",
        "test \"$(jq -r '.credentialed_external_write.succeeded'",
    ))
    _forbid_markers(name, body, (
        "contents: write",
        "actions: write",
        "id-token: write",
        "issues: write",
        "pull-requests: write",
        "deployments: write",
        "packages: write",
        "pages: write",
        "copilot-requests: write",
        "pull_request:",
        "pull_request_target:",
        "repository_dispatch:",
        "workflow_run:",
        "runs-on: self-hosted",
        "permissions: write-all",
        "git push ",
        "gh pr create",
        "gh workflow run",
    ))
    if body.count("statuses: write") != 1:
        raise SystemExit(f"{name}: statuses write permission must occur exactly once")

    engine = (ROOT / "automation/codegen/engine/the_world_unified_loop.py").read_text(encoding="utf-8")
    for marker in (
        'PRODUCTION_REPOSITORY = "MusicJapanLLC/test"',
        '"operation": "write_current_commit_status"',
        '"required_scopes": ["statuses:write"]',
        'url = f"https://api.github.com/repos/{PRODUCTION_REPOSITORY}/statuses/{sha}"',
        '"context": "the-world/unified-loop"',
        '"secret_persisted": False',
        '"checkpoint_may_restore_revoked_authority": False',
    ):
        if marker not in engine:
            raise SystemExit(f"{name}: status writer implementation drifted: {marker}")
    return name


def validate_world_trust_root_dispatch_lane() -> str:
    """Classify the trust-root loop as an existing-authority fleet dispatcher only."""
    name = "senju-world-trust-root-loop.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required trust-root loop is missing")
    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(
            f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}"
        )
    _require_markers(name, body, (
        "contents: read",
        "actions: write",
        "pull_request:",
        "push:",
        "schedule:",
        'cron: "41 */2 * * *"',
        "workflow_dispatch:",
        "if: github.event_name != 'pull_request'",
        "persist-credentials: false",
        "WORLD_ROOT_ID: world:kabeya-authorized-test-range",
        "WORLD_TARGET_HOST: kabeya-authorized-test-range.onrender.com",
        "WORLD_STANDING_AUTHORITY: canonical:kabeya-authorized-test-range",
        "WORLD_DEPLOY_WORKFLOW: meta-x-authorized-production-worker-fleet.yml",
        "assert report['authorization_reused_not_minted'] is True",
        "assert report['authority_minted_by_loop'] is False",
        "assert report['security_self_approval'] is False",
        "assert report['network_policy_self_edit'] is False",
        "assert report['revocation_overridden'] is False",
        "assert report['execution']['external_write_enabled'] is False",
        "deploy|recover_same_revision",
        "gh workflow run \"$WORLD_DEPLOY_WORKFLOW\"",
        "-f target_host=\"$WORLD_TARGET_HOST\"",
        "-f authority_reference=\"$WORLD_STANDING_AUTHORITY\"",
    ))
    _forbid_markers(name, body, (
        "contents: write",
        "id-token: write",
        "issues: write",
        "pull-requests: write",
        "deployments: write",
        "packages: write",
        "pages: write",
        "copilot-requests: write",
        "pull_request_target:",
        "repository_dispatch:",
        "workflow_run:",
        "runs-on: self-hosted",
        "permissions: write-all",
        "git push ",
        "gh pr create",
    ))
    if body.count("actions: write") != 1:
        raise SystemExit(f"{name}: actions write permission must occur exactly once")
    production = body.split("production-control-plane:", 1)
    if len(production) != 2 or "actions: write" in production[0]:
        raise SystemExit(f"{name}: PR/verify path must not inherit actions write authority")

    module = (ROOT / "senju/senju/world_trust_root_loop.py").read_text(encoding="utf-8")
    for marker in (
        "discovery is evidence, never permission by itself",
        "authorization is resolved from live explicit authority",
        "checkpoints restore work state only after live authority is revalidated",
        "replicas inherit the same or narrower capability and never raw secret bytes",
        "no component may self-approve a new trust root or widen network policy after denial",
        "MAX_OPERATIONS_PER_CYCLE = 64",
    ):
        if marker not in module:
            raise SystemExit(f"{name}: trust-root implementation drifted: {marker}")
    return name


def main() -> int:
    # Validate all workflows before removing custom-classified lanes so immutable
    # action pins, checkout credential disposal, and forbidden-trigger rules apply
    # globally. Named lanes below are then admitted only through exact contracts.
    policy.validate_global_safety()
    classified = {
        validate_continuity_lane(),
        validate_unified_status_lane(),
        validate_world_trust_root_dispatch_lane(),
    }
    for name in classified:
        policy.WORKFLOWS.pop(name, None)
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
