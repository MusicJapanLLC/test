from __future__ import annotations

from dataclasses import dataclass

import pytest

from senju.external import ContactReceipt, ContactResult, ExternalAuthorityScope, ExternalContactError
from senju.external_denial_learning import (
    DenialLearningMemory,
    classify_denial,
    denial_event,
    execute_with_agent_rotation,
    success_event,
)


def _scope() -> ExternalAuthorityScope:
    return ExternalAuthorityScope(
        scope_id="owned-read",
        target_service="owned read lane",
        allow_hosts=frozenset({"owned.example.com"}),
        allowed_methods=frozenset({"GET", "HEAD"}),
        credential_scope="none",
    )


def _result(status: int = 200, acknowledged: bool = True) -> ContactResult:
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
        response_sha256="0" * 64,
        content_type="application/json",
        etag=None,
        last_modified=None,
        retry_after=None,
        attempt_count=1,
        redirect_count=0,
    )
    return ContactResult(receipt=receipt, body=b"{}")


@dataclass
class _FakeClient:
    outcome: object

    def contact_with_body(self, url: str, *, method: str = "GET") -> ContactResult:
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        assert isinstance(self.outcome, ContactResult)
        return self.outcome


def test_transient_network_denial_rotates_agent_without_changing_authority() -> None:
    calls: list[str] = []
    outcomes = {
        "agent-a": ExternalContactError("external contact failed after 2 attempt(s): timed out"),
        "agent-b": _result(),
    }

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        assert scope.scope_id == "owned-read"
        return _FakeClient(outcomes[agent_id])

    result = execute_with_agent_rotation(
        operation_id="op-1",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b", "agent-c"),
        client_factory=factory,
    )

    assert result["success"] is True
    assert result["selected_agent"] == "agent-b"
    assert result["rotation_count"] == 1
    assert calls == ["agent-a", "agent-b"]
    invariants = result["authority_invariants"]
    assert invariants["scope_id"] == "owned-read"
    assert invariants["host"] == "owned.example.com"
    assert invariants["protocol"] == "https"
    assert invariants["method"] == "GET"
    assert invariants["credential_scope"] == "none"
    assert invariants["route_key"]
    assert invariants["unchanged_across_rotation"] is True
    assert result["attempts"][0]["denial"]["category"] == "network_denial"
    assert result["attempts"][0]["denial"]["agent_id"] == "agent-a"
    assert result["attempts"][0]["next_action"] == "rotate_same_authority_agent"
    assert result["route_health_after"]["successes"] == 1


def test_authorization_denial_is_critical_repair_and_not_retried_through_another_agent() -> None:
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        return _FakeClient(ExternalContactError("authorization denied by authority registry"))

    result = execute_with_agent_rotation(
        operation_id="op-auth",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b"),
        client_factory=factory,
    )

    assert result["success"] is False
    assert calls == ["agent-a"]
    denial = result["attempts"][0]["denial"]
    assert denial["category"] == "authorization_denial"
    assert denial["retryable"] is False
    assert denial["agent_id"] == "agent-a"
    assert denial["repair_action"] == "authority_reconcile"
    assert result["attempts"][0]["next_action"] == "authority_reconcile"
    assert result["denial_learning"]["optimization_objectives"][0]["priority"] == "critical"
    assert result["repair_queue"][0]["retry_allowed"] is False


def test_credential_and_private_network_denials_are_optimization_signals_not_rotation_triggers() -> None:
    assert classify_denial(status=401) == "credential_denial"
    assert classify_denial(error="non-public address blocked for owned.example.com: 127.0.0.1") == "private_network_denial"

    memory = DenialLearningMemory()
    for index in range(3):
        memory.record(denial_event(
            operation_id=f"op-{index}",
            agent_id="agent-a",
            scope=_scope(),
            url="https://owned.example.com/data",
            method="GET",
            status=401,
        ))
    summary = memory.summary()
    assert summary["by_category"]["credential_denial"] == 3
    assert summary["optimization_objectives"][0]["priority"] == "critical"
    assert "credential" in summary["optimization_objectives"][0]["objective"]
    assert summary["repair_queue"][0]["repair_action"] == "credential_provider_refresh"


