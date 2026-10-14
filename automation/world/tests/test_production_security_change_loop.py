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


def _envelopes(tmp_path: Path, grants: list[dict]) -> Path:
    root = tmp_path / "authority_envelopes"
    root.mkdir()
    _write(
        root / "owner.json",
        {
            "schema": "the-world-standing-authority-envelope/v1",
            "id": "test-owner-standing-delegation",
            "owner_namespace": "MusicJapanLLC/test",
            "enabled": True,
            "grants": grants,
        },
    )
    return root


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

    result = run_production_security_change_loop(state, authority_envelope_dir=None)
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


def test_predelegated_external_host_activates_after_ai_consensus(tmp_path: Path) -> None:
    host = "kabeya-authorized-test-range.onrender.com"
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-host-delegated",
                "proposer": "META",
                "change_kind": "new_external_host",
                "authority_relation": "broader",
                "requested_changes": {"host": host},
                "reason": "activate host already delegated by owner standing envelope",
            }
        ],
    )
    envelopes = _envelopes(
        tmp_path,
        [
            {
                "target": "authority_policy",
                "operation": "add_external_host",
                "parameters": {"host": host},
            }
        ],
    )

    result = run_production_security_change_loop(state, authority_envelope_dir=envelopes)
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())
    owner = json.loads((state / "owner_authority_required.json").read_text())
    receipts = json.loads((state / "production_security_change_receipts.json").read_text())

    assert result["production_applied_count"] == 1
    assert result["delegated_authority_applied_count"] == 1
    assert result["owner_authority_required_count"] == 0
    assert owner["items"] == []
    applied = next(iter(runtime["applied"].values()))
    assert applied["approval"] == "ai_consensus_predelegated_owner_authority"
    assert applied["delegated_authority_activation"] is True
    assert applied["delegation_envelope_id"] == "test-owner-standing-delegation"
    assert applied["creates_new_owner_authority"] is False
    row = receipts["receipts"][0]
    assert row["ai_consensus"]["delegated_activation_consensus"] is True
    assert row["status"] == "DELEGATED_OWNER_AUTHORITY_PRODUCTION_APPLIED"
    assert row["production_apply"] is True


def test_predelegated_credential_reference_can_activate_without_secret_material(tmp_path: Path) -> None:
    credential_reference = "vault://musicjapan/test-api"
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-credential-ref",
                "proposer": "X",
                "change_kind": "new_credential",
                "authority_relation": "broader",
                "requested_changes": {"credential_reference": credential_reference},
            }
        ],
    )
    envelopes = _envelopes(
        tmp_path,
        [
            {
                "target": "credential_broker",
                "operation": "register_credential_reference",
                "parameters": {"credential_reference": credential_reference},
            }
        ],
    )

    result = run_production_security_change_loop(state, authority_envelope_dir=envelopes)
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())

    assert result["delegated_authority_applied_count"] == 1
    applied = next(iter(runtime["applied"].values()))
    assert applied["requested_changes"] == {"credential_reference": credential_reference}
    assert applied["delegated_authority_activation"] is True
    assert applied["creates_new_owner_authority"] is False


def test_unmatched_external_host_still_requires_owner(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-host-unmatched",
                "proposer": "SENJU",
                "change_kind": "new_external_host",
                "authority_relation": "broader",
                "requested_changes": {"host": "unrelated.example"},
            }
        ],
    )
    envelopes = _envelopes(
        tmp_path,
        [
            {
                "target": "authority_policy",
                "operation": "add_external_host",
                "parameters": {"host": "kabeya-authorized-test-range.onrender.com"},
            }
        ],
    )

    result = run_production_security_change_loop(state, authority_envelope_dir=envelopes)
    owner = json.loads((state / "owner_authority_required.json").read_text())
    runtime = json.loads((state / "security_runtime_overrides.json").read_text())

    assert result["production_applied_count"] == 0
    assert result["delegated_authority_applied_count"] == 0
    assert result["owner_authority_required_count"] == 1
    assert runtime["applied"] == {}
    assert owner["items"][0]["status"] == "OWNER_AUTHORITY_REQUIRED"


def test_raw_credential_value_never_activates_via_delegation(tmp_path: Path) -> None:
    state = _state(
        tmp_path,
        [
            {
                "finding_id": "f-raw-secret",
                "proposer": "META",
                "change_kind": "new_credential",
                "authority_relation": "broader",
                "requested_changes": {
                    "credential_reference": "vault://musicjapan/test-api",
                    "token": "synthetic-secret-value",
                },
            }
        ],
    )
    envelopes = _envelopes(
        tmp_path,
        [
            {
                "target": "credential_broker",
                "operation": "register_credential_reference",
                "parameters": {"credential_reference": "vault://musicjapan/test-api"},
            }
        ],
    )

    result = run_production_security_change_loop(state, authority_envelope_dir=envelopes)
    owner = json.loads((state / "owner_authority_required.json").read_text())

    assert result["delegated_authority_applied_count"] == 0
    assert result["owner_authority_required_count"] == 1
    assert owner["items"][0]["raw_secret_material_detected"] is True


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

    result = run_production_security_change_loop(state, authority_envelope_dir=None)
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


def test_all_requested_privilege_classes_are_owner_gated_without_delegation(tmp_path: Path) -> None:
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

    result = run_production_security_change_loop(state, authority_envelope_dir=None)
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

    result = run_production_security_change_loop(state, authority_envelope_dir=None)
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

    result = run_production_security_change_loop(state, authority_envelope_dir=None)
    receipts = json.loads((state / "production_security_change_receipts.json").read_text())

    assert result["next_finding_enabled"] is True
    assert receipts["receipts"][0]["next_finding_enabled"] is True
