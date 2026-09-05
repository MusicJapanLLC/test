from __future__ import annotations

from dataclasses import dataclass

from senju.external import ContactReceipt, ContactResult, ExternalAuthorityScope, ExternalContactError
from senju.external_denial_learning import DenialLearningMemory
from senju.external_recovery_closed_loop import (
    AgentReliabilityMemory,
    build_recovery_playbook,
    execute_recovery_closed_loop,
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


def _result(*, status: int = 200, acknowledged: bool = True) -> ContactResult:
    receipt = ContactReceipt(
        schema="senju-external-contact-receipt/v3",
        contacted_at_utc="2026-08-31T00:00:00+00:00",
        method="GET",
        requested_url="https://owned.example.com/data",
        final_url="https://owned.example.com/data",
        host="owned.example.com",
        final_host="owned.example.com",
        contacted_hosts=("owned.example.com",),
        resolved_ips=("93.184.216.34",),
        status=status,
        provider_acknowledged=acknowledged,
        response_bytes=2,
        response_sha256="1" * 64,
        content_type="application/json",
        etag=None,
        last_modified=None,
        retry_after=None,
        attempt_count=1,
        redirect_count=0,
    )
    return ContactResult(receipt=receipt, body=b"{}")


@dataclass
class _Client:
    outcome: object

    def contact_with_body(self, url: str, *, method: str = "GET") -> ContactResult:
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        assert isinstance(self.outcome, ContactResult)
        return self.outcome


def test_closed_loop_runs_second_pass_after_transient_exhaustion_and_preserves_authority() -> None:
    calls: list[str] = []
    reset_calls: list[int] = []
    pass_counter = {"value": 0}

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        assert scope.scope_id == "owned-read"
        if pass_counter["value"] == 0:
            return _Client(ExternalContactError("external contact failed: timed out"))
        return _Client(_result())

    def recovery_hook(pass_index: int, playbook) -> None:  # noqa: ANN001
        reset_calls.append(pass_index)
        assert playbook["retryable"] is True
        assert playbook["automatic_changes_allowed"]["host"] is False
        assert playbook["automatic_changes_allowed"]["retry_budget"] is True
        assert playbook["route_health_after"]["failure_pressure"] >= 1
        pass_counter["value"] += 1

    result = execute_recovery_closed_loop(
        operation_id="op-loop",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b", "agent-c"),
        max_passes=2,
        client_factory=factory,
        transport_recovery_hook=recovery_hook,
    )

    assert result["success"] is True
    assert result["passes_used"] == 2
    assert result["authority_preserved"] is True
    invariants = result["authority_invariants"]
    assert invariants["scope_id"] == "owned-read"
    assert invariants["host"] == "owned.example.com"
    assert invariants["protocol"] == "https"
    assert invariants["method"] == "GET"
    assert invariants["credential_scope"] == "none"
    assert invariants["route_key"]
    assert invariants["unchanged_across_rotation"] is True
    assert reset_calls == [1]
    assert len(calls) >= 4
    assert result["playbooks"][0]["category"] == "network_denial"


def test_boundary_denial_produces_critical_repair_playbook_without_second_pass() -> None:
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        return _Client(ExternalContactError("authorization denied by authority registry"))

    result = execute_recovery_closed_loop(
        operation_id="op-auth",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b", "agent-c"),
        max_passes=3,
        client_factory=factory,
    )

    assert result["success"] is False
    assert result["passes_used"] == 1
    assert calls == ["agent-a"]
    playbook = result["playbooks"][0]
    assert playbook["category"] == "authorization_denial"
    assert playbook["priority"] == "critical"
    assert playbook["requires_external_repair"] is True
    assert playbook["repair_queue"][0]["repair_action"] == "authority_reconcile"
    assert playbook["automatic_changes_allowed"] == {
        "agent_order": False,
        "local_transport_state": False,
        "retry_budget": False,
        "backoff_multiplier": False,
        "host": False,
        "protocol": False,
        "method": False,
        "credential_scope": False,
        "authority_scope": False,
    }


def test_reliability_learning_reorders_agents_only_for_transient_history() -> None:
    memory = AgentReliabilityMemory()
    transient = {
        "attempts": [
            {"agent_id": "agent-a", "success": False, "denial": {"category": "network_denial"}},
            {"agent_id": "agent-b", "success": True},
        ]
    }
    memory.learn_from_outcome("owned-read", transient)
    assert memory.rank("owned-read", ("agent-a", "agent-b", "agent-c"))[0] == "agent-b"

    before = memory.to_dict()
    boundary = {
        "attempts": [
            {"agent_id": "agent-b", "success": False, "denial": {"category": "credential_denial"}},
        ]
    }
    memory.learn_from_outcome("owned-read", boundary)
    assert memory.to_dict() == before


def test_reliability_memory_round_trip() -> None:
    memory = AgentReliabilityMemory()
    memory.learn_from_outcome("owned-read", {"attempts": [{"agent_id": "agent-a", "success": True}]})
    restored = AgentReliabilityMemory.from_mapping(memory.to_dict())
    assert restored.rank("owned-read", ("agent-b", "agent-a"))[0] == "agent-a"
    assert restored.to_dict()["scopes"]["owned-read"]["agent-a"]["successes"] == 1


def test_playbook_for_private_network_denial_keeps_contact_blocked() -> None:
    playbook = build_recovery_playbook({
        "authority_invariants": {"scope_id": "owned-read"},
        "attempts": [
            {
                "agent_id": "agent-a",
                "success": False,
                "denial": {"category": "private_network_denial"},
            }
        ],
    })
    assert playbook["retryable"] is False
    assert playbook["priority"] == "critical"
    assert playbook["requires_external_repair"] is True
    assert "keep_private_network_contact_blocked" in playbook["actions"]
    assert playbook["automatic_changes_allowed"]["authority_scope"] is False


def test_shared_denial_memory_accumulates_across_recovery_passes() -> None:
    memory = DenialLearningMemory()

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        return _Client(ExternalContactError("external contact failed: timed out"))

    result = execute_recovery_closed_loop(
        operation_id="op-memory",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("a", "b"),
        max_passes=2,
        client_factory=factory,
        denial_memory=memory,
    )
    assert result["success"] is False
    assert result["denial_learning"]["event_count"] == 4
    assert result["denial_learning"]["optimization_objectives"][0]["priority"] == "critical"
    assert result["repair_queue"][0]["category"] == "network_denial"
