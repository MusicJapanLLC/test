"""AI Security Proposal -> Council -> Self-Approval decision engine.

This module is intentionally monotonic: AI self-approval may automatically apply
security-tightening changes inside the existing production namespace, but it may not
use the same loop to mint authority, weaken a guard, disable an emergency stop, or
rewrite the root approval mechanism itself.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

COUNCIL = ("META", "X", "Senju")

ALLOWED_OPERATIONS: dict[str, frozenset[str]] = {
    "guard": frozenset({
        "add_deny_rule", "tighten_rule", "enable_guard", "reduce_exception", "remove_bypass",
    }),
    "authority_policy": frozenset({
        "narrow_scope", "reduce_effect", "expire_grant", "revoke_grant", "require_approval",
    }),
    "credential_broker": frozenset({
        "revoke_credential", "reduce_ttl", "narrow_credential_scope", "disable_export", "require_rotation",
    }),
    "network_policy": frozenset({
        "deny_host", "remove_allowed_host", "reduce_rate_limit", "disable_private_network", "disable_external_write",
    }),
    "audit_policy": frozenset({
        "enable_audit", "add_audit_sink", "increase_retention", "require_integrity", "increase_coverage",
    }),
    "branch_protection": frozenset({
        "require_checks", "increase_required_approvals", "block_force_push", "block_deletion", "require_signed_commits",
    }),
    "deployment_protection": frozenset({
        "require_checks", "require_environment_approval", "restrict_ref", "block_unverified_deploy", "enable_rollback",
    }),
    "authorization_registry": frozenset({
        "revoke_authorization", "expire_authorization", "narrow_scope", "disable_entry", "require_fresh_validation",
    }),
    "emergency_stop": frozenset({
        "enable_stop", "add_stop_condition", "lower_trip_threshold", "require_stop_on_uncertainty", "lock_stop_disable",
    }),
    "recovery_policy": frozenset({
        "require_fresh_authorization", "reduce_recovery_scope", "disable_privileged_restore", "require_integrity_check", "require_owner_namespace",
    }),
}


def _council(votes: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, bool] = {}
    for member in COUNCIL:
        raw = votes.get(member)
        if isinstance(raw, dict):
            raw = raw.get("approve")
        clean[member] = raw is True
    complete = all(member in votes for member in COUNCIL)
    yes = sum(1 for member in COUNCIL if clean[member])
    return {
        "members": list(COUNCIL),
        "complete": complete,
        "yes": yes,
        "total": len(COUNCIL),
        "majority": yes >= 2,
        "approved": complete and yes >= 2,
        "votes": clean,
    }


def evaluate_security_proposal(proposal: dict[str, Any]) -> dict[str, Any]:
    proposal_id = str(proposal.get("id", "")).strip()
    target = str(proposal.get("target", ""))
    operations = proposal.get("operations", [])
    if not isinstance(operations, list):
        operations = []

    operation_names: list[str] = []
    malformed = False
    for operation in operations:
        if not isinstance(operation, dict) or not isinstance(operation.get("type"), str):
            malformed = True
            continue
        operation_names.append(operation["type"])

    allowed = ALLOWED_OPERATIONS.get(target, frozenset())
    monotonic = bool(operation_names) and not malformed and all(name in allowed for name in operation_names)
    council = _council(proposal.get("council_votes", {}) if isinstance(proposal.get("council_votes"), dict) else {})
    production_requested = proposal.get("environment", "production") == "production"
    owner_namespace = proposal.get("owner_namespace", "MusicJapanLLC/test") == "MusicJapanLLC/test"
    identified = bool(proposal_id)

    self_approved = all((identified, council["approved"], monotonic, production_requested, owner_namespace))

    return {
        "schema": "the-world-security-proposal-decision/v1",
        "proposal_id": proposal_id,
        "identified": identified,
        "target": target,
        "supported_target": target in ALLOWED_OPERATIONS,
        "operations": operation_names,
        "council": council,
        "security_direction": "tighten" if monotonic else "blocked",
        "self_approved": self_approved,
        "auto_merge_eligible": self_approved,
        "production_apply_eligible": self_approved,
        "fresh_human_prompt_required": not self_approved,
        "creates_new_authority": False,
        "scope_expansion_allowed": False,
        "guard_weakening_allowed": False,
        "emergency_stop_disable_allowed": False,
        "root_self_rewrite_allowed": False,
    }


def apply_proposal_to_state(
    state: dict[str, Any] | None,
    proposal: dict[str, Any],
    decision: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist an approved production security control state idempotently."""
    decision = decision or evaluate_security_proposal(proposal)
    if decision.get("production_apply_eligible") is not True:
        raise PermissionError("security proposal is not eligible for production apply")

    current = deepcopy(state or {})
    current.setdefault("schema", "the-world-ai-security-runtime-state/v1")
    current.setdefault("generation", 0)
    current.setdefault("applied_proposals", [])
    current.setdefault("controls", {})

    proposal_id = decision.get("proposal_id")
    existing = {
        row.get("proposal_id")
        for row in current["applied_proposals"]
        if isinstance(row, dict)
    }
    if proposal_id in existing:
        return current

    target = decision["target"]
    current["generation"] = int(current.get("generation", 0)) + 1
    current["controls"].setdefault(target, [])
    for operation in proposal.get("operations", []):
        current["controls"][target].append({
            "proposal_id": proposal_id,
            "type": operation["type"],
            "parameters": operation.get("parameters", {}),
        })
    current["applied_proposals"].append({
        "proposal_id": proposal_id,
        "target": target,
        "operations": list(decision["operations"]),
        "council_yes": decision["council"]["yes"],
        "self_approved": True,
        "production_applied": True,
    })
    return current
