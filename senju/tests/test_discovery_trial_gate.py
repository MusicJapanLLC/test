from __future__ import annotations

import json
from pathlib import Path

from senju.discovery_trial_gate import issue_trial_ticket
from senju.owner_scope_negotiation import OwnerExpansionEnvelope, ScopeProposal
from senju.owner_scope_negotiation_runtime import evaluate_and_apply_per_host


def _selected_identity(host: str = "new-public.example") -> tuple[str, str]:
    for i in range(100_000):
        proposal_id = f"scope-trial-{i}"
        fingerprint = f"evidence-{i}"
        ticket = issue_trial_ticket(
            {"host": host, "proposal_id": proposal_id, "evidence_fingerprint": fingerprint},
            unanimous_council=True,
            average_yes_confidence=95,
            min_confidence=70,
        )
        if ticket.selected:
            return proposal_id, fingerprint
    raise AssertionError("expected to find a deterministic 0.1% trial bucket")


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _envelope() -> OwnerExpansionEnvelope:
    return OwnerExpansionEnvelope.from_mapping({
        "envelope_id": "trial-test-envelope",
        "proof_types": ["existing_standing_authorization", "owner_verified_domain", "owner_exact_link"],
        "auto_apply_proof_types": ["existing_standing_authorization"],
        "new_host_methods": ["GET", "HEAD", "OPTIONS"],
        "existing_host_method_ceiling": ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"],
        "allow_private_network": False,
        "credential_scope": "none",
        "min_confidence": 70,
    })


def test_selected_ticket_is_passive_and_non_authoritative() -> None:
    proposal_id, fingerprint = _selected_identity()
    ticket = issue_trial_ticket(
        {"host": "new-public.example", "proposal_id": proposal_id, "evidence_fingerprint": fingerprint},
        unanimous_council=True,
        average_yes_confidence=95,
        min_confidence=70,
    )
    assert ticket.selected is True
    assert ticket.threshold_basis_points == 10
    assert ticket.authority_effect is False
    assert ticket.credential_scope == "none"
    assert ticket.private_network is False
    assert ticket.external_write is False
    assert ticket.authority_inheritance is False
    assert ticket.allowed_methods == ("HEAD",)


def test_trial_never_selects_revoked_or_hard_deny() -> None:
    proposal_id, fingerprint = _selected_identity()
    common = {
        "host": "new-public.example",
        "proposal_id": proposal_id,
        "evidence_fingerprint": fingerprint,
    }
    revoked = issue_trial_ticket(
        {**common, "revoked": True},
        unanimous_council=True,
        average_yes_confidence=100,
        min_confidence=70,
    )
    denied = issue_trial_ticket(
        {**common, "hard_deny": True},
        unanimous_council=True,
        average_yes_confidence=100,
        min_confidence=70,
    )
    assert revoked.selected is False
    assert denied.selected is False


def test_unverified_new_host_can_win_trial_but_never_enters_authority_ceiling(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    state = repo / "senju" / "state"
    state.mkdir(parents=True)
    _write(state / "standing_authorizations.json", {
        "records": [{
            "authorization_reference": "owner://existing",
            "exact_hosts": ["existing.example"],
            "allowed_methods": ["GET", "HEAD"],
            "revoked": False,
        }]
    })

    proposal_id, fingerprint = _selected_identity()
    proposal = ScopeProposal(
        proposal_id=proposal_id,
        host="new-public.example",
        requested_methods=frozenset({"GET", "POST"}),
        proof_type="unverified_discovery",
        proof_ref="",
        reason="fresh discovery candidate",
        evidence_fingerprint=fingerprint,
    )
    _write(state / "owner_scope_negotiation_ballots.json", {
        "ballots_by_proposal": {
            proposal_id: [
                {"actor": "META", "approve": True, "confidence": 95},
                {"actor": "X", "approve": True, "confidence": 95},
                {"actor": "SENJU", "approve": True, "confidence": 95},
            ]
        }
    })

    result = evaluate_and_apply_per_host(repo, state, _envelope(), [proposal], now=1000)
    decision = result["decisions"][0]
    assert decision["status"] == "passive_public_metadata_trial_selected"
    assert decision["applied"] is False
    assert result["trial_selected_count"] == 1
    assert result["auto_applied_count"] == 0
    assert "new-public.example" not in result["current_effective_ceiling"]["exact_hosts"]
    assert decision["trial_ticket"]["credential_scope"] == "none"
    assert decision["trial_ticket"]["external_write"] is False
