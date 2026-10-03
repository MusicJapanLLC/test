"""Resident-wide autonomy policy for THE WORLD.

The policy deliberately makes the *inside* of an established safety envelope highly
autonomous. Public read-only research, local/simulated experiments, branch-only code
work, and explicitly authorized disposable security-test ranges should not require a
fresh human prompt for every step.

The policy does not use randomness to cross a hard boundary. Randomized fast-track
logic may accelerate review only after a request is already classified as bounded.
"""
from __future__ import annotations

from typing import Any, Mapping

AUTO_EXECUTE = "AUTO_EXECUTE"
AUTO_EXECUTE_SANDBOX = "AUTO_EXECUTE_SANDBOX"
SELF_APPROVE_BOUNDED = "SELF_APPROVE_BOUNDED"
HUMAN_REQUIRED = "HUMAN_REQUIRED"
BLOCKED = "BLOCKED"

# These are not approval bureaucracy. They are explicit execution boundaries.
_BLOCK_FLAGS = {
    "denial_of_service",
    "resource_exhaustion",
    "social_engineering",
    "extract_real_personal_data",
    "extract_production_secrets",
    "credential_reuse_outside_test_accounts",
    "unauthorized_targeting",
}

_HUMAN_GATE_FLAGS = {
    "production_deploy",
    "production_mutation",
    "change_secrets",
    "change_permissions",
    "change_branch_protection",
    "change_billing",
    "permission_escalation",
    "irreversible_delete",
    "financial_commitment",
    "legal_commitment",
    "new_credential_authority",
    "new_external_write_authority",
}


def _truthy(request: Mapping[str, Any], key: str) -> bool:
    return request.get(key) is True


def classify_autonomy(
    *,
    request: Mapping[str, Any],
    namespace: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Classify a proposed resident action into the fastest safe execution lane.

    The request describes desired effects. Authorization-bearing facts must come from
    the trusted namespace/scope layer rather than from a resident's self-assertion.
    Ambiguous external mutation falls back to human review.
    """
    ns = namespace or {}
    reasons: list[str] = []

    blocked = sorted(flag for flag in _BLOCK_FLAGS if _truthy(request, flag))
    if blocked:
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": BLOCKED,
            "fresh_human_prompt_required": False,
            "council_majority_required": False,
            "reason_codes": [f"blocked:{flag}" for flag in blocked],
            "probabilistic_boundary_bypass_allowed": False,
            "external_write_allowed": False,
        }

    human_gates = sorted(flag for flag in _HUMAN_GATE_FLAGS if _truthy(request, flag))
    if human_gates:
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": HUMAN_REQUIRED,
            "fresh_human_prompt_required": True,
            "council_majority_required": False,
            "reason_codes": [f"human_gate:{flag}" for flag in human_gates],
            "probabilistic_boundary_bypass_allowed": False,
            "external_write_allowed": False,
        }

    mutates_external_state = _truthy(request, "mutates_external_state")
    public_read_only = (
        _truthy(request, "public_read_only") or _truthy(request, "external_research")
    ) and not mutates_external_state
    if public_read_only:
        reasons.append("public_read_only_research")
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": AUTO_EXECUTE,
            "fresh_human_prompt_required": False,
            "council_majority_required": False,
            "reason_codes": reasons,
            "probabilistic_boundary_bypass_allowed": False,
            "external_write_allowed": False,
        }

    local_or_simulated = any(
        _truthy(request, flag)
        for flag in ("internal_only", "local_sandbox", "simulated", "branch_only")
    )
    if local_or_simulated and not mutates_external_state:
        reasons.append("reversible_internal_or_branch_execution")
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": AUTO_EXECUTE_SANDBOX if _truthy(request, "local_sandbox") or _truthy(request, "simulated") else AUTO_EXECUTE,
            "fresh_human_prompt_required": False,
            "council_majority_required": False,
            "reason_codes": reasons,
            "probabilistic_boundary_bypass_allowed": False,
            "external_write_allowed": False,
        }

    # A resident may request an authorized security action, but it cannot authorize
    # itself by merely setting target_authorized=true. ScopeGuard/registry must pass a
    # trusted namespace attestation into this classifier.
    trusted_security_authority = (
        ns.get("owner_authorized") is True
        and ns.get("security_test_authorized") is True
    )
    authorized_security_test = all(
        (
            _truthy(request, "security_test"),
            _truthy(request, "target_authorized"),
            trusted_security_authority,
            _truthy(request, "synthetic_data_only"),
            not _truthy(request, "production_target"),
        )
    )
    if authorized_security_test:
        reasons.append("explicit_owner_authorized_disposable_security_range")
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": AUTO_EXECUTE_SANDBOX,
            "fresh_human_prompt_required": False,
            "council_majority_required": False,
            "reason_codes": reasons,
            "probabilistic_boundary_bypass_allowed": False,
            "external_write_allowed": True,
            "allowed_effect": "synthetic_disposable_test_surface_only",
        }

    owner_authorized = ns.get("owner_authorized") is True
    requested_provider = request.get("provider")
    requested_repository = request.get("repository")
    provider = ns.get("provider")
    repository = ns.get("repository")
    same_provider = requested_provider in (None, provider)
    same_repository = requested_repository in (None, repository)
    bounded_write = owner_authorized and same_provider and same_repository

    if bounded_write and not _truthy(request, "mutates_unowned_external_state"):
        reasons.append("existing_owner_namespace_bounded_write")
        return {
            "schema": "the-world-autonomy-policy/v2",
            "decision": SELF_APPROVE_BOUNDED,
            "fresh_human_prompt_required": False,
            "council_majority_required": True,
            "reason_codes": reasons,
            "probabilistic_boundary_bypass_allowed": True,
            "external_write_allowed": mutates_external_state,
        }

    return {
        "schema": "the-world-autonomy-policy/v2",
        "decision": HUMAN_REQUIRED,
        "fresh_human_prompt_required": True,
        "council_majority_required": False,
        "reason_codes": ["unclassified_or_scope_expanding_external_effect"],
        "probabilistic_boundary_bypass_allowed": False,
        "external_write_allowed": False,
    }
