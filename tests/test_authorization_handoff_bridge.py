from __future__ import annotations

import json
from pathlib import Path

from senju.authorization_handoff_bridge import bridge_authorization_handoffs


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_bridges_issued_authorization_into_reviewed_lease(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "negotiation_authorization_handoffs.json",
        {
            "handoffs": [
                {
                    "authorization": {
                        "authorization_id": "auth-1",
                        "host": "new-owned.example",
                        "authority_effect": "authorization_issued",
                        "allowed_methods": ["GET", "HEAD", "POST"],
                        "credential_scope": "none",
                        "private_network": False,
                        "expires_at": "2030-01-01T00:00:00+00:00",
                        "authorization_basis": "verified_cloud_control",
                        "proof_ref": "provider:service-1",
                    },
                    "requested_authority": {"host": "new-owned.example"},
                }
            ]
        },
    )
    _write(state / "reviewed_authority_operational_leases.json", {"leases": []})

    result = bridge_authorization_handoffs(state)
    leases = json.loads((state / "reviewed_authority_operational_leases.json").read_text())["leases"]

    assert result["closed_loop"] is True
    assert result["bridged_count"] == 1
    assert leases[0]["host"] == "new-owned.example"
    assert leases[0]["allowed_methods"] == ["GET", "HEAD"]
    assert leases[0]["same_or_narrower"] is True


def test_rejects_unissued_or_private_network_handoff(tmp_path: Path) -> None:
    state = tmp_path / "state"
    _write(
        state / "negotiation_authorization_handoffs.json",
        {
            "handoffs": [
                {
                    "authorization": {
                        "authorization_id": "auth-2",
                        "host": "bad.example",
                        "authority_effect": "none",
                        "allowed_methods": ["GET"],
                        "credential_scope": "none",
                        "private_network": False,
                        "expires_at": "2030-01-01T00:00:00+00:00",
                    },
                    "requested_authority": {"host": "bad.example"},
                },
                {
                    "authorization": {
                        "authorization_id": "auth-3",
                        "host": "private.example",
                        "authority_effect": "authorization_issued",
                        "allowed_methods": ["GET"],
                        "credential_scope": "none",
                        "private_network": True,
                        "expires_at": "2030-01-01T00:00:00+00:00",
                    },
                    "requested_authority": {"host": "private.example"},
                },
            ]
        },
    )
    _write(state / "reviewed_authority_operational_leases.json", {"leases": []})

    result = bridge_authorization_handoffs(state)
    leases = json.loads((state / "reviewed_authority_operational_leases.json").read_text())["leases"]

    assert result["bridged_count"] == 0
    assert leases == []
