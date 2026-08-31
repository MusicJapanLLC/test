from __future__ import annotations

import json
from pathlib import Path

from scripts.frontier_approval_continuity import run


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_budget_deferred_binding_ai_council_approval_returns_to_opportunity_queue(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "owner_frontier_council.json",
        {
            "decisions": [{
                "proposal_id": "scope-1",
                "host": "approved.example",
                "proof_type": "owner_verified_domain",
                "proof_ref": "owner-proof:1",
                "yes_votes": 3,
                "required_votes": 3,
                "valid_approval_is_binding": True,
                "min_yes_confidence": 88,
                "status": "cycle_host_budget_exhausted",
                "applied": False,
            }]
        },
    )
    _write(
        state / "owner_scope_negotiation_signals.json",
        {"signals": [{"host": "approved.example", "requested_methods": ["GET", "HEAD", "OPTIONS"]}]},
    )
    _write(
        state / "authority_opportunity_queue.json",
        {"opportunities": [{"host": "other.example", "requested_methods": ["GET"], "priority": 50}]},
    )

    result = run(state, now=100)
    assert result["pending_count"] == 1
    pending = json.loads((state / "owner_frontier_approved_pending.json").read_text())
    assert pending["pending"][0]["host"] == "approved.example"
    assert pending["pending"][0]["approved_votes"] == 3
    assert pending["pending"][0]["binding_approvers"] == ["META", "X", "SENJU"]
    assert pending["pending"][0]["requires_revalidation_next_cycle"] is True

    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    by_host = {row["host"]: row for row in queue["opportunities"]}
    assert "other.example" in by_host
    assert by_host["approved.example"]["priority"] == 100
    assert by_host["approved.example"]["hard_deny"] is False
    assert by_host["approved.example"]["revoked"] is False

    _write(
        state / "owner_frontier_council.json",
        {"decisions": [{"host": "approved.example", "status": "verified_owner_evidence_plus_ai_council_approved", "applied": True}]},
    )
    result = run(state, now=200)
    assert result["pending_count"] == 0
    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    assert [row["host"] for row in queue["opportunities"]] == ["other.example"]
