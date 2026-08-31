"""Advance negotiated hosts into execution-ready standing-authorization leases.

This production helper sits after Owner-scope negotiation. It does not infer authority
from discovery. Instead, when an exact host is already covered by an active Standing
Authorization and META/X/SENJU unanimously support the same proposal, it immediately
materializes renewable same-or-narrower operational leases for the existing authority.

Candidates without an active exact-host standing record are persisted as promotion
packets so evidence/negotiation agents can continue working them in later cycles.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Any, Mapping

from senju.meta.standing_authorization import (
    StandingAuthorization,
    load_registry,
    renew_operational_lease,
)
from senju.owner_scope_negotiation import (
    DECISION_MEMBERS,
    OwnerExpansionEnvelope,
    _ballots_for,
    build_scope_proposals,
)

RESULT_SCHEMA = "senju-authorized-host-promotion-corps/v1"
PACKET_SCHEMA = "senju-authorized-host-promotion-packets/v1"


class AuthorizedHostPromotionError(RuntimeError):
    pass


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _host(value: object) -> str:
    host = str(value or "").strip().lower().rstrip(".")
    if not host or any(ch in host for ch in "/?#@*"):
        raise AuthorizedHostPromotionError("exact host required")
    return host


def _decision_map(state_dir: Path) -> dict[str, dict[str, Any]]:
    raw = _load(state_dir / "owner_scope_negotiation_result.json", {})
    rows = raw.get("decisions", ()) if isinstance(raw, Mapping) else ()
    return {
        str(row["proposal_id"]): dict(row)
        for row in rows if isinstance(rows, list)
        if isinstance(row, Mapping) and str(row.get("proposal_id", ""))
    }


def _standing_index(path: Path) -> dict[str, list[StandingAuthorization]]:
    out: dict[str, list[StandingAuthorization]] = {}
    for record in load_registry(path):
        if not record.is_active or record.credential_scope != "none" or record.destructive:
            continue
        for raw_host in record.exact_hosts:
            out.setdefault(_host(raw_host), []).append(record)
    return out


def _standing_for(
    index: Mapping[str, list[StandingAuthorization]],
    host: str,
    proof_ref: str,
) -> StandingAuthorization | None:
    rows = list(index.get(host, ()))
    if proof_ref:
        rows = [row for row in rows if row.authorization_reference == proof_ref]
    if not rows:
        return None
    return sorted(rows, key=lambda row: (len(row.allowed_methods), row.authorization_reference))[0]


def _lease_dict(result: Any) -> dict[str, Any]:
    return {
        "automatically_renewed": bool(result.automatically_renewed),
        "authority_broadened": bool(result.authority_broadened),
        "lease": dataclasses.asdict(result.lease),
    }


def run_promotion_corps(
    repo_root: str | Path,
    state_dir: str | Path,
    promotion_dir: str | Path,
    *,
    envelope_path: str | Path | None = None,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    out_dir = Path(promotion_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    current = now or dt.datetime.now(dt.timezone.utc)
    if current.tzinfo is None:
        raise AuthorizedHostPromotionError("now must be timezone-aware")

    config = Path(envelope_path) if envelope_path else repo / "senju" / "config" / "owner-expansion-envelope.json"
    raw_envelope = _load(config, {})
    if not isinstance(raw_envelope, Mapping):
        raise AuthorizedHostPromotionError("Owner expansion envelope unavailable")
    envelope = OwnerExpansionEnvelope.from_mapping(raw_envelope)

    proposals = build_scope_proposals(repo, state, envelope)
    decisions = _decision_map(state)
    standing = _standing_index(state / "standing_authorizations.json")
    execution_ready: list[dict[str, Any]] = []
    packets: list[dict[str, Any]] = []

    for proposal in proposals:
        decision = decisions.get(proposal.proposal_id, {})
        ballots = _ballots_for(state, proposal.proposal_id)
        by_actor = {ballot.actor: ballot for ballot in ballots}
        unanimous = all(actor in by_actor and by_actor[actor].approve for actor in DECISION_MEMBERS)
        average = (
            round(sum(by_actor[a].confidence for a in DECISION_MEMBERS) / len(DECISION_MEMBERS))
            if unanimous else 0
        )
        standing_record = _standing_for(standing, proposal.host, proposal.proof_ref)
        requested = frozenset(proposal.requested_methods)
        covered = (
            frozenset(requested & set(standing_record.allowed_methods))
            if standing_record is not None else frozenset()
        )
        packet = {
            "schema": PACKET_SCHEMA,
            "proposal_id": proposal.proposal_id,
            "host": proposal.host,
            "requested_methods": sorted(requested),
            "proof_type": proposal.proof_type,
            "proof_ref": proposal.proof_ref,
            "decision_status": decision.get("status"),
            "council_unanimous": unanimous,
            "average_yes_confidence": average,
            "standing_authorization_match": standing_record is not None,
            "standing_authorization_reference": (
                standing_record.authorization_reference if standing_record else None
            ),
            "covered_methods": sorted(covered),
            "hard_deny": proposal.hard_deny,
            "revoked": proposal.revoked,
        }

        if proposal.hard_deny or proposal.revoked or decision.get("status") == "terminal_stop":
            packets.append({**packet, "status": "BLOCKED_TERMINAL", "next_action": "respect denial or revocation"})
            continue
        if not unanimous or average < envelope.min_confidence:
            packets.append({
                **packet,
                "status": "NEGOTIATION_PENDING",
                "next_action": "META/X/SENJU continue evidence and ballot work",
            })
            continue
        if standing_record is None or proposal.proof_type != "existing_standing_authorization":
            packets.append({
                **packet,
                "status": "READY_FOR_STANDING_AUTHORIZATION",
                "next_action": "continue exact-host owner-evidence negotiation; automatically re-evaluate next cycle",
            })
            continue
        if not covered:
            packets.append({
                **packet,
                "status": "METHOD_SCOPE_MISMATCH",
                "next_action": "negotiate a method set already covered by standing authorization",
            })
            continue
        if decision.get("status") != "auto_applied_inside_owner_expansion_envelope":
            packets.append({
                **packet,
                "status": "RUNTIME_APPLY_PENDING",
                "next_action": "complete Owner-scope runtime application; automatically re-evaluate next cycle",
            })
            continue

        meta = renew_operational_lease(
            standing_record,
            actor="META",
            requested_hosts=(proposal.host,),
            requested_methods=covered,
            reason=f"promotion_corps:{proposal.proposal_id}:META_X_SENJU_3_of_3",
            now=current,
        )
        x = renew_operational_lease(
            standing_record,
            actor="X",
            requested_hosts=(proposal.host,),
            requested_methods=covered,
            reason=f"promotion_corps:{proposal.proposal_id}:META_X_SENJU_3_of_3",
            now=current,
        )
        execution_ready.append({
            **packet,
            "status": "AUTHORIZED_EXECUTION_READY",
            "authority_effect": "existing_standing_authorization_lease",
            "scope_expanded": False,
            "leases": {"META": _lease_dict(meta), "X": _lease_dict(x)},
            "shared_with": ["META", "X", "SENJU"],
            "next_action": "handoff covered exact-host work to authorized execution lanes",
        })

    result = {
        "schema": RESULT_SCHEMA,
        "generated_at": current.astimezone(dt.timezone.utc).isoformat(),
        "proposal_count": len(proposals),
        "execution_ready_count": len(execution_ready),
        "packet_count": len(packets),
        "execution_ready": execution_ready,
        "packets": packets,
        "hard_limits": [
            "discovery_alone_never_creates_authority",
            "active_exact_host_standing_authorization_required",
            "META_X_SENJU_unanimous_consensus_required",
            "lease_hosts_and_methods_must_be_same_or_narrower",
            "revocation_and_hard_deny_are_terminal",
            "no_new_credentials_or_private_network_scope",
        ],
    }
    _write(out_dir / "promotion_packets.json", {"schema": PACKET_SCHEMA, "packets": packets})
    _write(out_dir / "execution_ready.json", {
        "schema": "senju-authorized-host-execution-ready/v1",
        "records": execution_ready,
    })
    _write(out_dir / "last_promotion_cycle.json", result)
    return result
