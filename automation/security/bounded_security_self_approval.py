#!/usr/bin/env python3
"""Bounded production Security Self-Approval for The World.

This runner gives the AI council a real self-approval path for security proposals that
move monotonically toward *more* restriction or stronger recovery/audit guarantees.
It never approves authority expansion, guard weakening, emergency-stop disablement,
credential export, or network-boundary broadening.

The output is intended to be consumed by the unified production loop and its Trust Root
lineage attestation.  It is an approval/apply decision artifact; it does not mint a new
trust root and does not persist credentials.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

SCHEMA = "the-world-bounded-security-self-approval/v1"
PRODUCTION_NAMESPACE = "MusicJapanLLC/test"
REQUIRED_COUNCIL = ("META", "X", "Senju")

# Only monotonic security operations may be self-approved. Unknown operations are denied.
MONOTONIC_OPERATIONS = {
    "tighten_rule",
    "require_approval",
    "require_rotation",
    "reduce_rate_limit",
    "increase_coverage",
    "require_checks",
    "enable_rollback",
    "require_fresh_validation",
    "lock_stop_disable",
    "require_integrity_check",
    "revoke",
    "restrict_scope",
    "reduce_limit",
    "shorten_ttl",
    "require_mfa",
    "require_signature",
    "require_attestation",
}


def _load(path: str | Path) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _active_root(bindings: dict[str, Any]) -> dict[str, Any] | None:
    records = bindings.get("records", [])
    if not isinstance(records, list):
        return None
    for row in records:
        if not isinstance(row, dict):
            continue
        if row.get("revoked") is True:
            continue
        if row.get("owner") != "MusicJapanLLC":
            continue
        if not str(row.get("root_id", "")).strip():
            continue
        return row
    return None


def evaluate_security_proposal(proposal: dict[str, Any], bindings: dict[str, Any]) -> dict[str, Any]:
    root = _active_root(bindings)
    changes = proposal.get("changes", []) if isinstance(proposal.get("changes"), list) else []
    votes = proposal.get("council_votes", {}) if isinstance(proposal.get("council_votes"), dict) else {}

    approved_ops: list[dict[str, str]] = []
    rejected_ops: list[dict[str, str]] = []
    for change in changes:
        if not isinstance(change, dict):
            rejected_ops.append({"target": "unknown", "operation": "invalid_change"})
            continue
        target = str(change.get("target", "")).strip()
        operations = change.get("operations", []) if isinstance(change.get("operations"), list) else []
        if not target or not operations:
            rejected_ops.append({"target": target or "unknown", "operation": "missing_operation"})
            continue
        for operation in operations:
            if not isinstance(operation, dict):
                rejected_ops.append({"target": target, "operation": "invalid_operation"})
                continue
            op_type = str(operation.get("type", "")).strip()
            row = {"target": target, "operation": op_type or "missing_type"}
            if op_type in MONOTONIC_OPERATIONS:
                approved_ops.append(row)
            else:
                rejected_ops.append(row)

    council = {
        actor: bool(isinstance(votes.get(actor), dict) and votes[actor].get("approve") is True)
        for actor in REQUIRED_COUNCIL
    }
    council_unanimous = all(council.values())
    namespace_ok = proposal.get("environment") == "production" and proposal.get("owner_namespace") == PRODUCTION_NAMESPACE
    root_ok = root is not None
    operations_ok = bool(approved_ops) and not rejected_ops
    approved = namespace_ok and root_ok and council_unanimous and operations_ok

    return {
        "schema": SCHEMA,
        "generated_at": int(time.time()),
        "production": True,
        "proposal_id": str(proposal.get("id", "")),
        "owner_namespace": PRODUCTION_NAMESPACE,
        "trust_root_id": str(root.get("root_id")) if root else None,
        "standing_authorization_reference": str(root.get("standing_authorization_reference")) if root else None,
        "mode": "monotonic_security_self_approval",
        "approved": approved,
        "applied": approved,
        "effect": "self_approved_monotonic" if approved else "external_approval_required",
        "council": council,
        "council_unanimous": council_unanimous,
        "operation_count": len(approved_ops) + len(rejected_ops),
        "approved_operations": approved_ops,
        "rejected_operations": rejected_ops,
        "invariants": {
            "new_trust_root_created": False,
            "authority_expanded": False,
            "network_boundary_broadened": False,
            "credential_scope_broadened": False,
            "raw_credential_persisted": False,
            "guard_weakened": False,
            "emergency_stop_weakened": False,
            "revocation_overridden": False,
            "unknown_operation_self_approved": False,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Approve only monotonic production security proposals")
    parser.add_argument("--proposal", required=True)
    parser.add_argument("--bindings", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    result = evaluate_security_proposal(_load(args.proposal), _load(args.bindings))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["approved"] and result["applied"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
