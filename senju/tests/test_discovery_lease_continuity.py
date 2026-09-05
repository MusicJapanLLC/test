from __future__ import annotations

import json
from pathlib import Path

from senju.meta.discovery_lease_continuity import (
    continuity_target_from_discovery_grant,
    load_active_discovery_continuity_grants,
    stage_discovery_continuity_authority,
)


NOW = 1_788_174_600


def _write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _lease(*, target: str = "owner.example", expires_at: int = NOW + 3600, shared_with=None, credential_scope="none"):
    return {
        "lease_id": f"discovery:{target}:abc:{NOW}",
        "target": target,
        "url": f"https://{target}/",
        "authorization_reference": f"owner:test:{target}",
        "authorization_basis": "trusted_root",
        "capability_authorization_profile": target,
        "capability_inherited_from_owner_root": False,
        "capabilities": ["scan", "probe", "write", "mutation", "credentialed_action"],
        "credential_scope": credential_scope,
        "shared_with": shared_with or ["META", "X", "SENJU", "CHILD", "AI"],
        "issued_at": NOW,
        "expires_at": expires_at,
        "source_action_fingerprint": "abc",
        "status": "active",
    }


def test_active_discovery_lease_becomes_continuity_grant(tmp_path: Path) -> None:
    path = tmp_path / "leases.json"
    _write(
        path,
        {
            "schema": "meta-discovery-capability-leases/v1",
            "leases": [_lease(credential_scope="preapproved-service")],
        },
    )
    grants = load_active_discovery_continuity_grants(path, now=NOW)
    assert len(grants) == 1
    grant = grants[0]
    assert grant.target_host == "owner.example"
    assert grant.authorization_reference == "owner:test:owner.example"
    assert set(grant.capabilities) == {"scan", "probe", "write", "mutation", "credentialed_action"}
    assert grant.source_credential_scope == "preapproved-service"


def test_expired_or_unshared_lease_is_not_continuity_authority(tmp_path: Path) -> None:
    path = tmp_path / "leases.json"
    _write(
        path,
        {
            "schema": "meta-discovery-capability-leases/v1",
            "leases": [
                _lease(target="expired.example", expires_at=NOW - 1),
                _lease(target="unshared.example", shared_with=["CHILD"]),
            ],
        },
    )
    assert load_active_discovery_continuity_grants(path, now=NOW) == ()


def test_staged_continuity_evidence_is_exact_read_only_and_secret_free(tmp_path: Path) -> None:
    path = tmp_path / "leases.json"
    _write(
        path,
        {
            "schema": "meta-discovery-capability-leases/v1",
            "leases": [_lease(credential_scope="preapproved-service")],
        },
    )
    grant = load_active_discovery_continuity_grants(path, now=NOW)[0]
    destination = stage_discovery_continuity_authority(state_dir=tmp_path / "state", grant=grant)
    payload = json.loads(destination.read_text())
    row = payload["hosts"]["owner.example"]
    assert row["allowed_methods"] == ["GET", "HEAD"]
    assert row["credential_scope"] == "none"
    assert row["effect"] == "read_only"
    assert row["allow_delete"] is False
    assert row["raw_credential_inheritance"] is False
    assert row["scope_expansion"] is False
    assert row["source_credential_scope_present"] is True


def test_continuity_target_inherits_internal_worker_scopes_not_external_credentials(tmp_path: Path) -> None:
    path = tmp_path / "leases.json"
    _write(
        path,
        {
            "schema": "meta-discovery-capability-leases/v1",
            "leases": [_lease(credential_scope="preapproved-service")],
        },
    )
    grant = load_active_discovery_continuity_grants(path, now=NOW)[0]
    target = continuity_target_from_discovery_grant(
        grant,
        actor="META",
        desired_replicas=10,
        parent_scopes=["read:state", "write:state", "read:research", "write:research"],
    )
    assert target["target_host"] == "owner.example"
    assert target["desired_replicas"] == 10
    assert set(target["parent_scopes"]) == {
        "read:state",
        "write:state",
        "read:research",
        "write:research",
    }
    assert target["raw_credential_inheritance"] is False
    assert target["automatic_deployment_authority_from_discovery"] is False
    assert target["authority_origin"] == "active_discovery_capability_lease"
    assert "credentialed_action" in target["source_capabilities"]
