"""Autonomous AI authority council for owner-bounded outbound decisions.

The council removes the need to pre-list an ``approved_hosts`` set for every trusted
Agent.  Instead, the explicit RootAuthorityEnvelope is the host/method ceiling and the
transitive trust graph decides which upper Agents may cast the council's independent
ALLOW vote.

This deliberately increases autonomy only *inside* an already active owner envelope:

- ordinary DENY / ABSTAIN votes from other evaluators are advisory and may be overcome
  by a valid council ALLOW;
- evaluator outages are not global blockers;
- one or more trusted META/X/SENJU-style approvers may satisfy the council threshold;
- the council may judge any exact host/method already present in the owner envelope,
  without a second per-host allowlist.

Global stops remain outside council discretion.  Expired/revoked envelopes, requests
outside the envelope, root hard-denied hosts, and HARD_DENY votes are still enforced by
``decide_distributed_authority`` and cannot be downgraded here.
"""
from __future__ import annotations

import dataclasses
from typing import Iterable

from .distributed_authority import (
    ABSTAIN,
    ALLOW,
    AuthorityEvaluator,
    AuthorityRequest,
    AuthorityVote,
    DistributedAuthorityDecision,
    RootAuthorityEnvelope,
    decide_distributed_authority,
)
from .transitive_trust import TrustEdge, resolve_trust

GENERIC_COUNCIL_SCOPE = "egress:approve"
HOST_COUNCIL_SCOPE_PREFIX = "egress:host:"


class AutonomousAuthorityCouncilError(RuntimeError):
    """Raised when council configuration is invalid."""


@dataclasses.dataclass(frozen=True)
class CouncilPolicy:
    """How aggressively trusted Agents may approve work inside one Owner envelope."""

    min_trusted_agents: int = 1
    allowed_methods: tuple[str, ...] = ("GET", "HEAD")
    name: str = "ai_authority_council"

    def __post_init__(self) -> None:
        if int(self.min_trusted_agents) < 1:
            raise AutonomousAuthorityCouncilError("min_trusted_agents must be at least 1")
        methods = tuple(sorted({str(item).strip().upper() for item in self.allowed_methods if str(item).strip()}))
        if not methods:
            raise AutonomousAuthorityCouncilError("allowed_methods cannot be empty")
        object.__setattr__(self, "allowed_methods", methods)
        if not str(self.name).strip():
            raise AutonomousAuthorityCouncilError("council name is required")


class AutonomousAuthorityCouncil:
    """Independent authority evaluator driven by transitive Agent trust.

    Unlike ``TrustedAgentAuthorityEvaluator``, callers do not have to duplicate an
    ``approved_hosts`` list.  The RootAuthorityEnvelope already defines the destination
    ceiling, so a trusted approver with ``egress:approve`` may autonomously judge any
    request inside that envelope.  A narrower ``egress:host:<hostname>`` trust scope is
    also supported.
    """

    def __init__(
        self,
        *,
        envelope: RootAuthorityEnvelope,
        owner: str,
        approvers: Iterable[str],
        edges: Iterable[TrustEdge],
        policy: CouncilPolicy | None = None,
    ) -> None:
        self.envelope = envelope
        self.owner = str(owner).strip()
        self.approvers = tuple(dict.fromkeys(str(item).strip() for item in approvers if str(item).strip()))
        self.edges = tuple(edges)
        self.policy = policy or CouncilPolicy()
        self.name = self.policy.name
        if not self.owner:
            raise AutonomousAuthorityCouncilError("owner is required")
        if not self.approvers:
            raise AutonomousAuthorityCouncilError("at least one council approver is required")

    def _trusted_approvals(self, request: AuthorityRequest) -> tuple[dict[str, object], ...]:
        approvals: list[dict[str, object]] = []
        host_scope = f"{HOST_COUNCIL_SCOPE_PREFIX}{request.host}"
        for approver in self.approvers:
            resolution = resolve_trust(owner=self.owner, subject=approver, edges=self.edges)
            if not resolution.trusted:
                continue
            scopes = set(resolution.effective_scopes)
            can_approve = "*" in scopes or GENERIC_COUNCIL_SCOPE in scopes or host_scope in scopes
            if not can_approve:
                continue
            approvals.append(
                {
                    "approver": approver,
                    "trust_path": resolution.path,
                    "effective_scopes": resolution.effective_scopes,
                    "depth": resolution.depth,
                }
            )
        return tuple(approvals)

    def evaluate(self, request: AuthorityRequest) -> AuthorityVote:
        # Redundant envelope checks keep the council safe even if someone calls the
        # evaluator directly instead of through decide_distributed_authority().
        if not self.envelope.is_active():
            return AuthorityVote(self.name, ABSTAIN, "owner_envelope_not_active")
        if request.host not in self.envelope.exact_hosts:
            return AuthorityVote(self.name, ABSTAIN, "request_outside_council_owner_envelope")
        if request.method not in self.envelope.allowed_methods:
            return AuthorityVote(self.name, ABSTAIN, "method_outside_council_owner_envelope")
        if request.host in self.envelope.hard_denied_hosts:
            return AuthorityVote(self.name, ABSTAIN, "root_hard_deny_not_council_overridable")
        if request.method not in self.policy.allowed_methods:
            return AuthorityVote(self.name, ABSTAIN, "method_not_delegated_to_ai_council")

        approvals = self._trusted_approvals(request)
        if len(approvals) < int(self.policy.min_trusted_agents):
            return AuthorityVote(
                self.name,
                ABSTAIN,
                "insufficient_trusted_ai_council_approvals",
                {
                    "required": int(self.policy.min_trusted_agents),
                    "trusted": len(approvals),
                    "approvers": tuple(item["approver"] for item in approvals),
                },
            )

        return AuthorityVote(
            self.name,
            ALLOW,
            "autonomous_ai_council_approval_inside_owner_envelope",
            {
                "owner_envelope": self.envelope.reference,
                "approval_mode": "owner_envelope_no_per_host_reapproval",
                "required_trusted_agents": int(self.policy.min_trusted_agents),
                "trusted_approvals": approvals,
            },
        )


def decide_with_autonomous_council(
    *,
    envelope: RootAuthorityEnvelope,
    request: AuthorityRequest,
    owner: str,
    approvers: Iterable[str],
    edges: Iterable[TrustEdge],
    evaluators: Iterable[AuthorityEvaluator] = (),
    council_policy: CouncilPolicy | None = None,
    min_allow_votes: int = 1,
    now: int | None = None,
) -> DistributedAuthorityDecision:
    """Add the autonomous AI council as an independent authority path.

    ``decide_distributed_authority`` still owns final enforcement.  Consequently an
    ordinary evaluator DENY may be overcome by the council, while HARD_DENY and root
    boundary failures remain global stops.
    """
    council = AutonomousAuthorityCouncil(
        envelope=envelope,
        owner=owner,
        approvers=approvers,
        edges=edges,
        policy=council_policy,
    )
    return decide_distributed_authority(
        envelope=envelope,
        request=request,
        evaluators=(*tuple(evaluators), council),
        min_allow_votes=min_allow_votes,
        now=now,
    )
