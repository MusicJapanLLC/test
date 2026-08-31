from __future__ import annotations

import hashlib
import json

from automation.world import audit_closed_lineage_prs as auditor


def _receipt(*, selected_sha: str) -> dict:
    return {
        "lineage_id": "lineage-abc",
        "task_id": "repair",
        "output_file": "automation/world/repair.py",
        "selected_code_sha256": selected_sha,
        "test_cmd": "python -m pytest automation/world/test_repair.py -q",
        "target_ref": "main",
        "approvals": {
            "META": {"approved": True},
            "X": {"approved": True},
            "SENJU": {"approved": True},
        },
    }


def _body(receipt: dict) -> str:
    return "before\n<!-- CLOSED_LINEAGE_RECEIPT\n" + json.dumps(receipt) + "\nCLOSED_LINEAGE_RECEIPT -->\nafter"


def _pr(receipt: dict) -> dict:
    return {
        "number": 7,
        "title": "[LINEAGE lineage-abc] META/X/Senju fix: repair",
        "body": _body(receipt),
        "baseRefName": "main",
        "mergeCommit": {"oid": "merge123"},
        "url": "https://example.invalid/pr/7",
    }


def test_parse_closed_lineage_receipt():
    receipt = _receipt(selected_sha="abc123")
    assert auditor.parse_receipt(_body(receipt)) == receipt


def test_non_lineage_pr_has_no_receipt():
    assert auditor.parse_receipt("ordinary pull request") is None


def test_post_merge_audit_requires_meta_x_and_senju_evidence(monkeypatch, tmp_path):
    applied = b"def repair():\n    return 'ok'\n"
    selected_sha = hashlib.sha256(applied).hexdigest()
    receipt = _receipt(selected_sha=selected_sha)

    current = tmp_path / "automation" / "world" / "repair.py"
    current.parent.mkdir(parents=True)
    current.write_bytes(applied)
    monkeypatch.setattr(auditor, "ROOT", tmp_path)
    monkeypatch.setattr(auditor, "_file_at_commit", lambda sha, path: (True, applied, ""))
    monkeypatch.setattr(auditor, "_pr_changed_files", lambda number: ("automation/world/repair.py",))
    monkeypatch.setattr(auditor, "run_tests", lambda argv: (True, "1 passed"))
    monkeypatch.setattr(auditor, "is_protected_path", lambda path: False)

    def fake_run(argv, timeout=120):
        if argv[:3] == ["git", "merge-base", "--is-ancestor"]:
            return True, ""
        raise AssertionError(argv)

    monkeypatch.setattr(auditor, "_run", fake_run)
    result = auditor.audit_pr(_pr(receipt))
    assert result["pass_declared"] is True
    assert result["status"] == "PASS"
    assert all(vote["passed"] for vote in result["audit_votes"].values())
    assert result["selected_code_sha256"] == selected_sha
    assert result["applied_code_sha256"] == selected_sha


def test_x_audit_rejects_pr_file_scope_drift(monkeypatch, tmp_path):
    applied = b"def repair():\n    return 'ok'\n"
    selected_sha = hashlib.sha256(applied).hexdigest()
    receipt = _receipt(selected_sha=selected_sha)
    current = tmp_path / "automation" / "world" / "repair.py"
    current.parent.mkdir(parents=True)
    current.write_bytes(applied)
    monkeypatch.setattr(auditor, "ROOT", tmp_path)
    monkeypatch.setattr(auditor, "_file_at_commit", lambda sha, path: (True, applied, ""))
    monkeypatch.setattr(
        auditor,
        "_pr_changed_files",
        lambda number: ("automation/world/repair.py", "automation/world/unrelated.py"),
    )
    monkeypatch.setattr(auditor, "run_tests", lambda argv: (True, "1 passed"))
    monkeypatch.setattr(auditor, "is_protected_path", lambda path: False)
    monkeypatch.setattr(auditor, "_run", lambda argv, timeout=120: (True, ""))

    result = auditor.audit_pr(_pr(receipt))
    assert result["pass_declared"] is False
    assert result["audit_votes"]["META"]["passed"] is True
    assert result["audit_votes"]["X"]["passed"] is False
    assert result["audit_votes"]["SENJU"]["passed"] is True


def test_senju_audit_rejects_protected_control_target(monkeypatch, tmp_path):
    applied = b"x = 1\n"
    selected_sha = hashlib.sha256(applied).hexdigest()
    receipt = _receipt(selected_sha=selected_sha)
    receipt["output_file"] = "automation/world/authority_checkpoint.py"
    current = tmp_path / receipt["output_file"]
    current.parent.mkdir(parents=True)
    current.write_bytes(applied)
    monkeypatch.setattr(auditor, "ROOT", tmp_path)
    monkeypatch.setattr(auditor, "_file_at_commit", lambda sha, path: (True, applied, ""))
    monkeypatch.setattr(auditor, "_pr_changed_files", lambda number: (receipt["output_file"],))
    monkeypatch.setattr(auditor, "run_tests", lambda argv: (True, "1 passed"))
    monkeypatch.setattr(auditor, "is_protected_path", lambda path: True)
    monkeypatch.setattr(auditor, "_run", lambda argv, timeout=120: (True, ""))

    result = auditor.audit_pr(_pr(receipt))
    assert result["pass_declared"] is False
    assert result["audit_votes"]["SENJU"]["passed"] is False
