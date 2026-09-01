"""Bounded discovery for operator-published public security labs.

This module grows SENJU RED's *read-only* public-lab authority from two sources:
1. an exact-host curated registry committed in this repository; and
2. OWASP VWAD online/live entries that look like direct vulnerable/test/lab apps.

It deliberately does not turn arbitrary discovery into authority. Generic training/CTF
platforms, private/non-HTTPS targets, redirects to new hosts, credentials, write methods,
and destructive operations are outside this authority class.
"""
from __future__ import annotations

import ipaddress
import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "senju-public-red-lab-authority/v1"
REGISTRY = Path("senju/config/public-red-lab-registry.json")
READ_ONLY_METHODS = ("GET", "HEAD", "OPTIONS")
MAX_AUTO_NEW_HARD = 4

# Platform-style sites are useful training destinations, but the platform root itself is
# not a generic scanner target. These tokens prevent accidental root-wide authority.
PLATFORM_TOKENS = (
    "hack the box",
    "hackthebox",
    "tryhackme",
    "ctflearn",
    "root me",
    "root-me",
    "hackthissite",
    "hacking lab",
    "vulnhub",
    "portswigger web security academy",
)

DIRECT_LAB_SIGNALS = (
    "vulnerable",
    "intentionally insecure",
    "intentionally vulnerable",
    "deliberately insecure",
    "deliberately vulnerable",
    "test app",
    "test application",
    "test site",
    "test bed",
    "testbed",
    "scanner",
    "security lab",
    "security labs",
    "pentest",
    "practice against",
    "training app",
    "training application",
    "challenge app",
    "demo app",
    "goat",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _normalize_https_url(value: Any) -> tuple[str, str] | None:
    try:
        parsed = urllib.parse.urlsplit(str(value or "").strip())
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or parsed.username is not None or parsed.password is not None:
        return None
    if not parsed.hostname:
        return None
    try:
        if parsed.port not in (None, 443):
            return None
        host = parsed.hostname.strip().rstrip(".").lower().encode("idna").decode("ascii")
    except (ValueError, UnicodeError, AttributeError):
        return None
    if not host or "." not in host or any(ch in host for ch in "/?#@*"):
        return None
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None and not literal.is_global:
        return None
    return host, f"https://{host}"


def _safe_registry_rows(repo_root: Path) -> list[dict[str, Any]]:
    doc = _load(repo_root / REGISTRY, {})
    rows = doc.get("targets", ()) if isinstance(doc, Mapping) else ()
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        parsed = _normalize_https_url(raw.get("base_url"))
        if parsed is None:
            continue
        host, base_url = parsed
        if str(raw.get("host") or "").strip().rstrip(".").lower() != host:
            continue
        evidence = str(raw.get("authorization_evidence_url") or "").strip()
        if not evidence.startswith("https://"):
            continue
        if host in seen:
            continue
        seen.add(host)
        out.append({
            "host": host,
            "base_url": base_url,
            "source": "curated_public_red_lab_registry",
            "source_id": str(raw.get("id") or host),
            "operator": str(raw.get("operator") or "public security lab operator"),
            "profile": str(raw.get("profile") or "public_security_lab"),
            "authorization_evidence_url": evidence,
            "authorization_note": " ".join(str(raw.get("authorization_note") or "").split())[:500],
            "allowed_methods": list(READ_ONLY_METHODS),
            "rate_limit_rps": max(1, min(int(raw.get("rate_limit_rps", 1) or 1), 2)),
            "credential_scope": "none",
            "allow_delete": False,
            "allow_private_network": False,
            "cross_host_inheritance": False,
            "status": "PUBLIC_RED_LAB_AUTHORIZED",
        })
    return sorted(out, key=lambda row: row["host"])


def _live_https_url(raw: Mapping[str, Any]) -> tuple[str, str] | None:
    refs = raw.get("references", ())
    if isinstance(refs, list):
        for ref in refs:
            if not isinstance(ref, Mapping):
                continue
            if str(ref.get("name") or "").strip().lower() != "live":
                continue
            parsed = _normalize_https_url(ref.get("url"))
            if parsed:
                return parsed
    return _normalize_https_url(raw.get("url"))


def _is_direct_online_lab(raw: Mapping[str, Any]) -> bool:
    collections = {str(v).strip().lower() for v in raw.get("collection", ()) if str(v).strip()}
    if "online" not in collections or "platform" in collections:
        return False
    text = " ".join(str(raw.get(key) or "") for key in ("name", "notes", "author")).lower()
    if any(token in text for token in PLATFORM_TOKENS):
        return False
    return any(signal in text for signal in DIRECT_LAB_SIGNALS)


def _upstream_candidates(upstream_doc: Any) -> list[dict[str, Any]]:
    if not isinstance(upstream_doc, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in upstream_doc:
        if not isinstance(raw, Mapping) or not _is_direct_online_lab(raw):
            continue
        parsed = _live_https_url(raw)
        if parsed is None:
            continue
        host, base_url = parsed
        if host in seen:
            continue
        seen.add(host)
        out.append({
            "host": host,
            "base_url": base_url,
            "source": "owasp_vwad_online_live",
            "source_id": str(raw.get("name") or host),
            "operator": str(raw.get("author") or "OWASP VWAD listed operator"),
            "profile": "probationary_public_security_lab",
            "authorization_evidence_url": "https://vwad.owasp.org/",
            "authorization_note": "OWASP VWAD online/live entry with direct vulnerable/test/lab signal; probationary read-only authority.",
            "allowed_methods": list(READ_ONLY_METHODS),
            "rate_limit_rps": 1,
            "credential_scope": "none",
            "allow_delete": False,
            "allow_private_network": False,
            "cross_host_inheritance": False,
            "status": "PUBLIC_RED_LAB_PROBATIONARY",
        })
    return sorted(out, key=lambda row: row["host"])


def refresh_public_red_lab_authority(
    repo_root: str | Path,
    state_dir: str | Path,
    meta_state_dir: str | Path,
    *,
    upstream_vwad: str | Path | None = None,
    max_auto_new: int = 2,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    meta_state = Path(meta_state_dir)
    current = int(time.time()) if now is None else int(now)
    cap = max(0, min(int(max_auto_new), MAX_AUTO_NEW_HARD))

    curated = _safe_registry_rows(repo)
    curated_hosts = {row["host"] for row in curated}

    authority_path = state / "public_red_lab_authority.json"
    previous = _load(authority_path, {})
    previous_rows = previous.get("targets", ()) if isinstance(previous, Mapping) else ()
    persisted_auto: dict[str, dict[str, Any]] = {}
    for raw in previous_rows if isinstance(previous_rows, list) else ():
        if not isinstance(raw, Mapping) or raw.get("source") != "owasp_vwad_online_live":
            continue
        parsed = _normalize_https_url(raw.get("base_url"))
        if parsed is None:
            continue
        host, base_url = parsed
        persisted_auto[host] = {
            **dict(raw),
            "host": host,
            "base_url": base_url,
            "allowed_methods": list(READ_ONLY_METHODS),
            "rate_limit_rps": 1,
            "credential_scope": "none",
            "allow_delete": False,
            "allow_private_network": False,
            "cross_host_inheritance": False,
            "status": "PUBLIC_RED_LAB_PROBATIONARY",
        }

    upstream_doc: Any = []
    if upstream_vwad:
        upstream_doc = _load(Path(upstream_vwad), [])
    candidates = _upstream_candidates(upstream_doc)
    added: list[dict[str, Any]] = []
    for row in candidates:
        host = row["host"]
        if host in curated_hosts or host in persisted_auto:
            continue
        if len(added) >= cap:
            break
        row = {**row, "first_authorized_at": current}
        persisted_auto[host] = row
        added.append(row)

    targets = curated + [persisted_auto[host] for host in sorted(persisted_auto) if host not in curated_hosts]
    constraints = {
        "allowed_methods": list(READ_ONLY_METHODS),
        "credentials": "none",
        "destructive_operations": False,
        "private_network": False,
        "cross_host_inheritance": False,
        "max_auto_new_per_cycle": cap,
    }
    previous_targets = previous.get("targets", []) if isinstance(previous, Mapping) else []
    previous_constraints = previous.get("constraints", {}) if isinstance(previous, Mapping) else {}
    authority_changed = _stable(previous_targets) != _stable(targets) or _stable(previous_constraints) != _stable(constraints)
    generated_at = current if authority_changed or not authority_path.exists() else int(previous.get("generated_at", current) or current)
    authority_doc = {
        "schema": SCHEMA,
        "generated_at": generated_at,
        "authority_class": "public_operator_published_security_lab_read_only",
        "curated_count": len(curated),
        "probationary_count": len(targets) - len(curated),
        "new_probationary_count": len(added),
        "target_count": len(targets),
        "targets": targets,
        "constraints": constraints,
    }
    if authority_changed or not authority_path.exists():
        _write(authority_path, authority_doc)

    candidate_path = meta_state / "discovery_candidates.json"
    candidate_doc = _load(candidate_path, {})
    rows = candidate_doc.get("candidates", ()) if isinstance(candidate_doc, Mapping) else ()
    by_host: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = str(raw.get("host") or "").strip().rstrip(".").lower()
        if host:
            by_host[host] = dict(raw)
    for row in targets:
        host = row["host"]
        by_host[host] = {
            "url": row["base_url"] + "/",
            "host": host,
            "source": row["source"],
            "decision": "operator_published_public_red_lab",
            "authorization_evidence_url": row["authorization_evidence_url"],
        }
    candidate_doc = dict(candidate_doc) if isinstance(candidate_doc, Mapping) else {}
    candidate_doc["candidates"] = [by_host[key] for key in sorted(by_host)]
    candidate_doc["public_red_lab_candidate_count"] = len(targets)
    candidate_doc["public_red_lab_new_probationary_count"] = len(added)
    _write(candidate_path, candidate_doc)

    return {
        "curated_count": len(curated),
        "probationary_count": len(targets) - len(curated),
        "new_probationary_count": len(added),
        "target_count": len(targets),
        "authority_changed": authority_changed,
        "hosts": [row["host"] for row in targets],
    }
