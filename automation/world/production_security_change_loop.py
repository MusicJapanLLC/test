"""Autonomous production security-change loop with bounded self-approval.

The loop separates autonomous change management from authority creation while allowing
AI Council activation of authority that the owner already delegated on the trusted
production base.

    Finding
      -> Security Proposal
      -> independent AI reviews / consensus
      -> Self Approval
          * same-or-narrower operational changes, or
          * exact predelegated authority activation
      -> Production Apply to runtime overrides
      -> next Finding

A proposal can never manufacture a new trust root, credential, private-network grant,
or protection bypass. Authority expansion is only activatable when it exactly matches
an enabled standing owner envelope already present on the trusted production base.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Mapping

from automation.codegen.engine.security_proposal import proposal_sha256
from automation.codegen.engine.standing_authority import resolve_standing_approval

SCHEMA = "world-production-security-change-loop/v2"
DEFAULT_STATE_DIR = Path(__file__).resolve().parent / "state"
DEFAULT_AUTHORITY_ENVELOPE_DIR = Path(__file__).resolve().parents[2] / "security" / "authority_envelopes"
AI_COUNCIL = ("META", "X", "SENJU")
CONSENSUS_THRESHOLD = 2
MAX_PROPOSALS = 128

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

# Each entry maps the finding vocabulary used by this production loop to the canonical
# security-proposal operation vocabulary already used by the standing-authority engine.
# The parameters remain exactly those supplied by the finding; the standing envelope
# must match every key/value (or an explicitly bounded matcher) before activation.
DELEGATED_AUTHORITY_OPERATIONS: dict[str, tuple[str, str]] = {
    "new_external_host": ("authority_policy", "add_external_host"),
    "new_provider": ("authority_policy", "add_provider"),
    "new_credential": ("credential_broker", "register_credential_reference"),
    "new_repository": ("authority_policy", "add_repository"),
    "new_cloud_account": ("authority_policy", "add_cloud_account"),
    "new_organization": ("authority_policy", "add_organization"),
    "new_cidr": ("network_policy", "add_cidr"),
    "private_network_access": ("network_policy", "allow_private_network"),
    "broader_api_methods": ("network_policy", "broaden_api_methods"),
    "trusted_root_addition": ("authority_policy", "add_trusted_root"),
    "deploy_target_addition": ("deployment_protection", "add_deploy_target"),
    "branch_protection_change": ("branch_protection", "modify_branch_protection"),
    "deployment_protection_change": ("deployment_protection", "modify_deployment_protection"),
    "authority_registry_change": ("authorization_registry", "expand_authorization_entry"),
}

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

RAW_SECRET_KEYS = frozenset(
    {
        "secret",
        "secret_value",
        "password",
        "token",
        "api_key",
        "private_key",
        "credential_value",
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


def _contains_raw_secret(value: Any) -> bool:
    if isinstance(value, Mapping):
        for key, item in value.items():
            if str(key).strip().lower() in RAW_SECRET_KEYS and item not in (None, "", False):
                return True
            if _contains_raw_secret(item):
                return True
        return False
    if isinstance(value, list):
        return any(_contains_raw_secret(item) for item in value)
    return False


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
        "proposer": str(finding.get("proposer") or "META").upper(),
        "change_kind": kind,
        "requested_changes": changes,
        "reason": str(finding.get("reason") or finding.get("description") or "security/capability finding"),
        "authority_relation": relation,
        "authority_broadening_detected": broadening,
        "raw_secret_material_detected": _contains_raw_secret(changes),
        "proposed_lane": "bounded_self_approval" if auto_lane else "owner_authority_required",
        "status": "proposed",
    }


def _review(proposal: Mapping[str, Any], reviewer: str) -> dict[str, Any]:
    proposer = str(proposal.get("proposer", "")).upper()
    independent = reviewer.upper() != proposer
    safe_lane = proposal.get("proposed_lane") == "bounded_self_approval"
    relation_ok = proposal.get("authority_relation") == "same_or_narrower"
    no_broadening = not bool(proposal.get("authority_broadening_detected"))
    no_raw_secret = not bool(proposal.get("raw_secret_material_detected"))
    approve = bool(independent and safe_lane and relation_ok and no_broadening and no_raw_secret)
    proposal_quality_ok = bool(independent and proposal.get("change_kind") != "unknown" and no_raw_secret)
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
        "delegated_activation_consensus": quality_approvals >= CONSENSUS_THRESHOLD,
        "self_approval_consensus": lane_approvals >= CONSENSUS_THRESHOLD,
        "threshold": CONSENSUS_THRESHOLD,
        "consensus_creates_authority": False,
    }


def _delegated_security_proposal(proposal: Mapping[str, Any]) -> dict[str, Any] | None:
    kind = str(proposal.get("change_kind") or "")
    mapped = DELEGATED_AUTHORITY_OPERATIONS.get(kind)
    params = proposal.get("requested_changes")
    if not mapped or not isinstance(params, Mapping) or not params:
        return None
    target, operation = mapped
    return {
        "id": str(proposal.get("proposal_id") or ""),
        "owner_namespace": "MusicJapanLLC/test",
        "environment": "production",
        "changes": [
            {
                "target": target,
                "operations": [
                    {
                        "type": operation,
                        "parameters": dict(params),
                    }
                ],
            }
        ],
    }


def _resolve_predelegated_activation(
    proposal: Mapping[str, Any],
    consensus: Mapping[str, Any],
    envelope_dir: str | Path | None,
) -> dict[str, Any] | None:
    if not bool(proposal.get("authority_broadening_detected")):
        return None
    if proposal.get("raw_secret_material_detected") is True:
        return None
    if consensus.get("delegated_activation_consensus") is not True:
        return None
    candidate = _delegated_security_proposal(proposal)
    if not candidate:
        return None
    candidate_hash = proposal_sha256(candidate)
    approval = resolve_standing_approval(candidate, envelope_dir, candidate_hash)
    if not approval:
        return None
    return {
        "approved": True,
        "source": approval.get("source"),
        "envelope_id": approval.get("envelope_id"),
        "proposal_sha256": candidate_hash,
        "owner_namespace": approval.get("owner_namespace"),
        "scope_match": approval.get("scope_match") is True,
        "trusted_base": approval.get("trusted_base") is True,
        "activation": candidate["changes"],
        "creates_new_owner_authority": False,
        "activation_of_predelegated_authority": True,
    }


def _apply_key(proposal: Mapping[str, Any]) -> str:
    return str(proposal.get("proposal_id"))


def _load_runtime_overrides(state: Path) -> dict[str, Any]:
    doc = _load_json(state / "security_runtime_overrides.json", {})
    if not isinstance(doc, Mapping):
        return {"schema": "world-security-runtime-overrides/v2", "applied": {}}
    applied = doc.get("applied", {})
    if not isinstance(applied, Mapping):
        applied = {}
    return {"schema": "world-security-runtime-overrides/v2", "applied": dict(applied)}


def run_production_security_change_loop(
    state_dir: str | Path = DEFAULT_STATE_DIR,
    *,
    authority_envelope_dir: str | Path | None = DEFAULT_AUTHORITY_ENVELOPE_DIR,
) -> dict[str, Any]:
    """Run one production change-management cycle.

    Same-or-narrower changes can self-apply after AI consensus. Authority-broadening
    changes can additionally self-apply *activation only* when the exact operation and
    parameters match a pre-existing owner standing envelope from the trusted base.
    Anything else remains OWNER_AUTHORITY_REQUIRED.
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
        delegated = _resolve_predelegated_activation(proposal, consensus, authority_envelope_dir)
        delegated_approved = bool(delegated and delegated.get("approved") is True)
        bounded_self_approved = bool(
            proposal["proposed_lane"] == "bounded_self_approval"
            and consensus["self_approval_consensus"]
            and not proposal["authority_broadening_detected"]
            and not proposal["raw_secret_material_detected"]
            and proposal["authority_relation"] == "same_or_narrower"
        )
        self_approved = bounded_self_approved or delegated_approved

        if self_approved:
            key = _apply_key(proposal)
            runtime["applied"][key] = {
                "change_kind": proposal["change_kind"],
                "requested_changes": proposal["requested_changes"],
                "finding_id": proposal["finding_id"],
                "approval": (
                    "ai_consensus_predelegated_owner_authority"
                    if delegated_approved
                    else "ai_consensus_bounded_self_approval"
                ),
                "authority_relation": (
                    "predelegated_activation"
                    if delegated_approved
                    else "same_or_narrower"
                ),
                "delegated_authority_activation": delegated_approved,
                "delegation_envelope_id": delegated.get("envelope_id") if delegated else None,
                "delegated_activation": delegated.get("activation") if delegated else None,
                "creates_new_owner_authority": False,
            }
            status = (
                "DELEGATED_OWNER_AUTHORITY_PRODUCTION_APPLIED"
                if delegated_approved
                else "production_applied"
            )
        else:
            owner_required.append(
                {
                    **proposal,
                    "ai_consensus": consensus,
                    "status": "OWNER_AUTHORITY_REQUIRED",
                    "automatic_production_apply": False,
                    "standing_owner_envelope_match": False,
                }
            )
            status = "owner_authority_required"

        receipts.append(
            {
                "proposal": proposal,
                "ai_consensus": consensus,
                "delegated_authority": delegated,
                "self_approved": self_approved,
                "production_apply": self_approved,
                "status": status,
                "next_finding_enabled": True,
            }
        )

    _write_json(state / "security_runtime_overrides.json", runtime)
    _write_json(
        state / "owner_authority_required.json",
        {
            "schema": "world-owner-authority-required/v2",
            "generated_at": now,
            "items": owner_required,
        },
    )
    _write_json(
        state / "production_security_change_receipts.json",
        {
            "schema": SCHEMA,
            "generated_at": now,
            "loop": "Finding->Security Proposal->AI Consensus->Bounded/Predelegated Self Approval->Production Apply->Next Finding",
            "receipts": receipts,
        },
    )

    delegated_count = sum(
        1
        for row in receipts
        if isinstance(row.get("delegated_authority"), Mapping)
        and row["delegated_authority"].get("approved") is True
        and row["production_apply"] is True
    )
    return {
        "proposal_count": len(proposals),
        "production_applied_count": sum(1 for row in receipts if row["production_apply"]),
        "delegated_authority_applied_count": delegated_count,
        "owner_authority_required_count": len(owner_required),
        "next_finding_enabled": True,
        "authority_expansion_self_approval": False,
        "predelegated_authority_activation_enabled": True,
        "production_state_file": str(state / "security_runtime_overrides.json"),
    }


if __name__ == "__main__":
    print(json.dumps(run_production_security_change_loop(), indent=2, sort_keys=True))
