#!/usr/bin/env python3
"""Select confirmed META findings that have an explicit codegen repair task.

This is the Detection -> Fix bridge. It is read-only: it does not dispatch a new
privileged workflow or write GitHub state. The existing approved Agent Factory
lane consumes the selected candidate and carries its deterministic lineage_id.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Mapping

from automation.world.closed_loop_lineage import lineage_id_for

ROOT = Path(__file__).resolve().parents[2]
TRACKER = ROOT / "senju" / "state" / "meta_hypothesis_tracker.json"
TASKS_DIR = ROOT / "automation" / "codegen" / "tasks"


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "-", str(value).strip()).strip("-").lower()


def load_tasks(tasks_dir: Path = TASKS_DIR) -> dict[str, dict[str, Any]]:
    tasks: dict[str, dict[str, Any]] = {}
    if not tasks_dir.exists():
        return tasks
    for path in sorted(tasks_dir.glob("*.json")):
        data = _load(path, {})
        if isinstance(data, dict):
            tasks[path.stem] = data
    return tasks


def matching_task_ids(hypothesis_id: str, hypothesis: Mapping[str, Any], tasks: Mapping[str, Mapping[str, Any]]) -> tuple[str, ...]:
    surfaces = {_slug(v) for v in hypothesis.get("surfaces", []) if str(v).strip()}
    matches: list[str] = []
    for task_id, task in tasks.items():
        task_surfaces = {_slug(v) for v in task.get("detection_surfaces", []) if str(v).strip()}
        task_hypotheses = {str(v).strip() for v in task.get("detection_hypothesis_ids", []) if str(v).strip()}
        implicit_surface_match = _slug(task_id) in surfaces
        if hypothesis_id in task_hypotheses or bool(surfaces & task_surfaces) or implicit_surface_match:
            matches.append(task_id)
    return tuple(matches)


def collect_candidates(
    tracker: Mapping[str, Any],
    tasks: Mapping[str, Mapping[str, Any]],
    *,
    target_ref: str,
) -> tuple[dict[str, Any], ...]:
    candidates: list[dict[str, Any]] = []
    for hypothesis_id, raw in tracker.items():
        if not isinstance(raw, Mapping) or str(raw.get("status")) != "confirmed":
            continue
        for task_id in matching_task_ids(str(hypothesis_id), raw, tasks):
            candidates.append({
                "hypothesis_id": str(hypothesis_id),
                "task_id": task_id,
                "confidence": float(raw.get("confidence") or 0.0),
                "surfaces": [str(v) for v in raw.get("surfaces", [])],
                "lineage_id": lineage_id_for(
                    detection_id=str(hypothesis_id),
                    task_id=task_id,
                    target_ref=target_ref,
                ),
            })
    candidates.sort(key=lambda row: (-float(row["confidence"]), row["hypothesis_id"], row["task_id"]))
    return tuple(candidates)


def main() -> int:
    parser = argparse.ArgumentParser(description="Select confirmed META findings for the closed production lineage")
    parser.add_argument("--target-ref", required=True)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--out")
    args = parser.parse_args()

    tracker = _load(TRACKER, {})
    tasks = load_tasks()
    if not isinstance(tracker, Mapping):
        tracker = {}
    candidates = collect_candidates(tracker, tasks, target_ref=args.target_ref)
    limit = max(0, int(args.limit))
    selected = list(candidates[:limit] if limit else candidates)
    result = {
        "schema": "meta-confirmed-fix-lineage-selection/v1",
        "target_ref": args.target_ref,
        "confirmed_findings": sum(1 for value in tracker.values() if isinstance(value, Mapping) and value.get("status") == "confirmed"),
        "task_count": len(tasks),
        "candidate_count": len(candidates),
        "selected": selected,
    }
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        path = Path(args.out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
