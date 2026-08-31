"""Canonical council-first approval constitution for new-host/root candidates.

This module controls review sequencing and canonical packet shape. It does not itself
create Authority. META/X/SENJU are the primary decision-makers for candidate approval;
Owner/standing evidence is deliberately moved two ranks lower and may only participate
as secondary activation validation after a council-primary decision.

A canonical packet produced by the negotiation system is entitled to formal review even
when secondary Owner/standing evidence is not yet present. Formal intake is not Authority
and never permits self-minting, credentials, network access, or terminal-stop bypass.
"""
from __future__ import annotations

from typing import Any, Iterable, Mapping

CONSTITUTION_ID = "authority-approval-constitution-v1"
CONSTITUTION_SCHEMA = "the-world-authority-approval-constitution/v1"
CANONICAL_FLOW_ID = "root-authority-candidate-v1"
FORMAL_INTAKE_RULE_ID = "negotiation-vetted-formal-intake-v1"
PRIMARY_APPROVERS = ("META", "X", "SENJU")
ALL_PARTICIPANTS = ("META", "X", "SENJU", "PR-ARMY", "CHILD", "AI")
SECONDARY_VALIDATION_RANK = 3
DECISION_PRECEDENCE = (
    "formal_negotiation_vetted_intake",
    "executive_council_primary_review",
    "dossier_integrity_and_scope_review",
    "secondary_authority_evidence_validation",
    "bounded_activation_by_existing_authority_machinery",
)
SECONDARY_EVIDENCE_TYPES = frozenset(
    {"existing_standing_authorization", "owner_verified_domain", "owner_exact_link"}
)


def constitutional_metadata() -> dict[str, Any]:
    return {
        "constitution_id": CONSTITUTION_ID,
        "constitution_schema": CONSTITUTION_SCHEMA,
        "canonical_flow_id": CANONICAL_FLOW_ID,
        "formal_intake_rule_id": FORMAL_INTAKE_RULE_ID,
        "decision_precedence": list(DECISION_PRECEDENCE),
        "primary_approvers": list(PRIMARY_APPROVERS),
        "primary_approval_requirement": "3_of_3",
        "random_ai_unrelated_root_generation_prohibited": True,
        "negotiation_vetted_canonical_candidate_must_enter_formal_approval": True,
        "secondary_owner_or_standing_evidence_required_for_formal_intake": False,
        "formal_intake_authority_effect": "none",
        "secondary_authority_evidence_rank": SECONDARY_VALIDATION_RANK,
        "secondary_authority_evidence_types": sorted(SECONDARY_EVIDENCE_TYPES),
        "secondary_evidence_may_admit_candidate": False,
        "secondary_evidence_may_raise_review_priority": False,
        "secondary_evidence_may_override_council_rejection": False,
        "unlisted_flow_policy": "exclude_from_canonical_review_surface",
        "shared_with": list(ALL_PARTICIPANTS),
    }


def secondary_validation(proof_type: object, proof_ref: object) -> dict[str, Any]:
    kind = str(proof_type or "").strip()
    ref = str(proof_ref or "").strip()
    present = bool(kind in SECONDARY_EVIDENCE_TYPES and ref)
    return {
        "stage": "secondary_authority_evidence_validation",
        "rank": SECONDARY_VALIDATION_RANK,
        "present": present,
        "evidence_type": kind if present else None,
        "evidence_ref": ref if present else None,
        "decision_power": "secondary_activation_validation_only",
        "may_admit_candidate": False,
        "may_raise_review_priority": False,
        "may_override_council_rejection": False,
    }


def canonical_review_packet(packet: Mapping[str, Any]) -> dict[str, Any]:
    out = dict(packet)
    out.update(constitutional_metadata())
    out["approval_stage"] = "executive_council_primary_review"
    out["required_approvers"] = list(PRIMARY_APPROVERS)
    out["required_approval"] = "META_X_SENJU_3_of_3"
    out["formal_intake_eligible"] = True
    out["formal_intake_requires_secondary_owner_or_standing_evidence"] = False
    out["authority_effect"] = "none"
    return out


def is_canonical_review_packet(packet: Mapping[str, Any]) -> bool:
    return (
        str(packet.get("constitution_id") or "") == CONSTITUTION_ID
        and str(packet.get("canonical_flow_id") or "") == CANONICAL_FLOW_ID
        and str(packet.get("approval_stage") or "") == "executive_council_primary_review"
        and tuple(packet.get("required_approvers") or ()) == PRIMARY_APPROVERS
        and packet.get("authority_effect") == "none"
    )


def filter_canonical_review_packets(rows: Iterable[Mapping[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    accepted: list[dict[str, Any]] = []
    excluded = 0
    for row in rows:
        if is_canonical_review_packet(row):
            accepted.append(dict(row))
        else:
            excluded += 1
    return accepted, excluded


def council_primary_approved(decision: Mapping[str, Any] | None) -> bool:
    if not isinstance(decision, Mapping):
        return False
    approvers = {str(v).strip().upper() for v in decision.get("approved_by", ()) if str(v).strip()}
    return (
        decision.get("approved") is True
        and approvers == set(PRIMARY_APPROVERS)
        and str(decision.get("constitution_id") or "") == CONSTITUTION_ID
        and str(decision.get("canonical_flow_id") or "") == CANONICAL_FLOW_ID
    )
