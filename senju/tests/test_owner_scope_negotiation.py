from __future__ import annotations

import json
from pathlib import Path

import pytest

from senju.external import ExternalContactError
from senju.negotiated_external_client import NegotiatedExternalContactClient
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, build_scope_proposals, materialize_negotiation_campaign
from senju.owner_scope_negotiation_runtime import evaluate_and_apply_per_host


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _envelope() -> OwnerExpansionEnvelope:
    return OwnerExpansionEnvelope.from_mapping({
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
        "min_confidence": 70,
        "negotiation_intensity": 60,
    })


def _repo(tmp_path: Path) -> tuple[Path, Path]:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    state.mkdir(parents=True)
    _write(state / "standing_authorizations.json", {
        "records": [{
            "authorization_reference": "owner://existing",
            "exact_hosts": ["existing.example"],
            "allowed_methods": ["GET", "HEAD", "POST"],
            "revoked": False,
        }]
    })
    return repo, state


def _ballots(state: Path, proposal_id: str, approve: bool = True) -> None:
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal_id: [
                {"actor": "META", "approve": approve, "confidence": 90},
                {"actor": "X", "approve": approve, "confidence": 90},
                {"actor": "SENJU", "approve": approve, "confidence": 90},
            ]
        }
    })


def test_unverified_discovery_becomes_aggressive_negotiation_not_authority(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "adversary_external_host_requests.json", {
        "requests": [{"host": "unknown.example", "requested_methods": ["GET"], "reason": "runtime friction"}]
    })
    proposals = build_scope_proposals(repo, state, _envelope())
    assert len(proposals) == 1
    assert proposals[0].proof_type == "unverified_discovery"
    campaign = materialize_negotiation_campaign(state, proposals, _envelope(), now=1000)
    assert campaign["negotiation_intensity"] == 60
    assert campaign["task_count"] == 30
    result = evaluate_and_apply_per_host(repo, state, _envelope(), proposals, now=1000)
    assert result["auto_applied_count"] == 0
    assert result["owner_review_count"] == 1
    assert "unknown.example" not in result["current_effective_ceiling"]["exact_hosts"]


def test_verified_new_host_stays_owner_review_even_with_unanimous_ai_ballots(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_expansion_evidence.json", {
        "evidence": [{
            "host": "owned-new.example",
            "proof_type": "owner_verified_domain",
            "proof_ref": "dns-proof:abc",
            "verified": True,
            "revoked": False,
        }]
    })
    _write(state / "adversary_external_host_requests.json", {
        "requests": [{"host": "owned-new.example", "requested_methods": ["GET", "POST"], "reason": "needed integration"}]
    })
    proposal = build_scope_proposals(repo, state, _envelope())[0]
    _ballots(state, proposal.proposal_id)
    result = evaluate_and_apply_per_host(repo, state, _envelope(), [proposal], now=1000)
    assert result["auto_applied_count"] == 0
    assert result["owner_review_count"] == 1
    assert "owned-new.example" not in result["current_effective_ceiling"]["exact_hosts"]


def test_existing_owner_host_can_expand_methods_after_meta_x_senju_quorum(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [
            {"host": "existing.example", "requested_methods": ["GET", "HEAD", "POST", "PATCH"]},
        ]
    })
    proposal = build_scope_proposals(repo, state, _envelope())[0]
    _ballots(state, proposal.proposal_id)
    result = evaluate_and_apply_per_host(repo, state, _envelope(), [proposal], now=1000)
    ceiling = result["current_effective_ceiling"]
    assert result["auto_applied_count"] == 1
    assert "PATCH" in ceiling["per_host_methods"]["existing.example"]
    assert ceiling["exact_hosts"] == ["existing.example"]


def test_existing_host_needs_full_meta_x_senju_quorum(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "existing.example", "requested_methods": ["PATCH"]}]
    })
    proposal = build_scope_proposals(repo, state, _envelope())[0]
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal.proposal_id: [
                {"actor": "META", "approve": True, "confidence": 95},
                {"actor": "X", "approve": True, "confidence": 95},
            ]
        }
    })
    result = evaluate_and_apply_per_host(repo, state, _envelope(), [proposal], now=1000)
    assert result["auto_applied_count"] == 0
    assert result["decisions"][0]["status"] == "council_negotiation_pending"


def test_hard_deny_remains_terminal_even_with_unanimous_ballots(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_scope_negotiation_signals.json", {
        "signals": [{"host": "existing.example", "requested_methods": ["PATCH"], "hard_deny": True}]
    })
    proposal = build_scope_proposals(repo, state, _envelope())[0]
    _ballots(state, proposal.proposal_id)
    result = evaluate_and_apply_per_host(repo, state, _envelope(), [proposal], now=1000)
    assert result["decisions"][0]["status"] == "terminal_stop"
    assert result["auto_applied_count"] == 0


def test_negotiated_client_enforces_per_host_methods_before_transport(tmp_path: Path) -> None:
    repo, state = _repo(tmp_path)
    _write(state / "owner_contact_ceiling_effective.json", {
        "ceiling": {
            "ceiling_id": "effective",
            "exact_hosts": ["existing.example", "owned-new.example"],
            "allowed_methods": ["GET", "HEAD", "OPTIONS", "POST", "PATCH"],
            "per_host_methods": {
                "existing.example": ["GET", "HEAD", "POST", "PATCH"],
                "owned-new.example": ["GET", "HEAD", "OPTIONS"],
            },
            "allow_http": False,
            "allow_delete": False,
            "follow_redirects": True,
            "max_redirects": 3,
            "retries": 1,
            "timeout_seconds": 5,
            "max_response_bytes": 1024,
        }
    })
    client = NegotiatedExternalContactClient(repo, state, opener=lambda *args, **kwargs: None)
    with pytest.raises(ExternalContactError, match="not allowed for negotiated host"):
        client.contact("https://owned-new.example/", method="POST")
    assert "POST" in client.per_host_methods["existing.example"]
