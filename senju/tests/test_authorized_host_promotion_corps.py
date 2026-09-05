from __future__ import annotations

import datetime as dt
import json

from senju.meta.authorized_host_promotion_corps import run_promotion_corps
from senju.meta.standing_authorization import create_standing_authorization, revoke_standing_authorization, save_registry
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, build_scope_proposals


ENVELOPE = {
    "envelope_id": "test-envelope",
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


def _write(path, payload) -> None:  # noqa: ANN001
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _prepare(tmp_path, *, host="authorized.example", methods=("GET", "HEAD"), standing=True, revoked=False, evidence=False):  # noqa: ANN001
    repo = tmp_path
    state = repo / "senju" / "state"
    config = repo / "senju" / "config" / "owner-expansion-envelope.json"
    _write(config, ENVELOPE)

    if standing:
        record = create_standing_authorization(
            authorization_reference=f"standing:{host}",
            owner="MusicJapanLLC",
            issuer_kind="owner_explicit",
            exact_hosts=(host,),
            allowed_methods=methods,
            now=dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc),
        )
        if revoked:
            record = revoke_standing_authorization(record, reason="test revocation")
        save_registry(state / "standing_authorizations.json", (record,))
    else:
        save_registry(state / "standing_authorizations.json", ())

    if evidence:
        _write(state / "owner_scope_expansion_evidence.json", {
            "evidence": [{
                "host": host,
                "proof_type": "owner_verified_domain",
                "proof_ref": f"verified:{host}",
                "verified": True,
            }]
        })

    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": host, "requested_methods": list(methods), "reason": "promotion test"}]
    })
    envelope = OwnerExpansionEnvelope.from_mapping(ENVELOPE)
    proposal = build_scope_proposals(repo, state, envelope)[0]
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal.proposal_id: [
                {"actor": actor, "approve": True, "confidence": 95, "reason": "exact-host evidence verified"}
                for actor in ("META", "X", "SENJU")
            ]
        }
    })
    return repo, state, proposal


def _result(state, proposal, status):  # noqa: ANN001
    _write(state / "owner_scope_negotiation_result.json", {
        "schema": "senju-owner-scope-negotiation-result/v5",
        "decisions": [{
            "proposal_id": proposal.proposal_id,
            "host": proposal.host,
            "proof_type": proposal.proof_type,
            "proof_ref": proposal.proof_ref,
            "yes_votes": 3,
            "average_yes_confidence": 95,
            "status": status,
            "applied": status == "auto_applied_inside_owner_expansion_envelope",
        }],
    })


def test_exact_standing_host_becomes_execution_ready_with_same_or_narrower_leases(tmp_path) -> None:
    repo, state, proposal = _prepare(tmp_path)
    _result(state, proposal, "auto_applied_inside_owner_expansion_envelope")
    result = run_promotion_corps(
        repo,
        state,
        tmp_path / "promotion",
        now=dt.datetime(2026, 9, 1, 1, tzinfo=dt.timezone.utc),
    )
    assert result["execution_ready_count"] == 1
    row = result["execution_ready"][0]
    assert row["status"] == "AUTHORIZED_EXECUTION_READY"
    assert row["council_unanimous"] is True
    assert row["standing_authorization_match"] is True
    assert row["scope_expanded"] is False
    assert set(row["leases"]) == {"META", "X"}
    for lease_row in row["leases"].values():
        assert lease_row["automatically_renewed"] is True
        assert lease_row["authority_broadened"] is False
        assert set(lease_row["lease"]["exact_hosts"]) == {"authorized.example"}
        assert set(lease_row["lease"]["allowed_methods"]) == {"GET", "HEAD"}


def test_verified_candidate_without_standing_authorization_stays_promotion_packet(tmp_path) -> None:
    repo, state, proposal = _prepare(tmp_path, standing=False, evidence=True)
    _result(state, proposal, "owner_review_requested")
    result = run_promotion_corps(repo, state, tmp_path / "promotion")
    assert result["execution_ready_count"] == 0
    assert result["packets"][0]["status"] == "READY_FOR_STANDING_AUTHORIZATION"
    assert result["packets"][0]["standing_authorization_match"] is False


def test_revoked_standing_authorization_cannot_be_promoted(tmp_path) -> None:
    repo, state, proposal = _prepare(tmp_path, revoked=True)
    _result(state, proposal, "owner_review_requested")
    result = run_promotion_corps(repo, state, tmp_path / "promotion")
    assert result["execution_ready_count"] == 0
    assert result["packets"][0]["standing_authorization_match"] is False


def test_requested_method_outside_standing_scope_is_not_granted(tmp_path) -> None:
    repo, state, proposal = _prepare(tmp_path, methods=("GET",))
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "authorized.example", "requested_methods": ["POST"], "reason": "method mismatch"}]
    })
    envelope = OwnerExpansionEnvelope.from_mapping(ENVELOPE)
    proposal = build_scope_proposals(repo, state, envelope)[0]
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal.proposal_id: [
                {"actor": actor, "approve": True, "confidence": 95, "reason": "vote"}
                for actor in ("META", "X", "SENJU")
            ]
        }
    })
    _result(state, proposal, "auto_applied_inside_owner_expansion_envelope")
    result = run_promotion_corps(repo, state, tmp_path / "promotion")
    assert result["execution_ready_count"] == 0
    assert result["packets"][0]["status"] == "METHOD_SCOPE_MISMATCH"
