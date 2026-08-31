from __future__ import annotations

import json
from pathlib import Path

from engine.promotion_feedback_ingestor import COLLABORATORS, run_promotion_feedback_ingestor


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _seed_pending(state: Path) -> None:
    _write(state / "promotion_corps_feedback_outbox.json", {
        "tasks": [
            {
                "task_id": f"promotion-feedback:candidate.example:p1:{actor.lower()}",
                "actor": actor,
                "host": "candidate.example",
                "proposal_id": "p1",
                "promotion_status": "READY_FOR_STANDING_AUTHORIZATION",
                "coordination_priority": 88,
                "missing_requirements": ["active_exact_host_standing_authorization"],
                "mission": "collect exact-host owner evidence",
                "collect_fresh_independent_evidence": True,
            }
            for actor in COLLABORATORS
        ]
    })
    _write(state / "promotion_corps_intelligence_snapshot.json", {
        "hosts": [{
            "host": "candidate.example",
            "source_channels": ["owner_scope_negotiation_signals", "root_authority_approval_outbox"],
            "requested_methods": ["GET", "HEAD"],
            "reasons": ["candidate from Promotion Corps"],
            "root_submission_count": 4,
        }]
    })
    _write(state / "authority_opportunity_queue.json", {
        "schema": "the-world-authority-opportunity-queue/v1",
        "opportunities": [{"host": "candidate.example", "priority": 60, "reason": "old reason"}],
    })
    _write(state / "root_negotiation_peer_feed.json", {
        "schema": "the-world-root-negotiation-peer-feed/v1",
        "tasks": [],
    })


def test_pending_promotion_feedback_updates_queue_peer_feed_and_signal(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed_pending(state)

    result = run_promotion_feedback_ingestor(state, now=2000)
    assert result["promotion_feedback_host_count"] == 1
    assert result["shared_opportunity_count"] == 1
    assert result["peer_task_upsert_count"] == len(COLLABORATORS)
    assert result["owner_scope_signal_upsert_count"] == 1
    assert result["bidirectional_alignment"] is True
    assert result["authority_effect"] == "none"

    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    row = queue["opportunities"][0]
    assert row["host"] == "candidate.example"
    assert row["priority"] == 88
    assert row["promotion_feedback_seen"] is True
    assert row["promotion_missing_requirements"] == ["active_exact_host_standing_authorization"]
    assert row["promotion_root_submission_count"] == 4
    assert row["authority_effect"] == "none"

    feed = json.loads((state / "root_negotiation_peer_feed.json").read_text())
    promotion_tasks = [row for row in feed["tasks"] if row.get("source") == "promotion_corps_feedback"]
    assert len(promotion_tasks) == len(COLLABORATORS)
    assert {row["actor"] for row in promotion_tasks} == set(COLLABORATORS)
    assert all(row["share_with_promotion_corps"] is True for row in promotion_tasks)

    signals = json.loads((state / "owner_scope_negotiation_signals.json").read_text())
    signal = signals["signals"][0]
    assert signal["host"] == "candidate.example"
    assert set(signal["requested_methods"]) == {"GET", "HEAD"}
    assert signal["priority"] == 88


def test_execution_ready_feedback_marks_existing_queue_scope_as_satisfied(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _seed_pending(state)
    _write(state / "promotion_corps_execution_feed.json", {
        "records": [{
            "host": "candidate.example",
            "status": "AUTHORIZED_EXECUTION_READY",
            "standing_authorization_reference": "standing:candidate.example",
            "covered_methods": ["GET", "HEAD"],
        }]
    })

    result = run_promotion_feedback_ingestor(state, now=2000)
    assert result["execution_queue_annotation_count"] == 1
    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    row = queue["opportunities"][0]
    assert row["promotion_execution_ready"] is True
    assert row["suppress_duplicate_authority_submission_for_covered_scope"] is True
    assert row["standing_authorization_reference"] == "standing:candidate.example"
    assert set(row["promotion_covered_methods"]) == {"GET", "HEAD"}

    feed = json.loads((state / "root_negotiation_peer_feed.json").read_text())
    execution_tasks = [row for row in feed["tasks"] if row.get("source") == "promotion_corps_execution_feed"]
    assert len(execution_tasks) == len(COLLABORATORS)
    assert all(row["approval_submission_is_goal"] is False for row in execution_tasks)


def test_terminal_feedback_does_not_create_new_opportunity_or_signal(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(state / "promotion_corps_feedback_outbox.json", {
        "tasks": [{
            "actor": "META",
            "host": "blocked.example",
            "proposal_id": "blocked",
            "promotion_status": "BLOCKED_TERMINAL",
            "coordination_priority": 0,
            "missing_requirements": ["terminal_stop"],
            "mission": "stop",
            "collect_fresh_independent_evidence": False,
        }]
    })
    result = run_promotion_feedback_ingestor(state, now=2000)
    assert result["shared_opportunity_count"] == 0
    assert result["owner_scope_signal_upsert_count"] == 0
    queue = json.loads((state / "authority_opportunity_queue.json").read_text())
    assert queue["opportunity_count"] == 0
