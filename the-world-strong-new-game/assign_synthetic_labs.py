#!/usr/bin/env python3
"""Attach a rotating offline synthetic-lab window to the four Strong New Game worlds."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ACTIVE_LABS_PER_CYCLE = 16
LABS_PER_WORLD = 4


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: assign_synthetic_labs.py OUTPUT_DIR")
    output = Path(sys.argv[1])
    catalog = json.loads((HERE / "synthetic-labs.json").read_text(encoding="utf-8"))
    sites = catalog["sites"]
    if len(sites) < ACTIVE_LABS_PER_CYCLE:
        raise SystemExit(f"expected at least {ACTIVE_LABS_PER_CYCLE} synthetic labs")

    latest_path = output / "latest.json"
    latest = json.loads(latest_path.read_text(encoding="utf-8"))
    checkpoint_path = output / latest["checkpoint"]
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    generation_dir = checkpoint_path.parent

    # Shift a full 16-lab window each generation. With the current 32-lab
    # catalog, every two cycles exercise the full catalog without increasing
    # the number of simultaneously active worlds or slowing the 4-way fan-out.
    generation = int(checkpoint["generation"])
    rotation_offset = ((generation - 1) * ACTIVE_LABS_PER_CYCLE) % len(sites)
    rotated = sites[rotation_offset:] + sites[:rotation_offset]
    active = rotated[:ACTIVE_LABS_PER_CYCLE]

    manifest_digests = []
    assignments = {}
    for world in range(1, 5):
        start = (world - 1) * LABS_PER_WORLD
        assigned = active[start : start + LABS_PER_WORLD]
        assignments[f"world-{world}"] = [row["id"] for row in assigned]
        manifest_path = generation_dir / f"world-{world}" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["synthetic_labs"] = assigned
        manifest["synthetic_lab_mode"] = "offline-simulation-only"
        manifest["synthetic_lab_rotation_offset"] = rotation_offset
        manifest.pop("manifest_digest", None)
        manifest["manifest_digest"] = digest(manifest)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest_digests.append(manifest["manifest_digest"])

    checkpoint["synthetic_labs"] = {
        "catalog_digest": digest(catalog),
        "catalog_size": len(sites),
        "active_per_cycle": ACTIVE_LABS_PER_CYCLE,
        "labs_per_world": LABS_PER_WORLD,
        "rotation_offset": rotation_offset,
        "network_transport": catalog["network_transport"],
        "simulation_only": catalog["simulation_only"],
        "assignments": assignments,
    }
    checkpoint["world_manifest_digests"] = manifest_digests
    checkpoint.pop("checkpoint_digest", None)
    checkpoint["checkpoint_digest"] = digest(checkpoint)
    checkpoint_path.write_text(json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest["checkpoint_digest"] = checkpoint["checkpoint_digest"]
    latest_path.write_text(json.dumps(latest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "worlds": 4,
                "catalog_labs": len(sites),
                "active_labs": ACTIVE_LABS_PER_CYCLE,
                "rotation_offset": rotation_offset,
                "checkpoint_digest": checkpoint["checkpoint_digest"],
            }
        )
    )


if __name__ == "__main__":
    main()
