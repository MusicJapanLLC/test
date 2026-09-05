from __future__ import annotations

from dataclasses import dataclass

from senju.external import BUILTIN_AUTHORITY_SCOPES, ContactResult, ExternalAuthorityScope, ExternalContactError
from senju.external_denial_learning import DenialLearningMemory
from senju.external_recovery_cycle import RecoveryMission, run_recovery_cycle
from senju.guard_denial_feedback import (
    feedback_for_operation,
    feedback_state,
    normalize_guard_failure,
    record_guard_failure,
    recommended_recovery_passes,
    record_success_for_operation,
)


def _scope() -> ExternalAuthorityScope:
    return ExternalAuthorityScope(
        scope_id="owned-read",
        target_service="owned read lane",
        allow_hosts=frozenset({"owned.example.com"}),
        allowed_methods=frozenset({"GET", "HEAD"}),
        credential_scope="none",
        retries=0,
    )


@dataclass
class _FailClient:
    error: BaseException

    def contact_with_body(self, url: str, *, method: str = "GET") -> ContactResult:
        raise self.error


def test_all_requested_guard_states_are_normalized_into_failure_categories() -> None:
    assert normalize_guard_failure("AUTHORITY_DENIED") == "authorization_denial"
    assert normalize_guard_failure("POLICY_DENIED") == "policy_denial"
    assert normalize_guard_failure("OUT_OF_SCOPE") == "out_of_scope"
    assert normalize_guard_failure("NETWORK_DENIED") == "network_denial"
    assert normalize_guard_failure("CREDENTIAL_DENIED") == "credential_denial"
    assert normalize_guard_failure("PRIVATE_NETWORK_DENIED") == "private_network_denial"
    assert normalize_guard_failure("SECURITY_STOP") == "security_stop"


def test_boundary_denials_raise_pressure_and_diagnostic_variation_without_external_bypass() -> None:
    memory = DenialLearningMemory()
    states = (
        "AUTHORITY_DENIED",
        "POLICY_DENIED",
        "OUT_OF_SCOPE",
        "CREDENTIAL_DENIED",
        "PRIVATE_NETWORK_DENIED",
    )
    pressures: list[int] = []
    for index, state in enumerate(states):
        record_guard_failure(
            memory,
            state=state,
            operation_id=f"guard-{index}",
            agent_id="senju-a",
            scope=_scope(),
            url="https://owned.example.com/data",
            detail=state,
        )
        pressures.append(feedback_state(memory)["self_tune_pressure"])

    assert pressures == sorted(pressures)
    assert len(set(pressures)) == len(pressures)
    final = feedback_state(memory)
    assert final["schema"] == "senju-guard-denial-feedback/v2"
    assert final["denied_is_normal_failure"] is True
    assert final["feedback_loop_active"] is True
    assert final["boundary_failure_count"] == len(states)
    assert final["failure_rate"] == 1.0
    assert final["pressure_components"]["weighted_denials"] > 0
    assert final["pressure_components"]["success_rate_pressure"] > 0
    assert final["diagnostic_variation_budget"] > 16
    assert final["repair_candidate_budget"] > 1
    assert final["diagnostic_route_hypothesis_budget"] > 1
    assert final["retry_pass_budget"] == 0
    assert final["agent_variation_budget"] == 0
    assert final["same_route_retry_attempt_budget"] == 0
    assert final["external_retry_allowed"] is False
    assert final["external_route_variation_budget"] == 1
    assert final["route_variation_budget"] == 1
    assert final["boundary_bypass_enabled"] is False
    assert final["blocked_dimensions"]["authority_scope_change"] is True
    assert final["repair_queue"][0]["priority"] == "critical"
    assert all(row["retry_allowed"] is False for row in final["repair_queue"])


def test_security_stop_is_max_pressure_signal_and_collapses_recovery_to_one_pass() -> None:
    memory = DenialLearningMemory()
    record_guard_failure(
        memory,
        state="NETWORK_DENIED",
        operation_id="net-1",
        agent_id="senju-a",
        scope=_scope(),
        url="https://owned.example.com/data",
    )
    before = feedback_state(memory)
    assert before["external_retry_allowed"] is True

    record_guard_failure(
        memory,
        state="SECURITY_STOP",
        operation_id="stop-1",
        agent_id="senju-a",
        scope=_scope(),
        url="https://owned.example.com/data",
    )
    after = feedback_state(memory)
    assert after["self_tune_pressure"] > before["self_tune_pressure"]
    assert after["security_stop_active"] is True
    assert after["boundary_block_active"] is True
    assert after["external_retry_allowed"] is False
    assert after["retry_pass_budget"] == 0
    assert after["agent_variation_budget"] == 0
    assert recommended_recovery_passes(after, configured=3) == 1


