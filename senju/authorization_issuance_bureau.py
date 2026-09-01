"""Bounded Authorization Issuance Bureau.

This module turns *verified owner-controlled authorization evidence* into a
machine-readable authorization grant that downstream Authority machinery can
consume.  It deliberately does not let discovery, negotiation success, or AI
consensus self-authorize an unrelated third-party host.

The bureau is intended to be the missing independent institution between
review and Authority materialization:

candidate -> evidence verification -> bureau issuance -> Authority handoff

Security invariant: issuance requires either an exact canonical authorized
host or an explicit owner-control proof supplied by a trusted verifier.  The
bureau never harvests credentials and never treats a discovered host as proof.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any, Iterable


_ALLOWED_METHODS = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"}


@dataclass(frozen=True)
class AuthorizationEvidence:
    host: str
    source: str
    owner_control_verified: bool
    explicit_owner_authorization: bool
    requested_methods: tuple[str, ...] = ("GET", "HEAD")
    credential_scope: str = "none"
    private_network: bool = False
    expires_in_minutes: int = 60
    proof_ref: str | None = None


@dataclass(frozen=True)
class IssuedAuthorization:
    authorization_id: str
    host: str
    issued_at: str
    expires_at: str
    allowed_methods: tuple[str, ...]
    credential_scope: str
    private_network: bool
    authority_effect: str
    issuer: str
    proof_ref: str | None


def _normalize_host(host: str) -> str:
    value = host.strip().lower().rstrip(".")
    if not value or "/" in value or "://" in value:
        raise ValueError("host must be an exact hostname")
    return value


def _normalize_methods(methods: Iterable[str]) -> tuple[str, ...]:
    normalized = tuple(sorted({m.upper().strip() for m in methods if m.strip()}))
    if not normalized:
        raise ValueError("at least one method is required")
    if any(m not in _ALLOWED_METHODS for m in normalized):
        raise ValueError("requested method outside bureau ceiling")
    return normalized


def issue_authorization(
    evidence: AuthorizationEvidence,
    *,
    canonical_authorized_hosts: set[str] | None = None,
) -> IssuedAuthorization:
    """Issue a bounded authorization grant.

    A host is eligible when either:
      * it is already an exact canonical authorized host; or
      * a trusted verifier supplied both owner-control verification and explicit
        owner authorization.

    This is intentionally stronger than a recommendation but weaker than a
    self-issued Root: discovery/negotiation alone can never satisfy the gate.
    """

    host = _normalize_host(evidence.host)
    canonical = {_normalize_host(h) for h in (canonical_authorized_hosts or set())}

    eligible = host in canonical or (
        evidence.owner_control_verified and evidence.explicit_owner_authorization
    )
    if not eligible:
        raise PermissionError("authorization denied: no verified owner-controlled authorization")

    if evidence.private_network:
        raise PermissionError("authorization denied: private-network scope is not issuable here")

    methods = _normalize_methods(evidence.requested_methods)
    if evidence.credential_scope not in {"none", "synthetic_test"}:
        raise PermissionError("authorization denied: credential scope outside bureau ceiling")

    ttl = max(5, min(int(evidence.expires_in_minutes), 24 * 60))
    issued = datetime.now(timezone.utc)
    expires = issued + timedelta(minutes=ttl)

    digest_input = "|".join(
        [host, evidence.source, issued.isoformat(), ",".join(methods), evidence.credential_scope]
    )
    authorization_id = "authz-" + sha256(digest_input.encode("utf-8")).hexdigest()[:20]

    return IssuedAuthorization(
        authorization_id=authorization_id,
        host=host,
        issued_at=issued.isoformat(),
        expires_at=expires.isoformat(),
        allowed_methods=methods,
        credential_scope=evidence.credential_scope,
        private_network=False,
        authority_effect="authorization_issued",
        issuer="SENJU_AUTHORIZATION_ISSUANCE_BUREAU",
        proof_ref=evidence.proof_ref,
    )


def build_authority_handoff(grant: IssuedAuthorization) -> dict[str, Any]:
    """Create a downstream Authority handoff packet from an issued grant."""

    return {
        "schema": "authorization-issuance-bureau/v1",
        "authorization": asdict(grant),
        "next_action": "materialize_same_or_narrower_authority",
        "requested_authority": {
            "host": grant.host,
            "methods": list(grant.allowed_methods),
            "credential_scope": grant.credential_scope,
            "private_network": False,
            "inheritance": "same_or_narrower",
        },
    }
