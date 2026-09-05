"""Distributed policy council for bounded ExternalContactClient liberalization.

META, X, SENJU and PR-Army may approve a more permissive contact policy. The normal
path remains the current effective Owner contact ceiling. A second path, the Research
Delegation Reserve, lets the council allocate methods/budgets that are not present in
the current effective ceiling when those capabilities were pre-delegated once for an
already explicit Owner-controlled research target.

This deliberately demotes ExternalContactClient's governance role. The council or the
Owner-scope negotiation layer chooses policy; ExternalContactClient is the transport
enforcer. The role split targets a 20% reduction in policy responsibility on the client
and a 65% standing delegation target for council-side research policy decisions.

The reserve does not create unknown-host authority, private-network authority, raw
credentials, HTTP downgrade, or identity-based HARD_DENY bypass. Core destination and
transport safety validation still happens at execution time.
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
RESEARCH_RESERVE_SCHEMA = "senju-external-contact-research-reserves/v1"
DEFAULT_RESEARCH_RESERVE_PATH = Path("senju/config/external-contact-research-reserves.json")
EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT = 20
COUNCIL_POLICY_DELEGATION_TARGET_PCT = 65


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
        raise ExternalContactCouncilError("contact authority requires at least one exact host")
    return out


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


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
class ResearchDelegationReserve:
    """Standing research policy delegated once for existing explicit Owner targets."""

    reserve_id: str
    exact_hosts: frozenset[str]
    delegable_methods: frozenset[str]
    allow_http: bool = False
    allow_delete: bool = False
    follow_redirects: bool = True
    max_redirects: int = 3
    retries: int = 4
    timeout_seconds: float = 15.0
    max_response_bytes: int = 4 * 1024 * 1024
    quorum: int = DEFAULT_QUORUM
    min_confidence: int = COUNCIL_POLICY_DELEGATION_TARGET_PCT
    authority_source: str = "canonical_owner_explicit_target"
    external_contact_policy_responsibility_reduction_pct: int = EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT
    council_policy_delegation_target_pct: int = COUNCIL_POLICY_DELEGATION_TARGET_PCT

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "ResearchDelegationReserve":
        reserve_id = str(raw.get("reserve_id") or "").strip()
        if not reserve_id:
            raise ExternalContactCouncilError("reserve_id is required")
        allow_http = bool(raw.get("allow_http", False))
        if allow_http:
            raise ExternalContactCouncilError("research delegation reserve is HTTPS-only")
        allow_delete = bool(raw.get("allow_delete", False))
        methods = _methods(raw.get("delegable_methods", ("GET", "HEAD", "OPTIONS")))
        if "DELETE" in methods and not allow_delete:
            methods = frozenset(method for method in methods if method != "DELETE")
        quorum = int(raw.get("quorum", DEFAULT_QUORUM))
        if quorum < 3 or quorum > len(COUNCIL_MEMBERS):
            raise ExternalContactCouncilError("research reserve quorum must be 3 or 4")
        confidence = max(60, min(int(raw.get("min_confidence", COUNCIL_POLICY_DELEGATION_TARGET_PCT)), 100))
        return cls(
            reserve_id=reserve_id,
            exact_hosts=_hosts(raw.get("exact_hosts", ())),
            delegable_methods=methods,
            allow_http=False,
            allow_delete=allow_delete,
            follow_redirects=bool(raw.get("follow_redirects", True)),
            max_redirects=max(0, min(int(raw.get("max_redirects", 3)), 5)),
            retries=max(0, min(int(raw.get("retries", 4)), 5)),
            timeout_seconds=max(0.5, min(float(raw.get("timeout_seconds", 15.0)), 20.0)),
            max_response_bytes=max(1024, min(int(raw.get("max_response_bytes", 4 * 1024 * 1024)), 10 * 1024 * 1024)),
            quorum=quorum,
            min_confidence=confidence,
            authority_source=str(raw.get("authority_source") or "canonical_owner_explicit_target"),
        )


def _canonical_owner_methods(repo_root: Path, host: str) -> frozenset[str] | None:
    doc = _load_json(repo_root / "AUTHORIZED_TEST_TARGETS.json", {})
    rows = doc.get("targets", ()) if isinstance(doc, Mapping) else ()
    for raw in rows if isinstance(rows, list) else ():
        if not isinstance(raw, Mapping) or raw.get("owner_authorization") != "explicit":
            continue
        raw_host = raw.get("host")
        if not isinstance(raw_host, str):
            continue
        try:
            candidate = _normalize_host(raw_host)
        except Exception:
            continue
        if candidate != host:
            continue
        interactions = {
            str(value).strip().upper()
            for value in raw.get("allowed_interactions", ())
            if str(value).strip().upper() in VALID_METHODS
        }
        return frozenset(interactions)
    return None


def load_research_delegation_reserve(
    repo_root: str | Path,
    reserve_id: str,
    *,
    config_path: str | Path | None = None,
) -> ResearchDelegationReserve:
    """Load a reserve and bind it to canonical explicit Owner target authority."""
    root = Path(repo_root)
    path = Path(config_path) if config_path is not None else root / DEFAULT_RESEARCH_RESERVE_PATH
    doc = _load_json(path, {})
    if not isinstance(doc, Mapping) or doc.get("schema") != RESEARCH_RESERVE_SCHEMA:
        raise ExternalContactCouncilError("research delegation reserve registry is invalid")
    records = doc.get("reserves", ())
    for raw in records if isinstance(records, list) else ():
        if not isinstance(raw, Mapping) or str(raw.get("reserve_id") or "") != reserve_id:
            continue
        reserve = ResearchDelegationReserve.from_mapping(raw)
        for host in reserve.exact_hosts:
            canonical = _canonical_owner_methods(root, host)
            if canonical is None:
                raise ExternalContactCouncilError(
                    f"research reserve host lacks canonical explicit Owner authority: {host}"
                )
            if not reserve.delegable_methods.issubset(canonical):
                raise ExternalContactCouncilError(
                    f"research reserve methods exceed canonical Owner interactions for {host}"
                )
        return reserve
    raise ExternalContactCouncilError(f"unknown research delegation reserve: {reserve_id}")


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
    authority_basis: str = "owner_contact_ceiling"
    delegation_id: str | None = None
    external_contact_role: str = "transport_enforcer_only"
    external_contact_policy_responsibility_reduction_pct: int = EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT
    council_policy_delegation_target_pct: int = COUNCIL_POLICY_DELEGATION_TARGET_PCT

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


def _validate_inside_reserve(
    proposal: ContactRelaxationProposal,
    ceiling: OwnerContactCeiling,
    reserve: ResearchDelegationReserve,
) -> None:
    if not ceiling.exact_hosts.issubset(reserve.exact_hosts):
        raise ExternalContactCouncilError("research reserve does not cover the current exact host set")
    if proposal.allow_http:
        raise ExternalContactCouncilError("research reserve cannot enable HTTP")
    if proposal.allow_delete and not reserve.allow_delete:
        raise ExternalContactCouncilError("proposal cannot enable DELETE beyond research reserve")
    if proposal.allow_delete and "DELETE" not in proposal.methods:
        raise ExternalContactCouncilError("allow_delete requires DELETE in proposed methods")
    if not proposal.methods.issubset(reserve.delegable_methods):
        raise ExternalContactCouncilError("proposal methods exceed Research Delegation Reserve")
    if proposal.follow_redirects and not reserve.follow_redirects:
        raise ExternalContactCouncilError("proposal cannot enable redirects beyond research reserve")
    if proposal.max_redirects > reserve.max_redirects:
        raise ExternalContactCouncilError("proposal redirect budget exceeds research reserve")
    if proposal.retries > reserve.retries:
        raise ExternalContactCouncilError("proposal retry budget exceeds research reserve")
    if proposal.timeout_seconds > reserve.timeout_seconds:
        raise ExternalContactCouncilError("proposal timeout exceeds research reserve")
    if proposal.max_response_bytes > reserve.max_response_bytes:
        raise ExternalContactCouncilError("proposal response budget exceeds research reserve")


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
    research_reserve: ResearchDelegationReserve | Mapping[str, Any] | None = None,
    quorum: int = DEFAULT_QUORUM,
    min_confidence: int = DEFAULT_MIN_CONFIDENCE,
    now: int | None = None,
) -> CouncilPolicyDecision:
    owner = ceiling if isinstance(ceiling, OwnerContactCeiling) else OwnerContactCeiling.from_mapping(ceiling)
    change = proposal if isinstance(proposal, ContactRelaxationProposal) else ContactRelaxationProposal.from_mapping(proposal)
    reserve = None
    if research_reserve is not None:
        reserve = research_reserve if isinstance(research_reserve, ResearchDelegationReserve) else ResearchDelegationReserve.from_mapping(research_reserve)

    authority_basis = "owner_contact_ceiling"
    delegation_id: str | None = None
    effective_quorum = quorum
    effective_confidence = min_confidence
    try:
        _validate_inside_ceiling(change, owner)
    except ExternalContactCouncilError as ceiling_error:
        if reserve is None:
            raise ceiling_error
        _validate_inside_reserve(change, owner, reserve)
        authority_basis = "research_delegation_reserve"
        delegation_id = reserve.reserve_id
        effective_quorum = max(effective_quorum, reserve.quorum)
        effective_confidence = max(effective_confidence, reserve.min_confidence)

    effective_quorum = max(3, min(int(effective_quorum), len(COUNCIL_MEMBERS)))
    effective_confidence = max(0, min(int(effective_confidence), 100))
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
    approved = len(yes) >= effective_quorum and yes_conf >= effective_confidence
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
            "policy_selected_upstream": True,
            "external_contact_role": "transport_enforcer_only",
        }
    if authority_basis == "research_delegation_reserve":
        approved_reason = "3-of-4 council allocated research policy from a standing Owner-delegated reserve beyond the current effective ceiling"
    else:
        approved_reason = "3-of-4 distributed council approved a more permissive policy inside the current effective Owner ceiling"
    return CouncilPolicyDecision(
        proposal_id=change.proposal_id,
        ceiling_id=owner.ceiling_id,
        approved=approved,
        yes_votes=len(yes),
        no_votes=len(no),
        average_yes_confidence=yes_conf,
        liberalization_score=_liberalization_score(change) if approved else 0,
        reason=(approved_reason if approved else f"council quorum/confidence not met: yes={len(yes)} confidence={yes_conf}"),
        policy=policy,
        ballots=normalized,
        generated_at=int(time.time()) if now is None else int(now),
        authority_basis=authority_basis,
        delegation_id=delegation_id,
    )


def materialize_vote_solicitations(state_dir: str | Path, proposal: ContactRelaxationProposal | Mapping[str, Any], *, now: int | None = None) -> dict[str, Any]:
    change = proposal if isinstance(proposal, ContactRelaxationProposal) else ContactRelaxationProposal.from_mapping(proposal)
    current = int(time.time()) if now is None else int(now)
    tasks = [{
        "task_id": f"external-contact-policy:{change.proposal_id}:{member.lower()}",
        "actor": member,
        "status": "pending",
        "surface": "ExternalContactClient",
        "question": "Approve this bounded policy relaxation from the current ceiling or standing Research Delegation Reserve?",
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
    payload = {
        "schema": "senju-external-contact-council-solicitations/v2",
        "generated_at": current,
        "proposal_id": change.proposal_id,
        "members": list(COUNCIL_MEMBERS),
        "required_quorum": DEFAULT_QUORUM,
        "external_contact_role": "transport_enforcer_only",
        "external_contact_policy_responsibility_reduction_pct": EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT,
        "council_policy_delegation_target_pct": COUNCIL_POLICY_DELEGATION_TARGET_PCT,
        "tasks": tasks,
    }
    path = Path(state_dir) / "external_contact_council_solicitations.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


class CouncilExternalContactClient:
    """Transport-only ExternalContactClient using an upstream council policy decision."""

    def __init__(self, decision: CouncilPolicyDecision, **client_kwargs: Any) -> None:
        self.decision = decision
        self.client = ExternalContactClient(decision.to_policy(), **client_kwargs)
        self.external_contact_role = "transport_enforcer_only"
        self.policy_authority = False
        self.policy_responsibility_reduction_pct = EXTERNAL_CONTACT_POLICY_RESPONSIBILITY_REDUCTION_PCT

    def role_profile(self) -> dict[str, Any]:
        return {
            "role": self.external_contact_role,
            "policy_authority": self.policy_authority,
            "policy_selection_source": self.decision.authority_basis,
            "policy_responsibility_reduction_pct": self.policy_responsibility_reduction_pct,
            "council_policy_delegation_target_pct": COUNCIL_POLICY_DELEGATION_TARGET_PCT,
            "retained_transport_invariants": [
                "exact_authorized_host",
                "https_or_explicit_policy",
                "default_port_authority",
                "url_credentials_blocked",
                "public_dns_resolution",
                "method_from_compiled_policy",
                "redirect_revalidation",
                "cross_host_sensitive_header_stripping",
            ],
        }

    def contact(self, *args: Any, **kwargs: Any):
        return self.client.contact(*args, **kwargs)

    def contact_with_body(self, *args: Any, **kwargs: Any):
        return self.client.contact_with_body(*args, **kwargs)
