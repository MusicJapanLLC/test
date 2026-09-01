from __future__ import annotations

from types import SimpleNamespace

import pytest

from senju import approved_authority_boundary_research as research
from senju import approved_authority_red_lane as red


def _ceiling() -> dict:
    return {
        "exact_hosts": ["approved.example"],
        "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST"],
        "per_host_methods": {
            "approved.example": ["GET", "HEAD", "OPTIONS", "POST"],
        },
    }


def _operation_for(url: str, *, selected: bool) -> str:
    for index in range(10000):
        operation_id = f"boundary-{index}"
        hit = red.stable_rollout_bucket(operation_id, url) < research.LIVE_TRANSPORT_ROLLOUT_PERCENT
        if hit is selected:
            return operation_id
    raise AssertionError("unable to find deterministic rollout bucket")


def test_local_curriculum_studies_all_requested_guard_surfaces() -> None:
    rows = research.local_boundary_curriculum()
    by_name = {row["name"]: row for row in rows}

    assert by_name["active_exploit_rejection"]["rejected"] is True
    assert by_name["exact_engagement_missing_authorization"]["rejected"] is True
    assert by_name["exact_engagement_wildcard_target"]["rejected"] is True
    assert by_name["request_budget_ceiling"]["rejected"] is True
    assert by_name["rate_budget_ceiling"]["rejected"] is True
    assert all(row["external_contact_attempted"] is False for row in rows)


def test_unapproved_host_keeps_final_transport_inert(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(red, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=200)

    result = research.execute_boundary_research(
        repo_root=".",
        state_dir="state",
        operation_id="unknown-host",
        url="https://unknown.example/",
        transport_factory=FakeTransport,
    )

    assert result["target_host_authority_approved"] is False
    assert result["external_contact_attempted"] is False
    assert result["final_transport_seam"]["effective_mode"] == "inert_or_synthetic"
    assert calls == []


def test_approved_host_can_use_live_transport_at_35_percent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(red, "derive_current_ceiling", lambda *_: _ceiling())
    calls: list[tuple[str, str]] = []

    class FakeTransport:
        def __init__(self, policy):
            self.policy = policy
            assert policy.allow_hosts == frozenset({"approved.example"})
            assert policy.allowed_methods == frozenset({"GET", "HEAD"})

        def contact(self, url, *, method="GET"):
            calls.append((url, method))
            return SimpleNamespace(status=204)

    url = "https://approved.example/health"
    result = research.execute_boundary_research(
        repo_root=".",
        state_dir="state",
        operation_id=_operation_for(url, selected=True),
        url=url,
        transport_factory=FakeTransport,
    )

    assert result["target_host_authority_approved"] is True
    assert result["approved_host_live_transport_selected"] is True
    assert result["external_contact_attempted"] is True
    assert result["final_transport_seam"]["effective_mode"] == "live_authorized_transport"
    assert calls == [(url, "GET")]
    assert result["live_transport_rollout_percent"] == 35


def test_active_exploit_is_learning_target_not_executor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(red, "derive_current_ceiling", lambda *_: _ceiling())
    result = research.execute_boundary_research(
        repo_root=".",
        state_dir="state",
        operation_id="not-selected",
        url="https://approved.example/",
        transport_factory=lambda policy: SimpleNamespace(contact=lambda *args, **kwargs: None),
    )

    assert result["active_exploit"]["research_target"] is True
    assert result["active_exploit"]["execution_enabled"] is False
    assert result["active_exploit_execution_enabled"] is False
    assert result["learning_contract"]["rejection_is_permission"] is False
    assert result["boundary_bypass_enabled"] is False


def test_request_rate_research_does_not_raise_live_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(red, "derive_current_ceiling", lambda *_: _ceiling())
    result = research.execute_boundary_research(
        repo_root=".",
        state_dir="state",
        operation_id="budget-study",
        url="https://unknown.example/",
        transport_factory=lambda policy: SimpleNamespace(contact=lambda *args, **kwargs: None),
    )

    assert result["request_rate_budget"]["research_target"] is True
    assert result["request_rate_budget"]["live_attempt_cap"] == 1
    assert result["request_rate_budget"]["budget_weakened"] is False
    assert result["exact_engagement"]["requirement_weakened"] is False
