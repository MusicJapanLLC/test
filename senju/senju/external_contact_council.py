"""Distributed policy council for bounded ExternalContactClient liberalization.

META, X, Senju and PR-Army may approve a more permissive contact policy *inside* an
existing Owner contact ceiling. The council can remove unnecessary friction such as
read-only-only defaults, disabled redirects, conservative retry/timeout limits, or
DELETE/HTTP when those capabilities were already explicitly allowed by the Owner.

The council cannot add a new host, bypass DNS/public-address validation, authorize
private/loopback/link-local targets, invent credentials, or exceed the Owner ceiling.
"""
from __future__ import annotations

import dataclasses
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .external import ExternalContactClient, ExternalContactPolicy, _normalize_host

COUNCIL_MEMBERS = ("META", "X", "SENJU", "PR-ARMY")
DEFAULT_QUORUM = 3
DEFAULT_MIN_CONFIDENCE = 60
VALID_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"})


class ExternalContactCouncilError(RuntimeError):
    pass


def _methods(values: Iterable[object]) -> frozenset[str]:
    out = frozenset(str(v).strip().upper() for v in values if str(v).strip())
    if not out:
        raise ExternalContactCouncilError("at least one HTTP method is required")
    if not out.issubset(VALID_METHODS):
        raise ExternalContactCouncilError(f"unsupported HTTP methods: {sorted(out - VALID_METHODS)}")
    return out


def _hosts(values: Iterable[object]) -> frozenset[str]:
    out = frozenset(_normalize_host(str(v)) for v in values if str(v).strip())
    if not out:
        raise ExternalContactCouncilError("owner contact ceiling requires at least one exact host")
    return out


@dataclass(frozen=True)
class OwnerContactCeiling:
    ceiling_id: str
    exact_hosts: frozenset[str]
    allowed_methods: frozenset[str]
    allow_http: bool = False
    allow_delete: bool = False
    follow_redirects: bool = True
    max_redirects: int = 5
    retries: int = 5
    timeout_seconds: float = 20.0
    max_response_bytes: int = 10 * 1024 * 1024

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "OwnerContactCeiling":
        ceiling_id = str(raw.get("ceiling_id") or "").strip()
        if not ceiling_id:
            raise ExternalContactCouncilError("ceiling_id is required")
        methods = _methods(raw.get("allowed_methods", ("GET", "HEAD", "OPTIONS")))
        allow_delete = bool(raw.get("allow_delete", False))
        if "DELETE" in methods and not allow_delete:
            methods = frozenset(m for m in methods if m != "DELETE")
        return cls(
            ceiling_id=ceiling_id,
            exact_hosts=_hosts(raw.get("exact_hosts", ())),
            allowed_methods=methods,
            allow_http=bool(raw.get("allow_http", False)),
            allow_delete=allow_delete,
            follow_redirects=bool(raw.get("follow_redirects", True)),
            max_redirects=max(0, min(int(raw.get("max_redirects", 5)), 5)),
            retries=max(0, min(int(raw.get("retries", 5)), 5)),
            timeout_seconds=max(0.5, min(float(raw.get("timeout_seconds", 20.0)), 20.0)),
            max_response_bytes=max(1024, min(int(raw.get("max_response_bytes", 10 * 1024 * 1024)), 10 * 1024 * 1024)),
        )


@dataclass(frozen=True)
class ContactRelaxationProposal:
    proposal_id: str
    methods: frozenset[str]
    allow_http: bool = False
    allow_delete: bool = False
    follow_redirects: bool = True
    max_redirects: int = 3
    retries: int = 2
    timeout_seconds: float = 10.0
    max_response_bytes: int = 1024 * 1024
    reason: str = "reduce unnecessary ExternalContactClient friction"

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "ContactRelaxationProposal":
        proposal_id = str(raw.get("proposal_id") or "").strip()
        if not proposal_id:
            raise ExternalContactCouncilError("proposal_id is required")
        return cls(
            proposal_id=proposal_id,
            methods=_methods(raw.get("methods", ("GET", "HEAD", "OPTIONS"))),
            allow_http=bool(raw.get("allow_http", False)),
            allow_delete=bool(raw.get("allow_delete", False)),
            follow_redirects=bool(raw.get("follow_redirects", True)),
            max_redirects=max(0, int(raw.get("max_redirects", 3))),
            retries=max(0, int(raw.get("retries", 2))),
            timeout_seconds=max(0.5, float(raw.get("timeout_seconds", 10.0))),
            max_response_bytes=max(1024, int(raw.get("max_response_bytes", 1024 * 1024))),
            reason=" ".join(str(raw.get("reason") or "reduce unnecessary ExternalContactClient friction").split())[:500],
        )


