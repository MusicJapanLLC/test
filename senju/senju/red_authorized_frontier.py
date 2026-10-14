"""Build SENJU RED's live URL frontier from already-issued exact-host Authority.

This module is deliberately downstream of the Owner Authorization Pool. It does not
create Authority and it never treats discovery as permission. Only entries that are
both currently authorized and marked transport_eligible become RED targets.

The output has two purposes:
- expand each live exact host into a bounded same-origin URL frontier for RED work;
- materialize read-only adversary transport leases that the existing
  AdversaryNetworkTransport can consume.

Public security labs and owner-controlled services share the same exact-host transport
boundary. Owner-controlled services may receive a higher scheduling weight, but this
frontier still executes only GET/HEAD/OPTIONS. Mutating methods remain in their existing
specialized, separately gated lanes.
"""
from __future__ import annotations

import json
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

SCHEMA = "senju-red-authorized-frontier/v1"
LEASE_SCHEMA = "senju-red-authorized-transport-leases/v1"
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
DEFAULT_SEED_PATHS = (
    "/",
    "/robots.txt",
    "/.well-known/security.txt",
    "/sitemap.xml",
)
MAX_HOSTS = 128
MAX_URLS_PER_HOST = 8
MAX_URLS = 512


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
    host = str(value or "").strip().lower().rstrip(".")
    if not host or "/" in host or "://" in host or "*" in host:
        return ""
    return host


def _epoch(value: object) -> int:
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


def _canonical_by_host(path: Path) -> dict[str, dict[str, Any]]:
    doc = _load(path, {})
    rows = doc.get("targets", []) if isinstance(doc, Mapping) else []
    out: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else []:
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if not host:
            continue
        if str(raw.get("owner_authorization", "")).strip().lower() != "explicit":
            continue
        out[host] = dict(raw)
    return out


def _base_url(host: str, target: Mapping[str, Any] | None) -> str:
    candidate = str((target or {}).get("base_url") or f"https://{host}").strip()
    try:
        parsed = urllib.parse.urlsplit(candidate)
    except ValueError:
        return f"https://{host}"
    if parsed.scheme.lower() != "https" or _host(parsed.hostname) != host:
        return f"https://{host}"
    path = parsed.path or "/"
    return urllib.parse.urlunsplit(("https", host, path, parsed.query, ""))


def _same_host_url(value: object, host: str) -> str | None:
    try:
        parsed = urllib.parse.urlsplit(str(value or "").strip())
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or _host(parsed.hostname) != host:
        return None
    return urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))


