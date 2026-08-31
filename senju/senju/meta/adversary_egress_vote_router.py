"""Materialize advisory-vote solicitations for adversary external-host requests.

The router turns each live promotion request into one deterministic pending task per
configured Agent. It does not cast votes or authorize the target; it only makes the
cross-Agent permission request explicit and durable.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable

SOLICITATION_SCHEMA = "senju-adversary-egress-vote-solicitations/v1"
DEFAULT_AGENTS = ("META", "X", "SENJU", "CHILD")


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _task_id(request_id: str, agent: str) -> str:
    raw = f"{request_id}|{agent}".encode("utf-8")
    return f"egress-vote:{hashlib.sha256(raw).hexdigest()[:24]}"


def route_pending_vote_requests(
    state_dir: str | Path,
    *,
    agents: Iterable[str] = DEFAULT_AGENTS,
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)
    requests = _load(state / "adversary_external_host_requests.json", {})
    request_rows = requests.get("requests", []) if isinstance(requests, dict) else []
    votes = _load(state / "adversary_external_host_votes.json", {})
    vote_rows = votes.get("votes", []) if isinstance(votes, dict) else []

    normalized_agents = tuple(sorted({str(agent).strip().upper() for agent in agents if str(agent).strip()}))
    latest_votes = {
        (str(row.get("request_id", "")), str(row.get("agent", "")).upper())
        for row in vote_rows if isinstance(row, dict)
    } if isinstance(vote_rows, list) else set()

    tasks: list[dict[str, Any]] = []
    if isinstance(request_rows, list):
        for request in request_rows:
            if not isinstance(request, dict):
                continue
            request_id = str(request.get("request_id", "")).strip()
            host = str(request.get("host", "")).strip().lower()
            url = str(request.get("url", "")).strip()
            reason = str(request.get("reason", "")).strip()[:500]
            try:
                expires_at = int(request.get("expires_at", 0))
            except (TypeError, ValueError):
                continue
            if not request_id or not host or not url or expires_at <= current:
                continue
            for agent in normalized_agents:
                already_voted = (request_id, agent) in latest_votes
                tasks.append({
                    "schema": SOLICITATION_SCHEMA,
                    "task_id": _task_id(request_id, agent),
                    "request_id": request_id,
                    "agent": agent,
                    "status": "completed" if already_voted else "pending",
                    "question": "Should this exact external HTTPS host receive the requested temporary read-only adversary scan/probe authority?",
                    "host": host,
                    "url": url,
                    "reason": reason,
                    "requested_capabilities": list(request.get("capabilities", [])),
                    "requested_methods": list(request.get("methods", [])),
                    "allowed_responses": ["allow", "deny", "abstain", "hard_deny"],
                    "expires_at": expires_at,
                })

    tasks.sort(key=lambda row: (str(row["request_id"]), str(row["agent"])))
    payload = {
        "schema": SOLICITATION_SCHEMA,
        "generated_at": current,
        "task_count": len(tasks),
        "pending_count": sum(1 for task in tasks if task["status"] == "pending"),
        "tasks": tasks,
    }
    state.mkdir(parents=True, exist_ok=True)
    (state / "adversary_external_host_vote_solicitations.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return payload
