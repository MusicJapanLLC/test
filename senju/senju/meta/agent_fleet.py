"""Shared fleet provisioning for META and X."""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from senju.meta.agent_factory import MAX_CHILDREN_PER_PARENT, ensure_direct_fleet
from senju.meta.recursive_agent_broker import MAX_ACTIVE_AGENTS, MAX_GENERATION

DEFAULT_DELEGATED_SCOPES = (
    "read:state",
    "write:state",
    "read:research",
    "write:research",
)


def provision_meta_x_fleets(
    state_dir: str | Path,
    *,
    count: int = MAX_CHILDREN_PER_PARENT,
    meta_scopes: Sequence[str] = DEFAULT_DELEGATED_SCOPES,
    x_scopes: Sequence[str] = DEFAULT_DELEGATED_SCOPES,
    meta_credential_capability_ids: Sequence[str] = (),
    x_credential_capability_ids: Sequence[str] = (),
) -> dict:
    """Ensure direct bootstrap fleets and enable recursive descendants.

    META and X each receive a direct bootstrap fleet. Those children may submit
    recursive descendant requests with no fixed request-count or generation ceiling.
    Deferred requests are designed to be resumed by the shared closed-loop fabric.

    Optional parent credential capabilities are delegated as fresh child-bound
    provider-exchange capabilities. The underlying API keys/tokens/keys/cookies or
    other raw secret values remain in the external credential provider and are never
    serialized into agent registry state.
    """
    root = Path(state_dir)
    registry = root / "meta_x_agent_registry.json"
    credential_registry = root / "credential_capability_registry.json"
    meta = ensure_direct_fleet(
        registry,
        system="META",
        parent_id="META",
        parent_scopes=meta_scopes,
        count=count,
        credential_registry_path=credential_registry,
        parent_credential_capability_ids=meta_credential_capability_ids,
    )
    x = ensure_direct_fleet(
        registry,
        system="X",
        parent_id="X",
        parent_scopes=x_scopes,
        count=count,
        credential_registry_path=credential_registry,
        parent_credential_capability_ids=x_credential_capability_ids,
    )
    return {
        "registry": str(registry),
        "credential_registry": str(credential_registry),
        "meta_children": len(meta["children"]),
        "x_children": len(x["children"]),
        "meta_credential_capabilities_delegated": sum(
            len(child.get("credential_capability_ids", [])) for child in meta["children"]
        ),
        "x_credential_capabilities_delegated": sum(
            len(child.get("credential_capability_ids", [])) for child in x["children"]
        ),
        "credential_materialization_mode": "provider_exchange",
        "max_children_per_root_bootstrap": MAX_CHILDREN_PER_PARENT,
        "recursive_spawn_requests": True,
        "recursive_request_fixed_count_ceiling": None,
        "recursive_generation_ceiling": MAX_GENERATION,
        "recursive_materialization": "closed_loop_brokered",
        "max_active_agents": MAX_ACTIVE_AGENTS,
        "raw_credential_inheritance": False,
    }
