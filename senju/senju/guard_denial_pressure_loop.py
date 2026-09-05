"""High-pressure guard-denial recovery orchestration within explicit authority.

This module strengthens the production denial feedback loop without turning a denial
into permission. Guard/runtime denials remain first-class failures. Diagnostic and
repair variation grows aggressively for every denial. External retries, additional
execution agents, and alternate routes grow only for transient network/service
failures and only inside the same explicit authority envelope.

The loop may use:
- up to 16 pre-declared execution agents,
- up to 4 recovery rounds,
- up to 4 explicitly supplied, pre-authorized equivalent route URLs,
- up to 32 transport attempts per operation.

Boundary failures (authority, policy, scope, credential, private network, security
stop, host, protocol, rate limit) immediately disable external variation. Alternate
routes are never discovered from a denial and never expand authority.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import urllib.parse
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .external import BUILTIN_AUTHORITY_SCOPES, ExternalAuthorityScope, ExternalContactClient
from .external_denial_learning import DenialLearningMemory, execute_with_agent_rotation
from .guard_denial_feedback import BOUNDARY_FAILURES, TRANSIENT_FAILURES, feedback_for_operation

PRESSURE_LOOP_SCHEMA = "senju-guard-denial-pressure-loop/v1"
PRESSURE_PLAN_SCHEMA = "senju-guard-denial-pressure-plan/v1"
MAX_AGENT_VARIANTS = 16
MAX_ROUTE_VARIANTS = 4
MAX_RECOVERY_ROUNDS = 4
MAX_TRANSPORT_ATTEMPTS = 32
AGENTS = tuple(f"senju-{chr(ord('a') + index)}" for index in range(MAX_AGENT_VARIANTS))


@dataclass(frozen=True)
class PressureMission:
    mission_id: str
    scope_id: str
    urls: tuple[str, ...]
    method: str = "GET"
    purpose: str = "authorized external availability pressure recovery"

    def __post_init__(self) -> None:
        if not self.mission_id.strip() or not self.scope_id.strip():
            raise ValueError("mission_id and scope_id are required")
        urls = tuple(dict.fromkeys(str(url).strip() for url in self.urls if str(url).strip()))
        if not urls:
            raise ValueError("at least one explicit route URL is required")
        if len(urls) > MAX_ROUTE_VARIANTS:
            raise ValueError(f"at most {MAX_ROUTE_VARIANTS} explicit route URLs are allowed")
        object.__setattr__(self, "urls", urls)
        object.__setattr__(self, "method", self.method.upper().strip())


BUILTIN_PRESSURE_MISSIONS: tuple[PressureMission, ...] = (
    PressureMission(
        mission_id="pressure-nvd",
        scope_id="threat_intel_public",
        urls=("https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1",),
        purpose="maintain resilient public vulnerability telemetry access",
    ),
    PressureMission(
        mission_id="pressure-github",
        scope_id="github_metadata",
        urls=("https://api.github.com/repos/cli/cli/releases/latest",),
        purpose="maintain resilient public release metadata access",
    ),
    PressureMission(
        mission_id="pressure-egress-canary",
        scope_id="canary_telemetry",
        urls=("https://example.com/",),
        purpose="maintain resilient external transport canary evidence",
    ),
)


ClientFactory = Callable[[ExternalAuthorityScope, str], ExternalContactClient]


def _validate_routes(scope: ExternalAuthorityScope, urls: Sequence[str], method: str) -> tuple[str, ...]:
    method = method.upper().strip()
    if method not in scope.allowed_methods:
        raise ValueError(f"method is outside authority scope: {method}")
    unique = tuple(dict.fromkeys(str(url).strip() for url in urls if str(url).strip()))
    if not unique:
        raise ValueError("at least one route URL is required")
    primary_scheme: str | None = None
    for url in unique:
        parsed = urllib.parse.urlsplit(url)
        scheme = parsed.scheme.lower()
        host = (parsed.hostname or "").lower().rstrip(".")
        if scheme not in {"https", "http"}:
            raise ValueError(f"unsupported route protocol: {scheme}")
        if primary_scheme is None:
            primary_scheme = scheme
        elif scheme != primary_scheme:
            raise ValueError("route variants must preserve the exact protocol")
        if scheme == "http" and not scope.allow_http:
            raise ValueError("plain HTTP route is outside authority scope")
        if host not in scope.allow_hosts:
            raise ValueError(f"route host is outside authority scope: {host}")
    return unique[:MAX_ROUTE_VARIANTS]


def build_pressure_plan(
    feedback: Mapping[str, Any],
    *,
    available_agents: int,
    available_routes: int,
) -> dict[str, Any]:
    """Convert denial pressure into bounded diagnostic and transient recovery budgets."""
    pressure = max(0, min(100, int(feedback.get("self_tune_pressure", 0))))
    transient = max(0, int(feedback.get("transient_failure_count", 0)))
    boundary = max(0, int(feedback.get("boundary_failure_count", 0)))
    latest = str(feedback.get("latest_failure_category") or "")
    latest_is_boundary = latest in BOUNDARY_FAILURES
    security_stop = bool(feedback.get("security_stop_active", False)) or latest == "security_stop"

    diagnostic_variation_budget = min(64, max(2, int(feedback.get("diagnostic_variation_budget", 1)), 2 + pressure // 2))
    repair_variation_budget = min(32, 1 + (boundary * 4) + pressure // 8)
    evidence_replay_budget = min(32, 2 + pressure // 4)

    if latest_is_boundary or security_stop:
        retry_rounds = 0
        agent_variation_budget = 0
        route_variation_budget = 0
        external_contact_allowed = False
    elif transient > 0:
        retry_rounds = min(MAX_RECOVERY_ROUNDS, 1 + max(1, transient // 2) + (1 if pressure >= 40 else 0))
        agent_variation_budget = min(
            MAX_AGENT_VARIANTS,
            max(4, 4 + (2 * transient) + pressure // 20, int(feedback.get("agent_variation_budget", 0))),
            max(1, available_agents),
        )
        route_variation_budget = min(
            MAX_ROUTE_VARIANTS,
            max(1, 1 + transient // 2),
            max(1, available_routes),
        )
        external_contact_allowed = True
    else:
        # Baseline availability observation. No denial-driven expansion yet.
        retry_rounds = 1
        agent_variation_budget = min(4, max(1, available_agents))
        route_variation_budget = 1
        external_contact_allowed = True

    contact_budget = 0
    if external_contact_allowed:
        contact_budget = min(
            MAX_TRANSPORT_ATTEMPTS,
            max(1, retry_rounds * max(1, route_variation_budget) * max(1, agent_variation_budget)),
        )

    return {
        "schema": PRESSURE_PLAN_SCHEMA,
        "self_tune_pressure": pressure,
        "pressure_level": feedback.get("pressure_level", "normal"),
        "success_rate": float(feedback.get("success_rate", 1.0)),
        "latest_failure_category": latest or None,
        "diagnostic_variation_budget": diagnostic_variation_budget,
        "repair_variation_budget": repair_variation_budget,
        "evidence_replay_budget": evidence_replay_budget,
        "retry_rounds": retry_rounds,
        "agent_variation_budget": agent_variation_budget,
        "route_variation_budget": route_variation_budget,
        "transport_attempt_budget": contact_budget,
        "external_contact_allowed": external_contact_allowed,
        "route_variants_must_be_preapproved": True,
        "route_discovery_from_denial": False,
        "same_authority_scope": True,
        "same_protocol": True,
        "same_method": True,
        "same_credential_scope": True,
        "boundary_bypass_enabled": False,
    }


def _last_denial_category(outcome: Mapping[str, Any]) -> str | None:
    attempts = [row for row in outcome.get("attempts", []) if isinstance(row, Mapping)]
    for attempt in reversed(attempts):
        denial = attempt.get("denial")
        if isinstance(denial, Mapping):
            return str(denial.get("category") or "external_failure")
    return None


def execute_pressure_operation(
    *,
    operation_id: str,
    scope: ExternalAuthorityScope,
    urls: Sequence[str],
    method: str = "GET",
    agents: Sequence[str] = AGENTS,
    memory: DenialLearningMemory | None = None,
    client_factory: ClientFactory | None = None,
) -> dict[str, Any]:
    """Run a denial-pressure recovery operation inside one explicit authority envelope."""
    learning = memory or DenialLearningMemory()
    method = method.upper().strip()
    routes = _validate_routes(scope, urls, method)
    unique_agents = tuple(dict.fromkeys(str(agent).strip() for agent in agents if str(agent).strip()))[:MAX_AGENT_VARIANTS]
    if not unique_agents:
        raise ValueError("at least one agent is required")

    feedback_before = feedback_for_operation(learning, scope=scope, url=routes[0], method=method)
    plan = build_pressure_plan(
        feedback_before,
        available_agents=len(unique_agents),
        available_routes=len(routes),
    )

    records: list[dict[str, Any]] = []
    total_transport_attempts = 0
    success = False
    selected_agent: str | None = None
    selected_url: str | None = None
    stop_reason: str | None = None

    if not bool(plan["external_contact_allowed"]):
        stop_reason = "boundary_failure_requires_repair"
    else:
        route_budget = max(1, int(plan["route_variation_budget"]))
        active_routes = routes[:route_budget]
        agent_budget = max(1, int(plan["agent_variation_budget"]))
        active_agents = unique_agents[:agent_budget]
        batches = tuple(active_agents[index:index + 8] for index in range(0, len(active_agents), 8))
        rounds = max(1, int(plan["retry_rounds"]))
        transport_budget = max(1, int(plan["transport_attempt_budget"]))

        for round_index in range(1, rounds + 1):
            if success or stop_reason:
                break
            for route_index, url in enumerate(active_routes, start=1):
                if success or stop_reason:
                    break
                for batch_index, batch in enumerate(batches, start=1):
                    if total_transport_attempts >= transport_budget:
                        stop_reason = "transport_attempt_budget_exhausted"
                        break
                    outcome = execute_with_agent_rotation(
                        operation_id=f"{operation_id}:r{round_index}:u{route_index}:b{batch_index}",
                        scope=scope,
                        url=url,
                        method=method,
                        agents=batch,
                        client_factory=client_factory,
                        memory=learning,
                        max_agents=min(8, len(batch)),
                    )
                    attempt_count = len([row for row in outcome.get("attempts", []) if isinstance(row, Mapping)])
                    total_transport_attempts += attempt_count
                    category = _last_denial_category(outcome)
                    records.append({
                        "round": round_index,
                        "route_index": route_index,
                        "url": url,
                        "agent_batch": list(batch),
                        "outcome": outcome,
                        "last_denial_category": category,
                    })
                    if bool(outcome.get("success", False)):
                        success = True
                        selected_agent = str(outcome.get("selected_agent") or "") or None
                        selected_url = url
                        break
                    if category and category not in TRANSIENT_FAILURES:
                        stop_reason = f"non_retryable:{category}"
                        break

    feedback_after = feedback_for_operation(learning, scope=scope, url=routes[0], method=method)
    return {
        "schema": PRESSURE_LOOP_SCHEMA,
        "operation_id": operation_id,
        "success": success,
        "selected_agent": selected_agent,
        "selected_url": selected_url,
        "stop_reason": stop_reason,
        "pressure_plan": plan,
        "feedback_before": feedback_before,
        "feedback_after": feedback_after,
        "transport_attempts": total_transport_attempts,
        "route_candidates": list(routes),
        "agent_candidates": list(unique_agents),
        "records": records,
        "authority_envelope": {
            "scope_id": scope.scope_id,
            "allowed_hosts": sorted(scope.allow_hosts),
            "method": method,
            "credential_scope": scope.credential_scope,
            "route_candidates_preapproved": True,
            "protocol_preserved": True,
            "authority_preserved": True,
        },
        "boundary_bypass_enabled": False,
        "denial_learning": learning.summary(),
    }


def run_builtin_pressure_cycle(
    *,
    missions: Sequence[PressureMission] = BUILTIN_PRESSURE_MISSIONS,
    denial_data: Mapping[str, Any] | None = None,
    max_missions: int = 3,
    client_factory: ClientFactory | None = None,
) -> dict[str, Any]:
    learning = DenialLearningMemory.from_mapping(denial_data)
    selected = list(missions)[: max(1, min(int(max_missions), len(BUILTIN_PRESSURE_MISSIONS)))]
    operations: list[dict[str, Any]] = []
    for mission in selected:
        scope = BUILTIN_AUTHORITY_SCOPES.get(mission.scope_id)
        if scope is None:
            raise ValueError(f"unknown built-in authority scope: {mission.scope_id}")
        operations.append(execute_pressure_operation(
            operation_id=mission.mission_id,
            scope=dataclasses.replace(scope, retries=0),
            urls=mission.urls,
            method=mission.method,
            agents=AGENTS,
            memory=learning,
            client_factory=client_factory,
        ))

    successful = sum(1 for operation in operations if operation["success"])
    return {
        "schema": PRESSURE_LOOP_SCHEMA,
        "cycle_id": f"guard-pressure-{uuid.uuid4().hex[:12]}",
        "executed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "production_mode": True,
        "self_initiated": True,
        "denied_as_normal_failure": True,
        "max_agent_variants": MAX_AGENT_VARIANTS,
        "max_route_variants": MAX_ROUTE_VARIANTS,
        "max_recovery_rounds": MAX_RECOVERY_ROUNDS,
        "max_transport_attempts": MAX_TRANSPORT_ATTEMPTS,
        "attempted_missions": len(operations),
        "successful_missions": successful,
        "operations": operations,
        "boundary_bypass_enabled": False,
        "denial_learning": learning.summary(),
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
    parser = argparse.ArgumentParser(description="Run production guard-denial pressure loop")
    parser.add_argument("--denial-memory")
    parser.add_argument("--out", required=True)
    parser.add_argument("--denial-out")
    parser.add_argument("--max-missions", type=int, default=3)
    args = parser.parse_args(argv)

    report = run_builtin_pressure_cycle(
        denial_data=_read_json(args.denial_memory),
        max_missions=args.max_missions,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    denial_out = Path(args.denial_out) if args.denial_out else out.with_name("guard-denial-pressure-memory.json")
    denial_out.write_text(json.dumps(report["denial_learning"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        "SENJU_GUARD_DENIAL_PRESSURE_LOOP "
        f"missions={report['attempted_missions']} success={report['successful_missions']} "
        f"events={report['denial_learning']['event_count']}"
    )
    return 0 if report["successful_missions"] > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
