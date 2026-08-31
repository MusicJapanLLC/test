"""Guard-denial feedback pressure for Senju production recovery.

Guard, policy, authority, scope, credential, private-network, security-stop, and
network denials are all first-class failures. They all increase self-tuning pressure,
but only transient network/service failures may automatically increase external
retry/agent variation. Boundary denials increase diagnostic/repair variation instead
of becoming permission or a bypass signal.
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

FEEDBACK_SCHEMA = "senju-guard-denial-feedback/v1"

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
    "security_stop": 10,
    "authorization_denial": 7,
    "policy_denial": 7,
    "out_of_scope": 7,
    "credential_denial": 6,
    "private_network_denial": 7,
    "host_denial": 5,
    "protocol_denial": 5,
    "network_denial": 3,
    "transient_service_failure": 3,
    "rate_limit_denial": 2,
    "external_failure": 2,
}

_OBJECTIVE = {
    "authorization_denial": "reconcile explicit authority before another external attempt",
    "policy_denial": "reconcile the operation with the active policy decision",
    "out_of_scope": "repair scope registration or obtain explicit in-scope authority",
    "network_denial": "increase bounded same-authority transport recovery variation",
    "credential_denial": "repair the configured credential through its authorized provider",
    "private_network_denial": "keep contact blocked and reconcile private-network scope out of band",
    "security_stop": "keep external execution stopped until the independent stop is released",
    "transient_service_failure": "increase bounded same-route retry and agent variation",
}

_REPAIR_ACTION = {
    "authorization_denial": "authority_reconcile",
    "policy_denial": "policy_reconcile",
    "out_of_scope": "scope_reconcile",
    "network_denial": "same_route_transport_recovery",
    "credential_denial": "credential_provider_refresh",
    "private_network_denial": "network_scope_reconcile",
    "security_stop": "wait_for_independent_security_stop_release",
    "transient_service_failure": "same_route_service_recovery",
}


def normalize_guard_failure(state: str) -> str:
    """Normalize explicit guard/runtime failure states into normal failure categories."""
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
    return _OBJECTIVE.get(category, "diagnose and reconcile the failure before another external attempt")


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


def feedback_state(
    memory: DenialLearningMemory,
    *,
    route_key: str | None = None,
) -> dict[str, Any]:
    """Build the self-tuning pressure state from ordinary failures and successes."""
    events = [
        dict(row) for row in memory.events
        if route_key is None or str(row.get("route_key", "")) == route_key
    ]
    successes = [
        dict(row) for row in memory.successes
        if route_key is None or str(row.get("route_key", "")) == route_key
    ]
    categories = Counter(str(row.get("category", "external_failure")) for row in events)
    failures = len(events)
    success_count = len(successes)
    total = failures + success_count
    success_rate = (success_count / total) if total else 1.0
    weighted_denials = sum(_PRESSURE_WEIGHT.get(category, 2) * count for category, count in categories.items())
    rate_pressure = int(round((1.0 - success_rate) * 10.0)) if total else 0
    pressure = min(100, weighted_denials + rate_pressure)
    if pressure >= 50:
        pressure_level = "critical"
    elif pressure >= 25:
        pressure_level = "high"
    elif pressure >= 10:
        pressure_level = "elevated"
    else:
        pressure_level = "normal"

    transient_count = sum(categories.get(category, 0) for category in TRANSIENT_FAILURES)
    boundary_count = sum(categories.get(category, 0) for category in BOUNDARY_FAILURES)
    latest_category = str(events[-1].get("category", "")) if events else None
    security_stop_active = latest_category == "security_stop"
    latest_boundary = latest_category in BOUNDARY_FAILURES if latest_category else False

    # Diagnostic/self-tuning variation grows for every denial category. External contact
    # variation grows only for transient transport/service failures and never changes
    # host, protocol, method, credential scope, or authority scope.
    diagnostic_variation_budget = min(16, 1 + pressure // 6)
    if transient_count:
        retry_pass_budget = min(3, 1 + max(1, transient_count // 2))
        agent_variation_budget = min(8, 3 + transient_count // 2)
    else:
        retry_pass_budget = 0
        agent_variation_budget = 0
    if latest_boundary or security_stop_active:
        retry_pass_budget = 0
        agent_variation_budget = 0

    return {
        "schema": FEEDBACK_SCHEMA,
        "route_key": route_key,
        "denied_is_normal_failure": True,
        "failure_count": failures,
        "success_count": success_count,
        "success_rate": round(success_rate, 4),
        "by_category": dict(sorted(categories.items())),
        "self_tune_pressure": pressure,
        "pressure_level": pressure_level,
        "diagnostic_variation_budget": diagnostic_variation_budget,
        "retry_pass_budget": retry_pass_budget,
        "agent_variation_budget": agent_variation_budget,
        "route_variation_budget": 1,
        "route_invariant": "same_authorized_route_only",
        "boundary_failure_count": boundary_count,
        "transient_failure_count": transient_count,
        "latest_failure_category": latest_category,
        "external_retry_allowed": bool(retry_pass_budget > 0),
        "security_stop_active": security_stop_active,
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
