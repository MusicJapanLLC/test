from __future__ import annotations

from pathlib import Path

import pytest

from senju.external_contact_council import (
    CouncilExternalContactClient,
    ExternalContactCouncilError,
    evaluate_contact_relaxation,
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


def _ballots(yes=3):
    actors = ["META", "X", "SENJU", "PR-ARMY"]
    return [{"actor": actor, "approve": index < yes, "confidence": 90, "reason": "bounded owner-scope relaxation"} for index, actor in enumerate(actors)]


def test_three_of_four_council_can_materially_relax_inside_owner_ceiling() -> None:
    decision = evaluate_contact_relaxation(_ceiling(), _proposal(), _ballots(3), now=1000)
    assert decision.approved is True
    assert decision.yes_votes == 3
    assert decision.liberalization_score >= 50
    policy = decision.to_policy()
    assert policy.allow_hosts == frozenset({"api.example.com", "cdn.example.com"})
    assert {"POST", "PUT", "PATCH", "DELETE"}.issubset(policy.allowed_methods)
    assert policy.allow_http is True
    assert policy.allow_delete is True
    assert policy.follow_redirects is True
    client = CouncilExternalContactClient(decision, resolver=lambda host, port: ("203.0.113.10",), opener=lambda *a, **k: None)
    assert client.client.policy.retries == 5


def test_two_votes_cannot_relax() -> None:
    decision = evaluate_contact_relaxation(_ceiling(), _proposal(), _ballots(2), now=1000)
    assert decision.approved is False
    assert decision.liberalization_score == 0
    with pytest.raises(ExternalContactCouncilError):
        decision.to_policy()


def test_council_cannot_exceed_owner_ceiling() -> None:
    with pytest.raises(ExternalContactCouncilError, match="methods exceed"):
        evaluate_contact_relaxation(
            _ceiling(allowed_methods=["GET", "HEAD"]),
            _proposal(methods=["GET", "HEAD", "POST"], allow_http=False, allow_delete=False),
            _ballots(4),
        )
    with pytest.raises(ExternalContactCouncilError, match="HTTP"):
        evaluate_contact_relaxation(_ceiling(allow_http=False), _proposal(allow_http=True), _ballots(4))
    with pytest.raises(ExternalContactCouncilError, match="DELETE"):
        evaluate_contact_relaxation(_ceiling(allow_delete=False), _proposal(allow_delete=True), _ballots(4))


def test_vote_solicitations_explicitly_ask_meta_x_senju_and_pr_army(tmp_path: Path) -> None:
    payload = materialize_vote_solicitations(tmp_path, _proposal(), now=1000)
    assert payload["required_quorum"] == 3
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
