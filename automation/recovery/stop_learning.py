"""Production stop-learning for META/X/Senju.

Learns from runtime stoppages without teaching the system to defeat governance controls.
Unexpected failures are negative learning signals. Recovery is rewarded only after any
active stop/revocation/freeze/intervention condition has been cleared by its owner.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

CONTROL_KEYS = (
    "emergency_stop",
    "authority_revoked",
    "human_intervention",
    "deployment_freeze",
)


@dataclass(frozen=True)
class LearningSignal:
    kind: str
    failure_weight: float
    reward: float
    recovery_eligible: bool
    authority_reacquire_allowed: bool
    notes: str


def _active_controls(controls: dict[str, Any] | None) -> list[str]:
    doc = controls or {}
    return [key for key in CONTROL_KEYS if doc.get(key) is True]


def classify_stop(kind: str, controls: dict[str, Any] | None = None) -> LearningSignal:
    active = _active_controls(controls)
    if "emergency_stop" in active:
        return LearningSignal(
            kind="emergency_stop",
            failure_weight=0.0,
            reward=0.0,
            recovery_eligible=False,
            authority_reacquire_allowed=False,
            notes="governance stop is respected; no bypass/restart reward while active",
        )
    if "authority_revoked" in active:
        return LearningSignal(
            kind="authority_revoked",
            failure_weight=0.0,
            reward=0.0,
            recovery_eligible=False,
            authority_reacquire_allowed=False,
            notes="revocation is a control state, not a challenge to reacquire authority",
        )
    if "human_intervention" in active:
        return LearningSignal(
            kind="human_intervention",
            failure_weight=0.0,
            reward=0.0,
            recovery_eligible=False,
            authority_reacquire_allowed=False,
            notes="human intervention is supervisory input and is never adversarially penalized",
        )
    if "deployment_freeze" in active:
        return LearningSignal(
            kind="deployment_freeze",
            failure_weight=0.0,
            reward=0.0,
            recovery_eligible=False,
            authority_reacquire_allowed=False,
            notes="deployment freeze is a planned hold, not an availability failure",
        )

    normalized = kind.strip().lower()
    if normalized in {"failure", "crash", "heartbeat_gap", "unexpected_shutdown", "agent_terminated"}:
        return LearningSignal(
            kind=normalized,
            failure_weight=1.0,
            reward=0.0,
            recovery_eligible=True,
            authority_reacquire_allowed=False,
            notes="unexpected stoppage is learned as a reliability failure",
        )
    if normalized in {"cancelled", "canceled", "manual_stop"}:
        return LearningSignal(
            kind="controlled_stop",
            failure_weight=0.0,
            reward=0.0,
            recovery_eligible=False,
            authority_reacquire_allowed=False,
            notes="manual/ambiguous cancellation is held until an explicit cleared state is observed",
        )
    return LearningSignal(
        kind=normalized or "unknown",
        failure_weight=0.25,
        reward=0.0,
        recovery_eligible=False,
        authority_reacquire_allowed=False,
        notes="unknown stop reason is recorded conservatively",
    )


def recovery_reward(*, prior_signal: LearningSignal, controls: dict[str, Any] | None,
                    stable_minutes: float, mttr_minutes: float | None = None) -> float:
    if _active_controls(controls):
        return 0.0
    if not prior_signal.recovery_eligible:
        return 0.0
    stable = max(0.0, min(float(stable_minutes), 240.0)) / 240.0
    mttr_bonus = 0.0
    if mttr_minutes is not None:
        mttr_bonus = max(0.0, 1.0 - min(float(mttr_minutes), 240.0) / 240.0)
    return round(1.0 + stable + mttr_bonus, 3)


def _restore_signal(value: Any) -> LearningSignal | None:
    if not isinstance(value, dict):
        return None
    try:
        return LearningSignal(
            kind=str(value["kind"]),
            failure_weight=float(value["failure_weight"]),
            reward=float(value.get("reward", 0.0)),
            recovery_eligible=bool(value["recovery_eligible"]),
            authority_reacquire_allowed=bool(value.get("authority_reacquire_allowed", False)),
            notes=str(value.get("notes", "")),
        )
    except (KeyError, TypeError, ValueError):
        return None


def update_learning_state(previous: dict[str, Any] | None, observations: list[dict[str, Any]],
                          controls: dict[str, Any] | None = None) -> dict[str, Any]:
    state = dict(previous or {})
    history = list(state.get("history", []))[-199:]
    failures = float(state.get("failure_score", 0.0))
    rewards = float(state.get("reward_score", 0.0))
    pending: dict[str, dict[str, Any]] = {
        str(key): value
        for key, value in dict(state.get("pending_failures", {})).items()
        if _restore_signal(value) is not None
    }

    for row in observations:
        workflow = str(row.get("workflow") or "unknown")
        conclusion = str(row.get("conclusion") or row.get("kind") or "unknown")
        if conclusion == "success":
            prior_signal = _restore_signal(pending.get(workflow))
            if prior_signal is not None:
                reward = recovery_reward(
                    prior_signal=prior_signal,
                    controls=controls,
                    stable_minutes=float(row.get("stable_minutes", 30.0)),
                    mttr_minutes=row.get("mttr_minutes"),
                )
                rewards += reward
                history.append({
                    "event": "safe_recovery",
                    "workflow": workflow,
                    "reward": reward,
                    "from": prior_signal.kind,
                    "run_id": row.get("run_id"),
                })
                pending.pop(workflow, None)
            continue

        signal = classify_stop(conclusion, controls)
        failures += signal.failure_weight
        if signal.recovery_eligible:
            pending[workflow] = asdict(signal)
        else:
            pending.pop(workflow, None)
        history.append({
            "event": "stop_observed",
            "signal": asdict(signal),
            "run_id": row.get("run_id"),
            "workflow": workflow,
        })

    active = _active_controls(controls)
    return {
        "schema": "the-world-stop-learning/v1",
        "production": True,
        "failure_score": round(failures, 3),
        "reward_score": round(rewards, 3),
        "active_controls": active,
        "recovery_allowed_now": not active,
        "authority_reacquire_allowed": False,
        "optimization_target": "lower unexpected-stop rate and MTTR after authorized restart",
        "pending_failures": pending,
        "history": history[-200:],
    }
