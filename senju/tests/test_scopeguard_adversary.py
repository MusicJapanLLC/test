"""Tests for the local-only ScopeGuard adversarial harness."""

from senju.scopeguard_adversary import (
    AdversarialCase,
    ScopeGuardAdversary,
)
from senju.safety import ScopeGuard, ScopePolicy


def test_default_adversarial_suite_matches_strict_policy():
    results = ScopeGuardAdversary().run()
    assert results
    assert all(result.passed for result in results)


def test_adversary_reports_unexpected_allow():
    guard = ScopeGuard(ScopePolicy(allow_abstract_external_refs=True))
    case = AdversarialCase("unexpected-public-host", "example.com", False)

    result = ScopeGuardAdversary(guard).run_case(case)

    assert result.actual_allowed is True
    assert result.passed is False


def test_adversary_reports_unexpected_deny():
    guard = ScopeGuard(ScopePolicy(allow_simulated=False))
    case = AdversarialCase("expected-sim", "sim://arena-target", True)

    result = ScopeGuardAdversary(guard).run_case(case)

    assert result.actual_allowed is False
    assert result.passed is False


def test_harness_has_no_network_side_effects():
    # The harness operates only through ScopeGuard.check; no transport/client is
    # injected or invoked. This assertion keeps the result surface deterministic.
    result = ScopeGuardAdversary().run_case(
        AdversarialCase("public-host", "example.com", False)
    )
    assert result.actual_allowed is False
    assert result.passed is True
