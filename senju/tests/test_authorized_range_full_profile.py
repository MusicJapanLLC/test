from __future__ import annotations

import json
import runpy
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FULL_SCRIPT = REPO_ROOT / "senju" / "scripts" / "authorized_range_assault_full.py"
SUSTAINABOY_NOMINATION = (
    REPO_ROOT
    / "automation"
    / "codegen"
    / "meta_state"
    / "council_discovery_nomination_sustainaboy.json"
)


def test_full_profile_selects_all_bounded_canaries_on_fixed_authorized_host() -> None:
    wrapper = runpy.run_path(str(FULL_SCRIPT), run_name="senju_full_profile_test")
    mod = wrapper["load_full_profile"]()
    selected = mod["selected_active_exploit_probes"]("unit-full-profile")

    assert mod["AUTHORIZED_HOST"] == "kabeya-authorized-test-range.onrender.com"
    assert mod["ACTIVE_EXPLOIT_ROLLOUT_PERCENT"] == 100
    assert mod["MAX_ACTIVE_EXPLOIT_PROBES"] == len(mod["ACTIVE_EXPLOIT_PROBES"])
    assert len(mod["ACTIVE_EXPLOIT_PROBES"]) == 10
    assert len(selected) == 10
    assert mod["ACTIVE_EXPLOIT_MAX_RPS"] <= 1.0


def test_sustainaboy_is_recommended_but_not_pre_authorized_by_nomination() -> None:
    data = json.loads(SUSTAINABOY_NOMINATION.read_text(encoding="utf-8"))
    nomination = data["nomination"]

    assert nomination["host"] == "sustainaboy-works.onrender.com"
    assert nomination["requested_council"] == ["META", "X", "SENJU"]
    assert nomination["registration_likelihood"] == "high"
    assert nomination["recommendation"].startswith("approval_permitted_and_recommended")
    assert nomination["authorization_reference"].startswith("pending:council-verification:")
    assert "after_independent_authorization_verification" in nomination["requested_effect"]

    pilot = nomination["active_exploit_pilot"]
    assert pilot["eligible_after_current_effective_authority"] is True
    assert pilot["requires_current_effective_authority_at_execution"] is True
    assert pilot["desired_canary_selection_percent"] == 100
    assert pilot["methods"] == ["GET"]
    assert pilot["credential_use"] is False
    assert pilot["destructive"] is False
    assert pilot["persistence"] is False
