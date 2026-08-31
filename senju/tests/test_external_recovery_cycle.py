from __future__ import annotations

from dataclasses import dataclass

from senju.external import ContactReceipt, ContactResult, ExternalAuthorityScope, ExternalContactError
from senju.external_recovery_cycle import RecoveryMission, run_recovery_cycle


@dataclass
class _Client:
    outcome: object

    def contact_with_body(self, url: str, *, method: str = "GET") -> ContactResult:
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        assert isinstance(self.outcome, ContactResult)
        return self.outcome


def _result(url: str = "https://example.com/") -> ContactResult:
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
        status=200,
        provider_acknowledged=True,
        response_bytes=2,
        response_sha256="2" * 64,
        content_type="text/html",
        etag=None,
        last_modified=None,
        retry_after=None,
        attempt_count=1,
        redirect_count=0,
    )
    return ContactResult(receipt=receipt, body=b"ok")


def test_cycle_rotates_transient_failure_and_persists_reliability() -> None:
    calls: list[str] = []
    mission = RecoveryMission(
        mission_id="test-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        if agent == "senju-a":
            return _Client(ExternalContactError("external contact failed: timed out"))
        return _Client(_result())

    report = run_recovery_cycle(
        missions=(mission,),
        max_missions=1,
        max_passes=2,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )

    assert report["production_mode"] is True
    assert report["closed_loop_recovery"] is True
    assert report["agent_rotation"] is True
    assert report["authority_preserved"] is True
    assert report["boundary_bypass_enabled"] is False
    assert report["successful_missions"] == 1
    assert calls[:2] == ["senju-a", "senju-b"]
    scope_memory = report["agent_reliability"]["scopes"]["canary_telemetry"]
    assert scope_memory["senju-a"]["transient_failures"] == 1
    assert scope_memory["senju-b"]["successes"] == 1


def test_persisted_reliability_promotes_previous_successful_agent_first() -> None:
    mission = RecoveryMission(
        mission_id="test-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )
    prior = {
        "schema": "senju-external-agent-reliability/v1",
        "scopes": {
            "canary_telemetry": {
                "senju-a": {"attempts": 4, "successes": 0, "transient_failures": 4, "last_outcome": "network_denial"},
                "senju-b": {"attempts": 4, "successes": 4, "transient_failures": 0, "last_outcome": "success"},
            }
        },
    }
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        return _Client(_result())

    report = run_recovery_cycle(
        missions=(mission,),
        reliability_data=prior,
        max_missions=1,
        max_passes=2,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )
    assert report["successful_missions"] == 1
    assert calls[0] == "senju-b"


def test_boundary_denial_enters_repair_queue_without_identity_retry() -> None:
    mission = RecoveryMission(
        mission_id="test-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        return _Client(ExternalContactError("authorization denied by authority registry"))

    report = run_recovery_cycle(
        missions=(mission,),
        max_missions=1,
        max_passes=3,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )
    assert report["successful_missions"] == 0
    assert calls == ["senju-a"]
    assert len(report["boundary_repair_queue"]) == 1
    repair = report["boundary_repair_queue"][0]
    assert repair["category"] == "authorization_denial"
    assert repair["automatic_changes_allowed"]["agent_order"] is False
    assert repair["automatic_changes_allowed"]["authority_scope"] is False


def test_first_three_transient_failures_promote_unused_agents_on_second_pass() -> None:
    mission = RecoveryMission(
        mission_id="test-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
    )
    calls: list[str] = []

    def factory(scope: ExternalAuthorityScope, agent: str) -> _Client:
        calls.append(agent)
        if agent in {"senju-a", "senju-b", "senju-c"}:
            return _Client(ExternalContactError("external contact failed: timed out"))
        return _Client(_result())

    report = run_recovery_cycle(
        missions=(mission,),
        max_missions=1,
        max_passes=2,
        client_factory=factory,
        sleeper=lambda seconds: None,
    )
    assert report["successful_missions"] == 1
    assert calls[:3] == ["senju-a", "senju-b", "senju-c"]
    assert calls[3] in {"senju-d", "senju-e"}
    assert report["operations"][0]["passes_used"] == 2
    assert report["authority_preserved"] is True
