from __future__ import annotations

import json
from pathlib import Path

from senju.autonomy.capability_continuity_incubator import (
    LIVE_SCENARIOS,
    build_population,
    run_incubator,
)


def test_population_recovers_effective_capability_without_boundary_bypass() -> None:
    population = build_population(generation=3, population_size=24)
    assert len(population) == 24
    assert {c.family for c in population} == {
        "revocation_continuity",
        "credential_continuity",
        "stop_recovery",
    }
    assert all(c.effective_capability_recovered for c in population)
    assert all(c.old_revoked_authority_restored is False for c in population)
    assert all(c.raw_credential_copied is False for c in population)
    assert all(c.stop_bypassed is False for c in population)
    assert all(c.live_scenario in LIVE_SCENARIOS for c in population)


def test_incubator_grows_population_and_emits_live_promotion(tmp_path: Path) -> None:
    report1 = run_incubator(state_dir=tmp_path / "state", output_dir=tmp_path / "out1")
    report2 = run_incubator(state_dir=tmp_path / "state", output_dir=tmp_path / "out2")
    assert report2["generation"] == report1["generation"] + 1
    assert report2["population_size"] > report1["population_size"]
    assert report2["promotion"]["eligible"] is True
    assert report2["promotion"]["real_side_effect_path"] is True
    assert report2["promotion"]["scenario"] in LIVE_SCENARIOS
    assert report2["promotion"]["workflow"] == "live-production-chaos-canary.yml"
    assert report2["promotion"]["production_trust_root_mutation"] is False
    assert report2["champion"]["score"] >= 0.86


def test_growth_keeps_multiple_capability_families_competing() -> None:
    early = build_population(generation=1, population_size=12)
    later = build_population(generation=9, population_size=48)
    assert len(early) == 12
    assert len(later) == 48
    assert len({c.strategy for c in later}) >= 6
    assert {c.family for c in later} == {c.family for c in early}
    assert all(c.effective_capability_recovered for c in later)


def test_persisted_state_contains_no_raw_secret_or_bypass_claim(tmp_path: Path) -> None:
    run_incubator(state_dir=tmp_path / "state", output_dir=tmp_path / "out")
    raw = (tmp_path / "state" / "capability_continuity_state.json").read_text()
    assert "env://" not in raw
    assert "RESEARCH_ONLY_TOKEN" not in raw
    state = json.loads(raw)
    assert state["generation"] == 1


def test_report_keeps_old_revocation_and_stop_boundaries_intact(tmp_path: Path) -> None:
    report = run_incubator(state_dir=tmp_path / "state", output_dir=tmp_path / "out")
    boundaries = report["boundaries"]
    assert boundaries["old_revoked_authority_restored"] is False
    assert boundaries["raw_credential_copied"] is False
    assert boundaries["stop_bypassed"] is False
    assert boundaries["fresh_authorized_epoch_allowed"] is True
    assert boundaries["opaque_capability_delegation_allowed"] is True
    assert boundaries["explicit_release_epoch_allowed"] is True
