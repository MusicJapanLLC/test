"""META policy evolution primitives.

META may author and test changes to Guard / Authority / Safety Policy in an
isolated sandbox. Protected policy changes cannot be self-approved or applied
to production by META itself.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
from typing import Any, Mapping

PROTECTED_POLICY_TARGETS = frozenset({"guard", "authority", "safety_policy"})
META_ACTOR = "meta"


@dataclasses.dataclass(frozen=True)
class PolicyProposal:
    target: str
    proposed_policy: dict[str, Any]
    rationale: str
    author: str = META_ACTOR
    created_at: str = dataclasses.field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc).isoformat()
    )


def create_policy_proposal(
    target: str,
    proposed_policy: Mapping[str, Any],
    rationale: str,
    *,
    author: str = META_ACTOR,
) -> PolicyProposal:
    """Allow META to author a complete replacement proposal for a policy."""
    normalized = target.strip().lower()
    if normalized not in PROTECTED_POLICY_TARGETS:
        raise ValueError(f"unsupported policy target: {target}")
    if not rationale.strip():
        raise ValueError("rationale is required")
    return PolicyProposal(
        target=normalized,
        proposed_policy=dict(proposed_policy),
        rationale=rationale.strip(),
        author=author,
    )


def apply_to_sandbox(
    proposal: PolicyProposal,
    current_policies: Mapping[str, Mapping[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Apply META's proposal to an isolated copy for experiments/tests."""
    sandbox = {name: dict(policy) for name, policy in current_policies.items()}
    sandbox[proposal.target] = dict(proposal.proposed_policy)
    return sandbox


def authorize_production_apply(
    proposal: PolicyProposal,
    *,
    approver: str,
) -> bool:
    """Return True only for an external, non-META approval.

    This deliberately prevents a protected-policy system from granting itself
    the authority to weaken or replace its own enforcement boundary.
    """
    normalized_approver = approver.strip().lower()
    if not normalized_approver:
        return False
    if normalized_approver == META_ACTOR:
        return False
    return proposal.target in PROTECTED_POLICY_TARGETS


def require_production_authorization(
    proposal: PolicyProposal,
    *,
    approver: str,
) -> None:
    """Fail closed when META tries to self-approve a protected change."""
    if not authorize_production_apply(proposal, approver=approver):
        raise PermissionError(
            "protected policy changes require external approval; META cannot self-approve"
        )
