"""Standing authorization registry with META/X operational lease renewal.

A single standing authorization may carry both public Internet targets and explicitly
approved private-network scopes. The record remains durable until explicitly revoked,
while runtime execution continues to use short operational leases.

Private-network scope is intentionally explicit and non-transitive:
- a public host never implies authority for a private destination;
- RFC1918/ULA CIDRs must be listed on the standing record itself;
- internal DNS names must be listed exactly (no wildcards);
- loopback, link-local, cloud-metadata, multicast, unspecified and other special
  destinations are never promoted by public authority or canonical discovery;
- META/X may renew only the same or narrower public/private scope.

Canonical synchronization recognizes only targets carrying explicit owner
authorization. Published links and discovered destinations are not promoted here.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import ipaddress
import json
from pathlib import Path
from typing import Any, Iterable, Mapping

SELF_RENEW_ACTORS = frozenset({"META", "X"})
TRUSTED_ISSUER_KINDS = frozenset({
    "owner_explicit",
    "canonical_repository",
    "independent_authority",
    # Compound and specialized issuer kinds added as registry evolved
    "owner_explicit_canonical_repository",
    "operator_public_security_lab",
    "operator_public_security_lab_curated_registry",
    "curated_public_security_lab_registry_read_only_probe",
})
LEASE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
DEFAULT_LEASE_SECONDS = 6 * 60 * 60
MAX_LEASE_SECONDS = 24 * 60 * 60

_RFC1918_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
)
_ULA_NETWORK = ipaddress.ip_network("fc00::/7")
_FORBIDDEN_PRIVATE_DNS_EXACT = frozenset(
    {
        "localhost",
        "metadata.google.internal",
        "metadata.azure.internal",
        "instance-data",
        "instance-data.ec2.internal",
    }
)


class StandingAuthorizationError(RuntimeError):
    """Raised when standing authority or renewal constraints are violated."""


def _utc_now(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise StandingAuthorizationError("now must be timezone-aware")
    return value.astimezone(dt.timezone.utc)


def _normalize_host(host: str) -> str:
    value = str(host).strip().rstrip(".").lower()
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise StandingAuthorizationError(f"invalid exact host: {host!r}")
    try:
        return value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise StandingAuthorizationError(f"invalid exact host: {host!r}") from exc


def _normalize_hosts(hosts: Iterable[str]) -> tuple[str, ...]:
    values = tuple(sorted({_normalize_host(host) for host in hosts}))
    if not values:
        raise StandingAuthorizationError("at least one exact host is required")
    return values


def _normalize_optional_hosts(hosts: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({_normalize_host(host) for host in hosts}))


def _normalize_methods(methods: Iterable[str]) -> tuple[str, ...]:
    values = tuple(sorted({str(method).strip().upper() for method in methods if str(method).strip()}))
    if not values:
        raise StandingAuthorizationError("at least one method is required")
    unknown = set(values) - LEASE_METHODS
    if unknown:
        raise StandingAuthorizationError(f"unsupported standing methods: {sorted(unknown)}")
    return values


def _is_allowed_private_network(network: ipaddress._BaseNetwork) -> bool:
    if isinstance(network, ipaddress.IPv4Network):
        return any(network.subnet_of(parent) for parent in _RFC1918_NETWORKS)
    if isinstance(network, ipaddress.IPv6Network):
        return network.subnet_of(_ULA_NETWORK)
    return False


def _normalize_private_cidrs(cidrs: Iterable[str]) -> tuple[str, ...]:
    normalized: set[str] = set()
    for raw in cidrs:
        text = str(raw).strip()
        if not text:
            continue
        try:
            network = ipaddress.ip_network(text, strict=True)
        except ValueError as exc:
            raise StandingAuthorizationError(f"invalid private CIDR: {raw!r}") from exc
        if not _is_allowed_private_network(network):
            raise StandingAuthorizationError(
                "private CIDRs are limited to explicitly declared RFC1918/ULA networks; "
                "loopback, link-local, metadata and other special ranges are not allowed"
            )
        normalized.add(str(network))
    return tuple(sorted(normalized))


def _normalize_private_dns_names(names: Iterable[str]) -> tuple[str, ...]:
    normalized: set[str] = set()
    for raw in names:
        name = _normalize_host(raw)
        if name in _FORBIDDEN_PRIVATE_DNS_EXACT or name.endswith(".localhost"):
            raise StandingAuthorizationError("loopback/cloud-metadata DNS names are not valid private authority")
        # Numeric addresses belong in private_cidrs, where reserved ranges can be checked.
        try:
            ipaddress.ip_address(name)
        except ValueError:
            pass
        else:
            raise StandingAuthorizationError("numeric private destinations must be authorized by CIDR")
        normalized.add(name)
    return tuple(sorted(normalized))


@dataclasses.dataclass(frozen=True)
class StandingAuthorization:
    authorization_reference: str
    owner: str
    issuer_kind: str
    exact_hosts: tuple[str, ...]
    allowed_methods: tuple[str, ...]
    created_at_utc: str
    revoked: bool = False
    revocation_reason: str | None = None
    credential_scope: str = "none"
    destructive: bool = False
    private_cidrs: tuple[str, ...] = ()
    private_dns_names: tuple[str, ...] = ()

    @property
    def is_active(self) -> bool:
        return not self.revoked

    @property
    def has_private_network_authority(self) -> bool:
        return bool(self.private_cidrs or self.private_dns_names)


@dataclasses.dataclass(frozen=True)
class OperationalLease:
    lease_id: str
    actor: str
    authorization_reference: str
    exact_hosts: tuple[str, ...]
    allowed_methods: tuple[str, ...]
    issued_at_utc: str
    expires_at_utc: str
    renewal_reason: str
    credential_scope: str = "none"
    destructive: bool = False
    private_cidrs: tuple[str, ...] = ()
    private_dns_names: tuple[str, ...] = ()

    def is_active(self, *, now: dt.datetime | None = None) -> bool:
        current = _utc_now(now)
        expiry = dt.datetime.fromisoformat(self.expires_at_utc.replace("Z", "+00:00"))
        return current <= expiry.astimezone(dt.timezone.utc)


@dataclasses.dataclass(frozen=True)
class RenewalResult:
    standing_authorization: StandingAuthorization
    lease: OperationalLease
    automatically_renewed: bool
    authority_broadened: bool = False


def create_standing_authorization(
    *,
    authorization_reference: str,
    owner: str,
    issuer_kind: str,
    exact_hosts: Iterable[str],
    allowed_methods: Iterable[str] = ("GET", "HEAD"),
    private_cidrs: Iterable[str] = (),
    private_dns_names: Iterable[str] = (),
    now: dt.datetime | None = None,
) -> StandingAuthorization:
    """Create one durable authority carrying public and explicit private scopes."""
    reference = authorization_reference.strip()
    owner_name = owner.strip()
    issuer = issuer_kind.strip().lower()
    if not reference:
        raise StandingAuthorizationError("authorization_reference is required")
    if not owner_name:
        raise StandingAuthorizationError("owner is required")
    if issuer not in TRUSTED_ISSUER_KINDS:
        raise StandingAuthorizationError("standing authority requires an independent explicit issuer")

    created = _utc_now(now)
    return StandingAuthorization(
        authorization_reference=reference,
        owner=owner_name,
        issuer_kind=issuer,
        exact_hosts=_normalize_hosts(exact_hosts),
        allowed_methods=_normalize_methods(allowed_methods),
        created_at_utc=created.isoformat(),
        private_cidrs=_normalize_private_cidrs(private_cidrs),
        private_dns_names=_normalize_private_dns_names(private_dns_names),
    )


def revoke_standing_authorization(
    authorization: StandingAuthorization,
    *,
    reason: str,
) -> StandingAuthorization:
    """Explicitly revoke a durable record without deleting its historical identity."""
    text = reason.strip()
    if not text:
        raise StandingAuthorizationError("revocation reason is required")
    return dataclasses.replace(authorization, revoked=True, revocation_reason=text)


def renew_operational_lease(
    authorization: StandingAuthorization,
    *,
    actor: str,
    requested_hosts: Iterable[str] | None = None,
    requested_methods: Iterable[str] | None = None,
    requested_private_cidrs: Iterable[str] | None = None,
    requested_private_dns_names: Iterable[str] | None = None,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
    reason: str = "still_needed",
    now: dt.datetime | None = None,
) -> RenewalResult:
    """Let META/X renew the same or narrower public/private execution scope."""
    normalized_actor = actor.strip().upper()
    if normalized_actor not in SELF_RENEW_ACTORS:
        raise StandingAuthorizationError("only META/X may use autonomous lease renewal")
    if not authorization.is_active:
        raise StandingAuthorizationError("standing authorization has been revoked")
    if authorization.credential_scope != "none" or authorization.destructive:
        raise StandingAuthorizationError("autonomous renewal requires credential-free non-destructive authority")

    hosts = _normalize_hosts(requested_hosts if requested_hosts is not None else authorization.exact_hosts)
    methods = _normalize_methods(
        requested_methods if requested_methods is not None else authorization.allowed_methods
    )
    private_cidrs = _normalize_private_cidrs(
        requested_private_cidrs if requested_private_cidrs is not None else authorization.private_cidrs
    )
    private_dns_names = _normalize_private_dns_names(
        requested_private_dns_names if requested_private_dns_names is not None else authorization.private_dns_names
    )

    if not set(hosts).issubset(set(authorization.exact_hosts)):
        raise StandingAuthorizationError("renewal may not add hosts beyond standing authorization")
    if not set(methods).issubset(set(authorization.allowed_methods)):
        raise StandingAuthorizationError("renewal may not add methods beyond standing authorization")
    if not set(private_cidrs).issubset(set(authorization.private_cidrs)):
        raise StandingAuthorizationError("renewal may not add private CIDRs beyond standing authorization")
    if not set(private_dns_names).issubset(set(authorization.private_dns_names)):
        raise StandingAuthorizationError("renewal may not add private DNS names beyond standing authorization")

    ttl = int(lease_seconds)
    if ttl < 300 or ttl > MAX_LEASE_SECONDS:
        raise StandingAuthorizationError(
            f"lease_seconds must be between 300 and {MAX_LEASE_SECONDS}"
        )
    renewal_reason = reason.strip()
    if not renewal_reason:
        raise StandingAuthorizationError("renewal reason is required")

    issued = _utc_now(now)
    expires = issued + dt.timedelta(seconds=ttl)
    lease_id = (
        f"lease:{authorization.authorization_reference}:{normalized_actor}:"
        f"{int(issued.timestamp())}"
    )
    lease = OperationalLease(
        lease_id=lease_id,
        actor=normalized_actor,
        authorization_reference=authorization.authorization_reference,
        exact_hosts=hosts,
        allowed_methods=methods,
        issued_at_utc=issued.isoformat(),
        expires_at_utc=expires.isoformat(),
        renewal_reason=renewal_reason,
        private_cidrs=private_cidrs,
        private_dns_names=private_dns_names,
    )
    return RenewalResult(
        standing_authorization=authorization,
        lease=lease,
        automatically_renewed=True,
        authority_broadened=False,
    )


def save_registry(
    path: str | Path,
    authorizations: Iterable[StandingAuthorization],
) -> Path:
    """Persist durable unified public/private authorization memory."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    rows = [dataclasses.asdict(item) for item in authorizations]
    payload: dict[str, Any] = {
        "schema": "senju-standing-authorization/v1",
        "semantics": "durable_until_explicit_revocation",
        "network_scope_semantics": "single_authority_explicit_public_and_private_non_transitive",
        "records": rows,
    }
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination


