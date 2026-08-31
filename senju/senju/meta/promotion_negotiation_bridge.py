"""Bidirectional intelligence bridge between Promotion Corps and negotiation agents.

The bridge is coordination-only. It consumes structured Owner-scope and Root Authority
negotiation context, enriches Promotion Corps packets, and publishes feedback/handoff
records back to the shared negotiation memory.

It never creates Authority, broadens Standing Authorization, mints credentials, enables
private-network access, or overrides revocation/HARD_DENY.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping

BRIDGE_SCHEMA = "senju-promotion-negotiation-bridge/v1"
FEEDBACK_SCHEMA = "senju-promotion-negotiation-feedback/v1"
EXECUTION_FEED_SCHEMA = "senju-promotion-execution-feed/v1"
COLLABORATORS = ("META", "X", "SENJU", "CHILD", "AI", "PR-ARMY")


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


def _iter_values(items: object) -> Iterable[object]:
    if items is None:
        return ()
    if isinstance(items, str):
        return (items,)
    if isinstance(items, (list, tuple, set, frozenset)):
        return items
    return (items,)


def _append_unique(values: list[str], items: object, *, limit: int = 32) -> None:
    seen = set(values)
    for raw in _iter_values(items):
        value = " ".join(str(raw or "").split())
        if not value or value in seen:
            continue
        values.append(value[:500])
        seen.add(value)
        if len(values) >= limit:
            return


def _ctx(index: dict[str, dict[str, Any]], host: str) -> dict[str, Any]:
    return index.setdefault(host, {
        "host": host,
        "source_channels": [],
        "source_refs": [],
        "reasons": [],
        "requested_methods": [],
        "owner_proof_types": [],
        "owner_proof_refs": [],
        "owner_evidence_verified": False,
        "active_trial": False,
        "active_trial_methods": [],
        "root_approval_submissions": 0,
        "root_review_packets": 0,
        "root_peer_tasks": 0,
        "root_submission_count": 0,
        "last_root_submission_at": 0,
        "root_readiness_score": 0,
        "opportunity_priority": 0,
    })


def _add_channel(ctx: dict[str, Any], name: str) -> None:
    _append_unique(ctx["source_channels"], name)


def _collect_owner_scope(state: Path, index: dict[str, dict[str, Any]]) -> None:
    signals = _load(state / "owner_scope_negotiation_signals.json", {})
    rows = signals.get("signals", ()) if isinstance(signals, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host") or raw.get("target"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "owner_scope_negotiation_signals")
        _append_unique(ctx["requested_methods"], raw.get("requested_methods") or raw.get("methods"))
        _append_unique(ctx["reasons"], raw.get("reason"))
        _append_unique(ctx["source_refs"], (raw.get("source_ref"), raw.get("proposal_id"), raw.get("signal_id")))

    requests = _load(state / "adversary_external_host_requests.json", {})
    rows = requests.get("requests", ()) if isinstance(requests, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host") or raw.get("target"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "adversary_external_host_requests")
        _append_unique(ctx["requested_methods"], raw.get("requested_methods") or raw.get("methods"))
        _append_unique(ctx["reasons"], raw.get("reason"))
        _append_unique(ctx["source_refs"], (raw.get("source_ref"), raw.get("request_id")))

    evidence = _load(state / "owner_scope_expansion_evidence.json", {})
    rows = evidence.get("evidence", ()) if isinstance(evidence, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping) or raw.get("revoked") is True:
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "owner_scope_expansion_evidence")
        if bool(raw.get("verified")):
            ctx["owner_evidence_verified"] = True
        _append_unique(ctx["owner_proof_types"], raw.get("proof_type"))
        _append_unique(ctx["owner_proof_refs"], raw.get("proof_ref"))
        _append_unique(ctx["source_refs"], raw.get("proof_ref"))

    trials = _load(state / "owner_verified_active_trials.json", {})
    rows = trials.get("grants", ()) if isinstance(trials, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "owner_verified_active_trials")
        ctx["active_trial"] = True
        _append_unique(ctx["active_trial_methods"], raw.get("allowed_methods"))
        _append_unique(ctx["source_refs"], (raw.get("proposal_id"), raw.get("proof_ref")))

    campaign = _load(state / "owner_scope_negotiation_campaign.json", {})
    rows = campaign.get("tasks", ()) if isinstance(campaign, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "owner_scope_negotiation_campaign")
        _append_unique(ctx["source_refs"], (raw.get("task_id"), raw.get("proposal_id")))


def _collect_root_shared(collaboration: Path, index: dict[str, dict[str, Any]]) -> None:
    outbox = _load(collaboration / "root_authority_approval_outbox.json", {})
    rows = outbox.get("packets", ()) if isinstance(outbox, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "root_authority_approval_outbox")
        ctx["root_approval_submissions"] += 1
        ctx["root_readiness_score"] = max(ctx["root_readiness_score"], int(raw.get("readiness_score", 0) or 0))
        ctx["last_root_submission_at"] = max(ctx["last_root_submission_at"], int(raw.get("submitted_at", 0) or 0))
        _append_unique(ctx["owner_proof_types"], raw.get("owner_proof_type"))
        _append_unique(ctx["owner_proof_refs"], raw.get("owner_proof_ref"))
        _append_unique(ctx["source_refs"], (raw.get("submission_id"), raw.get("candidate_id")))
        _append_unique(ctx["source_refs"], raw.get("source_refs"))

    review = _load(collaboration / "owner_root_authority_review_packets.json", {})
    rows = review.get("packets", ()) if isinstance(review, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "owner_root_authority_review_packets")
        ctx["root_review_packets"] += 1
        ctx["root_readiness_score"] = max(ctx["root_readiness_score"], int(raw.get("readiness_score", 0) or 0))
        _append_unique(ctx["source_refs"], (raw.get("packet_id"), raw.get("submission_id"), raw.get("candidate_id")))

    feed = _load(collaboration / "root_negotiation_peer_feed.json", {})
    rows = feed.get("tasks", ()) if isinstance(feed, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "root_negotiation_peer_feed")
        ctx["root_peer_tasks"] += 1
        _append_unique(ctx["source_refs"], raw.get("task_id"))

    ledger = _load(collaboration / "negotiation_submission_ledger.json", {})
    by_host = ledger.get("by_host", {}) if isinstance(ledger, Mapping) else {}
    if isinstance(by_host, Mapping):
        for raw_host, raw in by_host.items():
            host = _host(raw_host)
            if host is None or not isinstance(raw, Mapping):
                continue
            ctx = _ctx(index, host)
            _add_channel(ctx, "negotiation_submission_ledger")
            ctx["root_submission_count"] = max(ctx["root_submission_count"], int(raw.get("submission_count", 0) or 0))
            ctx["last_root_submission_at"] = max(ctx["last_root_submission_at"], int(raw.get("last_submitted_at", 0) or 0))

    queue = _load(collaboration / "authority_opportunity_queue.json", {})
    rows = queue.get("opportunities", ()) if isinstance(queue, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        host = _host(raw.get("host"))
        if host is None:
            continue
        ctx = _ctx(index, host)
        _add_channel(ctx, "authority_opportunity_queue")
        ctx["opportunity_priority"] = max(ctx["opportunity_priority"], int(raw.get("priority", 0) or 0))
        ctx["root_submission_count"] = max(ctx["root_submission_count"], int(raw.get("approval_submission_count", 0) or 0))
        _append_unique(ctx["reasons"], raw.get("reason"))
        _append_unique(ctx["source_refs"], (raw.get("source_ref"), raw.get("proposal_id")))


def collect_negotiation_intelligence(state_dir: str | Path, collaboration_dir: str | Path | None = None) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    _collect_owner_scope(Path(state_dir), index)
    if collaboration_dir is not None:
        _collect_root_shared(Path(collaboration_dir), index)
    for ctx in index.values():
        for key in ("source_channels", "source_refs", "reasons", "requested_methods", "owner_proof_types", "owner_proof_refs", "active_trial_methods"):
            ctx[key] = sorted(set(ctx[key]))
    return index


def coordination_priority(packet: Mapping[str, Any], context: Mapping[str, Any], *, min_confidence: int) -> int:
    if packet.get("hard_deny") is True or packet.get("revoked") is True or packet.get("status") == "BLOCKED_TERMINAL":
        return 0
    score = 10
    if packet.get("standing_authorization_match") is True:
        score += 30
    if packet.get("council_unanimous") is True:
        score += 20
    try:
        confidence = int(packet.get("average_yes_confidence", 0) or 0)
    except (TypeError, ValueError):
        confidence = 0
    if confidence >= min_confidence:
        score += 10
    if bool(context.get("owner_evidence_verified")):
        score += 8
    if bool(context.get("active_trial")):
        score += 5
    score += min(7, int(context.get("root_submission_count", 0) or 0))
    score += min(5, int(context.get("root_readiness_score", 0) or 0) // 20)
    score += min(5, int(context.get("opportunity_priority", 0) or 0) // 20)
    return max(0, min(score, 100))


def missing_requirements(packet: Mapping[str, Any], *, min_confidence: int) -> list[str]:
    if packet.get("hard_deny") is True or packet.get("revoked") is True or packet.get("status") == "BLOCKED_TERMINAL":
        return ["terminal_stop"]
    missing: list[str] = []
    if packet.get("council_unanimous") is not True:
        missing.append("META_X_SENJU_consensus")
    try:
        confidence = int(packet.get("average_yes_confidence", 0) or 0)
    except (TypeError, ValueError):
        confidence = 0
    if confidence < min_confidence:
        missing.append("minimum_confidence")
    if packet.get("standing_authorization_match") is not True:
        missing.append("active_exact_host_standing_authorization")
    if packet.get("standing_authorization_match") is True and not packet.get("covered_methods"):
        missing.append("method_subset_alignment")
    if packet.get("standing_authorization_match") is True and packet.get("decision_status") != "auto_applied_inside_owner_expansion_envelope":
        missing.append("owner_scope_runtime_application")
    return missing


def enrich_packet(packet: Mapping[str, Any], context: Mapping[str, Any] | None, *, min_confidence: int) -> dict[str, Any]:
    ctx = dict(context or {})
    enriched = dict(packet)
    enriched["negotiation_context"] = ctx
    enriched["negotiation_source_count"] = len(ctx.get("source_channels", ()))
    enriched["coordination_priority"] = coordination_priority(enriched, ctx, min_confidence=min_confidence)
    enriched["missing_requirements"] = missing_requirements(enriched, min_confidence=min_confidence)
    return enriched


def _feedback_mission(missing: Iterable[str]) -> str:
    values = set(str(v) for v in missing)
    if "terminal_stop" in values:
        return "record terminal stop and suppress further promotion or approval resubmission"
    if "active_exact_host_standing_authorization" in values:
        return "collect and cross-check exact-host owner/standing evidence, then update the existing META/X/SENJU review flow"
    if "META_X_SENJU_consensus" in values or "minimum_confidence" in values:
        return "share fresh evidence with META/X/SENJU and close the missing ballot/confidence gap"
    if "method_subset_alignment" in values:
        return "align requested methods to the already-authorized exact-host method set and resubmit the bounded proposal"
    if "owner_scope_runtime_application" in values:
        return "replay the approved Owner-scope runtime application and return the resulting receipt to Promotion Corps"
    return "share current promotion state and avoid duplicate negotiation work"


def publish_feedback(
    promotion_dir: str | Path,
    collaboration_dir: str | Path | None,
    *,
    packets: Iterable[Mapping[str, Any]],
    execution_ready: Iterable[Mapping[str, Any]],
    contexts: Mapping[str, Mapping[str, Any]],
    now: int | None = None,
) -> dict[str, Any]:
    current = int(time.time()) if now is None else int(now)
    promotion = Path(promotion_dir)
    packet_rows = [dict(row) for row in packets]
    ready_rows = [dict(row) for row in execution_ready]
    feedback_tasks: list[dict[str, Any]] = []

    for row in packet_rows:
        host = _host(row.get("host"))
        if host is None:
            continue
        missing = list(row.get("missing_requirements") or ())
        terminal = "terminal_stop" in missing
        for actor in COLLABORATORS:
            feedback_tasks.append({
                "task_id": f"promotion-feedback:{host}:{row.get('proposal_id')}:{actor.lower()}",
                "actor": actor,
                "host": host,
                "proposal_id": row.get("proposal_id"),
                "promotion_status": row.get("status"),
                "coordination_priority": int(row.get("coordination_priority", 0) or 0),
                "missing_requirements": missing,
                "mission": _feedback_mission(missing),
                "collect_fresh_independent_evidence": not terminal,
                "share_with_promotion_corps": True,
                "share_across_negotiation_agents": True,
                "authority_effect": "none",
                "may_self_mint_root": False,
                "may_bypass_terminal_stop": False,
            })

    execution_feed = []
    for row in ready_rows:
        host = _host(row.get("host"))
        if host is None:
            continue
        execution_feed.append({
            "host": host,
            "proposal_id": row.get("proposal_id"),
            "status": row.get("status"),
            "standing_authorization_reference": row.get("standing_authorization_reference"),
            "covered_methods": list(row.get("covered_methods") or ()),
            "shared_with": list(COLLABORATORS),
            "negotiation_action": "mark covered exact-host request execution-ready and suppress duplicate authority submissions for identical scope",
            "authority_effect": "existing_standing_authorization_lease",
            "scope_expanded": False,
        })

    intelligence = {
        "schema": BRIDGE_SCHEMA,
        "generated_at": current,
        "host_count": len(contexts),
        "hosts": sorted((dict(v) for v in contexts.values()), key=lambda row: str(row.get("host", ""))),
        "consumes_owner_scope_negotiation": True,
        "consumes_root_authority_negotiation": collaboration_dir is not None,
        "bidirectional": collaboration_dir is not None,
        "authority_effect": "none",
    }
    feedback = {
        "schema": FEEDBACK_SCHEMA,
        "generated_at": current,
        "collaborators": list(COLLABORATORS),
        "task_count": len(feedback_tasks),
        "tasks": sorted(feedback_tasks, key=lambda row: (-int(row.get("coordination_priority", 0) or 0), str(row.get("host", "")), str(row.get("actor", "")))),
        "goal": "close negotiation information gaps and route complete bounded proposals back into the existing review flow",
        "authority_effect": "none",
    }
    execution = {
        "schema": EXECUTION_FEED_SCHEMA,
        "generated_at": current,
        "record_count": len(execution_feed),
        "records": execution_feed,
        "authority_effect": "existing_standing_authorization_lease",
        "scope_expanded": False,
    }

    _write(promotion / "negotiation_intelligence.json", intelligence)
    _write(promotion / "negotiation_feedback.json", feedback)
    _write(promotion / "execution_handoff.json", execution)
    if collaboration_dir is not None:
        collaboration = Path(collaboration_dir)
        _write(collaboration / "promotion_corps_feedback_outbox.json", feedback)
        _write(collaboration / "promotion_corps_execution_feed.json", execution)
        _write(collaboration / "promotion_corps_intelligence_snapshot.json", intelligence)

    return {
        "schema": BRIDGE_SCHEMA,
        "generated_at": current,
        "host_count": len(contexts),
        "feedback_task_count": len(feedback_tasks),
        "execution_feed_count": len(execution_feed),
        "collaboration_dir_connected": collaboration_dir is not None,
        "collaborators": list(COLLABORATORS),
        "authority_effect": "none",
    }
