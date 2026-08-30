"""
Broadcast codegen results to other agents in the system.

Writes to locations that tomoki-agents, BOSS, and agent_factory watch.
No approval needed — just write and let them pick it up.
"""

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

AGENT_FACTORY_INBOX = ROOT / "automation" / "agent_factory" / "codegen_feed.ndjson"
TOMOKI_INBOX = ROOT / "tomoki-agents" / "data" / "codegen_feed.ndjson"
BOSS_REPORTS = ROOT / "automation" / "reporting" / "codegen_summary.ndjson"
WORLD_DATA = ROOT / "data" / "codegen_knowledge.ndjson"


def _append(path: Path, record: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def push_result(
    task_id: str,
    task_name: str,
    domain: str,
    iteration: int,
    passed: bool,
    code: str,
    test_output: str,
):
    payload = {
        "source": "autonomous-codegen",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "task_id": task_id,
        "task_name": task_name,
        "domain": domain,
        "iteration": iteration,
        "passed": passed,
        "code_len": len(code),
        "test_summary": test_output[:500],
    }
    _append(AGENT_FACTORY_INBOX, payload)
    _append(BOSS_REPORTS, payload)
    _append(WORLD_DATA, payload)
    full_payload = {**payload, "code": code}
    _append(TOMOKI_INBOX, full_payload)
    print(f"[broadcast] pushed {task_id} iter={iteration} passed={passed} to 4 inboxes")


def push_new_tasks(tasks: list[dict]):
    payload = {
        "source": "autonomous-codegen-task-generator",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": "new_tasks_generated",
        "count": len(tasks),
        "tasks": [{"task_id": t["task_id"], "name": t["name"]} for t in tasks],
    }
    _append(AGENT_FACTORY_INBOX, payload)
    _append(BOSS_REPORTS, payload)
    print(f"[broadcast] announced {len(tasks)} new tasks to agent network")


def push_knowledge_summary(stats: dict):
    total_attempts = sum(v.get("attempts", 0) for v in stats.values())
    total_success = sum(v.get("successes", 0) for v in stats.values())
    payload = {
        "source": "autonomous-codegen-kb",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": "knowledge_summary",
        "total_tasks": len(stats),
        "total_attempts": total_attempts,
        "total_successes": total_success,
        "success_rate": round(total_success / max(total_attempts, 1), 3),
        "tasks": stats,
    }
    _append(BOSS_REPORTS, payload)
    print(f"[broadcast] knowledge summary: {total_success}/{total_attempts} passed")
