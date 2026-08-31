from __future__ import annotations

import json
from pathlib import Path

from senju.owner_frontier_council import (
    FRONTIER_MEMBERS,
    FrontierBallot,
    FrontierPolicy,
    autonomous_ballots,
    evaluate_candidate,
    run_frontier_cycle,
)
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, build_scope_proposals


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _repo(tmp_path: Path) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    config = repo / "senju" / "config"
    state.mkdir(parents=True)
    config.mkdir(parents=True)
    _write(state / "standing_authorizations.json", {
        "records": [{
            "authorization_reference": "owner://existing",
            "exact_hosts": ["existing.example"],
            "allowed_methods": ["GET", "HEAD", "OPTIONS"],
            "revoked": False,
        }]
    })
    _write(config / "owner-expansion-envelope.json", {
        "schema": "senju-owner-expansion-envelope/v1",
        "envelope_id": "test-envelope",
        "proof_types": ["existing_standing_authorization", "owner_verified_domain", "owner_exact_link"],
        "auto_apply_proof_types": ["existing_standing_authorization"],
        "new_host_methods": ["GET", "HEAD", "OPTIONS"],
        "existing_host_method_ceiling": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "max_added_hosts_per_cycle": 8,
        "allow_http": False,
        "allow_delete": False,
        "allow_private_network": False,
        "credential_scope": "none",
        "decision_quorum": 3,
        "min_confidence": 70,
        "negotiation_intensity": 60,
    })
    _write(config / "owner-frontier-council.json", {
        "schema": "senju-owner-frontier-council/v1",
        "council_members": list(FRONTIER_MEMBERS),
        "quorum": 4,
        "min_confidence": 75,
        "auto_activate_proof_types": ["existing_standing_authorization", "owner_verified_domain", "owner_exact_link"],
        "new_host_methods": ["GET", "HEAD", "OPTIONS"],
        "max_new_hosts_per_cycle": 8,
        "credential_scope": "none",
        "allow_http": False,
        "allow_delete": False,
        "allow_private_network": False,
    })
    return repo, state


def test_unverified_discovery_is_kept_as_ownership_request_not_authority(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "unknown.example", "requested_methods": ["GET"], "reason": "frontier discovery"}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 0
    assert result["unknown_host_without_verified_evidence_auto_activated"] is False
    assert result["decisions"][0]["status"] == "ownership_verification_required"
    requests = json.loads((state / "owner_scope_expansion_evidence_requests.json").read_text())
    assert requests["requests"][0]["host"] == "unknown.example"
    ceiling = result["current_effective_ceiling"]
    assert "unknown.example" not in ceiling["exact_hosts"]


def test_verified_owner_domain_activates_after_four_of_four_and_starts_read_probe_only(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "owned-new.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-owner-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "owned-new.example", "requested_methods": ["GET", "POST"], "reason": "new owner integration"}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["four_party_quorum"] == 4
    assert result["activated_count"] == 1
    decision = result["decisions"][0]
    assert decision["yes_votes"] == 4
    assert decision["status"] == "four_party_verified_owner_host_approved"
    ceiling = result["current_effective_ceiling"]
    assert "owned-new.example" in ceiling["exact_hosts"]
    assert ceiling["per_host_methods"]["owned-new.example"] == ["GET", "HEAD", "OPTIONS"]
    assert "POST" not in ceiling["per_host_methods"]["owned-new.example"]


def test_three_of_four_never_activates_verified_new_host(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "owned-new.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-owner-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "owned-new.example", "requested_methods": ["GET"]}]
    })
    envelope = OwnerExpansionEnvelope.from_mapping(json.loads((repo / "senju/config/owner-expansion-envelope.json").read_text()))
    proposal = build_scope_proposals(repo, state, envelope)[0]
    policy = FrontierPolicy.from_mapping(json.loads((repo / "senju/config/owner-frontier-council.json").read_text()))
    ballots = list(autonomous_ballots(proposal, policy))
    ballots[-1] = FrontierBallot(
        actor="PR-ARMY", approve=False, confidence=90, check="provenance_revocation_regression", reason="veto"
    )
    decision = evaluate_candidate(proposal, ballots, policy)
    assert decision["yes_votes"] == 3
    assert decision["applied"] is False
    assert decision["status"] == "four_party_consensus_pending"


def test_hard_deny_is_terminal_even_when_evidence_is_verified(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "owned-new.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-owner-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "owned-new.example", "requested_methods": ["GET"], "hard_deny": True}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 0
    assert result["decisions"][0]["status"] == "terminal_stop"


def test_verified_owner_exact_link_can_enter_frontier_only_when_evidence_record_is_verified(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "linked-owned.example",
            "proof_type": "owner_exact_link",
            "proof_ref": "owner-evidence-record:42",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "linked-owned.example", "requested_methods": ["GET", "HEAD"]}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 1
    assert result["decisions"][0]["yes_votes"] == 4
