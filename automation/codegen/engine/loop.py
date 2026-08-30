"""
Enhanced autonomous loop with knowledge-base-informed prompting,
broadcaster integration, and aggressive retry with expanding context.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import anthropic

from . import knowledge_base as kb
from .broadcaster import push_result

ROOT = Path(__file__).resolve().parents[3]
TASKS_DIR = Path(__file__).parents[1] / "tasks"
RUNS_DIR = Path(__file__).parents[1] / "runs"


def load_task(task_id: str) -> dict[str, Any]:
    parts = task_id.split("/", 1)
    if len(parts) == 2:
        path = TASKS_DIR / parts[0] / f"{parts[1]}.json"
    else:
        path = TASKS_DIR / f"{task_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Task not found: {path}")
    return json.loads(path.read_text())


def build_prompt(task: dict, history: list[dict]) -> str:
    domain = task.get("domain", "general")
    exemplars = kb.get_successful_patterns(domain=domain, limit=3)

    parts = [
        f"# Code Generation Task: {task['name']}",
        f"\n## Domain: {domain}",
        f"\n## Goal\n{task['goal']}",
        f"\n## Output file\n`{task['output_file']}`",
        f"\n## Test command\n`{task['test_cmd']}`",
        f"\n## Constraints\n{task.get('constraints', 'None')}",
    ]

    if exemplars:
        parts.append("\n## Similar successful implementations (for reference)")
        for ex in exemplars:
            parts.append(
                f"\n### {ex['task_name']} (passed at iteration {ex['iteration']})"
                f"\n```python\n{ex['code'][:600]}\n```"
            )

    if history:
        parts.append(f"\n## Your previous {len(history)} attempt(s) — study the failures")
        for run in history[-5:]:
            parts.append(
                f"\n### Attempt {run['iteration']} — {'PASSED' if run['passed'] else 'FAILED'}"
                f"\n```python\n{run['code']}\n```"
                f"\n**Test output:**\n```\n{run['test_output'][:600]}\n```"
            )
        parts.append(
            "\n## Instructions\n"
            "Fix every issue you can identify from the failures above.\n"
            "Output ONLY raw Python code — no markdown, no explanation."
        )
    else:
        parts.append(
            "\n## Instructions\n"
            "Write a clean, correct implementation.\n"
            "Output ONLY raw Python code — no markdown, no explanation."
        )

    return "\n".join(parts)


def generate(task: dict, history: list[dict], client: anthropic.Anthropic) -> str:
    prompt = build_prompt(task, history)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    code = msg.content[0].text.strip()
    if code.startswith("```"):
        lines = code.splitlines()
        code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return code


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


def run_loop(task_id: str, max_iterations: int = 15) -> bool:
    task = load_task(task_id)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    output_path = ROOT / task["output_file"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    history = load_history(task_id)
    start = len(history) + 1
    domain = task.get("domain", "general")

    print(f"[loop] {task_id} iter {start}/{max_iterations} domain={domain}")

    for iteration in range(start, max_iterations + 1):
        print(f"\n[loop] === {task_id} iter {iteration} ===")
        code = generate(task, history, client)
        output_path.write_text(code)

        passed, test_output = run_tests(task["test_cmd"])
        print(f"[loop] {'PASS' if passed else 'FAIL'} | {test_output[:200]}")

        record = save_run(task_id, iteration, code, test_output, passed)
        history.append(record)

        kb.record(
            task_id=task_id, task_name=task["name"], iteration=iteration,
            passed=passed, code=code, test_output=test_output, domain=domain,
        )
        push_result(
            task_id=task_id, task_name=task["name"], domain=domain,
            iteration=iteration, passed=passed, code=code, test_output=test_output,
        )

        if passed:
            print(f"[loop] SUCCESS {task_id} at iteration {iteration}")
            return True

    print(f"[loop] EXHAUSTED {task_id} after {max_iterations} iterations")
    return False


if __name__ == "__main__":
    task_id = sys.argv[1] if len(sys.argv) > 1 else "example"
    max_iter = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    sys.exit(0 if run_loop(task_id, max_iter) else 1)