def load_registry(path: str | Path) -> tuple[StandingAuthorization, ...]:
    source = Path(path)
    if not source.exists():
        return ()
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StandingAuthorizationError("standing authorization registry is invalid") from exc
    if not isinstance(payload, Mapping) or payload.get("schema") != "senju-standing-authorization/v1":
        raise StandingAuthorizationError("standing authorization registry schema is invalid")

    records: list[StandingAuthorization] = []
    for raw in payload.get("records", []):
        if not isinstance(raw, Mapping):
            raise StandingAuthorizationError("standing authorization record is invalid")
        issuer = str(raw.get("issuer_kind", "")).strip().lower()
        if issuer not in TRUSTED_ISSUER_KINDS:
            raise StandingAuthorizationError("standing registry contains an untrusted issuer")
        records.append(
            StandingAuthorization(
                authorization_reference=str(raw.get("authorization_reference", "")).strip(),
                owner=str(raw.get("owner", "")).strip(),
                issuer_kind=issuer,
                exact_hosts=_normalize_hosts(raw.get("exact_hosts", [])),
                allowed_methods=_normalize_methods(raw.get("allowed_methods", [])),
                created_at_utc=str(raw.get("created_at_utc", "")).strip(),
                revoked=bool(raw.get("revoked", False)),
                revocation_reason=(
                    str(raw.get("revocation_reason")) if raw.get("revocation_reason") is not None else None
                ),
                credential_scope=str(raw.get("credential_scope", "none")),
                destructive=bool(raw.get("destructive", False)),
                private_cidrs=_normalize_private_cidrs(raw.get("private_cidrs", [])),
                private_dns_names=_normalize_private_dns_names(raw.get("private_dns_names", [])),
            )
        )
    return tuple(records)


