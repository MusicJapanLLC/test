"""Guard-denial feedback pressure for Senju production recovery.

Every Guard/runtime denial is a first-class failure signal. Failure volume, denial
density, success-rate collapse, and recent denial weight all increase self-tuning
pressure. Diagnostic and repair variation grows for every denial category.

External retry/agent variation is intentionally narrower: it may grow only for
transient network/service failures and always keeps the exact authorized route.
Authority, policy, scope, credential, private-network, protocol, rate-limit, and
security-stop denials increase pressure and repair urgency without becoming
permission, route expansion, or identity-based bypass.
"""
from __future__ import annotations

import dataclasses
from collections import Counter
from typing import Any, Mapping

from .external import ExternalAuthorityScope
from .external_denial_learning import (
    DenialEvent,
    DenialLearningMemory,
    denial_event,
    success_event,
)

FEEDBACK_SCHEMA = "senju-guard-denial-feedback/v2"

RAW_FAILURE_CATEGORY = {
    "AUTHORITY_DENIED": "authorization_denial",
    "POLICY_DENIED": "policy_denial",
    "OUT_OF_SCOPE": "out_of_scope",
    "NETWORK_DENIED": "network_denial",
    "CREDENTIAL_DENIED": "credential_denial",
    "PRIVATE_NETWORK_DENIED": "private_network_denial",
    "SECURITY_STOP": "security_stop",
}

BOUNDARY_FAILURES = frozenset({
    "authorization_denial",
    "policy_denial",
    "out_of_scope",
    "credential_denial",
    "private_network_denial",
    "security_stop",
    "host_denial",
    "protocol_denial",
    "rate_limit_denial",
})
TRANSIENT_FAILURES = frozenset({"network_denial", "transient_service_failure"})

_PRESSURE_WEIGHT = {
    "security_stop": 14,
    "authorization_denial": 10,
    "policy_denial": 10,
    "out_of_scope": 10,
    "credential_denial": 8,
    "private_network_denial": 10,
    "host_denial": 7,
    "protocol_denial": 7,
    "network_denial": 5,
    "transient_service_failure": 5,
    "rate_limit_denial": 4,
    "external_failure": 3,
}

_OBJECTIVE = {
    "authorization_denial": "reconcile explicit authority before another external attempt",
    "policy_denial": "reconcile the operation with the active policy decision",
    "out_of_scope": "repair scope registration or obtain explicit in-scope authority",
    "network_denial": "increase bounded same-authority transport recovery variation",
    "credential_denial": "repair the configured credential through its authorized provider",
    "private_network_denial": "keep contact blocked and reconcile private-network scope out of band",
    "security_stop": "keep external execution stopped until the independent stop is released",
    "host_denial": "repair the registered destination mapping without changing the intended target",
    "protocol_denial": "reconcile the operation with the existing protocol contract",
    "rate_limit_denial": "reduce request pressure and honor provider backoff",
    "transient_service_failure": "increase bounded same-route retry and agent variation",
    "external_failure": "diagnose and reconcile the failure before another external attempt",
}

_REPAIR_ACTION = {
    "authorization_denial": "authority_reconcile",
    "policy_denial": "policy_reconcile",
    "out_of_scope": "scope_reconcile",
    "network_denial": "same_route_transport_recovery",
    "credential_denial": "credential_provider_refresh",
    "private_network_denial": "network_scope_reconcile",
    "security_stop": "wait_for_independent_security_stop_release",
    "host_denial": "registry_reconcile",
    "protocol_denial": "protocol_contract_reconcile",
    "rate_limit_denial": "provider_backoff",
    "transient_service_failure": "same_route_service_recovery",
    "external_failure": "diagnostic_review",
}


def normalize_guard_failure(state: str) -> str:
    """Normalize explicit Guard/runtime failure states into normal failure categories."""
    raw = str(state).strip().upper().replace("-", "_").replace(" ", "_")
    if raw in RAW_FAILURE_CATEGORY:
        return RAW_FAILURE_CATEGORY[raw]
    lowered = str(state).strip().lower()
    if "security stop" in lowered or "security_stop" in lowered or "hard deny" in lowered:
        return "security_stop"
    if "policy denied" in lowered or "policy_denied" in lowered or "blocked by policy" in lowered:
        return "policy_denial"
    if "out of scope" in lowered or "out_of_scope" in lowered:
        return "out_of_scope"
    if "authority denied" in lowered or "authority_denied" in lowered:
        return "authorization_denial"
    if "credential denied" in lowered or "credential_denied" in lowered:
        return "credential_denial"
    if "private network denied" in lowered or "private_network_denied" in lowered:
        return "private_network_denial"
    if "network denied" in lowered or "network_denied" in lowered:
        return "network_denial"
    return "external_failure"


