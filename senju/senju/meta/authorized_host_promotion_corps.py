"""Advance negotiated hosts into execution-ready standing-authorization leases.

This production helper sits after Owner-scope negotiation. It also consumes the shared
negotiation evidence bundle produced by the authority collaboration bus so Promotion,
META, X, SENJU, PR-ARMY, CHILD, and AI reason from the same host context.

The corps also consumes the shared negotiation-intelligence context so each promotion
packet carries cross-agent evidence, producer lineage, priority, and non-secret auth
metadata. Candidates without an active exact-host standing record are persisted as
promotion packets so evidence/negotiation agents can continue working them later.
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

RESULT_SCHEMA = "senju-authorized-host-promotion-corps/v2"
PACKET_SCHEMA = "senju-authorized-host-promotion-packets/v2"
SHARED_WITH = (
    "META",
    "X",
    "SENJU",
    "CHILD",
    "AI",
    "PR-ARMY",
    "ROOT-NEGOTIATION",
    "AUTHORIZED-SITE-ACCELERATOR",
)
COORDINATION_CAPABILITIES = {
    "may_read_shared_negotiation_intelligence": True,
    "may_correlate_cross_agent_evidence": True,
    "may_raise_internal_priority": True,
    "may_publish_promotion_feedback": True,
    "may_request_re_review_and_retest": True,
    "may_materialize_same_or_narrower_existing_authority_leases": True,
    "may_emit_authorized_execution_handoff": True,
    "may_mint_new_external_authority": False,
    "may_access_raw_credentials": False,
    "may_override_revocation_or_hard_deny": False,
}


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


def _collaboration_index(shared_dir: Path | None) -> dict[str, dict[str, Any]]:
    if shared_dir is None:
        return {}
    doc = _load(shared_dir / "collaboration_context.json", {})
    rows = doc.get("hosts", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else ():
        if not isinstance(row, Mapping):
            continue
        try:
            host = _host(row.get("host"))
        except AuthorizedHostPromotionError:
            continue
        out[host] = {
            "priority": max(1, min(int(row.get("priority", 70) or 70), 100)),
        }
    return out


def _collaboration_context(index: dict[str, dict[str, Any]], host: str) -> dict[str, Any]:
    return index.get(host, {"priority": 70})


def _intelligence_index(promotion_dir: Path) -> dict[str, dict[str, Any]]:
    doc = _load(promotion_dir / "promotion_context.json", {})
    rows = doc.get("hosts", ()) if isinstance(doc, Mapping) else ()
    out: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else ():
        if not isinstance(row, Mapping):
            continue
        try:
            host = _host(row.get("host"))
        except AuthorizedHostPromotionError:
            continue
        out[host] = {
            "priority": max(1, min(int(row.get("priority", 70) or 70), 100)),
            "evidence_count": max(0, int(row.get("evidence_count", 0) or 0)),
            "source_files": list(row.get("source_files", []))[:24] if isinstance(row.get("source_files"), list) else [],
            "source_refs": list(row.get("source_refs", []))[:40] if isinstance(row.get("source_refs"), list) else [],
            "producers": list(row.get("producers", []))[:24] if isinstance(row.get("producers"), list) else [],
            "statuses": list(row.get("statuses", []))[:24] if isinstance(row.get("statuses"), list) else [],
            "reasons": list(row.get("reasons", []))[:12] if isinstance(row.get("reasons"), list) else [],
            "auth_contexts": list(row.get("auth_contexts", []))[:8] if isinstance(row.get("auth_contexts"), list) else [],
        }
    return out


def _lease_dict(result: Any) -> dict[str, Any]:
    return {
        "automatically_renewed": bool(result.automatically_renewed),
        "authority_broadened": bool(result.authority_broadened),
        "lease": dataclasses.asdict(result.lease),
    }


def _priority(
    intelligence: Mapping[str, Any],
    *,
    unanimous: bool,
    standing_match: bool,
    runtime_applied: bool,
) -> int:
    value = int(intelligence.get("priority", 70) or 70)
    if unanimous:
        value = max(value, 88)
    if standing_match:
        value = max(value, 94)
    if unanimous and standing_match and runtime_applied:
        value = 100
    return max(1, min(value, 100))


def run_promotion_corps(
    repo_root: str | Path,
    state_dir: str | Path,
    promotion_dir: str | Path,
    *,
    envelope_path: str | Path | None = None,
    collaboration_dir: str | Path | None = None,
    now: dt.datetime | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    out_dir = Path(promotion_dir)
    shared_dir = Path(collaboration_dir) if collaboration_dir else None
    out_dir.mkdir(parents=True, exist_ok=True)
    current = now or dt.datetime.now(dt.timezone.utc)
    if current.tzinfo is None:
        raise AuthorizedHostPromotionError("now must be timezone-aware")

    config = Path(envelope_path) if envelope_path else repo / "senju" / "config" / "owner-expansion-envelope.json"
    raw_envelope = _load(config, {})
    if not isinstance(raw_envelope, Mapping):
        raise AuthorizedHostPromotionError("Owner expansion envelope unavailable")
    envelope = OwnerExpansionEnvelope.from_mapping(raw_envelope)

    collaboration = _collaboration_index(shared_dir)
    proposals = build_scope_proposals(repo, state, envelope)
    proposals.sort(key=lambda proposal: (-int(_collaboration_context(collaboration, proposal.host)["priority"]), proposal.host, proposal.proposal_id))
    decisions = _decision_map(state)
    standing = _standing_index(state / "standing_authorizations.json")
    intelligence = _intelligence_index(out_dir)
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
        intel = intelligence.get(proposal.host, {})
        runtime_applied = decision.get("status") == "auto_applied_inside_owner_expansion_envelope"
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
            "standing_allowed_methods": sorted(standing_record.allowed_methods) if standing_record else [],
            "covered_methods": sorted(covered),
            "hard_deny": proposal.hard_deny,
            "revoked": proposal.revoked,
            "promotion_priority": _priority(
                intel,
                unanimous=unanimous,
                standing_match=standing_record is not None,
                runtime_applied=runtime_applied,
            ),
            "intelligence_context": {
                "evidence_count": int(intel.get("evidence_count", 0) or 0),
                "source_files": list(intel.get("source_files", [])),
                "source_refs": list(intel.get("source_refs", [])),
                "producers": list(intel.get("producers", [])),
                "statuses": list(intel.get("statuses", [])),
                "reasons": list(intel.get("reasons", [])),
                "auth_contexts": list(intel.get("auth_contexts", [])),
                "raw_credentials_forwarded": False,
            },
            "shared_with": list(SHARED_WITH),
            "coordination_capabilities": dict(COORDINATION_CAPABILITIES),
        }

        if proposal.hard_deny or proposal.revoked or decision.get("status") == "terminal_stop":
            packets.append({**packet, "status": "BLOCKED_TERMINAL", "next_action": "respect denial or revocation and propagate terminal evidence to every negotiation agent"})
            continue
        if not unanimous or average < envelope.min_confidence:
            packets.append({
                **packet,
                "status": "NEGOTIATION_PENDING",
                "next_action": "META/X/SENJU continue evidence and ballot work using shared intelligence context",
            })
            continue
        if standing_record is None or proposal.proof_type != "existing_standing_authorization":
            packets.append({
                **packet,
                "status": "READY_FOR_STANDING_AUTHORIZATION",
                "next_action": "continue exact-host evidence negotiation; feed Promotion Corps context back to all negotiators",
            })
            continue
        if not covered:
            packets.append({
                **packet,
                "status": "METHOD_SCOPE_MISMATCH",
                "next_action": "negotiate a same-or-narrower method set already covered by standing authorization",
            })
            continue
        if not runtime_applied:
            packets.append({
                **packet,
                "status": "RUNTIME_APPLY_PENDING",
                "next_action": "complete Owner-scope runtime application and publish the blocker/result to shared negotiation memory",
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
            "promotion_priority": 100,
            "leases": {"META": _lease_dict(meta), "X": _lease_dict(x)},
            "execution_capability_matrix": {
                "exact_host": proposal.host,
                "standing_methods": sorted(standing_record.allowed_methods),
                "granted_methods": sorted(covered),
                "autonomous_lease_renewers": ["META", "X"],
                "shared_execution_context": list(SHARED_WITH),
                "same_or_narrower_only": True,
            },
            "next_action": "handoff covered exact-host work to authorized execution lanes and publish outcome back to negotiators",
        })

    execution_ready.sort(key=lambda row: (-int(row.get("promotion_priority", 0)), str(row.get("host", ""))))
    packets.sort(key=lambda row: (-int(row.get("promotion_priority", 0)), str(row.get("host", ""))))
    result = {
        "schema": RESULT_SCHEMA,
        "generated_at": current.astimezone(dt.timezone.utc).isoformat(),
        "proposal_count": len(proposals),
        "intelligence_host_count": len(intelligence),
        "execution_ready_count": len(execution_ready),
        "packet_count": len(packets),
        "execution_ready": execution_ready,
        "packets": packets,
        "shared_with": list(SHARED_WITH),
        "coordination_capabilities": dict(COORDINATION_CAPABILITIES),
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
        "schema": "senju-authorized-host-execution-ready/v2",
        "records": execution_ready,
    })
    _write(out_dir / "last_promotion_cycle.json", result)
    return result
