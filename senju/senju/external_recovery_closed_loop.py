"""Closed-loop external recovery for production Senju contact lanes.

This module turns denial learning into a bounded recovery loop. It aggressively
optimizes execution reliability while preserving the exact external authority
contract. It may re-rank and rotate execution agents after transient transport or
service failures, and may run another bounded recovery pass after an optional local
transport-reset hook. It never changes host, protocol, method, credential scope, or
authority in response to a boundary denial.
"""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .external import ExternalAuthorityScope, ExternalContactClient
from .external_denial_learning import (
    BOUNDARY_DENIALS,
    RETRYABLE_DENIALS,
    DenialLearningMemory,
    execute_with_agent_rotation,
    optimization_objective,
)

RECOVERY_SCHEMA = "senju-external-recovery-closed-loop/v2"
RELIABILITY_SCHEMA = "senju-external-agent-reliability/v1"
PLAYBOOK_SCHEMA = "senju-external-recovery-playbook/v2"


@dataclasses.dataclass
class AgentStats:
    attempts: int = 0
    successes: int = 0
    transient_failures: int = 0
    last_outcome: str | None = None

    @property
    def score(self) -> float:
        success_ratio = (self.successes + 1.0) / (self.attempts + 2.0)
        penalty = min(0.30, 0.05 * self.transient_failures)
        return round(max(0.0, success_ratio - penalty), 6)


