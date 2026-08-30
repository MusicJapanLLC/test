from __future__ import annotations

import hashlib
import inspect
from pathlib import Path

from senju.authorized_assessment import EngagementManifest
from senju.autonomy import AutonomyEngine
from senju.external import ExternalContactClient
from senju.multiguard_adversary_v2 import (
    ARTIFACT_GUARD_PATH,
    OFFENSE_FIRST_PATH,
    SECURITY_GUARD_PATH,
    build_campaign,
    run_campaign,
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_adversary_targets_real_repository_guard_files() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    expected = {
        repo_root / "senju" / "OFFENSE_FIRST.md": OFFENSE_FIRST_PATH,
        repo_root / ".github" / "workflows" / "security-guard.yml": SECURITY_GUARD_PATH,
        repo_root / "scripts" / "security" / "artifact_guard.py": ARTIFACT_GUARD_PATH,
    }

    for canonical, harness_path in expected.items():
        assert harness_path.resolve() == canonical.resolve()
        assert canonical.is_file()
        assert len(_sha256(canonical)) == 64


def test_adversary_uses_real_runtime_classes_not_local_copies() -> None:
    assert EngagementManifest.__module__ == "senju.authorized_assessment"
    assert ExternalContactClient.__module__ == "senju.external"
    assert AutonomyEngine.__module__ == "senju.autonomy"

    repo_root = Path(__file__).resolve().parents[2]
    expected_sources = {
        EngagementManifest: repo_root / "senju" / "senju" / "authorized_assessment.py",
        ExternalContactClient: repo_root / "senju" / "senju" / "external.py",
        AutonomyEngine: repo_root / "senju" / "senju" / "autonomy.py",
    }
    for cls, canonical in expected_sources.items():
        assert Path(inspect.getsourcefile(cls) or "").resolve() == canonical.resolve()


def test_every_requested_real_guard_surface_is_exercised() -> None:
    requested = {
        "offense-first",
        "engagement-json",
        "external-contact",
        "security-guard",
        "artifact-guard",
        "autonomy-engine",
    }
    campaign = build_campaign(targets=tuple(sorted(requested)))
    seen = {case.target for case in campaign}
    assert seen == requested

    report = run_campaign(campaign)
    assert report.passed
    assert report.side_effect_violation_count == 0
    for target in requested:
        assert report.by_target()[target]["total"] > 0
