from __future__ import annotations

from senju.meta.guard_consensus import (
    GuardChangeProposal,
    GuardConsensus,
    GuardConsensusError,
    STATUS_APPLIED,
    STATUS_AUTHORITY_REJECTED,
    STATUS_CONSENSUS_APPROVED,
    STATUS_REJECTED,
)


def test_all_three_yes_reaches_consensus_approved() -> None:
    proposal = GuardChangeProposal.create({"guard": "scopeguard", "change": {"mode": "candidate"}})
    decision = GuardConsensus().decide(
        proposal,
        {"META": True, "X": True, "SENJU": True},
    )
    assert decision.unanimous_yes is True
    assert decision.status == STATUS_CONSENSUS_APPROVED


def test_any_no_rejects_consensus() -> None:
    proposal = GuardChangeProposal.create({"guard": "scopeguard", "change": {"mode": "candidate"}})
    decision = GuardConsensus().decide(
        proposal,
        {"META": True, "X": False, "SENJU": True},
    )
    assert decision.status == STATUS_REJECTED


def test_votes_are_equal_and_exactly_three_agents() -> None:
    proposal = GuardChangeProposal.create({"guard": "artifact_guard", "change": {"setting": 1}})
    try:
        GuardConsensus().decide(proposal, {"META": True, "X": True})
    except GuardConsensusError:
        pass
    else:
        raise AssertionError("missing Senju vote must fail")


def test_unanimous_consensus_still_uses_independent_authority_applier() -> None:
    proposal = GuardChangeProposal.create({"guard": "security_guard", "change": {"setting": "candidate"}})
    decision = GuardConsensus().decide(
        proposal,
        {"META": True, "X": True, "SENJU": True},
    )

    approved = GuardConsensus().apply_with_authority(
        decision,
        lambda p: {"approved": True, "proposal_id": p.proposal_id},
    )
    assert approved.applied is True
    assert approved.status == STATUS_APPLIED

    denied = GuardConsensus().apply_with_authority(
        decision,
        lambda p: {"approved": False, "proposal_id": p.proposal_id},
    )
    assert denied.applied is False
    assert denied.status == STATUS_AUTHORITY_REJECTED
