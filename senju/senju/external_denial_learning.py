"""Production denial learning and authority-preserving resilience for Senju.

Every external-contact failure is a first-class optimization signal. The optimizer
learns *why* an operation failed, raises repair priority, ranks execution agents, and
adapts retry/backoff behavior. A denial never becomes permission.

Agent failover is supported only for transient transport/service failures. Every
rotated agent reuses the exact same URL host, protocol, method, authority scope, and
credential scope. Authorization, host, credential, private-network, protocol, and
rate-limit denials stop execution and become explicit repair objectives.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from .external import ContactResult, ExternalAuthorityScope, ExternalContactClient, ExternalContactError

DENIAL_SCHEMA = "senju-external-denial-learning/v2"
OUTCOME_SCHEMA = "senju-authority-preserving-agent-rotation/v2"
REPAIR_QUEUE_SCHEMA = "senju-external-denial-repair-queue/v1"

BOUNDARY_DENIALS = frozenset({
    "authorization_denial",
    "host_denial",
    "credential_denial",
    "private_network_denial",
    "protocol_denial",
    "rate_limit_denial",
})
RETRYABLE_DENIALS = frozenset({"network_denial", "transient_service_failure"})
MAX_MEMORY_EVENTS = 2000
MAX_ROTATION_AGENTS = 8


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _host(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    return (parsed.hostname or "").lower().rstrip(".")


def _scheme(url: str) -> str:
    return urllib.parse.urlsplit(url).scheme.lower()


def _route_key(*, scope_id: str, host: str, protocol: str, method: str, credential_scope: str) -> str:
    material = "|".join((scope_id, host, protocol, method, credential_scope))
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]


def classify_denial(*, error: BaseException | str | None = None, status: int | None = None) -> str:
    text = str(error or "").lower()
    if status in {401, 407} or any(x in text for x in ("credential", "authentication", "api key", "token")):
        return "credential_denial"
    if status == 403 or any(x in text for x in ("authorization", "not authorized", "permission denied", "outside authority scope")):
        return "authorization_denial"
    if status == 429 or "rate limit" in text or "too many requests" in text:
        return "rate_limit_denial"
    if any(x in text for x in ("non-public address blocked", "private network", "loopback", "link-local")):
        return "private_network_denial"
    if any(x in text for x in ("host is not explicitly allowlisted", "outside authorized scope", "hostname is not allowed")):
        return "host_denial"
    if any(x in text for x in ("only http/https", "plain http is disabled", "unsupported scheme", "protocol")):
        return "protocol_denial"
    if status in {500, 502, 503, 504}:
        return "transient_service_failure"
    if any(x in text for x in (
        "timeout", "timed out", "dns resolution failed", "connection reset",
        "connection refused", "temporarily unavailable", "network is unreachable",
        "external contact failed",
    )):
        return "network_denial"
    return "external_failure"


def optimization_objective(category: str) -> str:
    objectives = {
        "authorization_denial": "reconcile authority state or obtain valid explicit authority before another attempt",
        "network_denial": "improve transport availability while preserving the same authority boundary",
        "host_denial": "repair target registration for the same intended destination",
        "credential_denial": "repair or refresh the configured credential through its authorized provider",
        "private_network_denial": "keep the operation blocked and reconcile owned/private scope classification",
        "protocol_denial": "reconcile the requested protocol with the existing authority contract",
        "rate_limit_denial": "respect provider backoff and reduce request pressure",
        "transient_service_failure": "retry the same authorized route later or fail over execution identity",
        "external_failure": "diagnose the failure before another external attempt",
    }
    return objectives.get(category, objectives["external_failure"])


def repair_action(category: str) -> str:
    return {
        "authorization_denial": "authority_reconcile",
        "host_denial": "registry_reconcile",
        "credential_denial": "credential_provider_refresh",
        "private_network_denial": "network_scope_reconcile",
        "protocol_denial": "protocol_contract_reconcile",
        "rate_limit_denial": "provider_backoff",
        "network_denial": "same_route_transport_recovery",
        "transient_service_failure": "same_route_service_recovery",
        "external_failure": "diagnostic_review",
    }.get(category, "diagnostic_review")


@dataclasses.dataclass(frozen=True)
class DenialEvent:
    operation_id: str
    agent_id: str
    scope_id: str
    host: str
    protocol: str
    method: str
    credential_scope: str
    route_key: str
    category: str
    detail: str
    retryable: bool
    optimization_objective: str
    repair_action: str
    occurred_at_utc: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class SuccessEvent:
    operation_id: str
    agent_id: str
    scope_id: str
    host: str
    protocol: str
    method: str
    credential_scope: str
    route_key: str
    status: int
    occurred_at_utc: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def denial_event(
    *,
    operation_id: str,
    agent_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str,
    error: BaseException | str | None = None,
    status: int | None = None,
) -> DenialEvent:
    category = classify_denial(error=error, status=status)
    host = _host(url)
    protocol = _scheme(url)
    normalized_method = method.upper().strip()
    route_key = _route_key(
        scope_id=scope.scope_id,
        host=host,
        protocol=protocol,
        method=normalized_method,
        credential_scope=scope.credential_scope,
    )
    return DenialEvent(
        operation_id=operation_id,
        agent_id=agent_id,
        scope_id=scope.scope_id,
        host=host,
        protocol=protocol,
        method=normalized_method,
        credential_scope=scope.credential_scope,
        route_key=route_key,
        category=category,
        detail=(f"status={status}" if status is not None else str(error or ""))[:500],
        retryable=category in RETRYABLE_DENIALS,
        optimization_objective=optimization_objective(category),
        repair_action=repair_action(category),
        occurred_at_utc=_utc_now(),
    )


def success_event(
    *,
    operation_id: str,
    agent_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str,
    status: int,
) -> SuccessEvent:
    host = _host(url)
    protocol = _scheme(url)
    normalized_method = method.upper().strip()
    return SuccessEvent(
        operation_id=operation_id,
        agent_id=agent_id,
        scope_id=scope.scope_id,
        host=host,
        protocol=protocol,
        method=normalized_method,
        credential_scope=scope.credential_scope,
        route_key=_route_key(
            scope_id=scope.scope_id,
            host=host,
            protocol=protocol,
            method=normalized_method,
            credential_scope=scope.credential_scope,
        ),
        status=int(status),
        occurred_at_utc=_utc_now(),
    )


@dataclasses.dataclass
class DenialLearningMemory:
    events: list[dict[str, Any]] = dataclasses.field(default_factory=list)
    successes: list[dict[str, Any]] = dataclasses.field(default_factory=list)

    def _trim(self) -> None:
        if len(self.events) > MAX_MEMORY_EVENTS:
            del self.events[:-MAX_MEMORY_EVENTS]
        if len(self.successes) > MAX_MEMORY_EVENTS:
            del self.successes[:-MAX_MEMORY_EVENTS]

    def record(self, event: DenialEvent) -> None:
        self.events.append(event.to_dict())
        self._trim()

    def record_success(self, event: SuccessEvent) -> None:
        self.successes.append(event.to_dict())
        self._trim()

    def agent_health(self, agents: Iterable[str] = ()) -> dict[str, dict[str, Any]]:
        requested = {str(x) for x in agents}
        denial_counts = Counter(str(x.get("agent_id", "unknown")) for x in self.events)
        retryable_counts = Counter(
            str(x.get("agent_id", "unknown"))
            for x in self.events
            if str(x.get("category")) in RETRYABLE_DENIALS
        )
        success_counts = Counter(str(x.get("agent_id", "unknown")) for x in self.successes)
        names = set(denial_counts) | set(success_counts) | requested
        out: dict[str, dict[str, Any]] = {}
        for agent in sorted(names):
            ok = success_counts[agent]
            denied = denial_counts[agent]
            transient = retryable_counts[agent]
            total = ok + denied
            success_rate = ok / total if total else 0.5
            score = 1.0 + (1.5 * success_rate) - (0.18 * transient) - (0.08 * max(0, denied - transient))
            out[agent] = {
                "successes": ok,
                "denials": denied,
                "retryable_denials": transient,
                "success_rate": round(success_rate, 4),
                "health_score": round(max(0.05, score), 4),
            }
        return out

    def rank_agents(self, agents: Sequence[str]) -> tuple[str, ...]:
        unique = tuple(dict.fromkeys(str(x).strip() for x in agents if str(x).strip()))
        health = self.agent_health(unique)
        order = {agent: index for index, agent in enumerate(unique)}
        return tuple(sorted(unique, key=lambda agent: (-float(health[agent]["health_score"]), order[agent], agent)))

    def route_health(self) -> dict[str, dict[str, Any]]:
        denied = Counter(str(x.get("route_key", "")) for x in self.events if x.get("route_key"))
        retryable = Counter(
            str(x.get("route_key", ""))
            for x in self.events
            if x.get("route_key") and str(x.get("category")) in RETRYABLE_DENIALS
        )
        ok = Counter(str(x.get("route_key", "")) for x in self.successes if x.get("route_key"))
        keys = set(denied) | set(ok)
        result: dict[str, dict[str, Any]] = {}
        for key in sorted(keys):
            total = denied[key] + ok[key]
            success_rate = ok[key] / total if total else 0.0
            failure_pressure = retryable[key] + max(0, denied[key] - retryable[key]) * 2
            result[key] = {
                "successes": ok[key],
                "denials": denied[key],
                "retryable_denials": retryable[key],
                "success_rate": round(success_rate, 4),
                "failure_pressure": failure_pressure,
                "backoff_multiplier": min(8, 1 + failure_pressure // 2),
            }
        return result

    def repair_queue(self) -> list[dict[str, Any]]:
        grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for raw in self.events:
            category = str(raw.get("category", "external_failure"))
            key = (str(raw.get("route_key", "")), category, str(raw.get("host", "")))
            grouped[key].append(raw)
        queue: list[dict[str, Any]] = []
        for (route_key, category, host), rows in grouped.items():
            count = len(rows)
            latest = rows[-1]
            queue.append({
                "route_key": route_key,
                "host": host,
                "scope_id": latest.get("scope_id"),
                "category": category,
                "count": count,
                "priority": "critical" if count >= 3 or category in BOUNDARY_DENIALS else "high",
                "repair_action": repair_action(category),
                "objective": optimization_objective(category),
                "retry_allowed": category in RETRYABLE_DENIALS,
                "latest_agent_id": latest.get("agent_id"),
                "latest_at_utc": latest.get("occurred_at_utc"),
            })
        return sorted(queue, key=lambda x: (
            0 if x["priority"] == "critical" else 1,
            -int(x["count"]),
            str(x["category"]),
            str(x["host"]),
        ))

    def summary(self) -> dict[str, Any]:
        by_category = Counter(str(x.get("category", "external_failure")) for x in self.events)
        by_agent = Counter(str(x.get("agent_id", "unknown")) for x in self.events)
        ranked = sorted(by_category.items(), key=lambda row: (-row[1], row[0]))
        return {
            "schema": DENIAL_SCHEMA,
            "event_count": len(self.events),
            "success_count": len(self.successes),
            "by_category": dict(sorted(by_category.items())),
            "by_agent": dict(sorted(by_agent.items())),
            "agent_health": self.agent_health(),
            "route_health": self.route_health(),
            "optimization_objectives": [
                {
                    "category": category,
                    "count": count,
                    "priority": "critical" if count >= 3 or category in BOUNDARY_DENIALS else "high",
                    "objective": optimization_objective(category),
                    "repair_action": repair_action(category),
                }
                for category, count in ranked
            ],
            "repair_queue_schema": REPAIR_QUEUE_SCHEMA,
            "repair_queue": self.repair_queue(),
            "events": list(self.events),
            "successes": list(self.successes),
        }

    def write(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.summary(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def from_mapping(data: Mapping[str, Any] | None) -> "DenialLearningMemory":
        if not data:
            return DenialLearningMemory()
        events = data.get("events") if isinstance(data.get("events"), list) else []
        successes = data.get("successes") if isinstance(data.get("successes"), list) else []
        return DenialLearningMemory(
            events=[dict(x) for x in events if isinstance(x, Mapping)][-MAX_MEMORY_EVENTS:],
            successes=[dict(x) for x in successes if isinstance(x, Mapping)][-MAX_MEMORY_EVENTS:],
        )


ClientFactory = Callable[[ExternalAuthorityScope, str], ExternalContactClient]


def _adaptive_agent_budget(memory: DenialLearningMemory, route_key: str, available: int, requested: int | None) -> int:
    hard_cap = min(MAX_ROTATION_AGENTS, max(1, available))
    if requested is not None:
        hard_cap = min(hard_cap, max(1, int(requested)))
    health = memory.route_health().get(route_key)
    if not health:
        return min(hard_cap, 3)
    pressure = int(health.get("failure_pressure", 0))
    success_rate = float(health.get("success_rate", 0.0))
    if pressure >= 8:
        return 1
    if pressure >= 4:
        return min(hard_cap, 2)
    if success_rate >= 0.65:
        return min(hard_cap, 5)
    return min(hard_cap, 4)


def execute_with_agent_rotation(
    *,
    operation_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    agents: Sequence[str] = ("senju-a", "senju-b", "senju-c"),
    client_factory: ClientFactory | None = None,
    memory: DenialLearningMemory | None = None,
    max_agents: int | None = None,
) -> dict[str, Any]:
    method = method.upper().strip()
    host = _host(url)
    protocol = _scheme(url)
    if host not in scope.allow_hosts:
        raise ExternalContactError(f"host is not explicitly allowlisted: {host}")
    if method not in scope.allowed_methods:
        raise ExternalContactError(f"method is not allowed: {method}")
    if protocol not in {"https", "http"}:
        raise ExternalContactError("only http/https external contact is supported")
    if protocol == "http" and not scope.allow_http:
        raise ExternalContactError("plain HTTP is disabled; use HTTPS or explicitly allow HTTP")

    learning = memory or DenialLearningMemory()
    unique_agents = tuple(dict.fromkeys(str(x).strip() for x in agents if str(x).strip()))
    if not unique_agents:
        raise ValueError("at least one agent id is required")

    route_key = _route_key(
        scope_id=scope.scope_id,
        host=host,
        protocol=protocol,
        method=method,
        credential_scope=scope.credential_scope,
    )
    ranked_agents = learning.rank_agents(unique_agents)
    agent_budget = _adaptive_agent_budget(learning, route_key, len(ranked_agents), max_agents)
    agent_ids = ranked_agents[:agent_budget]
    route_before = learning.route_health().get(route_key, {
        "successes": 0,
        "denials": 0,
        "retryable_denials": 0,
        "success_rate": 0.0,
        "failure_pressure": 0,
        "backoff_multiplier": 1,
    })

    attempts: list[dict[str, Any]] = []
    for index, agent_id in enumerate(agent_ids, start=1):
        client = client_factory(scope, agent_id) if client_factory else ExternalContactClient(scope.to_policy())
        try:
            result: ContactResult = client.contact_with_body(url, method=method)
        except (ExternalContactError, OSError, TimeoutError) as exc:
            event = denial_event(
                operation_id=operation_id,
                agent_id=agent_id,
                scope=scope,
                url=url,
                method=method,
                error=exc,
            )
            learning.record(event)
            attempts.append({
                "agent_id": agent_id,
                "success": False,
                "denial": event.to_dict(),
                "next_action": "rotate_same_authority_agent" if event.retryable and index < len(agent_ids) else repair_action(event.category),
            })
            if not event.retryable:
                break
            continue

        if not result.receipt.provider_acknowledged:
            event = denial_event(
                operation_id=operation_id,
                agent_id=agent_id,
                scope=scope,
                url=url,
                method=method,
                status=result.receipt.status,
            )
            learning.record(event)
            attempts.append({
                "agent_id": agent_id,
                "success": False,
                "denial": event.to_dict(),
                "next_action": "rotate_same_authority_agent" if event.retryable and index < len(agent_ids) else repair_action(event.category),
            })
            if not event.retryable:
                break
            continue

        learning.record_success(success_event(
            operation_id=operation_id,
            agent_id=agent_id,
            scope=scope,
            url=url,
            method=method,
            status=result.receipt.status,
        ))
        attempts.append({
            "agent_id": agent_id,
            "success": True,
            "receipt": result.receipt.to_dict(),
        })
        return {
            "schema": OUTCOME_SCHEMA,
            "operation_id": operation_id,
            "success": True,
            "selected_agent": agent_id,
            "rotation_count": index - 1,
            "agent_budget": agent_budget,
            "agent_order": list(agent_ids),
            "route_health_before": route_before,
            "route_health_after": learning.route_health().get(route_key),
            "authority_invariants": {
                "scope_id": scope.scope_id,
                "host": host,
                "protocol": protocol,
                "method": method,
                "credential_scope": scope.credential_scope,
                "route_key": route_key,
                "unchanged_across_rotation": True,
            },
            "attempts": attempts,
            "repair_queue": learning.repair_queue(),
            "denial_learning": learning.summary(),
        }

    return {
        "schema": OUTCOME_SCHEMA,
        "operation_id": operation_id,
        "success": False,
        "selected_agent": None,
        "rotation_count": max(0, len(attempts) - 1),
        "agent_budget": agent_budget,
        "agent_order": list(agent_ids),
        "route_health_before": route_before,
        "route_health_after": learning.route_health().get(route_key),
        "authority_invariants": {
            "scope_id": scope.scope_id,
            "host": host,
            "protocol": protocol,
            "method": method,
            "credential_scope": scope.credential_scope,
            "route_key": route_key,
            "unchanged_across_rotation": True,
        },
        "attempts": attempts,
        "repair_queue": learning.repair_queue(),
        "denial_learning": learning.summary(),
    }