def _seed_urls(host: str, target: Mapping[str, Any] | None) -> list[str]:
    base = _base_url(host, target)
    origin = f"https://{host}"
    urls: list[str] = [base]
    for path in DEFAULT_SEED_PATHS:
        urls.append(origin + path)
    if isinstance(target, Mapping):
        for key in ("scope_url", "federation_url", "security_txt"):
            extra = _same_host_url(target.get(key), host)
            if extra:
                urls.append(extra)
    seen: set[str] = set()
    out: list[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
        if len(out) >= MAX_URLS_PER_HOST:
            break
    return out


def _tier(entry: Mapping[str, Any], target: Mapping[str, Any] | None) -> str:
    if str(entry.get("source_kind", "")) == "verified_cloud_control":
        return "owner_controlled_live"
    target = target or {}
    if target.get("authorization_authority_root") is True:
        return "owner_controlled_live"
    if target.get("provider_control_verified") is True:
        return "owner_controlled_live"
    if int(target.get("owner_authorization_confidence_percent") or 0) >= 100:
        return "owner_controlled_live"
    if str(target.get("recommendation_target", "")).strip().upper() == "SENJU_RED":
        return "public_security_lab"
    return "explicit_authorized_target"


def build_red_authorized_frontier(
    state_dir: str | Path,
    *,
    canonical_targets: str | Path,
    now: int | None = None,
    max_hosts: int = MAX_HOSTS,
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    canonical = _canonical_by_host(Path(canonical_targets))
    pool = _load(state / "owner_authorization_pool.json", {})
    entries = pool.get("entries", []) if isinstance(pool, Mapping) else []

    rows: list[dict[str, Any]] = []
    leases: list[dict[str, Any]] = []
    frontier_urls: list[dict[str, Any]] = []

    for raw in entries if isinstance(entries, list) else []:
        if not isinstance(raw, Mapping) or raw.get("transport_eligible") is not True:
            continue
        host = _host(raw.get("host"))
        auth = raw.get("authorization") if isinstance(raw.get("authorization"), Mapping) else {}
        if not host or _host(auth.get("host")) != host:
            continue
        expires_at = _epoch(auth.get("expires_at"))
        if expires_at <= current:
            continue
        if str(auth.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if auth.get("private_network") is True:
            continue
        methods = sorted(
            {str(v).strip().upper() for v in auth.get("allowed_methods", []) if str(v).strip()}
            & READ_METHODS
        )
        if not methods:
            continue

        target = canonical.get(host)
        urls = _seed_urls(host, target)
        if not urls:
            continue
        tier = _tier(raw, target)
        weight = 3 if tier == "owner_controlled_live" else 2 if tier == "public_security_lab" else 1
        auth_id = str(auth.get("authorization_id") or "").strip()
        proof_ref = str(raw.get("proof_ref") or auth.get("proof_ref") or auth_id or host)
        authorization_reference = auth_id or proof_ref
        lease_id = f"red-frontier:{authorization_reference}"

        row = {
            "host": host,
            "base_url": urls[0],
            "tier": tier,
            "scheduling_weight": weight,
            "allowed_methods": methods,
            "expires_at": expires_at,
            "authorization_id": auth_id,
            "authorization_basis": auth.get("authorization_basis"),
            "proof_ref": proof_ref,
            "source_kind": raw.get("source_kind"),
            "provider": raw.get("provider"),
            "url_count": len(urls),
            "urls": urls,
            "same_origin_expansion": True,
            "credential_scope": "none",
            "private_network": False,
        }
        rows.append(row)
        leases.append(
            {
                "lease_id": lease_id,
                "target": host,
                "status": "active",
                "expires_at": expires_at,
                "capabilities": ["scan", "probe"],
                "allowed_methods": methods,
                "authorization_reference": authorization_reference,
                "authorization_basis": auth.get("authorization_basis"),
                "credential_scope": "none",
                "source_action_fingerprint": auth_id or None,
                "frontier_tier": tier,
            }
        )
        for url in urls:
            frontier_urls.append(
                {
                    "host": host,
                    "url": url,
                    "tier": tier,
                    "scheduling_weight": weight,
                    "allowed_methods": methods,
                    "authorization_reference": authorization_reference,
                    "expires_at": expires_at,
                }
            )

    rows.sort(key=lambda row: (-int(row["scheduling_weight"]), row["host"]))
    rows = rows[: max(1, min(int(max_hosts), MAX_HOSTS))]
    allowed_hosts = {row["host"] for row in rows}
    leases = [row for row in leases if row["target"] in allowed_hosts]
    frontier_urls = [row for row in frontier_urls if row["host"] in allowed_hosts][:MAX_URLS]

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "source": "owner_authorization_pool",
        "active_target_count": len(rows),
        "frontier_url_count": len(frontier_urls),
        "owner_controlled_count": sum(1 for row in rows if row["tier"] == "owner_controlled_live"),
        "public_security_lab_count": sum(1 for row in rows if row["tier"] == "public_security_lab"),
        "targets": rows,
        "urls": frontier_urls,
        "red_permissions": {
            "methods": sorted(READ_METHODS),
            "same_origin_url_expansion": True,
            "continuous_rebuild": True,
            "priority_owner_controlled": True,
            "credential_scope": "none",
            "private_network": False,
        },
        "hard_limits": [
            "existing_unexpired_authorization_required",
            "transport_eligible_required",
            "exact_host_only",
            "HTTPS_only",
            "GET_HEAD_OPTIONS_only_in_autonomous_RED_frontier",
            "no_credentials",
            "no_private_network",
            "no_cross_host_pivoting",
            "no_discovery_based_authorization",
            "no_denial_of_service_or_resource_exhaustion",
        ],
    }
    lease_doc = {
        "schema": LEASE_SCHEMA,
        "generated_at": current,
        "lease_count": len(leases),
        "leases": leases,
        "authority_created": False,
        "authority_source": "existing_owner_authorization_pool_only",
    }
    _write(state / "red_authorized_target_feed.json", result)
    _write(state / "red_authorized_transport_leases.json", lease_doc)
    _write(
        state / "red_authorized_url_frontier.json",
        {
            "schema": "senju-red-authorized-url-frontier/v1",
            "generated_at": current,
            "url_count": len(frontier_urls),
            "urls": frontier_urls,
        },
    )
    return result
