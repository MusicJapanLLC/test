#!/usr/bin/env python3
"""Three-hour 2x2 Strong New Game research checkpoint generator.

This module keeps the complete Git seed lineage while carrying forward research
knowledge from RED / Senju / META / X into four parallel, research-only worlds.
It does not grant credentials, authority, external side effects, or alter guard
policy; those remain outside inheritance.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_OUTPUT = HERE / "runtime"
TEXT_EXTENSIONS = {".json", ".md", ".txt", ".py", ".yaml", ".yml", ".toml"}
CHANNEL_WEIGHTS = {"RED": 0.40, "SENJU": 0.20, "META": 0.20, "X": 0.20}
WORLD_FOCUS = {
    1: "authorization-state-models",
    2: "session-and-identity-boundaries",
    3: "input-and-parser-regressions",
    4: "workflow-and-state-machine-regressions",
}
SIGNALS = ("finding", "hypothesis", "failure", "success", "regression", "mutation", "reproduce", "test")


def run(*args: str, capture: bool = True) -> str:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
    )
    return result.stdout.strip() if capture else ""


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()


def classify(path: str) -> set[str]:
    lowered = path.lower().replace("\\", "/")
    name = Path(lowered).name
    channels: set[str] = set()
    if "/red/" in f"/{lowered}" or name.startswith("red_") or "adversary" in lowered:
        channels.add("RED")
    if "senju" in lowered:
        channels.add("SENJU")
    if "/meta/" in f"/{lowered}" or name.startswith("meta_") or "meta_loop" in lowered:
        channels.add("META")
    if "/x/" in f"/{lowered}" or name.startswith("x_") or "x_bridge" in lowered:
        channels.add("X")
    return channels


def collect_research(max_files_per_channel: int = 250, max_bytes_per_file: int = 65536) -> dict:
    tracked = [line for line in run("git", "ls-files").splitlines() if line]
    buckets = {channel: [] for channel in CHANNEL_WEIGHTS}
    for rel in tracked:
        path = ROOT / rel
        if path.suffix.lower() not in TEXT_EXTENSIONS or not path.is_file():
            continue
        for channel in classify(rel):
            if len(buckets[channel]) < max_files_per_channel:
                buckets[channel].append(rel)

    summary = {}
    for channel, paths in buckets.items():
        digest = hashlib.sha256()
        signal_counts = {signal: 0 for signal in SIGNALS}
        total_bytes = 0
        for rel in sorted(paths):
            raw = (ROOT / rel).read_bytes()[:max_bytes_per_file]
            text = raw.decode("utf-8", "replace")
            digest.update(rel.encode())
            digest.update(b"\0")
            digest.update(raw)
            total_bytes += len(raw)
            lowered = text.lower()
            for signal in SIGNALS:
                signal_counts[signal] += lowered.count(signal)
        summary[channel] = {
            "priority_weight": CHANNEL_WEIGHTS[channel],
            "file_count": len(paths),
            "sample_paths": sorted(paths)[:24],
            "sampled_bytes": total_bytes,
            "content_digest": digest.hexdigest(),
            "signal_counts": signal_counts,
        }
    return summary


def refs_snapshot() -> dict:
    head = run("git", "rev-parse", "HEAD")
    refs = run("git", "show-ref", "--heads", "--tags")
    workflows = sorted(
        str(path.relative_to(ROOT))
        for path in (ROOT / ".github" / "workflows").glob("*.y*ml")
        if path.is_file()
    )
    return {
        "head": head,
        "refs_digest": sha256_text(refs),
        "workflow_files": workflows,
        "workflow_digest": sha256_text("\n".join(workflows)),
    }


def previous_checkpoint(previous: Path | None) -> dict | None:
    if previous is None or not previous.exists():
        return None
    candidates = sorted(previous.rglob("checkpoint.json"))
    if not candidates:
        return None
    try:
        return json.loads(candidates[-1].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def build_world(item: tuple[int, Path, dict]) -> dict:
    world_id, generation_dir, base = item
    world_dir = generation_dir / f"world-{world_id}"
    world_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema": "the-world-strong-new-game-world/v1",
        "world": world_id,
        "generation": base["generation"],
        "created_at": base["created_at"],
        "focus": WORLD_FOCUS[world_id],
        "lineage": base["lineage"],
        "research": base["research"],
        "inheritance": {
            "git_history": True,
            "merge_history": True,
            "workflow_definitions": True,
            "research_memory": True,
            "red_priority_weight": CHANNEL_WEIGHTS["RED"],
            "guard_policy": "unchanged",
            "credentials": False,
            "authority_grants": False,
            "external_side_effects": False,
        },
    }
    manifest["manifest_digest"] = sha256_text(json.dumps(manifest, sort_keys=True, ensure_ascii=False))
    (world_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def build(output: Path, previous: Path | None) -> dict:
    old = previous_checkpoint(previous)
    generation = int(old.get("generation", 0)) + 1 if old else 1
    created_at = datetime.now(timezone.utc).isoformat()
    research = collect_research()
    git_state = refs_snapshot()
    research_digest = sha256_text(json.dumps(research, sort_keys=True, ensure_ascii=False))
    previous_digest = old.get("checkpoint_digest") if old else None

    generation_dir = output / f"generation-{generation:06d}"
    generation_dir.mkdir(parents=True, exist_ok=True)
    base = {
        "generation": generation,
        "created_at": created_at,
        "research": research,
        "lineage": {
            "source_commit": git_state["head"],
            "refs_digest": git_state["refs_digest"],
            "workflow_digest": git_state["workflow_digest"],
            "previous_checkpoint_digest": previous_digest,
            "research_digest": research_digest,
        },
    }

    items = [(world, generation_dir, base) for world in range(1, 5)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="strong-new-game") as pool:
        worlds = list(pool.map(build_world, items))

    checkpoint = {
        "schema": "the-world-strong-new-game-checkpoint/v1",
        "generation": generation,
        "created_at": created_at,
        "cadence_hours": 3,
        "branching_factor": 2,
        "generations_per_cycle": 2,
        "world_count": 4,
        "source_commit": git_state["head"],
        "git_state": git_state,
        "research": research,
        "research_digest": research_digest,
        "previous_checkpoint_digest": previous_digest,
        "world_manifest_digests": [world["manifest_digest"] for world in worlds],
        "invariants": {
            "parent_folder_inside_test": True,
            "parallel_world_generation": True,
            "red_priority": CHANNEL_WEIGHTS["RED"],
            "guard_policy": "unchanged",
            "external_side_effects": False,
            "credential_inheritance": False,
            "authority_inheritance": False,
        },
    }
    checkpoint["checkpoint_digest"] = sha256_text(
        json.dumps(checkpoint, sort_keys=True, ensure_ascii=False)
    )
    (generation_dir / "checkpoint.json").write_text(
        json.dumps(checkpoint, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output / "latest.json").write_text(
        json.dumps(
            {
                "generation": generation,
                "checkpoint": str((generation_dir / "checkpoint.json").relative_to(output)),
                "checkpoint_digest": checkpoint["checkpoint_digest"],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"generation": generation, "worlds": 4, "checkpoint_digest": checkpoint["checkpoint_digest"]}))
    return checkpoint


def verify(output: Path) -> None:
    latest = json.loads((output / "latest.json").read_text(encoding="utf-8"))
    checkpoint = json.loads((output / latest["checkpoint"]).read_text(encoding="utf-8"))
    generation_dir = output / f"generation-{checkpoint['generation']:06d}"
    manifests = [generation_dir / f"world-{world}" / "manifest.json" for world in range(1, 5)]
    ok = checkpoint["world_count"] == 4 and all(path.is_file() for path in manifests)
    result = {
        "ok": ok,
        "generation": checkpoint["generation"],
        "world_count": checkpoint["world_count"],
        "source_commit": checkpoint["source_commit"],
        "red_priority": checkpoint["invariants"]["red_priority"],
    }
    print(json.dumps(result))
    raise SystemExit(0 if ok else 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "verify"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--previous", type=Path)
    args = parser.parse_args()
    if args.command == "build":
        build(args.output, args.previous)
    else:
        verify(args.output)


if __name__ == "__main__":
    main()
