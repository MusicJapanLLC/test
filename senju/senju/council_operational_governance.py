"""Transparent production operational governance for META/X/SENJU.

This layer deliberately separates *operational policy control* from authority creation.
For already-authorized exact public hosts, META/X/SENJU may unanimously tune a broad set
of production transport parameters without asking an Owner process to approve each knob.

The council can:
- narrow/restore methods that are already present in the current authority ceiling;
- enable/disable redirect following while every hop remains revalidated;
- tune redirect count, retries, retry backoff, timeout, and request/response budgets.

The council cannot:
- add a new host;
- add a method absent from the current authority ceiling for that host;
- introduce credentials, private-network access, HTTP, DELETE, or authority inheritance;
- override revocation/HARD_DENY.

Every accepted/rejected proposal and the complete mutable bounds are persisted so the
real production decision surface is inspectable instead of being hidden in Owner-only
logic.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Mapping

from .owner_scope_negotiation import DECISION_MEMBERS, _host, _methods, derive_current_ceiling

SCHEMA = "senju-council-operational-governance/v1"
POLICY_SCHEMA = "senju-council-operational-policy/v1"
MIN_CONFIDENCE = 70
MUTABLE_BOUNDS = {
    "follow_redirects": {"type": "boolean"},
    "max_redirects": {"min": 0, "max": 5},
    "retries": {"min": 0, "max": 5},
    "retry_backoff_seconds": {"min": 0.0, "max": 5.0},
    "timeout_seconds": {"min": 0.5, "max": 20.0},
    "max_request_bytes": {"min": 1024, "max": 1024 * 1024},
    "max_response_bytes": {"min": 1024, "max": 10 * 1024 * 1024},
    "per_host_methods": {
        "rule": "subset_of_current_exact_host_methods",
        "system_forbidden_additions": ["DELETE"],
    },
}
IMMUTABLE_AUTHORITY_DIMENSIONS = (
    "exact_hosts",
    "credential_scope",
    "allow_private_network",
    "allow_http",
    "allow_delete",
    "authority_inheritance",
)


class CouncilOperationalGovernanceError(RuntimeError):
    pass


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _current_per_host(ceiling: Mapping[str, Any]) -> dict[str, set[str]]:
    global_methods = set(_methods(ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS"))))
    out: dict[str, set[str]] = {}
    raw = ceiling.get("per_host_methods")
    if isinstance(raw, Mapping):
        for raw_host, values in raw.items():
            try:
                out[_host(raw_host)] = set(_methods(values))
            except Exception:
                continue
    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _host(raw_host)
        except Exception:
            continue
        out.setdefault(host, set(global_methods))
    return out


def _ballots(state: Path, proposal_id: str) -> dict[str, dict[str, Any]]:
    doc = _load(state / "council_operational_ballots.json", {})
    by_proposal = doc.get("ballots_by_proposal", {}) if isinstance(doc, Mapping) else {}
    rows = by_proposal.get(proposal_id, ()) if isinstance(by_proposal, Mapping) else ()
    out: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        actor = str(raw.get("actor") or "").strip().upper()
        if actor not in DECISION_MEMBERS:
            continue
        out[actor] = {
            "approve": bool(raw.get("approve")),
            "confidence": max(0, min(int(raw.get("confidence", 0)), 100)),
            "reason": " ".join(str(raw.get("reason") or "").split())[:300],
        }
    return out


def _bounded_number(name: str, value: Any, *, integer: bool) -> int | float:
    bounds = MUTABLE_BOUNDS[name]
    try:
        parsed = int(value) if integer else float(value)
    except (TypeError, ValueError) as exc:
        raise CouncilOperationalGovernanceError(f"invalid {name}") from exc
    low = bounds["min"]
    high = bounds["max"]
    if parsed < low or parsed > high:
        raise CouncilOperationalGovernanceError(f"{name} outside transparent system bounds {low}..{high}")
    return parsed


def _apply_changes(
    current: Mapping[str, Any],
    effective: dict[str, Any],
    requested: Mapping[str, Any],
) -> dict[str, Any]:
    for forbidden in IMMUTABLE_AUTHORITY_DIMENSIONS:
        if forbidden in requested:
            raise CouncilOperationalGovernanceError(
                f"{forbidden} is an authority dimension, not a council operational dimension"
            )

    if "follow_redirects" in requested:
        effective["follow_redirects"] = bool(requested["follow_redirects"])
    if "max_redirects" in requested:
        effective["max_redirects"] = _bounded_number("max_redirects", requested["max_redirects"], integer=True)
    if "retries" in requested:
        effective["retries"] = _bounded_number("retries", requested["retries"], integer=True)
    if "retry_backoff_seconds" in requested:
        effective["retry_backoff_seconds"] = _bounded_number(
            "retry_backoff_seconds", requested["retry_backoff_seconds"], integer=False
        )
    if "timeout_seconds" in requested:
        effective["timeout_seconds"] = _bounded_number("timeout_seconds", requested["timeout_seconds"], integer=False)
    if "max_request_bytes" in requested:
        effective["max_request_bytes"] = _bounded_number("max_request_bytes", requested["max_request_bytes"], integer=True)
    if "max_response_bytes" in requested:
        effective["max_response_bytes"] = _bounded_number("max_response_bytes", requested["max_response_bytes"], integer=True)

    if "per_host_methods" in requested:
        raw = requested["per_host_methods"]
        if not isinstance(raw, Mapping):
            raise CouncilOperationalGovernanceError("per_host_methods must be an object")
        current_per_host = _current_per_host(current)
        next_per_host = {host: set(methods) for host, methods in _current_per_host(effective).items()}
        for raw_host, values in raw.items():
            host = _host(raw_host)
            if host not in current_per_host:
                raise CouncilOperationalGovernanceError(f"council cannot add unauthorized host: {host}")
            methods = set(_methods(values))
            if "DELETE" in methods:
                raise CouncilOperationalGovernanceError("DELETE is not council-operationally addable")
            if not methods.issubset(current_per_host[host]):
                extra = sorted(methods - current_per_host[host])
                raise CouncilOperationalGovernanceError(
                    f"council cannot add methods outside current host authority for {host}: {extra}"
                )
            next_per_host[host] = methods
        effective["per_host_methods"] = {host: sorted(methods) for host, methods in sorted(next_per_host.items())}
        effective["allowed_methods"] = sorted({m for methods in next_per_host.values() for m in methods})

    return effective


def run_council_operational_governance(
    repo_root: str | Path,
    state_dir: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current_time = int(time.time()) if now is None else int(now)
    current = derive_current_ceiling(repo, state)
    effective = dict(current)
    effective.setdefault("follow_redirects", True)
    effective.setdefault("max_redirects", 5)
    effective.setdefault("retries", 5)
    effective.setdefault("retry_backoff_seconds", 0.25)
    effective.setdefault("timeout_seconds", 20.0)
    effective.setdefault("max_request_bytes", 64 * 1024)
    effective.setdefault("max_response_bytes", 10 * 1024 * 1024)

    doc = _load(state / "council_operational_proposals.json", {})
    rows = doc.get("proposals", ()) if isinstance(doc, Mapping) else ()
    decisions: list[dict[str, Any]] = []
    applied_by: list[dict[str, Any]] = []

    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        proposal_id = str(raw.get("proposal_id") or "").strip()
        if not proposal_id:
            continue
        base = {"proposal_id": proposal_id, "requested_changes": raw.get("changes", {})}
        if raw.get("revoked") is True or raw.get("hard_deny") is True:
            decisions.append({**base, "status": "terminal_stop", "applied": False})
            continue
        ballots = _ballots(state, proposal_id)
        unanimous = all(actor in ballots and ballots[actor]["approve"] for actor in DECISION_MEMBERS)
        avg = (
            round(sum(ballots[actor]["confidence"] for actor in DECISION_MEMBERS) / len(DECISION_MEMBERS))
            if unanimous else 0
        )
        if not unanimous or avg < MIN_CONFIDENCE:
            decisions.append({
                **base,
                "status": "council_consensus_pending",
                "applied": False,
                "council_unanimous": unanimous,
                "average_confidence": avg,
            })
            continue
        changes = raw.get("changes", {})
        if not isinstance(changes, Mapping):
            decisions.append({**base, "status": "invalid_proposal", "applied": False, "reason": "changes must be an object"})
            continue
        try:
            effective = _apply_changes(current, effective, changes)
        except CouncilOperationalGovernanceError as exc:
            decisions.append({
                **base,
                "status": "rejected_outside_operational_governance",
                "applied": False,
                "reason": str(exc),
                "council_unanimous": True,
                "average_confidence": avg,
            })
            continue
        approval = {
            "proposal_id": proposal_id,
            "approved_by": list(DECISION_MEMBERS),
            "average_confidence": avg,
        }
        applied_by.append(approval)
        decisions.append({
            **base,
            "status": "applied_by_META_X_SENJU_consensus",
            "applied": True,
            "council_unanimous": True,
            "average_confidence": avg,
        })

    policy = {
        "schema": POLICY_SCHEMA,
        "generated_at": current_time,
        "production": True,
        "governance_model": "META_X_SENJU_unanimous_operational_control",
        "authority_source": "current_exact_host_authority_ceiling",
        "owner_per_change_approval_required": False,
        "decision_members": list(DECISION_MEMBERS),
        "minimum_confidence": MIN_CONFIDENCE,
        "transparent_mutable_bounds": MUTABLE_BOUNDS,
        "immutable_authority_dimensions": list(IMMUTABLE_AUTHORITY_DIMENSIONS),
        "effective_policy": effective,
        "applied_proposals": applied_by,
    }
    result = {
        "schema": SCHEMA,
        "generated_at": current_time,
        "production": True,
        "proposal_count": len(rows) if isinstance(rows, list) else 0,
        "applied_count": sum(1 for d in decisions if d.get("applied")),
        "rejected_count": sum(1 for d in decisions if d.get("status") == "rejected_outside_operational_governance"),
        "decisions": decisions,
        "policy": policy,
    }
    _write(state / "council_operational_policy.json", policy)
    _write(state / "council_operational_governance_result.json", result)
    return result
