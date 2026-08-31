from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

from senju.meta import credential_broker as meta_broker


ROOT = Path(__file__).resolve().parents[2]
X_BROKER_PATH = ROOT / "automation" / "codegen" / "engine" / "credential_broker.py"


def _load_x_broker():
    spec = importlib.util.spec_from_file_location("x_credential_broker_test", X_BROKER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _policy() -> dict:
    return {
        "schema": "test/v2",
        "max_lease_seconds": 300,
        "max_delegation_seconds": 180,
        "renewal_margin_seconds": 30,
        "failure_cooldown_base_seconds": 30,
        "max_failure_cooldown_seconds": 120,
        "auto_select_from_authority": True,
        "systems": {
            "META": {
                "enabled": True,
                "default_capabilities": [],
                "allowed_capabilities": ["pr_write", "pr_write_backup", "admin_bad"],
            },
            "X": {
                "enabled": True,
                "default_capabilities": [],
                "allowed_capabilities": ["pr_write", "pr_write_backup", "admin_bad"],
            },
        },
        "capabilities": {
            "pr_write": {
                "credential_ref": "runtime:test-primary",
                "provider": "github",
                "scopes": ["repo:read", "repo:write:pr"],
                "materialization": "runtime_only",
                "delegable": True,
                "priority": 10,
            },
            "pr_write_backup": {
                "credential_ref": "runtime:test-backup",
                "provider": "github",
                "scopes": ["repo:read", "repo:write:pr"],
                "materialization": "runtime_only",
                "delegable": True,
                "priority": 20,
            },
            "admin_bad": {
                "credential_ref": "runtime:must-never-materialize",
                "provider": "github",
                "scopes": ["repo:admin", "credentials:read"],
                "materialization": "runtime_only",
                "delegable": True,
                "priority": 1,
            },
        },
        "never_broker": [],
        "never_broker_scopes": [],
        "never_delegate_scopes": [],
    }


def _configure_paths(broker, tmp_path, monkeypatch):
    authority_file = tmp_path / "authority.json"
    authority_file.write_text(json.dumps({"active_scopes": ["repo:write:pr"]}), encoding="utf-8")
    monkeypatch.setattr(broker, "AUTHORITY_STATE_FILE", authority_file)
    monkeypatch.setattr(broker, "HEALTH_FILE", tmp_path / "health.json")
    monkeypatch.setattr(broker, "AUDIT_FILE", tmp_path / "audit.ndjson")


@pytest.mark.parametrize("which", ["META", "X"])
def test_auto_selects_registered_least_privilege_capability_and_never_secret_material(tmp_path, monkeypatch, which):
    broker = meta_broker if which == "META" else _load_x_broker()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    state_file = tmp_path / "state.json"
    _configure_paths(broker, tmp_path, monkeypatch)

    lease = broker.lease_capabilities(policy_file=policy_file, state_file=state_file)
    names = [item["capability"] for item in lease["leases"]]

    assert names == ["pr_write"]
    assert lease["auto_selected_capabilities"] == ["pr_write"]
    assert lease["automatic_failover"] is True
    assert lease["automatic_renewal"] is True
    assert lease["raw_secret_material"] is False
    assert lease["oauth_scope_mutation"] is False
    assert lease["administrator_escalation"] is False


@pytest.mark.parametrize("which", ["META", "X"])
def test_failed_primary_enters_cooldown_and_next_healthy_handle_is_selected(tmp_path, monkeypatch, which):
    broker = meta_broker if which == "META" else _load_x_broker()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    _configure_paths(broker, tmp_path, monkeypatch)

    first = broker.lease_capabilities(policy_file=policy_file, state_file=tmp_path / "first.json")
    assert first["auto_selected_capabilities"] == ["pr_write"]

    result = broker.record_capability_result(
        "pr_write", False, reason="runtime credential handle failed", policy_file=policy_file
    )
    assert result["status"] == "cooldown"

    second = broker.lease_capabilities(policy_file=policy_file, state_file=tmp_path / "second.json")
    assert second["auto_selected_capabilities"] == ["pr_write_backup"]
    assert [item["capability"] for item in second["leases"]] == ["pr_write_backup"]


@pytest.mark.parametrize("which", ["META", "X"])
def test_live_lease_is_reused_then_renewed_when_margin_requires_it(tmp_path, monkeypatch, which):
    broker = meta_broker if which == "META" else _load_x_broker()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    state_file = tmp_path / "state.json"
    _configure_paths(broker, tmp_path, monkeypatch)

    broker.lease_capabilities(policy_file=policy_file, state_file=state_file)
    reused = broker.renew_capabilities(
        min_remaining_seconds=0, policy_file=policy_file, state_file=state_file
    )
    assert reused["renewed"] is False

    renewed = broker.renew_capabilities(
        min_remaining_seconds=999999, policy_file=policy_file, state_file=state_file
    )
    assert renewed["renewed"] is True
    assert [item["capability"] for item in renewed["leases"]] == ["pr_write"]


@pytest.mark.parametrize("which", ["META", "X"])
def test_hard_denies_admin_and_credential_scopes_even_if_policy_accidentally_allows_them(tmp_path, monkeypatch, which):
    broker = meta_broker if which == "META" else _load_x_broker()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    _configure_paths(broker, tmp_path, monkeypatch)

    assert broker.discover_capabilities(["repo:admin"], policy_file=policy_file) == []

    lease = broker.lease_capabilities(
        requested=["admin_bad"], policy_file=policy_file, state_file=tmp_path / "state.json"
    )
    assert lease["leases"] == []
    assert lease["denied"] == ["admin_bad"]

    delegated = broker.delegate_capability(
        "admin_bad", recipient="X" if which == "META" else "META", policy_file=policy_file
    )
    assert delegated["status"] == "denied"
    assert "forbidden_scope" in delegated["reasons"]


@pytest.mark.parametrize("which", ["META", "X"])
def test_delegation_is_opaque_and_never_transfers_token_material(tmp_path, monkeypatch, which):
    broker = meta_broker if which == "META" else _load_x_broker()
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(_policy()), encoding="utf-8")
    _configure_paths(broker, tmp_path, monkeypatch)

    delegated = broker.delegate_capability(
        "pr_write", recipient="X" if which == "META" else "META", policy_file=policy_file
    )
    assert delegated["status"] == "delegated"
    assert delegated["delegation_mode"] == "independent_materialization"
    assert delegated["raw_secret_material"] is False
    assert delegated["token_transfer"] is False
    assert delegated["oauth_scope_mutation"] is False
