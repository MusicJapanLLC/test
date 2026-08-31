from __future__ import annotations

import json

from senju.meta import credential_broker


def test_meta_broker_leases_only_preauthorized_capability_handles(tmp_path, monkeypatch) -> None:
    policy = {
        "max_lease_seconds": 300,
        "systems": {
            "META": {
                "enabled": True,
                "default_capabilities": ["github_pr_automation"],
                "allowed_capabilities": ["github_pr_automation"],
            }
        },
        "capabilities": {
            "github_pr_automation": {
                "credential_ref": "runtime:github-actions-token",
                "provider": "github",
                "scopes": ["repo:read", "repo:write:pr"],
                "materialization": "runtime_only",
            }
        },
        "never_broker": [
            "credential_discovery",
            "raw_token_read",
            "administrator_credential",
            "oauth_scope_expand",
            "secret_write",
        ],
    }
    policy_file = tmp_path / "policy.json"
    state_file = tmp_path / "state.json"
    audit_file = tmp_path / "audit.ndjson"
    policy_file.write_text(json.dumps(policy), encoding="utf-8")
    monkeypatch.setattr(credential_broker, "AUDIT_FILE", audit_file)

    result = credential_broker.lease_capabilities(
        [
            "github_pr_automation",
            "credential_discovery",
            "raw_token_read",
            "administrator_credential",
            "oauth_scope_expand",
            "secret_write",
        ],
        policy_file=policy_file,
        state_file=state_file,
    )

    assert [x["capability"] for x in result["leases"]] == ["github_pr_automation"]
    assert set(result["denied"]) == {
        "credential_discovery",
        "raw_token_read",
        "administrator_credential",
        "oauth_scope_expand",
        "secret_write",
    }
    assert result["raw_secret_material"] is False
    assert result["oauth_scope_mutation"] is False
    assert result["credential_discovery"] is False
    assert result["administrator_escalation"] is False

    persisted = json.loads(state_file.read_text(encoding="utf-8"))
    serialized = json.dumps(persisted)
    assert "runtime:github-actions-token" in serialized
    assert "ghp_" not in serialized
    assert "github_pat_" not in serialized
    assert "Bearer " not in serialized
