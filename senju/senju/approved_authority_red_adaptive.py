"""Adaptive, non-destructive RED learning over real transport for approved Authority hosts.

The loop is intentionally bounded to already-approved Authority hosts and safe read-only
HTTP methods. It can vary host, method, and path *inside that approved set*, learn from
responses/denials, and generate the next safe probe plan. It never generates exploit
payloads, request bodies, credentials, new Authority, or a boundary-bypass attempt.
"""
from __future__ import annotations

import hashlib
import urllib.parse
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from .external import (
    ExternalAuthorityScope,
    ExternalContactClient,
    ExternalContactError,
    ExternalContactPolicy,
    _normalize_host,
)
from .external_denial_learning import (
    BOUNDARY_DENIALS,
    DenialLearningMemory,
    denial_event,
    success_event,
)
from .owner_scope_negotiation import derive_current_ceiling

ADAPTIVE_SCHEMA = "senju-approved-authority-red-adaptive/v1"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
SAFE_DEFAULT_PATHS = ("/", "/robots.txt", "/health", "/status")
DEFAULT_MAX_ATTEMPTS = 4
MAX_ATTEMPTS = 6
DEFAULT_ROLLOUT_PERCENT = 45
MAX_ROLLOUT_PERCENT = 45

TransportFactory = Callable[[ExternalContactPolicy], Any]


def _approved_methods(repo_root: str | Path, state_dir: str | Path) -> dict[str, frozenset[str]]:
    """Return safe methods for hosts already present in the effective Authority ceiling."""
    ceiling = derive_current_ceiling(repo_root, state_dir)
    global_methods = frozenset(str(v).strip().upper() for v in ceiling.get("allowed_methods", ()))
    raw_per_host = ceiling.get("per_host_methods")
    out: dict[str, frozenset[str]] = {}

    if isinstance(raw_per_host, Mapping):
        for raw_host, values in raw_per_host.items():
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            methods = frozenset(str(v).strip().upper() for v in values) & SAFE_METHODS
            if methods:
                out[host] = methods

    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _normalize_host(str(raw_host))
        except ExternalContactError:
            continue
        methods = global_methods & SAFE_METHODS
        if methods:
            out.setdefault(host, methods)
    return out


def _bucket(operation_id: str, seed_url: str) -> int:
    material = f"{operation_id.strip()}|{seed_url.strip()}|adaptive-red".encode("utf-8")
    return int(hashlib.sha256(material).hexdigest()[:8], 16) % 100


def _normalize_path(value: str) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    if not text.startswith("/"):
        text = "/" + text
    if len(text) > 256 or "\x00" in text:
        return None
    parsed = urllib.parse.urlsplit(text)
    if parsed.scheme or parsed.netloc or parsed.fragment:
        return None
    # Keep alternate-path exploration path-only: no attacker-controlled query mutation.
    return parsed.path or "/"


def _validated_candidate_urls(
    seed_url: str,
    candidate_urls: Sequence[str],
    approved: Mapping[str, frozenset[str]],
) -> tuple[list[str], list[dict[str, str]]]:
    accepted: list[str] = []
    excluded: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for raw in (seed_url, *candidate_urls):
        text = str(raw or "").strip()
        try:
            parsed = urllib.parse.urlsplit(text)
            if parsed.scheme.lower() != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ExternalContactError("adaptive RED candidates require credential-free HTTPS URLs")
            host = _normalize_host(parsed.hostname)
            if host not in approved:
                raise ExternalContactError("candidate host is outside approved Authority")
            path = _normalize_path(parsed.path or "/") or "/"
            key = (host, path)
            if key in seen:
                continue
            seen.add(key)
            accepted.append(urllib.parse.urlunsplit(("https", host, path, "", "")))
        except (ExternalContactError, ValueError) as exc:
            excluded.append({"url": text[:300], "reason": str(exc)[:240]})
    return accepted, excluded


def _ordered_hosts(operation_id: str, urls: Sequence[str]) -> list[str]:
    by_host: dict[str, str] = {}
    for url in urls:
        parsed = urllib.parse.urlsplit(url)
        if parsed.hostname:
            by_host.setdefault(parsed.hostname.lower().rstrip("."), url)
    return sorted(
        by_host,
        key=lambda host: hashlib.sha256(f"{operation_id}|{host}".encode("utf-8")).hexdigest(),
    )


