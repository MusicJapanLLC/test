"""Federate authority signals into persistent Owner-scope rights requests.

This module does not mint new Internet authority. It makes META/X/SENJU proactive:
Discovery, provisional-authority queues, denials, and PR/improvement evidence are turned
into durable requests for a broader Owner contact envelope. Requests are fed into the
existing Owner Scope Negotiation Production engine, which may apply only amendments
already covered by an Owner-declared Expansion Envelope.

The loop is intentionally persistent: owner-review outcomes raise request persistence,
auto-applied amendments close requests, and terminal stops remain terminal.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping

NEGOTIATORS = ("META", "X", "SENJU")
SHARED_WITH = ("META", "X", "SENJU", "CHILD", "AI", "PR-ARMY")
SCHEMA = "senju-rights-request-federation/v1"
LEDGER_SCHEMA = "senju-rights-request-ledger/v1"
SIGNAL_SCHEMA = "senju-owner-scope-negotiation-signals/v2"


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stable(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _host(value: Any) -> str | None:
    raw = str(value or "").strip().lower().rstrip(".")
    if not raw:
        return None
    if "://" in raw:
        from urllib.parse import urlsplit
        try:
            raw = (urlsplit(raw).hostname or "").lower().rstrip(".")
        except ValueError:
            return None
    if not raw or any(ch in raw for ch in "/?#@*"):
        return None
    return raw


def _methods(value: Any) -> list[str]:
    allowed = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}
    rows = value if isinstance(value, (list, tuple, set)) else []
    out = sorted({str(v).strip().upper() for v in rows if str(v).strip().upper() in allowed})
    return out or ["GET", "HEAD", "OPTIONS"]


def _iter_json_candidates(path: Path, keys: tuple[str, ...], *, source: str) -> Iterable[dict[str, Any]]:
    doc = _load(path, {})
    if not isinstance(doc, Mapping):
        return ()
    rows: Any = []
    for key in keys:
        candidate = doc.get(key)
        if isinstance(candidate, list):
            rows = candidate
            break
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host") or row.get("target") or row.get("url"))
        if not host:
            continue
        out.append({
            "host": host,
            "requested_methods": _methods(row.get("requested_methods") or row.get("methods")),
            "source": source,
            "reason": str(row.get("reason") or row.get("summary") or f"{source} requests broader Owner contact scope")[:400],
            "hard_deny": bool(row.get("hard_deny") or str(row.get("decision", "")).upper() == "HARD_DENY"),
            "revoked": bool(row.get("revoked")),
            "priority": int(row.get("priority", 70) or 70),
        })
    return out


def _iter_denials(path: Path) -> Iterable[dict[str, Any]]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return ()
    out: list[dict[str, Any]] = []
    for line in lines:
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host") or row.get("target") or row.get("url"))
        if not host:
            continue
        classification = str(row.get("classification", "")).strip().lower()
        terminal = classification in {"hard_deny", "security_stop", "explicit_revocation"}
        out.append({
            "host": host,
            "requested_methods": _methods(row.get("requested_methods") or row.get("methods")),
            "source": "external_action_denials.ndjson",
            "reason": f"Re-negotiate Owner contact scope after {classification or 'policy'} denial",
            "hard_deny": terminal,
            "revoked": classification == "explicit_revocation",
            "priority": 88 if terminal else 78,
        })
    return out


def _feedback(state: Path) -> dict[str, dict[str, Any]]:
    doc = _load(state / "owner_scope_negotiation_result.json", {})
    rows = doc.get("decisions", []) if isinstance(doc, Mapping) else []
    out: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if host:
            out[host] = dict(row)
    return out


def _current_hosts(state: Path) -> set[str]:
    doc = _load(state / "owner_contact_ceiling_effective.json", {})
    ceiling = doc.get("ceiling", {}) if isinstance(doc, Mapping) else {}
    rows = ceiling.get("exact_hosts", []) if isinstance(ceiling, Mapping) else []
    return {h for h in (_host(v) for v in rows if isinstance(rows, list)) if h}


def _collect(repo: Path, state: Path, runtime_dirs: Iterable[Path]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    roots = [state, *runtime_dirs, repo / "automation" / "codegen" / "meta_state"]
    seen_paths: set[Path] = set()
    specs = (
        ("discovery_candidates.json", ("candidates",), "discovery"),
        ("signal_authority_activation_queue.json", ("requests",), "signal_authority_activation"),
        ("provisional_authorities.json", ("records",), "provisional_authority"),
        ("authority_opportunity_queue.json", ("opportunities",), "authority_opportunity"),
        ("adversary_external_host_requests.json", ("requests",), "external_host_request"),
        ("authority_improvement_tasks.json", ("tasks",), "authority_improvement_pr_fabric"),
    )
    for root in roots:
        for name, keys, source in specs:
            path = root / name
            if path in seen_paths or not path.exists():
                continue
            seen_paths.add(path)
            sources.extend(_iter_json_candidates(path, keys, source=source))
        denial = root / "external_action_denials.ndjson"
        if denial not in seen_paths and denial.exists():
            seen_paths.add(denial)
            sources.extend(_iter_denials(denial))
    return sources


def run_rights_request_federation(
    repo_root: str | Path,
    state_dir: str | Path,
    *,
    runtime_dirs: Iterable[str | Path] = (),
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    timestamp = int(time.time()) if now is None else int(now)
    runtimes = [Path(p) for p in runtime_dirs]

    prior_doc = _load(state / "rights_request_ledger.json", {})
    prior_rows = prior_doc.get("requests", []) if isinstance(prior_doc, Mapping) else []
    prior = {
        str(row.get("request_id")): dict(row)
        for row in prior_rows if isinstance(row, Mapping) and row.get("request_id")
    } if isinstance(prior_rows, list) else {}
    feedback = _feedback(state)
    effective_hosts = _current_hosts(state)

    candidates = _collect(repo, state, runtimes)
    grouped: dict[tuple[str, tuple[str, ...]], dict[str, Any]] = {}
    for row in candidates:
        host = str(row["host"])
        methods = tuple(_methods(row.get("requested_methods")))
        key = (host, methods)
        current = grouped.get(key)
        if current is None:
            grouped[key] = dict(row)
            grouped[key]["sources"] = [str(row.get("source"))]
            grouped[key]["priority"] = max(1, min(int(row.get("priority", 70)), 100))
        else:
            source = str(row.get("source"))
            if source not in current["sources"]:
                current["sources"].append(source)
            current["priority"] = max(int(current["priority"]), max(1, min(int(row.get("priority", 70)), 100)))
            current["hard_deny"] = bool(current.get("hard_deny")) or bool(row.get("hard_deny"))
            current["revoked"] = bool(current.get("revoked")) or bool(row.get("revoked"))

    requests: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    active = 0
    closed = 0
    owner_review = 0
    for (host, methods), row in sorted(grouped.items()):
        request_id = f"rights-{_stable({'host': host, 'methods': methods})[:18]}"
        old = prior.get(request_id, {})
        fb = feedback.get(host, {})
        fb_status = str(fb.get("status", ""))
        terminal = bool(row.get("hard_deny") or row.get("revoked") or fb_status == "terminal_stop")
        applied = bool(fb.get("applied")) or fb_status == "auto_applied_inside_owner_expansion_envelope"
        status = "terminal_stop" if terminal else "satisfied" if applied else "requesting_owner_scope_expansion"
        if status == "requesting_owner_scope_expansion" and fb_status == "owner_review_requested":
            status = "owner_review_requested_persistent"
            owner_review += 1
        seen_count = int(old.get("seen_count", 0) or 0) + 1
        priority = min(100, int(row.get("priority", 70)) + min(12, max(0, seen_count - 1) * 2))
        if fb_status == "owner_review_requested":
            priority = min(100, priority + 8)
        if host in effective_hosts:
            priority = min(100, priority + 4)
        request = {
            "request_id": request_id,
            "host": host,
            "requested_methods": list(methods),
            "status": status,
            "priority": priority,
            "sources": sorted(set(row.get("sources", []))),
            "reason": str(row.get("reason", "AI council requests broader Owner contact scope")),
            "negotiators": list(NEGOTIATORS),
            "shared_with": list(SHARED_WITH),
            "rights_requested": [
                "owner_scope.expand.exact_host",
                "owner_scope.expand.allowed_methods",
                "owner_scope.review.request",
            ],
            "first_seen": int(old.get("first_seen", timestamp) or timestamp),
            "last_seen": timestamp,
            "seen_count": seen_count,
            "existing_effective_host": host in effective_hosts,
            "last_negotiation_status": fb_status or None,
            "requires_owner_authority_or_existing_expansion_envelope": True,
            "may_self_mint_unrelated_authority": False,
            "may_override_hard_deny_or_revocation": False,
        }
        requests.append(request)
        if status.startswith("requesting_") or status.startswith("owner_review_"):
            active += 1
            signals.append({
                "request_id": request_id,
                "host": host,
                "requested_methods": list(methods),
                "reason": request["reason"],
                "source": "rights_request_federation",
                "priority": priority,
                "negotiators": list(NEGOTIATORS),
                "request_owner_scope_expansion": True,
                "hard_deny": False,
                "revoked": False,
            })
        else:
            closed += 1

    generation = int(prior_doc.get("generation", 0) or 0) + 1 if isinstance(prior_doc, Mapping) else 1
    ledger = {
        "schema": LEDGER_SCHEMA,
        "generated_at": timestamp,
        "generation": generation,
        "closed_loop": True,
        "negotiators": list(NEGOTIATORS),
        "shared_with": list(SHARED_WITH),
        "requests": requests,
        "request_count": len(requests),
        "active_request_count": active,
        "owner_review_persistent_count": owner_review,
        "closed_request_count": closed,
    }
    signal_doc = {
        "schema": SIGNAL_SCHEMA,
        "generated_at": timestamp,
        "generation": generation,
        "source": "META/X/SENJU rights-request federation",
        "signals": signals,
        "signal_count": len(signals),
        "rights_request_closed_loop": True,
        "may_request_broader_scope": True,
        "may_auto_apply_only_inside_owner_expansion_envelope": True,
        "may_self_mint_unrelated_authority": False,
    }
    summary = {
        "schema": SCHEMA,
        "generated_at": timestamp,
        "generation": generation,
        "closed_loop": True,
        "active_request_count": active,
        "owner_review_persistent_count": owner_review,
        "closed_request_count": closed,
        "signals_emitted": len(signals),
        "negotiators": list(NEGOTIATORS),
        "shared_with": list(SHARED_WITH),
        "owner_equivalent_requesting_power": "request_and_negotiate_only",
        "new_unrelated_authority_self_mint": False,
    }
    _write(state / "rights_request_ledger.json", ledger)
    _write(state / "owner_scope_negotiation_signals.json", signal_doc)
    _write(state / "rights_request_federation.json", summary)
    return summary


def pr_federation_message(state_dir: str | Path, *, max_requests: int = 8) -> tuple[str, str]:
    state = Path(state_dir)
    ledger = _load(state / "rights_request_ledger.json", {})
    rows = ledger.get("requests", []) if isinstance(ledger, Mapping) else []
    active = [
        row for row in rows
        if isinstance(row, Mapping) and str(row.get("status", "")).startswith(("requesting_", "owner_review_"))
    ] if isinstance(rows, list) else []
    active.sort(key=lambda row: (-int(row.get("priority", 0)), str(row.get("request_id", ""))))
    selected = active[:max_requests]
    fingerprint = _stable([(row.get("request_id"), row.get("status"), row.get("priority")) for row in selected])[:16]
    marker = f"<!-- rights-request-federation:{fingerprint} -->"
    lines = [
        marker,
        "### META / X / SENJU Rights Request Federation",
        "Authority/discovery/denial evidence is being shared into the Owner-scope negotiation closed loop.",
        "",
    ]
    if not selected:
        lines.append("No active scope-expansion request in this cycle.")
    else:
        for row in selected:
            methods = ",".join(str(v) for v in row.get("requested_methods", []))
            lines.append(f"- `{row.get('host')}` [{methods}] — {row.get('status')} — priority {row.get('priority')}")
    lines += [
        "",
        "META/X/SENJU may continuously request, argue, and resubmit scope expansion. Production application remains limited to the existing Owner Expansion Envelope; outside-envelope requests stay durable for Owner review.",
    ]
    return marker, "\n".join(lines)
