from __future__ import annotations

from types import SimpleNamespace

import pytest

from senju import approved_authority_red_adaptive as adaptive


def _ceiling() -> dict:
    return {
        "exact_hosts": ["a.example", "b.example"],
        "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST"],
        "per_host_methods": {
            "a.example": ["GET", "HEAD", "OPTIONS", "POST"],
            "b.example": ["GET", "HEAD", "OPTIONS"],
        },
    }


def _selected_operation(seed_url: str) -> str:
    for index in range(5000):
        operation_id = f"adaptive-{index}"
        if adaptive._bucket(operation_id, seed_url) < 45:
            return operation_id
    raise AssertionError("unable to find deterministic selected bucket")


def test_unapproved_candidate_is_excluded_before_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adaptive, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=200)

    seed = "https://unknown.example/"
    result = adaptive.execute_authorized_red_learning_cycle(
        repo_root=".",
        state_dir="state",
        operation_id=_selected_operation(seed),
        seed_url=seed,
        transport_factory=FakeTransport,
    )

    assert result["eligible"] is False
    assert result["external_contact_attempted"] is False
    assert calls == []
    assert result["authority_expansion_allowed"] is False
    assert result["boundary_bypass_enabled"] is False


def test_404_generates_safe_alternate_path_probe(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adaptive, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            if url.endswith("/missing"):
                return SimpleNamespace(status=404)
            if url.endswith("/health"):
                return SimpleNamespace(status=204)
            return SimpleNamespace(status=404)

    seed = "https://a.example/missing"
    result = adaptive.execute_authorized_red_learning_cycle(
        repo_root=".",
        state_dir="state",
        operation_id=_selected_operation(seed),
        seed_url=seed,
        method="GET",
        alternate_paths=("/health",),
        include_safe_defaults=False,
        max_attempts=4,
        transport_factory=FakeTransport,
    )

    assert result["success"] is True
    assert result["attempt_count"] >= 2
    assert ("https://a.example/missing", "GET") in calls
    assert ("https://a.example/health", "GET") in calls
    assert "switch_safe_path" in result["strategy_mutations"]
    assert result["failed_probe_next_plan_generated"] is True
    assert result["exploit_payload_generation_enabled"] is False


def test_method_variation_stays_read_only_and_preapproved(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adaptive, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy
            assert policy.allowed_methods == frozenset({"GET", "HEAD", "OPTIONS"})

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            if method == "GET":
                return SimpleNamespace(status=405)
            if method == "HEAD":
                return SimpleNamespace(status=204)
            return SimpleNamespace(status=404)

    seed = "https://a.example/status"
    result = adaptive.execute_authorized_red_learning_cycle(
        repo_root=".",
        state_dir="state",
        operation_id=_selected_operation(seed),
        seed_url=seed,
        method="GET",
        include_safe_defaults=False,
        max_attempts=3,
        transport_factory=FakeTransport,
    )

    assert result["success"] is True
    assert calls[:2] == [(seed, "GET"), (seed, "HEAD")]
    assert "switch_safe_method" in result["strategy_mutations"]
    assert "POST" not in result["methods_seen"]
    assert result["method_variation_allowed"] is True


def test_host_variation_can_move_between_already_approved_hosts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adaptive, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy
            assert policy.allow_hosts == frozenset({"a.example", "b.example"})

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            if "b.example" in url:
                return SimpleNamespace(status=200)
            return SimpleNamespace(status=404)

    seed = "https://a.example/health"
    result = adaptive.execute_authorized_red_learning_cycle(
        repo_root=".",
        state_dir="state",
        operation_id=_selected_operation(seed),
        seed_url=seed,
        candidate_urls=("https://b.example/health",),
        method="GET",
        include_safe_defaults=False,
        max_attempts=6,
        transport_factory=FakeTransport,
    )

    assert result["host_variation_allowed"] is True
    assert result["host_variation_scope"] == "already_approved_authority_only"
    assert set(result["approved_candidate_hosts"]) == {"a.example", "b.example"}
    assert result["success"] is True
    assert all("unknown.example" not in url for url, _ in calls)


def test_403_is_learning_signal_not_bypass_target(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adaptive, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=403)

    seed = "https://a.example/private"
    result = adaptive.execute_authorized_red_learning_cycle(
        repo_root=".",
        state_dir="state",
        operation_id=_selected_operation(seed),
        seed_url=seed,
        alternate_paths=("/health", "/status"),
        include_safe_defaults=False,
        max_attempts=6,
        transport_factory=FakeTransport,
    )

    assert result["success"] is False
    assert len(calls) == 1
    assert result["attempts"][0]["outcome"] == "access_boundary"
    assert result["denial_as_learning_signal"] is True
    assert result["denial_as_bypass_target"] is False
    assert result["boundary_bypass_enabled"] is False
    assert result["authority_expansion_allowed"] is False
    assert result["request_body_enabled"] is False
