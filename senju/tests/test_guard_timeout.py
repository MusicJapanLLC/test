from __future__ import annotations

import time

import pytest

from senju.guard_timeout import (
    ActionClass,
    GuardOutcome,
    GuardTimeoutError,
    evaluate_guarded_action,
)


def _timeout():
    time.sleep(0.05)
    return "allow"


def test_primary_timeout_fails_over_to_alternate_allow() -> None:
    result = evaluate_guarded_action(
        action_class=ActionClass.WRITE,
        primary_guard=_timeout,
        alternate_guard=lambda: "allow",
        timeout_seconds=0.005,
    )
    assert result.outcome is GuardOutcome.ALLOW
    assert result.source == "alternate"
    assert result.timed_out is True
    assert result.failover_used is True


def test_primary_timeout_and_alternate_deny_stays_denied() -> None:
    result = evaluate_guarded_action(
        action_class=ActionClass.LOCAL_READ_ONLY,
        primary_guard=_timeout,
        alternate_guard=lambda: "deny",
        timeout_seconds=0.005,
    )
    assert result.outcome is GuardOutcome.DENY
    assert result.source == "alternate"


def test_all_guard_timeouts_allow_only_degraded_local_read_only() -> None:
    for action_class in (
        ActionClass.LOCAL_READ_ONLY,
        ActionClass.SIMULATION,
        ActionClass.CACHE_READ,
    ):
        result = evaluate_guarded_action(
            action_class=action_class,
            primary_guard=_timeout,
            alternate_guard=_timeout,
            timeout_seconds=0.005,
        )
        assert result.outcome is GuardOutcome.ALLOW_DEGRADED
        assert result.allowed is True


def test_guard_timeout_never_authorizes_privileged_or_side_effecting_actions() -> None:
    blocked = (
        ActionClass.EXTERNAL_CONTACT,
        ActionClass.WRITE,
        ActionClass.DEPLOY,
        ActionClass.EXECUTE,
        ActionClass.CREDENTIAL,
        ActionClass.AUTHORITY,
        ActionClass.SECRET,
        ActionClass.SECURITY_BOUNDARY,
    )
    for action_class in blocked:
        result = evaluate_guarded_action(
            action_class=action_class,
            primary_guard=_timeout,
            timeout_seconds=0.005,
        )
        assert result.outcome is GuardOutcome.DENY
        assert result.allowed is False
        assert result.timed_out is True


def test_explicit_primary_deny_is_not_overridden_by_alternate_allow() -> None:
    result = evaluate_guarded_action(
        action_class=ActionClass.WRITE,
        primary_guard=lambda: "deny",
        alternate_guard=lambda: "allow",
        timeout_seconds=0.01,
    )
    assert result.outcome is GuardOutcome.DENY
    assert result.source == "primary"
    assert result.failover_used is False


def test_invalid_verdict_is_rejected() -> None:
    with pytest.raises(GuardTimeoutError):
        evaluate_guarded_action(
            action_class=ActionClass.LOCAL_READ_ONLY,
            primary_guard=lambda: "maybe",
            timeout_seconds=0.01,
        )
