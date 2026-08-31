#!/usr/bin/env python3
"""Keep valid frontier approvals alive when only the per-cycle budget deferred them.

A deferred row is eligible only when it already had verified Owner evidence and binding
META/X/SENJU 3/3 approval. The script does not mint authority; it requeues the approval
at priority 100 so the next normal frontier cycle revalidates current evidence and
policy, then activates it if still valid.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Mapping

APPROVED_PROOF_TYPES = {
    "existing_standing_authorization",
    "owner_verified_domain",
    "owner_exact_link",
}
MAX_PENDING = 300
KIND = "ai_council_approved_budget_deferred"


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _methods_for_host(state: Path, host: str) -> list[str]:
    docs = [
        _load(state / "owner_scope_negotiation_signals.json", {}),
        _load(state / "adversary_external_host_requests.json", {}),
        _load(state / "authority_opportunity_queue.json", {}),
    ]
    for doc in docs:
        if not isinstance(doc, Mapping):
            continue
        rows = doc.get("signals") or doc.get("requests") or doc.get("opportunities") or []
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, Mapping) or str(row.get("host") or row.get("target") or "").lower() != host.lower():
                continue
            raw = row.get("requested_methods") or row.get("methods") or []
            methods = sorted({str(v).strip().upper() for v in raw if str(v).strip()}) if isinstance(raw, list) else []
            if methods:
                return methods
    return ["GET", "HEAD", "OPTIONS"]


def run(state_dir: str | Path, *, now: int | None = None) -> dict[str, Any]:
    state = Path(state_dir)
    ts = int(time.time()) if now is None else int(now)
    council = _load(state / "owner_frontier_council.json", {})
    decisions = council.get("decisions", []) if isinstance(council, Mapping) else []
    old_doc = _load(state / "owner_frontier_approved_pending.json", {})
    old_rows = old_doc.get("pending", []) if isinstance(old_doc, Mapping) else []
    pending = {
        str(row.get("host")): dict(row)
        for row in old_rows
        if isinstance(row, Mapping) and row.get("host")
    } if isinstance(old_rows, list) else {}

    activated_hosts: set[str] = set()
    terminal_hosts: set[str] = set()
    for row in decisions if isinstance(decisions, list) else []:
        if not isinstance(row, Mapping):
            continue
        host = str(row.get("host") or "").strip().lower()
        if not host:
            continue
        status = str(row.get("status") or "")
        if bool(row.get("applied")):
            activated_hosts.add(host)
            continue
        if status == "terminal_stop":
            terminal_hosts.add(host)
            continue
        if status != "cycle_host_budget_exhausted":
            continue
        proof_type = str(row.get("proof_type") or "")
        proof_ref = str(row.get("proof_ref") or "")
        if proof_type not in APPROVED_PROOF_TYPES or not proof_ref:
            continue
        if int(row.get("yes_votes", 0) or 0) != 3:
            continue
        if int(row.get("required_votes", 0) or 0) != 3:
            continue
        if not bool(row.get("valid_approval_is_binding")):
            continue
        if int(row.get("min_yes_confidence", 0) or 0) < 75:
            continue
        old = pending.get(host, {})
        pending[host] = {
            "host": host,
            "requested_methods": _methods_for_host(state, host),
            "proof_type": proof_type,
            "proof_ref": proof_ref,
            "status": "approved_pending_next_frontier_cycle",
            "priority": 100,
            "approved_votes": 3,
            "binding_approvers": ["META", "X", "SENJU"],
            "min_yes_confidence": int(row.get("min_yes_confidence", 0) or 0),
            "first_approved_at": int(old.get("first_approved_at", ts) or ts),
            "last_seen_at": ts,
            "continuity_kind": KIND,
            "requires_revalidation_next_cycle": True,
        }

    for host in activated_hosts | terminal_hosts:
        pending.pop(host, None)

    pending_rows = sorted(
        pending.values(), key=lambda r: (-int(r.get("priority", 0)), str(r.get("host", "")))
    )[:MAX_PENDING]

    queue_doc = _load(state / "authority_opportunity_queue.json", {})
    raw_opps = queue_doc.get("opportunities", []) if isinstance(queue_doc, Mapping) else []
    kept = [
        dict(row) for row in raw_opps
        if isinstance(row, Mapping) and str(row.get("continuity_kind") or "") != KIND
    ] if isinstance(raw_opps, list) else []
    for row in pending_rows:
        kept.append({
            "host": row["host"],
            "requested_methods": row["requested_methods"],
            "reason": "Prior verified Owner evidence + META/X/SENJU 3/3 approval was deferred only by cycle budget; re-evaluate first next cycle.",
            "priority": 100,
            "hard_deny": False,
            "revoked": False,
            "continuity_kind": KIND,
            "proof_type_hint": row["proof_type"],
            "proof_ref_hint": row["proof_ref"],
        })

    pending_doc = {
        "schema": "senju-owner-frontier-approved-pending/v2",
        "generated_at": ts,
        "pending_count": len(pending_rows),
        "max_pending": MAX_PENDING,
        "authority_minted": False,
        "network_io_attempted": False,
        "binding_approvers": ["META", "X", "SENJU"],
        "pending": pending_rows,
    }
    out_queue = dict(queue_doc) if isinstance(queue_doc, Mapping) else {}
    out_queue.update({
        "schema": str(out_queue.get("schema") or "authority-opportunity-queue/v1"),
        "generated_at": ts,
        "opportunities": kept,
    })
    _write(state / "owner_frontier_approved_pending.json", pending_doc)
    _write(state / "authority_opportunity_queue.json", out_queue)
    return {
        "pending_count": len(pending_rows),
        "opportunity_count": len(kept),
        "authority_minted": False,
        "network_io_attempted": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", default="senju/state")
    parser.add_argument("--out")
    args = parser.parse_args()
    result = run(args.state_dir)
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
