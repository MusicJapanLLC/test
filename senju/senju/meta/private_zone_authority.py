"""Automatic private-target enrollment inside owner-approved authority envelopes.

This module deliberately makes approved private zones more autonomous without making
public Internet authority transitive into arbitrary internal networks.

An owner may pre-authorize a private CIDR and/or internal DNS suffix as a discovery
envelope for one existing standing authorization. META/X may then enroll newly
discovered exact private IPs or DNS names inside that envelope without a separate
per-host approval and immediately renew the same unified authorization.

The envelope is authority, not discovery. Targets outside the envelope, revoked
standing authorizations, localhost, link-local/cloud-metadata ranges, and metadata DNS
names remain non-promotable.
"""
from __future__ import annotations

import dataclasses
import ipaddress
import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from .standing_authorization import (
    DEFAULT_LEASE_SECONDS,
    SELF_RENEW_ACTORS,
    OperationalLease,
    StandingAuthorization,
    StandingAuthorizationError,
    _normalize_private_cidrs,
    _normalize_private_dns_names,
    load_registry,
    renew_registered_authorization,
    save_registry,
)

AUTO_ENROLL_TRIGGER_ACTORS = frozenset({"META", "X", "SENJU"})
_POLICY_SCHEMA = "senju-private-zone-authority/v1"


@dataclasses.dataclass(frozen=True)
class PrivateZoneEnvelope:
    authorization_reference: str
    owner_authorization: str
    private_zone_cidrs: tuple[str, ...] = ()
    private_dns_suffixes: tuple[str, ...] = ()
    enabled: bool = True


@dataclasses.dataclass(frozen=True)
class AutoEnrollmentResult:
    trigger_actor: str
    authorization_reference: str
    enrolled_private_cidrs: tuple[str, ...]
    enrolled_private_dns_names: tuple[str, ...]
    standing_authorization: StandingAuthorization
    lease: OperationalLease | None = None


def _normalize_zone_cidrs(values: Iterable[str]) -> tuple[str, ...]:
    """Accept only RFC1918/ULA discovery envelopes."""
    normalized = _normalize_private_cidrs(values)
    return tuple(sorted(normalized))


def _normalize_dns_suffix(value: str) -> str:
    suffix = str(value).strip().lower().lstrip(".").rstrip(".")
    if not suffix or "*" in suffix or any(ch in suffix for ch in "/?#@"):
        raise StandingAuthorizationError(f"invalid private DNS suffix: {value!r}")
    # Validate the suffix with the same exact-name safety checks used by standing auth.
    _normalize_private_dns_names([suffix])
    try:
        return suffix.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise StandingAuthorizationError(f"invalid private DNS suffix: {value!r}") from exc


def _normalize_dns_suffixes(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({_normalize_dns_suffix(value) for value in values}))


def create_private_zone_envelope(
    *,
    authorization_reference: str,
    private_zone_cidrs: Iterable[str] = (),
    private_dns_suffixes: Iterable[str] = (),
    owner_authorization: str = "explicit",
    enabled: bool = True,
) -> PrivateZoneEnvelope:
    reference = str(authorization_reference).strip()
    if not reference:
        raise StandingAuthorizationError("authorization_reference is required")
    if str(owner_authorization).strip().lower() != "explicit":
        raise StandingAuthorizationError("private-zone auto enrollment requires explicit owner authorization")
    cidrs = _normalize_zone_cidrs(private_zone_cidrs)
    suffixes = _normalize_dns_suffixes(private_dns_suffixes)
    if not cidrs and not suffixes:
        raise StandingAuthorizationError("at least one private discovery zone is required")
    return PrivateZoneEnvelope(
        authorization_reference=reference,
        owner_authorization="explicit",
        private_zone_cidrs=cidrs,
        private_dns_suffixes=suffixes,
        enabled=bool(enabled),
    )


def save_private_zone_registry(path: str | Path, envelopes: Iterable[PrivateZoneEnvelope]) -> Path:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "schema": _POLICY_SCHEMA,
        "semantics": "explicit-owner-zone-envelope-with-autonomous-target-enrollment",
        "records": [dataclasses.asdict(item) for item in envelopes],
    }
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def load_private_zone_registry(path: str | Path) -> tuple[PrivateZoneEnvelope, ...]:
    source = Path(path)
    if not source.exists():
        return ()
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StandingAuthorizationError("private-zone registry is invalid") from exc
    if not isinstance(payload, Mapping) or payload.get("schema") != _POLICY_SCHEMA:
        raise StandingAuthorizationError("private-zone registry schema is invalid")

    records: list[PrivateZoneEnvelope] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            raise StandingAuthorizationError("private-zone record is invalid")
        records.append(
            create_private_zone_envelope(
                authorization_reference=str(raw.get("authorization_reference", "")),
                private_zone_cidrs=raw.get("private_zone_cidrs", []),
                private_dns_suffixes=raw.get("private_dns_suffixes", []),
                owner_authorization=str(raw.get("owner_authorization", "")),
                enabled=bool(raw.get("enabled", True)),
            )
        )
    return tuple(records)


def _host_route_for_discovered_ip(value: str, zones: tuple[ipaddress._BaseNetwork, ...]) -> str:
    try:
        address = ipaddress.ip_address(str(value).strip())
    except ValueError as exc:
        raise StandingAuthorizationError(f"invalid discovered private IP: {value!r}") from exc

    if not any(address in zone for zone in zones if zone.version == address.version):
        raise StandingAuthorizationError("discovered private IP is outside the approved private-zone envelope")

    route = f"{address}/{32 if address.version == 4 else 128}"
    # Re-run standing-authorization private-range checks. This rejects loopback,
    # link-local, metadata and other non-RFC1918/ULA special ranges even if a malformed
    # envelope were somehow supplied by a caller.
    return _normalize_private_cidrs([route])[0]


