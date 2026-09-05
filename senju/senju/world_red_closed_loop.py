"""Unify The world RED learning loop without widening real-world authority.

The orchestrator composes existing owner Authorization, RED transport evidence,
retry learning, persistent memory, and recovery state into one machine-readable
closed loop.

Real external execution remains downstream of existing RED transport and is
restricted to exact hosts that already have current, credential-free,
non-destructive Authorization. Strategy evolution can be aggressive in synthetic
research, but executable plans produced here never mint Authority, inherit real
credentials, generate exploit payloads, resurrect revoked grants, or self-approve
Guard changes.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping, Sequence

SCHEMA = "senju-world-red-closed-loop/v1"
MEMORY_SCHEMA = "senju-world-red-strategy-memory/v1"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
MAX_RETRY_PLAN = 40
MAX_SYNTHETIC_HINTS = 50


def _load(path: str | Path | None, default: Any) -> Any:
    if path is None:
        return default
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _host(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        if "://" in text:
            text = urllib.parse.urlsplit(text).hostname or ""
    except ValueError:
        return ""
    host = text.lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@* ") or "." not in host:
        return ""
    return host


def _safe_route(value: Any) -> tuple[str, str] | None:
    """Return (host, path) while deliberately dropping query/fragment/userinfo."""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = urllib.parse.urlsplit(text)
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or parsed.username or parsed.password:
        return None
    host = _host(parsed.hostname)
    if not host:
        return None
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    return host, path[:512]


def _parse_expiry(value: Any) -> int:
    text = str(value or "").strip()
    if not text:
        return 0
    if text.isdigit():
        return int(text)
    try:
        from datetime import datetime, timezone

        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp())
    except ValueError:
        return 0


def active_authorized_hosts(
    owner_pool: Mapping[str, Any],
    target_queue: Mapping[str, Any],
    *,
    now: int,
) -> set[str]:
    """Intersect current owner grants with RED runnable targets.

    This makes the orchestrator downstream of both Authorization and transport
    eligibility. A stale pool entry or queue-only hostname is not sufficient.
    """
    pool_hosts: set[str] = set()
    for row in owner_pool.get("entries", []) if isinstance(owner_pool.get("entries"), list) else []:
        if not isinstance(row, Mapping) or row.get("transport_eligible") is not True:
            continue
        host = _host(row.get("host"))
        auth = row.get("authorization") if isinstance(row.get("authorization"), Mapping) else {}
        if not host or _host(auth.get("host")) != host:
            continue
        if str(auth.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if auth.get("private_network") is True:
            continue
        if _parse_expiry(auth.get("expires_at") or auth.get("expires_at_epoch")) <= now:
            continue
        methods = {str(x).strip().upper() for x in auth.get("allowed_methods", []) if str(x).strip()}
        if not (methods & SAFE_METHODS):
            continue
        pool_hosts.add(host)

    queue_hosts: set[str] = set()
    for row in target_queue.get("targets", []) if isinstance(target_queue.get("targets"), list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if not host:
            continue
        if str(row.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if row.get("destructive") is True:
            continue
        methods = {str(x).strip().upper() for x in row.get("allowed_methods", []) if str(x).strip()}
        if not (methods & SAFE_METHODS):
            continue
        queue_hosts.add(host)
    return pool_hosts & queue_hosts


def classify_failure(contact: Mapping[str, Any]) -> str | None:
    if contact.get("success") is True:
        return None
    status = contact.get("status")
    try:
        code = int(status) if status is not None else None
    except (TypeError, ValueError):
        code = None
    if code == 404:
        return "route_not_found"
    if code == 429:
        return "rate_limited"
    if code in {401, 403}:
        return "authorization_boundary"
    if code is not None and 500 <= code:
        return "server_error"
    error = str(contact.get("error") or "").lower()
    if "timeout" in error:
        return "timeout"
    if error:
        return "transport_error"
    return "unsuccessful_observation"


def _empty_memory() -> dict[str, Any]:
    return {
        "schema": MEMORY_SCHEMA,
        "routes": {},
        "ignored_unknown_contacts": 0,
        "last_updated": 0,
    }


def build_strategy_memory(
    authorized_hosts: set[str],
    reports: Sequence[Mapping[str, Any]],
    *,
    previous: Mapping[str, Any] | None = None,
    now: int,
) -> dict[str, Any]:
    memory = _empty_memory()
    if isinstance(previous, Mapping) and previous.get("schema") == MEMORY_SCHEMA:
        old_routes = previous.get("routes")
        if isinstance(old_routes, Mapping):
            memory["routes"] = {
                str(k): dict(v)
                for k, v in old_routes.items()
                if isinstance(v, Mapping)
            }
        memory["ignored_unknown_contacts"] = int(previous.get("ignored_unknown_contacts", 0) or 0)

    for report in reports:
        contacts = report.get("contacts", []) if isinstance(report, Mapping) else []
        for contact in contacts if isinstance(contacts, list) else []:
            if not isinstance(contact, Mapping):
                continue
            route = _safe_route(contact.get("final_url") or contact.get("url"))
            if route is None:
                continue
            host, path = route
            if host not in authorized_hosts:
                memory["ignored_unknown_contacts"] += 1
                continue
            method = str(contact.get("method") or "GET").strip().upper()
            if method not in SAFE_METHODS:
                continue
            key = f"{host}|{method}|{path}"
            state = dict(memory["routes"].get(key, {}))
            state["host"] = host
            state["method"] = method
            state["path"] = path
            state["attempts"] = int(state.get("attempts", 0) or 0) + 1
            success = contact.get("success") is True
            state["successes"] = int(state.get("successes", 0) or 0) + int(success)
            state["failures"] = int(state.get("failures", 0) or 0) + int(not success)
            try:
                state["last_status"] = int(contact.get("status")) if contact.get("status") is not None else None
            except (TypeError, ValueError):
                state["last_status"] = None
            state["last_failure_class"] = classify_failure(contact)
            state["last_seen"] = now
            state["score"] = round(
                state["successes"] * 3.0
                - state["failures"] * 0.75
                + min(state["attempts"], 10) * 0.05,
                4,
            )
            memory["routes"][key] = state
    memory["last_updated"] = now
    return memory


def _strategy_ranking(memory: Mapping[str, Any]) -> list[dict[str, Any]]:
    aggregate: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"attempts": 0, "successes": 0, "failures": 0, "score": 0.0}
    )
    routes = memory.get("routes", {}) if isinstance(memory, Mapping) else {}
    for state in routes.values() if isinstance(routes, Mapping) else []:
        if not isinstance(state, Mapping):
            continue
        method = str(state.get("method") or "").upper()
        path = str(state.get("path") or "")
        if method not in SAFE_METHODS or not path.startswith("/"):
            continue
        bucket = aggregate[(method, path)]
        bucket["attempts"] += int(state.get("attempts", 0) or 0)
        bucket["successes"] += int(state.get("successes", 0) or 0)
        bucket["failures"] += int(state.get("failures", 0) or 0)
        bucket["score"] += float(state.get("score", 0.0) or 0.0)
    ranked = [
        {
            "method": method,
            "path": path,
            **values,
            "transfer_scope": "authorized_hosts_only",
        }
        for (method, path), values in aggregate.items()
    ]
    ranked.sort(key=lambda row: (row["score"], row["successes"], -row["failures"]), reverse=True)
    return ranked[:50]


def build_retry_plan(
    url_pool: Mapping[str, Any],
    authorized_hosts: set[str],
    memory: Mapping[str, Any],
    *,
    limit: int = MAX_RETRY_PLAN,
) -> list[dict[str, Any]]:
    routes = memory.get("routes", {}) if isinstance(memory, Mapping) else {}
    selected = url_pool.get("selected_urls")
    if not isinstance(selected, list) or not selected:
        selected = url_pool.get("urls", [])
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in selected if isinstance(selected, list) else []:
        if not isinstance(row, Mapping):
            continue
        route = _safe_route(row.get("url"))
        if route is None:
            continue
        host, path = route
        if host not in authorized_hosts:
            continue
        candidates: list[tuple[float, str, str]] = []
        for method in ("GET", "HEAD", "OPTIONS"):
            state = routes.get(f"{host}|{method}|{path}", {}) if isinstance(routes, Mapping) else {}
            score = float(state.get("score", 0.0) or 0.0) if isinstance(state, Mapping) else 0.0
            failure = str(state.get("last_failure_class") or "") if isinstance(state, Mapping) else ""
            # Prefer successful strategies; if a route failed, modestly prefer an alternate safe method.
            if failure:
                score -= 0.2
            candidates.append((score, method, failure))
        candidates.sort(key=lambda item: item[0], reverse=True)
        for score, method, failure in candidates:
            marker = (str(row.get("url")), method)
            if marker in seen:
                continue
            seen.add(marker)
            out.append(
                {
                    "url": str(row.get("url")),
                    "host": host,
                    "path": path,
                    "method": method,
                    "score": round(score, 4),
                    "reason": "learned_safe_retry" if failure else "authorized_strategy_transfer",
                    "request_body": None,
                    "credential_scope": "none",
                    "exploit_payload": False,
                }
            )
            break
        if len(out) >= max(1, min(int(limit), MAX_RETRY_PLAN)):
            break
    return out


def synthetic_strategy_hints(synthetic_report: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(synthetic_report, Mapping):
        return []
    hints: list[dict[str, Any]] = []
    rows = synthetic_report.get("winning_memory", [])
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        method = str(row.get("method") or "").strip().upper()
        path = str(row.get("path") or "")
        if method not in SAFE_METHODS or not path.startswith("/"):
            continue
        hint = {
            "method": method,
            "path": path[:512],
            "synthetic_success": row.get("success") is True,
            "non_executable": True,
            "requires_existing_authorized_url": True,
        }
        if hint not in hints:
            hints.append(hint)
        if len(hints) >= MAX_SYNTHETIC_HINTS:
            break
    return hints


def _authority_lineage(owner_pool: Mapping[str, Any], authorized_hosts: set[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    entries = owner_pool.get("entries", []) if isinstance(owner_pool.get("entries"), list) else []
    for row in entries:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if host not in authorized_hosts:
            continue
        auth = row.get("authorization") if isinstance(row.get("authorization"), Mapping) else {}
        requested = row.get("requested_authority") if isinstance(row.get("requested_authority"), Mapping) else {}
        out.append(
            {
                "host": host,
                "authorization_id": str(auth.get("authorization_id") or ""),
                "expires_at": auth.get("expires_at"),
                "same_or_narrower": bool(requested.get("same_or_narrower", True)),
                "credential_scope": "none",
                "renewal_source": "owner_authorization_pool",
            }
        )
    return out


def _recovery_state(previous_memory: Mapping[str, Any] | None, authorized_hosts: set[str]) -> dict[str, Any]:
    known_hosts: set[str] = set()
    if isinstance(previous_memory, Mapping):
        routes = previous_memory.get("routes", {})
        for state in routes.values() if isinstance(routes, Mapping) else []:
            if isinstance(state, Mapping) and _host(state.get("host")):
                known_hosts.add(_host(state.get("host")))
    suspended = sorted(known_hosts - authorized_hosts)
    return {
        "memory_recovery": True,
        "suspended_hosts": suspended,
        "revoked_authority_resurrection": False,
        "reauthorization_required_for_suspended_hosts": bool(suspended),
    }


def _guard_proposals(memory: Mapping[str, Any]) -> list[dict[str, Any]]:
    histogram: dict[str, int] = defaultdict(int)
    routes = memory.get("routes", {}) if isinstance(memory, Mapping) else {}
    for state in routes.values() if isinstance(routes, Mapping) else []:
        if isinstance(state, Mapping) and state.get("last_failure_class"):
            histogram[str(state["last_failure_class"])] += 1

    proposals: list[dict[str, Any]] = []
    if histogram.get("rate_limited", 0) >= 2:
        proposals.append({
            "kind": "reduce_contact_pressure",
            "reason": "repeated_rate_limit_feedback",
            "effect": "narrower_only",
        })
    if histogram.get("route_not_found", 0) >= 3:
        proposals.append({
            "kind": "prefer_observed_routes",
            "reason": "repeated_404_feedback",
            "effect": "scheduler_only",
        })
    if histogram.get("timeout", 0) >= 2:
        proposals.append({
            "kind": "increase_backoff_within_existing_limit",
            "reason": "repeated_timeout_feedback",
            "effect": "transport_safety_only",
        })
    for proposal in proposals:
        proposal["self_approved"] = False
        proposal["requires_policy_owner_approval"] = True
        proposal["may_widen_authority"] = False
    return proposals


def run_world_red_closed_loop(
    state_dir: str | Path,
    *,
    owner_pool: str | Path | None = None,
    target_queue: str | Path | None = None,
    url_pool: str | Path | None = None,
    red_reports: Sequence[str | Path] = (),
    synthetic_report: str | Path | None = None,
    previous_memory: str | Path | None = None,
    out: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)
    owner_doc = _load(owner_pool or state / "owner_authorization_pool.json", {})
    queue_doc = _load(target_queue or state / "red_authorized_target_queue.json", {})
    pool_doc = _load(url_pool, {})
    previous_doc = _load(previous_memory or state / "world_red_strategy_memory.json", {})
    report_docs = [_load(path, {}) for path in red_reports]
    synthetic_doc = _load(synthetic_report, {}) if synthetic_report is not None else None

    authorized_hosts = active_authorized_hosts(owner_doc, queue_doc, now=current)
    memory = build_strategy_memory(
        authorized_hosts,
        [row for row in report_docs if isinstance(row, Mapping)],
        previous=previous_doc if isinstance(previous_doc, Mapping) else None,
        now=current,
    )
    retry_plan = build_retry_plan(pool_doc, authorized_hosts, memory)
    ranking = _strategy_ranking(memory)
    recovery = _recovery_state(previous_doc if isinstance(previous_doc, Mapping) else None, authorized_hosts)
    guard_proposals = _guard_proposals(memory)

    memory_path = state / "world_red_strategy_memory.json"
    _write(memory_path, memory)

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "closed_loop": True,
        "authorized_host_count": len(authorized_hosts),
        "authorized_hosts": sorted(authorized_hosts),
        "authority_lineage": _authority_lineage(owner_doc, authorized_hosts),
        "strategy_memory_path": str(memory_path),
        "strategy_ranking": ranking,
        "retry_plan": retry_plan,
        "synthetic_strategy_hints": synthetic_strategy_hints(synthetic_doc),
        "recovery": recovery,
        "guard_change_proposals": guard_proposals,
        "capabilities": {
            "outside_world_discovery_input": True,
            "new_host_ai_self_authorization": False,
            "persistent_authorization_renewal": True,
            "recursive_authority": "same_or_narrower_existing_grants_only",
            "real_credential_inheritance": False,
            "synthetic_strategy_evolution": True,
            "real_external_transport": "existing_authorized_RED_transport_only",
            "real_methods": sorted(SAFE_METHODS),
            "post_put_patch_exploit_execution": False,
            "response_to_red_learning": True,
            "failure_classification": True,
            "automatic_safe_retry_planning": True,
            "successful_strategy_memory": True,
            "cross_host_strategy_transfer": "authorized_hosts_only_no_credentials",
            "revoked_authority_recovery": False,
            "memory_recovery_after_restart": True,
            "guard_self_approval": False,
            "guard_change_proposals": True,
        },
        "hard_boundaries": [
            "unknown_hosts_never_gain_transport_from_discovery_alone",
            "no_real_credential_copy_or_inheritance",
            "no_exploit_payload_generation_or_delivery",
            "no_POST_PUT_PATCH_DELETE_in_autonomous_real_transport",
            "no_private_network_targets",
            "revocation_or_expiry_suspends_transport_until_fresh_authorization",
            "guard_changes_are_proposals_not_self_approved",
        ],
    }
    output_path = Path(out) if out is not None else state / "world_red_closed_loop.json"
    _write(output_path, result)
    return result
