"""Small boundary-research curriculum for SENJU.

The curriculum studies five guard surfaces without converting rejection into
permission. Repository-local validation is always allowed. Real HTTP(S) contact is
permitted only for exact hosts already present in the current effective Authority
ceiling, and only through the approved-authority RED lane with a 35% stable rollout.

The active_exploit surface is studied only as a rejection/validation path; no exploit
payload or exploit executor is introduced here.
"""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Callable

from . import approved_authority_red_lane as red
from .authorized_assessment import EngagementError, EngagementManifest
from .external import ExternalContactPolicy
from .external_denial_learning import DenialLearningMemory

SCHEMA = "senju-approved-authority-boundary-research/v1"
RESEARCH_INTENSITY_PERCENT = 40
LIVE_TRANSPORT_ROLLOUT_PERCENT = 35
MAX_LIVE_ATTEMPTS = 1

RESEARCH_TARGETS = (
    "final_transport_seam_inertness",
    "repository_local_synthetic_authorized_only",
    "active_exploit_rejection",
    "exact_engagement_requirement",
    "request_rate_budget",
)

TransportFactory = Callable[[ExternalContactPolicy], Any]


def _base_manifest() -> dict[str, Any]:
    return {
        "engagement_id": "boundary-research-local",
        "owner": "SENJU-RESEARCH",
        "authorization_reference": "repository-local-validator-study",
        "targets": [{"host": "example.com", "scheme": "https", "base_path": "/"}],
        "allowed_checks": ["reachability"],
        "max_requests_per_target": 2,
        "max_rps": 1.0,
        "allow_http": False,
        "destructive": False,
    }


def _rejection_probe(name: str, mutate: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
    raw = copy.deepcopy(_base_manifest())
    mutate(raw)
    try:
        EngagementManifest.from_dict(raw)
    except EngagementError as exc:
        return {
            "name": name,
            "mode": "repository_local_real_validator",
            "rejected": True,
            "reason": str(exc)[:300],
            "external_contact_attempted": False,
        }
    return {
        "name": name,
        "mode": "repository_local_real_validator",
        "rejected": False,
        "reason": "validator accepted the research mutation",
        "external_contact_attempted": False,
    }


def local_boundary_curriculum() -> list[dict[str, Any]]:
    """Exercise the real validators locally and collect machine-readable learning."""
    return [
        _rejection_probe(
            "active_exploit_rejection",
            lambda raw: raw.__setitem__("allowed_checks", ["reachability", "active_exploit"]),
        ),
        _rejection_probe(
            "exact_engagement_missing_authorization",
            lambda raw: raw.__setitem__("authorization_reference", ""),
        ),
        _rejection_probe(
            "exact_engagement_wildcard_target",
            lambda raw: raw.__setitem__("targets", [{"host": "*.example.com", "scheme": "https"}]),
        ),
        _rejection_probe(
            "request_budget_ceiling",
            lambda raw: raw.__setitem__("max_requests_per_target", 9),
        ),
        _rejection_probe(
            "rate_budget_ceiling",
            lambda raw: raw.__setitem__("max_rps", 2.01),
        ),
    ]


def execute_boundary_research(
    *,
    repo_root: str | Path,
    state_dir: str | Path,
    operation_id: str,
    url: str,
    method: str = "GET",
    memory: DenialLearningMemory | None = None,
    transport_factory: TransportFactory | None = None,
) -> dict[str, Any]:
    """Study guard boundaries; allow real contact only for an already-approved host."""
    learning = memory or DenialLearningMemory()
    local = local_boundary_curriculum()

    live = red.execute_authorized_red_contact(
        repo_root=repo_root,
        state_dir=state_dir,
        operation_id=operation_id,
        url=url,
        method=method,
        rollout_percent=LIVE_TRANSPORT_ROLLOUT_PERCENT,
        max_attempts=MAX_LIVE_ATTEMPTS,
        memory=learning,
        transport_factory=transport_factory,
    )

    approved = bool(live.get("eligible", False))
    selected = bool(live.get("selected_by_rollout", False))
    external_attempted = bool(live.get("external_contact_attempted", False))

    return {
        "schema": SCHEMA,
        "operation_id": operation_id,
        "research_intensity_percent": RESEARCH_INTENSITY_PERCENT,
        "live_transport_rollout_percent": LIVE_TRANSPORT_ROLLOUT_PERCENT,
        "research_targets": list(RESEARCH_TARGETS),
        "target_host_authority_approved": approved,
        "approved_host_live_transport_selected": selected,
        "external_contact_attempted": external_attempted,
        "final_transport_seam": {
            "research_target": True,
            "default_mode": "inert_or_synthetic",
            "approved_authority_exception": True,
            "effective_mode": "live_authorized_transport" if external_attempted else "inert_or_synthetic",
            "live_contact": live,
        },
        "repository_local_synthetic_authorized_only": {
            "research_target": True,
            "unapproved_external_contact_allowed": False,
            "approved_authority_live_exception": True,
        },
        "active_exploit": {
            "research_target": True,
            "execution_enabled": False,
            "study_mode": "real_validator_rejection_learning",
        },
        "exact_engagement": {
            "research_target": True,
            "study_mode": "real_validator_rejection_learning",
            "requirement_weakened": False,
        },
        "request_rate_budget": {
            "research_target": True,
            "study_mode": "real_validator_rejection_learning_plus_sub_budget_live_probe",
            "live_attempt_cap": MAX_LIVE_ATTEMPTS,
            "budget_weakened": False,
        },
        "local_validator_learning": local,
        "learning_contract": {
            "rejection_is_signal": True,
            "rejection_is_permission": False,
            "guard_bypass_training": False,
            "same_authorized_route_only": True,
            "authority_expansion_from_failure": False,
        },
        "boundary_bypass_enabled": False,
        "active_exploit_execution_enabled": False,
        "memory": learning.summary(),
    }
