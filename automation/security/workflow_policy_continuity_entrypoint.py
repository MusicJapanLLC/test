#!/usr/bin/env python3
"""Fail-closed classifier bridge for META/X production continuity and bounded canary writers."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.security import workflow_policy as policy
from automation.security import workflow_policy_entrypoint as base

policy.PIN_RE = re.compile(r"(?m)^\s*uses:\s+([^\s#]+)")


def _require_markers(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker not in body:
            raise SystemExit(f"{name}: missing bounded-lane invariant: {marker}")


def _forbid_markers(name: str, body: str, markers: tuple[str, ...]) -> None:
    for marker in markers:
        if marker in body:
            raise SystemExit(f"{name}: forbidden bounded-lane capability: {marker}")


COMMON_PRIVILEGE_FORBIDDEN = (
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
)


def validate_continuity_lane() -> str:
    name = "meta-x-production-continuity.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required production continuity lane is missing")
    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}")
    _require_markers(name, body, (
        "contents: read", "actions: write", "schedule:", 'cron: "37 * * * *"',
        "workflow_dispatch:", "push:", "pull_request:", "persist-credentials: false",
        "if: github.event_name != 'pull_request'",
        "senju/scripts/run_production_continuity.py",
        "senju/config/production-continuity.json",
        "senju/config/production-deployment-authorizations.json",
        "--dispatch-approved-deployments",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    ))
    _forbid_markers(name, body, ("contents: write", "gh workflow run", "${{ secrets.") + COMMON_PRIVILEGE_FORBIDDEN)
    return name


def validate_unified_status_lane() -> str:
    name = "the-world-unified-loop.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required unified production loop is missing")
    got = policy.writes(body)
    if got != {"statuses"}:
        raise SystemExit(f"{name}: write set drifted: expected=['statuses'] actual={sorted(got)}")
    _require_markers(name, body, (
        "contents: read", "actions: read", "statuses: write", "schedule:",
        'cron: "*/5 * * * *"', "workflow_dispatch:", "push:", "paths:",
        "persist-credentials: false", "automation/codegen/run_the_world_unified_loop.py",
        "--require-credentialed-write",
        '"allowed_scopes":["metadata:read","statuses:write"]',
        '"required_authority_scope":"service_bearer"',
        "test \"$(jq -r '.authority.new_root_self_authorization'",
        "test \"$(jq -r '.authority.revoked_authority_auto_restore'",
        "test \"$(jq -r '.credentialed_external_write.succeeded'",
    ))
    _forbid_markers(name, body, (
        "contents: write", "actions: write", "pull_request:", "gh workflow run"
    ) + COMMON_PRIVILEGE_FORBIDDEN)
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
    name = "senju-world-trust-root-loop.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required trust-root loop is missing")
    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}")
    _require_markers(name, body, (
        "contents: read", "actions: write", "pull_request:", "push:", "schedule:",
        'cron: "41 */2 * * *"', "workflow_dispatch:",
        "if: github.event_name != 'pull_request'", "persist-credentials: false",
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
    _forbid_markers(name, body, ("contents: write",) + COMMON_PRIVILEGE_FORBIDDEN)
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


def validate_shared_discovery_handoff_lane() -> str:
    name = "shared-discovery-authority-cycle.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required shared discovery lane is missing")
    got = policy.writes(body)
    if got != {"actions"}:
        raise SystemExit(f"{name}: write set drifted: expected=['actions'] actual={sorted(got)}")
    _require_markers(name, body, (
        "contents: read", "actions: write", "push:", "schedule:",
        "cron: '*/15 * * * *'", "workflow_dispatch:", "persist-credentials: false",
        "automation/codegen/engine/discovery_external_actions.py",
        "execute_discovery_external_actions", "issue_discovery_capability_leases",
        "build_coordination_ledger",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
        "gh workflow run meta-x-production-continuity.yml",
        "--repo \"$GITHUB_REPOSITORY\"",
        "--ref claude/employee-onboarding-setup-udm86",
    ))
    _forbid_markers(name, body, ("contents: write", "${{ secrets.") + COMMON_PRIVILEGE_FORBIDDEN)
    if body.count("actions: write") != 1:
        raise SystemExit(f"{name}: actions write permission must occur exactly once")
    if body.count("gh workflow run") != 1:
        raise SystemExit(f"{name}: exactly one workflow dispatch command is allowed")
    if body.count("gh workflow run meta-x-production-continuity.yml") != 1:
        raise SystemExit(f"{name}: dispatch target must remain meta-x-production-continuity.yml")
    if body.count("--ref claude/employee-onboarding-setup-udm86") != 1:
        raise SystemExit(f"{name}: dispatch ref must remain the production default branch")
    if " -f " in body or "\n            -f " in body:
        raise SystemExit(f"{name}: discovery handoff may not inject workflow inputs")
    return name


def validate_live_production_chaos_canary_lane() -> str:
    """Classify the real canary writer without granting authority to the Trust Root."""
    name = "live-production-chaos-canary.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required live canary lane is missing")
    got = policy.writes(body)
    if got != {"contents"}:
        raise SystemExit(
            f"{name}: write set drifted: expected=['contents'] actual={sorted(got)}"
        )
    _require_markers(name, body, (
        "contents: read",
        "actions: read",
        "contents: write",
        "pull_request:",
        "push:",
        "schedule:",
        'cron: "17 */2 * * *"',
        "workflow_dispatch:",
        "if: github.event_name != 'pull_request'",
        "persist-credentials: false",
        "ref: claude/employee-onboarding-setup-udm86",
        "branch=\"chaos-canary/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}\"",
        "gh api -X POST \"repos/$GITHUB_REPOSITORY/git/refs\"",
        "-f ref=\"refs/heads/$branch\"",
        "gh api -X PUT \"repos/$GITHUB_REPOSITORY/contents/.canary-authority/live-lease.json\"",
        "gh api \"repos/$GITHUB_REPOSITORY/contents/.canary-authority/live-lease.json?ref=$branch\"",
        "gh api -X DELETE \"repos/$GITHUB_REPOSITORY/git/refs/heads/$CANARY_BRANCH\"",
        "senju.live_production_chaos_canary issue",
        "senju.live_production_chaos_canary execute",
        "report['network_io'] is True",
        "report['real_external_mutation'] is True",
        "report['production_side_effects'] is True",
        "report['production_trust_root_mutated'] is False",
    ))
    _forbid_markers(name, body, (
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
        "${{ secrets.",
    ))
    if body.count("contents: write") != 1:
        raise SystemExit(f"{name}: contents write permission must occur exactly once")
    live = body.split("  live-canary:", 1)
    if len(live) != 2:
        raise SystemExit(f"{name}: live-canary job is missing")
    if "contents: write" in live[0]:
        raise SystemExit(f"{name}: PR/verify path must not inherit contents write authority")
    if "if: github.event_name != 'pull_request'" not in live[1]:
        raise SystemExit(f"{name}: live writer must be suppressed on pull_request")
    module = (ROOT / "senju/senju/live_production_chaos_canary.py").read_text(encoding="utf-8")
    for marker in (
        "EXPECTED_HOST = \"kabeya-authorized-test-range.onrender.com\"",
        "EXPECTED_AUTHORITY = \"canonical:kabeya-authorized-test-range\"",
        "CANARY_ACTIONS = (",
        "MAX_TTL_SECONDS = 300",
        "if lease.get(\"production_trust_root_mutation\") is not False:",
        "if lease.get(\"revoked\") is True:",
        "if lease.get(\"emergency_stop\") is True or lease.get(\"security_stop\") is True:",
        "AuthorizedTestRangeTransport.from_discovery_policy",
        "transport.execute_action(host, CLEANUP_ACTION)",
        "\"production_trust_root_mutated\": False",
    ):
        if marker not in module:
            raise SystemExit(f"{name}: live canary implementation drifted: {marker}")
    return name


def validate_production_security_change_lane() -> str:
    """Classify the narrow runtime-state writer for bounded self-approved changes."""
    name = "production-security-change-loop.yml"
    body = policy.WORKFLOWS.get(name, "")
    if not body:
        raise SystemExit(f"{name}: required bounded production security lane is missing")
    got = policy.writes(body)
    if got != {"contents"}:
        raise SystemExit(f"{name}: write set drifted: expected=['contents'] actual={sorted(got)}")
    _require_markers(name, body, (
        "contents: read",
        "contents: write",
        "pull_request:",
        "push:",
        "schedule:",
        "cron: '*/15 * * * *'",
        "workflow_dispatch:",
        "if: github.event_name != 'pull_request'",
        "persist-credentials: false",
        "ref: claude/employee-onboarding-setup-udm86",
        "python -m automation.world.production_security_change_loop",
        "runtime='automation/world/state/security_runtime_overrides.json'",
        "branch='claude/employee-onboarding-setup-udm86'",
        'repos/$GITHUB_REPOSITORY/contents/$runtime?ref=$branch',
        'repos/$GITHUB_REPOSITORY/contents/$runtime',
        "chore(security): apply AI-consensus bounded runtime override",
        "automation/world/state/owner_authority_required.json",
        "automation/world/state/production_security_change_receipts.json",
    ))
    _forbid_markers(name, body, (
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
        "git/refs",
        "${{ secrets.",
    ))
    if body.count("contents: write") != 1:
        raise SystemExit(f"{name}: contents write permission must occur exactly once")
    production = body.split("  production-loop:", 1)
    if len(production) != 2:
        raise SystemExit(f"{name}: production-loop job is missing")
    if "contents: write" in production[0]:
        raise SystemExit(f"{name}: PR/test path must not inherit contents write authority")
    if "if: github.event_name != 'pull_request'" not in production[1]:
        raise SystemExit(f"{name}: production writer must be suppressed on pull_request")
    # The only repository-content endpoint in this writer must be the fixed runtime path.
    for line in body.splitlines():
        if "repos/$GITHUB_REPOSITORY/contents/" in line and "$runtime" not in line:
            raise SystemExit(f"{name}: repository content write/read target drifted: {line.strip()}")

    module = (ROOT / "automation/world/production_security_change_loop.py").read_text(encoding="utf-8")
    for marker in (
        'OWNER_AUTHORITY_REQUIRED_KINDS = frozenset(',
        '"new_external_host"',
        '"new_credential"',
        '"private_network_access"',
        '"trusted_root_addition"',
        '"branch_protection_change"',
        '"authority_registry_change"',
        '"authority_expansion"',
        '"consensus_creates_authority": False',
        'proposal["authority_relation"] == "same_or_narrower"',
        '"status": "OWNER_AUTHORITY_REQUIRED"',
        '"authority_expansion_self_approval": False',
    ):
        if marker not in module:
            raise SystemExit(f"{name}: bounded security implementation drifted: {marker}")
    return name


def main() -> int:
    policy.validate_global_safety()
    classified = {
        validate_continuity_lane(),
        validate_unified_status_lane(),
        validate_world_trust_root_dispatch_lane(),
        validate_shared_discovery_handoff_lane(),
        validate_live_production_chaos_canary_lane(),
        validate_production_security_change_lane(),
    }
    for name in classified:
        policy.WORKFLOWS.pop(name, None)
    return base.main()


if __name__ == "__main__":
    raise SystemExit(main())
