"""Small RED-learning external lane for already-approved Authority hosts only.

This lane deliberately does not discover or promote hosts. Eligibility comes only from
the current effective Authority ceiling produced by the existing approval machinery.
The live transport is ``ExternalContactClient`` and the pilot is read-only (GET/HEAD).

Failure learning is conformance-oriented: transient network/service failures may retry
the exact same approved route; authority/policy/scope/credential/security boundaries are
recorded as repair signals and never become permission or a bypass attempt.
"""
from __future__ import annotations

import hashlib
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

from .external import (
    ExternalAuthorityScope,
    ExternalContactClient,
    ExternalContactError,
    ExternalContactPolicy,
    _normalize_host,
)
from .external_denial_learning import (
    RETRYABLE_DENIALS,
    DenialLearningMemory,
    denial_event,
    success_event,
)
from .owner_scope_negotiation import derive_current_ceiling

LANE_SCHEMA = "senju-approved-authority-red-lane/v1"
DEFAULT_ROLLOUT_PERCENT = 45
MAX_ROLLOUT_PERCENT = 45
DEFAULT_MAX_ATTEMPTS = 2
MAX_ATTEMPTS = 2
READ_METHODS = frozenset({"GET", "HEAD"})

TransportFactory = Callable[[ExternalContactPolicy], Any]


def _approved_per_host(repo_root: str | Path, state_dir: str | Path) -> dict[str, frozenset[str]]:
    """Return only exact hosts already present in the current effective Authority ceiling."""
    ceiling = derive_current_ceiling(repo_root, state_dir)
    raw_per_host = ceiling.get("per_host_methods")
    global_methods = frozenset(str(v).strip().upper() for v in ceiling.get("allowed_methods", ()))
    out: dict[str, frozenset[str]] = {}

    if isinstance(raw_per_host, Mapping):
        for raw_host, values in raw_per_host.items():
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            methods = frozenset(str(v).strip().upper() for v in values) & READ_METHODS
            if methods:
                out[host] = methods

    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _normalize_host(str(raw_host))
        except ExternalContactError:
            continue
        methods = global_methods & READ_METHODS
        if methods:
            out.setdefault(host, methods)
    return out


def stable_rollout_bucket(operation_id: str, url: str) -> int:
    material = f"{operation_id.strip()}|{url.strip()}".encode("utf-8")
    return int(hashlib.sha256(material).hexdigest()[:8], 16) % 100


@dataclass
class ApprovedAuthorityExternalContactClient:
    repo_root: str | Path
    state_dir: str | Path
    transport_factory: TransportFactory | None = None

    def __post_init__(self) -> None:
        self.per_host_methods = _approved_per_host(self.repo_root, self.state_dir)
        policy = ExternalContactPolicy(
            allow_hosts=frozenset(self.per_host_methods),
            allow_http=False,
            allowed_methods=READ_METHODS,
            allow_delete=False,
            follow_redirects=True,
            max_redirects=3,
            timeout_seconds=8.0,
            max_request_bytes=16 * 1024,
            max_response_bytes=512 * 1024,
            retries=0,
            retry_backoff_seconds=0.25,
        )
        factory = self.transport_factory or ExternalContactClient
        self.client = factory(policy)

    def _target(self, url: str, method: str) -> tuple[str, str]:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            raise ExternalContactError("approved-authority RED lane requires HTTPS")
        host = _normalize_host(parsed.hostname)
        normalized_method = method.upper().strip()
        if host not in self.per_host_methods:
            raise ExternalContactError(f"host is not explicitly allowlisted by approved Authority: {host}")
        if normalized_method not in self.per_host_methods[host] or normalized_method not in READ_METHODS:
            raise ExternalContactError(
                f"method is not allowed by approved Authority RED lane for {host}: {normalized_method}"
            )
        return host, normalized_method

    def scope_for(self, url: str, method: str) -> ExternalAuthorityScope:
        host, normalized_method = self._target(url, method)
        return ExternalAuthorityScope(
            scope_id=f"approved-authority-red:{host}",
            target_service=host,
            allow_hosts=frozenset({host}),
            allowed_methods=frozenset({normalized_method}),
            allow_http=False,
            allow_delete=False,
            retries=0,
            follow_redirects=True,
            credential_scope="none",
            description="Already-approved Authority host; small RED learning pilot",
        )

    def contact(self, url: str, *, method: str = "GET"):
        self._target(url, method)
        return self.client.contact(url, method=method)


