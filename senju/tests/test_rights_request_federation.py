from __future__ import annotations

import json
from pathlib import Path

from senju.rights_request_federation import pr_federation_message, run_rights_request_federation


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def test_discovery_candidate_becomes_persistent_owner_scope_request(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    runtime = repo / ".authority-opportunity-runtime"
    _write(runtime / "discovery_candidates.json", {"candidates": [{"host": "new.example", "url": "https://new.example/"}]})

    result = run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=100)
    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]
    ledger = json.loads((state / "rights_request_ledger.json").read_text())

    assert result["closed_loop"] is True
    assert result["active_request_count"] == 1
    assert result["new_unrelated_authority_self_mint"] is False
    assert signals[0]["host"] == "new.example"
    assert signals[0]["request_owner_scope_expansion"] is True
    assert ledger["requests"][0]["negotiators"] == ["META", "X", "SENJU"]
    assert ledger["requests"][0]["requires_owner_authority_or_existing_expansion_envelope"] is True


def test_multiple_authority_sources_dedupe_and_raise_priority(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    runtime = repo / ".authority-opportunity-runtime"
    _write(runtime / "discovery_candidates.json", {"candidates": [{"host": "shared.example"}]})
    _write(runtime / "signal_authority_activation_queue.json", {"requests": [{"host": "shared.example", "requested_methods": ["GET", "HEAD", "OPTIONS"], "priority": 88}]})

    run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=100)
    run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=200)
    request = json.loads((state / "rights_request_ledger.json").read_text())["requests"][0]

    assert set(request["sources"]) == {"discovery", "signal_authority_activation"}
    assert request["seen_count"] == 2
    assert request["priority"] >= 90


def test_owner_review_stays_active_and_gets_persistence_boost(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    runtime = repo / ".authority-opportunity-runtime"
    _write(runtime / "provisional_authorities.json", {"records": [{"host": "review.example", "provisional_authority": True}]})
    _write(state / "owner_scope_negotiation_result.json", {"decisions": [{"host": "review.example", "status": "owner_review_requested", "applied": False}]})

    result = run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=100)
    request = json.loads((state / "rights_request_ledger.json").read_text())["requests"][0]

    assert result["owner_review_persistent_count"] == 1
    assert request["status"] == "owner_review_requested_persistent"
    assert request["priority"] >= 78


def test_auto_applied_request_closes_feedback_loop(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    runtime = repo / ".authority-opportunity-runtime"
    _write(runtime / "discovery_candidates.json", {"candidates": [{"host": "owned.example"}]})
    _write(state / "owner_scope_negotiation_result.json", {"decisions": [{"host": "owned.example", "status": "auto_applied_inside_owner_expansion_envelope", "applied": True}]})

    result = run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=100)
    ledger = json.loads((state / "rights_request_ledger.json").read_text())
    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]

    assert result["active_request_count"] == 0
    assert ledger["requests"][0]["status"] == "satisfied"
    assert signals == []


def test_hard_deny_remains_terminal_and_is_not_re_requested(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    runtime = repo / ".authority-opportunity-runtime"
    runtime.mkdir(parents=True)
    (runtime / "external_action_denials.ndjson").write_text(json.dumps({"host": "blocked.example", "classification": "hard_deny"}) + "\n", encoding="utf-8")

    result = run_rights_request_federation(repo, state, runtime_dirs=[runtime], now=100)
    request = json.loads((state / "rights_request_ledger.json").read_text())["requests"][0]
    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())["signals"]

    assert result["closed_request_count"] == 1
    assert request["status"] == "terminal_stop"
    assert request["may_override_hard_deny_or_revocation"] is False
    assert signals == []


def test_pr_message_is_stable_for_same_active_request_set(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "rights_request_ledger.json", {"requests": [{
        "request_id": "rights-1",
        "host": "candidate.example",
        "requested_methods": ["GET", "HEAD"],
        "status": "requesting_owner_scope_expansion",
        "priority": 90,
    }]})

    marker1, message1 = pr_federation_message(state)
    marker2, message2 = pr_federation_message(state)

    assert marker1 == marker2
    assert message1 == message2
    assert "META / X / SENJU" in message1
    assert "candidate.example" in message1
    assert "Owner Expansion Envelope" in message1
