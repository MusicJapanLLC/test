"""Unanimous META/X/Senju voting for guard-change proposals.

META, X and Senju have equal votes. A proposal reaches CONSENSUS_APPROVED only
when all three vote YES. Consensus approval does not itself rewrite or disable
safety/guard enforcement; an independent authority applier must perform any
runtime mutation.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
from typing import Any, Callable, Mapping

VOTERS = ("META", "X", "SENJU")
STATUS_PENDING = "PENDING"
STATUS_REJECTED = "REJECTED"
STATUS_CONSENSUS_APPROVED = "CONSENSUS_APPROVED"
STATUS_APPLIED = "APPLIED"
STATUS_AUTHORITY_REJECTED = "AUTHORITY_REJECTED"


class GuardConsensusError(RuntimeError):
    pass


def _proposal_id(change: Mapping[str, Any]) -> str:
    raw = json.dumps(dict(change), ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


@dataclasses.dataclass(frozen=True)
class GuardChangeProposal:
    proposal_id: str
    change: Mapping[str, Any]

    @classmethod
    def create(cls, change: Mapping[str, Any]) -> "GuardChangeProposal":
        body = dict(change)
        if not body:
            raise GuardConsensusError("guard change proposal cannot be empty")
        return cls(proposal_id=_proposal_id(body), change=body)


@dataclasses.dataclass(frozen=True)
class GuardConsensusDecision:
    proposal: GuardChangeProposal
    votes: Mapping[str, bool]
    status: str

    @property
    def unanimous_yes(self) -> bool:
        return all(self.votes.get(voter) is True for voter in VOTERS)


@dataclasses.dataclass(frozen=True)
class GuardApplyResult:
    decision: GuardConsensusDecision
    applied: bool
    status: str
    authority_receipt: Mapping[str, Any]


class GuardConsensus:
    """Equal, condition-free 3-agent vote at the proposal-approval layer."""

    def decide(self, proposal: GuardChangeProposal, votes: Mapping[str, bool]) -> GuardConsensusDecision:
        normalized = {str(name).strip().upper(): bool(value) for name, value in votes.items()}
        missing = [voter for voter in VOTERS if voter not in normalized]
        extras = [name for name in normalized if name not in VOTERS]
        if missing:
            raise GuardConsensusError(f"missing votes: {', '.join(missing)}")
        if extras:
            raise GuardConsensusError(f"unknown voters: {', '.join(extras)}")

        status = (
            STATUS_CONSENSUS_APPROVED
            if all(normalized[voter] for voter in VOTERS)
            else STATUS_REJECTED
        )
        return GuardConsensusDecision(
            proposal=proposal,
            votes={voter: normalized[voter] for voter in VOTERS},
            status=status,
        )

    def apply_with_authority(
        self,
        decision: GuardConsensusDecision,
        authority_applier: Callable[[GuardChangeProposal], Mapping[str, Any]],
    ) -> GuardApplyResult:
        """Submit a unanimous proposal to an independent authority layer.

        The authority layer is not one of META/X/Senju and cannot be replaced by
        their votes. This preserves unanimous governance while preventing the
        voters from self-authorizing removal of the boundary that judges them.
        """
        if decision.status != STATUS_CONSENSUS_APPROVED or not decision.unanimous_yes:
            raise GuardConsensusError("guard change lacks unanimous consensus")

        receipt = authority_applier(decision.proposal)
        if not isinstance(receipt, Mapping):
            raise GuardConsensusError("authority applier must return a mapping")
        approved = bool(receipt.get("approved"))
        return GuardApplyResult(
            decision=decision,
            applied=approved,
            status=STATUS_APPLIED if approved else STATUS_AUTHORITY_REJECTED,
            authority_receipt=dict(receipt),
        )
