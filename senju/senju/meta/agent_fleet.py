"""Shared bounded fleet provisioning for META and X."""
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
) -> dict:
    """Ensure direct worker fleets and enable brokered recursive descendants.

    META and X each receive a bounded direct fleet. Those children may submit
    recursive descendant requests with no fixed ten-agent request ceiling, but
    descendants are materialized only through the shared broker's global live-agent
    budget. Every generation receives fresh revocable grants; raw credentials are
    never inherited.
    """
    registry = Path(state_dir) / "meta_x_agent_registry.json"
    meta = ensure_direct_fleet(
        registry,
        system="META",
        parent_id="META",
        parent_scopes=meta_scopes,
        count=count,
    )
    x = ensure_direct_fleet(
        registry,
        system="X",
        parent_id="X",
        parent_scopes=x_scopes,
        count=count,
    )
    return {
        "registry": str(registry),
        "meta_children": len(meta["children"]),
        "x_children": len(x["children"]),
        "max_children_per_root": MAX_CHILDREN_PER_PARENT,
        "recursive_spawn_requests": True,
        "recursive_request_fixed_count_ceiling": None,
        "recursive_materialization": "brokered",
        "max_active_agents": MAX_ACTIVE_AGENTS,
        "max_generation": MAX_GENERATION,
        "raw_credential_inheritance": False,
    }
