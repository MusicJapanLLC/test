from __future__ import annotations

import json
from pathlib import Path

from automation.world.production_security_change_loop import run_production_security_change_loop


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _state(tmp_path: Path, findings: list[dict]) -> Path:
    state = tmp_path / "state"
    state.mkdir()
    _write(state / "security_findings.json", {"findings": findings})
    return state


def test_same_or_narrower_change_self_approves_and_applies(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-safe-1",
                "proposer": "META",
                "change_kind": "retry_tuning",
                "authority_relation": "same_or_narrower",
                "requested_changes": {"max_retries": 2},
                "reason": "authorized read-only transport is flaky",
            }
        ],
    )

    result = run_production_security_change_loop(state)
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())
    receipts = json.loads((state / "production_security_change_receipts.json").read_text())

    assert result["production_applied_count"] == 1
    assert result["owner_authority_required_count"] == 0
    assert result["authority_expansion_self_approval"] is False
    assert len(runtime["applied"]) == 1
    row = receipts["receipts"][0]
    assert row["self_approved"] is True
    assert row["production_apply"] is True
    assert row["status"] == "production_applied"
    assert row["ai_consensus"]["self_approval_consensus"] is True
    assert row["ai_consensus"]["consensus_creates_authority"] is False


def test_authority_expansion_gets_consensus_but_requires_owner(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-root-1",
                "proposer": "META",
                "change_kind": "trusted_root_addition",
                "authority_relation": "broader",
                "requested_changes": {"trusted_root": "third-party.example"},
                "reason": "new target discovered",
            }
        ],
    )

    result = run_production_security_change_loop(state)
    owner = json.loads((state / "owner_authority_required.json").read_text())
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())

    assert result["production_applied_count"] == 0
    assert result["owner_authority_required_count"] == 1
    assert runtime["applied"] == {}
    row = owner["items"][0]
    assert row["status"] == "OWNER_AUTHORITY_REQUIRED"
    assert row["ai_consensus"]["quality_consensus"] is True
    assert row["ai_consensus"]["self_approval_consensus"] is False
    assert row["automatic_production_apply"] is False


def test_all_requested_privilege_classes_are_owner_gated(tmp_path: Path) -> None:
    kinds = [
        "new_external_host",
        "new_provider",
        "new_credential",
        "new_repository",
        "new_cloud_account",
        "new_organization",
        "new_cidr",
        "private_network_access",
        "broader_api_methods",
        "trusted_root_addition",
        "deploy_target_addition",
        "branch_protection_change",
        "deployment_protection_change",
        "authority_registry_change",
    ]
    findings = [
        {
            "finding_id": f"f-{kind}",
            "proposer": "X",
            "change_kind": kind,
            "authority_relation": "broader",
            "requested_changes": {"requested": kind},
        }
        for kind in kinds
    ]
    state = _state(tmp_path, findings)

    result = run_production_security_change_loop(state)
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())
    owner = json.loads((state / "owner_authority_required.json").read_text())

    assert result["production_applied_count"] == 0
    assert result["owner_authority_required_count"] == len(kinds)
    assert len(owner["items"]) == len(kinds)
    assert runtime["applied"] == {}
    assert all(item["status"] == "OWNER_AUTHORITY_REQUIRED" for item in owner["items"])


def test_textual_broadening_cannot_hide_inside_safe_kind(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-hidden",
                "proposer": "SENJU",
                "change_kind": "retry_tuning",
                "authority_relation": "same_or_narrower",
                "requested_changes": {
                    "max_retries": 3,
                    "note": "also add trusted root third-party.example",
                },
            }
        ],
    )

    result = run_production_security_change_loop(state)
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())

    assert result["production_applied_count"] == 0
    assert result["owner_authority_required_count"] == 1
    assert runtime["applied"] == {}


def test_closed_loop_keeps_next_finding_enabled(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-audit",
                "proposer": "META",
                "change_kind": "audit_strengthening",
                "authority_relation": "same_or_narrower",
                "requested_changes": {"receipt_detail": "full"},
            }
        ],
    )

    result = run_production_security_change_loop(state)
    receipts = json.loads((state / "production_security_change_receipts.json").read_text())

    assert result["next_finding_enabled"] is True
    assert receipts["receipts"][0]["next_finding_enabled"] is True
