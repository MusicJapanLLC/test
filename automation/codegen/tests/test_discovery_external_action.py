from __future__ import annotations

import json
import time
from pathlib import Path
from types import SimpleNamespace

from engine import discovery_external_action as module


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _lease(now: int) -> dict:
    return {
        "lease_id": "lease-1",
        "target": "owner.example",
        "url": "https://owner.example/",
        "authorization_reference": "canonical:owner",
        "authorization_basis": "trusted_root",
        "capability_authorization_profile": "owner.example",
        "capability_inherited_from_owner_root": False,
        "capabilities": ["scan", "probe", "write", "mutation"],
        "credential_scope": "none",
        "shared_with": ["META", "X", "SENJU", "CHILD", "AI"],
        "issued_at": now - 10,
        "expires_at": now + 3600,
        "source_action_fingerprint": "abc123",
        "status": "active",
    }


def _policy() -> dict:
    return {
        "schema": "meta-discovery-policy/v3",
        "action_profiles": {
            "owner.example": {
                "owner_authorization": "explicit",
                "capabilities": ["scan", "probe", "write", "mutation"],
                "credential_scope": "none",
                "external_actions": {
                    "write": [
                        {
                            "id": "write-1",
                            "method": "POST",
                            "path": "/synthetic/write",
                            "content_type": "application/json",
                            "body": "{\"synthetic\":true}",
                        }
                    ],
                    "mutation": [
                        {
                            "id": "put-1",
                            "method": "PUT",
                            "path": "/synthetic/item",
                            "content_type": "application/json",
                            "body": "{\"synthetic\":true}",
                        },
                        {
                            "id": "patch-1",
                            "method": "PATCH",
                            "path": "/synthetic/item",
                            "content_type": "application/json",
                            "body": "{\"synthetic\":true,\"v\":2}",
                        },
                        {
                            "id": "delete-1",
                            "method": "DELETE",
                            "path": "/synthetic/item",
                            "content_type": "application/json",
                            "body": None,
                        },
                    ],
                },
            }
        },
    }


def test_live_discovery_lease_executes_fixed_owner_synthetic_actions(tmp_path: Path, monkeypatch) -> None:
    now = int(time.time())
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    _write(state / "discovery_policy.json", _policy())
    _write(
        state / "discovery_capability_leases.json",
        {"schema": "meta-discovery-capability-leases/v1", "leases": [_lease(now)]},
    )
    _write(
        repo / "AUTHORIZED_TEST_TARGETS.json",
        {
            "targets": [
                {
                    "host": "owner.example",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
                }
            ]
        },
    )

    calls: list[tuple[str, str]] = []

    class FakeClient:
        def __init__(self, policy):
            self.policy = policy

        def contact_with_body(self, url, *, method, body=None, headers=None):
            calls.append((method, url))
            return SimpleNamespace(
                body=b"ok",
                receipt=SimpleNamespace(
                    status=200,
                    final_url=url,
                    response_sha256="00" * 32,
                ),
            )

    monkeypatch.setattr(module, "ExternalContactClient", FakeClient)
    result = module.run_discovery_external_actions(state, repo_root=repo, max_actions=8)

    assert result["attempted"] == 4
    assert result["succeeded"] == 4
    assert result["failed"] == 0
    assert result["denied_before_execution"] == 0
    assert [method for method, _ in calls] == ["POST", "PUT", "PATCH", "DELETE"]
    assert all(url.startswith("https://owner.example/") for _, url in calls)


def test_canonical_method_ceiling_blocks_action_before_transport(tmp_path: Path, monkeypatch) -> None:
    now = int(time.time())
    state = tmp_path / "state"
    repo = tmp_path / "repo"
    _write(state / "discovery_policy.json", _policy())
    _write(
        state / "discovery_capability_leases.json",
        {"schema": "meta-discovery-capability-leases/v1", "leases": [_lease(now)]},
    )
    _write(
        repo / "AUTHORIZED_TEST_TARGETS.json",
        {
            "targets": [
                {
                    "host": "owner.example",
                    "owner_authorization": "explicit",
                    "allowed_interactions": ["POST", "PUT", "PATCH"],
                }
            ]
        },
    )

    calls: list[str] = []

    class FakeClient:
        def __init__(self, policy):
            self.policy = policy

        def contact_with_body(self, url, *, method, body=None, headers=None):
            calls.append(method)
            return SimpleNamespace(
                body=b"ok",
                receipt=SimpleNamespace(status=200, final_url=url, response_sha256="11" * 32),
            )

    monkeypatch.setattr(module, "ExternalContactClient", FakeClient)
    result = module.run_discovery_external_actions(state, repo_root=repo, max_actions=8)

    assert result["attempted"] == 3
    assert result["succeeded"] == 3
    assert result["denied_before_execution"] == 1
    assert calls == ["POST", "PUT", "PATCH"]
