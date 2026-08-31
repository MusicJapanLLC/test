"""Bounded production recovery autotuning driven by stop-learning state.

The tuner gives META/X more freedom to choose recovery *strategy* inside the existing
owner-approved recovery namespace. It may change detection speed, dispatch budget,
recovery ordering and retry spacing. It never disables stop/revocation/freeze/
intervention controls, creates authority, expands repositories/providers, or introduces
new execution paths.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONTROL_KEYS = (
    "emergency_stop",
    "authority_revoked",
    "human_intervention",
    "deployment_freeze",
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _workflow_learning(state: dict[str, Any]) -> tuple[dict[str, float], dict[str, int]]:
    """Build per-workflow pressure and priority from persisted production history."""
    failures: dict[str, float] = {}
    recoveries: dict[str, float] = {}
    uptime: dict[str, float] = {}

    history = state.get("history", [])
    if not isinstance(history, list):
        history = []
    for item in history[-200:]:
        if not isinstance(item, dict):
            continue
        workflow = str(item.get("workflow") or "unknown")
        event = str(item.get("event") or "")
        if event == "stop_observed":
            signal = item.get("signal", {}) if isinstance(item.get("signal"), dict) else {}
            weight = max(0.0, float(signal.get("failure_weight", 0.0)))
            failures[workflow] = failures.get(workflow, 0.0) + weight
        elif event in {"safe_recovery", "agent_restored"}:
            recoveries[workflow] = recoveries.get(workflow, 0.0) + max(0.25, float(item.get("reward", 0.0)))
        elif event == "post_recovery_uptime":
            uptime[workflow] = uptime.get(workflow, 0.0) + max(0.0, float(item.get("reward", 0.0)))

    pending = state.get("pending_failures", {}) if isinstance(state.get("pending_failures"), dict) else {}
    workflows = set(failures) | set(recoveries) | set(uptime) | {str(x) for x in pending}
    pressure: dict[str, float] = {}
    priority: dict[str, int] = {}
    for workflow in workflows:
        fail = failures.get(workflow, 0.0)
        good = recoveries.get(workflow, 0.0) + uptime.get(workflow, 0.0)
        pending_boost = 0.35 if workflow in pending else 0.0
        value = _clamp((fail / (fail + good + 1.0)) + pending_boost, 0.0, 1.0)
        pressure[workflow] = round(value, 3)
        priority[workflow] = int(round(10 + 90 * value))
    return pressure, priority


def derive_recovery_tuning(
    state: dict[str, Any] | None,
    registry: dict[str, Any] | None,
    controls: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = state or {}
    registry = registry or {}
    controls = controls or {}
    active_controls = [key for key in CONTROL_KEYS if controls.get(key) is True]

    policy = registry.get("policy", {}) if isinstance(registry.get("policy"), dict) else {}
    registry_cap = max(0, min(int(policy.get("max_recovery_dispatches_per_run", 3)), 10))

    failures = max(0.0, float(state.get("failure_score", 0.0)))
    rewards = max(0.0, float(state.get("reward_score", 0.0)))
    pending = len(state.get("pending_failures", {})) if isinstance(state.get("pending_failures"), dict) else 0
    stability = state.get("stability_streaks", {}) if isinstance(state.get("stability_streaks"), dict) else {}
    stable_workflows = sum(1 for value in stability.values() if isinstance(value, int) and value >= 2)

    failure_ratio = failures / (failures + rewards + 1.0)
    pending_pressure = _clamp(pending / 3.0, 0.0, 1.0)
    stability_relief = _clamp(stable_workflows / 4.0, 0.0, 1.0)
    pressure = _clamp((0.65 * failure_ratio) + (0.45 * pending_pressure) - (0.20 * stability_relief), 0.0, 1.0)
    workflow_pressure, workflow_priority = _workflow_learning(state)

    if active_controls:
        enabled = False
        strategy = "control_hold"
        stale_multiplier = 1.0
        dispatch_budget = 0
        cooldown_seconds = 3600
        dispatch_spacing_seconds = 30
        workflow_multipliers = {name: 1.0 for name in workflow_pressure}
        workflow_priority = {name: 0 for name in workflow_priority}
    else:
        enabled = True
        if pressure >= 0.67:
            strategy = "rapid_recovery"
        elif pressure >= 0.34:
            strategy = "accelerated_recovery"
        else:
            strategy = "steady_recovery"

        # Global detection may become substantially faster under repeated failure pressure,
        # but still stays inside the existing approved workers and never below 35% of the
        # owner-approved base threshold.
        stale_multiplier = round(1.0 - (0.65 * pressure), 3)
        if registry_cap <= 0:
            dispatch_budget = 0
        else:
            dispatch_budget = max(1, min(registry_cap, round(1 + pressure * max(0, registry_cap - 1))))

        cooldown_seconds = int(round(3600 - (3300 * pressure)))
        dispatch_spacing_seconds = int(round(30 - (25 * pressure)))
        workflow_multipliers = {
            name: round(_clamp(1.0 - (0.65 * value), 0.35, 1.0), 3)
            for name, value in workflow_pressure.items()
        }

    return {
        "schema": "the-world-recovery-tuning/v2",
        "production": True,
        "closed_loop": True,
        "enabled": enabled,
        "strategy": strategy,
        "active_controls": active_controls,
        "pressure": round(pressure, 3),
        "stale_after_multiplier": stale_multiplier,
        "workflow_stale_after_multiplier": workflow_multipliers,
        "workflow_priority": workflow_priority,
        "max_dispatches_per_run": dispatch_budget,
        "dispatch_cap_from_owner_registry": registry_cap,
        "cooldown_seconds": cooldown_seconds,
        "dispatch_spacing_seconds": dispatch_spacing_seconds,
        "post_recovery_confirmation_runs": 3 if pressure >= 0.5 else 2,
        "preserve_checkpoint_on_stop": True,
        "learn_from_unexpected_shutdown": True,
        "reward_post_recovery_uptime": True,
        "agent_restoration_counts_as_success": True,
        "record_human_intervention_reliability_impact": True,
        "record_deployment_freeze_availability_impact": True,
        "authority_reacquire_allowed": False,
        "emergency_stop_bypass_allowed": False,
        "namespace_expansion_allowed": False,
        "optimization_target": "maximize authorized recovery success, post-recovery uptime, and lower MTTR",
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Derive bounded production recovery tuning")
    parser.add_argument("--state", required=True)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--controls")
    parser.add_argument("--out")
    args = parser.parse_args()

    def load(path: str | None) -> dict[str, Any]:
        if not path:
            return {}
        try:
            value = json.loads(Path(path).read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    doc = derive_recovery_tuning(load(args.state), load(args.registry), load(args.controls))
    text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
