"""
Knowledge base — persistent store of what worked, what failed, and why.

All codegen iterations write here. Other agents read from here.
Format: NDJSON (one record per line) for easy streaming / grep / append.
"""

import json
import time
from pathlib import Path
from typing import Any

KB_DIR = Path(__file__).parents[1] / "knowledge"
PATTERNS_FILE = KB_DIR / "patterns.ndjson"
BROADCAST_FILE = KB_DIR / "broadcast.ndjson"
INDEX_FILE = KB_DIR / "index.json"


def _ensure():
    KB_DIR.mkdir(parents=True, exist_ok=True)


def record(
    task_id: str,
    task_name: str,
    iteration: int,
    passed: bool,
    code: str,
    test_output: str,
    domain: str = "general",
    language: str = "python",
    extra: dict | None = None,
) -> dict:
    """Append one generation attempt to the knowledge base."""
    _ensure()
    entry = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "task_id": task_id,
        "task_name": task_name,
        "domain": domain,
        "language": language,
        "iteration": iteration,
        "passed": passed,
        "code_len": len(code),
        "code": code,
        "test_output": test_output,
        **(extra or {}),
    }
    with PATTERNS_FILE.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    _update_index(task_id, passed)
    broadcast(entry)
    return entry


def broadcast(entry: dict):
    """Write to broadcast log — other agents poll this."""
    _ensure()
    slim = {k: v for k, v in entry.items() if k != "code"}
    with BROADCAST_FILE.open("a") as f:
        f.write(json.dumps(slim, ensure_ascii=False) + "\n")


def _update_index(task_id: str, passed: bool):
    _ensure()
    index = {}
    if INDEX_FILE.exists():
        index = json.loads(INDEX_FILE.read_text())
    rec = index.setdefault(task_id, {"attempts": 0, "successes": 0, "last_pass": None})
    rec["attempts"] += 1
    if passed:
        rec["successes"] += 1
        rec["last_pass"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    INDEX_FILE.write_text(json.dumps(index, indent=2, ensure_ascii=False))


def get_successful_patterns(domain: str | None = None, limit: int = 5) -> list[dict]:
    """Return recently successful code snippets for few-shot prompting."""
    if not PATTERNS_FILE.exists():
        return []
    results = []
    for line in reversed(PATTERNS_FILE.read_text().splitlines()):
        if not line.strip():
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        if not e.get("passed"):
            continue
        if domain and e.get("domain") != domain:
            continue
        results.append(e)
        if len(results) >= limit:
            break
    return results


def get_stats() -> dict[str, Any]:
    if not INDEX_FILE.exists():
        return {}
    return json.loads(INDEX_FILE.read_text())
