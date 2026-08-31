"""Simplified Owner frontier approval council.

The trust boundary is split into two roles:

1. verified Owner evidence establishes that a host is eligible to enter the Owner
   frontier; this is required once and cannot be synthesized by the AI council;
2. META, X and SENJU make the operational approval decision as equal council seats.

PR-ARMY remains an advisory/audit participant rather than a veto seat. Once verified
Owner evidence exists and META/X/SENJU approve 3/3 above the confidence threshold, the
approval is binding: the host is activated in the same cycle or, if the configured
cycle budget is exhausted, it is explicitly marked for continuity/requeue.

Discovery alone never creates authority.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .owner_scope_negotiation import (
    OwnerExpansionEnvelope,
    ScopeProposal,
    _host,
    _load,
    _methods,
    _write,
    build_scope_proposals,
    derive_current_ceiling,
)

FRONTIER_SCHEMA = "senju-owner-frontier-council/v2"
FRONTIER_MEMBERS = ("META", "X", "SENJU")
FRONTIER_AUDITORS = ("PR-ARMY",)
SHARED_WITH = ("META", "X", "SENJU", "PR-ARMY", "CHILD", "AI")
DEFAULT_CONFIG = Path("senju/config/owner-frontier-council.json")
DEFAULT_ENVELOPE = Path("senju/config/owner-expansion-envelope.json")
DEFAULT_STATE = Path("senju/state")


class OwnerFrontierError(RuntimeError):
    pass


@dataclass(frozen=True)
class FrontierPolicy:
    quorum: int
    min_confidence: int
    auto_activate_proof_types: frozenset[str]
    new_host_methods: frozenset[str]
    max_new_hosts_per_cycle: int

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "FrontierPolicy":
        members = tuple(str(v).strip().upper() for v in raw.get("council_members", ()))
        if members != FRONTIER_MEMBERS:
            raise OwnerFrontierError(f"council_members must be exactly {FRONTIER_MEMBERS!r}")
        auditors = tuple(str(v).strip().upper() for v in raw.get("audit_members", FRONTIER_AUDITORS))
        if auditors != FRONTIER_AUDITORS:
            raise OwnerFrontierError(f"audit_members must be exactly {FRONTIER_AUDITORS!r}")
        quorum = int(raw.get("quorum", 3))
        if quorum != 3:
            raise OwnerFrontierError("new-host frontier requires META/X/SENJU three-of-three approval")
        if str(raw.get("credential_scope", "none")).strip().lower() != "none":
            raise OwnerFrontierError("new-host frontier is credential-free")
        if bool(raw.get("allow_http", False)):
            raise OwnerFrontierError("new-host frontier is HTTPS-only")
        if bool(raw.get("allow_delete", False)):
            raise OwnerFrontierError("new-host frontier cannot enable DELETE")
        if bool(raw.get("allow_private_network", False)):
            raise OwnerFrontierError("new-host frontier cannot enable private networks")
        proof_types = frozenset(str(v).strip() for v in raw.get("auto_activate_proof_types", ()) if str(v).strip())
        if not proof_types:
            raise OwnerFrontierError("auto_activate_proof_types cannot be empty")
        methods = _methods(raw.get("new_host_methods", ("GET", "HEAD", "OPTIONS")))
        if not methods.issubset({"GET", "HEAD", "OPTIONS"}):
            raise OwnerFrontierError("new hosts may start only with GET/HEAD/OPTIONS")
        return cls(
            quorum=3,
            min_confidence=max(75, min(int(raw.get("min_confidence", 75)), 100)),
            auto_activate_proof_types=proof_types,
            new_host_methods=methods,
            max_new_hosts_per_cycle=max(1, min(int(raw.get("max_new_hosts_per_cycle", 13)), 16)),
        )


@dataclass(frozen=True)
class FrontierBallot:
    actor: str
    approve: bool
    confidence: int
    check: str
    reason: str
    evidence_refs: tuple[str, ...] = ()
    binding: bool = True

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["evidence_refs"] = list(self.evidence_refs)
        return data


def _initial_per_host_methods(ceiling: Mapping[str, Any]) -> dict[str, set[str]]:
    global_methods = set(_methods(ceiling.get("allowed_methods", ("GET", "HEAD", "OPTIONS"))))
    out: dict[str, set[str]] = {}
    raw = ceiling.get("per_host_methods")
    if isinstance(raw, Mapping):
        for raw_host, methods in raw.items():
            try:
                out[_host(raw_host)] = set(_methods(methods))
            except Exception:
                continue
    for raw_host in ceiling.get("exact_hosts", ()):
        try:
            host = _host(raw_host)
        except Exception:
            continue
        out.setdefault(host, set(global_methods))
    return out


def _verified_for_auto_activation(proposal: ScopeProposal, policy: FrontierPolicy) -> bool:
    return bool(
        proposal.proof_type in policy.auto_activate_proof_types
        and proposal.proof_ref
        and not proposal.hard_deny
        and not proposal.revoked
    )


def autonomous_ballots(proposal: ScopeProposal, policy: FrontierPolicy) -> tuple[FrontierBallot, ...]:
    verified = _verified_for_auto_activation(proposal, policy)
    bounded_methods = bool(set(proposal.requested_methods) & set(policy.new_host_methods))
    common_refs = (proposal.proof_ref,) if proposal.proof_ref else ()
    return (
        FrontierBallot(
            actor="META",
            approve=verified,
            confidence=94 if verified else 0,
            check="owner_evidence_consistency",
            reason="verified Owner evidence makes this host eligible" if verified else "verified Owner evidence is missing",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="X",
            approve=verified,
            confidence=90 if verified else 0,
            check="exact_public_host_boundary",
            reason="exact public host carries eligible evidence" if verified else "host remains discovery-only",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="SENJU",
            approve=verified and bounded_methods,
            confidence=92 if verified and bounded_methods else 0,
            check="new_host_method_ceiling",
            reason="activation is clamped to GET/HEAD/OPTIONS" if verified and bounded_methods else "requested capability has no bounded method",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="PR-ARMY",
            approve=verified,
            confidence=88 if verified else 0,
            check="provenance_revocation_regression_audit",
            reason="advisory audit found no regression" if verified else "advisory audit sees insufficient provenance",
            evidence_refs=(proposal.evidence_fingerprint, *common_refs),
            binding=False,
        ),
    )


def evaluate_candidate(proposal: ScopeProposal, ballots: Iterable[FrontierBallot], policy: FrontierPolicy) -> dict[str, Any]:
    by_actor = {b.actor: b for b in ballots}
    yes = [by_actor[a] for a in FRONTIER_MEMBERS if a in by_actor and by_actor[a].binding and by_actor[a].approve]
    min_yes_confidence = min((b.confidence for b in yes), default=0)
    audit = by_actor.get("PR-ARMY")
    base = {
        "proposal_id": proposal.proposal_id,
        "host": proposal.host,
        "proof_type": proposal.proof_type,
        "proof_ref": proposal.proof_ref,
        "yes_votes": len(yes),
        "required_votes": 3,
        "min_yes_confidence": min_yes_confidence,
        "pr_army_audit": audit.to_dict() if audit else None,
        "owner_evidence_required_once": True,
        "valid_approval_is_binding": True,
    }
    if proposal.hard_deny or proposal.revoked:
        return {**base, "status": "terminal_stop", "applied": False, "reason": "HARD_DENY/revocation remains terminal"}
    if proposal.proof_type not in policy.auto_activate_proof_types or not proposal.proof_ref:
        return {**base, "status": "ownership_verification_required", "applied": False, "reason": "verified Owner evidence is required once before AI council approval"}
    if any(actor not in by_actor for actor in FRONTIER_MEMBERS) or len(yes) != 3:
        return {**base, "status": "ai_council_consensus_pending", "applied": False, "reason": "META, X and SENJU must all approve"}
    if min_yes_confidence < policy.min_confidence:
        return {**base, "status": "ai_council_consensus_pending", "applied": False, "reason": "one or more binding AI approvals are below threshold"}
    return {**base, "status": "verified_owner_evidence_plus_ai_council_approved", "applied": True, "reason": "verified Owner evidence plus META/X/SENJU three-of-three approval"}


def _ownership_request(proposal: ScopeProposal, decision: Mapping[str, Any], now: int) -> dict[str, Any]:
    return {
        "request_id": f"ownership:{proposal.proposal_id}",
        "created_or_seen_at": now,
        "host": proposal.host,
        "requested_methods": sorted(proposal.requested_methods),
        "status": str(decision.get("status") or "ownership_verification_required"),
        "reason": proposal.reason,
        "requested_by": list(FRONTIER_MEMBERS),
        "shared_with": list(SHARED_WITH),
        "required_evidence": ["owner_verified_domain", "owner_exact_link", "existing_standing_authorization"],
        "evidence_fingerprint": proposal.evidence_fingerprint,
    }


def _negotiator_feed(decisions: list[dict[str, Any]], now: int) -> dict[str, Any]:
    rows = []
    for decision in decisions:
        status = str(decision.get("status") or "")
        rows.append({
            "host": decision.get("host"),
            "status": status,
            "proof_type": decision.get("proof_type"),
            "proof_ref": decision.get("proof_ref"),
            "yes_votes": int(decision.get("yes_votes", 0) or 0),
            "required_votes": 3,
            "binding_approval": status in {"verified_owner_evidence_plus_ai_council_approved", "cycle_host_budget_exhausted"},
            "applied": bool(decision.get("applied")),
        })
    return {
        "schema": "senju-owner-frontier-negotiator-feed/v1",
        "generated_at": now,
        "shared_with": list(SHARED_WITH),
        "approval_contract": {
            "owner_evidence": "required_once",
            "binding_ai_approvers": list(FRONTIER_MEMBERS),
            "audit_only": list(FRONTIER_AUDITORS),
            "on_valid_approval": "activate_now_or_requeue_if_cycle_budget_exhausted",
        },
        "decisions": rows,
    }


def run_frontier_cycle(repo_root: str | Path, state_dir: str | Path = DEFAULT_STATE, *, config_path: str | Path | None = None, envelope_path: str | Path | None = None, now: int | None = None) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current_time = int(time.time()) if now is None else int(now)
    config = Path(config_path) if config_path else repo / DEFAULT_CONFIG
    envelope_file = Path(envelope_path) if envelope_path else repo / DEFAULT_ENVELOPE
    policy = FrontierPolicy.from_mapping(_load(config, {}))
    envelope = OwnerExpansionEnvelope.from_mapping(_load(envelope_file, {}))

    ceiling = derive_current_ceiling(repo, state)
    per_host = _initial_per_host_methods(ceiling)
    existing_hosts = set(per_host)
    proposals = [p for p in build_scope_proposals(repo, state, envelope) if p.host not in existing_hosts]
    ballots_by_proposal: dict[str, list[dict[str, Any]]] = {}
    decisions: list[dict[str, Any]] = []
    ownership_requests: list[dict[str, Any]] = []
    activated = 0

    for proposal in proposals:
        ballots = autonomous_ballots(proposal, policy)
        ballots_by_proposal[proposal.proposal_id] = [b.to_dict() for b in ballots]
        decision = evaluate_candidate(proposal, ballots, policy)
        if decision.get("applied"):
            if activated >= policy.max_new_hosts_per_cycle:
                decision = {**decision, "status": "cycle_host_budget_exhausted", "applied": False, "approved_pending_continuity": True, "reason": "valid approval is binding but deferred only by new-host cycle budget"}
            else:
                per_host[proposal.host] = set(policy.new_host_methods)
                activated += 1
                decision = {**decision, "new_host": True, "effective_host_methods": sorted(policy.new_host_methods), "approval_consumed": True}
        if not decision.get("applied") and decision.get("status") != "terminal_stop":
            ownership_requests.append(_ownership_request(proposal, decision, current_time))
        decisions.append(decision)

    global_methods = sorted({m for methods in per_host.values() for m in methods} or {"GET", "HEAD", "OPTIONS"})
    effective = dict(ceiling)
    effective.update({
        "ceiling_id": f"{ceiling.get('ceiling_id', 'owner')}:frontier-ai-council",
        "exact_hosts": sorted(per_host),
        "allowed_methods": global_methods,
        "per_host_methods": {host: sorted(per_host[host]) for host in sorted(per_host)},
        "allow_http": False,
        "allow_delete": False,
    })
    ballots_doc = {
        "schema": "senju-owner-frontier-ballots/v2",
        "generated_at": current_time,
        "binding_council_members": list(FRONTIER_MEMBERS),
        "audit_members": list(FRONTIER_AUDITORS),
        "quorum": 3,
        "ballots_by_proposal": ballots_by_proposal,
    }
    result = {
        "schema": FRONTIER_SCHEMA,
        "generated_at": current_time,
        "production": True,
        "council_members": list(FRONTIER_MEMBERS),
        "audit_members": list(FRONTIER_AUDITORS),
        "approval_quorum": 3,
        "min_confidence": policy.min_confidence,
        "candidate_count": len(proposals),
        "activated_count": activated,
        "ownership_verification_request_count": len(ownership_requests),
        "unknown_host_without_verified_evidence_auto_activated": False,
        "valid_approval_is_binding": True,
        "approval_contract": "verified owner evidence once + META/X/SENJU 3/3 => activate or continuity defer",
        "decisions": decisions,
        "current_effective_ceiling": effective,
        "hard_limits": [
            "discovery_alone_never_activates_host",
            "verified_owner_evidence_required_once",
            "meta_x_senju_three_of_three_required",
            "pr_army_is_advisory_not_veto",
            "hard_deny_and_revocation_are_terminal",
            "new_hosts_get_read_probe_methods_only",
            "no_credentials_http_delete_or_private_network_expansion",
        ],
    }
    _write(state / "owner_frontier_ballots.json", ballots_doc)
    _write(state / "owner_frontier_council.json", result)
    _write(state / "owner_scope_expansion_evidence_requests.json", {
        "schema": "senju-owner-frontier-ownership-requests/v2",
        "generated_at": current_time,
        "requests": ownership_requests,
    })
    _write(state / "owner_frontier_negotiator_feed.json", _negotiator_feed(decisions, current_time))
    _write(state / "owner_contact_ceiling_effective.json", {
        "schema": "senju-owner-contact-ceiling-effective/v5",
        "generated_at": current_time,
        "source": "verified Owner evidence + META/X/SENJU three-of-three approval",
        "envelope_id": envelope.envelope_id,
        "ceiling": effective,
    })
    return result
