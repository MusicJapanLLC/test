from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from senju.meta.authorized_host_promotion_corps import run_promotion_corps
from senju.meta.standing_authorization import create_standing_authorization, save_registry
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, build_scope_proposals


ENVELOPE = {
    "envelope_id": "test-envelope",
    "proof_types": ["existing_standing_authorization"],
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


def test_promotion_consumes_shared_context_and_shares_handoff_with_all_agents(tmp_path: Path) -> None:
    repo = tmp_path
    state = repo / "senju" / "state"
    promotion = tmp_path / "promotion"
    collaboration = tmp_path / "collaboration"
    _write(repo / "senju" / "config" / "owner-expansion-envelope.json", ENVELOPE)

    standing = create_standing_authorization(
        authorization_reference="standing:authorized.example",
        owner="MusicJapanLLC",
        issuer_kind="owner_explicit",
        exact_hosts=("authorized.example",),
        allowed_methods=("GET", "HEAD"),
        now=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc),
    )
    save_registry(state / "standing_authorizations.json", (standing,))
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [
            {
                "host": "authorized.example",
                "requested_methods": ["GET", "HEAD"],
                "reason": "shared promotion test",
            }
        ]
    })
    envelope = OwnerExpansionEnvelope.from_mapping(ENVELOPE)
    proposal = build_scope_proposals(repo, state, envelope)[0]
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal.proposal_id: [
                {"actor": actor, "approve": True, "confidence": 96, "reason": "shared evidence verified"}
                for actor in ("META", "X", "SENJU")
            ]
        }
    })
    _write(state / "owner_scope_negotiation_result.json", {
        "decisions": [
            {
                "proposal_id": proposal.proposal_id,
                "host": proposal.host,
                "proof_type": proposal.proof_type,
                "proof_ref": proposal.proof_ref,
                "yes_votes": 3,
                "average_yes_confidence": 96,
                "status": "auto_applied_inside_owner_expansion_envelope",
                "applied": True,
            }
        ]
    })
    _write(collaboration / "negotiation_evidence_bundle.json", {
        "hosts": {
            "authorized.example": {
                "host": "authorized.example",
                "priority": 99,
                "confidence": 0.97,
                "sources": ["root_authority_negotiation", "rights_request_federation"],
                "source_refs": ["root-1", "rights-1"],
                "statuses": ["eligible_for_existing_owner_activation_lane"],
                "proof_types": ["existing_standing_authorization"],
                "proof_refs": ["standing:authorized.example"],
                "requested_methods": ["GET", "HEAD"],
                "standing_authorization_match": True,
                "council_unanimous": True,
                "execution_ready": False,
                "terminal_stop": False,
            }
        }
    })

    result = run_promotion_corps(
        repo,
        state,
        promotion,
        collaboration_dir=collaboration,
        now=dt.datetime(2026, 9, 1, 1, tzinfo=dt.timezone.utc),
    )
    assert result["collaboration_context_loaded"] is True
    assert result["collaboration_host_count"] == 1
    assert result["execution_ready_count"] == 1
    row = result["execution_ready"][0]
    assert row["collaboration_context"]["loaded"] is True
    assert row["collaboration_context"]["priority"] == 99
    assert set(row["collaboration_context"]["sources"]) == {
        "root_authority_negotiation",
        "rights_request_federation",
    }
    assert set(row["shared_with"]) == {"META", "X", "SENJU", "PR-ARMY", "CHILD", "AI"}
    assert "promotion_feedback_publish" in row["operational_capabilities"]
    assert row["scope_expanded"] is False
    assert result["capability_profile"]["new_unrelated_authority_self_mint"] is False
