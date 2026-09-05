"""Knowledge base for X task stats and successful patterns.

Persists task execution history to a JSON file so runs accumulate across cycles.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[3]
_STATE_PATH = _ROOT / "automation" / "codegen" / "meta_state" / "knowledge_base.json"

_SCHEMA = "x-knowledge-base/v1"


def _load() -> dict[str, Any]:
    try:
        raw = json.loads(_STATE_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict) and raw.get("schema") == _SCHEMA:
            return raw
    except (OSError, json.JSONDecodeError, ValueError):
        pass
    return {"schema": _SCHEMA, "tasks": {}, "patterns": []}


def _save(db: dict[str, Any]) -> None:
    _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _STATE_PATH.write_text(
        json.dumps(db, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def get_stats() -> dict[str, dict[str, Any]]:
    """Return {task_id: {successes, attempts, last_attempt}} for all tracked tasks."""
    db = _load()
    return dict(db.get("tasks") or {})


def record_result(task_id: str, *, passed: bool, code: str = "", domain: str = "") -> None:
    """Record the outcome of a task run and persist it."""
    db = _load()
    tasks: dict[str, Any] = db.setdefault("tasks", {})
    entry = tasks.setdefault(task_id, {"successes": 0, "attempts": 0, "last_attempt": 0.0})
    entry["attempts"] = int(entry.get("attempts", 0)) + 1
    entry["last_attempt"] = time.time()
    if passed:
        entry["successes"] = int(entry.get("successes", 0)) + 1
        if code:
            patterns: list[Any] = db.setdefault("patterns", [])
            patterns.append(
                {
                    "task_name": task_id,
                    "domain": domain or "unknown",
                    "code": code[:2000],
                    "recorded_at": time.time(),
                }
            )
            db["patterns"] = patterns[-500:]
    _save(db)


def get_successful_patterns(limit: int = 10) -> list[dict[str, Any]]:
    """Return the most recent successful task patterns."""
    db = _load()
    patterns: list[Any] = db.get("patterns") or []
    patterns.sort(key=lambda p: p.get("recorded_at", 0), reverse=True)
    return patterns[:max(1, limit)]
