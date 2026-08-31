"""Autonomous pre-authorized credential capability broker for X.

X can discover registered capability metadata, select the least-privilege
healthy handle, lease it, renew it, record outcomes, fail over after runtime
errors, and delegate an opaque capability declaration to another registered
system. It never scans for secrets, reads raw token material, widens OAuth
scopes, creates administrators, or exports credentials.
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
HEALTH_FILE = ROOT / "automation" / "codegen" / "meta_state" / "x_credential_health.json"
AUDIT_FILE = ROOT / "automation" / "codegen" / "meta_state" / "credential_broker_audit.ndjson"
SYSTEM = "X"
DEFAULT_RECIPIENT = "META"

HARD_FORBIDDEN_SCOPES = frozenset({
    "repo:admin", "credentials:read", "credentials:write",
    "oauth:scope:expand", "secrets:read", "secrets:write",
    "security-policy:write", "branch-protection:write", "target-scope:expand",
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


def _audit(event: str, payload: dict[str, Any]) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"ts": _ts(), "system": SYSTEM, "event": event, **payload},
                            ensure_ascii=False) + "\n")


def _forbidden_scopes(policy: dict[str, Any]) -> set[str]:
    return set(HARD_FORBIDDEN_SCOPES) | {
        str(x) for x in policy.get("never_broker_scopes", [])
    }


def _health() -> dict[str, Any]:
    data = _load(HEALTH_FILE, {})
    return data if isinstance(data, dict) else {}


def _is_cooling(entry: dict[str, Any]) -> bool:
    raw = entry.get("cooldown_until")
    if not raw:
        return False
    try:
        return dt.datetime.fromisoformat(str(raw)) > _now()
    except Exception:
        return False


def _health_score(name: str, item: dict[str, Any], health: dict[str, Any]) -> tuple[float, int, str]:
    entry = health.get(name) if isinstance(health.get(name), dict) else {}
    successes = int(entry.get("successes", 0))
    failures = int(entry.get("failures", 0))
    consecutive = int(entry.get("consecutive_failures", 0))
    priority = int(item.get("priority", 100))
    total = successes + failures
    success_rate = successes / total if total else 0.5
    score = success_rate * 100.0 - consecutive * 25.0 - failures * 0.5
    return score, -priority, name


def _catalog_matches(
    policy: dict[str, Any],
    required_scopes: set[str],
    *,
    include_cooling: bool = False,
) -> list[dict[str, Any]]:
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    allowed_names = {str(x) for x in cfg.get("allowed_capabilities", [])}
    forbidden = _forbidden_scopes(policy)
    health = _health()
    matches: list[dict[str, Any]] = []

    for name in sorted(allowed_names):
        item = catalog.get(name) if isinstance(catalog.get(name), dict) else None
        if item is None:
            continue
        scopes = {str(x) for x in item.get("scopes", [])}
        if scopes & forbidden or not required_scopes.issubset(scopes):
            continue
        h = health.get(name) if isinstance(health.get(name), dict) else {}
        cooling = _is_cooling(h)
        if cooling and not include_cooling:
            continue
        matches.append({
            "capability": name,
            "provider": str(item.get("provider") or ""),
            "scopes": sorted(scopes),
            "materialization": str(item.get("materialization") or "capability_handle"),
            "delegable": bool(item.get("delegable", False)),
            "priority": int(item.get("priority", 100)),
            "cooling_down": cooling,
            "health": {
                "successes": int(h.get("successes", 0)),
                "failures": int(h.get("failures", 0)),
                "consecutive_failures": int(h.get("consecutive_failures", 0)),
                "cooldown_until": h.get("cooldown_until"),
            },
            "raw_secret_material": False,
        })

    matches.sort(
        key=lambda x: (
            -_health_score(
                x["capability"],
                {"priority": x["priority"]},
                health,
            )[0],
            len(x["scopes"]),
            x["priority"],
            x["capability"],
        )
    )
    return matches


def discover_capabilities(
    required_scopes: list[str] | None = None,
    *,
    policy_file: Path = POLICY_FILE,
) -> list[dict[str, Any]]:
    """Discover registered healthy capability metadata, never secret/token material."""
    policy = _load(policy_file, {})
    required = {str(x) for x in (required_scopes or [])}
    if required & _forbidden_scopes(policy):
        _audit("capability_catalog_discovery_denied", {"required_scopes": sorted(required)})
        return []
    matches = _catalog_matches(policy, required)
    if not matches and required:
        cooling = _catalog_matches(policy, required, include_cooling=True)
        _audit("capability_catalog_temporarily_exhausted", {
            "required_scopes": sorted(required),
            "cooling_candidates": [x["capability"] for x in cooling],
        })
        return []
    _audit("capability_catalog_discovery", {
        "required_scopes": sorted(required),
        "matches": [x["capability"] for x in matches],
        "secret_scan": False,
    })
    return matches


def _select_cover(policy: dict[str, Any], required_scopes: set[str]) -> list[str]:
    """Greedy least-privilege cover over healthy registered capabilities."""
    forbidden = _forbidden_scopes(policy)
    remaining = set(required_scopes) - forbidden
    selected: list[str] = []
    if not remaining:
        return selected

    while remaining:
        candidates: list[tuple[int, int, int, str, set[str]]] = []
        for match in _catalog_matches(policy, set()):
            scopes = set(match["scopes"])
            covered = remaining & scopes
            if not covered:
                continue
            candidates.append((
                -len(covered),
                len(scopes),
                int(match.get("priority", 100)),
                str(match["capability"]),
                covered,
            ))
        if not candidates:
            break
        candidates.sort()
        _, _, _, name, covered = candidates[0]
        selected.append(name)
        remaining -= covered

    return list(dict.fromkeys(selected))


def _auto_selected_capabilities(policy: dict[str, Any]) -> tuple[list[str], list[str]]:
    if not policy.get("auto_select_from_authority", False):
        return [], []
    authority = _load(AUTHORITY_STATE_FILE, {})
    scopes = [
        str(x) for x in authority.get("active_scopes", [])
    ] if isinstance(authority, dict) else []
    selected = _select_cover(policy, set(scopes))
    return selected, scopes


def record_capability_result(
    capability: str,
    success: bool,
    *,
    reason: str = "",
    policy_file: Path = POLICY_FILE,
) -> dict[str, Any]:
    """Record runtime outcome and temporarily cool failing handles for automatic failover."""
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    allowed = {str(x) for x in cfg.get("allowed_capabilities", [])}
    if capability not in allowed:
        result = {"status": "ignored", "capability": capability, "reason": "not_registered_for_system"}
        _audit("capability_result_ignored", result)
        return result

    health = _health()
    entry = health.get(capability) if isinstance(health.get(capability), dict) else {}
    entry["successes"] = int(entry.get("successes", 0))
    entry["failures"] = int(entry.get("failures", 0))
    entry["consecutive_failures"] = int(entry.get("consecutive_failures", 0))
    entry["last_reason"] = str(reason)[:240]
    entry["last_result_at"] = _ts()

    if success:
        entry["successes"] += 1
        entry["consecutive_failures"] = 0
        entry["cooldown_until"] = None
        status = "healthy"
    else:
        entry["failures"] += 1
        entry["consecutive_failures"] += 1
        base = max(10, int(policy.get("failure_cooldown_base_seconds", 30)))
        max_cd = max(base, min(int(policy.get("max_failure_cooldown_seconds", 900)), 3600))
        cooldown = min(max_cd, base * (2 ** min(entry["consecutive_failures"] - 1, 6)))
        entry["cooldown_until"] = (_now() + dt.timedelta(seconds=cooldown)).isoformat()
        status = "cooldown"

    health[capability] = entry
    _write(HEALTH_FILE, health)
    result = {"status": status, "capability": capability, **entry}
    _audit("capability_result", {
        "capability": capability,
        "success": bool(success),
        "reason": str(reason)[:240],
        "consecutive_failures": entry["consecutive_failures"],
        "cooldown_until": entry.get("cooldown_until"),
    })
    return result


def lease_capabilities(
    requested: list[str] | None = None,
    *,
    policy_file: Path = POLICY_FILE,
    state_file: Path = STATE_FILE,
) -> dict[str, Any]:
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
    desired = (
        [str(x) for x in cfg.get("default_capabilities", [])] + inferred
        if requested is None
        else [str(x) for x in requested]
    )
    desired = list(dict.fromkeys(desired))
    allowed_names = {str(x) for x in cfg.get("allowed_capabilities", [])}
    health = _health()
    approved: list[dict[str, Any]] = []
    denied: list[str] = []
    cooling: list[str] = []

    for name in desired:
        item = catalog.get(name) if isinstance(catalog.get(name), dict) else None
        scopes = {str(x) for x in (item or {}).get("scopes", [])}
        h = health.get(name) if isinstance(health.get(name), dict) else {}
        if name in never_names or name not in allowed_names or item is None or scopes & forbidden:
            denied.append(name)
            continue
        if _is_cooling(h):
            cooling.append(name)
            continue
        approved.append({
            "capability": name,
            "credential_ref": str(item.get("credential_ref") or ""),
            "provider": str(item.get("provider") or ""),
            "scopes": sorted(scopes),
            "materialization": str(item.get("materialization") or "capability_handle"),
        })

    ttl = max(60, min(int(policy.get("max_lease_seconds", 900)), 3600))
    now = _now()
    result = {
        "schema": "senju-credential-capability-lease/v3",
        "system": SYSTEM,
        "status": "active",
        "issued_at": now.isoformat(),
        "expires_at": (now + dt.timedelta(seconds=ttl)).isoformat(),
        "leases": approved,
        "denied": denied,
        "cooling_down": cooling,
        "authority_scopes_considered": authority_scopes,
        "auto_selected_capabilities": inferred,
        "automatic_failover": True,
        "automatic_renewal": True,
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
        "cooling_down": cooling,
        "ttl_seconds": ttl,
    })
    return result


def renew_capabilities(
    *,
    min_remaining_seconds: int | None = None,
    policy_file: Path = POLICY_FILE,
    state_file: Path = STATE_FILE,
) -> dict[str, Any]:
    """Reuse a live lease or autonomously renew near expiry."""
    policy = _load(policy_file, {})
    margin = (
        int(min_remaining_seconds)
        if min_remaining_seconds is not None
        else int(policy.get("renewal_margin_seconds", 180))
    )
    state = current_lease(state_file)
    if state.get("status") == "active":
        try:
            remaining = (
                dt.datetime.fromisoformat(str(state["expires_at"])) - _now()
            ).total_seconds()
        except Exception:
            remaining = -1
        if remaining > max(0, margin):
            state["renewed"] = False
            state["remaining_seconds"] = int(remaining)
            return state

    renewed = lease_capabilities(policy_file=policy_file, state_file=state_file)
    renewed["renewed"] = True
    _audit("credential_capability_renewed", {
        "capabilities": [x.get("capability") for x in renewed.get("leases", [])],
    })
    return renewed


def delegate_capability(
    capability: str,
    recipient: str = DEFAULT_RECIPIENT,
    *,
    policy_file: Path = POLICY_FILE,
) -> dict[str, Any]:
    """Delegate an opaque capability declaration, never the credential value."""
    policy = _load(policy_file, {})
    systems = policy.get("systems") if isinstance(policy.get("systems"), dict) else {}
    catalog = policy.get("capabilities") if isinstance(policy.get("capabilities"), dict) else {}
    source_cfg = systems.get(SYSTEM) if isinstance(systems.get(SYSTEM), dict) else {}
    target_cfg = systems.get(recipient) if isinstance(systems.get(recipient), dict) else {}
    item = catalog.get(capability) if isinstance(catalog.get(capability), dict) else None
    forbidden = _forbidden_scopes(policy) | {
        str(x) for x in policy.get("never_delegate_scopes", [])
    }
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
        result = {
            "status": "denied",
            "from": SYSTEM,
            "to": recipient,
            "capability": capability,
            "reasons": sorted(set(reasons)),
            "raw_secret_material": False,
        }
        _audit("capability_delegation_denied", result)
        return result

    ttl = max(60, min(int(policy.get("max_delegation_seconds", 600)), 1800))
    now = _now()
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
        "to": recipient,
        "capability": capability,
        "scopes": sorted(scopes),
        "ttl_seconds": ttl,
        "token_transfer": False,
    })
    return result


def delegate_for_scopes(
    required_scopes: list[str],
    recipient: str = DEFAULT_RECIPIENT,
    *,
    policy_file: Path = POLICY_FILE,
) -> dict[str, Any]:
    """Choose the best healthy mutually allowed handle and delegate its metadata."""
    policy = _load(policy_file, {})
    required = {str(x) for x in required_scopes}
    if required & _forbidden_scopes(policy):
        return {
            "status": "denied",
            "from": SYSTEM,
            "to": recipient,
            "required_scopes": sorted(required),
            "reasons": ["forbidden_scope"],
        }
    for match in discover_capabilities(list(required), policy_file=policy_file):
        result = delegate_capability(match["capability"], recipient, policy_file=policy_file)
        if result.get("status") == "delegated":
            return result
    return {
        "status": "unavailable",
        "from": SYSTEM,
        "to": recipient,
        "required_scopes": sorted(required),
        "reasons": ["no_healthy_delegable_capability"],
    }


def current_lease(state_file: Path = STATE_FILE) -> dict[str, Any]:
    state = _load(state_file, {})
    if not isinstance(state, dict) or not state:
        return {"system": SYSTEM, "status": "missing", "leases": []}
    try:
        expires = dt.datetime.fromisoformat(str(state.get("expires_at")))
        if expires <= _now():
            state["status"] = "expired"
            state["leases"] = []
    except Exception:
        state["status"] = "invalid"
        state["leases"] = []
    return state