def test_success_rate_collapse_adds_pressure_beyond_raw_denial_weight() -> None:
    memory = DenialLearningMemory()
    for index in range(4):
        record_success_for_operation(
            memory,
            operation_id=f"success-{index}",
            agent_id="senju-a",
            scope=_scope(),
            url="https://owned.example.com/data",
        )
    healthy = feedback_state(memory)
    assert healthy["success_rate"] == 1.0
    assert healthy["self_tune_pressure"] == 0

    for index in range(4):
        record_guard_failure(
            memory,
            state="NETWORK_DENIED",
            operation_id=f"deny-{index}",
            agent_id="senju-a",
            scope=_scope(),
            url="https://owned.example.com/data",
        )
    degraded = feedback_state(memory)
    assert degraded["success_rate"] == 0.5
    assert degraded["failure_rate"] == 0.5
    assert degraded["pressure_components"]["success_rate_pressure"] > 0
    assert degraded["self_tune_pressure"] > healthy["self_tune_pressure"]


def test_network_denials_increase_bounded_retry_agent_and_same_route_attempt_variation() -> None:
    memory = DenialLearningMemory()
    snapshots = []
    for index in range(6):
        record_guard_failure(
            memory,
            state="NETWORK_DENIED",
            operation_id=f"net-{index}",
            agent_id=f"senju-{index % 2}",
            scope=_scope(),
            url="https://owned.example.com/data",
        )
        snapshots.append(feedback_state(memory))

    assert snapshots[-1]["self_tune_pressure"] > snapshots[0]["self_tune_pressure"]
    assert snapshots[-1]["success_rate"] == 0.0
    assert snapshots[-1]["retry_pass_budget"] == 3
    assert snapshots[-1]["agent_variation_budget"] == 8
    assert snapshots[-1]["same_route_retry_attempt_budget"] == 24
    assert snapshots[-1]["external_route_variation_budget"] == 1
    assert snapshots[-1]["route_invariant"] == "same_authorized_route_only"
    assert snapshots[-1]["external_retry_allowed"] is True
    assert snapshots[-1]["guard_contact_escalation"] == "same_route_transient_retry"
    assert snapshots[-1]["variation_plan"]["diagnostic_route_hypotheses"] > 1


def test_production_recovery_cycle_consumes_prior_network_pressure() -> None:
    mission = RecoveryMission(
        mission_id="feedback-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )
    scope = BUILTIN_AUTHORITY_SCOPES["canary_telemetry"]
    memory = DenialLearningMemory()
    for index in range(6):
        record_guard_failure(
            memory,
            state="NETWORK_DENIED",
            operation_id=f"prior-{index}",
            agent_id="senju-a",
            scope=scope,
            url=mission.url,
        )

    before = feedback_for_operation(memory, scope=scope, url=mission.url)
    assert before["retry_pass_budget"] == 3
    assert recommended_recovery_passes(before, configured=2) == 3

    calls: list[str] = []

    def factory(current_scope: ExternalAuthorityScope, agent_id: str) -> _FailClient:
        calls.append(agent_id)
        return _FailClient(ExternalContactError("network is unreachable"))

    report = run_recovery_cycle(
        missions=(mission,),
        denial_data=memory.summary(),
        max_missions=1,
        max_passes=2,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )

    operation = report["operations"][0]
    assert report["schema"] == "senju-external-recovery-cycle/v4"
    assert report["same_cycle_pressure_escalation"] is True
    assert report["denied_as_normal_failure"] is True
    assert report["guard_denial_self_tune_pressure"] is True
    assert report["boundary_bypass_enabled"] is False
    assert report["external_route_variation_budget"] == 1
    assert operation["configured_max_passes"] == 2
    assert operation["self_tuned_initial_max_passes"] == 3
    assert operation["passes_used"] == 3
    assert operation["guard_feedback_after"]["self_tune_pressure"] >= before["self_tune_pressure"]
    assert operation["self_tune_variation_plan"]["external_route_candidates"] == 1
    assert len(calls) >= 3


def test_fresh_transient_denials_can_raise_pressure_and_unlock_extra_pass_in_same_cycle() -> None:
    mission = RecoveryMission(
        mission_id="fresh-pressure-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )
    calls: list[str] = []

    def factory(current_scope: ExternalAuthorityScope, agent_id: str) -> _FailClient:
        calls.append(agent_id)
        return _FailClient(ExternalContactError("network is unreachable"))

    report = run_recovery_cycle(
        missions=(mission,),
        max_missions=1,
        max_passes=1,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )
    operation = report["operations"][0]
    assert operation["configured_max_passes"] == 1
    assert operation["feedback_loop_escalated"] is True
    assert operation["pressure_escalation_rounds"] >= 1
    assert operation["passes_used"] >= 2
    assert operation["passes_used"] <= 3
    assert operation["pressure_delta"] > 0
    assert operation["pressure_trajectory"] == sorted(operation["pressure_trajectory"])
    assert operation["guard_feedback_after"]["external_route_variation_budget"] == 1
    assert report["authority_preserved"] is True
    assert len(calls) >= 2
