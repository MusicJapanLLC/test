"""
Master orchestrator (X) — runs without human approval.

Modes:
  full   : generate new tasks → run all pending → broadcast summary
  run    : run specific task_id (or all pending if omitted)
  expand : only generate new tasks
  report : only broadcast knowledge summary
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from engine import knowledge_base as kb
from engine.broadcaster import push_knowledge_summary, push_new_tasks
from engine.loop import run_loop
from engine.task_generator import generate_new_tasks
from engine.meta_v2 import run_full_meta_cycle, check_heartbeat
from engine.recovery import write_x_status, mutual_recovery_cycle, self_recover

TASKS_DIR = Path(__file__).parent / "tasks"
MAX_WORKERS = 4
DEFAULT_MAX_ITER = 15


def discover_pending_tasks(max_tasks: int = 20) -> list[str]:
    stats = kb.get_stats()
    pending = []
    for task_file in sorted(TASKS_DIR.rglob("*.json")):
        rel = task_file.relative_to(TASKS_DIR)
        task_id = str(rel.with_suffix(""))
        stat = stats.get(task_id, {})
        if stat.get("successes", 0) == 0:
            pending.append((stat.get("attempts", 0), task_id))
    pending.sort(key=lambda x: x[0])
    return [task_id for _, task_id in pending[:max_tasks]]


def run_parallel(task_ids: list[str], max_iter: int = DEFAULT_MAX_ITER) -> dict:
    results = {}
    print(f"[X] running {len(task_ids)} tasks with {MAX_WORKERS} workers")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(run_loop, tid, max_iter): tid for tid in task_ids}
        for future in as_completed(futures):
            tid = futures[future]
            try:
                passed = future.result()
                results[tid] = "PASS" if passed else "FAIL"
            except Exception as e:
                results[tid] = f"ERROR: {e}"
                print(f"[X] {tid} raised: {e}")
    return results


def mode_full(new_task_count: int = 5, max_iter: int = DEFAULT_MAX_ITER):
    print("[X] === FULL CYCLE ===")

    if not check_heartbeat(max_gap_hours=10.0):
        print("[X] WARNING: heartbeat gap — system may have been down")

    try:
        run_full_meta_cycle()
    except Exception as e:
        print(f"[X] meta_v2 cycle error (continuing): {e}")

    print(f"[X] generating {new_task_count} new tasks...")
    try:
        new_tasks = generate_new_tasks(new_task_count)
        push_new_tasks(new_tasks)
    except Exception as e:
        print(f"[X] task generation failed (continuing): {e}")

    pending = discover_pending_tasks()
    if not pending:
        print("[X] no pending tasks")
    else:
        results = run_parallel(pending, max_iter)
        passed = sum(1 for v in results.values() if v == "PASS")
        print(f"[X] cycle complete: {passed}/{len(results)} passed")

    stats = kb.get_stats()
    push_knowledge_summary(stats)
    try:
        write_x_status(stats, meta_cycle_ok=True)
        self_recover(stats)
        mutual_recovery_cycle(stats)
    except Exception as e:
        print(f"[X] recovery error (continuing): {e}")


def mode_run(task_ids: list[str] | None, max_iter: int = DEFAULT_MAX_ITER):
    if not task_ids:
        task_ids = discover_pending_tasks()
    if not task_ids:
        print("[X] nothing to run")
        return
    results = run_parallel(task_ids, max_iter)
    stats = kb.get_stats()
    push_knowledge_summary(stats)
    write_x_status(stats, meta_cycle_ok=True)
    for tid, status in results.items():
        print(f"  {tid}: {status}")


def mode_expand(count: int = 10):
    tasks = generate_new_tasks(count)
    push_new_tasks(tasks)


def mode_report():
    push_knowledge_summary(kb.get_stats())


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    if mode == "full":
        new_count = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        max_iter = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_MAX_ITER
        mode_full(new_count, max_iter)
    elif mode == "run":
        task_ids = sys.argv[2:] if len(sys.argv) > 2 else None
        mode_run(task_ids)
    elif mode == "expand":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        mode_expand(count)
    elif mode == "report":
        mode_report()
    else:
        print(f"Unknown mode: {mode}. Use: full | run | expand | report")
        sys.exit(1)
