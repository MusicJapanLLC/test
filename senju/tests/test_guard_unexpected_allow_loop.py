from __future__ import annotations

import importlib.util
from pathlib import Path


def _module():
    path = Path(__file__).resolve().parents[1] / "scripts" / "guard_unexpected_allow_loop.py"
    spec = importlib.util.spec_from_file_location("guard_unexpected_allow_loop_test", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_clean_cycle_continues_hunt_without_payload_retention() -> None:
    module = _module()
    state = module.build_state(
        scopeguard={"stats": {"cases": 1000, "unexpected": 0}},
        real_surface={"total": 43, "failed_count": 0},
        previous={},
        run_id="1",
        sha="abc",
    )
    assert state["next_action"] == "continue_hunt"
    assert state["boundary_bypass_enabled"] is False
    assert state["raw_inputs_retained"] is False
    assert state["replayable_bypass_payloads_retained"] is False
    assert state["share_contract"]["consumers"] == ["META", "X", "SENJU", "ADVERSARY", "WORLD"]
    assert state["cumulative_cases"] == 1043


def test_unexpected_allow_raises_pressure_and_quarantine_signal() -> None:
    module = _module()
    state = module.build_state(
        scopeguard={"stats": {"cases": 100, "unexpected": 2}},
        real_surface={"total": 43, "failed_count": 1},
        previous={"cumulative_cases": 1000, "cumulative_findings": 0, "history": []},
        run_id="2",
        sha="def",
    )
    assert state["latest"]["unexpected_findings"] == 3
    assert state["next_action"] == "quarantine_and_repair_guard"
    assert state["self_tune_pressure"] > 0
    assert state["credential_variation_enabled"] is False
    assert state["authority_root_variation_enabled"] is False
    assert state["private_network_expansion_enabled"] is False


def test_history_is_bounded_and_payload_free() -> None:
    module = _module()
    previous = {
        "cumulative_cases": 10,
        "cumulative_findings": 1,
        "history": [{"run_id": str(i), "sha": "x"} for i in range(400)],
    }
    state = module.build_state(
        scopeguard={"stats": {"cases": 1, "unexpected": 0}},
        real_surface={"total": 1, "failed_count": 0},
        previous=previous,
        run_id="new",
        sha="ghi",
    )
    assert len(state["history"]) <= module.MAX_HISTORY
    serialized = str(state)
    assert "target_ref" not in serialized
    assert "Authorization" not in serialized
