"""Immediate adversary transport leases for targets already inside Owner authority.

This module removes review latency *inside* the existing owner-controlled envelope.
A finding can become an executable read-only exact-host lease immediately when the
host is already covered by one of these explicit sources:

- discovery_policy trusted_roots or company_domains;
- network_policy_envelope authorized_roots;
- a live non-destructive, credential-free standing exact-host authorization;
- a live independently reviewed explicit exact-host grant; or
- an exact HTTPS link supplied by the owner in human_intent_signals.

It never creates an unrelated trust root, reactivates a revoked authority, or invents
credentials. The output is intentionally compatible with AdversaryNetworkTransport.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable, Mapping

from .meta.standing_authorization import StandingAuthorizationError, load_registry

FASTPATH_SCHEMA = "senju-owner-envelope-fastpath-leases/v1"
DEFAULT_TTL_SECONDS = 6 * 60 * 60
MAX_TTL_SECONDS = 24 * 60 * 60
SHARED_WITH = ("AI", "CHILD", "META", "SENJU", "X")
READ_CAPABILITIES = ("probe", "scan")
READ_METHODS = ("GET", "HEAD")


class OwnerEnvelopeFastPathError(RuntimeError):
    """Raised when an owner-envelope fast-path input is malformed."""


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _normalize_host(raw: object) -> str:
    value = str(raw).strip().lower().rstrip(".")
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise OwnerEnvelopeFastPathError(f"invalid exact host: {raw!r}")
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise OwnerEnvelopeFastPathError(f"invalid exact host: {raw!r}") from exc
    if "." not in value:
        raise OwnerEnvelopeFastPathError("target host must be fully qualified")
    return value


def _normalize_url(raw: object) -> tuple[str, str]:
    try:
        parsed = urllib.parse.urlsplit(str(raw).strip())
        port = parsed.port
    except ValueError as exc:
        raise OwnerEnvelopeFastPathError("invalid target URL") from exc
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise OwnerEnvelopeFastPathError("owner-envelope fast path requires HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise OwnerEnvelopeFastPathError("credentials in target URLs are forbidden")
    if port not in (None, 443):
        raise OwnerEnvelopeFastPathError("non-default HTTPS ports require separate explicit authority")
    host = _normalize_host(parsed.hostname)
    normalized = urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
    return normalized, host


def _normalize_domains(values: Iterable[object]) -> set[str]:
    out: set[str] = set()
    for raw in values:
        try:
            out.add(_normalize_host(raw))
        except OwnerEnvelopeFastPathError:
            continue
    return out


def _policy_roots(state: Path) -> set[str]:
    roots: set[str] = set()
    policy = _load(state / "discovery_policy.json", {})
    if isinstance(policy, Mapping):
        roots.update(_normalize_domains(policy.get("trusted_roots", ())))
        roots.update(_normalize_domains(policy.get("company_domains", ())))
    envelope = _load(state / "network_policy_envelope.json", {})
    if isinstance(envelope, Mapping):
        roots.update(_normalize_domains(envelope.get("authorized_roots", ())))
    return roots


def _within_root(host: str, roots: Iterable[str]) -> str | None:
    for root in sorted(set(roots), key=len, reverse=True):
        if host == root or host.endswith("." + root):
            return root
    return None


def _owner_supplied_exact_hosts(state: Path) -> set[str]:
    signals = _load(state / "human_intent_signals.json", {})
    if not isinstance(signals, Mapping):
        return set()
    out: set[str] = set()
    for raw in signals.get("supplied_links", ()):
        if not isinstance(raw, str):
            continue
        try:
            _, host = _normalize_url(raw)
        except OwnerEnvelopeFastPathError:
            continue
        out.add(host)
    return out


def _standing_exact_hosts(repo_root: Path) -> dict[str, tuple[str, tuple[str, ...]]]:
    path = repo_root / "senju" / "state" / "standing_authorizations.json"
    try:
        records = load_registry(path)
    except StandingAuthorizationError:
        return {}
    out: dict[str, tuple[str, tuple[str, ...]]] = {}
    for record in records:
        if record.revoked or record.destructive or record.credential_scope != "none":
            continue
        methods = tuple(sorted(set(record.allowed_methods).intersection(READ_METHODS)))
        if not methods:
            continue
        for raw_host in record.exact_hosts:
            try:
                host = _normalize_host(raw_host)
            except OwnerEnvelopeFastPathError:
                continue
            out[host] = (record.authorization_reference, methods)
    return out


def _reviewed_exact_hosts(state: Path, now: int) -> dict[str, tuple[str, tuple[str, ...]]]:
    reviewed = _load(state / "authority_reviewed_grants.json", {})
    if not isinstance(reviewed, Mapping) or reviewed.get("schema") != "meta-authority-reviewed-grants/v1":
        return {}
    out: dict[str, tuple[str, tuple[str, ...]]] = {}
    raw_hosts = reviewed.get("hosts", {})
    if not isinstance(raw_hosts, Mapping):
        return out
    for raw_host, grant in raw_hosts.items():
        if not isinstance(grant, Mapping):
            continue
        try:
            expires_at = int(grant.get("expires_at", 0))
        except (TypeError, ValueError):
            continue
        if expires_at <= now:
            continue
        if str(grant.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if str(grant.get("effect", "read_only")).strip().lower() != "read_only":
            continue
        if not grant.get("matched_explicit_root") and grant.get("owner_authorization") != "explicit":
            continue
        methods = tuple(
            sorted(
                {
                    str(item).strip().upper()
                    for item in grant.get("allowed_methods", ())
                    if str(item).strip().upper() in READ_METHODS
                }
            )
        )
        if not methods:
            continue
        try:
            host = _normalize_host(raw_host)
        except OwnerEnvelopeFastPathError:
            continue
        reference = str(
            grant.get("authorization_reference")
            or grant.get("owner_approval_reference")
            or f"reviewed-explicit:{host}"
        ).strip()
        out[host] = (reference, methods)
    return out


def _authority_basis(
    state: Path,
    repo_root: Path,
    *,
    host: str,
    now: int,
) -> tuple[str, str, tuple[str, ...]] | None:
    root = _within_root(host, _policy_roots(state))
    if root is not None:
        return "owner_declared_network_root", f"owner-envelope-root:{root}", READ_METHODS

    standing = _standing_exact_hosts(repo_root).get(host)
    if standing is not None:
        reference, methods = standing
        return "active_standing_exact_host", reference, methods

    reviewed = _reviewed_exact_hosts(state, now).get(host)
    if reviewed is not None:
        reference, methods = reviewed
        return "active_reviewed_explicit_exact_host", reference, methods

    if host in _owner_supplied_exact_hosts(state):
        return "owner_supplied_exact_host", f"owner-supplied:{host}", READ_METHODS

    return None


def _fingerprint(value: Mapping[str, Any]) -> str:
    raw = json.dumps(dict(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _upsert_lease(state: Path, lease: Mapping[str, Any], *, generated_at: int) -> None:
    path = state / "adversary_owner_fastpath_leases.json"
    payload = _load(path, {})
    rows = payload.get("leases", []) if isinstance(payload, Mapping) else []
    current = [
        dict(row)
        for row in rows
        if isinstance(row, Mapping) and str(row.get("target", "")) != str(lease.get("target", ""))
    ] if isinstance(rows, list) else []
    current.append(dict(lease))
    current.sort(key=lambda row: str(row.get("target", "")))
    _write(
        path,
        {
            "schema": FASTPATH_SCHEMA,
            "generated_at": generated_at,
            "semantics": "immediate_exact_host_transport_lease_inside_existing_owner_envelope",
            "leases": current,
        },
    )


def ensure_owner_fastpath_lease(
    state_dir: str | Path,
    url: str,
    *,
    repo_root: str | Path | None = None,
    now: int | None = None,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> dict[str, Any] | None:
    """Return/persist an immediate transport lease if the URL is already owner-authorized."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    repository = Path(repo_root) if repo_root is not None else Path(__file__).resolve().parents[2]
    normalized_url, host = _normalize_url(url)
    basis = _authority_basis(state, repository, host=host, now=current)
    if basis is None:
        return None
    basis_kind, reference, methods = basis
    ttl = max(300, min(int(ttl_seconds), MAX_TTL_SECONDS))
    material = {
        "target": host,
        "url": normalized_url,
        "authorization_reference": reference,
        "authorization_basis": basis_kind,
        "methods": methods,
    }
    fingerprint = _fingerprint(material)
    lease = {
        "lease_id": f"owner-fastpath:{host}:{fingerprint[:12]}:{current}",
        "target": host,
        "url": normalized_url,
        "authorization_reference": reference,
        "authorization_basis": basis_kind,
        "capability_authorization_profile": "owner-envelope-readonly-fastpath/v1",
        "capability_inherited_from_owner_root": basis_kind == "owner_declared_network_root",
        "capabilities": list(READ_CAPABILITIES),
        "allowed_methods": list(methods),
        "credential_scope": "none",
        "shared_with": list(SHARED_WITH),
        "issued_at": current,
        "expires_at": current + ttl,
        "source_action_fingerprint": fingerprint,
        "status": "active",
        "owner_envelope_fastpath": True,
    }
    _upsert_lease(state, lease, generated_at=current)
    return lease


