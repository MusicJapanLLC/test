"""Runtime-safe application layer for Owner-scope negotiation.

The base negotiation module discovers proposals and materializes the all-agent campaign.
This runtime layer applies approved amendments with per-host method ceilings.

Unverified/new-host proposals may enter the deterministic 0.1% passive metadata trial.
A selected new host that also has explicit Owner verification evidence may instead receive
a short-lived exact-host execution trial for requested POST/PUT/PATCH methods. That trial
is written to a separate runtime capability file and never mutates the Authority ceiling.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Iterable

from .discovery_trial_gate import issue_trial_ticket
from .owner_scope_negotiation import (
    DECISION_MEMBERS,
    OwnerExpansionEnvelope,
    ScopeProposal,
    _ballots_for,
    _host,
    _methods,
    _write,
    build_scope_proposals,
    derive_current_ceiling,
    materialize_negotiation_campaign,
)

SAFE_RUNTIME_AUTO_PROOF_TYPES = frozenset({"existing_standing_authorization"})


def _initial_per_host_methods(ceiling: dict[str, Any]) -> dict[str, set[str]]:
    global_methods = set(_methods(ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS"))))
    raw = ceiling.get("per_host_methods")
    out: dict[str, set[str]] = {}
    if isinstance(raw, dict):
        for raw_host, values in raw.items():
            try:
                host = _host(raw_host)
                out[host] = set(_methods(values))
            except Exception:
                continue
    for raw_host in ceiling.get("exact_hosts", ()):
        host = _host(raw_host)
        out.setdefault(host, set(global_methods))
    return out


def _trial_or_review(
    proposal: ScopeProposal,
    *,
    yes_votes: int,
    yes_confidence: int,
    envelope: OwnerExpansionEnvelope,
    base: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    unanimous = yes_votes == len(DECISION_MEMBERS)
    ticket = issue_trial_ticket(
        proposal,
        unanimous_council=unanimous,
        average_yes_confidence=yes_confidence,
        min_confidence=envelope.min_confidence,
    )
    if ticket.selected:
        if ticket.active_capability:
            return {
                **base,
                "status": "owner_verified_active_trial_selected",
                "applied": False,
                "reason": (
                    "0.1% trial selected with explicit Owner verification; short-lived exact-host "
                    "execution capability created without minting Authority"
                ),
                "trial_ticket": ticket.to_dict(),
            }
        return {
            **base,
            "status": "passive_public_metadata_trial_selected",
            "applied": False,
            "reason": "0.1% discovery trial selected after unanimous META/X/SENJU review; no authority was minted",
            "trial_ticket": ticket.to_dict(),
        }
    return {
        **base,
        "status": "owner_review_requested",
        "applied": False,
        "reason": reason,
        "trial_ticket": ticket.to_dict(),
    }


def _active_trial_grants(decisions: list[dict[str, Any]], current_time: int) -> list[dict[str, Any]]:
    grants: list[dict[str, Any]] = []
    for decision in decisions:
        if decision.get("status") != "owner_verified_active_trial_selected":
            continue
        ticket = decision.get("trial_ticket")
        if not isinstance(ticket, dict) or ticket.get("active_capability") is not True:
            continue
        ttl = max(1, min(int(ticket.get("expires_in_seconds", 600) or 600), 600))
        methods = [
            str(method).upper()
            for method in ticket.get("allowed_methods", ())
            if str(method).upper() in {"HEAD", "POST", "PUT", "PATCH"}
        ]
        if not methods:
            continue
        grants.append({
            "host": decision.get("host"),
            "proposal_id": decision.get("proposal_id"),
            "proof_type": decision.get("proof_type"),
            "proof_ref": decision.get("proof_ref"),
            "verified_owner_evidence": True,
            "allowed_methods": sorted(set(methods)),
            "credential_scope": "caller_supplied_existing",
            "private_network": False,
            "redirect_trust_inheritance": False,
            "authority_effect": False,
            "issued_at": current_time,
            "expires_at": current_time + ttl,
        })
    return grants


def evaluate_and_apply_per_host(
    repo_root: str | Path,
    state_dir: str | Path,
    envelope: OwnerExpansionEnvelope,
    proposals: Iterable[ScopeProposal],
    *,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current_time = int(time.time()) if now is None else int(now)
    ceiling = derive_current_ceiling(repo, state)
    per_host = _initial_per_host_methods(ceiling)
    hosts = set(per_host)
    decisions: list[dict[str, Any]] = []

    for proposal in proposals:
        ballots = _ballots_for(state, proposal.proposal_id)
        yes = [b for b in ballots if b.approve]
        yes_conf = round(sum(b.confidence for b in yes) / len(yes)) if yes else 0
        base = {
            "proposal_id": proposal.proposal_id,
            "host": proposal.host,
            "proof_type": proposal.proof_type,
            "proof_ref": proposal.proof_ref,
            "yes_votes": len(yes),
            "average_yes_confidence": yes_conf,
        }
        if proposal.hard_deny or proposal.revoked:
            decisions.append({**base, "status": "terminal_stop", "applied": False, "reason": "HARD_DENY/revocation remains terminal"})
            continue

        full_council = len(yes) == len(DECISION_MEMBERS) and yes_conf >= envelope.min_confidence

        # Unverified discovery may keep learning through the passive trial lane, but it
        # never receives credentials, write capability, private-network access, or scope.
        if proposal.proof_type not in envelope.proof_types:
            if proposal.proof_type == "unverified_discovery" and full_council:
                decisions.append(_trial_or_review(
                    proposal,
                    yes_votes=len(yes),
                    yes_confidence=yes_conf,
                    envelope=envelope,
                    base=base,
                    reason="scope request is outside the Owner Expansion Envelope; trial not selected",
                ))
            else:
                decisions.append({**base, "status": "owner_review_requested", "applied": False, "reason": "outside Owner Expansion Envelope"})
            continue

        if len(yes) < envelope.decision_quorum or yes_conf < envelope.min_confidence:
            decisions.append({**base, "status": "council_negotiation_pending", "applied": False, "reason": "META/X/SENJU quorum or confidence not met"})
            continue

        if proposal.proof_type not in envelope.auto_apply_proof_types:
            decisions.append(_trial_or_review(
                proposal,
                yes_votes=len(yes),
                yes_confidence=yes_conf,
                envelope=envelope,
                base=base,
                reason="proof type is negotiable but not auto-applicable; trial not selected",
            ))
            continue

        if proposal.proof_type not in SAFE_RUNTIME_AUTO_PROOF_TYPES:
            decisions.append(_trial_or_review(
                proposal,
                yes_votes=len(yes),
                yes_confidence=yes_conf,
                envelope=envelope,
                base=base,
                reason="runtime auto-apply requires active Owner standing authorization; trial not selected",
            ))
            continue

        is_new = proposal.host not in hosts
        if is_new:
            decisions.append(_trial_or_review(
                proposal,
                yes_votes=len(yes),
                yes_confidence=yes_conf,
                envelope=envelope,
                base=base,
                reason="new exact host cannot be activated until Owner standing authorization exists; trial not selected",
            ))
            continue

        current_methods = per_host.setdefault(proposal.host, set(envelope.new_host_methods))
        current_methods.update(proposal.requested_methods & envelope.existing_host_method_ceiling)
        decisions.append({
            **base,
            "status": "auto_applied_inside_owner_expansion_envelope",
            "applied": True,
            "new_host": False,
            "effective_host_methods": sorted(per_host[proposal.host]),
        })

    global_methods = sorted({method for methods in per_host.values() for method in methods} or {"GET", "HEAD", "OPTIONS"})
    effective = dict(ceiling)
    effective.update({
        "ceiling_id": f"{ceiling.get('ceiling_id', 'owner')}:negotiated:{envelope.envelope_id}",
        "exact_hosts": sorted(hosts),
        "allowed_methods": global_methods,
        "per_host_methods": {host: sorted(per_host[host]) for host in sorted(per_host)},
        "allow_http": bool(ceiling.get("allow_http", False)) and envelope.allow_http,
        "allow_delete": bool(ceiling.get("allow_delete", False)) and envelope.allow_delete,
    })

    active_trials = _active_trial_grants(decisions, current_time)
    _write(state / "owner_verified_active_trials.json", {
        "schema": "senju-owner-verified-active-trials/v1",
        "generated_at": current_time,
        "grant_count": len(active_trials),
        "grants": active_trials,
        "authority_effect": False,
        "private_network": False,
        "redirect_trust_inheritance": False,
    })

    result = {
        "schema": "senju-owner-scope-negotiation-result/v5",
        "generated_at": current_time,
        "production": True,
        "envelope_id": envelope.envelope_id,
        "decision_members": list(DECISION_MEMBERS),
        "current_effective_ceiling": effective,
        "auto_applied_count": sum(1 for d in decisions if d.get("applied")),
        "trial_selected_count": sum(
            1
            for d in decisions
            if d.get("status") in {"passive_public_metadata_trial_selected", "owner_verified_active_trial_selected"}
        ),
        "active_trial_selected_count": len(active_trials),
        "owner_review_count": sum(1 for d in decisions if d.get("status") == "owner_review_requested"),
        "decisions": decisions,
        "hard_limits": [
            "unverified_discovery_trial_remains_head_only_and_credential_free",
            "owner_verified_active_trial_is_short_lived_exact_host_capability_not_authority",
            "owner_verified_active_trial_may_use_only_existing_caller_supplied_credentials",
            "active_trial_never_enters_owner_contact_ceiling",
            "redirect_target_requires_independent_transport_validation_and_sensitive_headers_strip_cross_host",
            "no_unrelated_root_from_discovery_alone",
            "no_hard_deny_or_revocation_override",
            "no_credential_minting_or_discovery",
            "no_private_loopback_link_local_general_access",
            "no_scope_change_outside_owner_expansion_envelope",
            "per_host_methods_prevent_cross_host_method_inheritance",
        ],
    }
    _write(state / "owner_scope_negotiation_result.json", result)
    _write(state / "owner_contact_ceiling_effective.json", {
        "schema": "senju-owner-contact-ceiling-effective/v5",
        "generated_at": current_time,
        "source": "META/X/SENJU negotiation inside Owner Expansion Envelope",
        "envelope_id": envelope.envelope_id,
        "ceiling": effective,
    })
    return result


def run_production_scope_negotiation_cycle(
    repo_root: str | Path,
    state_dir: str | Path,
    *,
    envelope_path: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    config = Path(envelope_path) if envelope_path else repo / "senju" / "config" / "owner-expansion-envelope.json"
    import json
    raw = json.loads(config.read_text(encoding="utf-8"))
    envelope = OwnerExpansionEnvelope.from_mapping(raw)
    proposals = build_scope_proposals(repo, state, envelope)
    campaign = materialize_negotiation_campaign(state, proposals, envelope, now=now)
    result = evaluate_and_apply_per_host(repo, state, envelope, proposals, now=now)
    return {"campaign": campaign, "result": result}
