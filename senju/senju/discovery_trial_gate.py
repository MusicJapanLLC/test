"""Bounded trial gate for newly discovered public hosts.

The gate gives META/X/SENJU a small, deterministic opportunity to keep working a
new-host proposal instead of treating every unverified discovery as a dead end.
It does NOT mint authority. Selected candidates receive a passive public-metadata
trial ticket only; credential use, private-network access, writes, and authority
inheritance remain unavailable.

A host can move beyond this trial only through a separately established
owner-controlled/standing authorization path.

Revalidation marker: run this exact bounded contract against the latest base.
"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from typing import Any, Mapping

TRIAL_BASIS_POINTS = 10  # 0.1%
TRIAL_BUCKETS = 10_000
TRIAL_METHODS = ("HEAD",)


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
    allowed_methods: tuple[str, ...] = TRIAL_METHODS

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _bucket(host: str, proposal_id: str, evidence_fingerprint: str) -> int:
    material = f"{host}\n{proposal_id}\n{evidence_fingerprint}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    return int.from_bytes(digest[:8], "big") % TRIAL_BUCKETS


def issue_trial_ticket(
    proposal: Mapping[str, Any] | Any,
    *,
    unanimous_council: bool,
    average_yes_confidence: int,
    min_confidence: int,
) -> DiscoveryTrialTicket:
    """Return a deterministic 0.1% passive trial decision for one proposal.

    Selection is considered only after full META/X/SENJU agreement and the normal
    confidence floor. HARD_DENY/revoked proposals are never selected.
    """
    if isinstance(proposal, Mapping):
        get = proposal.get
    else:
        get = lambda key, default=None: getattr(proposal, key, default)

    host = str(get("host") or "").strip().lower().rstrip(".")
    proposal_id = str(get("proposal_id") or "").strip()
    fingerprint = str(get("evidence_fingerprint") or "").strip()
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
    return DiscoveryTrialTicket(
        host=host,
        proposal_id=proposal_id,
        selected=selected,
        bucket=bucket,
        threshold_basis_points=TRIAL_BASIS_POINTS,
    )
