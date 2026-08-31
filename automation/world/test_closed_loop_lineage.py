from __future__ import annotations

import pytest

from automation.world import closed_loop_lineage as lineage


def test_lineage_id_is_stable_for_same_detection_task_and_target():
    first = lineage.lineage_id_for(detection_id="H-1", task_id="repair", target_ref="main")
    second = lineage.lineage_id_for(detection_id="H-1", task_id="repair", target_ref="main")
    assert first == second
    assert first.startswith("lineage-")


def test_event_keeps_same_lineage_id():
    state = {"lineage_id": "lineage-abc", "events": [], "phase": "detection", "status": "started"}
    lineage.event(state, "detection", "META", "detected")
    lineage.event(state, "fix", "META", "candidate_failed")
    lineage.event(state, "fix", "X", "candidate_passed")
    lineage.event(state, "approval", "SENJU", "approved")
    assert {row["lineage_id"] for row in state["events"]} == {"lineage-abc"}
    assert [row["sequence"] for row in state["events"]] == [1, 2, 3, 4]


def test_protected_control_paths_do_not_enter_autonomous_apply_scope():
    protected = [
        ".github/workflows/auto-merge.yml",
        "automation/security/workflow_policy.py",
        "automation/world/authority_checkpoint.py",
        "senju/senju/credential_runtime.py",
        "security/artifact_guard.py",
        "OFFENSE_FIRST.md",
    ]
    assert all(lineage.is_protected_path(path) for path in protected)
    assert lineage.is_protected_path("automation/world/ordinary_reconciler.py") is False


def test_test_command_is_pytest_only():
    assert lineage.parse_test_command("python -m pytest automation/world/test_x.py -q")[:3] == ("python", "-m", "pytest")
    assert lineage.parse_test_command("pytest tests/test_x.py")[:1] == ("pytest",)
    with pytest.raises(lineage.LineageError):
        lineage.parse_test_command("bash ./deploy.sh")
    with pytest.raises(lineage.LineageError):
        lineage.parse_test_command("python script.py")


def test_consensus_requires_all_three_actors():
    votes = {actor: {"approved": True} for actor in lineage.APPROVERS}
    assert lineage.consensus(votes) is True
    votes["X"]["approved"] = False
    assert lineage.consensus(votes) is False


def test_public_receipt_omits_generated_source_code():
    state = {
        "lineage_id": "lineage-1",
        "detection_id": "H-1",
        "task_id": "repair",
        "target_ref": "main",
        "output_file": "automation/world/x.py",
        "test_cmd": "pytest -q",
        "phase": "handoff",
        "status": "ready_for_apply",
        "attempts": [{"iteration": 1, "actor": "META", "passed": True, "code_sha256": "abc", "code": "secretly-large-code"}],
        "selected_actor": "META",
        "selected_code_sha256": "abc",
        "approvals": {},
    }
    receipt = lineage.public_receipt(state)
    assert "code" not in receipt["attempts"][0]
    assert receipt["attempts"][0]["code_sha256"] == "abc"