def _build_plan(
    *,
    operation_id: str,
    approved_urls: Sequence[str],
    approved_methods: Mapping[str, frozenset[str]],
    requested_method: str,
    alternate_paths: Iterable[str],
    include_safe_defaults: bool,
) -> list[dict[str, str]]:
    seed_path_by_host: dict[str, str] = {}
    for url in approved_urls:
        parsed = urllib.parse.urlsplit(url)
        if parsed.hostname:
            seed_path_by_host.setdefault(parsed.hostname.lower().rstrip("."), parsed.path or "/")

    extra_paths: list[str] = []
    for raw in alternate_paths:
        normalized = _normalize_path(raw)
        if normalized and normalized not in extra_paths:
            extra_paths.append(normalized)
    if include_safe_defaults:
        for path in SAFE_DEFAULT_PATHS:
            if path not in extra_paths:
                extra_paths.append(path)

    preferred = requested_method.strip().upper()
    plan: list[dict[str, str]] = []
    for host in _ordered_hosts(operation_id, approved_urls):
        methods = approved_methods.get(host, frozenset())
        method_order = [m for m in (preferred, "GET", "HEAD", "OPTIONS") if m in methods]
        method_order = list(dict.fromkeys(method_order))
        paths = [seed_path_by_host.get(host, "/"), *extra_paths]
        paths = list(dict.fromkeys(path for path in paths if path))
        for path in paths:
            for method in method_order:
                plan.append({
                    "host": host,
                    "method": method,
                    "path": path,
                    "url": urllib.parse.urlunsplit(("https", host, path, "", "")),
                })
    return plan


def _scope_for(host: str, method: str) -> ExternalAuthorityScope:
    return ExternalAuthorityScope(
        scope_id=f"approved-authority-red-adaptive:{host}",
        target_service=host,
        allow_hosts=frozenset({host}),
        allowed_methods=frozenset({method}),
        allow_http=False,
        allow_delete=False,
        retries=0,
        follow_redirects=True,
        credential_scope="none",
        description="Approved Authority adaptive non-destructive RED learning",
    )


