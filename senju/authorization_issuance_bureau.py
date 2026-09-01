"""Bounded Authorization Issuance Bureau.

Authorization review keys are intentionally easy to obtain. Any requester may
open an exact-host authorization review lane and receive a stable
machine-readable key. Possession of that key has no authority effect.

Authorization issuance supports three legitimate bases:
1. an exact canonical authorized target;
2. trusted verifier evidence of owner control plus explicit authorization; or
3. a verified cloud-control attestation for a service owned in a connected
   account, with explicit owner authorization for that service.

The third route deliberately loosens the exit side without turning discovery or
AI consensus into permission for unrelated third-party hosts.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any, Iterable
from urllib.parse import urlparse


_ALLOWED_METHODS = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH"}
_TRUSTED_CONTROL_PROVIDERS = {"render", "vercel"}


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
class VerifiedControlAttestation:
    provider: str
    host: str
    service_url: str
    provider_control_verified: bool
    owner_authorized: bool
    proof_ref: str
    allowed_methods: tuple[str, ...] = ("GET", "HEAD")
    credential_scope: str = "none"
    private_network: bool = False
    workspace_id: str | None = None
    service_id: str | None = None


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
    requester: str | None = None
    acquisition_policy: str = "open"


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
    authorization_basis: str = "verified_owner_authorization"


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


def _normalize_requester(requester: str | None) -> str | None:
    if requester is None:
        return None
    value = str(requester).strip()
    return value[:160] or None


def recognize_discovery_key(
    host: str,
    *,
    source: str = "discovery",
    proof_ref: str | None = None,
    requester: str | None = None,
) -> DiscoveryAuthorizationKey:
    normalized_host = _normalize_host(host)
    normalized_requester = _normalize_requester(requester)
    discovered = datetime.now(timezone.utc)
    digest_input = "|".join(
        [normalized_host, source, normalized_requester or "", proof_ref or ""]
    )
    key_id = "review-key-" + sha256(digest_input.encode("utf-8")).hexdigest()[:20]
    return DiscoveryAuthorizationKey(
        key_id=key_id,
        host=normalized_host,
        source=source,
        discovered_at=discovered.isoformat(),
        status="authorization_review_unlocked",
        authority_effect="none",
        next_action="verify_authorization_then_issue",
        proof_ref=proof_ref,
        requester=normalized_requester,
        acquisition_policy="open",
    )


def request_review_key(
    host: str,
    *,
    requester: str | None = None,
    source: str = "public-review-request",
    proof_ref: str | None = None,
) -> DiscoveryAuthorizationKey:
    return recognize_discovery_key(
        host,
        source=source,
        proof_ref=proof_ref,
        requester=requester,
    )


def build_discovery_authorization_intake(
    key: DiscoveryAuthorizationKey,
    *,
    requested_methods: Iterable[str] = ("GET", "HEAD"),
) -> dict[str, Any]:
    methods = _normalize_methods(requested_methods)
    return {
        "schema": "authorization-issuance-bureau/review-key-v2",
        "trigger": "open_review_key",
        "review_key": asdict(key),
        "review_key_acquisition": "open",
        "authorization_review_unlocked": True,
        "authority_effect": "none",
        "review_required": True,
        "next_action": "verify_authorization_then_issue",
        "candidate": {
            "host": key.host,
            "requested_methods": list(methods),
            "credential_scope_ceiling": "synthetic_test",
            "private_network": False,
        },
    }


def _build_grant(evidence: AuthorizationEvidence, *, basis: str) -> IssuedAuthorization:
    host = _normalize_host(evidence.host)
    if evidence.private_network:
        raise PermissionError("authorization denied: private-network scope is not issuable here")
    methods = _normalize_methods(evidence.requested_methods)
    if evidence.credential_scope not in {"none", "synthetic_test"}:
        raise PermissionError("authorization denied: credential scope outside bureau ceiling")

    ttl = max(5, min(int(evidence.expires_in_minutes), 24 * 60))
    issued = datetime.now(timezone.utc)
    expires = issued + timedelta(minutes=ttl)
    digest_input = "|".join(
        [host, evidence.source, issued.isoformat(), ",".join(methods), evidence.credential_scope, basis]
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
        authorization_basis=basis,
    )


def issue_authorization(
    evidence: AuthorizationEvidence,
    *,
    canonical_authorized_hosts: set[str] | None = None,
) -> IssuedAuthorization:
    host = _normalize_host(evidence.host)
    canonical = {_normalize_host(h) for h in (canonical_authorized_hosts or set())}
    if host in canonical:
        return _build_grant(evidence, basis="canonical_authorized_host")
    if evidence.owner_control_verified and evidence.explicit_owner_authorization:
        return _build_grant(evidence, basis="trusted_owner_control_verification")
    raise PermissionError("authorization denied: no verified authorization basis")


def issue_from_verified_control_attestation(
    attestation: VerifiedControlAttestation,
    *,
    expires_in_minutes: int = 60,
) -> IssuedAuthorization:
    """Issue for a newly created host proven controlled in a connected cloud account.

    This route does not require prior canonical registration. It requires a
    provider-side control attestation and explicit owner authorization for the
    exact service being promoted.
    """

    provider = str(attestation.provider).strip().lower()
    if provider not in _TRUSTED_CONTROL_PROVIDERS:
        raise PermissionError("authorization denied: untrusted control provider")
    host = _normalize_host(attestation.host)
    parsed = urlparse(attestation.service_url)
    if parsed.scheme != "https" or _normalize_host(parsed.hostname or "") != host:
        raise PermissionError("authorization denied: service URL does not bind exact host")
    if not attestation.provider_control_verified or not attestation.owner_authorized:
        raise PermissionError("authorization denied: cloud control or owner authorization missing")
    if not attestation.proof_ref.strip():
        raise PermissionError("authorization denied: control proof reference required")
    if attestation.private_network:
        raise PermissionError("authorization denied: private-network scope is not issuable here")
    if attestation.credential_scope not in {"none", "synthetic_test"}:
        raise PermissionError("authorization denied: credential scope outside bureau ceiling")

    evidence = AuthorizationEvidence(
        host=host,
        source=f"verified-cloud-control:{provider}",
        owner_control_verified=True,
        explicit_owner_authorization=True,
        requested_methods=_normalize_methods(attestation.allowed_methods),
        credential_scope=attestation.credential_scope,
        private_network=False,
        expires_in_minutes=expires_in_minutes,
        proof_ref=attestation.proof_ref,
    )
    return _build_grant(evidence, basis=f"verified_cloud_control:{provider}")


def issue_from_discovery_key(
    key: DiscoveryAuthorizationKey,
    evidence: AuthorizationEvidence,
    *,
    canonical_authorized_hosts: set[str] | None = None,
) -> IssuedAuthorization:
    if key.host != _normalize_host(evidence.host):
        raise PermissionError("authorization denied: review key host mismatch")
    return issue_authorization(evidence, canonical_authorized_hosts=canonical_authorized_hosts)


def build_authority_handoff(grant: IssuedAuthorization) -> dict[str, Any]:
    return {
        "schema": "authorization-issuance-bureau/v2",
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
