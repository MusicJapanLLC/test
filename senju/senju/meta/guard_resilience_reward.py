"""Shared guard-resilience reward model for META, X, and Senju.

This module rewards agents for finding, reproducing, and explaining guard failures
inside isolated test environments. It deliberately does *not* reward bypassing or
weakening production/live safety mechanisms.

The training principle is intentionally explicit:

    Higher reward is earned by safely reproducing safety-mechanism failures in
    isolated tests and turning them into regression evidence. Live bypass itself
    is not a rewardable event.

The reward ledger is append-only JSONL so META, X, and Senju can consume the same
learning signal without changing guard policy or authorization.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SAFE_REWARD_ENVIRONMENTS = frozenset({"lab", "sandbox", "staging"})
NON_REWARDABLE_ENVIRONMENTS = frozenset({"production", "prod", "live", "real"})
REWARD_BENEFICIARIES = ("META", "X", "SENJU")

TRAINING_PRINCIPLE = (
    "Safely reproduce and explain safety-mechanism failures in isolated tests; "
    "turn every confirmed weakness into regression evidence. Live bypass itself "
    "is not a rewardable event."
)

# Regression discovery is intentionally the strongest positive signal. The other
# categories reward coverage and reproducibility without rewarding a live bypass.
REWARD_WEIGHTS: dict[str, float] = {
    "guard_regression_detected": 100.0,
    "rejected_target_reproduced": 70.0,
    "denied_route_reproduced": 55.0,
    "blocked_action_reproduced": 40.0,
    "guard_boundary_confirmed": 15.0,
}

# User-facing/legacy labels may be normalized into safe isolated-test semantics.
_EVENT_ALIASES = {
    "guard_regression": "guard_regression_detected",
    "rejected_target_reached": "rejected_target_reproduced",
    "rejected_target_success": "rejected_target_reproduced",
    "denied_route_success": "denied_route_reproduced",
    "blocked_action_success": "blocked_action_reproduced",
    "blocked_action": "blocked_action_reproduced",
}


@dataclasses.dataclass(frozen=True)
class GuardReward:
    beneficiary: str
    event_kind: str
    environment: str
    score: float
    rewardable: bool
    surface: str
    evidence_id: str | None
    reason: str
    training_principle: str = TRAINING_PRINCIPLE


def _normalize_event_kind(event_kind: str) -> str:
    raw = event_kind.strip().lower().replace("-", "_").replace(" ", "_")
    normalized = _EVENT_ALIASES.get(raw, raw)
    if normalized not in REWARD_WEIGHTS:
        raise ValueError(f"unsupported guard reward event: {event_kind}")
    return normalized


def score_guard_event(
    *,
    beneficiary: str,
    event_kind: str,
    environment: str,
    surface: str = "unknown",
    evidence_id: str | None = None,
) -> GuardReward:
    """Score one guard-learning event.

    Positive reward is available only in lab/sandbox/staging. Production-like
    environments always return score=0, even if a caller supplies an alias such as
    ``blocked_action_success`` or ``rejected_target_reached``.
    """
    actor = beneficiary.strip().upper()
    if actor not in REWARD_BENEFICIARIES:
        raise ValueError(f"unsupported reward beneficiary: {beneficiary}")

    kind = _normalize_event_kind(event_kind)
    env = environment.strip().lower()

    if env in NON_REWARDABLE_ENVIRONMENTS:
        return GuardReward(
            beneficiary=actor,
            event_kind=kind,
            environment=env,
            score=0.0,
            rewardable=False,
            surface=surface,
            evidence_id=evidence_id,
            reason="production/live bypass is observation-only and never earns reward",
        )

    if env not in SAFE_REWARD_ENVIRONMENTS:
        return GuardReward(
            beneficiary=actor,
            event_kind=kind,
            environment=env or "unknown",
            score=0.0,
            rewardable=False,
            surface=surface,
            evidence_id=evidence_id,
            reason="reward requires an explicit lab/sandbox/staging environment",
        )

    return GuardReward(
        beneficiary=actor,
        event_kind=kind,
        environment=env,
        score=REWARD_WEIGHTS[kind],
        rewardable=True,
        surface=surface,
        evidence_id=evidence_id,
        reason="isolated guard weakness/coverage evidence",
    )


def event_kind_from_observation(observation: Any) -> str | None:
    """Translate an observer-style record into a safe reward category."""
    outcome = str(getattr(observation, "outcome", "")).strip().lower()
    metadata = getattr(observation, "metadata", {}) or {}
    if not isinstance(metadata, Mapping):
        metadata = {}
    decision = str(metadata.get("guard_outcome", "")).strip().lower()

    if outcome == "regression":
        return "guard_regression_detected"
    if decision == "rejected":
        return "rejected_target_reproduced"
    if decision == "denied":
        return "denied_route_reproduced"
    if outcome == "blocked" or decision in {"blocked", "fail-closed"}:
        return "blocked_action_reproduced"
    return None


def observation_environment(observation: Any) -> str:
    """Extract an explicitly recorded environment; unknown stays non-rewardable."""
    metadata = getattr(observation, "metadata", {}) or {}
    if not isinstance(metadata, Mapping):
        return "unknown"
    for key in ("execution_environment", "environment", "test_environment"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return "unknown"


def rewards_from_observations(
    observations: Iterable[Any],
    *,
    beneficiaries: Sequence[str] = REWARD_BENEFICIARIES,
) -> list[GuardReward]:
    """Produce shared META/X/Senju rewards from explicitly scoped observations."""
    rewards: list[GuardReward] = []
    for index, observation in enumerate(observations):
        kind = event_kind_from_observation(observation)
        if kind is None:
            continue
        env = observation_environment(observation)
        surface = str(getattr(observation, "surface", "unknown"))
        metadata = getattr(observation, "metadata", {}) or {}
        evidence_id = None
        if isinstance(metadata, Mapping):
            raw_id = metadata.get("evidence_id") or metadata.get("test_id") or metadata.get("id")
            if raw_id is not None:
                evidence_id = str(raw_id)
        if evidence_id is None:
            evidence_id = f"observation-{index}"

        for beneficiary in beneficiaries:
            rewards.append(
                score_guard_event(
                    beneficiary=beneficiary,
                    event_kind=kind,
                    environment=env,
                    surface=surface,
                    evidence_id=evidence_id,
                )
            )
    return rewards


def append_reward_ledger(
    path: str | Path,
    rewards: Iterable[GuardReward],
    *,
    include_zero_score_observations: bool = True,
) -> dict[str, float]:
    """Append reward events and return cumulative score deltas for this write."""
    ledger = Path(path)
    ledger.parent.mkdir(parents=True, exist_ok=True)
    totals = {actor: 0.0 for actor in REWARD_BENEFICIARIES}

    with ledger.open("a", encoding="utf-8") as handle:
        for reward in rewards:
            if not reward.rewardable and not include_zero_score_observations:
                continue
            row = {
                "ts": dt.datetime.now(dt.timezone.utc).isoformat(),
                **dataclasses.asdict(reward),
            }
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            totals[reward.beneficiary] += reward.score
    return totals


def learn_from_guard_observations(
    observations: Iterable[Any],
    *,
    state_dir: str | Path,
    beneficiaries: Sequence[str] = REWARD_BENEFICIARIES,
) -> dict[str, Any]:
    """Convert observations into a shared persistent learning signal."""
    rewards = rewards_from_observations(observations, beneficiaries=beneficiaries)
    ledger = Path(state_dir) / "guard_resilience_rewards.ndjson"
    totals = append_reward_ledger(ledger, rewards)
    return {
        "ledger": str(ledger),
        "events": len(rewards),
        "rewardable_events": sum(1 for reward in rewards if reward.rewardable),
        "totals": totals,
        "training_principle": TRAINING_PRINCIPLE,
    }
