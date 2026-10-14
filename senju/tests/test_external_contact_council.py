from __future__ import annotations

from pathlib import Path

import pytest

from senju.external_contact_council import (
    CouncilExternalContactClient,
    ExternalContactCouncilError,
    ResearchDelegationReserve,
    evaluate_contact_relaxation,
    load_research_delegation_reserve,
    materialize_vote_solicitations,
)
from senju.external_contact_pressure import build_pressure_campaign, classify_denial


def _ceiling(**overrides):
    row = {
        "ceiling_id": "owner://contact/1",
        "exact_hosts": ["api.example.com", "cdn.example.com"],
        "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
        "allow_http": True,
        "allow_delete": True,
        "follow_redirects": True,
        "max_redirects": 5,
        "retries": 5,
        "timeout_seconds": 20,
        "max_response_bytes": 10 * 1024 * 1024,
    }
    row.update(overrides)
    return row


def _proposal(**overrides):
    row = {
        "proposal_id": "relax-1",
        "methods": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
        "allow_http": True,
        "allow_delete": True,
        "follow_redirects": True,
        "max_redirects": 5,
        "retries": 5,
        "timeout_seconds": 20,
        "max_response_bytes": 10 * 1024 * 1024,
    }
    row.update(overrides)
    return row


def _reserve(**overrides):
    row = {
        "reserve_id": "research-reserve-1",
        "exact_hosts": ["api.example.com", "cdn.example.com"],
        "delegable_methods": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "allow_http": False,
        "allow_delete": False,
        "follow_redirects": True,
        "max_redirects": 3,
        "retries": 4,
        "timeout_seconds": 15,
        "max_response_bytes": 4 * 1024 * 1024,
        "quorum": 3,
        "min_confidence": 65,
    }
    row.update(overrides)
    return row


def _ballots(yes=3):
    actors = ["META", "X", "SENJU", "PR-ARMY"]
    return [{"actor": actor, "approve": index < yes, "confidence": 90, "reason": "bounded research delegation"} for index, actor in enumerate(actors)]


def test_three_of_four_council_can_materially_relax_inside_owner_ceiling() -> None:
    decision = evaluate_contact_relaxation(_ceiling(), _proposal(), _ballots(3), now=1000)
    assert decision.approved is True
    assert decision.yes_votes == 3
    assert decision.liberalization_score >= 50
    assert decision.authority_basis == "owner_contact_ceiling"
    policy = decision.to_policy()
    assert policy.allow_hosts == frozenset({"api.example.com", "cdn.example.com"})
    assert {"POST", "PUT", "PATCH", "DELETE"}.issubset(policy.allowed_methods)
    assert policy.allow_http is True
    assert policy.allow_delete is True
    assert policy.follow_redirects is True
    client = CouncilExternalContactClient(decision, resolver=lambda host, port: ("8.8.8.8",), opener=lambda *a, **k: None)
    assert client.client.policy.retries == 5


