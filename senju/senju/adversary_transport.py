"""Real outbound transport for adversary systems, bound to existing authority leases.

This module closes the gap between adversary findings and Senju's real HTTP(S)
transport. It does not create authority. An execution must consume an active exact-host
lease that already exists in adversary promotion state, shared discovery capability
state, or the Owner Envelope Fast Path.

Security invariants:
- exact HTTPS hosts only;
- GET/HEAD only for the adversary lane;
- DNS must resolve to public/global addresses through ExternalContactClient;
- every redirect hop is revalidated against an active exact-host lease;
- cross-host redirects are allowed only between active leases sharing the same
  authorization_reference, and sensitive headers are stripped by ExternalContactClient;
- credentials are injected only when the selected existing lease explicitly carries
  both a non-none credential_scope and credentialed_action;
- credential material is never persisted in transport receipts;
- recovery retries the same URL and same authority lineage with same-or-narrower method.
"""
from __future__ import annotations

import dataclasses
import json
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .external import ContactResult, ExternalContactClient, ExternalContactError, ExternalContactPolicy

TRANSPORT_RECEIPT_SCHEMA = "senju-adversary-network-transport/v1"
READ_METHODS = frozenset({"GET", "HEAD"})
READ_CAPABILITIES = frozenset({"scan", "probe"})


class AdversaryTransportError(RuntimeError):
    """Raised when no existing authority permits the requested transport action."""


