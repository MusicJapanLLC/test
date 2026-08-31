"""Close the reviewed-Authority production lifecycle without widening authority.

Flow:
external/discovery/PR candidate -> shared authority bus -> Root negotiation ->
verified Owner evidence -> META/X/SENJU 3/3 binding approval -> independent
reviewed Authority -> bounded operational lease -> council-governed transport ->
exact-host HEAD execution -> evidence/state carried to the next cycle.

This module does not make discovery authoritative. It only leases grants already issued
by the independent authority reviewer. New-host leases are exact-host, short-lived,
credential-free, HTTPS-only, read-only, and same-or-narrower than both the reviewed grant
and the current Owner frontier ceiling.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Callable, Mapping

from .external import ExternalContactError, _normalize_host
from .negotiated_external_client import NegotiatedExternalContactClient
from .owner_scope_negotiation import derive_current_ceiling

LEASE_SCHEMA = "senju-reviewed-authority-operational-leases/v1"
STATE_SCHEMA = "senju-reviewed-authority-closed-loop/v1"
RECEIPT_SCHEMA = "senju-reviewed-authority-execution-receipts/v1"
BINDING_STATUS = "verified_owner_evidence_plus_ai_council_approved"
READ_ONLY = frozenset({"GET", "HEAD"})
MAX_HISTORY = 64
MAX_RECEIPTS = 256


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _frontier_by_host(state: Path) -> dict[str, dict[str, Any]]:
    doc = _load(state / "owner_frontier_council.json", {})
    rows = doc.get("decisions", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, dict[str, Any]] = {}
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping):
            continue
        try:
            host = _normalize_host(str(raw.get("host") or ""))
        except ExternalContactError:
            continue
        if raw.get("status") != BINDING_STATUS or raw.get("applied") is not True:
            continue
        try:
            yes = int(raw.get("yes_votes", 0) or 0)
            required = int(raw.get("required_votes", 3) or 3)
        except (TypeError, ValueError):
            continue
        if required != 3 or yes < 3:
            continue
        if not raw.get("proof_type") or not raw.get("proof_ref"):
            continue
        out[host] = dict(raw)
    return out


def _reviewed_hosts(meta_state: Path, state: Path, *, now: int) -> dict[str, dict[str, Any]]:
    candidates = (
        meta_state / "authority_reviewed_grants.json",
        state / "authority_reviewed_grants.json",
    )
    grants: dict[str, dict[str, Any]] = {}
    for path in candidates:
        doc = _load(path, {})
        rows = doc.get("hosts", {}) if isinstance(doc, Mapping) else {}
        if not isinstance(rows, Mapping):
            continue
        for raw_host, raw in rows.items():
            if not isinstance(raw, Mapping):
                continue
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            try:
                expires_at = int(raw.get("expires_at", 0) or 0)
            except (TypeError, ValueError):
                continue
            if expires_at <= now:
                continue
            if str(raw.get("credential_scope", "none")).strip().lower() != "none":
                continue
            if str(raw.get("effect", "read_only")).strip().lower() != "read_only":
                continue
            if raw.get("allow_http") is True or raw.get("allow_delete") is True:
                continue
            methods = frozenset(str(v).strip().upper() for v in raw.get("allowed_methods", ())) & READ_ONLY
            if not methods:
                continue
            grants[host] = {**dict(raw), "allowed_methods": sorted(methods), "_source": str(path)}
    return grants


def _ceiling_methods(repo_root: Path, state: Path) -> dict[str, frozenset[str]]:
    ceiling = derive_current_ceiling(repo_root, state)
    global_methods = frozenset(str(v).strip().upper() for v in ceiling.get("allowed_methods", ()))
    per_host: dict[str, frozenset[str]] = {}
    raw_per_host = ceiling.get("per_host_methods")
    if isinstance(raw_per_host, Mapping):
        for raw_host, values in raw_per_host.items():
            try:
                host = _normalize_host(str(raw_host))
            except ExternalContactError:
                continue
            per_host[host] = frozenset(str(v).strip().upper() for v in values)
    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _normalize_host(str(raw_host))
        except ExternalContactError:
            continue
        per_host.setdefault(host, global_methods)
    return per_host


def materialize_reviewed_authority_leases(
    repo_root: str | Path,
    state_dir: str | Path,
    meta_state_dir: str | Path,
    *,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    meta_state = Path(meta_state_dir)
    current = int(time.time()) if now is None else int(now)
    frontier = _frontier_by_host(state)
    reviewed = _reviewed_hosts(meta_state, state, now=current)
    ceiling = _ceiling_methods(repo, state)

    leases: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for host, grant in sorted(reviewed.items()):
        binding = frontier.get(host)
        basis = str(grant.get("authority_basis") or "")
        if basis == "binding_frontier_council" and binding is None:
            rejected.append({"host": host, "reason": "binding_frontier_approval_missing_or_stale"})
            continue
        if basis not in {"binding_frontier_council", "explicit_root"}:
            rejected.append({"host": host, "reason": "unsupported_reviewed_authority_basis"})
            continue
        allowed = frozenset(grant.get("allowed_methods", ())) & READ_ONLY
        bounded = allowed & ceiling.get(host, frozenset())
        if not bounded:
            rejected.append({"host": host, "reason": "reviewed_grant_not_present_in_current_frontier_ceiling"})
            continue
        expires_at = int(grant.get("expires_at", current) or current)
        proof_type = None
        proof_ref = None
        if binding:
            proof_type = binding.get("proof_type")
            proof_ref = binding.get("proof_ref")
        elif grant.get("binding_frontier_approval"):
            proof = grant.get("binding_frontier_approval") or {}
            proof_type = proof.get("proof_type")
            proof_ref = proof.get("proof_ref")
        digest = hashlib.sha256(
            f"{host}|{expires_at}|{','.join(sorted(bounded))}|{basis}|{proof_ref or ''}".encode("utf-8")
        ).hexdigest()[:20]
        leases.append({
            "lease_id": f"reviewed-authority:{digest}",
            "host": host,
            "status": "REVIEWED_AUTHORITY_LEASE_READY",
            "authority_basis": basis,
            "reviewer": grant.get("reviewer"),
            "reviewed_at": grant.get("reviewed_at"),
            "expires_at": expires_at,
            "allowed_methods": sorted(bounded),
            "credential_scope": "none",
            "allow_http": False,
            "allow_delete": False,
            "allow_private_network": False,
            "same_or_narrower": True,
            "frontier_binding_status": binding.get("status") if binding else None,
            "frontier_yes_votes": binding.get("yes_votes") if binding else None,
            "frontier_required_votes": binding.get("required_votes") if binding else None,
            "proof_type": proof_type,
            "proof_ref": proof_ref,
            "source_reviewed_grant": grant.get("_source"),
        })

    payload = {
        "schema": LEASE_SCHEMA,
        "generated_at": current,
        "production": True,
        "lease_count": len(leases),
        "rejected_count": len(rejected),
        "leases": leases,
        "rejected": rejected,
        "authority_minted": False,
        "authority_widened": False,
        "credentials_created": False,
        "private_network_enabled": False,
    }
    _write(state / "reviewed_authority_operational_leases.json", payload)
    return payload


def _append_receipts(state: Path, rows: list[dict[str, Any]], *, now: int) -> dict[str, Any]:
    previous = _load(state / "reviewed_authority_execution_receipts.json", {})
    prior = previous.get("receipts", ()) if isinstance(previous, Mapping) else ()
    merged = [dict(r) for r in prior if isinstance(r, Mapping)] + rows
    merged = merged[-MAX_RECEIPTS:]
    payload = {
        "schema": RECEIPT_SCHEMA,
        "generated_at": now,
        "receipt_count": len(merged),
        "receipts": merged,
    }
    _write(state / "reviewed_authority_execution_receipts.json", payload)
    return payload


def run_reviewed_authority_closed_loop(
    repo_root: str | Path,
    state_dir: str | Path,
    meta_state_dir: str | Path,
    *,
    max_exec_hosts: int = 4,
    now: int | None = None,
    client_factory: Callable[..., Any] = NegotiatedExternalContactClient,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    meta_state = Path(meta_state_dir)
    state.mkdir(parents=True, exist_ok=True)
    current = int(time.time()) if now is None else int(now)

    lease_doc = materialize_reviewed_authority_leases(repo, state, meta_state, now=current)
    client = client_factory(repo, state)
    execution_rows: list[dict[str, Any]] = []

    for lease in lease_doc["leases"][: max(0, min(int(max_exec_hosts), 8))]:
        host = str(lease["host"])
        lease_methods = frozenset(lease.get("allowed_methods", ()))
        live_methods = frozenset(getattr(client, "per_host_methods", {}).get(host, frozenset()))
        if "HEAD" not in lease_methods or "HEAD" not in live_methods:
            execution_rows.append({
                "executed_at": current,
                "host": host,
                "lease_id": lease.get("lease_id"),
                "status": "execution_skipped_policy_mismatch",
                "method": "HEAD",
                "provider_acknowledged": False,
            })
            continue
        try:
            receipt = client.contact(f"https://{host}/", method="HEAD")
        except ExternalContactError as exc:
            execution_rows.append({
                "executed_at": current,
                "host": host,
                "lease_id": lease.get("lease_id"),
                "status": "transport_error",
                "method": "HEAD",
                "provider_acknowledged": False,
                "error": str(exc)[:500],
            })
        except Exception as exc:  # network/provider failures are evidence, not authority changes
            execution_rows.append({
                "executed_at": current,
                "host": host,
                "lease_id": lease.get("lease_id"),
                "status": "provider_error",
                "method": "HEAD",
                "provider_acknowledged": False,
                "error": type(exc).__name__,
            })
        else:
            to_dict = getattr(receipt, "to_dict", None)
            raw_receipt = to_dict() if callable(to_dict) else {}
            execution_rows.append({
                "executed_at": current,
                "host": host,
                "lease_id": lease.get("lease_id"),
                "status": "contacted",
                "method": "HEAD",
                "provider_acknowledged": bool(getattr(receipt, "provider_acknowledged", False)),
                "http_status": getattr(receipt, "status", None),
                "final_host": getattr(receipt, "final_host", None),
                "receipt": raw_receipt,
            })

    receipt_doc = _append_receipts(state, execution_rows, now=current)
    prior = _load(state / "reviewed_authority_lifecycle_state.json", {})
    history = list(prior.get("history", ())) if isinstance(prior, Mapping) else []
    cycle_count = int(prior.get("cycle_count", 0) or 0) + 1 if isinstance(prior, Mapping) else 1
    cycle = {
        "cycle": cycle_count,
        "generated_at": current,
        "reviewed_lease_count": lease_doc["lease_count"],
        "execution_attempt_count": len(execution_rows),
        "contacted_count": sum(1 for row in execution_rows if row.get("status") == "contacted"),
        "provider_acknowledged_count": sum(1 for row in execution_rows if row.get("provider_acknowledged")),
        "hosts": [row.get("host") for row in execution_rows],
    }
    history.append(cycle)
    history = history[-MAX_HISTORY:]

    result = {
        "schema": STATE_SCHEMA,
        "generated_at": current,
        "production": True,
        "closed_loop": True,
        "cycle_count": cycle_count,
        "flow": [
            "external_or_discovery_or_pr_candidate",
            "shared_authority_bus",
            "root_negotiation",
            "verified_owner_evidence",
            "META_X_SENJU_3_of_3_binding_approval",
            "independent_reviewed_authority",
            "same_or_narrower_operational_lease",
            "AI_council_production_transport",
            "HEAD_execution",
            "approval_evidence_state_next_cycle",
        ],
        "reviewed_authority_lease_count": lease_doc["lease_count"],
        "execution_attempt_count": len(execution_rows),
        "contacted_count": cycle["contacted_count"],
        "provider_acknowledged_count": cycle["provider_acknowledged_count"],
        "execution": execution_rows,
        "history": history,
        "next_cycle_state": {
            "leases": "reviewed_authority_operational_leases.json",
            "receipts": "reviewed_authority_execution_receipts.json",
            "lifecycle": "reviewed_authority_lifecycle_state.json",
            "receipt_count": receipt_doc["receipt_count"],
        },
        "hard_limits": [
            "discovery_alone_never_creates_authority",
            "binding_frontier_review_or_explicit_root_required",
            "new_reviewed_hosts_are_exact_host_only",
            "GET_HEAD_only_for_reviewed_authority_leases",
            "credential_scope_none",
            "HTTPS_only",
            "private_network_disabled",
            "lease_must_be_same_or_narrower_than_current_ceiling",
            "HARD_DENY_and_revocation_are_not_bypassed",
        ],
    }
    _write(state / "reviewed_authority_lifecycle_state.json", result)
    return result
