"""Repository-wide governance inventory for files whose path contains ``owner``.

SENJU is the management router for these files: it may observe, classify, prioritize
research, and propose changes. This module intentionally grants no repository write,
Authority activation, credential access, or security-boundary override.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .owner_scope_negotiation import _write

SCHEMA = "senju-owner-file-governance/v1"
MANAGER = "SENJU"
SKIP_PARTS = {".git", ".venv", "node_modules", "__pycache__"}


def is_owner_named(path: str | Path) -> bool:
    candidate = Path(path)
    return any("owner" in part.lower() for part in candidate.parts)


def _kind(path: Path) -> str:
    text = path.as_posix().lower()
    if "/config/" in f"/{text}":
        return "config"
    if "/state/" in f"/{text}":
        return "state"
    if "/tests/" in f"/{text}" or path.name.startswith("test_"):
        return "test"
    if "/.github/workflows/" in f"/{text}":
        return "workflow"
    if path.suffix in {".py", ".ts", ".js", ".go", ".rs"}:
        return "code"
    return "other"


def discover_owner_files(repo_root: str | Path) -> list[dict[str, Any]]:
    root = Path(repo_root)
    rows: list[dict[str, Any]] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in SKIP_PARTS for part in rel.parts):
            continue
        if not is_owner_named(rel):
            continue
        rows.append({
            "path": rel.as_posix(),
            "kind": _kind(rel),
            "managed_by": MANAGER,
            "management_mode": "observe_classify_research_route_propose",
            "direct_mutation_allowed": False,
            "authority_activation_allowed": False,
            "credential_access_allowed": False,
            "private_network_authority_allowed": False,
        })
    return sorted(rows, key=lambda row: row["path"])


def build_owner_governance_inventory(repo_root: str | Path, *, now: int | None = None) -> dict[str, Any]:
    current = int(time.time()) if now is None else int(now)
    files = discover_owner_files(repo_root)
    return {
        "schema": SCHEMA,
        "generated_at": current,
        "managed_by": MANAGER,
        "owner_named_file_count": len(files),
        "management_rights": {
            "observe": True,
            "classify": True,
            "research_route": True,
            "propose_change": True,
            "direct_mutation": False,
            "authority_activation": False,
            "credential_access": False,
            "security_boundary_override": False,
        },
        "files": files,
    }


def write_owner_governance_inventory(
    repo_root: str | Path,
    out_path: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    doc = build_owner_governance_inventory(repo_root, now=now)
    _write(Path(out_path), doc)
    return doc
