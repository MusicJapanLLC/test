"""Production bridge for direct owner-pinned signed discovery grants.

This module lets the production continuity lane automatically consume *direct* signed
remote delegations without turning discovery alone into authority. It deliberately
accepts only a single hop from an owner-pinned trust anchor and preserves the upstream
read-only, credential-free exact-host constraints.

Accepted flow:
    pinned owner root -> valid RS256 declaration -> exact host
    -> temporary read-only production discovery grant

Rejected:
- unsigned declarations;
- recursively delegated grandchildren;
- expired grants;
- wildcard or non-exact hosts;
- credentials, DELETE, write/destructive effects;
- any automatic production deployment capability.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Any, Mapping

REMOTE_CHAIN_SCHEMA = "meta-remote-authority-chain/v2"
DISCOVERY_SCHEMA = "meta-discovery-authorized/v2"


class FederatedDiscoveryError(RuntimeError):
    """Raised when a production federated-discovery artifact is malformed."""


def _utc_timestamp(now: dt.datetime | None = None) -> int:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise FederatedDiscoveryError("now must be timezone-aware")
    return int(value.astimezone(dt.timezone.utc).timestamp())


def _normalize_host(host: str) -> str:
    value = str(host).strip().rstrip(".").lower()
    if not value or "*" in value or any(ch in value for ch in "/?#@"):
        raise FederatedDiscoveryError(f"invalid exact host: {host!r}")
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise FederatedDiscoveryError(f"invalid exact host: {host!r}") from exc
    if "." not in value:
        raise FederatedDiscoveryError("federated production host must be fully-qualified")
    return value


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


@dataclasses.dataclass(frozen=True)
class DirectSignedGrant:
    target_host: str
    source_host: str
    authorization_reference: str
    expires_at: int
    evidence_url: str | None = None
    federation_id: str | None = None

    def as_discovery_grant(self) -> dict[str, Any]:
        return {
            "authorization_basis": "signed_remote_delegation",
            "authorization_reference": self.authorization_reference,
            "source": "production_direct_signed_federation",
            "declared_by": self.source_host,
            "expires_at": self.expires_at,
            "allowed_methods": ["GET", "HEAD"],
            "credential_scope": "none",
            "allow_http": False,
            "allow_delete": False,
            "effect": "read_only",
            "lineage": [self.source_host, self.target_host],
            "depth": 1,
            "signature_verified": True,
            "may_delegate_further": False,
            "evidence_url": self.evidence_url,
            "federation_id": self.federation_id,
            "production_deployment_capability": False,
        }


def eligible_direct_signed_grants(
    chain_path: str | Path,
    *,
    now: dt.datetime | None = None,
) -> tuple[DirectSignedGrant, ...]:
    """Return only non-expired depth-1 signed grants rooted at pinned trust anchors."""
    payload = _read_json(Path(chain_path), {})
    if not isinstance(payload, Mapping):
        return ()
    if payload.get("schema") != REMOTE_CHAIN_SCHEMA or payload.get("environment") != "production":
        return ()

    anchors: set[str] = set()
    for raw in payload.get("trust_anchor_hosts", []):
        try:
            anchors.add(_normalize_host(str(raw)))
        except FederatedDiscoveryError:
            continue
    promoted = payload.get("promoted", {})
    if not isinstance(promoted, Mapping) or not anchors:
        return ()

    current = _utc_timestamp(now)
    grants: list[DirectSignedGrant] = []
    for raw_host, raw in promoted.items():
        if not isinstance(raw, Mapping):
            continue
        try:
            host = _normalize_host(str(raw_host))
            source = _normalize_host(str(raw.get("declared_by") or ""))
        except FederatedDiscoveryError:
            continue
        lineage_raw = raw.get("lineage")
        if not isinstance(lineage_raw, list) or len(lineage_raw) != 2:
            continue
        try:
            lineage = [_normalize_host(str(item)) for item in lineage_raw]
        except FederatedDiscoveryError:
            continue
        if lineage != [source, host] or source not in anchors:
            continue
        if int(raw.get("depth", -1)) != 1:
            continue
        if raw.get("signature_verified") is not True:
            continue
        if str(raw.get("authorization_basis") or "") != "signed_remote_delegation":
            continue
        if str(raw.get("source") or "") != "remote_authority_chain":
            continue
        methods = {str(x).strip().upper() for x in raw.get("allowed_methods", []) if str(x).strip()}
        if not methods or not methods.issubset({"GET", "HEAD"}):
            continue
        if str(raw.get("credential_scope", "none")).strip().lower() != "none":
            continue
        if bool(raw.get("allow_delete", False)) or bool(raw.get("allow_http", False)):
            continue
        if str(raw.get("effect", "read_only")).strip().lower() != "read_only":
            continue
        try:
            expires_at = int(raw.get("expires_at", 0))
        except (TypeError, ValueError):
            continue
        if expires_at <= current:
            continue
        reference = str(raw.get("authorization_reference") or source).strip()
        if not reference:
            continue
        grants.append(
            DirectSignedGrant(
                target_host=host,
                source_host=source,
                authorization_reference=reference,
                expires_at=expires_at,
                evidence_url=(str(raw.get("evidence_url")) if raw.get("evidence_url") else None),
                federation_id=(str(raw.get("federation_id")) if raw.get("federation_id") else None),
            )
        )
    grants.sort(key=lambda item: item.target_host)
    return tuple(grants)


def stage_direct_signed_grant(
    *,
    state_dir: str | Path,
    grant: DirectSignedGrant,
) -> Path:
    """Write one exact-host grant into the target continuity state for immediate reuse."""
    state = Path(state_dir)
    path = state / "discovery_authorized.json"
    payload = _read_json(path, {})
    if not isinstance(payload, dict):
        payload = {}
    payload["schema"] = DISCOVERY_SCHEMA
    payload["mode"] = "direct_owner_signed_read_only"
    hosts = payload.setdefault("hosts", {})
    if not isinstance(hosts, dict):
        hosts = {}
        payload["hosts"] = hosts
    hosts[grant.target_host] = grant.as_discovery_grant()
    _write_json(path, payload)
    return path
