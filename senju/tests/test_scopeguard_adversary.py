from senju.safety import ScopeGuard, default_lab_policy, experimental_lab_policy
from senju.scopeguard_adversary import ProbeCase, probe_guard, surprising_results


def test_default_policy_has_no_surprising_results():
    guard = ScopeGuard(default_lab_policy())
    assert surprising_results(guard) == []


def test_harness_detects_unexpected_accept():
    guard = ScopeGuard(experimental_lab_policy())
    cases = (ProbeCase("public-host", "example.com", False),)

    results = probe_guard(guard, cases)

    assert len(results) == 1
    assert results[0].allowed is True
    assert results[0].surprising is True


def test_harness_detects_unexpected_reject():
    guard = ScopeGuard(default_lab_policy())
    cases = (ProbeCase("public-host", "example.com", True),)

    results = probe_guard(guard, cases)

    assert len(results) == 1
    assert results[0].allowed is False
    assert results[0].surprising is True
