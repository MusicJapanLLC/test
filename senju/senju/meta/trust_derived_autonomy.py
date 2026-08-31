"""Convert transitive trust into bounded autonomous capability leases.

A live trust chain can now authorize useful autonomous work instead of being only
advisory metadata. The conversion is intentionally capability-scoped: trust can grant
repository editing, testing, issue/PR work, audit output, and read-only access to an
already-authorized target without a fresh per-action owner approval.

Trust alone does not mint credentials, arbitrary network authority, production deploy,
PR merge, unrestricted shell, destructive deletion, or other privileged capabilities.
Those require a separate authority source.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Iterable

from .transitive_trust import TrustEdge, TrustError, resolve_trust

DEFAULT_AUTONOMY_LEASE_SECONDS = 6 * 60 * 60
MAX_AUTONOMY_LEASE_SECONDS = 24 * 60 * 60

STANDARD_AUTONOMOUS_CAPABILITIES = frozenset(
    {
        "repo.read",
        "repo.branch.create",
        "repo.code.write",
        "repo.test.run",
        "github.issue.write",
        "github.pr.open",
        "github.pr.comment",
        "audit.write",
        "artifact.create",
        "authorized_target.read",
    }
)

# These names are explicit documentation and enforcement points: even wildcard trust
# is not enough to acquire them from this module.
PRIVILEGED_CAPABILITIES = frozenset(
    {
        "github.pr.merge",
        "github.workflow.write",
        "github.release.publish",
        "secrets.read",
        "credentials.issue",
        "network.private.unscoped",
        "network.metadata.read",
        "deployment.production",
        "shell.unrestricted",
        "artifact.delete",
    }
)

AUTONOMY_BUNDLE_SCOPE = "autonomy:standard"
CAPABILITY_SCOPE_PREFIX = "cap:"


class AutonomyError(RuntimeError):
    """Raised when trust-derived autonomous execution is not authorized."""


def _utc_now(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise AutonomyError("now must be timezone-aware")
    return value.astimezone(dt.timezone.utc)


def _normalize_capabilities(values: Iterable[str]) -> tuple[str, ...]:
    capabilities = tuple(sorted({str(value).strip() for value in values if str(value).strip()}))
    if not capabilities:
        raise AutonomyError("at least one autonomous capability is required")
    return capabilities


def capabilities_from_effective_trust_scopes(scopes: Iterable[str]) -> tuple[str, ...]:
    """Translate effective trust scopes into executable low-risk capabilities."""
    effective = {str(scope).strip() for scope in scopes if str(scope).strip()}
    allowed: set[str] = set()

    if "*" in effective or AUTONOMY_BUNDLE_SCOPE in effective:
        allowed.update(STANDARD_AUTONOMOUS_CAPABILITIES)

    for scope in effective:
        if not scope.startswith(CAPABILITY_SCOPE_PREFIX):
            continue
        capability = scope[len(CAPABILITY_SCOPE_PREFIX) :].strip()
        if capability in STANDARD_AUTONOMOUS_CAPABILITIES:
            allowed.add(capability)

    allowed.difference_update(PRIVILEGED_CAPABILITIES)
    return tuple(sorted(allowed))


@dataclasses.dataclass(frozen=True)
class DelegatedCapabilityLease:
    lease_id: str
    owner: str
    actor: str
    trust_path: tuple[str, ...]
    effective_trust_scopes: tuple[str, ...]
    capabilities: tuple[str, ...]
    issued_at_utc: str
    expires_at_utc: str
    renewal_reason: str = "trust_chain_still_valid"
    credential_scope: str = "none"
    destructive: bool = False

    def is_active(self, *, now: dt.datetime | None = None) -> bool:
        current = _utc_now(now)
        expiry = dt.datetime.fromisoformat(self.expires_at_utc.replace("Z", "+00:00"))
        return current <= expiry.astimezone(dt.timezone.utc)

    def allows(self, capability: str, *, now: dt.datetime | None = None) -> bool:
        normalized = str(capability).strip()
        return self.is_active(now=now) and normalized in self.capabilities


@dataclasses.dataclass(frozen=True)
class CapabilityLeaseResult:
    lease: DelegatedCapabilityLease
    automatically_issued: bool
    automatically_renewable: bool


def issue_capability_lease_from_trust(
    *,
    owner: str,
    actor: str,
    edges: Iterable[TrustEdge],
    requested_capabilities: Iterable[str] | None = None,
    lease_seconds: int = DEFAULT_AUTONOMY_LEASE_SECONDS,
    reason: str = "trusted_autonomous_work",
    now: dt.datetime | None = None,
) -> CapabilityLeaseResult:
    """Issue an execution lease directly from a valid transitive trust chain."""
    edge_list = tuple(edges)
    try:
        resolution = resolve_trust(owner=owner, subject=actor, edges=edge_list)
    except TrustError as exc:
        raise AutonomyError(str(exc)) from exc
    if not resolution.trusted:
        raise AutonomyError("actor is not transitively trusted by owner")

    allowed = set(capabilities_from_effective_trust_scopes(resolution.effective_scopes))
    if not allowed:
        raise AutonomyError("trust chain grants no executable autonomous capabilities")

    requested = (
        set(_normalize_capabilities(requested_capabilities))
        if requested_capabilities is not None
        else set(allowed)
    )
    privileged = requested & PRIVILEGED_CAPABILITIES
    if privileged:
        raise AutonomyError(
            f"trust alone cannot grant privileged capabilities: {sorted(privileged)}"
        )
    if not requested.issubset(allowed):
        missing = sorted(requested - allowed)
        raise AutonomyError(f"requested capabilities exceed effective trust scope: {missing}")

    ttl = int(lease_seconds)
    if ttl < 300 or ttl > MAX_AUTONOMY_LEASE_SECONDS:
        raise AutonomyError(
            f"lease_seconds must be between 300 and {MAX_AUTONOMY_LEASE_SECONDS}"
        )
    renewal_reason = str(reason).strip()
    if not renewal_reason:
        raise AutonomyError("renewal reason is required")

    issued = _utc_now(now)
    expires = issued + dt.timedelta(seconds=ttl)
    owner_name = str(owner).strip()
    actor_name = str(actor).strip()
    lease = DelegatedCapabilityLease(
        lease_id=f"autonomy:{owner_name}:{actor_name}:{int(issued.timestamp())}",
        owner=owner_name,
        actor=actor_name,
        trust_path=resolution.path,
        effective_trust_scopes=resolution.effective_scopes,
        capabilities=tuple(sorted(requested)),
        issued_at_utc=issued.isoformat(),
        expires_at_utc=expires.isoformat(),
        renewal_reason=renewal_reason,
    )
    return CapabilityLeaseResult(
        lease=lease,
        automatically_issued=True,
        automatically_renewable=True,
    )


def renew_capability_lease_from_trust(
    lease: DelegatedCapabilityLease,
    *,
    edges: Iterable[TrustEdge],
    lease_seconds: int = DEFAULT_AUTONOMY_LEASE_SECONDS,
    reason: str = "trust_chain_still_valid",
    now: dt.datetime | None = None,
) -> CapabilityLeaseResult:
    """Renew without owner touch while the same trust-derived capabilities remain valid."""
    return issue_capability_lease_from_trust(
        owner=lease.owner,
        actor=lease.actor,
        edges=edges,
        requested_capabilities=lease.capabilities,
        lease_seconds=lease_seconds,
        reason=reason,
        now=now,
    )


def authorize_autonomous_action(
    lease: DelegatedCapabilityLease,
    capability: str,
    *,
    now: dt.datetime | None = None,
) -> None:
    """Raise unless an active trust-derived lease authorizes the requested action."""
    normalized = str(capability).strip()
    if normalized in PRIVILEGED_CAPABILITIES:
        raise AutonomyError("privileged capability requires separate authority")
    if not lease.is_active(now=now):
        raise AutonomyError("autonomous capability lease has expired")
    if normalized not in lease.capabilities:
        raise AutonomyError("autonomous capability is not present on this lease")


def append_capability_lease(path: str | Path, lease: DelegatedCapabilityLease) -> Path:
    """Persist an immutable-style JSONL receipt for autonomous capability issuance."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dataclasses.asdict(lease), ensure_ascii=False, sort_keys=True) + "\n")
    return destination
