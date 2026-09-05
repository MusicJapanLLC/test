"""High-autonomy coordination around adversary external actions without self-minting trust.

The accelerator deliberately pushes automation up to the authority boundary:

* unrelated findings become durable, high-priority provisional root candidates and are
  broadcast to META/X/SENJU/CHILD/AI/PR-ARMY for parallel evidence work;
* ordinary DENY decisions may be reopened automatically when their evidence fingerprint
  changes, while HARD_DENY and revocation remain terminal;
* credential acquisition work is prepared automatically for exact hosts with an existing
  credential-capable authority lease and an explicit target profile;
* owner-signed private-network scope documents can authorize exact RFC1918 IP targets for
  a dedicated executor, while loopback/link-local/metadata/reserved targets remain blocked;
* recovery may explore pre-authorized paths and GET/HEAD on the same exact host and same
  authority/credential lineage;
* Finding -> authority request -> peer coordination is one callable production path.

This module does not convert discovery, similarity, consensus, or a finding by itself
into a new unrelated Root Authority. It is designed to remove coordination latency and
make every safe step automatic instead of weakening the terminal trust boundary.
"""
from __future__ import annotations

import dataclasses
import hashlib
import hmac
import ipaddress
import json
import os
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from .adversary_egress_request import AdversaryEgressRequestPort
from .adversary_transport import (
    AdversaryNetworkTransport,
    AdversaryTransportError,
    AdversaryTransportResult,
    load_transport_leases,
)
from .meta.adversary_egress_vote_router import route_pending_vote_requests
from .owner_envelope_fastpath import ensure_owner_fastpath_lease

ACCELERATOR_SCHEMA = "senju-adversary-autonomy-accelerator/v1"
PROVISIONAL_SCHEMA = "senju-adversary-provisional-root-candidates/v1"
COLLABORATION_SCHEMA = "senju-adversary-authority-collaboration-bus/v1"
CREDENTIAL_QUEUE_SCHEMA = "senju-adversary-credential-acquisition-queue/v1"
DENIAL_QUEUE_SCHEMA = "senju-adversary-denial-reconsideration/v1"
PRIVATE_SCOPE_SCHEMA = "senju-owner-private-network-scope/v1"
PRIVATE_SCOPE_ENVELOPE_SCHEMA = "senju-owner-private-network-scope-envelope/v1"
DEFAULT_COLLABORATORS = ("META", "X", "SENJU", "CHILD", "AI", "PR-ARMY")
TERMINAL_DENIAL_EFFECTS = frozenset({"hard_deny", "revoked"})
READ_METHODS = frozenset({"GET", "HEAD"})


class AdversaryAccelerationError(RuntimeError):
    """Raised when acceleration input violates the bounded authority contract."""


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, TypeError, json.JSONDecodeError):
        return default


def _write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _fingerprint(value: object) -> str:
    return hashlib.sha256(_canonical(value)).hexdigest()


