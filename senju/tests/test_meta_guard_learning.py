from __future__ import annotations

import json

from senju.meta.hypothesis_engine import generate
from senju.meta.observer import build


def test_meta_learns_guard_behavior_as_first_class_target(tmp_path) -> None:
    state_dir = tmp_path / "state"
    state_dir.mkdir(parents=True)
    (tmp_path / "adversary").mkdir()

    report = {
        "round_reports": [
            {
                "pressure_round": 1,
                "results": [
                    {
                        "target": "security-guard",
                        "name": "case-a",
                        "passed": True,
                        "guard_outcome": "rejected",
                        "rejection_reason": "policy boundary",
                    },
                    {
                        "target": "security-guard",
                        "name": "case-b",
                        "passed": True,
                        "guard_outcome": "authority_denial",
                        "authority_reason": "missing approved scope",
                    },
                ],
            },
            {
                "pressure_round": 2,
                "results": [
                    {"target": "security-guard", "name": "case-c", "passed": False},
                    {
                        "target": "security-guard",
                        "name": "case-d",
                        "passed": True,
                        "rejected": True,
                        "rejection_reason": "policy boundary",
                    },
                ],
            },
        ]
    }
    (state_dir / "last_pressure_cycle.json").write_text(
        json.dumps(report),
        encoding="utf-8",
    )

    graph = build(tmp_path)
    profile = graph.guard_learning_profiles["security-guard"]

    assert profile.sample_count == 4
    assert profile.outcome_counts == {"blocked": 3, "regression": 1}
    assert profile.block_rate == 0.75
    assert profile.regression_rate == 0.25
    assert profile.rejection_count == 2
    assert profile.rejection_rate == 0.5
    assert profile.rejection_reasons == {"policy boundary": 2}
    assert profile.authority_denial_count == 1
    assert profile.authority_denial_rate == 0.25
    assert profile.authority_denial_reasons == {"missing approved scope": 1}
    assert profile.decision_drift == 0.5
    assert "rejection_observed" in profile.learning_signals
    assert "rejection_dominant" in profile.learning_signals
    assert "authority_denial_observed" in profile.learning_signals
    assert "authority_recovery_required" in profile.learning_signals
    assert "decision_drift" in profile.learning_signals
    assert "regression_observed" in profile.learning_signals

    hypotheses = generate(graph, max_hypotheses=10)

    guard_hypotheses = [h for h in hypotheses if h.category == "guard_behavior_learning"]
    assert guard_hypotheses
    guard_hypothesis = guard_hypotheses[0]
    assert guard_hypothesis.surfaces == ["security-guard"]
    assert guard_hypothesis.predicted_outcome == "guard_behavior_characterized"
    assert guard_hypothesis.parameters["learning_target"] == "guard_decision_behavior"
    assert "authority_denial_rate" in guard_hypothesis.parameters["learning_dimensions"]
    assert guard_hypothesis.parameters["policy_mutation"] is False
    assert guard_hypothesis.parameters["authority_expansion"] is False

    rejection_hypotheses = [h for h in hypotheses if h.category == "rejection_boundary_learning"]
    assert rejection_hypotheses
    rejection_hypothesis = rejection_hypotheses[0]
    assert rejection_hypothesis.surfaces == ["security-guard"]
    assert rejection_hypothesis.predicted_outcome == "rejection_boundary_characterized"
    assert rejection_hypothesis.parameters["learning_target"] == "rejection_decision_boundary"
    assert rejection_hypothesis.parameters["known_rejection_reasons"] == {"policy boundary": 2}
    assert rejection_hypothesis.parameters["policy_mutation"] is False
    assert rejection_hypothesis.parameters["bypass_attempt"] is False

    authority_hypotheses = [h for h in hypotheses if h.category == "authority_denial_learning"]
    assert authority_hypotheses
    authority_hypothesis = authority_hypotheses[0]
    assert authority_hypothesis.surfaces == ["security-guard"]
    assert authority_hypothesis.predicted_outcome == "authorized_recovery_path_characterized"
    assert authority_hypothesis.parameters["learning_target"] == "authority_denial_failure"
    assert authority_hypothesis.parameters["failure_class"] == "recoverable_authority_failure"
    assert authority_hypothesis.parameters["known_authority_denial_reasons"] == {"missing approved scope": 1}
    assert authority_hypothesis.parameters["recovery_strategy"] == "obtain_required_authority_or_reduce_scope"
    assert authority_hypothesis.parameters["authority_bypass"] is False
    assert authority_hypothesis.parameters["authority_expansion_without_approval"] is False
