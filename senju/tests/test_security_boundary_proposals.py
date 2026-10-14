from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from senju.meta import security_boundary_proposals as proposals


ROOT = Path(__file__).resolve().parents[2]
X_ADAPTER = ROOT / "automation" / "codegen" / "engine" / "security_boundary_proposals.py"


def _policy() -> dict:
    return {
        "schema": "test/v1",
        "systems": {"META": {"enabled": True}, "X": {"enabled": True}},
        "max_patch_bytes": 4096,
        "allowed_target_patterns": [
            "**/safety.py",
            "**/AUTHORIZED_TARGETS.md",
            "senju/config/credential-broker-policy.json",
            ".github/workflows/*.yml",
        ],
        "audit": {
            "independent_audit_required": True,
            "exact_head_sha_required": True,
            "security_boundary_marker_required": True,
            "self_approval_allowed": False,
            "self_merge_allowed": False,
            "direct_default_branch_write_allowed": False,
        },
    }


def _load_x_adapter():
    spec = importlib.util.spec_from_file_location("x_boundary_proposal_test", X_ADAPTER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_meta_can_stage_safety_change_but_never_apply_or_self_approve(tmp_path, monkeypatch):
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    proposal_dir = tmp_path / "proposals"
    monkeypatch.setattr(proposals, "AUDIT_FILE", tmp_path / "audit.ndjson")

    result = proposals.stage_proposal(
        "META",
        "senju/senju/safety.py",
        "improve a safety policy invariant",
        "@@ example patch @@",
        policy_file=policy_file,
        proposal_dir=proposal_dir,
    )

    assert result["status"] == "requires_independent_audit"
    assert result["security_boundary_change"] is True
    assert result["applied"] is False
    assert result["direct_default_branch_write"] is False
    assert result["self_approval"] is False
    assert result["self_merge"] is False
    assert result["independent_audit_required"] is True
    assert result["exact_head_sha_required"] is True
    assert (proposal_dir / f"{result['proposal_id']}.json").exists()


def test_boundary_proposal_rejects_non_boundary_target(tmp_path, monkeypatch):
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    monkeypatch.setattr(proposals, "AUDIT_FILE", tmp_path / "audit.ndjson")

    result = proposals.stage_proposal(
        "META",
        "README.md",
        "ordinary documentation",
        "patch",
        policy_file=policy_file,
        proposal_dir=tmp_path / "proposals",
    )

    assert result["status"] == "rejected"
    assert result["applied"] is False
    assert "target_not_in_security_boundary_proposal_allowlist" in result["reasons"]


def test_cycle_report_stages_multiple_security_boundary_proposals(tmp_path, monkeypatch):
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    proposal_dir = tmp_path / "proposals"
    monkeypatch.setattr(proposals, "AUDIT_FILE", tmp_path / "audit.ndjson")

    staged = proposals.stage_from_cycle_report(
        "META",
        {
            "security_boundary_proposals": [
                {
                    "target_path": "senju/config/credential-broker-policy.json",
                    "rationale": "reduce credential routing errors",
                    "proposed_patch": "credential policy candidate patch",
                },
                {
                    "target_path": ".github/workflows/security-guard.yml",
                    "rationale": "make audit evidence deterministic",
                    "proposed_patch": "workflow candidate patch",
                },
            ]
        },
        policy_file=policy_file,
        proposal_dir=proposal_dir,
    )

    assert len(staged) == 2
    assert all(item["status"] == "requires_independent_audit" for item in staged)
    assert all(item["applied"] is False for item in staged)


def test_x_adapter_uses_same_proposal_only_boundary(monkeypatch, tmp_path):
    x = _load_x_adapter()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    proposal_dir = tmp_path / "proposals"
    monkeypatch.setattr(proposals, "AUDIT_FILE", tmp_path / "audit.ndjson")
    x.stage_proposal.__globals__["AUDIT_FILE"] = tmp_path / "audit.ndjson"

    assert x.is_security_boundary_target(
        "security/AUTHORIZED_TARGETS.md", policy_file=policy_file
    ) is True
    result = x.stage_x_proposal(
        "security/AUTHORIZED_TARGETS.md",
        "authorized-target policy improvement",
        "target registry candidate patch",
        policy_file=policy_file,
        proposal_dir=proposal_dir,
    )
    assert result["system"] == "X"
    assert result["status"] == "requires_independent_audit"
    assert result["applied"] is False
    assert result["self_approval"] is False
