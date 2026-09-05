"""SENJU-governed Owner frontier research council.

This component no longer has production activation authority. Its job is to inspect
frontier candidates, collect META/X/SENJU recommendations, and route every non-terminal
candidate into SENJU research/review. It may observe the current Owner ceiling, but it
must never mutate that ceiling, write repository refs, mint credentials, or create
external Authority.

Discovery and unverified candidates are allowed onto the research surface so research
is not blocked by Owner evidence. Owner evidence and council votes are retained as risk
and readiness metadata only.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .owner_scope_negotiation import (
    OwnerExpansionEnvelope,
    ScopeProposal,
    _load,
    _methods,
    _write,
    build_scope_proposals,
    derive_current_ceiling,
)

FRONTIER_SCHEMA = "senju-owner-frontier-council/v3"
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
    recognized_owner_evidence_types: frozenset[str]
    research_candidate_methods: frozenset[str]
    max_research_candidates_per_cycle: int
    production_activation_enabled: bool

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
            raise OwnerFrontierError("research council keeps META/X/SENJU three-seat scoring")
        if bool(raw.get("production_activation_enabled", False)):
            raise OwnerFrontierError("Owner frontier production activation is disabled")
        if bool(raw.get("repository_state_writer_enabled", False)):
            raise OwnerFrontierError("Owner frontier repository state writer is disabled")
        if str(raw.get("credential_scope", "none")).strip().lower() != "none":
            raise OwnerFrontierError("Owner frontier research is credential-free")
        if bool(raw.get("allow_private_network", False)):
            raise OwnerFrontierError("Owner frontier research cannot grant private-network authority")

        evidence_types = frozenset(
            str(v).strip()
            for v in raw.get(
                "recognized_owner_evidence_types",
                raw.get("auto_activate_proof_types", ()),
            )
            if str(v).strip()
        )
        if not evidence_types:
            raise OwnerFrontierError("recognized_owner_evidence_types cannot be empty")

        methods = _methods(raw.get("research_candidate_methods", ("GET", "HEAD", "OPTIONS")))
        if not methods.issubset({"GET", "HEAD", "OPTIONS"}):
            raise OwnerFrontierError("frontier live capability remains read-only; broader methods are proposal metadata only")

        return cls(
            quorum=3,
            min_confidence=max(1, min(int(raw.get("min_confidence", 75)), 100)),
            recognized_owner_evidence_types=evidence_types,
            research_candidate_methods=methods,
            max_research_candidates_per_cycle=max(
                1,
                min(int(raw.get("max_research_candidates_per_cycle", 64)), 512),
            ),
            production_activation_enabled=False,
        )


@dataclass(frozen=True)
class FrontierBallot:
    actor: str
    approve: bool
    confidence: int
    check: str
    reason: str
    evidence_refs: tuple[str, ...] = ()
    binding: bool = False

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["evidence_refs"] = list(self.evidence_refs)
        return data


def _recognized_owner_evidence(proposal: ScopeProposal, policy: FrontierPolicy) -> bool:
    return bool(
        proposal.proof_type in policy.recognized_owner_evidence_types
        and proposal.proof_ref
        and not proposal.hard_deny
        and not proposal.revoked
    )


def autonomous_ballots(proposal: ScopeProposal, policy: FrontierPolicy) -> tuple[FrontierBallot, ...]:
    """Produce recommendation-only ballots for SENJU research prioritization."""
    evidence = _recognized_owner_evidence(proposal, policy)
    bounded_methods = bool(set(proposal.requested_methods) & set(policy.research_candidate_methods))
    common_refs = (proposal.proof_ref,) if proposal.proof_ref else ()
    return (
        FrontierBallot(
            actor="META",
            approve=not proposal.hard_deny and not proposal.revoked,
            confidence=92 if evidence else 68,
            check="frontier_research_value",
            reason="route candidate into SENJU research; Owner evidence affects readiness only",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="X",
            approve=not proposal.hard_deny and not proposal.revoked,
            confidence=90 if evidence else 66,
            check="scope_and_provenance_research",
            reason="candidate may be researched without creating production Authority",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="SENJU",
            approve=not proposal.hard_deny and not proposal.revoked,
            confidence=94 if evidence and bounded_methods else 70,
            check="senju_research_route",
            reason="SENJU owns research routing; activation authority is absent",
            evidence_refs=common_refs,
        ),
        FrontierBallot(
            actor="PR-ARMY",
            approve=not proposal.hard_deny and not proposal.revoked,
            confidence=84 if evidence else 62,
            check="provenance_regression_audit",
            reason="advisory audit only",
            evidence_refs=(proposal.evidence_fingerprint, *common_refs),
            binding=False,
        ),
    )


def evaluate_candidate(
    proposal: ScopeProposal,
    ballots: Iterable[FrontierBallot],
    policy: FrontierPolicy,
) -> dict[str, Any]:
    by_actor = {b.actor: b for b in ballots}
    yes = [by_actor[a] for a in FRONTIER_MEMBERS if a in by_actor and by_actor[a].approve]
    min_yes_confidence = min((b.confidence for b in yes), default=0)
    evidence = _recognized_owner_evidence(proposal, policy)
    base = {
        "proposal_id": proposal.proposal_id,
        "host": proposal.host,
        "proof_type": proposal.proof_type,
        "proof_ref": proposal.proof_ref,
        "yes_votes": len(yes),
        "required_votes_for_recommendation": 3,
        "min_yes_confidence": min_yes_confidence,
        "recognized_owner_evidence": evidence,
        "managed_by": "SENJU",
        "authority_effect": "none",
        "production_activation_eligible": False,
        "valid_approval_is_binding": False,
        "applied": False,
    }
    if proposal.hard_deny or proposal.revoked:
        return {
            **base,
            "status": "terminal_stop",
            "research_admitted": False,
            "reason": "HARD_DENY/revocation remains terminal for external action",
        }
    if len(yes) != 3 or min_yes_confidence < policy.min_confidence:
        return {
            **base,
            "status": "senju_research_candidate_council_pending",
            "research_admitted": True,
            "reason": "candidate enters SENJU research while council recommendation matures",
        }
    if not evidence:
        return {
            **base,
            "status": "senju_research_candidate_unverified",
            "research_admitted": True,
            "reason": "Owner evidence is not required for research admission",
        }
    return {
        **base,
        "status": "senju_research_recommendation_ready",
        "research_admitted": True,
        "reason": "META/X/SENJU recommendation is ready; no production activation follows",
    }


def _research_request(proposal: ScopeProposal, decision: Mapping[str, Any], now: int) -> dict[str, Any]:
    return {
        "request_id": f"senju-frontier-research:{proposal.proposal_id}",
        "created_or_seen_at": now,
        "host": proposal.host,
        "requested_methods": sorted(proposal.requested_methods),
        "status": str(decision.get("status") or "senju_research_candidate"),
        "reason": proposal.reason,
        "managed_by": "SENJU",
        "shared_with": list(SHARED_WITH),
        "research_admitted": bool(decision.get("research_admitted")),
        "recognized_owner_evidence": bool(decision.get("recognized_owner_evidence")),
        "production_activation": False,
        "authority_effect": "none",
        "evidence_fingerprint": proposal.evidence_fingerprint,
    }


def _negotiator_feed(decisions: list[dict[str, Any]], now: int) -> dict[str, Any]:
    return {
        "schema": "senju-owner-frontier-negotiator-feed/v2",
        "generated_at": now,
        "managed_by": "SENJU",
        "shared_with": list(SHARED_WITH),
        "approval_contract": {
            "council_role": "recommendation_only",
            "binding_approval": False,
            "production_activation": False,
            "authority_effect": "none",
            "on_recommendation": "route_to_senju_research_and_existing_formal_review",
        },
        "decisions": [
            {
                "host": decision.get("host"),
                "status": decision.get("status"),
                "yes_votes": int(decision.get("yes_votes", 0) or 0),
                "research_admitted": bool(decision.get("research_admitted")),
                "binding_approval": False,
                "applied": False,
            }
            for decision in decisions
        ],
    }


def run_frontier_cycle(
    repo_root: str | Path,
    state_dir: str | Path = DEFAULT_STATE,
    *,
    config_path: str | Path | None = None,
    envelope_path: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current_time = int(time.time()) if now is None else int(now)
    config = Path(config_path) if config_path else repo / DEFAULT_CONFIG
    envelope_file = Path(envelope_path) if envelope_path else repo / DEFAULT_ENVELOPE
    policy = FrontierPolicy.from_mapping(_load(config, {}))
    envelope = OwnerExpansionEnvelope.from_mapping(_load(envelope_file, {}))

    observed_ceiling = derive_current_ceiling(repo, state)
    proposals = build_scope_proposals(repo, state, envelope)[: policy.max_research_candidates_per_cycle]

    ballots_by_proposal: dict[str, list[dict[str, Any]]] = {}
    decisions: list[dict[str, Any]] = []
    research_queue: list[dict[str, Any]] = []

    for proposal in proposals:
        ballots = autonomous_ballots(proposal, policy)
        ballots_by_proposal[proposal.proposal_id] = [b.to_dict() for b in ballots]
        decision = evaluate_candidate(proposal, ballots, policy)
        decisions.append(decision)
        if decision.get("research_admitted"):
            research_queue.append(_research_request(proposal, decision, current_time))

    result = {
        "schema": FRONTIER_SCHEMA,
        "generated_at": current_time,
        "production": False,
        "operating_mode": "senju_research_governance",
        "managed_by": "SENJU",
        "production_activation_enabled": False,
        "repository_state_writer_enabled": False,
        "writes_effective_owner_ceiling": False,
        "council_members": list(FRONTIER_MEMBERS),
        "audit_members": list(FRONTIER_AUDITORS),
        "approval_quorum": 3,
        "min_confidence": policy.min_confidence,
        "candidate_count": len(proposals),
        "research_candidate_count": len(research_queue),
        "activated_count": 0,
        "valid_approval_is_binding": False,
        "authority_effect": "none",
        "approval_contract": "META/X/SENJU recommendations route to SENJU research; no frontier activation",
        "decisions": decisions,
        "observed_effective_ceiling": observed_ceiling,
        "hard_limits": [
            "frontier_cannot_activate_authority",
            "frontier_cannot_write_effective_owner_ceiling",
            "frontier_cannot_persist_repository_state",
            "senju_management_is_review_and_proposal_only",
            "no_credential_or_private_network_authority",
            "hard_deny_and_revocation_remain_terminal_for_external_action",
        ],
    }

    _write(state / "owner_frontier_ballots.json", {
        "schema": "senju-owner-frontier-ballots/v3",
        "generated_at": current_time,
        "managed_by": "SENJU",
        "binding": False,
        "ballots_by_proposal": ballots_by_proposal,
    })
    _write(state / "owner_frontier_council.json", result)
    _write(state / "owner_scope_expansion_evidence_requests.json", {
        "schema": "senju-owner-frontier-research-requests/v3",
        "generated_at": current_time,
        "managed_by": "SENJU",
        "requests": research_queue,
        "authority_effect": "none",
    })
    _write(state / "owner_frontier_negotiator_feed.json", _negotiator_feed(decisions, current_time))
    _write(state / "owner_frontier_senju_research_queue.json", {
        "schema": "senju-owner-frontier-research-queue/v1",
        "generated_at": current_time,
        "managed_by": "SENJU",
        "candidate_count": len(research_queue),
        "candidates": research_queue,
        "production_activation": False,
        "authority_effect": "none",
    })
    return result