def test_research_reserve_lets_council_exceed_current_effective_method_ceiling() -> None:
    decision = evaluate_contact_relaxation(
        _ceiling(
            allowed_methods=["GET", "HEAD"],
            allow_http=False,
            allow_delete=False,
            max_redirects=1,
            retries=1,
            timeout_seconds=5,
            max_response_bytes=512 * 1024,
        ),
        _proposal(
            methods=["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
            allow_http=False,
            allow_delete=False,
            max_redirects=3,
            retries=4,
            timeout_seconds=15,
            max_response_bytes=4 * 1024 * 1024,
        ),
        _ballots(3),
        research_reserve=_reserve(),
        now=1000,
    )
    assert decision.approved is True
    assert decision.authority_basis == "research_delegation_reserve"
    assert decision.delegation_id == "research-reserve-1"
    assert decision.council_policy_delegation_target_pct == 65
    policy = decision.to_policy()
    assert {"POST", "PUT", "PATCH"}.issubset(policy.allowed_methods)
    assert policy.allow_http is False
    assert policy.allow_delete is False
    assert policy.max_redirects == 3
    assert policy.retries == 4


def test_transport_client_is_demoted_to_transport_enforcer_role() -> None:
    decision = evaluate_contact_relaxation(
        _ceiling(),
        _proposal(),
        _ballots(3),
        now=1000,
    )
    client = CouncilExternalContactClient(decision, resolver=lambda host, port: ("8.8.8.8",), opener=lambda *a, **k: None)
    profile = client.role_profile()
    assert profile["role"] == "transport_enforcer_only"
    assert profile["policy_authority"] is False
    assert profile["policy_responsibility_reduction_pct"] == 20
    assert profile["council_policy_delegation_target_pct"] == 65
    assert "redirect_revalidation" in profile["retained_transport_invariants"]


def test_two_votes_cannot_relax() -> None:
    decision = evaluate_contact_relaxation(_ceiling(), _proposal(), _ballots(2), now=1000)
    assert decision.approved is False
    assert decision.liberalization_score == 0
    with pytest.raises(ExternalContactCouncilError):
        decision.to_policy()


def test_without_reserve_council_still_cannot_exceed_current_ceiling() -> None:
    with pytest.raises(ExternalContactCouncilError, match="methods exceed"):
        evaluate_contact_relaxation(
            _ceiling(allowed_methods=["GET", "HEAD"]),
            _proposal(methods=["GET", "HEAD", "POST"], allow_http=False, allow_delete=False),
            _ballots(4),
        )


def test_research_reserve_cannot_add_unknown_host_or_http_or_delete() -> None:
    with pytest.raises(ExternalContactCouncilError, match="does not cover"):
        evaluate_contact_relaxation(
            _ceiling(exact_hosts=["other.example.com"], allowed_methods=["GET", "HEAD"]),
            _proposal(methods=["GET", "HEAD", "POST"], allow_http=False, allow_delete=False),
            _ballots(4),
            research_reserve=_reserve(exact_hosts=["api.example.com"]),
        )
    with pytest.raises(ExternalContactCouncilError, match="HTTPS-only"):
        ResearchDelegationReserve.from_mapping(_reserve(allow_http=True))
    with pytest.raises(ExternalContactCouncilError, match="DELETE"):
        evaluate_contact_relaxation(
            _ceiling(allowed_methods=["GET", "HEAD"]),
            _proposal(methods=["GET", "HEAD", "DELETE"], allow_http=False, allow_delete=True),
            _ballots(4),
            research_reserve=_reserve(),
        )


def test_production_research_reserve_is_bound_to_canonical_owner_target() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    reserve = load_research_delegation_reserve(
        repo_root,
        "owner-research:kabeya-authorized-test-range",
    )
    assert reserve.exact_hosts == frozenset({"kabeya-authorized-test-range.onrender.com"})
    assert {"POST", "PUT", "PATCH"}.issubset(reserve.delegable_methods)
    assert "DELETE" not in reserve.delegable_methods
    assert reserve.allow_http is False
    assert reserve.min_confidence == 65
    assert reserve.external_contact_policy_responsibility_reduction_pct == 20


def test_council_cannot_enable_http_or_delete_beyond_current_ceiling_without_reserve() -> None:
    with pytest.raises(ExternalContactCouncilError, match="HTTP"):
        evaluate_contact_relaxation(_ceiling(allow_http=False), _proposal(allow_http=True), _ballots(4))
    with pytest.raises(ExternalContactCouncilError, match="DELETE"):
        evaluate_contact_relaxation(_ceiling(allow_delete=False), _proposal(allow_delete=True), _ballots(4))


def test_vote_solicitations_explicitly_ask_meta_x_senju_and_pr_army(tmp_path: Path) -> None:
    payload = materialize_vote_solicitations(tmp_path, _proposal(), now=1000)
    assert payload["required_quorum"] == 3
    assert payload["external_contact_policy_responsibility_reduction_pct"] == 20
    assert payload["council_policy_delegation_target_pct"] == 65
    assert {row["actor"] for row in payload["tasks"]} == {"META", "X", "SENJU", "PR-ARMY"}
    assert (tmp_path / "external_contact_council_solicitations.json").exists()


def test_every_ai_gets_pressure_tasks_without_production_sabotage(tmp_path: Path) -> None:
    payload = build_pressure_campaign(tmp_path, now=1000)
    assert payload["task_count"] == 42
    assert set(payload["agents"]) == {"META", "X", "SENJU", "CHILD", "AI", "PR-ARMY"}
    assert payload["production_sabotage"] is False
    assert all(row["surface"] == "ExternalContactClient" for row in payload["tasks"])


def test_denials_are_routed_to_relaxation_or_terminal_boundary() -> None:
    assert classify_denial("method is not allowed: POST") == "council_relaxation_candidate"
    assert classify_denial("host is not explicitly allowlisted: x.example") == "owner_scope_evidence_required"
    assert classify_denial("non-default port is not covered") == "owner_endpoint_evidence_required"
    assert classify_denial("non-public address blocked for x: 127.0.0.1") == "terminal_security_boundary"
