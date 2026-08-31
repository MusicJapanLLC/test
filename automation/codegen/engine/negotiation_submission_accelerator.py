"""Increase new-host/root negotiation throughput into the existing approval flow.

This module is deliberately submission-focused: it does not grant Authority. It takes
persistent Root Authority candidates produced by ``root_authority_negotiation`` and
pushes more of them into the META/X/SENJU approval/review flow, while sharing the same
candidate/evidence state with the broader PR/agent collaboration fabric.

Submission policy:
- every non-terminal candidate is eligible for an approval-flow packet;
- a new candidate is submitted immediately;
- materially changed evidence is submitted immediately;
- unchanged candidates are re-submitted after a bounded cooldown so negotiation keeps
  moving without turning one denial into a tight-loop bypass attempt;
- HARD_DENY/revocation/terminal-stop candidates are never re-submitted.

The output is an internal approval outbox and collaboration feed only. ``authority_effect``
remains ``none`` until the existing authority machinery independently approves a change.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "the-world-negotiation-submission-accelerator/v1"
OUTBOX_SCHEMA = "the-world-root-authority-approval-outbox/v1"
LEDGER_SCHEMA = "the-world-root-authority-submission-ledger/v1"
PEER_FEED_SCHEMA = "the-world-root-negotiation-peer-feed/v1"
APPROVERS = ("META", "X", "SENJU")
COLLABORATORS = ("META", "X", "SENJU", "PR-ARMY", "CHILD", "AI")
RESUBMIT_COOLDOWN_SECONDS = 30 * 60
MAX_OUTBOX = 2048


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _fingerprint(candidate: Mapping[str, Any]) -> str:
    body = {
        "host": str(candidate.get("host") or ""),
        "source_files": sorted(str(v) for v in candidate.get("source_files", ()) if str(v)),
        "source_refs": sorted(str(v) for v in candidate.get("source_refs", ()) if str(v)),
        "reasons": sorted(str(v) for v in candidate.get("reasons", ()) if str(v)),
        "owner_proof_type": candidate.get("owner_proof_type"),
        "owner_proof_ref": candidate.get("owner_proof_ref"),
        "readiness_score": int(candidate.get("readiness_score", 0) or 0),
    }
    raw = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _submission_reason(previous: Mapping[str, Any] | None, fingerprint: str, now: int) -> str | None:
    if not isinstance(previous, Mapping):
        return "new_candidate"
    if str(previous.get("evidence_fingerprint") or "") != fingerprint:
        return "evidence_changed"
    try:
        last = int(previous.get("last_submitted_at", 0) or 0)
    except (TypeError, ValueError):
        last = 0
    if now - last >= RESUBMIT_COOLDOWN_SECONDS:
        return "cooldown_retry"
    return None


def run_submission_accelerator(state_dir: str | Path, *, now: int | None = None) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)

    root_state = _load(state / "root_authority_negotiation_state.json", {})
    candidates = root_state.get("candidates", ()) if isinstance(root_state, Mapping) else ()
    if not isinstance(candidates, list):
        candidates = []

    ledger_doc = _load(state / "negotiation_submission_ledger.json", {})
    ledger = ledger_doc.get("by_host", {}) if isinstance(ledger_doc, Mapping) else {}
    if not isinstance(ledger, dict):
        ledger = {}

    old_outbox = _load(state / "root_authority_approval_outbox.json", {})
    old_packets = old_outbox.get("packets", ()) if isinstance(old_outbox, Mapping) else ()
    by_id: dict[str, dict[str, Any]] = {}
    if isinstance(old_packets, list):
        for packet in old_packets:
            if isinstance(packet, Mapping) and packet.get("submission_id"):
                by_id[str(packet["submission_id"])] = dict(packet)

    submitted: list[dict[str, Any]] = []
    peer_tasks: list[dict[str, Any]] = []
    skipped_cooldown = 0
    terminal_skipped = 0

    for raw in candidates:
        if not isinstance(raw, Mapping):
            continue
        host = str(raw.get("host") or "").strip().lower().rstrip(".")
        if not host:
            continue
        if bool(raw.get("terminal_stop")):
            terminal_skipped += 1
            continue

        fp = _fingerprint(raw)
        reason = _submission_reason(ledger.get(host), fp, current)
        if reason is None:
            skipped_cooldown += 1
        else:
            attempt = int(raw.get("attempt_count", 0) or 0)
            submission_id = hashlib.sha256(f"{host}:{fp}:{current}:{reason}".encode()).hexdigest()[:24]
            packet = {
                "submission_id": f"root-approval-{submission_id}",
                "host": host,
                "candidate_id": raw.get("candidate_id"),
                "attempt_count": attempt,
                "submitted_at": current,
                "submission_reason": reason,
                "evidence_fingerprint": fp,
                "readiness_score": int(raw.get("readiness_score", 0) or 0),
                "source_files": list(raw.get("source_files", ()))[:32],
                "source_refs": list(raw.get("source_refs", ()))[:32],
                "owner_proof_type": raw.get("owner_proof_type"),
                "owner_proof_ref": raw.get("owner_proof_ref"),
                "requested_decision": "approve_or_reject_new_host_root_candidate",
                "approval_flow": "META_X_SENJU_existing_authority_review",
                "required_approvers": list(APPROVERS),
                "shared_with": list(COLLABORATORS),
                "authority_effect": "none",
                "may_self_mint_root": False,
                "may_bypass_terminal_stop": False,
            }
            by_id[packet["submission_id"]] = packet
            submitted.append(packet)
            previous = ledger.get(host, {}) if isinstance(ledger.get(host), Mapping) else {}
            ledger[host] = {
                "host": host,
                "last_submitted_at": current,
                "first_submitted_at": int(previous.get("first_submitted_at", current) or current),
                "submission_count": int(previous.get("submission_count", 0) or 0) + 1,
                "evidence_fingerprint": fp,
                "last_submission_reason": reason,
            }

        for actor in COLLABORATORS:
            peer_tasks.append({
                "task_id": f"negotiation-share:{host}:{int(raw.get('attempt_count', 0) or 0)}:{actor.lower()}",
                "actor": actor,
                "host": host,
                "attempt_count": int(raw.get("attempt_count", 0) or 0),
                "mission": "share fresh candidate evidence, challenge weak claims, and route a complete packet into the existing META/X/SENJU approval flow",
                "approval_submission_is_goal": True,
                "collect_fresh_independent_evidence": True,
                "share_across_pr_agents": True,
                "authority_effect": "none",
            })

    packets = sorted(by_id.values(), key=lambda row: int(row.get("submitted_at", 0) or 0), reverse=True)[:MAX_OUTBOX]
    _write(state / "root_authority_approval_outbox.json", {
        "schema": OUTBOX_SCHEMA,
        "generated_at": current,
        "required_approvers": list(APPROVERS),
        "packet_count": len(packets),
        "new_submissions_this_cycle": len(submitted),
        "packets": packets,
        "authority_effect": "none",
    })
    _write(state / "negotiation_submission_ledger.json", {
        "schema": LEDGER_SCHEMA,
        "generated_at": current,
        "resubmit_cooldown_seconds": RESUBMIT_COOLDOWN_SECONDS,
        "by_host": ledger,
    })
    _write(state / "root_negotiation_peer_feed.json", {
        "schema": PEER_FEED_SCHEMA,
        "generated_at": current,
        "collaborators": list(COLLABORATORS),
        "task_count": len(peer_tasks),
        "tasks": peer_tasks,
        "goal": "increase legitimate approval-flow submissions and evidence sharing",
        "authority_effect": "none",
    })

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "production": True,
        "active_candidate_count": sum(1 for row in candidates if isinstance(row, Mapping) and not row.get("terminal_stop")),
        "approval_flow_submission_count": len(submitted),
        "cooldown_skipped_count": skipped_cooldown,
        "terminal_skipped_count": terminal_skipped,
        "peer_share_task_count": len(peer_tasks),
        "approvers": list(APPROVERS),
        "collaborators": list(COLLABORATORS),
        "resubmit_cooldown_seconds": RESUBMIT_COOLDOWN_SECONDS,
        "approval_submission_is_goal": True,
        "fresh_evidence_resubmits_immediately": True,
        "unchanged_candidate_periodic_resubmission": True,
        "authority_effect": "none",
        "authority_activated": False,
        "terminal_stop_bypass": False,
    }
    _write(state / "negotiation_submission_accelerator_result.json", result)
    return result