@dataclasses.dataclass
class AgentReliabilityMemory:
    scopes: dict[str, dict[str, AgentStats]] = dataclasses.field(default_factory=dict)

    def state(self, scope_id: str, agent_id: str) -> AgentStats:
        scope = self.scopes.setdefault(scope_id, {})
        return scope.setdefault(agent_id, AgentStats())

    def rank(self, scope_id: str, agents: Sequence[str]) -> tuple[str, ...]:
        unique = tuple(dict.fromkeys(str(x).strip() for x in agents if str(x).strip()))
        return tuple(sorted(unique, key=lambda agent: (-self.state(scope_id, agent).score, agent)))

    def learn_from_outcome(self, scope_id: str, outcome: Mapping[str, Any]) -> None:
        for attempt in outcome.get("attempts", []):
            if not isinstance(attempt, Mapping):
                continue
            agent_id = str(attempt.get("agent_id") or "").strip()
            if not agent_id:
                continue
            if bool(attempt.get("success", False)):
                state = self.state(scope_id, agent_id)
                state.attempts += 1
                state.successes += 1
                state.last_outcome = "success"
                continue
            denial = attempt.get("denial") or {}
            category = str(denial.get("category") or "external_failure")
            if category not in RETRYABLE_DENIALS:
                continue
            state = self.state(scope_id, agent_id)
            state.attempts += 1
            state.transient_failures += 1
            state.last_outcome = category

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema": RELIABILITY_SCHEMA,
            "scopes": {
                scope_id: {
                    agent_id: dataclasses.asdict(stats) | {"score": stats.score}
                    for agent_id, stats in sorted(agents.items())
                }
                for scope_id, agents in sorted(self.scopes.items())
            },
        }

    @staticmethod
    def from_mapping(data: Mapping[str, Any] | None) -> "AgentReliabilityMemory":
        out = AgentReliabilityMemory()
        if not data or data.get("schema") != RELIABILITY_SCHEMA:
            return out
        raw_scopes = data.get("scopes") or {}
        if not isinstance(raw_scopes, Mapping):
            return out
        for scope_id, raw_agents in raw_scopes.items():
            if not isinstance(raw_agents, Mapping):
                continue
            for agent_id, raw in raw_agents.items():
                if not isinstance(raw, Mapping):
                    continue
                out.scopes.setdefault(str(scope_id), {})[str(agent_id)] = AgentStats(
                    attempts=max(0, int(raw.get("attempts", 0))),
                    successes=max(0, int(raw.get("successes", 0))),
                    transient_failures=max(0, int(raw.get("transient_failures", 0))),
                    last_outcome=(None if raw.get("last_outcome") is None else str(raw.get("last_outcome"))),
                )
        return out

    def write(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_recovery_playbook(outcome: Mapping[str, Any]) -> dict[str, Any]:
    attempts = [x for x in outcome.get("attempts", []) if isinstance(x, Mapping)]
    denials = [x.get("denial") for x in attempts if isinstance(x.get("denial"), Mapping)]
    category = str((denials[-1] if denials else {}).get("category") or "external_failure")
    retryable = category in RETRYABLE_DENIALS

    actions_by_category = {
        "network_denial": [
            "re_rank_agents_by_scope_reliability",
            "apply_route_health_backoff",
            "run_local_transport_recovery_hook",
            "retry_exact_same_authorized_operation",
        ],
        "transient_service_failure": [
            "re_rank_agents_by_scope_reliability",
            "apply_route_health_backoff",
            "honor_provider_availability_signal",
            "retry_exact_same_authorized_operation",
        ],
        "rate_limit_denial": [
            "reduce_request_pressure",
            "schedule_retry_after_provider_backoff",
        ],
        "authorization_denial": [
            "repair_authority_registry_input",
            "request_explicit_authority_refresh",
        ],
        "host_denial": [
            "repair_registered_host_mapping",
            "request_scope_registration_review",
        ],
        "credential_denial": [
            "refresh_configured_credential_via_authorized_provider",
            "verify_credential_scope_binding",
        ],
        "private_network_denial": [
            "keep_private_network_contact_blocked",
            "request_out_of_band_network_classification_review",
        ],
        "protocol_denial": [
            "repair_operation_to_match_existing_authority_contract",
        ],
        "external_failure": [
            "collect_diagnostics",
            "require_failure_classification_before_retry",
        ],
    }
    return {
        "schema": PLAYBOOK_SCHEMA,
        "category": category,
        "retryable": retryable,
        "priority": "critical" if category in BOUNDARY_DENIALS or len(denials) >= 3 else "high",
        "objective": optimization_objective(category),
        "actions": actions_by_category.get(category, actions_by_category["external_failure"]),
        "authority_invariants": dict(outcome.get("authority_invariants") or {}),
        "route_health_before": dict(outcome.get("route_health_before") or {}),
        "route_health_after": dict(outcome.get("route_health_after") or {}),
        "agent_order": list(outcome.get("agent_order") or []),
        "agent_budget": int(outcome.get("agent_budget", 0) or 0),
        "repair_queue": list(outcome.get("repair_queue") or []),
        "automatic_changes_allowed": {
            "agent_order": retryable,
            "local_transport_state": retryable,
            "retry_budget": retryable,
            "backoff_multiplier": retryable,
            "host": False,
            "protocol": False,
            "method": False,
            "credential_scope": False,
            "authority_scope": False,
        },
        "requires_external_repair": category in BOUNDARY_DENIALS,
    }


TransportRecoveryHook = Callable[[int, Mapping[str, Any]], None]
ClientFactory = Callable[[ExternalAuthorityScope, str], ExternalContactClient]


def execute_recovery_closed_loop(
    *,
    operation_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    agents: Sequence[str] = ("senju-a", "senju-b", "senju-c"),
    max_passes: int = 2,
    client_factory: ClientFactory | None = None,
    denial_memory: DenialLearningMemory | None = None,
    reliability_memory: AgentReliabilityMemory | None = None,
    transport_recovery_hook: TransportRecoveryHook | None = None,
) -> dict[str, Any]:
    """Run bounded recovery until success or a non-retryable boundary denial."""
    passes = max(1, min(int(max_passes), 3))
    learning = denial_memory or DenialLearningMemory()
    reliability = reliability_memory or AgentReliabilityMemory()
    requested_agents = tuple(dict.fromkeys(str(x).strip() for x in agents if str(x).strip()))
    if not requested_agents:
        raise ValueError("at least one agent id is required")

    outcomes: list[dict[str, Any]] = []
    playbooks: list[dict[str, Any]] = []
    invariant_snapshot: dict[str, Any] | None = None

    for pass_index in range(1, passes + 1):
        ranked_agents = reliability.rank(scope.scope_id, requested_agents)
        outcome = execute_with_agent_rotation(
            operation_id=operation_id,
            scope=scope,
            url=url,
            method=method,
            agents=ranked_agents,
            client_factory=client_factory,
            memory=learning,
            max_agents=min(8, len(ranked_agents)),
        )
        reliability.learn_from_outcome(scope.scope_id, outcome)
        outcomes.append(outcome)

        current_invariants = dict(outcome.get("authority_invariants") or {})
        if invariant_snapshot is None:
            invariant_snapshot = current_invariants
        elif current_invariants != invariant_snapshot:
            raise RuntimeError("authority invariants changed across recovery passes")

        if bool(outcome.get("success", False)):
            return {
                "schema": RECOVERY_SCHEMA,
                "operation_id": operation_id,
                "success": True,
                "passes_used": pass_index,
                "selected_agent": outcome.get("selected_agent"),
                "authority_invariants": invariant_snapshot,
                "authority_preserved": True,
                "outcomes": outcomes,
                "playbooks": playbooks,
                "repair_queue": learning.repair_queue(),
                "denial_learning": learning.summary(),
                "agent_reliability": reliability.to_dict(),
            }

        playbook = build_recovery_playbook(outcome)
        playbooks.append(playbook)
        if not bool(playbook.get("retryable", False)):
            break
        if pass_index >= passes:
            break
        if transport_recovery_hook is not None:
            transport_recovery_hook(pass_index, playbook)

    return {
        "schema": RECOVERY_SCHEMA,
        "operation_id": operation_id,
        "success": False,
        "passes_used": len(outcomes),
        "selected_agent": None,
        "authority_invariants": invariant_snapshot or {},
        "authority_preserved": True,
        "outcomes": outcomes,
        "playbooks": playbooks,
        "repair_queue": learning.repair_queue(),
        "denial_learning": learning.summary(),
        "agent_reliability": reliability.to_dict(),
    }