def load_owner_fastpath_leases(state_dir: str | Path) -> tuple[dict[str, Any], ...]:
    payload = _load(Path(state_dir) / "adversary_owner_fastpath_leases.json", {})
    rows = payload.get("leases", []) if isinstance(payload, Mapping) else []
    if not isinstance(rows, list):
        return ()
    return tuple(dict(row) for row in rows if isinstance(row, Mapping))


def materialize_owner_fastpath_from_findings(
    state_dir: str | Path,
    *,
    repo_root: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Bulk-convert already-authorized findings into shared transport leases."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    source = _load(state / "adversary_findings.json", {})
    findings = source.get("findings", []) if isinstance(source, Mapping) else []
    issued: list[dict[str, Any]] = []
    held: list[dict[str, Any]] = []
    for index, raw in enumerate(findings if isinstance(findings, list) else []):
        if not isinstance(raw, Mapping):
            continue
        url = raw.get("target_url", raw.get("url"))
        if not isinstance(url, str):
            continue
        try:
            lease = ensure_owner_fastpath_lease(
                state,
                url,
                repo_root=repo_root,
                now=current,
            )
        except OwnerEnvelopeFastPathError as exc:
            held.append({"index": index, "url": url, "reason": str(exc)})
            continue
        if lease is None:
            held.append({"index": index, "url": url, "reason": "outside_existing_owner_envelope"})
        else:
            issued.append(lease)
    return {
        "schema": "senju-owner-envelope-fastpath-materialization/v1",
        "generated_at": current,
        "issued_count": len(issued),
        "held_count": len(held),
        "issued": issued,
        "held": held,
    }
