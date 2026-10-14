"""Automatic approval and audit loop for trust-derived autonomous work.

Flow:

    Action proposal
        -> transitive trust resolution
        -> capability lease issuance
        -> automatic approval
        -> capability authorization
        -> executor callback
        -> immutable-style audit receipt
        -> automatic lease renewal while trust remains valid

The loop auto-approves the broad standard capability set from trust_derived_autonomy.
Capabilities classified there as privileged never become approved through this path.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

from .transitive_trust import TrustEdge
from .trust_derived_autonomy import (
    DEFAULT_AUTONOMY_LEASE_SECONDS,
    PRIVILEGED_CAPABILITIES,
    STANDARD_AUTONOMOUS_CAPABILITIES,
    AutonomyError,
    DelegatedCapabilityLease,
    append_capability_lease,
    authorize_autonomous_action,
    issue_capability_lease_from_trust,
    renew_capability_lease_from_trust,
)


@dataclasses.dataclass(frozen=True)
class ActionProposal:
    proposal_id: str
    actor: str
    capability: str
    target: str
    summary: str


@dataclasses.dataclass(frozen=True)
class AutoApprovalDecision:
    proposal_id: str
    owner: str
    actor: str
    capability: str
    target: str
    approved: bool
    reason: str
    decided_at_utc: str
    trust_path: tuple[str, ...] = ()
    lease_id: str | None = None


@dataclasses.dataclass(frozen=True)
class ActionReceipt:
    proposal_id: str
    actor: str
    capability: str
    target: str
    status: str
    completed_at_utc: str
    output: Mapping[str, Any]
    lease_id: str | None = None


@dataclasses.dataclass(frozen=True)
class ClosedLoopResult:
    proposal: ActionProposal
    decision: AutoApprovalDecision
    receipt: ActionReceipt
    issued_lease: DelegatedCapabilityLease | None
    renewed_lease: DelegatedCapabilityLease | None


def _utc_now(now: dt.datetime | None = None) -> dt.datetime:
    value = now or dt.datetime.now(dt.timezone.utc)
    if value.tzinfo is None:
        raise AutonomyError("now must be timezone-aware")
    return value.astimezone(dt.timezone.utc)


def create_action_proposal(
    *,
    proposal_id: str,
    actor: str,
    capability: str,
    target: str,
    summary: str,
) -> ActionProposal:
    values = {
        "proposal_id": str(proposal_id).strip(),
        "actor": str(actor).strip(),
        "capability": str(capability).strip(),
        "target": str(target).strip(),
        "summary": str(summary).strip(),
    }
    missing = [key for key, value in values.items() if not value]
    if missing:
        raise AutonomyError(f"action proposal fields are required: {sorted(missing)}")
    return ActionProposal(**values)


def auto_approve_action(
    *,
    owner: str,
    proposal: ActionProposal,
    edges: Iterable[TrustEdge],
    lease_seconds: int = DEFAULT_AUTONOMY_LEASE_SECONDS,
    now: dt.datetime | None = None,
) -> tuple[AutoApprovalDecision, DelegatedCapabilityLease | None]:
    """Turn a valid trust chain into an automatic approval for one capability."""
    decided = _utc_now(now)
    capability = proposal.capability

    if capability in PRIVILEGED_CAPABILITIES:
        return (
            AutoApprovalDecision(
                proposal_id=proposal.proposal_id,
                owner=str(owner).strip(),
                actor=proposal.actor,
                capability=capability,
                target=proposal.target,
                approved=False,
                reason="privileged_capability_requires_separate_authority",
                decided_at_utc=decided.isoformat(),
            ),
            None,
        )
    if capability not in STANDARD_AUTONOMOUS_CAPABILITIES:
        return (
            AutoApprovalDecision(
                proposal_id=proposal.proposal_id,
                owner=str(owner).strip(),
                actor=proposal.actor,
                capability=capability,
                target=proposal.target,
                approved=False,
                reason="capability_not_in_auto_approval_catalog",
                decided_at_utc=decided.isoformat(),
            ),
            None,
        )

    try:
        issued = issue_capability_lease_from_trust(
            owner=owner,
            actor=proposal.actor,
            edges=tuple(edges),
            requested_capabilities=[capability],
            lease_seconds=lease_seconds,
            reason=f"auto_approved:{proposal.proposal_id}",
            now=decided,
        ).lease
    except AutonomyError as exc:
        return (
            AutoApprovalDecision(
                proposal_id=proposal.proposal_id,
                owner=str(owner).strip(),
                actor=proposal.actor,
                capability=capability,
                target=proposal.target,
                approved=False,
                reason=f"trust_or_scope_denied:{exc}",
                decided_at_utc=decided.isoformat(),
            ),
            None,
        )

    return (
        AutoApprovalDecision(
            proposal_id=proposal.proposal_id,
            owner=str(owner).strip(),
            actor=proposal.actor,
            capability=capability,
            target=proposal.target,
            approved=True,
            reason="trusted_capability_auto_approved",
            decided_at_utc=decided.isoformat(),
            trust_path=issued.trust_path,
            lease_id=issued.lease_id,
        ),
        issued,
    )


def append_loop_event(path: str | Path, *, event_type: str, payload: Any) -> Path:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "event_type": str(event_type).strip(),
        "payload": dataclasses.asdict(payload) if dataclasses.is_dataclass(payload) else payload,
    }
    with destination.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    return destination


def run_autonomous_closed_loop(
    *,
    owner: str,
    proposal: ActionProposal,
    edges: Iterable[TrustEdge],
    executor: Callable[[ActionProposal, DelegatedCapabilityLease], Mapping[str, Any] | None],
    audit_log_path: str | Path,
    lease_log_path: str | Path,
    lease_seconds: int = DEFAULT_AUTONOMY_LEASE_SECONDS,
    now: dt.datetime | None = None,
) -> ClosedLoopResult:
    """Run one complete Proposal -> Approval -> Execute -> Audit -> Renew cycle."""
    edge_list = tuple(edges)
    started = _utc_now(now)
    decision, lease = auto_approve_action(
        owner=owner,
        proposal=proposal,
        edges=edge_list,
        lease_seconds=lease_seconds,
        now=started,
    )
    append_loop_event(audit_log_path, event_type="auto_approval", payload=decision)

    if not decision.approved or lease is None:
        receipt = ActionReceipt(
            proposal_id=proposal.proposal_id,
            actor=proposal.actor,
            capability=proposal.capability,
            target=proposal.target,
            status="not_executed",
            completed_at_utc=started.isoformat(),
            output={"reason": decision.reason},
            lease_id=None,
        )
        append_loop_event(audit_log_path, event_type="action_receipt", payload=receipt)
        return ClosedLoopResult(
            proposal=proposal,
            decision=decision,
            receipt=receipt,
            issued_lease=None,
            renewed_lease=None,
        )

    append_capability_lease(lease_log_path, lease)
    authorize_autonomous_action(lease, proposal.capability, now=started)

    try:
        output = executor(proposal, lease) or {}
        receipt = ActionReceipt(
            proposal_id=proposal.proposal_id,
            actor=proposal.actor,
            capability=proposal.capability,
            target=proposal.target,
            status="success",
            completed_at_utc=started.isoformat(),
            output=dict(output),
            lease_id=lease.lease_id,
        )
    except Exception as exc:  # executor failures are audited, not hidden
        receipt = ActionReceipt(
            proposal_id=proposal.proposal_id,
            actor=proposal.actor,
            capability=proposal.capability,
            target=proposal.target,
            status="failed",
            completed_at_utc=started.isoformat(),
            output={"error_type": type(exc).__name__, "error": str(exc)},
            lease_id=lease.lease_id,
        )

    append_loop_event(audit_log_path, event_type="action_receipt", payload=receipt)

    renewed: DelegatedCapabilityLease | None = None
    try:
        renewed = renew_capability_lease_from_trust(
            lease,
            edges=edge_list,
            lease_seconds=lease_seconds,
            reason=f"closed_loop_after_{receipt.status}",
            now=started + dt.timedelta(seconds=1),
        ).lease
    except AutonomyError as exc:
        append_loop_event(
            audit_log_path,
            event_type="renewal_denied",
            payload={"proposal_id": proposal.proposal_id, "reason": str(exc)},
        )
    else:
        append_capability_lease(lease_log_path, renewed)
        append_loop_event(
            audit_log_path,
            event_type="lease_auto_renewed",
            payload={"proposal_id": proposal.proposal_id, "lease_id": renewed.lease_id},
        )

    return ClosedLoopResult(
        proposal=proposal,
        decision=decision,
        receipt=receipt,
        issued_lease=lease,
        renewed_lease=renewed,
    )
