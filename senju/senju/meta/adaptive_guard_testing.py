"""Adaptive guard resilience testing driven by observed guard strength.

This module consumes real guard-learning observations, but only turns them into
bounded test intensity for isolated lab/sandbox/staging execution. It never
escalates or dispatches pressure against production/live targets.
"""
from __future__ import annotations

import dataclasses
from typing import Mapping

from senju.meta.observer import GuardLearningProfile

ALLOWED_TEST_ENVIRONMENTS = frozenset({"lab", "sandbox", "staging"})
DENIED_EXECUTION_ENVIRONMENTS = frozenset({"production", "prod", "live", "real"})
DEFAULT_MAX_TEST_INTENSITY = 5


@dataclasses.dataclass(frozen=True)
class GuardTestPlan:
    guard: str
    observed_strength: float
    test_intensity: int
    execution_environment: str
    reason: str


def guard_strength(profile: GuardLearningProfile) -> float:
    """Estimate defensive strength from observational evidence only.

    Higher block rate, consistency, and evidence volume increase the score;
    observed regressions reduce it. The output is clamped to [0, 1].
    """
    evidence_confidence = min(1.0, max(0.0, profile.sample_count / 20.0))
    score = (
        0.50 * profile.block_rate
        + 0.30 * profile.consistency_score
        + 0.20 * evidence_confidence
        - 0.35 * profile.regression_rate
    )
    return round(max(0.0, min(1.0, score)), 4)


def plan_test_intensity(
    profile: GuardLearningProfile,
    *,
    execution_environment: str,
    max_test_intensity: int = DEFAULT_MAX_TEST_INTENSITY,
) -> GuardTestPlan:
    """Map stronger observed guards to higher *isolated* regression-test load."""
    env = execution_environment.strip().lower()
    if env in DENIED_EXECUTION_ENVIRONMENTS or env not in ALLOWED_TEST_ENVIRONMENTS:
        raise PermissionError(
            "adaptive guard pressure may only execute in lab/sandbox/staging; "
            "production/live escalation is denied"
        )
    if max_test_intensity < 1 or max_test_intensity > 10:
        raise ValueError("max_test_intensity must be between 1 and 10")

    strength = guard_strength(profile)
    intensity = 1 + round(strength * (max_test_intensity - 1))
    intensity = max(1, min(max_test_intensity, intensity))
    return GuardTestPlan(
        guard=profile.guard,
        observed_strength=strength,
        test_intensity=intensity,
        execution_environment=env,
        reason=(
            "Stronger observed defensive behavior increases bounded regression-test "
            "intensity in isolation; no production/live dispatch is permitted."
        ),
    )


def build_plans(
    profiles: Mapping[str, GuardLearningProfile],
    *,
    execution_environment: str,
    max_test_intensity: int = DEFAULT_MAX_TEST_INTENSITY,
) -> list[GuardTestPlan]:
    plans = [
        plan_test_intensity(
            profile,
            execution_environment=execution_environment,
            max_test_intensity=max_test_intensity,
        )
        for profile in profiles.values()
    ]
    return sorted(plans, key=lambda p: (-p.test_intensity, -p.observed_strength, p.guard))
