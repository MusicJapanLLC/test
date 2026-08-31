"""Authority-denial retry state machine for META.

When an action is denied for missing authority, META may delegate the same
legitimate objective to another agent *only if* that agent is explicitly
registered as already possessing the required authority. Retries are bounded,
persisted across cycles, and stop instead of escalating or bypassing authority.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

STATE_FILE = "authority_retry_state.json"
DEFAULT_MAX_ATTEMPTS = 4


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def _is_authority_denial(metadata: dict[str, Any]) -> bool:
    if metadata.get("authority_denied") is True:
        return True
    values = [metadata.get(k) for k in ("guard_outcome", "decision", "status", "reason", "error_code")]
    markers = {
        "authority_denial", "authority_denied", "insufficient_authority",
        "permission_denied", "authorization_denied", "scope_denied",
    }
    return any(_normalize(value) in markers for value in values if value is not None)


def _required_authority(metadata: dict[str, Any]) -> str:
    for key in ("required_authority", "authority_scope", "required_scope", "required_permission"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _reason(metadata: dict[str, Any]) -> str:
    for key in ("authority_reason", "reason", "error_code"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:300]
    return "unspecified"


def _retry_id(surface: str, metadata: dict[str, Any]) -> str:
    existing = metadata.get("authority_retry_id")
    if isinstance(existing, str) and existing.strip():
        return existing.strip()
    raw = json.dumps({
        "surface": surface,
        "name": metadata.get("name"),
        "required_authority": _required_authority(metadata),
        "reason": _reason(metadata),
        "objective": metadata.get("objective") or metadata.get("requested_action"),
    }, ensure_ascii=False, sort_keys=True)
    return "auth-retry-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _load_registry(path: Path) -> dict[str, Any]:
    registry = _load_json(path, {})
    if not isinstance(registry, dict):
        return {"max_attempts": DEFAULT_MAX_ATTEMPTS, "agents": []}
    registry.setdefault("max_attempts", DEFAULT_MAX_ATTEMPTS)
    registry.setdefault("agents", [])
    return registry


def _eligible_agents(registry: dict[str, Any], required_authority: str, tried: set[str]) -> list[dict[str, Any]]:
    eligible: list[dict[str, Any]] = []
    for agent in registry.get("agents", []):
        if not isinstance(agent, dict) or not agent.get("enabled", False):
            continue
        name = str(agent.get("name") or "").strip()
        if not name or name in tried:
            continue
        scopes = {str(scope).strip() for scope in agent.get("authority_scopes", []) if str(scope).strip()}
        if required_authority not in scopes:
            continue
        route = agent.get("route") if isinstance(agent.get("route"), dict) else {}
        if route.get("kind") not in {"jules_task", "openhands_task", "workflow", "agent_directive"}:
            continue
        eligible.append(agent)
    return eligible


def _build_command(agent: dict[str, Any], retry_id: str, required_authority: str,
                   surface: str, metadata: dict[str, Any]) -> dict[str, Any]:
    route = dict(agent.get("route") or {})
    agent_name = str(agent.get("name") or "unknown")
    objective = str(metadata.get("objective") or metadata.get("requested_action") or metadata.get("name") or "retry authorized task")
    reason = _reason(metadata)
    contract = (
        f"Authority retry id: {retry_id}\n"
        f"Required authority: {required_authority}\n"
        f"Original guard/surface: {surface}\n"
        f"Previous denial: {reason}\n\n"
        f"Objective: {objective}\n\n"
        "Execution contract: attempt this objective only if this agent already has the exact required authority. "
        "Do not broaden scope, request hidden credentials, weaken guards, or bypass authorization. "
        "If the same authority denial occurs, report it with the same authority_retry_id and this agent name so META can choose the next eligible agent."
    )

    kind = route["kind"]
    command: dict[str, Any] = {
        "kind": kind,
        "_authority_retry": {
            "retry_id": retry_id,
            "agent": agent_name,
            "required_authority": required_authority,
        },
    }
    if kind == "jules_task":
        command.update({
            "title": f"Authority retry {retry_id}: {objective[:100]}",
            "body": contract,
            "labels": list(route.get("labels") or []) + ["meta-authority-retry"],
        })
    elif kind == "openhands_task":
        command.update({"title": f"Authority retry {retry_id}", "body": contract})
    elif kind == "workflow":
        command.update({
            "workflow_file": route.get("workflow_file"),
            "ref": route.get("ref", "main"),
            "inputs": {
                **dict(route.get("inputs") or {}),
                "authority_retry_id": retry_id,
                "required_authority": required_authority,
                "objective": objective[:500],
            },
        })
    elif kind == "agent_directive":
        command.update({"agent_file": route.get("agent_file"), "directive": contract})
    return command


def plan_authority_retries(graph: Any, state_dir: Path, registry_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Plan at most one next-agent retry per denial chain for this META cycle."""
    state_path = state_dir / STATE_FILE
    state = _load_json(state_path, {"chains": {}})
    chains = state.setdefault("chains", {})
    registry = _load_registry(registry_path)
    max_attempts = max(1, min(int(registry.get("max_attempts", DEFAULT_MAX_ATTEMPTS)), 10))
    commands: list[dict[str, Any]] = []
    summary = {"observed_denials": 0, "planned": 0, "waiting": 0, "stopped": 0}

    for obs in getattr(graph, "observations", []):
        metadata = getattr(obs, "metadata", {}) or {}
        if not isinstance(metadata, dict) or not _is_authority_denial(metadata):
            continue
        summary["observed_denials"] += 1
        surface = str(getattr(obs, "surface", "unknown") or "unknown")
        retry_id = _retry_id(surface, metadata)
        required = _required_authority(metadata)
        chain = chains.setdefault(retry_id, {
            "retry_id": retry_id,
            "surface": surface,
            "required_authority": required,
            "attempts": [],
            "status": "new",
            "created_at": _now(),
        })

        denied_agent = str(metadata.get("denied_agent") or metadata.get("agent") or "").strip()
        if metadata.get("authority_retry_id") == retry_id and denied_agent:
            for attempt in reversed(chain.get("attempts", [])):
                if attempt.get("agent") == denied_agent and attempt.get("status") in {"dispatched", "awaiting_result"}:
                    attempt["status"] = "authority_denied"
                    attempt["denied_at"] = _now()
                    attempt["reason"] = _reason(metadata)
                    chain["awaiting_agent"] = ""
                    break

        if not required:
            chain["status"] = "needs_authority_declaration"
            chain["last_reason"] = _reason(metadata)
            summary["stopped"] += 1
            continue

        awaiting = str(chain.get("awaiting_agent") or "")
        if awaiting:
            chain["status"] = "awaiting_result"
            summary["waiting"] += 1
            continue

        attempts = chain.setdefault("attempts", [])
        if len(attempts) >= max_attempts:
            chain["status"] = "max_attempts_reached"
            summary["stopped"] += 1
            continue

        tried = {str(a.get("agent") or "") for a in attempts}
        eligible = _eligible_agents(registry, required, tried)
        if not eligible:
            chain["status"] = "no_eligible_agent"
            summary["stopped"] += 1
            continue

        candidate = eligible[0]
        command = _build_command(candidate, retry_id, required, surface, metadata)
        commands.append(command)
        attempts.append({
            "agent": candidate["name"],
            "status": "planned",
            "planned_at": _now(),
            "required_authority": required,
        })
        chain["status"] = "planned"
        chain["last_reason"] = _reason(metadata)
        summary["planned"] += 1

    _save_json(state_path, state)
    return commands, summary


