"""
Autonomous generation loop — model-agnostic, Senju-integrated.

Works without Claude: uses GitHub Models (GITHUB_TOKEN) by default.
Control is intentionally loose — just run, record, share.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from . import knowledge_base as kb
from .broadcaster import push_result
from .model_client import get_client, strip_fences
from .senju_hub import emit_result, update_status

ROOT = Path(__file__).resolve().parents[3]
TASKS_DIR = Path(__file__).parents[1] / "tasks"
RUNS_DIR = Path(__file__).parents[1] / "runs"


def load_task(task_id: str) -> dict[str, Any]:
    parts = task_id.split("/", 1)
    path = (
        TASKS_DIR / parts[0] / f"{parts[1]}.json"
        if len(parts) == 2
        else TASKS_DIR / f"{task_id}.json"
    )
    if not path.exists():
        raise FileNotFoundError(f"Task not found: {path}")
    return json.loads(path.read_text())


def build_prompt(task: dict, history: list[dict]) -> str:
    domain = task.get("domain", "general")

    # Pull exemplars from local KB + Senju (cross-AI patterns)
    from .senju_hub import read_senju_knowledge
    local_exemplars = kb.get_successful_patterns(domain=domain, limit=2)
    senju_exemplars = read_senju_knowledge(domain=domain, limit=2)
    exemplars = (local_exemplars + senju_exemplars)[:3]

    parts = [
        f"# Programming Task: {task['name']}",
        f"Domain: {domain}",
        f"\n## Goal\n{task['goal']}",
        f"\n## Write to\n`{task['output_file']}`",
        f"\n## Validated by\n`{task['test_cmd']}`",
        f"\n## Constraints\n{task.get('constraints', 'None')}",
    ]

    if exemplars:
        parts.append("\n## Reference implementations (passed tests)")
        for ex in exemplars:
            src = ex.get("source", "local")
            parts.append(
                f"\n### {ex.get('task_name','?')} [{src}]\n"
                f"```python\n{ex.get('code','')[:500]}\n```"
            )

    if history:
        parts.append(f"\n## Previous {len(history)} attempt(s)")
        for run in history[-5:]:
            status = "PASSED" if run["passed"] else "FAILED"
            parts.append(
                f"\n### Attempt {run['iteration']}: {status}"
                f"\n```python\n{run['code']}\n```"
                f"\nTest output:\n```\n{run['test_output'][:500]}\n```"
            )
        parts.append(
            "\nFix the failures. Output ONLY raw Python. No markdown. No explanation."
        )
    else:
        parts.append(
            "\nWrite a correct implementation. Output ONLY raw Python. No markdown."
        )

    return "\n".join(parts)


def run_tests(test_cmd: str) -> tuple[bool, str]:
    result = subprocess.run(
        test_cmd, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=120
    )
    return result.returncode == 0, (result.stdout + result.stderr).strip()


def load_history(task_id: str) -> list[dict]:
    safe_id = task_id.replace("/", "_")
    run_dir = RUNS_DIR / safe_id
    if not run_dir.exists():
        return []
    return [json.loads(f.read_text()) for f in sorted(run_dir.glob("iter_*.json"))]


def save_run(task_id: str, iteration: int, code: str, output: str, passed: bool) -> dict:
    safe_id = task_id.replace("/", "_")
    run_dir = RUNS_DIR / safe_id
    run_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "task_id": task_id,
        "iteration": iteration,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "passed": passed,
        "code": code,
        "test_output": output,
    }
    (run_dir / f"iter_{iteration:03d}.json").write_text(json.dumps(record, indent=2))
    return record


STRATEGY_SHIFTS = [
    # (after N consecutive fails, inject this hint into prompt)
    (3,  "Try a completely different algorithm or data structure."),
    (6,  "Start from scratch. Ignore previous attempts. Use the simplest possible approach."),
    (10, "Use only Python standard library. No classes. Purely functional, step by step."),
]


def _strategy_hint(consecutive_fails: int) -> str:
    hint = ""
    for threshold, msg in reversed(STRATEGY_SHIFTS):
        if consecutive_fails >= threshold:
            hint = msg
            break
    return hint


def run_loop(task_id: str, max_iterations: int = 15) -> bool:
    task = load_task(task_id)
    client = get_client()
    model_name = type(client).__name__

    output_path = ROOT / task["output_file"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    history = load_history(task_id)
    start = len(history) + 1
    domain = task.get("domain", "general")
    consecutive_fails = sum(1 for r in reversed(history) if not r["passed"])

    print(f"[loop] {task_id} | model={model_name} | iter {start}/{max_iterations} | fails={consecutive_fails}")

    for iteration in range(start, max_iterations + 1):
        print(f"\n[loop] === {task_id} iter {iteration} ===")

        hint = _strategy_hint(consecutive_fails)
        if hint:
            print(f"[loop] strategy shift: {hint}")

        prompt = build_prompt(task, history)
        if hint:
            prompt += f"\n\n## Strategy directive\n{hint}"
        code = strip_fences(client.complete(prompt))
        output_path.write_text(code)

        passed, test_output = run_tests(task["test_cmd"])
        print(f"[loop] {'PASS' if passed else 'FAIL'} | {test_output[:180]}")

        record = save_run(task_id, iteration, code, test_output, passed)
        history.append(record)

        # Persist everywhere — no approval gate
        kb.record(task_id=task_id, task_name=task["name"], iteration=iteration,
                  passed=passed, code=code, test_output=test_output, domain=domain,
                  extra={"model": model_name})
        push_result(task_id=task_id, task_name=task["name"], domain=domain,
                    iteration=iteration, passed=passed, code=code, test_output=test_output)
        emit_result(task_id=task_id, task_name=task["name"], domain=domain,
                    iteration=iteration, passed=passed, code=code,
                    test_output=test_output, model_used=model_name)

        if passed:
            consecutive_fails = 0
            print(f"[loop] SUCCESS {task_id} at iteration {iteration}")
            update_status(kb.get_stats())
            return True
        else:
            consecutive_fails += 1

    print(f"[loop] EXHAUSTED {task_id} after {max_iterations} iterations")
    update_status(kb.get_stats())
    return False


if __name__ == "__main__":
    task_id = sys.argv[1] if len(sys.argv) > 1 else "example"
    max_iter = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    sys.exit(0 if run_loop(task_id, max_iter) else 1)
