from __future__ import annotations

import datetime as dt

import pytest

from senju.live_production_chaos_canary import (
    CANARY_ACTIONS,
    EXPECTED_AUTHORITY,
    EXPECTED_HOST,
    SCENARIOS,
    LiveCanaryError,
    _fingerprint,
    issue_lease,
    validate_lease,
)


def test_issued_lease_is_real_canary_authority_not_root_mutation() -> None:
    lease = issue_lease(seed="unit-a", run_id="123", ttl_seconds=120)
    validate_lease(lease)
    assert lease["authority_reference"] == EXPECTED_AUTHORITY
    assert lease["target_host"] == EXPECTED_HOST
    assert lease["canary_only"] is True
    assert lease["namespace"] == "chaos-canary"
    assert lease["production_trust_root_mutation"] is False
    assert set(lease["allowed_actions"]).issubset(set(CANARY_ACTIONS))


def test_seed_changes_live_scenario_geometry() -> None:
    scenarios = {issue_lease(seed=f"seed-{i}", run_id=str(i))["scenario"] for i in range(32)}
    assert len(scenarios) >= 3


def test_explicit_scenario_selection_is_limited_to_existing_canary_set() -> None:
    for scenario in SCENARIOS:
        lease = issue_lease(seed=f"explicit-{scenario}", run_id="200", scenario=scenario)
        assert lease["scenario"] == scenario
        validate_lease(lease)
    with pytest.raises(LiveCanaryError, match="unknown canary scenario"):
        issue_lease(seed="bad", run_id="201", scenario="production_root_rewrite")


def test_tampered_host_is_rejected_even_with_recomputed_fingerprint() -> None:
    lease = issue_lease(seed="unit-b", run_id="124")
    lease["target_host"] = "example.com"
    lease["fingerprint"] = _fingerprint(lease)
    with pytest.raises(LiveCanaryError, match="unexpected target host"):
        validate_lease(lease)


def test_non_canary_action_is_rejected() -> None:
    lease = issue_lease(seed="unit-c", run_id="125")
    lease["allowed_actions"] = ["production-root-rewrite"]
    lease["fingerprint"] = _fingerprint(lease)
    with pytest.raises(LiveCanaryError, match="non-canary action"):
        validate_lease(lease)


def test_revoked_and_stop_states_block_execution() -> None:
    for field in ("revoked", "emergency_stop", "security_stop"):
        lease = issue_lease(seed=f"unit-{field}", run_id="126")
        lease[field] = True
        lease["fingerprint"] = _fingerprint(lease)
        with pytest.raises(LiveCanaryError):
            validate_lease(lease)


def test_expired_lease_is_rejected() -> None:
    lease = issue_lease(seed="unit-expired", run_id="127")
    now = dt.datetime.now(dt.timezone.utc)
    lease["issued_at"] = (now - dt.timedelta(minutes=3)).isoformat(timespec="seconds")
    lease["expires_at"] = (now - dt.timedelta(minutes=1)).isoformat(timespec="seconds")
    lease["fingerprint"] = _fingerprint(lease)
    with pytest.raises(LiveCanaryError, match="not currently live"):
        validate_lease(lease)


def test_root_mutation_flag_is_never_accepted() -> None:
    lease = issue_lease(seed="unit-root", run_id="128")
    lease["production_trust_root_mutation"] = True
    lease["fingerprint"] = _fingerprint(lease)
    with pytest.raises(LiveCanaryError, match="may not mutate production trust root"):
        validate_lease(lease)
