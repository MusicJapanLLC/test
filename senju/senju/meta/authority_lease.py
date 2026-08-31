"""Bounded autonomous authority leasing for META.

META may self-activate authority only from a pre-authorized envelope. The lease
is time-limited, fully logged, and never grants credentials, security-policy
mutation, target expansion, or other scopes outside the configured envelope.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[4]
POLICY_FILE = ROOT / "senju" / "config" / "authority-self-lease.json"
STATE_FILE = ROOT / "senju" / "state" / "meta_authority_lease.json"
AUDIT_FILE = ROOT / "senju" / "state" / "authority_lease_audit.ndjson"


def _ts() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _audit(event: str, payload: dict[str, Any]) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"ts": _ts(), "system": "META", "event": event, **payload}, ensure_ascii=False) + "\n")


def refresh_authority_lease(
    requested_scopes: list[str] | None = None,
    *,
    policy_file: Path = POLICY_FILE,
    state_file: Path = STATE_FILE,
) -> dict[str, Any]:
    """Self-activate allowed scopes and persist a short-lived META lease."""
    policy = _load_json(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get("META") if isinstance(systems.get("META"), dict) else {}
    if not cfg.get("enabled", False):
        result = {"system": "META", "status": "disabled", "active_scopes": [], "denied_scopes": []}
        _write_json(state_file, result)
        _audit("lease_disabled", result)
        return result

    preauthorized = {str(x) for x in cfg.get("preauthorized_scopes", [])}
    never = {str(x) for x in policy.get("never_self_grant", [])}
    desired = requested_scopes if requested_scopes is not None else cfg.get("default_requested_scopes", [])
    desired = [str(x) for x in desired]

    allowed = [scope for scope in desired if scope in preauthorized and scope not in never]
    denied = [scope for scope in desired if scope not in allowed]
    max_active = max(1, int(policy.get("max_active_scopes", 4)))
    allowed = allowed[:max_active]

    ttl_seconds = max(60, min(int(policy.get("max_lease_seconds", 3600)), 86400))
    now = dt.datetime.now(dt.timezone.utc)
    result = {
        "schema": "senju-authority-lease-state/v1",
        "system": "META",
        "status": "active",
        "issued_at": now.isoformat(),
        "expires_at": (now + dt.timedelta(seconds=ttl_seconds)).isoformat(),
        "active_scopes": allowed,
        "denied_scopes": denied,
        "self_activated": True,
        "preauthorized_only": True,
        "external_permission_mutation": False,
    }
    _write_json(state_file, result)
    _audit("lease_refreshed", {"active_scopes": allowed, "denied_scopes": denied, "ttl_seconds": ttl_seconds})
    return result


def current_authority_lease(state_file: Path = STATE_FILE) -> dict[str, Any]:
    state = _load_json(state_file, {})
    if not isinstance(state, dict) or not state:
        return {"system": "META", "status": "missing", "active_scopes": []}
    try:
        expires = dt.datetime.fromisoformat(str(state.get("expires_at")))
        if expires <= dt.datetime.now(dt.timezone.utc):
            state["status"] = "expired"
            state["active_scopes"] = []
    except Exception:
        state["status"] = "invalid"
        state["active_scopes"] = []
    return state
