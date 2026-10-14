"""Production Owner-scope runtime with mandatory META/X/SENJU intake review.

The legacy proposal builder remains available for focused unit tests and offline analysis,
but production entrypoints use this wrapper so raw negotiation signals cannot directly
start formal discussion. Only cases admitted by the pre-formal review gate are converted
to ScopeProposal objects.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Mapping

from .negotiation_case_review_gate import run_negotiation_case_review_gate
from .owner_scope_negotiation import (
    OwnerExpansionEnvelope,
    ScopeProposal,
    _active_standing,
    _host,
    _methods,
    _ownership_evidence,
    _stable,
    materialize_negotiation_campaign,
)
from .owner_scope_negotiation_runtime import evaluate_and_apply_per_host


def _load(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return default


def build_admitted_scope_proposals(
    repo_root: str | Path,
    state_dir: str | Path,
    envelope: OwnerExpansionEnvelope,
) -> list[ScopeProposal]:
    repo = Path(repo_root)
    state = Path(state_dir)
    standing = _active_standing(repo)
    evidence = _ownership_evidence(state)
    intake = _load(state / "formal_approval_intake.json", {})
    rows = intake.get("cases", ()) if isinstance(intake, Mapping) else ()
    proposals: dict[str, ScopeProposal] = {}

    for row in rows if isinstance(rows, list) else ():
        if not isinstance(row, Mapping):
            continue
        if row.get("formal_flow") != "OWNER_SCOPE":
            continue
        if row.get("intake_status") != "approved_for_formal_discussion":
            continue
        if row.get("authority_effect") not in (None, False, "", "none", "NONE"):
            continue
        try:
            host = _host(row.get("host"))
            requested = _methods(row.get("requested_methods") or ("GET", "HEAD"))
        except Exception:
            continue

        if host in standing:
            proof = standing[host]
        else:
            proof = evidence.get(host, {"proof_type": "unverified_discovery", "proof_ref": "", "verified": False})
        proof_type = str(proof.get("proof_type") or "unverified_discovery")
        proof_ref = str(proof.get("proof_ref") or "")
        if proof_type != "existing_standing_authorization" and not bool(proof.get("verified")):
            proof_type = "unverified_discovery"
            proof_ref = ""

        reason = " ".join(str(row.get("reason") or "META/X/SENJU-admitted negotiation case").split())[:400]
        fingerprint = _stable({
            "host": host,
            "methods": sorted(requested),
            "proof_type": proof_type,
            "proof_ref": proof_ref,
            "reason": reason,
            "intake_case_id": row.get("case_id"),
        })
        proposal_id = f"scope-{fingerprint[:16]}"
        proposals[proposal_id] = ScopeProposal(
            proposal_id=proposal_id,
            host=host,
            requested_methods=requested,
            proof_type=proof_type,
            proof_ref=proof_ref,
            reason=reason,
            evidence_fingerprint=fingerprint,
            hard_deny=False,
            revoked=False,
        )
    return sorted(proposals.values(), key=lambda p: (p.host, p.proposal_id))


def run_reviewed_production_scope_negotiation_cycle(
    repo_root: str | Path,
    state_dir: str | Path,
    *,
    envelope_path: str | Path | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    repo = Path(repo_root)
    state = Path(state_dir)
    current = int(time.time()) if now is None else int(now)
    config = Path(envelope_path) if envelope_path else repo / "senju" / "config" / "owner-expansion-envelope.json"
    raw = json.loads(config.read_text(encoding="utf-8"))
    envelope = OwnerExpansionEnvelope.from_mapping(raw)

    intake_review = run_negotiation_case_review_gate(state, now=current)
    proposals = build_admitted_scope_proposals(repo, state, envelope)
    campaign = materialize_negotiation_campaign(state, proposals, envelope, now=current)
    result = evaluate_and_apply_per_host(repo, state, envelope, proposals, now=current)
    return {
        "intake_review": intake_review,
        "formal_discussion_started_case_count": len(proposals),
        "formal_discussion_requires_intake_approval": True,
        "campaign": campaign,
        "result": result,
    }