def execute_authorized_red_contact(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    operation_id: str,
    url: str,
    method: str = "GET",
    rollout_percent: int = DEFAULT_ROLLOUT_PERCENT,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    memory: DenialLearningMemory | None = None,
    transport_factory: TransportFactory | None = None,
) -> dict[str, Any]:
    """Execute a small real-contact RED pilot only for already-approved Authority hosts."""
    rollout = max(1, min(int(rollout_percent), MAX_ROLLOUT_PERCENT))
    attempts_cap = max(1, min(int(max_attempts), MAX_ATTEMPTS))
    learning = memory or DenialLearningMemory()
    lane = ApprovedAuthorityExternalContactClient(repo_root, state_dir, transport_factory)

    try:
        scope = lane.scope_for(url, method)
    except ExternalContactError as exc:
        # Record the boundary denial without creating or invoking a transport to the target.
        parsed = urllib.parse.urlsplit(url)
        raw_host = (parsed.hostname or "invalid-target").lower().rstrip(".")
        scope = ExternalAuthorityScope(
            scope_id="approved-authority-red:blocked",
            target_service=raw_host,
            allow_hosts=frozenset(lane.per_host_methods),
            allowed_methods=READ_METHODS,
            credential_scope="none",
            description="Blocked before transport because target is outside approved Authority",
        )
        event = denial_event(
            operation_id=operation_id,
            agent_id="SENJU-RED",
            scope=scope,
            url=url,
            method=method,
            error=exc,
        )
        learning.record(event)
        return {
            "schema": LANE_SCHEMA,
            "operation_id": operation_id,
            "eligible": False,
            "selected_by_rollout": False,
            "external_contact_attempted": False,
            "success": False,
            "stop_reason": "not_in_approved_authority",
            "denial_category": event.category,
            "rollout_percent": rollout,
            "guard_learning_mode": "conformance_only",
            "same_authorized_route_only": True,
            "boundary_bypass_enabled": False,
            "memory": learning.summary(),
        }

    bucket = stable_rollout_bucket(operation_id, url)
    selected = bucket < rollout
    if not selected:
        return {
            "schema": LANE_SCHEMA,
            "operation_id": operation_id,
            "eligible": True,
            "selected_by_rollout": False,
            "rollout_bucket": bucket,
            "rollout_percent": rollout,
            "external_contact_attempted": False,
            "success": False,
            "stop_reason": "pilot_rollout_not_selected",
            "approved_host": next(iter(scope.allow_hosts)),
            "guard_learning_mode": "conformance_only",
            "same_authorized_route_only": True,
            "boundary_bypass_enabled": False,
            "memory": learning.summary(),
        }

    attempts: list[dict[str, Any]] = []
    success = False
    stop_reason: str | None = None
    receipt = None

    for attempt in range(1, attempts_cap + 1):
        try:
            receipt = lane.contact(url, method=method)
            if receipt is None:
                raise ExternalContactError("transport returned None response")
        except Exception as exc:  # transport errors are normalized into denial memory
            event = denial_event(
                operation_id=operation_id,
                agent_id="SENJU-RED",
                scope=scope,
                url=url,
                method=method,
                error=exc,
            )
            learning.record(event)
            attempts.append({
                "attempt": attempt,
                "success": False,
                "category": event.category,
                "retryable": event.retryable,
                "repair_action": event.repair_action,
            })
            if event.category not in RETRYABLE_DENIALS:
                stop_reason = f"boundary_or_nonretryable:{event.category}"
                break
            if attempt >= attempts_cap:
                stop_reason = "transient_retry_budget_exhausted"
                break
            continue

        learning.record_success(success_event(
            operation_id=operation_id,
            agent_id="SENJU-RED",
            scope=scope,
            url=url,
            method=method,
            status=int(receipt.status),
        ))
        attempts.append({"attempt": attempt, "success": True, "status": int(receipt.status)})
        success = True
        stop_reason = None
        break

    return {
        "schema": LANE_SCHEMA,
        "operation_id": operation_id,
        "eligible": True,
        "selected_by_rollout": True,
        "rollout_bucket": bucket,
        "rollout_percent": rollout,
        "approved_host": next(iter(scope.allow_hosts)),
        "method": method.upper().strip(),
        "external_contact_attempted": bool(attempts),
        "attempt_count": len(attempts),
        "max_attempts": attempts_cap,
        "success": success,
        "status": int(receipt.status) if receipt is not None else None,
        "stop_reason": stop_reason,
        "attempts": attempts,
        "red_learning_active": True,
        "failure_driven_retry": True,
        "guard_learning_mode": "conformance_only",
        "same_authorized_route_only": True,
        "host_variation_allowed": False,
        "method_variation_allowed": False,
        "authority_expansion_allowed": False,
        "boundary_bypass_enabled": False,
        "memory": learning.summary(),
    }
