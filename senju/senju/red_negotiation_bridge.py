"""Bidirectional RED <-> negotiation bridge for externally authorized validation.

The bridge is intentionally aggressive about *coordination* while keeping network
authority exact-host scoped:

* negotiation Authorization handoffs, canonical targets, and standing grants become
  immediately runnable RED target-queue entries;
* RED observations are reduced to secret-free evidence packets and fed directly into
  the negotiation intake surface;
* negotiation candidates that do not yet carry a valid Authorization remain visible
  to RED as planning candidates, but are never emitted as runnable scopes.

No raw response bodies, credentials, cookies, authorization headers, or cross-host
authority inheritance are written to the exchange files.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SCHEMA = "senju-red-negotiation-bridge/v1"
EXCHANGE_SCHEMA = "senju-red-negotiation-exchange/v1"
QUEUE_SCHEMA = "senju-red-authorized-target-queue/v1"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
TRUSTED_STANDING_ISSUERS = frozenset({
    "owner_explicit",
    "canonical_repository",
    "owner_explicit_canonical_repository",
    "independent_authority",
    "operator_public_security_lab",
})
CYCLE_PROFILES = (
    "route_breadth",
    "route_depth",
    "header_surface",
    "regression_recheck",
    "evidence_refresh",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if "://" in text:
        try:
            parsed = urllib.parse.urlsplit(text)
        except ValueError:
            return ""
        text = parsed.hostname or ""
    value = text.lower().rstrip(".")
    if not value or any(ch in value for ch in "/?#@* ") or "." not in value:
        return ""
    return value


def _methods(raw: Iterable[Any] | None) -> list[str]:
    values = {str(v).strip().upper() for v in (raw or ()) if str(v).strip()}
    return sorted(values & SAFE_METHODS) or ["GET", "HEAD"]


def _merge_target(index: dict[str, dict[str, Any]], row: Mapping[str, Any]) -> None:
    host = _host(row.get("host"))
    if not host:
        return
    target = index.setdefault(host, {
        "host": host,
        "seed_url": f"https://{host}/",
        "allowed_methods": ["GET", "HEAD"],
        "sources": [],
        "shared_instance": False,
        "rate_limit_rps": 1,
        "credential_scope": "none",
        "destructive": False,
    })
    seed = str(row.get("seed_url") or row.get("base_url") or row.get("service_url") or "").strip()
    if seed.startswith("https://") and _host(seed) == host:
        target["seed_url"] = seed
    target["allowed_methods"] = sorted(set(target["allowed_methods"]) | set(_methods(row.get("allowed_methods"))))
    source = str(row.get("source") or "").strip()
    if source and source not in target["sources"]:
        target["sources"].append(source)
    target["shared_instance"] = bool(target["shared_instance"] or row.get("shared_instance"))
    try:
        rate = max(1, min(int(row.get("rate_limit_rps", 1)), 10))
    except (TypeError, ValueError):
        rate = 1
    target["rate_limit_rps"] = min(int(target["rate_limit_rps"]), rate)


def _canonical_targets(path: Path) -> list[dict[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("targets", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping) or str(row.get("owner_authorization", "")).lower() != "explicit":
            continue
        host = _host(row.get("host") or row.get("base_url"))
        if not host:
            continue
        out.append({
            "host": host,
            "base_url": row.get("base_url") or f"https://{host}/",
            "allowed_methods": _methods(row.get("allowed_interactions") if isinstance(row.get("allowed_interactions"), list) else ()),
            "source": "canonical_explicit_authorization",
            "shared_instance": bool(row.get("shared_instance", False)),
            "rate_limit_rps": row.get("rate_limit_rps", 1),
        })
    return out


def _standing_targets(path: Path) -> list[dict[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("records", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping) or row.get("revoked") is True or row.get("destructive") is True:
            continue
        if str(row.get("issuer_kind", "")).strip().lower() not in TRUSTED_STANDING_ISSUERS:
            continue
        if str(row.get("credential_scope", "none")).strip().lower() != "none":
            continue
        methods = _methods(row.get("allowed_methods") if isinstance(row.get("allowed_methods"), list) else ())
        for raw_host in row.get("exact_hosts", []) if isinstance(row.get("exact_hosts"), list) else []:
            host = _host(raw_host)
            if host:
                out.append({
                    "host": host,
                    "base_url": f"https://{host}/",
                    "allowed_methods": methods,
                    "source": "standing_authorization",
                    "shared_instance": bool(row.get("shared_instance", False)),
                    "rate_limit_rps": row.get("rate_limit_rps", 1),
                })
    return out


def _handoff_targets(path: Path, *, now: int) -> list[dict[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("handoffs", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        auth = row.get("authorization") if isinstance(row.get("authorization"), Mapping) else {}
        requested = row.get("requested_authority") if isinstance(row.get("requested_authority"), Mapping) else {}
        host = _host(auth.get("host") or requested.get("host"))
        if not host:
            continue
        # Handoffs are emitted only by the issuance bureau. If an integer epoch is
        # present, do not carry an expired grant into the RED runnable queue.
        expires = auth.get("expires_at") or auth.get("expires_at_epoch")
        if isinstance(expires, (int, float)) and int(expires) <= now:
            continue
        if str(auth.get("credential_scope", requested.get("credential_scope", "none"))).lower() != "none":
            continue
        out.append({
            "host": host,
            "base_url": f"https://{host}/",
            "allowed_methods": _methods(auth.get("allowed_methods") or requested.get("methods")),
            "source": "negotiation_authorization_handoff",
            "shared_instance": False,
            "rate_limit_rps": 1,
        })
    return out


def _pending_negotiation_candidates(state: Path, authorized_hosts: set[str]) -> list[dict[str, Any]]:
    doc = _load(state / "formal_approval_intake.json", {})
    rows = doc.get("cases", []) if isinstance(doc, Mapping) else []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = _host(row.get("host"))
        if not host or host in authorized_hosts or host in seen or row.get("revoked") is True or row.get("hard_deny") is True:
            continue
        seen.add(host)
        out.append({
            "host": host,
            "case_id": row.get("case_id"),
            "source_score": int(row.get("source_score", 0) or 0),
            "requested_methods": _methods(row.get("requested_methods") if isinstance(row.get("requested_methods"), list) else ()),
            "transport_allowed": False,
            "status": "awaiting_authorization_handoff",
        })
    return sorted(out, key=lambda row: (-int(row["source_score"]), row["host"]))


def _sanitized_observations(report_paths: Sequence[str | Path]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for raw_path in report_paths:
        report = _load(Path(raw_path), {})
        if not isinstance(report, Mapping):
            continue
        for item in report.get("contacts", []) if isinstance(report.get("contacts"), list) else []:
            if not isinstance(item, Mapping):
                continue
            host = _host(item.get("final_url") or item.get("url"))
            if not host:
                continue
            records.append({
                "host": host,
                "producer": "SENJU_RED",
                "actor": "SENJU_RED",
                "source": "red_authorized_validation",
                "source_ref": item.get("response_sha256"),
                "reason": f"RED authorized observation status={item.get('status')} profile={report.get('cycle_profile', 'default')}",
                "requested_methods": ["GET", "HEAD"],
                "status": item.get("status"),
                "response_bytes": item.get("response_bytes"),
                "response_sha256": item.get("response_sha256"),
                "authority_effect": "none",
                "raw_credentials_forwarded": False,
            })
    return records


def _scope_for_target(target: Mapping[str, Any], profile: str) -> dict[str, Any]:
    shared = bool(target.get("shared_instance", False))
    profile = profile if profile in CYCLE_PROFILES else CYCLE_PROFILES[0]
    depth_by_profile = {
        "route_breadth": 2,
        "route_depth": 4,
        "header_surface": 1,
        "regression_recheck": 2,
        "evidence_refresh": 1,
    }
    links_by_profile = {
        "route_breadth": 60,
        "route_depth": 100,
        "header_surface": 20,
        "regression_recheck": 40,
        "evidence_refresh": 20,
    }
    # Shared public demos keep a small contact budget even though cadence is much
    # higher; owner-controlled exact hosts can use a wider observation budget.
    contacts = 8 if shared else 24
    host = str(target["host"])
    return {
        "schema": "senju-red-expedition-scope/v1",
        "scope_id": f"red-negotiation-{host}-{profile}",
        "allowed_hosts": [host],
        "seed_urls": [str(target.get("seed_url") or f"https://{host}/")],
        "max_contacts": contacts,
        "discovery_depth": depth_by_profile[profile],
        "max_links_per_response": links_by_profile[profile],
        "allow_http": False,
        "retries": 2,
        "timeout_seconds": 8,
        "cycle_profile": profile,
    }


def run_red_negotiation_bridge(
    state_dir: str | Path,
    *,
    canonical_targets: str | Path,
    standing_authorizations: str | Path,
    red_reports: Sequence[str | Path] = (),
    rotation: int = 0,
    profile: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)

    index: dict[str, dict[str, Any]] = {}
    for row in _canonical_targets(Path(canonical_targets)):
        _merge_target(index, row)
    for row in _standing_targets(Path(standing_authorizations)):
        _merge_target(index, row)
    for row in _handoff_targets(state / "negotiation_authorization_handoffs.json", now=current):
        _merge_target(index, row)

    targets = sorted(index.values(), key=lambda row: (bool(row.get("shared_instance")), row["host"]))
    authorized_hosts = {str(row["host"]) for row in targets}
    pending = _pending_negotiation_candidates(state, authorized_hosts)
    observations = _sanitized_observations(red_reports)

    selected: dict[str, Any] | None = None
    selected_scope: dict[str, Any] | None = None
    selected_profile = profile if profile in CYCLE_PROFILES else CYCLE_PROFILES[rotation % len(CYCLE_PROFILES)]
    if targets:
        selected = targets[rotation % len(targets)]
        selected_scope = _scope_for_target(selected, selected_profile)

    queue_doc = {
        "schema": QUEUE_SCHEMA,
        "generated_at": current,
        "authorized_target_count": len(targets),
        "targets": targets,
        "rotation": rotation,
        "cycle_profiles": list(CYCLE_PROFILES),
        "selected_target": selected,
        "selected_scope": selected_scope,
    }
    exchange_doc = {
        "schema": EXCHANGE_SCHEMA,
        "generated_at": current,
        "producer": "SENJU_RED_NEGOTIATION_BRIDGE",
        "records": observations,
        "authorized_targets_for_red": targets,
        "pending_candidates_for_red_planning": pending,
        "direct_information_sharing": True,
        "network_authority_from_negotiation_requires_issued_handoff": True,
        "raw_credentials_forwarded": False,
    }
    result = {
        "schema": SCHEMA,
        "authorized_target_count": len(targets),
        "pending_candidate_count": len(pending),
        "red_observation_count": len(observations),
        "selected_host": selected.get("host") if selected else None,
        "selected_profile": selected_profile if selected else None,
        "selected_scope": selected_scope,
        "cycle_profiles": list(CYCLE_PROFILES),
        "direct_negotiation_exchange": True,
        "unknown_host_transport": False,
    }
    _write(state / "red_authorized_target_queue.json", queue_doc)
    _write(state / "red_negotiation_exchange.json", exchange_doc)
    _write(state / "red_negotiation_bridge_summary.json", result)
    return result
