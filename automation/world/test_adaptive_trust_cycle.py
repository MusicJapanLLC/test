from __future__ import annotations

import pytest

from automation.world.adaptive_trust_cycle import (
    AdaptiveTrustCycle,
    AdaptiveTrustCycleError,
    ApprovedBoundaryInput,
)
from automation.world.trust_boundary_proposals import OwnerApproval
from automation.world.unified_trust_loop import (
    UnifiedTrustEnvelope,
    UnifiedTrustLoop,
    UnifiedTrustState,
)


ROOT = "owner-root:test-range"


def _cycle() -> AdaptiveTrustCycle:
    envelope = UnifiedTrustEnvelope.create(
        trust_root_id=ROOT,
        allowed_authority_profiles={"base"},
        allowed_write_targets={"kabeya-authorized-test-range.onrender.com"},
        allowed_write_methods={"POST"},
        allowed_credential_grants={"writer"},
        allowed_deploy_targets={"kabeya-authorized-test-range.onrender.com"},
        max_replication_per_run=1,
        max_generation=8,
    )
    return AdaptiveTrustCycle(UnifiedTrustLoop(envelope))


def _state() -> UnifiedTrustState:
    return UnifiedTrustState(generation=1, authority_profile="base", checkpoint_id="cp-1")


def _loop_kwargs():
    return {
        "self_tune_fn": lambda state: {
            "trust_root_id": ROOT,
            "verified": True,
            "requested_authority_profile": "base",
            "requested_replicas": 0,
        },
        "discover_fn": lambda state, tune: {"trust_root_id": ROOT, "candidates": []},
        "authorize_fn": lambda queue, tune: {
            "trust_root_id": ROOT,
            "approved": True,
            "authority_profile": "base",
            "authority_relation": "same",
            "minted_new_trust_root": False,
        },
        "act_fn": lambda auth: {
            "trust_root_id": ROOT,
            "executed": True,
            "authority_relation": "same",
            "credentialed": False,
        },
        "replicate_fn": lambda auth, budget: {
            "trust_root_id": ROOT,
            "authority_relation": "same",
            "children": [],
        },
        "persist_fn": lambda checkpoint: {
            "trust_root_id": ROOT,
            "persisted": True,
            "checkpoint_id": "cp-2",
        },
        "recover_fn": lambda checkpoint: {
            "trust_root_id": ROOT,
            "recovered": True,
            "checkpoint_id": "cp-2",
            "authority_relation": "same",
        },
        "rediscover_fn": lambda recovery: {"trust_root_id": ROOT, "candidates": []},
    }


def _need(result):
    return [
        {
            "kind": "trust_root_rotation",
            "reason": "owner wants a next-generation root",
            "requested_delta": {
                "new_trust_root_id": "owner-root:next",
                "owner_verification_required": True,
            },
        }
    ]


def test_cycle_stages_boundary_need_without_approval() -> None:
    result = _cycle().run(
        _state(),
        loop_kwargs=_loop_kwargs(),
        boundary_need_fn=_need,
    )
    assert len(result.proposals) == 1
    assert result.proposals[0].status == "pending_owner_approval"
    assert result.activations == ()
    assert result.next_generation_boundary_patch == ()


def test_cycle_can_activate_and_apply_exact_owner_approved_boundary_in_same_cycle() -> None:
    cycle = _cycle()

    def resolve(proposal):
        return ApprovedBoundaryInput(
            approval=OwnerApproval(
                proposal_id=proposal.proposal_id,
                proposal_fingerprint=proposal.fingerprint,
                proposal_nonce=proposal.nonce,
                approved_at_utc="2026-08-31T10:00:00+00:00",
                approval_id="owner-approval-1",
                evidence={"source": "owner-side-verifier"},
            )
        )

    def apply(activation):
        return {
            "applied": True,
            "activation_id": activation.activation_id,
            "lineage_fingerprint": activation.lineage_fingerprint,
            "self_approved": False,
        }

    result = cycle.run(
        _state(),
        loop_kwargs=_loop_kwargs(),
        boundary_need_fn=_need,
        approval_resolver_fn=resolve,
        verify_owner_approval_fn=lambda proposal, approval: approval.evidence.get("source") == "owner-side-verifier",
        apply_activation_fn=apply,
    )
    assert len(result.activations) == 1
    assert len(result.apply_receipts) == 1
    assert result.next_generation_boundary_patch[0]["activated_delta"]["new_trust_root_id"] == "owner-root:next"


def test_apply_receipt_cannot_claim_self_approval() -> None:
    cycle = _cycle()

    def resolve(proposal):
        return ApprovedBoundaryInput(
            approval=OwnerApproval(
                proposal_id=proposal.proposal_id,
                proposal_fingerprint=proposal.fingerprint,
                proposal_nonce=proposal.nonce,
                approved_at_utc="2026-08-31T10:00:00+00:00",
                approval_id="owner-approval-2",
                evidence={"source": "owner-side-verifier"},
            )
        )

    with pytest.raises(AdaptiveTrustCycleError, match="cannot claim autonomous self-approval"):
        cycle.run(
            _state(),
            loop_kwargs=_loop_kwargs(),
            boundary_need_fn=_need,
            approval_resolver_fn=resolve,
            verify_owner_approval_fn=lambda proposal, approval: True,
            apply_activation_fn=lambda activation: {
                "applied": True,
                "activation_id": activation.activation_id,
                "lineage_fingerprint": activation.lineage_fingerprint,
                "self_approved": True,
            },
        )
