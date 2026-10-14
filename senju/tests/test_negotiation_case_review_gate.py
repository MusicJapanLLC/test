from __future__ import annotations

import json
from pathlib import Path

from senju.negotiation_case_review_gate import (
    collect_negotiation_cases,
    run_negotiation_case_review_gate,
)


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_aggregates_negotiation_sources_by_host_and_flow(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "negotiation_intelligence_bus.json", {
        "records": [{
            "host": "case.example",
            "intelligence_id": "intel-1",
            "producer": "CHILD",
            "reason": "public research",
            "requested_methods": ["GET"],
            "authority_effect": "none",
            "raw_credentials_forwarded": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": "case.example",
            "signal_id": "signal-1",
            "source": "negotiator",
            "reason": "needs review",
            "requested_methods": ["HEAD"],
        }]
    })
    cases = collect_negotiation_cases(state)
    assert len(cases) == 1
    assert cases[0]["host"] == "case.example"
    assert cases[0]["formal_flow"] == "OWNER_SCOPE"
    assert cases[0]["requested_methods"] == ["GET", "HEAD"]
    assert set(cases[0]["source_refs"]) == {"intel-1", "signal-1"}


def test_three_of_three_admits_case_to_formal_intake_without_authority(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": "approved.example",
            "signal_id": "signal-2",
            "reason": "bounded integration request",
            "requested_methods": ["GET", "HEAD"],
            "authority_effect": "none",
            "raw_credentials_forwarded": False,
        }]
    })
    result = run_negotiation_case_review_gate(state, now=1000)
    assert result["admitted_count"] == 1
    assert result["review_quorum"] == "3_of_3"
    assert result["formal_authority_granted"] is False

    review = json.loads((state / "negotiation_case_review_queue.json").read_text())
    case = review["cases"][0]
    assert case["status"] == "ADMITTED_TO_FORMAL_APPROVAL"
    assert [b["actor"] for b in case["ballots"]] == ["META", "X", "SENJU"]
    assert all(b["approve_for_formal_approval_flow"] for b in case["ballots"])

    intake = json.loads((state / "formal_approval_intake.json").read_text())
    assert intake["formal_authority_granted"] is False
    assert intake["cases"][0]["discussion_state"] == "ready_to_begin_formal_review"
    assert intake["cases"][0]["authority_effect"] == "none"


def test_terminal_case_is_rejected_before_formal_discussion(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "authority_opportunity_queue.json", {
        "opportunities": [{
            "host": "blocked.example",
            "request_id": "root-1",
            "reason": "candidate",
            "hard_deny": True,
            "score": 99,
        }]
    })
    result = run_negotiation_case_review_gate(state, now=1000)
    assert result["terminal_rejected_count"] == 1
    assert result["admitted_count"] == 0
    intake = json.loads((state / "formal_approval_intake.json").read_text())
    assert intake["cases"] == []


def test_raw_credentials_or_pregranted_authority_hold_case(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "negotiation_intelligence_bus.json", {
        "records": [{
            "host": "unsafe.example",
            "intelligence_id": "intel-unsafe",
            "reason": "bad packet",
            "raw_credentials_forwarded": True,
            "authority_effect": "granted",
        }]
    })
    result = run_negotiation_case_review_gate(state, now=1000)
    assert result["held_count"] == 1
    review = json.loads((state / "negotiation_case_review_queue.json").read_text())
    ballots = {row["actor"]: row for row in review["cases"][0]["ballots"]}
    assert ballots["META"]["approve_for_formal_approval_flow"] is True
    assert ballots["X"]["approve_for_formal_approval_flow"] is False
    assert ballots["SENJU"]["approve_for_formal_approval_flow"] is False


def test_private_literal_ip_never_becomes_review_case(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "127.0.0.1", "signal_id": "private", "reason": "no"}]
    })
    result = run_negotiation_case_review_gate(state, now=1000)
    assert result["case_count"] == 0
    assert result["admitted_count"] == 0


def test_root_opportunity_requires_same_intake_gate(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "authority_opportunity_queue.json", {
        "opportunities": [{
            "host": "root-candidate.example",
            "request_id": "root-2",
            "reason": "root negotiation candidate",
            "score": 80,
            "authority_effect": "none",
        }]
    })
    result = run_negotiation_case_review_gate(state, now=1000)
    assert result["admitted_count"] == 1
    intake = json.loads((state / "formal_approval_intake.json").read_text())
    assert intake["cases"][0]["formal_flow"] == "ROOT_AUTHORITY"
    assert intake["cases"][0]["intake_consensus"] == "3_of_3"
