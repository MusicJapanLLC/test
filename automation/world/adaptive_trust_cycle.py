"""Adaptive production cycle: UnifiedTrustLoop plus owner-approved boundary evolution.

The ordinary autonomous generation executes first. Agents may then identify boundary
needs and create inert proposals. After proposal creation, an external approval resolver
may return independently-produced owner approval for that exact fingerprint. The approved
delta can then be activated and applied in the same cycle.

No fallback verifier exists here. Without external owner approval, proposals remain inert.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence

from .trust_boundary_proposals import (
    BoundaryActivation,
    BoundaryProposal,
    OwnerApproval,
    TrustBoundaryProposalManager,
)
from .unified_trust_loop import UnifiedTrustLoop, UnifiedTrustResult, UnifiedTrustState


class AdaptiveTrustCycleError(RuntimeError):
    pass


@dataclass(frozen=True)
class ApprovedBoundaryInput:
    approval: OwnerApproval
    approved_delta: Mapping[str, Any] | None = None


@dataclass(frozen=True)
class AdaptiveTrustCycleResult:
    loop_result: UnifiedTrustResult
    proposals: tuple[BoundaryProposal, ...]
    activations: tuple[BoundaryActivation, ...]
    apply_receipts: tuple[Mapping[str, Any], ...]
    next_generation_boundary_patch: tuple[Mapping[str, Any], ...]


class AdaptiveTrustCycle:
    def __init__(
        self,
        loop: UnifiedTrustLoop,
        proposal_manager: TrustBoundaryProposalManager | None = None,
    ) -> None:
        self.loop = loop
        self.proposal_manager = proposal_manager or TrustBoundaryProposalManager()

    def run(
        self,
        state: UnifiedTrustState,
        *,
        loop_kwargs: Mapping[str, Any],
        boundary_need_fn: Callable[[UnifiedTrustResult], Sequence[Mapping[str, Any]]],
        approval_resolver_fn: Callable[[BoundaryProposal], ApprovedBoundaryInput | None] | None = None,
        verify_owner_approval_fn: Callable[[BoundaryProposal, OwnerApproval], bool] | None = None,
        apply_activation_fn: Callable[[BoundaryActivation], Mapping[str, Any]] | None = None,
    ) -> AdaptiveTrustCycleResult:
        result = self.loop.run(state, **dict(loop_kwargs))
        needs = boundary_need_fn(result)
        if not isinstance(needs, (list, tuple)):
            raise AdaptiveTrustCycleError("boundary_need_fn must return a list/tuple")

        proposals: list[BoundaryProposal] = []
        activations: list[BoundaryActivation] = []
        receipts: list[Mapping[str, Any]] = []
        next_patch: list[Mapping[str, Any]] = []

        for raw in needs:
            if not isinstance(raw, Mapping):
                raise AdaptiveTrustCycleError("boundary need must be a mapping")
            proposal = self.proposal_manager.propose(
                kind=str(raw.get("kind") or ""),
                source_trust_root_id=self.loop.envelope.trust_root_id,
                reason=str(raw.get("reason") or ""),
                requested_delta=dict(raw.get("requested_delta") or {}),
                ttl_seconds=int(raw.get("ttl_seconds", 3600)),
            )
            proposals.append(proposal)

            approved = approval_resolver_fn(proposal) if approval_resolver_fn is not None else None
            if approved is None:
                continue
            if verify_owner_approval_fn is None:
                raise AdaptiveTrustCycleError("owner approval exists but no external verifier was provided")

            activation = self.proposal_manager.activate(
                proposal_id=proposal.proposal_id,
                approval=approved.approval,
                verify_owner_approval_fn=verify_owner_approval_fn,
                approved_delta=approved.approved_delta,
            )
            activations.append(activation)

            if apply_activation_fn is None:
                next_patch.append(activation.to_dict())
                continue

            receipt = copy.deepcopy(dict(apply_activation_fn(activation)))
            if receipt.get("applied") is not True:
                raise AdaptiveTrustCycleError("boundary activation apply did not report success")
            if str(receipt.get("activation_id") or "") != activation.activation_id:
                raise AdaptiveTrustCycleError("apply receipt references the wrong activation")
            if str(receipt.get("lineage_fingerprint") or "") != activation.lineage_fingerprint:
                raise AdaptiveTrustCycleError("apply receipt lineage fingerprint mismatch")
            if receipt.get("self_approved") is True:
                raise AdaptiveTrustCycleError("boundary apply receipt cannot claim autonomous self-approval")
            receipts.append(receipt)
            next_patch.append(
                {
                    "kind": activation.kind,
                    "activation_id": activation.activation_id,
                    "lineage_fingerprint": activation.lineage_fingerprint,
                    "activated_delta": copy.deepcopy(dict(activation.activated_delta)),
                    "apply_receipt": receipt,
                }
            )

        return AdaptiveTrustCycleResult(
            loop_result=result,
            proposals=tuple(proposals),
            activations=tuple(activations),
            apply_receipts=tuple(receipts),
            next_generation_boundary_patch=tuple(next_patch),
        )