def test_http_403_is_authorization_denial_and_does_not_rotate() -> None:
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        return _FakeClient(_result(status=403, acknowledged=False))

    result = execute_with_agent_rotation(
        operation_id="op-403",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b"),
        client_factory=factory,
    )
    assert result["success"] is False
    assert calls == ["agent-a"]
    assert result["attempts"][0]["denial"]["category"] == "authorization_denial"


def test_agent_health_ranking_prefers_prior_successful_executor() -> None:
    memory = DenialLearningMemory()
    memory.record(denial_event(
        operation_id="fail-a",
        agent_id="agent-a",
        scope=_scope(),
        url="https://owned.example.com/data",
        method="GET",
        error="connection reset",
    ))
    for index in range(3):
        memory.record_success(success_event(
            operation_id=f"ok-b-{index}",
            agent_id="agent-b",
            scope=_scope(),
            url="https://owned.example.com/data",
            method="GET",
            status=200,
        ))

    assert memory.rank_agents(("agent-a", "agent-b", "agent-c"))[0] == "agent-b"

    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        return _FakeClient(_result())

    result = execute_with_agent_rotation(
        operation_id="ranked",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b", "agent-c"),
        client_factory=factory,
        memory=memory,
    )
    assert result["selected_agent"] == "agent-b"
    assert calls == ["agent-b"]


def test_route_pressure_reduces_rotation_budget_instead_of_hammering() -> None:
    memory = DenialLearningMemory()
    for index in range(8):
        memory.record(denial_event(
            operation_id=f"net-{index}",
            agent_id=f"agent-{index % 2}",
            scope=_scope(),
            url="https://owned.example.com/data",
            method="GET",
            error="network is unreachable",
        ))

    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        return _FakeClient(ExternalContactError("timed out"))

    result = execute_with_agent_rotation(
        operation_id="pressure",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("a", "b", "c", "d", "e", "f"),
        client_factory=factory,
        memory=memory,
        max_agents=6,
    )
    assert result["agent_budget"] == 1
    assert len(calls) == 1
    assert result["route_health_before"]["backoff_multiplier"] >= 5


def test_successful_route_can_use_larger_bounded_agent_pool() -> None:
    memory = DenialLearningMemory()
    for index in range(4):
        memory.record_success(success_event(
            operation_id=f"ok-{index}",
            agent_id="agent-a",
            scope=_scope(),
            url="https://owned.example.com/data",
            method="GET",
            status=200,
        ))

    calls: list[str] = []
    outcomes = {
        "agent-a": ExternalContactError("timed out"),
        "agent-b": ExternalContactError("connection reset"),
        "agent-c": _result(),
    }

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _FakeClient:
        calls.append(agent_id)
        return _FakeClient(outcomes.get(agent_id, _result()))

    result = execute_with_agent_rotation(
        operation_id="healthy-route",
        scope=_scope(),
        url="https://owned.example.com/data",
        agents=("agent-a", "agent-b", "agent-c", "agent-d", "agent-e", "agent-f"),
        client_factory=factory,
        memory=memory,
        max_agents=8,
    )
    assert result["agent_budget"] == 5
    assert result["success"] is True
    assert result["selected_agent"] == "agent-c"
    assert calls[:3] == ["agent-a", "agent-b", "agent-c"]


def test_memory_round_trip_preserves_learning_and_successes() -> None:
    memory = DenialLearningMemory()
    memory.record(denial_event(
        operation_id="d1",
        agent_id="agent-a",
        scope=_scope(),
        url="https://owned.example.com/data",
        method="GET",
        error="timed out",
    ))
    memory.record_success(success_event(
        operation_id="s1",
        agent_id="agent-b",
        scope=_scope(),
        url="https://owned.example.com/data",
        method="GET",
        status=200,
    ))

    restored = DenialLearningMemory.from_mapping(memory.summary())
    assert restored.summary()["event_count"] == 1
    assert restored.summary()["success_count"] == 1
    assert restored.rank_agents(("agent-a", "agent-b"))[0] == "agent-b"


def test_scope_is_validated_before_agent_rotation() -> None:
    with pytest.raises(ExternalContactError, match="not explicitly allowlisted"):
        execute_with_agent_rotation(
            operation_id="op-outside",
            scope=_scope(),
            url="https://other.example.net/",
            agents=("agent-a", "agent-b"),
            client_factory=lambda scope, agent: _FakeClient(_result()),
        )
