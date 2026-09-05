"""Bridge newly issued Authorization handoffs into the reviewed promotion lease feed.

This closes the process gap between negotiation/discovery-originated Authorization
issuance and the existing Authority Promotion Bureau. The bridge is deliberately
same-or-narrower: it never creates Authorization, never widens method/credential
scope, and never copies credential values.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "senju-authorization-handoff-bridge/v1"
LEASE_SCHEMA = "senju-reviewed-authority-operational-leases/v1"
PROMOTION_METHODS = frozenset({"GET", "HEAD"})


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: Any) -> str:
    return str(value or "").strip().lower().rstrip(".")


def _epoch_from_iso(value: Any) -> int | None:
    from datetime import datetime, timezone

    try:
        dt = datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.astimezone(timezone.utc).timestamp())


def bridge_authorization_handoffs(
    state_dir: str | Path,
    *,
    handoff_file: str = "negotiation_authorization_handoffs.json",
    lease_file: str = "reviewed_authority_operational_leases.json",
) -> dict[str, Any]:
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)

    handoff_doc = _load(state / handoff_file, {})
    lease_doc = _load(state / lease_file, {})
    handoffs = handoff_doc.get("handoffs", []) if isinstance(handoff_doc, Mapping) else []
    existing = lease_doc.get("leases", []) if isinstance(lease_doc, Mapping) else []

    leases_by_host: dict[str, dict[str, Any]] = {}
    for row in existing if isinstance(existing, list) else []:
        if isinstance(row, Mapping) and _host(row.get("host")):
            leases_by_host[_host(row.get("host"))] = dict(row)

    bridged = 0
    skipped = 0
    for packet in handoffs if isinstance(handoffs, list) else []:
        if not isinstance(packet, Mapping):
            skipped += 1
            continue
        auth = packet.get("authorization")
        requested = packet.get("requested_authority")
        if not isinstance(auth, Mapping) or not isinstance(requested, Mapping):
            skipped += 1
            continue
        if str(auth.get("authority_effect") or "") != "authorization_issued":
            skipped += 1
            continue
        if auth.get("private_network") is True:
            skipped += 1
            continue

        host = _host(auth.get("host"))
        if not host or host != _host(requested.get("host")):
            skipped += 1
            continue

        requested_methods = {str(v).upper() for v in auth.get("allowed_methods", []) if str(v).strip()}
        methods = sorted(requested_methods & PROMOTION_METHODS)
        if not methods:
            skipped += 1
            continue

        # The existing Authority Promotion Bureau accepts credential-free reviewed
        # leases only. Credential-bearing synthetic test lanes remain separate;
        # admitting them here would create a false-positive bridge that Promotion
        # immediately filters out and could replace a valid credential-free lease.
        credential_scope = str(auth.get("credential_scope") or "none").strip().lower()
        if credential_scope != "none":
            skipped += 1
            continue

        expires_at = _epoch_from_iso(auth.get("expires_at"))
        authorization_id = str(auth.get("authorization_id") or "").strip()
        if expires_at is None or not authorization_id:
            skipped += 1
            continue

        candidate = {
            "lease_id": f"authorization-handoff:{authorization_id}",
            "authorization_id": authorization_id,
            "host": host,
            "expires_at": expires_at,
            "same_or_narrower": True,
            "credential_scope": "none",
            "allow_http": False,
            "allow_delete": False,
            "allow_private_network": False,
            "allowed_methods": methods,
            "authority_basis": auth.get("authorization_basis"),
            "proof_ref": auth.get("proof_ref"),
            "transport_eligible": True,
            "source": "authorization_handoff_bridge",
        }

        prior = leases_by_host.get(host)
        if prior is not None:
            prior_expiry = int(prior.get("expires_at") or 0)
            if prior_expiry >= expires_at and set(prior.get("allowed_methods", [])) >= set(methods):
                skipped += 1
                continue
        leases_by_host[host] = candidate
        bridged += 1

    leases = sorted(leases_by_host.values(), key=lambda row: row["host"])
    out = {
        "schema": LEASE_SCHEMA,
        "lease_count": len(leases),
        "leases": leases,
        "source": "owner_authorization_pool+authorization_handoff_bridge",
    }
    _write(state / lease_file, out)

    result = {
        "schema": SCHEMA,
        "input_handoff_count": len(handoffs) if isinstance(handoffs, list) else 0,
        "bridged_count": bridged,
        "skipped_count": skipped,
        "reviewed_lease_count": len(leases),
        "closed_loop": True,
        "flow": [
            "formal_intake",
            "review_key",
            "authorization_issued",
            "reviewed_operational_lease",
            "authority_promotion_bureau",
        ],
    }
    _write(state / "authorization_handoff_bridge.json", result)
    return result
