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


def test_boundary_denials_raise_self_tune_pressure_but_do_not_enable_external_retry() -> None:
    memory = DenialLearningMemory()
    states = (
        "AUTHORITY_DENIED",
        "POLICY_DENIED",
        "OUT_OF_SCOPE",
        "CREDENTIAL_DENIED",
        "PRIVATE_NETWORK_DENIED",
    )
    previous_pressure = -1
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
        state_now = feedback_state(memory)
        assert state_now["self_tune_pressure"] > previous_pressure
        previous_pressure = state_now["self_tune_pressure"]

    final = feedback_state(memory)
    assert final["denied_is_normal_failure"] is True
    assert final["boundary_failure_count"] == len(states)
    assert final["diagnostic_variation_budget"] > 1
    assert final["retry_pass_budget"] == 0
    assert final["agent_variation_budget"] == 0
    assert final["external_retry_allowed"] is False
    assert final["route_variation_budget"] == 1
    assert final["boundary_bypass_enabled"] is False


def test_security_stop_is_high_pressure_and_forces_no_external_retry() -> None:
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
    assert after["external_retry_allowed"] is False
    assert after["retry_pass_budget"] == 0
    assert after["agent_variation_budget"] == 0
    assert recommended_recovery_passes(after, configured=3) == 1


def test_network_denials_increase_bounded_retry_and_agent_variation_on_same_route() -> None:
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
    assert snapshots[-1]["agent_variation_budget"] >= 6
    assert snapshots[-1]["route_variation_budget"] == 1
    assert snapshots[-1]["route_invariant"] == "same_authorized_route_only"
    assert snapshots[-1]["external_retry_allowed"] is True


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
    assert report["schema"] == "senju-external-recovery-cycle/v3"
    assert report["denied_as_normal_failure"] is True
    assert report["guard_denial_self_tune_pressure"] is True
    assert report["boundary_bypass_enabled"] is False
    assert operation["configured_max_passes"] == 2
    assert operation["self_tuned_max_passes"] == 3
    assert operation["passes_used"] == 3
    assert operation["guard_feedback_after"]["self_tune_pressure"] >= before["self_tune_pressure"]
    assert len(calls) >= 3
