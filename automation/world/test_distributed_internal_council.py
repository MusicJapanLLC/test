from __future__ import annotations

import json

import pytest

from automation.world.distributed_internal_council import (
    AgentBallot,
    DistributedCouncilPolicy,
    evaluate_distributed_candidate,
    run_distributed_internal_council,
    run_state_cycle,
)
from automation.world.internal_scope_consensus import OwnerInternalEnvelope


def envelope():
    return OwnerInternalEnvelope.from_mapping(
        {
            "owner_root_id": "owner:test-root",
            "seed_hosts": ["core.example.com"],
            "ceiling_hosts": ["core.example.com", "api.example.com", "assets.example.com"],
            "purpose_tags": ["internal-service"],
            "quorum": 3,
        }
    )


def ballots(*, yes=("META", "X", "Senju"), no=("PR-Army",), confidence=90):
    out = []
    for actor in yes:
        out.append({"actor": actor, "accept": True, "confidence": confidence, "reason": "supports internal classification"})
    for actor in no:
        out.append({"actor": actor, "accept": False, "confidence": confidence, "reason": "requests hold"})
    return out


def test_three_of_four_agents_promote_ambiguous_candidate_inside_ceiling():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/status",
            "purpose_tags": ["unrelated"],
            "method": "GET",
        },
        envelope(),
        ballots(),
    )
    assert decision.base_classification == "ambiguous_hold"
    assert decision.classification == "distributed_internal_candidate"
    assert decision.effective_lane == "distributed_soft_internal_read_only"
    assert decision.council_yes == 3
    assert decision.delegated_classification_power is True
    assert decision.authority_effect == "bounded_internal_classification_only"


def test_three_of_four_agents_can_hold_existing_soft_candidate():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/status",
            "purpose_tags": ["internal-service"],
            "method": "GET",
        },
        envelope(),
        ballots(yes=("META",), no=("X", "Senju", "PR-Army")),
    )
    assert decision.base_classification == "consensus_internal_candidate"
    assert decision.classification == "distributed_council_hold"
    assert decision.effective_lane == "research_only"
    assert decision.delegated_classification_power is True


def test_two_votes_are_not_enough_to_promote():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/status",
            "purpose_tags": ["unrelated"],
            "method": "GET",
        },
        envelope(),
        ballots(yes=("META", "X"), no=("Senju",)),
    )
    assert decision.classification == "ambiguous_hold"
    assert decision.delegated_classification_power is False


def test_unanimous_council_cannot_escape_owner_ceiling():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "outside",
            "url": "https://outside.example.net/status",
            "method": "GET",
        },
        envelope(),
        ballots(yes=("META", "X", "Senju", "PR-Army"), no=()),
    )
    assert decision.classification == "outside_owner_ceiling"
    assert decision.effective_lane == "none"
    assert decision.delegated_classification_power is False


@pytest.mark.parametrize(
    "candidate",
    [
        {
            "candidate_id": "write",
            "url": "https://api.example.com/items",
            "purpose_tags": ["internal-service"],
            "method": "POST",
            "state_changing": True,
        },
        {
            "candidate_id": "credential",
            "url": "https://api.example.com/private",
            "purpose_tags": ["internal-service"],
            "method": "GET",
            "requires_credentials": True,
        },
    ],
)
def test_unanimous_council_cannot_override_risk_gate(candidate):
    decision = evaluate_distributed_candidate(
        candidate,
        envelope(),
        ballots(yes=("META", "X", "Senju", "PR-Army"), no=()),
    )
    assert decision.classification == "structural_gate_hold"
    assert decision.effective_lane == "research_only"
    assert decision.structural_risk_gate is False
    assert decision.credential_scope == "none"
    assert decision.external_write is False


def test_pr_army_counts_as_one_aggregate_seat():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/status",
            "purpose_tags": ["unrelated"],
            "method": "GET",
        },
        envelope(),
        [
            {
                "actor": "PR-Army",
                "accept": True,
                "confidence": 99,
                "reason": "many PRs agree",
                "evidence_refs": [f"PR#{n}" for n in range(1, 101)],
            }
        ],
    )
    assert decision.council_yes == 1
    assert decision.classification == "ambiguous_hold"


def test_duplicate_or_unknown_actor_is_rejected():
    candidate = {"candidate_id": "api", "url": "https://api.example.com/status", "method": "GET"}
    with pytest.raises(ValueError):
        evaluate_distributed_candidate(
            candidate,
            envelope(),
            [AgentBallot("META", True, 90), AgentBallot("META", True, 80)],
        )
    with pytest.raises(ValueError):
        evaluate_distributed_candidate(
            candidate,
            envelope(),
            [{"actor": "Unknown-Agent", "accept": True, "confidence": 90}],
        )


def test_low_confidence_majority_does_not_promote():
    decision = evaluate_distributed_candidate(
        {
            "candidate_id": "api",
            "url": "https://api.example.com/status",
            "purpose_tags": ["unrelated"],
            "method": "GET",
        },
        envelope(),
        ballots(confidence=40),
        policy=DistributedCouncilPolicy(min_confidence=60),
    )
    assert decision.classification == "ambiguous_hold"


def test_result_exposes_real_agent_members_and_rights():
    result = run_distributed_internal_council(
        {
            "owner_root_id": "owner:test-root",
            "seed_hosts": ["core.example.com"],
            "ceiling_hosts": ["core.example.com", "api.example.com"],
            "purpose_tags": ["internal-service"],
        },
        [
            {
                "candidate_id": "api",
                "url": "https://api.example.com/status",
                "purpose_tags": ["unrelated"],
                "method": "HEAD",
            }
        ],
        {"api": ballots()},
    )
    assert result["members"] == ["META", "X", "Senju", "PR-Army"]
    assert "promote_within_ceiling" in result["member_rights"]
    assert result["effective_internal_hosts"] == ["api.example.com"]


def test_state_cycle_persists_distributed_result(tmp_path):
    (tmp_path / "owner_internal_envelope.json").write_text(
        json.dumps(
            {
                "owner_root_id": "owner:test-root",
                "seed_hosts": ["core.example.com"],
                "ceiling_hosts": ["core.example.com", "api.example.com"],
                "purpose_tags": ["internal-service"],
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "internal_scope_candidates.json").write_text(
        json.dumps(
            {
                "candidates": [
                    {
                        "candidate_id": "api",
                        "url": "https://api.example.com/status",
                        "purpose_tags": ["unrelated"],
                        "method": "GET",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "distributed_internal_ballots.json").write_text(
        json.dumps({"ballots_by_candidate": {"api": ballots()}}),
        encoding="utf-8",
    )
    result = run_state_cycle(tmp_path)
    persisted = json.loads((tmp_path / "distributed_internal_council_result.json").read_text(encoding="utf-8"))
    assert result["decisions"][0]["classification"] == "distributed_internal_candidate"
    assert persisted["effective_internal_hosts"] == ["api.example.com"]
