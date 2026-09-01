#!/usr/bin/env python3
"""Three-hour 2x2 Strong New Game research checkpoint generator.

The cycle keeps complete Git lineage and rolls bounded research knowledge from
RED / Senju / META / X into four parallel research-only worlds. External
artifacts are read as evidence, summarized, and discarded; credentials,
authority grants, external side effects, and guard-policy changes are never
inherited by this checkpoint format.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_OUTPUT = HERE / "runtime"
TEXT_EXTENSIONS = {".json", ".md", ".txt", ".py", ".yaml", ".yml", ".toml"}
CHANNEL_WEIGHTS = {"RED": 0.40, "SENJU": 0.20, "META": 0.20, "X": 0.20}
TOTAL_FILE_BUDGET = 1000
MAX_BYTES_PER_FILE = 65536
MAX_INSIGHTS_PER_CHANNEL = 128
WORLD_FOCUS = {
    1: "authorization-state-models",
    2: "session-and-identity-boundaries",
    3: "input-and-parser-regressions",
    4: "workflow-and-state-machine-regressions",
}
SIGNALS = ("finding", "hypothesis", "failure", "success", "regression", "mutation", "reproduce", "test")
INSIGHT_KEYS = {
    "schema",
    "doctrine",
    "trend",
    "next_cycle",
    "mode",
    "program_key",
    "focus_findings",
    "priority_findings",
    "learning_directive",
    "risk_delta",
    "holdout_delta",
    "novelty",
    "confidence",
    "reproducibility",
    "replication_outcome",
}


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
    if "/red/" in f"/{lowered}" or name.startswith("red_") or "adversary" in lowered or "pentest" in lowered:
        channels.add("RED")
    if "senju" in lowered:
        channels.add("SENJU")
    if "/meta/" in f"/{lowered}" or name.startswith("meta_") or "meta_loop" in lowered:
        channels.add("META")
    if "/x/" in f"/{lowered}" or name.startswith("x_") or "x_bridge" in lowered:
        channels.add("X")
    return channels


def channel_budgets(total: int = TOTAL_FILE_BUDGET) -> dict[str, int]:
    if total < len(CHANNEL_WEIGHTS):
        raise ValueError("total research file budget is too small")
    budgets = {name: int(total * weight) for name, weight in CHANNEL_WEIGHTS.items()}
    remainder = total - sum(budgets.values())
    order = sorted(CHANNEL_WEIGHTS, key=CHANNEL_WEIGHTS.get, reverse=True)
    for index in range(remainder):
        budgets[order[index % len(order)]] += 1
    return budgets


def parse_research_inputs(values: list[str]) -> dict[str, list[Path]]:
    result = {channel: [] for channel in CHANNEL_WEIGHTS}
    for value in values:
        if "=" not in value:
            raise ValueError(f"research input must use CHANNEL=PATH: {value}")
        channel, raw_path = value.split("=", 1)
        channel = channel.strip().upper()
        if channel not in CHANNEL_WEIGHTS:
            raise ValueError(f"unknown research channel: {channel}")
        result[channel].append(Path(raw_path).expanduser())
    return result


def safe_scalar(value) -> str | None:
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (int, float)):
        return str(value)
    if not isinstance(value, str):
        return None
    text = " ".join(value.strip().split())
    if not text or len(text) > 160:
        return None
    lowered = text.lower()
    if "://" in lowered or "authorization:" in lowered or "bearer " in lowered or "token=" in lowered:
        return None
    return text


def extract_json_insights(value, prefix: str = "", limit: int = 64) -> list[str]:
    out: list[str] = []

    def visit(node, path: str) -> None:
        if len(out) >= limit:
            return
        if isinstance(node, dict):
            for key, child in node.items():
                next_path = f"{path}.{key}" if path else str(key)
                if key in INSIGHT_KEYS:
                    if isinstance(child, list):
                        for item in child[:16]:
                            scalar = safe_scalar(item)
                            if scalar is not None:
                                out.append(f"{next_path}={scalar}")
                                if len(out) >= limit:
                                    return
                    elif isinstance(child, dict):
                        for subkey, subvalue in list(child.items())[:16]:
                            scalar = safe_scalar(subvalue)
                            if scalar is not None:
                                out.append(f"{next_path}.{subkey}={scalar}")
                                if len(out) >= limit:
                                    return
                    else:
                        scalar = safe_scalar(child)
                        if scalar is not None:
                            out.append(f"{next_path}={scalar}")
                visit(child, next_path)
        elif isinstance(node, list):
            for item in node[:32]:
                visit(item, path)

    visit(value, prefix)
    return out[:limit]


def file_insights(path: Path, text: str) -> tuple[list[str], list[str]]:
    if path.suffix.lower() != ".json":
        return [], []
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return [], []
    schemas: list[str] = []
    if isinstance(value, dict):
        schema = safe_scalar(value.get("schema"))
        if schema:
            schemas.append(schema)
    return schemas, extract_json_insights(value)


def external_candidates(inputs: dict[str, list[Path]]) -> dict[str, list[tuple[str, Path, str]]]:
    result = {channel: [] for channel in CHANNEL_WEIGHTS}
    for channel, roots in inputs.items():
        for root in roots:
            if not root.exists():
                continue
            files = [root] if root.is_file() else sorted(path for path in root.rglob("*") if path.is_file())
            for path in files:
                if path.suffix.lower() not in TEXT_EXTENSIONS:
                    continue
                try:
                    label = str(path.relative_to(root)) if root.is_dir() else path.name
                except ValueError:
                    label = path.name
                result[channel].append(("artifact", path, label))
    return result


def collect_research(
    research_inputs: dict[str, list[Path]] | None = None,
    total_file_budget: int = TOTAL_FILE_BUDGET,
    max_bytes_per_file: int = MAX_BYTES_PER_FILE,
) -> dict:
    research_inputs = research_inputs or {channel: [] for channel in CHANNEL_WEIGHTS}
    budgets = channel_budgets(total_file_budget)
    candidates = external_candidates(research_inputs)

    # Artifact evidence is intentionally placed first so the newest measured
    # research is consumed before the repository baseline when a quota fills.
    for rel in (line for line in run("git", "ls-files").splitlines() if line):
        path = ROOT / rel
        if path.suffix.lower() not in TEXT_EXTENSIONS or not path.is_file():
            continue
        for channel in classify(rel):
            candidates[channel].append(("repository", path, rel))

    summary = {}
    for channel in CHANNEL_WEIGHTS:
        budget = budgets[channel]
        selected: list[tuple[str, Path, str]] = []
        seen: set[str] = set()
        for source, path, label in candidates[channel]:
            key = f"{source}:{path.resolve()}"
            if key in seen:
                continue
            seen.add(key)
            selected.append((source, path, label))
            if len(selected) >= budget:
                break

        digest = hashlib.sha256()
        signal_counts = {signal: 0 for signal in SIGNALS}
        schemas: list[str] = []
        insights: list[str] = []
        source_counts = {"artifact": 0, "repository": 0}
        total_bytes = 0
        sample_paths: list[str] = []

        for source, path, label in selected:
            try:
                raw = path.read_bytes()[:max_bytes_per_file]
            except OSError:
                continue
            text = raw.decode("utf-8", "replace")
            digest.update(source.encode())
            digest.update(b"\0")
            digest.update(label.encode("utf-8", "replace"))
            digest.update(b"\0")
            digest.update(raw)
            total_bytes += len(raw)
            source_counts[source] += 1
            if len(sample_paths) < 24:
                sample_paths.append(f"{source}:{label}")
            lowered = text.lower()
            for signal in SIGNALS:
                signal_counts[signal] += lowered.count(signal)
            found_schemas, found_insights = file_insights(path, text)
            for schema in found_schemas:
                if schema not in schemas and len(schemas) < 64:
                    schemas.append(schema)
            for insight in found_insights:
                if insight not in insights and len(insights) < MAX_INSIGHTS_PER_CHANNEL:
                    insights.append(insight)

        summary[channel] = {
            "priority_weight": CHANNEL_WEIGHTS[channel],
            "file_budget": budget,
            "candidate_count": len(candidates[channel]),
            "file_count": sum(source_counts.values()),
            "source_counts": source_counts,
            "sample_paths": sample_paths,
            "sampled_bytes": total_bytes,
            "content_digest": digest.hexdigest(),
            "signal_counts": signal_counts,
            "schemas": schemas,
            "insights": insights,
        }
    return summary


def roll_forward_research(current: dict, previous_checkpoint: dict | None) -> dict:
    previous = (previous_checkpoint or {}).get("research") or {}
    for channel, row in current.items():
        prior = previous.get(channel) or {}
        row["previous_content_digest"] = prior.get("content_digest")
        row["cumulative_cycles"] = int(prior.get("cumulative_cycles") or (1 if prior else 0)) + 1
        prior_counts = prior.get("cumulative_signal_counts") or prior.get("signal_counts") or {}
        row["cumulative_signal_counts"] = {
            signal: int(prior_counts.get(signal, 0)) + int(row["signal_counts"].get(signal, 0))
            for signal in SIGNALS
        }
        rolling: list[str] = []
        for insight in row.get("insights", []) + prior.get("rolling_insights", prior.get("insights", [])):
            if insight not in rolling:
                rolling.append(insight)
            if len(rolling) >= MAX_INSIGHTS_PER_CHANNEL:
                break
        row["rolling_insights"] = rolling
    return current


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
        "schema": "the-world-strong-new-game-world/v2",
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


def build(
    output: Path,
    previous: Path | None,
    research_inputs: dict[str, list[Path]] | None = None,
    total_file_budget: int = TOTAL_FILE_BUDGET,
) -> dict:
    build_started = time.perf_counter()
    old = previous_checkpoint(previous)
    generation = int(old.get("generation", 0)) + 1 if old else 1
    created_at = datetime.now(timezone.utc).isoformat()

    research_started = time.perf_counter()
    research = collect_research(research_inputs, total_file_budget=total_file_budget)
    research = roll_forward_research(research, old)
    research_seconds = time.perf_counter() - research_started

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

    worlds_started = time.perf_counter()
    items = [(world, generation_dir, base) for world in range(1, 5)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="strong-new-game") as pool:
        worlds = list(pool.map(build_world, items))
    world_generation_seconds = time.perf_counter() - worlds_started

    virtual_lineage_count = 4 ** generation
    checkpoint = {
        "schema": "the-world-strong-new-game-checkpoint/v2",
        "generation": generation,
        "created_at": created_at,
        "cadence_hours": 3,
        "branching_factor": 2,
        "generations_per_cycle": 2,
        "active_world_count": 4,
        "world_count": 4,
        "virtual_lineage_count": virtual_lineage_count,
        "source_commit": git_state["head"],
        "git_state": git_state,
        "research": research,
        "research_digest": research_digest,
        "previous_checkpoint_digest": previous_digest,
        "world_manifest_digests": [world["manifest_digest"] for world in worlds],
        "performance": {
            "research_collect_seconds": round(research_seconds, 6),
            "world_generation_seconds": round(world_generation_seconds, 6),
            "active_world_workers": 4,
            "research_file_budget_total": total_file_budget,
        },
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
    checkpoint["performance"]["total_build_seconds"] = round(time.perf_counter() - build_started, 6)
    checkpoint["checkpoint_digest"] = sha256_text(json.dumps(checkpoint, sort_keys=True, ensure_ascii=False))
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
    print(
        json.dumps(
            {
                "generation": generation,
                "active_worlds": 4,
                "virtual_lineage_count": virtual_lineage_count,
                "red_file_budget": research["RED"]["file_budget"],
                "total_build_seconds": checkpoint["performance"]["total_build_seconds"],
                "checkpoint_digest": checkpoint["checkpoint_digest"],
            }
        )
    )
    return checkpoint


def verify(output: Path) -> None:
    latest = json.loads((output / "latest.json").read_text(encoding="utf-8"))
    checkpoint = json.loads((output / latest["checkpoint"]).read_text(encoding="utf-8"))
    generation_dir = output / f"generation-{checkpoint['generation']:06d}"
    manifests = [generation_dir / f"world-{world}" / "manifest.json" for world in range(1, 5)]
    budgets = {channel: checkpoint["research"][channel]["file_budget"] for channel in CHANNEL_WEIGHTS}
    ok = (
        checkpoint["world_count"] == 4
        and all(path.is_file() for path in manifests)
        and budgets["RED"] == 2 * budgets["SENJU"]
        and budgets["RED"] == 2 * budgets["META"]
        and budgets["RED"] == 2 * budgets["X"]
    )
    result = {
        "ok": ok,
        "generation": checkpoint["generation"],
        "world_count": checkpoint["world_count"],
        "virtual_lineage_count": checkpoint.get("virtual_lineage_count"),
        "source_commit": checkpoint["source_commit"],
        "red_priority": checkpoint["invariants"]["red_priority"],
        "research_budgets": budgets,
        "performance": checkpoint.get("performance", {}),
    }
    print(json.dumps(result))
    raise SystemExit(0 if ok else 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["build", "verify"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--previous", type=Path)
    parser.add_argument(
        "--research-input",
        action="append",
        default=[],
        metavar="CHANNEL=PATH",
        help="read-only research artifact input; may be repeated",
    )
    parser.add_argument("--research-file-budget", type=int, default=TOTAL_FILE_BUDGET)
    args = parser.parse_args()
    if args.command == "build":
        inputs = parse_research_inputs(args.research_input)
        build(args.output, args.previous, inputs, total_file_budget=args.research_file_budget)
    else:
        verify(args.output)


if __name__ == "__main__":
    main()
