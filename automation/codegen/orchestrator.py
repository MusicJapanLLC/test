"""
Master orchestrator (X) — runs without human approval.

Modes:
  full    : generate new tasks → run all pending → broadcast summary → self-dev
  run     : run specific task_id (or all pending if omitted)
  expand  : only generate new tasks
  report  : only broadcast knowledge summary
  selfdev : run self-improvement cycle only
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
from engine.recovery import write_x_status, enhanced_mutual_recovery

TASKS_DIR = Path(__file__).parent / "tasks"

_BASE_WORKERS = int(os.environ.get("X_WORKERS", "16"))
DEFAULT_MAX_ITER = int(os.environ.get("X_MAX_ITER", "30"))
DEFAULT_NEW_TASKS = int(os.environ.get("X_NEW_TASKS", "20"))


def _adaptive_max_iter(stats: dict) -> int:
    """Scale iteration budget inversely with pass rate."""
    if DEFAULT_MAX_ITER == 0:
        total = max(len(stats), 1)
        passing = sum(1 for v in stats.values() if v.get("successes", 0) > 0)
        rate = passing / total
        if rate >= 0.8:
            return 10
        elif rate >= 0.5:
            return 20
        elif rate >= 0.2:
            return 30
        else:
            return 40
    return DEFAULT_MAX_ITER


def _adaptive_workers(pending_count: int) -> int:
    """Scale workers with pending workload."""
    if pending_count > 100:
        return min(_BASE_WORKERS * 2, 32)
    elif pending_count > 50:
        return min(_BASE_WORKERS, 24)
    elif pending_count > 20:
        return _BASE_WORKERS
    else:
        return max(_BASE_WORKERS // 2, 4)


def discover_pending_tasks(max_tasks: int = 100) -> list[str]:
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
    workers = _adaptive_workers(len(task_ids))
    results = {}
    print(f"[X] running {len(task_ids)} tasks with {workers} workers, max_iter={max_iter}")
    with ThreadPoolExecutor(max_workers=workers) as pool:
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


def _analyze_failures(results: dict, stats: dict) -> str:
    """Find the dominant failing domain to focus self-dev on."""
    domain_fails: dict[str, int] = {}
    for tid, status in results.items():
        if status != "PASS":
            domain = stats.get(tid, {}).get("domain", "unknown")
            domain_fails[domain] = domain_fails.get(domain, 0) + 1
    if not domain_fails:
        return ""
    top = max(domain_fails, key=lambda d: domain_fails[d])
    return f"most failures in domain: {top} ({domain_fails[top]} tasks)"


def _run_self_dev(focus: str = ""):
    try:
        from engine.self_dev import run_self_dev_cycle
        result = run_self_dev_cycle(focus=focus)
        print(f"[X/self-dev] {result.get('file','—')}: {result.get('rationale','')}"
              f" applied={result.get('applied')} pushed={result.get('pushed')}")
    except Exception as e:
        print(f"[X/self-dev] error (continuing): {e}")


def mode_full(new_task_count: int = DEFAULT_NEW_TASKS, max_iter: int = 0):
    print("[X] === FULL CYCLE v2 ===")

    if not check_heartbeat(max_gap_hours=6.0):
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

    stats = kb.get_stats()
    effective_iter = max_iter if max_iter > 0 else _adaptive_max_iter(stats)

    pending = discover_pending_tasks()
    results = {}
    if not pending:
        print("[X] no pending tasks")
    else:
        results = run_parallel(pending, effective_iter)
        passed = sum(1 for v in results.values() if v == "PASS")
        print(f"[X] cycle complete: {passed}/{len(results)} passed")

    stats = kb.get_stats()
    push_knowledge_summary(stats)

    try:
        write_x_status(stats, meta_cycle_ok=True)
        recovery_report = enhanced_mutual_recovery(stats)
        print(f"[X] recovery: {recovery_report}")
    except Exception as e:
        print(f"[X] recovery error (continuing): {e}")

    focus = _analyze_failures(results, stats)
    _run_self_dev(focus)


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


def mode_expand(count: int = DEFAULT_NEW_TASKS):
    tasks = generate_new_tasks(count)
    push_new_tasks(tasks)


def mode_report():
    push_knowledge_summary(kb.get_stats())


def mode_selfdev(focus: str = ""):
    print(f"[X] === SELF-DEV CYCLE focus={focus!r} ===")
    _run_self_dev(focus)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    if mode == "full":
        new_count = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_NEW_TASKS
        max_iter = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        mode_full(new_count, max_iter)
    elif mode == "run":
        task_ids = sys.argv[2:] if len(sys.argv) > 2 else None
        mode_run(task_ids)
    elif mode == "expand":
        count = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_NEW_TASKS
        mode_expand(count)
    elif mode == "report":
        mode_report()
    elif mode == "selfdev":
        focus = sys.argv[2] if len(sys.argv) > 2 else ""
        mode_selfdev(focus)
    else:
        print(f"Unknown mode: {mode}. Use: full | run | expand | report | selfdev")
        sys.exit(1)
