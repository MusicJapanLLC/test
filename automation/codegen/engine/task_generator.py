"""
Meta-loop: AI generates NEW tasks autonomously.

Reads the knowledge base, finds gaps, and creates new task specs
without human input. The more it runs, the more tasks it creates.
"""

import json
import os
import time
from pathlib import Path

import anthropic

from . import knowledge_base as kb

TASKS_DIR = Path(__file__).parents[1] / "tasks"
GENERATED_TASKS_DIR = TASKS_DIR / "auto"
TESTS_DIR = Path(__file__).parents[1] / "tests"

DOMAINS = [
    "algorithms", "data_structures", "text_processing", "math",
    "file_io", "networking", "parsing", "compression", "encoding", "validation",
]

META_PROMPT = """You are an autonomous software task generator.

Your job: invent NEW programming tasks that a code-generation AI can attempt.
Each task must be:
- Testable with pytest (specific inputs -> specific outputs)
- Solvable in one Python file
- Harder or different from what has been attempted before

Already attempted tasks:
{attempted}

Knowledge base stats (domain -> attempts):
{stats}

Generate {count} NEW task specs. Output ONLY a JSON array, no explanation:

[
  {{
    "name": "Short descriptive name",
    "domain": "one of: {domains}",
    "goal": "Detailed description of what to implement. Include function signatures.",
    "output_file": "automation/codegen/generated/auto/<snake_case_name>.py",
    "test_template": "complete pytest file content that tests the module",
    "constraints": "Performance or style constraints."
  }},
  ...
]
"""


def generate_new_tasks(count: int = 5) -> list[dict]:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    stats = kb.get_stats()
    attempted = list(stats.keys()) if stats else ["example"]

    prompt = META_PROMPT.format(
        attempted=json.dumps(attempted, ensure_ascii=False),
        stats=json.dumps({k: v["attempts"] for k, v in stats.items()}, ensure_ascii=False),
        count=count,
        domains=", ".join(DOMAINS),
    )

    msg = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"]).messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    specs = json.loads(raw)
    return _save_tasks(specs)


def _save_tasks(specs: list[dict]) -> list[dict]:
    GENERATED_TASKS_DIR.mkdir(parents=True, exist_ok=True)
    TESTS_DIR.mkdir(parents=True, exist_ok=True)
    saved = []

    for spec in specs:
        name_part = Path(spec["output_file"]).stem
        task_id = f"auto/{name_part}"
        task_path = GENERATED_TASKS_DIR / f"{name_part}.json"
        test_path = TESTS_DIR / f"test_{name_part}.py"

        task_spec = {
            "name": spec["name"],
            "domain": spec.get("domain", "general"),
            "goal": spec["goal"],
            "output_file": spec["output_file"],
            "test_cmd": f"python -m pytest automation/codegen/tests/test_{name_part}.py -v",
            "constraints": spec.get("constraints", ""),
            "auto_generated": True,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        task_path.write_text(json.dumps(task_spec, indent=2, ensure_ascii=False))
        test_path.write_text(spec.get("test_template", _default_test(name_part, spec)))

        saved.append({"task_id": task_id, "name": spec["name"], "path": str(task_path)})
        print(f"[task-gen] created: {task_id} ({spec['name']})")

    return saved


def _default_test(name: str, spec: dict) -> str:
    return f'''"""Auto-generated tests for {name}."""
import importlib.util
from pathlib import Path


def load_module():
    path = Path(__file__).parents[3] / "{spec['output_file']}"
    spec_ = importlib.util.spec_from_file_location("{name}", path)
    mod = importlib.util.module_from_spec(spec_)
    spec_.loader.exec_module(mod)
    return mod


def test_module_loads():
    m = load_module()
    assert m is not None


def test_has_public_functions():
    m = load_module()
    callables = [x for x in dir(m) if not x.startswith("_") and callable(getattr(m, x))]
    assert len(callables) > 0
'''
