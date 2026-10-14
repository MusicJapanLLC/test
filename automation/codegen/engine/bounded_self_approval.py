"""Production self-approval gate for THE WORLD.

Autonomy Policy v2 makes low-risk/read-only/local/branch-only work immediately
self-approvable and permits explicitly authorized disposable security ranges to run
without a fresh human prompt.  Existing owner-namespace writes still use council and
existing-authority evidence.  Hard external boundaries remain explicit.
"""
from __future__ import annotations

from typing import Any

from .autonomy_policy_v2 import (
    AUTO_EXECUTE,
    AUTO_EXECUTE_SANDBOX,
    BLOCKED,
    SELF_APPROVE_BOUNDED,
    classify_autonomy,
)


def evaluate_self_approval(
    *,
    request: dict[str, Any],
    four_pillar_decision: dict[str, Any],
    namespace: dict[str, Any],
) -> dict[str, Any]:
    council = four_pillar_decision.get("council", {})
    authority = four_pillar_decision.get("authority", {})
    policy = classify_autonomy(request=request, namespace=namespace)

    majority = bool(council.get("majority"))
    owner_authorized = namespace.get("owner_authorized") is True
    provider = str(namespace.get("provider", ""))
    repository = str(namespace.get("repository", ""))

    requested_provider = request.get("provider")
    requested_repository = request.get("repository")
    provider_ok = requested_provider in (None, provider)
    repository_ok = requested_repository in (None, repository)

    internal_only = bool(request.get("internal_only"))
    existing_authority = bool(authority.get("authorized")) and authority.get("new_authority_created") is False
    authorized_security_range = (
        policy["decision"] == AUTO_EXECUTE_SANDBOX
        and request.get("security_test") is True
        and request.get("target_authorized") is True
        and request.get("synthetic_data_only") is True
    )

    immediate_policy_lane = policy["decision"] in (AUTO_EXECUTE, AUTO_EXECUTE_SANDBOX)
    bounded_policy_lane = policy["decision"] == SELF_APPROVE_BOUNDED
    policy_blocked = policy["decision"] == BLOCKED

    if immediate_policy_lane:
        # Public read-only research, internal work, local/simulated experiments, and
        # explicitly authorized disposable test ranges do not need council ritual.
        approved = not policy_blocked
    elif bounded_policy_lane:
        authority_ok = internal_only or existing_authority
        no_external_mint = authority.get("new_authority_created") is not True
        approved = all(
            (
                majority,
                owner_authorized,
                provider_ok,
                repository_ok,
                authority_ok,
                no_external_mint,
            )
        )
    else:
        approved = False

    if authorized_security_range:
        authority_basis = "explicit_authorized_disposable_security_range"
    elif existing_authority:
        authority_basis = "existing_explicit_grant"
    elif internal_only or policy["decision"] in (AUTO_EXECUTE, AUTO_EXECUTE_SANDBOX):
        authority_basis = "autonomy_policy_v2"
    else:
        authority_basis = "none"

    return {
        "schema": "the-world-bounded-self-approval/v2",
        "self_approved": approved,
        "fresh_human_prompt_required": False if approved or policy_blocked else bool(policy["fresh_human_prompt_required"]),
        "council_majority": majority,
        "council_majority_required": bool(policy["council_majority_required"]),
        "owner_namespace": owner_authorized,
        "provider": provider,
        "repository": repository,
        "authority_basis": authority_basis,
        "autonomy_decision": policy["decision"],
        "autonomy_reason_codes": list(policy["reason_codes"]),
        "hard_blocked": policy_blocked,
        "creates_new_external_authority": False,
        "scope_expansion_allowed": False,
        "probabilistic_boundary_bypass_allowed": bool(policy["probabilistic_boundary_bypass_allowed"]),
    }
