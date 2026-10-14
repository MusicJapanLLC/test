#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def entry_id(head: str) -> str:
    digest = hashlib.sha256(f"world:{head}".encode()).hexdigest()[:14]
    return f"world_{digest}"


def build_entry(snapshot: dict) -> dict:
    source = snapshot.get("source_head") or {}
    head = str(source.get("sha") or "unknown")
    roots = snapshot.get("roots") if isinstance(snapshot.get("roots"), list) else []
    active = [r for r in roots if isinstance(r, dict) and int(r.get("tracked_files") or 0) > 0]
    ranked = sorted(active, key=lambda r: int(r.get("tracked_files") or 0), reverse=True)
    top = [
        {
            "root": r.get("root"),
            "tracked_files": r.get("tracked_files"),
            "latest_commit": (r.get("latest_commit") or {}).get("sha"),
            "latest_commit_date": (r.get("latest_commit") or {}).get("date"),
            "available_scripts": ((r.get("package") or {}).get("scripts") or [])[:20],
        }
        for r in ranked[:12]
    ]
    created = source.get("date") or datetime.now(timezone.utc).isoformat()
    return {
        "knowledge_id": entry_id(head),
        "schema_version": "1.0",
        "source_repos": ["test"],
        "category": "world_observation",
        "created_by_agent": "THE_WORLD_OBSERVER",
        "created_at": created,
        "content": {
            "title": f"THE WORLD repository observation at {head[:8]}",
            "source_head": head,
            "autonomy_level": snapshot.get("autonomy_level"),
            "repository": snapshot.get("repository", {}),
            "largest_observed_roots": top,
            "protected_production_refs": snapshot.get("protected_production_refs", []),
            "capability_budget": snapshot.get("capability_budget", {}),
        },
        "effectiveness": {
            "success_rate": 1.0,
            "last_verified": created,
        },
        "meta_learning": {
            "observed_root_count": len(roots),
            "active_root_count": len(active),
            "tracked_files": (snapshot.get("repository") or {}).get("tracked_files"),
        },
        "cross_repo_applicable": {
            "source": "test",
            "target": "the-world2",
            "confidence": 0.95,
            "approved": True,
        },
        "tags": ["world-observation", "repository-reality", "cross-system-context", "autonomy-95"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot")
    parser.add_argument("--registry-path", required=True)
    args = parser.parse_args()

    snapshot_path = Path(args.snapshot)
    registry_path = Path(args.registry_path)
    snapshot = load_json(snapshot_path, {})
    if snapshot.get("schema") != "the-world-observation/v1":
        raise SystemExit("invalid or missing world observation snapshot")

    registry = load_json(registry_path, {
        "schema": "god-knowledge-registry/v1",
        "description": "THE WORLD GOD unified knowledge registry",
        "entries": [],
        "last_updated": None,
        "total_entries": 0,
    })
    entry = build_entry(snapshot)
    entries = registry.setdefault("entries", [])
    existing = {str(item.get("knowledge_id")) for item in entries if isinstance(item, dict)}
    added = False
    if entry["knowledge_id"] not in existing:
        entries.append(entry)
        added = True
    registry["last_updated"] = datetime.now(timezone.utc).isoformat()
    registry["total_entries"] = len(entries)
    save_json(registry_path, registry)
    print(json.dumps({"added": added, "knowledge_id": entry["knowledge_id"], "total_entries": len(entries)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