CredentialProvider = Callable[[str, str], Mapping[str, str]]


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _host(url: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(str(url).strip())
        port = parsed.port
    except ValueError as exc:
        raise AdversaryTransportError("invalid adversary target URL") from exc
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise AdversaryTransportError("adversary network transport requires HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise AdversaryTransportError("credentials in target URLs are forbidden")
    if port not in (None, 443):
        raise AdversaryTransportError("non-default HTTPS ports require separate explicit authority")
    value = parsed.hostname.strip().lower().rstrip(".")
    if not value or "*" in value:
        raise AdversaryTransportError("transport requires an exact host")
    try:
        return value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise AdversaryTransportError("invalid target host") from exc


def _lease_rows(payload: object) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []
    rows = payload.get("leases", [])
    if not isinstance(rows, list):
        return []
    return [dict(row) for row in rows if isinstance(row, dict)]


def load_transport_leases(state_dir: str | Path) -> tuple[dict[str, Any], ...]:
    """Load #481, #459 and immediate Owner Envelope Fast Path leases."""
    state = Path(state_dir)
    rows: list[dict[str, Any]] = []
    rows.extend(_lease_rows(_load(state / "adversary_owner_promoted_leases.json", {})))
    rows.extend(_lease_rows(_load(state / "discovery_capability_leases.json", {})))
    rows.extend(_lease_rows(_load(state / "adversary_owner_fastpath_leases.json", {})))
    # Deterministic order keeps selection/recovery reproducible.
    rows.sort(
        key=lambda row: (
            str(row.get("target", "")),
            -int(row.get("expires_at", 0) or 0),
            str(row.get("lease_id", "")),
        )
    )
    return tuple(rows)


def _active_exact_lease(
    leases: Sequence[Mapping[str, Any]],
    *,
    host: str,
    method: str,
    now: int,
) -> dict[str, Any]:
    wanted_method = method.upper().strip()
    if wanted_method not in READ_METHODS:
        raise AdversaryTransportError(f"adversary transport method is not allowed: {wanted_method}")

    candidates: list[dict[str, Any]] = []
    for raw in leases:
        target = str(raw.get("target", "")).strip().lower().rstrip(".")
        if target != host:
            continue
        if str(raw.get("status", "active")).strip().lower() != "active":
            continue
        try:
            expires_at = int(raw.get("expires_at", 0))
        except (TypeError, ValueError):
            continue
        if expires_at <= now:
            continue
        caps = {str(x).strip().lower() for x in raw.get("capabilities", []) if str(x).strip()}
        if not caps.intersection(READ_CAPABILITIES):
            continue
        allowed_methods = {
            str(x).strip().upper()
            for x in raw.get("allowed_methods", ("GET", "HEAD"))
            if str(x).strip()
        }
        if wanted_method not in allowed_methods:
            continue
        reference = str(raw.get("authorization_reference", "")).strip()
        lease_id = str(raw.get("lease_id", "")).strip()
        if not reference or not lease_id:
            continue
        row = dict(raw)
        row["_normalized_capabilities"] = sorted(caps)
        row["_normalized_methods"] = sorted(allowed_methods)
        candidates.append(row)

    if not candidates:
        raise AdversaryTransportError(f"no active exact-host lease permits {wanted_method} -> {host}")
    candidates.sort(key=lambda row: (-int(row.get("expires_at", 0)), str(row.get("lease_id", ""))))
    return candidates[0]


def _related_authorized_hosts(
    leases: Sequence[Mapping[str, Any]],
    *,
    selected: Mapping[str, Any],
    method: str,
    now: int,
) -> tuple[str, ...]:
    """Return exact hosts that share the selected live authorization reference.

    This is a bounded redirect relaxation: a provider may redirect between two hosts
    already carrying independent active exact-host leases from the same authority.
    It never authorizes a host merely because a redirect points at it.
    """
    reference = str(selected.get("authorization_reference", "")).strip()
    if not reference:
        return (str(selected.get("target", "")).strip().lower().rstrip("."),)
    wanted_method = method.upper().strip()
    hosts: set[str] = set()
    for raw in leases:
        if str(raw.get("authorization_reference", "")).strip() != reference:
            continue
        if str(raw.get("status", "active")).strip().lower() != "active":
            continue
        try:
            if int(raw.get("expires_at", 0)) <= now:
                continue
        except (TypeError, ValueError):
            continue
        caps = {str(x).strip().lower() for x in raw.get("capabilities", []) if str(x).strip()}
        if not caps.intersection(READ_CAPABILITIES):
            continue
        allowed_methods = {
            str(x).strip().upper()
            for x in raw.get("allowed_methods", ("GET", "HEAD"))
            if str(x).strip()
        }
        if wanted_method not in allowed_methods:
            continue
        target = str(raw.get("target", "")).strip().lower().rstrip(".")
        if target:
            hosts.add(target)
    selected_host = str(selected.get("target", "")).strip().lower().rstrip(".")
    if selected_host:
        hosts.add(selected_host)
    return tuple(sorted(hosts))


@dataclass(frozen=True)
class AdversaryTransportReceipt:
    schema: str
    lease_id: str
    authorization_reference: str
    authorization_basis: str | None
    host: str
    method: str
    requested_url: str
    final_url: str
    status: int
    provider_acknowledged: bool
    contacted_hosts: tuple[str, ...]
    resolved_ips: tuple[str, ...]
    redirect_count: int
    attempt_count: int
    response_bytes: int
    response_sha256: str
    credential_scope: str
    source_action_fingerprint: str | None
    executed_at: int

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclass(frozen=True)
class AdversaryTransportResult:
    receipt: AdversaryTransportReceipt
    body: bytes


class AdversaryNetworkTransport:
    """Execute real outbound GET/HEAD only under already-active authority leases."""

    def __init__(
        self,
        state_dir: str | Path,
        *,
        credential_provider: CredentialProvider | None = None,
        client_factory: Callable[[ExternalContactPolicy], ExternalContactClient] = ExternalContactClient,
    ) -> None:
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.credential_provider = credential_provider
        self.client_factory = client_factory

    @property
    def receipt_path(self) -> Path:
        return self.state_dir / "adversary_transport_receipts.ndjson"

    def _credential_headers(self, lease: Mapping[str, Any], host: str) -> tuple[str, Mapping[str, str]]:
        scope = str(lease.get("credential_scope", "none")).strip() or "none"
        if scope == "none":
            return scope, {}
        caps = {str(x).strip().lower() for x in lease.get("capabilities", []) if str(x).strip()}
        if "credentialed_action" not in caps:
            raise AdversaryTransportError("credential scope is present without credentialed_action authority")
        if self.credential_provider is None:
            raise AdversaryTransportError("credentialed lease requires an explicit runtime credential provider")
        supplied = self.credential_provider(scope, host)
        if not isinstance(supplied, Mapping):
            raise AdversaryTransportError("credential provider must return request headers")
        headers = {str(k): str(v) for k, v in supplied.items()}
        return scope, headers

    def execute(
        self,
        url: str,
        *,
        method: str = "GET",
        leases: Sequence[Mapping[str, Any]] | None = None,
        now: int | None = None,
    ) -> AdversaryTransportResult:
        current = int(time.time()) if now is None else int(now)
        host = _host(url)
        normalized_method = method.upper().strip()
        available = tuple(leases) if leases is not None else load_transport_leases(self.state_dir)
        lease = _active_exact_lease(available, host=host, method=normalized_method, now=current)
        credential_scope, headers = self._credential_headers(lease, host)

        # Redirects may move only among active exact hosts carrying the same authority
        # reference. ExternalContactClient still validates DNS and every hop, and strips
        # Authorization/Cookie/API-key headers on cross-host redirects.
        allow_hosts = _related_authorized_hosts(
            available,
            selected=lease,
            method=normalized_method,
            now=current,
        )
        policy = ExternalContactPolicy.from_hosts(
            allow_hosts,
            allow_http=False,
            allow_delete=False,
            follow_redirects=True,
            max_redirects=3,
            timeout_seconds=8.0,
            max_response_bytes=1024 * 1024,
            retries=2,
        )
        client = self.client_factory(policy)
        try:
            result: ContactResult = client.contact_with_body(
                url,
                method=normalized_method,
                headers=headers,
            )
        except ExternalContactError as exc:
            raise AdversaryTransportError(str(exc)) from exc

        raw = result.receipt
        receipt = AdversaryTransportReceipt(
            schema=TRANSPORT_RECEIPT_SCHEMA,
            lease_id=str(lease.get("lease_id")),
            authorization_reference=str(lease.get("authorization_reference")),
            authorization_basis=(
                str(lease.get("authorization_basis"))
                if lease.get("authorization_basis") is not None
                else None
            ),
            host=host,
            method=normalized_method,
            requested_url=raw.requested_url,
            final_url=raw.final_url,
            status=raw.status,
            provider_acknowledged=raw.provider_acknowledged,
            contacted_hosts=tuple(raw.contacted_hosts),
            resolved_ips=tuple(raw.resolved_ips),
            redirect_count=raw.redirect_count,
            attempt_count=raw.attempt_count,
            response_bytes=raw.response_bytes,
            response_sha256=raw.response_sha256,
            credential_scope=credential_scope,
            source_action_fingerprint=(
                str(lease.get("source_action_fingerprint"))
                if lease.get("source_action_fingerprint") is not None
                else None
            ),
            executed_at=current,
        )
        with self.receipt_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(receipt.to_dict(), ensure_ascii=False, sort_keys=True) + "\n")
        return AdversaryTransportResult(receipt=receipt, body=result.body)

    def execute_with_recovery(
        self,
        url: str,
        *,
        method: str = "GET",
        leases: Sequence[Mapping[str, Any]] | None = None,
        now: int | None = None,
    ) -> AdversaryTransportResult:
        """Retry under the same live authorization lineage.

        GET may fall back to HEAD only when the selected exact-host lease already permits
        HEAD. No recovery step invents a credential, capability, host authority, or scope.
        """
        current = int(time.time()) if now is None else int(now)
        available = tuple(leases) if leases is not None else load_transport_leases(self.state_dir)
        try:
            return self.execute(url, method=method, leases=available, now=current)
        except AdversaryTransportError as first:
            if method.upper().strip() != "GET":
                raise
            host = _host(url)
            try:
                _active_exact_lease(available, host=host, method="HEAD", now=current)
            except AdversaryTransportError:
                raise first
            return self.execute(url, method="HEAD", leases=available, now=current)
