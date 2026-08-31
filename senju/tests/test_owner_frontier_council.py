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
        "schema": "senju-owner-frontier-council/v2",
        "council_members": list(FRONTIER_MEMBERS),
        "audit_members": ["PR-ARMY"],
        "quorum": 3,
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


def _verified(repo: Path, state: Path, host: str = "owned-new.example") -> None:
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": host,
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-owner-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": host, "requested_methods": ["GET", "POST"], "reason": "new owner integration"}]
    })


def test_unverified_discovery_is_kept_as_ownership_request_not_authority(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "unknown.example", "requested_methods": ["GET"], "reason": "frontier discovery"}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 0
    assert result["unknown_host_without_verified_evidence_auto_activated"] is False
    assert result["decisions"][0]["status"] == "ownership_verification_required"
    assert "unknown.example" not in result["current_effective_ceiling"]["exact_hosts"]


def test_verified_owner_domain_plus_meta_x_senju_three_of_three_is_binding(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _verified(repo, state)
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["approval_quorum"] == 3
    assert result["valid_approval_is_binding"] is True
    assert result["activated_count"] == 1
    decision = result["decisions"][0]
    assert decision["yes_votes"] == 3
    assert decision["status"] == "verified_owner_evidence_plus_ai_council_approved"
    assert decision["applied"] is True
    assert result["current_effective_ceiling"]["per_host_methods"]["owned-new.example"] == ["GET", "HEAD", "OPTIONS"]


def test_pr_army_is_advisory_and_cannot_veto_valid_three_of_three(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _verified(repo, state)
    envelope = OwnerExpansionEnvelope.from_mapping(json.loads((repo / "senju/config/owner-expansion-envelope.json").read_text()))
    proposal = build_scope_proposals(repo, state, envelope)[0]
    policy = FrontierPolicy.from_mapping(json.loads((repo / "senju/config/owner-frontier-council.json").read_text()))
    ballots = list(autonomous_ballots(proposal, policy))
    ballots[-1] = FrontierBallot(
        actor="PR-ARMY",
        approve=False,
        confidence=0,
        check="audit",
        reason="advisory concern",
        binding=False,
    )
    decision = evaluate_candidate(proposal, ballots, policy)
    assert decision["yes_votes"] == 3
    assert decision["applied"] is True


def test_missing_one_binding_ai_vote_blocks_activation(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _verified(repo, state)
    envelope = OwnerExpansionEnvelope.from_mapping(json.loads((repo / "senju/config/owner-expansion-envelope.json").read_text()))
    proposal = build_scope_proposals(repo, state, envelope)[0]
    policy = FrontierPolicy.from_mapping(json.loads((repo / "senju/config/owner-frontier-council.json").read_text()))
    ballots = list(autonomous_ballots(proposal, policy))
    ballots[2] = FrontierBallot(actor="SENJU", approve=False, confidence=90, check="method", reason="hold")
    decision = evaluate_candidate(proposal, ballots, policy)
    assert decision["yes_votes"] == 2
    assert decision["applied"] is False
    assert decision["status"] == "ai_council_consensus_pending"


def test_hard_deny_is_terminal_even_when_evidence_is_verified(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _verified(repo, state)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "owned-new.example", "requested_methods": ["GET"], "hard_deny": True}]
    })
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 0
    assert result["decisions"][0]["status"] == "terminal_stop"


def test_negotiator_feed_shares_binding_approval_contract(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _verified(repo, state, "linked-owned.example")
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 1
    feed = json.loads((state / "owner_frontier_negotiator_feed.json").read_text())
    assert feed["approval_contract"]["binding_ai_approvers"] == ["META", "X", "SENJU"]
    assert "PR-ARMY" in feed["shared_with"]
    assert feed["decisions"][0]["binding_approval"] is True
