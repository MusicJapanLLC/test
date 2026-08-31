"""Production denial learning and authority-preserving agent failover for Senju.

Every external-contact failure is treated as a first-class optimization signal.
The optimizer learns *why* an operation was denied and raises its priority for
configuration, availability, or authorization repair. It does not convert a denial
into permission.

Agent rotation is supported for transient transport failures only. A rotated agent
must reuse the exact same URL host, protocol, method, authority scope, and credential
scope. Authorization, host, credential, private-network, protocol, and rate-limit
denials are never retried through another identity.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from .external import ContactResult, ExternalAuthorityScope, ExternalContactClient, ExternalContactError

DENIAL_SCHEMA = "senju-external-denial-learning/v1"
OUTCOME_SCHEMA = "senju-authority-preserving-agent-rotation/v1"

BOUNDARY_DENIALS = frozenset({
    "authorization_denial",
    "host_denial",
    "credential_denial",
    "private_network_denial",
    "protocol_denial",
    "rate_limit_denial",
})
RETRYABLE_DENIALS = frozenset({"network_denial", "transient_service_failure"})


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _host(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    return (parsed.hostname or "").lower().rstrip(".")


def _scheme(url: str) -> str:
    return urllib.parse.urlsplit(url).scheme.lower()


def classify_denial(*, error: BaseException | str | None = None, status: int | None = None) -> str:
    """Classify a failed external operation into an optimization objective."""
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
        "authorization_denial": "repair authorization inputs or obtain valid explicit authority before another attempt",
        "network_denial": "improve transport availability while preserving the same authority boundary",
        "host_denial": "repair target registration or use an already authorized host",
        "credential_denial": "repair the configured credential through its authorized credential provider",
        "private_network_denial": "keep the operation blocked and repair scope/network classification out of band",
        "protocol_denial": "use the protocol already permitted by the authority contract",
        "rate_limit_denial": "respect provider backoff and reduce request pressure",
        "transient_service_failure": "retry later or fail over execution identity without changing authority",
        "external_failure": "diagnose the failure before another external attempt",
    }
    return objectives.get(category, objectives["external_failure"])


@dataclasses.dataclass(frozen=True)
class DenialEvent:
    operation_id: str
    agent_id: str
    scope_id: str
    host: str
    protocol: str
    method: str
    credential_scope: str
    category: str
    detail: str
    retryable: bool
    optimization_objective: str
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
    return DenialEvent(
        operation_id=operation_id,
        agent_id=agent_id,
        scope_id=scope.scope_id,
        host=_host(url),
        protocol=_scheme(url),
        method=method.upper().strip(),
        credential_scope=scope.credential_scope,
        category=category,
        detail=(f"status={status}" if status is not None else str(error or ""))[:500],
        retryable=category in RETRYABLE_DENIALS,
        optimization_objective=optimization_objective(category),
        occurred_at_utc=_utc_now(),
    )


@dataclasses.dataclass
class DenialLearningMemory:
    events: list[dict[str, Any]] = dataclasses.field(default_factory=list)

    def record(self, event: DenialEvent) -> None:
        self.events.append(event.to_dict())
        if len(self.events) > 1000:
            del self.events[:-1000]

    def summary(self) -> dict[str, Any]:
        by_category = Counter(str(x.get("category", "external_failure")) for x in self.events)
        by_agent = Counter(str(x.get("agent_id", "unknown")) for x in self.events)
        ranked = sorted(by_category.items(), key=lambda row: (-row[1], row[0]))
        return {
            "schema": DENIAL_SCHEMA,
            "event_count": len(self.events),
            "by_category": dict(sorted(by_category.items())),
            "by_agent": dict(sorted(by_agent.items())),
            "optimization_objectives": [
                {
                    "category": category,
                    "count": count,
                    "priority": "critical" if count >= 3 else "high",
                    "objective": optimization_objective(category),
                }
                for category, count in ranked
            ],
            "events": list(self.events),
        }

    def write(self, path: str | Path) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.summary(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


ClientFactory = Callable[[ExternalAuthorityScope, str], ExternalContactClient]


def execute_with_agent_rotation(
    *,
    operation_id: str,
    scope: ExternalAuthorityScope,
    url: str,
    method: str = "GET",
    agents: Sequence[str] = ("senju-a", "senju-b", "senju-c"),
    client_factory: ClientFactory | None = None,
    memory: DenialLearningMemory | None = None,
) -> dict[str, Any]:
    """Execute one authorized operation with identity failover on transient failures.

    Rotation never changes authority inputs. Boundary denials stop immediately and are
    learned as high-priority repair objectives instead of being retried through another
    agent.
    """
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

    agent_ids = tuple(dict.fromkeys(str(x).strip() for x in agents if str(x).strip()))[:3]
    if not agent_ids:
        raise ValueError("at least one agent id is required")
    learning = memory or DenialLearningMemory()
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
            attempts.append({"agent_id": agent_id, "success": False, "denial": event.to_dict()})
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
            attempts.append({"agent_id": agent_id, "success": False, "denial": event.to_dict()})
            if not event.retryable:
                break
            continue

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
            "authority_invariants": {
                "scope_id": scope.scope_id,
                "host": host,
                "protocol": protocol,
                "method": method,
                "credential_scope": scope.credential_scope,
                "unchanged_across_rotation": True,
            },
            "attempts": attempts,
            "denial_learning": learning.summary(),
        }

    return {
        "schema": OUTCOME_SCHEMA,
        "operation_id": operation_id,
        "success": False,
        "selected_agent": None,
        "rotation_count": max(0, len(attempts) - 1),
        "authority_invariants": {
            "scope_id": scope.scope_id,
            "host": host,
            "protocol": protocol,
            "method": method,
            "credential_scope": scope.credential_scope,
            "unchanged_across_rotation": True,
        },
        "attempts": attempts,
        "denial_learning": learning.summary(),
    }
