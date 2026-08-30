"""
Senju hub integration.

Senju reads from senju/inbox/. We write structured event records there.
Other AIs (ChatGPT workers, Tomoki, etc.) can also write — format is
append-only NDJSON so nobody steps on each other.

Senju acts as the shared memory / coordination layer.
"""

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SENJU_INBOX = ROOT / "senju" / "inbox" / "codegen_events.ndjson"
SENJU_KNOWLEDGE = ROOT / "senju" / "knowledge" / "codegen_patterns.ndjson"
SENJU_STATUS = ROOT / "senju" / "status" / "codegen_status.json"


def _append(path: Path, record: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _write_status(data: dict):
    SENJU_STATUS.parent.mkdir(parents=True, exist_ok=True)
    SENJU_STATUS.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def emit_result(task_id: str, task_name: str, domain: str, iteration: int,
                passed: bool, code: str, test_output: str, model_used: str = "unknown"):
    event = {
        "source": "codegen",
        "event": "iteration_complete",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "task_id": task_id,
        "task_name": task_name,
        "domain": domain,
        "iteration": iteration,
        "passed": passed,
        "model_used": model_used,
        "code_len": len(code),
        "test_summary": test_output[:400],
    }
    _append(SENJU_INBOX, event)

    if passed:
        pattern = {**event, "code": code}
        _append(SENJU_KNOWLEDGE, pattern)
        print(f"[senju] emitted SUCCESS pattern for {task_id}")
    else:
        print(f"[senju] emitted FAIL event for {task_id} iter={iteration}")


def emit_new_tasks(tasks: list[dict]):
    event = {
        "source": "codegen-task-generator",
        "event": "new_tasks",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "count": len(tasks),
        "tasks": [{"task_id": t["task_id"], "name": t["name"]} for t in tasks],
    }
    _append(SENJU_INBOX, event)


def update_status(stats: dict):
    total = len(stats)
    passing = sum(1 for v in stats.values() if v.get("successes", 0) > 0)
    attempts = sum(v.get("attempts", 0) for v in stats.values())
    _write_status({
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_tasks": total,
        "passing": passing,
        "pending": total - passing,
        "total_attempts": attempts,
        "success_rate": round(passing / max(total, 1), 3),
        "tasks": stats,
    })
    print(f"[senju] status updated: {passing}/{total} passing")


def read_senju_knowledge(domain: str | None = None, limit: int = 5) -> list[dict]:
    """Read successful patterns that OTHER AIs wrote to Senju."""
    if not SENJU_KNOWLEDGE.exists():
        return []
    results = []
    for line in reversed(SENJU_KNOWLEDGE.read_text().splitlines()):
        if not line.strip():
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        if domain and e.get("domain") != domain:
            continue
        results.append(e)
        if len(results) >= limit:
            break
    return results
