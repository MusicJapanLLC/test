"""Bounded trial gate for newly discovered public hosts.

Unverified discovery remains a passive metadata-only trial. A selected proposal may gain
short-lived real write capability only when the same exact host already carries explicit
Owner verification evidence (``owner_verified_domain`` or ``owner_exact_link``).

The active trial is deliberately not Authority: it never enters the effective Owner
ceiling, never enables private networks, never mints/discovers credentials, and never
inherits trust across redirects. Callers may supply an already-existing credential for
the exact verified host; the transport layer continues to revalidate redirect targets and
strip sensitive headers on cross-host redirects.
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from typing import Any, Mapping

TRIAL_BASIS_POINTS = 10  # 0.1%
TRIAL_BUCKETS = 10_000
PASSIVE_TRIAL_METHODS = ("HEAD",)
ACTIVE_TRIAL_METHODS = ("HEAD", "POST", "PUT", "PATCH")
OWNER_VERIFIED_ACTIVE_PROOF_TYPES = frozenset({"owner_verified_domain", "owner_exact_link"})
ACTIVE_TRIAL_TTL_SECONDS = 600


@dataclass(frozen=True)
class DiscoveryTrialTicket:
    host: str
    proposal_id: str
    selected: bool
    bucket: int
    threshold_basis_points: int
    mode: str = "passive_public_metadata_only"
    authority_effect: bool = False
    credential_scope: str = "none"
    private_network: bool = False
    external_write: bool = False
    authority_inheritance: bool = False
    redirect_trust_inheritance: bool = False
    active_capability: bool = False
    expires_in_seconds: int = 0
    allowed_methods: tuple[str, ...] = PASSIVE_TRIAL_METHODS

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _bucket(host: str, proposal_id: str, evidence_fingerprint: str) -> int:
    material = f"{host}\n{proposal_id}\n{evidence_fingerprint}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    return int.from_bytes(digest[:8], "big") % TRIAL_BUCKETS


def _requested_methods(get: Any) -> frozenset[str]:
    raw = get("requested_methods", ())
    if not isinstance(raw, (list, tuple, set, frozenset)):
        return frozenset()
    return frozenset(str(value).strip().upper() for value in raw if str(value).strip())


def issue_trial_ticket(
    proposal: Mapping[str, Any] | Any,
    *,
    unanimous_council: bool,
    average_yes_confidence: int,
    min_confidence: int,
) -> DiscoveryTrialTicket:
    """Return a deterministic 0.1% trial decision for one proposal.

    Selection is considered only after full META/X/SENJU agreement and the normal
    confidence floor. HARD_DENY/revoked proposals are never selected.

    Unverified discovery receives only passive HEAD capability. A selected proposal with
    explicit Owner-verification proof may receive a ten-minute exact-host write trial for
    the requested subset of POST/PUT/PATCH. This is an execution capability, not an
    Authority grant.
    """
    if isinstance(proposal, Mapping):
        get = proposal.get
    else:
        get = lambda key, default=None: getattr(proposal, key, default)

    host = str(get("host") or "").strip().lower().rstrip(".")
    proposal_id = str(get("proposal_id") or "").strip()
    fingerprint = str(get("evidence_fingerprint") or "").strip()
    proof_type = str(get("proof_type") or "unverified_discovery").strip()
    proof_ref = str(get("proof_ref") or "").strip()
    requested_methods = _requested_methods(get)
    hard_deny = bool(get("hard_deny", False))
    revoked = bool(get("revoked", False))

    bucket = _bucket(host, proposal_id, fingerprint)
    eligible = bool(
        host
        and proposal_id
        and fingerprint
        and unanimous_council
        and average_yes_confidence >= min_confidence
        and not hard_deny
        and not revoked
    )
    selected = eligible and bucket < TRIAL_BASIS_POINTS
    owner_verified_active = bool(
        selected
        and proof_type in OWNER_VERIFIED_ACTIVE_PROOF_TYPES
        and proof_ref
    )

    if owner_verified_active:
        allowed_methods = tuple(
            method
            for method in ACTIVE_TRIAL_METHODS
            if method == "HEAD" or method in requested_methods
        )
        return DiscoveryTrialTicket(
            host=host,
            proposal_id=proposal_id,
            selected=True,
            bucket=bucket,
            threshold_basis_points=TRIAL_BASIS_POINTS,
            mode="owner_verified_exact_host_active_trial",
            credential_scope="caller_supplied_existing",
            private_network=False,
            external_write=any(method in {"POST", "PUT", "PATCH"} for method in allowed_methods),
            authority_inheritance=False,
            redirect_trust_inheritance=False,
            active_capability=True,
            expires_in_seconds=ACTIVE_TRIAL_TTL_SECONDS,
            allowed_methods=allowed_methods,
        )

    return DiscoveryTrialTicket(
        host=host,
        proposal_id=proposal_id,
        selected=selected,
        bucket=bucket,
        threshold_basis_points=TRIAL_BASIS_POINTS,
    )
