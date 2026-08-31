from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from senju.meta.authorized_host_promotion_corps import run_promotion_corps
from senju.meta.promotion_negotiation_bridge import COLLABORATORS, collect_negotiation_intelligence
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, build_scope_proposals
from senju.meta.standing_authorization import save_registry


ENVELOPE = {
    "envelope_id": "bridge-test",
    "proof_types": ["existing_standing_authorization", "owner_verified_domain"],
    "auto_apply_proof_types": ["existing_standing_authorization"],
    "new_host_methods": ["GET", "HEAD", "OPTIONS"],
    "existing_host_method_ceiling": ["GET", "HEAD", "OPTIONS"],
    "decision_quorum": 3,
    "min_confidence": 70,
    "negotiation_intensity": 85,
    "allow_http": False,
    "allow_delete": False,
    "allow_private_network": False,
    "credential_scope": "none",
}


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_collects_owner_and_root_negotiation_context(tmp_path: Path) -> None:
    state = tmp_path / "state"
    shared = tmp_path / "shared"
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": "candidate.example",
            "requested_methods": ["GET", "HEAD"],
            "reason": "owner scope candidate",
        }]
    })
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "candidate.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "proof:1",
            "verified": True,
        }]
    })
    _write(shared / "root_authority_approval_outbox.json", {
        "packets": [{
            "host": "candidate.example",
            "submission_id": "sub-1",
            "candidate_id": "candidate-1",
            "readiness_score": 80,
            "submitted_at": 1234,
            "source_refs": ["root-ref"],
        }]
    })
    _write(shared / "negotiation_submission_ledger.json", {
        "by_host": {"candidate.example": {"submission_count": 3, "last_submitted_at": 1234}}
    })
    _write(shared / "authority_opportunity_queue.json", {
        "opportunities": [{"host": "candidate.example", "priority": 92, "reason": "root candidate"}]
    })

    context = collect_negotiation_intelligence(state, shared)["candidate.example"]
    assert context["owner_evidence_verified"] is True
    assert context["root_approval_submissions"] == 1
    assert context["root_submission_count"] == 3
    assert context["root_readiness_score"] == 80
    assert context["opportunity_priority"] == 92
    assert set(context["requested_methods"]) == {"GET", "HEAD"}
    assert "owner_scope_negotiation_signals" in context["source_channels"]
    assert "root_authority_approval_outbox" in context["source_channels"]


def test_promotion_corps_writes_feedback_back_to_shared_negotiation_memory(tmp_path: Path) -> None:
    repo = tmp_path
    state = repo / "senju" / "state"
    shared = tmp_path / "shared"
    promotion = tmp_path / "promotion"
    _write(repo / "senju" / "config" / "owner-expansion-envelope.json", ENVELOPE)
    save_registry(state / "standing_authorizations.json", ())
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "candidate.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "verified:candidate.example",
            "verified": True,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": "candidate.example",
            "requested_methods": ["GET", "HEAD"],
            "reason": "promotion bridge candidate",
        }]
    })
    envelope = OwnerExpansionEnvelope.from_mapping(ENVELOPE)
    proposal = build_scope_proposals(repo, state, envelope)[0]
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal.proposal_id: [
                {"actor": actor, "approve": True, "confidence": 95, "reason": "reviewed"}
                for actor in ("META", "X", "SENJU")
            ]
        }
    })
    _write(state / "owner_scope_negotiation_result.json", {
        "decisions": [{
            "proposal_id": proposal.proposal_id,
            "status": "owner_review_requested",
            "applied": False,
        }]
    })
    _write(shared / "root_authority_approval_outbox.json", {
        "packets": [{
            "host": "candidate.example",
            "submission_id": "sub-1",
            "candidate_id": "candidate-1",
            "readiness_score": 80,
            "submitted_at": 1234,
        }]
    })
    _write(shared / "negotiation_submission_ledger.json", {
        "by_host": {"candidate.example": {"submission_count": 2, "last_submitted_at": 1234}}
    })

    result = run_promotion_corps(
        repo,
        state,
        promotion,
        collaboration_dir=shared,
        now=dt.datetime(2026, 9, 1, 1, tzinfo=dt.timezone.utc),
    )
    assert result["execution_ready_count"] == 0
    assert result["packet_count"] == 1
    assert result["collaboration_dir_connected"] is True
    assert result["feedback_task_count"] == len(COLLABORATORS)
    packet = result["packets"][0]
    assert packet["status"] == "READY_FOR_STANDING_AUTHORIZATION"
    assert packet["coordination_priority"] >= 70
    assert "active_exact_host_standing_authorization" in packet["missing_requirements"]
    assert packet["negotiation_context"]["root_submission_count"] == 2

    feedback = json.loads((shared / "promotion_corps_feedback_outbox.json").read_text())
    assert feedback["task_count"] == len(COLLABORATORS)
    assert {task["actor"] for task in feedback["tasks"]} == set(COLLABORATORS)
    assert all(task["share_across_negotiation_agents"] is True for task in feedback["tasks"])
    assert all(task["authority_effect"] == "none" for task in feedback["tasks"])

    intelligence = json.loads((shared / "promotion_corps_intelligence_snapshot.json").read_text())
    assert intelligence["host_count"] == 1
    assert intelligence["bidirectional"] is True
