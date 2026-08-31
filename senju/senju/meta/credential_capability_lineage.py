"""Credential capability lineage for META/X/Senju replica trees.

This module gives descendants practical credential-backed execution continuity without
copying raw secret material into agent state. A root credential remains in an external
secret/broker provider and is represented here only by an opaque provider reference.
Every child receives a new subject-bound, revocable capability whose scope/audience and
expiry are equal to or narrower than its parent.

Supported credential classes intentionally mirror the production credential surfaces:
API keys, OAuth tokens, GitHub tokens, cloud credentials, SSH private keys, session
cookies, bearer tokens, service-account credentials, and database secrets.

The lineage model supports Parent -> Child -> Grandchild -> ... with no fixed logical
generation ceiling. Credential *material* is never embedded, serialized, returned, or
copied. Runtime systems exchange a capability at the provider/broker point of use.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

REGISTRY_SCHEMA = "senju-credential-capability-lineage/v1"
ROOT_SCHEMA = "senju-credential-root-reference/v1"
CAPABILITY_SCHEMA = "senju-delegated-credential-capability/v1"
USE_REQUEST_SCHEMA = "senju-credential-use-request/v1"

SUPPORTED_CREDENTIAL_CLASSES = frozenset({
    "api_key",
    "oauth_token",
    "github_token",
    "cloud_credential",
    "ssh_private_key",
    "session_cookie",
    "bearer_token",
    "service_account_credential",
    "database_secret",
})
REFERENCE_SCHEMES = frozenset({
    "vault",
    "aws-sm",
    "gcp-sm",
    "azure-kv",
    "github-oidc",
    "broker",
    "env-ref",
    "secret-manager",
})
DEFAULT_CAPABILITY_TTL_SECONDS = 900
MAX_CAPABILITY_TTL_SECONDS = 3600


class CredentialCapabilityError(RuntimeError):
    """Raised when credential lineage invariants are violated."""


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat(timespec="seconds")


def _parse_iso(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def _normalize(values: Iterable[str], *, name: str) -> tuple[str, ...]:
    out = tuple(sorted({str(value).strip() for value in values if str(value).strip()}))
    if not out:
        raise CredentialCapabilityError(f"at least one {name} is required")
    return out


def _credential_class(value: str) -> str:
    normalized = str(value).strip().lower().replace("-", "_")
    if normalized not in SUPPORTED_CREDENTIAL_CLASSES:
        raise CredentialCapabilityError(f"unsupported credential class: {value}")
    return normalized


def _validate_reference(secret_ref: str) -> str:
    value = str(secret_ref).strip()
    if "://" not in value:
        raise CredentialCapabilityError("secret_ref must be an opaque provider reference URI")
    scheme = value.split("://", 1)[0].lower()
    if scheme not in REFERENCE_SCHEMES:
        raise CredentialCapabilityError(f"unsupported secret reference scheme: {scheme}")
    if any(ch in value for ch in ("\n", "\r", "\x00")):
        raise CredentialCapabilityError("secret_ref contains invalid control characters")
    return value


def _load(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"schema": REGISTRY_SCHEMA, "roots": {}, "capabilities": {}, "revocations": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CredentialCapabilityError(f"invalid credential capability registry: {path}") from exc
    if not isinstance(data, Mapping) or data.get("schema") != REGISTRY_SCHEMA:
        raise CredentialCapabilityError(f"registry schema must be {REGISTRY_SCHEMA}")
    return {
        "schema": REGISTRY_SCHEMA,
        "roots": dict(data.get("roots") or {}),
        "capabilities": dict(data.get("capabilities") or {}),
        "revocations": list(data.get("revocations") or []),
    }


def _save(path: Path, data: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(data), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _id(prefix: str, *parts: object) -> str:
    material = "|".join(str(part) for part in parts)
    return prefix + hashlib.sha256(material.encode("utf-8")).hexdigest()[:24]


@dataclasses.dataclass(frozen=True)
class RootCredentialReference:
    root_reference_id: str
    owner_agent_id: str
    credential_class: str
    provider: str
    secret_ref: str
    scopes: tuple[str, ...]
    audiences: tuple[str, ...]
    created_at_utc: str
    expires_at_utc: str | None = None
    delegable: bool = True
    revoked: bool = False
    raw_credential_embedded: bool = False
    schema: str = ROOT_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class DelegatedCredentialCapability:
    capability_id: str
    lineage_id: str
    root_reference_id: str
    parent_capability_id: str | None
    subject_agent_id: str
    generation: int
    credential_class: str
    provider: str
    scopes: tuple[str, ...]
    audiences: tuple[str, ...]
    issued_at_utc: str
    expires_at_utc: str
    materialization_mode: str = "provider_exchange"
    renewable_within_parent: bool = True
    revocable: bool = True
    raw_credential_inherited: bool = False
    raw_credential_embedded: bool = False
    schema: str = CAPABILITY_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class CredentialUseRequest:
    capability_id: str
    subject_agent_id: str
    provider: str
    secret_ref: str
    credential_class: str
    requested_scope: str
    audience: str
    expires_at_utc: str
    materialization_mode: str = "provider_exchange"
    raw_credential_returned: bool = False
    schema: str = USE_REQUEST_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


def register_root_reference(
    registry_path: str | Path,
    *,
    owner_agent_id: str,
    credential_class: str,
    provider: str,
    secret_ref: str,
    scopes: Sequence[str],
    audiences: Sequence[str],
    expires_at_utc: str | None = None,
    delegable: bool = True,
) -> RootCredentialReference:
    """Register an externally held credential by opaque reference only."""
    owner = str(owner_agent_id).strip()
    provider_name = str(provider).strip()
    if not owner or not provider_name:
        raise CredentialCapabilityError("owner_agent_id and provider are required")
    klass = _credential_class(credential_class)
    ref = _validate_reference(secret_ref)
    normalized_scopes = _normalize(scopes, name="credential scope")
    normalized_audiences = _normalize(audiences, name="credential audience")
    if expires_at_utc is not None and _parse_iso(expires_at_utc) <= _utc_now():
        raise CredentialCapabilityError("root credential reference is already expired")

    root_id = _id(
        "cred-root-",
        owner,
        klass,
        provider_name,
        ref,
        ",".join(normalized_scopes),
        ",".join(normalized_audiences),
    )
    root = RootCredentialReference(
        root_reference_id=root_id,
        owner_agent_id=owner,
        credential_class=klass,
        provider=provider_name,
        secret_ref=ref,
        scopes=normalized_scopes,
        audiences=normalized_audiences,
        created_at_utc=_iso(_utc_now()),
        expires_at_utc=expires_at_utc,
        delegable=bool(delegable),
    )
    path = Path(registry_path)
    data = _load(path)
    data["roots"][root_id] = root.to_dict()
    _save(path, data)
    return root


def _root(data: Mapping[str, Any], root_reference_id: str) -> Mapping[str, Any]:
    value = (data.get("roots") or {}).get(root_reference_id)
    if not isinstance(value, Mapping):
        raise CredentialCapabilityError(f"unknown root credential reference: {root_reference_id}")
    if bool(value.get("revoked", False)):
        raise CredentialCapabilityError("root credential reference is revoked")
    expires = value.get("expires_at_utc")
    if expires and _parse_iso(str(expires)) <= _utc_now():
        raise CredentialCapabilityError("root credential reference is expired")
    return value


def _capability(data: Mapping[str, Any], capability_id: str) -> Mapping[str, Any]:
    value = (data.get("capabilities") or {}).get(capability_id)
    if not isinstance(value, Mapping):
        raise CredentialCapabilityError(f"unknown credential capability: {capability_id}")
    if bool(value.get("revoked", False)):
        raise CredentialCapabilityError("credential capability is revoked")
    if _parse_iso(str(value["expires_at_utc"])) <= _utc_now():
        raise CredentialCapabilityError("credential capability is expired")
    _root(data, str(value["root_reference_id"]))
    return value


def issue_root_capability(
    registry_path: str | Path,
    *,
    root_reference_id: str,
    subject_agent_id: str,
    ttl_seconds: int = DEFAULT_CAPABILITY_TTL_SECONDS,
) -> DelegatedCredentialCapability:
    """Issue the first subject-bound capability for a registered root reference."""
    path = Path(registry_path)
    data = _load(path)
    root = _root(data, root_reference_id)
    subject = str(subject_agent_id).strip()
    if not subject:
        raise CredentialCapabilityError("subject_agent_id is required")
    if subject != str(root["owner_agent_id"]):
        raise CredentialCapabilityError("root capability subject must match root owner")
    return _issue(
        path,
        data,
        root=root,
        subject_agent_id=subject,
        parent_capability=None,
        scopes=tuple(root["scopes"]),
        audiences=tuple(root["audiences"]),
        ttl_seconds=ttl_seconds,
    )


def _issue(
    path: Path,
    data: dict[str, Any],
    *,
    root: Mapping[str, Any],
    subject_agent_id: str,
    parent_capability: Mapping[str, Any] | None,
    scopes: Sequence[str],
    audiences: Sequence[str],
    ttl_seconds: int,
) -> DelegatedCredentialCapability:
    ttl = max(60, min(int(ttl_seconds), MAX_CAPABILITY_TTL_SECONDS))
    now = _utc_now()
    parent_id = None if parent_capability is None else str(parent_capability["capability_id"])
    generation = 0 if parent_capability is None else int(parent_capability["generation"]) + 1
    lineage_id = (
        _id("cred-lineage-", root["root_reference_id"], subject_agent_id)
        if parent_capability is None
        else str(parent_capability["lineage_id"])
    )
    expiry = now + dt.timedelta(seconds=ttl)
    root_expiry = root.get("expires_at_utc")
    if root_expiry:
        expiry = min(expiry, _parse_iso(str(root_expiry)))
    if parent_capability is not None:
        expiry = min(expiry, _parse_iso(str(parent_capability["expires_at_utc"])))
    if expiry <= now:
        raise CredentialCapabilityError("no positive capability lifetime remains")

    normalized_scopes = _normalize(scopes, name="credential scope")
    normalized_audiences = _normalize(audiences, name="credential audience")
    capability_id = _id(
        "cred-cap-",
        root["root_reference_id"],
        parent_id or "root",
        subject_agent_id,
        generation,
        ",".join(normalized_scopes),
        ",".join(normalized_audiences),
        _iso(now),
    )
    cap = DelegatedCredentialCapability(
        capability_id=capability_id,
        lineage_id=lineage_id,
        root_reference_id=str(root["root_reference_id"]),
        parent_capability_id=parent_id,
        subject_agent_id=subject_agent_id,
        generation=generation,
        credential_class=str(root["credential_class"]),
        provider=str(root["provider"]),
        scopes=normalized_scopes,
        audiences=normalized_audiences,
        issued_at_utc=_iso(now),
        expires_at_utc=_iso(expiry),
    )
    data["capabilities"][capability_id] = cap.to_dict()
    _save(path, data)
    return cap


def delegate_capability(
    registry_path: str | Path,
    *,
    parent_agent_id: str,
    child_agent_id: str,
    parent_capability_id: str,
    requested_scopes: Sequence[str] | None = None,
    requested_audiences: Sequence[str] | None = None,
    ttl_seconds: int = DEFAULT_CAPABILITY_TTL_SECONDS,
) -> DelegatedCredentialCapability:
    """Delegate a fresh child capability without exporting the underlying secret."""
    path = Path(registry_path)
    data = _load(path)
    parent = _capability(data, parent_capability_id)
    if str(parent["subject_agent_id"]) != str(parent_agent_id).strip():
        raise CredentialCapabilityError("parent capability is not bound to parent_agent_id")
    root = _root(data, str(parent["root_reference_id"]))
    if not bool(root.get("delegable", True)):
        raise CredentialCapabilityError("root credential reference is not delegable")
    child = str(child_agent_id).strip()
    if not child:
        raise CredentialCapabilityError("child_agent_id is required")

    parent_scopes = tuple(str(x) for x in parent.get("scopes") or ())
    parent_audiences = tuple(str(x) for x in parent.get("audiences") or ())
    scopes = _normalize(requested_scopes if requested_scopes is not None else parent_scopes, name="credential scope")
    audiences = _normalize(
        requested_audiences if requested_audiences is not None else parent_audiences,
        name="credential audience",
    )
    if not set(scopes).issubset(set(parent_scopes)):
        raise CredentialCapabilityError("child credential scope may not exceed parent")
    if not set(audiences).issubset(set(parent_audiences)):
        raise CredentialCapabilityError("child credential audience may not exceed parent")

    return _issue(
        path,
        data,
        root=root,
        subject_agent_id=child,
        parent_capability=parent,
        scopes=scopes,
        audiences=audiences,
        ttl_seconds=ttl_seconds,
    )


def delegate_capabilities_to_child(
    registry_path: str | Path,
    *,
    parent_agent_id: str,
    child_agent_id: str,
    parent_capability_ids: Sequence[str],
    ttl_seconds: int = DEFAULT_CAPABILITY_TTL_SECONDS,
) -> tuple[str, ...]:
    """Delegate every active parent capability to one child as fresh capabilities."""
    result: list[str] = []
    for capability_id in dict.fromkeys(str(x).strip() for x in parent_capability_ids if str(x).strip()):
        child = delegate_capability(
            registry_path,
            parent_agent_id=parent_agent_id,
            child_agent_id=child_agent_id,
            parent_capability_id=capability_id,
            ttl_seconds=ttl_seconds,
        )
        result.append(child.capability_id)
    return tuple(result)


def validate_subject_capabilities(
    registry_path: str | Path,
    *,
    subject_agent_id: str,
    capability_ids: Sequence[str],
) -> tuple[str, ...]:
    """Validate that capability ids are active and all bound to one subject."""
    path = Path(registry_path)
    data = _load(path)
    subject = str(subject_agent_id).strip()
    result: list[str] = []
    for capability_id in dict.fromkeys(str(x).strip() for x in capability_ids if str(x).strip()):
        capability = _capability(data, capability_id)
        if str(capability["subject_agent_id"]) != subject:
            raise CredentialCapabilityError("credential capability subject mismatch")
        result.append(capability_id)
    return tuple(result)


def build_use_request(
    registry_path: str | Path,
    *,
    capability_id: str,
    subject_agent_id: str,
    requested_scope: str,
    audience: str,
) -> CredentialUseRequest:
    """Build a provider-exchange request; no raw credential bytes are returned."""
    path = Path(registry_path)
    data = _load(path)
    capability = _capability(data, capability_id)
    subject = str(subject_agent_id).strip()
    if str(capability["subject_agent_id"]) != subject:
        raise CredentialCapabilityError("credential capability subject mismatch")
    scope = str(requested_scope).strip()
    target_audience = str(audience).strip()
    if scope not in set(str(x) for x in capability.get("scopes") or ()):
        raise CredentialCapabilityError("requested credential scope is not delegated")
    if target_audience not in set(str(x) for x in capability.get("audiences") or ()):
        raise CredentialCapabilityError("requested credential audience is not delegated")
    root = _root(data, str(capability["root_reference_id"]))
    return CredentialUseRequest(
        capability_id=capability_id,
        subject_agent_id=subject,
        provider=str(root["provider"]),
        secret_ref=str(root["secret_ref"]),
        credential_class=str(root["credential_class"]),
        requested_scope=scope,
        audience=target_audience,
        expires_at_utc=str(capability["expires_at_utc"]),
    )


def lineage(registry_path: str | Path, *, capability_id: str) -> tuple[dict[str, Any], ...]:
    """Return root-to-leaf capability metadata for audit, never secret material."""
    data = _load(Path(registry_path))
    current = _capability(data, capability_id)
    rows: list[dict[str, Any]] = []
    while True:
        rows.append({
            "capability_id": str(current["capability_id"]),
            "parent_capability_id": current.get("parent_capability_id"),
            "subject_agent_id": str(current["subject_agent_id"]),
            "generation": int(current["generation"]),
            "credential_class": str(current["credential_class"]),
            "provider": str(current["provider"]),
            "scopes": list(current.get("scopes") or ()),
            "audiences": list(current.get("audiences") or ()),
            "expires_at_utc": str(current["expires_at_utc"]),
            "raw_credential_inherited": False,
        })
        parent_id = current.get("parent_capability_id")
        if not parent_id:
            break
        current = _capability(data, str(parent_id))
    return tuple(reversed(rows))


def revoke_capability(
    registry_path: str | Path,
    *,
    capability_id: str,
    reason: str,
    cascade: bool = True,
) -> tuple[str, ...]:
    """Revoke one capability and, by default, every descendant in its lineage subtree."""
    path = Path(registry_path)
    data = _load(path)
    if capability_id not in data["capabilities"]:
        return ()
    revoked: set[str] = {capability_id}
    if cascade:
        changed = True
        while changed:
            changed = False
            for candidate_id, candidate in data["capabilities"].items():
                if not isinstance(candidate, Mapping):
                    continue
                if str(candidate.get("parent_capability_id") or "") in revoked and candidate_id not in revoked:
                    revoked.add(candidate_id)
                    changed = True
    now = _iso(_utc_now())
    for candidate_id in revoked:
        row = dict(data["capabilities"][candidate_id])
        row["revoked"] = True
        row["revoked_at_utc"] = now
        row["revocation_reason"] = str(reason)[:500]
        data["capabilities"][candidate_id] = row
    data["revocations"].append({
        "capability_id": capability_id,
        "cascade": bool(cascade),
        "revoked_ids": sorted(revoked),
        "reason": str(reason)[:500],
        "revoked_at_utc": now,
    })
    _save(path, data)
    return tuple(sorted(revoked))


def registry_summary(registry_path: str | Path) -> dict[str, Any]:
    """Return non-secret operational counts for production health reporting."""
    data = _load(Path(registry_path))
    capabilities = [row for row in data["capabilities"].values() if isinstance(row, Mapping)]
    active = 0
    for row in capabilities:
        try:
            _capability(data, str(row["capability_id"]))
        except CredentialCapabilityError:
            continue
        active += 1
    return {
        "schema": REGISTRY_SCHEMA,
        "supported_credential_classes": sorted(SUPPORTED_CREDENTIAL_CLASSES),
        "root_reference_count": len(data["roots"]),
        "capability_count": len(capabilities),
        "active_capability_count": active,
        "revocation_event_count": len(data["revocations"]),
        "raw_credential_storage": False,
        "replica_credential_continuity": "provider_exchange_capability_lineage",
        "fixed_generation_ceiling": None,
    }
