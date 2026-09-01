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
        "schema": "senju-owner-frontier-council/v3",
        "operating_mode": "senju_research_governance",
        "managed_by": "SENJU",
        "production_activation_enabled": False,
        "repository_state_writer_enabled": False,
        "council_members": list(FRONTIER_MEMBERS),
        "audit_members": ["PR-ARMY"],
        "quorum": 3,
        "min_confidence": 75,
        "recognized_owner_evidence_types": ["existing_standing_authorization", "owner_verified_domain", "owner_exact_link"],
        "research_candidate_methods": ["GET", "HEAD", "OPTIONS"],
        "max_research_candidates_per_cycle": 64,
        "credential_scope": "none",
        "allow_http": False,
        "allow_delete": False,
        "allow_private_network": False,
    })
    return repo, state


def _signal(state: Path, host: str, **extra: object) -> None:
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{
            "host": host,
            "requested_methods": ["GET", "POST"],
            "reason": "frontier research",
            **extra,
        }]
    })


def _verified(state: Path, host: str) -> None:
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": host,
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-owner-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })


def test_unverified_discovery_enters_senju_research_without_authority(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _signal(state, "unknown.example")
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["production"] is False
    assert result["production_activation_enabled"] is False
    assert result["activated_count"] == 0
    assert result["valid_approval_is_binding"] is False
    assert result["decisions"][0]["research_admitted"] is True
    assert result["decisions"][0]["production_activation_eligible"] is False
    assert result["decisions"][0]["status"].startswith("senju_research_candidate")


def test_verified_three_of_three_is_recommendation_only(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _signal(state, "owned-new.example")
    _verified(state, "owned-new.example")
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["approval_quorum"] == 3
    assert result["activated_count"] == 0
    decision = result["decisions"][0]
    assert decision["yes_votes"] == 3
    assert decision["status"] == "senju_research_recommendation_ready"
    assert decision["applied"] is False
    assert decision["valid_approval_is_binding"] is False
    assert decision["authority_effect"] == "none"


def test_pr_army_is_advisory_and_no_ballot_is_binding(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _signal(state, "owned-new.example")
    _verified(state, "owned-new.example")
    envelope = OwnerExpansionEnvelope.from_mapping(json.loads((repo / "senju/config/owner-expansion-envelope.json").read_text()))
    proposal = build_scope_proposals(repo, state, envelope)[0]
    policy = FrontierPolicy.from_mapping(json.loads((repo / "senju/config/owner-frontier-council.json").read_text()))
    ballots = list(autonomous_ballots(proposal, policy))
    assert all(ballot.binding is False for ballot in ballots)
    ballots[-1] = FrontierBallot(actor="PR-ARMY", approve=False, confidence=0, check="audit", reason="concern")
    decision = evaluate_candidate(proposal, ballots, policy)
    assert decision["applied"] is False
    assert decision["production_activation_eligible"] is False


def test_hard_deny_is_terminal_for_external_action(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _signal(state, "blocked.example", hard_deny=True)
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["activated_count"] == 0
    assert result["decisions"][0]["status"] == "terminal_stop"
    assert result["decisions"][0]["research_admitted"] is False


def test_frontier_does_not_write_effective_owner_ceiling(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    sentinel = {"sentinel": "must-not-change"}
    _write(state / "owner_contact_ceiling_effective.json", sentinel)
    _signal(state, "owned-new.example")
    _verified(state, "owned-new.example")
    result = run_frontier_cycle(repo, state, now=1000)
    assert result["writes_effective_owner_ceiling"] is False
    assert json.loads((state / "owner_contact_ceiling_effective.json").read_text()) == sentinel


def test_negotiator_feed_routes_to_senju_research_not_binding_activation(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _signal(state, "linked-owned.example")
    _verified(state, "linked-owned.example")
    run_frontier_cycle(repo, state, now=1000)
    feed = json.loads((state / "owner_frontier_negotiator_feed.json").read_text())
    assert feed["managed_by"] == "SENJU"
    assert feed["approval_contract"]["binding_approval"] is False
    assert feed["approval_contract"]["production_activation"] is False
    assert feed["decisions"][0]["binding_approval"] is False
    research = json.loads((state / "owner_frontier_senju_research_queue.json").read_text())
    assert research["managed_by"] == "SENJU"
    assert research["production_activation"] is False
