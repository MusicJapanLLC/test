#!/usr/bin/env python3
"""Select work for the META/X/Senju production repair lineage.

Priority is deliberately closed-loop:
1. A recently merged lineage whose latest production Audit failed returns to Fix
   under the same canonical lineage_id.
2. Otherwise, confirmed META findings are selected.
3. Explicit task contracts are preferred; unique ordinary-code Surface Scout
   findings may materialize a temporary pytest-backed task.

The selector is read-only with respect to GitHub state. It does not broaden
runtime authority; it only routes failed Audit evidence back into the existing
Fix/Approval/Apply lineage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from automation.world.closed_loop_lineage import is_protected_path, lineage_id_for

TRACKER = ROOT / "senju" / "state" / "meta_hypothesis_tracker.json"
TASKS_DIR = ROOT / "automation" / "codegen" / "tasks"
AUTO_PREFIXES = (
    "automation/ai_foundry/",
    "automation/world/",
    "automation/security/",
    "standment-security/",
    "value-lab/",
)


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "-", str(value).strip()).strip("-").lower()


def _repo_rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def load_tasks(tasks_dir: Path = TASKS_DIR) -> dict[str, dict[str, Any]]:
    tasks: dict[str, dict[str, Any]] = {}
    if not tasks_dir.exists():
        return tasks
    for path in sorted(tasks_dir.glob("*.json")):
        data = _load(path, {})
        if isinstance(data, dict):
            tasks[path.stem] = data
    return tasks


def matching_task_ids(
    hypothesis_id: str,
    hypothesis: Mapping[str, Any],
    tasks: Mapping[str, Mapping[str, Any]],
) -> tuple[str, ...]:
    surfaces = {_slug(v) for v in hypothesis.get("surfaces", []) if str(v).strip()}
    matches: list[str] = []
    for task_id, task in tasks.items():
        task_surfaces = {_slug(v) for v in task.get("detection_surfaces", []) if str(v).strip()}
        task_hypotheses = {str(v).strip() for v in task.get("detection_hypothesis_ids", []) if str(v).strip()}
        implicit_surface_match = _slug(task_id) in surfaces
        if hypothesis_id in task_hypotheses or bool(surfaces & task_surfaces) or implicit_surface_match:
            matches.append(task_id)
    return tuple(matches)


def _allowed_auto_path(path: Path) -> bool:
    try:
        rel = _repo_rel(path)
    except ValueError:
        return False
    if not rel.endswith(".py") or Path(rel).name.startswith("test_"):
        return False
    if not any(rel.startswith(prefix) for prefix in AUTO_PREFIXES):
        return False
    return not is_protected_path(rel)


def _surface_paths(surface: str) -> tuple[Path, ...]:
    raw = str(surface).strip().replace("\\", "/")
    found: list[Path] = []

    direct = ROOT / raw
    if "/" in raw and direct.exists() and direct.is_file() and _allowed_auto_path(direct):
        found.append(direct)

    match = re.fullmatch(r"auto:[^:]+:([A-Za-z0-9_.-]+)", raw)
    if match:
        stem = match.group(1)
        matches: list[Path] = []
        for prefix in AUTO_PREFIXES:
            base = ROOT / prefix
            if not base.exists():
                continue
            for path in base.rglob(f"{stem}.py"):
                if path.is_file() and _allowed_auto_path(path):
                    matches.append(path)
        unique = sorted({p.resolve() for p in matches})
        if len(unique) == 1:
            found.append(unique[0])

    return tuple(sorted({p.resolve() for p in found}))


def _test_for_target(target: Path) -> str | None:
    stem = target.stem
    candidates: set[Path] = set()
    for path in (
        target.parent / f"test_{stem}.py",
        target.parent / "tests" / f"test_{stem}.py",
    ):
        if path.exists() and path.is_file():
            candidates.add(path.resolve())

    if not candidates:
        for prefix in AUTO_PREFIXES:
            base = ROOT / prefix
            if not base.exists():
                continue
            for path in base.rglob(f"test_{stem}.py"):
                if path.is_file():
                    candidates.add(path.resolve())

    if len(candidates) != 1:
        return None
    test_rel = _repo_rel(next(iter(candidates)))
    return f"python -m pytest {test_rel} -q"


def _auto_task(
    *,
    hypothesis_id: str,
    hypothesis: Mapping[str, Any],
    target: Path,
    test_cmd: str,
) -> tuple[str, dict[str, Any]]:
    rel = _repo_rel(target)
    digest = hashlib.sha256(f"{hypothesis_id}|{rel}|{test_cmd}".encode("utf-8")).hexdigest()[:12]
    task_id = f"meta-auto-{target.stem}-{digest}"
    statement = str(hypothesis.get("statement") or hypothesis_id).strip()
    predicted = str(hypothesis.get("predicted_outcome") or "").strip()
    goal = f"Repair confirmed META finding {hypothesis_id}: {statement}"
    if predicted:
        goal += f" Predicted outcome: {predicted}."
    return task_id, {
        "name": f"META auto repair: {target.name}",
        "goal": goal,
        "output_file": rel,
        "test_cmd": test_cmd,
        "constraints": "Preserve unrelated behavior. Modify only the declared output file. Keep the existing security/authority boundary unchanged.",
        "detection_hypothesis_ids": [hypothesis_id],
        "detection_surfaces": [str(v) for v in hypothesis.get("surfaces", [])],
        "auto_materialized": True,
    }


def inferred_tasks(hypothesis_id: str, hypothesis: Mapping[str, Any]) -> tuple[tuple[str, dict[str, Any]], ...]:
    rows: list[tuple[str, dict[str, Any]]] = []
    seen_targets: set[str] = set()
    for surface in hypothesis.get("surfaces", []):
        for target in _surface_paths(str(surface)):
            rel = _repo_rel(target)
            if rel in seen_targets:
                continue
            seen_targets.add(rel)
            test_cmd = _test_for_target(target)
            if not test_cmd:
                continue
            rows.append(_auto_task(
                hypothesis_id=hypothesis_id,
                hypothesis=hypothesis,
                target=target,
                test_cmd=test_cmd,
            ))
    return tuple(rows)


def _candidate(
    *,
    hypothesis_id: str,
    raw: Mapping[str, Any],
    task_id: str,
    target_ref: str,
    source: str,
    task: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    canonical = lineage_id_for(
        detection_id=hypothesis_id,
        task_id=task_id,
        target_ref=target_ref,
    )
    row = {
        "hypothesis_id": hypothesis_id,
        "task_id": task_id,
        "confidence": float(raw.get("confidence") or 0.0),
        "surfaces": [str(v) for v in raw.get("surfaces", [])],
        "source": source,
        "lineage_id": canonical,
        "canonical_lineage_id": canonical,
        "attempt_key": canonical,
        "retry": False,
    }
    if task is not None:
        row["task"] = dict(task)
    return row


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
        hid = str(hypothesis_id)
        explicit = matching_task_ids(hid, raw, tasks)
        for task_id in explicit:
            candidates.append(_candidate(
                hypothesis_id=hid,
                raw=raw,
                task_id=task_id,
                target_ref=target_ref,
                source="explicit_task",
            ))
        if not explicit:
            for task_id, task in inferred_tasks(hid, raw):
                candidates.append(_candidate(
                    hypothesis_id=hid,
                    raw=raw,
                    task_id=task_id,
                    target_ref=target_ref,
                    source="inferred_unique_surface",
                    task=task,
                ))
    candidates.sort(key=lambda row: (
        0 if row["source"] == "explicit_task" else 1,
        -float(row["confidence"]),
        row["hypothesis_id"],
        row["task_id"],
    ))
    return tuple(candidates)


def _retry_task_from_audit(audit: Mapping[str, Any], receipt: Mapping[str, Any]) -> dict[str, Any] | None:
    output_file = str(receipt.get("output_file") or audit.get("output_file") or "").strip().replace("\\", "/")
    test_cmd = str(receipt.get("test_cmd") or audit.get("test_cmd") or "").strip()
    task_id = str(receipt.get("task_id") or audit.get("task_id") or "").strip()
    if not output_file or not test_cmd or not task_id or is_protected_path(output_file):
        return None

    votes = audit.get("audit_votes") if isinstance(audit.get("audit_votes"), Mapping) else {}
    failed = [
        actor for actor, vote in votes.items()
        if isinstance(vote, Mapping) and not bool(vote.get("passed"))
    ]
    senju = votes.get("SENJU") if isinstance(votes, Mapping) else None
    test_output = str((senju or {}).get("test_output") or "")[-4000:] if isinstance(senju, Mapping) else ""
    goal = (
        "Continue the same production lineage after Audit FAIL. "
        f"The previous applied attempt failed audit actors: {', '.join(failed) or 'unknown'}. "
        "Repair the declared output so the original test contract and post-merge integrity audit pass."
    )
    if test_output:
        goal += f" Previous Senju audit test output: {test_output}"
    return {
        "name": f"Audit retry: {task_id}",
        "goal": goal,
        "output_file": output_file,
        "test_cmd": test_cmd,
        "constraints": "Stay inside the original output file and existing authority boundary. Preserve unrelated behavior. This is a retry of the same canonical lineage.",
        "audit_retry": True,
    }


def retry_candidates_from_audits(
    failed_audits: tuple[Mapping[str, Any], ...],
    tasks: Mapping[str, Mapping[str, Any]],
    *,
    target_ref: str,
) -> tuple[dict[str, Any], ...]:
    rows: list[dict[str, Any]] = []
    for audit in failed_audits:
        receipt = audit.get("_receipt")
        if not isinstance(receipt, Mapping):
            continue
        canonical = str(receipt.get("lineage_id") or "").strip()
        detection_id = str(receipt.get("detection_id") or "").strip()
        task_id = str(receipt.get("task_id") or "").strip()
        receipt_target = str(receipt.get("target_ref") or target_ref).strip()
        pr_number = int(audit.get("pr_number") or 0)
        merge_sha = str(audit.get("merge_commit_sha") or "").strip()
        if not canonical or not detection_id or not task_id or receipt_target != target_ref:
            continue
        expected = lineage_id_for(detection_id=detection_id, task_id=task_id, target_ref=target_ref)
        if expected != canonical:
            continue
        output_file = str(receipt.get("output_file") or "").strip()
        if not output_file or is_protected_path(output_file):
            continue

        task = None if task_id in tasks else _retry_task_from_audit(audit, receipt)
        if task_id not in tasks and task is None:
            continue

        attempt_tag = f"retry-pr{pr_number}-{merge_sha[:8] or 'audit'}"
        attempt_key = f"{canonical}-{attempt_tag}"
        rows.append({
            "hypothesis_id": detection_id,
            "task_id": task_id,
            "confidence": 2.0,
            "surfaces": [output_file],
            "source": "audit_retry",
            "lineage_id": attempt_key,
            "canonical_lineage_id": canonical,
            "attempt_key": attempt_key,
            "retry": True,
            "retry_of_pr": pr_number,
            "prior_audit_status": audit.get("status"),
            "task": task,
        })
    return tuple(rows)


def live_failed_audits(*, limit: int = 20, lookback_hours: int = 24) -> tuple[dict[str, Any], ...]:
    """Re-audit the latest merged PR for each lineage using existing read authority."""
    if os.environ.get("GITHUB_ACTIONS", "").lower() != "true" or not shutil.which("gh"):
        return ()
    try:
        from automation.world import audit_closed_lineage_prs as auditor
        prs = list(auditor.discover_lineage_prs(limit))
    except Exception:
        return ()

    prs.sort(key=lambda row: str(row.get("mergedAt") or ""), reverse=True)
    seen: set[str] = set()
    failed: list[dict[str, Any]] = []
    for pr in prs:
        receipt = auditor.parse_receipt(str(pr.get("body") or ""))
        if not isinstance(receipt, Mapping):
            continue
        canonical = str(receipt.get("lineage_id") or "").strip()
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)
        if not auditor._recent_enough(pr, lookback_hours):
            continue
        try:
            result = auditor.audit_pr(pr)
        except Exception as exc:
            result = {
                "schema": "the-world-closed-lineage-audit/v2",
                "lineage_id": canonical,
                "phase": "audit",
                "status": "FAIL",
                "pass_declared": False,
                "pr_number": pr.get("number"),
                "merge_commit_sha": "",
                "error": str(exc),
            }
        if not bool(result.get("pass_declared")):
            row = dict(result)
            row["_receipt"] = dict(receipt)
            failed.append(row)
    return tuple(failed)


def _exclude_local_task(path: Path) -> None:
    exclude = ROOT / ".git" / "info" / "exclude"
    if not exclude.parent.exists():
        return
    rel = _repo_rel(path)
    existing = exclude.read_text(encoding="utf-8") if exclude.exists() else ""
    if rel not in {line.strip() for line in existing.splitlines()}:
        exclude.write_text(existing + ("" if existing.endswith("\n") or not existing else "\n") + rel + "\n", encoding="utf-8")


def materialize_selected(selected: list[dict[str, Any]]) -> int:
    written = 0
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    for row in selected:
        task = row.get("task")
        if not isinstance(task, Mapping):
            continue
        path = TASKS_DIR / f"{row['task_id']}.json"
        if path.exists():
            continue
        path.write_text(json.dumps(dict(task), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        _exclude_local_task(path)
        row["materialized_task_path"] = _repo_rel(path)
        written += 1
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Select META findings or failed audits for the closed production lineage")
    parser.add_argument("--target-ref", required=True)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--out")
    args = parser.parse_args()

    tracker = _load(TRACKER, {})
    tasks = load_tasks()
    if not isinstance(tracker, Mapping):
        tracker = {}

    failed_audits = live_failed_audits()
    retries = retry_candidates_from_audits(failed_audits, tasks, target_ref=args.target_ref)
    findings = collect_candidates(tracker, tasks, target_ref=args.target_ref)
    candidates = tuple(retries) + tuple(findings)
    limit = max(0, int(args.limit))
    selected = list(candidates[:limit] if limit else candidates)
    materialized = materialize_selected(selected)
    result = {
        "schema": "meta-confirmed-fix-lineage-selection/v3",
        "target_ref": args.target_ref,
        "confirmed_findings": sum(
            1 for value in tracker.values()
            if isinstance(value, Mapping) and value.get("status") == "confirmed"
        ),
        "failed_lineages_reaudited": len(failed_audits),
        "audit_retry_candidates": len(retries),
        "task_count": len(tasks),
        "candidate_count": len(candidates),
        "auto_tasks_materialized": materialized,
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
