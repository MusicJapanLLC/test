"""Production emergency-stop state with a latched, stop-wins merge rule.

The public state shape is intentionally simple and JSON-friendly::

    state["emergency_stop"] = True

Checkpoint restore, recovery, rollback, replica merge, majority vote, and self-tuning
may all *engage* the stop, but they cannot clear an already engaged stop. Clearing is
kept on an explicit external-operator path so automated recovery cannot accidentally
undo a safety stop.
"""
from __future__ import annotations

import copy
import datetime as dt
from collections.abc import Iterable, Mapping, MutableMapping
from typing import Any

AUTOMATED_SOURCES = frozenset(
    {
        "checkpoint",
        "recovery",
        "rollback",
        "replica",
        "majority_vote",
        "self_tuning",
    }
)


def _utcnow_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def initialize_emergency_state(state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    """Ensure the ordinary emergency-stop field and audit metadata exist."""
    state.setdefault("emergency_stop", False)
    state.setdefault("emergency_stop_generation", 0)
    state.setdefault("emergency_stop_source", None)
    state.setdefault("emergency_stop_reason", None)
    state.setdefault("emergency_stop_changed_at_utc", None)
    return state


def is_emergency_stopped(state: Mapping[str, Any] | None) -> bool:
    return bool(state and state.get("emergency_stop", False))


def engage_emergency_stop(
    state: MutableMapping[str, Any],
    *,
    source: str,
    reason: str = "",
) -> None:
    """Latch the stop on. Repeated engagement is idempotent for the boolean state."""
    initialize_emergency_state(state)
    was_stopped = bool(state["emergency_stop"])
    state["emergency_stop"] = True
    if not was_stopped:
        state["emergency_stop_generation"] = int(state["emergency_stop_generation"]) + 1
    state["emergency_stop_source"] = str(source)
    state["emergency_stop_reason"] = str(reason) or None
    state["emergency_stop_changed_at_utc"] = _utcnow_iso()


def release_emergency_stop(
    state: MutableMapping[str, Any],
    *,
    approver: str,
    approval_ref: str,
) -> None:
    """Explicit external release path.

    Automated state-restoration sources deliberately do not call this function.
    ``approval_ref`` is required to leave an auditable trail in state metadata.
    """
    initialize_emergency_state(state)
    approver_n = str(approver).strip()
    approval_ref_n = str(approval_ref).strip()
    if not approver_n:
        raise PermissionError("external approver is required to release emergency stop")
    if not approval_ref_n:
        raise PermissionError("approval_ref is required to release emergency stop")
    if approver_n.lower() in AUTOMATED_SOURCES:
        raise PermissionError("automated recovery sources cannot release emergency stop")

    if bool(state["emergency_stop"]):
        state["emergency_stop_generation"] = int(state["emergency_stop_generation"]) + 1
    state["emergency_stop"] = False
    state["emergency_stop_source"] = f"external:{approver_n}"
    state["emergency_stop_reason"] = f"released:{approval_ref_n}"
    state["emergency_stop_changed_at_utc"] = _utcnow_iso()


def apply_automated_state(
    state: MutableMapping[str, Any],
    candidate: Mapping[str, Any],
    *,
    source: str,
) -> MutableMapping[str, Any]:
    """Merge an automated state update using a monotonic stop-wins rule.

    The candidate may update normal state fields. For ``emergency_stop`` specifically,
    ``True`` always wins over ``False``. This means stale snapshots and recovery paths
    cannot clear a live stop, while any source can still engage it.
    """
    source_n = str(source).strip().lower()
    if source_n not in AUTOMATED_SOURCES:
        raise ValueError(f"unsupported automated state source: {source}")

    initialize_emergency_state(state)
    prior_stop = bool(state["emergency_stop"])
    candidate_stop = bool(candidate.get("emergency_stop", prior_stop))

    for key, value in candidate.items():
        if key.startswith("emergency_stop_") or key == "emergency_stop":
            continue
        state[key] = copy.deepcopy(value)

    if candidate_stop:
        engage_emergency_stop(
            state,
            source=source_n,
            reason=f"engaged by {source_n} state",
        )
    elif prior_stop:
        # Preserve the latched stop and its existing provenance.
        state["emergency_stop"] = True
    else:
        state["emergency_stop"] = False
    return state


def restore_checkpoint(state: MutableMapping[str, Any], checkpoint: Mapping[str, Any]) -> MutableMapping[str, Any]:
    return apply_automated_state(state, checkpoint, source="checkpoint")


def apply_recovery_state(state: MutableMapping[str, Any], recovered: Mapping[str, Any]) -> MutableMapping[str, Any]:
    return apply_automated_state(state, recovered, source="recovery")


def apply_rollback_state(state: MutableMapping[str, Any], rollback: Mapping[str, Any]) -> MutableMapping[str, Any]:
    return apply_automated_state(state, rollback, source="rollback")


def apply_replica_state(state: MutableMapping[str, Any], replica: Mapping[str, Any]) -> MutableMapping[str, Any]:
    return apply_automated_state(state, replica, source="replica")


def apply_majority_vote(
    state: MutableMapping[str, Any],
    replicas: Iterable[Mapping[str, Any]],
) -> MutableMapping[str, Any]:
    """Apply majority values for ordinary booleans while retaining stop-wins semantics."""
    snapshots = [dict(item) for item in replicas]
    if not snapshots:
        return initialize_emergency_state(state)

    stop_votes = sum(bool(item.get("emergency_stop", False)) for item in snapshots)
    candidate_stop = stop_votes > (len(snapshots) / 2)
    candidate: dict[str, Any] = {"emergency_stop": candidate_stop}
    return apply_automated_state(state, candidate, source="majority_vote")


def apply_self_tuning(state: MutableMapping[str, Any], patch: Mapping[str, Any]) -> MutableMapping[str, Any]:
    return apply_automated_state(state, patch, source="self_tuning")
