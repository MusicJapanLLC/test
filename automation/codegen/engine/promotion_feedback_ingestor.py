"""Ingest Promotion Corps feedback into the shared Root negotiation memory.

This module is coordination-only. It reads the Promotion Corps feedback/intelligence
files from the shared authority collaboration cache and folds them into the existing
opportunity queue, peer feed, and Owner-scope signal surface so META/X/SENJU and the
other negotiation participants work from the same current host state.

It never grants Authority, changes standing authorization, creates credentials, or
turns an execution-ready lease into broader Root authority.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "the-world-promotion-feedback-ingestor/v1"
QUEUE_SCHEMA = "the-world-authority-opportunity-queue/v1"
PEER_SCHEMA = "the-world-root-negotiation-peer-feed/v2"
SIGNAL_SCHEMA = "senju-owner-scope-negotiation-signals/v1"
COLLABORATORS = ("META", "X", "SENJU", "PR-ARMY", "CHILD", "AI")
MAX_QUEUE = 2048
MAX_PEER_TASKS = 4096
MAX_SIGNALS = 2048


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: object) -> str | None:
    host = str(value or "").strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@*"):
        return None
    return host


def _as_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value] if value.strip() else []
    if not isinstance(value, (list, tuple, set, frozenset)):
        return []
    return [str(v) for v in value if str(v).strip()]


def _intelligence_by_host(state: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(state / "promotion_corps_intelligence_snapshot.json", {})
    rows = doc.get("hosts", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, Mapping[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host:
            out[host] = raw
    return out


def _feedback_by_host(state: Path) -> dict[str, list[Mapping[str, Any]]]:
    doc = _load(state / "promotion_corps_feedback_outbox.json", {})
    rows = doc.get("tasks", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, list[Mapping[str, Any]]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host:
            out.setdefault(host, []).append(raw)
    return out


def _execution_by_host(state: Path) -> dict[str, Mapping[str, Any]]:
    doc = _load(state / "promotion_corps_execution_feed.json", {})
    rows = doc.get("records", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, Mapping[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host:
            out[host] = raw
    return out


def _update_queue(
    state: Path,
    feedback: Mapping[str, list[Mapping[str, Any]]],
    intelligence: Mapping[str, Mapping[str, Any]],
    execution: Mapping[str, Mapping[str, Any]],
    *,
    now: int,
) -> tuple[int, int]:
    path = state / "authority_opportunity_queue.json"
    doc = _load(path, {})
    rows = doc.get("opportunities", ()) if isinstance(doc, Mapping) else ()
    by_host: dict[str, dict[str, Any]] = {}
    if isinstance(rows, list):
        for raw in rows:
            if not isinstance(raw, Mapping):
                continue
            host = _host(raw.get("host"))
            if host:
                by_host[host] = dict(raw)

    pending_shared = 0
    execution_annotated = 0
    for host, tasks in feedback.items():
        if not tasks:
            continue
        sample = max(tasks, key=lambda row: int(row.get("coordination_priority", 0) or 0))
        missing = sorted({item for task in tasks for item in _as_list(task.get("missing_requirements"))})
        if "terminal_stop" in missing:
            current = by_host.get(host)
            if current is not None:
                current["promotion_terminal_stop"] = True
                current["promotion_status"] = sample.get("promotion_status")
                current["promotion_feedback_seen_at"] = now
            continue
        current = by_host.get(host, {})
        if current.get("hard_deny") is True or current.get("revoked") is True:
            continue
        context = intelligence.get(host, {})
        try:
            old_priority = int(current.get("priority", 0) or 0)
        except (TypeError, ValueError):
            old_priority = 0
        priority = max(old_priority, int(sample.get("coordination_priority", 0) or 0), 70)
        reasons = _as_list(context.get("reasons"))
        mission = str(sample.get("mission") or "Promotion Corps feedback")
        current.update({
            "host": host,
            "reason": str(current.get("reason") or (reasons[0] if reasons else mission))[:400],
            "priority": max(1, min(priority, 100)),
            "source": str(current.get("source") or "promotion_corps_feedback"),
            "proposal_only": True,
            "authority_effect": "none",
            "promotion_feedback_seen": True,
            "promotion_feedback_seen_at": now,
            "promotion_status": sample.get("promotion_status"),
            "promotion_coordination_priority": int(sample.get("coordination_priority", 0) or 0),
            "promotion_missing_requirements": missing,
            "promotion_negotiation_source_count": int(context.get("source_channels") and len(context.get("source_channels", ())) or 0),
            "promotion_root_submission_count": int(context.get("root_submission_count", 0) or 0),
            "promotion_shared_with": list(COLLABORATORS),
            "promotion_feedback_file": "promotion_corps_feedback_outbox.json",
        })
        by_host[host] = current
        pending_shared += 1

    for host, row in execution.items():
        current = by_host.get(host)
        if current is None:
            continue
        current.update({
            "promotion_execution_ready": True,
            "promotion_status": row.get("status"),
            "standing_authorization_reference": row.get("standing_authorization_reference"),
            "promotion_covered_methods": _as_list(row.get("covered_methods")),
            "suppress_duplicate_authority_submission_for_covered_scope": True,
            "promotion_feedback_seen_at": now,
        })
        execution_annotated += 1

    ordered = sorted(
        by_host.values(),
        key=lambda row: (-int(row.get("priority", 0) or 0), str(row.get("host", ""))),
    )[:MAX_QUEUE]
    _write(path, {
        "schema": str(doc.get("schema") or QUEUE_SCHEMA) if isinstance(doc, Mapping) else QUEUE_SCHEMA,
        "generated_at": now,
        "producer": "authority_collaboration_bus+negotiation_submission_accelerator+promotion_feedback_ingestor",
        "proposal_only": True,
        "authority_activated": False,
        "external_side_effects": False,
        "opportunities": ordered,
        "opportunity_count": len(ordered),
    })
    return pending_shared, execution_annotated


def _update_peer_feed(
    state: Path,
    feedback: Mapping[str, list[Mapping[str, Any]]],
    execution: Mapping[str, Mapping[str, Any]],
    *,
    now: int,
) -> int:
    path = state / "root_negotiation_peer_feed.json"
    doc = _load(path, {})
    rows = doc.get("tasks", ()) if isinstance(doc, Mapping) else ()
    by_id: dict[str, dict[str, Any]] = {}
    if isinstance(rows, list):
        for raw in rows:
            if isinstance(raw, Mapping) and raw.get("task_id"):
                by_id[str(raw["task_id"])] = dict(raw)

    added = 0
    for host, tasks in feedback.items():
        for raw in tasks:
            actor = str(raw.get("actor") or "").strip().upper()
            if actor not in COLLABORATORS:
                continue
            task_id = f"promotion-sync:{host}:{raw.get('proposal_id')}:{actor.lower()}"
            by_id[task_id] = {
                "task_id": task_id,
                "actor": actor,
                "host": host,
                "proposal_id": raw.get("proposal_id"),
                "mission": raw.get("mission"),
                "promotion_status": raw.get("promotion_status"),
                "coordination_priority": int(raw.get("coordination_priority", 0) or 0),
                "missing_requirements": _as_list(raw.get("missing_requirements")),
                "approval_submission_is_goal": "terminal_stop" not in _as_list(raw.get("missing_requirements")),
                "collect_fresh_independent_evidence": bool(raw.get("collect_fresh_independent_evidence")),
                "share_with_promotion_corps": True,
                "share_across_pr_agents": True,
                "source": "promotion_corps_feedback",
                "authority_effect": "none",
            }
            added += 1

    for host, raw in execution.items():
        for actor in COLLABORATORS:
            task_id = f"promotion-execution-sync:{host}:{actor.lower()}"
            by_id[task_id] = {
                "task_id": task_id,
                "actor": actor,
                "host": host,
                "mission": "consume execution-ready standing-authorized handoff and stop duplicate Root approval work for the identical covered scope",
                "promotion_status": raw.get("status"),
                "covered_methods": _as_list(raw.get("covered_methods")),
                "standing_authorization_reference": raw.get("standing_authorization_reference"),
                "approval_submission_is_goal": False,
                "suppress_duplicate_authority_submission_for_covered_scope": True,
                "share_with_promotion_corps": True,
                "share_across_pr_agents": True,
                "source": "promotion_corps_execution_feed",
                "authority_effect": "existing_standing_authorization_lease",
                "scope_expanded": False,
            }
            added += 1

    tasks = sorted(
        by_id.values(),
        key=lambda row: (-int(row.get("coordination_priority", 0) or 0), str(row.get("host", "")), str(row.get("actor", ""))),
    )[:MAX_PEER_TASKS]
    _write(path, {
        "schema": PEER_SCHEMA,
        "generated_at": now,
        "collaborators": list(COLLABORATORS),
        "task_count": len(tasks),
        "tasks": tasks,
        "goal": "shared negotiation memory with Promotion Corps feedback and execution state",
        "authority_effect": "none",
    })
    return added


def _update_owner_scope_signals(
    state: Path,
    feedback: Mapping[str, list[Mapping[str, Any]]],
    intelligence: Mapping[str, Mapping[str, Any]],
    *,
    now: int,
) -> int:
    path = state / "owner_scope_negotiation_signals.json"
    doc = _load(path, {})
    rows = doc.get("signals", ()) if isinstance(doc, Mapping) else ()
    by_id: dict[str, dict[str, Any]] = {}
    if isinstance(rows, list):
        for raw in rows:
            if isinstance(raw, Mapping):
                signal_id = str(raw.get("signal_id") or "").strip()
                if signal_id:
                    by_id[signal_id] = dict(raw)

    added = 0
    for host, tasks in feedback.items():
        if not tasks:
            continue
        missing = sorted({item for task in tasks for item in _as_list(task.get("missing_requirements"))})
        if "terminal_stop" in missing:
            continue
        sample = max(tasks, key=lambda row: int(row.get("coordination_priority", 0) or 0))
        context = intelligence.get(host, {})
        signal_id = f"promotion-feedback:{host}"
        by_id[signal_id] = {
            "signal_id": signal_id,
            "host": host,
            "requested_methods": _as_list(context.get("requested_methods")) or ["GET", "HEAD", "OPTIONS"],
            "reason": str(sample.get("mission") or "Promotion Corps requests synchronized negotiation follow-up")[:400],
            "source": "promotion_feedback_ingestor",
            "source_ref": sample.get("proposal_id"),
            "priority": int(sample.get("coordination_priority", 0) or 0),
            "missing_requirements": missing,
            "generated_at": now,
            "authority_effect": "none",
        }
        added += 1

    signals = sorted(by_id.values(), key=lambda row: (-int(row.get("priority", 0) or 0), str(row.get("host", ""))))[:MAX_SIGNALS]
    _write(path, {"schema": SIGNAL_SCHEMA, "generated_at": now, "signals": signals})
    return added


def run_promotion_feedback_ingestor(state_dir: str | Path, *, now: int | None = None) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    feedback = _feedback_by_host(state)
    intelligence = _intelligence_by_host(state)
    execution = _execution_by_host(state)

    shared, execution_annotated = _update_queue(state, feedback, intelligence, execution, now=current)
    peer_added = _update_peer_feed(state, feedback, execution, now=current)
    signal_added = _update_owner_scope_signals(state, feedback, intelligence, now=current)

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "production": True,
        "promotion_feedback_host_count": len(feedback),
        "promotion_execution_host_count": len(execution),
        "shared_opportunity_count": shared,
        "execution_queue_annotation_count": execution_annotated,
        "peer_task_upsert_count": peer_added,
        "owner_scope_signal_upsert_count": signal_added,
        "reads_promotion_feedback": True,
        "writes_shared_negotiation_memory": True,
        "bidirectional_alignment": True,
        "authority_effect": "none",
        "authority_activated": False,
        "hard_limits": [
            "promotion_feedback_never_grants_authority",
            "execution_feed_never_broadens_standing_scope",
            "hard_deny_and_revocation_are_not_overridden",
            "no_credential_or_private_network_expansion",
        ],
    }
    _write(state / "promotion_feedback_ingestor_result.json", result)
    return result