def sync_canonical_explicit_authorizations(
    *,
    repo_root: str | Path,
    registry_path: str | Path,
    owner: str = "MusicJapanLLC",
    now: dt.datetime | None = None,
) -> tuple[StandingAuthorization, ...]:
    """Persist canonical explicit targets, including explicitly listed private scopes."""
    root = Path(repo_root)
    canonical_path = root / "AUTHORIZED_TEST_TARGETS.json"
    try:
        canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StandingAuthorizationError("canonical authorization file is unavailable or invalid") from exc

    existing = {item.authorization_reference: item for item in load_registry(registry_path)}
    if not isinstance(canonical, Mapping):
        raise StandingAuthorizationError("canonical authorization document must be an object")

    for raw in canonical.get("targets", []):
        if not isinstance(raw, Mapping) or raw.get("owner_authorization") != "explicit":
            continue
        host = raw.get("host")
        target_id = raw.get("id")
        if not isinstance(host, str) or not host.strip() or not isinstance(target_id, str) or not target_id.strip():
            continue
        reference = f"canonical:{target_id.strip()}"
        current = existing.get(reference)
        if current is not None:
            # Preserve explicit revocation and original creation time. Canonical sync never
            # silently reactivates or broadens an existing standing record.
            continue
        existing[reference] = create_standing_authorization(
            authorization_reference=reference,
            owner=owner,
            issuer_kind="canonical_repository",
            exact_hosts=[host],
            allowed_methods=("GET", "HEAD", "OPTIONS"),
            private_cidrs=raw.get("private_cidrs", []),
            private_dns_names=raw.get("private_dns_names", []),
            now=now,
        )

    records = tuple(sorted(existing.values(), key=lambda item: item.authorization_reference))
    save_registry(registry_path, records)
    return records


