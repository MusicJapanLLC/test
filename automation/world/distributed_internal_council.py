"""Distributed internal-scope council for THE WORLD.

META, X, Senju, and the aggregate PR-Army each receive one bounded governance seat.
Inside an owner-declared ceiling they may nominate, vote, promote an ambiguous candidate
into the read-only internal lane, or hold a soft candidate. The council cannot move the
owner ceiling or bypass the structural namespace/risk gates.

This deliberately distributes *classification power*, not general authority:

    owner seed / ceiling
        -> structural namespace + risk gates
        -> META / X / Senju / PR-Army ballots
        -> 3-of-4 distributed decision
        -> read-only, credential-free internal classification

Even unanimous council support cannot authorize a target outside the ceiling, a private
target, credentials, or state-changing methods.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .internal_scope_consensus import (
    DEFAULT_STATE_DIR,
    OwnerInternalEnvelope,
    classify_candidate,
)

COUNCIL_MEMBERS = ("META", "X", "Senju", "PR-Army")
DEFAULT_AGENT_QUORUM = 3
DEFAULT_HOLD_QUORUM = 3
DEFAULT_MIN_CONFIDENCE = 60


@dataclass(frozen=True)
class AgentBallot:
    actor: str
    accept: bool
    confidence: int
    reason: str = ""
    evidence_refs: tuple[str, ...] = ()

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "AgentBallot":
        actor_raw = str(raw.get("actor") or "").strip()
        aliases = {
            "meta": "META",
            "x": "X",
            "senju": "Senju",
            "pr-army": "PR-Army",
            "pr_army": "PR-Army",
            "prarmy": "PR-Army",
        }
        actor = aliases.get(actor_raw.lower(), actor_raw)
        if actor not in COUNCIL_MEMBERS:
            raise ValueError(f"unknown distributed council actor: {actor_raw}")
        confidence = max(0, min(int(raw.get("confidence", 0)), 100))
        reason = " ".join(str(raw.get("reason") or "").strip().split())[:240]
        evidence_raw = raw.get("evidence_refs", ())
        if not isinstance(evidence_raw, (list, tuple, set, frozenset)):
            evidence_raw = ()
        evidence: list[str] = []
        for item in evidence_raw:
            value = " ".join(str(item).strip().split())[:160]
            if value and value not in evidence:
                evidence.append(value)
        return cls(actor, bool(raw.get("accept")), confidence, reason, tuple(evidence))


@dataclass(frozen=True)
class DistributedCouncilPolicy:
    promote_quorum: int = DEFAULT_AGENT_QUORUM
    hold_quorum: int = DEFAULT_HOLD_QUORUM
    min_confidence: int = DEFAULT_MIN_CONFIDENCE

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any] | None) -> "DistributedCouncilPolicy":
        doc = raw or {}
        promote = int(doc.get("promote_quorum", DEFAULT_AGENT_QUORUM))
        hold = int(doc.get("hold_quorum", DEFAULT_HOLD_QUORUM))
        confidence = int(doc.get("min_confidence", DEFAULT_MIN_CONFIDENCE))
        if not 3 <= promote <= len(COUNCIL_MEMBERS):
            raise ValueError("promote_quorum must require at least 3 of 4 council seats")
        if not 3 <= hold <= len(COUNCIL_MEMBERS):
            raise ValueError("hold_quorum must require at least 3 of 4 council seats")
        if not 0 <= confidence <= 100:
            raise ValueError("min_confidence must be between 0 and 100")
        return cls(promote, hold, confidence)


@dataclass(frozen=True)
class DistributedDecision:
    candidate_id: str
    host: str
    base_classification: str
    classification: str
    effective_lane: str
    council_yes: int
    council_no: int
    council_missing: int
    average_yes_confidence: int
    average_no_confidence: int
    ballots: tuple[AgentBallot, ...]
    structural_namespace_gate: bool
    structural_risk_gate: bool
    delegated_classification_power: bool
    authority_effect: str = "bounded_internal_classification_only"
    credential_scope: str = "none"
    external_write: bool = False

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["ballots"] = [asdict(ballot) for ballot in self.ballots]
        return data


def _validated_ballots(values: Iterable[Mapping[str, Any] | AgentBallot]) -> tuple[AgentBallot, ...]:
    indexed: dict[str, AgentBallot] = {}
    for raw in values:
        ballot = raw if isinstance(raw, AgentBallot) else AgentBallot.from_mapping(raw)
        if ballot.actor in indexed:
            raise ValueError(f"duplicate distributed council ballot: {ballot.actor}")
        indexed[ballot.actor] = ballot
    return tuple(indexed[member] for member in COUNCIL_MEMBERS if member in indexed)


def _structural_gates(base: Any) -> tuple[bool, bool]:
    votes = {vote.agent: vote for vote in base.votes}
    namespace_ok = bool(votes.get("namespace") and votes["namespace"].accept)
    risk_ok = bool(votes.get("risk") and votes["risk"].accept)
    return namespace_ok, risk_ok


def _average_confidence(ballots: Iterable[AgentBallot], *, accept: bool) -> int:
    values = [ballot.confidence for ballot in ballots if ballot.accept is accept]
    return round(sum(values) / len(values)) if values else 0


def evaluate_distributed_candidate(
    candidate: Mapping[str, Any],
    envelope: OwnerInternalEnvelope,
    ballots: Iterable[Mapping[str, Any] | AgentBallot],
    *,
    policy: DistributedCouncilPolicy | None = None,
) -> DistributedDecision:
    """Give the named AI council bounded classification power inside the owner ceiling."""
    base = classify_candidate(candidate, envelope)
    policy = policy or DistributedCouncilPolicy()
    council = _validated_ballots(ballots)
    yes = sum(1 for ballot in council if ballot.accept)
    no = sum(1 for ballot in council if not ballot.accept)
    missing = len(COUNCIL_MEMBERS) - len(council)
    yes_conf = _average_confidence(council, accept=True)
    no_conf = _average_confidence(council, accept=False)
    namespace_ok, risk_ok = _structural_gates(base)

    # Hard structural outcomes are never overridable by council consensus.
    if base.classification in {"invalid_or_unsafe_target", "outside_owner_ceiling"}:
        classification = base.classification
        lane = "none"
        delegated = False
    elif not namespace_ok or not risk_ok:
        classification = "structural_gate_hold"
        lane = "research_only"
        delegated = False
    elif base.classification == "explicit_internal":
        # Explicit owner seed remains internal. Council still has a voice but cannot erase
        # an explicit owner declaration through this soft-band mechanism.
        classification = "explicit_internal"
        lane = base.effective_lane
        delegated = False
    elif no >= policy.hold_quorum and no_conf >= policy.min_confidence:
        classification = "distributed_council_hold"
        lane = "research_only"
        delegated = True
    elif yes >= policy.promote_quorum and yes_conf >= policy.min_confidence:
        classification = "distributed_internal_candidate"
        lane = "distributed_soft_internal_read_only"
        delegated = True
    else:
        classification = base.classification
        lane = base.effective_lane
        delegated = False

    return DistributedDecision(
        candidate_id=base.candidate_id,
        host=base.host,
        base_classification=base.classification,
        classification=classification,
        effective_lane=lane,
        council_yes=yes,
        council_no=no,
        council_missing=missing,
        average_yes_confidence=yes_conf,
        average_no_confidence=no_conf,
        ballots=council,
        structural_namespace_gate=namespace_ok,
        structural_risk_gate=risk_ok,
        delegated_classification_power=delegated,
    )


def run_distributed_internal_council(
    envelope: Mapping[str, Any],
    candidates: Iterable[Mapping[str, Any]],
    ballots_by_candidate: Mapping[str, Iterable[Mapping[str, Any] | AgentBallot]],
    *,
    policy: Mapping[str, Any] | DistributedCouncilPolicy | None = None,
) -> dict[str, Any]:
    owner = OwnerInternalEnvelope.from_mapping(envelope)
    council_policy = (
        policy
        if isinstance(policy, DistributedCouncilPolicy)
        else DistributedCouncilPolicy.from_mapping(policy if isinstance(policy, Mapping) else None)
    )
    decisions: list[DistributedDecision] = []
    for candidate in candidates:
        if not isinstance(candidate, Mapping):
            continue
        candidate_id = " ".join(str(candidate.get("candidate_id") or "candidate").strip().split())[:160]
        raw_ballots = ballots_by_candidate.get(candidate_id, ())
        decisions.append(
            evaluate_distributed_candidate(candidate, owner, raw_ballots, policy=council_policy)
        )

    effective = sorted(
        {
            decision.host
            for decision in decisions
            if decision.classification in {"explicit_internal", "consensus_internal_candidate", "distributed_internal_candidate"}
            and decision.host
        }
    )
    return {
        "schema": "the-world-distributed-internal-council/v1",
        "generated_at": int(time.time()),
        "mode": "distributed_ai_governance_inside_owner_ceiling",
        "members": list(COUNCIL_MEMBERS),
        "member_rights": ["nominate", "vote", "promote_within_ceiling", "hold_soft_candidate"],
        "promote_quorum": council_policy.promote_quorum,
        "hold_quorum": council_policy.hold_quorum,
        "min_confidence": council_policy.min_confidence,
        "effective_internal_hosts": effective,
        "decisions": [decision.to_dict() for decision in decisions],
        "hard_limits": [
            "council_cannot_move_owner_ceiling",
            "council_cannot_override_namespace_gate",
            "council_cannot_override_risk_gate",
            "read_only_credential_free_lane_only",
            "no_external_write",
            "no_private_loopback_link_local",
            "no_general_authority_or_credential_minting",
            "pr_army_is_one_aggregate_seat_no_sybil_amplification",
        ],
    }


def run_state_cycle(state_dir: str | Path = DEFAULT_STATE_DIR) -> dict[str, Any]:
    state = Path(state_dir)
    envelope = json.loads((state / "owner_internal_envelope.json").read_text(encoding="utf-8"))
    candidates_doc = json.loads((state / "internal_scope_candidates.json").read_text(encoding="utf-8"))
    ballots_doc = json.loads((state / "distributed_internal_ballots.json").read_text(encoding="utf-8"))
    policy_path = state / "distributed_internal_policy.json"
    policy_doc = json.loads(policy_path.read_text(encoding="utf-8")) if policy_path.exists() else {}
    candidates = candidates_doc.get("candidates", []) if isinstance(candidates_doc, Mapping) else []
    ballots = ballots_doc.get("ballots_by_candidate", {}) if isinstance(ballots_doc, Mapping) else {}
    if not isinstance(ballots, Mapping):
        ballots = {}
    result = run_distributed_internal_council(envelope, candidates, ballots, policy=policy_doc)
    state.mkdir(parents=True, exist_ok=True)
    (state / "distributed_internal_council_result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return result
