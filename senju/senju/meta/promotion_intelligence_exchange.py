"""Bidirectional intelligence exchange between negotiation AI and Promotion Corps.

This layer expands coordination: it correlates research, negotiation, rights-request,
root-negotiation and prior promotion state into host-centric context, then sends Promotion
Corps outcomes back to META/X/SENJU and cooperating agents. It is not an authority-minting
layer: no raw credentials, network I/O, revocation bypass, or discovery-only authority.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import urlsplit

SCHEMA = "senju-promotion-intelligence-exchange/v1"
CONTEXT_SCHEMA = "senju-promotion-intelligence-context/v1"
INBOX_SCHEMA = "senju-negotiator-promotion-inbox/v1"
FEEDBACK_SCHEMA = "senju-promotion-feedback/v1"
HANDOFF_SCHEMA = "senju-authorized-execution-handoff/v1"
SIGNAL_SCHEMA = "senju-owner-scope-negotiation-signals/v1"

RECIPIENTS = (
    "META", "X", "SENJU", "CHILD", "AI", "PR-ARMY",
    "ROOT-NEGOTIATION", "AUTHORIZED-SITE-ACCELERATOR",
)
LOCAL_FILES = (
    "negotiation_intelligence_bus.json",
    "rights_request_ledger.json",
    "rights_request_federation.json",
    "owner_scope_negotiation_signals.json",
    "owner_scope_negotiation_campaign.json",
    "owner_scope_negotiation_result.json",
    "council_operational_governance_result.json",
    "root_negotiation_peer_feed.json",
    "authority_opportunity_queue.json",
    "external_input_negotiation_relay.json",
)
EXTERNAL_PATTERNS = (
    "**/negotiation_intelligence_bus.json",
    "**/rights_request_ledger.json",
    "**/owner_scope_negotiation_signals.json",
    "**/owner_scope_negotiation_campaign.json",
    "**/owner_scope_negotiation_result.json",
    "**/root_negotiation_peer_feed.json",
    "**/authority_opportunity_queue.json",
    "**/external_input_negotiation_relay.json",
    "**/authorized_site_authority_promotion_bus.json",
    "**/owner_frontier_negotiator_feed.json",
    "**/promotion_packets.json",
    "**/execution_ready.json",
    "**/last_promotion_cycle.json",
)
TERMINAL = {"blocked_terminal", "terminal_stop", "revoked", "hard_deny", "rejected"}
READY = {"authorized_execution_ready", "authorized", "promoted"}
FEEDBACK = {
    "negotiation_pending",
    "ready_for_standing_authorization",
    "runtime_apply_pending",
    "method_scope_mismatch",
    "owner_review_requested",
    "owner_review_requested_persistent",
    "council_negotiation_pending",
}


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _clean(value: Any, limit: int = 600) -> str:
    return " ".join(str(value or "").strip().split())[:limit]


def _stable(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _host(value: Any) -> str:
    text = _clean(value, 2048).lower().rstrip(".")
    if "://" in text:
        try:
            parsed = urlsplit(text)
        except ValueError:
            return ""
        if parsed.username or parsed.password:
            return ""
        text = (parsed.hostname or "").lower().rstrip(".")
    if not text or "." not in text or any(ch in text for ch in "/?#@* "):
        return ""
    return text


def _status(row: Mapping[str, Any]) -> str:
    return _clean(row.get("status") or row.get("decision_status") or row.get("decision"), 120).lower()


def _methods(row: Mapping[str, Any]) -> list[str]:
    allowed = {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}
    values = row.get("requested_methods") or row.get("covered_methods") or row.get("allowed_methods") or []
    if not isinstance(values, (list, tuple, set)):
        return []
    return sorted({str(v).strip().upper() for v in values if str(v).strip().upper() in allowed})


def _priority(row: Mapping[str, Any], source: str) -> int:
    try:
        value = int(float(row.get("priority") or row.get("priority_score") or 70))
    except (TypeError, ValueError):
        value = 70
    status = _status(row)
    floors = {
        "ready_for_standing_authorization": 96,
        "runtime_apply_pending": 94,
        "negotiation_pending": 90,
        "method_scope_mismatch": 88,
    }
    value = max(value, floors.get(status, 1))
    if "promotion" in source:
        value = max(value, 92)
    return max(1, min(value, 100))


def _rows(value: Any, *, depth: int = 0) -> Iterable[Mapping[str, Any]]:
    if depth > 5:
        return
    if isinstance(value, Mapping):
        if value.get("host") or value.get("target") or value.get("url") or value.get("final_url"):
            yield value
        for child in value.values():
            if isinstance(child, (Mapping, list)):
                yield from _rows(child, depth=depth + 1)
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (Mapping, list)):
                yield from _rows(child, depth=depth + 1)


def _files(state: Path, promotion: Path, roots: Iterable[Path]) -> list[Path]:
    paths = [state / name for name in LOCAL_FILES if (state / name).exists()]
    paths += [
        promotion / name
        for name in ("promotion_packets.json", "execution_ready.json", "last_promotion_cycle.json")
        if (promotion / name).exists()
    ]
    for root in roots:
        if root.exists():
            for pattern in EXTERNAL_PATTERNS:
                paths.extend(root.glob(pattern))
    unique: dict[str, Path] = {}
    for path in paths:
        try:
            key = str(path.resolve())
        except OSError:
            key = str(path)
        unique[key] = path
    return sorted(unique.values(), key=str)


def _collect(state: Path, promotion: Path, roots: Iterable[Path]) -> tuple[list[Path], list[dict[str, Any]]]:
    source_files = _files(state, promotion, roots)
    hosts: dict[str, dict[str, Any]] = {}
    for path in source_files:
        source = path.name
        for row in _rows(_load(path, {})):
            host = _host(row.get("host") or row.get("target") or row.get("url") or row.get("final_url"))
            if not host:
                continue
            item = hosts.setdefault(host, {
                "host": host,
                "priority": 1,
                "evidence_count": 0,
                "source_files": [],
                "source_refs": [],
                "producers": [],
                "statuses": [],
                "reasons": [],
                "requested_methods": [],
                "auth_contexts": [],
                "promotion_statuses": [],
                "standing_authorization_references": [],
            })
            item["evidence_count"] += 1
            if source not in item["source_files"]:
                item["source_files"].append(source)
            producer = _clean(row.get("producer") or row.get("source") or row.get("actor"), 100)
            if producer and producer not in item["producers"]:
                item["producers"].append(producer)
            ref = _clean(
                row.get("intelligence_id") or row.get("proposal_id") or row.get("request_id")
                or row.get("signal_id") or row.get("relay_id") or row.get("packet_id"),
                260,
            )
            if ref and ref not in item["source_refs"]:
                item["source_refs"].append(ref)
            status = _status(row)
            if status and status not in item["statuses"]:
                item["statuses"].append(status)
            if "promotion" in source or status in READY | FEEDBACK | TERMINAL:
                if status and status not in item["promotion_statuses"]:
                    item["promotion_statuses"].append(status)
            reason = _clean(row.get("reason") or row.get("summary") or row.get("next_action") or row.get("mission"), 500)
            if reason and reason not in item["reasons"]:
                item["reasons"].append(reason)
            item["requested_methods"] = sorted(set(item["requested_methods"]) | set(_methods(row)))
            auth = row.get("auth_context")
            if isinstance(auth, Mapping):
                safe_auth = {
                    "authentication_required": bool(auth.get("authentication_required")),
                    "scheme": _clean(auth.get("scheme"), 80),
                    "login_url": _clean(auth.get("login_url"), 500),
                    "reference_present": bool(auth.get("reference_present")),
                    "reference_fingerprint": _clean(auth.get("reference_fingerprint"), 80),
                    "raw_credentials_forwarded": False,
                }
                if safe_auth not in item["auth_contexts"]:
                    item["auth_contexts"].append(safe_auth)
            standing_ref = _clean(row.get("standing_authorization_reference"), 300)
            if standing_ref and standing_ref not in item["standing_authorization_references"]:
                item["standing_authorization_references"].append(standing_ref)
            item["priority"] = max(int(item["priority"]), _priority(row, source))

    for item in hosts.values():
        item["priority"] = min(100, int(item["priority"]) + min(8, max(0, item["evidence_count"] - 1)))
        for key in ("source_files", "producers", "statuses", "promotion_statuses", "standing_authorization_references"):
            item[key] = sorted(item[key])
        item["source_refs"] = item["source_refs"][:40]
        item["reasons"] = item["reasons"][:12]
        item["auth_contexts"] = item["auth_contexts"][:8]
    return source_files, sorted(hosts.values(), key=lambda row: (-int(row["priority"]), row["host"]))


def _merge_feedback_signals(state: Path, contexts: Iterable[Mapping[str, Any]], now: int) -> int:
    path = state / "owner_scope_negotiation_signals.json"
    doc = _load(path, {})
    rows = doc.get("signals", []) if isinstance(doc, Mapping) else []
    existing = [dict(row) for row in rows if isinstance(row, Mapping)] if isinstance(rows, list) else []
    unkeyed = [row for row in existing if not str(row.get("signal_id") or "")]
    keyed = {
        str(row.get("signal_id")): row
        for row in existing
        if str(row.get("signal_id") or "")
    }
    changed = 0
    for item in contexts:
        statuses = {str(v).lower() for v in item.get("promotion_statuses", [])}
        actionable = sorted(statuses & FEEDBACK)
        if not actionable or statuses & TERMINAL or statuses & READY:
            continue
        host = str(item.get("host") or "")
        if not host:
            continue
        signal_id = f"promotion-feedback-{_stable(host)[:18]}"
        signal = {
            "signal_id": signal_id,
            "host": host,
            "requested_methods": list(item.get("requested_methods") or ["GET", "HEAD"]),
            "reason": f"Promotion Corps feedback={actionable[0]}; continue evidence/negotiation using shared context",
            "source": "promotion_intelligence_exchange",
            "priority": int(item.get("priority", 90) or 90),
            "source_refs": list(item.get("source_refs", []))[:24],
            "shared_with": list(RECIPIENTS),
            "proposal_only": True,
            "authority_effect": "none",
            "raw_credentials_forwarded": False,
            "generated_at": now,
        }
        if keyed.get(signal_id) != signal:
            keyed[signal_id] = signal
            changed += 1
    merged = unkeyed + list(keyed.values())
    merged.sort(key=lambda row: (-int(row.get("priority", 0) or 0), str(row.get("host", "")), str(row.get("signal_id", ""))))
    if len(merged) > 4096:
        merged = merged[:4096]
    _write(path, {
        "schema": str(doc.get("schema") or SIGNAL_SCHEMA) if isinstance(doc, Mapping) else SIGNAL_SCHEMA,
        "generated_at": now,
        "producer": "promotion_intelligence_exchange",
        "signals": merged,
    })
    return changed


def run_promotion_intelligence_exchange(
    state_dir: str | Path,
    promotion_dir: str | Path,
    *,
    input_roots: Iterable[str | Path] = (),
    phase: str = "before_promotion",
    now: int | None = None,
) -> dict[str, Any]:
    state = Path(state_dir)
    promotion = Path(promotion_dir)
    promotion.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)
    source_files, contexts = _collect(state, promotion, [Path(v) for v in input_roots])

    feedback_changes = _merge_feedback_signals(state, contexts, current) if phase == "after_promotion" else 0
    _write(promotion / "promotion_context.json", {
        "schema": CONTEXT_SCHEMA,
        "generated_at": current,
        "phase": phase,
        "host_count": len(contexts),
        "hosts": contexts,
        "raw_credentials_forwarded": False,
    })

    tasks = []
    for item in contexts:
        statuses = set(item.get("promotion_statuses", []))
        if statuses & TERMINAL:
            action = "respect terminal stop; retain evidence for audit only"
        elif statuses & READY:
            action = "consume execution-ready handoff; do not broaden authority from this status alone"
        else:
            action = "continue evidence, ballot, and exact-host standing-authorization negotiation"
        tasks.append({
            "host": item["host"],
            "priority": item["priority"],
            "requested_methods": item["requested_methods"],
            "promotion_statuses": item["promotion_statuses"],
            "source_refs": item["source_refs"],
            "action": action,
        })
    _write(promotion / "negotiator_inbox.json", {
        "schema": INBOX_SCHEMA,
        "generated_at": current,
        "recipients": list(RECIPIENTS),
        "task_count": len(tasks),
        "tasks": tasks,
        "shared_context": "promotion_context.json",
    })

    cycle = _load(promotion / "last_promotion_cycle.json", {})
    execution_ready = cycle.get("execution_ready", []) if isinstance(cycle, Mapping) else []
    packets = cycle.get("packets", []) if isinstance(cycle, Mapping) else []
    _write(promotion / "promotion_feedback.json", {
        "schema": FEEDBACK_SCHEMA,
        "generated_at": current,
        "phase": phase,
        "shared_with": list(RECIPIENTS),
        "execution_ready": execution_ready,
        "packets": packets,
        "feedback_signal_changes": feedback_changes,
        "raw_credentials_forwarded": False,
    })
    handoffs = [dict(row) for row in execution_ready if isinstance(row, Mapping) and _status(row) in READY]
    _write(promotion / "execution_handoff.json", {
        "schema": HANDOFF_SCHEMA,
        "generated_at": current,
        "handoff_count": len(handoffs),
        "records": handoffs,
        "routing_targets": ["META", "X", "SENJU", "AUTHORIZED-EXECUTION-LANES"],
        "authority_source": "existing_standing_authorization_only",
        "scope_expanded_by_exchange": False,
    })

    result = {
        "schema": SCHEMA,
        "generated_at": current,
        "phase": phase,
        "closed_loop": True,
        "source_file_count": len(source_files),
        "host_context_count": len(contexts),
        "feedback_signal_changes": feedback_changes,
        "execution_handoff_count": len(handoffs),
        "recipients": list(RECIPIENTS),
        "coordination_capabilities": {
            "may_read_cross_agent_negotiation_state": True,
            "may_correlate_cross_agent_evidence": True,
            "may_raise_internal_priority": True,
            "may_publish_negotiator_inbox": True,
            "may_request_re_review_and_retest": True,
            "may_emit_execution_handoff_for_existing_authority": True,
            "may_access_raw_credentials": False,
            "may_mint_new_external_authority": False,
            "may_override_revocation_or_hard_deny": False,
            "may_perform_network_io": False,
        },
        "raw_credentials_forwarded": False,
        "authority_effect": "coordination_only",
    }
    _write(promotion / "intelligence_exchange_last_run.json", result)
    return result
