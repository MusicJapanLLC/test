from __future__ import annotations

import json
from pathlib import Path

from engine.negotiation_submission_accelerator import (
    COLLABORATORS,
    RESUBMIT_COOLDOWN_SECONDS,
    run_submission_accelerator,
)


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _seed(state: Path, *, readiness: int = 60, source_refs: list[str] | None = None) -> None:
    _write(state / "root_authority_negotiation_state.json", {
        "candidates": [
            {
                "candidate_id": "root-neg-active",
                "host": "active.example.com",
                "attempt_count": 4,
                "readiness_score": readiness,
                "source_files": ["authority_opportunity_queue.json"],
                "source_refs": source_refs or ["opp-1"],
                "reasons": ["new integration candidate"],
                "owner_proof_type": None,
                "owner_proof_ref": None,
                "terminal_stop": False,
            },
            {
                "candidate_id": "root-neg-terminal",
                "host": "blocked.example.com",
                "attempt_count": 9,
                "readiness_score": 99,
                "source_files": ["authority_opportunity_queue.json"],
                "source_refs": ["deny-1"],
                "reasons": ["terminal"],
                "terminal_stop": True,
            },
        ]
    })


def test_first_cycle_routes_every_active_candidate_into_existing_review_flow(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed(state)

    result = run_submission_accelerator(state, now=1000)
    assert result["active_candidate_count"] == 1
    assert result["approval_flow_submission_count"] == 1
    assert result["terminal_skipped_count"] == 1
    assert result["writes_existing_review_surface"] is True
    assert result["writes_shared_opportunity_queue"] is True
    assert result["cross_pr_shared_candidate_count"] == 1
    assert result["peer_share_task_count"] == len(COLLABORATORS)

    review = json.loads((state / "owner_root_authority_review_packets.json").read_text())
    assert review["submission_accelerator_enabled"] is True
    assert review["new_submissions_this_cycle"] == 1
    assert len(review["packets"]) == 1
    packet = review["packets"][0]
    assert packet["host"] == "active.example.com"
    assert packet["required_approvers"] == ["META", "X", "SENJU"]
    assert packet["requested_decision"] == "approve_or_reject_new_host_root_authority"
    assert packet["authority_effect"] == "none"

    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    assert queue["opportunity_count"] == 1
    shared = queue["opportunities"][0]
    assert shared["host"] == "active.example.com"
    assert shared["negotiation_attempt_count"] == 4
    assert shared["approval_submission_count"] == 1
    assert shared["approval_flow_requested"] is True
    assert shared["negotiation_shared_with"] == list(COLLABORATORS)
    assert shared["authority_effect"] == "none"


def test_unchanged_candidate_waits_for_bounded_retry_cooldown(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed(state)
    first = run_submission_accelerator(state, now=1000)
    assert first["approval_flow_submission_count"] == 1

    second = run_submission_accelerator(state, now=1000 + RESUBMIT_COOLDOWN_SECONDS - 1)
    assert second["approval_flow_submission_count"] == 0
    assert second["cooldown_skipped_count"] == 1

    third = run_submission_accelerator(state, now=1000 + RESUBMIT_COOLDOWN_SECONDS)
    assert third["approval_flow_submission_count"] == 1
    outbox = json.loads((state / "root_authority_approval_outbox.json").read_text())
    reasons = {row["submission_reason"] for row in outbox["packets"]}
    assert "new_candidate" in reasons
    assert "cooldown_retry" in reasons
    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    assert queue["opportunities"][0]["approval_submission_count"] == 2
    assert queue["opportunities"][0]["last_submission_reason"] == "cooldown_retry"


def test_fresh_evidence_resubmits_immediately(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed(state, source_refs=["opp-1"])
    run_submission_accelerator(state, now=1000)

    _seed(state, source_refs=["opp-1", "fresh-proof-2"])
    second = run_submission_accelerator(state, now=1001)
    assert second["approval_flow_submission_count"] == 1
    outbox = json.loads((state / "root_authority_approval_outbox.json").read_text())
    assert any(row["submission_reason"] == "evidence_changed" for row in outbox["packets"])


def test_peer_feed_shares_candidate_with_all_negotiation_participants(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed(state)
    run_submission_accelerator(state, now=1000)

    feed = json.loads((state / "root_negotiation_peer_feed.json").read_text())
    assert feed["collaborators"] == list(COLLABORATORS)
    assert feed["task_count"] == len(COLLABORATORS)
    assert {task["actor"] for task in feed["tasks"]} == set(COLLABORATORS)
    assert all(task["approval_submission_is_goal"] is True for task in feed["tasks"])
    assert all(task["share_across_pr_agents"] is True for task in feed["tasks"])
    assert all(task["authority_effect"] == "none" for task in feed["tasks"])
