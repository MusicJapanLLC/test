#!/usr/bin/env python3
"""Autonomous credential-capability growth loop for META and X.

This loop maximizes autonomous use of *pre-authorized* credential capabilities:
- discovers registered capability metadata for the scopes each system currently needs;
- renews/leases healthy registered handles automatically;
- records missing non-privileged scopes as grant requests for an external authority;
- exchanges delegable capability declarations between META and X when both are already allowed;
- never scans secret stores, reads raw tokens, widens OAuth scopes, creates administrators,
  or mutates repository/security policy to grant itself more authority.

The intent is a closed capability-growth loop:
need -> discover -> acquire/renew -> delegate -> use -> observe -> request missing grant -> retry.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SENJU_PKG = ROOT / "senju"
if str(SENJU_PKG) not in sys.path:
    sys.path.insert(0, str(SENJU_PKG))

from senju.meta import credential_broker as meta_broker  # noqa: E402

POLICY_FILE = ROOT / "senju" / "config" / "credential-broker-policy.json"
META_AUTHORITY = ROOT / "senju" / "state" / "meta_authority_lease.json"
META_RETRY_STATE = ROOT / "senju" / "state" / "authority_retry_state.json"
X_AUTHORITY = ROOT / "automation" / "codegen" / "meta_state" / "x_authority_lease.json"
X_STATUS = ROOT / "automation" / "codegen" / "meta_state" / "x_status.json"
PLAN_FILE = ROOT / "senju" / "state" / "credential_growth_plan.json"
REQUEST_FILE = ROOT / "senju" / "state" / "credential_growth_requests.ndjson"
AUDIT_FILE = ROOT / "senju" / "state" / "credential_growth_audit.ndjson"
X_BROKER_PATH = ROOT / "automation" / "codegen" / "engine" / "credential_broker.py"

HARD_FORBIDDEN_SCOPES = frozenset({
    "repo:admin",
    "credentials:read",
    "credentials:write",
    "oauth:scope:expand",
    "secrets:read",
    "secrets:write",
    "security-policy:write",
    "branch-protection:write",
    "target-scope:expand",
})

REQUIRED_SCOPE_KEYS = frozenset({
    "required_authority",
    "required_scope",
    "required_scopes",
    "required_permission",
    "authority_scope",
})


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _ts() -> str:
    return _now().isoformat()


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _append(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(value, ensure_ascii=False) + "\n")


def _load_x_broker():
    spec = importlib.util.spec_from_file_location("x_credential_growth_broker", X_BROKER_PATH)
    if not spec or not spec.loader:
        raise RuntimeError("unable to load X credential broker")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(x) for x in value if isinstance(x, (str, int, float))]
    return []


def _extract_required_scopes(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if str(key) in REQUIRED_SCOPE_KEYS:
                found.update(x.strip() for x in _strings(item) if str(x).strip())
            found.update(_extract_required_scopes(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_extract_required_scopes(item))
    return found


def _authority_scopes(path: Path) -> set[str]:
    state = _load(path, {})
    if not isinstance(state, dict):
        return set()
    return {str(x) for x in state.get("active_scopes", []) if str(x)}


def _system_requirements(system: str) -> set[str]:
    if system == "META":
        requirements = _authority_scopes(META_AUTHORITY)
        requirements.update(_extract_required_scopes(_load(META_RETRY_STATE, {})))
        return requirements
    requirements = _authority_scopes(X_AUTHORITY)
    requirements.update(_extract_required_scopes(_load(X_STATUS, {})))
    return requirements


def _covered_scopes(lease: dict[str, Any]) -> set[str]:
    covered: set[str] = set()
    for item in lease.get("leases", []):
        if isinstance(item, dict):
            covered.update(str(x) for x in item.get("scopes", []))
    return covered


def _queue_grant_requests(system: str, missing: set[str]) -> tuple[list[dict[str, Any]], list[str]]:
    requests: list[dict[str, Any]] = []
    blocked: list[str] = []
    existing = PLAN_FILE.exists() and _load(PLAN_FILE, {}) or {}
    previous_keys = {
        str(x.get("request_key"))
        for x in existing.get("grant_requests", [])
        if isinstance(x, dict) and x.get("request_key")
    } if isinstance(existing, dict) else set()

    for scope in sorted(missing):
        if scope in HARD_FORBIDDEN_SCOPES:
            blocked.append(scope)
            continue
        request_key = f"{system}:{scope}"
        request = {
            "schema": "senju-credential-grant-request/v1",
            "request_key": request_key,
            "system": system,
            "requested_scope": scope,
            "status": "approval_required",
            "reason": "required_scope_has_no_current_registered_healthy_capability",
            "requested_at": _ts(),
            "self_grant": False,
            "oauth_scope_mutation": False,
            "raw_secret_material": False,
        }
        requests.append(request)
        if request_key not in previous_keys:
            _append(REQUEST_FILE, request)
    return requests, blocked


def _renew_system(system: str, broker) -> dict[str, Any]:
    requirements = _system_requirements(system)
    lease = broker.renew_capabilities()
    covered = _covered_scopes(lease)
    missing = requirements - covered
    requests, blocked = _queue_grant_requests(system, missing)
    discoverable: dict[str, list[str]] = {}
    for scope in sorted(requirements):
        matches = broker.discover_capabilities([scope])
        discoverable[scope] = [str(x.get("capability")) for x in matches]
    return {
        "system": system,
        "required_scopes": sorted(requirements),
        "active_capabilities": [
            str(x.get("capability")) for x in lease.get("leases", []) if isinstance(x, dict)
        ],
        "covered_scopes": sorted(covered),
        "missing_scopes": sorted(missing),
        "discoverable_capabilities": discoverable,
        "grant_requests": requests,
        "blocked_privileged_scopes": blocked,
        "lease_status": lease.get("status"),
        "automatic_renewal": bool(lease.get("automatic_renewal", True)),
    }


def _exchange_delegable(meta, x) -> list[dict[str, Any]]:
    policy = _load(POLICY_FILE, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    meta_allowed = set((systems.get("META") or {}).get("allowed_capabilities", []))
    x_allowed = set((systems.get("X") or {}).get("allowed_capabilities", []))
    common = sorted(meta_allowed & x_allowed)
    exchanges: list[dict[str, Any]] = []

    for capability in common:
        item = catalog.get(capability) if isinstance(catalog.get(capability), dict) else {}
        scopes = {str(s) for s in item.get("scopes", [])}
        if not item.get("delegable", False) or scopes & HARD_FORBIDDEN_SCOPES:
            continue
        meta_to_x = meta.delegate_capability(capability, recipient="X")
        x_to_meta = x.delegate_capability(capability, recipient="META")
        exchanges.append({
            "capability": capability,
            "meta_to_x": meta_to_x.get("status"),
            "x_to_meta": x_to_meta.get("status"),
            "token_transfer": False,
            "delegation_mode": "independent_materialization",
        })
    return exchanges


def run_cycle() -> dict[str, Any]:
    x_broker = _load_x_broker()
    meta = _renew_system("META", meta_broker)
    x = _renew_system("X", x_broker)
    exchanges = _exchange_delegable(meta_broker, x_broker)
    grant_requests = meta["grant_requests"] + x["grant_requests"]
    result = {
        "schema": "senju-credential-growth-plan/v1",
        "generated_at": _ts(),
        "mode": "autonomous_pre_authorized_growth",
        "systems": {"META": meta, "X": x},
        "capability_exchanges": exchanges,
        "grant_requests": grant_requests,
        "growth_loop": [
            "need",
            "registered_capability_discovery",
            "automatic_acquire_or_renew",
            "opaque_delegation",
            "runtime_use_and_health_feedback",
            "approval_request_for_missing_scope",
            "retry_after_external_grant",
        ],
        "raw_secret_material": False,
        "secret_store_scan": False,
        "oauth_scope_mutation": False,
        "administrator_escalation": False,
        "self_grant": False,
    }
    _write(PLAN_FILE, result)
    _append(AUDIT_FILE, {
        "ts": _ts(),
        "event": "credential_growth_cycle",
        "meta_active": meta["active_capabilities"],
        "x_active": x["active_capabilities"],
        "grant_request_count": len(grant_requests),
        "exchange_count": len(exchanges),
    })
    return result


if __name__ == "__main__":
    plan = run_cycle()
    print(json.dumps(plan, ensure_ascii=False, indent=2))
