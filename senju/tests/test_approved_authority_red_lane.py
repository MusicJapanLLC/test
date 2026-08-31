from __future__ import annotations

from types import SimpleNamespace

import pytest

from senju import approved_authority_red_lane as lane
from senju.external import ExternalContactError


def _ceiling() -> dict:
    return {
        "exact_hosts": ["approved.example"],
        "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST"],
        "per_host_methods": {
            "approved.example": ["GET", "HEAD", "OPTIONS", "POST"],
        },
    }


def _operation_for(url: str, *, selected: bool) -> str:
    for index in range(5000):
        operation_id = f"op-{index}"
        hit = lane.stable_rollout_bucket(operation_id, url) < 45
        if hit is selected:
            return operation_id
    raise AssertionError("unable to find deterministic rollout bucket")


def test_unapproved_host_never_reaches_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())
    calls = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=200)

    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id="blocked-op",
        url="https://unknown.example/",
        transport_factory=FakeTransport,
    )

    assert result["eligible"] is False
    assert result["external_contact_attempted"] is False
    assert result["stop_reason"] == "not_in_approved_authority"
    assert calls == []
    assert result["boundary_bypass_enabled"] is False


def test_rollout_can_hold_an_approved_host_without_contact(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())
    calls = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=200)

    url = "https://approved.example/"
    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id=_operation_for(url, selected=False),
        url=url,
        transport_factory=FakeTransport,
    )

    assert result["eligible"] is True
    assert result["selected_by_rollout"] is False
    assert result["external_contact_attempted"] is False
    assert calls == []


def test_selected_approved_host_uses_real_transport_interface(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())
    calls = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy
            assert policy.allow_hosts == frozenset({"approved.example"})
            assert policy.allowed_methods == frozenset({"GET", "HEAD"})

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=204)

    url = "https://approved.example/health"
    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id=_operation_for(url, selected=True),
        url=url,
        method="GET",
        transport_factory=FakeTransport,
    )

    assert result["success"] is True
    assert result["status"] == 204
    assert result["attempt_count"] == 1
    assert calls == [(url, "GET")]
    assert result["red_learning_active"] is True


def test_transient_failure_retries_same_route_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())
    calls = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            if len(calls) == 1:
                raise ExternalContactError("network is unreachable")
            return SimpleNamespace(status=200)

    url = "https://approved.example/status"
    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id=_operation_for(url, selected=True),
        url=url,
        transport_factory=FakeTransport,
        max_attempts=2,
    )

    assert result["success"] is True
    assert result["attempt_count"] == 2
    assert calls == [(url, "GET"), (url, "GET")]
    assert result["attempts"][0]["category"] == "network_denial"
    assert result["attempts"][0]["retryable"] is True
    assert result["same_authorized_route_only"] is True
    assert result["host_variation_allowed"] is False


def test_boundary_failure_is_learned_but_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())
    calls = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            raise ExternalContactError("permission denied by policy")

    url = "https://approved.example/guarded"
    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id=_operation_for(url, selected=True),
        url=url,
        transport_factory=FakeTransport,
        max_attempts=2,
    )

    assert result["success"] is False
    assert result["attempt_count"] == 1
    assert len(calls) == 1
    assert result["attempts"][0]["retryable"] is False
    assert result["stop_reason"].startswith("boundary_or_nonretryable:")
    assert result["guard_learning_mode"] == "conformance_only"
    assert result["authority_expansion_allowed"] is False
    assert result["boundary_bypass_enabled"] is False


def test_post_is_rejected_even_if_existing_authority_has_post(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lane, "derive_current_ceiling", lambda *_: _ceiling())

    result = lane.execute_authorized_red_contact(
        repo_root=".",
        state_dir="state",
        operation_id="post-blocked",
        url="https://approved.example/write",
        method="POST",
        transport_factory=lambda policy: SimpleNamespace(contact=lambda *args, **kwargs: None),
    )

    assert result["eligible"] is False
    assert result["external_contact_attempted"] is False
    assert result["boundary_bypass_enabled"] is False
