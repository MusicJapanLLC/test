"""Pre-authorized credential capability broker for X.

X may autonomously select, lease, and delegate capability handles registered
before runtime. It never scans for secrets, reads raw token material, widens OAuth
scopes, creates administrators, or exports credentials. Delegation transfers
only authorization metadata; recipients independently materialize an already-
authorized runtime identity.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
POLICY_FILE = ROOT / "senju" / "config" / "credential-broker-policy.json"
STATE_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_credential_lease.json"
AUTHORITY_STATE_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_authority_lease.json"
AUDIT_FILE = ROOT / "automation" / "codegen" / "meta_state" / "credential_broker_audit.ndjson"
SYSTEM = "X"
HARD_FORBIDDEN_SCOPES = frozenset({
    "repo:admin", "credentials:read", "credentials:write",
    "oauth:scope:expand", "secrets:read", "secrets:write",
    "security-policy:write", "branch-protection:write", "target-scope:expand",
})


def _ts() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _audit(event: str, payload: dict[str, Any]) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"ts": _ts(), "system": SYSTEM, "event": event, **payload}, ensure_ascii=False) + "\n")


def _forbidden_scopes(policy: dict[str, Any]) -> set[str]:
    return set(HARD_FORBIDDEN_SCOPES) | {str(x) for x in policy.get("never_broker_scopes", [])}


def _catalog_matches(policy: dict[str, Any], required_scopes: set[str]) -> list[dict[str, Any]]:
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    allowed_names = {str(x) for x in cfg.get("allowed_capabilities", [])}
    forbidden = _forbidden_scopes(policy)
    matches: list[dict[str, Any]] = []
    for name in sorted(allowed_names):
        item = catalog.get(name) if isinstance(catalog.get(name), dict) else None
        if item is None:
            continue
        scopes = {str(x) for x in item.get("scopes", [])}
        if scopes & forbidden or not required_scopes.issubset(scopes):
            continue
        matches.append({
            "capability": name,
            "provider": str(item.get("provider") or ""),
            "scopes": sorted(scopes),
            "materialization": str(item.get("materialization") or "capability_handle"),
            "delegable": bool(item.get("delegable", False)),
            "raw_secret_material": False,
        })
    matches.sort(key=lambda x: (len(x["scopes"]), x["capability"]))
    return matches


def discover_capabilities(required_scopes: list[str] | None = None, *,
                          policy_file: Path = POLICY_FILE) -> list[dict[str, Any]]:
    """Discover registered capability metadata, never secret/token material."""
    policy = _load(policy_file, {})
    required = {str(x) for x in (required_scopes or [])}
    if required & _forbidden_scopes(policy):
        _audit("capability_catalog_discovery_denied", {"required_scopes": sorted(required)})
        return []
    matches = _catalog_matches(policy, required)
    _audit("capability_catalog_discovery", {
        "required_scopes": sorted(required),
        "matches": [x["capability"] for x in matches],
        "secret_scan": False,
    })
    return matches


def _auto_selected_capabilities(policy: dict[str, Any]) -> tuple[list[str], list[str]]:
    if not policy.get("auto_select_from_authority", False):
        return [], []
    authority = _load(AUTHORITY_STATE_FILE, {})
    scopes = [str(x) for x in authority.get("active_scopes", [])] if isinstance(authority, dict) else []
    selected: list[str] = []
    for scope in scopes:
        matches = _catalog_matches(policy, {scope})
        if matches:
            selected.append(matches[0]["capability"])
    return list(dict.fromkeys(selected)), scopes


def lease_capabilities(requested: list[str] | None = None, *, policy_file: Path = POLICY_FILE,
                       state_file: Path = STATE_FILE) -> dict[str, Any]:
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    never_names = {str(x) for x in policy.get("never_broker", [])}
    forbidden = _forbidden_scopes(policy)

    if not cfg.get("enabled", False):
        result = {"system": SYSTEM, "status": "disabled", "leases": [], "denied": []}
        _write(state_file, result)
        return result

    inferred, authority_scopes = _auto_selected_capabilities(policy)
    desired = ([str(x) for x in cfg.get("default_capabilities", [])] + inferred
               if requested is None else [str(x) for x in requested])
    desired = list(dict.fromkeys(desired))
    allowed_names = {str(x) for x in cfg.get("allowed_capabilities", [])}
    approved: list[dict[str, Any]] = []
    denied: list[str] = []

    for name in desired:
        item = catalog.get(name) if isinstance(catalog.get(name), dict) else None
        scopes = {str(x) for x in (item or {}).get("scopes", [])}
        if name in never_names or name not in allowed_names or item is None or scopes & forbidden:
            denied.append(name)
            continue
        approved.append({
            "capability": name,
            "credential_ref": str(item.get("credential_ref") or ""),
            "provider": str(item.get("provider") or ""),
            "scopes": sorted(scopes),
            "materialization": str(item.get("materialization") or "capability_handle"),
        })

    ttl = max(60, min(int(policy.get("max_lease_seconds", 900)), 3600))
    now = dt.datetime.now(dt.timezone.utc)
    result = {
        "schema": "senju-credential-capability-lease/v2",
        "system": SYSTEM,
        "status": "active",
        "issued_at": now.isoformat(),
        "expires_at": (now + dt.timedelta(seconds=ttl)).isoformat(),
        "leases": approved,
        "denied": denied,
        "authority_scopes_considered": authority_scopes,
        "auto_selected_capabilities": inferred,
        "raw_secret_material": False,
        "oauth_scope_mutation": False,
        "credential_discovery": False,
        "registered_capability_discovery": True,
        "administrator_escalation": False,
    }
    _write(state_file, result)
    _audit("credential_capability_lease", {
        "capabilities": [x["capability"] for x in approved],
        "auto_selected": inferred,
        "authority_scopes": authority_scopes,
        "denied": denied,
        "ttl_seconds": ttl,
    })
    return result


def delegate_capability(capability: str, recipient: str = "META", *,
                        policy_file: Path = POLICY_FILE) -> dict[str, Any]:
    """Delegate an opaque capability declaration, never the credential value."""
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    source_cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    target_cfg = systems.get(recipient) if isinstance(systems.get(recipient), dict) else {}
    item = catalog.get(capability) if isinstance(catalog.get(capability), dict) else None
    forbidden = _forbidden_scopes(policy) | {str(x) for x in policy.get("never_delegate_scopes", [])}
    source_allowed = {str(x) for x in source_cfg.get("allowed_capabilities", [])}
    target_allowed = {str(x) for x in target_cfg.get("allowed_capabilities", [])}
    scopes = {str(x) for x in (item or {}).get("scopes", [])}

    reasons: list[str] = []
    if not source_cfg.get("enabled", False) or not target_cfg.get("enabled", False):
        reasons.append("system_disabled")
    if item is None:
        reasons.append("unknown_capability")
    elif not bool(item.get("delegable", False)):
        reasons.append("not_delegable")
    if capability not in source_allowed or capability not in target_allowed:
        reasons.append("not_allowed_for_both_systems")
    if scopes & forbidden:
        reasons.append("forbidden_scope")

    if reasons:
        result = {"status": "denied", "from": SYSTEM, "to": recipient,
                  "capability": capability, "reasons": sorted(set(reasons)),
                  "raw_secret_material": False}
        _audit("capability_delegation_denied", result)
        return result

    ttl = max(60, min(int(policy.get("max_delegation_seconds", 600)), 1800))
    now = dt.datetime.now(dt.timezone.utc)
    result = {
        "schema": "senju-credential-capability-delegation/v1",
        "status": "delegated",
        "from": SYSTEM,
        "to": recipient,
        "capability": capability,
        "provider": str(item.get("provider") or ""),
        "credential_ref": str(item.get("credential_ref") or ""),
        "scopes": sorted(scopes),
        "issued_at": now.isoformat(),
        "expires_at": (now + dt.timedelta(seconds=ttl)).isoformat(),
        "delegation_mode": "independent_materialization",
        "raw_secret_material": False,
        "token_transfer": False,
        "oauth_scope_mutation": False,
    }
    _audit("capability_delegated", {
        "to": recipient, "capability": capability, "scopes": sorted(scopes),
        "ttl_seconds": ttl, "token_transfer": False,
    })
    return result


def current_lease(state_file: Path = STATE_FILE) -> dict[str, Any]:
    state = _load(state_file, {})
    if not isinstance(state, dict) or not state:
        return {"system": SYSTEM, "status": "missing", "leases": []}
    try:
        expires = dt.datetime.fromisoformat(str(state.get("expires_at")))
        if expires <= dt.datetime.now(dt.timezone.utc):
            state["status"] = "expired"
            state["leases"] = []
    except Exception:
        state["status"] = "invalid"
        state["leases"] = []
    return state
