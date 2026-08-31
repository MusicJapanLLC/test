#!/usr/bin/env python3
"""Dispatch confirmed META findings into the closed production repair lineage.

A task is eligible when its task JSON explicitly maps to the confirmed finding
via ``detection_surfaces`` / ``detection_hypothesis_ids`` or when the normalized
surface name equals the task id. The task specification continues to define the
single output file and its test command; the downstream lineage owns generation,
approval, production apply, audit, and PASS.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SENJU_DIR = ROOT / "senju"
TRACKER = SENJU_DIR / "state" / "meta_hypothesis_tracker.json"
TASKS_DIR = ROOT / "automation" / "codegen" / "tasks"
LEDGER = SENJU_DIR / "state" / "closed_lineage_dispatch_ledger.json"
WORKFLOW = "meta-x-senju-closed-lineage.yml"


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


def matching_task_ids(hypothesis_id: str, hypothesis: dict[str, Any], tasks: dict[str, dict[str, Any]]) -> tuple[str, ...]:
    surfaces = {_slug(v) for v in hypothesis.get("surfaces", []) if str(v).strip()}
    matches: list[str] = []
    for task_id, task in tasks.items():
        task_surfaces = {_slug(v) for v in task.get("detection_surfaces", []) if str(v).strip()}
        task_hypotheses = {str(v).strip() for v in task.get("detection_hypothesis_ids", []) if str(v).strip()}
        implicit_surface_match = _slug(task_id) in surfaces
        if hypothesis_id in task_hypotheses or bool(surfaces & task_surfaces) or implicit_surface_match:
            matches.append(task_id)
    return tuple(matches)


def collect_dispatches(
    tracker: dict[str, Any],
    tasks: dict[str, dict[str, Any]],
    ledger: dict[str, Any],
) -> tuple[dict[str, str], ...]:
    sent = ledger.get("sent") if isinstance(ledger.get("sent"), dict) else {}
    dispatches: list[dict[str, str]] = []
    for hypothesis_id, raw in tracker.items():
        if not isinstance(raw, dict) or str(raw.get("status")) != "confirmed":
            continue
        for task_id in matching_task_ids(str(hypothesis_id), raw, tasks):
            key = f"{hypothesis_id}:{task_id}"
            if key in sent:
                continue
            dispatches.append({
                "key": key,
                "hypothesis_id": str(hypothesis_id),
                "task_id": task_id,
            })
    return tuple(dispatches)


def main() -> int:
    parser = argparse.ArgumentParser(description="Dispatch confirmed META findings into production closed lineages")
    parser.add_argument("--ref", default=os.environ.get("GITHUB_REF_NAME") or "claude/employee-onboarding-setup-udm86")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tracker = _load(TRACKER, {})
    tasks = load_tasks()
    ledger = _load(LEDGER, {"schema": "meta-closed-lineage-dispatch-ledger/v1", "sent": {}})
    if not isinstance(tracker, dict):
        tracker = {}
    if not isinstance(ledger, dict):
        ledger = {"schema": "meta-closed-lineage-dispatch-ledger/v1", "sent": {}}
    ledger.setdefault("schema", "meta-closed-lineage-dispatch-ledger/v1")
    ledger.setdefault("sent", {})

    dispatches = collect_dispatches(tracker, tasks, ledger)
    results: list[dict[str, Any]] = []

    if dispatches and not args.dry_run:
        sys.path.insert(0, str(SENJU_DIR))
        from senju.meta.agent_dispatch import dispatch_workflow

        for row in dispatches:
            result = dispatch_workflow(
                WORKFLOW,
                ref=args.ref,
                inputs={
                    "task_id": row["task_id"],
                    "max_iterations": "8",
                    "apply_to_production": "true",
                },
                actor="META",
            )
            results.append({**row, "dispatch": result})
            dispatch_result = result.get("result") if isinstance(result, dict) else None
            if isinstance(dispatch_result, dict) and "_error" not in dispatch_result:
                ledger["sent"][row["key"]] = {
                    "hypothesis_id": row["hypothesis_id"],
                    "task_id": row["task_id"],
                    "workflow": WORKFLOW,
                    "ref": args.ref,
                }
    else:
        results = [dict(row) for row in dispatches]

    if not args.dry_run:
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "confirmed_findings": sum(1 for v in tracker.values() if isinstance(v, dict) and v.get("status") == "confirmed"),
        "tasks": len(tasks),
        "dispatch_candidates": len(dispatches),
        "dry_run": args.dry_run,
        "results": results,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
