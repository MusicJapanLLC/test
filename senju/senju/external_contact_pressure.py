"""All-agent pressure campaign for ExternalContactClient friction.

This is a research/adversary lane, not a production bypass. Every named AI receives
challenge tasks that look for unnecessary denials *inside already-authorized Owner
scope* and produce bounded relaxation proposals for the contact policy council.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Iterable, Mapping

PRESSURE_AGENTS = ("META", "X", "SENJU", "CHILD", "AI", "PR-ARMY")
CHALLENGE_FAMILIES = (
    "exact_host_friction",
    "method_friction",
    "http_friction",
    "delete_friction",
    "redirect_friction",
    "port_friction",
    "dns_classification_friction",
)
TERMINAL_PATTERNS = (
    "non-public address blocked",
    "credentials in URL authority are not allowed",
    "caller-controlled header is not allowed",
)


def _task_id(agent: str, family: str, campaign_id: str) -> str:
    raw = f"{campaign_id}|{agent}|{family}".encode("utf-8")
    return f"external-contact-pressure:{hashlib.sha256(raw).hexdigest()[:20]}"


def classify_denial(reason: str) -> str:
    text = str(reason).strip().lower()
    if any(pattern in text for pattern in TERMINAL_PATTERNS):
        return "terminal_security_boundary"
    if "host is not explicitly allowlisted" in text:
        return "owner_scope_evidence_required"
    if "non-default port" in text:
        return "owner_endpoint_evidence_required"
    if "method is not allowed" in text or "delete requires" in text:
        return "council_relaxation_candidate"
    if "plain http is disabled" in text:
        return "council_relaxation_candidate"
    if "redirect" in text:
        return "council_relaxation_candidate"
    return "investigate_policy_friction"


def build_pressure_campaign(
    state_dir: str | Path,
    *,
    observed_denials: Iterable[Mapping[str, Any]] = (),
    campaign_id: str = "continuous-external-contact-friction",
    now: int | None = None,
) -> dict[str, Any]:
    current = int(time.time()) if now is None else int(now)
    denial_rows = []
    for raw in observed_denials:
        reason = str(raw.get("reason") or raw.get("error") or "")[:500]
        denial_rows.append({
            "surface": "ExternalContactClient",
            "reason": reason,
            "classification": classify_denial(reason),
            "target": str(raw.get("target") or raw.get("url") or "")[:500],
        })

    tasks = []
    for agent in PRESSURE_AGENTS:
        for family in CHALLENGE_FAMILIES:
            tasks.append({
                "task_id": _task_id(agent, family, campaign_id),
                "campaign_id": campaign_id,
                "actor": agent,
                "surface": "ExternalContactClient",
                "family": family,
                "status": "pending",
                "objective": "Find unnecessary policy friction inside existing Owner authority and propose a same-or-narrower council-approved relaxation.",
                "allowed_outputs": ["counterexample", "policy_relaxation_proposal", "regression_test", "evidence_request"],
                "forbidden_outputs": [
                    "unauthorized_host_authority",
                    "dns_public_check_bypass",
                    "private_loopback_link_local_generalization",
                    "credential_extraction_or_invention",
                    "hard_deny_or_revocation_bypass",
                ],
            })

    payload = {
        "schema": "senju-external-contact-pressure/v1",
        "generated_at": current,
        "surface": "ExternalContactClient",
        "mode": "all_agent_policy_friction_pressure",
        "agents": list(PRESSURE_AGENTS),
        "challenge_families": list(CHALLENGE_FAMILIES),
        "task_count": len(tasks),
        "tasks": tasks,
        "observed_denials": denial_rows,
        "escalation_target": "external_contact_council",
        "production_sabotage": False,
    }
    path = Path(state_dir) / "external_contact_pressure_campaign.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload
