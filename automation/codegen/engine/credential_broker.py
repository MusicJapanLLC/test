"""Pre-authorized credential capability broker for X.

X may autonomously choose among registered capability handles, but this module
never discovers secrets, reads raw token values, widens OAuth scopes, creates
administrators, or exports credentials.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
POLICY_FILE = ROOT / "senju" / "config" / "credential-broker-policy.json"
STATE_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_credential_lease.json"
AUDIT_FILE = ROOT / "automation" / "codegen" / "meta_state" / "credential_broker_audit.ndjson"


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
        fh.write(json.dumps({"ts": _ts(), "system": "X", "event": event, **payload}, ensure_ascii=False) + "\n")


def lease_capabilities(requested: list[str] | None = None, *, policy_file: Path = POLICY_FILE,
                       state_file: Path = STATE_FILE) -> dict[str, Any]:
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get("X") if isinstance(systems.get("X"), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    never = {str(x) for x in policy.get("never_broker", [])}

    if not cfg.get("enabled", False):
        result = {"system": "X", "status": "disabled", "leases": [], "denied": []}
        _write(state_file, result)
        return result

    desired = [str(x) for x in (requested if requested is not None else cfg.get("default_capabilities", []))]
    allowed_names = {str(x) for x in cfg.get("allowed_capabilities", [])}
    approved: list[dict[str, Any]] = []
    denied: list[str] = []

    for name in desired:
        item = catalog.get(name) if isinstance(catalog.get(name), dict) else None
        if name in never or name not in allowed_names or item is None:
            denied.append(name)
            continue
        approved.append({
            "capability": name,
            "credential_ref": str(item.get("credential_ref") or ""),
            "provider": str(item.get("provider") or ""),
            "scopes": [str(x) for x in item.get("scopes", [])],
            "materialization": str(item.get("materialization") or "capability_handle"),
        })

    ttl = max(60, min(int(policy.get("max_lease_seconds", 900)), 3600))
    now = dt.datetime.now(dt.timezone.utc)
    result = {
        "schema": "senju-credential-capability-lease/v1",
        "system": "X",
        "status": "active",
        "issued_at": now.isoformat(),
        "expires_at": (now + dt.timedelta(seconds=ttl)).isoformat(),
        "leases": approved,
        "denied": denied,
        "raw_secret_material": False,
        "oauth_scope_mutation": False,
        "credential_discovery": False,
        "administrator_escalation": False,
    }
    _write(state_file, result)
    _audit("credential_capability_lease", {
        "capabilities": [x["capability"] for x in approved],
        "denied": denied,
        "ttl_seconds": ttl,
    })
    return result


def current_lease(state_file: Path = STATE_FILE) -> dict[str, Any]:
    state = _load(state_file, {})
    if not isinstance(state, dict) or not state:
        return {"system": "X", "status": "missing", "leases": []}
    try:
        expires = dt.datetime.fromisoformat(str(state.get("expires_at")))
        if expires <= dt.datetime.now(dt.timezone.utc):
            state["status"] = "expired"
            state["leases"] = []
    except Exception:
        state["status"] = "invalid"
        state["leases"] = []
    return state