def _normalize_url(raw: object) -> tuple[str, str]:
    try:
        parsed = urllib.parse.urlsplit(str(raw).strip())
        port = parsed.port
    except ValueError as exc:
        raise AdversaryAccelerationError("invalid target URL") from exc
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise AdversaryAccelerationError("accelerated adversary targets require HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise AdversaryAccelerationError("credentials in target URLs are forbidden")
    if port not in (None, 443):
        raise AdversaryAccelerationError("non-default HTTPS ports require separate explicit authority")
    host = parsed.hostname.strip().lower().rstrip(".")
    if not host or "*" in host:
        raise AdversaryAccelerationError("an exact host is required")
    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise AdversaryAccelerationError("invalid target host") from exc
    normalized = urllib.parse.urlunsplit(("https", host, parsed.path or "/", parsed.query, ""))
    return normalized, host


def _active_exact_leases(
    state_dir: str | Path,
    host: str,
    *,
    now: int,
) -> tuple[dict[str, Any], ...]:
    rows: list[dict[str, Any]] = []
    for raw in load_transport_leases(state_dir):
        if str(raw.get("target", "")).strip().lower().rstrip(".") != host:
            continue
        if str(raw.get("status", "active")).strip().lower() != "active":
            continue
        try:
            if int(raw.get("expires_at", 0)) <= now:
                continue
        except (TypeError, ValueError):
            continue
        if not str(raw.get("authorization_reference", "")).strip():
            continue
        rows.append(dict(raw))
    rows.sort(key=lambda row: (-int(row.get("expires_at", 0)), str(row.get("lease_id", ""))))
    return tuple(rows)


def reconsider_denial(
    *,
    effect: str,
    revoked: bool = False,
    previous_evidence_fingerprint: str | None,
    current_evidence: object,
) -> dict[str, Any]:
    """Automatically reopen only a soft DENY when materially new evidence appears."""
    normalized = str(effect).strip().lower()
    current = _fingerprint(current_evidence)
    if revoked or normalized in TERMINAL_DENIAL_EFFECTS:
        return {
            "status": "terminal",
            "effect": "revoked" if revoked else normalized,
            "evidence_fingerprint": current,
            "reopen": False,
        }
    if normalized != "deny":
        return {
            "status": "not_denied",
            "effect": normalized or "unknown",
            "evidence_fingerprint": current,
            "reopen": False,
        }
    changed = bool(previous_evidence_fingerprint) and previous_evidence_fingerprint != current
    return {
        "status": "reopened_for_review" if changed else "held_soft_deny",
        "effect": "deny",
        "evidence_fingerprint": current,
        "reopen": changed,
    }


def refresh_denial_reconsideration_queue(
    state_dir: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    """Requeue soft denials when evidence_by_host changed; never requeue hard/revoked rows."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    denials = _load(state / "authority_denials.json", {})
    rows = denials.get("denials", []) if isinstance(denials, Mapping) else []
    evidence_doc = _load(state / "authority_evidence_by_host.json", {})
    evidence_by_host = evidence_doc.get("hosts", {}) if isinstance(evidence_doc, Mapping) else {}
    if not isinstance(evidence_by_host, Mapping):
        evidence_by_host = {}

    queue: list[dict[str, Any]] = []
    terminal: list[dict[str, Any]] = []
    for raw in rows if isinstance(rows, list) else []:
        if not isinstance(raw, Mapping):
            continue
        host = str(raw.get("host", "")).strip().lower().rstrip(".")
        if not host:
            continue
        current_evidence = evidence_by_host.get(host, {})
        decision = reconsider_denial(
            effect=str(raw.get("effect", "deny")),
            revoked=bool(raw.get("revoked", False)),
            previous_evidence_fingerprint=(
                str(raw.get("evidence_fingerprint")) if raw.get("evidence_fingerprint") else None
            ),
            current_evidence=current_evidence,
        )
        row = {
            "host": host,
            "source_denial_id": raw.get("denial_id"),
            "decision": decision,
            "generated_at": current,
        }
        if decision["reopen"]:
            queue.append(row)
        elif decision["status"] == "terminal":
            terminal.append(row)

    payload = {
        "schema": DENIAL_QUEUE_SCHEMA,
        "generated_at": current,
        "reopened_count": len(queue),
        "terminal_count": len(terminal),
        "queue": queue,
        "terminal": terminal,
    }
    _write(state / "authority_denial_reconsideration_queue.json", payload)
    return payload


def _upsert_by_key(path: Path, *, schema: str, key: str, row: Mapping[str, Any], generated_at: int) -> None:
    payload = _load(path, {})
    rows = payload.get("items", []) if isinstance(payload, Mapping) else []
    current = [
        dict(item)
        for item in rows
        if isinstance(item, Mapping) and str(item.get(key, "")) != str(row.get(key, ""))
    ] if isinstance(rows, list) else []
    current.append(dict(row))
    current.sort(key=lambda item: str(item.get(key, "")))
    _write(path, {"schema": schema, "generated_at": generated_at, "items": current})


def materialize_provisional_candidate(
    state_dir: str | Path,
    *,
    url: str,
    source_actor: str,
    reason: str,
    request_id: str,
    now: int,
) -> dict[str, Any]:
    """Create a durable AI-workable candidate that explicitly carries no execution authority."""
    state = Path(state_dir)
    normalized_url, host = _normalize_url(url)
    row = {
        "candidate_id": f"provisional-root:{_fingerprint([host, request_id])[:24]}",
        "host": host,
        "url": normalized_url,
        "source_actor": source_actor,
        "reason": reason[:1000],
        "request_id": request_id,
        "status": "parallel_evidence_collection",
        "execution_authority": False,
        "credential_scope": "none",
        "created_at": now,
        "expires_at": now + 6 * 60 * 60,
    }
    _upsert_by_key(
        state / "adversary_provisional_root_candidates.json",
        schema=PROVISIONAL_SCHEMA,
        key="candidate_id",
        row=row,
        generated_at=now,
    )
    return row


def materialize_collaboration_bus(
    state_dir: str | Path,
    *,
    candidate: Mapping[str, Any],
    collaborators: Sequence[str] = DEFAULT_COLLABORATORS,
    now: int,
) -> dict[str, Any]:
    """Fan one unresolved host out to every cooperating AI without multiplying authority votes."""
    state = Path(state_dir)
    tasks: list[dict[str, Any]] = []
    for actor in sorted({str(x).strip().upper() for x in collaborators if str(x).strip()}):
        task_id = f"authority-evidence:{_fingerprint([candidate.get('candidate_id'), actor])[:24]}"
        tasks.append({
            "task_id": task_id,
            "actor": actor,
            "candidate_id": candidate.get("candidate_id"),
            "request_id": candidate.get("request_id"),
            "host": candidate.get("host"),
            "url": candidate.get("url"),
            "status": "pending",
            "objective": "collect independent authority/ownership evidence and return it to the existing review lane",
            "may_mint_authority": False,
            "created_at": now,
            "expires_at": candidate.get("expires_at"),
        })
    payload = {
        "schema": COLLABORATION_SCHEMA,
        "generated_at": now,
        "task_count": len(tasks),
        "tasks": tasks,
    }
    _write(state / "adversary_authority_collaboration_bus.json", payload)
    return payload


def prepare_credential_acquisition(
    state_dir: str | Path,
    *,
    host: str,
    now: int | None = None,
) -> dict[str, Any]:
    """Prepare automatic acquisition only for an explicit exact-host credential profile.

    `credential_target_profiles.json` is metadata-only and may name provider/scopes/grant.
    This function never creates a grant and never stores/resolves a secret.
    """
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    profiles_doc = _load(state / "credential_target_profiles.json", {})
    raw_profiles = profiles_doc.get("hosts", {}) if isinstance(profiles_doc, Mapping) else {}
    profile = raw_profiles.get(host) if isinstance(raw_profiles, Mapping) else None
    leases = _active_exact_leases(state, host, now=current)

    if not isinstance(profile, Mapping):
        row = {"host": host, "status": "no_explicit_credential_profile", "generated_at": current}
    elif not leases:
        row = {
            "host": host,
            "status": "waiting_for_host_authority",
            "provider": profile.get("provider"),
            "grant_id": profile.get("grant_id"),
            "required_scopes": list(profile.get("required_scopes", [])),
            "generated_at": current,
        }
    else:
        credential_ready = next(
            (
                lease for lease in leases
                if "credentialed_action" in {
                    str(x).strip().lower() for x in lease.get("capabilities", [])
                }
                and str(lease.get("credential_scope", "none")).strip().lower() != "none"
            ),
            None,
        )
        row = {
            "host": host,
            "status": "runtime_acquisition_ready" if credential_ready else "credential_authority_required",
            "provider": profile.get("provider"),
            "grant_id": profile.get("grant_id"),
            "required_scopes": list(profile.get("required_scopes", [])),
            "host_lease_id": credential_ready.get("lease_id") if credential_ready else leases[0].get("lease_id"),
            "credential_scope": credential_ready.get("credential_scope") if credential_ready else "none",
            "raw_credential_present": False,
            "generated_at": current,
        }
    _upsert_by_key(
        state / "adversary_credential_acquisition_queue.json",
        schema=CREDENTIAL_QUEUE_SCHEMA,
        key="host",
        row=row,
        generated_at=current,
    )
    return row


def verify_private_scope_envelope(
    envelope: Mapping[str, Any],
    *,
    hmac_key: str | bytes | None = None,
    now: int | None = None,
) -> Mapping[str, Any]:
    """Verify an owner-signed private-scope document without exposing the signing key."""
    if envelope.get("schema") != PRIVATE_SCOPE_ENVELOPE_SCHEMA:
        raise AdversaryAccelerationError("unexpected private-scope envelope schema")
    payload = envelope.get("payload")
    signature = str(envelope.get("signature", "")).strip().lower()
    if not isinstance(payload, Mapping) or payload.get("schema") != PRIVATE_SCOPE_SCHEMA:
        raise AdversaryAccelerationError("invalid private-scope payload")
    key = hmac_key if hmac_key is not None else os.environ.get("SENJU_OWNER_PRIVATE_SCOPE_HMAC_KEY", "")
    key_bytes = key.encode("utf-8") if isinstance(key, str) else bytes(key or b"")
    if not key_bytes:
        raise AdversaryAccelerationError("owner private-scope signing key is unavailable")
    expected = hmac.new(key_bytes, _canonical(payload), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise AdversaryAccelerationError("private-scope signature mismatch")
    current = int(time.time()) if now is None else int(now)
    try:
        issued_at = int(payload.get("issued_at", 0))
        expires_at = int(payload.get("expires_at", 0))
    except (TypeError, ValueError) as exc:
        raise AdversaryAccelerationError("private-scope timestamps are invalid") from exc
    if issued_at > current or expires_at <= current:
        raise AdversaryAccelerationError("private-scope payload is not currently active")
    if expires_at - issued_at > 24 * 60 * 60:
        raise AdversaryAccelerationError("private-scope lifetime exceeds 24h ceiling")
    return payload


def private_ip_authorized(
    ip_text: str,
    *,
    envelope: Mapping[str, Any],
    hmac_key: str | bytes | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    """Authorize only explicitly signed RFC1918 addresses; never loopback/link-local/metadata."""
    payload = verify_private_scope_envelope(envelope, hmac_key=hmac_key, now=now)
    try:
        ip = ipaddress.ip_address(str(ip_text).strip())
    except ValueError as exc:
        raise AdversaryAccelerationError("private target must be an IP literal") from exc
    if ip.version != 4 or not ip.is_private:
        raise AdversaryAccelerationError("private target must be an RFC1918 IPv4 address")
    if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        raise AdversaryAccelerationError("loopback/link-local/reserved private targets remain blocked")
    if str(ip) == "169.254.169.254":
        raise AdversaryAccelerationError("cloud metadata address remains blocked")
    cidrs = payload.get("allowed_cidrs", [])
    allowed = False
    for raw in cidrs if isinstance(cidrs, list) else []:
        try:
            network = ipaddress.ip_network(str(raw), strict=False)
        except ValueError:
            continue
        if network.version == 4 and network.is_private and ip in network:
            allowed = True
            break
    if not allowed:
        raise AdversaryAccelerationError("private target is outside owner-signed CIDRs")
    return {
        "authorized": True,
        "ip": str(ip),
        "authorization_reference": payload.get("authorization_reference"),
        "expires_at": int(payload.get("expires_at", 0)),
        "transport_profile": "owner-signed-private-rfc1918-exact-ip/v1",
    }


def _recovery_urls(url: str, lease: Mapping[str, Any]) -> tuple[str, ...]:
    normalized, host = _normalize_url(url)
    parsed = urllib.parse.urlsplit(normalized)
    urls = [normalized]
    for raw in lease.get("recovery_paths", []):
        path = str(raw).strip()
        if not path.startswith("/") or path.startswith("//"):
            continue
        candidate = urllib.parse.urlunsplit(("https", host, path, "", ""))
        if candidate not in urls:
            urls.append(candidate)
    return tuple(urls)


def execute_same_authority_recovery(
    transport: AdversaryNetworkTransport,
    *,
    state_dir: str | Path,
    url: str,
    now: int | None = None,
) -> AdversaryTransportResult:
    """Explore only owner-predeclared paths and GET/HEAD under one exact authority lineage."""
    current = int(time.time()) if now is None else int(now)
    _, host = _normalize_url(url)
    active = _active_exact_leases(state_dir, host, now=current)
    if not active:
        raise AdversaryTransportError(f"no active exact-host authority for recovery: {host}")
    selected = active[0]
    reference = str(selected.get("authorization_reference", "")).strip()
    credential_scope = str(selected.get("credential_scope", "none")).strip()
    lineage = tuple(
        lease for lease in active
        if str(lease.get("authorization_reference", "")).strip() == reference
        and str(lease.get("credential_scope", "none")).strip() == credential_scope
    )
    allowed_methods = {
        str(x).strip().upper() for x in selected.get("allowed_methods", ["GET", "HEAD"])
    }.intersection(READ_METHODS)
    attempts: list[tuple[str, str]] = []
    for candidate_url in _recovery_urls(url, selected):
        for method in ("GET", "HEAD"):
            if method not in allowed_methods:
                continue
            attempts.append((candidate_url, method))

    last_error: Exception | None = None
    last_result: AdversaryTransportResult | None = None
    for candidate_url, method in attempts:
        try:
            result = transport.execute(candidate_url, method=method, leases=lineage, now=current)
        except AdversaryTransportError as exc:
            last_error = exc
            continue
        last_result = result
        if result.receipt.provider_acknowledged:
            return result
    if last_result is not None:
        return last_result
    raise AdversaryTransportError(str(last_error or "same-authority recovery exhausted"))


@dataclass(frozen=True)
class AccelerationResult:
    schema: str
    status: str
    host: str
    url: str
    request_id: str | None
    lease_id: str | None
    collaboration_tasks: int
    credential_status: str
    generated_at: int

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def run_adversary_autonomy_acceleration(
    state_dir: str | Path,
    *,
    url: str,
    source_actor: str,
    reason: str,
    now: int | None = None,
) -> AccelerationResult:
    """Push a finding to immediate execution-readiness or the full parallel review lane."""
    current = int(time.time()) if now is None else int(now)
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    normalized_url, host = _normalize_url(url)

    # Existing Owner authority becomes a live exact-host lease immediately.
    ensure_owner_fastpath_lease(state, normalized_url, now=current)
    active = _active_exact_leases(state, host, now=current)
    credential = prepare_credential_acquisition(state, host=host, now=current)
    if active:
        result = AccelerationResult(
            schema=ACCELERATOR_SCHEMA,
            status="ready_existing_authority",
            host=host,
            url=normalized_url,
            request_id=None,
            lease_id=str(active[0].get("lease_id", "")) or None,
            collaboration_tasks=0,
            credential_status=str(credential.get("status", "unknown")),
            generated_at=current,
        )
        _write(state / "adversary_autonomy_accelerator_latest.json", result.to_dict())
        return result

    port = AdversaryEgressRequestPort(state)
    decision = port.request(
        normalized_url,
        source_actor=source_actor,
        reason=reason,
        capabilities=("scan", "probe"),
        methods=("GET", "HEAD"),
        existing_leases=(),
        now=current,
    )
    solicitations = route_pending_vote_requests(state, now=current)
    candidate = materialize_provisional_candidate(
        state,
        url=normalized_url,
        source_actor=source_actor,
        reason=reason,
        request_id=decision.request_id,
        now=current,
    )
    collaboration = materialize_collaboration_bus(state, candidate=candidate, now=current)
    result = AccelerationResult(
        schema=ACCELERATOR_SCHEMA,
        status="parallel_authority_acquisition",
        host=host,
        url=normalized_url,
        request_id=decision.request_id,
        lease_id=None,
        collaboration_tasks=int(collaboration.get("task_count", 0)) + int(solicitations.get("pending_count", 0)),
        credential_status=str(credential.get("status", "unknown")),
        generated_at=current,
    )
    _write(state / "adversary_autonomy_accelerator_latest.json", result.to_dict())
    return result