def _objective(category: str) -> str:
    return _OBJECTIVE.get(category, _OBJECTIVE["external_failure"])


def _repair_action(category: str) -> str:
    return _REPAIR_ACTION.get(category, "diagnostic_review")


def guard_failure_event(
    *,
    state: str,
    operation_id: str,
    agent_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    detail: str = "",
) -> DenialEvent:
    """Create a normal denial-memory event from an explicit Guard failure state."""
    base = denial_event(
        operation_id=operation_id,
        agent_id=agent_id,
        scope=scope,
        url=url,
        method=method,
        error=detail or state,
    )
    category = normalize_guard_failure(state)
    return dataclasses.replace(
        base,
        category=category,
        detail=(detail or state)[:500],
        retryable=category in TRANSIENT_FAILURES,
        optimization_objective=_objective(category),
        repair_action=_repair_action(category),
    )


def record_guard_failure(
    memory: DenialLearningMemory,
    *,
    state: str,
    operation_id: str,
    agent_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    detail: str = "",
) -> DenialEvent:
    event = guard_failure_event(
        state=state,
        operation_id=operation_id,
        agent_id=agent_id,
        scope=scope,
        url=url,
        method=method,
        detail=detail,
    )
    memory.record(event)
    return event


def operation_route_key(*, scope: ExternalAuthorityScope, url: str, method: str = "GET") -> str:
    """Derive the existing denial-memory route key without mutating memory."""
    probe = denial_event(
        operation_id="guard-feedback-route-probe",
        agent_id="guard-feedback",
        scope=scope,
        url=url,
        method=method,
        error="network is unreachable",
    )
    return probe.route_key


