"""Bounded Authorization Issuance Bureau.

Discovery is a first-class authorization *review key*: a discovered exact host
may automatically enter the authorization-verification lane and receive a
stable machine-readable intake key. Discovery alone still has no authority
effect. An authorization grant is issued only when the host is already a
canonical authorized target or a trusted verifier supplies both owner-control
verification and explicit owner authorization.

Flow:
    discovery -> review key -> owner-control verification -> bureau issuance
    -> same-or-narrower Authority handoff
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
class DiscoveryAuthorizationKey:
    key_id: str
    host: str
    source: str
    discovered_at: str
    status: str
    authority_effect: str
    next_action: str
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


def recognize_discovery_key(
    host: str,
    *,
    source: str = "discovery",
    proof_ref: str | None = None,
) -> DiscoveryAuthorizationKey:
    """Recognize discovery as a key that opens the authorization review lane.

    The key is deliberately non-authorizing. It makes the discovered host an
    accepted authorization-review candidate and gives downstream workers a
    stable object to enrich with owner-control evidence.
    """

    normalized_host = _normalize_host(host)
    discovered = datetime.now(timezone.utc)
    digest_input = "|".join([normalized_host, source, proof_ref or ""])
    key_id = "discovery-key-" + sha256(digest_input.encode("utf-8")).hexdigest()[:20]
    return DiscoveryAuthorizationKey(
        key_id=key_id,
        host=normalized_host,
        source=source,
        discovered_at=discovered.isoformat(),
        status="authorization_review_unlocked",
        authority_effect="none",
        next_action="verify_owner_control_then_issue",
        proof_ref=proof_ref,
    )


def build_discovery_authorization_intake(
    key: DiscoveryAuthorizationKey,
    *,
    requested_methods: Iterable[str] = ("GET", "HEAD"),
) -> dict[str, Any]:
    """Create the review packet opened by a discovery key."""

    methods = _normalize_methods(requested_methods)
    return {
        "schema": "authorization-issuance-bureau/discovery-key-v1",
        "trigger": "discovery_key",
        "discovery_key": asdict(key),
        "discovery_recognized": True,
        "authorization_review_unlocked": True,
        "authority_effect": "none",
        "review_required": True,
        "next_action": "verify_owner_control_then_issue",
        "candidate": {
            "host": key.host,
            "requested_methods": list(methods),
            "credential_scope_ceiling": "synthetic_test",
            "private_network": False,
        },
    }


def issue_authorization(
    evidence: AuthorizationEvidence,
    *,
    canonical_authorized_hosts: set[str] | None = None,
) -> IssuedAuthorization:
    """Issue a bounded authorization grant after authorization evidence exists."""

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


def issue_from_discovery_key(
    key: DiscoveryAuthorizationKey,
    evidence: AuthorizationEvidence,
    *,
    canonical_authorized_hosts: set[str] | None = None,
) -> IssuedAuthorization:
    """Continue a discovery-opened lane into issuance after verification.

    The discovery key binds the review to one exact host. Verification cannot be
    borrowed from another discovered host.
    """

    if key.host != _normalize_host(evidence.host):
        raise PermissionError("authorization denied: discovery key host mismatch")
    return issue_authorization(
        evidence,
        canonical_authorized_hosts=canonical_authorized_hosts,
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