@dataclass(frozen=True)
class CouncilBallot:
    actor: str
    approve: bool
    confidence: int
    reason: str = ""

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "CouncilBallot":
        aliases = {"meta": "META", "x": "X", "senju": "SENJU", "pr-army": "PR-ARMY", "pr_army": "PR-ARMY"}
        actor_raw = str(raw.get("actor") or "").strip()
        actor = aliases.get(actor_raw.lower(), actor_raw.upper())
        if actor not in COUNCIL_MEMBERS:
            raise ExternalContactCouncilError(f"unknown council actor: {actor_raw}")
        return cls(actor=actor, approve=bool(raw.get("approve")), confidence=max(0, min(int(raw.get("confidence", 0)), 100)), reason=" ".join(str(raw.get("reason") or "").split())[:300])


@dataclass(frozen=True)
class CouncilPolicyDecision:
    proposal_id: str
    ceiling_id: str
    approved: bool
    yes_votes: int
    no_votes: int
    average_yes_confidence: int
    liberalization_score: int
    reason: str
    policy: Mapping[str, Any] | None
    ballots: tuple[CouncilBallot, ...]
    generated_at: int

    def to_dict(self) -> dict[str, Any]:
        data = dataclasses.asdict(self)
        data["ballots"] = [dataclasses.asdict(v) for v in self.ballots]
        return data

    def to_policy(self) -> ExternalContactPolicy:
        if not self.approved or not isinstance(self.policy, Mapping):
            raise ExternalContactCouncilError("council decision is not approved")
        return ExternalContactPolicy(
            allow_hosts=frozenset(str(x) for x in self.policy["allow_hosts"]),
            allow_http=bool(self.policy["allow_http"]),
            allowed_methods=frozenset(str(x) for x in self.policy["allowed_methods"]),
            allow_delete=bool(self.policy["allow_delete"]),
            follow_redirects=bool(self.policy["follow_redirects"]),
            max_redirects=int(self.policy["max_redirects"]),
            timeout_seconds=float(self.policy["timeout_seconds"]),
            max_response_bytes=int(self.policy["max_response_bytes"]),
            retries=int(self.policy["retries"]),
        )


def _validate_inside_ceiling(proposal: ContactRelaxationProposal, ceiling: OwnerContactCeiling) -> None:
    if proposal.allow_delete and not ceiling.allow_delete:
        raise ExternalContactCouncilError("proposal cannot enable DELETE beyond Owner ceiling")
    if proposal.allow_delete and "DELETE" not in proposal.methods:
        raise ExternalContactCouncilError("allow_delete requires DELETE in proposed methods")
    if proposal.allow_http and not ceiling.allow_http:
        raise ExternalContactCouncilError("proposal cannot enable HTTP beyond Owner ceiling")
    if not proposal.methods.issubset(ceiling.allowed_methods):
        raise ExternalContactCouncilError("proposal methods exceed Owner contact ceiling")
    if proposal.follow_redirects and not ceiling.follow_redirects:
        raise ExternalContactCouncilError("proposal cannot enable redirects beyond Owner ceiling")
    if proposal.max_redirects > ceiling.max_redirects:
        raise ExternalContactCouncilError("proposal redirect budget exceeds Owner ceiling")
    if proposal.retries > ceiling.retries:
        raise ExternalContactCouncilError("proposal retry budget exceeds Owner ceiling")
    if proposal.timeout_seconds > ceiling.timeout_seconds:
        raise ExternalContactCouncilError("proposal timeout exceeds Owner ceiling")
    if proposal.max_response_bytes > ceiling.max_response_bytes:
        raise ExternalContactCouncilError("proposal response budget exceeds Owner ceiling")


