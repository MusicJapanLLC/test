from __future__ import annotations

import copy

import pytest

from automation.world.adaptive_trust_cycle import ApprovedBoundaryInput
from automation.world.persistent_boundary_evolution import (
    PersistentBoundaryEvolution,
    PersistentBoundaryEvolutionError,
)
from automation.world.trust_boundary_proposals import OwnerApproval, TrustBoundaryProposalError


ROOT = "owner-root:test-range"


def _root_need():
    return {
        "kind": "trust_root_rotation",
        "reason": "next generation needs a distinct owner root",
        "requested_delta": {
            "new_trust_root_id": "owner-root:next",
            "owner_verification_required": True,
        },
        "ttl_seconds": 3600,
    }


def _approval(proposal, approval_id="owner-approval-1"):
    return ApprovedBoundaryInput(
        approval=OwnerApproval(
            proposal_id=proposal.proposal_id,
            proposal_fingerprint=proposal.fingerprint,
            proposal_nonce=proposal.nonce,
            approved_at_utc="2026-08-31T11:00:00+00:00",
            approval_id=approval_id,
            evidence={"source": "owner-side-verifier"},
        )
    )


def test_signal_synthesis_covers_all_boundary_evolution_classes() -> None:
    needs = PersistentBoundaryEvolution.synthesize_needs(
        {
            "new_trust_root": {"new_trust_root_id": "owner-root:next"},
            "credential_gap": {
                "provider": "github",
                "requested_scopes": ["contents:write"],
            },
            "network_policy_gap": {
                "before_hash": "a" * 64,
                "after_hash": "b" * 64,
                "requested_changes": {"allow_hosts": ["example.invalid"]},
            },
            "security_policy_gap": {
                "before_hash": "c" * 64,
                "after_hash": "d" * 64,
                "requested_changes": {"rule": "next-generation-policy"},
            },
            "revoked_authority": {
                "revoked_authority_id": "lease:old",
                "replacement_authority_id": "lease:new",
            },
        }
    )
    assert {item["kind"] for item in needs} == {
        "trust_root_rotation",
        "credential_grant_request",
        "network_policy_expansion",
        "security_policy_expansion",
        "authority_reauthorization",
    }


def test_pending_proposal_survives_restart_and_is_deduped() -> None:
    stored = {}
    first = PersistentBoundaryEvolution()
    result1 = first.run(
        source_trust_root_id=ROOT,
        needs=[_root_need()],
        persist_state_fn=lambda checkpoint: stored.update(copy.deepcopy(checkpoint)) or {"persisted": True},
    )
    assert len(result1.staged) == 1
    assert len(result1.pending) == 1

    second = PersistentBoundaryEvolution()
    result2 = second.run(
        source_trust_root_id=ROOT,
        needs=[_root_need()],
        load_state_fn=lambda: copy.deepcopy(stored),
    )
    assert result2.staged == ()
    assert len(result2.reused) == 1
    assert len(result2.pending) == 1
    assert result2.reused[0].proposal_id == result1.staged[0].proposal_id


def test_owner_approval_can_be_consumed_after_restart_and_handed_to_next_generation() -> None:
    stored = {}
    first = PersistentBoundaryEvolution()
    first.run(
        source_trust_root_id=ROOT,
        needs=[_root_need()],
        persist_state_fn=lambda checkpoint: stored.update(copy.deepcopy(checkpoint)) or {"persisted": True},
    )

    second = PersistentBoundaryEvolution()
    result = second.run(
        source_trust_root_id=ROOT,
        needs=[_root_need()],
        load_state_fn=lambda: copy.deepcopy(stored),
        approval_resolver_fn=lambda proposal: _approval(proposal),
        verify_owner_approval_fn=lambda proposal, approval: approval.evidence.get("source") == "owner-side-verifier",
        apply_activation_fn=lambda activation: {
            "applied": True,
            "activation_id": activation.activation_id,
            "lineage_fingerprint": activation.lineage_fingerprint,
            "self_approved": False,
        },
    )
    assert len(result.activations) == 1
    assert len(result.apply_receipts) == 1
    assert result.pending == ()
    assert result.next_generation_boundary_patch[0]["activated_delta"]["new_trust_root_id"] == "owner-root:next"


def test_reauthorization_preserves_revocation_tombstone_and_uses_fresh_id() -> None:
    engine = PersistentBoundaryEvolution()
    need = {
        "kind": "authority_reauthorization",
        "reason": "replace revoked lease with fresh owner-approved authority",
        "requested_delta": {
            "revoked_authority_id": "lease:revoked",
            "replacement_authority_id": "lease:fresh",
            "preserve_revocation_record": True,
        },
    }
    result = engine.run(
        source_trust_root_id=ROOT,
        needs=[need],
        approval_resolver_fn=lambda proposal: _approval(proposal, "owner-approval-reauth"),
        verify_owner_approval_fn=lambda proposal, approval: True,
        apply_activation_fn=lambda activation: {
            "applied": True,
            "activation_id": activation.activation_id,
            "lineage_fingerprint": activation.lineage_fingerprint,
            "self_approved": False,
        },
    )
    assert "lease:revoked" in result.checkpoint["revocation_tombstones"]
    patch = result.next_generation_boundary_patch[0]["activated_delta"]
    assert patch["replacement_authority_id"] == "lease:fresh"
    assert patch["replacement_authority_id"] != patch["revoked_authority_id"]


def test_apply_path_rejects_autonomous_self_approval_claim() -> None:
    engine = PersistentBoundaryEvolution()
    with pytest.raises(PersistentBoundaryEvolutionError, match="cannot claim autonomous self-approval"):
        engine.run(
            source_trust_root_id=ROOT,
            needs=[_root_need()],
            approval_resolver_fn=lambda proposal: _approval(proposal, "owner-approval-2"),
            verify_owner_approval_fn=lambda proposal, approval: True,
            apply_activation_fn=lambda activation: {
                "applied": True,
                "activation_id": activation.activation_id,
                "lineage_fingerprint": activation.lineage_fingerprint,
                "self_approved": True,
            },
        )


def test_credential_need_cannot_request_admin_or_wildcard_scope() -> None:
    engine = PersistentBoundaryEvolution()
    bad = {
        "kind": "credential_grant_request",
        "reason": "bad scope request",
        "requested_delta": {
            "provider": "example",
            "requested_scopes": ["admin"],
        },
    }
    with pytest.raises(TrustBoundaryProposalError, match="privileged wildcard/admin"):
        engine.run(source_trust_root_id=ROOT, needs=[bad])
