"""Shared bounded fleet provisioning for META and X."""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

from senju.meta.agent_factory import MAX_CHILDREN_PER_PARENT, ensure_direct_fleet

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
    """Ensure bounded direct worker fleets for both META and X.

    Each root receives at most ten direct workers. Workers receive independent,
    revocable grant identifiers with delegated scope metadata; they do not inherit
    the root's raw credential and are not allowed to spawn another generation.
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
        "max_children_per_parent": MAX_CHILDREN_PER_PARENT,
        "recursive_spawn": False,
        "raw_credential_inheritance": False,
    }
