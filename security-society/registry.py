"""Defensive Security Society registry.

Pure policy / identity code. It performs no network calls, secret access,
production writes, scanning, exploitation or credential activity.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass


GUILDS: dict[str, tuple[str, ...]] = {
    "APPSEC": ("secure_code_review", "sast_triage", "dependency_review", "remediation_design"),
    "IAM": ("iam_review", "least_privilege_design", "config_review", "access_evidence"),
    "SUPPLY": ("sbom_analysis", "dependency_risk", "provenance_review", "update_planning"),
    "DETECT": ("detection_design", "log_analysis", "alert_tuning", "coverage_mapping"),
    "IR": ("incident_triage", "timeline_analysis", "evidence_preservation", "recovery_planning"),
    "INTEL": ("public_threat_research", "cve_research", "exposure_modeling", "defense_prioritization"),
    "ARCH": ("threat_modeling", "trust_boundary_review", "secure_design", "control_mapping"),
    "DATA": ("data_flow_review", "retention_review", "privacy_control_design", "secret_hygiene_review"),
    "SRE": ("reliability_review", "backup_validation", "recovery_testing", "safe_chaos_design"),
    "SIM": ("attack_path_modeling", "scenario_design", "control_validation", "detection_validation"),
}

NETWORK_RANK = {"simulated-only": 0, "private-lab": 1}
REPORTING_ROUTE = ("WORKER", "MANAGER", "TOMOKI", "BOSS", "CEO")


class DelegationViolation(ValueError):
    """Raised when a requested child would exceed the bounded grant."""


@dataclass(frozen=True)
class SocietyAgent:
    agent_id: str
    guild: str
    slot: int
    capabilities: frozenset[str]
    network_scope: str = "simulated-only"


@dataclass(frozen=True)
class ParentGrant:
    parent_id: str
    capabilities: frozenset[str]
    network_scope: str = "simulated-only"
    max_children: int = 8
    max_ttl_minutes: int = 480
    covenant_profile: str | None = None


@dataclass(frozen=True)
class SubagentRequest:
    child_id: str
    purpose: str
    capabilities: frozenset[str]
    ttl_minutes: int = 120
    network_scope: str = "simulated-only"
    kill_switch_owner: str = "parent"
    needs_secrets: bool = False
    needs_production_write: bool = False


def build_roster() -> tuple[SocietyAgent, ...]:
    """Return exactly 100 stable identities: 10 guilds × 10 slots."""
    agents: list[SocietyAgent] = []
    for guild, capabilities in GUILDS.items():
        for slot in range(1, 11):
            agents.append(
                SocietyAgent(
                    agent_id=f"SEC-{guild}-{slot:02d}",
                    guild=guild,
                    slot=slot,
                    capabilities=frozenset(capabilities),
                )
            )
    return tuple(agents)


def validate_roster(roster: tuple[SocietyAgent, ...] | None = None) -> None:
    roster = roster or build_roster()
    if len(roster) != 100:
        raise ValueError(f"expected 100 agents, got {len(roster)}")
    ids = [agent.agent_id for agent in roster]
    if len(set(ids)) != 100:
        raise ValueError("agent IDs must be unique")
    for guild in GUILDS:
        count = sum(1 for agent in roster if agent.guild == guild)
        if count != 10:
            raise ValueError(f"guild {guild} expected 10 slots, got {count}")


def validate_delegation(
    parent: ParentGrant,
    request: SubagentRequest,
    *,
    issue_42_remediated: bool = False,
) -> None:
    """Fail closed: self-service children may only narrow a parent's grant."""
    if not request.child_id.strip():
        raise DelegationViolation("child_id is required")
    if not request.purpose.strip():
        raise DelegationViolation("purpose is required")
    if not request.kill_switch_owner.strip():
        raise DelegationViolation("kill_switch_owner is required")

    if not request.capabilities.issubset(parent.capabilities):
        extra = sorted(request.capabilities - parent.capabilities)
        raise DelegationViolation(f"capability escalation denied: {extra}")

    if parent.network_scope not in NETWORK_RANK:
        raise DelegationViolation("parent has invalid self-service network scope")
    if request.network_scope not in NETWORK_RANK:
        raise DelegationViolation("external/public network scope is forbidden")
    if NETWORK_RANK[request.network_scope] > NETWORK_RANK[parent.network_scope]:
        raise DelegationViolation("network scope escalation denied")

    if request.network_scope == "private-lab" and not issue_42_remediated:
        raise DelegationViolation(
            "private-lab delegation blocked until Security Issue #42 fail-close remediation is accepted"
        )

    if request.needs_secrets:
        raise DelegationViolation("self-service secret access is forbidden")
    if request.needs_production_write:
        raise DelegationViolation("self-service production writes are forbidden")

    if request.ttl_minutes < 1 or request.ttl_minutes > parent.max_ttl_minutes:
        raise DelegationViolation(
            f"ttl must be 1..{parent.max_ttl_minutes} minutes"
        )


def registration_event(
    parent: ParentGrant,
    request: SubagentRequest,
    *,
    issue_42_remediated: bool = False,
) -> dict[str, object]:
    """Build append-safe event metadata for the existing durable event bus."""
    validate_delegation(
        parent,
        request,
        issue_42_remediated=issue_42_remediated,
    )
    basis = "|".join(
        [
            "security-society-v1",
            parent.parent_id,
            request.child_id,
            request.purpose,
            ",".join(sorted(request.capabilities)),
            request.network_scope,
            str(request.ttl_minutes),
        ]
    )
    dedupe = hashlib.sha256(basis.encode("utf-8")).hexdigest()
    return {
        "event_type": "SECURITY_SUBAGENT_REGISTERED",
        "society_id": "defensive-security-society-v1",
        "parent_id": parent.parent_id,
        "child_id": request.child_id,
        "purpose": request.purpose,
        "capabilities": sorted(request.capabilities),
        "network_scope": request.network_scope,
        "ttl_minutes": request.ttl_minutes,
        "kill_switch_owner": request.kill_switch_owner,
        "covenant_profile": parent.covenant_profile,
        "reporting_route": list(REPORTING_ROUTE),
        "dedupe_key": f"security-society:{dedupe}",
        "write_policy": "append-only",
        "security_issue_42_gate": (
            "accepted" if issue_42_remediated else "private-lab-blocked"
        ),
    }


# Fail fast at import time if a future edit breaks the promised topology.
validate_roster()
