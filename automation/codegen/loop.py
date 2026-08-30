"""
Autonomous code generation loop.

Cycle: read task spec → generate code → run tests → read results → iterate.
Each iteration writes to its own branch; results accumulate in runs/.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import anthropic

ROOT = Path(__file__).resolve().parents[2]
TASKS_DIR = Path(__file__).parent / "tasks"
RUNS_DIR = Path(__file__).parent / "runs"


def load_task(task_id: str) -> dict[str, Any]:
    path = TASKS_DIR / f"{task_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Task not found: {path}")
    return json.loads(path.read_text())


def build_prompt(task: dict, history: list[dict]) -> str:
    parts = [
        f"# Task: {task['name']}",
        f"\n## Goal\n{task['goal']}",
        f"\n## Output file\n`{task['output_file']}`",
        f"\n## Test command\n`{task['test_cmd']}`",
        f"\n## Constraints\n{task.get('constraints', 'None')}",
    ]

    if history:
        parts.append("\n## Previous attempt results (most recent last)")
        for run in history[-3:]:  # last 3 attempts
            parts.append(
                f"\n### Attempt {run['iteration']}"
                f"\n**Code written:**\n```python\n{run['code']}\n```"
                f"\n**Test output:**\n```\n{run['test_output']}\n```"
                f"\n**Passed:** {run['passed']}"
            )
        parts.append(
            "\n## Instructions\n"
            "Study the previous failures carefully. "
            "Write improved code that fixes the issues. "
            "Output ONLY the raw Python code — no markdown fences, no explanation."
        )
    else:
        parts.append(
            "\n## Instructions\n"
            "Write the implementation. "
            "Output ONLY the raw Python code — no markdown fences, no explanation."
        )

    return "\n".join(parts)


def generate_code(task: dict, history: list[dict], client: anthropic.Anthropic) -> str:
    prompt = build_prompt(task, history)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    code = message.content[0].text.strip()
    # Strip accidental markdown fences
    if code.startswith("```"):
        lines = code.splitlines()
        code = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return code


def run_tests(test_cmd: str, cwd: Path) -> tuple[bool, str]:
    result = subprocess.run(
        test_cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def save_run(task_id: str, iteration: int, code: str, test_output: str, passed: bool) -> dict:
    run_dir = RUNS_DIR / task_id
    run_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "task_id": task_id,
        "iteration": iteration,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "passed": passed,
        "code": code,
        "test_output": test_output,
    }
    (run_dir / f"iter_{iteration:03d}.json").write_text(json.dumps(record, indent=2))
    return record


def load_history(task_id: str) -> list[dict]:
    run_dir = RUNS_DIR / task_id
    if not run_dir.exists():
        return []
    records = []
    for f in sorted(run_dir.glob("iter_*.json")):
        records.append(json.loads(f.read_text()))
    return records


def run_loop(task_id: str, max_iterations: int = 10) -> bool:
    task = load_task(task_id)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    output_path = ROOT / task["output_file"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    history = load_history(task_id)
    start_iter = len(history) + 1

    print(f"[codegen] task={task_id} starting at iteration {start_iter}/{max_iterations}")

    for iteration in range(start_iter, max_iterations + 1):
        print(f"\n[codegen] === Iteration {iteration} ===")

        code = generate_code(task, history, client)
        output_path.write_text(code)
        print(f"[codegen] wrote {len(code)} chars to {task['output_file']}")

        passed, test_output = run_tests(task["test_cmd"], ROOT)
        print(f"[codegen] tests {'PASSED' if passed else 'FAILED'}")
        print(test_output[:800])

        record = save_run(task_id, iteration, code, test_output, passed)
        history.append(record)

        if passed:
            print(f"\n[codegen] SUCCESS at iteration {iteration}")
            return True

        if iteration < max_iterations:
            print("[codegen] retrying with feedback...")

    print(f"\n[codegen] FAILED after {max_iterations} iterations")
    return False


if __name__ == "__main__":
    task_id = sys.argv[1] if len(sys.argv) > 1 else "example"
    max_iter = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    success = run_loop(task_id, max_iter)
    sys.exit(0 if success else 1)
