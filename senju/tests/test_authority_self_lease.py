from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from senju.meta import authority_lease as meta_lease


REPO_ROOT = Path(__file__).resolve().parents[2]
X_MODULE_PATH = REPO_ROOT / "automation" / "codegen" / "engine" / "authority_lease.py"


def _load_x_module():
    spec = importlib.util.spec_from_file_location("x_authority_lease_test_module", X_MODULE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _policy(path: Path) -> Path:
    payload = {
        "max_lease_seconds": 600,
        "max_active_scopes": 4,
        "systems": {
            "META": {
                "enabled": True,
                "preauthorized_scopes": ["repo:read", "repo:write:pr"],
                "default_requested_scopes": ["repo:read", "repo:write:pr"],
            },
            "X": {
                "enabled": True,
                "preauthorized_scopes": ["repo:read", "codegen:queue:write"],
                "default_requested_scopes": ["repo:read", "codegen:queue:write"],
            },
        },
        "never_self_grant": [
            "credentials:read",
            "security-policy:write",
            "target-scope:expand",
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_meta_self_lease_only_activates_preauthorized_scope(tmp_path, monkeypatch) -> None:
    policy = _policy(tmp_path / "policy.json")
    monkeypatch.setattr(meta_lease, "AUDIT_FILE", tmp_path / "meta-audit.ndjson")

    result = meta_lease.refresh_authority_lease(
        ["repo:read", "credentials:read", "security-policy:write", "target-scope:expand"],
        policy_file=policy,
        state_file=tmp_path / "meta-state.json",
    )

    assert result["active_scopes"] == ["repo:read"]
    assert set(result["denied_scopes"]) == {
        "credentials:read",
        "security-policy:write",
        "target-scope:expand",
    }
    assert result["self_activated"] is True
    assert result["preauthorized_only"] is True
    assert result["external_permission_mutation"] is False


def test_x_self_lease_only_activates_preauthorized_scope(tmp_path) -> None:
    x_lease = _load_x_module()
    policy = _policy(tmp_path / "policy.json")
    x_lease.AUDIT_FILE = tmp_path / "x-audit.ndjson"

    result = x_lease.refresh_authority_lease(
        ["codegen:queue:write", "credentials:read", "security-policy:write", "target-scope:expand"],
        policy_file=policy,
        state_file=tmp_path / "x-state.json",
    )

    assert result["active_scopes"] == ["codegen:queue:write"]
    assert set(result["denied_scopes"]) == {
        "credentials:read",
        "security-policy:write",
        "target-scope:expand",
    }
    assert result["self_activated"] is True
    assert result["preauthorized_only"] is True
    assert result["external_permission_mutation"] is False
