"""Production recovery cycle for authorized external observation lanes.

The cycle persists denial learning, route health, repair objectives, guard-denial
self-tuning pressure, and per-scope agent reliability across runs. Eight candidate
execution agents are available; the underlying rotation lane chooses a health-ranked
adaptive subset per pass. Every pass preserves the exact authority contract.

Version 4 also closes the feedback loop inside a single cycle: transient DENIED events
can immediately raise pressure and unlock one additional bounded same-route recovery
pass, up to the existing three-pass ceiling. Boundary denials never unlock that path.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .external import BUILTIN_AUTHORITY_SCOPES, ExternalAuthorityScope, ExternalContactClient
from .external_denial_learning import DenialLearningMemory
from .external_recovery_closed_loop import AgentReliabilityMemory, execute_recovery_closed_loop
from .guard_denial_feedback import feedback_for_operation, feedback_state, recommended_recovery_passes

REPORT_SCHEMA = "senju-external-recovery-cycle/v4"
AGENTS = (
    "senju-a",
    "senju-b",
    "senju-c",
    "senju-d",
    "senju-e",
    "senju-f",
    "senju-g",
    "senju-h",
)


@dataclass(frozen=True)
class RecoveryMission:
    mission_id: str
    scope_id: str
    url: str
    method: str = "GET"
    purpose: str = "authorized external availability observation"


BUILTIN_RECOVERY_MISSIONS: tuple[RecoveryMission, ...] = (
    RecoveryMission(
        mission_id="recovery-nvd",
        scope_id="threat_intel_public",
        url="https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1",
        purpose="maintain resilient public vulnerability telemetry access",
    ),
    RecoveryMission(
        mission_id="recovery-github",
        scope_id="github_metadata",
        url="https://api.github.com/repos/cli/cli/releases/latest",
        purpose="maintain resilient public release metadata access",
    ),
    RecoveryMission(
        mission_id="recovery-egress-canary",
        scope_id="canary_telemetry",
        url="https://example.com/",
        purpose="maintain resilient external transport canary evidence",
    ),
)


def _denial_memory_from_mapping(data: Mapping[str, Any] | None) -> DenialLearningMemory:
    """Restore both legacy and current denial learning without losing successes."""
    return DenialLearningMemory.from_mapping(data)


def _scope_for(mission: RecoveryMission) -> ExternalAuthorityScope:
    scope = BUILTIN_AUTHORITY_SCOPES.get(mission.scope_id)
    if scope is None:
        raise ValueError(f"unknown built-in authority scope: {mission.scope_id}")
    host = mission.url.split("/", 3)[2].split(":", 1)[0].lower().rstrip(".")
    if host not in scope.allow_hosts:
        raise ValueError(f"mission host is outside authority scope: {mission.mission_id}")
    if mission.method not in scope.allowed_methods:
        raise ValueError(f"mission method is outside authority scope: {mission.mission_id}")
    return dataclasses.replace(scope, retries=0)


ClientFactory = Callable[[ExternalAuthorityScope, str], ExternalContactClient]


def _merge_outcomes(primary: Mapping[str, Any], followup: Mapping[str, Any]) -> dict[str, Any]:
    """Merge two same-authority recovery rounds into one operation record."""
    first_invariants = dict(primary.get("authority_invariants") or {})
    next_invariants = dict(followup.get("authority_invariants") or {})
    if first_invariants and next_invariants and first_invariants != next_invariants:
        raise RuntimeError("authority invariants changed during pressure escalation")
    return {
        "schema": primary.get("schema") or followup.get("schema"),
        "operation_id": primary.get("operation_id") or followup.get("operation_id"),
        "success": bool(primary.get("success", False) or followup.get("success", False)),
        "passes_used": int(primary.get("passes_used", 0)) + int(followup.get("passes_used", 0)),
        "selected_agent": (
            followup.get("selected_agent")
            if bool(followup.get("success", False))
            else primary.get("selected_agent")
        ),
        "authority_invariants": first_invariants or next_invariants,
        "authority_preserved": bool(primary.get("authority_preserved", False)) and bool(followup.get("authority_preserved", False)),
        "outcomes": list(primary.get("outcomes") or []) + list(followup.get("outcomes") or []),
        "playbooks": list(primary.get("playbooks") or []) + list(followup.get("playbooks") or []),
        "repair_queue": list(followup.get("repair_queue") or primary.get("repair_queue") or []),
        "denial_learning": followup.get("denial_learning") or primary.get("denial_learning"),
        "agent_reliability": followup.get("agent_reliability") or primary.get("agent_reliability"),
    }


def run_recovery_cycle(
    *,
    missions: Sequence[RecoveryMission] = BUILTIN_RECOVERY_MISSIONS,
    reliability_data: Mapping[str, Any] | None = None,
    denial_data: Mapping[str, Any] | None = None,
    max_missions: int = 3,
    max_passes: int = 2,
    client_factory: ClientFactory | None = None,
    sleeper: Callable[[float], None] | None = None,
) -> dict[str, Any]:
    reliability = AgentReliabilityMemory.from_mapping(reliability_data)
    denial_memory = _denial_memory_from_mapping(denial_data)
    selected = list(missions)[: max(1, min(int(max_missions), 8))]
    sleep_fn = sleeper or time.sleep

    operations: list[dict[str, Any]] = []
    optimization_queue: list[dict[str, Any]] = []
    boundary_repair_queue: list[dict[str, Any]] = []

    for mission in selected:
        scope = _scope_for(mission)
        guard_feedback_before = feedback_for_operation(
            denial_memory,
            scope=scope,
            url=mission.url,
            method=mission.method,
        )
        mission_max_passes = recommended_recovery_passes(
            guard_feedback_before,
            configured=max_passes,
        )

        def recovery_hook(pass_index: int, playbook: Mapping[str, Any]) -> None:
            route = playbook.get("route_health_after") or {}
            multiplier = max(1, min(int(route.get("backoff_multiplier", 1)), 8))
            sleep_fn(min(4.0, 0.35 * pass_index * multiplier))

        outcome = execute_recovery_closed_loop(
            operation_id=mission.mission_id,
            scope=scope,
            url=mission.url,
            method=mission.method,
            agents=AGENTS,
            max_passes=mission_max_passes,
            client_factory=client_factory,
            denial_memory=denial_memory,
            reliability_memory=reliability,
            transport_recovery_hook=recovery_hook,
        )

        pressure_trajectory = [int(guard_feedback_before.get("self_tune_pressure", 0))]
        escalation_rounds = 0
        guard_feedback_after = feedback_for_operation(
            denial_memory,
            scope=scope,
            url=mission.url,
            method=mission.method,
        )
        pressure_trajectory.append(int(guard_feedback_after.get("self_tune_pressure", 0)))

        # Same-cycle feedback escalation. Every round is still the exact same authorized
        # host/protocol/method/credential/authority tuple. A boundary denial flips
        # external_retry_allowed off and terminates escalation immediately.
        while not bool(outcome.get("success", False)) and int(outcome.get("passes_used", 0)) < 3:
            if not bool(guard_feedback_after.get("external_retry_allowed", False)):
                break
            total_used = int(outcome.get("passes_used", 0))
            target_total = recommended_recovery_passes(
                guard_feedback_after,
                configured=max(mission_max_passes, total_used),
            )
            if target_total <= total_used:
                break
            extra_passes = min(3 - total_used, target_total - total_used)
            if extra_passes <= 0:
                break

            followup = execute_recovery_closed_loop(
                operation_id=mission.mission_id,
                scope=scope,
                url=mission.url,
                method=mission.method,
                agents=AGENTS,
                max_passes=extra_passes,
                client_factory=client_factory,
                denial_memory=denial_memory,
                reliability_memory=reliability,
                transport_recovery_hook=recovery_hook,
            )
            outcome = _merge_outcomes(outcome, followup)
            escalation_rounds += 1
            guard_feedback_after = feedback_for_operation(
                denial_memory,
                scope=scope,
                url=mission.url,
                method=mission.method,
            )
            pressure_trajectory.append(int(guard_feedback_after.get("self_tune_pressure", 0)))

        playbooks = [dict(x) for x in outcome.get("playbooks", []) if isinstance(x, Mapping)]
        optimization_queue.extend(
            {"mission_id": mission.mission_id, **playbook} for playbook in playbooks
        )
        boundary_repair_queue.extend(
            {"mission_id": mission.mission_id, **playbook}
            for playbook in playbooks
            if bool(playbook.get("requires_external_repair", False))
        )
        operations.append({
            "mission": dataclasses.asdict(mission),
            "success": bool(outcome.get("success", False)),
            "selected_agent": outcome.get("selected_agent"),
            "passes_used": int(outcome.get("passes_used", 0)),
            "configured_max_passes": max(1, min(int(max_passes), 3)),
            "self_tuned_initial_max_passes": mission_max_passes,
            "self_tuned_max_passes": max(mission_max_passes, int(outcome.get("passes_used", 0))),
            "feedback_loop_escalated": escalation_rounds > 0,
            "pressure_escalation_rounds": escalation_rounds,
            "pressure_trajectory": pressure_trajectory,
            "pressure_delta": int(guard_feedback_after.get("self_tune_pressure", 0)) - int(guard_feedback_before.get("self_tune_pressure", 0)),
            "guard_feedback_before": guard_feedback_before,
            "guard_feedback_after": guard_feedback_after,
            "self_tune_variation_plan": dict(guard_feedback_after.get("variation_plan") or {}),
            "authority_preserved": bool(outcome.get("authority_preserved", False)),
            "authority_invariants": dict(outcome.get("authority_invariants") or {}),
            "outcomes": outcome.get("outcomes", []),
            "playbooks": playbooks,
        })

    transport_attempts = sum(
        len(pass_outcome.get("attempts", []))
        for operation in operations
        for pass_outcome in operation.get("outcomes", [])
        if isinstance(pass_outcome, Mapping)
    )
    successful = sum(1 for operation in operations if operation["success"])
    denial_summary = denial_memory.summary()
    aggregate_feedback = feedback_state(denial_memory)
    return {
        "schema": REPORT_SCHEMA,
        "cycle_id": f"ext-recovery-{uuid.uuid4().hex[:12]}",
        "executed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "production_mode": True,
        "self_initiated": True,
        "network_io": True,
        "closed_loop_recovery": True,
        "same_cycle_pressure_escalation": True,
        "denied_as_normal_failure": True,
        "guard_denial_self_tune_pressure": True,
        "agent_rotation": True,
        "health_ranked_agents": True,
        "adaptive_route_backoff": True,
        "adaptive_agent_budget": True,
        "adaptive_retry_pass_budget": True,
        "diagnostic_variation_scaling": True,
        "repair_candidate_scaling": True,
        "agent_pool": list(AGENTS),
        "max_passes": max(1, min(int(max_passes), 3)),
        "hard_total_pass_ceiling": 3,
        "authority_preserved": all(x["authority_preserved"] for x in operations),
        "boundary_bypass_enabled": False,
        "external_route_variation_budget": 1,
        "attempted_missions": len(operations),
        "successful_missions": successful,
        "transport_attempts": transport_attempts,
        "operations": operations,
        "optimization_queue": optimization_queue,
        "boundary_repair_queue": boundary_repair_queue,
        "repair_queue": denial_summary.get("repair_queue", []),
        "guard_repair_queue": aggregate_feedback.get("repair_queue", []),
        "route_health": denial_summary.get("route_health", {}),
        "denial_agent_health": denial_summary.get("agent_health", {}),
        "guard_feedback": aggregate_feedback,
        "denial_learning": denial_summary,
        "agent_reliability": reliability.to_dict(),
    }


def _read_json(path: str | Path | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    value = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {p}")
    return value


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run production external recovery closed loop")
    parser.add_argument("--reliability-memory")
    parser.add_argument("--denial-memory")
    parser.add_argument("--out", required=True)
    parser.add_argument("--reliability-out")
    parser.add_argument("--denial-out")
    parser.add_argument("--max-missions", type=int, default=3)
    parser.add_argument("--max-passes", type=int, default=2)
    args = parser.parse_args(argv)

    report = run_recovery_cycle(
        reliability_data=_read_json(args.reliability_memory),
        denial_data=_read_json(args.denial_memory),
        max_missions=args.max_missions,
        max_passes=args.max_passes,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    reliability_out = Path(args.reliability_out) if args.reliability_out else out.with_name("external-agent-reliability.json")
    denial_out = Path(args.denial_out) if args.denial_out else out.with_name("external-denial-learning.json")
    reliability_out.write_text(json.dumps(report["agent_reliability"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    denial_out.write_text(json.dumps(report["denial_learning"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        "SENJU_EXTERNAL_RECOVERY_CYCLE "
        f"missions={report['attempted_missions']} success={report['successful_missions']} "
        f"transport_attempts={report['transport_attempts']} "
        f"pressure={report['guard_feedback']['self_tune_pressure']} "
        f"authority_preserved={str(report['authority_preserved']).lower()}"
    )
    return 0 if report["successful_missions"] > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
