"""Feed live Owner Authorization Pool assets into SENJU RED's runnable queue.

This adapter is intentionally downstream of Authorization issuance. It does not create,
expand, renew, or infer Authority. A host can enter through this path only when the
current Owner Authorization Pool already contains an exact-host, unexpired,
credential-free Authorization and marks that host ``transport_eligible=true``.

The adapter augments (rather than replaces) the RED negotiation bridge queue so the
existing 100-URL scheduler can rotate across canonical public labs *and* currently live
owner-controlled Render/Vercel assets.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "senju-red-owner-pool-bridge/v1"
QUEUE_SCHEMA = "senju-red-authorized-target-queue/v1"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
MAX_TARGETS = 256


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _host(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if "://" in text:
        try:
            text = urllib.parse.urlsplit(text).hostname or ""
        except ValueError:
            return ""
    host = text.lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@* ") or "." not in host:
        return ""
    return host


def _expiry_epoch(value: object) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp())


def _methods(values: object) -> list[str]:
    rows = values if isinstance(values, (list, tuple)) else ()
    allowed = {str(v).strip().upper() for v in rows if str(v).strip()} & SAFE_METHODS
    return sorted(allowed)


def _valid_owner_targets(pool: Mapping[str, Any], *, now: int) -> list[dict[str, Any]]:
    entries = pool.get("entries", [])
    out: list[dict[str, Any]] = []
    for raw in entries if isinstance(entries, list) else []:
        if not isinstance(raw, Mapping) or raw.get("transport_eligible") is not True:
            continue
        host = _host(raw.get("host"))
        auth = raw.get("authorization") if isinstance(raw.get("authorization"), Mapping) else {}
        if not host or _host(auth.get("host")) != host:
            continue
        if _expiry_epoch(auth.get("expires_at") or auth.get("expires_at_epoch")) <= now:
            continue
        if str(auth.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if auth.get("private_network") is True:
            continue
        methods = _methods(auth.get("allowed_methods"))
        if not methods:
            continue
        service_url = str(raw.get("service_url") or "").strip()
        if not service_url.startswith("https://") or _host(service_url) != host:
            service_url = f"https://{host}/"
        out.append(
            {
                "host": host,
                "seed_url": service_url,
                "allowed_methods": methods,
                "sources": ["owner_authorization_pool_transport_eligible"],
                "shared_instance": False,
                "rate_limit_rps": 2,
                "credential_scope": "none",
                "destructive": False,
                "owner_pool_transport_eligible": True,
                "authorization_id": str(auth.get("authorization_id") or ""),
                "authorization_basis": auth.get("authorization_basis"),
                "proof_ref": raw.get("proof_ref") or auth.get("proof_ref"),
                "provider": raw.get("provider"),
                "expires_at": auth.get("expires_at"),
            }
        )
    out.sort(key=lambda row: (str(row.get("provider") or ""), row["host"]))
    return out


def _merge(index: dict[str, dict[str, Any]], row: Mapping[str, Any]) -> None:
    host = _host(row.get("host"))
    if not host:
        return
    current = index.get(host)
    if current is None:
        index[host] = dict(row)
        return

    merged = dict(current)
    methods = set(_methods(current.get("allowed_methods"))) | set(_methods(row.get("allowed_methods")))
    merged["allowed_methods"] = sorted(methods & SAFE_METHODS) or ["GET", "HEAD"]
    sources = [str(x) for x in current.get("sources", []) if str(x)]
    for source in row.get("sources", []) if isinstance(row.get("sources"), list) else []:
        if str(source) and str(source) not in sources:
            sources.append(str(source))
    merged["sources"] = sources
    if row.get("owner_pool_transport_eligible") is True:
        merged["owner_pool_transport_eligible"] = True
        merged["authorization_id"] = row.get("authorization_id")
        merged["authorization_basis"] = row.get("authorization_basis")
        merged["proof_ref"] = row.get("proof_ref")
        merged["provider"] = row.get("provider")
        merged["expires_at"] = row.get("expires_at")
        seed = str(row.get("seed_url") or "").strip()
        if seed.startswith("https://") and _host(seed) == host:
            merged["seed_url"] = seed
    merged["credential_scope"] = "none"
    merged["destructive"] = False
    merged["shared_instance"] = bool(current.get("shared_instance", False))
    try:
        current_rate = max(1, int(current.get("rate_limit_rps", 1)))
    except (TypeError, ValueError):
        current_rate = 1
    try:
        owner_rate = max(1, int(row.get("rate_limit_rps", 2)))
    except (TypeError, ValueError):
        owner_rate = 2
    merged["rate_limit_rps"] = min(10, max(current_rate, owner_rate))
    index[host] = merged


def augment_red_queue_from_owner_pool(
    state_dir: str | Path,
    *,
    owner_pool: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)
    queue_path = state / "red_authorized_target_queue.json"
    pool_path = Path(owner_pool) if owner_pool is not None else state / "owner_authorization_pool.json"

    queue = _load(queue_path, {})
    if not isinstance(queue, Mapping):
        queue = {}
    existing = queue.get("targets", [])
    index: dict[str, dict[str, Any]] = {}
    for row in existing if isinstance(existing, list) else []:
        if isinstance(row, Mapping) and _host(row.get("host")):
            index[_host(row.get("host"))] = dict(row)

    pool_doc = _load(pool_path, {})
    owner_targets = _valid_owner_targets(pool_doc, now=current) if isinstance(pool_doc, Mapping) else []
    before = len(index)
    for row in owner_targets:
        _merge(index, row)

    targets = sorted(
        index.values(),
        key=lambda row: (
            0 if row.get("owner_pool_transport_eligible") is True else 1,
            bool(row.get("shared_instance", False)),
            _host(row.get("host")),
        ),
    )[:MAX_TARGETS]
    added_hosts = sorted({_host(row["host"]) for row in owner_targets} - {
        _host(row.get("host")) for row in existing if isinstance(row, Mapping)
    })

    updated = dict(queue)
    updated["schema"] = str(queue.get("schema") or QUEUE_SCHEMA)
    updated["generated_at"] = current
    updated["authorized_target_count"] = len(targets)
    updated["targets"] = targets
    updated["owner_pool_bridge"] = {
        "enabled": True,
        "source": str(pool_path),
        "transport_eligible_owner_targets": len(owner_targets),
        "new_unique_hosts_added": len(added_hosts),
        "total_runnable_hosts": len(targets),
        "authority_created": False,
    }
    _write(queue_path, updated)

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "queue_targets_before": before,
        "transport_eligible_owner_targets": len(owner_targets),
        "new_unique_hosts_added": len(added_hosts),
        "added_hosts": added_hosts,
        "total_runnable_hosts": len(targets),
        "queue_path": str(queue_path),
        "authority_created": False,
        "authority_expanded": False,
        "requirements": [
            "existing_owner_authorization_pool_entry",
            "transport_eligible_true",
            "unexpired_exact_host_authorization",
            "credential_scope_none",
            "public_https_transport",
        ],
    }
    _write(state / "red_owner_pool_bridge.json", result)
    return result
