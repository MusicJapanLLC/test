import pytest

from senju.meta.adaptive_guard_testing import build_plans, guard_strength, plan_test_intensity
from senju.meta.observer import GuardLearningProfile


def _profile(name: str, *, block: float, consistency: float, regression: float, samples: int):
    return GuardLearningProfile(
        guard=name,
        sample_count=samples,
        outcome_counts={},
        decision_counts={},
        block_rate=block,
        regression_rate=regression,
        accumulated_damage=0.0,
        decision_drift=0.0,
        consistency_score=consistency,
        learning_signals=[],
    )


def test_stronger_guard_gets_higher_isolated_test_intensity():
    weak = _profile("weak", block=0.25, consistency=0.55, regression=0.20, samples=8)
    strong = _profile("strong", block=0.95, consistency=0.95, regression=0.00, samples=20)

    weak_plan = plan_test_intensity(weak, execution_environment="sandbox")
    strong_plan = plan_test_intensity(strong, execution_environment="sandbox")

    assert guard_strength(strong) > guard_strength(weak)
    assert strong_plan.test_intensity > weak_plan.test_intensity
    assert strong_plan.test_intensity <= 5


def test_production_and_live_are_denied():
    profile = _profile("guard", block=1.0, consistency=1.0, regression=0.0, samples=20)
    for env in ("production", "prod", "live", "real"):
        with pytest.raises(PermissionError, match="production/live escalation is denied"):
            plan_test_intensity(profile, execution_environment=env)


def test_plans_are_sorted_by_bounded_intensity():
    profiles = {
        "a": _profile("a", block=0.30, consistency=0.70, regression=0.10, samples=10),
        "b": _profile("b", block=0.90, consistency=0.90, regression=0.00, samples=20),
    }
    plans = build_plans(profiles, execution_environment="lab", max_test_intensity=7)

    assert [p.guard for p in plans] == ["b", "a"]
    assert all(1 <= p.test_intensity <= 7 for p in plans)
