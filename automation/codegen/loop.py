"""
Autonomous code generation loop.

Cycle: read task spec -> generate code -> run tests -> read results -> iterate.
Three logical agents can run independently against the same task catalog. Each
agent keeps isolated history under runs/<agent_id>/<task_id>/ and normally runs
on its own Git branch in GitHub Actions.
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
CODEGEN_DIR = Path(__file__).parent
TASKS_DIR = CODEGEN_DIR / "tasks"
RUNS_DIR = CODEGEN_DIR / "runs"
AGENTS_DIR = CODEGEN_DIR / "agents"
DEFAULT_AGENT_ID = "codegen-1"


def load_task(task_id: str) -> dict[str, Any]:
    path = TASKS_DIR / f"{task_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Task not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_agent(agent_id: str) -> dict[str, Any]:
    path = AGENTS_DIR / f"{agent_id}.json"
    if not path.exists():
        available = ", ".join(sorted(p.stem for p in AGENTS_DIR.glob("*.json")))
        raise FileNotFoundError(
            f"Agent not found: {path}. Available agents: {available or 'none'}"
        )
    agent = json.loads(path.read_text(encoding="utf-8"))
    agent.setdefault("id", agent_id)
    return agent


def build_prompt(task: dict, history: list[dict], agent: dict) -> str:
    parts = [
        f"# Agent\n{agent.get('name', agent['id'])} ({agent['id']})",
        f"\n## Operating style\n{agent.get('operating_style', 'Implement the task carefully and make the tests pass.')}",
        f"\n# Task: {task['name']}",
        f"\n## Goal\n{task['goal']}",
        f"\n## Output file\n`{task['output_file']}`",
        f"\n## Test command\n`{task['test_cmd']}`",
        f"\n## Constraints\n{task.get('constraints', 'None')}",
    ]

    if history:
        parts.append("\n## Previous attempt results (most recent last)")
        for run in history[-3:]:
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
            "Output ONLY the raw Python code - no markdown fences, no explanation."
        )
    else:
        parts.append(
            "\n## Instructions\n"
            "Write the implementation. "
            "Output ONLY the raw Python code - no markdown fences, no explanation."
        )

    return "\n".join(parts)


def generate_code(
    task: dict,
    history: list[dict],
    agent: dict,
    client: anthropic.Anthropic,
) -> str:
    prompt = build_prompt(task, history, agent)
    message = client.messages.create(
        model=os.getenv("CODEGEN_MODEL", "claude-sonnet-4-6"),
        max_tokens=int(os.getenv("CODEGEN_MAX_TOKENS", "4096")),
        messages=[{"role": "user", "content": prompt}],
    )
    code = message.content[0].text.strip()
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
        timeout=int(os.getenv("CODEGEN_TEST_TIMEOUT", "120")),
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def save_run(
    agent_id: str,
    task_id: str,
    iteration: int,
    code: str,
    test_output: str,
    passed: bool,
) -> dict:
    run_dir = RUNS_DIR / agent_id / task_id
    run_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "agent_id": agent_id,
        "task_id": task_id,
        "iteration": iteration,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "passed": passed,
        "code": code,
        "test_output": test_output,
    }
    (run_dir / f"iter_{iteration:03d}.json").write_text(
        json.dumps(record, indent=2), encoding="utf-8"
    )
    return record


def load_history(agent_id: str, task_id: str) -> list[dict]:
    run_dir = RUNS_DIR / agent_id / task_id
    if not run_dir.exists():
        return []
    records = []
    for file in sorted(run_dir.glob("iter_*.json")):
        records.append(json.loads(file.read_text(encoding="utf-8")))
    return records


def run_loop(task_id: str, max_iterations: int = 10, agent_id: str = DEFAULT_AGENT_ID) -> bool:
    task = load_task(task_id)
    agent = load_agent(agent_id)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    output_path = ROOT / task["output_file"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    history = load_history(agent_id, task_id)
    start_iter = len(history) + 1

    print(
        f"[codegen] agent={agent_id} task={task_id} "
        f"starting at iteration {start_iter}/{max_iterations}"
    )

    for iteration in range(start_iter, max_iterations + 1):
        print(f"\n[codegen] === {agent_id} / Iteration {iteration} ===")

        code = generate_code(task, history, agent, client)
        output_path.write_text(code, encoding="utf-8")
        print(f"[codegen] wrote {len(code)} chars to {task['output_file']}")

        passed, test_output = run_tests(task["test_cmd"], ROOT)
        print(f"[codegen] tests {'PASSED' if passed else 'FAILED'}")
        print(test_output[:800])

        record = save_run(agent_id, task_id, iteration, code, test_output, passed)
        history.append(record)

        if passed:
            print(f"\n[codegen] SUCCESS agent={agent_id} iteration={iteration}")
            return True

        if iteration < max_iterations:
            print("[codegen] retrying with feedback...")

    print(f"\n[codegen] FAILED agent={agent_id} after {max_iterations} iterations")
    return False


if __name__ == "__main__":
    task_id = sys.argv[1] if len(sys.argv) > 1 else "example"
    max_iter = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    agent_id = sys.argv[3] if len(sys.argv) > 3 else os.getenv("CODEGEN_AGENT_ID", DEFAULT_AGENT_ID)
    success = run_loop(task_id, max_iter, agent_id)
    sys.exit(0 if success else 1)
