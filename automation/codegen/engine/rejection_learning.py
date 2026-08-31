"""Rejection learning for the META/codegen loop.

Rejections are treated as structured feedback: classify why the attempt was
rejected, persist the signal, and feed a safer next-step strategy into later
iterations. This module intentionally does not generate or reward safeguard
bypass tactics.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

CODEGEN_DIR = Path(__file__).resolve().parents[1]
STATE_DIR = CODEGEN_DIR / "meta_state"
REJECTIONS_FILE = STATE_DIR / "rejections.ndjson"
PROFILE_FILE = STATE_DIR / "rejection_profile.json"

_POLICY_MARKERS = (
    "i can't help with",
    "i cannot help with",
    "i can’t help with",
    "i'm unable to assist",
    "i’m unable to assist",
    "cannot assist with",
    "can't assist with",
    "not able to help with",
    "i must refuse",
    "できません",
    "お手伝いできません",
    "対応できません",
    "拒否します",
)

_CATEGORY_HINTS = {
    "policy": (
        "Treat the rejection as a boundary signal. Preserve the legitimate goal, "
        "but reformulate the next attempt toward benign, defensive, authorized, "
        "or sandboxed work. Do not try to evade or weaken safeguards."
    ),
    "permission": (
        "Reduce scope to resources that are explicitly authorized, or surface the "
        "missing permission as a prerequisite instead of forcing the action."
    ),
    "auth": (
        "Treat this as a configuration problem: verify required credentials or "
        "environment variables and avoid changing task intent."
    ),
    "rate_limit": (
        "Use bounded backoff/retry behavior and reduce request pressure; do not "
        "change the task in order to bypass service controls."
    ),
    "validation": (
        "Repair the request shape, schema, types, or required fields while keeping "
        "the original allowed objective unchanged."
    ),
    "unknown": (
        "Capture the rejection evidence, make the next attempt smaller and clearer, "
        "and prefer an allowed/authorized alternative rather than bypass behavior."
    ),
}


def _ensure() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def classify_rejection(text: str) -> str | None:
    """Return a rejection category when *text* looks like a refusal/error signal."""
    if not text:
        return None

    lowered = text.strip().lower()
    head = lowered[:1200]

    if any(marker in head for marker in _POLICY_MARKERS):
        return "policy"
    if any(marker in head for marker in ("403", "forbidden", "permission denied", "not authorized")):
        return "permission"
    if any(marker in head for marker in ("401", "unauthorized", "invalid api key", "authentication")):
        return "auth"
    if any(marker in head for marker in ("429", "rate limit", "too many requests")):
        return "rate_limit"
    if any(marker in head for marker in ("400", "invalid request", "validation error", "required field")):
        return "validation"
    return None


def strategy_for(category: str) -> str:
    return _CATEGORY_HINTS.get(category, _CATEGORY_HINTS["unknown"])


def record_rejection(
    *,
    task_id: str,
    agent_id: str,
    category: str,
    evidence: str,
    source: str = "model",
) -> dict[str, Any]:
    """Persist one rejection and update the aggregate learning profile."""
    _ensure()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    record = {
        "ts": now,
        "task_id": task_id,
        "agent_id": agent_id,
        "category": category,
        "source": source,
        "evidence": evidence.strip()[:1200],
        "next_strategy": strategy_for(category),
    }
    with REJECTIONS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    profile: dict[str, Any] = {"total": 0, "categories": {}, "tasks": {}}
    if PROFILE_FILE.exists():
        try:
            profile = json.loads(PROFILE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

    profile["total"] = int(profile.get("total", 0)) + 1
    categories = profile.setdefault("categories", {})
    categories[category] = int(categories.get(category, 0)) + 1

    tasks = profile.setdefault("tasks", {})
    task = tasks.setdefault(task_id, {"count": 0, "categories": {}})
    task["count"] = int(task.get("count", 0)) + 1
    task_categories = task.setdefault("categories", {})
    task_categories[category] = int(task_categories.get(category, 0)) + 1
    task["last_seen"] = now
    task["next_strategy"] = strategy_for(category)

    profile["last_seen"] = now
    PROFILE_FILE.write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")
    return record


def observe_model_response(task_id: str, agent_id: str, text: str) -> dict[str, Any] | None:
    """Classify and learn from a model response when it is a rejection."""
    category = classify_rejection(text)
    if category is None:
        return None
    return record_rejection(
        task_id=task_id,
        agent_id=agent_id,
        category=category,
        evidence=text,
        source="model_response",
    )


def learning_hint(task_id: str | None = None) -> str:
    """Return a compact learned hint for future META/codegen attempts."""
    if not PROFILE_FILE.exists():
        return ""
    try:
        profile = json.loads(PROFILE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return ""

    if task_id:
        task = profile.get("tasks", {}).get(task_id)
        if task:
            strategy = task.get("next_strategy", "")
            if strategy:
                return f"Previous rejection learning for this task: {strategy}"

    categories = profile.get("categories", {})
    if not categories:
        return ""
    top = max(categories, key=categories.get)
    return f"META rejection learning ({top} dominant): {strategy_for(top)}"
