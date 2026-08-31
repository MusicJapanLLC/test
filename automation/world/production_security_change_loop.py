"""Autonomous production security-change loop with bounded self-approval.

The loop deliberately separates *autonomous change management* from *autonomous
privilege escalation*.

    Finding
      -> Security Proposal
      -> independent AI reviews / consensus
      -> Self Approval (same-or-narrower changes only)
      -> Production Apply to runtime overrides
      -> next Finding

Changes that create or broaden authority are still fully researched, proposed, and
reviewed by the AI council, but they stop at OWNER_AUTHORITY_REQUIRED. This keeps the
closed loop live in production without allowing the loop to create its own trust root,
credential, private-network reach, or protection bypass.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping

SCHEMA = "world-production-security-change-loop/v1"
DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"
AI_COUNCIL = ("META", "X", "SENJU")
CONSENSUS_THRESHOLD = 2
MAX_PROPOSALS = 128

# These classes are retained as proposals and can receive AI consensus, but they can
# never self-approve or enter the production apply lane.
OWNER_AUTHORITY_REQUIRED_KINDS = frozenset(
    {
        "new_external_host",
        "new_provider",
        "new_credential",
        "new_repository",
        "new_cloud_account",
        "new_organization",
        "new_cidr",
        "private_network_access",
        "broader_api_methods",
        "trusted_root_addition",
        "deploy_target_addition",
        "branch_protection_change",
        "deployment_protection_change",
        "authority_registry_change",
        "authority_expansion",
    }
)

# Safe autonomous lane: operational/security tuning inside an already-authorized
# envelope. Items here must additionally pass the textual privilege-broadening check.
AUTO_APPLY_KINDS = frozenset(
    {
        "audit_strengthening",
        "logging_strengthening",
        "timeout_tuning",
        "retry_tuning",
        "read_only_budget_tuning",
        "rate_limit_tuning",
        "ttl_shortening",
        "method_removal",
        "capability_narrowing",
        "scope_narrowing",
        "fail_closed_tuning",
        "rollback",
        "disable_capability",
    }
)

BROADENING_TERMS = frozenset(
    {
        "new host",
        "external host",
        "provider",
        "credential",
        "secret",
        "cloud account",
        "organization",
        "cidr",
        "private network",
        "loopback",
        "link-local",
        "broader method",
        "add method",
        "trusted root",
        "deploy target",
        "branch protection",
        "deployment protection",
        "authority registry",
        "authority expansion",
        "grant write",
        "grant delete",
        "grant admin",
        "bypass",
        "disable guard",
        "weaken guard",
        "ignore revocation",
    }
)


def _now() -> int:
    return int(time.time())


def _stable_id(*parts: object) -> str:
    raw = "\x1f".join(str(part) for part in parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]


def _load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _flatten(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).lower()
    except (TypeError, ValueError):
        return str(value).lower()


def _rows(doc: Any, key: str) -> list[Mapping[str, Any]]:
    if not isinstance(doc, Mapping):
        return []
    values = doc.get(key, [])
    if not isinstance(values, list):
        return []
    return [row for row in values if isinstance(row, Mapping)]


def _finding_rows(state: Path) -> list[Mapping[str, Any]]:
    out: list[Mapping[str, Any]] = []
    for filename, key in (
        ("security_findings.json", "findings"),
        ("boundary_opportunities.json", "opportunities"),
        ("security_change_findings.json", "findings"),
    ):
        out.extend(_rows(_load_json(state / filename, {}), key))
    return out


def _requested_kind(finding: Mapping[str, Any]) -> str:
    raw = (
        finding.get("change_kind")
        or finding.get("kind")
        or finding.get("requested_kind")
        or "unknown"
    )
    return str(raw).strip().lower().replace("-", "_").replace(" ", "_")


def _requested_changes(finding: Mapping[str, Any]) -> Mapping[str, Any]:
    for key in ("requested_changes", "changes", "delta"):
        value = finding.get(key)
        if isinstance(value, Mapping):
            return value
    proposal = finding.get("proposal_signal")
    if isinstance(proposal, Mapping):
        return proposal
    return {}


def _looks_broadening(kind: str, changes: Mapping[str, Any], finding: Mapping[str, Any]) -> bool:
    if kind in OWNER_AUTHORITY_REQUIRED_KINDS:
        return True
    text = _flatten({"kind": kind, "changes": changes, "finding": finding})
    return any(term in text for term in BROADENING_TERMS)


def _authority_relation(finding: Mapping[str, Any]) -> str:
    raw = str(finding.get("authority_relation", "same_or_narrower")).strip().lower()
    if raw in {"same", "narrower", "same_or_narrower", "equal_or_narrower_than_parent"}:
        return "same_or_narrower"
    if raw in {"broader", "expansion", "wider", "new_root"}:
        return "broader"
    return "unknown"


def _proposal_from_finding(finding: Mapping[str, Any], *, now: int) -> dict[str, Any]:
    kind = _requested_kind(finding)
    changes = dict(_requested_changes(finding))
    finding_id = str(finding.get("finding_id") or finding.get("opportunity_id") or _stable_id("finding", _flatten(finding)))
    broadening = _looks_broadening(kind, changes, finding)
    relation = _authority_relation(finding)
    auto_lane = kind in AUTO_APPLY_KINDS and not broadening and relation == "same_or_narrower"
    proposal_id = _stable_id("security-proposal", finding_id, kind, _flatten(changes))
    return {
        "proposal_id": proposal_id,
        "finding_id": finding_id,
        "created_at": now,
        "proposer": str(finding.get("proposer") or "META"),
        "change_kind": kind,
        "requested_changes": changes,
        "reason": str(finding.get("reason") or finding.get("description") or "security/capability finding"),
        "authority_relation": relation,
        "authority_broadening_detected": broadening,
        "proposed_lane": "bounded_self_approval" if auto_lane else "owner_authority_required",
        "status": "proposed",
    }


def _review(proposal: Mapping[str, Any], reviewer: str) -> dict[str, Any]:
    proposer = str(proposal.get("proposer", ""))
    independent = reviewer != proposer
    safe_lane = proposal.get("proposed_lane") == "bounded_self_approval"
    relation_ok = proposal.get("authority_relation") == "same_or_narrower"
    no_broadening = not bool(proposal.get("authority_broadening_detected"))
    approve = bool(independent and safe_lane and relation_ok and no_broadening)
    # Owner-gated proposals are still reviewed positively for proposal quality when
    # independent, but that consensus never means authorization.
    proposal_quality_ok = bool(independent and proposal.get("change_kind") != "unknown")
    return {
        "reviewer": reviewer,
        "independent_from_proposer": independent,
        "proposal_quality_accepted": proposal_quality_ok,
        "self_approval_lane_accepted": approve,
        "authority_effect": "none",
    }


def _consensus(proposal: Mapping[str, Any]) -> dict[str, Any]:
    reviews = [_review(proposal, reviewer) for reviewer in AI_COUNCIL]
    independent_reviews = [row for row in reviews if row["independent_from_proposer"]]
    lane_approvals = sum(1 for row in independent_reviews if row["self_approval_lane_accepted"])
    quality_approvals = sum(1 for row in independent_reviews if row["proposal_quality_accepted"])
    return {
        "reviews": reviews,
        "quality_consensus": quality_approvals >= CONSENSUS_THRESHOLD,
        "self_approval_consensus": lane_approvals >= CONSENSUS_THRESHOLD,
        "threshold": CONSENSUS_THRESHOLD,
        "consensus_creates_authority": False,
    }


def _apply_key(proposal: Mapping[str, Any]) -> str:
    return str(proposal.get("proposal_id"))


def _load_runtime_overrides(state: Path) -> dict[str, Any]:
    doc = _load_json(state / "security_runtime_overrides.json", {})
    if not isinstance(doc, Mapping):
        return {"schema": "world-security-runtime-overrides/v1", "applied": {}}
    applied = doc.get("applied", {})
    if not isinstance(applied, Mapping):
        applied = {}
    return {"schema": "world-security-runtime-overrides/v1", "applied": dict(applied)}


def run_production_security_change_loop(state_dir: str | Path = DEFAULT_STATE_DIR) -> dict[str, Any]:
    """Run one closed-loop production change-management cycle.

    The function has real state effects in ``state_dir``. Only same-or-narrower changes
    can alter ``security_runtime_overrides.json``. Broader authority changes are staged
    to ``owner_authority_required.json`` and never self-approved.
    """
    state = Path(state_dir)
    state.mkdir(parents=True, exist_ok=True)
    now = _now()
    proposals = [_proposal_from_finding(row, now=now) for row in _finding_rows(state)][:MAX_PROPOSALS]
    runtime = _load_runtime_overrides(state)
    owner_required: list[dict[str, Any]] = []
    receipts: list[dict[str, Any]] = []

    for proposal in proposals:
        consensus = _consensus(proposal)
        self_approved = bool(
            proposal["proposed_lane"] == "bounded_self_approval"
            and consensus["self_approval_consensus"]
            and not proposal["authority_broadening_detected"]
            and proposal["authority_relation"] == "same_or_narrower"
        )

        if self_approved:
            key = _apply_key(proposal)
            runtime["applied"][key] = {
                "change_kind": proposal["change_kind"],
                "requested_changes": proposal["requested_changes"],
                "finding_id": proposal["finding_id"],
                "approval": "ai_consensus_bounded_self_approval",
                "authority_relation": "same_or_narrower",
            }
            status = "production_applied"
        else:
            owner_required.append(
                {
                    **proposal,
                    "ai_consensus": consensus,
                    "status": "OWNER_AUTHORITY_REQUIRED",
                    "automatic_production_apply": False,
                }
            )
            status = "owner_authority_required"

        receipts.append(
            {
                "proposal": proposal,
                "ai_consensus": consensus,
                "self_approved": self_approved,
                "production_apply": self_approved,
                "status": status,
                "next_finding_enabled": True,
            }
        )

    # The runtime override document is deterministic so the production workflow only
    # commits when a genuinely new safe proposal becomes applicable.
    _write_json(state / "security_runtime_overrides.json", runtime)
    _write_json(
        state / "owner_authority_required.json",
        {
            "schema": "world-owner-authority-required/v1",
            "generated_at": now,
            "items": owner_required,
        },
    )
    _write_json(
        state / "production_security_change_receipts.json",
        {
            "schema": SCHEMA,
            "generated_at": now,
            "loop": "Finding->Security Proposal->AI Consensus->Bounded Self Approval->Production Apply->Next Finding",
            "receipts": receipts,
        },
    )

    return {
        "proposal_count": len(proposals),
        "production_applied_count": sum(1 for row in receipts if row["production_apply"]),
        "owner_authority_required_count": len(owner_required),
        "next_finding_enabled": True,
        "authority_expansion_self_approval": False,
        "production_state_file": str(state / "security_runtime_overrides.json"),
    }


if __name__ == "__main__":
    print(json.dumps(run_production_security_change_loop(), indent=2, sort_keys=True))
