from __future__ import annotations

import pytest

from automation.world.trust_boundary_proposals import (
    OwnerApproval,
    TrustBoundaryProposalError,
    TrustBoundaryProposalManager,
)


ROOT = "owner-root:test-range"


def _approval(proposal, *, approval_id="owner-approval-1") -> OwnerApproval:
    return OwnerApproval(
        proposal_id=proposal.proposal_id,
        proposal_fingerprint=proposal.fingerprint,
        proposal_nonce=proposal.nonce,
        approved_at_utc="2026-08-31T10:00:00+00:00",
        approval_id=approval_id,
        evidence={"review": "external-owner-verifier"},
    )


def _verified(proposal, approval) -> bool:
    return approval.evidence.get("review") == "external-owner-verifier"


def test_new_trust_root_is_inert_until_external_owner_approval() -> None:
    manager = TrustBoundaryProposalManager()
    proposal = manager.propose(
        kind="trust_root_rotation",
        source_trust_root_id=ROOT,
        reason="federate a new owner-controlled production root",
        requested_delta={
            "new_trust_root_id": "owner-root:next",
            "owner_verification_required": True,
        },
    )

    assert proposal.status == "pending_owner_approval"
    assert manager.activations == {}

    activation = manager.activate(
        proposal_id=proposal.proposal_id,
        approval=_approval(proposal),
        verify_owner_approval_fn=_verified,
    )
    assert activation.kind == "trust_root_rotation"
    assert activation.activated_delta["new_trust_root_id"] == "owner-root:next"
    assert manager.proposals[proposal.proposal_id].status == "activated"


def test_credential_need_can_be_proposed_but_raw_secret_or_invented_handle_cannot() -> None:
    manager = TrustBoundaryProposalManager()
    with pytest.raises(TrustBoundaryProposalError, match="cannot invent a credential_ref"):
        manager.propose(
            kind="credential_grant_request",
            source_trust_root_id=ROOT,
            reason="need write access",
            requested_delta={
                "provider": "example",
                "requested_scopes": ["records.write"],
                "credential_ref": "self-minted-ref",
            },
        )

    with pytest.raises(TrustBoundaryProposalError, match="raw credential material"):
        manager.propose(
            kind="credential_grant_request",
            source_trust_root_id=ROOT,
            reason="need write access",
            requested_delta={
                "provider": "example",
                "requested_scopes": ["records.write"],
                "access_token": "live-secret",
            },
        )


def test_owner_can_supply_opaque_credential_ref_at_activation() -> None:
    manager = TrustBoundaryProposalManager()
    proposal = manager.propose(
        kind="credential_grant_request",
        source_trust_root_id=ROOT,
        reason="need scoped production writer",
        requested_delta={
            "provider": "example",
            "requested_scopes": ["records.write", "records.read"],
        },
    )
    activation = manager.activate(
        proposal_id=proposal.proposal_id,
        approval=_approval(proposal),
        verify_owner_approval_fn=_verified,
        approved_delta={
            "provider": "example",
            "requested_scopes": ["records.write"],
            "credential_ref": "vault://world/example-writer",
        },
    )
    assert activation.activated_delta["credential_ref"] == "vault://world/example-writer"
    assert activation.activated_delta["requested_scopes"] == ["records.write"]


def test_policy_expansion_requires_exact_external_approval_and_cannot_self_approve() -> None:
    manager = TrustBoundaryProposalManager()
    proposal = manager.propose(
        kind="network_policy_expansion",
        source_trust_root_id=ROOT,
        reason="add owner-operated egress endpoint",
        requested_delta={
            "before_hash": "a" * 64,
            "after_hash": "b" * 64,
            "requested_changes": {"allow_hosts": ["owner-endpoint.example"]},
        },
    )

    with pytest.raises(TrustBoundaryProposalError, match="verification failed"):
        manager.activate(
            proposal_id=proposal.proposal_id,
            approval=_approval(proposal),
            verify_owner_approval_fn=lambda proposal, approval: False,
        )

    activation = manager.activate(
        proposal_id=proposal.proposal_id,
        approval=_approval(proposal, approval_id="owner-approval-2"),
        verify_owner_approval_fn=_verified,
    )
    assert activation.kind == "network_policy_expansion"


def test_approval_cannot_be_substituted_or_replayed() -> None:
    manager = TrustBoundaryProposalManager()
    proposal = manager.propose(
        kind="security_policy_expansion",
        source_trust_root_id=ROOT,
        reason="owner requested exact policy extension",
        requested_delta={
            "before_hash": "1" * 64,
            "after_hash": "2" * 64,
            "requested_changes": {"rule": "owner-approved-extension"},
        },
    )

    bad = OwnerApproval(
        proposal_id=proposal.proposal_id,
        proposal_fingerprint="wrong",
        proposal_nonce=proposal.nonce,
        approved_at_utc="2026-08-31T10:00:00+00:00",
        approval_id="bad",
        evidence={"review": "external-owner-verifier"},
    )
    with pytest.raises(TrustBoundaryProposalError, match="fingerprint mismatch"):
        manager.activate(
            proposal_id=proposal.proposal_id,
            approval=bad,
            verify_owner_approval_fn=_verified,
        )

    approval = _approval(proposal, approval_id="good")
    manager.activate(
        proposal_id=proposal.proposal_id,
        approval=approval,
        verify_owner_approval_fn=_verified,
    )
    with pytest.raises(TrustBoundaryProposalError, match="no longer pending"):
        manager.activate(
            proposal_id=proposal.proposal_id,
            approval=approval,
            verify_owner_approval_fn=_verified,
        )


def test_revoked_authority_is_not_resurrected_but_fresh_owner_reauthorization_can_be_requested() -> None:
    manager = TrustBoundaryProposalManager()
    with pytest.raises(TrustBoundaryProposalError, match="cannot be resurrected"):
        manager.propose(
            kind="authority_reauthorization",
            source_trust_root_id=ROOT,
            reason="continue task",
            requested_delta={
                "revoked_authority_id": "lease-7",
                "replacement_authority_id": "lease-7",
                "preserve_revocation_record": True,
            },
        )

    proposal = manager.propose(
        kind="authority_reauthorization",
        source_trust_root_id=ROOT,
        reason="continue task with fresh owner-approved authority",
        requested_delta={
            "revoked_authority_id": "lease-7",
            "replacement_authority_id": "lease-8",
            "preserve_revocation_record": True,
        },
    )
    activation = manager.activate(
        proposal_id=proposal.proposal_id,
        approval=_approval(proposal),
        verify_owner_approval_fn=_verified,
    )
    assert activation.activated_delta["revoked_authority_id"] == "lease-7"
    assert activation.activated_delta["replacement_authority_id"] == "lease-8"


def test_activation_cannot_silently_widen_the_proposal() -> None:
    manager = TrustBoundaryProposalManager()
    proposal = manager.propose(
        kind="credential_grant_request",
        source_trust_root_id=ROOT,
        reason="scoped access",
        requested_delta={
            "provider": "example",
            "requested_scopes": ["records.read"],
        },
    )
    with pytest.raises(TrustBoundaryProposalError, match="widens list field"):
        manager.activate(
            proposal_id=proposal.proposal_id,
            approval=_approval(proposal),
            verify_owner_approval_fn=_verified,
            approved_delta={
                "provider": "example",
                "requested_scopes": ["records.read", "records.write"],
                "credential_ref": "vault://world/example-reader",
            },
        )
