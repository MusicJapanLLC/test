"""Bounded META/X child-agent factory.

META and X may each maintain a direct fleet of up to ten child workers. Children
receive revocable delegated capability grants derived from the parent's allowed
scope. Credential-backed execution continuity is represented by fresh child-bound
provider-exchange capabilities; raw credentials/secrets are never copied into child
records.

Children may request descendants through the recursive spawn broker. Credential
capabilities can continue down the lineage as new subject-bound grants, while secret
material remains in its external provider/broker.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from senju.meta.credential_capability_lineage import (
    CredentialCapabilityError,
    delegate_capabilities_to_child,
    revoke_capability,
    validate_subject_capabilities,
)

MAX_CHILDREN_PER_PARENT = 10
ROOT_SYSTEMS = frozenset({"META", "X"})
REGISTRY_SCHEMA = "senju-meta-x-agent-factory/v1"


@dataclasses.dataclass(frozen=True)
class DelegatedGrant:
    grant_id: str
    scopes: tuple[str, ...]
    revocable: bool = True
    raw_credential_inherited: bool = False


@dataclasses.dataclass(frozen=True)
class AgentSpec:
    agent_id: str
    system: str
    parent_id: str
    generation: int
    grant: DelegatedGrant
    may_spawn_children: bool = False
    status: str = "provisioned"


def _normalize_scopes(scopes: Iterable[str]) -> tuple[str, ...]:
    cleaned = tuple(sorted({str(scope).strip() for scope in scopes if str(scope).strip()}))
    if not cleaned:
        raise ValueError("at least one delegated scope is required")
    return cleaned


def _derive_grant(parent_id: str, agent_id: str, parent_scopes: Sequence[str], requested_scopes: Sequence[str] | None) -> DelegatedGrant:
    parent = set(_normalize_scopes(parent_scopes))
    requested = set(_normalize_scopes(requested_scopes if requested_scopes is not None else parent_scopes))
    if not requested.issubset(parent):
        raise PermissionError("child grant may not exceed parent scope")
    material = f"{parent_id}|{agent_id}|{'|'.join(sorted(requested))}"
    grant_id = "grant-" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]
    return DelegatedGrant(grant_id=grant_id, scopes=tuple(sorted(requested)))


def spawn_children(
    *,
    system: str,
    parent_id: str,
    parent_scopes: Sequence[str],
    count: int = MAX_CHILDREN_PER_PARENT,
    requested_scopes: Sequence[str] | None = None,
    parent_generation: int = 0,
) -> list[AgentSpec]:
    """Create bounded direct children for a META or X root.

    Direct materialization remains root-only and bounded to ten children. The
    children are marked as eligible to submit recursive spawn requests to the
    broker. Raw credentials are not embedded in AgentSpec; credential continuity is
    attached separately by ``ensure_direct_fleet`` as child-bound capability ids.
    """
    normalized_system = system.strip().upper()
    if normalized_system not in ROOT_SYSTEMS:
        raise PermissionError("only META and X roots may use the shared child factory")
    if parent_generation != 0:
        raise PermissionError("recursive direct spawning is disabled; use the spawn broker")
    if count < 1 or count > MAX_CHILDREN_PER_PARENT:
        raise ValueError(f"count must be between 1 and {MAX_CHILDREN_PER_PARENT}")
    if not parent_id.strip():
        raise ValueError("parent_id is required")

    children: list[AgentSpec] = []
    for index in range(1, count + 1):
        agent_id = f"{normalized_system}-CHILD-{index:02d}"
        grant = _derive_grant(parent_id, agent_id, parent_scopes, requested_scopes)
        children.append(
            AgentSpec(
                agent_id=agent_id,
                system=normalized_system,
                parent_id=parent_id,
                generation=1,
                grant=grant,
                may_spawn_children=True,
            )
        )
    return children


def ensure_direct_fleet(
    registry_path: str | Path,
    *,
    system: str,
    parent_id: str,
    parent_scopes: Sequence[str],
    count: int = MAX_CHILDREN_PER_PARENT,
    requested_scopes: Sequence[str] | None = None,
    credential_registry_path: str | Path | None = None,
    parent_credential_capability_ids: Sequence[str] = (),
) -> dict:
    """Idempotently persist one bounded direct fleet.

    Re-running the META loop updates the same parent fleet rather than multiplying
    the number of live agents on every cycle. When parent credential capability ids
    are supplied, each direct child receives fresh child-bound capabilities derived
    from those parent capabilities. Only ids and non-secret mode metadata are stored
    in the agent registry.
    """
    path = Path(registry_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            registry = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            registry = {}
    else:
        registry = {}

    if registry.get("schema") != REGISTRY_SCHEMA:
        registry = {"schema": REGISTRY_SCHEMA, "parents": {}}
    parents = registry.setdefault("parents", {})
    fleet = spawn_children(
        system=system,
        parent_id=parent_id,
        parent_scopes=parent_scopes,
        count=count,
        requested_scopes=requested_scopes,
        parent_generation=0,
    )

    capability_ids = tuple(
        dict.fromkeys(str(value).strip() for value in parent_credential_capability_ids if str(value).strip())
    )
    credential_path = Path(credential_registry_path) if credential_registry_path is not None else None
    if capability_ids and credential_path is None:
        raise ValueError("credential_registry_path is required when parent credential capabilities are supplied")
    if capability_ids:
        try:
            capability_ids = validate_subject_capabilities(
                credential_path,
                subject_agent_id=parent_id,
                capability_ids=capability_ids,
            )
        except CredentialCapabilityError as exc:
            raise PermissionError(str(exc)) from exc

    serialized_children: list[dict] = []
    for child in fleet:
        row = dataclasses.asdict(child)
        if capability_ids:
            try:
                child_caps = delegate_capabilities_to_child(
                    credential_path,
                    parent_agent_id=parent_id,
                    child_agent_id=child.agent_id,
                    parent_capability_ids=capability_ids,
                )
            except CredentialCapabilityError as exc:
                raise PermissionError(str(exc)) from exc
            row["credential_capability_ids"] = list(child_caps)
            row["credential_materialization_mode"] = "provider_exchange"
        else:
            row["credential_capability_ids"] = []
            row["credential_materialization_mode"] = "none"
        row["raw_credential_inherited"] = False
        serialized_children.append(row)

    parents[parent_id] = {
        "system": system.strip().upper(),
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "max_children": MAX_CHILDREN_PER_PARENT,
        "credential_capability_delegation": bool(capability_ids),
        "credential_materialization_mode": "provider_exchange" if capability_ids else "none",
        "raw_credential_inheritance": False,
        "children": serialized_children,
    }
    path.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")
    return parents[parent_id]


def revoke_child(
    registry_path: str | Path,
    *,
    parent_id: str,
    agent_id: str,
    credential_registry_path: str | Path | None = None,
) -> bool:
    """Revoke one child and optionally cascade-revoke its credential capabilities."""
    path = Path(registry_path)
    if not path.exists():
        return False
    try:
        registry = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    parent = (registry.get("parents") or {}).get(parent_id)
    if not isinstance(parent, Mapping):
        return False
    children = parent.get("children")
    if not isinstance(children, list):
        return False
    changed = False
    capability_ids: list[str] = []
    for child in children:
        if isinstance(child, dict) and child.get("agent_id") == agent_id:
            child["status"] = "revoked"
            capability_ids.extend(
                str(value).strip()
                for value in child.get("credential_capability_ids", [])
                if str(value).strip()
            )
            changed = True
    if changed:
        path.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")
        if credential_registry_path is not None:
            for capability_id in capability_ids:
                revoke_capability(
                    credential_registry_path,
                    capability_id=capability_id,
                    reason=f"agent revoked: {agent_id}",
                    cascade=True,
                )
    return changed
