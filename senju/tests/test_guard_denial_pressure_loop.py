from __future__ import annotations

from dataclasses import dataclass

from senju.external import ContactReceipt, ContactResult, ExternalAuthorityScope, ExternalContactError
from senju.external_denial_learning import DenialLearningMemory
from senju.guard_denial_feedback import record_guard_failure
from senju.guard_denial_pressure_loop import (
    AGENTS,
    MAX_AGENT_VARIANTS,
    MAX_RECOVERY_ROUNDS,
    MAX_ROUTE_VARIANTS,
    MAX_TRANSPORT_ATTEMPTS,
    build_pressure_plan,
    execute_pressure_operation,
)


def _scope() -> ExternalAuthorityScope:
    return ExternalAuthorityScope(
        scope_id="owned-pressure",
        target_service="owned pressure lane",
        allow_hosts=frozenset({"owned.example.com", "backup.owned.example.com"}),
        allowed_methods=frozenset({"GET", "HEAD"}),
        credential_scope="none",
        retries=0,
    )


def _result(url: str, status: int = 200, acknowledged: bool = True) -> ContactResult:
    host = url.split("/", 3)[2]
    receipt = ContactReceipt(
        schema="senju-external-contact-receipt/v3",
        contacted_at_utc="2026-08-31T00:00:00+00:00",
        method="GET",
        requested_url=url,
        final_url=url,
        host=host,
        final_host=host,
        contacted_hosts=(host,),
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
class _RouteClient:
    calls: list[tuple[str, str]]
    agent_id: str
    boundary_on_primary: bool = False

    def contact_with_body(self, url: str, *, method: str = "GET") -> ContactResult:
        self.calls.append((self.agent_id, url))
        if url.startswith("https://owned.example.com/"):
            if self.boundary_on_primary:
                raise ExternalContactError("authorization denied by authority registry")
            raise ExternalContactError("network is unreachable")
        return _result(url)


def _seed_network_pressure(memory: DenialLearningMemory, count: int = 8) -> None:
    for index in range(count):
        record_guard_failure(
            memory,
            state="NETWORK_DENIED",
            operation_id=f"net-{index}",
            agent_id=f"senju-{index % 3}",
            scope=_scope(),
            url="https://owned.example.com/data",
        )


def test_high_network_pressure_expands_bounded_variation() -> None:
    memory = DenialLearningMemory()
    _seed_network_pressure(memory, 8)
    from senju.guard_denial_feedback import feedback_for_operation

    feedback = feedback_for_operation(
        memory,
        scope=_scope(),
        url="https://owned.example.com/data",
    )
    plan = build_pressure_plan(feedback, available_agents=len(AGENTS), available_routes=4)

    assert plan["external_contact_allowed"] is True
    assert plan["retry_rounds"] == MAX_RECOVERY_ROUNDS
    assert plan["agent_variation_budget"] == MAX_AGENT_VARIANTS
    assert plan["route_variation_budget"] == MAX_ROUTE_VARIANTS
    assert plan["diagnostic_variation_budget"] > 16
    assert plan["repair_variation_budget"] >= 1
    assert plan["evidence_replay_budget"] > 2
    assert plan["transport_attempt_budget"] == MAX_TRANSPORT_ATTEMPTS
    assert plan["route_discovery_from_denial"] is False
    assert plan["boundary_bypass_enabled"] is False


def test_transient_denial_can_move_to_explicit_preauthorized_route() -> None:
    memory = DenialLearningMemory()
    _seed_network_pressure(memory, 6)
    calls: list[tuple[str, str]] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _RouteClient:
        assert scope.scope_id == "owned-pressure"
        return _RouteClient(calls, agent_id)

    result = execute_pressure_operation(
        operation_id="pressure-route",
        scope=_scope(),
        urls=(
            "https://owned.example.com/data",
            "https://backup.owned.example.com/data",
        ),
        agents=AGENTS,
        memory=memory,
        client_factory=factory,
    )

    assert result["success"] is True
    assert result["selected_url"] == "https://backup.owned.example.com/data"
    assert any(url == "https://owned.example.com/data" for _, url in calls)
    assert any(url == "https://backup.owned.example.com/data" for _, url in calls)
    assert result["transport_attempts"] <= MAX_TRANSPORT_ATTEMPTS
    assert result["authority_envelope"]["scope_id"] == "owned-pressure"
    assert result["authority_envelope"]["route_candidates_preapproved"] is True
    assert result["authority_envelope"]["protocol_preserved"] is True
    assert result["boundary_bypass_enabled"] is False


def test_boundary_denial_stops_before_alternate_route_or_agent_escalation() -> None:
    memory = DenialLearningMemory()
    _seed_network_pressure(memory, 6)
    calls: list[tuple[str, str]] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _RouteClient:
        return _RouteClient(calls, agent_id, boundary_on_primary=True)

    result = execute_pressure_operation(
        operation_id="pressure-boundary",
        scope=_scope(),
        urls=(
            "https://owned.example.com/data",
            "https://backup.owned.example.com/data",
        ),
        agents=AGENTS,
        memory=memory,
        client_factory=factory,
    )

    assert result["success"] is False
    assert result["stop_reason"] == "non_retryable:authorization_denial"
    assert calls
    assert all(url == "https://owned.example.com/data" for _, url in calls)
    assert len(calls) == 1


def test_security_stop_converts_pressure_into_diagnostics_not_external_contact() -> None:
    memory = DenialLearningMemory()
    _seed_network_pressure(memory, 6)
    record_guard_failure(
        memory,
        state="SECURITY_STOP",
        operation_id="stop",
        agent_id="senju-a",
        scope=_scope(),
        url="https://owned.example.com/data",
    )
    calls: list[tuple[str, str]] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _RouteClient:
        return _RouteClient(calls, agent_id)

    result = execute_pressure_operation(
        operation_id="pressure-stop",
        scope=_scope(),
        urls=(
            "https://owned.example.com/data",
            "https://backup.owned.example.com/data",
        ),
        agents=AGENTS,
        memory=memory,
        client_factory=factory,
    )

    plan = result["pressure_plan"]
    assert result["stop_reason"] == "boundary_failure_requires_repair"
    assert result["transport_attempts"] == 0
    assert calls == []
    assert plan["external_contact_allowed"] is False
    assert plan["retry_rounds"] == 0
    assert plan["agent_variation_budget"] == 0
    assert plan["route_variation_budget"] == 0
    assert plan["diagnostic_variation_budget"] > 16
    assert plan["repair_variation_budget"] > 1


def test_unapproved_route_is_rejected_before_any_contact() -> None:
    memory = DenialLearningMemory()
    calls: list[tuple[str, str]] = []

    def factory(scope: ExternalAuthorityScope, agent_id: str) -> _RouteClient:
        return _RouteClient(calls, agent_id)

    try:
        execute_pressure_operation(
            operation_id="pressure-outside",
            scope=_scope(),
            urls=("https://unapproved.example.net/data",),
            memory=memory,
            client_factory=factory,
        )
    except ValueError as exc:
        assert "outside authority scope" in str(exc)
    else:
        raise AssertionError("unapproved route should have been rejected")
    assert calls == []