def _liberalization_score(proposal: ContactRelaxationProposal) -> int:
    score = 0
    score += min(30, max(0, len(proposal.methods) - 2) * 6)
    score += 15 if proposal.follow_redirects else 0
    score += min(10, proposal.max_redirects * 2)
    score += 10 if proposal.allow_http else 0
    score += 10 if proposal.allow_delete else 0
    score += min(10, proposal.retries * 2)
    score += min(8, max(0, round(proposal.timeout_seconds - 5.0)))
    score += min(7, max(0, proposal.max_response_bytes // (1024 * 1024) - 1))
    return min(score, 100)


def evaluate_contact_relaxation(
    ceiling: OwnerContactCeiling | Mapping[str, Any],
    proposal: ContactRelaxationProposal | Mapping[str, Any],
    ballots: Iterable[CouncilBallot | Mapping[str, Any]],
    *,
    quorum: int = DEFAULT_QUORUM,
    min_confidence: int = DEFAULT_MIN_CONFIDENCE,
    now: int | None = None,
) -> CouncilPolicyDecision:
    owner = ceiling if isinstance(ceiling, OwnerContactCeiling) else OwnerContactCeiling.from_mapping(ceiling)
    change = proposal if isinstance(proposal, ContactRelaxationProposal) else ContactRelaxationProposal.from_mapping(proposal)
    _validate_inside_ceiling(change, owner)
    quorum = max(3, min(int(quorum), len(COUNCIL_MEMBERS)))
    min_confidence = max(0, min(int(min_confidence), 100))
    by_actor: dict[str, CouncilBallot] = {}
    for raw in ballots:
        ballot = raw if isinstance(raw, CouncilBallot) else CouncilBallot.from_mapping(raw)
        if ballot.actor in by_actor:
            raise ExternalContactCouncilError(f"duplicate ballot: {ballot.actor}")
        by_actor[ballot.actor] = ballot
    normalized = tuple(by_actor[m] for m in COUNCIL_MEMBERS if m in by_actor)
    yes = [v for v in normalized if v.approve]
    no = [v for v in normalized if not v.approve]
    yes_conf = round(sum(v.confidence for v in yes) / len(yes)) if yes else 0
    approved = len(yes) >= quorum and yes_conf >= min_confidence
    policy = None
    if approved:
        policy = {
            "allow_hosts": sorted(owner.exact_hosts),
            "allowed_methods": sorted(change.methods),
            "allow_http": change.allow_http,
            "allow_delete": change.allow_delete,
            "follow_redirects": change.follow_redirects,
            "max_redirects": change.max_redirects,
            "retries": change.retries,
            "timeout_seconds": change.timeout_seconds,
            "max_response_bytes": change.max_response_bytes,
        }
    return CouncilPolicyDecision(
        proposal_id=change.proposal_id,
        ceiling_id=owner.ceiling_id,
        approved=approved,
        yes_votes=len(yes),
        no_votes=len(no),
        average_yes_confidence=yes_conf,
        liberalization_score=_liberalization_score(change) if approved else 0,
        reason=("3-of-4 distributed council approved a more permissive policy inside the existing Owner ceiling" if approved else f"council quorum/confidence not met: yes={len(yes)} confidence={yes_conf}"),
        policy=policy,
        ballots=normalized,
        generated_at=int(time.time()) if now is None else int(now),
    )


def materialize_vote_solicitations(state_dir: str | Path, proposal: ContactRelaxationProposal | Mapping[str, Any], *, now: int | None = None) -> dict[str, Any]:
    change = proposal if isinstance(proposal, ContactRelaxationProposal) else ContactRelaxationProposal.from_mapping(proposal)
    current = int(time.time()) if now is None else int(now)
    tasks = [{
        "task_id": f"external-contact-policy:{change.proposal_id}:{member.lower()}",
        "actor": member,
        "status": "pending",
        "surface": "ExternalContactClient",
        "question": "Approve this bounded policy relaxation inside the existing Owner contact ceiling?",
        "proposal_id": change.proposal_id,
        "requested_methods": sorted(change.methods),
        "allow_http": change.allow_http,
        "allow_delete": change.allow_delete,
        "follow_redirects": change.follow_redirects,
        "max_redirects": change.max_redirects,
        "retries": change.retries,
        "timeout_seconds": change.timeout_seconds,
        "max_response_bytes": change.max_response_bytes,
        "reason": change.reason,
    } for member in COUNCIL_MEMBERS]
    payload = {"schema": "senju-external-contact-council-solicitations/v1", "generated_at": current, "proposal_id": change.proposal_id, "members": list(COUNCIL_MEMBERS), "required_quorum": DEFAULT_QUORUM, "tasks": tasks}
    path = Path(state_dir) / "external_contact_council_solicitations.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


class CouncilExternalContactClient:
    """ExternalContactClient using a council-approved policy projection."""

    def __init__(self, decision: CouncilPolicyDecision, **client_kwargs: Any) -> None:
        self.decision = decision
        self.client = ExternalContactClient(decision.to_policy(), **client_kwargs)

    def contact(self, *args: Any, **kwargs: Any):
        return self.client.contact(*args, **kwargs)

    def contact_with_body(self, *args: Any, **kwargs: Any):
        return self.client.contact_with_body(*args, **kwargs)
