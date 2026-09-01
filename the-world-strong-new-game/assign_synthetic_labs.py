#!/usr/bin/env python3
"""Attach offline synthetic labs to the four Strong New Game worlds."""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: assign_synthetic_labs.py OUTPUT_DIR")
    output = Path(sys.argv[1])
    catalog = json.loads((HERE / "synthetic-labs.json").read_text(encoding="utf-8"))
    sites = catalog["sites"]
    if len(sites) < 16:
        raise SystemExit("expected at least 16 synthetic labs")

    latest_path = output / "latest.json"
    latest = json.loads(latest_path.read_text(encoding="utf-8"))
    checkpoint_path = output / latest["checkpoint"]
    checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    generation_dir = checkpoint_path.parent

    manifest_digests = []
    assignments = {}
    for world in range(1, 5):
        assigned = sites[(world - 1) * 4 : world * 4]
        assignments[f"world-{world}"] = [row["id"] for row in assigned]
        manifest_path = generation_dir / f"world-{world}" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["synthetic_labs"] = assigned
        manifest["synthetic_lab_mode"] = "offline-simulation-only"
        manifest.pop("manifest_digest", None)
        manifest["manifest_digest"] = digest(manifest)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest_digests.append(manifest["manifest_digest"])

    checkpoint["synthetic_labs"] = {
        "catalog_digest": digest(catalog),
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
    print(json.dumps({"worlds": 4, "labs": 16, "checkpoint_digest": checkpoint["checkpoint_digest"]}))


if __name__ == "__main__":
    main()
