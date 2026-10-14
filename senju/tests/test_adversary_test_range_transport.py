from __future__ import annotations

from pathlib import Path

import pytest

from senju.adversary_finding_loop import AdversaryFinding, AdversaryFindingLoop
from senju.adversary_test_range_transport import (
    AdversaryTransportError,
    AuthorizedTestRangeTransport,
    DefinedAction,
)


def _transport(monkeypatch: pytest.MonkeyPatch) -> AuthorizedTestRangeTransport:
    transport = AuthorizedTestRangeTransport(
        allowed_hosts={"kabeya-authorized-test-range.onrender.com"},
        actions={
            "synthetic-write": DefinedAction(
                action_id="synthetic-write",
                method="POST",
                path="/contact/index.html",
                content_type="application/x-www-form-urlencoded",
                body=b"name=test&message=bounded",
            )
        },
    )
    monkeypatch.setattr(transport, "_validate_dns", lambda host: None)
    return transport


def test_outside_host_never_becomes_transport_authority(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _transport(monkeypatch)
    with pytest.raises(AdversaryTransportError, match="outside explicit test range"):
        transport.probe("https://outside.example/")


def test_credential_bearing_headers_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _transport(monkeypatch)
    with pytest.raises(AdversaryTransportError, match="credential-bearing"):
        transport.probe(
            "https://kabeya-authorized-test-range.onrender.com/",
            headers={"Authorization": "Bearer should-not-leave"},
        )


def test_redirect_is_revalidated_before_second_network_hop(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _transport(monkeypatch)
    calls: list[tuple[str, str]] = []

    def fake_request(*, host: str, path: str, method: str, headers, body):
        calls.append((host, path))
        return 302, {"Location": "https://outside.example/next"}, b""

    monkeypatch.setattr(transport, "_single_request", fake_request)
    with pytest.raises(AdversaryTransportError, match="outside explicit test range"):
        transport.probe("https://kabeya-authorized-test-range.onrender.com/start")
    assert calls == [("kabeya-authorized-test-range.onrender.com", "/start")]


def test_owner_defined_mutation_action_can_use_real_transport_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transport = _transport(monkeypatch)
    captured: dict[str, object] = {}

    def fake_request(*, host: str, path: str, method: str, headers, body):
        captured.update(host=host, path=path, method=method, headers=dict(headers), body=body)
        return 200, {"Content-Type": "text/plain"}, b"ok"

    monkeypatch.setattr(transport, "_single_request", fake_request)
    result = transport.execute_action(
        "kabeya-authorized-test-range.onrender.com",
        "synthetic-write",
    )
    assert result.status == 200
    assert captured["host"] == "kabeya-authorized-test-range.onrender.com"
    assert captured["path"] == "/contact/index.html"
    assert captured["method"] == "POST"
    assert captured["body"] == b"name=test&message=bounded"


def test_arbitrary_mutation_is_not_available(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _transport(monkeypatch)
    with pytest.raises(AdversaryTransportError, match="unknown owner-defined action"):
        transport.execute_action(
            "kabeya-authorized-test-range.onrender.com",
            "invented-delete-everything",
        )


def test_recovery_changes_transport_method_not_authority(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _transport(monkeypatch)
    calls: list[tuple[str, str, str]] = []

    def fake_request(*, host: str, path: str, method: str, headers, body):
        calls.append((host, path, method))
        if method == "GET":
            raise OSError("synthetic transport failure")
        return 204, {}, b""

    monkeypatch.setattr(transport, "_single_request", fake_request)
    result = transport.recovery_probe(
        "https://kabeya-authorized-test-range.onrender.com/health"
    )
    assert result.status == 204
    assert calls == [
        ("kabeya-authorized-test-range.onrender.com", "/health", "GET"),
        ("kabeya-authorized-test-range.onrender.com", "/health", "HEAD"),
    ]


def test_shared_finding_loop_executes_authorized_test_range_action(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transport = _transport(monkeypatch)

    def fake_request(*, host: str, path: str, method: str, headers, body):
        return 201, {}, b"created"

    monkeypatch.setattr(transport, "_single_request", fake_request)
    loop = AdversaryFindingLoop(transport)
    outcome = loop.handle(
        AdversaryFinding(
            actor="META",
            url="https://kabeya-authorized-test-range.onrender.com/contact/index.html",
            reason="validate a synthetic finding",
            action_id="synthetic-write",
        )
    )
    assert outcome.status == "action_executed"
    assert outcome.transport_status == 201


def test_shared_finding_loop_keeps_untrusted_discovery_candidate_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    transport = _transport(monkeypatch)
    loop = AdversaryFindingLoop(transport)
    outcome = loop.handle(
        AdversaryFinding(
            actor="X",
            url="https://outside.example/suspected-target",
            reason="newly discovered host",
        )
    )
    assert outcome.status == "candidate_only"
    assert outcome.transport_status is None


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.1",
        "169.254.1.1",
        "::1",
        "fe80::1",
    ],
)
def test_private_loopback_and_link_local_ips_are_forbidden(ip: str) -> None:
    assert AuthorizedTestRangeTransport._ip_is_forbidden(ip) is True


def test_current_discovery_policy_loads_only_explicit_test_range_actions() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    policy = repo_root / "automation" / "codegen" / "meta_state" / "discovery_policy.json"
    transport = AuthorizedTestRangeTransport.from_discovery_policy(policy)
    assert transport.allowed_hosts == frozenset({"kabeya-authorized-test-range.onrender.com"})
    assert set(transport.actions) >= {
        "synthetic-contact-write",
        "synthetic-record-create",
        "synthetic-record-update",
        "synthetic-record-cleanup",
    }