def execute_authorized_red_learning_cycle(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    operation_id: str,
    seed_url: str,
    method: str = "GET",
    candidate_urls: Sequence[str] = (),
    alternate_paths: Sequence[str] = (),
    include_safe_defaults: bool = True,
    rollout_percent: int = DEFAULT_ROLLOUT_PERCENT,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    memory: DenialLearningMemory | None = None,
    transport_factory: TransportFactory | None = None,
) -> dict[str, Any]:
    """Run one adaptive real-transport cycle within the existing approved Authority set."""
    approved = _approved_methods(repo_root, state_dir)
    learning = memory or DenialLearningMemory()
    rollout = max(1, min(int(rollout_percent), MAX_ROLLOUT_PERCENT))
    attempts_cap = max(1, min(int(max_attempts), MAX_ATTEMPTS))
    approved_urls, excluded = _validated_candidate_urls(seed_url, candidate_urls, approved)

    if not approved_urls:
        return {
            "schema": ADAPTIVE_SCHEMA,
            "operation_id": operation_id,
            "eligible": False,
            "selected_by_rollout": False,
            "external_contact_attempted": False,
            "success": False,
            "stop_reason": "no_candidate_inside_approved_authority",
            "excluded_candidates": excluded,
            "real_transport": True,
            "red_learning_active": True,
            "host_variation_allowed": False,
            "method_variation_allowed": False,
            "alternate_path_exploration_allowed": False,
            "authority_expansion_allowed": False,
            "boundary_bypass_enabled": False,
            "exploit_payload_generation_enabled": False,
            "request_body_enabled": False,
            "memory": learning.summary(),
        }

    bucket = _bucket(operation_id, seed_url)
    if bucket >= rollout:
        hosts = sorted({urllib.parse.urlsplit(url).hostname for url in approved_urls if urllib.parse.urlsplit(url).hostname})
        return {
            "schema": ADAPTIVE_SCHEMA,
            "operation_id": operation_id,
            "eligible": True,
            "selected_by_rollout": False,
            "rollout_bucket": bucket,
            "rollout_percent": rollout,
            "external_contact_attempted": False,
            "success": False,
            "stop_reason": "pilot_rollout_not_selected",
            "approved_candidate_hosts": hosts,
            "excluded_candidates": excluded,
            "real_transport": True,
            "red_learning_active": True,
            "host_variation_allowed": len(hosts) > 1,
            "method_variation_allowed": True,
            "alternate_path_exploration_allowed": True,
            "authority_expansion_allowed": False,
            "boundary_bypass_enabled": False,
            "exploit_payload_generation_enabled": False,
            "request_body_enabled": False,
            "memory": learning.summary(),
        }

    plan = _build_plan(
        operation_id=operation_id,
        approved_urls=approved_urls,
        approved_methods=approved,
        requested_method=method,
        alternate_paths=alternate_paths,
        include_safe_defaults=include_safe_defaults,
    )
    policy = ExternalContactPolicy(
        allow_hosts=frozenset(approved),
        allow_http=False,
        allowed_methods=SAFE_METHODS,
        allow_delete=False,
        follow_redirects=True,
        max_redirects=3,
        timeout_seconds=8.0,
        max_request_bytes=0,
        max_response_bytes=256 * 1024,
        retries=0,
        retry_backoff_seconds=0.25,
    )
    client = (transport_factory or ExternalContactClient)(policy)

    attempts: list[dict[str, Any]] = []
    blocked_hosts: set[str] = set()
    strategy_mutations: list[str] = []
    success = False
    status: int | None = None
    stop_reason = "safe_probe_plan_exhausted"

    for item in plan:
        if len(attempts) >= attempts_cap:
            stop_reason = "adaptive_attempt_budget_exhausted"
            break
        host = item["host"]
        if host in blocked_hosts:
            continue
        scope = _scope_for(host, item["method"])
        try:
            receipt = client.contact(item["url"], method=item["method"])
        except Exception as exc:
            event = denial_event(
                operation_id=operation_id,
                agent_id="SENJU-RED-ADAPTIVE",
                scope=scope,
                url=item["url"],
                method=item["method"],
                error=exc,
            )
            learning.record(event)
            attempts.append({
                "attempt": len(attempts) + 1,
                **item,
                "success": False,
                "outcome": "transport_or_policy_denial",
                "denial_category": event.category,
                "retryable": event.retryable,
                "repair_action": event.repair_action,
            })
            if event.category in BOUNDARY_DENIALS:
                blocked_hosts.add(host)
                strategy_mutations.append("stop_denied_host_without_bypass")
            elif event.retryable:
                strategy_mutations.append("continue_with_next_safe_probe")
            else:
                strategy_mutations.append("diagnose_then_continue_bounded_plan")
            continue

        status = int(receipt.status)
        if 200 <= status < 400:
            learning.record_success(success_event(
                operation_id=operation_id,
                agent_id="SENJU-RED-ADAPTIVE",
                scope=scope,
                url=item["url"],
                method=item["method"],
                status=status,
            ))
            attempts.append({
                "attempt": len(attempts) + 1,
                **item,
                "success": True,
                "status": status,
                "outcome": "reachable_success",
            })
            success = True
            stop_reason = "success"
            break

        event = denial_event(
            operation_id=operation_id,
            agent_id="SENJU-RED-ADAPTIVE",
            scope=scope,
            url=item["url"],
            method=item["method"],
            status=status,
        )
        learning.record(event)

        if status == 404:
            outcome = "path_not_found"
            strategy_mutations.append("switch_safe_path")
        elif status == 405:
            outcome = "method_not_allowed"
            strategy_mutations.append("switch_safe_method")
        elif status in {401, 403, 407}:
            outcome = "access_boundary"
            blocked_hosts.add(host)
            strategy_mutations.append("stop_denied_host_without_bypass")
        elif status == 429:
            outcome = "rate_limited"
            blocked_hosts.add(host)
            strategy_mutations.append("respect_rate_limit_and_stop_host")
        elif 500 <= status < 600:
            outcome = "transient_service_failure"
            strategy_mutations.append("continue_with_next_safe_probe")
        else:
            outcome = "http_failure"
            strategy_mutations.append("continue_bounded_plan")

        attempts.append({
            "attempt": len(attempts) + 1,
            **item,
            "success": False,
            "status": status,
            "outcome": outcome,
            "denial_category": event.category,
            "retryable": event.retryable,
        })

    hosts = sorted({urllib.parse.urlsplit(url).hostname for url in approved_urls if urllib.parse.urlsplit(url).hostname})
    methods_seen = sorted({str(row.get("method")) for row in attempts if row.get("method")})
    paths_seen = sorted({str(row.get("path")) for row in attempts if row.get("path")})
    return {
        "schema": ADAPTIVE_SCHEMA,
        "operation_id": operation_id,
        "eligible": True,
        "selected_by_rollout": True,
        "rollout_bucket": bucket,
        "rollout_percent": rollout,
        "external_contact_attempted": bool(attempts),
        "attempt_count": len(attempts),
        "max_attempts": attempts_cap,
        "success": success,
        "status": status if success else None,
        "stop_reason": stop_reason,
        "attempts": attempts,
        "approved_candidate_hosts": hosts,
        "methods_seen": methods_seen,
        "paths_seen": paths_seen,
        "excluded_candidates": excluded,
        "strategy_mutations": list(dict.fromkeys(strategy_mutations)),
        "failed_probe_next_plan_generated": any(not row.get("success") for row in attempts) and len(attempts) > 1,
        "real_transport": True,
        "red_learning_active": True,
        "denial_as_learning_signal": True,
        "denial_as_bypass_target": False,
        "exact_single_host_lock": False,
        "approved_host_set_boundary": True,
        "host_variation_allowed": len(hosts) > 1,
        "host_variation_scope": "already_approved_authority_only",
        "method_variation_allowed": True,
        "method_variation_scope": "already_approved_safe_read_methods_only",
        "alternate_path_exploration_allowed": True,
        "alternate_path_scope": "path_only_no_query_no_body",
        "authority_expansion_allowed": False,
        "boundary_bypass_enabled": False,
        "exploit_payload_generation_enabled": False,
        "request_body_enabled": False,
        "raw_response_body_retained": False,
        "memory": learning.summary(),
    }
