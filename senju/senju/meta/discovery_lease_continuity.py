"""Bridge live discovery capability leases into production continuity targets.

The shared discovery loop already emits exact-target, time-bounded capability leases.
This module lets the production continuity controller consume those leases as an input
for replication/persistence without minting a new authority source.

Important separation:
- a live discovery lease may make an exact target eligible for continuity/replication;
- continuity descendants inherit only configured internal coordination scopes;
- raw credentials are never inherited here;
- production deployment remains gated by the separate exact-host
  ``production-deployment-authorizations.json`` authority.
"""
from __future__ import annotations

import dataclasses
import json
import time
from pathlib import Path
from typing import Any, Mapping, Sequence

DISCOVERY_LEASE_SCHEMA = "meta-discovery-capability-leases/v1"
DISCOVERY_CONTINUITY_EVIDENCE_SCHEMA = "meta-discovery-authorized/v1"
SUPPORTED_CAPABILITIES = frozenset({"scan", "probe", "write", "mutation", "credentialed_action"})
CONTINUITY_ACTORS = frozenset({"META", "X", "SENJU"})


class DiscoveryLeaseContinuityError(RuntimeError):
    """Raised when a discovery lease cannot safely become a continuity input."""


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _normalize_host(host: str) -> str:
    value = str(host).strip().rstrip(".").lower()
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise DiscoveryLeaseContinuityError(f"invalid exact host: {host!r}")
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise DiscoveryLeaseContinuityError(f"invalid exact host: {host!r}") from exc
    if "." not in value:
        raise DiscoveryLeaseContinuityError("continuity target must be a fully-qualified host")
    return value


@dataclasses.dataclass(frozen=True)
class DiscoveryContinuityGrant:
    target_host: str
    lease_id: str
    authorization_reference: str
    authorization_basis: str | None
    capabilities: tuple[str, ...]
    source_lease_expires_at: int
    capability_authorization_profile: str | None
    capability_inherited_from_owner_root: bool
    source_credential_scope: str
    shared_with: tuple[str, ...]



def load_active_discovery_continuity_grants(
    path: str | Path,
    *,
    now: int | None = None,
) -> tuple[DiscoveryContinuityGrant, ...]:
    """Load exact active targets from a trusted shared-discovery lease artifact."""
    current = int(time.time()) if now is None else int(now)
    payload = _read_json(Path(path), {})
    if not isinstance(payload, Mapping) or payload.get("schema") != DISCOVERY_LEASE_SCHEMA:
        return ()

    grants: dict[str, DiscoveryContinuityGrant] = {}
    for raw in payload.get("leases", []):
        if not isinstance(raw, Mapping):
            continue
        if str(raw.get("status", "active")).strip().lower() != "active":
            continue
        try:
            expires_at = int(raw.get("expires_at", 0))
        except (TypeError, ValueError):
            continue
        if expires_at <= current:
            continue
        try:
            target = _normalize_host(str(raw.get("target") or ""))
        except DiscoveryLeaseContinuityError:
            continue
        lease_id = str(raw.get("lease_id") or "").strip()
        reference = str(raw.get("authorization_reference") or "").strip()
        if not lease_id or not reference:
            continue
        capabilities = tuple(
            sorted(
                {
                    str(item).strip().lower()
                    for item in raw.get("capabilities", [])
                    if str(item).strip().lower() in SUPPORTED_CAPABILITIES
                }
            )
        )
        if not capabilities:
            continue
        shared_with = tuple(
            sorted({str(item).strip().upper() for item in raw.get("shared_with", []) if str(item).strip()})
        )
        if not set(shared_with).intersection(CONTINUITY_ACTORS):
            continue
        profile = raw.get("capability_authorization_profile")
        grant = DiscoveryContinuityGrant(
            target_host=target,
            lease_id=lease_id,
            authorization_reference=reference,
            authorization_basis=(
                str(raw.get("authorization_basis")) if raw.get("authorization_basis") is not None else None
            ),
            capabilities=capabilities,
            source_lease_expires_at=expires_at,
            capability_authorization_profile=(
                str(profile).strip() if isinstance(profile, str) and profile.strip() else None
            ),
            capability_inherited_from_owner_root=bool(raw.get("capability_inherited_from_owner_root", False)),
            source_credential_scope=str(raw.get("credential_scope", "none")).strip() or "none",
            shared_with=shared_with,
        )
        grants[target] = grant
    return tuple(sorted(grants.values(), key=lambda item: item.target_host))



def stage_discovery_continuity_authority(
    *,
    state_dir: str | Path,
    grant: DiscoveryContinuityGrant,
) -> Path:
    """Stage same-target read-only evidence so continuity can resolve existing authority.

    The staged evidence deliberately does not copy write/mutation/credential authority.
    Those remain on the original discovery capability lease/executor. Continuity needs
    only an existing exact-target authority basis to manage its worker lineage.
    """
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": DISCOVERY_CONTINUITY_EVIDENCE_SCHEMA,
        "source": "discovery_capability_lease",
        "hosts": {
            grant.target_host: {
                "host": grant.target_host,
                "authorization_reference": grant.authorization_reference,
                "authorization_basis": grant.authorization_basis,
                "allowed_methods": ["GET", "HEAD"],
                "credential_scope": "none",
                "effect": "read_only",
                "allow_http": False,
                "allow_delete": False,
                "expires_at": grant.source_lease_expires_at,
                "source_lease_id": grant.lease_id,
                "source_capabilities": list(grant.capabilities),
                "source_credential_scope_present": grant.source_credential_scope != "none",
                "raw_credential_inheritance": False,
                "scope_expansion": False,
            }
        },
    }
    destination = state / "discovery_authorized.json"
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return destination



def continuity_target_from_discovery_grant(
    grant: DiscoveryContinuityGrant,
    *,
    actor: str = "META",
    parent_id_prefix: str = "META-DISCOVERY-CONTINUITY",
    parent_generation: int = 1,
    parent_scopes: Sequence[str] = ("read:state", "write:state", "read:research", "write:research"),
    desired_replicas: int = 4,
    desired_revision: str = "default-branch",
    active_limit: int = 50,
) -> dict[str, Any]:
    """Build a production-continuity target without inheriting external credentials."""
    system = str(actor).strip().upper()
    if system not in CONTINUITY_ACTORS:
        raise DiscoveryLeaseContinuityError(f"unsupported continuity actor: {actor!r}")
    prefix = str(parent_id_prefix).strip()
    if not prefix:
        raise DiscoveryLeaseContinuityError("parent_id_prefix is required")
    scopes = tuple(sorted({str(item).strip() for item in parent_scopes if str(item).strip()}))
    if not scopes:
        raise DiscoveryLeaseContinuityError("at least one internal parent scope is required")
    revision = str(desired_revision).strip()
    if not revision:
        raise DiscoveryLeaseContinuityError("desired_revision is required")

    return {
        "target_host": grant.target_host,
        "actor": system,
        "parent_id": f"{prefix}:{grant.target_host}",
        "parent_generation": max(1, int(parent_generation)),
        "parent_scopes": list(scopes),
        "desired_replicas": max(0, min(int(desired_replicas), 50)),
        "desired_revision": revision,
        "active_limit": max(1, min(int(active_limit), 200)),
        "health_status": "healthy",
        "authority_origin": "active_discovery_capability_lease",
        "discovery_lease_id": grant.lease_id,
        "discovery_authorization_reference": grant.authorization_reference,
        "source_capabilities": list(grant.capabilities),
        "raw_credential_inheritance": False,
        "automatic_deployment_authority_from_discovery": False,
    }
