"""Bidirectional intelligence exchange between negotiation AI and Promotion Corps.

The exchange broadens the Promotion Corps' *coordination* abilities without broadening
external authority. It continuously correlates negotiation, discovery, rights-request,
root-negotiation, and prior promotion state into one host-centric context, then returns
promotion outcomes to META/X/SENJU and cooperating agents as proposal-only feedback.

It never mints new authority, accesses raw credentials, performs network I/O, or overrides
revocation/HARD_DENY. Execution handoffs are emitted only for records already marked
AUTHORIZED_EXECUTION_READY by the standing-authorization Promotion Corps.
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
    "META",
    "X",
    "SENJU",
    "CHILD",
    "AI",
    "PR-ARMY",
    "ROOT-NEGOTIATION",
    "AUTHORIZED-SITE-ACCELERATOR",
)

LOCAL_SOURCE_FILES = (
    "negotiation_intelligence_bus.json",
    "negotiation_intelligence_receipts.json",
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

ROW_KEYS = (
    "records",
    "requests",
    "signals",
    "tasks",
    "decisions",
    "opportunities",
    "candidates",
    "items",
    "packets",
    "execution_ready",
    "promoted",
)

TERMINAL_STATUSES = {"blocked_terminal", "terminal_stop", "revoked", "hard_deny", "rejected"}
EXECUTION_READY_STATUSES = {"authorized_execution_ready", "authorized", "promoted"}
FEEDBACK_STATUSES = {
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


def _stable(*parts: Any) -> str:
    raw = "\x1f".join(str(v) for v in parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _host(value: Any) -> str:
    text = _clean(value, 2048).lower().rstrip(".")
    if not text:
        return ""
    if "://" in text:
        try:
            parsed = urlsplit(text)
        except ValueError:
            return ""
        if parsed.username or parsed.password:
            return ""
        text = (parsed.hostname or "").lower().rstrip(".")
    if not text or any(ch in text for ch in "/?#@* "):
        return ""
    if "." not in text:
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
    raw = row.get("priority") or row.get("priority_score")
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        value = 70
    status = _status(row)
    if status == "ready_for_standing_authorization":
        value = max(value, 96)
    elif status == "runtime_apply_pending":
        value = max(value, 94)
    elif status == "negotiation_pending":
        value = max(value, 90)
    elif status == "method_scope_mismatch":
        value = max(value, 88)
    if "promotion" in source:
        value = max(value, 92)
    return max(1, min(value, 100))


def _mapping_rows(value: Any, *, depth: int = 0) -> Iterable[Mapping[str, Any]]:
    if depth > 4:
        return
    if isinstance(value, Mapping):
        hostish = value.get("host") or value.get("target") or value.get("url") or value.get("final_url")
        if hostish:
            yield value
        for child in value.values():
            if isinstance(child, (Mapping, list)):
                yield from _mapping_rows(child, depth=depth + 1)
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (Mapping, list)):
                yield from _mapping_rows(child, depth=depth + 1)


def _iter_rows(doc: Any) -> Iterable[Mapping[str, Any]]:
    if not isinstance(doc, Mapping):
        return ()
    explicit: list[Mapping[str, Any]] = []
    for key in ROW_KEYS:
        rows = doc.get(key)
        if isinstance(rows, list):
            explicit.extend(row for row in rows if isinstance(row, Mapping))
    if explicit:
        return explicit
    return list(_mapping_rows(doc))


def _candidate_files(state: Path, promotion: Path, input_roots: Iterable[Path]) -> list[Path]:
    paths: list[Path] = []
    for name in LOCAL_SOURCE_FILES:
        path = state / name
        if path.exists():
            paths.append(path)
    for name in ("promotion_packets.json", "execution_ready.json", "last_promotion_cycle.json"):
        path = promotion / name
        if path.exists():
            paths.append(path)
    for root in input_roots:
        if not root.exists():
            continue
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


def _collect(state: Path, promotion: Path, input_roots: Iterable[Path]) -> tuple[list[Path], dict[str, dict[str, Any]]]:
    files = _candidate_files(state, promotion, input_roots)
    hosts: dict[str, dict[str, Any]] = {}
    for path in files:
        doc = _load(path, {})
        source = path.name
        for row in _iter_rows(doc):
            host = _host(row.get("host") or row.get("target") or row.get("url") or row.get("final_url"))
            if not host:
                continue
            item = hosts.setdefault(
                host,
                {
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
                },
            )
            item["evidence_count"] += 1
            if source not in item["source_files"]:
                item["source_files"].append(source)
            producer = _clean(row.get("producer") or row.get("source") or row.get("actor"), 100)
            if producer and producer not in item["producers"]:
                item["producers"].append(producer)
            ref = _clean(
                row.get("intelligence_id")
                or row.get("proposal_id")
                or row.get("request_id")
                or row.get("signal_id")
                or row.get("relay_id")
                or row.get("packet_id"),
                260,
            )
            if ref and ref not in item["source_refs"]:
                item["source_refs"].append(ref)
            status = _status(row)
            if status and status not in item["statuses"]:
                item["statuses"].append(status)
            if "promotion" in source or status in EXECUTION_READY_STATUSES | FEEDBACK_STATUSES | TERMINAL_STATUSES:
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
        item["priority"] = min(100, int(item["priority"]) + min(8, max(0, int(item["evidence_count"]) - 1)))
        item["source_files"].sort()
        item["source_refs"] = item["source_refs"][:40]
        item["producers"].sort()
        item["statuses"].sort()
        item["promotion_statuses"].sort()
        item["reasons"] = item["reasons"][:12]
        item["auth_contexts"] = item["auth_contexts"][:8]
        item["standing_authorization_references"].sort()
    return files, hosts


def _merge_feedback_signals(state: Path, contexts: Iterable[Mapping[str, Any]], now: int) -> int:
    path = state / "owner_scope_negotiation_signals.json"
    doc = _load(path, {})
    rows = doc.get("signals", []) if isinstance(doc, Mapping) else []
    signals = [dict(row) for row in rows if isinstance(row, Mapping)] if isinstance(rows, list) else []
    by_id = {
        str(row.get("signal_id")): row
        for row in signals
        if str(row.get("signal_id") or "")
    }
    changed = 0
    for item in contexts:
        statuses = {str(v).lower() for v in item.get("promotion_statuses", [])}
        actionable = sorted(statuses & FEEDBACK_STATUSES)
        if not actionable or statuses & TERMINAL_STATUSES or statuses & EXECUTION_READY_STATUSES:
            continue
        host = str(item.get("host") or "")
        if not host:
            continue
        signal_id = f"promotion-feedback-{_stable(host)[:18]}"
        next_status = actionable[0]
        methods = list(item.get("requested_methods") or ["GET", "HEAD"])
        signal = {
            "signal_id": signal_id,
            "host": host,
            "requested_methods": methods,
            "reason": f"Promotion Corps feedback={next_status}; continue evidence/negotiation using shared context",
            "source": "promotion_intelligence_exchange",
            "priority": int(item.get("priority", 90) or 90),
            "source_refs": list(item.get("source_refs", []))[:24],
            "shared_with": list(RECIPIENTS),
            "proposal_only": True,
            "authority_effect": "none",
            "raw_credentials_forwarded": False,
            "generated_at": now,
        }
        if by_id.get(signal_id) != signal:
            by_id[signal_id] = signal
            changed += 1
    merged = sorted(by_id.values(), key=lambda row: (-int(row.get("priority", 0) or 0), str(row.get("host", "")), str(row.get("signal_id", ""))))
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
    roots = [Path(v) for v in input_roots]
    files, by_host = _collect(state, promotion, roots)
    contexts = sorted(by_host.values(), key=lambda row: (-int(row["priority"]), row["host"]))

    feedback_signal_changes = 0
    if phase == "after_promotion":
        feedback_signal_changes = _merge_feedback_signals(state, contexts, current)

    context_doc = {
        "schema": CONTEXT_SCHEMA,
        "generated_at": current,
        "phase": phase,
        "host_count": len(contexts),
        "hosts": contexts,
        "raw_credentials_forwarded": False,
    }
    _write(promotion / "promotion_context.json", context_doc)

    inbox_tasks = []
    for item in contexts:
        statuses = set(item.get("promotion_statuses", []))
        terminal = bool(statuses & TERMINAL_STATUSES)
        ready = bool(statuses & EXECUTION_READY_STATUSES)
        if terminal:
            action = "respect terminal stop; retain evidence for audit only"
        elif ready:
            action = "consume execution-ready handoff; do not renegotiate broader scope from this status alone"
        else:
            action = "continue evidence, ballot, and exact-host standing-authorization negotiation"
        inbox_tasks.append({
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
        "task_count": len(inbox_tasks),
        "tasks": inbox_tasks,
        "shared_context": "promotion_context.json",
    })

    promotion_rows = _load(promotion / "last_promotion_cycle.json", {})
    _write(promotion / "promotion_feedback.json", {
        "schema": FEEDBACK_SCHEMA,
        "generated_at": current,
        "phase": phase,
        "shared_with": list(RECIPIENTS),
        "execution_ready": promotion_rows.get("execution_ready", []) if isinstance(promotion_rows, Mapping) else [],
        "packets": promotion_rows.get("packets", []) if isinstance(promotion_rows, Mapping) else [],
        "feedback_signal_changes": feedback_signal_changes,
        "raw_credentials_forwarded": False,
    })

    execution_ready = promotion_rows.get("execution_ready", []) if isinstance(promotion_rows, Mapping) else []
    handoffs = [dict(row) for row in execution_ready if isinstance(row, Mapping) and _status(row) in EXECUTION_READY_STATUSES]
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
        "source_file_count": len(files),
        "host_context_count": len(contexts),
        "feedback_signal_changes": feedback_signal_changes,
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