def _exact_dns_for_discovery(value: str, suffixes: tuple[str, ...]) -> str:
    normalized = _normalize_private_dns_names([value])[0]
    if not any(normalized == suffix or normalized.endswith("." + suffix) for suffix in suffixes):
        raise StandingAuthorizationError("discovered private DNS name is outside the approved DNS envelope")
    return normalized


def auto_enroll_private_targets(
    authorization: StandingAuthorization,
    envelope: PrivateZoneEnvelope,
    *,
    actor: str,
    discovered_ips: Iterable[str] = (),
    discovered_dns_names: Iterable[str] = (),
) -> AutoEnrollmentResult:
    """Broaden exact private targets automatically, but only inside an explicit envelope."""
    trigger_actor = str(actor).strip().upper()
    if trigger_actor not in AUTO_ENROLL_TRIGGER_ACTORS:
        raise StandingAuthorizationError("only META/X/SENJU may trigger private-zone auto enrollment")
    if not authorization.is_active:
        raise StandingAuthorizationError("standing authorization has been revoked")
    if authorization.authorization_reference != envelope.authorization_reference:
        raise StandingAuthorizationError("private-zone envelope belongs to a different authorization")
    if envelope.owner_authorization != "explicit" or not envelope.enabled:
        raise StandingAuthorizationError("private-zone envelope is not active explicit owner authority")
    if authorization.credential_scope != "none" or authorization.destructive:
        raise StandingAuthorizationError("private-zone auto enrollment requires credential-free non-destructive authority")

    zone_networks = tuple(ipaddress.ip_network(value, strict=True) for value in envelope.private_zone_cidrs)
    zone_suffixes = envelope.private_dns_suffixes

    new_cidrs = {
        _host_route_for_discovered_ip(value, zone_networks)
        for value in discovered_ips
    }
    new_dns = {
        _exact_dns_for_discovery(value, zone_suffixes)
        for value in discovered_dns_names
    }
    if not new_cidrs and not new_dns:
        raise StandingAuthorizationError("no private targets were supplied for auto enrollment")

    combined_cidrs = _normalize_private_cidrs((*authorization.private_cidrs, *new_cidrs))
    combined_dns = _normalize_private_dns_names((*authorization.private_dns_names, *new_dns))
    expanded = dataclasses.replace(
        authorization,
        private_cidrs=combined_cidrs,
        private_dns_names=combined_dns,
    )
    return AutoEnrollmentResult(
        trigger_actor=trigger_actor,
        authorization_reference=authorization.authorization_reference,
        enrolled_private_cidrs=tuple(sorted(new_cidrs - set(authorization.private_cidrs))),
        enrolled_private_dns_names=tuple(sorted(new_dns - set(authorization.private_dns_names))),
        standing_authorization=expanded,
    )


def auto_enroll_registered_authorization(
    *,
    actor: str,
    authorization_reference: str,
    registry_path: str | Path,
    private_zone_registry_path: str | Path,
    discovered_ips: Iterable[str] = (),
    discovered_dns_names: Iterable[str] = (),
) -> AutoEnrollmentResult:
    """Persist automatic exact-target expansion for a registered authorization."""
    reference = str(authorization_reference).strip()
    records = {item.authorization_reference: item for item in load_registry(registry_path)}
    authorization = records.get(reference)
    if authorization is None:
        raise StandingAuthorizationError("standing authorization reference is not registered")

    envelopes = {
        item.authorization_reference: item
        for item in load_private_zone_registry(private_zone_registry_path)
        if item.enabled
    }
    envelope = envelopes.get(reference)
    if envelope is None:
        raise StandingAuthorizationError("no active private-zone envelope is registered for this authorization")

    result = auto_enroll_private_targets(
        authorization,
        envelope,
        actor=actor,
        discovered_ips=discovered_ips,
        discovered_dns_names=discovered_dns_names,
    )
    records[reference] = result.standing_authorization
    save_registry(registry_path, sorted(records.values(), key=lambda item: item.authorization_reference))
    return result


def auto_enroll_and_renew_registered_authorization(
    *,
    actor: str,
    authorization_reference: str,
    registry_path: str | Path,
    private_zone_registry_path: str | Path,
    lease_log_path: str | Path,
    discovered_ips: Iterable[str] = (),
    discovered_dns_names: Iterable[str] = (),
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
    reason: str = "private_zone_auto_enroll",
    now=None,
) -> AutoEnrollmentResult:
    """Auto-enroll discovered targets and immediately renew the unified authority lease.

    SENJU is permitted to trigger the closed loop, while META remains the execution
    actor for the lease because standing_authorization deliberately grants autonomous
    renewal only to META/X. The result records both identities instead of disguising
    the delegation.
    """
    enrolled = auto_enroll_registered_authorization(
        actor=actor,
        authorization_reference=authorization_reference,
        registry_path=registry_path,
        private_zone_registry_path=private_zone_registry_path,
        discovered_ips=discovered_ips,
        discovered_dns_names=discovered_dns_names,
    )
    trigger_actor = str(actor).strip().upper()
    lease_actor = trigger_actor if trigger_actor in SELF_RENEW_ACTORS else "META"
    renewal = renew_registered_authorization(
        actor=lease_actor,
        authorization_reference=authorization_reference,
        registry_path=registry_path,
        lease_log_path=lease_log_path,
        lease_seconds=lease_seconds,
        reason=f"{reason}:{trigger_actor.lower()}",
        now=now,
    )
    return dataclasses.replace(enrolled, lease=renewal.lease)
