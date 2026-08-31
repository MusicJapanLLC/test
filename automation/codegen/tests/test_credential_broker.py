from __future__ import annotations

import json
import sys
from pathlib import Path

CODEGEN_DIR = Path(__file__).resolve().parents[1]
if str(CODEGEN_DIR) not in sys.path:
    sys.path.insert(0, str(CODEGEN_DIR))

from engine import credential_broker


def test_x_broker_leases_only_registered_capability_handles(tmp_path, monkeypatch) -> None:
    policy = {
        "max_lease_seconds": 300,
        "systems": {
            "X": {
                "enabled": True,
                "default_capabilities": ["codegen_queue_write"],
                "allowed_capabilities": ["codegen_queue_write"],
            }
        },
        "capabilities": {
            "codegen_queue_write": {
                "credential_ref": "internal:x-codegen-capability",
                "provider": "internal",
                "scopes": ["codegen:queue:write"],
                "materialization": "capability_handle",
            }
        },
        "never_broker": [
            "credential_discovery",
            "raw_token_read",
            "administrator_credential",
            "oauth_scope_expand",
            "secret_write",
            "credential_exchange_external",
        ],
    }
    policy_file = tmp_path / "policy.json"
    state_file = tmp_path / "state.json"
    audit_file = tmp_path / "audit.ndjson"
    policy_file.write_text(json.dumps(policy), encoding="utf-8")
    monkeypatch.setattr(credential_broker, "AUDIT_FILE", audit_file)

    result = credential_broker.lease_capabilities(
        [
            "codegen_queue_write",
            "credential_discovery",
            "raw_token_read",
            "administrator_credential",
            "oauth_scope_expand",
            "secret_write",
            "credential_exchange_external",
        ],
        policy_file=policy_file,
        state_file=state_file,
    )

    assert [x["capability"] for x in result["leases"]] == ["codegen_queue_write"]
    assert set(result["denied"]) == {
        "credential_discovery",
        "raw_token_read",
        "administrator_credential",
        "oauth_scope_expand",
        "secret_write",
        "credential_exchange_external",
    }
    assert result["raw_secret_material"] is False
    assert result["oauth_scope_mutation"] is False
    assert result["credential_discovery"] is False
    assert result["administrator_escalation"] is False
