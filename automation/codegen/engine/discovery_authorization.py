"""Bounded META discovery authorization.

META may discover URLs, links, or hostnames during normal operation. This module gives
those discoveries a safe, auditable path to temporary authorization without allowing
arbitrary third-party hosts to self-escalate into scope.

Promotion rules:
- HTTPS only; no credentials in URL; default port only.
- Host must be the configured trusted root or a subdomain of it.
- Trusted roots come from META_DISCOVERY_TRUST_ROOTS or meta_state/discovery_policy.json.
- Promotions are probationary, read-only (GET/HEAD), credential-free, and expire.
- Untrusted discoveries are retained as candidates; they are never auto-authorized.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable

URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
HOST_KEYS = {"host", "hostname", "domain", "domain_name", "target_host"}
DEFAULT_TTL_SECONDS = 6 * 60 * 60


def _now() -> int:
    return int(time.time())


def _normalize_host(host: str) -> str:
    value = host.strip().rstrip(".").lower()
    if not value or any(ch in value for ch in "/?#@"):
        raise ValueError("invalid host")
    value = value.encode("idna").decode("ascii")
    if "." not in value:
        raise ValueError("hostname must be fully qualified")
    try:
        ipaddress.ip_address(value)
    except ValueError:
        pass
    else:
        raise ValueError("IP literals are not eligible for discovery promotion")
    return value


def _normalize_url(url: str) -> tuple[str, str] | None:
    try:
        parsed = urllib.parse.urlsplit(url.strip())
        if parsed.scheme.lower() != "https":
            return None
        if parsed.username is not None or parsed.password is not None:
            return None
        if not parsed.hostname:
            return None
        host = _normalize_host(parsed.hostname)
        if parsed.port not in (None, 443):
            return None
        path = parsed.path or "/"
        normalized = urllib.parse.urlunsplit(("https", host, path, parsed.query, ""))
        return normalized, host
    except (ValueError, UnicodeError):
        return None


def _extract_discoveries(value: Any) -> set[str]:
    """Extract explicit URLs plus values carried in hostname/domain fields."""
    found: set[str] = set()
    if isinstance(value, str):
        found.update(URL_RE.findall(value))
    elif isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str) and key.lower() in HOST_KEYS and isinstance(item, str):
                try:
                    host = _normalize_host(item)
                    found.add(f"https://{host}/")
                except ValueError:
                    pass
            found.update(_extract_discoveries(item))
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            found.update(_extract_discoveries(item))
    return found


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _trusted_roots(state_dir: Path) -> set[str]:
    roots: set[str] = set()
    env = os.environ.get("META_DISCOVERY_TRUST_ROOTS", "")
    for item in env.split(","):
        item = item.strip()
        if item:
            try:
                roots.add(_normalize_host(item))
            except ValueError:
                continue

    policy = _load_json(state_dir / "discovery_policy.json", {})
    for item in policy.get("trusted_roots", []) if isinstance(policy, dict) else []:
        try:
            roots.add(_normalize_host(str(item)))
        except ValueError:
            continue
    return roots


def _within_root(host: str, roots: Iterable[str]) -> str | None:
    for root in roots:
        if host == root or host.endswith("." + root):
            return root
    return None


def _candidate_record(url: str, host: str, source: str) -> dict[str, Any]:
    return {
        "url": url,
        "host": host,
        "source": source,
        "discovered_at": _now(),
    }


def run_discovery_authorization(
    state_dir: str | Path,
    *,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> dict[str, Any]:
    """Promote only discoveries that remain inside explicitly trusted roots.

    Input convention:
      meta_state/discovered_urls.json may contain URLs, href/link strings, or explicit
      host/hostname/domain fields. external_intel.json is also scanned for URL evidence.

    Output files:
      discovery_candidates.json  - every normalized discovery and decision
      discovery_authorized.json  - live probationary read-only host grants
    """
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    roots = _trusted_roots(state)
    ttl = max(300, min(int(ttl_seconds), 24 * 60 * 60))
    now = _now()

    sources = {
        "discovered_urls": state / "discovered_urls.json",
        "external_intel": state / "external_intel.json",
    }
    candidates: list[dict[str, Any]] = []
    promoted: dict[str, dict[str, Any]] = {}

    for source_name, path in sources.items():
        payload = _load_json(path, {})
        for raw in sorted(_extract_discoveries(payload)):
            normalized = _normalize_url(raw)
            if not normalized:
                continue
            url, host = normalized
            record = _candidate_record(url, host, source_name)
            root = _within_root(host, roots)
            if root is None:
                record.update({"decision": "candidate_only", "reason": "outside_trusted_roots"})
            else:
                record.update({"decision": "probationary_authorized", "trusted_root": root})
                promoted[host] = {
                    "host": host,
                    "trusted_root": root,
                    "authorized_at": now,
                    "expires_at": now + ttl,
                    "allowed_methods": ["GET", "HEAD"],
                    "credential_scope": "none",
                    "allow_http": False,
                    "allow_delete": False,
                    "effect": "read_only",
                    "source": "meta_discovery_authorization",
                }
            candidates.append(record)

    previous = _load_json(state / "discovery_authorized.json", {})
    if isinstance(previous, dict):
        for host, grant in previous.get("hosts", {}).items():
            if not isinstance(grant, dict):
                continue
            if int(grant.get("expires_at", 0)) <= now:
                continue
            try:
                normalized_host = _normalize_host(host)
            except ValueError:
                continue
            root = _within_root(normalized_host, roots)
            if root is None:
                continue
            promoted.setdefault(normalized_host, grant)

    candidate_doc = {
        "schema": "meta-discovery-candidates/v1",
        "generated_at": now,
        "trusted_roots": sorted(roots),
        "candidates": candidates,
    }
    authorized_doc = {
        "schema": "meta-discovery-authorized/v1",
        "generated_at": now,
        "mode": "probationary_read_only",
        "hosts": dict(sorted(promoted.items())),
    }
    (state / "discovery_candidates.json").write_text(
        json.dumps(candidate_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (state / "discovery_authorized.json").write_text(
        json.dumps(authorized_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "trusted_roots": sorted(roots),
        "candidate_count": len(candidates),
        "authorized_hosts": sorted(promoted),
        "authorized_count": len(promoted),
        "ttl_seconds": ttl,
    }
