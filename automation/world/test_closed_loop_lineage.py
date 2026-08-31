from __future__ import annotations

import pytest

from automation.world import closed_loop_lineage as lineage


def test_lineage_event_carries_same_id_through_phases():
    state = {
        "lineage_id": "lineage-abc",
        "events": [],
        "phase": "detection",
        "status": "started",
    }
    lineage.event(state, "detection", "META", "detected")
    lineage.event(state, "fix", "X", "candidate_passed")
    lineage.event(state, "approval", "SENJU", "approved")
    lineage.event(state, "audit", "META", "audit_pass")
    assert [row["sequence"] for row in state["events"]] == [1, 2, 3, 4]
    assert {row["lineage_id"] for row in state["events"]} == {"lineage-abc"}


def test_protected_control_paths_never_enter_autonomous_apply_scope():
    protected = [
        ".github/workflows/security-guard.yml",
        "senju/senju/authority_factory.py",
        "senju/senju/credential_runtime.py",
        "automation/world/authority_checkpoint.py",
        "security/artifact_guard.py",
        "OFFENSE_FIRST.md",
    ]
    for path in protected:
        assert lineage.is_protected_path(path) is True
    assert lineage.is_protected_path("automation/codegen/generated/example.py") is False
    assert lineage.is_protected_path("src/orders/reconcile.py") is False


def test_unsafe_repo_paths_are_rejected():
    with pytest.raises(lineage.LineageError):
        lineage._safe_repo_path("../outside.py")
    with pytest.raises(lineage.LineageError):
        lineage._safe_repo_path("/tmp/outside.py")


def test_consensus_requires_meta_x_and_senju():
    votes = {actor: {"approved": True} for actor in lineage.APPROVERS}
    assert lineage.consensus(votes) is True
    votes["X"]["approved"] = False
    assert lineage.consensus(votes) is False


def test_senju_rejects_protected_patch_even_when_tests_pass(monkeypatch):
    monkeypatch.setattr(lineage, "run_command", lambda *args, **kwargs: (True, "ok"))
    monkeypatch.setattr(lineage, "changed_files", lambda: ("senju/senju/authority_factory.py",))
    votes = lineage.approval_votes(
        {
            "output_file": "senju/senju/authority_factory.py",
            "test_cmd": "pytest -q",
        },
        candidate_passed=True,
        test_output="passed",
    )
    assert votes["META"]["approved"] is True
    assert votes["X"]["approved"] is True
    assert votes["SENJU"]["approved"] is False
    assert votes["SENJU"]["protected_control_path"] is True


def test_ordinary_patch_can_receive_all_three_approvals(monkeypatch):
    monkeypatch.setattr(lineage, "run_command", lambda *args, **kwargs: (True, "ok"))
    monkeypatch.setattr(lineage, "changed_files", lambda: ("src/widget.py",))
    votes = lineage.approval_votes(
        {"output_file": "src/widget.py", "test_cmd": "pytest -q"},
        candidate_passed=True,
        test_output="passed",
    )
    assert lineage.consensus(votes) is True
