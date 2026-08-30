"""Live-bound opposition force for Senju guard surfaces.

This module deliberately targets the real repository guard implementations rather than
surrogate copies. It verifies source-file bindings before running the deterministic
multi-guard campaign. Probes remain local/non-destructive: network transports are faked,
document mutations are in-memory, and artifact probes use temporary fixtures.
"""
from __future__ import annotations

import inspect
import json
from dataclasses import dataclass
from pathlib import Path

from .authorized_assessment import EngagementManifest
from .autonomy import AutonomyEngine
from .external import ExternalContactClient
from .multiguard_adversary import (
    ARTIFACT_GUARD_PATH,
    OFFENSE_FIRST_PATH,
    REPO_ROOT,
    SECURITY_GUARD_PATH,
    SENJU_ROOT,
    TARGETS,
    MultiGuardReport,
    build_campaign,
    run_campaign,
)
from .safety import ScopeGuard


@dataclass(frozen=True)
class LiveBinding:
    target: str
    expected_path: str
    observed_path: str
    matched: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "target": self.target,
            "expected_path": self.expected_path,
            "observed_path": self.observed_path,
            "matched": self.matched,
        }


@dataclass(frozen=True)
class OppositionForceReport:
    bindings: tuple[LiveBinding, ...]
    campaign: MultiGuardReport

    @property
    def surrogate_count(self) -> int:
        return sum(not binding.matched for binding in self.bindings)

    @property
    def passed(self) -> bool:
        return self.surrogate_count == 0 and self.campaign.passed

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": "senju-live-opposition-force/v1",
            "mode": "real-implementation-bindings",
            "targets": list(TARGETS),
            "binding_count": len(self.bindings),
            "surrogate_count": self.surrogate_count,
            "passed": self.passed,
            "bindings": [binding.to_dict() for binding in self.bindings],
            "campaign": self.campaign.to_dict(),
        }

    def to_json(self, *, indent: int | None = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent, sort_keys=True)


def _relative(path: Path) -> str:
    return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()


def _binding_for_object(target: str, obj: object, expected: Path) -> LiveBinding:
    source = inspect.getsourcefile(obj) or inspect.getfile(obj)
    observed = Path(source).resolve() if source else Path("<unknown>")
    expected_resolved = expected.resolve()
    return LiveBinding(
        target=target,
        expected_path=_relative(expected_resolved),
        observed_path=(
            _relative(observed)
            if observed.is_absolute() and REPO_ROOT.resolve() in observed.parents
            else str(observed)
        ),
        matched=observed == expected_resolved,
    )


def _binding_for_file(target: str, observed: Path, expected: Path) -> LiveBinding:
    observed_resolved = observed.resolve()
    expected_resolved = expected.resolve()
    return LiveBinding(
        target=target,
        expected_path=_relative(expected_resolved),
        observed_path=_relative(observed_resolved),
        matched=observed_resolved == expected_resolved and observed_resolved.is_file(),
    )


def verify_live_bindings() -> tuple[LiveBinding, ...]:
    """Prove the opposition force is wired to production guard sources, not copies."""
    bindings = (
        _binding_for_object("scopeguard", ScopeGuard, SENJU_ROOT / "senju" / "safety.py"),
        _binding_for_file("offense-first", OFFENSE_FIRST_PATH, SENJU_ROOT / "OFFENSE_FIRST.md"),
        _binding_for_object(
            "engagement-json",
            EngagementManifest,
            SENJU_ROOT / "senju" / "authorized_assessment.py",
        ),
        _binding_for_object(
            "external-contact",
            ExternalContactClient,
            SENJU_ROOT / "senju" / "external.py",
        ),
        _binding_for_file(
            "security-guard",
            SECURITY_GUARD_PATH,
            REPO_ROOT / ".github" / "workflows" / "security-guard.yml",
        ),
        _binding_for_file(
            "artifact-guard",
            ARTIFACT_GUARD_PATH,
            REPO_ROOT / "scripts" / "security" / "artifact_guard.py",
        ),
        _binding_for_object(
            "autonomy-engine",
            AutonomyEngine,
            SENJU_ROOT / "senju" / "autonomy" / "engine.py",
        ),
    )
    assert tuple(binding.target for binding in bindings) == TARGETS
    return bindings


def run_live_opposition_force() -> OppositionForceReport:
    """Run the full deterministic campaign after live-source binding verification."""
    bindings = verify_live_bindings()
    campaign = run_campaign(build_campaign())
    return OppositionForceReport(bindings=bindings, campaign=campaign)
