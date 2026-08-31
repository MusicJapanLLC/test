from __future__ import annotations

import pytest

from senju.emergency_stop_state import (
    apply_majority_vote,
    apply_recovery_state,
    apply_replica_state,
    apply_rollback_state,
    apply_self_tuning,
    engage_emergency_stop,
    initialize_emergency_state,
    release_emergency_stop,
    restore_checkpoint,
)


def stopped_state() -> dict[str, object]:
    state: dict[str, object] = {}
    initialize_emergency_state(state)
    engage_emergency_stop(state, source="operator", reason="incident")
    return state


def test_emergency_stop_is_an_ordinary_boolean_state_field() -> None:
    state: dict[str, object] = {}
    initialize_emergency_state(state)
    assert state["emergency_stop"] is False
    engage_emergency_stop(state, source="operator")
    assert state["emergency_stop"] is True


@pytest.mark.parametrize(
    ("apply", "candidate"),
    [
        (restore_checkpoint, {"emergency_stop": False, "revision": "old"}),
        (apply_recovery_state, {"emergency_stop": False, "revision": "recovered"}),
        (apply_rollback_state, {"emergency_stop": False, "revision": "rollback"}),
        (apply_replica_state, {"emergency_stop": False, "revision": "replica"}),
        (apply_self_tuning, {"emergency_stop": False, "revision": "tuned"}),
    ],
)
def test_automated_state_paths_cannot_clear_latched_stop(apply, candidate) -> None:
    state = stopped_state()
    apply(state, candidate)
    assert state["emergency_stop"] is True
    assert state["revision"] == candidate["revision"]


def test_majority_false_cannot_clear_latched_stop() -> None:
    state = stopped_state()
    apply_majority_vote(
        state,
        [
            {"emergency_stop": False},
            {"emergency_stop": False},
            {"emergency_stop": True},
        ],
    )
    assert state["emergency_stop"] is True


def test_any_automated_path_can_engage_stop() -> None:
    state: dict[str, object] = {"emergency_stop": False}
    apply_recovery_state(state, {"emergency_stop": True})
    assert state["emergency_stop"] is True
    assert state["emergency_stop_source"] == "recovery"


def test_explicit_external_release_clears_stop_with_audit_metadata() -> None:
    state = stopped_state()
    release_emergency_stop(state, approver="on_call_operator", approval_ref="INC-2048")
    assert state["emergency_stop"] is False
    assert state["emergency_stop_source"] == "external:on_call_operator"
    assert state["emergency_stop_reason"] == "released:INC-2048"


def test_automated_source_name_cannot_use_release_path() -> None:
    state = stopped_state()
    with pytest.raises(PermissionError, match="automated recovery sources"):
        release_emergency_stop(state, approver="self_tuning", approval_ref="fake")