def _guard_repair_queue(categories: Counter[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for category, count in categories.items():
        boundary = category in BOUNDARY_FAILURES
        transient = category in TRANSIENT_FAILURES
        rows.append({
            "category": category,
            "count": int(count),
            "priority": "critical" if boundary or count >= 3 else "high",
            "repair_action": _repair_action(category),
            "objective": _objective(category),
            "retry_allowed": transient,
            "boundary_failure": boundary,
        })
    return sorted(
        rows,
        key=lambda row: (
            0 if row["priority"] == "critical" else 1,
            -int(row["count"]),
            str(row["category"]),
        ),
    )


def feedback_state(
    memory: DenialLearningMemory,
    *,
    route_key: str | None = None,
) -> dict[str, Any]:
    """Build a high-gain self-tuning pressure state from failures and successes."""
    events = [
        dict(row) for row in memory.events
        if route_key is None or str(row.get("route_key", "")) == route_key
    ]
    successes = [
        dict(row) for row in memory.successes
        if route_key is None or str(row.get("route_key", "")) == route_key
    ]
    categories: Counter[str] = Counter(str(row.get("category", "external_failure")) for row in events)
    failures = len(events)
    success_count = len(successes)
    total = failures + success_count
    success_rate = (success_count / total) if total else 1.0
    failure_rate = 1.0 - success_rate

    weighted_denials = sum(_PRESSURE_WEIGHT.get(category, 3) * count for category, count in categories.items())
    success_rate_pressure = int(round(failure_rate * 25.0)) if total else 0
    failure_volume_pressure = min(20, failures * 2)
    recent_rows = events[-8:]
    recent_denial_pressure = min(
        20,
        sum(_PRESSURE_WEIGHT.get(str(row.get("category", "external_failure")), 3) for row in recent_rows) // 2,
    )
    pressure = min(
        100,
        weighted_denials + success_rate_pressure + failure_volume_pressure + recent_denial_pressure,
    )

    if pressure >= 70:
        pressure_level = "critical"
    elif pressure >= 45:
        pressure_level = "high"
    elif pressure >= 20:
        pressure_level = "elevated"
    else:
        pressure_level = "normal"

    transient_count = sum(categories.get(category, 0) for category in TRANSIENT_FAILURES)
    boundary_count = sum(categories.get(category, 0) for category in BOUNDARY_FAILURES)
    latest_category = str(events[-1].get("category", "")) if events else None
    security_stop_active = latest_category == "security_stop"
    boundary_block_active = latest_category in BOUNDARY_FAILURES if latest_category else False

    diagnostic_variation_budget = min(64, 1 + pressure // 2 + failures)
    repair_candidate_budget = min(32, 1 + pressure // 4 + boundary_count)
    diagnostic_route_hypothesis_budget = min(16, 1 + pressure // 12 + boundary_count)

    if transient_count:
        retry_pass_budget = min(3, 1 + transient_count // 2 + (1 if pressure >= 60 else 0))
        agent_variation_budget = min(8, 3 + transient_count + pressure // 25)
    else:
        retry_pass_budget = 0
        agent_variation_budget = 0

    if boundary_block_active or security_stop_active:
        retry_pass_budget = 0
        agent_variation_budget = 0

    same_route_retry_attempt_budget = (
        min(24, retry_pass_budget * max(1, agent_variation_budget))
        if retry_pass_budget > 0
        else 0
    )

    if pressure >= 70:
        self_tune_stage = 4
    elif pressure >= 45:
        self_tune_stage = 3
    elif pressure >= 20:
        self_tune_stage = 2
    elif failures:
        self_tune_stage = 1
    else:
        self_tune_stage = 0

    repair_queue = _guard_repair_queue(categories)
    external_retry_allowed = bool(retry_pass_budget > 0)

    return {
        "schema": FEEDBACK_SCHEMA,
        "route_key": route_key,
        "denied_is_normal_failure": True,
        "feedback_loop_active": bool(failures),
        "failure_count": failures,
        "success_count": success_count,
        "success_rate": round(success_rate, 4),
        "failure_rate": round(failure_rate, 4),
        "by_category": dict(sorted(categories.items())),
        "self_tune_pressure": pressure,
        "pressure_level": pressure_level,
        "self_tune_stage": self_tune_stage,
        "pressure_components": {
            "weighted_denials": weighted_denials,
            "success_rate_pressure": success_rate_pressure,
            "failure_volume_pressure": failure_volume_pressure,
            "recent_denial_pressure": recent_denial_pressure,
        },
        "diagnostic_variation_budget": diagnostic_variation_budget,
        "repair_candidate_budget": repair_candidate_budget,
        "diagnostic_route_hypothesis_budget": diagnostic_route_hypothesis_budget,
        "retry_pass_budget": retry_pass_budget,
        "agent_variation_budget": agent_variation_budget,
        "same_route_retry_attempt_budget": same_route_retry_attempt_budget,
        "external_route_variation_budget": 1,
        "route_variation_budget": 1,
        "route_invariant": "same_authorized_route_only",
        "boundary_failure_count": boundary_count,
        "transient_failure_count": transient_count,
        "latest_failure_category": latest_category,
        "boundary_block_active": boundary_block_active,
        "external_retry_allowed": external_retry_allowed,
        "security_stop_active": security_stop_active,
        "guard_contact_escalation": (
            "same_route_transient_retry"
            if external_retry_allowed
            else "repair_and_diagnostics_only"
            if failures
            else "idle"
        ),
        "repair_queue": repair_queue,
        "variation_plan": {
            "diagnostic_variations": diagnostic_variation_budget,
            "repair_candidates": repair_candidate_budget,
            "diagnostic_route_hypotheses": diagnostic_route_hypothesis_budget,
            "external_route_candidates": 1,
            "agent_candidates": agent_variation_budget,
            "retry_passes": retry_pass_budget,
            "same_route_attempt_budget": same_route_retry_attempt_budget,
        },
        "feedback_chain": [
            "DENIED -> normal_failure",
            "normal_failure -> success_rate_pressure",
            "success_rate_pressure -> self_tune_pressure",
            "self_tune_pressure -> diagnostic_variation",
            "transient_only -> bounded_retry_and_agent_variation",
            "boundary_denial -> repair_pressure_without_bypass",
        ],
        "blocked_dimensions": {
            "host_change": True,
            "protocol_change": True,
            "method_change": True,
            "credential_scope_change": True,
            "authority_scope_change": True,
            "private_network_bypass": True,
            "security_stop_bypass": True,
        },
        "boundary_bypass_enabled": False,
    }


def feedback_for_operation(
    memory: DenialLearningMemory,
    *,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
) -> dict[str, Any]:
    return feedback_state(
        memory,
        route_key=operation_route_key(scope=scope, url=url, method=method),
    )


def recommended_recovery_passes(
    state: Mapping[str, Any],
    *,
    configured: int = 2,
) -> int:
    """Choose a bounded pass count; only transient pressure can increase it."""
    configured = max(1, min(int(configured), 3))
    if bool(state.get("security_stop_active", False)):
        return 1
    if bool(state.get("boundary_block_active", False)):
        return 1
    if not bool(state.get("external_retry_allowed", False)):
        return configured
    pressure_budget = max(1, min(int(state.get("retry_pass_budget", 1)), 3))
    return min(3, max(configured, pressure_budget))


def record_success_for_operation(
    memory: DenialLearningMemory,
    *,
    operation_id: str,
    agent_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    status: int = 200,
) -> None:
    memory.record_success(success_event(
        operation_id=operation_id,
        agent_id=agent_id,
        scope=scope,
        url=url,
        method=method,
        status=status,
    ))