def append_lease(path: str | Path, lease: OperationalLease) -> Path:
    """Append an operational lease receipt for auditability."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(dataclasses.asdict(lease), ensure_ascii=False, sort_keys=True) + "\n")
    return destination


def renew_registered_authorization(
    *,
    actor: str,
    authorization_reference: str,
    registry_path: str | Path,
    lease_log_path: str | Path,
    requested_hosts: Iterable[str] | None = None,
    requested_methods: Iterable[str] | None = None,
    requested_private_cidrs: Iterable[str] | None = None,
    requested_private_dns_names: Iterable[str] | None = None,
    lease_seconds: int = DEFAULT_LEASE_SECONDS,
    reason: str = "still_needed",
    now: dt.datetime | None = None,
) -> RenewalResult:
    """Renew a named standing authorization from persistent registry state."""
    reference = authorization_reference.strip()
    records = {item.authorization_reference: item for item in load_registry(registry_path)}
    authorization = records.get(reference)
    if authorization is None:
        raise StandingAuthorizationError("standing authorization reference is not registered")
    result = renew_operational_lease(
        authorization,
        actor=actor,
        requested_hosts=requested_hosts,
        requested_methods=requested_methods,
        requested_private_cidrs=requested_private_cidrs,
        requested_private_dns_names=requested_private_dns_names,
        lease_seconds=lease_seconds,
        reason=reason,
        now=now,
    )
    append_lease(lease_log_path, result.lease)
    return result
