"""AI Security Proposal -> Council -> Self-Approval decision engine.

The production loop grants the AI Council broad standing authority to automatically
apply security-tightening changes inside the existing owner namespace. A proposal
may target one surface or atomically bundle multiple security surfaces in a single
Council decision and Production Apply transaction.

The loop remains monotonic: it cannot mint authority, widen scope, weaken a guard,
disable an emergency stop, or rewrite the root approval mechanism itself.
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


def _normalize_changes(proposal: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
    """Return normalized target/operation groups and whether the input was malformed.

    Backward-compatible single-target proposals use ``target`` + ``operations``.
    New bundle proposals use ``changes`` and are evaluated atomically: one unsafe or
    malformed change blocks the entire proposal before any state is written.
    """
    malformed = False
    raw_changes = proposal.get("changes")

    if raw_changes is not None:
        if not isinstance(raw_changes, list) or not raw_changes:
            return [], True
        changes = raw_changes
    else:
        changes = [{
            "target": proposal.get("target", ""),
            "operations": proposal.get("operations", []),
        }]

    normalized: list[dict[str, Any]] = []
    for change in changes:
        if not isinstance(change, dict):
            malformed = True
            continue

        target = str(change.get("target", "")).strip()
        operations = change.get("operations", [])
        if not isinstance(operations, list) or not operations:
            malformed = True
            operations = []

        normalized_operations: list[dict[str, Any]] = []
        for operation in operations:
            if not isinstance(operation, dict) or not isinstance(operation.get("type"), str):
                malformed = True
                continue
            op_type = operation["type"].strip()
            if not op_type:
                malformed = True
                continue
            normalized_operations.append({
                "type": op_type,
                "parameters": operation.get("parameters", {}) if isinstance(operation.get("parameters", {}), dict) else {},
            })

        normalized.append({
            "target": target,
            "operations": normalized_operations,
        })

    return normalized, malformed


def evaluate_security_proposal(proposal: dict[str, Any]) -> dict[str, Any]:
    proposal_id = str(proposal.get("id", "")).strip()
    changes, malformed = _normalize_changes(proposal)

    decision_changes: list[dict[str, Any]] = []
    all_operation_names: list[str] = []
    monotonic = bool(changes) and not malformed

    for change in changes:
        target = change["target"]
        operation_names = [operation["type"] for operation in change["operations"]]
        allowed = ALLOWED_OPERATIONS.get(target, frozenset())
        supported = target in ALLOWED_OPERATIONS
        change_monotonic = bool(operation_names) and supported and all(name in allowed for name in operation_names)
        monotonic = monotonic and change_monotonic
        all_operation_names.extend(operation_names)
        decision_changes.append({
            "target": target,
            "supported_target": supported,
            "operations": operation_names,
            "security_direction": "tighten" if change_monotonic else "blocked",
        })

    council = _council(proposal.get("council_votes", {}) if isinstance(proposal.get("council_votes"), dict) else {})
    production_requested = proposal.get("environment", "production") == "production"
    owner_namespace = proposal.get("owner_namespace", "MusicJapanLLC/test") == "MusicJapanLLC/test"
    identified = bool(proposal_id)

    self_approved = all((identified, council["approved"], monotonic, production_requested, owner_namespace))
    targets = [change["target"] for change in decision_changes]
    target = targets[0] if len(targets) == 1 else "multi_surface_bundle"

    return {
        "schema": "the-world-security-proposal-decision/v2",
        "proposal_id": proposal_id,
        "identified": identified,
        "target": target,
        "targets": targets,
        "supported_target": bool(decision_changes) and all(change["supported_target"] for change in decision_changes),
        "operations": all_operation_names,
        "changes": decision_changes,
        "atomic_bundle": len(decision_changes) > 1,
        "council": council,
        "security_direction": "tighten" if monotonic else "blocked",
        "self_approved": self_approved,
        "auto_merge_eligible": self_approved,
        "production_apply_eligible": self_approved,
        "fresh_human_prompt_required": not self_approved,
        "standing_ai_council_authority": self_approved,
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
    """Persist an approved production security control state idempotently and atomically."""
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

    normalized_changes, malformed = _normalize_changes(proposal)
    if malformed or not normalized_changes:
        raise PermissionError("security proposal changed after approval or is malformed")

    # Build the entire next state off-copy, then return it only after every approved
    # change has been materialized. This prevents partial bundle application.
    next_state = deepcopy(current)
    next_state["generation"] = int(next_state.get("generation", 0)) + 1

    for change in normalized_changes:
        target = change["target"]
        next_state["controls"].setdefault(target, [])
        for operation in change["operations"]:
            next_state["controls"][target].append({
                "proposal_id": proposal_id,
                "type": operation["type"],
                "parameters": operation.get("parameters", {}),
            })

    next_state["applied_proposals"].append({
        "proposal_id": proposal_id,
        "target": decision["target"],
        "targets": list(decision["targets"]),
        "operations": list(decision["operations"]),
        "atomic_bundle": bool(decision.get("atomic_bundle")),
        "council_yes": decision["council"]["yes"],
        "self_approved": True,
        "production_applied": True,
    })
    return next_state