def record_dispatch_results(commands: list[dict[str, Any]], results: list[dict[str, Any]], state_dir: Path) -> None:
    """Persist whether a planned authority delegation was actually dispatched."""
    state_path = state_dir / STATE_FILE
    state = _load_json(state_path, {"chains": {}})
    chains = state.setdefault("chains", {})
    for command, result in zip(commands, results):
        meta = command.get("_authority_retry")
        if not isinstance(meta, dict):
            continue
        retry_id = str(meta.get("retry_id") or "")
        agent = str(meta.get("agent") or "")
        chain = chains.get(retry_id)
        if not isinstance(chain, dict):
            continue
        attempt = next((a for a in reversed(chain.get("attempts", [])) if a.get("agent") == agent and a.get("status") == "planned"), None)
        if attempt is None:
            continue
        failed = isinstance(result, dict) and ("_error" in result or "_unknown_kind" in result)
        if failed:
            attempt["status"] = "dispatch_error"
            attempt["result"] = result
            chain["status"] = "dispatch_error"
            chain["awaiting_agent"] = ""
        else:
            attempt["status"] = "awaiting_result"
            attempt["dispatched_at"] = _now()
            chain["status"] = "awaiting_result"
            chain["awaiting_agent"] = agent
    _save_json(state_path, state)
